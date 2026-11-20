import { mulberry32 } from '../../src/miki/core/parts/mulberry32Part';

const r1 = mulberry32(42);
const seq1 = [r1(), r1(), r1(), r1(), r1()];
const r2 = mulberry32(42);
const seq2 = [r2(), r2(), r2(), r2(), r2()];
const det = seq1.every((v, i) => v === seq2[i]);
const inRange = seq1.every((v) => v >= 0 && v < 1);
const varied = new Set(seq1).size === seq1.length;
const ok = det && inRange && varied;
console.log(`SMOKE_PASS_NORMAL: mulberry32 spec ${ok ? 'OK' : 'NG'} (seed42 deterministic, range [0,1), seq=${seq1.map((v) => v.toFixed(4)).join(',')})`);
process.exit(ok ? 0 : 1);
