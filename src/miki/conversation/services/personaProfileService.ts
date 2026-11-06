import { storageService } from '../../../services/storageService';
import { systemLogger } from '../../../services/systemLogger';
import { canonicalSha256 } from '../../core/services/canonicalSha256Service';
import type { PersonaConfig } from '../../../types';

export interface PersonaProfile {
  schemaVersion: 1;
  profileId: string;
  revision: number;
  name: string;
  personalityText: string;
  avatarId: string;
  avatarAssetVersion: number;
  createdAt: number;
  updatedAt: number;
  // P454: fields that let one profile fully describe one persona, so the
  // App-side PersonaConfig can be derived from the active profile instead
  // of being managed as a second, diverging copy.
  configId?: string;
  tagline?: string;
  speakingStyle?: string;
  userNickname?: string;
  extras?: Record<string, unknown>;
}

export interface PersonaRoster {
  schemaVersion: 1;
  activeProfileId: string;
  profiles: PersonaProfile[];
}

export interface PersonaCommunicationStyle {
  politeness: number;
  warmth: number;
  formality: number;
  verbosity: number;
  technicalExplanation: boolean;
}

export interface PersonaProfileReceipt {
  receiptId: string;
  profileId: string;
  revision: number;
  profileSha256: string;
  persistedAt: number;
  reloaded: true;
}

const PROFILE_KEY = 'miki_persona_profile_v1';
const ROSTER_KEY = 'miki_persona_roster_v1';
const LEGACY_KEY = 'gamecraft_persona';
const DEFAULT_PROFILE: PersonaProfile = {
  schemaVersion: 1,
  profileId: 'persona-default',
  revision: 1,
  name: 'MIKI-AI',
  personalityText: '親しみやすく、落ち着いた、簡潔で丁寧な話し方',
  avatarId: 'miki-default',
  avatarAssetVersion: 1,
  createdAt: 0,
  updatedAt: 0,
};

// P454: Bibi — same shared brain as Miki, a different person. Kiria's image:
// a youngish, slightly goofy kid. The goofiness lives in wording and
// reactions, not in knowledge. Her personalityText is written so that
// deriveCommunicationStyle lands on different axes than Miki's
// (warmth HIGH / formality LOW / verbosity CONCISE on the surface).
export const BIBI_PROFILE_ID = 'persona-bibi';
const BIBI_PROFILE: PersonaProfile = {
  schemaVersion: 1,
  profileId: BIBI_PROFILE_ID,
  revision: 1,
  name: 'ビービー',
  personalityText: '幼くて素直で、ちょっとおっちょこちょいな妹みたいな子。優しくて温かく、カジュアルで気軽な話し方をします。知っていることは得意げに話し、難しいことは短く言い換えて一生懸命伝えます。',
  avatarId: 'bibi-default',
  avatarAssetVersion: 1,
  createdAt: 0,
  updatedAt: 0,
  configId: 'bibi_default',
  tagline: '頭脳はみきとおそろい。でも反応はちょっとあほな妹分',
  speakingStyle: '幼いタメ口（〜だよ、〜なの？、わーい、えへへ）。分からないことは素直に「わかんない」と言い、知っていることは自慢げに話す。感嘆と絵文字が多め。',
  // PROVISIONAL (P454): Kiria has not decided how Bibi addresses him yet.
  // Editable later from the persona settings / memory modal.
  userNickname: 'きりあ',
  // PROVISIONAL (P454): Bibi starts as a new acquaintance.
  extras: { intimacyLevel: 1, intimacyExp: 0 },
};

const AVATAR_TEXT_BY_ID: Record<string, string> = {
  'miki-default': '🌸',
  'miki-circle': '●',
  'miki-spark': '✦',
  'miki-cube': '◆',
  'bibi-default': '🎀',
};

// PersonaConfig keys that are mapped explicitly between the two shapes;
// everything else round-trips through PersonaProfile.extras.
const CONFIG_MAPPED_KEYS = new Set(['id', 'name', 'avatar', 'tagline', 'basePersonality', 'speakingStyle', 'userNickname']);

const clamp = (value: number) => Math.max(0, Math.min(100, value));
const has = (text: string, words: string[]) => words.some(word => text.includes(word));

class PersonaProfileService {
  getDefault(): PersonaProfile {
    const now = Date.now();
    // The reset affordance in the settings panel should offer the default
    // of the persona currently being edited, not always Miki's.
    const roster = this.readRoster();
    const base = roster?.activeProfileId === BIBI_PROFILE_ID ? BIBI_PROFILE : DEFAULT_PROFILE;
    return { ...base, createdAt: now, updatedAt: now };
  }

