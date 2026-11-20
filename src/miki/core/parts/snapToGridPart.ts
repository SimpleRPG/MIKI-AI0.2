/*
 * 土台部品（教師製・P1099）: 値を格子の目（step の倍数）に吸着させる。
 * タイル配置・座標の丸めに使う。step <= 0 のときは値をそのまま返す。
 * 純関数・自己完結（import なし）。
 */
export function snapToGrid(value: number, step: number): number {
  if (step <= 0) return value;
  return Math.round(value / step) * step;
}
