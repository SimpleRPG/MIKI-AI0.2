import { smoothstep01 } from '../../src/miki/core/parts/smoothstep01Part';

const eq = (a: number, b: number) => Math.abs(a - b) < 1e-9;
const ok = eq(smoothstep01(0.25), 0.15625) && eq(smoothstep01(0.5), 0.5) && eq(smoothstep01(0.75), 0.84375) && smoothstep01(-1) === 0 && smoothstep01(2) === 1;
console.log(`SMOKE_PASS_NORMAL: smoothstep01 spec ${ok ? 'OK' : 'NG'} (0.25->0.15625, 0.5->0.5, 0.75->0.84375, -1->0, 2->1)`);
process.exit(ok ? 0 : 1);
