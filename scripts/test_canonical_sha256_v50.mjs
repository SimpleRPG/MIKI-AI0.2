import fs from 'node:fs';
const sha=fs.readFileSync('src/miki/core/services/canonicalSha256Service.ts','utf8');
const plan=fs.readFileSync('src/miki/core/services/corePlanRevisionService.ts','utf8');
const assessment=fs.readFileSync('src/miki/improvement/services/improvementAssessmentService.ts','utf8');
const planner=fs.readFileSync('src/miki/core/services/adaptiveRoutePlannerService.ts','utf8');
const checks={shaConstants:sha.includes('0x428a2f98')&&sha.includes('0xc67178f2'),shaPadding:sha.includes('bytes.push(0x80)'),shaOutput64:sha.includes("padStart(8,'0')"),canonicalKeys:sha.includes(".sort(([left], [right]) => left.localeCompare(right))"),planUsesCanonicalSha:plan.includes("return canonicalSha256(value)"),noFnv:!plan.includes('fnv1a32'),proposalShaField:assessment.includes('proposalSha256: string'),proposalHashCalculated:assessment.includes('proposal.proposalSha256 = canonicalSha256'),plannerRequires64Hex:planner.includes("/^[a-f0-9]{64}$/.test(proposalSha256)"),proposalHashForwarded:planner.includes('proposalSha256,priority')};
const passed=Object.values(checks).every(Boolean);fs.writeFileSync('CANONICAL_SHA256_V50.json',JSON.stringify({version:'v50',passed,checks},null,2)+'\n');console.log(JSON.stringify({version:'v50',passed,checks},null,2));if(!passed)process.exitCode=1;
