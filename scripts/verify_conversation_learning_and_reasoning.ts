import { conversationCoreService } from '../src/miki/safety/services/conversationCoreService';
import { claimDatabaseService } from '../src/miki/memory/services/claimDatabaseService';
import { mikiUnifiedLearningContinuumService } from '../src/miki/learning/services/mikiUnifiedLearningContinuumService';
import { mikiReasoningTemplateService } from '../src/miki/selfAwareness/services/mikiReasoningTemplateService';
import { mikiConversationLearningService } from '../src/miki/learning/services/mikiConversationLearningService';
import { defaultConversationState } from '../src/miki/conversation/services/conversationStateService';

async function runVerification() {
  console.log('=== [みき自律学習・推論昇格統合検証] 開始 ===');

  // 初期化
  mikiUnifiedLearningContinuumService.initialize();

  // ----------------------------------------------------
  // テスト1: ユーザー教示検知とCANDIDATE主張の登録
  // ----------------------------------------------------
  console.log('\n--- 1. ユーザー教示検知 (User Teaching) テスト ---');
  let state = defaultConversationState();

  const teachPrompt = '正解は「IndexedDBが使えない場合はメモリフォールバックを使用する」だよ';
  const teachResult = await conversationCoreService.execute({
    prompt: teachPrompt,
    conversationState: state,
  });

  console.log('Teach Result Status:', teachResult.status);
  console.log('Teach Result Reason:', teachResult.reason);
  console.log('Reply Text:', teachResult.replyText.slice(0, 100));

  if (teachResult.status !== 'RESOLVED' || !teachResult.reason.includes('user_teaching_recorded')) {
    throw new Error(`教示検知が正しく動作していません: ${teachResult.reason}`);
  }

  state = teachResult.nextConversationState;
  const candidateClaimId = state.lastCandidateClaimId;
  console.log('Registered Candidate Claim ID:', candidateClaimId);

  if (!candidateClaimId) {
    throw new Error('候補Claim IDが保存されていません');
  }

  const registeredClaim = claimDatabaseService.listClaims({ status: 'CANDIDATE' }).find(
    (c) => c.claim_id === candidateClaimId
  );
  if (!registeredClaim) {
    throw new Error('ClaimDatabaseService内にCANDIDATE主張が存在しません');
  }
  console.log('Candidate Claim Status:', registeredClaim.status);
  console.log('Candidate Claim Statement:', registeredClaim.statement);

  // ----------------------------------------------------
  // テスト2: 1回の言及では昇格しないことの検証（防壁）
  // ----------------------------------------------------
  console.log('\n--- 2. 1回目言及での昇格阻止（防壁）テスト ---');
  const promoCheck1 = mikiConversationLearningService.evaluateCandidatePromotion(candidateClaimId);
  console.log('1回目昇格判定 eligible:', promoCheck1.eligible, '| 理由:', promoCheck1.reason);
  if (promoCheck1.eligible) {
    throw new Error('1回目の言及で昇格してしまっています（客観基準違反）');
  }

  // ----------------------------------------------------
  // テスト3: ユーザーの肯定だけでは外部事実へ昇格しないことの検証
  // ----------------------------------------------------
  console.log('\n--- 3. ユーザーの肯定だけでの昇格阻止テスト ---');
  const affirmPrompt = 'ありがとう！まさにその通り、助かったよ';
  const affirmResult = await conversationCoreService.execute({
    prompt: affirmPrompt,
    conversationState: state,
  });

  console.log('Affirm Result Status:', affirmResult.status);
  const updatedClaim = claimDatabaseService.listClaims({ excludeSuperseded: true }).find(
    (c) => c.claim_id === candidateClaimId
  );
  console.log('Claim Status after affirmation:', updatedClaim?.status);
  console.log('Claim Source:', updatedClaim?.source);
  const promoCheck2 = mikiConversationLearningService.evaluateCandidatePromotion(candidateClaimId);
  console.log('2回目の昇格判定 eligible:', promoCheck2.eligible, '| 理由:', promoCheck2.reason);

  if (updatedClaim?.status !== 'CANDIDATE' || updatedClaim?.source !== 'USER_CLAIM') {
    throw new Error(`独立検証前のUSER_CLAIMが候補状態を維持していません: status=${updatedClaim?.status}, source=${updatedClaim?.source}`);
  }
  if (promoCheck2.eligible || promoCheck2.reason !== 'USER_CLAIM_REQUIRES_INDEPENDENT_VERIFICATION') {
    throw new Error(`独立検証前のUSER_CLAIMに対する昇格ガードが機能していません: ${promoCheck2.reason}`);
  }

  // ----------------------------------------------------
  // テスト4: 多軸比較推論テンプレートの適用検証
  // ----------------------------------------------------
  console.log('\n--- 4. 多軸比較推論 (Reasoning Template: Comparison) テスト ---');
  const compPrompt = 'ループ処理と配列一括処理を比較して';
  state = defaultConversationState();
  const compResult = await conversationCoreService.execute({
    prompt: compPrompt,
    conversationState: state,
  });

  console.log('Comparison Result Status:', compResult.status);
  console.log('Comparison Result Reason:', compResult.reason);
  console.log('Matched Claims Count:', compResult.matchedClaimsCount);
  console.log('Comparison Reply:', compResult.replyText);

  if (compResult.status !== 'RESOLVED' || !compResult.reason.includes('reasoning:comparison')) {
    throw new Error(`多軸比較推論が適用されていません: ${compResult.reason}`);
  }
  if (compResult.matchedClaimsCount < 2) {
    throw new Error(`比較推論で2件以上のClaimが統合されていません: ${compResult.matchedClaimsCount}`);
  }

  // ----------------------------------------------------
  // テスト5: 推論後のユーザー肯定反応による推論テンプレートの学習観測
  // ----------------------------------------------------
  console.log('\n--- 5. 推論後のユーザー評価観測テスト ---');
  state = compResult.nextConversationState;
  const feedbackPrompt = 'わかりやすい比較ありがとう！完璧です';
  const feedbackResult = await conversationCoreService.execute({
    prompt: feedbackPrompt,
    conversationState: state,
  });

  const templateProfile = mikiUnifiedLearningContinuumService.getProfile('reasoning:comparison');
  console.log('Template Profile after affirmation:', templateProfile);

  if (!templateProfile || templateProfile.successes < 1) {
    throw new Error('推論テンプレートの成功がContinuumに観測されていません');
  }

  // ----------------------------------------------------
  // テスト6: 因果推論テンプレートの適用検証
  // ----------------------------------------------------
  console.log('\n--- 6. 因果連鎖推論 (Reasoning Template: Causality) テスト ---');
  const causePrompt = 'Excelでセルを1つずつ代入すると低下する原因と対策はどうして？';
  state = defaultConversationState();
  const causeResult = await conversationCoreService.execute({
    prompt: causePrompt,
    conversationState: state,
  });

  console.log('Causality Result Status:', causeResult.status);
  console.log('Causality Result Reason:', causeResult.reason);
  console.log('Causality Reply:', causeResult.replyText);

  if (causeResult.status !== 'RESOLVED') {
    throw new Error(`因果推論が解決されていません: ${causeResult.status} / ${causeResult.reason}`);
  }

  console.log('\n🎉 === すべての検証項目が正常に合格しました ===');
  process.exit(0);
}

runVerification().catch((err) => {
  console.error('❌ 検証失敗:', err);
  process.exit(1);
});
