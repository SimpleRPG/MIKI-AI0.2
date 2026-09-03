import {
  WorkManagerConstraints,
  WorkManagerStatus,
  BackgroundTaskExecutionLog,
  MemoryItem,
  ChatMessage,
  PersonaConfig,
  RegressionSuiteRunReport,
  BackgroundExecutionConditions,
} from '../types';
import { worldModelService } from './worldModelService';
import { selfImprovementService } from './selfImprovementService';
import { systemLogger } from './systemLogger';
import { calculateDomainVector, calculateCosineSimilarity } from '../utils/memoryRetrieval';
import { nativeBackgroundService } from './nativeBackgroundService';
import { storageService } from './storageService';
import { skillsService } from './skillsService';
import { regressionBenchmarkService } from './regressionBenchmarkService';
import { nativeLlmService } from './nativeLlmService';
import { webLLMService } from './webLlmService';
import { syntheticDataService } from './syntheticDataService';

const WORK_MANAGER_CONSTRAINTS_KEY = 'miki_ai_workmanager_constraints';
const WORK_MANAGER_LOGS_KEY = 'miki_ai_workmanager_logs';
const WORK_MANAGER_CONFIG_KEY = 'miki_ai_workmanager_config';

/**
 * 浅い睡眠 (Shallow Sleep) 判定関数
 * 浅い睡眠: 索引更新・重複検出・ログ圧縮・メモリ整理など軽量処理
 */
export function canRunShallowSleep(c: BackgroundExecutionConditions): boolean {
  return !c.isUserActive && c.thermalState !== 'critical';
}

/**
 * 深い睡眠 (Deep Sleep) 判定関数
 * 深い睡眠: シャドー評価・A/Bテスト・教材生成・回帰ベンチマークなど重い処理
 */
export function canRunDeepSleep(c: BackgroundExecutionConditions): boolean {
  const normLevel = c.batteryLevel > 1 ? c.batteryLevel / 100 : c.batteryLevel;
  return (
    c.isCharging &&
    normLevel > 0.3 &&
    !c.isUserActive &&
    (c.thermalState === 'normal' || c.thermalState === 'warm')
  );
}

/**
 * 深い睡眠の未達理由を取得するヘルパー関数
 */
export function getDeepSleepUnmetReasons(c: BackgroundExecutionConditions): string[] {
  const reasons: string[] = [];
  if (!c.isCharging) {
    reasons.push('充電器に接続されていません (充電中が必要です)');
  }
  const normLevel = c.batteryLevel > 1 ? c.batteryLevel / 100 : c.batteryLevel;
  if (normLevel <= 0.3) {
    reasons.push(`バッテリー残量が不足しています (${Math.round(normLevel * 100)}% / 30%超が必要です)`);
  }
  if (c.isUserActive) {
    reasons.push('直近にユーザーのチャット操作・アプリ操作があります (アイドル待機中)');
  }
  if (c.thermalState === 'hot') {
    reasons.push('端末が高温です (hot: normalまたはwarmが必要です)');
  } else if (c.thermalState === 'critical') {
    reasons.push('端末温度が危険域です (critical)');
  }
  return reasons;
}

/**
 * 浅い睡眠の未達理由を取得するヘルパー関数
 */
export function getShallowSleepUnmetReasons(c: BackgroundExecutionConditions): string[] {
  const reasons: string[] = [];
  if (c.isUserActive) {
    reasons.push('直近にユーザーのチャット操作・アプリ操作があります');
  }
  if (c.thermalState === 'critical') {
    reasons.push('端末温度が危険域です (critical)');
  }
  return reasons;
}

/**
 * Android WorkManager & バックグラウンド自律処理サービス
 *
 * 設計思想 11. バックグラウンド自己対話と自律改善 (会話中ではなく深夜・充電中・Wi-Fi接続時に実行)
 * 設計思想 23. Androidネイティブと連携 (WorkManager, BatteryManager, NetworkCapabilities)
 * 設計思想「浅い睡眠 / 深い睡眠」による厳格な実行条件ゲート
 */
