import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read=p=>readFileSync(p,'utf8');
const ui=read('src/components/self_improvement/SelfCodeArchitectTab.tsx');
const loop=read('src/components/self_improvement/EvidenceBasedLoopSubView.tsx');
const design=read('docs/MIKI_AI_18_DOMAIN_DESIGN_PHILOSOPHY.txt');
const checks={
  noVisibleChapterLabelPatterns:!/(第\\$\\{[^}]+\\}章|第\\{[^}]+\\}章|第\\d+(?:\\.\\d+)?章)/.test(ui)&&!/(第\\$\\{[^}]+\\}章|第\\{[^}]+\\}章|第\\d+(?:\\.\\d+)?章)/.test(loop),
  internalChapterNumberRetained:ui.includes('chapterNumber'),
  usesTargetSpecLanguage:ui.includes('対象仕様')||ui.includes('選択した仕様'),
  spec:design.includes('新UIの章番号表示を除去')
};
assert.equal(Object.values(checks).every(Boolean),true);
console.log(JSON.stringify({version:'v186',passed:true,checks},null,2));
