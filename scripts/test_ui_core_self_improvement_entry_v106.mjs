import fs from 'node:fs';
const source=fs.readFileSync('src/miki/core/ui/typedImprovementUiGatewayService.ts','utf8');
const required=['START_SPECIFIED_IMPROVEMENT','DISCOVER_IMPROVEMENT_TARGET','RESUME_IMPROVEMENT_TASK','coreTaskIngressService.submit','coreTaskIngressService.resume',"kind:'SELF_IMPROVEMENT'",'operationInstanceId','planRevision','currentStage','nextStage','stopReason','unresolved','entry:\'TYPED_IMPROVEMENT_UI_GATEWAY\''];
const missing=required.filter(token=>!source.includes(token));if(missing.length){console.error(`typed UI core entry missing: ${missing.join(',')}`);process.exit(1);}
for(const method of ['startSpecifiedImprovement','discoverImprovementTarget','resumeImprovementTask'])if(!source.includes(method)){console.error(`missing UI command: ${method}`);process.exit(1);}
console.log('PASS UI core self improvement entry v106');