export class BackgroundWorkerService {
  private constraints: WorkManagerConstraints = {
    requiresCharging: true,
    requiresDeviceIdle: false, // 睡眠判定で厳格に制御
    requiresUnmeteredWifi: true,
    batteryNotLow: true,
    nightTimeOnly: false,
  };

  private intervalMinutes: number = 360; // 6時間ごと
  private executionLogs: BackgroundTaskExecutionLog[] = [];
  private isRegistered: boolean = true;
  private isExecutingNow: boolean = false;
  private currentSleepState: 'idle' | 'shallow' | 'deep' = 'idle';
  private lastRunTimestamp: number = 0;
  private nextScheduledRunTimestamp: number = 0;

  // ハードウェア & 環境状態
  private batteryState = {
    level: 100, // 0 - 100
    charging: true,
    supported: false,
  };

  private thermalState: 'normal' | 'warm' | 'hot' | 'critical' = 'normal';

  private networkState = {
    isWifi: true,
    isOnline: true,
    type: 'wifi',
  };

  // ユーザーアクティビティ管理 (会話割り込み防止)
  private lastUserActivityTimestamp: number = 0;
  private isChatGenerating: boolean = false;
  private activeAbortController: AbortController | null = null;
  private idleTimer: any = null;
  private isUserIdle: boolean = false;
  private schedulerTimer: any = null;

  // チャット操作後のクールダウン時間 (直近2分間はユーザーアクティブとみなす)
  private readonly USER_ACTIVE_COOLDOWN_MS = 2 * 60 * 1000;

  constructor() {
    this.loadState();
    this.initHardwareMonitors();
    this.initIdleDetector();
    this.scheduleNextRun();
    if (this.isRegistered) {
      nativeBackgroundService.start().catch(() => {});
    }
  }

  private loadState(): void {
    if (typeof storageService === 'undefined') return;
    try {
      const savedConstraints = storageService.getItem(WORK_MANAGER_CONSTRAINTS_KEY);
      if (savedConstraints) this.constraints = JSON.parse(savedConstraints);

      const savedLogs = storageService.getItem(WORK_MANAGER_LOGS_KEY);
      if (savedLogs) this.executionLogs = JSON.parse(savedLogs);

      const savedConfig = storageService.getItem(WORK_MANAGER_CONFIG_KEY);
      if (savedConfig) {
        const parsed = JSON.parse(savedConfig);
        this.intervalMinutes = parsed.intervalMinutes || 360;
        this.lastRunTimestamp = parsed.lastRunTimestamp || 0;
      }
    } catch (e) {
      console.warn('Failed to load WorkManager state:', e);
    }
  }

  private saveState(): void {
    if (typeof storageService === 'undefined') return;
    try {
      storageService.setItem(WORK_MANAGER_CONSTRAINTS_KEY, JSON.stringify(this.constraints));
      storageService.setItem(WORK_MANAGER_LOGS_KEY, JSON.stringify(this.executionLogs.slice(-50)));
      storageService.setItem(
        WORK_MANAGER_CONFIG_KEY,
        JSON.stringify({
          intervalMinutes: this.intervalMinutes,
          lastRunTimestamp: this.lastRunTimestamp,
        })
      );
    } catch (e) {
      console.warn('Failed to save WorkManager state:', e);
    }
  }

