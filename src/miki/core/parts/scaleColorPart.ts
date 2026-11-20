/*
 * 土台部品（教師製・P1099）: 色全体に倍率をかけて 0..255 に収める。
 * 影色・縁の色づくりで繰り返し出てくる操作。丸めはしない。
 * 純関数・自己完結（import なし）。
 */
export function scaleColor(color: number[], factor: number): number[] {
  return [
    Math.min(255, Math.max(0, color[0] * factor)),
    Math.min(255, Math.max(0, color[1] * factor)),
    Math.min(255, Math.max(0, color[2] * factor)),
  ];
}
