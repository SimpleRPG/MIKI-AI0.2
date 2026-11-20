// P1099 教師検証用 smoke: chanceRoll の仕様確認（教師 Muse が実走する）
import { chanceRoll } from '../../src/miki/core/parts/chanceRollPart';
if (!((() => { for (let s = 1; s <= 50; s++) { if (chanceRoll(s, 0) !== false) return false; if (chanceRoll(s, 1) !== true) return false; if (chanceRoll(s, 0.5) !== chanceRoll(s, 0.5)) return false; } return true; })())) { console.log('SMOKE_FAIL_NORMAL'); process.exit(1); }
console.log('SMOKE_PASS_NORMAL: ' + (String(chanceRoll(42, 0.5))));