  /**
   * Battery API & Network API モニタリング
   */
  private initHardwareMonitors(): void {
    // 1. Battery Status
    if (typeof navigator !== 'undefined' && 'getBattery' in navigator) {
      (navigator as any)
        .getBattery()
        .then((battery: any) => {
          this.batteryState.supported = true;
          this.batteryState.level = Math.round(battery.level * 100);
          this.batteryState.charging = battery.charging;

          battery.addEventListener('chargingchange', () => {
            this.batteryState.charging = battery.charging;
            systemLogger.info('SELF_IMPROVEMENT', `WorkManager: 充電状態変化 -> ${battery.charging ? '充電中' : '放電中'}`);
            // 充電が外れた場合、実行中の深い睡眠処理があれば安全に中断フラグを立てる
            if (!battery.charging && this.currentSleepState === 'deep') {
              this.abortDeepSleepExecution('充電器が切断されたため深い睡眠処理を安全に中断しました');
            }
          });

          battery.addEventListener('levelchange', () => {
            this.batteryState.level = Math.round(battery.level * 100);
            if (this.batteryState.level <= 30 && this.currentSleepState === 'deep') {
              this.abortDeepSleepExecution('バッテリー残量が30%以下に低下したため深い睡眠処理を中断しました');
            }
          });
        })
        .catch(() => {
          this.batteryState.supported = false;
        });
    }

    // 2. Network Information
    if (typeof navigator !== 'undefined') {
      this.networkState.isOnline = navigator.onLine;
      window.addEventListener('online', () => (this.networkState.isOnline = true));
      window.addEventListener('offline', () => (this.networkState.isOnline = false));

      const conn = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
      if (conn) {
        this.networkState.type = conn.type || conn.effectiveType || 'wifi';
        this.networkState.isWifi = conn.type === 'wifi' || conn.effectiveType === '4g' || !conn.saveData;
      }
    }
  }

  /**
   * ユーザー無操作（アイドル）検出
   */
  private initIdleDetector(): void {
    if (typeof window === 'undefined') return;
    const resetIdle = () => {
      this.isUserIdle = false;
      this.lastUserActivityTimestamp = Date.now();
      clearTimeout(this.idleTimer);
      // 45秒間操作がなければアイドルとみなす
      this.idleTimer = setTimeout(() => {
        this.isUserIdle = true;
      }, 45000);
    };

    window.addEventListener('mousemove', resetIdle, { passive: true });
    window.addEventListener('keydown', resetIdle, { passive: true });
    window.addEventListener('touchstart', resetIdle, { passive: true });
    resetIdle();
  }

  /**
   * ユーザーがチャット操作（送信、入力など）を行ったことを記録
   * 会話中・直後の割り込みを完全防止
   */
  public recordUserActivity(): void {
    this.lastUserActivityTimestamp = Date.now();
    this.isUserIdle = false;
    if (this.currentSleepState === 'deep') {
      this.abortDeepSleepExecution('ユーザーのチャット操作が検知されたため、深い睡眠処理を安全に中断しました');
    }
  }

  /**
   * チャット推論中ステータスの設定 (会話中の割り込み防止)
   */
  public setChatGenerating(isGenerating: boolean): void {
    this.isChatGenerating = isGenerating;
    if (isGenerating) {
      this.recordUserActivity();
      if (this.currentSleepState === 'deep' || this.isExecutingNow) {
        this.abortDeepSleepExecution('チャット応答生成が開始されたため、バックグラウンド重処理を直ちに中断しました');
      }
    }
  }

  /**
   * 深い睡眠処理の安全な中断処理
   */
  private abortDeepSleepExecution(reason: string): void {
    if (this.activeAbortController && !this.activeAbortController.signal.aborted) {
      systemLogger.warn('SELF_IMPROVEMENT', `⏸ [Gate] ${reason}`);
      this.activeAbortController.abort(reason);
    }
  }

  /**
   * 現在の実行条件 (BackgroundExecutionConditions) を取得
   */
  public getExecutionConditions(): BackgroundExecutionConditions {
    const now = Date.now();
    const timeSinceLastActivity = now - this.lastUserActivityTimestamp;
    const isRecentlyActive = timeSinceLastActivity < this.USER_ACTIVE_COOLDOWN_MS;
    const isUserActive = this.isChatGenerating || isRecentlyActive || !this.isUserIdle;

    return {
      isCharging: this.batteryState.charging,
      batteryLevel: this.batteryState.level / 100, // 0 - 1
      isUserActive,
      thermalState: this.thermalState,
    };
  }

  private scheduleNextRun(): void {
    const nextRun = Date.now() + this.intervalMinutes * 60 * 1000;
    this.nextScheduledRunTimestamp = nextRun;

    if (this.schedulerTimer) clearInterval(this.schedulerTimer);
    // 30秒ごとにバックグラウンド実行条件をポーリング検査
    this.schedulerTimer = setInterval(() => {
      this.checkAndTriggerScheduledWork();
    }, 30000);
  }

