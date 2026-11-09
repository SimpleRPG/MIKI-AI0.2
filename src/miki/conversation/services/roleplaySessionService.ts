import { storageService } from '../../../services/storageService';
import { systemLogger } from '../../../services/systemLogger';

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

  /** セッションを終える。あらすじは役に保存して次回の継続に使う。 */
  public endSession(): RoleplaySession | null {
    const session = this.loadSession();
    if (!session) return null;
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

  public setScene(scene: string): void {
    const session = this.loadSession();
    if (!session) return;
    session.scene = normalizeName(scene);
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
    if (/なりチャ(?:終わり|おわり|終了)|役を(?:終わり|おわり|終了|やめ)|なりきり(?:終わり|終了)/.test(source)) {
      if (this.isActive()) {
        this.endSession();
        return 'ended';
      }
      return undefined;
    }
    const startMatch =
      source.match(/(.{1,20}?)(?:として)(?:話して|演じて|なりきって)/) ??
      source.match(/(.{1,20}?)(?:に)(?:なりきって)/) ??
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
