import {
  TaskPlan,
  TaskStep,
  TaskStepStatus,
  TaskPlanStatus,
  WorkspaceFile,
  MemoryItem,
} from '../types';
import { storageService } from './storageService';
import { systemLogger } from './systemLogger';
import { toolsService } from './toolsService';

const ACTIVE_PLAN_KEY = 'miki_active_task_plan';
const PLAN_HISTORY_KEY = 'miki_task_plan_history';

export interface PlanGenerationContext {
  workspaceFiles?: WorkspaceFile[];
  workspaceFilesCount?: number;
  relevantMemories?: MemoryItem[];
  attachedFilesCount?: number;
  userExplicitMultiStep?: boolean;
}

export interface StepAdvanceResult {
  updatedPlan: TaskPlan;
  nextStep: TaskStep | null;
  isDone: boolean;
  summary?: string;
}

export interface PlanCompletionJudgement {
  isComplete: boolean;
  canProceed: boolean;
  successRate: number;
  completedCount: number;
  failedCount: number;
  summary: string;
}

class TaskPlanService {
  /**
   * 単発応答か多段計画（Multi-step Reasoning）かを判定するヒューリスティック
   * 制約: 「全会話を多段化しない。単純なチャットは軽量に保つ」
   */
  public shouldUseMultiStep(text: string, context?: PlanGenerationContext): boolean {
    const trimmed = text.trim();
    if (!trimmed) return false;

    // ユーザーが手動/明示的に多段モードを指定している場合
    if (context?.userExplicitMultiStep) {
      return true;
    }

    // 短文（挨拶、単純な質問、日常会話）は確実に除外
    if (trimmed.length < 25) {
      // 短くても明示的な計画キーワードがある場合のみ例外
      if (/^(計画|タスク計画|段階的に|ステップごと)/.test(trimmed)) {
        return true;
      }
      return false;
    }

    // 1. 明示的な段階的思考・計画の要請
    const explicitPlanningPatterns = [
      /ステップ[ご毎]とに/i,
      /段階的[にな]/,
      /順[をを]追って/,
      /計画[を立てて|して|の作成]/,
      /タスク[分解|プラン|計画]/,
      /まず.*(?:次に|その[後あ]と)/,
      /ロードマップ/,
      /詳細な手順/,
      /マルチステップ/,
      /多段推論/,
      /要件定義.*実装.*検証/,
    ];
    if (explicitPlanningPatterns.some((pattern) => pattern.test(trimmed))) {
      return true;
    }

    // 2. 複数ファイル・添付ファイルに跨る複合タスク
    if ((context?.attachedFilesCount || 0) >= 2) {
      return true;
    }

    // 3. 複合的な開発・設計・リファクタリング要請
    const complexDevPatterns = [
      /(?:設計|アーキテクチャ).*(?:実装|コーディング).*(?:テスト|検証)/,
      /(?:リファクタ|改修|書き換え).*(?:かつ|および|その上で)/,
      /バグ[のを探して|を特定して].*(?:修正|パッチ).*(?:検証|確認)/,
      /機能[をの](?:追加|実装).*(?:テスト|動作確認)/,
      /整合性[をの]検証/,
      /エッジケース.*考慮/,
    ];
    if (complexDevPatterns.some((pattern) => pattern.test(trimmed))) {
      return true;
    }

    // 4. 長文かつ複数指示を含むタスク
    if (trimmed.length >= 150) {
      const instructionSignals = [
        trimmed.includes('1.') || trimmed.includes('①') || trimmed.includes('- '),
        trimmed.includes('前提') || trimmed.includes('制約'),
        trimmed.includes('ただし') || trimmed.includes('条件'),
        trimmed.includes('出力形式') || trimmed.includes('フォーマット'),
        trimmed.includes('検証') || trimmed.includes('チェック'),
      ];
      const matchCount = instructionSignals.filter(Boolean).length;
      if (matchCount >= 2) {
        return true;
      }
    }

    return false;
  }

  /**
   * ゴール文字列から制約事項を抽出
   */
  private extractConstraints(goal: string): string[] {
    const constraints: string[] = [];
    const lines = goal.split('\n');
    for (const line of lines) {
      if (/制約|禁止|ただし|前提|条件|ルール/i.test(line)) {
        constraints.push(line.replace(/^[・\-*\d.]\s*/, '').trim());
      }
    }
    return constraints.slice(0, 5);
  }

