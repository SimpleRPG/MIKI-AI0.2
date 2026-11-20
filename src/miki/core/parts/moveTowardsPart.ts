/*
 * 土台部品（教師製・P1099）: 目標へ最大 maxDelta だけ近づく（行き過ぎない）。
 * 移動・追尾・数値の滑らかな追従スなどゲーム制作の基本。
 * maxDelta が負のときは動かない。
 * 純関数・自己完結（import なし）。
 */
export function moveTowards(current: number, target: number, maxDelta: number): number {
  const d = Math.max(0, maxDelta);
  const diff = target - current;
  if (Math.abs(diff) <= d) return target;
  return current + Math.sign(diff) * d;
}