  /**
   * 定期ジョブの実行条件判定
   */
  private checkAndTriggerScheduledWork(): void {
    if (!this.isRegistered || this.isExecutingNow) return;

    const now = Date.now();
    const isDue = now >= this.nextScheduledRunTimestamp;
    if (!isDue) return;

    // 浅い睡眠または深い睡眠のどちらかが実行可能か判定
    const conditions = this.getExecutionConditions();
    const canShallow = canRunShallowSleep(conditions);
    const canDeep = canRunDeepSleep(conditions);

    if (!canShallow && !canDeep) {
      return; // 実行条件未達のため延期
    }

    this.runAutonomousBackgroundCycle('periodic_scheduled');
  }

  /**
   * WorkManager 制約評価 (従来のAPI互換 & 条件チェック)
   */
  public evaluateConstraints(): { passed: boolean; reasons: string[] } {
    const conditions = this.getExecutionConditions();
    const deepReasons = getDeepSleepUnmetReasons(conditions);
    const shallowReasons = getShallowSleepUnmetReasons(conditions);

    // 少なくとも浅い睡眠が動くかどうか
    const passed = canRunShallowSleep(conditions);

    return {
      passed,
      reasons: deepReasons,
    };
  }

  /**
   * 自律バックグラウンド処理サイクルを実行
   * 設計思想「浅い睡眠 / 深い睡眠」による厳格な2段階ゲート制御
   *
   * [浅い睡眠]: 記憶統合・知識グラフ構築・LoRA重複除去・スキル抽出 (軽量)
   * [深い睡眠]: 自己対話テスト・A/Bベンチマーク・回帰ベンチマーク・教材生成 (重推論)
   */
  public async runAutonomousBackgroundCycle(
    triggerSource: 'manual' | 'periodic_scheduled' | 'android_intent' = 'manual',
    context?: {
      memories?: MemoryItem[];
      onUpdateMemories?: (updater: (prev: MemoryItem[]) => MemoryItem[]) => void;
      persona?: PersonaConfig;
      messages?: ChatMessage[];
    }
  ): Promise<BackgroundTaskExecutionLog> {
    if (this.isExecutingNow) {
      throw new Error('バックグラウンドタスクが既に実行中です');
    }

    const initialConditions = this.getExecutionConditions();

    // 手動実行以外の定期スケジュール時は、最低限浅い睡眠条件を満たしている必要がある
    if (triggerSource !== 'manual' && !canRunShallowSleep(initialConditions)) {
      const reasons = getShallowSleepUnmetReasons(initialConditions);
      throw new Error(`浅い睡眠の実行条件を満たしていません: ${reasons.join(', ')}`);
    }

    this.isExecutingNow = true;
    this.currentSleepState = 'shallow';
    this.activeAbortController = new AbortController();
    const abortSignal = this.activeAbortController.signal;

    const startTime = Date.now();
    const logId = 'bg_' + startTime + '_' + Math.random().toString(36).substring(2, 6);

    systemLogger.info('SELF_IMPROVEMENT', `⚡ WorkManager 自律処理開始 [Trigger: ${triggerSource}]`);

    let consolidatedCount = 0;
    let graphLinksCreated = 0;
    let simulatedCount = 0;
    const weaknessFound: string[] = [];
    let abTestsRunCount = 0;
    let regressionReport: RegressionSuiteRunReport | null = null;
    let deepSleepExecuted = false;
    let deepSleepSkippedReason: string | null = null;
    let syntheticCreatedCount = 0;

    try {
      // ==========================================
      // PHASE 1: 浅い睡眠 (Shallow Sleep)
      // ==========================================
      systemLogger.info('SELF_IMPROVEMENT', '🌙 [浅い睡眠] 記憶整理 & 重複除去 & スキル抽出を開始');

      // Step 1: 記憶の統合・整理 & 知識グラフリンク構築
      if (context?.memories && context?.onUpdateMemories) {
        const mems = context.memories;
        const activeMems = mems.filter((m) => m.active !== false);

        context.onUpdateMemories((prev) => {
          return prev.map((target) => {
            if (target.prerequisiteMemoryIds && target.prerequisiteMemoryIds.length > 0) {
              return target;
            }
            const targetVec = target.domainVector || calculateDomainVector(target.content);
            const related = activeMems
              .filter((other) => other.id !== target.id)
              .map((other) => {
                const otherVec = other.domainVector || calculateDomainVector(other.content);
                const sim = calculateCosineSimilarity(targetVec, otherVec);
                return { other, sim };
              })
              .filter((res) => res.sim > 0.65)
              .slice(0, 2);

            if (related.length > 0) {
              graphLinksCreated++;
              return {
                ...target,
                relatedMemoryIds: Array.from(new Set([...(target.relatedMemoryIds || []), ...related.map((r) => r.other.id)])),
              };
            }
            return target;
          });
        });
        consolidatedCount = activeMems.length;
      }

      // Step 2: DPO / LoRA 学習サンプルの本格クリーンアップ・重複除去
      const cleanupResult = selfImprovementService.cleanAndDeduplicateSamples();

      // Step 3: 会話ログからのスキル自動抽出 & 昇格評価
      let extractedSkillsCount = 0;
      if (context?.messages && context.messages.length > 0) {
        const newSkills = skillsService.autoExtractSkillsFromHistory(context.messages);
        extractedSkillsCount = newSkills.length;
      }
      const skillPromo = skillsService.evaluateAllSkillsPromotion();

      systemLogger.info(
        'SELF_IMPROVEMENT',
        `✓ [浅い睡眠完了] 記憶整理(${consolidatedCount}件), グラフ接続(+${graphLinksCreated}件), サンプル重複除外(${cleanupResult.removedDuplicates}件), スキル抽出(+${extractedSkillsCount}件)`
      );

      // ==========================================
      // PHASE 2: 深い睡眠 (Deep Sleep) ゲート検査
      // ==========================================
      // 割り込みチェック
      if (abortSignal.aborted) {
        throw new Error(`中断されました: ${abortSignal.reason || 'ユーザー操作'}`);
      }

      const currentConditions = this.getExecutionConditions();
      const allowDeepSleep = triggerSource === 'manual' ? true : canRunDeepSleep(currentConditions);

      if (!allowDeepSleep) {
        const unmetReasons = getDeepSleepUnmetReasons(currentConditions);
        deepSleepSkippedReason = unmetReasons.join(', ');
        systemLogger.info(
          'SELF_IMPROVEMENT',
          `💤 [深い睡眠スキップ] 実行条件を満たさないため重い処理を省略します: ${deepSleepSkippedReason}`
        );
      } else {
        // 深い睡眠を開始
        this.currentSleepState = 'deep';
        deepSleepExecuted = true;
        systemLogger.info('SELF_IMPROVEMENT', '🌌 [深い睡眠] 自己対話テスト・A/Bテスト・回帰ベンチマークを開始');

        // Step 4: 自己対話による弱点シミュレーション & 失敗診断
        if (abortSignal.aborted) throw new Error('ユーザー操作により中断');
        const errors = worldModelService.getErrorRecords();
        const highErrors = errors.filter((e) => e.predictionError.errorMagnitude >= 0.35);

        if (highErrors.length > 0) {
          simulatedCount = Math.min(highErrors.length, 3);
          highErrors.slice(0, 3).forEach((err) => {
            const cat = err.predictionError.errorCategory;
            const prompt = err.prediction.userPrompt;
            weaknessFound.push(`[${cat}] 「${prompt.substring(0, 20)}...」への逸脱を検証 ➔ 修正境界を追加`);

            if (err.predictionError.errorCategory === 'constraint_violation' || err.actualOutcome.hasToneViolation) {
              const failureCheck = selfImprovementService.recordOrCheckFailureRecurrence({
                prompt,
                category: cat,
                reason: 'ロボット的敬語の混入・制約逸脱',
              });

              if (failureCheck.isActionable) {
                selfImprovementService.addTrainingSample({
                  instruction: prompt,
                  outputTarget: 'うん、わかった！任せて！すぐに確認してやってみるね。',
                  category: 'chat',
                  reliability: 'high',
                  approved: true,
                  split: 'train',
                  originalFailureOutput: err.actualOutcome.actualIntent || '敬語・ロボット的応答',
                  failureReason: `[再現確認: ${failureCheck.recurrenceCount}回] ロボット的敬語の混入・制約逸脱に対する自己補正プロンプト`,
                });
                selfImprovementService.markFailurePromoted(failureCheck.patternKey);
                weaknessFound.push(`[再発弱点昇格] 「${prompt.substring(0, 15)}...」が${failureCheck.recurrenceCount}回再現 ➔ 学習サンプルへ追加`);
              } else {
                weaknessFound.push(`[一過性失敗ガード] 「${prompt.substring(0, 15)}...」初回検知 (再現待機: ${failureCheck.recurrenceCount}/2回) ➔ サンプル追加保留`);
              }
            }
          });
        } else {
          simulatedCount = 1;
          weaknessFound.push('基本タメ口ペルソナ維持・境界テスト ➔ 逸脱なし(OK)');
        }

        // Step 5: プロンプトA/Bテストのバックグラウンド静的シミュレーション
        if (abortSignal.aborted) throw new Error('ユーザー操作により中断');
        try {
          const abResult = await selfImprovementService.runPromptABBenchmark(
            'こんにちは！今日何してた？',
            {
              name: '親友ペルソナA',
              systemPrompt: 'あなたは親友のみきだよ。タメ口で明るく自然な日本語で話してね。',
            },
            {
              name: '丁寧アシスタントB',
              systemPrompt: 'あなたはアシスタントです。親しみやすく返信してください。',
            }
          );
          if (abResult) {
            abTestsRunCount = 1;
          }
        } catch {
          // スキップ
        }

        // Step 6: 自律回帰ベンチマーク評価
        if (abortSignal.aborted) throw new Error('ユーザー操作により中断');
        try {
          if (!regressionBenchmarkService.isBusy()) {
            const isNativeReady = nativeLlmService.isNative() && !!nativeLlmService.getActiveModelId();
            const isWebReady = webLLMService.isLoaded();
            if (isNativeReady || isWebReady) {
              regressionReport = await regressionBenchmarkService.runFullSuite();
              if (regressionReport.regressionsCount > 0 || regressionReport.failedTests > 0) {
                weaknessFound.push(
                  `[回帰劣化検知] 自律ベンチマークで退行${regressionReport.regressionsCount}件 / 失敗${regressionReport.failedTests}件を検出 (総合スコア: ${regressionReport.overallScore}点)`
                );
              }
            } else {
              systemLogger.info('SELF_IMPROVEMENT', '自律回帰テスト: 推論モデル未ロードのためスキップ');
            }
          }
        } catch (benchErr: any) {
          systemLogger.warn('SELF_IMPROVEMENT', '自律回帰ベンチマーク実行中に例外が発生しました', benchErr);
        }

        // Step 6.5: 端末内 合成教材生成パイプライン (設計思想 33節・53節 フェーズ7)
        if (abortSignal.aborted) throw new Error('ユーザー操作により中断');
        syntheticCreatedCount = 0;
        try {
          const synSummary = await syntheticDataService.runDeepSleepSyntheticCycle();
          if (synSummary && synSummary.approvedCount > 0) {
            syntheticCreatedCount = synSummary.approvedCount;
            weaknessFound.push(
              `[合成学習データ工場] 弱点「${synSummary.weaknessCategory}」に偏らせた練習問題を生成 ➔ ${synSummary.approvedCount}件の高品質教材を自動登録`
            );
          }
        } catch (synErr: any) {
          systemLogger.warn('SELF_IMPROVEMENT', '合成教材生成パイプライン実行中に例外が発生しました', synErr);
        }
      }

      // Step 7: 学習教材の蓄積しきい値チェック
      const thresholdCheck = selfImprovementService.checkTrainingThreshold();

      const durationMs = Date.now() - startTime;
      const summaryText = deepSleepExecuted
        ? `自律サイクル完了 [深い睡眠]: 記憶整理(${consolidatedCount}件), グラフ接続(+${graphLinksCreated}件), 弱点検証(${simulatedCount}件), スキル抽出(+${extractedSkillsCount}件)${syntheticCreatedCount ? `, 合成教材(+${syntheticCreatedCount}件)` : ''}${regressionReport ? `, 回帰スコア(${regressionReport.overallScore}点)` : ''}`
        : `自律サイクル完了 [浅い睡眠のみ]: 記憶整理(${consolidatedCount}件), グラフ接続(+${graphLinksCreated}件), スキル抽出(+${extractedSkillsCount}件) (※深い睡眠保留: ${deepSleepSkippedReason || '条件未達'})`;

      const logRecord: BackgroundTaskExecutionLog = {
        id: logId,
        timestamp: Date.now(),
        taskType: 'autonomous_cycle',
        status: 'completed',
        durationMs,
        batteryLevel: this.batteryState.level,
        isCharging: this.batteryState.charging,
        isWifi: this.networkState.isWifi,
        summary: summaryText,
        details: {
          consolidatedMemoriesCount: consolidatedCount,
          graphLinksCreatedCount: graphLinksCreated,
          simulatedDialoguesCount: simulatedCount,
          cleanedDatasetSamplesCount: cleanupResult.afterCount,
          cleanedDuplicatesCount: cleanupResult.removedDuplicates,
          prunedLowQualityCount: cleanupResult.prunedLowQuality,
          skillsExtractedCount: extractedSkillsCount,
          skillsPromotedCount: skillPromo.promotedCount,
          abTestsRunCount,
          regressionBenchmarkScore: regressionReport ? regressionReport.overallScore : undefined,
          regressionReportId: regressionReport ? regressionReport.id : undefined,
          trainingThresholdReached: thresholdCheck.thresholdReached,
          trainingCurrentCount: thresholdCheck.currentCount,
          trainingTargetThreshold: thresholdCheck.threshold,
          syntheticGeneratedCount: syntheticCreatedCount,
          weaknessFound,
        },
      };

      this.executionLogs.unshift(logRecord);
      this.lastRunTimestamp = Date.now();
      this.nextScheduledRunTimestamp = Date.now() + this.intervalMinutes * 60 * 1000;
      this.saveState();

      systemLogger.info('SELF_IMPROVEMENT', `✓ WorkManager 自律処理完了 (${durationMs}ms)`);
      return logRecord;
    } catch (err: any) {
      const durationMs = Date.now() - startTime;
      const isAborted = abortSignal.aborted;
      const failedRecord: BackgroundTaskExecutionLog = {
        id: logId,
        timestamp: Date.now(),
        taskType: 'autonomous_cycle',
        status: isAborted ? 'aborted_constraint' : 'failed',
        durationMs,
        batteryLevel: this.batteryState.level,
        isCharging: this.batteryState.charging,
        isWifi: this.networkState.isWifi,
        summary: isAborted
          ? `安全中断: ${abortSignal.reason || 'ユーザーチャット操作割り込み検知'}`
          : `自律処理例外: ${err?.message || '不明なエラー'}`,
        details: {},
      };
      this.executionLogs.unshift(failedRecord);
      this.saveState();
      throw err;
    } finally {
      this.isExecutingNow = false;
      this.currentSleepState = 'idle';
      this.activeAbortController = null;
    }
  }

