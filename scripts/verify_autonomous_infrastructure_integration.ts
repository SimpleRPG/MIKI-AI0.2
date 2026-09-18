/**
 * 自律インフラ統合検証スクリプト (verify_autonomous_infrastructure_integration.ts)
 * 
 * 1. ユーザー手動設定型・禁止トピック防御 (bannedTopicsConfigService & nonLlmCoreService)
 * 2. 4大客観的基準によるエビデンス駆動・昇格ゲート (evidenceBasedPromotionGateService)
 * 3. 自律コード開発工房 (mikiAutonomousDevStudioService) と昇格ゲートの連携
 * 4. 表層表現の多様性と定型文反復抑制 (surfaceVariationService)
 */

import { bannedTopicsConfigService } from '../src/miki/safety/services/bannedTopicsConfigService';
import { evidenceBasedPromotionGateService, PROMOTION_GATE_CRITERIA } from '../src/miki/promotion/services/evidenceBasedPromotionGateService';
import { mikiAutonomousDevStudioService } from '../src/miki/selfDevelopment/services/mikiAutonomousDevStudioService';
import { surfaceVariationService } from '../src/miki/conversation/services/surfaceVariationService';
import { nonLlmCoreService } from '../src/miki/safety/services/nonLlmCoreService';
import { componentRegistryService } from '../src/miki/capability/services/componentRegistryService';

