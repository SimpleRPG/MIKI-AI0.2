import { strict as assert } from 'node:assert';
import { canonicalSha256Object } from '../src/miki/core/services/canonicalSha256Service';
import { claimDatabaseService } from '../src/miki/memory/services/claimDatabaseService';
import { evidenceService } from '../src/miki/memory/services/evidenceService';
import { storageService } from '../src/services/storageService';
import {
  reusableComponentFactoryService,
  type KnowledgeComponentArtifact,
} from '../src/miki/core/services/reusableComponentFactoryService';
import { extractWebSemanticUnits } from '../src/miki/research/services/webContentUnderstandingService';
import { webSemanticRuleLearningService } from '../src/miki/research/services/webSemanticRuleLearningService';

const stamp = Date.now().toString(36);
const targetCue = 'は磁場を折り返す';
const unknownProbe = '紫の観測装置Dは磁場を折り返す。';
assert.equal(
  extractWebSemanticUnits(unknownProbe, 4, `https://probe-${stamp}.research-site.org/a`).length,
  0,
  'the base parser should not classify the novel predicate before learning',
);

function createVerifiedCandidate(index: number, statement: string): { component: KnowledgeComponentArtifact; claimId: string } {
  const sourceKey = `https://article-${stamp}-${index}.research-site.org/page`;
  const unit = extractWebSemanticUnits(statement, 1, sourceKey)[0];
  assert.ok(unit, `source statement ${index} must produce a base semantic candidate`);
  assert.ok(['OBSERVATION', 'RELATION'].includes(unit.kind), `source statement ${index} must use a learnable base class`);
  const claim = claimDatabaseService.registerClaim({
    statement,
    world: 'REAL',
    kind: 'FACT_CLAIM',
    source: 'web_search',
    origin_source_id: `web-semantic-rule-test-${stamp}-${index}`,
    independence_cluster_id: `web-semantic-rule-test-claim-${stamp}-${index}`,
    self_provenance: 'NONE',
  });
  const evidenceIds: string[] = [];
  const sourceUrls: string[] = [];
  for (let sourceIndex = 0; sourceIndex < 2; sourceIndex += 1) {
    const url = `https://paper-${stamp}-${index}-${sourceIndex}.technical-research.org/article/${index}/${sourceIndex}`;
    const evidence = evidenceService.recordWebEvidence({
      title: `Independent technical paper ${stamp} ${index}-${sourceIndex}`,
      snippet: `The report states: ${statement} This description appears in an independently collected technical publication.`,
      source: 'technical_publication',
      url,
      sourceId: `web-semantic-rule-test-source-${stamp}-${index}-${sourceIndex}`,
      independenceClusterId: `web-semantic-rule-test-cluster-${stamp}-${index}-${sourceIndex}`,
      metadata: { research_source_role: 'SECONDARY' },
    });
    assert.notEqual(evidence.status, 'REJECTED', 'non-synthetic web evidence must not be rejected');
    assert.ok(evidenceService.attachEvidenceToClaim(evidence.evidence_id, claim.claim_id), 'evidence must be attached to its claim');
    evidenceIds.push(evidence.evidence_id);
    sourceUrls.push(url);
  }
  const body = {
    componentKind: 'KNOWLEDGE' as const,
    componentType: 'WEB_SEMANTIC_PROPOSITION',
    purpose: `Verified web semantic rule test ${stamp} ${index}: ${statement}`,
    interfaceContract: {
      schemaVersion: 'WEB_SEMANTIC_PROPOSITION_V1',
      unit,
      provenance: {
        sourceTitle: `Independent technical paper ${stamp} ${index}`,
        sourceUrl: sourceUrls[0],
        evidenceId: evidenceIds[0],
        sourceFragmentSha256: unit.sourceFragmentSha256,
        sourceStart: unit.sourceStart,
        sourceEnd: unit.sourceEnd,
      },
      gate: 'CORE_CLAIM_VERIFICATION_REQUIRED',
    },
    inputs: ['source sentence', 'research context'],
    outputs: ['structured proposition', 'conditions', 'exceptions', 'scope signals', 'source lineage'],
    prerequisites: ['Claim must pass CORE verification before knowledge promotion'],
    dependencies: ['WebResearch', 'ClaimVerifier', 'P211 semantic graph'],
    appliesWhen: [unit.kind, unit.relation],
    doesNotApplyWhen: ['Claim has not passed CORE verification'],
    sourceEpisodeIds: [],
    sourceLearningArtifactIds: [],
    environmentFingerprint: 'unknown',
    lifecycleStatus: 'CANDIDATE' as const,
    usageCount: 0,
    successCount: 0,
    failureCount: 0,
    claimIds: [claim.claim_id],
    evidenceRefs: evidenceIds,
    sourceUrls,
    sourceArtifactIds: evidenceIds,
    verificationStatus: 'UNVERIFIED' as const,
    contradictionRefs: [],
    freshnessPolicy: 'REVALIDATE_ON_ENVIRONMENT_CHANGE',
  };
  const now = Date.now();
  const component = {
    ...body,
    componentId: `RC-WEB-SEMANTIC-RULE-TEST-${stamp}-${index}`,
    canonicalSha256: canonicalSha256Object(body),
    createdAt: now,
    updatedAt: now,
  } as KnowledgeComponentArtifact;
  reusableComponentFactoryService.storeCandidates([component]);
  return { component, claimId: claim.claim_id };
}