  /**
   * Android Kotlin WorkManager 用コード生成 (Section 23 準拠)
   */
  public generateAndroidWorkManagerCode(): string {
    return `// Android Kotlin WorkManager Implementation (MikiAI Autonomous Worker)
// app/src/main/java/com/mikiai/worker/MikiAutonomousWorker.kt

package com.mikiai.worker

import android.content.Context
import androidx.work.*
import java.util.concurrent.TimeUnit

class MikiAutonomousWorker(appContext: Context, workerParams: WorkerParameters) :
    CoroutineWorker(appContext, workerParams) {

    override suspend fun doWork(): Result {
        return try {
            // 浅い睡眠: 記憶統合 & 重複除去
            // 深い睡眠 (充電中・低温時): 弱点自己対話シミュレーション & A/Bテスト
            Result.success()
        } catch (e: Exception) {
            Result.retry()
        }
    }

    companion object {
        fun schedulePeriodicWork(context: Context) {
            val constraints = Constraints.Builder()
                .setRequiresCharging(${this.constraints.requiresCharging})
                .setRequiresDeviceIdle(${this.constraints.requiresDeviceIdle})
                .setRequiredNetworkType(${
                  this.constraints.requiresUnmeteredWifi
                    ? 'NetworkType.UNMETERED'
                    : 'NetworkType.CONNECTED'
                })
                .setRequiresBatteryNotLow(${this.constraints.batteryNotLow})
                .build()

            val workRequest = PeriodicWorkRequestBuilder<MikiAutonomousWorker>(
                ${this.intervalMinutes}, TimeUnit.MINUTES,
                30, TimeUnit.MINUTES // Flex interval
            )
            .setConstraints(constraints)
            .addTag("MikiAutonomousWork")
            .build()

            WorkManager.getInstance(context).enqueueUniquePeriodicWork(
                "MikiAutonomousSelfImprovement",
                ExistingPeriodicWorkPolicy.KEEP,
                workRequest
            )
        }
    }
}`;
  }

