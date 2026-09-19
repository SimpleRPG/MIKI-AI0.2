import fs from 'node:fs';
import path from 'node:path';

const read = (file) => fs.readFileSync(file, 'utf8');
const exists = (file) => fs.existsSync(file);

const files = {
  pipeline: 'src/miki/conversation/services/conversationComponentPipelineService.ts',
  composition: 'src/miki/capability/services/componentCompositionService.ts',
  registry: 'src/miki/capability/services/componentRegistryService.ts',
  hybrid: 'src/miki/conversation/services/hybridConversationEngineService.ts',
  nonLlm: 'src/miki/safety/services/nonLlmCoreService.ts',
  bootstrap: 'src/miki/core/services/domainIntegrationBootstrapService.ts',
  runtime: 'src/miki/conversation/services/runtimeConversationCompositionService.ts',
  coreOrchestrator: 'src/miki/core/services/coreOrchestratorService.ts',
  coreResult: 'src/miki/core/services/coreResultService.ts',
  barrel: 'src/miki/conversation.ts',
  domainRouter: 'src/miki/core/services/domainRouterService.ts',
  domainCatalog: 'src/miki/core/services/domainCatalogService.ts',
};

for (const file of Object.values(files)) {
  if (!exists(file)) throw new Error(`MISSING: ${file}`);
}

const pipeline = read(files.pipeline);
const composition = read(files.composition);
const registry = read(files.registry);
const hybrid = read(files.hybrid);
const nonLlm = read(files.nonLlm);
const bootstrap = read(files.bootstrap);
const runtime = read(files.runtime);
const coreOrchestrator = read(files.coreOrchestrator);
const coreResult = read(files.coreResult);
const barrel = read(files.barrel);
const domainRouter = read(files.domainRouter);
const domainCatalog = read(files.domainCatalog);

function collectFiles(dir) {
  const out = [];
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) out.push(...collectFiles(p));
    else if (p.endsWith('.ts')) out.push(p);
  }
  return out;
}

const srcFiles = collectFiles('src/miki');
const directJapaneseCalls = srcFiles
  .filter(file => file !== files.pipeline)
  .filter(file => /japaneseAnalysisCompositionService\.analyze(?:Sync)?\s*\(/.test(read(file)));

const orchestratorRefs = srcFiles.filter(file =>
  /JapaneseAnalysisComponentOrchestratorService|japaneseAnalysisComponentOrchestratorService/.test(read(file))
);

const runtimeMethod = composition.match(
  /public composeRuntimeComponentIds\([\s\S]*?\n  public composeFromCapabilityPlan\(/,
)?.[0] || '';

const allowedStatusBlock = runtimeMethod.match(
  /const allowedStatuses = new Set<[\s\S]*?\);/
)?.[0] || '';

const checks = [
  ['common pipeline exists', exists(files.pipeline)],
  ['old Japanese-only orchestrator removed', !exists('src/miki/conversation/services/japaneseAnalysisComponentOrchestratorService.ts')],
  ['no Japanese-only orchestrator refs remain in src/miki', orchestratorRefs.length === 0],
  ['only common pipeline directly calls low-level Japanese composition', directJapaneseCalls.length === 0],
  ['hybrid uses common pipeline', hybrid.includes('conversationComponentPipelineService.analyzeSync')],
  ['nonLlmCore uses common pipeline', nonLlm.includes('conversationComponentPipelineService.analyzeSync')],
  ['CORE ANALYZE_TEXT uses common pipeline', bootstrap.includes('conversationComponentPipelineService.analyze(')],
  ['ANALYZE_TEXT remains in conversation domain', domainRouter.includes("'ANALYZE_TEXT'") && bootstrap.includes("if(domain==='conversation')return ['ANALYZE_TEXT'];")],
  ['pipeline uses generic registry', pipeline.includes('componentRegistryService')],
  ['pipeline uses generic composition', pipeline.includes('componentCompositionService')],
  ['pipeline declares String as external initial input', pipeline.includes("'conversation',\n      ['String'],")],
  ['CompositionPlan records initial input types', composition.includes('initial_input_types?: string[];')],
  ['runtime planner accepts initial input types', runtimeMethod.includes('initialInputTypes: string[]')],
  ['runtime planner checks initial/previous input supply', runtimeMethod.includes('inputTypeSatisfied') && runtimeMethod.includes('initialInputTypes')],
  ['runtime planner records initial input types', runtimeMethod.includes('initial_input_types: [...normalizedInitialInputs]')],
  ['runtime planner allowed statuses exclude CANDIDATE', Boolean(allowedStatusBlock) && !allowedStatusBlock.includes("'CANDIDATE'")],
  ['analysis components registered generically', registry.includes('conversation.analysis.sudachi') && registry.includes('conversation.analysis.intl_segmenter') && registry.includes('conversation.analysis.dictionary_ngram')],
  ['normal conversation builds AnswerContentIR', nonLlm.includes('answerContentIrService.buildAnswerIR')],
  ['normal conversation uses runtime composition', nonLlm.includes('runtimeConversationCompositionService.compose') && runtime.includes('AnswerContentIR')],
  ['CoreResult completion path exists', coreOrchestrator.includes('coreResultService.complete(') && coreResult.includes('interface CoreResult')],
  ['conversation barrel has no Japanese-only orchestrator export', !barrel.includes('japaneseAnalysisComponentOrchestratorService')],
  ['17-domain catalog remains intact', ['autonomy','capability','conversation','data','execution','experience','improvement','learning','memory','promotion','research','safety','selfAwareness','selfDevelopment','strategy','unknown','verification'].every(d => domainCatalog.includes(`'${d}'`) || domainCatalog.includes(`"${d}"`))],
];

let failed = false;
for (const [name, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}`);
  if (!ok) failed = true;
}

if (failed) process.exit(1);
console.log('COMMON CONVERSATION COMPONENT PIPELINE CONTRACT HARDEN PASS');
