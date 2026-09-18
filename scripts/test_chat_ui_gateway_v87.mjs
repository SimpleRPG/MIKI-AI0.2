import fs from 'node:fs';

const chat = fs.readFileSync('src/components/ChatPanel.tsx', 'utf8');
const gateway = fs.readFileSync('src/miki/core/ui/typedChatUiGatewayService.ts', 'utf8');
const checks = [
  ['ChatPanel uses typed chat gateway', chat.includes("from '../miki/core/ui/typedChatUiGatewayService'")],
  ['No direct domain service imports in ChatPanel', !/from ['"]\.\.\/miki\/(conversation|improvement|capability|verification|execution|experience|autonomy|selfDevelopment|learning|selfAwareness|strategy)\/services\//.test(chat)],
  ['No legacy systemLogger import in ChatPanel', !chat.includes("from '../services/systemLogger'")],
  ['Gateway exposes speech recognition', gateway.includes('speechRecognitionService')],
  ['Gateway exposes workflow execution', gateway.includes('workflowSynthesisService')],
  ['Gateway exposes completion verification', gateway.includes('completionJudgeService')],
  ['Gateway exposes feedback governance', gateway.includes('userFeedbackGovernanceService')],
  ['Gateway exposes conversation state tools', gateway.includes('conversationBranchService') && gateway.includes('conversationTaskboardService')],
  ['GitHub Actions retained', fs.existsSync('.github/workflows/build-apk.yml')],
  ['Gradle wrapper retained', fs.existsSync('android/gradle/wrapper/gradle-wrapper.jar')],
];
let failed=0;
for (const [name, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`);
  if (!ok) failed += 1;
}
if (failed) process.exit(1);
