/*
 * 合成部品（彼女の合成探索が作成・P1126）: 房の影の落ち込み。
 * 目標 = 余弦の落ち込み（中心1・端0）への当てはめ。許容誤差を
 * 0.01 に締めた試験で、棚の smoothstep01 と lerp の合成として
 * 彼女自身が見つけた（最大誤差 0.0099）。緩い試験（0.03）では
 * 直線の当てはめが通ってしまったため、教師側で試験を締め直した。
 * 状態: CANDIDATE（彼女の梯子で上げる）。
 */
import { smoothstep01 } from './smoothstep01Part';
import { lerp } from './lerpPart';

export function strandFalloff(x: number): number { return smoothstep01(lerp(1, 0, x)); }
