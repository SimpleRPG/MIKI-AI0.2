import { CompiledRequestType, ConversationState } from '../types';
import { systemLogger } from './systemLogger';

/**
 * 非LLM中心・自己成長型AIコンパニオン 設計思想指示書(統合版) 第10.1節
 * 要求型コンパイラ (Request Type Compiler)
 *
 * 【設計思想】
 * 自然言語の曖昧な依頼をそのまま実行・生成モデルに渡すのではなく、
 * 機械検査可能な確定構造（要求型: CompiledRequestType）へ決定論的にコンパイルする。
 * 型エラーや未決定項目をLLMの確率的推測で埋めず、安全な境界値を適用する。
 */
export class RequestTypeCompilerService {
  private static instance: RequestTypeCompilerService;

  private constructor() {}

  public static getInstance(): RequestTypeCompilerService {
    if (!RequestTypeCompilerService.instance) {
      RequestTypeCompilerService.instance = new RequestTypeCompilerService();
    }
    return RequestTypeCompilerService.instance;
  }

  /**
   * 自然言語入力から要求型へコンパイル
   */
  public compile(
    userInput: string,
    conversationState?: ConversationState | null
  ): CompiledRequestType {
    const rawText = userInput.trim();
    const lower = rawText.toLowerCase();

    // 要求ID自体も再現可能にする。時刻・乱数を混ぜると同一入力の比較試験が壊れるため、
    // 入力と会話状態の安定表現からFNV-1aを算出する。
    const requestFingerprint = `${rawText}|${conversationState?.currentTopic || ''}|${conversationState?.topLevelGoal || ''}`;
    let requestHash = 2166136261;
    for (let i = 0; i < requestFingerprint.length; i++) {
      requestHash ^= requestFingerprint.charCodeAt(i);
      requestHash = Math.imul(requestHash, 16777619);
    }
    const requestId = `REQ-${(requestHash >>> 0).toString(16).toUpperCase().padStart(8, '0')}`;

    // 1. GOAL (目的・ゴール) の抽出
    let goal = '一般的な問い合わせ・対話処理';
    if (/マクロ|vba|excel|シート|表/i.test(rawText)) {
      goal = 'Excel/VBA 自動化マクロの作成・検証・最適化';
    } else if (/作成|作って|実装|コード/i.test(rawText)) {
      goal = 'プログラム・コンポーネントの実装とコード納品';
    } else if (/調査|調べて|検索|どういう|何|教えて/i.test(rawText)) {
      goal = '知識調査・事実検証および明文化';
    } else if (/修正|直して|エラー|バグ|動かない/i.test(rawText)) {
      goal = '障害原因の特定・デバッグ・リファクタリング';
    }

    // 2. TARGET (対象) の抽出
    let target = conversationState?.currentTopic || '未指定の対象ドメイン';
    if (/excel|vba|シート|セル|行|列/i.test(rawText)) {
      target = 'Microsoft Excel / VBA 環境';
    } else if (/android|termux|galaxy/i.test(rawText)) {
      target = 'Galaxy S25 / Android / Termux 環境';
    } else if (/python|typescript|react/i.test(rawText)) {
      target = 'TypeScript / React / Python ソフトウェア基盤';
    }

    // 3. DELIVERABLES (納品成果物) の特定
    const deliverables: string[] = [];
    if (/vba|マクロ|excel/i.test(rawText)) {
      deliverables.push('VBA標準モジュールコード (.bas/.txt)');
      deliverables.push('実行前提条件および導入マニュアル');
    } else if (/コード|実装/i.test(rawText)) {
      deliverables.push('検証済みソースコード');
    } else {
      deliverables.push('回答内容IR準拠の説明・提案テキスト');
    }

    // 4. CONSTRAINTS (制約条件) の抽出
    const constraints: string[] = [];
    if (/高速|速く|パフォーマンス|最適化/i.test(rawText)) {
      constraints.push('画面更新停止 (ScreenUpdating=False) および配列一括転記による高速化');
    }
    if (/先頭ゼロ|ゼロ埋め|数値文字列/i.test(rawText)) {
      constraints.push('先頭ゼロ・数値形式の文字列属性保持 (NumberFormatLocal = "@")');
    }
    if (/重複|ユニーク|除外/i.test(rawText)) {
      constraints.push('重複行・重複データの決定論的除去');
    }
    if (/excel/i.test(rawText)) {
      constraints.push('Excel 2016以降 または Microsoft 365 互換環境');
    }

    // 5. PROHIBITIONS (禁止事項) の抽出
    const prohibitions: string[] = [];
    prohibitions.push('ハードコードされた固定セル座標への盲目的依存の禁止');
    prohibitions.push('未宣言変数の使用禁止 (Option Explicit 必須)');
    if (/安全|壊さ|非破壊/i.test(rawText)) {
      prohibitions.push('元データシートの不可逆な上書き保存禁止');
    }

    // 6. ACCEPTANCE_CRITERIA (受入基準) の確定
    const acceptanceCriteria: string[] = [];
    acceptanceCriteria.push('構文エラー・未宣言変数のゼロ保証');
    if (/vba|マクロ/i.test(rawText)) {
      acceptanceCriteria.push('VBAブロック整合性およびエラーハンドラ (On Error GoTo) の完備');
    }
    acceptanceCriteria.push('設計思想 13.4 意味保持検査の合格');

    // 7. PRIVACY_CLASS (プライバシークラス)
    let privacyClass: CompiledRequestType['privacyClass'] = 'PUBLIC';
    if (/パスワード|秘密|api_key|token|個人情報|社内|機密/i.test(lower)) {
      privacyClass = 'CONFIDENTIAL';
    }

    // 8. SIDE_EFFECT_CLASS (副作用クラス)
    let sideEffectClass: CompiledRequestType['sideEffectClass'] = 'READ_ONLY';
    if (/削除|上書き|変更|書き込み|保存/i.test(rawText)) {
      sideEffectClass = 'LOCAL_WRITE';
    }
    if (/実行|プロセス|シェル|起動/i.test(rawText)) {
      sideEffectClass = 'PROCESS_EXECUTION';
    }

    // 9. APPROVAL_CLASS (承認クラス)
    let approvalClass: CompiledRequestType['approvalClass'] = 'AUTOMATIC';
    if (sideEffectClass === 'LOCAL_WRITE' || sideEffectClass === 'PROCESS_EXECUTION') {
      approvalClass = 'CONFIRM_IF_BRANCH';
    }
    if (privacyClass === 'CONFIDENTIAL' || /完全削除|初期化|ドロップ/i.test(rawText)) {
      approvalClass = 'EXPLICIT_USER_APPROVAL_REQUIRED';
    }

    // 10. UNRESOLVED_QUESTIONS (未解決事項)
    const unresolvedQuestions: string[] = [];
    if (/vba|excel/i.test(rawText) && !/シート名|見出し|何行/i.test(rawText)) {
      unresolvedQuestions.push('対象シート名および見出し行の正確な名称（既定値: ActiveSheet）');
    }

    // 11. ROLLBACK_REQUIREMENT (ロールバック要否)
    const rollbackRequirement = sideEffectClass !== 'READ_ONLY';

    // 12. 決定論的実行可否 (非LLM部品レジストリで完結可能か)
    // 「どっち」だけでは比較結果を決められない。決定論的実行可否は、
    // 実際に既知の処理規則へ落とせる領域に限定する。
    const canExecuteDeterministically =
      /vba|マクロ|重複|転記|シート|正規化|挨拶|お疲れ|ありがとう/i.test(rawText);

    const compiled: CompiledRequestType = {
      requestId,
      compiled_id: requestId,
      goal,
      target,
      targetEntity: target,
      category: /マクロ|vba|コード|実装/i.test(rawText)
        ? 'CODE_SYNTHESIS'
        : /教えて|どう|なぜ|何/i.test(rawText)
        ? 'FACT_INQUIRY'
        : 'GENERAL_REQUEST',
      domain: /vba|excel/i.test(rawText)
        ? 'EXCEL_VBA'
        : /android|termux/i.test(rawText)
        ? 'ANDROID_TERMUX'
        : 'SOFTWARE_GENERAL',
      expectedDeliverable: deliverables[0] || '回答テキスト',
      certaintyRequirement: canExecuteDeterministically ? 'CERTAIN' : 'CONDITIONAL',
      resolvedAnaphora: [],
      deliverables,
      constraints,
      prohibitions,
      acceptanceCriteria,
      privacyClass,
      sideEffectClass,
      approvalClass,
      unresolvedQuestions,
      rollbackRequirement,
      canExecuteDeterministically,
      compiledAt: Date.now(),
    };

    systemLogger.info(
      'ANSWER_PLAN',
      `📋 [10.1 要求型コンパイル完了] ${requestId}: Goal=「${goal}」 | Target=「${target}」 | Deterministic=${canExecuteDeterministically} | SideEffect=${sideEffectClass} | Approval=${approvalClass}`
    );

    return compiled;
  }
}

export const requestTypeCompilerService = RequestTypeCompilerService.getInstance();
