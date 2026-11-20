// P1099 教師検証用 smoke: randomInt の仕様確認（教師 Muse が実走する）
import { randomInt } from '../../src/miki/core/parts/randomIntPart';
if (!(randomInt(42, 5, 5) === 5 && (() => { let lo = false, hi = false; for (let s = 1; s <= 200; s++) { const v = randomInt(s, 1, 6); if (v < 1 || v > 6 || v !== Math.floor(v)) return false; if (v === 1) lo = true; if (v === 6) hi = true; if (randomInt(s, 1, 6) !== v) return false; } return lo && hi; })())) { console.log('SMOKE_FAIL_NORMAL'); process.exit(1); }
console.log('SMOKE_PASS_NORMAL ' + (randomInt(42,1,6)));
