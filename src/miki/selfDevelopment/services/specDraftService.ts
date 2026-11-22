import { storageService } from '../../../services/storageService';
import { compositionSearchService, type CompositionCase } from './compositionSearchService';

/*
 * P1134: 仕様の切り出しを彼女側へ寄せる初段。
 *
 * これまで「欲しい関数の仕様（入力→出力の点の集まり）を用意し、
 * テストが甘くないか（自明な当てはめで通ってしまわないか）を締める」
 * 仕事は教師（Claude）の手作業だった（P1126: 緩い試験では直線が
 * 通ってしまい、教師側で試験を締め直した）。
 *
 * このサービスはその流れを彼女自身の仕組みにする:
 *   言葉での依頼（名前＋説明＋仕様点）を受ける
 *   → 仕様点を受け入れケースへ変換する
 *   → 弁別力チェック: 定数当て・直線当てで全ケースが許容誤差の
 *     3倍以内に収まってしまう仕様は「弱い」と印を付ける
 *     （弱い仕様は、自明な答えと意図した形を見分けられない）
 *   → 合成探索で解く
 *   → 台帳に残す（強い仕様で解けたものだけが「仕様切り出しの成功」）
 *
 * 解けた式の部品登録・配線は従来どおり供給ルート／教師の仕事。
 * ここは「仕様とテストを彼女が用意し、自分で締めて、自分で解く」
 * までを担う。
 */

const LEDGER_KEY = 'miki_spec_draft_ledger_v1';
const LEDGER_CAP = 100;

export interface SpecDraftRequest {
  name: string;
  description: string;
  points: Array<{ x: number; y: number }>;
  tolerance?: number;
}

export interface SpecDraftRecord {
  name: string;
  description: string;
  cases: CompositionCase[];
  discrimination: 'STRONG' | 'WEAK';
  trivialMaxError: number;
  found: boolean;
  expression: string;
  usedParts: string[];
  maxError: number;
  at: number;
}

/** P1153: 説明文から切り出した仕様点と、その出どころ。 */
export interface SpecPointsDraft {
  points: Array<{ x: number; y: number }>;
  source: string;
}

const TEMPLATE_XS = [0, 0.25, 0.5, 0.75, 1];
const SPEC_TEMPLATES_1153: Array<{ id: string; keywords: string[]; fn: (x: number) => number }> = [
  {
    id: 'falloff',
    keywords: ['減衰', 'だんだん減', '徐々に減', '次第に減', '0に近づ', 'ゼロに近づ', '弱まる', 'フェード', 'falloff', 'decay'],
    fn: (x) => 0.5 + 0.5 * Math.cos(Math.PI * x),
  },
  {
    id: 'bump',
    keywords: ['山なり', '真ん中が最大', '中央が最大', '真ん中が一番', '盛り上が', 'bump'],
    fn: (x) => Math.sin(Math.PI * x),
  },
  {
    id: 'saturate',
    keywords: ['飽和', '上限に近づ', '増えて止まる', 'だんだん増えて', 'saturat'],
    fn: (x) => 1 - Math.exp(-3 * x),
  },
];

function trivialFitMaxError(points: Array<{ x: number; y: number }>): number {
  const n = points.length;
  const meanY = points.reduce((sum, p) => sum + p.y, 0) / n;
  const constErr = Math.max(...points.map(p => Math.abs(p.y - meanY)));
  const meanX = points.reduce((sum, p) => sum + p.x, 0) / n;
  const sxx = points.reduce((sum, p) => sum + (p.x - meanX) ** 2, 0);
  const sxy = points.reduce((sum, p) => sum + (p.x - meanX) * (p.y - meanY), 0);
  if (sxx <= 1e-12) return constErr;
  const slope = sxy / sxx;
  const intercept = meanY - slope * meanX;
  const linErr = Math.max(...points.map(p => Math.abs(p.y - (slope * p.x + intercept))));
  return Math.min(constErr, linErr);
}

class SpecDraftService {
  private readLedger(): SpecDraftRecord[] {
    return storageService.getJson<SpecDraftRecord[]>(LEDGER_KEY, []);
  }

  list(): SpecDraftRecord[] {
    return this.readLedger();
  }

