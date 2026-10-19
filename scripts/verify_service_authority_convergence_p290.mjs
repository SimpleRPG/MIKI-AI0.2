#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const require = (ok, message) => { if (!ok) throw new Error(message); };
const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');

const report = JSON.parse(read('SERVICE_AUTHORITY_CONVERGENCE_P290.json'));
const ledger = JSON.parse(read('SOURCE_FILE_RELATION_LEDGER_P290.json'));
const pairs = report.pairs;
require(pairs.length === 37, 'expected 37 converged service pairs');
require(ledger.revision === 'P290', 'ledger revision must be P290');
require(ledger.records.length === 1787, 'unified ledger record count mismatch');
require(ledger.counts.pathDuplicateCount === undefined || ledger.counts.pathDuplicateCount === 0, 'unexpected top-level duplicate paths');
require(report.counts.currentBodyDuplicatePairs === 0, 'duplicate implementation count must be zero');
const seenLegacy = new Set();
const seenCanonical = new Set();
for (const pair of pairs) {
  require(!seenLegacy.has(pair.legacyPath), `duplicate legacy path ${pair.legacyPath}`);
  require(!seenCanonical.has(pair.canonicalPath), `duplicate canonical path ${pair.canonicalPath}`);
  seenLegacy.add(pair.legacyPath); seenCanonical.add(pair.canonicalPath);
  const canonical = read(pair.canonicalPath);
  const legacy = read(pair.legacyPath);
  const importTarget = `../${pair.canonicalPath.slice('src/'.length).replace(/\.ts$/, '')}`;
  require(legacy.includes(`export * from '${importTarget}'`), `facade target mismatch: ${pair.legacyPath}`);
  require((legacy.match(/^export\s+\*\s+from\s+/gm) || []).length === 1, `expected exactly one re-export: ${pair.legacyPath}`);
  require(!/^export\s+(?:const|let|var|class|function|abstract\s+class)\s+/m.test(legacy), `implementation remains in facade: ${pair.legacyPath}`);
  require(!/\bprivate\s+\w+\s*=/.test(legacy), `private state remains in facade: ${pair.legacyPath}`);
  require(canonical.length > 0, `empty canonical service: ${pair.canonicalPath}`);
  const legacyRecord = ledger.records.find(r => r.path === pair.legacyPath);
  const canonicalRecord = ledger.records.find(r => r.path === pair.canonicalPath);
  require(Boolean(legacyRecord && canonicalRecord), `ledger pair missing: ${pair.basename}`);
  require(legacyRecord.staticDependencies.includes(pair.canonicalPath), `ledger facade edge missing: ${pair.legacyPath}`);
  require(legacyRecord.capabilityClassification.implementationRole === 'COMPATIBILITY_RE_EXPORT_FACADE', `ledger facade role missing: ${pair.legacyPath}`);
  require(canonicalRecord.staticImporters.some(i => i.path === pair.legacyPath), `canonical reverse edge missing: ${pair.basename}`);
  require(legacyRecord.sourceFacts.sha256 === sha256(legacy), `ledger hash mismatch: ${pair.legacyPath}`);
  require(canonicalRecord.sourceFacts.sha256 === sha256(canonical), `ledger hash mismatch: ${pair.canonicalPath}`);
}

