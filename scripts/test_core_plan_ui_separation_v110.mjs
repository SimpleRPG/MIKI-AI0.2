import fs from 'node:fs';
const core=fs.readFileSync('src/miki/core/services/coreOrchestratorService.ts','utf8');
const gateway=fs.readFileSync('src/miki/core/ui/typedImprovementUiGatewayService.ts','utf8');
const ui=fs.readFileSync('src/components/AutonomousImprovementHome.tsx','utf8');
for(const token of ['corePlanRevisionService.latest(task)','taskRevision:task.revision','corePlanRevision:plan?.planRevision','currentOperationInstanceId','currentBusinessStage','nextOperationInstanceId'])if(!core.includes(token)){console.error(`core plan read model missing: ${token}`);process.exit(1);}
for(const token of ['taskRevision?:number','corePlanRevision?:number','currentOperationInstanceId?:string','currentBusinessStage?:string'])if(!gateway.includes(token)){console.error(`gateway plan contract missing: ${token}`);process.exit(1);}
if(gateway.includes('planRevision:result.task.revision')){console.error('task revision still masquerades as core plan revision');process.exit(1);}
for(const token of ['Task revision:','Core Plan revision:','Business stage:','Next operation:'])if(!ui.includes(token)){console.error(`UI plan display missing: ${token}`);process.exit(1);}
console.log('PASS core plan UI separation v110');