  /**
   * ゴール文字列から受け入れ条件を抽出
   */
  private extractAcceptanceConditions(goal: string): string[] {
    const conditions: string[] = [];
    const lines = goal.split('\n');
    for (const line of lines) {
      if (/受け入れ|完了条件|ゴール|要件|必須/i.test(line)) {
        conditions.push(line.replace(/^[・\-*\d.]\s*/, '').trim());
      }
    }
    return conditions.slice(0, 5);
  }

  /**
   * ゴールとコンテキストから多段推論タスク計画を立案・生成
   */
  public createPlan(goal: string, context?: PlanGenerationContext): TaskPlan {
    const planId = `plan_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const steps = this.decomposeGoalToSteps(goal, context);

    const plan: TaskPlan = {
      id: planId,
      goal,
      status: 'planning',
      steps,
      currentStepIndex: 0,
      totalSteps: steps.length,
      completedSteps: 0,
      claimLedger: {
        confirmed: [],
        hypotheses: [],
        unconfirmed: [],
      },
      constraints: this.extractConstraints(goal),
      acceptanceConditions: this.extractAcceptanceConditions(goal),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      checkpoint: {
        snapshotTime: Date.now(),
        completedStepCount: 0,
        stateData: {
          initialGoal: goal,
          workspaceFileCount: context?.workspaceFiles?.length || 0,
        },
      },
    };

    // 初期ステップを開始状態に設定
    if (plan.steps.length > 0) {
      plan.steps[0].status = 'in_progress';
      plan.status = 'executing';
    }

    this.saveCheckpoint(plan);
    systemLogger.info('STEP', `新規タスク計画立案完了: [${planId}] 全${plan.totalSteps}ステップ`, {
      goal: goal.slice(0, 80),
      stepTitles: plan.steps.map((s) => s.title),
    });

    return plan;
  }

  /**
   * 入力内容の特性に応じたステップの分解ロジック
   */
  private decomposeGoalToSteps(goal: string, context?: PlanGenerationContext): TaskStep[] {
    const steps: TaskStep[] = [];
    let stepNumber = 1;

    // 候補ツールの事前検知
    const candidateTools = toolsService.detectCandidateToolsForPrompt(goal, {
      workspaceFiles: context?.workspaceFiles,
    });
    const hasMathTool = candidateTools.some((t) => t.toolId === 'tool_safe_calculator');
    const hasWorkspaceTool = candidateTools.some((t) => t.toolId.startsWith('tool_workspace_'));

    const isCodingTask =
      goal.includes('コード') ||
      goal.includes('実装') ||
      goal.includes('作成') ||
      goal.includes('修正') ||
      goal.includes('HTML') ||
      goal.includes('TypeScript') ||
      goal.includes('バグ');

    const isAnalysisOnly =
      !isCodingTask &&
      (goal.includes('比較') || goal.includes('分析') || goal.includes('考察') || goal.includes('教えて'));

    // Step 1: 要件整理 & 制約分析 (共通)
    steps.push({
      id: `step_${stepNumber}`,
      stepNumber: stepNumber++,
      title: '要件定義と制約条件の抽出',
      description: '提示された課題のゴール、入力前提、必須要件および禁止事項を論理的に分解します。',
      status: 'pending',
      actionType: 'analysis',
    });

    // Step 2: ツール実行またはコンテキスト調査
    if (hasMathTool) {
      const mathTool = candidateTools.find((t) => t.toolId === 'tool_safe_calculator');
      steps.push({
        id: `step_${stepNumber}`,
        stepNumber: stepNumber++,
        title: '安全数値計算機による精密計算',
        description: '曖昧性のない安全再帰下降パーサーを用いて、数式および計算条件を厳密に算出します。',
        status: 'pending',
        actionType: 'tool_execution',
        toolCall: {
          toolId: 'tool_safe_calculator',
          toolName: '高精度・安全数値計算機',
          params: mathTool?.suggestedParams,
        },
      });
    } else if (hasWorkspaceTool) {
      steps.push({
        id: `step_${stepNumber}`,
        stepNumber: stepNumber++,
        title: 'ワークスペース対象リソースの走査・確認',
        description: '対象ファイルの内容、行数、依存構造を読み出し、改修影響範囲を特定します。',
        status: 'pending',
        actionType: 'tool_execution',
        toolCall: {
          toolId: candidateTools[0].toolId,
          toolName: candidateTools[0].name,
          params: candidateTools[0].suggestedParams,
        },
      });
    } else if (isCodingTask) {
      steps.push({
        id: `step_${stepNumber}`,
        stepNumber: stepNumber++,
        title: 'アーキテクチャ・データ構造設計',
        description: '型定義、状態遷移、コンポーネント構成およびエラーケースの事前設計を策定します。',
        status: 'pending',
        actionType: 'analysis',
      });
    } else {
      steps.push({
        id: `step_${stepNumber}`,
        stepNumber: stepNumber++,
        title: '前提調査と多角的視点からの情報整理',
        description: '課題に関連する前提事実や比較対象、関連記憶を抽出し、比較軸を定義します。',
        status: 'pending',
        actionType: 'analysis',
      });
    }

    // Step 3: 実装生成または論理展開
    if (isCodingTask) {
      steps.push({
        id: `step_${stepNumber}`,
        stepNumber: stepNumber++,
        title: 'コア実装および生成成果物の構築',
        description: 'モジュール設計に沿った実動コード、関数、コンポーネントを段階的に生成します。',
        status: 'pending',
        actionType: 'code_generation',
      });
    } else if (isAnalysisOnly) {
      steps.push({
        id: `step_${stepNumber}`,
        stepNumber: stepNumber++,
        title: '論点ごとの詳細分析と根拠の提示',
        description: '各論点に対する客観的メリット・デメリット・定量的根拠を体系化します。',
        status: 'pending',
        actionType: 'synthesis',
      });
    } else {
      steps.push({
        id: `step_${stepNumber}`,
        stepNumber: stepNumber++,
        title: '解決策の具体化と手順の策定',
        description: '実行可能な具体的アクション、解決手順、アウトプットの詳細を構築します。',
        status: 'pending',
        actionType: 'synthesis',
      });
    }

    // Step 4: 自己検証 & 整合性チェック (フェーズ3の中核)
    steps.push({
      id: `step_${stepNumber}`,
      stepNumber: stepNumber++,
      title: '整合性の自己検証とエッジケース検査',
      description: '生成成果物・導出結果に論理的矛盾やエッジケースの見落とし、構文エラーがないかを点検します。',
      status: 'pending',
      actionType: 'verification',
    });

    // Step 5: 最終統合 & サマリー提示
    steps.push({
      id: `step_${stepNumber}`,
      stepNumber: stepNumber++,
      title: '結論の統合と次のアクション提示',
      description: '各ステップの成果を統合し、ユーザーにとって直感的かつ即座に実行可能な形でまとめます。',
      status: 'pending',
      actionType: 'synthesis',
    });

    return steps;
  }

  /**
   * claimLedgerを数行〜十数行のコンパクトな要約文字列にフォーマット
   * 原文を毎回積まず、トークン消費の爆発を防ぐ核心部
   */
  public formatClaimLedger(ledger: TaskPlan['claimLedger']): string {
    const confirmed = ledger.confirmed.length > 0
      ? ledger.confirmed.map((c) => `  - [確定] ${c}`).join('\n')
      : '  - (なし)';
    const hypotheses = ledger.hypotheses.length > 0
      ? ledger.hypotheses.map((h) => `  - [仮説] ${h}`).join('\n')
      : '  - (なし)';
    const unconfirmed = ledger.unconfirmed.length > 0
      ? ledger.unconfirmed.map((u) => `  - [未確認] ${u}`).join('\n')
      : '  - (なし)';

    return `■ 確定事実 (Confirmed Claims):\n${confirmed}\n■ 仮説事項 (Hypotheses):\n${hypotheses}\n■ 未確認・要調査 (Unconfirmed):\n${unconfirmed}`;
  }

  /**
   * LLMによる短縮論理抽出用のプロンプトを構築
   */
  public buildClaimExtractionPrompt(
    stepTitle: string,
    stepResultText: string,
    actionType?: string
  ): string {
    return `【論理台帳の更新抽出】
以下のステップ実行結果を分析し、
1. 確定した事実 (confirmed): 明確に確認・成功・立証された事項
2. 仮説段階 (hypotheses): まだ推測や推論段階のもの
3. 未確認・要調査事項 (unconfirmed): 今後の確認や検証が必要な事項
をそれぞれ1〜3行以内の簡潔な箇条書きで抽出してください。

ステップ: ${stepTitle} (${actionType || 'analysis'})
結果抜粋:
${stepResultText.slice(0, 1000)}

出力フォーマット (各行ハイフン始まり):
[確定]
- ...
[仮説]
- ...
[未確認]
- ...`;
  }

  /**
   * テキストまたはLLM応答から確定事実・仮説・未確認事項をパース
   */
  public parseClaimsFromText(
    rawText: string,
    stepTitle: string,
    success: boolean
  ): { confirmed: string[]; hypotheses: string[]; unconfirmed: string[] } {
    const confirmed: string[] = [];
    const hypotheses: string[] = [];
    const unconfirmed: string[] = [];

    let currentSection: 'confirmed' | 'hypotheses' | 'unconfirmed' | null = null;
    const lines = rawText.split('\n').map((l) => l.trim()).filter(Boolean);

    for (const line of lines) {
      const lower = line.toLowerCase();
      if (line.includes('[確定]') || lower.includes('confirmed') || line.startsWith('確定:')) {
        currentSection = 'confirmed';
        continue;
      } else if (line.includes('[仮説]') || lower.includes('hypotheses') || line.startsWith('仮説:')) {
        currentSection = 'hypotheses';
        continue;
      } else if (line.includes('[未確認]') || lower.includes('unconfirmed') || line.startsWith('未確認:')) {
        currentSection = 'unconfirmed';
        continue;
      }

      if (line.startsWith('-') || line.startsWith('・') || line.startsWith('*') || /^\d+\./.test(line)) {
        const clean = line.replace(/^[-・*\d.]\s*/, '').trim();
        if (!clean) continue;
        if (currentSection === 'confirmed') confirmed.push(clean);
        else if (currentSection === 'hypotheses') hypotheses.push(clean);
        else if (currentSection === 'unconfirmed') unconfirmed.push(clean);
      }
    }

    // パースで1件も取れなかった場合の確実なフォールバック
    if (confirmed.length === 0 && hypotheses.length === 0 && unconfirmed.length === 0) {
      const summarySnippet = rawText.slice(0, 120).replace(/[\r\n]+/g, ' ').trim();
      if (success) {
        confirmed.push(`${stepTitle}: ${summarySnippet}`);
      } else {
        unconfirmed.push(`${stepTitle}で課題検知: ${summarySnippet}`);
      }
    }

    return { confirmed, hypotheses, unconfirmed };
  }

  /**
   * 現在のステップを進行し、結果を記録して次のステップを準備
   * claimLedger (確定事実・仮説・未確認事項) を更新
   */
  public advanceStep(
    plan: TaskPlan,
    stepResult: {
      success: boolean;
      resultText: string;
      error?: string;
      durationMs?: number;
      confidenceScore?: number;
      extractedClaims?: {
        confirmed?: string[];
        hypotheses?: string[];
        unconfirmed?: string[];
      };
    }
  ): StepAdvanceResult {
    const updatedPlan: TaskPlan = JSON.parse(JSON.stringify(plan));
    const currentIndex = updatedPlan.currentStepIndex;
    const currentStep = updatedPlan.steps[currentIndex];

    if (!currentStep) {
      return {
        updatedPlan,
        nextStep: null,
        isDone: true,
      };
    }

    // ステップ結果を記録
    currentStep.status = stepResult.success ? 'completed' : 'failed';
    currentStep.result = stepResult.resultText;
    currentStep.error = stepResult.error;
    currentStep.durationMs = stepResult.durationMs || 0;
    currentStep.confidenceScore = stepResult.confidenceScore;

    // claimLedger の整合性保証
    if (!updatedPlan.claimLedger) {
      updatedPlan.claimLedger = {
        confirmed: [],
        hypotheses: [],
        unconfirmed: [],
      };
    }

    // claimLedger の更新 (LLM抽出結果 または ルールベース解析)
    const claims = stepResult.extractedClaims || this.parseClaimsFromText(
      stepResult.resultText,
      currentStep.title,
      stepResult.success
    );

    if (claims.confirmed && claims.confirmed.length > 0) {
      for (const c of claims.confirmed) {
        if (!updatedPlan.claimLedger.confirmed.includes(c)) {
          updatedPlan.claimLedger.confirmed.push(c);
        }
      }
    }
    if (claims.hypotheses && claims.hypotheses.length > 0) {
      for (const h of claims.hypotheses) {
        if (!updatedPlan.claimLedger.hypotheses.includes(h)) {
          updatedPlan.claimLedger.hypotheses.push(h);
        }
      }
    }
    if (claims.unconfirmed && claims.unconfirmed.length > 0) {
      for (const u of claims.unconfirmed) {
        if (!updatedPlan.claimLedger.unconfirmed.includes(u)) {
          updatedPlan.claimLedger.unconfirmed.push(u);
        }
      }
    }
    // 確定した事実と重複・解決した未確認事項をクリーンアップ
    if (claims.confirmed && claims.confirmed.length > 0) {
      updatedPlan.claimLedger.unconfirmed = updatedPlan.claimLedger.unconfirmed.filter(
        (u) => !claims.confirmed!.some((c) => c.includes(u) || u.includes(c))
      );
    }

    if (stepResult.success) {
      updatedPlan.completedSteps = updatedPlan.steps.filter((s) => s.status === 'completed').length;
    }

    updatedPlan.updatedAt = Date.now();

    // チェックポイント更新
    updatedPlan.checkpoint = {
      lastCompletedStepId: currentStep.id,
      snapshotTime: Date.now(),
      completedStepCount: updatedPlan.completedSteps,
      stateData: {
        lastStepTitle: currentStep.title,
        lastResultSnippet: stepResult.resultText.slice(0, 100),
        confirmedClaimsCount: updatedPlan.claimLedger.confirmed.length,
      },
    };

    // 次のステップの決定
    const nextIndex = currentIndex + 1;
    let nextStep: TaskStep | null = null;

    if (nextIndex < updatedPlan.steps.length) {
      updatedPlan.currentStepIndex = nextIndex;
      nextStep = updatedPlan.steps[nextIndex];
      nextStep.status = 'in_progress';
      updatedPlan.status = 'executing';
    } else {
      // 全ステップ終了
      updatedPlan.status = updatedPlan.steps.some((s) => s.status === 'failed')
        ? 'failed'
        : 'completed';
      const judgement = this.judgeCompletion(updatedPlan);
      updatedPlan.finalSummary = judgement.summary;
    }

    this.saveCheckpoint(updatedPlan);

    systemLogger.step(
      currentIndex + 1,
      updatedPlan.totalSteps,
      `タスクステップ進捗: [${currentStep.title}] -> ${currentStep.status} (確定事実: ${updatedPlan.claimLedger.confirmed.length}件)`,
      {
        planId: updatedPlan.id,
        durationMs: currentStep.durationMs,
        isDone: !nextStep,
        claimLedgerSummary: {
          confirmed: updatedPlan.claimLedger.confirmed.length,
          hypotheses: updatedPlan.claimLedger.hypotheses.length,
          unconfirmed: updatedPlan.claimLedger.unconfirmed.length,
        },
      }
    );

    return {
      updatedPlan,
      nextStep,
      isDone: !nextStep,
      summary: updatedPlan.finalSummary,
    };
  }

  /**
   * 計画全体の達成状況と最終品質を判定
   */
  public judgeCompletion(plan: TaskPlan): PlanCompletionJudgement {
    const total = plan.steps.length;
    const completed = plan.steps.filter((s) => s.status === 'completed').length;
    const failed = plan.steps.filter((s) => s.status === 'failed').length;
    const successRate = total > 0 ? completed / total : 0;
    const isComplete = completed === total;
    const canProceed = failed === 0;

    let summary = '';
    if (isComplete) {
      summary = `✅ 全${total}ステップの多段推論および自己検証が正常に完了しました。`;
    } else if (canProceed) {
      summary = `🔄 計画進行中: ${completed}/${total} ステップ完了`;
    } else {
      summary = `⚠️ ${failed}件のステップで課題が検知されました。整合性の再確認を推奨します。`;
    }

    return {
      isComplete,
      canProceed,
      successRate,
      completedCount: completed,
      failedCount: failed,
      summary,
    };
  }

  /**
   * ステップ実行用のプロンプトを構築
   * 前ステップの生のresult全文ではなくclaimLedgerの要約を渡し、
   * トークン消費の爆発を防ぎ線形増加に抑える
   */
  public buildStepPrompt(
    plan: TaskPlan,
    step: TaskStep,
    previousStepOutputs?: { stepNumber: number; title: string; output: string }[]
  ): string {
    let prompt = `【多段推論タスク計画】
目標: ${plan.goal}
現在ステップ (${step.stepNumber}/${plan.totalSteps}): ${step.title}
目的・詳細: ${step.description}
実行種別: ${step.actionType || 'analysis'}
`;

    if (plan.constraints && plan.constraints.length > 0) {
      prompt += `\n【制約条件】:\n` + plan.constraints.map((c) => `・${c}`).join('\n') + '\n';
    }
    if (plan.acceptanceConditions && plan.acceptanceConditions.length > 0) {
      prompt += `\n【受け入れ条件】:\n` + plan.acceptanceConditions.map((a) => `・${a}`).join('\n') + '\n';
    }

    // 生の過去出力を全て積むのではなく、論理台帳（claimLedger）の要約を渡す
    prompt += `\n【これまでの論理台帳 (Claim Ledger)】:\n`;
    prompt += this.formatClaimLedger(plan.claimLedger);

    // 直前ステップのみ、補助としてタイトルと直近要点（3行以内）を添える
    if (previousStepOutputs && previousStepOutputs.length > 0) {
      const lastOutput = previousStepOutputs[previousStepOutputs.length - 1];
      const snippet = lastOutput.output.slice(0, 160).replace(/[\r\n]+/g, ' ').trim();
      prompt += `\n\n【直前ステップ概要】: [Step ${lastOutput.stepNumber}: ${lastOutput.title}] -> ${snippet}`;
    }

    prompt += `\n\n【このステップの指示】:
上記目標と論理台帳の確定事項を踏まえ、「${step.title}」を精密に実行してください。
不要な前置きを省き、要点を構造化して明確に記述してください。`;

    return prompt;
  }

  /**
   * チェックポイントの永続化保存
   */
  public saveCheckpoint(plan: TaskPlan): void {
    try {
      storageService.setItem(`miki_task_plan_${plan.id}`, JSON.stringify(plan));
      storageService.setItem(ACTIVE_PLAN_KEY, plan.id);

      // 履歴一覧の更新
      const rawHistory = storageService.getItem(PLAN_HISTORY_KEY);
      const history: string[] = rawHistory ? JSON.parse(rawHistory) : [];
      if (!history.includes(plan.id)) {
        history.unshift(plan.id);
        storageService.setItem(PLAN_HISTORY_KEY, JSON.stringify(history.slice(0, 20)));
      }
    } catch (e) {
      console.warn('taskPlanService: saveCheckpoint failed', e);
    }
  }

  /**
   * チェックポイントの読み込み
   */
  public loadCheckpoint(planId: string): TaskPlan | null {
    try {
      const raw = storageService.getItem(`miki_task_plan_${planId}`);
      if (!raw) return null;
      return JSON.parse(raw) as TaskPlan;
    } catch (e) {
      console.warn('taskPlanService: loadCheckpoint failed', e);
      return null;
    }
  }

  /**
   * 中断されたチェックポイントからタスク計画を復元して再開
   * - storageServiceから該当planIdのチェックポイントとプラン本体を読み出す
   * - currentStepIndexとclaimLedgerを復元し、そこからadvanceStepを再開できる状態で返す
   * - 該当プランが見つからない、またはstatusが'completed'/'failed'の場合はnullを返す
   */
  public resumeFromCheckpoint(planId: string): TaskPlan | null {
    const plan = this.loadCheckpoint(planId);
    if (!plan) return null;

    // 該当プランが見つからない、またはstatusが'completed'/'failed'の場合はnullを返す
    if (plan.status === 'completed' || plan.status === 'failed') {
      return null;
    }

    // claimLedgerの復元・整合性保証
    if (!plan.claimLedger) {
      plan.claimLedger = {
        confirmed: [],
        hypotheses: [],
        unconfirmed: [],
      };
    }

    // 未完了の最初のステップ（in_progress または pending）を再開対象に決定
    const resumeIndex = plan.steps.findIndex(
      (s) => s.status === 'in_progress' || s.status === 'pending'
    );
    if (resumeIndex === -1) {
      return null;
    }

    plan.currentStepIndex = resumeIndex;
    plan.steps[resumeIndex].status = 'in_progress';
    plan.status = 'executing';
    plan.updatedAt = Date.now();

    this.saveCheckpoint(plan);

    systemLogger.step(
      resumeIndex + 1,
      plan.totalSteps,
      `タスク計画チェックポイントから再開: [${plan.steps[resumeIndex].title}] (確定事実: ${plan.claimLedger.confirmed.length}件)`,
      {
        planId: plan.id,
        currentStepIndex: resumeIndex,
        confirmedClaimsCount: plan.claimLedger.confirmed.length,
      }
    );

    return plan;
  }

  /**
   * 実行中の計画を一時中断(paused)状態にしてチェックポイント保存
   */
  public pausePlan(planId: string): TaskPlan | null {
    const plan = this.loadCheckpoint(planId);
    if (!plan) return null;
    if (plan.status === 'completed' || plan.status === 'failed') return null;

    plan.status = 'paused';
    // 実行中ステップがあればpendingに戻して保存（再開時に清潔に再開可能）
    if (plan.steps[plan.currentStepIndex]?.status === 'in_progress') {
      plan.steps[plan.currentStepIndex].status = 'pending';
    }
    plan.updatedAt = Date.now();
    this.saveCheckpoint(plan);

    systemLogger.info('STEP', `タスク計画を一時停止(paused): [${planId}]`, {
      currentStep: plan.currentStepIndex + 1,
      totalSteps: plan.totalSteps,
      claims: plan.claimLedger.confirmed.length,
    });

    return plan;
  }

  /**
   * 再開可能なプランを検出 (paused または 未完了のexecuting)
   */
  public getResumablePlan(): TaskPlan | null {
    const activeId = storageService.getItem(ACTIVE_PLAN_KEY);
    if (activeId) {
      const plan = this.loadCheckpoint(activeId);
      if (plan && (plan.status === 'paused' || plan.status === 'executing')) {
        const hasUnfinished = plan.steps.some(
          (s) => s.status === 'pending' || s.status === 'in_progress'
        );
        if (hasUnfinished) return plan;
      }
    }

    // 履歴からも探索
    const history = this.listPlans();
    const resumable = history.find(
      (p) =>
        (p.status === 'paused' || p.status === 'executing') &&
        p.steps.some((s) => s.status === 'pending' || s.status === 'in_progress')
    );
    return resumable || null;
  }

  /**
   * 現在進行中のアクティブ計画を取得
   */
  public getActivePlan(): TaskPlan | null {
    const activeId = storageService.getItem(ACTIVE_PLAN_KEY);
    if (!activeId) return null;
    return this.loadCheckpoint(activeId);
  }

  /**
   * 計画のクリア
   */
  public clearActivePlan(): void {
    storageService.removeItem(ACTIVE_PLAN_KEY);
  }

  /**
   * 過去の全計画履歴を取得
   */
  public listPlans(): TaskPlan[] {
    try {
      const rawHistory = storageService.getItem(PLAN_HISTORY_KEY);
      if (!rawHistory) return [];
      const ids: string[] = JSON.parse(rawHistory);
      const plans: TaskPlan[] = [];
      for (const id of ids) {
        const p = this.loadCheckpoint(id);
        if (p) plans.push(p);
      }
      return plans;
    } catch {
      return [];
    }
  }
}

export const taskPlanService = new TaskPlanService();
