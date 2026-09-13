/**
 * 作業指示書 v20 検証スクリプト
 * backgroundWorkerService.ts の Step 6.12.12 に配線された Web素材自律成長サイクルの検証
 *
 * 1. 禁止トピック判定の動作確認
 * 2. backgroundWorkerService.runAutonomousBackgroundCycle('manual') を実際に1サイクル実行
 * 3. 検索クエリ -> 取得件数 -> 禁止トピック除外 -> 意味保持検査 ->
 *    registerSkeletonFromWebObservation(WEB_OBSERVED) -> processWebMaterialForVariationGrowth(WEB_DERIVED) ->
 *    正式昇格 という一連の生ログを取得・提示
 */

import { backgroundWorkerService } from '../src/services/backgroundWorkerService';
import { bannedTopicsConfigService } from '../src/services/bannedTopicsConfigService';
import { autonomousSearchService } from '../src/services/autonomousSearchService';
import { answerPlanService } from '../src/services/answerPlanService';
import { surfaceVariationGrowthService } from '../src/services/surfaceVariationGrowthService';
import { systemLogger } from '../src/services/systemLogger';

async function main() {
  console.log('================================================================');
  console.log('🧪 作業指示書 v20: Step 6.12.12 Web検索自律学習素材の実配線 動作検証');
  console.log('================================================================');

  // 自律検索設定を有効化
  autonomousSearchService.updateConfig({
    enabled: true,
    idleSearchEnabled: true,
    allowFallbackMock: true,
    maxQueriesPerRun: 1,
  });

  // --- テスト 1: 禁止トピック除外機能の事前検証 ---
  console.log('\n--- テスト 1: 禁止トピック手動設定による事前除外検証 ---');
  bannedTopicsConfigService.addTopic('危険爆破手順テスト');
  const banTest = bannedTopicsConfigService.checkBanned('危険爆破手順テストの解説');
  console.log(`[禁止トピック判定結果] isBanned: ${banTest.isBanned}, matchedTopic: ${banTest.matchedTopic}`);
  if (banTest.isBanned) {
    console.log('✅ PASS: 禁止トピックに抵触するクエリ・素材の事前除外機能が正常です');
  } else {
    console.error('❌ FAIL: 禁止トピックが検知されませんでした');
    process.exit(1);
  }
  bannedTopicsConfigService.removeTopic('危険爆破手順テスト');

  // --- テスト 2: backgroundWorkerService の実サイクル実行 ---
  console.log('\n--- テスト 2: backgroundWorkerService.runAutonomousBackgroundCycle 1サイクル実行 ---');

  // ログ収集用リスナー
  const capturedLogs: Array<{ level: string; category: string; message: string; data?: any }> = [];
  const unsubscribe = systemLogger.subscribe((entry) => {
    capturedLogs.push(entry);
    // 関連ログを標準出力にストリーミング表示
    if (
      entry.message.includes('Web自律成長') ||
      entry.message.includes('Web素材') ||
      entry.message.includes('WEB_OBSERVED') ||
      entry.message.includes('WEB_DERIVED') ||
      entry.message.includes('意味保持検査') ||
      entry.message.includes('骨格候補') ||
      entry.message.includes('言い回し') ||
      entry.message.includes('禁止トピック')
    ) {
      console.log(`[生ログ: ${entry.category}] ${entry.message}`);
    }
  });

  try {
    const cycleResult = await backgroundWorkerService.runAutonomousBackgroundCycle('manual');
    console.log('\n✅ サイクル実行完了:', cycleResult.logId);
    console.log('検出・実施記録:', cycleResult.weaknessFound);
  } catch (err: any) {
    console.error('❌ サイクル実行エラー:', err);
    process.exit(1);
  } finally {
    unsubscribe();
  }

  // --- テスト 3: 収集された生ログの監査 ---
  console.log('\n--- テスト 3: 収集された生ログにおける必須要素の監査 ---');
  const webSearchLogs = capturedLogs.filter(
    (l) => l.message.includes('Web自律成長検索') || l.message.includes('Web素材取得件数')
  );
  const webResultLogs = capturedLogs.filter(
    (l) => l.message.includes('Web自律成長結果') || l.message.includes('WEB_OBSERVED') || l.message.includes('WEB_DERIVED')
  );

  console.log(`[監査] Web自律成長検索ログ件数: ${webSearchLogs.length}`);
  console.log(`[監査] 縦横素材還元結果ログ件数: ${webResultLogs.length}`);

  for (const log of webResultLogs) {
    console.log(`  -> ${log.message}`);
  }

  // 縦(WEB_OBSERVED)骨格の存在確認
  const allSkeletons = answerPlanService.getAllSkeletons();
  const webObservedSkeletons = allSkeletons.filter((s) => s.sourceType === 'WEB_OBSERVED');
  console.log(`[監査] 登録された WEB_OBSERVED 骨格候補数: ${webObservedSkeletons.length}`);
  for (const s of webObservedSkeletons.slice(0, 3)) {
    console.log(`  -> id:${s.pattern_id}, status:${s.status}, observedCount:${s.observedCount}, situation:${s.situation}`);
  }

  // 横(WEB_DERIVED)変種の監査ログ確認
  const allCandidates = surfaceVariationGrowthService.getCandidateRecords();
  const webDerivedCandidates = allCandidates.filter((c) => c.mutationType === 'WEB_DERIVED');
  console.log(`[監査] 登録された WEB_DERIVED 言い回し候補数: ${webDerivedCandidates.length}`);
  for (const c of webDerivedCandidates.slice(0, 3)) {
    console.log(`  -> id:${c.id}, status:${c.status}, candidateText:「${c.candidateText}」, category:${c.categoryKey}`);
  }

  const hasWebObserved = webObservedSkeletons.length > 0;
  const hasWebDerived = webDerivedCandidates.length > 0;

  if (hasWebObserved && hasWebDerived) {
    console.log('\n🎉 PASS: backgroundWorkerService Step 6.12.12 の実配線と縦横の還元が正常に完了しました！');
    process.exit(0);
  } else {
    console.error('\n⚠️ FAIL: WEB_OBSERVED または WEB_DERIVED の生成・登録が確認できませんでした');
    process.exit(1);
  }
}

main().catch((e) => {
  console.error('Fatal error:', e);
  process.exit(1);
});
