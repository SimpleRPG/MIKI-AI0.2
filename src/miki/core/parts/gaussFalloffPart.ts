/*
 * 土台部品（教師製・P1099）: ガウス型の落ち込み（中心で1、離れるほど0へ）。
 * 描画の膨らみ・減衰（胸の丸み等）で繰り返し出てくる形。
 * sigma <= 0 のときは中心だけ1、それ以外0。
 * 純関数・自己完結（import なし）。
 */
export function gaussFalloff(x: number, center: number, sigma: number): number {
  if (sigma <= 0) return x === center ? 1 : 0;
  const d = (x - center) / sigma;
  return Math.exp(-0.5 * d * d);
}
