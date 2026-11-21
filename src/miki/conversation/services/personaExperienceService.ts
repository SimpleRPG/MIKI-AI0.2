import { storageService } from '../../../services/storageService';

/**
 * P1120: 人格の経験特性（測るだけの台帳）。
 *
 * 人格の話し方の軸（deriveCommunicationStyle）は性格文からの純粋な
 * 導出で、経験では一切動かなかった。ここでは「話し方への明示的な
 * フィードバック」を人格ごとに数えるだけの台帳を持つ。生成には
 * まだ効かせない：まず実データとして何がどれだけ溜まるかを見て、
 * 効かせる（有界オフセット）かどうかは次の段階で判断する。
 *
 * 数えるのは、彼女の返し方への指示として読める明示形だけ。
 * 内容への言及（「髪が長い」等）や感謝（「丁寧に教えてくれて
 * ありがとう」）を数えないよう、形は返信への要求に寄せる。
 * 発話そのものは残さず、カウンタだけを持つ（userStateTrail の流儀）。
 */

export type PersonaExperienceAxis = 'verbosityDown' | 'verbosityUp' | 'formalityDown' | 'formalityUp';

export interface PersonaExperienceEntry {
  verbosityDown: number;
  verbosityUp: number;
  formalityDown: number;
  formalityUp: number;
  events: number;
  updatedAt: number;
}

export interface PersonaExperienceSummary extends PersonaExperienceEntry {
  profileId: string;
  verbosityNet: number;
  formalityNet: number;
}

const STORAGE_KEY = 'miki_persona_experience_v1';

const VERBOSITY_DOWN = /(?:長すぎ|長過ぎ|もっと短く|短くして|短めに|簡潔に|手短に|話が長い|説明が長い|文章が長い|返事が長い)/;
const VERBOSITY_UP = /(?:もっと詳しく|詳しく(?:教えて|知りたい|聞きたい|説明)|くわしく(?:教えて|知りたい)|詳細に(?:教えて|説明)|もっと説明して)/;
const FORMALITY_DOWN = /(?:敬語いらない|敬語はいい|敬語なしで|敬語やめて|タメ口でいい|タメ口で話して|フランクに|くだけて話して)/;
const FORMALITY_UP = /(?:敬語で|敬語を使って|もっと丁寧に|丁寧に話して|丁寧な言葉で|丁寧語で)/;

const EMPTY: PersonaExperienceEntry = {
  verbosityDown: 0,
  verbosityUp: 0,
  formalityDown: 0,
  formalityUp: 0,
  events: 0,
  updatedAt: 0,
};

class PersonaExperienceService {
  private static instance: PersonaExperienceService;

  private constructor() {}

  public static getInstance(): PersonaExperienceService {
    if (!PersonaExperienceService.instance) {
      PersonaExperienceService.instance = new PersonaExperienceService();
    }
    return PersonaExperienceService.instance;
  }

  private loadAll(): Record<string, PersonaExperienceEntry> {
    try {
      const raw = storageService.getItem(STORAGE_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw) as Record<string, PersonaExperienceEntry>;
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }

  /** 発話が話し方フィードバックなら数える。当たった軸を返す。 */
  public recordFromText(text: string, profileId: string): PersonaExperienceAxis[] {
    const matched: PersonaExperienceAxis[] = [];
    try {
      const source = String(text || '');
      if (!profileId || source.length === 0 || source.length > 60) return matched;
      // 疑問符のある文は彼女への指示ではなく質問・相談として扱う。
      // utteranceFeatureService の questionForm は「教えて」のような
      // 依頼形も YESNO に寄せるため、ここでは疑問符そのものを見る。
      if (/[？?]/.test(source)) return matched;
      if (VERBOSITY_DOWN.test(source)) matched.push('verbosityDown');
      if (VERBOSITY_UP.test(source)) matched.push('verbosityUp');
      if (FORMALITY_DOWN.test(source)) matched.push('formalityDown');
      if (FORMALITY_UP.test(source)) matched.push('formalityUp');
      if (matched.length === 0) return matched;
      const all = this.loadAll();
      const entry: PersonaExperienceEntry = { ...EMPTY, ...(all[profileId] || {}) };
      for (const axis of matched) entry[axis] += 1;
      entry.events += matched.length;
      entry.updatedAt = Date.now();
      all[profileId] = entry;
      storageService.setItem(STORAGE_KEY, JSON.stringify(all));
    } catch { /* 経験の記録は補助経路 */ }
    return matched;
  }

  /** 測った結果の読み出し（診断・将来のオフセット判断用）。 */
  public summary(profileId: string): PersonaExperienceSummary {
    const entry: PersonaExperienceEntry = { ...EMPTY, ...(this.loadAll()[profileId] || {}) };
    return {
      profileId,
      ...entry,
      verbosityNet: entry.verbosityUp - entry.verbosityDown,
      formalityNet: entry.formalityUp - entry.formalityDown,
    };
  }
}

export const personaExperienceService = PersonaExperienceService.getInstance();
