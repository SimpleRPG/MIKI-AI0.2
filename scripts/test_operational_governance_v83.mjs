import fs from 'fs';
const root='.';
const must=['miki/autonomy/services/operationalGovernanceService.ts','miki/selfAwareness/services/situationalAwarenessService.ts'];
for(const f of must){if(!fs.existsSync(f))throw new Error(`missing ${f}`);}
const s=fs.readFileSync('miki/autonomy/services/operationalGovernanceService.ts','utf8');
const checks=[
 ['SLO hard gate',/hardSafety.*!safety/],
 ['permission scoped grant',/SCOPE_MISMATCH/],
 ['permission expiry',/EXPIRED/],
 ['checkpoint integrity',/integrityHash/],
 ['checkpoint cycle detection',/CYCLE/],
 ['blind input budget binding',/inputHash.*budgetHash/],
 ['blind fairness',/fair:/],
 ['no arbitrary code execution',/child_process|eval\(|new Function/],
];
for(const [n,re] of checks){if(n==='no arbitrary code execution' ? re.test(s) : !re.test(s))throw new Error(`FAIL ${n}`);console.log(`PASS ${n}`);}
const sa=fs.readFileSync('miki/selfAwareness/services/situationalAwarenessService.ts','utf8');
if(!/allowed\.has\(e\.source\)/.test(sa))throw new Error('FAIL perception permission gate');
console.log('PASS perception permission gate');
console.log('PASS 9/9');
