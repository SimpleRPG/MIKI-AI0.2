import { glowPulse } from '../../src/miki/core/parts/glowPulsePart';

const g0 = Math.exp(-2); const u0 = 1 - g0; const edge = 1 - u0 * u0 * u0;
const cases: Array<[number, number]> = [[50, 1], [0, edge], [100, edge]];
let ok = true;
for (const [x, expected] of cases) {
  const actual = glowPulse(x);
  if (Math.abs(actual - expected) > 1e-12) { ok = false; console.log(`MISMATCH glowPulse(${x}) = ${actual}, expected ${expected}`); }
}
if (glowPulse(25) !== glowPulse(75)) { ok = false; console.log('MISMATCH glowPulse は中心対称でない'); }
console.log(ok ? 'SMOKE_PASS_NORMAL: glowPulse は中心(50)で1・縁で合成どおりに落ち・左右対称' : 'SMOKE_FAIL: glowPulse');
if (!ok) process.exit(1);
