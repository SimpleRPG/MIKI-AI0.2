/*
 * 土台部品（教師製・P1099）: seed から決定的に確率判定する。
 * probability (0..1) の確率で true。ドロップ判定・命中判定などに使う。
 * 同じ seed では必ず同じ結果（再現性つき）。乱数器は内蔵する。
 * 純関数・自己完結（import なし）。
 */
export function chanceRoll(seed: number, probability: number): boolean {
  let a = seed | 0;
  a = (a + 0x6D2B79F5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  const r = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  const p = Math.min(1, Math.max(0, probability));
  return r < p;
}
