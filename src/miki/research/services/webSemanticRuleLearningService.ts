import { canonicalSha256Object } from '../../core/services/canonicalSha256Service';
import { claimDatabaseService } from '../../memory/services/claimDatabaseService';
import { evidenceService } from '../../memory/services/evidenceService';
import { storageService } from '../../../services/storageService';

export type WebSemanticRuleState = 'CANDIDATE' | 'ACTIVE' | 'SUSPENDED';
type SemanticKind = 'DEFINITION' | 'RELATION' | 'CAUSE' | 'CONDITION' | 'PREREQUISITE' | 'PROCEDURE' | 'EXCEPTION' | 'OBSERVATION';
type SemanticRelation = 'DEFINED_AS' | 'ASSERTS' | 'CAUSE_OR_EXPLANATION' | 'CONDITIONAL_ON' | 'REQUIRES' | 'PROCEDURE_STEP' | 'EXCEPTION_TO' | 'OBSERVES';
type SemanticPolarity = 'AFFIRMATIVE' | 'NEGATIVE';

interface SemanticUnitLike {
  kind: SemanticKind;
  relation: SemanticRelation;
  statement: string;
  subject?: string;
  polarity: SemanticPolarity;
  sourceFragmentSha256: string;
  extractionRule: string;
  extractionConfidence: number;
}

interface VerifiedKnowledgeComponentLike {
  componentId: string;
  componentKind: string;
  componentType: string;
  lifecycleStatus: string;
  verificationStatus: string;
  claimIds: string[];
  interfaceContract: Record<string, unknown>;
}

export interface WebSemanticRuleObservation {
  claimId: string;
  componentId: string;
  label: string;
  statementHash: string;
  sourceUrls: string[];
  clusterIds: string[];
  evidenceIds: string[];
  subjectFingerprint: string;
  extractionConfidence: number;
  observedAt: number;
}

export interface WebSemanticLearnedRule {
  ruleId: string;
  cue: string;
  kind: SemanticKind;
  relation: SemanticRelation;
  polarity: SemanticPolarity;
  state: WebSemanticRuleState;
  reason: string;
  conflicting: boolean;
  observedLabels: string[];
  observations: WebSemanticRuleObservation[];
  confidence: number;
  createdAt: number;
  updatedAt: number;
}

interface WebSemanticRuleStorePayload {
  schemaVersion: 1;
  revision: number;
  rules: WebSemanticLearnedRule[];
}

interface WebSemanticRuleStore extends WebSemanticRuleStorePayload {
  sha256: string;
}

export interface WebSemanticRuleLearningReceipt {
  status: 'SKIPPED' | 'CANDIDATE' | 'ACTIVE' | 'SUSPENDED' | 'UNCHANGED';
  learnedRuleIds: string[];
  activeRuleCount: number;
  reason: string;
}

export interface WebSemanticRuleMatch {
  ruleId: string;
  cue: string;
  kind: SemanticKind;
  relation: SemanticRelation;
  polarity: SemanticPolarity;
  confidence: number;
}