  get(): PersonaProfile {
    const roster = this.ensureRoster();
    return roster.profiles.find(p => p.profileId === roster.activeProfileId) ?? roster.profiles[0];
  }

  listProfiles(): PersonaProfile[] {
    return this.ensureRoster().profiles;
  }

  getActiveProfileId(): string {
    return this.ensureRoster().activeProfileId;
  }

  deriveCommunicationStyle(profile: PersonaProfile): PersonaCommunicationStyle {
    const text = profile.personalityText.toLowerCase();
    return {
      politeness: clamp(has(text, ['丁寧', '礼儀', 'polite']) ? 85 : 65),
      warmth: clamp(has(text, ['温か', '親し', '優し', 'warm', 'friendly']) ? 85 : 60),
      formality: clamp(has(text, ['格式', 'フォーマル', 'formal']) ? 80 : has(text, ['気軽', 'カジュアル']) ? 35 : 55),
      verbosity: clamp(has(text, ['詳し', '丁寧に説明']) ? 75 : has(text, ['簡潔', '短く']) ? 30 : 50),
      technicalExplanation: has(text, ['分かりやす', '専門語', '解説', '説明']),
    };
  }

  preview(profile: PersonaProfile): Record<'short' | 'technical' | 'correction' | 'unknown', string> {
    const style = this.deriveCommunicationStyle(profile);
    const soft = style.warmth >= 75 ? 'できるだけ分かりやすく' : '要点を整理して';
    const concise = style.verbosity <= 40 ? '結論からお伝えします。' : '結論と根拠を順に整理します。';
    return {
      short: `${profile.name}です。${concise}`,
      technical: `${profile.name}です。${soft}、技術的な前提と確認結果を分けて説明します。`,
      correction: `ご指摘の内容を確認し、事実と表現を分けて修正します。`,
      unknown: `確認できていない点は確定事項にせず、不足している根拠を明示します。`,
    };
  }

  async save(input: Pick<PersonaProfile, 'name' | 'personalityText' | 'avatarId'>): Promise<{ profile: PersonaProfile; receipt: PersonaProfileReceipt }> {
    const name = input.name.trim();
    const personalityText = input.personalityText.trim();
    if (!name || name.length > 40) throw new Error('PERSONA_NAME_INVALID');
    if (!personalityText || personalityText.length > 500) throw new Error('PERSONALITY_TEXT_INVALID');
    const current = this.get();
    const now = Date.now();
    const profile: PersonaProfile = {
      ...current,
      name,
      personalityText,
      avatarId: input.avatarId || 'miki-default',
      avatarAssetVersion: current.avatarId === input.avatarId ? current.avatarAssetVersion : current.avatarAssetVersion + 1,
      revision: current.revision + 1,
      updatedAt: now,
    };
    const profileSha256 = canonicalSha256(profile);
    this.persistActive(profile);
    const reloaded = this.get();
    if (canonicalSha256(reloaded) !== profileSha256) throw new Error('PERSONA_PROFILE_PERSISTENCE_FAILED');
    const receipt: PersonaProfileReceipt = {
      receiptId: `PPR-${profileSha256.slice(0, 20)}`,
      profileId: profile.profileId,
      revision: profile.revision,
      profileSha256,
      persistedAt: now,
      reloaded: true,
    };
    window.dispatchEvent(new CustomEvent('miki-persona-profile-updated', { detail: profile }));
    return { profile, receipt };
  }

  /**
   * P454: switch the active persona. Knowledge, memories, claims and
   * conversation history are shared and untouched; only the persona stores
   * (roster / active profile copy / legacy App config) change.
   */
  switchProfile(profileId: string): PersonaProfile {
    const roster = this.ensureRoster();
    const target = roster.profiles.find(p => p.profileId === profileId);
    if (!target) throw new Error('PERSONA_PROFILE_NOT_FOUND');
    if (roster.activeProfileId === profileId) return target;
    const next: PersonaRoster = { ...roster, activeProfileId: profileId };
    storageService.setItem(ROSTER_KEY, JSON.stringify(next));
    storageService.setItem(PROFILE_KEY, JSON.stringify(target));
    // Rewrite the legacy App config from the newly active persona's own
    // fields, so nothing of the previous persona (tagline, nickname, ...)
    // leaks into the other one.
    storageService.setItem(LEGACY_KEY, JSON.stringify(this.toPersonaConfig(target)));
    systemLogger.info('CHAT', `[P454] Persona switched: ${target.name} (${target.profileId})`);
    window.dispatchEvent(new CustomEvent('miki-persona-profile-updated', { detail: target }));
    return target;
  }

