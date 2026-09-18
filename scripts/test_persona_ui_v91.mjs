import fs from 'node:fs';
const read = p => fs.readFileSync(p, 'utf8');
const checks = [
  ['canonical profile service', read('src/miki/conversation/services/personaProfileService.ts').includes('miki_persona_profile_v1')],
  ['legacy migration', read('src/miki/conversation/services/personaProfileService.ts').includes('migrateLegacy')],
  ['single profile revision', read('src/miki/conversation/services/personaProfileService.ts').includes('revision: current.revision + 1')],
  ['surface-only derivation', read('src/miki/conversation/services/personaProfileService.ts').includes('deriveCommunicationStyle')],
  ['typed gateway', read('src/miki/core/ui/typedPersonaUiGatewayService.ts').includes('coreTaskIngressService.submit')],
  ['settings panel', read('src/components/PersonaSettingsPanel.tsx').includes('会話・人格')],
  ['name personality avatar', ['profile.name','profile.personalityText','profile.avatarId'].every(x=>read('src/components/PersonaSettingsPanel.tsx').includes(x))],
  ['four previews', ['preview.short','preview.technical','preview.correction','preview.unknown'].every(x=>read('src/components/PersonaSettingsPanel.tsx').includes(x))],
  ['settings route integration', read('src/components/ExternalConnectionsScreen.tsx').includes('<PersonaSettingsPanel/>')],
  ['48dp actions', read('src/components/PersonaSettingsPanel.tsx').includes('min-h-12')],
  ['fact safety boundary stated', read('src/components/PersonaSettingsPanel.tsx').includes('事実判定、安全、Evidence、coreの権限は変更しません')],
  ['github actions retained', fs.existsSync('.github/workflows/build-apk.yml')],
  ['gradle wrapper retained', fs.existsSync('android/gradle/wrapper/gradle-wrapper.jar')],
];
let failed=0;
for (const [name,ok] of checks){console.log(`${ok?'PASS':'FAIL'} ${name}`);if(!ok)failed++;}
console.log(`TOTAL ${checks.length-failed}/${checks.length}`);
process.exit(failed?1:0);
