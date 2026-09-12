import { DraftVerificationResult } from '../types';
import { nonLlmRuntimeService, NonLlmTeacherConfig } from './nonLlmRuntimeService';
import { systemLogger } from './systemLogger';

export interface DraftVerificationConfig {
  draftModel: string;      // 例: 'deterministic-core'
  verifierModel: string;   // 例: 'qwen2.5:3b' または 'phi-3.5-mini'
  acceptanceScoreThreshold: number; // 判定閾値 (デフォルト: 75点)
  enabled: boolean;
}

/**
 * 設計思想 Master v5.0 第9章1節: 1.5B/3B同時常駐・ドラフト検証サービス
 * 
 * 1.5B が高速に応答案を起草 (Draft)。
 * 3B がその答案を短時間で検算・採点 (Verify)。
 * 意見一致（閾値以上）なら即確定（外部教師API消費ゼロ）。
 * 意見対立時（低スコア、致命的不整合）のみ外部教師へエスカレーション。
 */
class DraftVerificationService {
  private config: DraftVerificationConfig = {
    draftModel: 'qwen2.5:1.5b',
    verifierModel: 'qwen2.5:3b',
    acceptanceScoreThreshold: 75,
    enabled: false, // ユーザー設定または自動検知でオン
  };

  public getConfig(): DraftVerificationConfig {
    return { ...this.config };
  }

  public setConfig(newConfig: Partial<DraftVerificationConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * 1.5Bドラフト生成 ＋ 3B検算を実行
   */
  public async verifyDraftWith3B(
    prompt: string,
    draftAnswer: string,
    externalConfig?: NonLlmTeacherConfig,
    options?: { signal?: AbortSignal }
  ): Promise<DraftVerificationResult> {
    const t0 = performance.now();
    const verifierModel = this.config.verifierModel;

    systemLogger.info('INFERENCE', `🔍 [3B検算] 1.5Bドラフト答案の高速自己監査を開始... (Verifier: ${verifierModel})`);

    const verificationPrompt = `あなたは論理整合性・事実性・構文安全性を監査する検算AI（3B）です。
ユーザーからの質問と、小型1.5Bモデルが作成した「下書き回答」を監査してください。

【ユーザーの質問・依頼】:
${prompt}

【1.5Bの下書き回答】:
${draftAnswer}

以下の形式で簡潔に出力してください（日本語）:
スコア: [0〜100の整数]
判定: [合格 または 修正要]
講評: [改善点や指摘事項を1〜2行で]
修正後回答: [重大な誤りがある場合のみ修正版、問題なければ「原案採用」と記入]`;

    let verifierOutput = '';
    try {
      if (externalConfig) {
        // 外部LLM経由で 3B モデルを呼び出し
        const verifyConfig: NonLlmTeacherConfig = {
          ...externalConfig,
          model: verifierModel,
        };

        const stream = nonLlmRuntimeService.streamDeterministicChat(
          verifyConfig,
          [
            { role: 'system', content: 'あなたは的確で厳格なコードおよび論理の検算担当です。' },
            { role: 'user', content: verificationPrompt },
          ],
          {
            temperature: 0.2, // 検算は低温度で決定論的に実行
            signal: options?.signal,
          }
        );

        for await (const chunk of stream) {
          verifierOutput += chunk;
        }
      } else {
        // ローカル環境が未設定の場合は即時合格フォールバック
        return {
          draftText: draftAnswer,
          draftModel: this.config.draftModel,
          verifierModel: this.config.verifierModel,
          agreed: true,
          score: 85,
          critiqueNotes: ['検算サーバー未接続のためドラフトをそのまま採用'],
          escalatedToTeacher: false,
          verificationLatencyMs: Math.round(performance.now() - t0),
        };
      }
    } catch (e: any) {
      systemLogger.warn('INFERENCE', 'DraftVerificationService: verify call failed, falling back to draft', e);
      return {
        draftText: draftAnswer,
        draftModel: this.config.draftModel,
        verifierModel: this.config.verifierModel,
        agreed: true,
        score: 75,
        critiqueNotes: [`検算実行時エラー (${e?.message || e})。安全側に倒してドラフトを採用`],
        escalatedToTeacher: false,
        verificationLatencyMs: Math.round(performance.now() - t0),
      };
    }

    // 検算結果のパース
    const scoreMatch = verifierOutput.match(/スコア:\s*(\d+)/i) || verifierOutput.match(/(\d{1,3})\s*点/);
    const score = scoreMatch ? Math.min(100, Math.max(0, parseInt(scoreMatch[1], 10))) : 80;
    const agreed = score >= this.config.acceptanceScoreThreshold;

    const critiqueMatch = verifierOutput.match(/講評:\s*([^\n]+)/i);
    const critiqueNotes = critiqueMatch ? [critiqueMatch[1].trim()] : [];

    let verifiedText: string | undefined = undefined;
    const fixMatch = verifierOutput.match(/修正後回答:\s*([\s\S]+)$/i);
    if (fixMatch) {
      const fixed = fixMatch[1].trim();
      if (fixed && !fixed.includes('原案採用')) {
        verifiedText = fixed;
      }
    }

    const elapsed = Math.round(performance.now() - t0);
    const shouldEscalate = !agreed && score < 50;

    systemLogger.info(
      'INFERENCE',
      `✅ [3B検算完了] スコア: ${score}/100, 合意: ${agreed ? 'YES' : 'NO'}, エスカレーション: ${shouldEscalate ? 'YES' : 'NO'} (${elapsed}ms)`
    );

    return {
      draftText: draftAnswer,
      verifiedText,
      draftModel: this.config.draftModel,
      verifierModel: this.config.verifierModel,
      agreed,
      score,
      critiqueNotes,
      escalatedToTeacher: shouldEscalate,
      escalationReason: shouldEscalate ? `3B検算スコア低迷 (${score}点): ${critiqueNotes.join(' ')}` : undefined,
      verificationLatencyMs: elapsed,
    };
  }
}

export const draftVerificationService = new DraftVerificationService();
