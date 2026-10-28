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
assert.ok(research.includes("const sourceEvidenceIds = sourceBackedResults.slice(0, 3).map"), 'Learning must assign source-backed Evidence IDs');
assert.ok(learning.includes('evidenceService.recordWebEvidence('), 'Search materials must be recorded by EvidenceService');
assert.ok(!learning.includes("evidenceIdentityService.create('search'"), 'Synthetic evidence identity must not replace Evidence records');
assert.ok(learning.includes('this.hasVerifiedResearchOutcome(options)'), 'Verification flags must be checked against persisted evidence and claims');
assert.ok(research.includes("item.status === 'ADMISSIBLE'"), 'Agenda resolution must require admissible Evidence');
assert.ok(research.includes("claim.status !== 'SUPPORTED' && claim.status !== 'DEVICE_VERIFIED'"), 'Agenda resolution must require verified Claims');
assert.ok(learning.includes('if (options?.resolvedAgendaId && verifiedResearchOutcome)'), 'Agenda resolution must be gated by verified research');
assert.ok(learning.includes("verificationStatus: effectiveVerificationStatus"), 'Stored learning status must reflect validated verification');

for (const marker of ['mock (non-real)', 'mock_fallback', 'knowledge.local', '【テスト用モック】', '実データではありません']) {
  assert.ok(research.includes(marker), `Search learning mock marker missing: ${marker}`);
}
for (const marker of ['mock (non-real)', 'mock_fallback', 'knowledge.local', 'テスト用モック', '実データではありません']) {
  assert.ok(evidence.includes(marker), `Evidence rejection marker missing: ${marker}`);
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
