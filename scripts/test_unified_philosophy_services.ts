import { claimDatabaseService } from '../src/services/claimDatabaseService';
import { requestTypeCompilerService } from '../src/services/requestTypeCompilerService';
import { componentRegistryService } from '../src/services/componentRegistryService';
import { worldModelService } from '../src/services/worldModelService';
import { formalConstraintSolverService } from '../src/services/formalConstraintSolverService';

console.log('='.repeat(64));
console.log('🧪 統合版設計思想主要サービス & 第59章 動作実態検証テスト');
console.log('='.repeat(64));

let passCount = 0;
let totalCount = 0;

function assert(condition: boolean, msg: string) {
  totalCount++;
  if (condition) {
    console.log(`✅ [PASS] ${msg}`);
    passCount++;
  } else {
    console.error(`❌ [FAIL] ${msg}`);
  }
}

// ── 1. claimDatabaseService (統合版 第6章) ──
console.log('\n【1. claimDatabaseService (統合版 第6章: 主張DB)】');
const initialClaims = claimDatabaseService.getAllClaims();
assert(initialClaims.length >= 4, `初期シード主張が存在すること (現在: ${initialClaims.length}件)`);

// 1-1 新規主張登録
const registered = claimDatabaseService.registerClaim({
  statement: 'SQLiteはWALモードを使用すると並行読込性能が向上する',
  world: 'REAL',
  kind: 'FACT_CLAIM',
  status: 'DEVICE_VERIFIED',
  scope: { environment: 'Node.js', runtime: 'better-sqlite3' },
  source: 'official_benchmark',
  maturity: 'MATURE',
  self_provenance: 'INDEPENDENTLY_SUPPORTED',
});
assert(registered.claim_id.startsWith('CLM-'), `新規主張IDが採番されていること: ${registered.claim_id}`);
assert(registered.world === 'REAL', '世界の区分がREALであること');

// 1-2 自己証明の禁止 (6.7節)
const selfProved = claimDatabaseService.registerClaim({
  statement: 'AI自身が考えた理論は無条件で真である',
  world: 'REAL',
  kind: 'FACT_CLAIM',
  status: 'SUPPORTED', // AI出力なのにSUPPORTEDを主張
  source: 'ai_output', // AI自己生成
});
assert(
  selfProved.status === 'UNVERIFIED',
  `AI自己生成出力を単独でSUPPORTEDにできずUNVERIFIEDに降格されること (実際: ${selfProved.status})`
);
assert(selfProved.self_provenance === 'SELF_SUPPORTED', '自己生成フラグがSELF_SUPPORTEDであること');

// 1-3 矛盾検出と上書き(SUPERSEDE)関係
const candidateContradiction = {
  claim_id: 'CLM-TEMP-01',
  statement: '特定条件で長い入力時にDevice Lostが発生しない',
  world: 'REAL' as const,
  kind: 'OBSERVATION' as const,
  status: 'UNVERIFIED' as const,
  scope: { device: 'Galaxy S25', environment: 'Termux', backend: 'Vulkan' },
  source: 'test_observation',
  maturity: 'DISCOVERED' as const,
  self_provenance: 'INDEPENDENTLY_SUPPORTED' as const,
  created_at: Date.now(),
  updated_at: Date.now(),
};
const conflicts = claimDatabaseService.detectContradictions(candidateContradiction);
assert(conflicts.length > 0, `矛盾関係が検出されること (検出件数: ${conflicts.length}, 対象: ${conflicts[0]?.statement})`);

// 1-4 上書き(supersede)と成熟度昇格(promoteMaturity)
const supersededOk = claimDatabaseService.supersedeClaim(
  'CLM-000001',
  registered.claim_id,
  '新しいベンチマークにより更新'
);
assert(supersededOk === true, '既存主張をSUPERSEDED状態に更新できること');

const stats = claimDatabaseService.getSummaryStats();
assert(stats.total >= 5, `主張総数が集計されること: ${stats.total}`);

// ── 2. requestTypeCompilerService (統合版 第10.1節) ──
console.log('\n【2. requestTypeCompilerService (統合版 第10.1節: 要求型コンパイラ)】');
const vbaRequest = 'Excelで売上データの重複を削除して、高速に一括転記するVBAマクロを作って。元データは壊さないで';
const compiled = requestTypeCompilerService.compile(vbaRequest);

assert(compiled.requestId.startsWith('REQ-'), `要求IDが発行されていること: ${compiled.requestId}`);
assert(compiled.goal.includes('Excel/VBA'), `Goalが適切に抽出されていること: ${compiled.goal}`);
assert(compiled.deliverables.some(d => d.includes('VBA')), '納品成果物にVBAモジュールが含まれること');
assert(compiled.prohibitions.some(p => p.includes('Option Explicit')), '禁止事項に未宣言変数禁止(Option Explicit必須)が含まれること');
assert(compiled.prohibitions.some(p => p.includes('上書き保存禁止')), '安全指示から元データ上書き禁止が抽出されること');
assert(compiled.canExecuteDeterministically === true, '定型VBA指示が決定論的実行可能(true)と判定されること');
assert(compiled.sideEffectClass === 'LOCAL_WRITE', '副作用クラスがLOCAL_WRITEと判定されること');

