/*
 * P1102/P1105: 合成探索サービス。
 * 部品×制御テンプレートの組み合わせを、ケース（入出力の物差し）に照らして
 * 探索する。定数は座標降下（1個ずつ詰める）で合わせる。
 * 自由な進化型の探索は式が肥大化して深い合成に届かなかったため、
 * 型の列挙＋定数 fitting の方式を採る（P1100 の実験で 4/4 解題、
 * 語彙外の課題は解けないと正直に返す）。
 * P1105 で多変数化：ケースの引数の数だけ入力変数を持ち、各スロットに
 * 「どの変数・定数・内側の結果」が入る組み合わせを列挙する。
 * 探索には評価予算があり、尽きたら見つからなかったとして返す
 * （無限に探し続けない。予算内で最良の式と誤差は返す）。
 * 既知の限界：定数が強く結合した合成（例：範囲制限の上下限と内側の傾きを
 * 同時に決める必要がある形）は、座標降下がプラトーで止まって見つからない
 * ことがある（P1105 実測）。
 * 見つけた合成は buildSelfContainedSource で自己完結ソースにし、
 * 実行器（pureCodeExecutionService）やコードドリルで検証できる。
 */
import { clamp01 } from '../../core/parts/clamp01Part';
import { lerp } from '../../core/parts/lerpPart';
import { smoothstep01 } from '../../core/parts/smoothstep01Part';
import { clampRange } from '../../core/parts/clampRangePart';
import { remap } from '../../core/parts/remapPart';
import { gaussFalloff } from '../../core/parts/gaussFalloffPart';
import { taperAlpha } from '../../core/parts/taperAlphaPart';
import { sinePhase } from '../../core/parts/sinePhasePart';
import { easeOutCubic } from '../../core/parts/easeOutCubicPart';
import { moveTowards } from '../../core/parts/moveTowardsPart';
import { snapToGrid } from '../../core/parts/snapToGridPart';
import { easeInQuad } from '../../core/parts/easeInQuadPart';
import { glowPulse } from '../../core/parts/glowPulsePart';
import { manhattanDistance } from '../../core/parts/manhattanDistancePart';
import { euclideanDistance } from '../../core/parts/euclideanDistancePart';

export interface CompositionCase { args: number[]; expected: number }
export interface CompositionSearchInput {
  entryPoint: string;
  cases: CompositionCase[];
  partNames?: string[];
  maxDepth?: 1 | 2;
  tolerance?: number;
}
export interface CompositionSearchResult {
  found: boolean;
  entryPoint: string;
  expression: string;
  usedParts: string[];
  variables: string[];
  maxError: number;
  source: string;
}

interface PartDef { fn: (...a: number[]) => number; arity: number; modulePath: string }
const CATALOG: Record<string, PartDef> = {
  clamp01: { fn: clamp01, arity: 1, modulePath: '../../core/parts/clamp01Part' },
  lerp: { fn: lerp, arity: 3, modulePath: '../../core/parts/lerpPart' },
  smoothstep01: { fn: smoothstep01, arity: 1, modulePath: '../../core/parts/smoothstep01Part' },
  clampRange: { fn: clampRange, arity: 3, modulePath: '../../core/parts/clampRangePart' },
  remap: { fn: remap, arity: 5, modulePath: '../../core/parts/remapPart' },
  gaussFalloff: { fn: gaussFalloff, arity: 3, modulePath: '../../core/parts/gaussFalloffPart' },
  taperAlpha: { fn: taperAlpha, arity: 3, modulePath: '../../core/parts/taperAlphaPart' },
  sinePhase: { fn: sinePhase, arity: 4, modulePath: '../../core/parts/sinePhasePart' },
  easeOutCubic: { fn: easeOutCubic, arity: 1, modulePath: '../../core/parts/easeOutCubicPart' },
  moveTowards: { fn: moveTowards, arity: 3, modulePath: '../../core/parts/moveTowardsPart' },
  snapToGrid: { fn: snapToGrid, arity: 2, modulePath: '../../core/parts/snapToGridPart' },
  easeInQuad: { fn: easeInQuad, arity: 1, modulePath: '../../core/parts/easeInQuadPart' },
  glowPulse: { fn: glowPulse, arity: 1, modulePath: '../../core/parts/glowPulsePart' },
  manhattanDistance: { fn: manhattanDistance, arity: 4, modulePath: '../../core/parts/manhattanDistancePart' },
  euclideanDistance: { fn: euclideanDistance, arity: 4, modulePath: '../../core/parts/euclideanDistancePart' },
};
const CONST_POOL = [0, 0.25, 0.5, 0.8, 1, 2, 4, 10, 25, 50, 100, 140, -1];
const VAR_NAMES = ['x', 'y', 'z'];
const EVAL_BUDGET = 6_000_000;

type Node =
  | { t: 'var'; i: number }
  | { t: 'const'; ci: number }
  | { t: 'op'; op: string; l: Node; r: Node }
  | { t: 'call'; name: string; args: Node[] };

