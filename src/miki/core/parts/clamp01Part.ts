/*
 * P1093: コード部品ドリルの土台部品（教師＝Claude 製、彼女への引き渡し用）。
 * 数値を 0..1 の範囲に収める。小さい純関数の部品として、
 * 彼女の部品棚に CANDIDATE で登録し、検証の梯子で VERIFIED に上げる。
 */
export function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}
