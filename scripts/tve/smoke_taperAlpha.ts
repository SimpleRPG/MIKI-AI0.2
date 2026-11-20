import { taperAlpha } from '../../src/miki/core/parts/taperAlphaPart';

const eq = (a: number, b: number) => Math.abs(a - b) < 1e-9;
const ok = taperAlpha(0, 140, 0.8) === 0 && eq(taperAlpha(70, 140, 0.8), 0.8) && taperAlpha(140, 140, 0.8) === 0 && taperAlpha(139, 140, 0.8) < 0.02;
console.log(`SMOKE_PASS_NORMAL: taperAlpha spec ${ok ? 'OK' : 'NG'} ((0,140,0.8)->0, (70,140,0.8)->0.8, (140,140,0.8)->0)`);
process.exit(ok ? 0 : 1);
