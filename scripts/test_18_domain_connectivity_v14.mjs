import fs from 'node:fs';
import path from 'node:path';
const root=process.cwd();
const domains=['core','autonomy','capability','conversation','data','execution','experience','improvement','learning','memory','promotion','research','safety','selfAwareness','selfDevelopment','strategy','unknown','verification'];
const participation=fs.readFileSync(path.join(root,'src/miki/core/services/domainParticipationService.ts'),'utf8');
const bootstrap=fs.readFileSync(path.join(root,'src/miki/core/services/domainIntegrationBootstrapService.ts'),'utf8');
const failures=[];

const orchestrator=fs.readFileSync(path.join(root,'src/miki/core/services/adaptiveWorkflowOrchestratorService.ts'),'utf8');
if(orchestrator.includes('collectDomainParticipation'))failures.push('normal workflow must not force all-domain participation');
if(orchestrator.includes("'PARTICIPATE'"))failures.push('PARTICIPATE must remain diagnostics-only');
if(participation.includes('suggestedNextDomains'))failures.push('domain diagnostics must not choose the next domain');
if(!participation.includes('diagnosticResponsibility'))failures.push('diagnostic responsibility contract missing');

for(const domain of domains){if(!participation.includes(`${domain}: {`))failures.push(`missing participation rule: ${domain}`);}
if(!bootstrap.includes("'PARTICIPATE'"))failures.push('PARTICIPATE command not registered');
if(!bootstrap.includes('domainParticipationService.assess(domain,envelope.payload)'))failures.push('PARTICIPATE handler not wired');
if(!bootstrap.includes('await domainParticipationService.auditAll()'))failures.push('startup audit not wired');
if(!bootstrap.includes('DOMAIN_CONNECTIVITY_AUDIT_FAILED'))failures.push('fail-closed missing');
if(!participation.includes('healthAccepted: health.accepted'))failures.push('health result not observed');
if(!participation.includes('participationAccepted: participation.accepted'))failures.push('participation result not observed');
if(failures.length){console.error(failures.join('\n'));process.exit(1);}
console.log(`PASS 18 domain connectivity contract (${domains.length} domains)`);
