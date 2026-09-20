import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
const read=p=>readFileSync(p,'utf8');
const ui=read('android/app/src/main/assets/public/index.html');
const android=read('ANDROID_BUILD.md');
const jp=read('src/data/japaneseKnowledgeData.ts');
const moe=read('src/utils/moeRouter.ts');
const server=read('server.ts');
const checks={
  androidHtmlClean:!ui.includes('WebLLM local execution')&&!ui.includes('on-device MoE'),
  androidGuideCurrent:android.includes('Deterministic Non-LLM Core')&&!/llama\.cpp|MLC-LLM|WebLLM|GGUF/i.test(android),
  japaneseGuidanceCurrent:!jp.includes('WebLLMが機械的')&&!jp.includes('WebLLM推論プロンプト'),
  utilityCommentsCurrent:!moe.includes('llama.cpp / vLLM'),
  serverCommentCurrent:server.includes('外部教師未使用時は構造解析のみ実施')&&!server.includes('モデル生成系ランタイム ネット大海探索'),
  oldDesignRemoved:!existsSync('docs/非LLM中心_自己成長型AIコンパニオン_設計思想指示書_統合版.md'),
};
const passed=Object.values(checks).every(Boolean);
console.log(JSON.stringify({version:'v196',passed,checks},null,2));
if(!passed)process.exit(1);