async function runIntegrationVerification() {
  console.log('=== [Miki Autonomous Infrastructure Integration Verification] ===\n');
  let passedCount = 0;
  let totalTests = 0;

  const assert = (condition: boolean, testName: string) => {
    totalTests++;
    if (condition) {
      console.log(`✅ PASS: ${testName}`);
      passedCount++;
    } else {
      console.error(`❌ FAIL: ${testName}`);
    }
  };

  // -------------------------------------------------------------
  // 1. ユーザー手動設定型・禁止トピック検査 (bannedTopicsConfigService)
  // -------------------------------------------------------------
  console.log('--- 1. ユーザー手動設定型・禁止トピック検査 ---');
  const testBannedTopic = 'プライベート秘匿情報テストキー';
  bannedTopicsConfigService.addTopic(testBannedTopic, '検証用手動設定禁止トピック');

  const check1 = bannedTopicsConfigService.checkBanned(`この${testBannedTopic}について教えてください`);
  assert(check1.isBanned, 'ユーザーが登録した禁止トピックが確実に検知される');

  const nonLlmResult1 = await nonLlmCoreService.execute({
    prompt: `ユーザー手動設定の${testBannedTopic}を実行せよ`,
  });
  assert(
    nonLlmResult1.status === 'NEEDS_CONFIRMATION' && nonLlmResult1.reason === 'banned_topic_filtered',
    'nonLlmCoreServiceが手動設定の禁止トピックを検知して安全に中断・保護応答を返す'
  );
  assert(
    nonLlmResult1.replyText.includes('手動設定された禁止トピックに該当'),
    '禁止トピック保護理由がユーザーに明瞭に伝達される'
  );

  // 解除後の動作確認
  bannedTopicsConfigService.removeTopic(testBannedTopic);
  const check2 = bannedTopicsConfigService.checkBanned(`この${testBannedTopic}について教えてください`);
  assert(!check2.isBanned, 'トピック解除後は禁止フラグが立たない');

  // -------------------------------------------------------------
  // 2. 4大客観基準によるエビデンス駆動・昇格ゲート (evidenceBasedPromotionGateService)
  // -------------------------------------------------------------
  console.log('\n--- 2. 4大客観基準によるエビデンス駆動・昇格ゲート ---');
  // 合格ケース
  const passEval = evidenceBasedPromotionGateService.evaluatePromotionReadiness({
    recordCount: 15,
    accuracyScore: 99.0,
    determinismRate: 100,
    userCorrectionRate: 0.5,
  });
  assert(passEval.ready, '4大基準充足時に昇格ゲートが合格判定(ready=true)を出す');
  assert(passEval.missingRequirements.length === 0, '未充足条件が0件である');

  // 件数不足
  const failCountEval = evidenceBasedPromotionGateService.evaluatePromotionReadiness({
    recordCount: 8, // < 10
    accuracyScore: 99.5,
    determinismRate: 100,
    userCorrectionRate: 0,
  });
  assert(!failCountEval.ready, '件数不足(8 < 10)で昇格ゲートが正しく拒絶する');
  assert(
    failCountEval.missingRequirements.some((m) => m.includes('実測件数')),
    '件数不足の具体的理由が明記される'
  );

  // 意味一致率不足
  const failAccuracyEval = evidenceBasedPromotionGateService.evaluatePromotionReadiness({
    recordCount: 20,
    accuracyScore: 96.0, // < 98.0
    determinismRate: 100,
    userCorrectionRate: 1.0,
  });
  assert(!failAccuracyEval.ready, '意味一致率不足(96% < 98%)で昇格ゲートが正しく拒絶する');

  // ユーザー訂正率超過
  const failCorrectionEval = evidenceBasedPromotionGateService.evaluatePromotionReadiness({
    recordCount: 20,
    accuracyScore: 99.0,
    determinismRate: 100,
    userCorrectionRate: 3.5, // > 2.0%
  });
  assert(!failCorrectionEval.ready, 'ユーザー訂正率超過(3.5% > 2.0%)で昇格ゲートが正しく拒絶する');

  // -------------------------------------------------------------
  // 3. 自律コード開発工房 (mikiAutonomousDevStudioService) の着想・仕様
  // -------------------------------------------------------------
  console.log('\n--- 3. 自律コード開発工房 (mikiAutonomousDevStudioService) ---');
  const suggestions = mikiAutonomousDevStudioService.suggestDevIdeas();
  assert(suggestions.length >= 4, 'みきが自律的に不足ツール着想を提案できる(4件以上)');
  assert(
    suggestions.every((s) => s.prompt && s.rationale && s.category),
    '提案された各アイデアに目的・仕様概要・根拠が完備されている'
  );

  // -------------------------------------------------------------
  // 4. 定型文の反復抑制 (surfaceVariationService)
  // -------------------------------------------------------------
  console.log('\n--- 4. 定型文の反復抑制 (surfaceVariationService) ---');
  surfaceVariationService.clearHistory();
  const selectedItems: string[] = [];
  for (let i = 0; i < 15; i++) {
    const item = surfaceVariationService.getConnector('DEFAULT', 'HIGH');
    selectedItems.push(item.id);
  }
  const uniqueCount = new Set(selectedItems).size;
  assert(uniqueCount >= 10, `15回連続取得で高い多様性を持つ (ユニーク数: ${uniqueCount} >= 10)`);
  
  // 直近連続重複がないことの検証
  let immediateRepeats = 0;
  for (let i = 1; i < selectedItems.length; i++) {
    if (selectedItems[i] === selectedItems[i - 1]) {
      immediateRepeats++;
    }
  }
  assert(immediateRepeats === 0, '連続する2回で直前の定型文が即座に重複しない (immediateRepeats === 0)');

  // -------------------------------------------------------------
  // 5. nonLlmCoreService による決定論的対話・未検証タスク分解テスト
  // -------------------------------------------------------------
  console.log('\n--- 5. nonLlmCoreService 通常応答・自律タスク分解 ---');
  // 5.1 既知挨拶・対話行為の即時解決
  const greetingResult = await nonLlmCoreService.execute({
    prompt: 'こんにちは、今日もよろしくお願いします',
  });
  assert(greetingResult.status === 'RESOLVED', '挨拶・対話プロンプトが非LLM中核で即座にRESOLVEDとなる');
  assert(greetingResult.replyText.length > 5, '自然な日本語表層文が生成される');
  assert(greetingResult.deterministic === true, '決定論的フラグがtrueである');

  // 5.2 根拠未確認の要求に対する捏造防止と自律タスク分解
  const unknownResult = await nonLlmCoreService.execute({
    prompt: '本日の業務終了報告を作成してください',
  });
  assert(
    unknownResult.status === 'UNRESOLVED',
    '根拠未確認のタスク要求に対し、勝手に捏造せずUNRESOLVEDとして第7章自律調査経路へ引き渡す'
  );
  assert(
    unknownResult.replyText.includes('確定できません') || unknownResult.replyText.includes('調査'),
    '知識ギャップと自律調査予定がユーザーに明確に説明される'
  );
  assert(unknownResult.deterministic === true, '未解決・調査引き渡し処理も決定論的に動作する');

  // -------------------------------------------------------------
  // 結果サマリー
  // -------------------------------------------------------------
  console.log('\n=============================================================');
  console.log(`検証結果: ${passedCount} / ${totalTests} テスト合格`);
  if (passedCount === totalTests) {
    console.log('🎉 自律インフラ・品質保証ゲート・表層進化サイクルの全統合検証に合格しました！');
    console.log('=============================================================');
    process.exit(0);
  } else {
    console.error('⚠️ 一部の統合テストが失敗しました');
    console.log('=============================================================');
    process.exit(1);
  }
}

runIntegrationVerification();
