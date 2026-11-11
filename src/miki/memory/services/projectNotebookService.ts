import { storageService } from '../../../services/storageService';
import { systemLogger } from '../../../services/systemLogger';
import { intakeMeaningGuardService } from './intakeMeaningGuardService';

/**
 * P511: プロジェクトノート。
 *
 * ゲーム開発の相方として一緒に作るプロジェクト（EFR、シンプルRPG等）の
 * 「決め事」を置く専用の薄い層。プロジェクトの決定事項は世界の事実では
 * なく「本人が決めたこと」なので、出所はユーザー本人で足り、世界の事実の
 * 検証（Claim の梯子）とは別枠で扱う。
 *
 * - 保存は storageService 経由（他の台帳と経路を統一）。
 * - 初回は既知の設計方針を seed として入れる（source: 'seed'）。
 * - 想起は P212 の自己問い合わせ（「EFRの決め事は？」）から使う。
 */

export interface ProjectDecision {
  id: string;
  project: string;
  text: string;
  source: 'seed' | 'user' | 'teacher';
  createdAt: number;
}

/** P555: プロジェクトごとの作業状態（今取り組んでいるもの・次の手）。 */
export interface ProjectWorkState {
  project: string;
  current?: string;
  next?: string;
  updatedAt: number;
}

const STORAGE_KEY = 'miki_project_notebook_v1';
const WORK_STATE_KEY = 'miki_project_work_state_v1';
const REGISTRY_KEY = 'miki_project_registry_v1';

const SEED_DECISIONS: ReadonlyArray<{ project: string; text: string }> = [
  { project: 'EFR', text: 'マップは表示しない（難易度が下がるため）。' },
  { project: 'EFR', text: '縦持ちスマホ前提で、画面比率はHUD 1〜2割、メイン 6〜8割、操作エリア 3〜4割を目安にする。' },
  { project: 'EFR', text: 'レベルと職はバッグ画面で確認できればよい。' },
  { project: 'EFR', text: '鍵は死んでも消えない鍵専用インベントリで保管し、探索に持ち込んで使える。' },
  { project: 'EFR', text: 'ペット（かわいい動物の相棒）を優先材料にする（相方の要望）。' },
  { project: 'シンプルRPG', text: 'アルビオンRPG寄りの方向性で、相方と一緒に遊ぶためのゲーム。' },
];

const PROJECT_ALIASES: Record<string, string> = {
  efr: 'EFR',
  エスケープフロムrpg: 'EFR',
  escapefromrpg: 'EFR',
};

const normalizeProjectKey = (value: string): string => value.replace(/\s+/g, '').toLowerCase();
const normalizeText = (value: string): string => value.replace(/\s+/g, ' ').trim();

export class ProjectNotebookService {
  private static instance: ProjectNotebookService;
  private decisions: ProjectDecision[] | null = null;
  private workStates: ProjectWorkState[] | null = null;

  private constructor() {}

  public static getInstance(): ProjectNotebookService {
    if (!ProjectNotebookService.instance) {
      ProjectNotebookService.instance = new ProjectNotebookService();
    }
    return ProjectNotebookService.instance;
  }

