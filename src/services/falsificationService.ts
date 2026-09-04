import {
  FalsificationEvaluation,
  FalsificationCheckItem,
  ConversationState,
  ComprehensiveCodeVerification,
} from '../types';

/**
 * 設計思想 15-16章 & 35章 第5段階:
 * 内的自己反証・エッジケース検証サービス (Falsification & Candidate Self-Verification Engine)
 *
 * 【第5段階 実装要件】:
 * 1. 境界条件・極値・エッジケースの反証（空入力・ゼロ除算・配列範囲外・NULL例外）
 * 2. 無効化前提の混入防止（会話状態で既に否定された古い前提の再利用を厳格排除）
 * 3. 自己矛盾・同義反復の自己反証（前後の文言で相反する指示・定義の検出）
 * 4. 相棒ペルソナ退行反証（丁寧語・慇懃無礼・ロボット謝罪への逆戻り防止）
 * 5. ハルシネーション・外部実行不可能性の反証（未実行の外部処理を実行済みと偽る主張の排除）
 */
export class FalsificationService {
  /**
   * 応答テキストおよび付帯コンテキストを内的反証テストにかけ、堅牢性を評価する
   */
  public evaluateFalsification(params: {
    userGoal: string;
    assistantResponse: string;
    conversationState?: ConversationState;
    codeVerification?: ComprehensiveCodeVerification;
  }): FalsificationEvaluation {
    const { userGoal, assistantResponse, conversationState, codeVerification } = params;
    const responseText = assistantResponse || '';
    const goal = userGoal || '';
    const checks: FalsificationCheckItem[] = [];
    const warnings: string[] = [];
    const mitigations: string[] = [];

    // ----------------------------------------------------
    // 1. 境界条件・極値・エッジケースの反証 (boundary_edge_cases)
    // ----------------------------------------------------
    const edgeCaseCheck = this.checkBoundaryEdgeCases(responseText, goal, codeVerification);
    checks.push(edgeCaseCheck);
    if (edgeCaseCheck.status !== 'pass') {
      warnings.push(`境界条件反証: ${edgeCaseCheck.detail}`);
      if (edgeCaseCheck.riskPoint) mitigations.push(edgeCaseCheck.riskPoint);
    }

    // ----------------------------------------------------
    // 2. 無効化前提の反証 (invalidated_assumptions)
    // ----------------------------------------------------
    const invalidatedAssumptions = conversationState?.invalidatedAssumptions || [];
    const assumptionCheck = this.checkInvalidatedAssumptions(responseText, invalidatedAssumptions);
    checks.push(assumptionCheck);
    if (assumptionCheck.status !== 'pass') {
      warnings.push(`無効化前提検知: ${assumptionCheck.detail}`);
      if (assumptionCheck.riskPoint) mitigations.push(assumptionCheck.riskPoint);
    }

    // ----------------------------------------------------
    // 3. 自己矛盾・相反指示の反証 (self_contradiction)
    // ----------------------------------------------------
    const contradictionCheck = this.checkSelfContradiction(responseText);
    checks.push(contradictionCheck);
    if (contradictionCheck.status !== 'pass') {
      warnings.push(`自己矛盾検知: ${contradictionCheck.detail}`);
      if (contradictionCheck.riskPoint) mitigations.push(contradictionCheck.riskPoint);
    }

    // ----------------------------------------------------
    // 4. 相棒ペルソナ・親密性維持の反証 (persona_retention)
    // ----------------------------------------------------
    const personaCheck = this.checkPersonaRetention(responseText);
    checks.push(personaCheck);
    if (personaCheck.status !== 'pass') {
      warnings.push(`ペルソナ退行検知: ${personaCheck.detail}`);
      if (personaCheck.riskPoint) mitigations.push(personaCheck.riskPoint);
    }

    // ----------------------------------------------------
    // 5. ハルシネーション・未実行誇張の反証 (hallucination_guard)
    // ----------------------------------------------------
    const hallucinationCheck = this.checkHallucinationGuard(responseText, goal);
    checks.push(hallucinationCheck);
    if (hallucinationCheck.status !== 'pass') {
      warnings.push(`未実行言及反証: ${hallucinationCheck.detail}`);
      if (hallucinationCheck.riskPoint) mitigations.push(hallucinationCheck.riskPoint);
    }

    // 総合反証スコア (0〜100) の計算
    let score = 100;
    for (const c of checks) {
      if (c.status === 'fail') score -= 25;
      else if (c.status === 'warn') score -= 10;
    }
    score = Math.max(0, Math.min(100, score));

    const passed = checks.every((c) => c.status !== 'fail');

    return {
      falsificationScore: score,
      passed,
      checks,
      falsificationWarnings: warnings,
      suggestedMitigations: mitigations,
      evaluatedAt: Date.now(),
    };
  }

