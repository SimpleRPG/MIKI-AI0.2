import fs from 'fs';
const service = fs.readFileSync('src/services/verifiedCapabilityPromotionService.ts','utf8');
const graph = fs.readFileSync('src/services/capabilityGraphService.ts','utf8');
const core = fs.readFileSync('src/services/nonLlmCoreService.ts','utf8');
const server = fs.readFileSync('server.ts','utf8');
const checks = [
  ['service exists', service.includes('export class VerifiedCapabilityPromotionService')],
  ['no eval', !service.includes('eval(') && !service.includes('new Function')],
  ['verified gate', service.includes("['SUPPORTED', 'DEVICE_VERIFIED']")],
  ['maturity transfer', service.includes("'TRANSFERRED'")],
  ['graph ranking wired', graph.includes('verifiedCapabilityPromotionService.rank')],
  ['core promotion wired', core.includes('verifiedCapabilityPromotionService.promote')],
  ['api list', server.includes('/api/miki/verified-capabilities')],
  ['api relevant', server.includes('/api/miki/verified-capabilities/relevant')],
];
for (const [name, ok] of checks) { console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`); if (!ok) process.exitCode=1; }
if (!service.includes('component') || !service.includes('Component')) console.log('PASS component promotion separation');
