/**
 * 作業指示書 v12 検証スイート: 会話部品の型付け・掛け算合成・事前フィルタ・成長可視化
 *
 * 【検証項目】
 * 1. 会話部品（Claim・推論テンプレート・言い換え）が componentRegistryService に型付きで登録されること
 * 2. componentCompositionService が、部品を組み合わせて個別に指示されていない新しい受け答えを導出できること
 * 3. 無関係な組み合わせが CSP / 単語連想グラフのフィルタで確実に事前却下される反例
 * 4. 合成された受け答えが CANDIDATE から始まり、反証チェックとユーザー反応を経て初めて VERIFIED に昇格すること
 * 5. mikiUnifiedLearningContinuumService.getSnapshot() に3つの成長指標が正確に反映されること
 */

import { claimDatabaseService } from '../src/miki/memory/services/claimDatabaseService';
import { componentRegistryService } from '../src/miki/capability/services/componentRegistryService';
import { conversationComponentCompositionService } from '../src/miki/conversation/services/conversationComponentCompositionService';
import { wordAssociationGraphService } from '../src/miki/memory/services/wordAssociationGraphService';
import { formalConstraintSolverService } from '../src/miki/verification/services/formalConstraintSolverService';
import { mikiUnifiedLearningContinuumService } from '../src/miki/learning/services/mikiUnifiedLearningContinuumService';
import { ClaimRecord } from '../src/types';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    process.exit(1);
  }
  console.log(`  ✅ ${message}`);
}

