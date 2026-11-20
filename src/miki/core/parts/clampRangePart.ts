/*
 * 土台部品（教師製・P1099）: 値を [lo, hi] の範囲に収める。
 * 彼女のコードで59箇所に出てくる clamp パターンの一般形。
 * 純関数・自己完結（import なし）。
 */
export function clampRange(value: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, value));
}
