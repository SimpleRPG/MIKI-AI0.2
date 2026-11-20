/*
 * P1102: 合成探索サービス。
 * 部品×制御テンプレートの組み合わせを、ケース（入出力の物差し）に照らして
 * 探索する。定数は座標降下（1個ずつ詰める）で合わせる。
 * 自由な進化型の探索は式が肥大化して深い合成に届かなかったため、
 * 型の列挙＋定数 fitting の方式を採る（P1100 の実験で 4/4 解題、
 * 語彙外の課題は解けないと正直に返す）。
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
};
const CONST_POOL = [0, 0.25, 0.5, 0.8, 1, 2, 4, 10, 25, 50, 100, 140, -1];

type Struct = any;
function evalStruct(s: Struct, consts: number[], x: number): number {
  if (s.form === 'identity') return x;
  if (s.form === 'opxx') { if (s.op === '+') return x + x; if (s.op === '-') return x - x; if (s.op === '*') return x * x; return x / (x === 0 ? 1e-9 : x); }
  if (s.form === 'opxc') { const c = consts[0]; if (s.op === '+') return x + c; if (s.op === '-') return x - c; if (s.op === '*') return x * c; return Math.abs(c) < 1e-9 ? 1e9 : x / c; }
  const first = s.inner ? evalStruct(s.inner, consts.slice(s.constCount), x) : x;
  return CATALOG[s.name].fn(first, ...consts.slice(0, s.constCount));
}
function structCode(s: Struct, consts: number[]): string {
  if (s.form === 'identity') return 'x';
  if (s.form === 'opxx') return `(x ${s.op} x)`;
  if (s.form === 'opxc') return `(x ${s.op} ${consts[0]})`;
  const first = s.inner ? structCode(s.inner, consts.slice(s.constCount)) : 'x';
  return `${s.name}(${[first, ...consts.slice(0, s.constCount).map(String)].join(', ')})`;
}
function collectParts(s: Struct, into: Set<string>): void {
  if (s.form === 'part') { into.add(s.name); if (s.inner) collectParts(s.inner, into); }
}
const totalConsts = (s: Struct): number => s.constCount + (s.inner ? totalConsts(s.inner) : 0);

export const compositionSearchService = {
  search(input: CompositionSearchInput): CompositionSearchResult {
    const tol = input.tolerance ?? 1e-9;
    const names = (input.partNames && input.partNames.length ? input.partNames : Object.keys(CATALOG)).filter((n) => CATALOG[n]);
    const maxDepth = input.maxDepth ?? 2;
    const makePart = (name: string, inner?: Struct): Struct => ({ form: 'part', name, inner, constCount: CATALOG[name].arity - 1 });
    const structures: Struct[] = [{ form: 'identity', constCount: 0 }];
    for (const op of ['+', '-', '*', '/']) { structures.push({ form: 'opxx', op, constCount: 0 }); structures.push({ form: 'opxc', op, constCount: 1 }); }
    for (const n of names) structures.push(makePart(n));
    if (maxDepth >= 2) for (const o of names) for (const i of names) structures.push(makePart(o, makePart(i)));
    const errOf = (s: Struct, cs: number[]) => {
      let e = 0;
      for (const c of input.cases) { const v = evalStruct(s, cs, c.args[0]); if (!Number.isFinite(v)) return 1e18; e = Math.max(e, Math.abs(v - c.expected)); }
      return e;
    };
    const fit = (s: Struct): { consts: number[]; err: number } => {
      const n = totalConsts(s);
      let best: number[] = new Array(n).fill(1);
      let bestErr = errOf(s, best);
      const zero: number[] = new Array(n).fill(0);
      const ez = errOf(s, zero); if (ez < bestErr) { best = zero; bestErr = ez; }
      for (let round = 0; round < 3 && bestErr > tol; round++) {
        for (let i = 0; i < n; i++) for (const v of CONST_POOL) {
          if (v === best[i]) continue;
          const cand = [...best]; cand[i] = v;
          const e = errOf(s, cand);
          if (e < bestErr - 1e-12) { best = cand; bestErr = e; }
        }
      }
      return { consts: best, err: bestErr };
    };
    let bestS: Struct = structures[0]; let bestConsts: number[] = []; let bestErr = Infinity;
    for (const s of structures) {
      const r = fit(s);
      if (r.err < bestErr) { bestErr = r.err; bestS = s; bestConsts = r.consts; if (bestErr <= tol) break; }
    }
    const expression = structCode(bestS, bestConsts);
    const used = new Set<string>(); collectParts(bestS, used);
    const usedParts = [...used];
    const imports = usedParts.map((n) => `import { ${n} } from '${CATALOG[n].modulePath}';`).join('\n');
    const source = `${imports ? imports + '\n\n' : ''}export function ${input.entryPoint}(x: number): number { return ${expression}; }\n`;
    return { found: bestErr <= tol, entryPoint: input.entryPoint, expression, usedParts, maxError: bestErr, source };
  },

  // 実行器やドリルで使う自己完結ソースを作る。部品のソース供給関数が必要。
  buildSelfContainedSource(result: CompositionSearchResult, getPartSource: (name: string) => string | null): string | null {
    const bodies: string[] = [];
    for (const n of result.usedParts) {
      const src = getPartSource(n);
      if (src === null) return null;
      bodies.push(src.replace(/^\/\*[\s\S]*?\*\//, '').trim());
    }
    return `${bodies.join('\n\n')}\n\nexport function ${result.entryPoint}(x: number): number { return ${result.expression}; }\n`;
  },
};