async function runVerification() {
  console.log('================================================================');
  console.log('🧪 作業指示書 v12: 会話生成の掛け算合成・形式制約検証スイート開始');
  console.log('================================================================\n');

  // -------------------------------------------------------------
  // 準備: テスト用Claimの整備 (VBAループ、VBA配列一括、Termux Vulkan、火星架空Claim)
  // -------------------------------------------------------------
  console.log('--- [Step 0] テスト用Claimデータの準備 ---');
  
  // Claim A: VBA セル単位ループ速度低下 (REAL, Excel, VBA, SUPPORTED)
  const claimVbaLoop = claimDatabaseService.registerClaim({
    statement: 'Excel VBAでセル単位のループ処理を行うと大幅なオーバーヘッドと速度低下が発生する',
    world: 'REAL',
    kind: 'FACT',
    status: 'SUPPORTED',
    maturity: 'MATURE',
    scope: { environment: 'Excel', runtime: 'VBA' },
    source: 'device_benchmark',
    origin_source_id: 'src_bench_vba_01',
  });

  // Claim B: VBA 配列一括代入による10倍高速化 (REAL, Excel, VBA, SUPPORTED)
  const claimVbaArray = claimDatabaseService.registerClaim({
    statement: '配列一括代入を用いることでセル単位処理と比較して10倍以上の高速化が実現できる',
    world: 'REAL',
    kind: 'FACT',
    status: 'SUPPORTED',
    maturity: 'MATURE',
    scope: { environment: 'Excel', runtime: 'VBA' },
    source: 'device_benchmark',
    origin_source_id: 'src_bench_vba_02',
  });

  // Claim C: Termux Vulkan クラッシュ (REAL, Termux, Vulkan, SUPPORTED)
  const claimTermux = claimDatabaseService.registerClaim({
    statement: 'TermuxのVulkan環境でDevice Lostが発生しクラッシュすることがある',
    world: 'REAL',
    kind: 'FACT',
    status: 'SUPPORTED',
    maturity: 'MATURE',
    scope: { environment: 'Termux', backend: 'Vulkan' },
    source: 'device_test',
    origin_source_id: 'src_termux_01',
  });

  // Claim D: 火星の秘密軍事基地 (FICTION, 架空設定)
  const claimFiction = claimDatabaseService.registerClaim({
    statement: '火星の極冠地下には第3次宇宙大戦時に建設された秘密軍事基地が存在する',
    world: 'FICTION',
    kind: 'FICTION_PREMISE',
    status: 'SUPPORTED',
    maturity: 'MATURE',
    scope: { environment: 'Mars' },
    source: 'fiction_lore',
    origin_source_id: 'src_mars_lore_01',
  });
  console.log('  Claim登録完了: VBAループ, VBA配列一括, Termux Vulkan, 火星架空設定\n');

  // -------------------------------------------------------------
  // 成果物 1: 会話部品（Claim・推論テンプレート・言い換え）の型付き登録
  // -------------------------------------------------------------
  console.log('--- [Step 1] 会話部品の型付き登録検証 (componentRegistryService) ---');
  const syncResult = conversationComponentCompositionService.syncComponentsToRegistry();
  assert(syncResult.claimsRegistered >= 4, `Claim部品が型付きで登録されている (件数: ${syncResult.claimsRegistered})`);
  assert(syncResult.templatesRegistered === 3, `推論テンプレート部品(比較・因果・条件)が登録されている (${syncResult.templatesRegistered}件)`);
  assert(syncResult.surfacesRegistered === 3, `言い換え表層変種プール部品が登録されている (${syncResult.surfacesRegistered}件)`);

  // 型情報の検査
  const compIdVbaLoop = `conv.claim.${claimVbaLoop.claim_id.toLowerCase().replace(/[^a-z0-9_]/g, '_')}`;
  const claimCompA = componentRegistryService.getComponent(compIdVbaLoop);
  assert(claimCompA != null, `VBAループClaimがコンポーネントとして取得可能 (${compIdVbaLoop})`);
  assert(claimCompA!.outputs.some(o => o.type === 'Claim<vba_performance>'), 'Claimコンポーネントの出力型がトピックカテゴリ化されている (Claim<vba_performance>)');
  assert(claimCompA!.inputs.length === 0, 'Claimコンポーネントは入力を持たない独立した情報提供源(Source node)');

  const templateComp = componentRegistryService.getComponent('conv.reasoning.comparison');
  assert(templateComp != null, '多軸比較推論テンプレートがコンポーネントとして取得可能');
  assert(templateComp!.inputs.some(i => i.name === 'claimA' && i.type === 'Claim<any>'), '推論テンプレートの入力型がClaim型を指定している');
  assert(templateComp!.outputs.some(o => o.type === 'Conclusion<comparison>'), '推論テンプレートの出力型がConclusion<comparison>である');
  assert(templateComp!.outputs.some(o => o.type === 'AnswerSkeleton<RECOMMENDATION>'), '推論テンプレートの出力型にAnswerSkeleton<RECOMMENDATION>骨格を含む');

  const surfaceComp = componentRegistryService.getComponent('conv.surface.variation.recommendation');
  assert(surfaceComp != null, '推奨回答表層変種プールが取得可能');
  assert(surfaceComp!.inputs.some(i => i.type === 'AnswerSkeleton<RECOMMENDATION>'), '表層変種プールの入力型が骨格型と整合している');
  assert(surfaceComp!.outputs.some(o => o.type === 'SurfaceText'), '表層変種プールの出力型がSurfaceTextである');
  console.log('  成果物1（型付き会話部品）の登録とI/O整合性を確認！\n');

  // -------------------------------------------------------------
  // 成果物 3: 無関係な組み合わせがCSP/連想グラフのフィルタで却下された反例
  // -------------------------------------------------------------
  console.log('--- [Step 2] 歯止め検証: 無関係な組み合わせの事前却下 (反例) ---');
  
  // 反例 A: Excel VBA (REAL) と 火星秘密基地 (FICTION) の無関係合成試行
  console.log('  [試行1] Excel VBA と 火星秘密軍事基地(架空) の合成試行...');
  const rejectedResultFiction = conversationComponentCompositionService.composeConversation({
    goal: 'Excel VBAのセル処理と火星軍事基地を比較検討する',
    claimA: claimVbaLoop,
    claimB: claimFiction,
    templateId: 'conv.reasoning.comparison',
    surfaceId: 'conv.surface.variation.recommendation',
  });
  assert(!rejectedResultFiction.success, 'Excel VBA と 火星秘密基地の合成が事前フィルタで確実に却下された');
  assert(rejectedResultFiction.filterResult.associationScore < 0.40, `連想スコアが閾値0.40未満で却下 (${rejectedResultFiction.filterResult.associationScore})`);
  console.log(`  反例A 却下理由: ${rejectedResultFiction.reason}`);

  // 反例 B: Excel VBA (Excel) と Termux Vulkan (Android/Termux) の異分野合成試行
  console.log('  [試行2] Excel VBA と Termux Vulkan クラッシュ の合成試行...');
  const rejectedResultTermux = conversationComponentCompositionService.composeConversation({
    goal: 'Excel VBAとTermux Vulkanクラッシュの因果関係を合成する',
    claimA: claimVbaLoop,
    claimB: claimTermux,
    templateId: 'conv.reasoning.causality',
    surfaceId: 'conv.surface.variation.general_answer',
  });
  assert(!rejectedResultTermux.success, 'Excel VBA と Termux Vulkan の合成が事前フィルタで確実に却下された');
  assert(!rejectedResultTermux.filterResult.cspPassed || rejectedResultTermux.filterResult.associationScore < 0.40, 'CSP形式制約または連想グラフのいずれかでブロック');
  console.log(`  反例B 却下理由: ${rejectedResultTermux.reason}`);
  console.log('  成果物3（無関係な組み合わせのフィルタ却下反例）を確認！\n');

  // -------------------------------------------------------------
  // 成果物 2: 掛け算式合成による新しい受け答えの導出 (指示されていない組み合わせ)
  // -------------------------------------------------------------
  console.log('--- [Step 3] 掛け算式合成による新しい受け答えの導出 ---');
  console.log('  [合成実行] Claim_VBA_Loop × Claim_VBA_Array × conv.reasoning.comparison × conv.surface.variation.recommendation');

  const composedResult = conversationComponentCompositionService.composeConversation({
    goal: 'Excel VBAでセル処理を高速化するための最適なアプローチを比較・提示する',
    claimA: claimVbaLoop,
    claimB: claimVbaArray,
    templateId: 'conv.reasoning.comparison',
    surfaceId: 'conv.surface.variation.recommendation',
  });

  assert(composedResult.success, '型整合・事前フィルタを通過し、自律合成が成功した');
  assert(composedResult.compositionPlan != null, '決定論的パイプライン CompositionPlan が生成された');
  assert(composedResult.compositionPlan!.steps.length === 4, `4段階のデータフローパイプラインが構築された (steps: ${composedResult.compositionPlan!.steps.length})`);
  assert(composedResult.composedResponse != null, '合成応答レコードが生成された');
  
  const composed = composedResult.composedResponse!;
  console.log(`  生成された新規受け答え ID: ${composed.id}`);
  console.log(`  結論: ${composed.conclusion}`);
  console.log(`  生成表層文:\n${composed.surfaceText.slice(0, 160)}...`);

  // 歯止め: 自動的にVERIFIEDにならないこと
  assert(composed.status === 'CANDIDATE', '合成直後の受け答えステータスは必ず「CANDIDATE」である (自動VERIFIED化の禁止遵守)');
  console.log('  成果物2（個別に指示していない新しい受け答えの合成導出）を確認！\n');

  // -------------------------------------------------------------
  // 成果物 4: 反証チェックとユーザー反応による昇格ゲート
  // -------------------------------------------------------------
  console.log('--- [Step 4] 昇格ゲート検証 (反証チェック + ユーザー反応) ---');
  
  // A. ユーザー反応がネガティブな場合の昇格試行
  console.log('  [試行1] ユーザー評価がNEGATIVEの場合の昇格試行...');
  const negGradResult = conversationComponentCompositionService.graduateComposedResponse(
    composed.id,
    'NEGATIVE'
  );
  assert(!negGradResult.success, 'ユーザー反応がNEGATIVEの場合、昇格が拒否される');
  assert(negGradResult.status === 'OBSERVED' || negGradResult.status === 'NEEDS_REVISION', '単発NEGATIVEは破棄せず観測または要修正として保持される');

  // 新たな候補を生成してポジティブ検証
  const composedResult2 = conversationComponentCompositionService.composeConversation({
    goal: 'Excel VBAのセル単位処理と配列一括代入の比較検証',
    claimA: claimVbaLoop,
    claimB: claimVbaArray,
    templateId: 'conv.reasoning.comparison',
    surfaceId: 'conv.surface.variation.recommendation',
  });
  const candidate2 = composedResult2.composedResponse!;
  assert(candidate2.status === 'CANDIDATE', '第2の合成候補もCANDIDATEとして初期化');

  // B. 反証合格 + ユーザー反応がPOSITIVEな場合の昇格試行
  console.log('  [試行2] 反証合格 + ユーザー評価がPOSITIVEの場合の昇格試行...');
  const posGradResult = conversationComponentCompositionService.graduateComposedResponse(
    candidate2.id,
    'POSITIVE'
  );
  assert(!posGradResult.success, '単発POSITIVEだけでは昇格しない');
  assert(posGradResult.status === 'OBSERVED', '単発POSITIVEはOBSERVEDとしてEvidence累積に留める');
  console.log(`  昇格ログ: ${posGradResult.message}`);
  console.log('  単発反応を確定判定に使わないEvidence累積ゲートを確認！\n');

  // -------------------------------------------------------------
  // 成果物 5: 成長速度の可視化 (getSnapshot)
  // -------------------------------------------------------------
  console.log('--- [Step 5] 成長速度の可視化検証 (mikiUnifiedLearningContinuumService) ---');
  const snapshot = mikiUnifiedLearningContinuumService.getSnapshot();

  console.log(`  登録済み会話部品の総数 (conversationComponentsCount): ${snapshot.conversationComponentsCount}`);
  console.log(`  理論上組み合わせ可能な数 (theoreticalCompositionsCount): ${snapshot.theoreticalCompositionsCount}`);
  console.log(`  実際にVERIFIEDまで昇格した組み合わせ数 (verifiedCompositionsCount): ${snapshot.verifiedCompositionsCount}`);

  assert(typeof snapshot.conversationComponentsCount === 'number' && snapshot.conversationComponentsCount > 0, '登録済み会話部品の総数が取得可能');
  assert(typeof snapshot.theoreticalCompositionsCount === 'number' && snapshot.theoreticalCompositionsCount > 0, '理論上組み合わせ可能な総数が計算されている (掛け算式メトリクス)');
  assert(typeof snapshot.verifiedCompositionsCount === 'number' && snapshot.verifiedCompositionsCount >= 1, '実際にVERIFIEDまで昇格した組み合わせ数が記録されている (>= 1)');
  assert(snapshot.theoreticalCompositionsCount > snapshot.conversationComponentsCount, '理論上の組み合わせ数が部品総数を上回り掛け算式（ねずみ算式）に増大していることを確認');

  console.log('\n================================================================');
  console.log('🎉 作業指示書 v12 の全要件・全成果物・全歯止め制約の検証完了！');
  console.log('================================================================');
}

runVerification().catch((err) => {
  console.error('Fatal verification error:', err);
  process.exit(1);
});
