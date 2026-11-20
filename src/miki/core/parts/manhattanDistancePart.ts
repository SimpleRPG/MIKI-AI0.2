/*
 * 土台部品（教師製・P1099）: 格子上の距離（マンハッタン距離）。
 * タイル移動・経路の見積もりなどゲーム制作の基本。
 * 純関数・自己完結（import なし）。
 */
export function manhattanDistance(x1: number, y1: number, x2: number, y2: number): number {
  return Math.abs(x2 - x1) + Math.abs(y2 - y1);
}
