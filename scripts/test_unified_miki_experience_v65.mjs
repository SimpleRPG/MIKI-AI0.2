import fs from 'node:fs';
import assert from 'node:assert/strict';

const core = fs.readFileSync('src/services/nonLlmCoreService.ts','utf8');
const unified = fs.readFileSync('src/services/unifiedMikiExperienceService.ts','utf8');
const server = fs.readFileSync('server.ts','utf8');
const agenda = fs.readFileSync('src/services/workingAgendaService.ts','utf8');
assert.match(core, /unifiedMikiExperienceService/);
assert.match(server, /unifiedMikiExperienceService\.observeRpg/);
assert.match(server, /\/api\/miki\/unified-experience\/state/);
assert.match(unified, /observeConversation/);
assert.match(unified, /observeRpg/);
assert.match(unified, /rankDomains/);
assert.doesNotMatch(unified, /Math\.random\s*\(/);
assert.doesNotMatch(unified, /\beval\s*\(/);
assert.doesNotMatch(unified, /new\s+Function\s*\(/);
assert.doesNotMatch(agenda, /Math\.random\s*\(/);
console.log('PASS: unified Miki experience boundary');
