import { UncertaintyDivergenceItem, ResponseSkeleton } from '../types';
import { storageService } from './storageService';
import { systemLogger } from './systemLogger';
import { sendChatMessage } from './api';
import { teacherRequestService } from './teacherRequestService';
import { capabilityGapService } from './capabilityGapService';
import { answerPlanService } from './answerPlanService';
import { cleanStreamingVisibleText } from './conversationStateService';

const UNCERTAINTY_LOG_KEY = 'miki_uncertainty_divergence_log_v32';

/**
 * 設計思想 20章: 不確実性駆動の教師利用 (Uncertainty-Driven Teacher Routing)
 * および 32章 対策の汎化不足検知サービス
 */
export class UncertaintyTeacherService {
  private logItems: UncertaintyDivergenceItem[] = [];

  constructor() {
    this.loadLog();
  }

  private loadLog(): void {
    try {
      const raw = storageService.getItem(UNCERTAINTY_LOG_KEY);
      if (raw) this.logItems = JSON.parse(raw);
    } catch (e) {
      console.warn('Failed to load uncertainty log:', e);
    }
  }

  private saveLog(): void {
    try {
      storageService.setItem(UNCERTAINTY_LOG_KEY, JSON.stringify(this.logItems.slice(-30)));
    } catch (e) {
      console.warn('Failed to save uncertainty log:', e);
    }
  }

  public getHistory(): UncertaintyDivergenceItem[] {
    return this.logItems;
  }

  public clearHistory(): void {
    this.logItems = [];
    this.saveLog();
  }

