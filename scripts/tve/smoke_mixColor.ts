// P1099 教師検証用 smoke: mixColor の仕様確認（教師 Muse が実走する）
import { mixColor } from '../../src/miki/core/parts/mixColorPart';
if (!(JSON.stringify(mixColor([0,0,0],[100,200,255],0.5)) === '[50,100,127.5]' && JSON.stringify(mixColor([10,20,30],[100,200,255],2)) === '[100,200,255]')) { console.log('SMOKE_FAIL_NORMAL'); process.exit(1); }
console.log('SMOKE_PASS_NORMAL ' + (mixColor([0,0,0],[100,200,255],0.5).join(',')));
