import { componentRegistryService } from './componentRegistryService';
import { componentImprovementCandidateService, ComponentImprovementCandidate } from './componentImprovementCandidateService';
import { cloudAiRestrictedGatewayService } from './cloudAiRestrictedGatewayService';
import { storageService } from './storageService';
import { systemLogger } from './systemLogger';
import { improvementStaticGuardService } from './improvementStaticGuardService';
import { safeImprovementPipelineService } from './safeImprovementPipelineService';
import { ExecutionEnvironment } from './executionRunnerService';
import { improvementRegressionCoordinatorService } from './improvementRegressionCoordinatorService';

export type ProposalStatus = 'REQUESTED' | 'RECEIVED' | 'CANDIDATE_CREATED' | 'REJECTED';

export interface ImprovementProposalRecord {
  proposal_id: string;
  component_id: string;
  trigger_reason: string;
  required_capability: string;
  escalation_id: string;
  status: ProposalStatus;
  candidate_id?: string;
  created_at: number;
  updated_at: number;
}

/**
 * 改善案の生成境界。
 * Cloud AIには「改善案」を要求できるが、ここではコードを実行しない。
 * 受信したコードもそのまま採用せず、Component候補として隔離する。
 */
export class ImprovementProposalService {
  private static instance: ImprovementProposalService;
  private readonly storageKey = 'miki_improvement_proposals_v1';
  private records = new Map<string, ImprovementProposalRecord>();
  private constructor() { this.load(); }
  public static getInstance() { return this.instance || (this.instance = new ImprovementProposalService()); }

  public requestCloudProposal(componentId: string, reason: string, failureSignature?: string): ImprovementProposalRecord | undefined {
    const component = componentRegistryService.getComponent(componentId);
    if (!component) return undefined;
    if (!component.implementation_txt?.trim()) return undefined;

    const escalation = cloudAiRestrictedGatewayService.createEscalationRequest({
      triggerReason: 'REPEATED_LOCAL_FAILURE',
      abstractGoal: component.purpose || componentId,
      requiredCapability: componentId,
      rawContextToSanitize: `component=${componentId}\nreason=${reason}\ninputs=${component.inputs.join(',')}\noutputs=${component.outputs.join(',')}`,
      failureSignature,
    });
    const now = Date.now();
    const record: ImprovementProposalRecord = {
      proposal_id: `IPP-${this.hash(`${componentId}|${escalation.escalationId}|${now}`)}`,
      component_id: componentId,
      trigger_reason: reason,
      required_capability: componentId,
      escalation_id: escalation.escalationId,
      status: 'REQUESTED',
      created_at: now,
      updated_at: now,
    };
    this.records.set(record.proposal_id, record);
    this.save();
    systemLogger.info('SELF_IMPROVEMENT', `☁️ [Proposal] ${record.proposal_id} cloud proposal requested`);
    return record;
  }

  /** 既にGatewayで作成済みのEscalationをProposal追跡台帳へ紐付ける。再送は行わない。 */
  public registerEscalation(escalationId: string, componentId: string, reason: string, requiredCapability?: string): ImprovementProposalRecord | undefined {
    const existing = this.list().find(r => r.escalation_id === escalationId);
    if (existing) return existing;
    const component = componentRegistryService.getComponent(componentId);
    if (!component) return undefined;
    const now = Date.now();
    const record: ImprovementProposalRecord = {
      proposal_id: `IPP-${this.hash(`${componentId}|${escalationId}|${now}`)}`,
      component_id: componentId,
      trigger_reason: reason,
      required_capability: requiredCapability || componentId,
      escalation_id: escalationId,
      status: 'REQUESTED',
      created_at: now,
      updated_at: now,
    };
    this.records.set(record.proposal_id, record);
    this.save();
    systemLogger.info('SELF_IMPROVEMENT', `🔗 [Proposal] ${record.proposal_id} linked to existing escalation ${escalationId}`);
    return record;
  }

