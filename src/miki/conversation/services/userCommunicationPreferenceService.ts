import { storageService } from '../../../services/storageService';

/**
 * P394: the user's standing instructions about HOW to answer.
 *
 * MIKI already kept a persona for itself and episodes of what was
 * said, but nothing remembered what the user asked for in terms of
 * delivery: "短くして" shaped one answer and was then forgotten, so
 * the next answer arrived at the default length again. This service
 * keeps exactly that — the user's standing delivery preferences —
 * and the answer composition consults it when a request carries no
 * detail instruction of its own.
 *
 * Scope, deliberately narrow: only short utterances that are about
 * the answering style itself become standing preferences. A long
 * request that happens to contain 詳しく stays a per-request wish
 * and is not remembered. The newest instruction wins; an explicit
 * "いつも通りに戻して" clears the preference.
 */
export interface UserCommunicationPreference {
  verbosity?: 'BRIEF' | 'DETAILED';
  sourceText: string;
  updatedAt: number;
}

const STORAGE_KEY = 'miki_user_communication_preference_v1';
const MAX_STANDING_UTTERANCE_LENGTH = 30;

const BRIEF_PATTERN = /短く(して|答えて|教えて|お願い)|簡潔に|手短に|要点だけ/;
const DETAILED_PATTERN = /詳しく(して|教えて|説明)|くわしく(教えて|説明)|丁寧に説明/;
const RESET_PATTERN = /いつも通り|元に戻して|普通に(答えて|して|お願い)/;

class UserCommunicationPreferenceService {
  private preference: UserCommunicationPreference | undefined;
  private loaded = false;

  private load(): void {
    if (this.loaded) return;
    this.loaded = true;
    try {
      const raw = storageService.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as UserCommunicationPreference;
      if (parsed && (parsed.verbosity === 'BRIEF' || parsed.verbosity === 'DETAILED')) this.preference = parsed;
    } catch { /* a broken store means no standing preference */ }
  }

  private save(): void {
    try {
      if (this.preference) storageService.setItem(STORAGE_KEY, JSON.stringify(this.preference));
      else storageService.removeItem(STORAGE_KEY);
    } catch { /* best-effort, like other learned state */ }
  }

  /** Observe one user utterance; returns the preference now in force. */
  public observeUserInput(text: string): UserCommunicationPreference | undefined {
    this.load();
    const value = String(text || '').trim();
    if (!value || value.length > MAX_STANDING_UTTERANCE_LENGTH) return this.preference;
    if (RESET_PATTERN.test(value)) {
      if (this.preference) { this.preference = undefined; this.save(); }
      return this.preference;
    }
    const verbosity = BRIEF_PATTERN.test(value) ? 'BRIEF' : DETAILED_PATTERN.test(value) ? 'DETAILED' : undefined;
    if (verbosity && this.preference?.verbosity !== verbosity) {
      this.preference = { verbosity, sourceText: value.slice(0, 64), updatedAt: Date.now() };
      this.save();
    }
    return this.preference;
  }

  public getPreference(): UserCommunicationPreference | undefined {
    this.load();
    return this.preference ? { ...this.preference } : undefined;
  }

  /** The standing detail level, if the user has expressed one. */
  public currentDetailLevel(): 'BRIEF' | 'DETAILED' | undefined {
    this.load();
    return this.preference?.verbosity;
  }

  public clear(): void {
    this.load();
    this.preference = undefined;
    this.save();
  }
}

export const userCommunicationPreferenceService = new UserCommunicationPreferenceService();
