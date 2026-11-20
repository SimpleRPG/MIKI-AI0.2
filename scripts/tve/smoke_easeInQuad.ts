import { easeInQuad } from '../../src/miki/core/parts/easeInQuadPart';

const cases: Array<[number, number]> = [[0, 0], [0.25, 0.0625], [0.5, 0.25], [0.75, 0.5625], [1, 1]];
let ok = true;
for (const [x, expected] of cases) {
  const actual = easeInQuad(x);
  if (Math.abs(actual - expected) > 1e-12) { ok = false; console.log(`MISMATCH easeInQuad(${x}) = ${actual}, expected ${expected}`); }
}
console.log(ok ? 'SMOKE_PASS_NORMAL: easeInQuad は 0..1 で二乗カーブ（0→0、0.5→0.25、1→1）' : 'SMOKE_FAIL: easeInQuad');
if (!ok) process.exit(1);