function verifyCandidate(index: number, statement: string): void {
  const { component, claimId } = createVerifiedCandidate(index, statement);
  const result = reusableComponentFactoryService.verifyResearchKnowledge(component.componentId, [claimId]);
  assert.equal(result.verified, true, `candidate ${index} must pass CORE's independent evidence verification: ${result.reasons.join('; ')}`);
}

const unverifiedReceipt = webSemanticRuleLearningService.observeVerifiedComponent({
  componentId: 'unverified-web-semantic-fixture',
  componentKind: 'KNOWLEDGE',
  componentType: 'WEB_SEMANTIC_PROPOSITION',
  lifecycleStatus: 'CANDIDATE',
  verificationStatus: 'UNVERIFIED',
  claimIds: [],
  interfaceContract: {},
}, []);
assert.equal(unverifiedReceipt.status, 'SKIPPED', 'unverified semantic candidates must never train a rule');

verifyCandidate(0, '赤い調査装置Aは磁場を折り返すことができます。');
verifyCandidate(1, '青い調査装置Bは磁場を折り返すことができます。');
const pendingRule = webSemanticRuleLearningService.listRules().find((rule) => rule.cue === targetCue);
assert.ok(pendingRule, 'repeated cue should be persisted as a learning candidate');
assert.equal(pendingRule.state, 'CANDIDATE', 'two claims must not activate a learned rule');
assert.equal(webSemanticRuleLearningService.getActiveRules().some((rule) => rule.cue === targetCue), false);

verifyCandidate(2, '白い調査装置Cは磁場を折り返すことができます。');
let rule = webSemanticRuleLearningService.listRules().find((item) => item.cue === targetCue);
assert.ok(rule, 'target cue rule must remain present');
assert.equal(rule.state, 'ACTIVE', 'three independent claims, URLs, clusters and distinct subjects should activate the cue');
const learned = extractWebSemanticUnits(unknownProbe, 4, `https://probe-${stamp}.research-site.org/b`);
assert.equal(learned.length, 1, 'an active learned cue should classify a previously unsupported sentence');
assert.ok(learned[0].extractionRule.startsWith('LEARNED_CUE_WEB-RULE-'), 'learned classification must retain rule lineage');
assert.equal(learned[0].kind, 'OBSERVATION');
assert.equal(learned[0].polarity, 'AFFIRMATIVE');
assert.equal(webSemanticRuleLearningService.match(unknownProbe, 'NEGATIVE'), undefined, 'an active affirmative rule must not match a negative-polarity request');
assert.equal(extractWebSemanticUnits('紫の観測装置Dは磁場を折り返さない。', 4, `https://probe-${stamp}.research-site.org/c`).length, 0, 'affirmative learned rules must not classify negative sentences');

verifyCandidate(3, '緑の調査装置Dは磁場を折り返すことができる。');
rule = webSemanticRuleLearningService.listRules().find((item) => item.cue === targetCue);
assert.ok(rule, 'rule must remain auditable after a conflict');
assert.equal(rule.state, 'SUSPENDED', 'a cue with conflicting verified semantic labels must be suspended');
assert.equal(rule.conflicting, true);
assert.equal(extractWebSemanticUnits(unknownProbe, 4, `https://probe-${stamp}.research-site.org/d`).length, 0, 'suspended rules must no longer be applied');

const ruleStoreKey = 'miki_web_semantic_rule_learning_v1';
const savedRules = storageService.getItem(ruleStoreKey);
assert.ok(savedRules, 'learned rules must be persistently stored');
const tampered = JSON.parse(savedRules) as { sha256: string };
tampered.sha256 = '0'.repeat(64);
storageService.setItem(ruleStoreKey, JSON.stringify(tampered));
assert.equal(webSemanticRuleLearningService.listRules().length, 0, 'a snapshot with a bad checksum must not be trusted');
assert.ok(
  storageService.keys().some((key) => key.startsWith(`${ruleStoreKey}_quarantine_`)),
  'the invalid raw snapshot must be quarantined before reset',
);

console.log('PASS web semantic rule learning: unverified-input rejection, evidence threshold, activation, polarity isolation, conflict suspension and corrupt-snapshot quarantine verified');
