/*
 * 土台部品（教師製・P1099）: seed から決定的に [min, max] の整数を1つ引く。
 * サイコロ・ランダムエンカウントなどゲーム制作の基本。
 * 同じ seed では必ず同じ値（再現性つき）。乱数器は内蔵する。
 * 純関数・自己完結（import なし）。
 */
export function randomInt(seed: number, min: number, max: number): number {
  let a = seed | 0;
  a = (a + 0x6D2B79F5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  const r = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  const lo = Math.ceil(min);
  const hi = Math.floor(max);
  if (hi < lo) return lo;
  return lo + Math.floor(r * (hi - lo + 1));
}
