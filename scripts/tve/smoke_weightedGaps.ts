import { weightedGaps } from '../../src/miki/core/parts/weightedGapsPart';

const ok = JSON.stringify(weightedGaps([1, 1, 1, 1], 40)) === '[0,10,20,30]' && JSON.stringify(weightedGaps([1, 3], 8)) === '[0,2]' && JSON.stringify(weightedGaps([], 10)) === '[]';
console.log(`SMOKE_PASS_NORMAL: weightedGaps spec ${ok ? 'OK' : 'NG'} ([1,1,1,1],40->[0,10,20,30], [1,3],8->[0,2])`);
process.exit(ok ? 0 : 1);