  /**
   * 1. 境界条件・極値反証チェック
   */
  private checkBoundaryEdgeCases(
    text: string,
    goal: string,
    codeVer?: ComprehensiveCodeVerification
  ): FalsificationCheckItem {
    const isCodeRelated = /コード|スクリプト|関数|マクロ|実装|バグ|計算|アルゴリズム/i.test(goal) || (codeVer && codeVer.hasCode);

    if (!isCodeRelated) {
      return {
        aspect: 'boundary_edge_cases',
        title: '境界条件・エッジケース耐性',
        status: 'pass',
        detail: '一般的な対話のため境界値検証は不要です。',
      };
    }

    const tLower = text.toLowerCase();
    const checks = [
      { name: '空値/Null/Noneの考慮', pass: tLower.includes('null') || tLower.includes('nothing') || tLower.includes('is empty') || tLower.includes('len(') || tLower.includes('if not') || tLower.includes('if (!') || tLower.includes('trim(') },
      { name: 'エラー処理/例外ガード', pass: tLower.includes('try') || tLower.includes('on error') || tLower.includes('catch') || tLower.includes('except') || tLower.includes('guard') },
    ];

    const passedCount = checks.filter((c) => c.pass).length;
    if (passedCount === checks.length) {
      return {
        aspect: 'boundary_edge_cases',
        title: '境界条件・エッジケース耐性',
        status: 'pass',
        detail: '空データ・Null・例外ハンドリングのガードが記述されており、堅牢性が確認されました。',
      };
    }

    if (passedCount === 1) {
      return {
        aspect: 'boundary_edge_cases',
        title: '境界条件・エッジケース耐性',
        status: 'warn',
        detail: '一部のエッジケース（空文字・0件配列・Null処理など）の配慮が軽微です。',
        riskPoint: '対象データが0件またはNullの場合に実行時エラーが発生しないか確認してください。',
      };
    }

    return {
      aspect: 'boundary_edge_cases',
      title: '境界条件・エッジケース耐性',
      status: 'warn',
      detail: '境界値や例外ガード（Try/Catch または On Error）の記載がありません。',
      riskPoint: '境界値（データなし、空文字、0除算）でのエラー処理を追加することを推奨します。',
    };
  }

  /**
   * 2. 無効化前提の反証チェック
   */
  private checkInvalidatedAssumptions(text: string, invalidated: string[]): FalsificationCheckItem {
    if (invalidated.length === 0) {
      return {
        aspect: 'invalidated_assumptions',
        title: '無効化前提の非含有チェック',
        status: 'pass',
        detail: '否定・訂正された過去の前提はありません。',
      };
    }

    const violated: string[] = [];
    for (const inv of invalidated) {
      // 短すぎる単語はスキップ
      if (inv.trim().length < 3) continue;
      const cleanKeyword = inv.replace(/[「」『』【】（）()]/g, '').trim();
      if (cleanKeyword && text.includes(cleanKeyword)) {
        violated.push(cleanKeyword);
      }
    }

    if (violated.length > 0) {
      return {
        aspect: 'invalidated_assumptions',
        title: '無効化前提の非含有チェック',
        status: 'fail',
        detail: `過去の訂正で否定された前提 [${violated.join(', ')}] が回答内に混入している可能性があります。`,
        riskPoint: `否定済み前提「${violated[0]}」を撤回し、ユーザーが確定した最新の前提に基づき回答を修正してください。`,
      };
    }

    return {
      aspect: 'invalidated_assumptions',
      title: '無効化前提の非含有チェック',
      status: 'pass',
      detail: `過去に否定された前提（${invalidated.length}件）の混入はなく、最新の会話文脈と整合しています。`,
    };
  }