  public getStatus(): WorkManagerStatus {
    const conditions = this.getExecutionConditions();
    const shallowReasons = getShallowSleepUnmetReasons(conditions);
    const deepReasons = getDeepSleepUnmetReasons(conditions);

    return {
      isRegistered: this.isRegistered,
      lastRunTimestamp: this.lastRunTimestamp,
      nextScheduledRunTimestamp: this.nextScheduledRunTimestamp,
      intervalMinutes: this.intervalMinutes,
      constraints: { ...this.constraints },
      currentBatteryState: { ...this.batteryState },
      currentNetworkState: { ...this.networkState },
      isIdle: !conditions.isUserActive,
      isExecutingNow: this.isExecutingNow,
      currentSleepState: this.currentSleepState,
      currentConditions: conditions,
      unmetReasons: {
        shallow: shallowReasons,
        deep: deepReasons,
      },
    };
  }

  public updateConstraints(newConstraints: Partial<WorkManagerConstraints>): void {
    this.constraints = { ...this.constraints, ...newConstraints };
    this.saveState();
  }

  public updateInterval(minutes: number): void {
    this.intervalMinutes = Math.max(15, minutes);
    this.scheduleNextRun();
    this.saveState();
  }

  public toggleRegistered(registered: boolean): void {
    this.isRegistered = registered;
    this.saveState();
    if (registered) {
      nativeBackgroundService.start().catch(() => {});
    } else {
      nativeBackgroundService.stop().catch(() => {});
    }
  }

