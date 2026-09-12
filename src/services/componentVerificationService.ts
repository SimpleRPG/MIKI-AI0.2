import { componentRegistryService } from './componentRegistryService';
import { evidenceService } from './evidenceService';
import { systemLogger } from './systemLogger';
import { componentArtifactStoreService } from './componentArtifactStoreService';
import { ComponentStatus, ComponentTestCategory } from '../types';
import { componentTestCaseService } from './componentTestCaseService';

export interface ComponentVerificationResult {
  componentId: string;
  accepted: boolean;
  previousStatus?: ComponentStatus;
  nextStatus?: ComponentStatus;
  evidenceId?: string;
  reason: string;
}

/** 実行結果をComponent Registryの状態遷移へ接続する境界。 */
export class ComponentVerificationService {
  public verifyExecution(input: {
    componentId: string;
    implementationHash: string;
    environment: string;
    testCategory: ComponentTestCategory;
    passed: boolean;
    outputSummary: string;
    errorMessage?: string;
    durationMs?: number;
    runnerId: string;
    artifactSnapshotKey: string;
    testCaseId: string;
    expectedSummary?: string;
    assertionStatus?: 'PASS' | 'FAIL' | 'INCONCLUSIVE';
    assertionRule?: string;
    assertionReason?: string;
  }): ComponentVerificationResult {
    const component = componentRegistryService.getComponent(input.componentId);
    if (!component) return { componentId: input.componentId, accepted: false, reason: 'Componentが存在しません。' };
    const testCase = componentTestCaseService.getForComponent(input.testCaseId, input.componentId, input.implementationHash);
    if (!testCase) return { componentId: input.componentId, accepted: false, previousStatus: component.status, reason: 'Test Case IDがComponent/implementation hashに紐付いていません。' };
    if (testCase.category !== input.testCategory) return { componentId: input.componentId, accepted: false, previousStatus: component.status, reason: 'Test Caseのカテゴリと実行結果が一致しません。' };
    if (!input.implementationHash || input.implementationHash !== component.implementation_hash) {
      return { componentId: input.componentId, accepted: false, previousStatus: component.status, reason: '実装ハッシュ不一致。' };
    }

    const artifact = componentArtifactStoreService.getBySnapshotKey(input.artifactSnapshotKey);
    if (!artifact || artifact.component_id !== component.component_id || artifact.implementation_hash !== input.implementationHash) {
      return { componentId: input.componentId, accepted: false, previousStatus: component.status, reason: 'Artifact snapshot不一致。実行結果を検証証拠として受理しません。' };
    }

    const evidence = evidenceService.recordExecutionEvidence({
      title: `Component execution: ${input.componentId}`,
      snippet: `${input.environment}/${input.testCategory}: ${input.passed ? 'PASS' : 'FAIL'}; ${input.outputSummary}${input.errorMessage ? `; error=${input.errorMessage}` : ''}${typeof input.durationMs === 'number' ? `; duration=${input.durationMs}ms` : ''}`,
      source: 'component_execution_runner',
      sourceId: input.runnerId,
      independenceClusterId: `cluster_execution_${input.runnerId}`,
      metadata: { test_case_id: input.testCaseId, test_case_source: testCase.source, expected_summary: input.expectedSummary || testCase.expected_summary, assertion_status: input.assertionStatus, assertion_rule: input.assertionRule, assertion_reason: input.assertionReason, actual_output_summary: input.outputSummary, component_id: component.component_id, implementation_hash: input.implementationHash, test_category: input.testCategory, passed: input.passed, environment: input.environment, runner: input.runnerId, observed_at: Date.now(), result_summary: input.outputSummary, artifact_snapshot_key: input.artifactSnapshotKey },
    });

    // 通常実行の失敗やAssertion FAILは、Component自体の恒久的なREJECT理由にはしない。
    // Failure Memory / Regression Coordinatorが失敗を学習・評価し、Promotionだけを止める。
    if (!input.passed || input.assertionStatus === 'FAIL') {
      const previousStatus = component.status;
      return {
        componentId: input.componentId,
        accepted: true,
        previousStatus,
        nextStatus: previousStatus,
        evidenceId: evidence.evidence_id,
        reason: !input.passed
          ? '実行失敗をEvidenceとして記録しました。Component状態は変更せず、Failure Memory/Recovery/Regressionへ委譲します。'
          : 'Assertion FAILをEvidenceとして記録しました。Component状態は変更せず、Promotion/Regressionを停止します。',
      };
    }

    if (input.assertionStatus !== 'PASS') {
      const previousStatus = component.status;
      return {
        componentId: input.componentId,
        accepted: true,
        previousStatus,
        nextStatus: previousStatus,
        evidenceId: evidence.evidence_id,
        reason: 'AssertionがPASSではないため、Component状態を変更しません。',
      };
    }

    if (component.status === 'REJECTED' || component.status === 'DEPRECATED' || component.status === 'SUPERSEDED') {
      return { componentId: input.componentId, accepted: true, previousStatus: component.status, evidenceId: evidence.evidence_id, reason: `現在状態=${component.status}のため自動復帰しません。` };
    }

    // 実行証拠はこの時点で初めてADMISSIBLEにする。
    evidenceService.attachEvidenceToClaim(evidence.evidence_id, this.ensureExecutionClaim(evidence.evidence_id, component.component_id, input));

    const previousStatus = component.status;
    const nextStatus: ComponentStatus = previousStatus === 'ANALYZED' || previousStatus === 'CLOUD_TESTED' || previousStatus === 'CANDIDATE'
      ? 'DEVICE_TESTED'
      : previousStatus === 'DEVICE_TESTED'
        ? 'DEVICE_TESTED'
        : previousStatus;

    if (nextStatus !== previousStatus) {
      component.status = nextStatus;
      component.updated_at = Date.now();
      componentRegistryService.registerComponent(component);
    }

    systemLogger.info('TOOLS', `🧩 [ComponentVerifier] ${component.component_id}: ${previousStatus} -> ${nextStatus}`);
    return { componentId: component.component_id, accepted: true, previousStatus, nextStatus, evidenceId: evidence.evidence_id, reason: '実行成功。DEVICE_TESTEDへ到達。VERIFIEDへの昇格はRegression Gateを通過したPromotion Pipelineだけが行います。' };
  }

  private ensureExecutionClaim(evidenceId: string, componentId: string, input: { environment: string; testCategory: ComponentTestCategory; passed: boolean }): string {
    const statement = `Component ${componentId} implementation passed ${input.testCategory} execution in ${input.environment}.`;
    const evidence = evidenceService.getEvidence(evidenceId);
    if (!evidence || evidence.kind !== 'EXECUTION' || evidence.status === 'REJECTED') return '';
    if (evidence.claim_ids[0]) return evidence.claim_ids[0];
    const claimId = evidenceService.registerExecutionClaim(evidence.evidence_id, statement);
    if (!claimId) throw new Error('execution claim creation failed');
    return claimId;
  }
}

export const componentVerificationService = new ComponentVerificationService();
