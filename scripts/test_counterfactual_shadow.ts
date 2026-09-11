/**
 * 【フェーズ3検証】判断・反事実推論 (counterfactualReasoningService) シャドー実行シミュレーション
 *
 * 本スクリプトは、比較・判断を求めるユーザー発言に対して、
 * resolveAnaphoraの候補抽出とcounterfactualReasoningServiceの分岐シミュレーションが
 * 正確に連動して動作することを検証するためのシミュレーションスクリプトです。
 */
import { counterfactualReasoningService } from '../src/services/counterfactualReasoningService';
import { resolveAnaphora, defaultConversationState } from '../src/services/conversationStateService';
import { ConversationState } from '../src/types';

function runCounterfactualShadowSimulation() {
  console.log('================================================================');
  console.log('🔀 フェーズ3: 判断・反事実推論 (counterfactualReasoningService) シミュレーション検証');
  console.log('================================================================\n');

  const testInputs = [
    {
      text: 'PostgreSQLとSQLite、今回のアプリにはどっちがいい？',
      contextTopic: 'データベース選定',
      expectedTrigger: true,
    },
    {
      text: 'ViteとNext.jsを比較して、SPAならどちらが向いてる？',
      contextTopic: 'フロントエンド構成',
      expectedTrigger: true,
    },
    {
      text: 'こんにちは、今日の進捗はどうですか？',
      contextTopic: '挨拶',
      expectedTrigger: false,
    },
  ];

  let state: ConversationState = defaultConversationState();

  for (const item of testInputs) {
    state.currentTopic = item.contextTopic;

    // 1. 指示語・省略解決（フェーズ1）
    const anaphoraRes = resolveAnaphora(item.text, state);

    // 2. 判断・比較トリガーの評価
    const isJudgmentOrComparison =
      anaphoraRes.detectedExpression === 'どっち' ||
      anaphoraRes.detectedExpression === 'どちら' ||
      /どっち|どちら|比較|選ぶ|選びたい|どっちがいい|どちらが良い|メリット.*デメリット/.test(item.text);

    console.log(`\n【入力】: "${item.text}"`);
    console.log(`  - 指示語検知: ${anaphoraRes.detectedExpression || 'なし'} (確信度: ${anaphoraRes.confidence})`);
    console.log(`  - 抽出候補 (candidates): [${anaphoraRes.candidates.join(', ')}]`);
    console.log(`  - 判断・比較トリガー発動: ${isJudgmentOrComparison ? 'YES' : 'NO'}`);

    if (isJudgmentOrComparison) {
      const topic = state.currentTopic || '判断・比較';
      const options = anaphoraRes.candidates.length >= 2
        ? anaphoraRes.candidates
        : ['選択肢A', '選択肢B'];

      const candidateScenarios = options.map((opt, idx) => ({
        id: `cf_cand_${idx}_${Date.now()}`,
        name: `選択肢『${opt}』の採用`,
        condition: `もし『${opt}』を選択した場合`,
        alternativeChoice: `${opt} を主軸に選定`,
        hypothesis: `${opt} の特性を活かした設計と運用への移行`,
      }));

      const simulation = counterfactualReasoningService.simulateBranchReasoning(
        topic,
        options[0] || '現状維持',
        `ユーザーの判断要請: "${item.text.slice(0, 60)}"`,
        candidateScenarios
      );

      console.log(`  - シミュレーションID: ${simulation.id}`);
      console.log(`  - 比較対象案数: ${simulation.evaluations.length} 案`);
      for (const ev of simulation.evaluations) {
        console.log(`    * [${ev.scenarioName}]: 安全度=${ev.safetyScore}, 性能=${ev.performanceScore}, 精度=${ev.accuracyScore}, 相対Δ=${ev.overallDeltaScore}点, 判定=${ev.recommendation}`);
      }
      console.log(`  - 最良代替案: ${simulation.bestAlternative?.scenarioName || '(なし)'}`);
      console.log(`  - 結論: ${simulation.conclusion}`);
    }
  }

  console.log('\n================================================================');
  console.log('✅ フェーズ3 シャドー推論シミュレーション完了');
  console.log('================================================================');
  process.exit(0);
}

runCounterfactualShadowSimulation();
