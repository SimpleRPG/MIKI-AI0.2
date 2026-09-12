import fs from 'fs';
const root='.';
const s=fs.readFileSync('src/services/cognitiveExecutionEvidenceService.ts','utf8');
const server=fs.readFileSync('server.ts','utf8');
const tests=[
 ['evidence service exists',s.includes('class CognitiveExecutionEvidenceService')],
 ['execution events subscribed',s.includes("execution.completed")&&s.includes("execution.failed")],
 ['evidence creates KOS object',s.includes("type:'EVIDENCE'")],
 ['experience continuum linked',s.includes('unifiedMikiExperienceService.observeExecution')],
 ['idempotent evidence',s.includes('existing = this.records.find')],
 ['api list',server.includes("/api/miki/execution-evidence")],
 ['startup wired',server.includes('cognitiveExecutionEvidenceService.initialize();')],
 ['manual ingest endpoint',server.includes("/api/miki/execution-evidence/ingest")],
];
let pass=0; for(const [n,ok] of tests){console.log(`${ok?'PASS':'FAIL'} ${n}`);if(ok)pass++;}
console.log(`${pass}/${tests.length} PASS`); if(pass!==tests.length)process.exit(1);
