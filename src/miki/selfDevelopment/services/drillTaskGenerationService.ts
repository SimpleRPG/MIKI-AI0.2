/*
 * P1106: ドリル課題の自動生成サービス。
 * 探索の語彙（部品×テンプレート）からランダムな合成式を作り、その式を
 * 評価してケース（入出力）を組み立てる。解が存在することだけが保証され、
 * 式そのものは課題に含めない（探索が再発見する。等価な別式でもよい）。
 * 生成は seed 決定的（mulberry32）。定数同然の課題・振る舞いが重なる課題・
 * 素の部品だけの課題の出し過ぎは生成側で抑える。
 */
import { mulberry32 } from '../../core/parts/mulberry32Part';
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

const FNS: Record<string, { fn: (...a: number[]) => number; arity: number }> = {
  clamp01: { fn: clamp01, arity: 1 }, lerp: { fn: lerp, arity: 3 }, smoothstep01: { fn: smoothstep01, arity: 1 },
  clampRange: { fn: clampRange, arity: 3 }, remap: { fn: remap, arity: 5 }, gaussFalloff: { fn: gaussFalloff, arity: 3 },
  taperAlpha: { fn: taperAlpha, arity: 3 }, sinePhase: { fn: sinePhase, arity: 4 }, easeOutCubic: { fn: easeOutCubic, arity: 1 },
  moveTowards: { fn: moveTowards, arity: 3 }, snapToGrid: { fn: snapToGrid, arity: 2 }, easeInQuad: { fn: easeInQuad, arity: 1 },
  glowPulse: { fn: glowPulse, arity: 1 }, manhattanDistance: { fn: manhattanDistance, arity: 4 }, euclideanDistance: { fn: euclideanDistance, arity: 4 },
};
const NAMES = Object.keys(FNS);
const CONST_CHOICES = [0, 0.25, 0.3, 0.5, 0.8, 1, 2, 4, 10, 25, 50, -1];
const VAR_NAMES = ['x', 'y'];

type GNode =
  | { t: 'var'; i: number }
  | { t: 'const'; v: number }
  | { t: 'op'; op: string; l: GNode; r: GNode }
  | { t: 'call'; name: string; args: GNode[] };

function evalG(n: GNode, vars: number[]): number {
  if (n.t === 'var') return vars[n.i];
  if (n.t === 'const') return n.v;
  if (n.t === 'op') { const l = evalG(n.l, vars); const r = evalG(n.r, vars); if (n.op === '+') return l + r; if (n.op === '-') return l - r; if (n.op === '*') return l * r; return l / (Math.abs(r) < 1e-9 ? 1e-9 : r); }
  return FNS[n.name].fn(...n.args.map((a) => evalG(a, vars)));
}
function codeG(n: GNode): string {
  if (n.t === 'var') return VAR_NAMES[n.i];
  if (n.t === 'const') return String(n.v);
  if (n.t === 'op') return `(${codeG(n.l)} ${n.op} ${codeG(n.r)})`;
  return `${n.name}(${n.args.map(codeG).join(', ')})`;
}

export interface GeneratedTask {
  taskId: string; title: string; entryPoint: string;
  cases: { args: number[]; expected: number }[];
  generatingExpression: string;
}

/*
 * P1154: 言葉の依頼（仕様ブリーフ）のプール。自動セッションが
 * 「言葉→仕様点の切り出し（P1153）→弁別力ゲート→解題」の
 * 練習も回せるようにするための課題源。言い回しは複数持たせ、
 * 形の言葉の表記ゆれに強くする。点そのものは持たない（点は
 * 彼女が説明から切り出すのが練習の本体）。
 */
const SPEC_BRIEFS_1154: string[] = [
  'だんだん減って0に近づく形',
  '徐々に減衰していく形',
  '真ん中が最大の山なりの形',
  '中央が最大で盛り上がる形',
  'だんだん増えて上限に近づく形',
  '飽和するように増える形',
  '0で1、0.5で0.5、1で0になる落ち込み',
  '(0, 1) (0.5, 0.5) (1, 0) の形',
];

export interface GeneratedSpecTask {
  taskId: string; name: string; description: string;
}

export const drillTaskGenerationService = {
  generateTasks(seed: number, count: number): GeneratedTask[] {
    return generateTasksImpl(seed, count);
  },
  /** P1154: seed 決定的にブリーフを選ぶ（開始位置だけ seed でずらして一巡する）。 */
  generateSpecTasks(seed: number, count: number): GeneratedSpecTask[] {
    const out: GeneratedSpecTask[] = [];
    const start = Math.abs(Math.floor(seed)) % SPEC_BRIEFS_1154.length;
    for (let i = 0; i < count; i++) {
      const description = SPEC_BRIEFS_1154[(start + i) % SPEC_BRIEFS_1154.length];
      out.push({
        taskId: `specgen-${seed}-${i}`,
        name: `specShape${Math.abs(Math.floor(seed))}x${i}`,
        description,
      });
    }
    return out;
  },
};

