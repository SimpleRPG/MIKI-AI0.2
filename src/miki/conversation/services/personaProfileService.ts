import { storageService } from '../../../services/storageService';
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

const clamp = (value: number) => Math.max(0, Math.min(100, value));
const has = (text: string, words: string[]) => words.some(word => text.includes(word));

class PersonaProfileService {
  getDefault(): PersonaProfile {
    const now = Date.now();
    return { ...DEFAULT_PROFILE, createdAt: now, updatedAt: now };
  }

  get(): PersonaProfile {
    const saved = storageService.getItem(PROFILE_KEY);
    if (saved) {
      try {
        return this.validate(JSON.parse(saved));
      } catch {
        return this.getDefault();
      }
    }
    return this.migrateLegacy();
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
    storageService.setItem(PROFILE_KEY, JSON.stringify(profile));
    this.writeLegacyCompatibility(profile);
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
      avatar: profile.avatarId,
      basePersonality: profile.personalityText,
      speakingStyle: profile.personalityText,
    }));
  }
}

export const personaProfileService = new PersonaProfileService();
