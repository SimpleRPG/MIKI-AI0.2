import { classifyClaimEpistemology } from '../src/services/falsificationService';
import { memoryAuditService } from '../src/services/memoryAuditService';
import { storageService } from '../src/services/storageService';
import { MemoryItem } from '../src/types';

function runEpistemicClassificationTests() {
  console.log('================================================================');
  console.log('🧪 フェーズ2: 主張・証拠の認識論的分類 (現実/創作/仮定) ロジック単体テスト');
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

  // ── 1. 創作・架空・ロールプレイ (fictional) の検証 ──
  console.log('【パターン1: 創作・架空・物語 (fictional)】');
  const fictionalCases = [
    '宇宙海賊が未知の惑星を冒険するSFファンタジー物語を創作してほしい',
    'このキャラ設定として、普段は無口な魔法使いという設定でロールプレイしよう',
    '昔々ある森に小さなドラゴンが住んでいましたという童話ストーリーを書いてみて',
  ];

  for (const c of fictionalCases) {
    const res = classifyClaimEpistemology(c);
    console.log(`  [入力]: "${c}"`);
    console.log(`  [判定]: status=${res.status}, confidence=${res.confidence.toFixed(2)}, markers=[${res.detectedMarkers.join(', ')}], reasons=[${res.reasons.join(', ')}]`);
    assert(
      `創作表現が 'fictional' と判定されること: "${c.slice(0, 20)}..."`,
      res.status === 'fictional' && res.detectedMarkers.length > 0 && res.confidence >= 0.75
    );
  }

  // ── 2. 仮定・反実仮想・思考実験 (hypothetical) の検証 ──
  console.log('\n【パターン2: 仮定・反実仮想・思考実験 (hypothetical)】');
  const hypotheticalCases = [
    'もしもサーバーがダウンして全ノードが停止したらどうフェイルオーバーする？',
    '仮にメモリが512MBしかない組み込み環境だったとしたら、どの軽量DBを選ぶ？',
    '仮想的にユーザー数が1000万人に急増した場合をシミュレーションしてみて',
  ];

  for (const c of hypotheticalCases) {
    const res = classifyClaimEpistemology(c);
    console.log(`  [入力]: "${c}"`);
    console.log(`  [判定]: status=${res.status}, confidence=${res.confidence.toFixed(2)}, markers=[${res.detectedMarkers.join(', ')}], reasons=[${res.reasons.join(', ')}]`);
    assert(
      `仮定表現が 'hypothetical' と判定されること: "${c.slice(0, 20)}..."`,
      res.status === 'hypothetical' && res.detectedMarkers.length > 0 && res.confidence >= 0.7
    );
  }

  // ── 3. 客観的事実・確定事項 (confirmed) の検証 ──
  console.log('\n【パターン3: 客観的事実・確定事項 (confirmed)】');
  const confirmedCases = [
    'TypeScript 5.0が正式リリースされた',
    'ポート3000のプロセスを終了し、正常にサーバーが動作した',
    'チーム会議でデータベースをSQLiteに決定した',
  ];

  for (const c of confirmedCases) {
    const res = classifyClaimEpistemology(c);
    console.log(`  [入力]: "${c}"`);
    console.log(`  [判定]: status=${res.status}, confidence=${res.confidence.toFixed(2)}, markers=[${res.detectedMarkers.join(', ')}], reasons=[${res.reasons.join(', ')}]`);
    assert(
      `確定表現が 'confirmed' と判定されること: "${c.slice(0, 20)}..."`,
      res.status === 'confirmed' && res.detectedMarkers.length > 0 && res.confidence >= 0.7
    );
  }

  // ── 4. 未検証・推測・伝聞 (unverified) の検証 ──
  console.log('\n【パターン4: 未検証・推測・伝聞 (unverified)】');
  const unverifiedCases = [
    '来週新しいモデルが出るらしいよ',
    'パフォーマンスが向上するかもしれない気がする',
    '噂ではそのライブラリは非推奨になるはずだ',
  ];

  for (const c of unverifiedCases) {
    const res = classifyClaimEpistemology(c);
    console.log(`  [入力]: "${c}"`);
    console.log(`  [判定]: status=${res.status}, confidence=${res.confidence.toFixed(2)}, markers=[${res.detectedMarkers.join(', ')}], reasons=[${res.reasons.join(', ')}]`);
    assert(
      `推測・伝聞が 'unverified' と判定されること: "${c.slice(0, 20)}..."`,
      res.status === 'unverified' && res.detectedMarkers.length > 0
    );
  }

  // ── 5. memoryAuditService による混同是正監査の検証 ──
  console.log('\n【パターン5: 記憶監査による創作・事実混同是正の検証】');
  {
    // テスト用の記憶を注入: 創作物語が誤って confirmed と登録されているケース
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
  console.log(`================================================================`);

  if (passed !== total) {
    process.exit(1);
  }
  process.exit(0);
}

runEpistemicClassificationTests();
