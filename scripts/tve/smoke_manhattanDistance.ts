// P1099 教師検証用 smoke: manhattanDistance の仕様確認（教師 Muse が実走する）
import { manhattanDistance } from '../../src/miki/core/parts/manhattanDistancePart';
if (!(manhattanDistance(0, 0, 3, 4) === 7 && manhattanDistance(2, 2, 2, 2) === 0)) { console.log('SMOKE_FAIL_NORMAL'); process.exit(1); }
console.log('SMOKE_PASS_NORMAL ' + (manhattanDistance(0,0,3,4)));
