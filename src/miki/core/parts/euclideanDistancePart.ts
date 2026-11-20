/*
 * 土台部品（教師製・P1099）: 2点間の直線距離。
 * 純関数・自己完結（import なし）。
 */
export function euclideanDistance(x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return Math.sqrt(dx * dx + dy * dy);
}
