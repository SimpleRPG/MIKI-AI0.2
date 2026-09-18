import fs from 'node:fs';
import path from 'node:path';
const root=process.cwd(); const src=path.join(root,'src');
const domains=['core','autonomy','capability','conversation','data','execution','experience','improvement','learning','memory','promotion','research','safety','selfAwareness','selfDevelopment','strategy','unknown','verification'];
const failures=[];
for(const d of domains){if(!fs.existsSync(path.join(src,'miki',d)))failures.push(`DOMAIN_DIR_MISSING:${d}`);if(!fs.existsSync(path.join(src,'miki',`${d}.ts`)))failures.push(`DOMAIN_BARREL_MISSING:${d}`);}
const walk=d=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(d,e.name)):[path.join(d,e.name)]);
const files=walk(src).filter(f=>/\.(ts|tsx)$/.test(f));
const forbidden=[/deterministicRuntimeService\.getActiveModelId\(\)/,/deterministicRuntimeService\.isLoaded\(\)/,/deterministicRuntimeService\.isNative\(\)/,/deterministicRuntimeService\.isModelLoaded\(/,/deterministicRuntimeService\.getAvailableGgufModels\(\)/];
for(const f of files){const rel=path.relative(root,f).replaceAll('\\','/');if(rel.endsWith('/deterministicRuntimeService.ts'))continue;const t=fs.readFileSync(f,'utf8');for(const x of forbidden)if(x.test(t))failures.push(`ACTIVE_LOCAL_RUNTIME_REFERENCE:${rel}:${x}`);}
const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));for(const n of Object.keys({...pkg.dependencies,...pkg.devDependencies}))if(/(web-llm|llama|gguf)/i.test(n))failures.push(`LOCAL_GENERATIVE_DEPENDENCY:${n}`);
const ingress=fs.readFileSync(path.join(src,'miki/core/services/coreTaskIngressService.ts'),'utf8');const orch=fs.readFileSync(path.join(src,'miki/core/services/coreOrchestratorService.ts'),'utf8');if(!/coreOrchestratorService/.test(ingress))failures.push('CORE_INGRESS_NOT_CONNECTED');if(!/adaptiveRoutePlannerService/.test(orch)||!/domainRouterService/.test(orch)||!/taskBlackboardService/.test(orch))failures.push('CORE_ORCHESTRATOR_INCOMPLETE');
const report={version:29,passed:failures.length===0,domainCount:domains.length,failures,policy:'core plans and collects; 17 specialist domains execute; active local generative runtime is unavailable'};fs.writeFileSync(path.join(root,'ARCHITECTURE_CONVERGENCE_V29.json'),JSON.stringify(report,null,2));if(failures.length){console.error(JSON.stringify(report,null,2));process.exit(1)}console.log(JSON.stringify(report,null,2));
