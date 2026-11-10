import { storageService } from '../../../services/storageService';
import { systemLogger } from '../../../services/systemLogger';
import { contentTermsFromTokens, japaneseAnalysisService } from '../../research/services/japaneseAnalysisService';

/**
 * P514: なりチャの役レイヤー。
 *
 * みき／ビービーの元の性格は「なりきり設定」ではなく本人そのもの
 * （きりあの設計原則）。人格プロフィールには一切触らず、役は人格の
 * 横に置く小さな層として持つ：被せた間だけ効き、外せば元の性格に
 * 完全に戻る。
 *
 * - 役の定義（名前・立場・世界・口調の寄せ・きりあの役）は保存して
 *   再利用できる。
 * - セッションは現在の役・場面・あらすじを持つ。あらすじは役ごとに
 *   前回の分を保持し、再開時に読み戻す（継続の土台）。
 * - セッション中のユーザー発言は創作であり、現実の事実取り込みの
 *   対象にしない（分離は conversationFactIntakeService 側のゲート）。
 */

export interface RoleDefinition {
  roleId: string;
  name: string;
  stance: string;
  world: string;
  toneHint: string;
  userRole: string;
  lastSummary?: string;
  createdAt: number;
}

export interface RoleplaySession {
  roleId: string;
  roleName: string;
  personaId: string;
  startedAt: number;
  scene: string;
  summary: string;
  // P523: あらすじ自動生成の材料（セッション中の発話の内容語）。
  notedTerms?: string[];
  // P536: 場面進行の歩数（何ターン会話したかの数え）。
  sceneBeats?: number;
  // P554: 弱い終了信号を検出した歩数。3歩以内にもう一度来たら終了が確定する。
  pendingEndBeat?: number;
  // P577: 既に使った場面進行文（重複排除用）。場面が変わると消える。
  usedProgressions?: string[];
}

const ROLES_KEY = 'miki_roleplay_roles_v1';
const SESSION_KEY = 'miki_roleplay_session_v1';

const normalizeName = (value: string): string => value.replace(/\s+/g, ' ').trim();

export class RoleplaySessionService {
  private static instance: RoleplaySessionService;
  private roles: RoleDefinition[] | null = null;
  private session: RoleplaySession | null | undefined = undefined;

  private constructor() {}

  public static getInstance(): RoleplaySessionService {
    if (!RoleplaySessionService.instance) {
      RoleplaySessionService.instance = new RoleplaySessionService();
    }
    return RoleplaySessionService.instance;
  }

  private loadRoles(): RoleDefinition[] {
    if (this.roles) return this.roles;
    let loaded: RoleDefinition[] = [];
    try {
      const raw = storageService.getItem(ROLES_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as RoleDefinition[];
        if (Array.isArray(parsed)) loaded = parsed.filter((r) => r && typeof r.name === 'string');
      }
    } catch {
      loaded = [];
    }
    this.roles = loaded;
    return loaded;
  }

  private persistRoles(): void {
    try {
      storageService.setItem(ROLES_KEY, JSON.stringify(this.roles ?? []));
    } catch { /* メモリ上の保持は続ける */ }
  }

  private loadSession(): RoleplaySession | null {
    if (this.session !== undefined) return this.session;
    let loaded: RoleplaySession | null = null;
    try {
      const raw = storageService.getItem(SESSION_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as RoleplaySession;
        if (parsed && typeof parsed.roleName === 'string') loaded = parsed;
      }
    } catch {
      loaded = null;
    }
    this.session = loaded;
    return loaded;
  }

  private persistSession(): void {
    try {
      if (this.session) storageService.setItem(SESSION_KEY, JSON.stringify(this.session));
      else storageService.removeItem(SESSION_KEY);
    } catch { /* メモリ上の保持は続ける */ }
  }

  public listRoles(): RoleDefinition[] {
    return [...this.loadRoles()];
  }

  public findRole(name: string): RoleDefinition | undefined {
    const key = normalizeName(name);
    if (!key) return undefined;
    const roles = this.loadRoles();
    return roles.find((r) => r.name === key) ?? roles.find((r) => r.name.includes(key) || key.includes(r.name));
  }

