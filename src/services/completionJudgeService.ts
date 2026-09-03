import {
  CompletionEvaluation,
  CompletionStatus,
  CompletionChecklist,
  ExecutionStep,
  ToolExecutionResult,
  WorkspaceFile,
  TaskPlan,
} from '../types';

/**
 * 文字列の軽量ハッシュ計算 (FNV-1a 32-bit hex)
 */
function calculateQuickHash(str: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return 'h_' + (hash >>> 0).toString(16).padStart(8, '0');
}

/**
 * 文書48章「完成条件と完了判定器」
 *
 * LLMの文章生成完了をそのまま「処理完了」とみなさず、
 * 7項目の完成条件チェックリスト（依頼目的充足、成果物の存在、必須項目の充足、
 * 検証結果、未解決事項の有無と明示、保存先とハッシュの記録、次操作の要否）
 * に基づいて厳格に完了状態を判定する。
 *
 * 【重要規則】
 * 生成コード・特にVBAコードを含む応答は、スマホ側の静的検証に通っただけでは
 * 決して COMPLETE にしてはならず、EXTERNAL_COMPILE_REQUIRED または RUNTIME_TEST_REQUIRED とする。
 */
export class CompletionJudgeService {
  /**
   * 応答内容とコンテキストから完了判定を厳格に下す
   */
  public evaluateCompletion(params: {
    userGoal: string;
    assistantResponse: string;
    isError?: boolean;
    executionSteps?: ExecutionStep[];
    executedTools?: ToolExecutionResult[];
    files?: WorkspaceFile[];
    taskPlan?: TaskPlan;
  }): CompletionEvaluation {
    const { userGoal, assistantResponse, isError, executionSteps, executedTools, files, taskPlan } = params;
    const responseText = assistantResponse || '';
    const goalText = userGoal || '';

    // ==========================================
    // 1. コード及びVBAの検出
    // ==========================================
    const detectedCodeTypes: string[] = [];
    const codeBlockRegex = /```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g;
    const codeBlocks: Array<{ lang: string; code: string }> = [];
    let match: RegExpExecArray | null;

    while ((match = codeBlockRegex.exec(responseText)) !== null) {
      const lang = (match[1] || '').toLowerCase().trim();
      const code = match[2];
      codeBlocks.push({ lang, code });
      if (lang) detectedCodeTypes.push(lang);
    }

    // VBA特有のキーワード検出 (構文ブロック)
    const vbaSpecificKeywords = [
      /\bSub\s+[a-zA-Z0-9_]+\s*\(/i,
      /\bFunction\s+[a-zA-Z0-9_]+\s*\(/i,
      /\bEnd\s+(Sub|Function)\b/i,
      /\bOption\s+Explicit\b/i,
      /\bDim\s+[a-zA-Z0-9_]+\s+As\s+/i,
      /\bWorksheets?\s*\(/i,
      /\bRange\s*\(/i,
      /\bCells\s*\(/i,
      /\bMsgBox\b/i,
      /\bOn\s+Error\s+GoTo\b/i,
    ];

    const hasVbaSyntax =
      detectedCodeTypes.some((t) => ['vba', 'vb', 'bas', 'frm', 'cls'].includes(t)) ||
      vbaSpecificKeywords.some((regex) => regex.test(responseText));

    if (hasVbaSyntax && !detectedCodeTypes.includes('vba')) {
      detectedCodeTypes.push('vba');
    }

    const isCodeOrVba = codeBlocks.length > 0 || hasVbaSyntax;

    // ==========================================
    // 2. 7項目チェックリストの個別診断
    // ==========================================

    // 項目1: 依頼の目的を満たしたか (goalSatisfaction)
    const goalSatisfaction = this.checkGoalSatisfaction(goalText, responseText, isError, taskPlan);

    // 項目2: 成果物の存在 (artifactPresence)
    const artifactPresence = this.checkArtifactPresence(responseText, codeBlocks, hasVbaSyntax, files, taskPlan);

    // 項目3: 必須項目の充足 (requiredItems)
    const requiredItems = this.checkRequiredItems(goalText, responseText, hasVbaSyntax);

    // 項目4: 検証結果の有無 (verification)
    const verification = this.checkVerificationStatus(responseText, hasVbaSyntax, executionSteps, executedTools, isError);

    // 項目5: 未解決事項の有無と明示 (unresolvedIssues)
    const unresolvedIssues = this.checkUnresolvedIssues(responseText);

    // 項目6: 保存先とハッシュの記録 (storageTracking)
    const storageTracking = this.createStorageTracking(codeBlocks, responseText, files);

    // 項目7: 次操作の要否 (nextAction)
    const nextAction = this.determineNextAction(hasVbaSyntax, isCodeOrVba, verification, unresolvedIssues, goalSatisfaction);

    const checklist: CompletionChecklist = {
      goalSatisfaction,
      artifactPresence,
      requiredItems,
      verification,
      unresolvedIssues,
      storageTracking,
      nextAction,
    };

    // ==========================================
    // 3. 文書48章のルールに基づく最終完了状態の決定
    // ==========================================
    let status: CompletionStatus = 'COMPLETE';
    let headline = '完了';
    let reason = 'すべての要件が満たされ、追加アクションは不要です。';
    let requiresExternalVerification = false;

    // ルールA: 実行時エラーまたはシステムエラー
    if (isError || verification.status === 'failed') {
      status = 'FAILED';
      headline = '処理失敗';
      reason = '処理中にエラーが発生したか、検証に失敗しました。';
    }
    // ルールB: 外部依存・権限・必須情報不足で停止している場合
    else if (!goalSatisfaction.passed && unresolvedIssues.hasIssues && !artifactPresence.passed) {
      status = 'BLOCKED';
      headline = '中断 / 情報待ち';
      reason = '必要な仕様や情報が不足しているため、追加の入力が必要です。';
    }
    // ルールC: 【文書48章最重要規則】VBAコードを含む場合
    // スマホ側の静的チェックに通っていても絶対に COMPLETE にしてはならない！
    else if (hasVbaSyntax) {
      requiresExternalVerification = true;
      if (verification.status === 'static_only' || verification.status === 'unverified') {
        // Excel/VBE環境でのコンパイル確認が必要
        status = 'EXTERNAL_COMPILE_REQUIRED';
        headline = '外部コンパイル待ち (Excel)';
        reason = 'スマホ側での静的構文チェックは通過しましたが、ExcelのVBE環境（Alt+F11）でのコンパイル確認が必要です。';
      } else {
        // コンパイル確認が済んでいる場合は実シートでの動作テスト要
        status = 'RUNTIME_TEST_REQUIRED';
        headline = '実機テスト要 (実シート)';
        reason = 'Excelでの構文確認後、実際のワークシートデータを用いた実行テストが必要です。';
      }
    }
    // ルールD: VBA以外のコードを含むが、実行テスト未検証の場合
    else if (isCodeOrVba && verification.status !== 'verified') {
      requiresExternalVerification = true;
      status = 'RUNTIME_TEST_REQUIRED';
      headline = '実機テスト要';
      reason = 'コードが生成されましたが、実行時テストによる動作確認が必要です。';
    }
    // ルールE: 未解決事項が残っているか、部分的な回答の場合
    else if (unresolvedIssues.hasIssues || !requiredItems.passed || !goalSatisfaction.passed) {
      status = 'PARTIAL';
      headline = '一部完了 / 未解決あり';
      reason = unresolvedIssues.hasIssues
        ? `未解決事項（${unresolvedIssues.issues.join(', ')}）が明記されています。`
        : '依頼の一部要件が未充足の可能性があります。';
    }
    // ルールF: 質問回答・解説等で要件を完遂した場合
    else {
      status = 'COMPLETE';
      headline = '完了';
      reason = '依頼事項に対する完全な回答・解説が提供されました。';
    }

    // スコア計算 (0〜100)
    const score = this.calculateCompletionScore(checklist, status);

    return {
      status,
      score,
      headline,
      reason,
      checklist,
      isCodeOrVba,
      detectedCodeTypes,
      requiresExternalVerification,
      evaluatedAt: Date.now(),
      manuallyOverridden: false,
    };
  }

  /**
   * 1. 依頼目的の充足度判定
   */
  private checkGoalSatisfaction(
    goal: string,
    response: string,
    isError?: boolean,
    taskPlan?: TaskPlan
  ): { passed: boolean; note: string } {
    if (isError) {
      return { passed: false, note: 'エラー発生のため目的未達成' };
    }
    if (!response || response.trim().length < 15) {
      return { passed: false, note: '応答本文が極めて短く、十分な情報がありません' };
    }

    // タスク計画がある場合
    if (taskPlan) {
      const completedRatio = taskPlan.totalSteps > 0 ? taskPlan.completedSteps / taskPlan.totalSteps : 0;
      if (taskPlan.status === 'failed') {
        return { passed: false, note: `タスク計画の実行中にエラーが発生しました (${completedRatio * 100}%完了)` };
      }
      if (completedRatio < 1 && taskPlan.status !== 'completed') {
        return { passed: false, note: `タスク計画が進行中または一部未完了です (${taskPlan.completedSteps}/${taskPlan.totalSteps})` };
      }
    }

    // 不可能・拒否・ブロッキング表現の検知
    const blockingPhrases = [
      '対応できません',
      'わかりかねます',
      'サポートしていません',
      '情報が不足しており',
      '処理に失敗しました',
      'エラーが発生しました',
    ];
    for (const phrase of blockingPhrases) {
      if (response.includes(phrase)) {
        return { passed: false, note: `応答内に未解決またはブロッキング文言が含まれています: 「${phrase}」` };
      }
    }

    return { passed: true, note: '依頼の主旨に対する具体的な回答または成果物が提供されています' };
  }

  /**
   * 2. 成果物の存在判定
   */
  private checkArtifactPresence(
    response: string,
    codeBlocks: Array<{ lang: string; code: string }>,
    hasVba: boolean,
    files?: WorkspaceFile[],
    taskPlan?: TaskPlan
  ): { passed: boolean; type?: 'code' | 'vba' | 'json' | 'plan' | 'text' | 'file'; summary?: string } {
    if (hasVba) {
      const subCount = (response.match(/\bSub\s+/gi) || []).length;
      const fnCount = (response.match(/\bFunction\s+/gi) || []).length;
      return {
        passed: true,
        type: 'vba',
        summary: `VBAプロシージャ (${subCount > 0 ? `${subCount}個のSub ` : ''}${fnCount > 0 ? `${fnCount}個のFunction` : ''})`,
      };
    }

    if (codeBlocks.length > 0) {
      const langs = Array.from(new Set(codeBlocks.map((b) => b.lang || 'text'))).join(', ');
      return {
        passed: true,
        type: 'code',
        summary: `コードブロック ${codeBlocks.length}件 (${langs})`,
      };
    }

    if (files && files.length > 0) {
      return {
        passed: true,
        type: 'file',
        summary: `ワークスペースファイル ${files.length}件`,
      };
    }

    if (taskPlan && taskPlan.steps.length > 0) {
      return {
        passed: true,
        type: 'plan',
        summary: `実行タスク計画 (${taskPlan.steps.length}ステップ)`,
      };
    }

    if (response.trim().length >= 40) {
      return {
        passed: true,
        type: 'text',
        summary: '解説・分析テキスト回答',
      };
    }

    return { passed: false, summary: '具体的な成果物が検出されませんでした' };
  }

  /**
   * 3. 必須項目の充足判定
   */
  private checkRequiredItems(
    goal: string,
    response: string,
    hasVba: boolean
  ): { passed: boolean; fulfilled: string[]; missing: string[] } {
    const fulfilled: string[] = [];
    const missing: string[] = [];

    // VBAのベストプラクティス項目のチェック
    if (hasVba) {
      if (/Option\s+Explicit/i.test(response)) {
        fulfilled.push('Option Explicit (変数明示宣言)');
      } else {
        missing.push('Option Explicit (未宣言変数の検知防止)');
      }

      if (/On\s+Error\s+GoTo/i.test(response) || /Err\./i.test(response)) {
        fulfilled.push('エラーハンドリング (On Error)');
      }

      if (/Application\.ScreenUpdating/i.test(response)) {
        fulfilled.push('描画抑制 (高速化)');
      }
    }

    // ユーザー依頼からの特定要求キーワード充足
    const goalLower = goal.toLowerCase();
    if (goalLower.includes('ループ') || goalLower.includes('繰り返し')) {
      if (/For\s+|While\s+|Do\s+/i.test(response)) {
        fulfilled.push('ループ処理の実装');
      } else {
        missing.push('指定されたループ処理');
      }
    }

    if (goalLower.includes('コピー') || goalLower.includes('転記')) {
      if (/Copy|Value\s*=|Paste/i.test(response)) {
        fulfilled.push('転記/コピーロジック');
      } else {
        missing.push('転記/コピー処理');
      }
    }

    return {
      passed: missing.length === 0,
      fulfilled,
      missing,
    };
  }

  /**
   * 4. 検証結果の有無
   */
  private checkVerificationStatus(
    response: string,
    hasVba: boolean,
    executionSteps?: ExecutionStep[],
    executedTools?: ToolExecutionResult[],
    isError?: boolean
  ): { status: 'verified' | 'static_only' | 'unverified' | 'failed'; note: string } {
    if (isError) {
      return { status: 'failed', note: '処理エラーが検出されました' };
    }

    // ツール実行結果のチェック
    if (executedTools && executedTools.length > 0) {
      const anyToolFailed = executedTools.some((t) => !t.success);
      if (anyToolFailed) {
        return { status: 'failed', note: 'ツール実行時にエラーが発生しました' };
      }
      return { status: 'verified', note: `ツール ${executedTools.length}件の実行検証に合格` };
    }

    // VBA構文の静的チェック
    if (hasVba) {
      const subPairs = (response.match(/\bSub\s+[a-zA-Z0-9_]+/gi) || []).length;
      const endSubPairs = (response.match(/\bEnd\s+Sub\b/gi) || []).length;
      const fnPairs = (response.match(/\bFunction\s+[a-zA-Z0-9_]+/gi) || []).length;
      const endFnPairs = (response.match(/\bEnd\s+Function\b/gi) || []).length;

      if (subPairs !== endSubPairs || fnPairs !== endFnPairs) {
        return {
          status: 'failed',
          note: `プロシージャの開始と終了が不一致です (Sub: ${subPairs}/${endSubPairs}, Function: ${fnPairs}/${endFnPairs})`,
        };
      }

      return {
        status: 'static_only',
        note: '端末側の構文静的検査（Sub/End Subペア、基本ブロック構文）は通過',
      };
    }

    // 実行ステップのチェック
    if (executionSteps && executionSteps.length > 0) {
      const hasErrorStep = executionSteps.some((s) => s.status === 'error');
      if (hasErrorStep) {
        return { status: 'failed', note: '実行ステップ中にエラーが発生しました' };
      }
      return { status: 'verified', note: 'すべての実行ステップが成功しました' };
    }

    return { status: 'unverified', note: '動的検証は未実施です' };
  }

  /**
   * 5. 未解決事項の有無と明示
   */
  private checkUnresolvedIssues(
    response: string
  ): { hasIssues: boolean; issues: string[]; explicitlyNoted: boolean } {
    const issues: string[] = [];

    const issuePatterns = [
      { pattern: /TODO[:\s]+([^\n]+)/gi, prefix: 'TODO' },
      { pattern: /未実装[:\s]+([^\n]+)/gi, prefix: '未実装' },
      { pattern: /【注意】([^\n]+)/gi, prefix: '注意' },
      { pattern: /制約事項[:\s]+([^\n]+)/gi, prefix: '制約' },
      { pattern: /要確認[:\s]+([^\n]+)/gi, prefix: '要確認' },
    ];

    for (const { pattern, prefix } of issuePatterns) {
      let m: RegExpExecArray | null;
      while ((m = pattern.exec(response)) !== null) {
        const detail = m[1].trim().slice(0, 40);
        issues.push(`${prefix}: ${detail}`);
      }
    }

    const explicitlyNoted =
      issues.length > 0 &&
      (response.includes('注意') ||
        response.includes('制約') ||
        response.includes('未対応') ||
        response.includes('留意点'));

    return {
      hasIssues: issues.length > 0,
      issues,
      explicitlyNoted,
    };
  }

  /**
   * 6. 保存先とハッシュの記録
   */
  private createStorageTracking(
    codeBlocks: Array<{ lang: string; code: string }>,
    response: string,
    files?: WorkspaceFile[]
  ): { savedLocation?: string; contentHash?: string; filename?: string } {
    const mainCode = codeBlocks.length > 0 ? codeBlocks.map((b) => b.code).join('\n') : response;
    const contentHash = calculateQuickHash(mainCode);

    let savedLocation = 'クリップボード / チャット履歴';
    let filename: string | undefined;

    if (files && files.length > 0) {
      savedLocation = files[0].path;
      filename = files[0].name;
    } else if (codeBlocks.some((b) => ['vba', 'vb', 'bas'].includes(b.lang))) {
      filename = 'Module1.bas';
      savedLocation = 'Excel標準モジュール (手動貼付またはVBAエクスポート)';
    }

    return {
      savedLocation,
      contentHash,
      filename,
    };
  }

  /**
   * 7. 次操作の要否判定
   */
  private determineNextAction(
    hasVba: boolean,
    isCode: boolean,
    verification: { status: string },
    unresolved: { hasIssues: boolean },
    goalSat: { passed: boolean }
  ): {
    required: boolean;
    actionType: 'compile_in_excel' | 'run_test' | 'provide_info' | 'user_review' | 'none';
    note: string;
  } {
    if (!goalSat.passed) {
      return {
        required: true,
        actionType: 'provide_info',
        note: '仕様や条件の詳細を追加でお知らせください。',
      };
    }

    if (hasVba) {
      return {
        required: true,
        actionType: 'compile_in_excel',
        note: 'ExcelのVBE (Alt+F11) の標準モジュールに貼り付け、[デバッグ] → [VBAProjectのコンパイル] を実行してください。',
      };
    }

    if (isCode) {
      return {
        required: true,
        actionType: 'run_test',
        note: '対象の実行環境でテスト実行し、挙動をご確認ください。',
      };
    }

    if (unresolved.hasIssues) {
      return {
        required: true,
        actionType: 'user_review',
        note: '明記された注意事項や制約をご確認ください。',
      };
    }

    return {
      required: false,
      actionType: 'none',
      note: '追加の必須アクションはありません。',
    };
  }

  /**
   * 完了スコアの算出 (0〜100)
   */
  private calculateCompletionScore(checklist: CompletionChecklist, status: CompletionStatus): number {
    if (status === 'FAILED') return 10;
    if (status === 'BLOCKED') return 30;

    let score = 50;
    if (checklist.goalSatisfaction.passed) score += 20;
    if (checklist.artifactPresence.passed) score += 15;
    if (checklist.requiredItems.passed) score += 10;
    if (checklist.verification.status === 'verified') score += 15;
    else if (checklist.verification.status === 'static_only') score += 10;
    if (!checklist.unresolvedIssues.hasIssues) score += 10;
    if (status === 'COMPLETE') score = Math.max(95, score);
    if (status === 'EXTERNAL_COMPILE_REQUIRED') score = Math.min(88, score);
    if (status === 'RUNTIME_TEST_REQUIRED') score = Math.min(85, score);
    if (status === 'PARTIAL') score = Math.min(75, score);

    return Math.min(100, Math.max(0, score));
  }

  /**
   * ユーザーの手動操作により完了状態を「COMPLETE」に昇格
   * (例: 「Excelでコンパイル・動作確認成功」ボタン押下時)
   */
  public markAsCompleted(evaluation: CompletionEvaluation, userNote?: string): CompletionEvaluation {
    return {
      ...evaluation,
      status: 'COMPLETE',
      score: 100,
      headline: '動作確認完了 (手動承認)',
      reason: userNote || 'ユーザーにより外部環境（Excel等）での動作確認・コンパイル成功が確認されました。',
      requiresExternalVerification: false,
      manuallyOverridden: true,
      checklist: {
        ...evaluation.checklist,
        verification: {
          status: 'verified',
          note: userNote || '外部環境での実行テスト合格',
        },
        nextAction: {
          required: false,
          actionType: 'none',
          note: 'すべての確認が完了しました。',
        },
      },
    };
  }

  /**
   * ユーザーの手動操作により「FAILED」に更新
   * (例: 「Excelでエラーが出た」報告時)
   */
  public markAsFailed(evaluation: CompletionEvaluation, errorReason: string): CompletionEvaluation {
    return {
      ...evaluation,
      status: 'FAILED',
      score: 20,
      headline: '外部実行エラー',
      reason: errorReason,
      requiresExternalVerification: true,
      manuallyOverridden: true,
      checklist: {
        ...evaluation.checklist,
        verification: {
          status: 'failed',
          note: `外部環境実行エラー: ${errorReason}`,
        },
        nextAction: {
          required: true,
          actionType: 'provide_info',
          note: 'エラー内容をチャットに貼り付けて修正を依頼してください。',
        },
      },
    };
  }

  /**
   * UI表示用のバッジプロパティ設定を取得
   */
  public getBadgeConfig(status: CompletionStatus): {
    label: string;
    shortLabel: string;
    bgColor: string;
    textColor: string;
    borderColor: string;
    icon: string;
    description: string;
  } {
    switch (status) {
      case 'COMPLETE':
        return {
          label: '✅ 完了 (検証済)',
          shortLabel: '完了',
          bgColor: 'bg-emerald-500/10 dark:bg-emerald-500/20',
          textColor: 'text-emerald-700 dark:text-emerald-300',
          borderColor: 'border-emerald-500/30',
          icon: 'CheckCircle2',
          description: 'すべての要求を満たし、必要な検証も完了しています。',
        };
      case 'EXTERNAL_COMPILE_REQUIRED':
        return {
          label: '🟡 外部コンパイル待ち (Excel/VBE)',
          shortLabel: '外部コンパイル要',
          bgColor: 'bg-amber-500/10 dark:bg-amber-500/20',
          textColor: 'text-amber-700 dark:text-amber-300',
          borderColor: 'border-amber-500/30',
          icon: 'FileCode2',
          description: 'スマホ側での静的チェックは通過。ExcelのVBE環境でのコンパイル確認が必要です。',
        };
      case 'RUNTIME_TEST_REQUIRED':
        return {
          label: '🧪 実機テスト要 (シート確認)',
          shortLabel: '実機テスト要',
          bgColor: 'bg-violet-500/10 dark:bg-violet-500/20',
          textColor: 'text-violet-700 dark:text-violet-300',
          borderColor: 'border-violet-500/30',
          icon: 'FlaskConical',
          description: 'コードの構文は通っていますが、実際のデータを用いた実行テストが必要です。',
        };
      case 'PARTIAL':
        return {
          label: '⚠️ 一部完了 / 未解決あり',
          shortLabel: '一部完了',
          bgColor: 'bg-yellow-500/10 dark:bg-yellow-500/20',
          textColor: 'text-yellow-700 dark:text-yellow-300',
          borderColor: 'border-yellow-500/30',
          icon: 'AlertTriangle',
          description: '一部の要件が完了しましたが、未解決事項や残課題があります。',
        };
      case 'BLOCKED':
        return {
          label: '🚫 ブロック中 / 情報待ち',
          shortLabel: 'ブロック中',
          bgColor: 'bg-rose-500/10 dark:bg-rose-500/20',
          textColor: 'text-rose-700 dark:text-rose-300',
          borderColor: 'border-rose-500/30',
          icon: 'Ban',
          description: '必要な情報や外部前提条件が不足しているため処理が中断しています。',
        };
      case 'FAILED':
        return {
          label: '❌ 失敗',
          shortLabel: '失敗',
          bgColor: 'bg-red-500/10 dark:bg-red-500/20',
          textColor: 'text-red-700 dark:text-red-300',
          borderColor: 'border-red-500/30',
          icon: 'XCircle',
          description: '処理中にエラーが発生したか、検証に合格しませんでした。',
        };
      case 'CANCELLED':
        return {
          label: '⏸️ 中断',
          shortLabel: '中断',
          bgColor: 'bg-slate-500/10 dark:bg-slate-500/20',
          textColor: 'text-slate-700 dark:text-slate-300',
          borderColor: 'border-slate-500/30',
          icon: 'PauseCircle',
          description: 'ユーザー操作またはタイムアウトにより中断されました。',
        };
      default:
        return {
          label: '未判定',
          shortLabel: '未判定',
          bgColor: 'bg-zinc-500/10',
          textColor: 'text-zinc-600',
          borderColor: 'border-zinc-300',
          icon: 'HelpCircle',
          description: '判定待機中',
        };
    }
  }
}

export const completionJudgeService = new CompletionJudgeService();