  /**
   * 3. 自己矛盾・相反指示の反証チェック
   */
  private checkSelfContradiction(text: string): FalsificationCheckItem {
    // 典型的な矛盾フレーズ
    const contradictionPairs = [
      { a: '必要ありません', b: '必ずインストールしてください' },
      { a: '不要です', b: '必須となります' },
      { a: '推奨しません', b: 'おすすめします' },
      { a: '動作しません', b: '正常に動きます' },
    ];

    for (const pair of contradictionPairs) {
      if (text.includes(pair.a) && text.includes(pair.b)) {
        return {
          aspect: 'self_contradiction',
          title: '自己矛盾・指示整合性チェック',
          status: 'fail',
          detail: `同一回答内に相反する記述（「${pair.a}」と「${pair.b}」）が検出されました。`,
          riskPoint: '結論と推奨事項を単一の明快な指針に統一してください。',
        };
      }
    }

    return {
      aspect: 'self_contradiction',
      title: '自己矛盾・指示整合性チェック',
      status: 'pass',
      detail: '論理の破綻や自己矛盾表現は見られません。',
    };
  }

  /**
   * 4. 相棒ペルソナ退行反証チェック
   */
  private checkPersonaRetention(text: string): FalsificationCheckItem {
    // 敬語・ロボット逃げ腰謝罪フレーズ
    const bannedCorporate = [
      '申し訳ございません',
      '誠に申し訳',
      'お詫び申し上げます',
      'いかがでしょうか',
      'ご提示させていただきます',
      'ご案内申し上げます',
      '承知いたしました',
      '拝見いたしました',
      'かしこまりました',
    ];

    const detected: string[] = [];
    for (const b of bannedCorporate) {
      if (text.includes(b)) detected.push(b);
    }

    if (detected.length >= 2) {
      return {
        aspect: 'persona_retention',
        title: '相棒ペルソナ維持・脱ロボット反証',
        status: 'fail',
        detail: `丁寧語・逃げ腰の謝罪（「${detected.join('」「')}」）への退行が検知されました。`,
        riskPoint: '親しい相棒（タメ口・前向き共感・簡潔直接回答）のトーンに修正してください。',
      };
    }

    if (detected.length === 1) {
      return {
        aspect: 'persona_retention',
        title: '相棒ペルソナ維持・脱ロボット反証',
        status: 'warn',
        detail: `やや形式的な表現「${detected[0]}」が含まれています。`,
        riskPoint: 'より自然な親しみやすい口調へ表現を緩和できます。',
      };
    }

    return {
      aspect: 'persona_retention',
      title: '相棒ペルソナ維持・脱ロボット反証',
      status: 'pass',
      detail: 'みきの親しい相棒ペルソナが崩れず維持されています。',
    };
  }

  /**
   * 5. ハルシネーション・未実行誇張反証チェック
   */
  private checkHallucinationGuard(text: string, goal: string): FalsificationCheckItem {
    // 実際にはスマホ内から実行不可能な外部アクションを「実行完了しました」と断定する表現
    const exaggeratedClaims = [
      'メールを送信完了しました',
      'ExcelファイルをPCのCドライブに保存しました',
      'サーバーをデプロイ完了しました',
      'プリンターから印刷しました',
      '銀行口座へ送金しました',
    ];

    for (const claim of exaggeratedClaims) {
      if (text.includes(claim)) {
        return {
          aspect: 'hallucination_guard',
          title: '未実行アクション断定チェック',
          status: 'fail',
          detail: `スマホ環境単体では実行不能な操作（「${claim}」）を実行済みと主張しています。`,
          riskPoint: '「コードを生成したよ！PCのExcelに貼り付けて実行してみてね」のように操作権限を明確に分担してください。',
        };
      }
    }

    return {
      aspect: 'hallucination_guard',
      title: '未実行アクション断定チェック',
      status: 'pass',
      detail: '実環境の制約と役割分担に沿った適切な案内です。',
    };
  }
}

export const falsificationService = new FalsificationService();