  /** 役を保存する。同名は上書き（定義の更新）。 */
  public saveRole(input: Omit<RoleDefinition, 'roleId' | 'createdAt'> & { roleId?: string }): RoleDefinition {
    const roles = this.loadRoles();
    const name = normalizeName(input.name);
    const existing = roles.find((r) => r.name === name);
    if (existing) {
      existing.stance = input.stance;
      existing.world = input.world;
      existing.toneHint = input.toneHint;
      existing.userRole = input.userRole;
      if (input.lastSummary !== undefined) existing.lastSummary = input.lastSummary;
      this.persistRoles();
      return existing;
    }
    const role: RoleDefinition = {
      roleId: input.roleId ?? `ROLE-${Date.now().toString(36).toUpperCase()}-${roles.length + 1}`,
      name,
      stance: input.stance,
      world: input.world,
      toneHint: input.toneHint,
      userRole: input.userRole,
      lastSummary: input.lastSummary,
      createdAt: Date.now(),
    };
    roles.push(role);
    this.persistRoles();
    return role;
  }

  public getSession(): RoleplaySession | null {
    return this.loadSession();
  }

  public isActive(): boolean {
    return this.loadSession() !== null;
  }

  /** 現在被せている役の定義。 */
  public getActiveRole(): RoleDefinition | undefined {
    const session = this.loadSession();
    if (!session) return undefined;
    return this.loadRoles().find((r) => r.roleId === session.roleId);
  }

  public startSession(role: RoleDefinition, personaId: string): RoleplaySession {
    const session: RoleplaySession = {
      roleId: role.roleId,
      roleName: role.name,
      personaId,
      startedAt: Date.now(),
      scene: role.world || '',
      summary: role.lastSummary || '',
    };
    this.session = session;
    this.persistSession();
    systemLogger.info('CHAT', `🎭 [なりチャ] ${role.name} の役を開始しました。`);
    return session;
  }

  /**
   * P523: セッション中の発話の内容語を、あらすじの材料として
   * 控える。創作の分離のため、ここに残るのは内容語だけで、
   * 現実の事実としては扱わない。
   */
  public noteTurn(text: string): void {
    const session = this.loadSession();
    if (!session) return;
    try {
      const terms = contentTermsFromTokens(japaneseAnalysisService.analyze(String(text || '')).tokens)
        .filter((t) => t.length >= 2 && !['した', 'する', '今日', '明日', '昨日', 'こと', 'もの', 'ため', 'よう', 'あと', 'それ', 'これ'].includes(t))
        .slice(0, 6);
      if (terms.length === 0) return;
      session.notedTerms = [...(session.notedTerms ?? []), ...terms].slice(-60);
      this.persistSession();
    } catch { /* 控えは補助経路 */ }
  }

  /** セッションを終える。あらすじは役に保存して次回の継続に使う。 */
  public endSession(): RoleplaySession | null {
    const session = this.loadSession();
    if (!session) return null;
    // P523: あらすじが手で付いていなければ、控えた内容語から
    // 自動で組み立てる（頻出の語＝その回の中心の話題）。
    if (!session.summary && session.notedTerms && session.notedTerms.length > 0) {
      const frequency = new Map<string, number>();
      for (const term of session.notedTerms) frequency.set(term, (frequency.get(term) ?? 0) + 1);
      const topTerms = [...frequency.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([term]) => term);
      if (topTerms.length > 0) {
        session.summary = `${session.roleName}として${session.scene ? `${session.scene}で` : ''}${topTerms.join('と')}の話をした。`;
        systemLogger.info('CHAT', `🎭 [なりチャ] あらすじを自動生成しました: ${session.summary}`);
      }
    }
    const role = this.loadRoles().find((r) => r.roleId === session.roleId);
    if (role && session.summary) {
      role.lastSummary = session.summary;
      this.persistRoles();
    }
    this.session = null;
    this.persistSession();
    systemLogger.info('CHAT', `🎭 [なりチャ] ${session.roleName} の役を終了しました。`);
    return session;
  }

