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
 *
 * P1098: 土台部品（P1093）の合成で作り直した。乱数・間隔割り・
 * サイン波・減衰・clamp は src/miki/core/parts/ の部品を使い、
 * 出力は従来実装と全点一致（差は浮動小数の末桁のみ）であることを
 * プローブで確認済み。これにより描画のたびに土台部品が実利用される。
 */
import { mulberry32 } from '../../core/parts/mulberry32Part';
import { weightedGaps } from '../../core/parts/weightedGapsPart';
import { sinePhase } from '../../core/parts/sinePhasePart';
import { taperAlpha } from '../../core/parts/taperAlphaPart';
import { clamp01 } from '../../core/parts/clamp01Part';

export interface HairStrandPoint { x: number; y: number; alpha: number }
export interface HairStrand { points: HairStrandPoint[]; width: number }
export interface HairStrandSofteningInput { spanWidth: number; spanHeight: number; seed: number }
export interface HairStrandSofteningResult { strands: HairStrand[] }

export function softenHairStrands(input: HairStrandSofteningInput): HairStrandSofteningResult {
  const rand = mulberry32(input.seed);
  const n = 4 + Math.floor(rand() * 4);
  const weights: number[] = [];
  for (let i = 0; i <= n; i++) weights.push(0.3 + rand());

  // weightedGaps は「開始位置」の列を返す。この部品の baseX は
  // 自分の重みを含めた累積なので、1つ先の開始位置が対応する。
  const gaps = weightedGaps(weights, input.spanWidth - 6);
  const baseX: number[] = [];
  for (let i = 0; i < n; i++) baseX.push(3 + gaps[i + 1]);

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
      const x = baseX[i] + sinePhase(y, period1, phase1, amp1) + sinePhase(y, period2, phase2, amp2);
      const clampedX = input.spanWidth > 1 ? clamp01(x / (input.spanWidth - 1)) * (input.spanWidth - 1) : 0;
      const alpha = taperAlpha(y, input.spanHeight, peak);

      points.push({ x: clampedX, y, alpha });
    }

    strands.push({ points, width });
  }

  strands.sort((a, b) => a.points[0].x - b.points[0].x);

  return { strands };
}
