/**
 * 設計思想 第171/172章 実装: 決定論的自己改善研究所
 *
 * 重要: ローカルLLMを生成器として使用しない。Web上のコードは証拠候補として扱い、
 * 実装候補は既存の安全なテンプレート/VERIFIED部品からのみ構成する。
 * 自動で本番コードを上書きせず、最後はCANDIDATEとして停止する。
 */
import { codeSearchService } from './codeSearchService';
import { dynamicToolFactoryService } from './dynamicToolFactoryService';
import { formalSemanticsKernelService } from './formalSemanticsKernelService';
import { mikiUltraEvolverService, MutationTestResult } from './mikiUltraEvolverService';
import { canaryDeploymentSafetyService, CanaryDeploymentState } from './canaryDeploymentSafetyService';
import { mikiUnifiedLearningContinuumService } from './mikiUnifiedLearningContinuumService';
import { systemLogger } from './systemLogger';

export type EvolutionStage =
  | 'GAP_LOCALIZED' | 'WEB_EVIDENCE' | 'TOOL_CANDIDATE' | 'FORMAL_VERIFIED'
  | 'MUTATION_VERIFIED' | 'CANARY_VERIFIED' | 'CANDIDATE_READY' | 'BLOCKED';

export interface EvolutionLabResult {
  id: string;
  topic: string;
  targetChapter: number;
  stage: EvolutionStage;
  stages: Array<{ name: string; passed: boolean; detail: string }>;
  evidenceCount: number;
  leanSlices: string[];
  toolId?: string;
  mutation?: Pick<MutationTestResult, 'mutationScore'|'totalMutants'|'killedCount'|'survivedCount'|'success'>;
  canary?: Pick<CanaryDeploymentState, 'stage'|'healthStatus'|'trafficRatio'|'errorRate'>;
  blockedReason?: string;
  promotionRequired: 'USER_OR_PROTECTED_OPERATOR';
  completedAt: string;
}

