import fs from 'fs';
const read=p=>fs.readFileSync(p,'utf8');
const checks=[];
const research=read('src/services/researchService.ts');
checks.push(['research bridges verified/admissible claims to KOS', research.includes('cognitiveEvidenceIntegrationService.ingestClaims(claimIds)')]);
const bridge=read('src/services/cognitiveEvidenceIntegrationService.ts');
checks.push(['KOS bridge rejects missing evidence', bridge.includes("if (!evidence.length) return undefined")]);
checks.push(['KOS bridge preserves claim status', bridge.includes('claimStatus: claim.status')]);
const causal=read('src/services/causalInvestigationService.ts');
checks.push(['causal low-impact test ordering', causal.includes("impact:i===0?'LOW':'MEDIUM'")]);
checks.push(['causal falsifier tracking', causal.includes('addFalsifier')]);
checks.push(['rejected hypotheses get zero weight', causal.includes("h.status='REJECTED'")]);
const server=read('server.ts');
checks.push(['KOS ingestion API', server.includes('/api/miki/knowledge-os/ingest-claims')]);
checks.push(['causal test-plan API', server.includes('/api/miki/causal/investigations/:id/tests')]);
let pass=0; for(const [n,ok] of checks){console.log(`${ok?'PASS':'FAIL'} ${n}`); if(ok)pass++;}
console.log(`RESULT ${pass}/${checks.length}`); if(pass!==checks.length) process.exit(1);
