import { compositionSearchService, type CompositionCase } from './compositionSearchService';
import { codeDrillService, type CodeDrillTask } from './codeDrillService';
import { specDraftService, type SpecDraftRequest } from './specDraftService';
import { drillTaskGenerationService } from './drillTaskGenerationService';
import { reusableComponentFactoryService } from '../../core/services/reusableComponentFactoryService';
import { selfCodeSpaceService } from '../../core/services/selfCodeSpaceService';

/*
 * P1103: 合成ドリルの運転手。
 * 課題を受け取ると、合成探索（P1102）で候補を作り、コードドリル（P1095）で
 * 解題として通し、解けたら部品として登録する。探索→解題→登録を
 * 彼女自身の仕組みの中で一続きに回すための接続。
 *
 * 部品のソースは自分のコード空間（selfCodeSpaceService）から読む。
 * 読めない部品が合成に含まれていたら、その候補は自己完結化できないので
 * 解題には進まず、理由を返して台帳にも残さない（測れないものを測った
 * ことにしない）。
 * 解けない課題は、最良の候補をドリルに1回だけ通して失敗を台帳に残す
 * （失敗の記録も彼女の到達点の記録）。
 */

export interface CompositionDrillInput {
  task: CodeDrillTask;
  partNames?: string[];
  maxDepth?: 1 | 2;
  registerAsPart?: boolean;
}

export interface CompositionDrillResult {
  solved: boolean;
  expression?: string;
  usedParts: string[];
  maxError: number;
  attempts: number;
  componentId?: string;
  reason?: string;
}

class CompositionDrillService {
  private partSource(name: string): string | null {
    try {
      const file = selfCodeSpaceService.readFile(`src/miki/core/parts/${name}Part.ts`);
      return file?.content ?? null;
    } catch {
      return null;
    }
  }

  public async solveAndRegister(input: CompositionDrillInput): Promise<CompositionDrillResult> {
    const cases: CompositionCase[] = input.task.cases.map((c) => ({ args: c.args as number[], expected: c.expected as number }));
    const search = compositionSearchService.search({
      entryPoint: input.task.entryPoint,
      cases,
      partNames: input.partNames,
      maxDepth: input.maxDepth,
    });
    const source = compositionSearchService.buildSelfContainedSource(
      { found: search.found, entryPoint: search.entryPoint, expression: search.expression, usedParts: search.usedParts, variables: search.variables, maxError: search.maxError, source: search.source },
      (name) => this.partSource(name),
    );
    if (source === null) {
      return { solved: false, usedParts: search.usedParts, maxError: search.maxError, attempts: 0, reason: 'PART_SOURCE_UNAVAILABLE' };
    }
    const attempt = codeDrillService.runAttempt(input.task, source);
    if (!attempt.record.solved) {
      return {
        solved: false,
        expression: search.expression,
        usedParts: search.usedParts,
        maxError: search.maxError,
        attempts: attempt.record.attempts,
        reason: search.found ? 'DRILL_NOT_PASSED' : 'NOT_FOUND_IN_VOCABULARY',
      };
    }
    let componentId: string | undefined;
    if (input.registerAsPart) {
      const reg = await reusableComponentFactoryService.createCodeComponentCandidate({
        purpose: `合成部品 ${input.task.entryPoint}: ${input.task.title}（合成探索＋コードドリルで解題・P1103）`,
        implementation: source,
        targetPath: `src/miki/core/parts/${input.task.entryPoint}Part.ts`,
        tests: `${input.task.entryPoint} の受け入れケース ${input.task.cases.length} 件を全て通すこと`,
        validation: `合成探索が式 ${search.expression} を見つけ、コードドリルの実行判定を全件通過した`,
        componentType: 'FUNCTION',
        inputs: new Array(Math.max(1, input.task.cases.length ? input.task.cases[0].args.length : 1)).fill('number'),
        outputs: ['number'],
        exports: [input.task.entryPoint],
        entryPoint: input.task.entryPoint,
        supportedEnvironments: ['LOCAL'],
      });
      componentId = (reg as { componentId?: string }).componentId;
    }
    return {
      solved: true,
      expression: search.expression,
      usedParts: search.usedParts,
      maxError: search.maxError,
      attempts: attempt.record.attempts,
      componentId,
    };
  }

  /*
   * P1148: 仕様の切り出し（P1134）をドリルへ接続する。
   * 仕様点→ケース化と弁別力チェックを通し、弱い仕様（定数や
   * 直線当てで通ってしまうもの）は課題にしない。解題しても
   * 腕が測れないため。強い仕様だけを課題化して、合成→解題→
   * （任意で）部品登録の既存経路に乗せる。
   */
  public async solveSpecDraft(
    request: SpecDraftRequest,
    registerAsPart = false,
  ): Promise<CompositionDrillResult & { discrimination?: 'STRONG' | 'WEAK' }> {
    const draft = specDraftService.draftAndSolve(request);
    if (!draft) return { solved: false, usedParts: [], maxError: 0, attempts: 0, reason: 'SPEC_INVALID' };
    if (draft.discrimination === 'WEAK') {
      return { solved: false, usedParts: [], maxError: draft.maxError, attempts: 0, reason: 'SPEC_TOO_WEAK', discrimination: 'WEAK' };
    }
    // P1148: 仕様の許容誤差をそのまま解題のケースに載せる。
    // 探索は許容誤差の範囲で式を探すのに、解題の判定が
    // 許容誤差0（完全一致）だと、仕様どおりの式でも必ず
    // 落ちてしまう。仕様の公差と解題の公差は同じものである
    // べきなので、ここでつなぐ。
    const tolerance = request.tolerance && request.tolerance > 0 ? request.tolerance : 0.02;
    const task: CodeDrillTask = {
      taskId: `spec-${draft.name}`,
      title: draft.description || draft.name,
      entryPoint: draft.name,
      cases: draft.cases.map((c) => ({ args: [...c.args], expected: c.expected, tolerance })),
    };
    const result = await this.solveAndRegister({ task, registerAsPart });
    return { ...result, discrimination: 'STRONG' };
  }

  /*
   * P1106: 自動セッション。課題を自動生成（P1106 生成サービス）して
   * 全部解題に回し、解けたものは部品登録する。彼女が自分で課題を作って
   * 解く循環の1周分。結果は件数と内訳で返す（解けなかった課題も
   * 台帳に失敗として残る）。
   */
  public async runAutoSession(seed: number, count: number, registerAsPart = true): Promise<{
    generated: number; solved: number; registered: number;
    results: Array<{ taskId: string; solved: boolean; expression?: string; reason?: string }>;
  }> {
    const tasks = drillTaskGenerationService.generateTasks(seed, count);
    const results: Array<{ taskId: string; solved: boolean; expression?: string; reason?: string }> = [];
    let solved = 0;
    let registered = 0;
    for (const t of tasks) {
      const r = await this.solveAndRegister({
        task: { taskId: t.taskId, title: t.title, entryPoint: t.entryPoint, cases: t.cases },
        registerAsPart,
      });
      if (r.solved) solved++;
      if (r.componentId) registered++;
      results.push({ taskId: t.taskId, solved: r.solved, expression: r.expression, reason: r.reason });
    }
    return { generated: tasks.length, solved, registered, results };
  }
}

export const compositionDrillService = new CompositionDrillService();