  /** Cloud提案受信後、candidateへ隔離する。ここでは検証・採用しない。 */
  public receiveCloudProposal(proposalId: string, proposal: { candidateCode: string; proposedSpec: string; testCases: string[] }): ComponentImprovementCandidate | undefined {
    const record = this.records.get(proposalId);
    if (!record) return undefined;
    if (!proposal.candidateCode?.trim() || proposal.testCases.length === 0 || proposal.proposedSpec.trim().length < 10) {
      record.status = 'REJECTED'; record.updated_at = Date.now(); this.save();
      return undefined;
    }
    const base = componentRegistryService.getComponent(record.component_id);
    if (!base) {
      record.status = 'REJECTED'; record.updated_at = Date.now(); this.save();
      return undefined;
    }
    const guard = improvementStaticGuardService.inspect(base, proposal.candidateCode);
    if (!guard.passed) {
      record.status = 'REJECTED';
      record.updated_at = Date.now();
      record.trigger_reason += `\nSTATIC_GUARD_REJECT: ${guard.issues.filter(i => i.severity === 'ERROR').map(i => i.code).join(',')}`;
      this.save();
      systemLogger.warn('SELF_IMPROVEMENT', `🛑 [Proposal] ${proposalId} static guard rejected candidate`);
      return undefined;
    }
    const candidate = componentImprovementCandidateService.create(record.component_id, proposal.candidateCode, record.trigger_reason);
    record.status = 'CANDIDATE_CREATED';
    record.candidate_id = candidate.candidate_id;
    record.updated_at = Date.now();
    this.save();
    return candidate;
  }


  /**
   * Cloud受信→Candidate→Regression計画までを一つの受入境界として接続する。
   * 実行・DEVICE_TESTED・VERIFIED化は行わず、Runner待ちで停止する。
   */
  public receiveAndQueueCandidateByEscalationId(
    escalationId: string,
    proposal: { candidateCode: string; proposedSpec: string; testCases: string[] },
    environment: ExecutionEnvironment = 'ANDROID',
  ): { accepted: boolean; candidate?: ComponentImprovementCandidate; runId?: string; suiteId?: string; reason: string } {
    const record = this.list().find(r => r.escalation_id === escalationId);
    if (!record) return { accepted: false, reason: `エスカレーション ${escalationId} に対応する改善Proposal記録がありません。` };
    return this.receiveAndQueueCandidate(record.proposal_id, proposal, environment);
  }

  public receiveAndQueueCandidate(
    proposalId: string,
    proposal: { candidateCode: string; proposedSpec: string; testCases: string[] },
    environment: ExecutionEnvironment = 'ANDROID',
  ): { accepted: boolean; candidate?: ComponentImprovementCandidate; runId?: string; suiteId?: string; reason: string } {
    const candidate = this.receiveCloudProposal(proposalId, proposal);
    if (!candidate) return { accepted: false, reason: 'Cloud提案をCandidate化できませんでした。' };
    const run = safeImprovementPipelineService.proposeCandidate(candidate.candidate_id, environment);
    if (!run) {
      componentImprovementCandidateService.markRejected(candidate.candidate_id, 'Safe Improvement Run作成に失敗');
      return { accepted: false, candidate, reason: 'Safe Improvement Runを作成できませんでした。' };
    }
    const planned = safeImprovementPipelineService.planRegression(run.run_id);
    if (!planned.suite) {
      componentImprovementCandidateService.markRejected(candidate.candidate_id, planned.reason);
      return { accepted: false, candidate, runId: run.run_id, reason: planned.reason };
    }
    improvementRegressionCoordinatorService.register(planned.run || run);
    return {
      accepted: true,
      candidate,
      runId: run.run_id,
      suiteId: planned.suite.suite_id,
      reason: 'Candidate化とRegression計画まで完了。実行結果待ちです。',
    };
  }
  public list(): ImprovementProposalRecord[] { return Array.from(this.records.values()).sort((a,b)=>b.created_at-a.created_at); }
  public get(id: string) { return this.records.get(id); }
  private load() { try { const raw=storageService.getItem(this.storageKey); if(raw) for(const r of JSON.parse(raw) as ImprovementProposalRecord[]) this.records.set(r.proposal_id,r); } catch {} }
  private save() { try { storageService.setItem(this.storageKey, JSON.stringify(this.list().slice(0,200))); } catch {} }
  private hash(raw:string){let h=2166136261;for(let i=0;i<raw.length;i++){h^=raw.charCodeAt(i);h=Math.imul(h,16777619);}return(h>>>0).toString(16).padStart(8,'0');}
}
export const improvementProposalService = ImprovementProposalService.getInstance();
