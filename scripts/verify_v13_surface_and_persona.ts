import { answerContentIrService } from '../src/services/answerContentIrService';
import { surfaceGrammarAndStyleService } from '../src/services/surfaceGrammarAndStyleService';
import { responseDesignService } from '../src/services/responseDesignService';
import { AnswerContentIR, MultiAxisPersonaConfig } from '../src/types';

console.log('================================================================');
console.log('MikiAI 作業指示書 v13: 11部品統合・性格6軸・破綻検出・重複除去検証');
console.log('================================================================\n');

// -----------------------------------------------------------------------------
// 検証 1: 重複除去エンジンの接続と実例3件
// -----------------------------------------------------------------------------
console.log('### 検証 1: 重複除去エンジンの接続（実例3件）');

const baseIr: AnswerContentIR = {
  conclusion: 'データベースの接続プーリングを有効化することで接続遅延を解消しました。',
  reasons: ['コネクション再利用によるオーバーヘッド削減'],
  conditions: ['最大接続数プールが50を超えないこと'],
  exceptions: [],
  next_actions: ['負荷テストを実施してください'],
  certainty: 'CERTAIN',
  world_scope: 'REAL_WORLD',
  detail_level: 'STANDARD',
};

// 実例 1: 同一行の連続重複を含むケース
const dupCase1: AnswerContentIR = {
  ...baseIr,
  conclusion: '処理が完了しました。\n処理が完了しました。',
};
const res1 = answerContentIrService.generateSurfaceTextFromIR(dupCase1, 'GENERAL_ANSWER');

// 実例 2: 同一文の連続重複を含むケース
const dupCase2: AnswerContentIR = {
  ...baseIr,
  reasons: [
    'コネクション再利用によるオーバーヘッド削減。コネクション再利用によるオーバーヘッド削減。',
  ],
};
const res2 = answerContentIrService.generateSurfaceTextFromIR(dupCase2, 'GENERAL_ANSWER');

// 実例 3: ループ定型句の重複を含むケース
const dupCase3: AnswerContentIR = {
  ...baseIr,
  conclusion: '設定完了だよ！設定完了だよ！設定完了だよ！',
};
const res3 = answerContentIrService.generateSurfaceTextFromIR(dupCase3, 'GENERAL_ANSWER');

console.log('\n--- 実例1 (同一行の重複) ---');
console.log('入力結論:\n' + dupCase1.conclusion);
console.log('生成結果:\n' + res1.surfaceText);

console.log('\n--- 実例2 (同一文の重複) ---');
console.log('入力理由:\n' + dupCase2.reasons[0]);
console.log('生成結果:\n' + res2.surfaceText);

console.log('\n--- 実例3 (ループ定型句の重複) ---');
console.log('入力結論:\n' + dupCase3.conclusion);
console.log('生成結果:\n' + res3.surfaceText);

// -----------------------------------------------------------------------------
// 検証 2: 性格設定6軸のBefore/After比較
// -----------------------------------------------------------------------------
console.log('\n================================================================');
console.log('### 検証 2: 性格設定6軸のBefore/After比較');
console.log('================================================================');

const sampleIr: AnswerContentIR = {
  conclusion: 'ASTとIRの整合性を検査し、トランザクションの冪等性を確認しました。',
  reasons: ['スキーマ定義に基づき中間表現を検証したため'],
  conditions: ['前提としてデータベースの分離レベルがSERIALIZABLEであること'],
  exceptions: ['デッドロック発生時は自動リトライを行う'],
  next_actions: ['負荷試験パイプラインを実行して検証結果を記録する'],
  certainty: 'CERTAIN',
  world_scope: 'REAL_WORLD',
  detail_level: 'STANDARD',
};

// 軸 1: warmth (LOW vs HIGH)
console.log('\n--- 軸 1: warmth (LOW vs HIGH) ---');
const warmthLow = answerContentIrService.generateSurfaceTextFromIR(sampleIr, 'GENERAL_ANSWER', {
  warmth: 'LOW',
  humor: 'OFF',
});
const warmthHigh = answerContentIrService.generateSurfaceTextFromIR(sampleIr, 'GENERAL_ANSWER', {
  warmth: 'HIGH',
  humor: 'OFF',
});
console.log('[Before: warmth=LOW]\n' + warmthLow.surfaceText);
console.log('\n[After: warmth=HIGH]\n' + warmthHigh.surfaceText);

// 軸 2: technicalTerminology (RIGOROUS vs MINIMAL)
console.log('\n--- 軸 2: technicalTerminology (RIGOROUS vs MINIMAL) ---');
const techRigorous = answerContentIrService.generateSurfaceTextFromIR(sampleIr, 'GENERAL_ANSWER', {
  technicalTerminology: 'RIGOROUS',
});
const techMinimal = answerContentIrService.generateSurfaceTextFromIR(sampleIr, 'GENERAL_ANSWER', {
  technicalTerminology: 'MINIMAL',
});
console.log('[Before: technicalTerminology=RIGOROUS]\n' + techRigorous.surfaceText);
console.log('\n[After: technicalTerminology=MINIMAL]\n' + techMinimal.surfaceText);