function evalNode(n: Node, consts: number[], vars: number[]): number {
  if (n.t === 'var') return vars[n.i];
  if (n.t === 'const') return consts[n.ci];
  if (n.t === 'op') {
    const l = evalNode(n.l, consts, vars); const r = evalNode(n.r, consts, vars);
    if (n.op === '+') return l + r;
    if (n.op === '-') return l - r;
    if (n.op === '*') return l * r;
    return l / (Math.abs(r) < 1e-9 ? 1e-9 : r);
  }
  return CATALOG[n.name].fn(...n.args.map((a) => evalNode(a, consts, vars)));
}
function nodeCode(n: Node, consts: number[]): string {
  if (n.t === 'var') return VAR_NAMES[n.i];
  if (n.t === 'const') return String(consts[n.ci]);
  if (n.t === 'op') return `(${nodeCode(n.l, consts)} ${n.op} ${nodeCode(n.r, consts)})`;
  return `${n.name}(${n.args.map((a) => nodeCode(a, consts)).join(', ')})`;
}
function countConsts(n: Node): number {
  if (n.t === 'const') return 1;
  if (n.t === 'var') return 0;
  if (n.t === 'op') return countConsts(n.l) + countConsts(n.r);
  return n.args.reduce((s, a) => s + countConsts(a), 0);
}
function collectParts(n: Node, into: Set<string>): void {
  if (n.t === 'call') { into.add(n.name); for (const a of n.args) collectParts(a, into); }
  if (n.t === 'op') { collectParts(n.l, into); collectParts(n.r, into); }
}

// スロット列挙：arity 個のスロットに変数（0..k-1）か定数を割り当てる。
// varSlots は「変数が入るスロット数」の上限（爆発防止）。
function slotAssignments(arity: number, k: number, maxVarSlots: number): Array<Array<number>> {
  // 戻り値の各要素: スロットごとの割当て（-1 = 定数、0.. = 変数番号）
  const out: Array<Array<number>> = [];
  const cur: number[] = new Array(arity).fill(-1);
  const rec = (slot: number, varUsed: number) => {
    if (slot === arity) { if (varUsed > 0 || arity === 0) out.push([...cur]); return; }
    cur[slot] = -1; rec(slot + 1, varUsed);
    if (varUsed < maxVarSlots) for (let v = 0; v < k; v++) { cur[slot] = v; rec(slot + 1, varUsed + 1); }
    cur[slot] = -1;
  };
  rec(0, 0);
  return out;
}