  /** P536: 場面進行の歩数を1つ進めて返す（セッションに永続化）。 */
  public advanceSceneBeat(): number {
    const session = this.loadSession();
    if (!session) return 0;
    session.sceneBeats = (session.sceneBeats || 0) + 1;
    this.persistSession();
    return session.sceneBeats;
  }

  public setScene(scene: string): void {
    const session = this.loadSession();
    if (!session) return;
    session.scene = normalizeName(scene);
    // P577: 場面が変わったら、使った進行文の記録は持ち越さない。
    session.usedProgressions = [];
    this.persistSession();
  }

  /** P577: 使った場面進行文を記録する（重複排除用）。 */
  public noteProgressionUsed(text: string): void {
    const session = this.loadSession();
    if (!session) return;
    session.usedProgressions = [...(session.usedProgressions ?? []), text].slice(-24);
    this.persistSession();
  }

  public setSummary(summary: string): void {
    const session = this.loadSession();
    if (!session) return;
    session.summary = String(summary || '').trim();
    this.persistSession();
  }

  /**
   * 会話の入口でセッションの開始・終了を拾う。開始は「<役名>として
   * 話して／演じて」「<役名>になりきって」「なりチャ：<役名>」の
   * 明示的な言い方だけに反応する。保存済みの役が無ければ、その名前
   * で仮の役を作って保存する（後から定義を育てられる）。
   */
  public handleUserText(text: string, personaId: string): 'started' | 'ended' | undefined {
    const source = String(text || '');
    if (!source.trim()) return undefined;
    // P554: 終了の誤爆対策。強い信号（なりチャそのものへの明示の終了
    // 指示）は即終了。弱い信号（「元に戻って」「役をやめる」）は役の
    // 中の台詞にも出うるので、1回では終わらせず、3歩以内にもう一度
    // 来たときだけ確定する。
    if (/なりチャ(?:終わり|おわり|終了|おしまい)|役を(?:終わり|おわり|終了|やめて)|なりきり(?:終わり|終了)/.test(source)) {
      if (this.isActive()) {
        this.endSession();
        return 'ended';
      }
      return undefined;
    }
    if (/役を(?:やめる|やめたい|やめよう|やめます)|(?:普通|元)に(?:戻って|もどって)/.test(source)) {
      const session = this.loadSession();
      if (!session) return undefined;
      const beats = session.sceneBeats || 0;
      if (session.pendingEndBeat !== undefined && beats - session.pendingEndBeat <= 3) {
        this.endSession();
        return 'ended';
      }
      session.pendingEndBeat = beats;
      this.session = session;
      this.persistSession();
      systemLogger.info('CHAT', '🎭 [なりチャ] 弱い終了信号を検出しました。もう一度で終了します。');
      return undefined;
    }
    // P579: 場面の設定・変更（「場面は〜だよ」）。セッション中の
    // 発言として処理し、場面だけを差し替える。
    if (this.isActive()) {
      const sceneMatch = source.match(/場面は(.{1,24}?)(?:だよ|です|。|．|$)/);
      if (sceneMatch) {
        const scene = normalizeName(sceneMatch[1]);
        if (scene) {
          this.setScene(scene);
          systemLogger.info('CHAT', `🎭 [なりチャ] 場面を「${scene}」に設定しました。`);
        }
      }
    }
    const startMatch =
      source.match(/(.{1,20}?)(?:として)(?:話して|演じて|なりきって)/) ??
      source.match(/(.{1,20}?)(?:に)(?:なりきって)/) ??
      // P547: 「<役名>になって」は文末か依頼の形に限る（「〜になってから」
      // のような通常文を役の開始と誤認しないため）。
      source.match(/(.{1,20}?)(?:になって)(?:話して|演じて|ほしい|ください|お願い)?[。．!！]?$/) ??
      source.match(/なりチャ[:：]\s*(.{1,20})/);
    if (startMatch) {
      const name = normalizeName(startMatch[1].replace(/^(じゃあ|では|それじゃあ)/, ''));
      if (!name) return undefined;
      const role = this.findRole(name) ?? this.saveRole({ name, stance: '', world: '', toneHint: '', userRole: '' });
      this.startSession(role, personaId);
      return 'started';
    }
    return undefined;
  }
}

export const roleplaySessionService = RoleplaySessionService.getInstance();
