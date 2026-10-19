import fs from 'node:fs';
const runtime=fs.readFileSync('src/miki/selfDevelopment/services/durableJobWorkerRuntimeService.ts','utf8');
const worker=fs.readFileSync('src/miki/selfDevelopment/services/productionScaleWorkerService.ts','utf8');
const checks=[
  ['CANCELLED is a durable terminal state',/JobState\s*=.*'CANCELLING'\s*\|\s*'CANCELLED'\s*\|\s*'COMPLETED'/.test(runtime)],
  ['expired cancellation recovers as CANCELLED, not RETRYING',/job\.state==='CANCELLING'\?'CANCELLED':job\.attempt<job\.retryBudget\?'RETRYING'/.test(worker)],
  ['cancellation observed after awaited runtime execution',/const afterExecution=durableJobWorkerRuntimeService\.list\(\)\.find\(x=>x\.jobId===job\.jobId\);if\(afterExecution\?\.state==='CANCELLING'\)\{reasons\.push\('JOB_CANCELLED'\);break;\}/.test(worker)],
  ['cancelled jobs cannot be marked successful',/const passed=reasons\.length===0&&!cancelled&&current\?\.state==='RUNNING';/.test(worker)&&/if\(cancelled\)durableJobWorkerRuntimeService\.transition\(job\.jobId,'CANCELLED'\);else if\(current\?\.state==='RUNNING'\)durableJobWorkerRuntimeService\.transition\(job\.jobId,passed\?'COMPLETED'/.test(worker)],
  ['exception path preserves cancellation terminal state',/if\(current\?\.state==='CANCELLING'\)durableJobWorkerRuntimeService\.transition\(job\.jobId,'CANCELLED'\);else if\(current\?\.state==='RUNNING'\)/.test(worker)],
];
for(const [name,ok] of checks){if(!ok)throw new Error(`FAIL:${name}`);}
console.log(JSON.stringify({passed:true,checks:checks.length,results:checks.map(([name])=>name)},null,2));
