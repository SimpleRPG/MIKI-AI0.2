/*
 * P1093: コード部品ドリルの土台部品（教師＝Claude 製、彼女への引き渡し用）。
 * t を 0..1 にクランプしてから t*t*(3-2*t) を返す滑らかな階段関数。
 * 髪の柔らかさ部品（P1092）の中で使われた形そのもの。
 * 小さい純関数の部品として、彼女の部品棚に CANDIDATE で登録し、
 * 検証の梯子で VERIFIED に上げる。
 */
export function smoothstep01(t: number): number {
  const c = Math.max(0, Math.min(1, t));
  return c * c * (3 - 2 * c);
}