export const compositionSearchService = {
  search(input: CompositionSearchInput): CompositionSearchResult {
    const tol = input.tolerance ?? 1e-9;
    const k = Math.min(3, Math.max(1, input.cases.length ? input.cases[0].args.length : 1));
    const variables = VAR_NAMES.slice(0, k);
    const names = (input.partNames && input.partNames.length ? input.partNames : Object.keys(CATALOG)).filter((n) => CATALOG[n]);
    const maxDepth = input.maxDepth ?? 2;
    let evals = 0;

    const buildCall = (name: string, assign: Array<number>, firstOverride?: Node): { node: Node; nConsts: number } => {
      let ci = 0;
      const args: Node[] = assign.map((a, idx) => {
        if (idx === 0 && firstOverride) return firstOverride;
        if (a >= 0) return { t: 'var', i: a } as Node;
        return { t: 'const', ci: ci++ } as Node;
      });
      return { node: { t: 'call', name, args }, nConsts: ci };
    };

    // 深さ1の構造（葉と部品呼び出し）
    const depth1: Array<{ node: Node; nConsts: number }> = [];
    for (let v = 0; v < k; v++) depth1.push({ node: { t: 'var', i: v }, nConsts: 0 });
    for (const op of ['+', '-', '*', '/']) {
      for (let i = 0; i < k; i++) for (let j = 0; j < k; j++) depth1.push({ node: { t: 'op', op, l: { t: 'var', i }, r: { t: 'var', i: j } }, nConsts: 0 });
      for (let i = 0; i < k; i++) depth1.push({ node: { t: 'op', op, l: { t: 'var', i }, r: { t: 'const', ci: 0 } }, nConsts: 1 });
    }
    for (const name of names) {
      const arity = CATALOG[name].arity;
      for (const assign of slotAssignments(arity, k, 3)) depth1.push(buildCall(name, assign));
    }

    const errOf = (node: Node, cs: number[]): number => {
      let e = 0;
      for (const c of input.cases) {
        evals++;
        const v = evalNode(node, cs, c.args);
        if (!Number.isFinite(v)) return 1e18;
        e = Math.max(e, Math.abs(v - c.expected));
      }
      return e;
    };
    const fit = (node: Node, nConsts: number): { consts: number[]; err: number } => {
      let best: number[] = new Array(nConsts).fill(1);
      let bestErr = errOf(node, best);
      const zero: number[] = new Array(nConsts).fill(0);
      const ez = errOf(node, zero); if (ez < bestErr) { best = zero; bestErr = ez; }
      for (let round = 0; round < 3 && bestErr > tol && evals < EVAL_BUDGET; round++) {
        for (let i = 0; i < nConsts && evals < EVAL_BUDGET; i++) for (const v of CONST_POOL) {
          if (v === best[i]) continue;
          const cand = [...best]; cand[i] = v;
          const e = errOf(node, cand);
          if (e < bestErr - 1e-12) { best = cand; bestErr = e; }
        }
      }
      // 連続微調整：プールに無い定数（0.3 など）へも歩幅を縮めながら寄せる
      for (const step of [0.4, 0.2, 0.1, 0.04, 0.02, 0.008, 0.003, 0.001, 0.0004, 0.0001, 0.00003, 0.00001]) {
        if (bestErr <= tol || evals >= EVAL_BUDGET) break;
        for (let i = 0; i < nConsts && evals < EVAL_BUDGET; i++) {
          for (const d of [step, -step]) {
            const cand = [...best]; cand[i] = best[i] + d;
            const e = errOf(node, cand);
            if (e < bestErr - 1e-12) { best = cand; bestErr = e; }
          }
        }
      }
      return { consts: best, err: bestErr };
    };

    let bestNode: Node = depth1[0].node; let bestConsts: number[] = []; let bestErr = Infinity;
    const consider = (node: Node, nConsts: number): boolean => {
      const r = fit(node, nConsts);
      if (r.err < bestErr) { bestErr = r.err; bestNode = node; bestConsts = r.consts; }
      return bestErr <= tol;
    };
    for (const s of depth1) { if (consider(s.node, s.nConsts)) break; }

    if (bestErr > tol && maxDepth >= 2 && evals < EVAL_BUDGET) {
      // 深さ2：第1スロットに深さ1の構造を入れた部品呼び出し
      outer: for (const name of names) {
        const arity = CATALOG[name].arity;
        const restAssigns = slotAssignments(arity - 1, k, 2);
        for (const inner of depth1) {
          for (const rest of restAssigns) {
            const assign = [0, ...rest.map((a) => a)]; // 第1スロットは inner で置換される
            const built = buildCall(name, new Array(arity).fill(-1), inner.node);
            // rest の割当てを第2スロット以降に適用し直す
            let ci = inner.nConsts;
            const args: Node[] = (built.node as { args: Node[] }).args.map((a, idx) => {
              if (idx === 0) return a;
              const r = rest[idx - 1];
              if (r >= 0) return { t: 'var', i: r } as Node;
              return { t: 'const', ci: ci++ } as Node;
            });
            // inner 側の定数インデックスをずらす（outer の定数と衝突させない）
            const shiftConsts = (n: Node, off: number): Node => {
              if (n.t === 'const') return { t: 'const', ci: n.ci + off };
              if (n.t === 'var') return n;
              if (n.t === 'op') return { t: 'op', op: n.op, l: shiftConsts(n.l, off), r: shiftConsts(n.r, off) };
              return { t: 'call', name: n.name, args: n.args.map((a) => shiftConsts(a, off)) };
            };
            const outerConstsBefore = ci - inner.nConsts;
            const shiftedInner = outerConstsBefore > 0 ? shiftConsts(inner.node, 0) : inner.node;
            const node: Node = { t: 'call', name, args: [shiftedInner, ...args.slice(1)] };
            const nConsts = countConsts(node);
            if (consider(node, nConsts)) break outer;
            if (evals >= EVAL_BUDGET) break outer;
          }
        }
      }
    }

    const expression = nodeCode(bestNode, bestConsts);
    const used = new Set<string>(); collectParts(bestNode, used);
    const usedParts = [...used];
    const imports = usedParts.map((n) => `import { ${n} } from '${CATALOG[n].modulePath}';`).join('\n');
    const params = variables.map((v) => `${v}: number`).join(', ');
    const source = `${imports ? imports + '\n\n' : ''}export function ${input.entryPoint}(${params}): number { return ${expression}; }\n`;
    return { found: bestErr <= tol, entryPoint: input.entryPoint, expression, usedParts, variables, maxError: bestErr, source };
  },

  // 実行器やドリルで使う自己完結ソースを作る。部品のソース供給関数が必要。
  buildSelfContainedSource(result: CompositionSearchResult, getPartSource: (name: string) => string | null): string | null {
    const bodies: string[] = [];
    for (const n of result.usedParts) {
      const src = getPartSource(n);
      if (src === null) return null;
      bodies.push(src.replace(/^\/\*[\s\S]*?\*\//, '').trim());
    }
    const vars = result.variables && result.variables.length ? result.variables : ['x'];
    const params = vars.map((v) => `${v}: number`).join(', ');
    return `${bodies.join('\n\n')}\n\nexport function ${result.entryPoint}(${params}): number { return ${result.expression}; }\n`;
  },
};