  private ensureLoaded(): ProjectDecision[] {
    if (this.decisions) return this.decisions;
    let loaded: ProjectDecision[] = [];
    try {
      const raw = storageService.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as ProjectDecision[];
        if (Array.isArray(parsed)) loaded = parsed.filter((d) => d && typeof d.project === 'string' && typeof d.text === 'string');
      }
    } catch {
      loaded = [];
    }
    if (loaded.length === 0) {
      const now = Date.now();
      loaded = SEED_DECISIONS.map((seed, index) => ({
        id: `PD-SEED-${index + 1}`,
        project: seed.project,
        text: seed.text,
        source: 'seed' as const,
        createdAt: now,
      }));
      this.decisions = loaded;
      this.persist();
      systemLogger.info('SYSTEM', `📓 [プロジェクトノート] 初期の決め事 ${loaded.length} 件を登録しました。`);
    } else {
      this.decisions = loaded;
    }
    return this.decisions;
  }

  private persist(): void {
    try {
      storageService.setItem(STORAGE_KEY, JSON.stringify(this.decisions ?? []));
    } catch {
      // 保存に失敗してもメモリ上の保持は続ける。
    }
  }

  /** 登録済みプロジェクト名の一覧。 */
  public listProjects(): string[] {
    const seen = new Set<string>();
    for (const decision of this.ensureLoaded()) seen.add(decision.project);
    for (const entry of this.loadRegistry()) seen.add(entry.name);
    return [...seen];
  }

  // ---- P713: プロジェクトの登録簿 ----
  // 決め事が1件も無い新規プロジェクトは、従来は存在自体を記録できず、
  // 後続の決定発言（プロジェクト名を含まないもの）が紐付けられなかった。
  // 名前と最終言及時刻だけを持つ軽い登録簿を別に持つ。
  private registry: Array<{ name: string; lastMentionedAt: number }> | null = null;

  private loadRegistry(): Array<{ name: string; lastMentionedAt: number }> {
    if (this.registry) return this.registry;
    let loaded: Array<{ name: string; lastMentionedAt: number }> = [];
    try {
      const raw = storageService.getItem(REGISTRY_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) loaded = parsed.filter((e) => e && typeof e.name === 'string');
      }
    } catch { loaded = []; }
    this.registry = loaded;
    return this.registry;
  }

  private persistRegistry(): void {
    try { storageService.setItem(REGISTRY_KEY, JSON.stringify(this.registry ?? [])); } catch { /* 保存は補助経路 */ }
  }

  /** プロジェクト名を登録し、「今のプロジェクト」として印を付ける。 */
  public registerProject(name: string): string | undefined {
    const clean = normalizeText(name).replace(/[。、！!？?]+$/, '');
    if (!clean || clean.length < 2 || clean.length > 20) return undefined;
    const registry = this.loadRegistry();
    const existing = registry.find((e) => normalizeProjectKey(e.name) === normalizeProjectKey(clean));
    if (existing) {
      existing.lastMentionedAt = Date.now();
      this.persistRegistry();
      return existing.name;
    }
    registry.push({ name: clean, lastMentionedAt: Date.now() });
    this.persistRegistry();
    systemLogger.info('SYSTEM', `📓 [プロジェクトノート] プロジェクト「${clean}」を登録しました`);
    return clean;
  }

  /** 直近（2時間以内）に言及されたプロジェクト。決定の紐付け先。 */
  public currentProject(): string | undefined {
    const registry = this.loadRegistry();
    if (registry.length === 0) return undefined;
    const freshest = [...registry].sort((a, b) => b.lastMentionedAt - a.lastMentionedAt)[0];
    if (Date.now() - freshest.lastMentionedAt > 2 * 60 * 60 * 1000) return undefined;
    return freshest.name;
  }

  /** 質問文などからプロジェクトを特定する。別名・部分一致に対応。 */
  public findProject(query: string): string | undefined {
    const key = normalizeProjectKey(query);
    if (!key) return undefined;
    const alias = PROJECT_ALIASES[key];
    const projects = this.listProjects();
    if (alias && projects.includes(alias)) return alias;
    return projects.find((project) => {
      const projectKey = normalizeProjectKey(project);
      return projectKey === key || projectKey.includes(key) || key.includes(projectKey);
    });
  }

  /** 会話文のような長い文の中からプロジェクト名を探す。 */
  public findProjectInText(text: string): string | undefined {
    const key = normalizeProjectKey(text);
    if (!key) return undefined;
    const projects = this.listProjects();
    for (const [alias, canonical] of Object.entries(PROJECT_ALIASES)) {
      if (key.includes(alias) && projects.includes(canonical)) return canonical;
    }
    return projects.find((project) => key.includes(normalizeProjectKey(project)));
  }

  /**
   * P513: 会話での決定発言を取り込む。プロジェクト名が文中にあり、
   * 決定を表す言い方（決めた／ことにした／決定した等、P547で意志形
   * ことにしよ／ことにしようも追加）が含まれ、
   * 質問文でない場合だけ、そのプロジェクトを含む文を決め事として
   * 登録する。言及しただけ・質問しただけでは登録しない。
   */
  public intakeFromUserText(text: string): ProjectDecision | undefined {
    const source = String(text || '');
    if (!source.trim()) return undefined;
    // P713: プロジェクトの開始宣言（「Xを作りたい」「Xに〜を入れたい」）
    // を登録簿に残す。決め事が無くてもプロジェクトが存在できるように。
    try {
      const intro = source.match(/([^。．、！!？?]{1,14}?)(?:を作りたい|を作ろう|を作っていく|の開発を(?:始め|はじめ)|の開発をする)/)
        || source.match(/([^。．、！!？?]{1,14}?)(?:に)(?:.{1,12}?)を(?:入れたい|作りたい|付けたい)/);
      if (intro) {
        const candidate = normalizeText(intro[1]).replace(/^(?:今度は|新しい|その|この)/, '').trim();
        // 日常の文（「鞄に本を入れたい」「ケーキを作りたい」）を
        // プロジェクトと誤認しないよう、作り物らしい名前か、
        // 文脈がゲーム・アプリ開発の時だけ登録する。
        const projectLike = /ゲーム|RPG|アプリ|ツール|システム|サイト|ソフト/i.test(candidate)
          || /(?:ゲーム|アプリ|システム)(?:作り|開発)/.test(source);
        if (candidate && projectLike && !/ゲーム作り|話$/.test(candidate)) this.registerProject(candidate);
      }
    } catch { /* 登録は補助経路 */ }
    // P555: 作業状態の発言（「今〜を作ってる」「次は〜を作る」）も拾う。
    try { this.intakeWorkStateFromUserText(source); } catch { /* best-effort */ }
    if (/[？?]\s*$/.test(source.trim()) || /教えて|聞かせて/.test(source)) return undefined;
    // P713: 決定の言い方に「仕様にする／しよう」「〜で決まり」も加える。
    if (!/決め(た|る|ました|よう)|ことにし(た|ます|よう|よ)|決定(した|する|しました)|仕様に(?:する|しよう)|(?:で|に)決まり/.test(source)) return undefined;
    // P713: プロジェクト名が文中に無ければ、直近のプロジェクトに紐付ける。
    const project = this.findProjectInText(source) || this.currentProject();
    if (!project) return undefined;
    try { this.registerProject(project); } catch { /* 言及の記録は補助 */ }
    const sentences = source.split(/(?<=。)/).map((s) => s.trim()).filter(Boolean);
    const sentence = sentences.find((s) => this.findProjectInText(s) === project) ?? source.trim();
    // P546: 形は決め事でも、仮定・引用・伝聞なら本人の決定として
    // 記録しない（共有層の意味チェック）。
    const verdict = intakeMeaningGuardService.check(sentence);
    if (!verdict.ok) {
      systemLogger.info('SYSTEM', `🛡️ [取り込み判定] 決め事として記録しませんでした（${verdict.reason}）: ${sentence.slice(0, 60)}`);
      return undefined;
    }
    return this.addDecision(project, sentence, 'user');
  }

  // ---- P555: 作業状態（今の作業・次の手） ----

  private loadWorkStates(): ProjectWorkState[] {
    if (this.workStates) return this.workStates;
    let loaded: ProjectWorkState[] = [];
    try {
      const raw = storageService.getItem(WORK_STATE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as ProjectWorkState[];
        if (Array.isArray(parsed)) loaded = parsed.filter((s) => s && typeof s.project === 'string');
      }
    } catch {
      loaded = [];
    }
    this.workStates = loaded;
    return this.workStates;
  }

  private persistWorkStates(): void {
    try {
      storageService.setItem(WORK_STATE_KEY, JSON.stringify(this.workStates ?? []));
    } catch { /* 保存は補助経路 */ }
  }

  public getWorkState(project: string): ProjectWorkState | undefined {
    const canonical = this.findProject(project) ?? project;
    return this.loadWorkStates().find((s) => s.project === canonical);
  }

  public listWorkStates(): ProjectWorkState[] {
    return [...this.loadWorkStates()];
  }

  public setWorkState(project: string, patch: { current?: string; next?: string }): ProjectWorkState | undefined {
    const canonical = this.findProject(project);
    if (!canonical) return undefined;
    const states = this.loadWorkStates();
    let state = states.find((s) => s.project === canonical);
    if (!state) {
      state = { project: canonical, updatedAt: Date.now() };
      states.push(state);
    }
    if (patch.current) state.current = patch.current;
    if (patch.next) state.next = patch.next;
    state.updatedAt = Date.now();
    this.persistWorkStates();
    systemLogger.info('SYSTEM', `📓 [作業状態] ${canonical}： 今「${state.current ?? '—'}」／次「${state.next ?? '—'}」`);
    return state;
  }

  /** P563: 今の作業が完了したら、次の手を今の作業に進める。 */
  public advanceWorkState(project: string): ProjectWorkState | undefined {
    const canonical = this.findProject(project);
    if (!canonical) return undefined;
    const state = this.loadWorkStates().find((s) => s.project === canonical);
    if (!state || !state.current) return undefined;
    const done = state.current;
    state.current = state.next;
    state.next = undefined;
    state.updatedAt = Date.now();
    this.persistWorkStates();
    systemLogger.info('SYSTEM', `📓 [作業状態] ${canonical}：「${done}」が完了。${state.current ? `次は「${state.current}」へ。` : ''}`);
    return state;
  }

  /**
   * P555: 作業の進み具合の発言を取り込む。プロジェクト名があり、
   * 「今〜を作ってる／実装中」「次は〜を作る」の形で、意味チェック
   * （P546）を通った文だけを作業状態として残す。
   * P563: 今の作業の名前を含んだ完了の発言（「〜ができた」）は、
   * 次の手へ進める合図として扱う。
   */
  private intakeWorkStateFromUserText(text: string): void {
    const project = this.findProjectInText(text);
    if (!project) return;
    const sentences = String(text || '').split(/(?<=。)/).map((s) => s.trim()).filter(Boolean);
    for (const sentence of sentences.length > 0 ? sentences : [String(text || '').trim()]) {
      if (!sentence) continue;
      const stateNow = this.getWorkState(project);
      if (stateNow?.current && sentence.includes(stateNow.current) && /(?:できた|完成した|終わった|完了した)/.test(sentence)) {
        if (intakeMeaningGuardService.check(sentence).ok) this.advanceWorkState(project);
        continue;
      }
      const currentMatch = sentence.match(/今(?:は|、)?(.{2,24}?)(?:を作って(?:い)?る|を実装して(?:い)?る|を作成中|を実装中|の実装中|の作成中)/);
      const nextMatch = sentence.match(/次(?:は|に)(.{2,24}?)(?:を作る|を実装する|をやる|に取り組む)/);
      if (!currentMatch && !nextMatch) continue;
      if (!intakeMeaningGuardService.check(sentence).ok) continue;
      const patch: { current?: string; next?: string } = {};
      if (currentMatch) patch.current = this.cleanWorkItem(currentMatch[1], project);
      if (nextMatch) patch.next = this.cleanWorkItem(nextMatch[1], project);
      if (patch.current || patch.next) this.setWorkState(project, patch);
    }
  }

  private cleanWorkItem(raw: string, project: string): string {
    let v = String(raw || '').trim().replace(/^[はの、,]+/, '');
    if (v.startsWith(project)) v = v.slice(project.length).replace(/^の/, '');
    return v.replace(/の$/, '').trim();
  }

  public listDecisions(project?: string): ProjectDecision[] {
    const all = this.ensureLoaded();
    if (!project) return [...all];
    const canonical = this.findProject(project) ?? project;
    return all.filter((d) => d.project === canonical);
  }

  /** 決め事を追加する。同プロジェクト・同文は重複登録しない。 */
  public addDecision(project: string, text: string, source: ProjectDecision['source'] = 'user'): ProjectDecision | undefined {
    const canonical = this.findProject(project) ?? normalizeText(project);
    const cleanText = normalizeText(text);
    if (!canonical || !cleanText) return undefined;
    const all = this.ensureLoaded();
    const existing = all.find((d) => d.project === canonical && d.text === cleanText);
    if (existing) return existing;
    const decision: ProjectDecision = {
      id: `PD-${Date.now().toString(36).toUpperCase()}-${all.length + 1}`,
      project: canonical,
      text: cleanText,
      source,
      createdAt: Date.now(),
    };
    all.push(decision);
    this.persist();
    systemLogger.info('SYSTEM', `📓 [プロジェクトノート] ${canonical} の決め事を追加しました: ${cleanText}`);
    return decision;
  }
}

export const projectNotebookService = ProjectNotebookService.getInstance();