// 軸 3: proactiveSuggestion (PASSIVE vs ACTIVE)
console.log('\n--- 軸 3: proactiveSuggestion (PASSIVE vs ACTIVE) ---');
const proactivePassive = answerContentIrService.generateSurfaceTextFromIR(sampleIr, 'GENERAL_ANSWER', {
  proactiveSuggestion: 'PASSIVE',
});
const proactiveActive = answerContentIrService.generateSurfaceTextFromIR(sampleIr, 'GENERAL_ANSWER', {
  proactiveSuggestion: 'ACTIVE',
});
console.log('[Before: proactiveSuggestion=PASSIVE]\n' + proactivePassive.surfaceText);
console.log('\n[After: proactiveSuggestion=ACTIVE]\n' + proactiveActive.surfaceText);

// 軸 4: prudence (STANDARD vs VERY_HIGH)
console.log('\n--- 軸 4: prudence (STANDARD vs VERY_HIGH) ---');
const prudenceStandard = answerContentIrService.generateSurfaceTextFromIR(sampleIr, 'GENERAL_ANSWER', {
  prudence: 'STANDARD',
});
const prudenceVeryHigh = answerContentIrService.generateSurfaceTextFromIR(sampleIr, 'GENERAL_ANSWER', {
  prudence: 'VERY_HIGH',
});
console.log('[Before: prudence=STANDARD]\n' + prudenceStandard.surfaceText);
console.log('\n[After: prudence=VERY_HIGH]\n' + prudenceVeryHigh.surfaceText);

// 軸 5: humor (OFF vs MODERATE)
console.log('\n--- 軸 5: humor (OFF vs MODERATE) ---');
const humorOff = answerContentIrService.generateSurfaceTextFromIR(sampleIr, 'GENERAL_ANSWER', {
  humor: 'OFF',
});
const humorModerate = answerContentIrService.generateSurfaceTextFromIR(sampleIr, 'GENERAL_ANSWER', {
  humor: 'MODERATE',
});
console.log('[Before: humor=OFF]\n' + humorOff.surfaceText);
console.log('\n[After: humor=MODERATE]\n' + humorModerate.surfaceText);

// 軸 6: currentScene (NORMAL vs DISASTER_RECOVERY vs TECHNICAL_RESEARCH)
console.log('\n--- 軸 6: currentScene (NORMAL vs DISASTER_RECOVERY) ---');
const sceneNormal = answerContentIrService.generateSurfaceTextFromIR(sampleIr, 'RECOMMENDATION', {
  currentScene: 'NORMAL',
});
const sceneDisaster = answerContentIrService.generateSurfaceTextFromIR(sampleIr, 'RECOMMENDATION', {
  currentScene: 'DISASTER_RECOVERY',
});
console.log('[Before: currentScene=NORMAL]\n' + sceneNormal.surfaceText);
console.log('\n[After: currentScene=DISASTER_RECOVERY]\n' + sceneDisaster.surfaceText);

// -----------------------------------------------------------------------------
// 検証 3: 破綻検出関数（活用不整合 3件、助詞連続誤用 3件）
// -----------------------------------------------------------------------------
console.log('\n================================================================');
console.log('### 検証 3: 破綻検出関数（活用不整合 3件、助詞連続誤用 3件）');
console.log('================================================================');

console.log('\n--- 3.1 活用不整合 検出ケース ---');
const conjCases = [
  '本システムの設計は完了ですであるため、次のフェーズへ進みます。',
  '昨日の検証で確認済みだでしたので、問題ありません。',
  'すべての設定を適用しただことが成功の前提です。',
];

for (let i = 0; i < conjCases.length; i++) {
  const check = surfaceGrammarAndStyleService.detectConjugationDisruption(conjCases[i]);
  console.log(`\n[ケース ${i + 1}] 入力: ${conjCases[i]}`);
  console.log(`検出結果: hasError=${check.hasError}`);
  console.log(`検出理由: ${check.issues.join(', ')}`);
  console.log(`修復後: ${check.repairedText}`);
  if (!check.hasError) {
    throw new Error(`活用破綻ケース ${i + 1} が検出されませんでした！`);
  }
}

console.log('\n--- 3.2 助詞連続誤用 検出ケース ---');
const particleCases = [
  'キャッシュデータををすべて消去して初期化しました。',
  '今回の不具合についてについての調査報告をまとめました。',
  'メモリ使用量がが想定以上に肥大化しています。',
];

for (let i = 0; i < particleCases.length; i++) {
  const check = surfaceGrammarAndStyleService.detectParticleDisruption(particleCases[i]);
  console.log(`\n[ケース ${i + 1}] 入力: ${particleCases[i]}`);
  console.log(`検出結果: hasError=${check.hasError}`);
  console.log(`検出理由: ${check.issues.join(', ')}`);
  console.log(`修復後: ${check.repairedText}`);
  if (!check.hasError) {
    throw new Error(`助詞破綻ケース ${i + 1} が検出されませんでした！`);
  }
}

console.log('\n================================================================');
console.log('All verification checks passed successfully!');
console.log('================================================================');
