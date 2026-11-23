import { compositionSearchService, type CompositionCase } from './compositionSearchService';
import { codeDrillService, type CodeDrillTask } from './codeDrillService';
import { specDraftService, type SpecDraftRequest } from './specDraftService';
import { drillTaskGenerationService, DRILL_BASE_PART_NAMES, type DrillExtraPart } from './drillTaskGenerationService';
import { pureCodeExecutionService } from './pureCodeExecutionService';
import { reusableComponentFactoryService } from '../../core/services/reusableComponentFactoryService';
import { selfCodeSpaceService } from '../../core/services/selfCodeSpaceService';
import { componentArtifactStoreService } from '../../capability/services/componentArtifactStoreService';

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
  /** P2002: 追加の材料（登録部品）。生成に使ったものと同じ一覧を解く側にも渡す。 */
  extraParts?: DrillExtraPart[];
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
  private artifactSourceCache = new Map<string, string | null>();

  private partSource(name: string): string | null {
    try {
      const file = selfCodeSpaceService.readFile(`src/miki/core/parts/${name}Part.ts`);
      if (file?.content) return file.content;
    } catch {
      // 空間が未初期化なら成果物側へ落ちる
    }
    // P2002: 登録部品は成果物（部品TXT正本）が実体で、コード空間へ
    // 反映されていないことがある。空間に無い部品は成果物から読む
    // （生成・探索・自己完結化で、部品の出所を1本に揃える）。
    return this.artifactPartSource(name);
  }

  /*
   * P2002: 成果物から「部品ファイルとしての正本ソース」を引く。
   * component.txt の ENTRY_POINT / TARGET_PATH が
   * src/miki/core/parts/<名前>Part.ts と一致する記録だけを対象にし、
   * implementation.txt の FILE_CONTENT 本体を返す。成果物は不変
   * スナップショットなので、名前ごとの結果はキャッシュしてよい。
   */
  private artifactPartSource(name: string): string | null {
    if (this.artifactSourceCache.has(name)) return this.artifactSourceCache.get(name) ?? null;
    let found: string | null = null;
    try {
      for (const manifest of componentArtifactStoreService.getAllManifests()) {
        const record = componentArtifactStoreService.getBySnapshotKey(manifest.snapshot_key);
        if (!record) continue;
        const parsed = CompositionDrillService.parseArtifactPart(record.component_txt, record.implementation_txt);
        if (parsed && parsed.name === name) { found = parsed.content; break; }
      }
    } catch {
      found = null;
    }
    this.artifactSourceCache.set(name, found);
    return found;
  }

  /** 成果物の TXT から部品の入口・対象パス・本体を取り出す（対象外なら null）。 */
  private static parseArtifactPart(
    componentTxt: string,
    implementationTxt: string,
  ): { name: string; content: string } | null {
    // 成果物 TXT の項目区切りはリテラル "\\n"（2文字）のことがあるため、
    // 値の終端は空白とバックスラッシュの両方で止める。
    const entry = /ENTRY_POINT:\s*([A-Za-z0-9_]+)/.exec(componentTxt)?.[1];
    const target = /TARGET_PATH:\s*([^\s\\]+)/.exec(componentTxt)?.[1];
    if (!entry || !target) return null;
    if (target !== `src/miki/core/parts/${entry}Part.ts`) return null;
    const begin = implementationTxt.indexOf('FILE_CONTENT_BEGIN');
    const end = implementationTxt.indexOf('FILE_CONTENT_END');
    if (begin < 0 || end < 0 || end <= begin) return null;
    const content = implementationTxt
      .slice(begin + 'FILE_CONTENT_BEGIN'.length, end)
      .replace(/^(?:\s|\\n)+/, '')
      .replace(/(?:\s|\\n)+$/, '');
    return content ? { name: entry, content } : null;
  }

  /*
   * P2002: 登録部品のスナップショット（名前＋arity、名前順）。
   * セッション開始時点で確定させるための列挙で、成果物のうち
   * 部品ファイル（src/miki/core/parts/<名前>Part.ts）を対象にし、
   * 土台の語彙と同名のものと、評価器として取り出せないものは除く。
   * arity は取り出した関数の長さ（実物）を正とする。
   */
  public snapshotRegisteredParts(): Array<{ name: string; arity: number }> {
    const out: Array<{ name: string; arity: number }> = [];
    const seen = new Set<string>();
    try {
      for (const manifest of componentArtifactStoreService.getAllManifests()) {
        const record = componentArtifactStoreService.getBySnapshotKey(manifest.snapshot_key);
        if (!record) continue;
        const parsed = CompositionDrillService.parseArtifactPart(record.component_txt, record.implementation_txt);
        if (!parsed || seen.has(parsed.name) || DRILL_BASE_PART_NAMES.has(parsed.name)) continue;
        const fn = pureCodeExecutionService.compileFunction(parsed.content, parsed.name);
        if (!fn || fn.length < 1) continue;
        seen.add(parsed.name);
        out.push({ name: parsed.name, arity: fn.length });
      }
    } catch {
      // 列挙に失敗したら追加材料なし（土台だけのセッションとして続ける）
    }
    out.sort((a, b) => a.name.localeCompare(b.name));
    return out;
  }

  /*
   * P2002: スナップショット（名前＋arity）を評価できる材料へ解決する。
   * 生成・探索・再構成の全てがこの解決を通すことで、同じ一覧が同じ
   * 評価器に落ちる。解決できない部品は黙って落とすのではなく一覧から
   * 外れる（＝そのセッションの材料に無いものとして扱う）。
   * 戻り値の arity は実物の関数の長さで、セッションが返す
   * スナップショットはこの解決後の値を使う。
   */
  public resolveExtraParts(list: Array<{ name: string; arity: number }>): DrillExtraPart[] {
    const out: DrillExtraPart[] = [];
    for (const item of list) {
      if (!item || !item.name || out.some((p) => p.name === item.name)) continue;
      const source = this.partSource(item.name);
      if (!source) continue;
      const fn = pureCodeExecutionService.compileFunction(source, item.name);
      if (!fn || fn.length < 1) continue;
      out.push({ name: item.name, arity: fn.length, fn: fn as (...args: number[]) => number });
    }
    return out;
  }

  public async solveAndRegister(input: CompositionDrillInput): Promise<CompositionDrillResult> {
    const cases: CompositionCase[] = input.task.cases.map((c) => ({ args: c.args as number[], expected: c.expected as number }));
    const search = compositionSearchService.search({
      entryPoint: input.task.entryPoint,
      cases,
      partNames: input.partNames,
      maxDepth: input.maxDepth,
      extraParts: input.extraParts,
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

  /**
   * P1153: 説明文だけから仕様を切り出してドリルへ渡す。
   * 点の切り出し（P1153 specDraftService 側）ができなければ
   * SPEC_POINTS_UNAVAILABLE。切り出せた後は P1148 と同じ
   * 経路（弁別力ゲート→課題化→解題→台帳）。
   */
  public async solveSpecDescription(
    request: { name: string; description: string; tolerance?: number },
    registerAsPart = false,
  ): Promise<CompositionDrillResult & { discrimination?: 'STRONG' | 'WEAK'; pointsSource?: string }> {
    const drafted = specDraftService.draftPointsFromDescription(request.description);
    if (!drafted) {
      return { solved: false, usedParts: [], maxError: 0, attempts: 0, reason: 'SPEC_POINTS_UNAVAILABLE' };
    }
    const result = await this.solveSpecDraft(
      { name: request.name, description: request.description, points: drafted.points, tolerance: request.tolerance },
      registerAsPart,
    );
    return { ...result, pointsSource: drafted.source };
  }

  /*
   * P1106: 自動セッション。課題を自動生成（P1106 生成サービス）して
   * 全部解題に回し、解けたものは部品登録する。彼女が自分で課題を作って
   * 解く循環の1周分。結果は件数と内訳で返す（解けなかった課題も
   * 台帳に失敗として残る）。
   */
  public async runAutoSession(seed: number, count: number, registerAsPart = true, extraParts?: Array<{ name: string; arity: number }>): Promise<{
    generated: number; solved: number; registered: number;
    extraParts: Array<{ name: string; arity: number }>;
    results: Array<{ taskId: string; solved: boolean; expression?: string; reason?: string }>;
  }> {
    // P2002: 追加材料はセッション開始時点のスナップショットで固定し、
    // 生成・探索・（結果経由の）再構成の全部で同じ一覧を使う。
    const resolved = this.resolveExtraParts(extraParts ?? this.snapshotRegisteredParts());
    const effective = resolved.map((p) => ({ name: p.name, arity: p.arity }));
    const tasks = drillTaskGenerationService.generateTasks(seed, count, resolved);
    const results: Array<{ taskId: string; solved: boolean; expression?: string; reason?: string }> = [];
    let solved = 0;
    let registered = 0;
    for (const t of tasks) {
      const r = await this.solveAndRegister({
        task: { taskId: t.taskId, title: t.title, entryPoint: t.entryPoint, cases: t.cases },
        registerAsPart,
        extraParts: resolved,
      });
      if (r.solved) solved++;
      if (r.componentId) registered++;
      results.push({ taskId: t.taskId, solved: r.solved, expression: r.expression, reason: r.reason });
    }
    return { generated: tasks.length, solved, registered, extraParts: effective, results };
  }

  /**
   * P1154: 仕様セッション。言葉の依頼から彼女が仕様を切り出し、
   * 弁別力ゲートを通して解題する練習の1周分。自動セッション
   * （式から作る課題）とは別に、「言葉→仕様→解題」の回路を
   * 常駐ドリルや自律実行から回せるようにする。
   */
  public async runSpecSession(seed: number, count: number, registerAsPart = false): Promise<{
    generated: number; solved: number;
    results: Array<{ taskId: string; solved: boolean; reason?: string; pointsSource?: string }>;
  }> {
    const tasks = drillTaskGenerationService.generateSpecTasks(seed, count);
    const results: Array<{ taskId: string; solved: boolean; reason?: string; pointsSource?: string }> = [];
    let solved = 0;
    for (const t of tasks) {
      const r = await this.solveSpecDescription(
        { name: t.name, description: t.description },
        registerAsPart,
      );
      if (r.solved) solved++;
      results.push({ taskId: t.taskId, solved: r.solved, reason: r.reason, pointsSource: r.pointsSource });
    }
    return { generated: tasks.length, solved, results };
  }

  /**
   * P1155: 練習セッション（混合ローテーション）。式の課題と仕様の課題を
   * 交互に回す1周分。自動セッション（式のみ）・仕様セッション（言葉のみ）を
   * 1つの入口に束ね、アイドル進化サイクルの熟達ドリルから呼べるようにする。
   * 解けた課題は部品登録する（練習で彼女の部品カタログが増える）。
   */
  public async runPracticeSession(seed: number, count: number, registerAsPart = true, extraParts?: Array<{ name: string; arity: number }>): Promise<{
    generated: number; solved: number; registered: number;
    expressionSolved: number; specSolved: number;
    extraParts: Array<{ name: string; arity: number }>;
    results: Array<{ taskId: string; kind: 'expression' | 'spec'; solved: boolean; reason?: string; pointsSource?: string }>;
  }> {
    // P2002: 式の課題の追加材料はセッション開始時点のスナップショットで
    // 固定する。結果に含めて返すので、失敗課題の再構成（同じ seed で
    // 再生成する側）が同じ一覧をそのまま使える。仕様の課題は対象外。
    const resolved = this.resolveExtraParts(extraParts ?? this.snapshotRegisteredParts());
    const effective = resolved.map((p) => ({ name: p.name, arity: p.arity }));
    const exprCount = Math.ceil(count / 2);
    const specCount = count - exprCount;
    const exprTasks = drillTaskGenerationService.generateTasks(seed, exprCount, resolved);
    const specTasks = drillTaskGenerationService.generateSpecTasks(seed, specCount);
    const results: Array<{ taskId: string; kind: 'expression' | 'spec'; solved: boolean; reason?: string; pointsSource?: string }> = [];
    let solved = 0;
    let registered = 0;
    let expressionSolved = 0;
    let specSolved = 0;
    for (let i = 0; i < count; i++) {
      if (i % 2 === 0) {
        const t = exprTasks[i / 2];
        const r = await this.solveAndRegister({
          task: { taskId: t.taskId, title: t.title, entryPoint: t.entryPoint, cases: t.cases },
          registerAsPart,
          extraParts: resolved,
        });
        if (r.solved) { solved++; expressionSolved++; }
        if (r.componentId) registered++;
        results.push({ taskId: t.taskId, kind: 'expression', solved: r.solved, reason: r.reason });
      } else {
        const t = specTasks[(i - 1) / 2];
        const r = await this.solveSpecDescription(
          { name: t.name, description: t.description },
          registerAsPart,
        );
        if (r.solved) { solved++; specSolved++; }
        if (r.componentId) registered++;
        results.push({ taskId: t.taskId, kind: 'spec', solved: r.solved, reason: r.reason, pointsSource: r.pointsSource });
      }
    }
    return { generated: count, solved, registered, expressionSolved, specSolved, extraParts: effective, results };
  }
}

export const compositionDrillService = new CompositionDrillService();
