import { strict as assert } from 'node:assert';
import { extractWebSemanticUnits } from '../src/miki/research/services/webContentUnderstandingService';

const source = [
  'データベースとは、データを体系的に保存して検索できる仕組みです。',
  '処理は入力が空の場合に停止します。',
  'ネットワーク障害のため、要求は失敗します。',
  '高度な操作を始める前に管理者認証が必要です。',
  'まず最初に設定ファイルを読み込んでから実行します。',
  'ただし管理者権限がない場合は処理を実行できません。',
  'The cache is a temporary store for derived data.',
  'The client requires an active session before protected actions.',
].join('\n');

const units = extractWebSemanticUnits(source, 12, 'fixture://web-content-understanding');
const has = (kind: string) => units.some(unit => unit.kind === kind);

assert.ok(has('DEFINITION'), 'definition statements should become semantic units');
assert.ok(has('CONDITION'), 'condition statements should retain condition structure');
assert.ok(has('CAUSE'), 'causal/explanatory statements should be identified');
assert.ok(has('PREREQUISITE'), 'prerequisites should be identified');
assert.ok(has('PROCEDURE'), 'procedural statements should be identified');
assert.ok(has('EXCEPTION'), 'exception statements should be identified');

const exception = units.find(unit => unit.kind === 'EXCEPTION');
assert.ok(exception, 'exception candidate should exist');
assert.equal(exception.polarity, 'NEGATIVE', 'negative polarity must not be discarded');
assert.ok(exception.exceptions.length > 0, 'exception phrase should be retained');

for (const unit of units) {
  assert.ok(unit.sourceStart >= 0 && unit.sourceEnd > unit.sourceStart, 'source offsets should be valid');
  assert.equal(
    source.slice(unit.sourceStart, unit.sourceEnd),
    unit.statement,
    'the structured statement must map to its exact source fragment',
  );
  assert.ok(unit.sourceFragmentSha256.length >= 16, 'source fragment hash should be retained');
  assert.ok(unit.extractionConfidence > 0 && unit.extractionConfidence < 1);
}

assert.ok(
  extractWebSemanticUnits(source, 2, 'fixture://bounded').length <= 2,
  'per-page extraction must stay bounded',
);

console.log(`PASS web content understanding: ${units.length} structured candidates; source offsets, polarity and bounds verified`);
