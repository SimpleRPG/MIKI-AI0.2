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
   * 現在のステップを進行し、結果を記録して次のステップを準備
   */
  public advanceStep(
    plan: TaskPlan,
    stepResult: {
      success: boolean;
      resultText: string;
      error?: string;
      durationMs?: number;
      confidenceScore?: number;
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
      `タスクステップ進捗: [${currentStep.title}] -> ${currentStep.status}`,
      {
        planId: updatedPlan.id,
        durationMs: currentStep.durationMs,
        isDone: !nextStep,
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
   */
  public buildStepPrompt(
    plan: TaskPlan,
    step: TaskStep,
    previousStepOutputs: { stepNumber: number; title: string; output: string }[]
  ): string {
    let prompt = `【多段推論タスク計画】
目標: ${plan.goal}
現在ステップ (${step.stepNumber}/${plan.totalSteps}): ${step.title}
目的・詳細: ${step.description}
実行種別: ${step.actionType || 'analysis'}
`;

    if (previousStepOutputs.length > 0) {
      prompt += `\n【これまでのステップ成果】:\n`;
      previousStepOutputs.forEach((prev) => {
        prompt += `--- [Step ${prev.stepNumber}: ${prev.title}] ---\n${prev.output.trim()}\n\n`;
      });
    }

    prompt += `\n【このステップの指示】:
上記目標と過去成果を踏まえ、「${step.title}」を精密に実行してください。
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
