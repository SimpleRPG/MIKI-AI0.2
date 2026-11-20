import { sinePhase } from '../../src/miki/core/parts/sinePhasePart';

const eq = (a: number, b: number) => Math.abs(a - b) < 1e-9;
const ok = eq(sinePhase(0, 40, 0, 2), 0) && eq(sinePhase(10, 40, 0, 2), 2) && Math.abs(sinePhase(20, 40, 0, 2)) < 1e-9 && eq(sinePhase(30, 40, 0, 2), -2);
console.log(`SMOKE_PASS_NORMAL: sinePhase spec ${ok ? 'OK' : 'NG'} ((0,40,0,2)->0, (10,40,0,2)->2, (30,40,0,2)->-2)`);
process.exit(ok ? 0 : 1);