  /**
   * P1153: 仕様「点」を言葉の説明から彼女自身が切り出す。
   * P1134 では点は教師が渡していた。ここでは2つの出どころを
   * 彼女の側に持つ:
   *   1. 説明の中に点が明示されている場合（「0で1、0.5で0.5」
   *      や「(0, 1)」の形）は、それをそのまま拾う。
   *   2. 形の言葉（減衰・山なり・飽和など）があれば、形の型
   *      から点を生成する。
   * どちらにも当たらなければ undefined（まだ切り出せない、
   * という正直な失敗。教師の点にフォールバックするのは
   * 呼び出し側の判断）。切り出した点は従来どおり弁別力
   * チェックに通すので、甘い点は WEAK として弾かれる。
   */
  draftPointsFromDescription(descriptionRaw: string): SpecPointsDraft | undefined {
    const description = String(descriptionRaw || '');
    if (!description) return undefined;
    const byX = new Map<number, number>();
    const addPoint = (x: number, y: number) => {
      if (Number.isFinite(x) && Number.isFinite(y) && !byX.has(x)) byX.set(x, y);
    };
    for (const m of description.matchAll(/[\(（]\s*(-?\d+(?:\.\d+)?)\s*[,、]\s*(-?\d+(?:\.\d+)?)\s*[\)）]/g)) {
      addPoint(Number(m[1]), Number(m[2]));
    }
    for (const m of description.matchAll(/(-?\d+(?:\.\d+)?)\s*(?:のとき|で|→|->)\s*(-?\d+(?:\.\d+)?)/g)) {
      addPoint(Number(m[1]), Number(m[2]));
    }
    if (byX.size >= 2) {
      const points = [...byX.entries()].map(([x, y]) => ({ x, y })).sort((a, b) => a.x - b.x);
      return { points, source: 'explicit' };
    }
    const lower = description.toLowerCase();
    for (const template of SPEC_TEMPLATES_1153) {
      if (!template.keywords.some((k) => lower.includes(k.toLowerCase()))) continue;
      const points = TEMPLATE_XS.map((x) => ({ x, y: Math.round(template.fn(x) * 10000) / 10000 }));
      return { points, source: `template:${template.id}` };
    }
    return undefined;
  }

  /** P1153: 説明から点を切り出して、そのまま仕様化と解題まで通す。 */
  draftFromDescription(
    request: { name: string; description: string; tolerance?: number },
  ): { record: SpecDraftRecord; source: string } | undefined {
    const drafted = this.draftPointsFromDescription(request.description);
    if (!drafted) return undefined;
    const record = this.draftAndSolve({
      name: request.name,
      description: request.description,
      points: drafted.points,
      tolerance: request.tolerance,
    });
    if (!record) return undefined;
    return { record, source: drafted.source };
  }

  draftAndSolve(request: SpecDraftRequest): SpecDraftRecord | undefined {
    const name = (request.name || '').trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) return undefined;
    const points = (request.points || [])
      .filter(p => Number.isFinite(p.x) && Number.isFinite(p.y))
      .slice()
      .sort((a, b) => a.x - b.x);
    if (points.length < 2) return undefined;
    const tolerance = request.tolerance && request.tolerance > 0 ? request.tolerance : 0.02;
    const cases: CompositionCase[] = points.map(p => ({ args: [p.x], expected: p.y }));
    const trivialMaxError = trivialFitMaxError(points);
    const discrimination: SpecDraftRecord['discrimination'] =
      trivialMaxError > tolerance * 3 ? 'STRONG' : 'WEAK';
    const result = compositionSearchService.search({
      entryPoint: name,
      cases,
      tolerance,
    });
    const record: SpecDraftRecord = {
      name,
      description: (request.description || '').slice(0, 200),
      cases,
      discrimination,
      trivialMaxError,
      found: result.found,
      expression: result.expression,
      usedParts: result.usedParts,
      maxError: result.maxError,
      at: Date.now(),
    };
    const ledger = this.readLedger();
    ledger.push(record);
    storageService.setItem(LEDGER_KEY, JSON.stringify(ledger.slice(-LEDGER_CAP)));
    return record;
  }
}

export const specDraftService = new SpecDraftService();