// ── 3. componentRegistryService (統合版 第9章) ──
console.log('\n【3. componentRegistryService (統合版 第9章: 部品レジストリ)】');
const allComponents = componentRegistryService.getAllComponents();
assert(allComponents.length >= 4, `シード部品が登録されていること (現在: ${allComponents.length}件)`);

// 3-1 重複判定 (9.4節)
const dupCheck = componentRegistryService.evaluateNewComponentCandidate({
  implementationCode: 'Dim ws As Worksheet\nSet ws = ActiveSheet',
  entryPoint: 'GetActiveSheet',
  purpose: 'ワークシートの安全な取得',
  securityClass: 'READ_ONLY',
});
assert(['REUSE', 'COMPOSE', 'NEW', 'EXTEND', 'DUPLICATE'].includes(dupCheck.decision), `部品評価決定が有効であること: ${dupCheck.decision}`);

// 3-2 決定論的VBAマクロ合成
const synthesized = componentRegistryService.synthesizeVbaMacro({
  macroName: 'ConsolidateSalesData',
  sourceSheetName: 'RawData',
  headerKeyName: '売上番号',
  destSheetName: 'Summary',
});
assert(synthesized.success === true, '合成が成功すること');
assert(synthesized.assembledCode.includes('Option Explicit'), '合成されたコードにOption Explicitが含まれること');
assert(synthesized.assembledCode.includes('Sub ConsolidateSalesData()'), 'プロシージャ名が反映されていること');
assert(synthesized.assembledCode.includes('FindColumnByHeader'), '動的見出し検索部品が組み込まれていること');
assert(synthesized.assembledCode.includes('ReadRangeToBatchArray'), '配列一括読込部品が組み込まれていること');
assert(synthesized.usedComponents.length > 0, `利用された登録部品が存在すること: [${synthesized.usedComponents.join(', ')}]`);

// ── 4. worldModelService (統合版 第7.1〜7.2節 / 第52章) ──
console.log('\n【4. worldModelService (統合版 第7.1〜7.2節 / 第52章: 世界モデル)】');
const sampleMemories: any[] = [
  { id: 'mem_1', content: 'ユーザーはExcel 2019を使用中', tags: ['env'] },
];
const prediction = worldModelService.predictAction(
  'VBAで重複データを抽出するコードを作ってほしい',
  sampleMemories,
  { name: 'Miki', tone: 'helpful' } as any
);
assert(prediction.predictionId.startsWith('pred_'), `予測IDが生成されること: ${prediction.predictionId}`);
assert(prediction.expectedIntent.length > 0, `発話意図が予測されること: ${prediction.expectedIntent}`);

// 実際の結果を記録して予測誤差を算出
const errorRecord = worldModelService.recordOutcomeAndComputeError(
  prediction,
  {
    assistantResponse: '了解！Excel 2019環境に合わせて、重複データを高速抽出するVBAコードを用意したよ。\n```vba\nSub Extract()\nEnd Sub\n```',
    actualUsedMemories: [{ id: 'mem_1', content: 'Excel 2019' }],
    actualUsedSkills: [{ id: 'vba_batch', name: 'VBA Batch' }],
    executionError: false,
    userFeedback: 'good',
  }
);
assert(errorRecord.predictionId === prediction.predictionId, '予測結果と誤差レコードが紐づいていること');
assert(typeof errorRecord.predictionError.errorMagnitude === 'number', `誤差強度スコア(errorMagnitude)が算出されること: ${errorRecord.predictionError.errorMagnitude}`);
assert(errorRecord.predictionError.errorCategory !== undefined, `誤差分類が判定されること: ${errorRecord.predictionError.errorCategory}`);

// ── 5. formalConstraintSolverService (第59章) ──
console.log('\n【5. formalConstraintSolverService (第59章: 形式知識・制約ソルバー)】');
// 5-1 SAT 充足判定
const satResult = formalConstraintSolverService.solveCSP({
  targetModel: ['Qwen-3B-Base'],
  activeWeights: ['IMMUTABLE'],
  dataPrivacyLevel: ['CONFIDENTIAL'],
  networkDestination: ['LOCAL_CONTAINER'],
});
assert(satResult.isSatisfied === true, '不変条件を満たす変数组で CSP が SAT (充足) となること');

// 5-2 UNSAT 矛盾検知
const unsatResult = formalConstraintSolverService.solveCSP({
  targetModel: ['Qwen-3B-Base'],
  activeWeights: ['MODIFIED_ONLINE'], // 不変保護制約違反
});
assert(unsatResult.isSatisfied === false, '重み変更違反で CSP が UNSAT (矛盾) と判定されること');
assert(unsatResult.contradictionsFound.length > 0, '矛盾検出内容が記録されること');

console.log('\n' + '='.repeat(64));
console.log(`📊 テスト結果: ${passCount} / ${totalCount} 通過 (${Math.round((passCount / totalCount) * 100)}%)`);
console.log('='.repeat(64));

if (passCount !== totalCount) {
  process.exit(1);
} else {
  process.exit(0);
}
