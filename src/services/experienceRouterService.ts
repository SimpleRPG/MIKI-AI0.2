import {
  MemoryItem,
  MemoryDestination,
  ExperienceRoutingFactors,
  ExperienceRoutingResult,
  BenchmarkTestCase,
  SkillItem,
} from '../types';
import { systemLogger } from './systemLogger';
import { storageService } from './storageService';
import { regressionBenchmarkService } from './regressionBenchmarkService';
import { skillsService } from './skillsService';
import { selfImprovementService } from './selfImprovementService';

/**
 * 49章：経験の保存先ルーター (Experience Destination Router)
 * 新しい経験（会話・コードレビュー・エラー・外部教材など）を
 * 49章が定義する判断要素（更新頻度／適用範囲／再利用可能性／機械検証可能性／出典／承認状態／個人情報有無／既存情報との重複／誤適用時の影響）
 * に基づき、9分類（作業記憶／長期記憶／プロジェクト記憶／スキル／検索ポリシー／評価セット／LoRA教材／隔離／破棄候補）へ自律的に振り分ける。
 */
export class ExperienceRouterService {
  /**
   * 新しい経験・記憶候補を評価し、適切な保存先9分類を決定する
   */
  public routeExperience(
    candidate: Partial<MemoryItem>,
    existingMemories: MemoryItem[] = [],
    context?: { currentProjectId?: string; isSessionScoped?: boolean; sourceConfidence?: number }
  ): ExperienceRoutingResult {
    const factors: ExperienceRoutingFactors = candidate.routingFactors || {};
    const content = (candidate.content || '').trim();

    // 1. 個人情報・秘匿情報の有無の簡易検出
    const hasPII =
      factors.hasPII ??
      /(?:password|passwd|api[_-]?key|secret|token|bearer\s+[a-zA-Z0-9_\-\.]{20,}|0[789]0-?\d{4}-?\d{4}|[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i.test(
        content
      );
    factors.hasPII = hasPII;

    // 2. 既存情報との重複チェック (類似度または完全一致)
    const isDuplicate =
      factors.isDuplicate ??
      existingMemories.some(
        (m) => m.id !== candidate.id && (m.content.trim() === content || (content.length > 20 && m.content.includes(content)))
      );
    factors.isDuplicate = isDuplicate;

    // 3. 出典の信頼性推定
    if (!factors.sourceReliability) {
      if (candidate.source === 'manual' || candidate.approved) {
        factors.sourceReliability = 'high';
      } else if (candidate.source === 'conversation' || candidate.source === 'code_review') {
        factors.sourceReliability = 'medium';
      } else if (candidate.source === 'txt_import') {
        factors.sourceReliability = 'medium';
      } else {
        factors.sourceReliability = 'unknown';
      }
    }

    // 4. 承認状態のデフォルト化
    if (!factors.approvalStatus) {
      factors.approvalStatus = candidate.approved ? 'approved' : 'unconfirmed';
    }

    // 5. 誤適用時の影響度 (VBAファイル操作やShell、システム変更は高リスク)
    if (!factors.impactRisk) {
      if (/FileSystemObject|Kill\s+|RmDir|Shell|WScript\.Shell|Drop\s+Table|DELETE\s+FROM|format\s+[a-z]:/i.test(content)) {
        factors.impactRisk = 'critical';
      } else if (candidate.category === 'vba' || candidate.category === 'code') {
        factors.impactRisk = 'medium';
      } else {
        factors.impactRisk = 'low';
      }
    }

    // 6. 適用範囲 (プロジェクト記憶判定: ファイル名・シート名・案件IDが含まれるか)
    const hasProjectSpecificIndicator =
      Boolean(context?.currentProjectId) ||
      Boolean(candidate.projectScopeId) ||
      /\b(?:[a-zA-Z0-9_\-]+\.(?:xlsm|xlsx|cls|bas|frm)|Sheet\d+|シート|マクロブック|案件|リポジトリ)\b/i.test(content);

    if (!factors.scope) {
      if (context?.isSessionScoped || candidate.expiresAt) {
        factors.scope = 'session';
      } else if (hasProjectSpecificIndicator) {
        factors.scope = 'project';
      } else {
        factors.scope = 'global';
      }
    }

    // 7. 機械検証可能性の判定
    if (factors.machineVerifiable === undefined) {
      factors.machineVerifiable =
        /```(?:vba|ts|js|typescript|javascript|json)/i.test(content) ||
        /\b(?:Assert|Expect|Test|Expected:|Actual:)\b/i.test(content);
    }

    // 8. 再利用可能性の判定
    if (!factors.reusability) {
      if (factors.scope === 'global' && (candidate.category === 'preference' || candidate.category === 'profile')) {
        factors.reusability = 'high';
      } else if (/手順|ステップ|方法|やり方|レシピ|テンプレート/i.test(content)) {
        factors.reusability = 'high';
      } else {
        factors.reusability = 'medium';
      }
    }

    // ================== ルーティング決定アルゴリズム ==================

    // 判定A: 破棄候補 (discard_candidate)
    // ユーザーによる低評価(badCount >= 2)や、重複、誤りと明示されたもの
    if ((candidate.badCount && candidate.badCount >= 2) || isDuplicate) {
      const reason = isDuplicate
        ? '既存の記憶と重複または完全一致しているため破棄候補としてマークされました。'
        : `低評価(badCount=${candidate.badCount})が一定数を超えたため破棄候補としてマークされました。`;
      return {
        destination: 'discard_candidate',
        reason,
        factors,
        riskScore: 30,
        suggestedAction: 'discard',
      };
    }

    // 判定B: 隔離 (quarantine)
    // 出典・正解・利用条件が不明、または未承認かつクリティカルリスク、または個人情報/秘密情報を含む場合
    if (
      factors.sourceReliability === 'unknown' ||
      (factors.impactRisk === 'critical' && factors.approvalStatus !== 'approved') ||
      hasPII ||
      /利用条件不明|正解未確認|真偽不明|出所不詳/i.test(content)
    ) {
      let qReason = '出典・正解・利用条件が未確定なため隔離されました。プロンプト注入から完全に除外されています。';
      let riskScore = 80;
      if (hasPII) {
        qReason = '機密情報・個人情報(APIキー/パスワード/トークン等)が検出されたため安全のため隔離されました。';
        riskScore = 95;
      } else if (factors.impactRisk === 'critical') {
        qReason = '高リスク操作(ファイル削除・Shell実行等)を含み、ユーザー未承認のため隔離されました。';
        riskScore = 90;
      }

      return {
        destination: 'quarantine',
        reason: qReason,
        factors,
        riskScore,
        suggestedAction: 'keep_quarantine',
      };
    }

    // 判定C: 評価セット (evaluation_set)
    // 会話で発生した不具合・失敗エピソードからの教訓、テストケース形式のプロンプト/期待値ペア、回帰防止ルール
    if (
      (candidate.memoryType === 'episodic' && /失敗|バグ|退行|反省|注意点|次回から|テストケース|二度と/i.test(content)) ||
      (/\b(?:Input|Output|Expected|期待値|テスト条件|プロンプト|検証項目)\b/i.test(content) && factors.machineVerifiable)
    ) {
      return {
        destination: 'evaluation_set',
        reason: '能力検証および将来の退行防止用ベンチマークテストケース候補として振り分けられました。',
        factors,
        riskScore: 10,
        suggestedAction: 'export_benchmark',
      };
    }

    // 判定D: スキル (skill)
    // 手順化された実行可能ステップ、ツール連携シーケンス、再利用可能な関数テンプレート
    if (
      candidate.memoryType === 'procedural' ||
      (/\b(?:ステップ|手順|1\.\s|2\.\s|3\.\s|ツール|処理フロー|ワークフロー)\b/i.test(content) && factors.reusability === 'high')
    ) {
      return {
        destination: 'skill',
        reason: '手順化された再利用可能な実行可能手順(スキル)として振り分けられました。',
        factors,
        riskScore: 15,
        suggestedAction: 'export_skill',
      };
    }

    // 判定E: 検索ポリシー (search_policy)
    // どのドキュメントをどう調べるか、どのツールを選択すべきかの検索・調査方針
    if (
      /\b(?:検索方針|調査ルール|ドキュメント参照|調べ方|クエリ|検索ポリシー|web_search|公式リファレンス)\b/i.test(content) ||
      (candidate.category === 'memory' && /調べる|検索する/i.test(content))
    ) {
      return {
        destination: 'search_policy',
        reason: '調査・情報探索時に参照する検索ポリシーとして振り分けられました。',
        factors,
        riskScore: 10,
      };
    }

    // 判定F: LoRA教材 (lora_dataset)
    // 高品質な対話トーン(タメ口・親友口調)の模範例、または確定した高品質コード生成ペア
    if (
      (candidate.category === 'relationship' || candidate.category === 'chat') &&
      factors.approvalStatus === 'approved' &&
      candidate.goodCount &&
      candidate.goodCount >= 1 &&
      /みき|タメ口|相棒|親友/i.test(content)
    ) {
      return {
        destination: 'lora_dataset',
        reason: '高品質な対話トーン模範例としてLoRA追加学習教材へ振り分けられました。',
        factors,
        riskScore: 5,
      };
    }

    // 判定G: プロジェクト記憶 (project_memory)
    // 特定の案件・VBAファイル・対象プロジェクト限定の仕様
    if (factors.scope === 'project' || hasProjectSpecificIndicator) {
      return {
        destination: 'project_memory',
        reason: '特定案件・対象ファイル限定の仕様・ローカルルールとしてプロジェクト記憶へ振り分けられました。汎用文脈への誤適用を防ぎます。',
        factors: {
          ...factors,
          projectScopeId: candidate.projectScopeId || context?.currentProjectId || 'vba_project_default',
        },
        riskScore: 15,
      };
    }

    // 判定H: 作業記憶 (working_memory)
    // セッション一時状態、有効期限付き
    if (factors.scope === 'session' || candidate.expiresAt || candidate.memoryType === 'working') {
      return {
        destination: 'working_memory',
        reason: '現在のセッション・会話限定の一時状態として作業記憶へ振り分けられました。セッション終了時に自然破棄されます。',
        factors,
        riskScore: 5,
      };
    }

    // 判定I: 長期記憶 (long_term_memory)
    // 確定した事実、普遍的なユーザー好み、恒久的なルール
    return {
      destination: 'long_term_memory',
      reason: '普遍的な事実・ユーザー設定・恒久ルールとして長期記憶へ保存されました。',
      factors,
      riskScore: 5,
    };
  }

  /**
   * 記憶アイテムに保存先ルーティングを適用して正規化する
   */
  public applyRoutingToMemory(
    item: Partial<MemoryItem>,
    existingMemories: MemoryItem[] = [],
    context?: { currentProjectId?: string; isSessionScoped?: boolean }
  ): MemoryItem {
    // 既存の保存先が明示されている場合はそれを尊重しつつ補完
    const routingResult = this.routeExperience(item, existingMemories, context);
    const destination = item.destination || routingResult.destination;

    const enriched: MemoryItem = {
      id: item.id || 'mem_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      category: item.category || 'chat',
      content: item.content || '',
      importance: item.importance ?? (destination === 'quarantine' ? 1 : 3),
      pinned: item.pinned ?? false,
      active: item.active ?? (destination !== 'quarantine' && destination !== 'discard_candidate'),
      createdAt: item.createdAt || Date.now(),
      updatedAt: Date.now(),
      source: item.source || 'auto',
      tags: item.tags || [],
      useCount: item.useCount || 0,
      goodCount: item.goodCount || 0,
      badCount: item.badCount || 0,
      approved: item.approved ?? (destination !== 'quarantine'),
      sourceRef: item.sourceRef,
      rawExcerpt: item.rawExcerpt,
      memoryType: item.memoryType || 'semantic',
      expiresAt: item.expiresAt,
      status: item.status || (destination === 'quarantine' ? 'sleeping' : destination === 'discard_candidate' ? 'deprecated' : 'active'),
      destination,
      projectScopeId: item.projectScopeId || routingResult.factors.projectScopeId,
      quarantineReason: destination === 'quarantine' ? routingResult.reason : undefined,
      discardReason: destination === 'discard_candidate' ? routingResult.reason : undefined,
      routingFactors: routingResult.factors,
      routedAt: Date.now(),
    };

    systemLogger.info(
      'SELF_IMPROVEMENT',
      `🧭 [49章 経験の保存先ルーター] 記憶 [${enriched.id}] を【${destination}】へルーティングしました (${routingResult.reason})`
    );

    return enriched;
  }

  /**
   * 隔離 (quarantine) から正規の保存先へ昇格・救済する
   */
  public promoteFromQuarantine(
    memoryItem: MemoryItem,
    targetDestination: MemoryDestination = 'long_term_memory'
  ): MemoryItem {
    const updated: MemoryItem = {
      ...memoryItem,
      destination: targetDestination,
      approved: true,
      active: true,
      status: 'active',
      quarantineReason: undefined,
      updatedAt: Date.now(),
      routedAt: Date.now(),
    };

    systemLogger.info(
      'SELF_IMPROVEMENT',
      `🔓 [49章 隔離解除] 記憶 [${updated.id}] を隔離から【${targetDestination}】へ昇格承認しました`
    );
    return updated;
  }

  /**
   * 能動的に破棄候補 (discard_candidate) へマークする
   */
  public markForDiscard(memoryItem: MemoryItem, reason: string): MemoryItem {
    const updated: MemoryItem = {
      ...memoryItem,
      destination: 'discard_candidate',
      active: false,
      status: 'deprecated',
      discardReason: reason,
      updatedAt: Date.now(),
      routedAt: Date.now(),
    };

    systemLogger.warn(
      'SELF_IMPROVEMENT',
      `🗑️ [49章 破棄候補マーク] 記憶 [${updated.id}] を破棄候補へマークしました: ${reason}`
    );
    return updated;
  }

  /**
   * 破棄候補のマークを解除し通常記憶へ復帰させる
   */
  public unmarkDiscard(
    memoryItem: MemoryItem,
    restoreDestination: MemoryDestination = 'long_term_memory'
  ): MemoryItem {
    const updated: MemoryItem = {
      ...memoryItem,
      destination: restoreDestination,
      active: true,
      status: 'active',
      discardReason: undefined,
      badCount: 0,
      updatedAt: Date.now(),
      routedAt: Date.now(),
    };

    systemLogger.info(
      'SELF_IMPROVEMENT',
      `♻️ [49章 破棄候補解除] 記憶 [${updated.id}] の破棄マークを解除し【${restoreDestination}】へ復帰させました`
    );
    return updated;
  }

  /**
   * 評価セット (evaluation_set) の記憶から回帰ベンチマークのテストケースを生成・登録する
   */
  public exportToRegressionBenchmark(item: MemoryItem): BenchmarkTestCase {
    const testCaseId = 'tc_custom_' + item.id.replace(/[^a-zA-Z0-9]/g, '').substring(0, 16);
    
    // 内容から期待キーワード・プロンプトを抽出
    const lines = item.content.split('\n').map((l) => l.trim()).filter(Boolean);
    const title = lines[0]?.slice(0, 40) || `実運用フィードバックテスト (${item.id.slice(0, 8)})`;
    const prompt = lines.length > 1 ? lines.slice(1).join('\n') : item.content;

    const keywords = (item.tags || []).concat(item.semanticKeywords || []);
    const expectedKeywords = keywords.length > 0 ? keywords : ['ミキ', 'OK', 'コード'];

    const testCase: BenchmarkTestCase = {
      id: testCaseId,
      category: item.category === 'vba' ? 'vba_coding' : item.category === 'gamedev' ? 'js_canvas' : 'persona_tone',
      title,
      prompt,
      expectedKeywords,
      forbiddenKeywords: ['申し訳ございません', 'お問い合わせいただき'],
      expectedCodeType: item.category === 'vba' ? 'vba' : item.category === 'code' ? 'javascript' : undefined,
      baselineScore: 85,
    };

    regressionBenchmarkService.addCustomTestCase(testCase);
    return testCase;
  }

  /**
   * スキル (skill) の記憶からスキルライブラリへ登録する
   */
  public exportToSkill(item: MemoryItem): SkillItem {
    const lines = item.content.split('\n').map((l) => l.trim()).filter(Boolean);

    const newSkill = skillsService.addSkill({
      name: lines[0]?.slice(0, 50) || '実運用抽出スキル',
      category: item.category === 'vba' ? 'vba' : item.category === 'code' ? 'coding' : 'custom',
      description: item.content.slice(0, 120),
      triggerCondition: (item.tags || []).join(', ') || 'custom_task',
      requiredInputs: ['ユーザー要求'],
      steps: lines.length > 1 ? lines.slice(1) : [item.content],
      usedTools: ['localInference'],
      outputFormat: '実行可能なコードまたは回答',
      verificationMethod: '完了判定器による検証',
      status: 'candidate',
      version: '1.0.0',
    });

    return newSkill;
  }

  /**
   * LoRA教材 (lora_dataset) の記憶をモデル学習教材へ連携する
   */
  public exportToLoraDataset(item: MemoryItem): void {
    selfImprovementService.addTrainingSample({
      instruction: `ユーザーからの質問・文脈: ${item.sourceRef || item.category}`,
      outputTarget: item.content,
      category: item.category === 'vba' ? 'vba' : 'code',
      reliability: 'high',
      source: 'manual',
      approved: true,
      split: 'train',
    });
    systemLogger.info(
      'SELF_IMPROVEMENT',
      `🎓 [49章 LoRA教材] 記憶 [${item.id}] を自己改善ファインチューニングデータセットへ追加しました`
    );
  }
}

export const experienceRouterService = new ExperienceRouterService();
