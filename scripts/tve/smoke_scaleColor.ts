// P1099 教師検証用 smoke: scaleColor の仕様確認（教師 Muse が実走する）
import { scaleColor } from '../../src/miki/core/parts/scaleColorPart';
if (!(JSON.stringify(scaleColor([100,200,300],0.5)) === '[50,100,150]' && JSON.stringify(scaleColor([200,10,10],2)) === '[255,20,20]')) { console.log('SMOKE_FAIL_NORMAL'); process.exit(1); }
console.log('SMOKE_PASS_NORMAL ' + (scaleColor([100,200,300],0.5).join(',')));
