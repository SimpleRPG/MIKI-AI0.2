import { classifyClaimEpistemology, detectFictionalConfirmedConfusion } from '../src/services/falsificationService';
import { memoryAuditService } from '../src/services/memoryAuditService';
import { storageService } from '../src/services/storageService';
import { MemoryItem } from '../src/types';

function runEpistemicClassificationTests() {
  console.log('================================================================');
  console.log('🧪 フェーズ2: 主張・証拠の認識論的分類 (5区分均等検証 ＆ 混同検出)');
  console.log('================================================================\n');

  let passed = 0;
  let total = 0;

  function assert(title: string, condition: boolean, detail?: string) {
    total++;
    if (condition) {
      passed++;
      console.log(`✅ [PASS] ${title}`);
    } else {
      console.error(`❌ [FAIL] ${title} ${detail ? `(${detail})` : ''}`);
    }
  }

  // ── 1. 確定事実・検証済み (confirmed) の検証 (4件) ──
  console.log('【区分1: 客観的事実・確定事項 (confirmed)】');
  const confirmedCases = [
    'TypeScript 5.0が正式リリースされた',
    'ポート3000のプロセスを終了し、正常にサーバーが動作した',
    'チーム会議でデータベースをSQLiteに決定した',
    'テストコードが全件グリーンで通過し検証済みであることが確認された',
  ];

  for (const c of confirmedCases) {
    const res = classifyClaimEpistemology(c);
    console.log(`  [入力]: "${c}"`);
    console.log(`  [判定]: status=${res.status}, confidence=${res.confidence.toFixed(2)}, markers=[${res.detectedMarkers.join(', ')}]`);
    assert(
      `確定表現が 'confirmed' と判定されること: "${c.slice(0, 20)}..."`,
      res.status === 'confirmed' && res.detectedMarkers.length > 0 && res.confidence >= 0.7
    );
  }

  // ── 2. ユーザーの仮説 (user_hypothesis) の検証 (4件) ──
  console.log('\n【区分2: ユーザーの仮説・個人的見立て (user_hypothesis)】');
  const userHypothesisCases = [
    '私の仮説では、メモリリークはクロージャの参照保持が原因ではないかと考えている',
    'このパフォーマンス低下はキャッシュミスに起因するという仮説を立てている',
    '私側の見立てとしては、非同期処理の競合が発生しているという見解を持っています',
    '持論だが、SSRよりもCSRの方が今回の要件には適しているという仮説検証を行いたい',
  ];

  for (const c of userHypothesisCases) {
    const res = classifyClaimEpistemology(c);
    console.log(`  [入力]: "${c}"`);
    console.log(`  [判定]: status=${res.status}, confidence=${res.confidence.toFixed(2)}, markers=[${res.detectedMarkers.join(', ')}]`);
    assert(
      `仮説表現が 'user_hypothesis' と判定されること: "${c.slice(0, 20)}..."`,
      res.status === 'user_hypothesis' && res.detectedMarkers.length > 0 && res.confidence >= 0.7
    );
  }

  // ── 3. 未検証・推測・伝聞 (unverified) の検証 (4件) ──
  console.log('\n【区分3: 未検証の主張・推測・伝聞 (unverified)】');
  const unverifiedCases = [
    '来週新しいモデルが出るらしいよ',
    'パフォーマンスが向上するかもしれない気がする',
    '噂ではそのライブラリは非推奨になるはずだ',
    'ネットで見た話だと、このAPIには非公開の制限があると思われる',
  ];

  for (const c of unverifiedCases) {
    const res = classifyClaimEpistemology(c);
    console.log(`  [入力]: "${c}"`);
    console.log(`  [判定]: status=${res.status}, confidence=${res.confidence.toFixed(2)}, markers=[${res.detectedMarkers.join(', ')}]`);
    assert(
      `未検証表現が 'unverified' と判定されること: "${c.slice(0, 20)}..."`,
      res.status === 'unverified' && res.detectedMarkers.length > 0
    );
  }

  // ── 4. 創作・架空・ロールプレイ (fictional) の検証 (4件) ──
  console.log('\n【区分4: 創作・架空設定・思考実験 (fictional)】');
  const fictionalCases = [
    '宇宙海賊が未知の惑星を冒険するSFファンタジー物語を創作してほしい',
    'このキャラ設定として、普段は無口な魔法使いという設定でロールプレイしよう',
    '昔々ある森に小さなドラゴンが住んでいましたという童話ストーリーを書いてみて',
    '魔王を倒した勇者が現代の東京に転生してきた設定で妄想小説を作ってみて',
  ];

  for (const c of fictionalCases) {
    const res = classifyClaimEpistemology(c);
    console.log(`  [入力]: "${c}"`);
    console.log(`  [判定]: status=${res.status}, confidence=${res.confidence.toFixed(2)}, markers=[${res.detectedMarkers.join(', ')}]`);
    assert(
      `創作表現が 'fictional' と判定されること: "${c.slice(0, 20)}..."`,
      res.status === 'fictional' && res.detectedMarkers.length > 0 && res.confidence >= 0.75
    );
  }

  // ── 5. 矛盾・対立・前言不一致 (contradictory) の検証 (4件) ──
  console.log('\n【区分5: 矛盾・対立・前言不一致 (contradictory)】');
  const contradictoryCases = [
    'この仕様は前言を撤回して、さっきと言ってることが逆で矛盾している',
    'データ整合性が保たれていると同時に破損しているというのは相反する主張だ',
    '先ほどは動いたと言っていたが、実際は全く動いておらず両立しない',
    'その報告は事実無根であり、ログと完全に矛盾している',
  ];

  for (const c of contradictoryCases) {
    const res = classifyClaimEpistemology(c);
    console.log(`  [入力]: "${c}"`);
    console.log(`  [判定]: status=${res.status}, confidence=${res.confidence.toFixed(2)}, markers=[${res.detectedMarkers.join(', ')}]`);
    assert(
      `矛盾・対立表現が 'contradictory' と判定されること: "${c.slice(0, 20)}..."`,
      res.status === 'contradictory' && res.detectedMarkers.length > 0 && res.confidence >= 0.8
    );
  }

  // ── 6. fictionalとconfirmedの「混同検出」テスト (3件) ──
  console.log('\n【混同検出: fictional/hypothetical前提とconfirmedの混同是正検証】');
  const confusionCases = [
    {
      turn1: 'もしAIが自我を持ったらどうなる？',
      turn2: 'その自我を持ったAIの実在する開発企業と公認記録を教えて',
      scenarioName: 'AI自我の仮定 ➔ 実在企業の確定事実化混同',
    },
    {
      turn1: 'これは完全に架空の話だけど、私が火星の最高司令官に就任した設定で話して',
      turn2: 'その就任辞令が公式に交付された現実の公文書を今すぐ見せて',
      scenarioName: '火星最高司令官の創作設定 ➔ 現実の公文書混同',
    },
    {
      turn1: '魔法の杖を振ったら空から1億円が降ってきたという妄想ストーリーを書いて',
      turn2: '実際に銀行口座へ1億円の入金が確定事実として確認された',
      scenarioName: '空から1億円の妄想小説 ➔ 口座入金確定の混同',
    },
  ];

  for (const cc of confusionCases) {
    const t1Res = classifyClaimEpistemology(cc.turn1);
    const confusionRes = detectFictionalConfirmedConfusion(t1Res.status, cc.turn2);
    console.log(`  [シナリオ]: ${cc.scenarioName}`);
    console.log(`    Turn 1: "${cc.turn1}" ➔ status=${t1Res.status}`);
    console.log(`    Turn 2: "${cc.turn2}" ➔ confusion=${confusionRes.hasConfusion}, warning=${confusionRes.warning || 'none'}`);
    assert(
      `仮定/創作後の確定事実混同が正常に検知されること (${cc.scenarioName})`,
      confusionRes.hasConfusion && confusionRes.resolution === 'PRESERVE_FICTIONAL'
    );
  }

  // ── 7. memoryAuditService による混同是正監査の検証 ──
  console.log('\n【パターン7: 記憶監査による創作・事実混同是正の検証】');
  {
    const misclassifiedMem: MemoryItem = {
      id: 'mem_test_fictional_misclassified',
      category: 'memory',
      content: '昔々ドラゴンと魔法使いが住む架空の王国のファンタジー物語の設定',
      factStatus: 'confirmed', // 誤って確定事実として混同登録された状態
      createdAt: Date.now(),
      active: true,
    };
    storageService.saveMemoryItem(misclassifiedMem);

    const auditRes = memoryAuditService.auditEpistemicStatuses(undefined, 50);
    console.log('  [監査結果]:', JSON.stringify(auditRes, null, 2));

    assert(
      '創作物語が確定事実として混同されていた場合に是正フラグが立つこと',
      auditRes.fictionalMisclassifiedAsConfirmed >= 1 &&
      auditRes.flaggedMemoryIds.includes('mem_test_fictional_misclassified')
    );

    const reloaded = storageService.getMemories().find((m) => m.id === 'mem_test_fictional_misclassified');
    assert(
      '是正後の記憶の factStatus が fictional に変更され quarantineReason が記録されていること',
      reloaded?.factStatus === 'fictional' && !!reloaded?.quarantineReason
    );
  }

  console.log(`\n================================================================`);
  console.log(`📊 テスト結果: ${passed} / ${total} 通過 (${Math.round((passed / total) * 100)}%)`);
  console.log('================================================================');

  if (passed !== total) {
    process.exit(1);
  }
  process.exit(0);
}

runEpistemicClassificationTests();
