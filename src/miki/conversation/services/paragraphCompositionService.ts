import { worldModelGraphService } from '../../selfAwareness/services/worldModelGraphService';
import { claimDatabaseService } from '../../memory/services/claimDatabaseService';
import { roleplaySessionService } from './roleplaySessionService';
import { systemLogger } from '../../../services/systemLogger';

/**
 * P525/P526: 段落合成（決定論）。
 *
 * 彼女の回答は「結論1文＋付属品」で終わりがちで、文章を段落として
 * 編む段が無かった。ここでは、彼女が既に検証済みで持っている材料
 * だけを使って、2文目・3文目を組み立てる。
 *
 * P525 の材料:
 *   1. 世界モデルの確定した関係（仮の関係 provisional は使わない）
 *      を、関係タイプごとの言い換え型で文にする。
 *   2. 質問にマッチした補助 Claim の statement（検証済みの文その
 *      もの）を、重複しない範囲で1文添える。
 * 新しい事実は作らない。材料が無ければ段落は付かない。
 *
 * P526 の材料（なりチャの地の文）:
 *   セッションの「場面」から、場面の質感を表す1文を選ぶ。創作の
 *   層の中だけの話で、事実の材料とは混ぜない。毎ターン付けると
 *   型が目立つので、種に応じて間引く。
 */
class ParagraphCompositionService {
  public buildSupplements(params: {
    subjectTerms: string[];
    supportingClaims: Array<{ claim_id: string; statement: string }>;
    excludeClaimId?: string;
    excludeText: string;
  }): string[] {
    const out: string[] = [];
    const terms = [...new Set(params.subjectTerms)].filter((t) => t && t.length >= 2);
    const usable = (statement: string): boolean =>
      statement.length >= 8 &&
      statement.length <= 140 &&
      !params.excludeText.includes(statement.slice(0, 12)) &&
      !out.some((s) => s.includes(statement.slice(0, 12)));

    // 1. 世界モデルの関係を文にする
    try {
      const entities = worldModelGraphService.entities();
      // WorldRelation の from/to は実体の「名前」で保持されている。
      const matchedNames = new Set(
        entities
          .filter((e) => terms.some((t) => t === e.name || t.includes(e.name)))
          .map((e) => e.name),
      );
      if (matchedNames.size > 0) {
        const relations = worldModelGraphService
          .relations()
          .filter((r) => !r.provisional && (matchedNames.has(r.from) || matchedNames.has(r.to)))
          .sort((a, b) => (b.confidence || 0) - (a.confidence || 0));
        for (const relation of relations) {
          const sentence = this.verbalizeRelation(relation.type, relation.from, relation.to);
          if (sentence && !params.excludeText.includes(sentence.slice(0, 10))) {
            out.push(sentence);
            break;
          }
        }
      }
    } catch {
      /* 世界モデルが読めなければ Claim の段落だけにする */
    }

    // 2. 補助 Claim の文を添える。findBestMatchingClaim の
    // supportingClaims は主 Claim 自身しか返さないため、同じ主題の
    // 検証済み Claim を台帳から直接拾うのが本命の経路。
    const pushClaim = (statement: string) => {
      const st = String(statement || '').trim();
      if (usable(st)) out.push(/[。．.]$/.test(st) ? st : `${st}。`);
    };
    for (const claim of params.supportingClaims || []) {
      if (out.length >= 2) break;
      if (params.excludeClaimId && claim.claim_id === params.excludeClaimId) continue;
      pushClaim(claim.statement);
    }
    if (out.length < 2 && terms.length > 0) {
      try {
        for (const claim of claimDatabaseService.listClaims()) {
          if (out.length >= 2) break;
          if (params.excludeClaimId && claim.claim_id === params.excludeClaimId) continue;
          if (claim.status !== 'SUPPORTED' && claim.status !== 'DEVICE_VERIFIED') continue;
          const st = String(claim.statement || '').trim();
          if (!terms.some((t) => st.includes(t))) continue;
          pushClaim(st);
        }
      } catch {
        /* 台帳が読めなければ関係の段落だけにする */
      }
    }

    if (out.length > 0) {
      try {
        systemLogger.info('CHAT', `🧩 [段落合成] 検証済みの材料から ${out.length} 文の段落を編みました`);
      } catch { /* ログは補助 */ }
    }
    return out.slice(0, 2);
  }

  private verbalizeRelation(type: string, from?: string, to?: string): string | undefined {
    if (!from || !to) return undefined;
    switch (type) {
      case 'IS_A': return `${from}は${to}の一種です。`;
      case 'PART_OF': return `${from}は${to}の一部です。`;
      case 'CAUSES': return `${from}は${to}を引き起こすことがあります。`;
      case 'ENABLES': return `${from}があると、${to}ができるようになります。`;
      case 'USED_FOR': return `${from}は${to}に使われます。`;
      default: return undefined;
    }
  }

  /**
   * P526: なりチャの場面の地の文（接尾辞として本文に足す1文）。
   * セッションが無ければ undefined。約3回に1回は間引く。
   */
  public sceneTextureSuffix(seedText: string): string | undefined {
    const session = roleplaySessionService.getSession();
    if (!session) return undefined;
    const scene = String(session.scene || '').trim();
    if (!scene) return undefined;
    const seed = seedText.length + scene.length + (session.notedTerms?.length || 0);
    if (seed % 3 === 0) return undefined;
    const pools: Array<[RegExp, string[]]> = [
      [/教室|学校|授業/, ['黒板には、今日の予定が書かれています。', '窓の外からは、校庭のざわめきが聞こえてきます。']],
      [/海|浜|港|船/, ['波の音が、静かに繰り返し聞こえています。', '潮風が、頬を撫でていきます。']],
      [/森|林|山/, ['木漏れ日が、足元に揺れています。', '鳥の声が、遠くで聞こえています。']],
      [/街|町|店/, ['通りのざわめきが、少し遠くに聞こえています。']],
      [/城|宮殿/, ['石の廊下に、足音が低く響いています。']],
      [/部屋|家|自宅/, ['部屋の中は、静かな空気に満ちています。']],
    ];
    for (const [pattern, pool] of pools) {
      if (pattern.test(scene)) return pool[seed % pool.length];
    }
    const generic = [
      `${scene}の時間が、ゆっくりと流れています。`,
      `${scene}は、穏やかな空気に包まれています。`,
    ];
    return generic[seed % generic.length];
  }
}

export const paragraphCompositionService = new ParagraphCompositionService();
