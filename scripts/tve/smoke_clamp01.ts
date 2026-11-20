import { clamp01 } from '../../src/miki/core/parts/clamp01Part';

const eq = (a: number, b: number) => a === b;
const ok = eq(clamp01(-0.5), 0) && eq(clamp01(0.3), 0.3) && eq(clamp01(1.7), 1) && eq(clamp01(0), 0) && eq(clamp01(1), 1);
console.log(`SMOKE_PASS_NORMAL: clamp01 spec ${ok ? 'OK' : 'NG'} (-0.5->0, 0.3->0.3, 1.7->1, 0->0, 1->1)`);
process.exit(ok ? 0 : 1);
