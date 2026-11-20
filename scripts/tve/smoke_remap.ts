// P1099 教師検証用 smoke: remap の仕様確認（教師 Muse が実走する）
import { remap } from '../../src/miki/core/parts/remapPart';
if (!(remap(5, 0, 10, 0, 100) === 50 && remap(-5, 0, 10, 0, 100) === 0 && remap(15, 0, 10, 0, 100) === 100 && remap(3, 2, 2, 7, 9) === 7)) { console.log('SMOKE_FAIL_NORMAL'); process.exit(1); }
console.log('SMOKE_PASS_NORMAL: ' + ([remap(5,0,10,0,100), remap(15,0,10,0,100)].join(',')));
