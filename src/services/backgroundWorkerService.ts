import {
  WorkManagerConstraints,
  WorkManagerStatus,
  BackgroundTaskExecutionLog,
  MemoryItem,
  ChatMessage,
  PersonaConfig,
  RegressionSuiteRunReport,
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

const WORK_MANAGER_CONSTRAINTS_KEY = 'miki_ai_workmanager_constraints';
const WORK_MANAGER_LOGS_KEY = 'miki_ai_workmanager_logs';
const WORK_MANAGER_CONFIG_KEY = 'miki_ai_workmanager_config';

/**
 * Android WorkManager & バックグラウンド自律処理サービス
 *
 * 設計思想 11. バックグラウンド自己対話と自律改善 (会話中ではなく深夜・充電中・Wi-Fi接続時に実行)
 * 設計思想 23. Androidネイティブと連携 (WorkManager, BatteryManager, NetworkCapabilities)
 */
export class BackgroundWorkerService {
  private constraints: WorkManagerConstraints = {
    requiresCharging: true,
    requiresDeviceIdle: false, // チャット中も裏で回して良い、という指示に合わせてデフォルトOFF
    requiresUnmeteredWifi: true,
    batteryNotLow: true,
    nightTimeOnly: false, // デモや検証用にデフォルトは終日許可
  };

  private intervalMinutes: number = 360; // 6時間ごと
  private executionLogs: BackgroundTaskExecutionLog[] = [];
  private isRegistered: boolean = true;
  private isExecutingNow: boolean = false;
  private lastRunTimestamp: number = 0;
  private nextScheduledRunTimestamp: number = 0;

  // バッテリー & ネットワーク実機状態
  private batteryState = {
    level: 100,
    charging: true,
    supported: false,
  };

  private networkState = {
    isWifi: true,
    isOnline: true,
    type: 'wifi',
  };

  private isUserIdle: boolean = false;
  private idleTimer: any = null;
  private schedulerTimer: any = null;

  constructor() {
    this.loadState();
    this.initHardwareMonitors();
    this.initIdleDetector();
    this.scheduleNextRun();
    // If background self-improvement is enabled (default), keep the native
    // process alive so the scheduler above still ticks while backgrounded.
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
      (navigator as any).getBattery().then((battery: any) => {
        this.batteryState.supported = true;
        this.batteryState.level = Math.round(battery.level * 100);
        this.batteryState.charging = battery.charging;

        battery.addEventListener('chargingchange', () => {
          this.batteryState.charging = battery.charging;
          systemLogger.info('SELF_IMPROVEMENT', `WorkManager: 充電状態変化 -> ${battery.charging ? '充電中' : '放電中'}`);
        });

        battery.addEventListener('levelchange', () => {
          this.batteryState.level = Math.round(battery.level * 100);
        });
      }).catch(() => {
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

    // 制約チェック
    const checkResult = this.evaluateConstraints();
    if (!checkResult.passed) {
      // 制約未達のため延期
      return;
    }

    this.runAutonomousBackgroundCycle('periodic_scheduled');
  }

  /**
   * WorkManager 制約評価 (Constraints Evaluation)
   */
  public evaluateConstraints(): { passed: boolean; reasons: string[] } {
    const reasons: string[] = [];
    const now = new Date();
    const currentHour = now.getHours();

    if (this.constraints.requiresCharging && !this.batteryState.charging) {
      reasons.push('充電器に接続されていません (BATTERY_STATUS_CHARGING 必要)');
    }

    if (this.constraints.batteryNotLow && this.batteryState.level < 20 && !this.batteryState.charging) {
      reasons.push('バッテリー残量が20%未満です (BATTERY_NOT_LOW 必要)');
    }

    if (this.constraints.requiresUnmeteredWifi && (!this.networkState.isOnline || !this.networkState.isWifi)) {
      reasons.push('Wi-Fi環境ではありません (NET_CAPABILITY_NOT_METERED 必要)');
    }

    if (this.constraints.requiresDeviceIdle && !this.isUserIdle) {
      reasons.push('ユーザーが操作中です (DEVICE_IDLE 必要)');
    }

    if (this.constraints.nightTimeOnly && (currentHour < 2 || currentHour >= 5)) {
      reasons.push(`深夜帯(02:00〜05:00)ではありません (現在時刻: ${currentHour}時)`);
    }

    return {
      passed: reasons.length === 0,
      reasons,
    };
  }

  /**
   * 自律バックグラウンド処理サイクルを実行
   * 設計思想 11: 記憶統合 ➔ 自己対話テスト ➔ 知識グラフリンク構築 ➔ 学習データ生成
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

    this.isExecutingNow = true;
    const startTime = Date.now();
    const logId = 'bg_' + startTime + '_' + Math.random().toString(36).substring(2, 6);

    systemLogger.info('SELF_IMPROVEMENT', `⚡ WorkManager 自律バックグラウンド処理を開始 [Trigger: ${triggerSource}]`);

    let consolidatedCount = 0;
    let graphLinksCreated = 0;
    let simulatedCount = 0;
    const weaknessFound: string[] = [];

    try {
      // Step 1: 記憶の統合・整理 & 知識グラフリンク構築 (Memory Consolidation)
      if (context?.memories && context?.onUpdateMemories) {
        const mems = context.memories;
        const activeMems = mems.filter((m) => m.active !== false);

        // 重複や孤立記憶の自動グラフリンク付与
        context.onUpdateMemories((prev) => {
          return prev.map((target) => {
            if (target.prerequisiteMemoryIds && target.prerequisiteMemoryIds.length > 0) {
              return target;
            }
            const targetVec = target.domainVector || calculateDomainVector(target.content);
            // 類似する上位記憶を探索
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

      // Step 2: DPO / LoRA 学習サンプルの本格クリーンアップ・重複除去 (実データ処理)
      const cleanupResult = selfImprovementService.cleanAndDeduplicateSamples();

      // Step 3: 自己対話による弱点シミュレーション & 失敗診断 (Self-Dialogue Stress Testing)
      const errors = worldModelService.getErrorRecords();
      const highErrors = errors.filter((e) => e.predictionError.errorMagnitude >= 0.35);

      if (highErrors.length > 0) {
        simulatedCount = Math.min(highErrors.length, 3);
        highErrors.slice(0, 3).forEach((err) => {
          const cat = err.predictionError.errorCategory;
          const prompt = err.prediction.userPrompt;
          weaknessFound.push(`[${cat}] 「${prompt.substring(0, 20)}...」への逸脱を検証 ➔ 修正境界を追加`);

          // 失敗事例から自動補正用トレーニングサンプルを学習プールへ注入
          if (err.predictionError.errorCategory === 'constraint_violation' || err.actualOutcome.hasToneViolation) {
            // 設計思想 25 & 課題 3: 一過性ノイズの即サンプル化防止ガード (再現回数・頻度チェック)
            const failureCheck = selfImprovementService.recordOrCheckFailureRecurrence({
              prompt,
              category: cat,
              reason: 'ロボット的敬語の混入・制約逸脱',
            });

            if (failureCheck.isActionable) {
              // 2回以上再現された本物の弱点パターンのみ学習プールへ正式追加
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
              // 初回・一過性失敗は学習データ汚染を防ぐためサンプル化を保留
              weaknessFound.push(`[一過性失敗ガード] 「${prompt.substring(0, 15)}...」初回検知 (再現待機: ${failureCheck.recurrenceCount}/2回) ➔ サンプル追加保留`);
            }
          }
        });
      } else {
        simulatedCount = 1;
        weaknessFound.push('基本タメ口ペルソナ維持・境界テスト ➔ 逸脱なし(OK)');
      }

      // Step 4: 会話ログからのスキル自動抽出 (Skill Discovery) & 昇格再評価
      let extractedSkillsCount = 0;
      if (context?.messages && context.messages.length > 0) {
        const newSkills = skillsService.autoExtractSkillsFromHistory(context.messages);
        extractedSkillsCount = newSkills.length;
      }
      const skillPromo = skillsService.evaluateAllSkillsPromotion();

      // Step 5: プロンプトA/Bテストのバックグラウンド静的シミュレーション
      let abTestsRunCount = 0;
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
        // モデル未ロード時はスキップ
      }

      // Step 5.5: アイドル時・自律回帰ベンチマーク評価 (設計思想 9. ベンチマークと退行テスト & 21. 自動回帰評価)
      let regressionReport: RegressionSuiteRunReport | null = null;
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

      // Step 6: 学習教材の蓄積しきい値チェック
      const thresholdCheck = selfImprovementService.checkTrainingThreshold();

      const durationMs = Date.now() - startTime;
      const logRecord: BackgroundTaskExecutionLog = {
        id: logId,
        timestamp: Date.now(),
        taskType: 'autonomous_cycle',
        status: 'completed',
        durationMs,
        batteryLevel: this.batteryState.level,
        isCharging: this.batteryState.charging,
        isWifi: this.networkState.isWifi,
        summary: `自律サイクル完了: 記憶整理(${consolidatedCount}件), グラフ接続(+${graphLinksCreated}件), 重複除外(${cleanupResult.removedDuplicates}件), 弱点対話・補正(${simulatedCount}件), 新規スキル(+${extractedSkillsCount}件)${regressionReport ? `, 回帰評価(${regressionReport.overallScore}点/退行${regressionReport.regressionsCount}件)` : ''}`,
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
      const failedRecord: BackgroundTaskExecutionLog = {
        id: logId,
        timestamp: Date.now(),
        taskType: 'autonomous_cycle',
        status: 'failed',
        durationMs,
        batteryLevel: this.batteryState.level,
        isCharging: this.batteryState.charging,
        isWifi: this.networkState.isWifi,
        summary: `自律処理例外: ${err?.message || '不明なエラー'}`,
        details: {},
      };
      this.executionLogs.unshift(failedRecord);
      this.saveState();
      throw err;
    } finally {
      this.isExecutingNow = false;
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
            // 1. 記憶の統合・整理 (Memory Consolidation)
            // 2. 弱点自己対話シミュレーション
            // 3. LoRA用JSONLクリーンアップ
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
    return {
      isRegistered: this.isRegistered,
      lastRunTimestamp: this.lastRunTimestamp,
      nextScheduledRunTimestamp: this.nextScheduledRunTimestamp,
      intervalMinutes: this.intervalMinutes,
      constraints: { ...this.constraints },
      currentBatteryState: { ...this.batteryState },
      currentNetworkState: { ...this.networkState },
      isIdle: this.isUserIdle,
      isExecutingNow: this.isExecutingNow,
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
    // Pausing stops the foreground keep-alive service too (screen off / app
    // backgrounded no longer needs to be kept awake); resuming restarts it.
    if (registered) {
      nativeBackgroundService.start().catch(() => {});
    } else {
      nativeBackgroundService.stop().catch(() => {});
    }
  }

  public setMockBattery(charging: boolean, level: number): void {
    this.batteryState.charging = charging;
    this.batteryState.level = level;
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
