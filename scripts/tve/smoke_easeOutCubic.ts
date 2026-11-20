// P1099 教師検証用 smoke: easeOutCubic の仕様確認（教師 Muse が実走する）
import { easeOutCubic } from '../../src/miki/core/parts/easeOutCubicPart';
if (!(easeOutCubic(0) === 0 && easeOutCubic(1) === 1 && Math.abs(easeOutCubic(0.5) - 0.875) < 1e-12)) { console.log('SMOKE_FAIL_NORMAL'); process.exit(1); }
console.log('SMOKE_PASS_NORMAL: ' + (easeOutCubic(0.5)));