class DeterministicSelfImprovementLabService {
  async run(topic: string, targetChapter = 172): Promise<EvolutionLabResult> {
    const clean = topic.trim().slice(0, 160);
    const id = `EVO-${this.hash(`${clean}|${targetChapter}`)}-${Date.now().toString(36)}`;
    const stages: EvolutionLabResult['stages'] = [];
    const resultBase = (): EvolutionLabResult => ({
      id, topic: clean, targetChapter, stage: 'BLOCKED', stages,
      evidenceCount: 0, leanSlices: [], promotionRequired: 'USER_OR_PROTECTED_OPERATOR',
      completedAt: new Date().toISOString(),
    });

    if (!clean) {
      stages.push({ name: 'GAP_LOCALIZED', passed: false, detail: '改善対象が空です。' });
      return { ...resultBase(), blockedReason: 'EMPTY_TOPIC' };
    }
    stages.push({ name: 'GAP_LOCALIZED', passed: true, detail: `改善対象を「${clean}」に固定しました。` });

    let evidence;
    try {
      evidence = await codeSearchService.searchCode(clean, { language: 'typescript', maxResults: 4 });
      const slices = evidence.snippets.map(s => codeSearchService.sliceToLeanAst(s.code, 24));
      const r = resultBase(); r.evidenceCount = evidence.snippets.length; r.leanSlices = slices;
      stages.push({ name: 'WEB_EVIDENCE', passed: evidence.snippets.length > 0, detail: `外部コード候補 ${evidence.snippets.length} 件を取得し、Lean AST Sliceへ圧縮しました。` });
      if (!evidence.snippets.length) return { ...r, blockedReason: 'NO_EXTERNAL_EVIDENCE' };
    } catch (e: any) {
      stages.push({ name: 'WEB_EVIDENCE', passed: false, detail: `外部証拠取得失敗: ${e?.message || e}` });
      return { ...resultBase(), blockedReason: 'WEB_EVIDENCE_FAILED' };
    }

    // 外部コードをそのまま実行/採用しない。既存の安全テンプレートから補助ツール候補を作る。
    const suggestion = evidence.suggestedTools?.[0];
    if (!suggestion) return { ...resultBase(), blockedReason: 'NO_TOOL_SPEC' };
    const tool = await dynamicToolFactoryService.synthesizeTool({
      featureName: suggestion.name,
      description: suggestion.description,
      targetProblem: suggestion.targetProblem,
      inputParameters: [{ name: 'input', type: 'string', description: '検証対象', required: false }],
      // 生成系モデルを呼ばず、純粋な決定論的テンプレートを使用。
      suggestedCodePattern: '(async function executeTool(params){ return { status: \'SUCCESS\', input: params || {} }; })',
      sourceReference: evidence.snippets[0]?.sourceUrl,
    });
    if (!tool.success || !tool.sandboxTestResult.passed) {
      stages.push({ name: 'TOOL_CANDIDATE', passed: false, detail: '動的ツール候補のサンドボックス検証に失敗しました。' });
      return { ...resultBase(), evidenceCount: evidence.snippets.length, leanSlices: evidence.snippets.map(s => codeSearchService.sliceToLeanAst(s.code, 24)), blockedReason: 'TOOL_SANDBOX_FAILED' };
    }
    stages.push({ name: 'TOOL_CANDIDATE', passed: true, detail: `安全テンプレートからツール ${tool.tool.id} を候補化しました。` });

    const semantics = formalSemanticsKernelService.evaluate([
      { op: 'REQUIRE', subject: 'tool sandbox test must pass' },
      { op: 'ALLOW', subject: 'READ_ONLY_DYNAMIC_TOOL' },
      { op: 'DENY', subject: 'LOCAL_LLM_RUNTIME_REACTIVATION' },
      { op: 'DENY', subject: 'DIRECT_PRODUCTION_OVERWRITE' },
      { op: 'ASSERT', subject: 'promotion requires protected operator' },
    ]);
    if (!semantics.passed) return { ...resultBase(), blockedReason: 'FORMAL_SEMANTICS_FAILED' };
    stages.push({ name: 'FORMAL_VERIFIED', passed: true, detail: `形式意味検証 ${semantics.proofHash} を取得しました。` });

    const mutation = await mikiUltraEvolverService.runMutationTest(tool.generatedCode, tool.tool.name);
    if (!mutation.success || mutation.totalMutants === 0 || mutation.mutationScore < 0.8) {
      stages.push({ name: 'MUTATION_VERIFIED', passed: false, detail: `変異テスト不合格: score=${mutation.mutationScore}` });
      return { ...resultBase(), evidenceCount: evidence.snippets.length, leanSlices: evidence.snippets.map(s => codeSearchService.sliceToLeanAst(s.code, 24)), toolId: tool.tool.id, mutation, blockedReason: 'MUTATION_THRESHOLD_NOT_MET' };
    }
    stages.push({ name: 'MUTATION_VERIFIED', passed: true, detail: `変異体 ${mutation.killedCount}/${mutation.totalMutants} を撃破しました。` });

    // カナリアは検証のみ。自動FULL_RELEASEはしない。
    const canary = await canaryDeploymentSafetyService.startCanaryRelease(id, targetChapter, tool.generatedCode);
    const canaryPassed = canary.healthStatus === 'HEALTHY' && canary.errorRate <= 0.05;
    stages.push({ name: 'CANARY_VERIFIED', passed: canaryPassed, detail: `canary=${canary.stage}, health=${canary.healthStatus}, error=${canary.errorRate}` });
    if (!canaryPassed) {
      canaryDeploymentSafetyService.triggerImmediateRollback(id, '第172章の安全条件を満たさないため候補を破棄');
      return { ...resultBase(), evidenceCount: evidence.snippets.length, leanSlices: evidence.snippets.map(s => codeSearchService.sliceToLeanAst(s.code, 24)), toolId: tool.tool.id, mutation, canary, blockedReason: 'CANARY_FAILED' };
    }

    mikiUnifiedLearningContinuumService.observe({
      domain: 'system', action: 'deterministic_self_improvement_candidate', input: clean,
      outcome: 'SUCCESS', verified: true, capabilityIds: ['general.self-improvement-lab'],
      lesson: `${id}: Web evidence→safe tool→formal semantics→mutation→canary verified. Full release requires protected operator.`,
    });
    systemLogger.info('SELF_IMPROVEMENT', `[第172章] ${id} をCANDIDATE_READYとして保存。自動本番反映は行いません。`);

    return {
      id, topic: clean, targetChapter, stage: 'CANDIDATE_READY', stages,
      evidenceCount: evidence.snippets.length,
      leanSlices: evidence.snippets.map(s => codeSearchService.sliceToLeanAst(s.code, 24)),
      toolId: tool.tool.id,
      mutation,
      canary,
      promotionRequired: 'USER_OR_PROTECTED_OPERATOR',
      completedAt: new Date().toISOString(),
    };
  }

  private hash(s: string): string {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return (h >>> 0).toString(16).padStart(8, '0');
  }
}

export const deterministicSelfImprovementLabService = new DeterministicSelfImprovementLabService();
