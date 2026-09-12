/** v47 非LLM設計思想の静的契約チェック。外部サービス・実機を使わない。 */
import fs from 'fs';

const core = fs.readFileSync('src/services/nonLlmCoreService.ts', 'utf8');
const hw = fs.readFileSync('src/services/nonLlmHardwarePipelineService.ts', 'utf8');
const migration = fs.readFileSync('src/services/llmMigrationProtocolService.ts', 'utf8');

const forbidden = [
  /score:\s*50\b/,
  /Math\.random\(\)/,
  /30ms以内/, 
  /CPU・NPU・GPU全機駆動/,
];
for (const [name, text] of [['core', core], ['hardware', hw], ['migration', migration]] as const) {
  for (const pattern of forbidden) {
    if (pattern.test(text)) throw new Error(`${name}: forbidden non-LLM philosophy pattern ${pattern}`);
  }
}
if (!migration.includes('実測値を呼び出し側から受け取る')) throw new Error('migration: measured-input contract missing');
if (!migration.includes("newStatus === 'NON_LLM_DEFAULT'")) throw new Error('migration: default promotion gate missing');
if (!hw.includes("executedBackends: Array<'CPU' | 'NPU' | 'GPU'>")) throw new Error('hardware: backend evidence missing');
if (!hw.includes("const executedBackends: Array<'CPU' | 'NPU' | 'GPU'> = ['CPU'];")) throw new Error('hardware: CPU-first default missing');
if (!core.includes('評価軸・根拠')) throw new Error('core: recommendation evidence guard missing');
console.log('PASS: v47 non-LLM philosophy static contracts');
