/*
 * P1093: コード部品ドリルの土台部品（教師＝Claude 製、彼女への引き渡し用）。
 * 線の濃さの減衰：上端 15% で滑らかに立ち上がり、下端 30% で
 * 滑らかに消える。y=0 と y=height で 0、中間では peak を返す。
 * 髪の柔らかさ部品（P1092）の中で使われた形そのもの。
 */
export function taperAlpha(y: number, height: number, peak: number): number {
  const riseT = Math.max(0, Math.min(1, y / (0.15 * height)));
  const rise = riseT * riseT * (3 - 2 * riseT);
  const fallT = Math.max(0, Math.min(1, (y - 0.7 * height) / (0.3 * height)));
  const fall = 1 - fallT * fallT * (3 - 2 * fallT);
  return peak * rise * fall;
}
