import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const read=p=>fs.readFileSync(p,'utf8');
const expected=['core','autonomy','capability','conversation','data','execution','experience','improvement','learning','memory','promotion','research','safety','selfAwareness','selfDevelopment','strategy','unknown','verification'];
const cross=read('src/miki/core/services/crossDomainCirculationService.ts');
const service=read('src/miki/selfDevelopment/services/mikiSelfCodingSuperchargerService.ts');
const aut=read('src/miki/autonomy/services/autonomousContinuousEvolutionService.ts');
const arch=read('src/miki/selfDevelopment/services/selfCodeArchitectService.ts');
const ultra=read('src/components/self_improvement/UltraSelfEvolverSubView.tsx');
const planner=read('src/miki/core/services/adaptiveRoutePlannerService.ts');
const router=read('src/miki/core/services/domainRouterService.ts');
const bootstrap=read('src/miki/core/services/domainIntegrationBootstrapService.ts');
const server=read('server.ts');
const files=[];
function walk(dir){for(const ent of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,ent.name);if(ent.isDirectory())walk(p);else if(/\.(ts|tsx)$/.test(ent.name))files.push(p);}}
walk('src');
const executable=[...files,'server.ts'].map(p=>({p,t:read(p)}));
const bad=[];
const domainMatches=[...cross.matchAll(/'([A-Za-z][A-Za-z0-9]*)'/g)].map(m=>m[1]).filter(x=>expected.includes(x));
const uniqueDomain=[...new Set(domainMatches)];
if(uniqueDomain.length!==18||!expected.every(x=>uniqueDomain.includes(x)))bad.push('DOMAIN_SET_NOT_EXACT_18');
if(!router.includes("| 'RUN_SELF_IMPROVEMENT' | 'SAVE_AUTONOMY_CONFIG'"))bad.push('AUTONOMY_COMMAND_NOT_REGISTERED');
if(!planner.includes("target:'autonomy',\n        command:'SAVE_AUTONOMY_CONFIG'"))bad.push('AUTONOMY_CONFIG_NOT_CORE_PLANNED');
if(!bootstrap.includes("domain==='autonomy'&&envelope.command==='SAVE_AUTONOMY_CONFIG'"))bad.push('AUTONOMY_CONFIG_HANDLER_MISSING');
for(const p of executable){
  const t=p.t;
  if(/localLlmEndpoint|localLlmModel|miki_external_llm_config/.test(t) && /mikiSelfCodingSuperchargerService|selfCodeArchitectService|UltraSelfEvolverSubView|autonomousContinuousEvolutionService/.test(p.p))bad.push(`SELF_CODE_LOCAL_LLM_REFERENCE:${p.p}`);
  if(/from\s+['"][^'"]*(?:nativeLlmService|webLlmService|ggufModels)[^'"]*['"]/.test(t))bad.push(`LOCAL_RUNTIME_IMPORT:${p.p}`);
  if(/new\s+Worker\([^)]*(?:llama|webllm|gguf)/i.test(t))bad.push(`LOCAL_RUNTIME_WORKER:${p.p}`);
}
// Direct physical apply calls: only the approved promotion service should pass true, and it must carry CORE_PROMOTION.
const callerFiles=['src/miki/selfDevelopment/services/selfCodeArchitectService.ts','src/components/self_improvement/UltraSelfEvolverSubView.tsx','src/miki/autonomy/services/autonomousContinuousEvolutionService.ts','src/components/CodeEditor.tsx','src/miki/selfDevelopment/services/mikiSelfCodingSuperchargerService.ts'];
for(const p of callerFiles){
  const t=read(p);
  const re=/runAutonomousImplementation\([\s\S]{0,500}?\n\s*\);/g; let m;
  while((m=re.exec(t))){if(/\n\s*true\b/.test(m[0]) && !m[0].includes("'CORE_PROMOTION'"))bad.push(`UNAUTHORIZED_PHYSICAL_APPLY:${p}`);}
}
// The one approved physical apply must exist and have the authority token.
if(!aut.includes("true, // 正式配備\n        code,\n        'CORE_PROMOTION'"))bad.push('CORE_PROMOTION_PATH_MISSING');
const report={version:'v193',passed:bad.length===0,domainCount:uniqueDomain.length,failures:bad,policy:'CORE is the single planner/authority; 17 classifications execute selected work; self-code physical apply requires CORE_PROMOTION; local generative runtime is unavailable'};
fs.writeFileSync('ARCHITECTURE_FINAL_AUDIT_V193.json',JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
if(bad.length)process.exit(1);