const checks = [];
function check(name, ok) { checks.push({name, passed: Boolean(ok)}); require(ok, `behavior contract failed: ${name}`); }
const findCanonical = (basename) => pairs.find(p => p.basename === basename)?.canonicalPath;
const canon = (basename) => read(findCanonical(basename));
check('request compiler preserves multi-intent planning', /decomposeMultiIntent|intentPlan/.test(canon('requestTypeCompilerService.ts')));
check('skills graduation routes to deterministic capability candidates', /registerCapabilityCandidate|capabilityCandidateId/.test(canon('skillsService.ts')) && !/lora_dataset|exportToLoraDataset/i.test(canon('skillsService.ts')));
check('capability graph exposes legacy-compatible exclusion and environment arguments', /excludedComponentIds[\s\S]{0,180}environment\??:/.test(canon('capabilityGraphService.ts')));
check('dictionary keeps semantic graph integration', /semanticDictionaryGraphP209Service|\.lookup\(surface\)/.test(canon('japaneseDictionaryService.ts')));
check('experience route is deterministic candidate flow, not LoRA', /routeToCapabilityCandidate|verified_candidate/.test(canon('experienceRouterService.ts')) && !/lora_dataset|exportToLoraDataset/i.test(canon('experienceRouterService.ts')));
check('feature flag does not expose active LoRA default', !/LORA_TRAINING\s*:/.test(canon('featureFlagsService.ts').slice(0, canon('featureFlagsService.ts').indexOf('private loadFlags'))));
check('execution runner preserves counterfactual contract', /counterfactualMeasurement|validateCounterfactualRunnerTag/.test(canon('executionRunnerService.ts')));
check('capability evolution accepts deterministic candidates, not old sample contract', /compileVerifiedCandidate\(candidate: CapabilityLearningCandidate\)/.test(canon('deterministicCapabilityEvolutionService.ts')) && !/compileVerifiedSample\(sample: TrainingSampleJSONL\)/.test(canon('deterministicCapabilityEvolutionService.ts')));
check('Japanese analyzer protects empty input and retains fallback', /if \(!normalizedText\) return this\.buildResult/.test(canon('japaneseAnalysisService.ts')) && /analyzeDeterministic/.test(canon('japaneseAnalysisService.ts')));
check('capability gap retains evidence and experience integration', /evidenceIds/.test(canon('capabilityGapService.ts')) && /experienceLinkService/.test(canon('capabilityGapService.ts')) && /evidenceBasedPromotionGateService|unknownTaskDecompositionService/.test(canon('capabilityGapService.ts')));
check('long-term memory uses the domain runtime authority', /deterministicRuntimeService/.test(canon('longTermMemoryService.ts')));
check('old LoRA runtime service is absent', !fs.existsSync(path.join(ROOT, 'src/services/virtualTrainingService.ts')));

// Legacy flag identifiers are permitted only inside migration code. The active
// route/default flag paths are asserted above; no adapter/dataset API is allowed.
const sourceFiles = [];
function walk(dir) {
  for (const ent of fs.readdirSync(path.join(ROOT, dir), {withFileTypes:true})) {
    const rel = path.posix.join(dir, ent.name);
    if (ent.isDirectory()) walk(rel);
    else if (/\.(?:ts|tsx|js|jsx|kt|rs)$/.test(ent.name)) sourceFiles.push(rel);
  }
}
walk('src'); walk('android-native'); walk('native');
const allText = sourceFiles.map(p => [p, read(p)]);
const activeLoRA = allText.flatMap(([p, t]) => {
  const allowed = new Set(['src/services/storageService.ts','src/miki/safety/services/featureFlagsService.ts','src/miki/capability/services/skillsService.ts']);
  const hits = [...t.matchAll(/lora_dataset|exportToLoraDataset|LoraAdapter|lora_adapter|LORA_TRAINING/g)].map(m => ({p, token:m[0]}));
  return allowed.has(p) ? [] : hits.filter(h => !(p === 'src/miki/capability/services/skillsService.ts' && /trainingSampleId|graduatedToTrainingAt/.test(t)));
});
check('no active LoRA route/API outside one-time migration paths', activeLoRA.length === 0);

const legacyFiles = pairs.map(p => path.join(ROOT, p.legacyPath));
check('37 compatibility facades are unique and present', new Set(legacyFiles).size === 37 && legacyFiles.every(fs.existsSync));
check('ledger has no duplicate paths and current import graph matches edge count', new Set(ledger.records.map(r => r.path)).size === ledger.records.length && ledger.edgesTouchingSelectedFiles.length === ledger.counts.allResolvedLocalImportEdges && ledger.records.every(r => new Set(r.staticDependencies).size === r.staticDependencies.length));
check('four byte-identical Android/source asset pairs are kept out of service consolidation', ledger.duplicateAuditP290Current.byteIdenticalGroups.length === 4 && ledger.duplicateAuditP290Current.counts.highPriorityCurrentBodyDuplicatePairs === 0);
console.log(JSON.stringify({status:'PASS',revision:'P290',facades:pairs.length,canonicalImplementations:new Set(pairs.map(p=>p.canonicalPath)).size,checks:checks.length,sourceHash:sha256(pairs.map(p=>read(p.legacyPath)).join('\n'))}, null, 2));
