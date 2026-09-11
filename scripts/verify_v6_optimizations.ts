import { buildExpertSystemPromptWithTracking } from '../src/utils/moeRouter';
import {
  extractConversationState,
  inferConversationStage,
  defaultConversationState,
  CONVERSATION_STATE_INSTRUCTION,
} from '../src/services/conversationStateService';
import { PersonaConfig, WorkspaceFile, MemoryItem } from '../src/types';

async function runTests() {
  console.log('================================================================');
  console.log('🚀 作業指示書 v6 検証テスト: 優先度8 (不変プレフィックス) & 優先度9 (会話状態軽量化)');
  console.log('================================================================\n');

  const defaultPersona: PersonaConfig = {
    name: 'みき',
    userNickname: 'マスター',
    basePersonality: '明るく親しみやすく、相手の気持ちに寄り添う親友',
    speakingStyle: 'タメ口',
  };

  const sampleFiles: WorkspaceFile[] = [
    { path: 'test.py', content: 'print("hello")', language: 'python' },
  ];

  const sampleMemories: MemoryItem[] = [];

  // =========================================================================
  // テスト 1: 静的プレフィックスの真の不変化 (優先度8)
  // =========================================================================
  console.log('【テスト 1: 静的プレフィックス (staticPrefixPrompt) の完全不変性検証】');

  const scenario1 = await buildExpertSystemPromptWithTracking(
    'moe_chat',
    defaultPersona,
    sampleMemories,
    sampleFiles,
    'こんにちは！今日の天気はどう？'
  );

  const scenario2 = await buildExpertSystemPromptWithTracking(
    'code',
    defaultPersona,
    sampleMemories,
    sampleFiles,
    'このPythonコードのバグを直して: def add(a, b): return a - b'
  );

  const scenario3 = await buildExpertSystemPromptWithTracking(
    'logic',
    defaultPersona,
    sampleMemories,
    sampleFiles,
    '12345 * 67890 の計算結果を教えて'
  );

  const isPrefixMatch1_2 = scenario1.staticPrefixPrompt === scenario2.staticPrefixPrompt;
  const isPrefixMatch2_3 = scenario2.staticPrefixPrompt === scenario3.staticPrefixPrompt;
  const isAllPrefixIdentical = isPrefixMatch1_2 && isPrefixMatch2_3;

  console.log(`- シナリオ1 (雑談/moe_chat) prefix長: ${scenario1.staticPrefixPrompt.length} 文字`);
  console.log(`- シナリオ2 (コード/code)    prefix長: ${scenario2.staticPrefixPrompt.length} 文字`);
  console.log(`- シナリオ3 (計算/logic)    prefix長: ${scenario3.staticPrefixPrompt.length} 文字`);
  console.log(`- シナリオ 1 と 2 の一致判定: ${isPrefixMatch1_2 ? '✅ 完全一致' : '❌ 不一致'}`);
  console.log(`- シナリオ 2 と 3 の一致判定: ${isPrefixMatch2_3 ? '✅ 完全一致' : '❌ 不一致'}`);
  console.log(`- 全シナリオ共通 prefix 一致: ${isAllPrefixIdentical ? '✅ 100% 完全同一 (KVキャッシュ最長ヒット達成)' : '❌ 失敗'}`);
  console.log(`- 分離された expertInstruction: "${scenario2.expertInstruction?.slice(0, 30)}..."`);
  console.log(`- 分離された toolBlock: ${scenario2.toolBlock ? '存在 (動的部へ配置)' : 'なし'}\n`);

  if (!isAllPrefixIdentical) {
    throw new Error('テスト1失敗: staticPrefixPrompt が異なるシナリオ間で一致していません。');
  }

  // =========================================================================
  // テスト 2: ルールベース stage 推定関数の精度検証 (優先度9-3)
  // =========================================================================
  console.log('【テスト 2: ルールベース会話ステージ (inferConversationStage) の推定精度検証】');

  const stageCases = [
    { input: '違うよ、そうじゃなくてVBAで書いてほしいの', expected: 'CORRECTION' },
    { input: 'エラーが出た！動かないよ！直して', expected: 'CORRECTION' },
    { input: 'ReactとVueはどっちがいい？違いを比較して', expected: 'COMPARISON' },
    { input: 'じゃあReactにする！これで決定でお願い', expected: 'DECISION' },
    { input: 'ありがとう！解決したよ！お疲れ様', expected: 'CLOSING' },
    { input: 'ところで別の質問なんだけど...', expected: 'TOPIC_CHANGE' },
    { input: 'もうちょっと詳しく教えて！他にはある？', expected: 'FOLLOW_UP' },
    { input: 'それってどういうこと？意味がわからない', expected: 'CLARIFICATION' },
    { input: 'TypeScriptのインターフェースの書き方は？', expected: 'QUESTION' },
  ];

  let stageSuccessCount = 0;
  for (const tc of stageCases) {
    const inferred = inferConversationStage(tc.input);
    const pass = inferred === tc.expected;
    if (pass) stageSuccessCount++;
    console.log(`- 入力: "${tc.input}" ➔ 推定: ${inferred} (期待: ${tc.expected}) ${pass ? '✅' : '❌'}`);
  }
  console.log(`- ステージ推定正解率: ${stageSuccessCount}/${stageCases.length} (${Math.round((stageSuccessCount / stageCases.length) * 100)}%)\n`);

  if (stageSuccessCount !== stageCases.length) {
    throw new Error('テスト2失敗: inferConversationStage で不一致が発生しました。');
  }

  // =========================================================================
  // テスト 3: 会話状態抽出 (extractConversationState) の新旧スキーマ互換性検証
  // =========================================================================
  console.log('【テスト 3: extractConversationState 新旧スキーマ・省略パース検証】');

  const prevState = defaultConversationState();

  // ケースA: 新スキーマ (超軽量短縮キー: t, g のみ)
  const newSchemaRaw = '<state>{"t":"在庫管理ツール","g":"売上集計の自動化"}</state>\n了解だよ！在庫管理ツールの集計マクロを作ろうね！';
  const extractA = extractConversationState(newSchemaRaw, prevState, {
    userPrompt: '在庫管理の売上を集計するマクロを作って',
    inferredExpectedLength: 'standard',
    stateDurationMs: 120,
  });

  console.log('- ケースA (新スキーマ/超軽量短縮キー):');
  console.log(`  - 抽出Topic: "${extractA.state.currentTopic}" (期待: "在庫管理ツール")`);
  console.log(`  - 抽出Goal:  "${extractA.state.topLevelGoal}" (期待: "売上集計の自動化")`);
  console.log(`  - 自動補完Stage: "${extractA.state.stage}" (期待: "QUESTION")`);
  console.log(`  - コード側回答長: "${extractA.state.expectedResponseLength}" (期待: "standard")`);
  console.log(`  - 短縮キー判定: ${extractA.stats.isKeyShortened ? '✅ 短縮キー検出' : '❌'}`);
  console.log(`  - 生文字数: ${extractA.stats.rawStateChars}字 (~${extractA.stats.estimatedTokens} tok), 所要時間: ${extractA.stats.durationMs}ms`);
  console.log(`  - 本文分離: "${extractA.visibleText}"`);

  if (extractA.state.currentTopic !== '在庫管理ツール' || extractA.state.topLevelGoal !== '売上集計の自動化') {
    throw new Error('テスト3-A失敗: 新スキーマの抽出に失敗しました。');
  }

  // ケースB: 新スキーマ + 訂正イベント短縮 (s: 'CORRECTION', c: [{o: '旧', n: '新'}])
  const newCorrectionRaw = '<state>{"t":"在庫管理","g":"自動化","s":"CORRECTION","c":[{"o":"5列目","n":"6列目"}]}</state>\n直したよ！6列目を対象にしたよ！';
  const extractB = extractConversationState(newCorrectionRaw, extractA.state, {
    userPrompt: '5列目じゃなくて6列目だよ！直して',
    inferredExpectedLength: 'short',
    stateDurationMs: 95,
  });

  console.log('- ケースB (新スキーマ/訂正イベント & 短縮ステージ):');
  console.log(`  - 抽出Stage: "${extractB.state.stage}" (期待: "CORRECTION")`);
  console.log(`  - 抽出訂正: 「${extractB.state.corrections[0]?.oldValue}」➔「${extractB.state.corrections[0]?.newValue}」`);
  console.log(`  - コード側回答長: "${extractB.state.expectedResponseLength}" (期待: "short")`);
  if (extractB.state.stage !== 'CORRECTION' || extractB.state.corrections[0]?.newValue !== '6列目') {
    throw new Error('テスト3-B失敗: 新スキーマの訂正イベント抽出に失敗しました。');
  }

  // ケースC: 旧スキーマ (後方互換性テスト: currentTopic, topLevelGoal, expectedResponseLength)
  const oldSchemaRaw = '<state>{"currentTopic":"旧スキーマ話題","topLevelGoal":"旧スキーマ目的","stage":"COMPARISON","confirmedFacts":["Fact1"],"expectedResponseLength":"detailed"}</state>\n比較結果をお伝えするね！';
  const extractC = extractConversationState(oldSchemaRaw, prevState, {
    userPrompt: 'AとBのメリットを比較して',
    inferredExpectedLength: 'standard',
  });

  console.log('- ケースC (旧スキーマ/後方互換性):');
  console.log(`  - 抽出Topic: "${extractC.state.currentTopic}" (期待: "旧スキーマ話題")`);
  console.log(`  - 抽出Goal:  "${extractC.state.topLevelGoal}" (期待: "旧スキーマ目的")`);
  console.log(`  - 抽出Stage: "${extractC.state.stage}" (期待: "COMPARISON")`);
  console.log(`  - 抽出回答長: "${extractC.state.expectedResponseLength}" (期待: "detailed")`);
  console.log(`  - 短縮キー判定: ${extractC.stats.isKeyShortened ? '短縮' : '✅ 旧形式キー検出'}`);

  if (extractC.state.currentTopic !== '旧スキーマ話題' || extractC.state.expectedResponseLength !== 'detailed') {
    throw new Error('テスト3-C失敗: 旧スキーマの後方互換性に失敗しました。');
  }

  // ケースD: モデルが state タグを出力しなかった場合 (フォールバック & コード自己充足)
  const noStateRaw = '了解だよ！ごめんね、エラーの原因は型定義の不一致だったから修正したよ！';
  const extractD = extractConversationState(noStateRaw, extractA.state, {
    userPrompt: '動かないよ！エラーが出るから直して！',
    inferredExpectedLength: 'short',
    stateDurationMs: 0,
  });

  console.log('- ケースD (モデルが state タグを出力しなかったフォールバック):');
  console.log(`  - タグ有無: ${extractD.stats.hasStateTag ? 'あり' : '✅ タグなし (安全検出)'}`);
  console.log(`  - 自動維持Topic: "${extractD.state.currentTopic}"`);
  console.log(`  - 自動補完Stage: "${extractD.state.stage}" (ルールベース判定により "CORRECTION" へ更新)`);
  console.log(`  - 本文完全保持: "${extractD.visibleText.slice(0, 25)}..."`);

  if (extractD.state.stage !== 'CORRECTION') {
    throw new Error('テスト3-D失敗: タグなしフォールバック時のステージ補完に失敗しました。');
  }

  // =========================================================================
  // テスト 4: 不可視JSONトークン削減の実測比較
  // =========================================================================
  console.log('\n【テスト 4: 不可視JSONトークン削減の実測比較】');

  const oldSampleStateJson = '<state>{"currentTopic":"売上集計の自動化","topLevelGoal":"月次売上レポートの作成","stage":"QUESTION","confirmedFacts":[],"corrections":[],"invalidatedAssumptions":[],"pendingQuestions":[],"expectedResponseLength":"standard"}</state>';
  const newSampleStateJson = '<state>{"t":"売上集計の自動化","g":"月次売上レポートの作成"}</state>';

  const oldChars = oldSampleStateJson.length;
  const newChars = newSampleStateJson.length;
  const oldEstTokens = Math.round(oldChars / 1.5);
  const newEstTokens = Math.round(newChars / 1.5);
  const reductionTokens = oldEstTokens - newEstTokens;
  const reductionRate = Math.round(((oldChars - newChars) / oldChars) * 100);

  console.log(`- 旧仕様 (全キー空配列出力): ${oldChars} 文字 (~${oldEstTokens} tokens)`);
  console.log(`- 新仕様 (短縮キー・空キー完全省略): ${newChars} 文字 (~${newEstTokens} tokens)`);
  console.log(`- 削減効果: ${oldChars - newChars} 文字削減 (${reductionTokens} tokens 削減)`);
  console.log(`- 削減率: 🎉 約 ${reductionRate}% の不可視JSONトークン削減を達成！\n`);

  console.log('【新仕様 CONVERSATION_STATE_INSTRUCTION プロンプト指示文】:');
  console.log(CONVERSATION_STATE_INSTRUCTION);
  console.log('================================================================');
  console.log('🎉 すべての検証テストが正常に合格しました！');
  console.log('================================================================');
  process.exit(0);
}

runTests().catch((err) => {
  console.error('テスト実行エラー:', err);
  process.exit(1);
});
