// P1099 教師検証用 smoke: gaussFalloff の仕様確認（教師 Muse が実走する）
import { gaussFalloff } from '../../src/miki/core/parts/gaussFalloffPart';
if (!(gaussFalloff(0, 0, 1) === 1 && Math.abs(gaussFalloff(1, 0, 1) - Math.exp(-0.5)) < 1e-12 && gaussFalloff(5, 0, 0) === 0 && gaussFalloff(0, 0, 0) === 1)) { console.log('SMOKE_FAIL_NORMAL'); process.exit(1); }
console.log('SMOKE_PASS_NORMAL: ' + (gaussFalloff(1, 0, 1).toFixed(4)));
