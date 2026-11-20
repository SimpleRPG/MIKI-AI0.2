// P1099 教師検証用 smoke: euclideanDistance の仕様確認（教師 Muse が実走する）
import { euclideanDistance } from '../../src/miki/core/parts/euclideanDistancePart';
if (!(euclideanDistance(0, 0, 3, 4) === 5 && euclideanDistance(1, 1, 1, 1) === 0)) { console.log('SMOKE_FAIL_NORMAL'); process.exit(1); }
console.log('SMOKE_PASS_NORMAL: ' + (euclideanDistance(0,0,3,4)));
