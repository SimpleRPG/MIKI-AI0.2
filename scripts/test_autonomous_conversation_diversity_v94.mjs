import fs from 'node:fs';
const runtime = fs.readFileSync('src/miki/conversation/services/runtimeConversationCompositionService.ts','utf8');
const div = fs.readFileSync('src/miki/conversation/services/conversationSurfaceDiversityService.ts','utf8');
const checks = [
 ['diversity service', div.includes('class ConversationSurfaceDiversityService')],
 ['bounded history', div.includes('MAX_HISTORY = 24')],
 ['exact repetition', div.includes('exactRecentMatch')],
 ['opening repetition', div.includes('repeatedOpening')],
 ['ending repetition', div.includes('repeatedEnding')],
 ['canonical signature', div.includes('canonicalSha256')],
 ['runtime assessment', runtime.includes('conversationSurfaceDiversityService.assess')],
 ['runtime record', runtime.includes('conversationSurfaceDiversityService.record')],
 ['score penalty', runtime.includes('candidate.repetitionScore * 180')],
 ['result lineage', runtime.includes('selectedSurfaceSignature') && runtime.includes('repetitionAvoided')],
];
let failed=0; for (const [name, ok] of checks) { console.log(`${ok?'PASS':'FAIL'} ${name}`); if(!ok) failed++; }
process.exitCode=failed?1:0;
