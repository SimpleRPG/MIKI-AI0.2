import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(path, 'utf8');
const research = read('src/miki/research/services/autonomousSearchService.ts');
const evidence = read('src/miki/memory/services/evidenceService.ts');
const candidateUnknown = read('src/miki/core/services/candidateUnknownResolutionService.ts');
const mainTools = read('src/services/toolsService.ts');
const capabilityTools = read('src/miki/capability/services/toolsService.ts');
const workflow = read('.github/workflows/build-apk.yml');
const design = read('MIKI-AI0.2_統合設計書_正本.txt');

const learnStart = research.indexOf('  public learnFromSearch(');
const idleStart = research.indexOf('  public async performIdleAutonomousLearning(');
const renderedPageStart = research.indexOf(
  '  /**\n   * 指示1 & 指示5: ネイティブ(またはフォールバック)のヘッドレスWebViewを用いて',
  idleStart,
);
assert.ok(learnStart >= 0 && idleStart > learnStart, 'Research learning methods must exist');
assert.ok(renderedPageStart > idleStart, 'Idle learning method boundary must exist');

const learning = research.slice(learnStart, idleStart);
const idle = research.slice(idleStart, renderedPageStart);

assert.ok(research.includes('function isSyntheticSearchResult('), 'Synthetic search guard must exist');
assert.ok(research.includes('function isSourceBackedSearchResult('), 'URL-backed source guard must exist');
assert.ok(evidence.includes('export function isSyntheticWebMaterial('), 'A shared synthetic-material classifier must exist');
assert.ok(evidence.includes('return isSyntheticWebMaterial(input);'), 'Evidence rejection must use the shared classifier');
assert.ok(research.includes('return isSyntheticWebMaterial({'), 'Search admission must use the shared classifier');
assert.ok(research.includes('const syntheticSummary = isSyntheticWebMaterial('), 'Synthetic summary must be checked independently');
assert.ok(research.includes("const acceptedSourceBackedResults: WebSearchResultItem[] = [];"), 'Only accepted source-backed results may continue');
assert.ok(research.includes("evidence.status === 'REJECTED'"), 'Rejected Evidence must be excluded');
assert.ok(research.includes('sourceBackedResults = acceptedSourceBackedResults;'), 'Downstream learning must receive only evidence-backed results');
assert.ok(!learning.includes('const sourceEvidenceIds = sourceBackedResults.slice(0, 3).map'), 'Evidence IDs must not be taken unconditionally from recordWebEvidence');
assert.ok(learning.includes('sourceEvidenceIds.push(evidence.evidence_id)'), 'Only a non-rejected Evidence ID may be added to the learning set');

const memoryItemStart = learning.indexOf('const memItem: MemoryItem = {');
const memoryItemEnd = learning.indexOf('storageService.saveMemoryItem(memItem)', memoryItemStart);
assert.ok(memoryItemStart >= 0 && memoryItemEnd > memoryItemStart, 'Stored MemoryItem must exist');
const memoryItem = learning.slice(memoryItemStart, memoryItemEnd);
assert.ok(memoryItem.includes('verificationStatus: effectiveVerificationStatus'), 'Memory must use persisted outcome verification');
assert.ok(!memoryItem.includes('verificationStatus: options?.verificationStatus'), 'Caller-supplied verification must not bypass outcome validation');
assert.ok(learning.includes('evidenceService.recordWebEvidence('), 'Search materials must be recorded by EvidenceService');
assert.ok(!learning.includes("evidenceIdentityService.create('search'"), 'Synthetic evidence identity must not replace Evidence records');
assert.ok(learning.includes('this.hasVerifiedResearchOutcome(options)'), 'Verification flags must be checked against persisted evidence and claims');
assert.ok(research.includes("item.status === 'ADMISSIBLE'"), 'Agenda resolution must require admissible Evidence');
assert.ok(research.includes("claim.status !== 'SUPPORTED' && claim.status !== 'DEVICE_VERIFIED'"), 'Agenda resolution must require verified Claims');
assert.ok(learning.includes('if (options?.resolvedAgendaId && verifiedResearchOutcome)'), 'Agenda resolution must be gated by verified research');
assert.ok(learning.includes("verificationStatus: effectiveVerificationStatus"), 'Stored learning status must reflect validated verification');

assert.ok(evidence.includes('export function isSyntheticWebMaterial('), 'A shared synthetic-material classifier must exist');
assert.ok(research.includes('return isSyntheticWebMaterial({'), 'Search learning must use the shared classifier');
assert.ok(evidence.includes('return isSyntheticWebMaterial(input);'), 'Evidence rejection must use the shared classifier');
for (const marker of ['local synthetic fallback', 'synthetic fallback', 'offline fallback', 'fallback result', 'synthetic result', 'mock (non-real)', 'mock_fallback', 'knowledge.local', 'テスト用モック', '【テスト用モック】', '【テスト用モックデータ】', '実データではありません']) {
  assert.ok(evidence.includes(marker), `Shared synthetic-material marker missing: ${marker}`);
}

assert.ok(research.includes('const UNVERIFIED_RESEARCH_COOLDOWN_MS = 24 * 60 * 60 * 1000;'), '24-hour unverified research cooldown must be configured');
assert.ok(research.includes('private hasRecentUnverifiedResearch('), 'Recent unverified query guard must exist');
assert.ok(idle.includes("this.hasRecentUnverifiedResearch(searchQuery, 'working_agenda')"), 'Agenda search must be throttled');
assert.ok(idle.includes("this.hasRecentUnverifiedResearch(query, 'capability_gap')"), 'Capability-gap search must be throttled');
assert.ok(!idle.includes('workingAgendaService.resolveAgenda('), 'Idle search must not resolve agendas directly');
assert.ok(!idle.includes('capabilityGapService.updateGapStatus('), 'Idle search must not mitigate gaps from result count alone');
assert.ok(idle.includes('独立検証まで未解決状態を維持します'), 'Agenda search must remain unresolved until independent verification');
assert.ok(idle.includes('OPENを維持します'), 'Capability gap must remain open until independent verification');

for (const [name, source] of [['main tools', mainTools], ['capability tools', capabilityTools]]) {
  assert.ok(
    source.includes('検索結果は学習・記憶へ反映しませんでした'),
    `${name} must not announce successful learning when the source guard rejects results`,
  );
}

assert.ok(candidateUnknown.includes('resolution.evidenceCount + collectedMaterials.length'), 'The separate implementation-material count issue remains explicitly visible for its own follow-up');
assert.ok(workflow.includes('node scripts/verify_research_learning_integrity_p331.mjs'), 'P331 verifier must run in GitHub Actions');
assert.ok(design.includes('B-008') && design.includes('B-009') && design.includes('B-010'), 'P331 backlog items must be recorded');

console.log('P331 research provenance, mock rejection, verification gating and cooldown: PASS');
