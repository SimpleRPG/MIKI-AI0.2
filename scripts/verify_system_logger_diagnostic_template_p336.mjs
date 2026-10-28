import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('src/services/systemLogger.ts', 'utf8');
const templatePrefix = '    const reportHeader = `';
const templateSuffix = "\n`;\n    return reportHeader;";
const templateStart = source.indexOf(templatePrefix);
assert.ok(templateStart >= 0, 'System diagnostic report template must exist');

const bodyStart = templateStart + templatePrefix.length;
const templateEnd = source.indexOf(templateSuffix, bodyStart);
assert.ok(templateEnd > bodyStart, 'System diagnostic report template must have a closing boundary');

const body = source.slice(bodyStart, templateEnd);
assert.ok(!body.includes('`'), 'Diagnostic report template must not contain unescaped nested backticks');
assert.ok(
  body.includes('Termuxで npm run dev を起動し、APIが http://127.0.0.1:3000 で待機していることを確認します。'),
  'Diagnostic report must preserve the Termux local API startup guidance',
);
assert.ok(
  body.includes('Termuxサーバーが停止中なら、サーバーAPIに依存する機能は利用できません。'),
  'Diagnostic report must preserve the Termux server availability warning',
);

console.log('P336 diagnostic report template delimiter and guidance: PASS');
