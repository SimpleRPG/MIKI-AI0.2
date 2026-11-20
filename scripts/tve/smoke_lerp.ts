import { lerp } from '../../src/miki/core/parts/lerpPart';

const eq = (a: number, b: number) => Math.abs(a - b) < 1e-9;
const ok = eq(lerp(2, 6, 0.25), 3) && eq(lerp(10, 0, 0.5), 5) && eq(lerp(5, 5, 0.7), 5) && eq(lerp(0, 100, 0), 0) && eq(lerp(0, 100, 1), 100);
console.log(`SMOKE_PASS_NORMAL: lerp spec ${ok ? 'OK' : 'NG'} ((2,6,0.25)->3, (10,0,0.5)->5, (0,100,0)->0, (0,100,1)->100)`);
process.exit(ok ? 0 : 1);
