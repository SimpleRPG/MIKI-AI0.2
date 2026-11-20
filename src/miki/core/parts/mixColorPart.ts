/*
 * 土台部品（教師製・P1099）: 2色を t (0..1) で混ぜる。
 * 色は [r, g, b] の配列。丸めはしない（呼び出し側で必要なら丸める）。
 * 純関数・自己完結（import なし）。
 */
export function mixColor(colorA: number[], colorB: number[], t: number): number[] {
  const c = Math.min(1, Math.max(0, t));
  return [
    colorA[0] + (colorB[0] - colorA[0]) * c,
    colorA[1] + (colorB[1] - colorA[1]) * c,
    colorA[2] + (colorB[2] - colorA[2]) * c,
  ];
}