const STORAGE_KEY = 'miki_web_semantic_rule_learning_v1';
const MAX_RULES = 256;
const MAX_OBSERVATIONS_PER_RULE = 24;
const MAX_SOURCE_REFS_PER_OBSERVATION = 12;
const CUE_LENGTHS = [6, 8, 10, 12, 14] as const;
const VALID_KINDS: SemanticKind[] = ['DEFINITION', 'RELATION', 'CAUSE', 'CONDITION', 'PREREQUISITE', 'PROCEDURE', 'EXCEPTION', 'OBSERVATION'];
const VALID_RELATIONS: SemanticRelation[] = ['DEFINED_AS', 'ASSERTS', 'CAUSE_OR_EXPLANATION', 'CONDITIONAL_ON', 'REQUIRES', 'PROCEDURE_STEP', 'EXCEPTION_TO', 'OBSERVES'];
const VALID_POLARITIES: SemanticPolarity[] = ['AFFIRMATIVE', 'NEGATIVE'];
const GENERIC_CUES = new Set([
  'ことができます', 'ことができる', 'ことができません', 'ことができない', 'ことがあります', 'ことがある',
  'です', 'ます', 'である', 'する', 'した', 'している', 'できる', 'できない', 'ありません', 'ある', 'いる', 'なる',
  'is', 'are', 'was', 'were', 'be', 'been', 'has', 'have', 'had', 'can', 'cannot', 'will', 'would', 'should', 'must',
  'uses', 'supports', 'contains', 'includes', 'provides', 'works', 'fails', 'stores', 'returns',
]);
const TERMINAL_FRAMES = [
  /ことができます$/u,
  /ことができません$/u,
  /ことができる$/u,
  /ことができない$/u,
  /ことがあります$/u,
  /ことがありません$/u,
  /ことがある$/u,
  /ことがない$/u,
  /とされています$/u,
  /とされている$/u,
  /とされる$/u,
  /と言われています$/u,
  /と言われる$/u,
  /と考えられます$/u,
  /と考えられる$/u,
  /と推定されます$/u,
  /と推定される$/u,
  /\bis able to$/i,
  /\bare able to$/i,
  /\bis considered to$/i,
  /\bare considered to$/i,
  /\bis known to$/i,
  /\bare known to$/i,
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeText(value: string): string {
  return value.normalize('NFKC').replace(/\s+/g, ' ').trim().toLowerCase();
}

function predicateCore(statement: string): string {
  let text = normalizeText(statement).replace(/[。！？!?.,;；:：]+$/gu, '').trim();
  for (let pass = 0; pass < 3; pass += 1) {
    const matched = TERMINAL_FRAMES.find((pattern) => pattern.test(text));
    if (!matched) break;
    const next = text.replace(matched, '').trim();
    if (next.length < 6 || next === text) break;
    text = next;
  }
  return text;
}

function normalizeWebUrl(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  try {
    const url = new URL(raw);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return undefined;
    url.hash = '';
    url.search = '';
    const pathname = url.pathname.replace(/\/+$/u, '') || '/';
    return `${url.protocol}//${url.host.toLowerCase()}${pathname}`;
  } catch {
    return undefined;
  }
}

function isSemanticUnit(value: unknown): value is SemanticUnitLike {
  if (!isRecord(value)) return false;
  return VALID_KINDS.includes(value.kind as SemanticKind)
    && VALID_RELATIONS.includes(value.relation as SemanticRelation)
    && typeof value.statement === 'string'
    && value.statement.trim().length >= 15
    && VALID_POLARITIES.includes(value.polarity as SemanticPolarity)
    && typeof value.sourceFragmentSha256 === 'string'
    && /^[a-f0-9]{64}$/i.test(value.sourceFragmentSha256)
    && typeof value.extractionRule === 'string'
    && Number.isFinite(value.extractionConfidence)
    && Number(value.extractionConfidence) > 0
    && Number(value.extractionConfidence) < 1
    && (value.subject === undefined || typeof value.subject === 'string');
}

function isObservation(value: unknown): value is WebSemanticRuleObservation {
  if (!isRecord(value)) return false;
  return typeof value.claimId === 'string'
    && typeof value.componentId === 'string'
    && typeof value.label === 'string'
    && typeof value.statementHash === 'string'
    && Array.isArray(value.sourceUrls) && value.sourceUrls.every((item) => typeof item === 'string')
    && Array.isArray(value.clusterIds) && value.clusterIds.every((item) => typeof item === 'string')
    && Array.isArray(value.evidenceIds) && value.evidenceIds.every((item) => typeof item === 'string')
    && typeof value.subjectFingerprint === 'string'
    && Number.isFinite(value.extractionConfidence)
    && Number(value.extractionConfidence) > 0
    && Number(value.extractionConfidence) < 1
    && Number.isFinite(value.observedAt);
}

function isRule(value: unknown): value is WebSemanticLearnedRule {
  if (!isRecord(value)) return false;
  return typeof value.ruleId === 'string'
    && typeof value.cue === 'string' && value.cue.length >= 4
    && VALID_KINDS.includes(value.kind as SemanticKind)
    && VALID_RELATIONS.includes(value.relation as SemanticRelation)
    && VALID_POLARITIES.includes(value.polarity as SemanticPolarity)
    && ['CANDIDATE', 'ACTIVE', 'SUSPENDED'].includes(String(value.state))
    && typeof value.reason === 'string'
    && typeof value.conflicting === 'boolean'
    && Array.isArray(value.observedLabels) && value.observedLabels.every((item) => typeof item === 'string')
    && Array.isArray(value.observations) && value.observations.length <= MAX_OBSERVATIONS_PER_RULE
    && value.observations.every(isObservation)
    && Number.isFinite(value.confidence)
    && Number(value.confidence) >= 0 && Number(value.confidence) <= 1
    && Number.isFinite(value.createdAt) && Number.isFinite(value.updatedAt);
}

function hasSafeCue(cue: string): boolean {
  const value = cue.trim();
  if (value.length < 6 || GENERIC_CUES.has(value)) return false;
  if (/^[0-9０-９\p{P}\p{S}\s_]+$/u.test(value)) return false;
  if (/^(?:は|が|を|に|へ|の|で|と|も|や|など|こと|もの|ため|場合|とき|時)+$/u.test(value)) return false;
  return true;
}

function candidateCues(unit: SemanticUnitLike): Array<{ cue: string; subjectFingerprint: string }> {
  const core = predicateCore(unit.statement);
  const results: Array<{ cue: string; subjectFingerprint: string }> = [];
  for (const length of CUE_LENGTHS) {
    if (core.length <= length + 4) continue;
    const cue = core.slice(-length).trim();
    if (!hasSafeCue(cue)) continue;
    const subject = normalizeText(unit.subject || core.slice(0, Math.max(0, core.length - length))).slice(0, 80);
    if (subject.length < 4) continue;
    results.push({ cue, subjectFingerprint: canonicalSha256Object(subject).slice(0, 16) });
  }
  return results.filter((entry, index, array) => array.findIndex((other) => other.cue === entry.cue) === index);
}

function labelFor(unit: SemanticUnitLike): string {
  return `${unit.kind}|${unit.relation}|${unit.polarity}`;
}

function validStore(value: unknown): value is WebSemanticRuleStore {
  if (!isRecord(value)
    || value.schemaVersion !== 1
    || !Number.isFinite(value.revision)
    || Number(value.revision) < 0
    || !Array.isArray(value.rules)
    || value.rules.length > MAX_RULES
    || !value.rules.every(isRule)
    || typeof value.sha256 !== 'string') return false;
  const payload: WebSemanticRuleStorePayload = {
    schemaVersion: 1,
    revision: Number(value.revision),
    rules: value.rules as WebSemanticLearnedRule[],
  };
  return value.sha256 === canonicalSha256Object(payload);
}

export class WebSemanticRuleLearningService {
  private makeStore(revision: number, rules: WebSemanticLearnedRule[]): WebSemanticRuleStore {
    const payload: WebSemanticRuleStorePayload = {
      schemaVersion: 1,
      revision,
      rules: [...rules].sort((left, right) => left.cue.localeCompare(right.cue)),
    };
    return { ...payload, sha256: canonicalSha256Object(payload) };
  }

  private persist(revision: number, rules: WebSemanticLearnedRule[]): WebSemanticRuleStore {
    const store = this.makeStore(revision, rules);
    const raw = JSON.stringify(store);
    storageService.setItem(STORAGE_KEY, raw);
    const readback = storageService.getItem(STORAGE_KEY);
    if (readback !== raw) throw new Error('WEB_SEMANTIC_RULE_STORE_READBACK_MISMATCH');
    let parsed: unknown;
    try {
      parsed = JSON.parse(readback);
    } catch {
      throw new Error('WEB_SEMANTIC_RULE_STORE_READBACK_INVALID_JSON');
    }
    if (!validStore(parsed)) throw new Error('WEB_SEMANTIC_RULE_STORE_READBACK_INVALID_SHAPE_OR_HASH');
    return parsed;
  }

  private quarantineAndReset(raw: string): WebSemanticRuleStore {
    const quarantineKey = `${STORAGE_KEY}_quarantine_${canonicalSha256Object(raw).slice(0, 16)}`;
    storageService.setItem(quarantineKey, raw);
    if (storageService.getItem(quarantineKey) !== raw) {
      throw new Error('WEB_SEMANTIC_RULE_QUARANTINE_READBACK_FAILED');
    }
    return this.persist(0, []);
  }

  private readStore(): WebSemanticRuleStore {
    const raw = storageService.getItem(STORAGE_KEY);
    if (raw === null) return this.makeStore(0, []);
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return this.quarantineAndReset(raw);
    }
    if (!validStore(parsed)) return this.quarantineAndReset(raw);
    return parsed;
  }

  private activeCount(rules: WebSemanticLearnedRule[]): number {
    return rules.filter((rule) => rule.state === 'ACTIVE').length;
  }

  private skip(reason: string): WebSemanticRuleLearningReceipt {
    let activeRuleCount = 0;
    try {
      activeRuleCount = this.activeCount(this.readStore().rules);
    } catch {
      // Rule application remains unavailable when persistent state cannot be trusted.
    }
    return { status: 'SKIPPED', learnedRuleIds: [], activeRuleCount, reason };
  }

  private refreshRule(rule: WebSemanticLearnedRule): void {
    if (rule.observedLabels.length > 1) rule.conflicting = true;
    if (rule.conflicting) {
      rule.state = 'SUSPENDED';
      rule.reason = 'CONFLICTING_VERIFIED_SEMANTIC_LABELS';
      rule.confidence = 0;
      return;
    }
    const claims = new Set(rule.observations.map((item) => item.claimId));
    const urls = new Set(rule.observations.flatMap((item) => item.sourceUrls));
    const clusters = new Set(rule.observations.flatMap((item) => item.clusterIds));
    const subjects = new Set(rule.observations.map((item) => item.subjectFingerprint).filter(Boolean));
    if (claims.size >= 3 && urls.size >= 3 && clusters.size >= 3 && subjects.size >= 2) {
      rule.state = 'ACTIVE';
      rule.reason = 'THREE_VERIFIED_CLAIMS_WITH_INDEPENDENT_WEB_PROVENANCE';
      const baseConfidence = Math.min(...rule.observations.map((item) => item.extractionConfidence));
      rule.confidence = Math.min(0.60, Math.max(0.35, baseConfidence + 0.05));
    } else {
      rule.state = 'CANDIDATE';
      rule.reason = 'INSUFFICIENT_INDEPENDENT_VERIFIED_SAMPLES';
      rule.confidence = 0;
    }
  }

  public observeVerifiedComponent(
    component: VerifiedKnowledgeComponentLike,
    verifiedClaimIds: string[],
  ): WebSemanticRuleLearningReceipt {
    if (component.componentKind !== 'KNOWLEDGE'
      || component.componentType !== 'WEB_SEMANTIC_PROPOSITION'
      || component.verificationStatus !== 'VERIFIED'
      || component.lifecycleStatus !== 'VERIFIED') return this.skip('COMPONENT_NOT_CORE_VERIFIED_WEB_SEMANTIC_KNOWLEDGE');
    const contract = component.interfaceContract;
    if (contract.schemaVersion !== 'WEB_SEMANTIC_PROPOSITION_V1' || !isSemanticUnit(contract.unit)) {
      return this.skip('SEMANTIC_UNIT_SCHEMA_INVALID');
    }
    const unit = contract.unit;
    if (unit.sourceFragmentSha256 !== canonicalSha256Object(normalizeText(unit.statement))) {
      return this.skip('SOURCE_FRAGMENT_HASH_MISMATCH');
    }
    if (unit.extractionRule.startsWith('LEARNED_CUE_')) {
      return this.skip('LEARNED_RULE_OUTPUT_CANNOT_TRAIN_ANOTHER_RULE');
    }
    if (!((unit.kind === 'OBSERVATION' && unit.relation === 'OBSERVES' && unit.extractionRule === 'DECLARATIVE_SENTENCE')
      || (unit.kind === 'RELATION' && unit.relation === 'ASSERTS'
        && ['JA_DECLARATIVE_RELATION', 'EN_DECLARATIVE_RELATION'].includes(unit.extractionRule)))) {
      return this.skip('UNSUPPORTED_RULE_CLASS_FOR_SUFFIX_GENERALIZATION');
    }
    const requested = new Set(verifiedClaimIds.filter(Boolean));
    const claimIds = [...new Set(component.claimIds.filter(Boolean))];
    if (claimIds.length !== 1) return this.skip('ONE_SEMANTIC_UNIT_MUST_MAP_TO_ONE_VERIFIED_CLAIM');
    if (claimIds.some((claimId) => !requested.has(claimId))) {
      return this.skip('COMPONENT_CLAIMS_NOT_ALL_INCLUDED_IN_VERIFIED_RESULT');
    }

    const proof = { sourceUrls: new Set<string>(), clusterIds: new Set<string>(), evidenceIds: new Set<string>() };
    for (const claimId of claimIds) {
      const claim = claimDatabaseService.getClaim(claimId);
      if (!claim || claim.world !== 'REAL' || !['SUPPORTED', 'DEVICE_VERIFIED'].includes(claim.status)) {
        return this.skip('CLAIM_NOT_INDEPENDENTLY_VERIFIED_REAL_WORLD_KNOWLEDGE');
      }
      const hasLiveContradiction = (claim.contradicted_by || []).some((otherId) => {
        const other = claimDatabaseService.getClaim(otherId);
        return Boolean(other && other.status !== 'SUPERSEDED' && other.status !== 'FALSE');
      });
      if (hasLiveContradiction) return this.skip('CLAIM_HAS_LIVE_CONTRADICTION');
      const evidence = evidenceService.list({ claimId }).filter((record) =>
        record.kind === 'WEB'
        && record.status === 'ADMISSIBLE'
        && record.metadata?.research_source_role !== 'COUNTEREVIDENCE'
        && Boolean(normalizeWebUrl(record.url))
      );
      const urls = [...new Set(evidence.map((record) => normalizeWebUrl(record.url)).filter((url): url is string => Boolean(url)))].sort();
      const clusters = [...new Set(evidence.map((record) => record.independence_cluster_id.trim()).filter(Boolean))].sort();
      if (urls.length < 2 || clusters.length < 2) {
        return this.skip('CLAIM_NEEDS_TWO_ADMISSIBLE_WEB_URLS_AND_INDEPENDENT_CLUSTERS');
      }
      urls.slice(0, MAX_SOURCE_REFS_PER_OBSERVATION).forEach((url) => proof.sourceUrls.add(url));
      clusters.slice(0, MAX_SOURCE_REFS_PER_OBSERVATION).forEach((cluster) => proof.clusterIds.add(cluster));
      evidence.map((record) => record.evidence_id).sort().slice(0, MAX_SOURCE_REFS_PER_OBSERVATION)
        .forEach((evidenceId) => proof.evidenceIds.add(evidenceId));
    }

    const cues = candidateCues(unit);
    if (cues.length === 0) return this.skip('NO_SAFE_PREDICATE_CUE');
    const store = this.readStore();
    const now = Date.now();
    const label = labelFor(unit);
    const changedRules: WebSemanticLearnedRule[] = [];
    let changed = false;

    for (const candidate of cues) {
      let rule = store.rules.find((item) => item.cue === candidate.cue);
      if (!rule) {
        rule = {
          ruleId: `WEB-RULE-${canonicalSha256Object(candidate.cue).slice(0, 18)}`,
          cue: candidate.cue,
          kind: unit.kind,
          relation: unit.relation,
          polarity: unit.polarity,
          state: 'CANDIDATE',
          reason: 'INSUFFICIENT_INDEPENDENT_VERIFIED_SAMPLES',
          conflicting: false,
          observedLabels: [],
          observations: [],
          confidence: 0,
          createdAt: now,
          updatedAt: now,
        };
        store.rules.push(rule);
        changed = true;
      }
      const before = JSON.stringify(rule);
      if (!rule.observedLabels.includes(label)) rule.observedLabels = [...rule.observedLabels, label].sort();
      const observation: WebSemanticRuleObservation = {
        claimId: claimIds[0],
        componentId: component.componentId,
        label,
        statementHash: unit.sourceFragmentSha256,
        sourceUrls: [...proof.sourceUrls].sort().slice(0, MAX_SOURCE_REFS_PER_OBSERVATION),
        clusterIds: [...proof.clusterIds].sort().slice(0, MAX_SOURCE_REFS_PER_OBSERVATION),
        evidenceIds: [...proof.evidenceIds].sort().slice(0, MAX_SOURCE_REFS_PER_OBSERVATION),
        subjectFingerprint: candidate.subjectFingerprint,
        extractionConfidence: unit.extractionConfidence,
        observedAt: now,
      };
      const oldObservationIndex = rule.observations.findIndex((item) =>
        item.claimId === observation.claimId
        && item.componentId === observation.componentId
        && item.statementHash === observation.statementHash
        && item.label === observation.label
      );
      if (oldObservationIndex < 0) {
        rule.observations.push(observation);
      } else {
        const oldObservation = rule.observations[oldObservationIndex];
        oldObservation.sourceUrls = [...new Set([...oldObservation.sourceUrls, ...observation.sourceUrls])].sort().slice(0, MAX_SOURCE_REFS_PER_OBSERVATION);
        oldObservation.clusterIds = [...new Set([...oldObservation.clusterIds, ...observation.clusterIds])].sort().slice(0, MAX_SOURCE_REFS_PER_OBSERVATION);
        oldObservation.evidenceIds = [...new Set([...oldObservation.evidenceIds, ...observation.evidenceIds])].sort().slice(0, MAX_SOURCE_REFS_PER_OBSERVATION);
        oldObservation.subjectFingerprint = observation.subjectFingerprint;
        oldObservation.extractionConfidence = Math.min(oldObservation.extractionConfidence, observation.extractionConfidence);
      }
      rule.observations = rule.observations.sort((left, right) => right.observedAt - left.observedAt).slice(0, MAX_OBSERVATIONS_PER_RULE);
      this.refreshRule(rule);
      if (JSON.stringify(rule) !== before) {
        rule.updatedAt = now;
        changed = true;
        changedRules.push(rule);
      }
    }

    store.rules.sort((left, right) => {
      const activeDiff = Number(right.state === 'ACTIVE') - Number(left.state === 'ACTIVE');
      if (activeDiff !== 0) return activeDiff;
      const claimCountDiff = new Set(right.observations.map((item) => item.claimId)).size
        - new Set(left.observations.map((item) => item.claimId)).size;
      return claimCountDiff || right.updatedAt - left.updatedAt || left.cue.localeCompare(right.cue);
    });
    store.rules = store.rules.slice(0, MAX_RULES).sort((left, right) => left.cue.localeCompare(right.cue));
    const saved = changed ? this.persist(store.revision + 1, store.rules) : store;
    const activeRuleCount = this.activeCount(saved.rules);
    if (!changed) return { status: 'UNCHANGED', learnedRuleIds: [], activeRuleCount, reason: 'OBSERVATION_ALREADY_REGISTERED' };
    const changedStates = changedRules.map((rule) => rule.state);
    const status: WebSemanticRuleLearningReceipt['status'] = changedStates.includes('ACTIVE')
      ? 'ACTIVE'
      : changedStates.includes('SUSPENDED') ? 'SUSPENDED' : 'CANDIDATE';
    return {
      status,
      learnedRuleIds: [...new Set(changedRules.map((rule) => rule.ruleId))],
      activeRuleCount,
      reason: changedRules.map((rule) => rule.reason).sort()[0] || 'RULE_OBSERVATION_STORED',
    };
  }

  public listRules(): WebSemanticLearnedRule[] {
    return this.readStore().rules.map((rule) => ({
      ...rule,
      observedLabels: [...rule.observedLabels],
      observations: rule.observations.map((observation) => ({
        ...observation,
        sourceUrls: [...observation.sourceUrls],
        clusterIds: [...observation.clusterIds],
        evidenceIds: [...observation.evidenceIds],
      })),
    }));
  }

  public getActiveRules(): WebSemanticLearnedRule[] {
    return this.listRules().filter((rule) => rule.state === 'ACTIVE');
  }

  public match(statement: string, polarity: SemanticPolarity): WebSemanticRuleMatch | undefined {
    try {
      const core = predicateCore(statement);
      if (core.length < 10) return undefined;
      const matches = this.readStore().rules
        .filter((rule) => rule.state === 'ACTIVE'
          && rule.polarity === polarity
          && core.length > rule.cue.length + 4
          && core.endsWith(rule.cue))
        .sort((left, right) => right.cue.length - left.cue.length
          || right.confidence - left.confidence
          || left.ruleId.localeCompare(right.ruleId));
      const rule = matches[0];
      if (!rule) return undefined;
      return {
        ruleId: rule.ruleId,
        cue: rule.cue,
        kind: rule.kind,
        relation: rule.relation,
        polarity: rule.polarity,
        confidence: rule.confidence,
      };
    } catch {
      // Untrusted or unreadable learned state is never allowed to break base extraction.
      return undefined;
    }
  }
}

export const webSemanticRuleLearningService = new WebSemanticRuleLearningService();
