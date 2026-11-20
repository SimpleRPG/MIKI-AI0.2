/*
 * 土台部品（教師製・P1099）: 最初速く後で滑らかに止まるイージング（3次）。
 * アニメーションや移動の減速に使う。入力は 0..1 に丸める。
 * 純関数・自己完結（import なし）。
 */
export function easeOutCubic(t: number): number {
  const c = Math.min(1, Math.max(0, t));
  const u = 1 - c;
  return 1 - u * u * u;
}
