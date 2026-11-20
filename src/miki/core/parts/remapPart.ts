/*
 * 土台部品（教師製・P1099）: ある範囲の値を別の範囲へ写す（範囲変換）。
 * 入力範囲での位置（0..1に丸める）を保って出力範囲に移す。
 * 入力範囲が潰れている（inMax == inMin）ときは outMin を返す。
 * 純関数・自己完結（import なし）。
 */
export function remap(value: number, inMin: number, inMax: number, outMin: number, outMax: number): number {
  if (inMax === inMin) return outMin;
  const t = Math.min(1, Math.max(0, (value - inMin) / (inMax - inMin)));
  return outMin + t * (outMax - outMin);
}
