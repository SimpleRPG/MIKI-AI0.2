import fs from 'node:fs';
const runtime = fs.readFileSync('src/miki/conversation/services/runtimeConversationCompositionService.ts', 'utf8');
const persona = fs.readFileSync('src/miki/conversation/services/personaProfileService.ts', 'utf8');
const checks = [
  ['runtime imports persona profile', runtime.includes('personaProfileService')],
  ['runtime reads current profile', runtime.includes('const personaProfile = personaProfileService.get()')],
  ['runtime derives surface style', runtime.includes('deriveCommunicationStyle(personaProfile)')],
  ['persona revision participates in cache key', runtime.includes('personaProfile.revision') && runtime.includes('stableSignature')],
  ['surface renderer receives persona', runtime.includes('generateSurfaceTextFromIR(ir, skeleton, surfacePersona')],
  ['fallback renderer receives persona', runtime.includes('generateSurfaceTextFromIR(ir, primarySkeleton, surfacePersona')],
  ['result records persona lineage', runtime.includes('personaProfileId: personaProfile.profileId') && runtime.includes('personaRevision: personaProfile.revision')],
  ['judgment axes not derived', !runtime.includes('directness:') && !runtime.includes('prudence:') && !runtime.includes('proactiveSuggestion:')],
  ['persona derivation exists', persona.includes('deriveCommunicationStyle')],
  ['github workflow retained', fs.existsSync('.github/workflows/build-apk.yml')],
  ['gradle wrapper retained', fs.existsSync('android/gradle/wrapper/gradle-wrapper.jar')],
];
let failed = 0;
for (const [name, ok] of checks) { console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`); if (!ok) failed += 1; }
if (failed) process.exit(1);
