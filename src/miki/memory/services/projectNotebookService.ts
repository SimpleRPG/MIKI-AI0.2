import { storageService } from '../../../services/storageService';
import { systemLogger } from '../../../services/systemLogger';

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

const STORAGE_KEY = 'miki_project_notebook_v1';

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
    return [...seen];
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
   * 決定を表す言い方（決めた／ことにした／決定した等）が含まれ、
   * 質問文でない場合だけ、そのプロジェクトを含む文を決め事として
   * 登録する。言及しただけ・質問しただけでは登録しない。
   */
  public intakeFromUserText(text: string): ProjectDecision | undefined {
    const source = String(text || '');
    if (!source.trim()) return undefined;
    if (/[？?]\s*$/.test(source.trim()) || /教えて|聞かせて/.test(source)) return undefined;
    if (!/決め(た|る|ました)|ことにし(た|ます)|決定(した|する|しました)/.test(source)) return undefined;
    const project = this.findProjectInText(source);
    if (!project) return undefined;
    const sentences = source.split(/(?<=。)/).map((s) => s.trim()).filter(Boolean);
    const sentence = sentences.find((s) => this.findProjectInText(s) === project) ?? source.trim();
    return this.addDecision(project, sentence, 'user');
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