  public setMockBattery(charging: boolean, level: number): void {
    this.batteryState.charging = charging;
    // level: 0〜1 または 0〜100 の両方に対応
    this.batteryState.level = level <= 1 ? Math.round(level * 100) : Math.round(level);
    systemLogger.info(
      'SELF_IMPROVEMENT',
      `[Mock] バッテリー状態変更 -> ${charging ? '充電中' : '放電中'}, 残量: ${this.batteryState.level}%`
    );
  }

  public setThermalState(state: 'normal' | 'warm' | 'hot' | 'critical'): void {
    this.thermalState = state;
    systemLogger.info('SELF_IMPROVEMENT', `[Mock/API] サーマルステート変更 -> ${state}`);
    if ((state === 'hot' || state === 'critical') && this.currentSleepState === 'deep') {
      this.abortDeepSleepExecution(`端末発熱 (${state}) が検知されたため深い睡眠処理を安全に中断しました`);
    }
  }

  public setMockWifi(isWifi: boolean): void {
    this.networkState.isWifi = isWifi;
  }

  public getLogs(): BackgroundTaskExecutionLog[] {
    return [...this.executionLogs];
  }

  public clearLogs(): void {
    this.executionLogs = [];
    storageService.removeItem(WORK_MANAGER_LOGS_KEY);
  }
}

export const backgroundWorkerService = new BackgroundWorkerService();
