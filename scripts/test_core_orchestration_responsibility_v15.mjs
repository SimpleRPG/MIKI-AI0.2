import fs from 'node:fs';
const read=p=>fs.readFileSync(p,'utf8');
const orchestrator=read('src/miki/core/services/coreOrchestratorService.ts');
const planner=read('src/miki/core/services/adaptiveRoutePlannerService.ts');
const participation=read('src/miki/core/services/domainParticipationService.ts');
const bootstrap=read('src/miki/core/services/domainIntegrationBootstrapService.ts');
const failures=[];
if(!orchestrator.includes('adaptiveRoutePlannerService.plan(current)'))failures.push('core route planner is not authoritative');
if(orchestrator.includes('collectDomainParticipation'))failures.push('normal tasks still force all domains');
if(orchestrator.includes("'PARTICIPATE'"))failures.push('diagnostic command leaked into normal workflow');
if(participation.includes('suggestedNextDomains'))failures.push('domain diagnostic chooses next route');
if(!bootstrap.includes('await domainParticipationService.auditAll()'))failures.push('startup diagnostics removed');
if(!planner.includes('routes.push'))failures.push('core route decisions missing');
if(failures.length){console.error(failures.join('\n'));process.exit(1);}
console.log('PASS core orchestration responsibility v15');
