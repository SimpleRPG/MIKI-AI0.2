/*
 * 合成部品（みき自身の合成・P1101）: 中心で明るく、縁へ滑らかに消える脈動。
 * 合成探索が easeOutCubic(gaussFalloff(x, 50, 25)) を見つけ、
 * コードドリルで解題として通した彼女の合成第2号（深さ2の合成）。
 * 土台部品2つの本体を内蔵する（自己完結・import なし）。
 */
function gaussFalloff(x: number, center: number, sigma: number): number {
  if (sigma <= 0) return x === center ? 1 : 0;
  const d = (x - center) / sigma;
  return Math.exp(-0.5 * d * d);
}

function easeOutCubic(t: number): number {
  const c = Math.min(1, Math.max(0, t));
  const u = 1 - c;
  return 1 - u * u * u;
}

export function glowPulse(x: number): number {
  return easeOutCubic(gaussFalloff(x, 50, 25));
}
