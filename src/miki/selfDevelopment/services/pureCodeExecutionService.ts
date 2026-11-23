import ts from 'typescript';
import { canonicalSha256 } from '../../core/services/canonicalSha256Service';

/*
 * P1094: コードドリルの実行器。
 * 既存の sandbox 実行（generatedComponentSandboxExecutionService）は静的
 * チェックと模擬であり、コードを実際には走らせない。こちらは純関数部品を
 * 本当に実行して、テストケースとの一致で合否を出す「物差し」。
 *
 * 安全境界：
 * - 禁止グローバル（fetch / eval / Function / process / require 等）と
 *   非決定要素（Math.random / Date.now）の静的検査を通らないものは実行しない。
 * - 実行は require を封じた使い捨てモジュール内。外部アクセス手段を持たない。
 * - 対象は同期の純関数のみ（部品ドリルの前提）。
 * 既知の限界：無限ループはこの段では止められない。候補は彼女のゲートと
 * 教師部品を経たものだけが来る前提で、v1 では許容する（設計メモ参照）。
 */

export interface PureExecutionCase {
  args: unknown[];
  expected: unknown;
  tolerance?: number;
  /** 戻り値が関数の場合、その関数をこの回数だけ呼んだ結果の列と比べる。 */
  callCount?: number;
}

export interface PureExecutionCaseResult {
  index: number;
  ok: boolean;
  actual: unknown;
  error?: string;
}

export interface PureExecutionEvidence {
  passed: boolean;
  total: number;
  passedCount: number;
  cases: PureExecutionCaseResult[];
  failureReasons: string[];
  implementationHash: string;
}

const PROHIBITED = /(?:fetch|XMLHttpRequest|WebSocket|eval|Function|localStorage|sessionStorage|document|window|process|require|globalThis)\s*\(|import\s*\(/;
const NONDETERMINISTIC = /Date\.now|Math\.random|new\s+Date\s*\(/;

function deepEqual(a: unknown, b: unknown, tol: number): boolean {
  if (typeof a === 'number' && typeof b === 'number') return Math.abs(a - b) <= tol;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((v, i) => deepEqual(v, b[i], tol));
  }
  if (a !== null && b !== null && typeof a === 'object' && typeof b === 'object') {
    const ka = Object.keys(a as Record<string, unknown>);
    const kb = Object.keys(b as Record<string, unknown>);
    return ka.length === kb.length && ka.every((k) => deepEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k], tol));
  }
  return a === b;
}

function summarize(value: unknown): unknown {
  const text = JSON.stringify(value) ?? String(value);
  return text.length > 200 ? text.slice(0, 200) + '…' : value;
}

class PureCodeExecutionService {
  public execute(implementation: string, entryPoint: string, cases: PureExecutionCase[]): PureExecutionEvidence {
    const implementationHash = canonicalSha256(implementation);
    const failureReasons: string[] = [];
    if (PROHIBITED.test(implementation)) failureReasons.push('PROHIBITED_GLOBAL');
    if (NONDETERMINISTIC.test(implementation)) failureReasons.push('NON_DETERMINISTIC_SOURCE');
    const transpiled = ts.transpileModule(implementation, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
      reportDiagnostics: true,
    });
    if ((transpiled.diagnostics || []).some((d) => d.category === ts.DiagnosticCategory.Error)) {
      failureReasons.push('TRANSPILE_FAILED');
    }
    if (failureReasons.length > 0 || cases.length === 0) {
      if (cases.length === 0) failureReasons.push('NO_CASES');
      return { passed: false, total: cases.length, passedCount: 0, cases: [], failureReasons, implementationHash };
    }
    let fn: unknown;
    try {
      const moduleObj: { exports: Record<string, unknown> } = { exports: {} };
      const factory = new Function('module', 'exports', 'require', transpiled.outputText);
      factory(moduleObj, moduleObj.exports, () => {
        throw new Error('require is not available in pure execution');
      });
      fn = moduleObj.exports[entryPoint];
    } catch (e) {
      return { passed: false, total: cases.length, passedCount: 0, cases: [], failureReasons: ['LOAD_FAILED'], implementationHash };
    }
    if (typeof fn !== 'function') {
      return { passed: false, total: cases.length, passedCount: 0, cases: [], failureReasons: ['ENTRY_POINT_NOT_FUNCTION'], implementationHash };
    }
    const call = fn as (...args: unknown[]) => unknown;
    const results: PureExecutionCaseResult[] = [];
    let passedCount = 0;
    cases.forEach((c, index) => {
      try {
        let actual: unknown = call(...c.args);
        if (typeof c.callCount === 'number' && typeof actual === 'function') {
          const seq: unknown[] = [];
          const inner = actual as () => unknown;
          for (let i = 0; i < c.callCount; i++) seq.push(inner());
          actual = seq;
        }
        const ok = deepEqual(actual, c.expected, c.tolerance ?? 0);
        if (ok) passedCount++;
        results.push({ index, ok, actual: summarize(actual) });
      } catch (e) {
        results.push({ index, ok: false, actual: undefined, error: String(e).slice(0, 120) });
      }
    });
    return {
      passed: passedCount === cases.length,
      total: cases.length,
      passedCount,
      cases: results,
      failureReasons,
      implementationHash,
    };
  }

  /*
   * P2002: ソースから入口関数そのものを取り出す。ケース判定（execute）
   * ではなく、登録部品を「評価できる材料」として生成・探索で使う側の口。
   * 安全境界は execute と同じ（禁止グローバル・非決定要素の静的検査、
   * トランスパイル診断、require を封じた使い捨てモジュール）。
   * 取り出せなければ null（測れないものを測ったことにしない）。
   */
  public compileFunction(implementation: string, entryPoint: string): ((...args: unknown[]) => unknown) | null {
    if (PROHIBITED.test(implementation) || NONDETERMINISTIC.test(implementation)) return null;
    const transpiled = ts.transpileModule(implementation, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
      reportDiagnostics: true,
    });
    if ((transpiled.diagnostics || []).some((d) => d.category === ts.DiagnosticCategory.Error)) return null;
    try {
      const moduleObj: { exports: Record<string, unknown> } = { exports: {} };
      const factory = new Function('module', 'exports', 'require', transpiled.outputText);
      factory(moduleObj, moduleObj.exports, () => {
        throw new Error('require is not available in pure execution');
      });
      const fn = moduleObj.exports[entryPoint];
      return typeof fn === 'function' ? (fn as (...args: unknown[]) => unknown) : null;
    } catch {
      return null;
    }
  }
}

export const pureCodeExecutionService = new PureCodeExecutionService();
