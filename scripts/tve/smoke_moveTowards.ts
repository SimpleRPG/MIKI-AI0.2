// P1099 教師検証用 smoke: moveTowards の仕様確認（教師 Muse が実走する）
import { moveTowards } from '../../src/miki/core/parts/moveTowardsPart';
if (!(moveTowards(0, 10, 3) === 3 && moveTowards(0, 2, 3) === 2 && moveTowards(10, 0, 4) === 6 && moveTowards(5, 5, 1) === 5)) { console.log('SMOKE_FAIL_NORMAL'); process.exit(1); }
console.log('SMOKE_PASS_NORMAL: ' + ([moveTowards(0,10,3), moveTowards(10,0,4)].join(',')));
