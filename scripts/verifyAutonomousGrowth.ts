import { answerPlanService } from '../src/services/answerPlanService';
import { surfaceVariationGrowthService } from '../src/services/surfaceVariationGrowthService';
import { surfaceVariationService } from '../src/services/surfaceVariationService';

function runTests() {
  console.log('================================================================');
  console.log('🧪 Miki AI 縦(骨格)・横(言い回し) 自律成長パイプライン検証テスト');
  console.log('================================================================\n');

  let passedAll = true;

  // -------------------------------------------------------------
  // テスト 1: 縦の成長 (ResponseSkeleton 自律成長と 3回観測強制ルール)
  // -------------------------------------------------------------
  console.log('--- テスト 1: 縦の成長 (骨格候補登録 & 3回観測でのVERIFIED昇格) ---');
  
  const testInstruction = 'テスト指示: ユーザーのカスタム条件に基づく特別な例外処理手順を構築する';
  
  // 1回目観測 -> CANDIDATE
  const c1 = answerPlanService.registerSkeletonCandidate({
    instruction: testInstruction,
    sourceType: 'UNRESOLVED_CONVERSATION',
  });
  console.log(`[1回目観測] ID: ${c1.pattern_id}, status: ${c1.status}, observedCount: ${c1.observedCount}`);
  if (c1.status !== 'CANDIDATE' || c1.observedCount !== 1) {
    console.error('❌ FAIL: 1回目は CANDIDATE かつ observedCount=1 であるべきです');
    passedAll = false;
  } else {
    console.log('✅ PASS: 初回は正しく CANDIDATE (観測回数: 1) として登録されました');
  }

  // 実会話マッチングからの除外検証
  const matchCandidate = answerPlanService.matchSkeleton('テスト指示: ユーザーのカスタム条件に基づく特別な例外処理手順');
  const usedCandidate = matchCandidate.skeleton?.pattern_id === c1.pattern_id;
  if (usedCandidate) {
    console.error('❌ FAIL: CANDIDATE 状態の骨格が matchSkeleton で適用されてしまいました');
    passedAll = false;
  } else {
    console.log('✅ PASS: CANDIDATE 状態の骨格は matchSkeleton で安全に除外されています');
  }

  // 2回目観測 -> CANDIDATE維持
  const c2 = answerPlanService.registerSkeletonCandidate({
    instruction: testInstruction,
    sourceType: 'UNRESOLVED_CONVERSATION',
  });
  console.log(`[2回目観測] ID: ${c2.pattern_id}, status: ${c2.status}, observedCount: ${c2.observedCount}`);
  if (c2.status !== 'CANDIDATE' || c2.observedCount !== 2) {
    console.error('❌ FAIL: 2回目は CANDIDATE を維持し observedCount=2 であるべきです');
    passedAll = false;
  } else {
    console.log('✅ PASS: 2回目は CANDIDATE を維持 (観測回数: 2)');
  }

  // 3回目観測 -> VERIFIED昇格
  const c3 = answerPlanService.registerSkeletonCandidate({
    instruction: testInstruction,
    sourceType: 'UNRESOLVED_CONVERSATION',
  });
  console.log(`[3回目観測] ID: ${c3.pattern_id}, status: ${c3.status}, observedCount: ${c3.observedCount}`);
  if (c3.status !== 'VERIFIED' || c3.observedCount !== 3) {
    console.error('❌ FAIL: 3回目で VERIFIED に昇格するべきです');
    passedAll = false;
  } else {
    console.log('✅ PASS: 3回目の観測により正式に VERIFIED へ昇格しました！');
  }

  // -------------------------------------------------------------
  // テスト 2: 横の成長 (表層バリエーションの検証と安全弁)
  // -------------------------------------------------------------
  console.log('\n--- テスト 2: 横の成長 (表層バリエーションの意味保持・文法検査・安全弁) ---');

  const seed = '確認した内容を順序立ててお伝えするね。';

  // 2.1 正常な同義変種 (PASS検証)
  const validCandidate = '確認できた要点を順序立てて説明するね。';
  const validCheck = surfaceVariationGrowthService.verifyCandidate(seed, validCandidate);
  console.log(`[正常変種] 「${validCandidate}」 => passed: ${validCheck.passed}`);
  if (!validCheck.passed) {
    console.error(`❌ FAIL: 正常な変種が拒否されました: ${validCheck.rejectionReason}`);
    passedAll = false;
  } else {
    console.log('✅ PASS: 正常な同義表現は意味保持・文法検査を通過しました');
  }

  // 2.2 意味破綻 (否定脱落プローブ: REJECT検証)
  const negSeed = '古い前提は残さないように注意するね。';
  const defectNegationCandidate = '古い前提は残すように注意するね。';
  const negCheck = surfaceVariationGrowthService.verifyCandidate(negSeed, defectNegationCandidate);
  console.log(`[否定脱落プローブ] 「${defectNegationCandidate}」 => passed: ${negCheck.passed}, reason: ${negCheck.rejectionReason}`);
  if (negCheck.passed) {
    console.error('❌ FAIL: 否定が反転・脱落した候補が通過してしまいました！');
    passedAll = false;
  } else {
    console.log('✅ PASS: 否定が反転した欠陥候補は正しくブロック・破棄されました');
  }

  // 2.3 根拠なき確実性誇張 (REJECT検証)
  const nonCertainSeed = '状況に応じて最適な方法を検討するよ。';
  const exaggeratedCandidate = '絶対に100%確実に最適な方法を検討するよ。';
  const exagCheck = surfaceVariationGrowthService.verifyCandidate(nonCertainSeed, exaggeratedCandidate);
  console.log(`[確実性誇張プローブ] 「${exaggeratedCandidate}」 => passed: ${exagCheck.passed}, reason: ${exagCheck.rejectionReason}`);
  if (exagCheck.passed) {
    console.error('❌ FAIL: 根拠なき100%誇張候補が通過してしまいました！');
    passedAll = false;
  } else {
    console.log('✅ PASS: 根拠なき断定誇張候補は正しくブロック・破棄されました');
  }

  // 2.4 文法・助詞破綻 (REJECT検証)
  const brokenGrammarCandidate = '確認した内容を順序立ててのがお伝えするね。';
  const brokenCheck = surfaceVariationGrowthService.verifyCandidate(seed, brokenGrammarCandidate);
  console.log(`[助詞破綻プローブ] 「${brokenGrammarCandidate}」 => passed: ${brokenCheck.passed}, reason: ${brokenCheck.rejectionReason}`);
  if (brokenCheck.passed) {
    console.error('❌ FAIL: 助詞が破綻した候補が通過してしまいました！');
    passedAll = false;
  } else {
    console.log('✅ PASS: 助詞連続破綻の候補は正しくブロック・破棄されました');
  }

  // -------------------------------------------------------------
  // テスト 3: 自律サイクルの実行と昇格上限ガード (maxPromotions = 2)
  // -------------------------------------------------------------
  console.log('\n--- テスト 3: 横の自律サイクル実行 (上限ガード検証) ---');
  // 一部のカテゴリを使用頻度過多にして弱点を誘発
  surfaceVariationService.recordUsage('greeting_casual', 'GREET-01');
  surfaceVariationService.recordUsage('greeting_casual', 'GREET-01');
  surfaceVariationService.recordUsage('greeting_casual', 'GREET-01');

  const growthReport = surfaceVariationGrowthService.runAutonomousVariationGrowthCycle(2);
  console.log(`[自律サイクル実行結果] 生成: ${growthReport.totalGenerated}, 合格: ${growthReport.passedCount}, 破棄: ${growthReport.rejectedCount}, 昇格: ${growthReport.promotedCount}`);
  if (growthReport.promotedCount > 2) {
    console.error(`❌ FAIL: 1サイクルの昇格数が上限(2件)を超過しました: ${growthReport.promotedCount}`);
    passedAll = false;
  } else {
    console.log(`✅ PASS: 昇格上限ガード(maxPromotions=2)が正常に機能しています (昇格数: ${growthReport.promotedCount})`);
  }

  console.log('\n================================================================');
  if (passedAll) {
    console.log('🎉 全ての自律成長検証テストに合格しました！');
  } else {
    console.log('⚠️ 一部のテストで不合格が検出されました');
    process.exit(1);
  }
  console.log('================================================================');
}

runTests();
