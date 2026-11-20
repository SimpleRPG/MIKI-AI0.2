/*
 * P1093: コード部品ドリルの土台部品（教師＝Claude 製、彼女への引き渡し用）。
 * a から b へ t の割合で線形補間する。小さい純関数の部品として、
 * 彼女の部品棚に CANDIDATE で登録し、検証の梯子で VERIFIED に上げる。
 */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
