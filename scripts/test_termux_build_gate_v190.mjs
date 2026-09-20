import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
const pkg=JSON.parse(readFileSync('package.json','utf8'));
const design=readFileSync('docs/MIKI_AI_18_DOMAIN_DESIGN_PHILOSOPHY.txt','utf8');
const gate='scripts/verify_termux_build_v190.sh';
const checks={
  lintScript:typeof pkg.scripts?.lint==='string'&&pkg.scripts.lint.includes('tsc --noEmit'),
  buildScript:typeof pkg.scripts?.build==='string'&&pkg.scripts.build.includes('vite build'),
  startScript:typeof pkg.scripts?.start==='string'&&pkg.scripts.start.includes('dist/server.cjs'),
  buildGateExists:existsSync(gate),
  typecheckInGate:readFileSync(gate,'utf8').includes('npm run lint'),
  buildInGate:readFileSync(gate,'utf8').includes('npm run build'),
  artifactsChecked:readFileSync(gate,'utf8').includes('dist/index.html')&&readFileSync(gate,'utf8').includes('dist/server.cjs'),
  spec:design.includes('Termux型検査・本番ビルドゲート')
};
const passed=Object.values(checks).every(Boolean);
console.log(JSON.stringify({version:'v190',passed,checks},null,2));
if(!passed)process.exit(1);
