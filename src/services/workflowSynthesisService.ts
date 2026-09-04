import {
  SynthesizedWorkflow,
  SynthesizedWorkflowStep,
  CapabilityPlugin,
} from '../types';
import { capabilityPluginService } from './capabilityPluginService';
import { toolsService } from './toolsService';
import { systemLogger } from './systemLogger';

const WORKFLOW_STORAGE_KEY = 'miki_synthesized_workflows';

/**
 * 設計思想 47章 & 35章 第5段階:
 * 自然言語からワークフローを作る機構 (Natural Language Workflow Synthesis Engine)
 *
 * 【第5段階 実装要件】:
 * 1. 自然言語の複合指示を、46章「能力プラグイン」および tools の実行可能DAG/パイプラインに分解。
 * 2. 各ステップに入力引数マッピング、成果物スキーマ、必要権限・同意要否、実行予算を割当。
 * 3. 実行前の明示的な同意・安全性ゲート（プラグインが追加されても正式権限を自動増加させない原則）を遵守。
 * 4. 実行予算（所要時間・トークン数・リスクレベル）の事前見積もり。
 */
export class WorkflowSynthesisService {
  /**
   * ユーザー指示が単発会話か、多段ワークフロー合成を要するか判定
   */
  public shouldSynthesizeWorkflow(prompt: string): boolean {
    const p = (prompt || '').trim();
    if (p.length < 30) return false;

    // ワークフロー要求キーワード
    const workflowSignals = [
      /(?:調査|検索).*して.*(?:コード|作成|生成).*して.*(?:検証|保存)/i,
      /(?:ステップ|工程|段階).*で(?:進めて|実行して|作って)/i,
      /(?:まず|初めに).*(?:次に|その[後あ]と).*(?:最後に|仕上げに)/i,
      /ワークフロー/,
      /パイプライン/,
      /自動化.*手順/,
      /(?:ファイル|データ).*を(?:読み込んで|解析して).*変換.*して.*出力/,
      /web.*調べ.*vba.*作成/i,
    ];

    return workflowSignals.some((regex) => regex.test(p));
  }

