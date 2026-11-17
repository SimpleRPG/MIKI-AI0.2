import { storageService } from '../../../services/storageService';
import { systemLogger } from '../../../services/systemLogger';
import { conversationFactIntakeService } from '../../conversation/services/conversationFactIntakeService';
import { claimDatabaseService } from '../../memory/services/claimDatabaseService';

/**
 * P937: 根拠つきで反論できること（第1段）。
 *
 * 利用者の断定が、彼女が検証済み（SUPPORTED / DEVICE_VERIFIED）と
 * して持つ Claim と食い違うときだけ、記録を根拠に静かに異を唱える。
 * 未検証の知識では反論しない。利用者自身の事実の更新（訂正形）や
 * 質問には口を挟まない——決めるのは利用者で、彼女の役割は
 * 「確かめた記録と違うよ」と根拠を示すところまで。
 */

const STORAGE_KEY = 'miki_rebuttals_v1';
const STRONG_STATUS = new Set(['SUPPORTED', 'DEVICE_VERIFIED']);

export interface RebuttalHit {
  entity: string;
  attribute?: string;
  userValue: string;
  claimValue: string;
  claimText: string;
}

interface RebuttalState {
  count: number;
  last?: { entity: string; userValue: string; claimValue: string; at: number };
}

class GroundedRebuttalService {
  private load(): RebuttalState {
    try {
      const parsed = JSON.parse(storageService.getItem(STORAGE_KEY) || '{"count":0}');
      if (parsed && typeof parsed.count === 'number') return parsed;
    } catch { /* fallthrough */ }
    return { count: 0 };
  }

  /**
   * 断定文を検証済み Claim と照合する。食い違いがあれば根拠を返し、
   * なければ null。質問・訂正・依頼の形には反応しない。
   */
  public check(userText: string): RebuttalHit | null {
    const text = String(userText || '');
    if (!text) return null;
    if (/[？?]/.test(text)) return null;
    if (/(?:じゃなくて|ではなく)/.test(text)) return null;
    if (/(?:教えて|調べて|探して|見せて)/.test(text)) return null;
    let facts;
    try {
      facts = conversationFactIntakeService.extractUserFacts(text).facts;
    } catch { return null; }
    // 属性のある事実だけを対象にする。属性のない自由な描写
    // （「モコロンは綿毛が取れる羊みたいなパル」等）は、別の描写と
    // 食い違っても矛盾ではないので反論しない。
    const fact = facts.find((f) => f.entity && f.value && f.attribute);
    if (!fact || !fact.entity || !fact.value) return null;
    let claims;
    try {
      claims = claimDatabaseService.searchClaims(fact.entity, 8) as any[];
    } catch { return null; }
    for (const claim of claims) {
      if (!claim || !STRONG_STATUS.has(String(claim.status || ''))) continue;
      const statement = String(claim.statement || '');
      if (!statement) continue;
      let claimFacts;
      try {
        claimFacts = conversationFactIntakeService.extractUserFacts(statement).facts;
      } catch { continue; }
      const cf = claimFacts.find((f) => f.entity === fact.entity && f.value && f.attribute);
      if (!cf || !cf.value) continue;
      if ((cf.attribute || '') !== (fact.attribute || '')) continue;
      if (cf.value === fact.value) continue;
      const state = this.load();
      state.count += 1;
      state.last = { entity: fact.entity, userValue: fact.value, claimValue: cf.value, at: Date.now() };
      storageService.setItem(STORAGE_KEY, JSON.stringify(state));
      systemLogger.info('SYSTEM', `🗣 [反論] 「${fact.entity}」について記録と異なる断定に根拠を示した（記録: ${cf.value} / 断定: ${fact.value}）`);
      return {
        entity: fact.entity,
        attribute: fact.attribute,
        userValue: fact.value,
        claimValue: cf.value,
        claimText: statement,
      };
    }
    return null;
  }

  public summary(): { rebuttals: number } {
    return { rebuttals: this.load().count };
  }
}

export const groundedRebuttalService = new GroundedRebuttalService();
