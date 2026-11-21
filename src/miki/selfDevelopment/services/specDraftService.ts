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
