/**
 * 作業指示書 v15 検証スクリプト
 * 
 * 検証内容:
 * 1. ConversationState に lastFalsificationPassed / lastFalsificationScore が存在すること
 * 2. ユーザーの反応が中立で、lastFalsificationPassed === false の場合に outcome が 'FAILURE' になること
 *    (Mikiが自分で矛盾を検知した場合、ユーザーの沈黙を成功と解釈しない)
 * 3. ユーザーの反応が中立で、lastFalsificationPassed === true の場合は通常通り 'SUCCESS' になること
 * 4. ユーザーが訂正した場合に 'FAILURE' になること
 */

import { mikiConversationLearningService } from '../src/miki/learning/services/mikiConversationLearningService';
import { ConversationState } from '../src/types';

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`✅ PASS: ${message}`);
  } else {
    console.error(`❌ FAIL: ${message}`);
    process.exitCode = 1;
  }
}

async function runVerification() {
  console.log('=== [v15 Verification] 内的自己反証スコア学習接続テスト ===\n');

  // ケース1: ユーザーの反応が中立 (沈黙・「なるほど」)、直前の内的自己反証が不合格 (passed === false)
  const stateFalsificationFailed: ConversationState = {
    currentTopic: 'Excel VBA高速化',
    topLevelGoal: 'VBAマクロ作成',
    stage: 'QUESTION',
    confirmedFacts: [],
    corrections: [],
    invalidatedAssumptions: [],
    pendingQuestions: [],
    expectedResponseLength: 'standard',
    updatedAt: Date.now(),
    lastResultStatus: 'RESOLVED',
    lastPrompt: 'VBAでセルを1行ずつコピーする方法を教えて',
    lastDialogueAct: 'REQUEST_ARTIFACT',
    lastTopic: 'Excel VBA高速化',
    lastReasoningTemplateId: 'template_vba_batch_process',
    lastFalsificationPassed: false, // 矛盾・エッジケース破綻を自己検知
    lastFalsificationScore: 42,
  };

  const neutralUserPrompt = 'なるほど、わかりました。';
  const result1 = mikiConversationLearningService.evaluatePreviousTurn(neutralUserPrompt, stateFalsificationFailed);

  console.log('[ケース1: ユーザー中立 + 自己反証不合格]');
  console.log(`  outcome: ${result1.outcome}`);
  console.log(`  verified: ${result1.verified}`);
  console.log(`  reason: ${result1.reason}\n`);

  assert(result1.outcome === 'FAILURE', '自己反証不合格時、中立発話でも outcome が FAILURE になること');
  assert(result1.verified === false, '自己反証不合格時、verified が false になること');
  assert(result1.reason.includes('FALSIFICATION_FAILED'), '自己反証不合格の理由が記録されていること');

  // ケース2: ユーザーの反応が中立、直前の内的自己反証が合格 (passed === true)
  const stateFalsificationPassed: ConversationState = {
    ...stateFalsificationFailed,
    lastFalsificationPassed: true,
    lastFalsificationScore: 95,
  };

  const result2 = mikiConversationLearningService.evaluatePreviousTurn(neutralUserPrompt, stateFalsificationPassed);

  console.log('[ケース2: ユーザー中立 + 自己反証合格]');
  console.log(`  outcome: ${result2.outcome}`);
  console.log(`  verified: ${result2.verified}`);
  console.log(`  reason: ${result2.reason}\n`);

  assert(result2.outcome === 'SUCCESS', '自己反証合格時、中立発話で outcome が SUCCESS になること');

  // ケース3: ユーザーが明示的に訂正した場合
  const correctionPrompt = 'いや、それだとエラーになるよ。間違ってる';
  const result3 = mikiConversationLearningService.evaluatePreviousTurn(correctionPrompt, stateFalsificationPassed);

  console.log('[ケース3: ユーザー訂正]');
  console.log(`  outcome: ${result3.outcome}`);
  console.log(`  verified: ${result3.verified}`);
  console.log(`  reason: ${result3.reason}\n`);

  assert(result3.outcome === 'FAILURE', 'ユーザー訂正時は outcome が FAILURE になること');

  console.log('=== [v15 Verification] 検証完了 ===\n');
}

runVerification().catch((err) => {
  console.error('Test execution error:', err);
  process.exit(1);
});