  /**
   * 自然言語の指示から、46章プラグインとツールを組み合わせた実行可能ワークフローを合成する
   */
  public synthesizeWorkflow(goal: string): SynthesizedWorkflow {
    const allPlugins: CapabilityPlugin[] = capabilityPluginService.getAllPlugins();
    const gLower = goal.toLowerCase();

    const steps: SynthesizedWorkflowStep[] = [];
    let stepCounter = 1;

    // 1. Web調査・外部情報取得が必要か？
    if (gLower.includes('調べ') || gLower.includes('検索') || gLower.includes('web') || gLower.includes('ドキュメント') || gLower.includes('仕様')) {
      const webPlugin = allPlugins.find((p: CapabilityPlugin) => p.plugin_id === 'plugin_web_search') || {
        plugin_id: 'plugin_web_search',
        allowedTools: ['tool_gemini_cloud_search'],
        requiredPermissions: ['network_cloud'],
        status: 'ACTIVE' as const,
      };

      steps.push({
        stepId: `wf_step_${Date.now()}_${stepCounter}`,
        stepNumber: stepCounter++,
        name: '外部仕様・Web情報調査',
        intent: '最新の仕様・公式ドキュメントおよび参考事例をWeb検索で収集する',
        pluginId: webPlugin.plugin_id,
        assignedTool: webPlugin.allowedTools[0] || 'tool_gemini_cloud_search',
        inputMapping: { query: goal, research_focus: '正確なAPI構文とベストプラクティス' },
        expectedOutputSchema: 'Markdown形式の調査要約レポート（引用URL付き）',
        requiresConsent: webPlugin.status !== 'ACTIVE',
        requiredPermissions: webPlugin.requiredPermissions || ['network_cloud'],
        timeoutMs: 15000,
        status: 'ready',
      });
    }

    // 2. ワークスペースのファイル確認・コンテキスト解析
    if (gLower.includes('ファイル') || gLower.includes('プロジェクト') || gLower.includes('既存') || gLower.includes('修正')) {
      const codePlugin = allPlugins.find((p: CapabilityPlugin) => p.plugin_id === 'plugin_code_workspace') || {
        plugin_id: 'plugin_code_workspace',
        allowedTools: ['tool_workspace_search'],
        requiredPermissions: ['workspace_read'],
        status: 'ACTIVE' as const,
      };

      steps.push({
        stepId: `wf_step_${Date.now()}_${stepCounter}`,
        stepNumber: stepCounter++,
        name: 'ワークスペースファイル解析',
        intent: '関連する既存ソースコード・マクロファイルを精査し、依存関係を特定する',
        pluginId: codePlugin.plugin_id,
        assignedTool: codePlugin.allowedTools[0] || 'tool_workspace_search',
        inputMapping: { scope: 'workspace_files', targetKeywords: ['Sub', 'Function', 'canvas', 'html'] },
        expectedOutputSchema: '対象ファイル差分および整合性マップ',
        requiresConsent: codePlugin.status !== 'ACTIVE',
        requiredPermissions: codePlugin.requiredPermissions || ['workspace_read'],
        timeoutMs: 10000,
        status: 'pending',
      });
    }

    // 3. コード・成果物生成
    const isVba = gLower.includes('vba') || gLower.includes('excel') || gLower.includes('マクロ');
    const isCanvas = gLower.includes('canvas') || gLower.includes('ゲーム') || gLower.includes('html');
    
    const genPlugin = allPlugins.find((p: CapabilityPlugin) => p.plugin_id === 'plugin_safe_computation') || {
      plugin_id: 'plugin_safe_computation',
      allowedTools: ['tool_safe_math'],
      requiredPermissions: [],
      status: 'ACTIVE' as const,
    };

    steps.push({
      stepId: `wf_step_${Date.now()}_${stepCounter}`,
      stepNumber: stepCounter++,
      name: isVba ? '安全なVBAコード生成' : isCanvas ? '自己完結Canvasゲーム生成' : 'ターゲット成果物生成',
      intent: isVba
        ? 'Office 64bit互換・安全ガードを備えたExcel VBAマクロを生成'
        : 'HTML5/Canvas対応の単一自己完結型コードブロックを出力',
      pluginId: genPlugin.plugin_id,
      assignedTool: genPlugin.allowedTools[0] || 'tool_safe_math',
      inputMapping: { goal, language: isVba ? 'vba' : isCanvas ? 'html_canvas' : 'text' },
      expectedOutputSchema: isVba ? '```vba ... ```' : isCanvas ? '```html ... ```' : '構造化テキスト',
      requiresConsent: false,
      requiredPermissions: [],
      timeoutMs: 20000,
      status: 'pending',
    });

    // 4. 静的構文検査 & 安全検証ゲート (10章)
    steps.push({
      stepId: `wf_step_${Date.now()}_${stepCounter}`,
      stepNumber: stepCounter++,
      name: '静的構文検査 & 安全準備ゲート検証',
      intent: '生成された成果物の閉じタグ・ブロック整合性・破壊的コマンド(Kill/Shell)を静的検査',
      pluginId: 'plugin_code_verification',
      assignedTool: 'tool_code_verifier',
      inputMapping: { checkSafety: true, checkSyntax: true },
      expectedOutputSchema: 'ComprehensiveCodeVerification レポート',
      requiresConsent: false,
      requiredPermissions: [],
      timeoutMs: 5000,
      status: 'pending',
    });

    // 5. 反証・完成条件チェック (15・16章 & 48章)
    steps.push({
      stepId: `wf_step_${Date.now()}_${stepCounter}`,
      stepNumber: stepCounter++,
      name: '内的自己反証 & 成果物確定',
      intent: 'エッジケース・無効化前提・ペルソナ維持の自己反証を行い、7項目の完成条件を判定',
      pluginId: 'plugin_completion_judge',
      assignedTool: 'tool_completion_evaluator',
      inputMapping: { userGoal: goal },
      expectedOutputSchema: 'CompletionEvaluation (7項目チェックリスト合格判定)',
      requiresConsent: false,
      requiredPermissions: [],
      timeoutMs: 5000,
      status: 'pending',
    });

    // 予算の見積もり
    const totalDuration = steps.reduce((acc, s) => acc + s.timeoutMs, 0);
    const estimatedTokens = steps.length * 800;
    const hasNetwork = steps.some((s) => s.requiredPermissions.includes('network_cloud'));

    const workflow: SynthesizedWorkflow = {
      workflowId: `wf_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      userGoal: goal,
      steps,
      budgetEstimate: {
        estimatedDurationMs: totalDuration,
        estimatedTokens,
        estimatedCostUnits: hasNetwork ? 1 : 0,
        riskLevel: hasNetwork ? 'medium' : 'low',
      },
      synthesisRationale: `依頼の目的「${goal.slice(0, 40)}...」を46章プラグインに基づき${steps.length}段階の自律ワークフローへ分解しました。`,
      createdAt: Date.now(),
      status: 'ready' as any,
    };

    this.saveWorkflow(workflow);
    systemLogger.info(
      'SELF_IMPROVEMENT',
      `⚡ [47章 ワークフロー合成] 「${goal.slice(0, 30)}...」から${steps.length}段階のワークフローを自動合成しました (ID: ${workflow.workflowId})`
    );

    return workflow;
  }

  /**
   * ワークフロー一覧の取得
   */
  public getWorkflows(): SynthesizedWorkflow[] {
    try {
      const raw = localStorage.getItem(WORKFLOW_STORAGE_KEY);
      if (!raw) return [];
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }

  /**
   * ワークフローの保存
   */
  public saveWorkflow(workflow: SynthesizedWorkflow): void {
    const list = this.getWorkflows().filter((w) => w.workflowId !== workflow.workflowId);
    list.unshift(workflow);
    localStorage.setItem(WORKFLOW_STORAGE_KEY, JSON.stringify(list.slice(0, 30)));
  }

  /**
   * ワークフローのステップ進行
   */
  public updateStepStatus(
    workflowId: string,
    stepId: string,
    status: SynthesizedWorkflowStep['status'],
    resultExcerpt?: string
  ): SynthesizedWorkflow | null {
    const list = this.getWorkflows();
    const wf = list.find((w) => w.workflowId === workflowId);
    if (!wf) return null;

    const step = wf.steps.find((s) => s.stepId === stepId);
    if (step) {
      step.status = status;
      if (resultExcerpt) step.resultExcerpt = resultExcerpt;
    }

    const allDone = wf.steps.every((s) => s.status === 'completed');
    const anyFailed = wf.steps.some((s) => s.status === 'failed');
    if (allDone) wf.status = 'completed';
    else if (anyFailed) wf.status = 'failed';
    else wf.status = 'executing';

    this.saveWorkflow(wf);
    return wf;
  }
}

export const workflowSynthesisService = new WorkflowSynthesisService();