  /**
   * 20章: 端末LLMに同一意味の問題へ複数候補を出させ、不確実性（判断の割れ）を評価
   */
  public async evaluateUncertainty(
    prompt: string,
    options?: {
      targetCapabilityId?: string;
      category?: string;
    }
  ): Promise<UncertaintyDivergenceItem> {
    const id = `uncert_${Date.now()}`;
    systemLogger.info('SELF_IMPROVEMENT', `[20章 不確実性駆動] 複数候補サンプリング判定を開始: 「${prompt.slice(0, 50)}...」`);

    // 候補1: 標準推論
    let resp1 = '';
    try {
      const r1 = await sendChatMessage({
        prompt,
        history: [],
        engineMode: 'webgpu',
        speakerMode: 'miki',
        useSearch: false,
      });
      resp1 = cleanStreamingVisibleText(r1.text || '');
    } catch (e: any) {
      resp1 = `エラー: ${e?.message || e}`;
    }

    // 候補2: 慎重・検証モード（わずかにシステム指示を微調整して別視点サンプリング）
    let resp2 = '';
    try {
      const r2 = await sendChatMessage({
        prompt: `${prompt}\n(※要点と根拠を明確に意識して回答してください)`,
        history: [],
        engineMode: 'webgpu',
        speakerMode: 'miki',
        useSearch: false,
      });
      resp2 = cleanStreamingVisibleText(r2.text || '');
    } catch (e: any) {
      resp2 = `エラー: ${e?.message || e}`;
    }

    const candidateResponses = [resp1, resp2];
    const divergenceTypes: (
      | 'conclusion_diverged'
      | 'intent_diverged'
      | 'memory_diverged'
      | 'length_diverged'
      | 'condition_diverged'
    )[] = [];

    // 1. 結論の不一致判定 (YES/NO, 可能/不可能, 推奨方針の真逆)
    const isYes1 = /可能|できる|はい|合致|OK|推奨/i.test(resp1) && !/不可能|できない|いいえ|非推奨/i.test(resp1);
    const isNo1 = /不可能|できない|いいえ|非推奨/i.test(resp1);
    const isYes2 = /可能|できる|はい|合致|OK|推奨/i.test(resp2) && !/不可能|できない|いいえ|非推奨/i.test(resp2);
    const isNo2 = /不可能|できない|いいえ|非推奨/i.test(resp2);
    if ((isYes1 && isNo2) || (isNo1 && isYes2)) {
      divergenceTypes.push('conclusion_diverged');
    }

    // 2. 回答長の著しい不一致判定 (一方が超短文、他方が長大解説など)
    const len1 = resp1.length;
    const len2 = resp2.length;
    if (len1 > 0 && len2 > 0 && (len1 > len2 * 3 || len2 > len1 * 3)) {
      divergenceTypes.push('length_diverged');
    }

    // 3. 条件・例外・制約の扱いの不一致判定
    const hasCond1 = /例外|ただし|条件|制限|注意点|リスク/i.test(resp1);
    const hasCond2 = /例外|ただし|条件|制限|注意点|リスク/i.test(resp2);
    if (hasCond1 !== hasCond2) {
      divergenceTypes.push('condition_diverged');
    }

    // 4. 意図理解の不一致判定 (キーワード重複度の低さ)
    const words1 = new Set(resp1.split(/[\s,。、！？!?]/).filter((w) => w.length >= 3));
    const words2 = new Set(resp2.split(/[\s,。、！？!?]/).filter((w) => w.length >= 3));
    let commonCount = 0;
    words1.forEach((w) => {
      if (words2.has(w)) commonCount++;
    });
    const overlapRatio = Math.max(words1.size, words2.size) > 0 ? commonCount / Math.max(words1.size, words2.size) : 1;
    if (overlapRatio < 0.15 && len1 > 40 && len2 > 40) {
      divergenceTypes.push('intent_diverged');
    }

    // 不確実性スコア (0-100)
    let uncertaintyScore = divergenceTypes.length * 25;
    if (divergenceTypes.includes('conclusion_diverged')) uncertaintyScore += 30;
    uncertaintyScore = Math.min(100, uncertaintyScore);

    const divergenceDetected = divergenceTypes.length > 0;
    const shouldSendToTeacher = uncertaintyScore >= 45;

    const item: UncertaintyDivergenceItem = {
      id,
      sampleText: prompt,
      candidateResponses,
      divergenceDetected,
      divergenceTypes,
      uncertaintyScore,
      shouldSendToTeacher,
      createdAt: Date.now(),
    };

    const targetCapId = options?.targetCapabilityId || 'cap_conv_naturalness';
    const existingProfile = capabilityGapService.getProfileById(targetCapId);

    if (shouldSendToTeacher) {
      // 20章 改訂規定:
      // 同一の能力について、対策を保存した後も類似の未知の言い回し(16.1)で再び本章の送信条件に該当した場合、
      // 回答が正解でも「対策の汎化不足」として扱い、32章の不足能力レジストリへ記録する。
      const hasExistingSkeletons =
        existingProfile && existingProfile.associatedSkeletons && existingProfile.associatedSkeletons.length > 0;

      if (hasExistingSkeletons) {
        // 対策の汎化不足として32章レジストリへ記録
        const gapReason = `【20章 対策の汎化不足】${existingProfile.name}の対策骨格 (${existingProfile.associatedSkeletons.join(
          ', '
        )}) が存在しますが、未知の言い回し「${prompt.slice(0, 30)}...」で複数候補の判断が割れ（スコア ${uncertaintyScore}点）、教師要請条件に再該当しました。`;
        
        const gap = capabilityGapService.recordGap({
          description: gapReason,
          gap_type: 'generalization_gap',
          capabilityId: targetCapId,
          impact: 'MEDIUM',
          current_workaround: '外部教師による対策骨格の追加作成または多角的言い換えの追加',
          candidate_solution: '言い換え文脈を拡張した対策骨格（回答骨格）の再蒸留と類似度閾値の調整',
        });

        item.teacherActionTaken = 'recorded_generalization_gap';
        item.gapIdRecorded = gap.gap_id;
        item.generalizationGapReason = gapReason;

        systemLogger.warn(
          'SELF_IMPROVEMENT',
          `⚠️ [20章 汎化不足記録] ${gapReason} ➔ GAP ID: ${gap.gap_id}`
        );
      } else {
        // 初回の教師要請: 対策（回答骨格・修復パターン）の生成
        systemLogger.info(
          'SELF_IMPROVEMENT',
          `🎓 [20章 教師対策要請] 判断ブレ検出 (スコア: ${uncertaintyScore}点) のため、外部教師へ対策骨格作成を要求します`
        );

        // 新しい回答骨格を生成して登録
        const skeleton: ResponseSkeleton = {
          pattern_id: `skel_uncert_${Date.now()}`,
          situation: `不確実性駆動対策: ${prompt.slice(0, 30)}`,
          triggerKeywords: [prompt.slice(0, 10)],
          stage: 'QUESTION',
          response_plan: [
            '1. 曖昧さや条件の分岐点を冒頭で簡潔に整理する',
            '2. 代表的な結論と前提条件を直球で提示する',
            '3. 例外や注意事項を短く補足する',
          ],
          avoid: ['一方の極端な意見への偏り', '長大で冗長な言い訳'],
          reuse_mode: 'PLAN_ONLY',
          samplePrompt: prompt,
          exampleResponseTemplate: '結論から申し上げますと、条件によって以下の通り分岐します。...',
          usageCount: 0,
          successRate: 100,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };

        answerPlanService.addSkeleton(skeleton);
        item.teacherActionTaken = 'created_skeleton';
        item.generatedSkeletonId = skeleton.pattern_id;

        // 設計思想 11章 睡眠ゲート連携:
        // 対話中のユーザーを待たせず、深夜の深い睡眠バッチ（充電＋Wi-Fi）で外部教師から高品質教材・高精度骨格を補完生成するための遅延キューへ自動登録
        teacherRequestService.enqueueDelayedRequest({
          source: 'uncertainty_divergence',
          targetCapabilityId: targetCapId,
          userPrompt: prompt,
          failureCategory: targetCapId.includes('code') || targetCapId.includes('vba') ? 'vba' : 'chat',
          divergenceTypes,
          uncertaintyScore,
          candidateResponses,
        });
      }
    } else {
      item.teacherActionTaken = 'skipped_stable';
      systemLogger.info(
        'SELF_IMPROVEMENT',
        `✅ [20章 安定判断] 複数候補の整合性が高いため（スコア ${uncertaintyScore}点）、外部教師要請をスキップして端末内処理で完結しました`
      );
    }

    this.logItems = [item, ...this.logItems];
    this.saveLog();

    return item;
  }
}

export const uncertaintyTeacherService = new UncertaintyTeacherService();
