import fs from 'node:fs';
import path from 'node:path';

const read = (file) => fs.readFileSync(file, 'utf8');

const hybrid = read('src/miki/conversation/services/hybridConversationEngineService.ts');
const nonLlm = read('src/miki/safety/services/nonLlmCoreService.ts');
const bootstrap = read('src/miki/core/services/domainIntegrationBootstrapService.ts');
const barrel = read('src/miki/conversation.ts');
const pipeline = read('src/miki/conversation/services/conversationComponentPipelineService.ts');
const composition = read('src/miki/capability/services/componentCompositionService.ts');
const registry = read('src/miki/capability/services/componentRegistryService.ts');
const domainRouter = read('src/miki/core/services/domainRouterService.ts');
const domainCatalog = read('src/miki/core/services/domainCatalogService.ts');

function collectFiles(dir) {
  const out = [];
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) out.push(...collectFiles(p));
    else if (p.endsWith('.ts') && !p.includes(`${path.sep}dist${path.sep}`)) out.push(p);
  }
  return out;
}

const srcFiles = collectFiles('src/miki');
const directJapaneseCalls = srcFiles
  .filter(file => file !== 'src/miki/conversation/services/conversationComponentPipelineService.ts')
  .filter(file => /japaneseAnalysisCompositionService\.analyze(?:Sync)?\s*\(/.test(read(file)));

const orchestratorReferences = srcFiles.filter(file =>
  /JapaneseAnalysisComponentOrchestratorService|japaneseAnalysisComponentOrchestratorService/.test(read(file))
);

const checks = [
  ['common pipeline file exists', fs.existsSync('src/miki/conversation/services/conversationComponentPipelineService.ts')],
  ['hybrid uses common pipeline', hybrid.includes('conversationComponentPipelineService') && hybrid.includes('conversationComponentPipelineService.analyzeSync')],
  ['nonLlmCore uses common pipeline', nonLlm.includes('conversationComponentPipelineService') && nonLlm.includes('conversationComponentPipelineService.analyzeSync')],
  ['hybrid has no direct low-level Japanese composition call', !hybrid.includes('japaneseAnalysisCompositionService')],
  ['nonLlmCore has no direct low-level Japanese composition call', !nonLlm.includes('japaneseAnalysisCompositionService')],
  ['CORE ANALYZE_TEXT uses common pipeline', bootstrap.includes('conversationComponentPipelineService') && bootstrap.includes('conversationComponentPipelineService.analyze(')],
  ['ANALYZE_TEXT remains a CORE conversation command', domainRouter.includes("'ANALYZE_TEXT'") && bootstrap.includes("if(domain==='conversation')return ['ANALYZE_TEXT'];")],
  ['conversation barrel removes Japanese orchestrator', !barrel.includes('japaneseAnalysisComponentOrchestratorService')],
  ['Japanese-only orchestrator file removed', !fs.existsSync('src/miki/conversation/services/japaneseAnalysisComponentOrchestratorService.ts')],
  ['no remaining Japanese-only orchestrator references in src/miki', orchestratorReferences.length === 0],
  ['only common pipeline may call low-level Japanese composition', directJapaneseCalls.length === 0],
  ['common pipeline imports registry', pipeline.includes('componentRegistryService')],
  ['common pipeline imports generic composition', pipeline.includes('componentCompositionService')],
  ['common pipeline builds a CompositionPlan', pipeline.includes('composeRuntimeComponentIds')],
  ['common composition runtime planner exists', composition.includes('public composeRuntimeComponentIds(')],
  ['analysis components registered', registry.includes('conversation.analysis.sudachi') && registry.includes('conversation.analysis.intl_segmenter') && registry.includes('conversation.analysis.dictionary_ngram') && registry.includes('conversation.analysis.composed')],
  ['17-domain catalog remains present', domainCatalog.includes('MIKI_DOMAINS') && ['autonomy','capability','conversation','data','execution','experience','improvement','learning','memory','promotion','research','safety','selfAwareness','selfDevelopment','strategy','unknown','verification'].every(d => domainCatalog.includes(`'${d}'`) || domainCatalog.includes(`"${d}"`))],
  ['no local generative runtime guard remains', fs.existsSync('scripts/test_no_local_generative_runtime_v55.mjs') || fs.existsSync('scripts/test_no_local_generative_runtime_v55.ts')],
];

let failed = false;
for (const [name, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}`);
  if (!ok) failed = true;
}

if (failed) process.exit(1);
console.log('COMMON CONVERSATION COMPONENT PIPELINE PASS');
