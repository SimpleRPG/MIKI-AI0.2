import fs from 'node:fs';
const read=(p)=>fs.readFileSync(p,'utf8');
const catalog=read('src/miki/core/services/domainCatalogService.ts');
const bootstrap=read('src/miki/core/services/domainIntegrationBootstrapService.ts');
const router=read('src/miki/core/services/domainRouterService.ts');
const core=read('src/miki/core/services/coreOrchestratorService.ts');
const domains=['core','autonomy','capability','conversation','data','execution','experience','improvement','learning','memory','promotion','research','safety','selfAwareness','selfDevelopment','strategy','unknown','verification'];
const checks={all18Declared:domains.every((d)=>catalog.includes(`'${d}'`)),catalogIsCanonical:catalog.includes('MIKI_DOMAINS'),bootstrapRegistersCatalog:bootstrap.includes('MIKI_DOMAINS')&&bootstrap.includes('domainRouterService.register'),auditAfterRegistration:bootstrap.indexOf('domainRouterService.register')<bootstrap.indexOf('domainParticipationService.auditAll()'),failClosed:bootstrap.includes('DOMAIN_CONNECTIVITY_AUDIT_FAILED'),depthGuard:router.includes('MAX_DEPTH'),coreOwnsBlackboard:core.includes('taskBlackboardService.get'),coreOwnsRouting:core.includes('adaptiveRoutePlannerService'),coreCollectsReplies:core.includes('domainRouterService.dispatch')};
const passed=Object.values(checks).every(Boolean);const result={version:'v63-current-architecture',passed,checks};fs.writeFileSync('DOMAIN_CONNECTION_AUDIT_V16.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));if(!passed)process.exitCode=1;
