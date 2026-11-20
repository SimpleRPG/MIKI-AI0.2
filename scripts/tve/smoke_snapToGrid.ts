// P1099 教師検証用 smoke: snapToGrid の仕様確認（教師 Muse が実走する）
import { snapToGrid } from '../../src/miki/core/parts/snapToGridPart';
if (!(snapToGrid(13, 5) === 15 && snapToGrid(12, 5) === 10 && snapToGrid(7, 0) === 7)) { console.log('SMOKE_FAIL_NORMAL'); process.exit(1); }
console.log('SMOKE_PASS_NORMAL: ' + (snapToGrid(13,5)));
