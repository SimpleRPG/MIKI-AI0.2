import fs from 'node:fs';
const root = new URL('../', import.meta.url);
const read = path => fs.readFileSync(new URL(path, root), 'utf8');
const feedback = read('src/miki/conversation/services/conversationFeedbackEvidenceService.ts');
const composition = read('src/miki/conversation/services/conversationComponentCompositionService.ts');
const checks = [
  ['correction parsing', feedback, /replacementText/],
  ['unknown vocabulary', feedback, /unknownTerms/],
  ['claim support', feedback, /supportingClaimIds/],
  ['claim conflict', feedback, /conflictingClaimIds/],
  ['user not sole authority', feedback, /epistemicStatus !== 'CONFLICTED'/],
  ['single feedback no verify', composition, /independentContexts >= 3/],
  ['scoped revision', composition, /negativeScopes/],
  ['no immediate rejection', composition, /NEEDS_REVISION/],
];
const failures = checks.filter(([, text, pattern]) => !pattern.test(text));
if (failures.length) { for (const [name] of failures) console.error(`FAIL ${name}`); process.exit(1); }
console.log('Epistemic conversation feedback integration PASS');