  /** Derive the App-side PersonaConfig view of the active persona. */
  getActivePersonaConfig(): PersonaConfig {
    return this.toPersonaConfig(this.get());
  }

  toPersonaConfig(profile: PersonaProfile): PersonaConfig {
    return {
      ...(profile.extras ?? {}),
      id: profile.configId || profile.profileId,
      name: profile.name,
      avatar: this.avatarTextFor(profile),
      tagline: profile.tagline ?? '',
      basePersonality: profile.personalityText,
      speakingStyle: profile.speakingStyle ?? profile.personalityText,
      userNickname: profile.userNickname ?? 'あなた',
    } as PersonaConfig;
  }

  /**
   * P454: reflect App-side persona edits (memory modal etc.) into the
   * active roster profile, so edits survive switching away and back.
   * Storage only — never dispatches events, so it cannot loop with the
   * App's persistence effect.
   */
  syncActiveFromPersonaConfig(config: PersonaConfig): void {
    try {
      const roster = this.ensureRoster();
      const active = roster.profiles.find(p => p.profileId === roster.activeProfileId);
      if (!active || !config || typeof config !== 'object') return;
      // Only sync into the profile this config belongs to; a stale config
      // of the other persona must never overwrite the active one.
      const configId = typeof config.id === 'string' ? config.id : undefined;
      if (configId && active.configId && configId !== active.configId) return;
      const extras: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(config)) {
        if (!CONFIG_MAPPED_KEYS.has(key) && value !== undefined) extras[key] = value;
      }
      const next: PersonaProfile = {
        ...active,
        configId: configId ?? active.configId,
        name: typeof config.name === 'string' && config.name.trim() ? config.name : active.name,
        personalityText: typeof config.basePersonality === 'string' && config.basePersonality.trim() ? config.basePersonality : active.personalityText,
        speakingStyle: typeof config.speakingStyle === 'string' ? config.speakingStyle : active.speakingStyle,
        tagline: typeof config.tagline === 'string' ? config.tagline : active.tagline,
        userNickname: typeof config.userNickname === 'string' ? config.userNickname : active.userNickname,
        avatarId: this.avatarIdFromConfigAvatar(config.avatar, active),
        extras,
      };
      if (canonicalSha256(next) === canonicalSha256(active)) return;
      next.revision = active.revision + 1;
      next.updatedAt = Date.now();
      this.persistActive(next);
    } catch {
      // Persona sync must never break the App's own persistence path.
    }
  }

  private avatarTextFor(profile: PersonaProfile): string {
    const mapped = AVATAR_TEXT_BY_ID[profile.avatarId];
    if (mapped) return mapped;
    // Migrated profiles may carry the emoji itself as the avatar id.
    if (profile.avatarId && profile.avatarId.length <= 4) return profile.avatarId;
    return '🌸';
  }

  private avatarIdFromConfigAvatar(avatar: unknown, active: PersonaProfile): string {
    if (typeof avatar !== 'string' || !avatar) return active.avatarId;
    if (avatar === this.avatarTextFor(active)) return active.avatarId;
    const byText = Object.entries(AVATAR_TEXT_BY_ID).find(([, text]) => text === avatar);
    return byText ? byText[0] : avatar;
  }

  private persistActive(profile: PersonaProfile): void {
    const roster = this.ensureRoster();
    const next: PersonaRoster = {
      ...roster,
      profiles: roster.profiles.map(p => (p.profileId === profile.profileId ? profile : p)),
    };
    storageService.setItem(ROSTER_KEY, JSON.stringify(next));
    storageService.setItem(PROFILE_KEY, JSON.stringify(profile));
    this.writeLegacyCompatibility(profile);
  }

  private readRoster(): PersonaRoster | null {
    const saved = storageService.getItem(ROSTER_KEY);
    if (!saved) return null;
    try {
      const parsed = JSON.parse(saved) as PersonaRoster;
      if (parsed?.schemaVersion !== 1 || !Array.isArray(parsed.profiles) || parsed.profiles.length === 0) return null;
      const profiles = parsed.profiles.map(p => this.validate(p));
      const activeProfileId = profiles.some(p => p.profileId === parsed.activeProfileId) ? parsed.activeProfileId : profiles[0].profileId;
      return { schemaVersion: 1, activeProfileId, profiles };
    } catch {
      return null;
    }
  }

  private ensureRoster(): PersonaRoster {
    const existing = this.readRoster();
    if (existing) {
      // Rosters built before Bibi existed gain her on first read.
      if (!existing.profiles.some(p => p.profileId === BIBI_PROFILE_ID)) {
        const next: PersonaRoster = { ...existing, profiles: [...existing.profiles, this.buildBibiProfile()] };
        storageService.setItem(ROSTER_KEY, JSON.stringify(next));
        return next;
      }
      return existing;
    }
    const miki = this.buildMikiProfile();
    const roster: PersonaRoster = { schemaVersion: 1, activeProfileId: miki.profileId, profiles: [miki, this.buildBibiProfile()] };
    storageService.setItem(ROSTER_KEY, JSON.stringify(roster));
    return roster;
  }

  private buildBibiProfile(): PersonaProfile {
    const now = Date.now();
    return { ...BIBI_PROFILE, createdAt: now, updatedAt: now };
  }

  /**
   * Build the roster's Miki entry from whatever the device already has:
   * the single-profile store when present, otherwise the legacy App
   * config migration — enriched with the legacy display fields so the
   * App-side view of Miki stays exactly what the user already sees.
   */
  private buildMikiProfile(): PersonaProfile {
    let base: PersonaProfile | null = null;
    const saved = storageService.getItem(PROFILE_KEY);
    if (saved) {
      try { base = this.validate(JSON.parse(saved)); } catch { base = null; }
    }
    if (!base) base = this.migrateLegacy();
    const legacy = this.readLegacyConfig();
    if (!legacy) return base;
    const extras: Record<string, unknown> = { ...(base.extras ?? {}) };
    for (const [key, value] of Object.entries(legacy)) {
      if (!CONFIG_MAPPED_KEYS.has(key) && key !== 'color' && value !== undefined) extras[key] = value;
    }
    if (typeof legacy.color === 'string') extras.color = legacy.color;
    return {
      ...base,
      // If the profile side still carries the untouched built-in default
      // name while the App side knows her as みき, adopt what the user sees.
      name: base.name === DEFAULT_PROFILE.name && typeof legacy.name === 'string' && legacy.name.trim() ? legacy.name : base.name,
      configId: base.configId || (typeof legacy.id === 'string' ? legacy.id : 'miki_default'),
      tagline: base.tagline ?? (typeof legacy.tagline === 'string' ? legacy.tagline : undefined),
      speakingStyle: base.speakingStyle ?? (typeof legacy.speakingStyle === 'string' ? legacy.speakingStyle : undefined),
      userNickname: base.userNickname ?? (typeof legacy.userNickname === 'string' ? legacy.userNickname : undefined),
      extras,
    };
  }

  private readLegacyConfig(): Partial<PersonaConfig> | null {
    const raw = storageService.getItem(LEGACY_KEY);
    if (!raw) return null;
    try { return JSON.parse(raw) as Partial<PersonaConfig>; } catch { return null; }
  }

  private validate(value: unknown): PersonaProfile {
    if (!value || typeof value !== 'object') throw new Error('PERSONA_PROFILE_INVALID');
    const row = value as Partial<PersonaProfile>;
    if (row.schemaVersion !== 1 || !row.profileId || !row.name || !row.personalityText || !row.avatarId) throw new Error('PERSONA_PROFILE_INVALID');
    return row as PersonaProfile;
  }

  private migrateLegacy(): PersonaProfile {
    const raw = storageService.getItem(LEGACY_KEY);
    if (!raw) return this.getDefault();
    try {
      const legacy = JSON.parse(raw) as Partial<PersonaConfig>;
      const now = Date.now();
      const profile: PersonaProfile = {
        ...this.getDefault(),
        profileId: legacy.id || 'persona-migrated',
        name: legacy.name?.trim() || DEFAULT_PROFILE.name,
        personalityText: legacy.basePersonality?.trim() || legacy.speakingStyle?.trim() || DEFAULT_PROFILE.personalityText,
        avatarId: legacy.avatar || DEFAULT_PROFILE.avatarId,
        createdAt: now,
        updatedAt: now,
      };
      storageService.setItem(PROFILE_KEY, JSON.stringify(profile));
      return profile;
    } catch {
      return this.getDefault();
    }
  }

  private writeLegacyCompatibility(profile: PersonaProfile): void {
    const raw = storageService.getItem(LEGACY_KEY);
    let legacy: Partial<PersonaConfig> = {};
    try { legacy = raw ? JSON.parse(raw) : {}; } catch { legacy = {}; }
    storageService.setItem(LEGACY_KEY, JSON.stringify({
      ...legacy,
      id: legacy.id || profile.profileId,
      name: profile.name,
      avatar: this.avatarTextFor(profile),
      basePersonality: profile.personalityText,
      speakingStyle: profile.personalityText,
    }));
  }
}

export const personaProfileService = new PersonaProfileService();