function generateTasksImpl(seed: number, count: number): GeneratedTask[] {
  const rand = mulberry32(seed);
  const pick = <T,>(arr: T[]): T => arr[Math.floor(rand() * arr.length)];
  const makeLeaf = (k: number): GNode => (rand() < 0.6 ? { t: 'var', i: Math.floor(rand() * k) } : { t: 'const', v: pick(CONST_CHOICES) });
  const makeCall = (k: number, first?: GNode): GNode => {
    const name = pick(NAMES);
    const arity = FNS[name].arity;
    const args: GNode[] = [];
    let hasVar = !!first;
    for (let s = 0; s < arity; s++) {
      if (s === 0 && first) { args.push(first); continue; }
      const leaf = makeLeaf(k);
      if (leaf.t === 'var') hasVar = true;
      args.push(leaf);
    }
    if (!hasVar) args[arity > 1 ? 1 : 0] = { t: 'var', i: Math.floor(rand() * k) };
    return { t: 'call', name, args };
  };
  const makeExpr = (k: number, depth: number): GNode => {
    const inner: GNode = rand() < 0.25
      ? { t: 'op', op: pick(['+', '-', '*']), l: { t: 'var', i: Math.floor(rand() * k) }, r: makeLeaf(k) }
      : makeCall(k);
    if (depth < 2) return inner;
    return makeCall(k, inner);
  };
  const samplePoints = (k: number): number[][] => {
    if (k === 1) return [-2, -0.5, 0, 0.25, 0.5, 0.75, 1, 1.5, 3, 7].map((x) => [x]);
    const g = [-3, 0, 2, 5, 10];
    return g.flatMap((x) => g.map((y) => [x, y]));
  };
  // 自明な振る舞い（変数そのもの・変数同士の単純演算・変数と定数の演算）の
  // 署名を用意し、それと一致する課題は作らない（解くまでもない課題の除外）。
  const trivialSigs = (k: number): Set<string> => {
    const pts = samplePoints(k);
    const sigOf = (vals: number[]) => vals.map((v) => Math.round(v * 1e6) / 1e6).join(',');
    const sigs = new Set<string>();
    for (let i = 0; i < k; i++) sigs.add(sigOf(pts.map((p) => p[i])));
    for (let i = 0; i < k; i++) for (let j = 0; j < k; j++) for (const op of ['+', '-', '*', '/']) {
      sigs.add(sigOf(pts.map((p) => { const l = p[i]; const r = p[j]; if (op === '+') return l + r; if (op === '-') return l - r; if (op === '*') return l * r; return l / (Math.abs(r) < 1e-9 ? 1e-9 : r); })));
    }
    for (let i = 0; i < k; i++) for (const c of CONST_CHOICES) for (const op of ['+', '-', '*', '/']) {
      sigs.add(sigOf(pts.map((p) => { const l = p[i]; if (op === '+') return l + c; if (op === '-') return l - c; if (op === '*') return l * c; return l / (Math.abs(c) < 1e-9 ? 1e-9 : c); })));
    }
    return sigs;
  };
  const tasks: GeneratedTask[] = [];
  const seen = new Set<string>();
  const seenSigs = new Set<string>();
  let bareCount = 0;
  const bareLimit = Math.max(1, Math.ceil(count / 4));
  let guard = 0;
  while (tasks.length < count && guard++ < count * 40) {
    const k = rand() < 0.6 ? 1 : 2;
    const depth = rand() < 0.5 ? 1 : 2;
    let expr = makeExpr(k, depth);
    // 深さ2で外と内が同じ部品のときは内側を1回だけ作り直す（冪等な入れ子を避ける）
    if (expr.t === 'call' && expr.args[0] && expr.args[0].t === 'call' && expr.args[0].name === expr.name) {
      expr = { ...expr, args: [makeCall(k), ...expr.args.slice(1)] };
    }
    const code = codeG(expr);
    if (seen.has(code)) continue;
    const cases = samplePoints(k).map((args) => ({ args, expected: evalG(expr, args) }));
    if (cases.some((c) => !Number.isFinite(c.expected))) continue;
    const vals = cases.map((c) => c.expected);
    if (Math.max(...vals) - Math.min(...vals) < 1e-6) continue; // 定数同然は課題にならない
    const sig = vals.map((v) => Math.round(v * 1e6) / 1e6).join(',');
    if (seenSigs.has(sig)) continue; // 振る舞いが同じ課題は重ねない
    if (trivialSigs(k).has(sig)) continue; // 自明な振る舞いの課題は作らない
    const isBare = expr.t === 'call' && expr.args.every((a) => a.t === 'var');
    if (isBare && bareCount >= bareLimit) continue;
    if (isBare) bareCount++;
    seen.add(code);
    seenSigs.add(sig);
    const n = tasks.length;
    tasks.push({
      taskId: `auto-${seed}-${n}`,
      title: `自動生成課題 ${n + 1}（${k}変数・深さ${depth}）`,
      entryPoint: `autoPart${seed}_${n}`,
      cases,
      generatingExpression: code,
    });
  }
  return tasks;
}
