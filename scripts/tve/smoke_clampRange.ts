// P1099 教師検証用 smoke: clampRange の仕様確認（教師 Muse が実走する）
import { clampRange } from '../../src/miki/core/parts/clampRangePart';
if (!(clampRange(5, 0, 3) === 3 && clampRange(-1, 0, 3) === 0 && clampRange(2, 0, 3) === 2)) { console.log('SMOKE_FAIL_NORMAL'); process.exit(1); }
console.log('SMOKE_PASS_NORMAL ' + ([clampRange(5,0,3), clampRange(-1,0,3), clampRange(2,0,3)].join(',')));
