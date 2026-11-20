/*
 * P1092: 髪の毛束線を柔らかく描くための配置計算。
 *
 * みきのコード能力の段階制の第1号部品。不足（gap）と契約は
 * missingComponentSpecService の仕様導出で切り、受け入れ条件は
 * acceptanceTestMatrixService のテスト案（AC-001〜AC-011）を
 * 弁別力のある物差しに落として検証した（現行方式の再現シムは
 * 曲がり・間隔・テーパーの3条件で不合格になることを確認済み）。
 * 実装の下書きは供給パッケージ経由のローカルLLM下書き3号を、
 * オラクル全合格＋教師検証（Muse）を経て採用し、部品棚には
 * CANDIDATE として登録した（CC-4e1f728e…）。
 *
 * 役割は「線の置き方」だけ。ピクセルへの書き込みはしない。
 * 純関数・決定的（seed から mulberry32 で乱数を引く）。
 */
export interface HairStrandPoint { x: number; y: number; alpha: number }
export interface HairStrand { points: HairStrandPoint[]; width: number }
export interface HairStrandSofteningInput { spanWidth: number; spanHeight: number; seed: number }
export interface HairStrandSofteningResult { strands: HairStrand[] }

function mulberry32(a: number): () => number {
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function smoothstep01(t: number): number {
  const c = Math.max(0, Math.min(1, t));
  return c * c * (3 - 2 * c);
}

export function softenHairStrands(input: HairStrandSofteningInput): HairStrandSofteningResult {
  const rand = mulberry32(input.seed);
  const n = 4 + Math.floor(rand() * 4);
  const weights: number[] = [];
  let total = 0;

  for (let i = 0; i <= n; i++) {
    const w = 0.3 + rand();
    weights.push(w);
    total += w;
  }

  const scale = (input.spanWidth - 6) / total;
  const baseX: number[] = [];
  let sum = 0;

  for (let k = 0; k <= n; k++) {
    sum += weights[k];
    baseX.push(3 + scale * sum);
  }

  const strands: HairStrand[] = [];

  for (let i = 0; i < n; i++) {
    const period1 = 40 + rand() * 120;
    const period2 = 40 + rand() * 120;
    const phase1 = rand() * 2 * Math.PI;
    const phase2 = rand() * 2 * Math.PI;
    const amp1 = 1.5 + rand() * 2;
    const amp2 = 0.5 + rand() * 1.5;
    const peak = 0.55 + rand() * 0.45;
    const width = 1 + rand() * 0.6;

    const points: HairStrandPoint[] = [];

    for (let y = 0; y < input.spanHeight; y++) {
      const x = baseX[i] + amp1 * Math.sin(2 * Math.PI * y / period1 + phase1) + amp2 * Math.sin(2 * Math.PI * y / period2 + phase2);
      const clampedX = Math.min(Math.max(0, x), input.spanWidth - 1);
      const rise = smoothstep01(y / (0.15 * input.spanHeight));
      const fall = 1 - smoothstep01((y - 0.70 * input.spanHeight) / (0.30 * input.spanHeight));
      const alpha = peak * rise * fall;

      points.push({ x: clampedX, y, alpha });
    }

    strands.push({ points, width });
  }

  strands.sort((a, b) => a.points[0].x - b.points[0].x);

  return { strands };
}
