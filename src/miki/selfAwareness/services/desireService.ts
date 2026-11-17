import { selfPreferenceService } from './selfPreferenceService';
import { knowledgeGapService } from '../../unknown/services/knowledgeGapService';

/**
 * P909: 欲求の層（BDI の D、対応表#14）。
 *
 * 信念＝Claim 台帳、意図＝予定・プロジェクト台帳、と分離は
 * 進んでいたが、欲求側は自己選好（P578）の「記録」止まりで、
 * 行動を駆動する層としては薄かった。ここでは欲求を合成して
 * 一覧できる形にする:
 *   TALK（話したい）: 教示された好き・興味（強い。得意は能力の
 *     自己認識なので含めない）＋頻度由来の興味（弱い）。
 *   LEARN（知りたい）: 開いている知識ギャップ。不足の自覚が
 *     そのまま欲求になる。
 * 強さ順、同点は新しい教示を前に置く（今の欲求を優先する）。
 *
 * 欲求そのものはここでは合成まで。欲求が意図（学習）に変わる
 * 消費は自己点検（knowledgeSelfInspectionService）が担う。
 */

export interface Desire {
  kind: 'TALK' | 'LEARN';
  term: string;
  /** 0..1。教示された好き=1.0、興味=0.85、頻度由来=0.4。 */
  strength: number;
  source: 'taught' | 'derived' | 'gap';
  /** 教示の時刻（taught のみ）。同点の並び替えに使う。 */
  at?: number;
}

class DesireService {
  public compose(personaId: string): Desire[] {
    const desires: Desire[] = [];
    try {
      for (const p of selfPreferenceService.listTaught(personaId)) {
        if (p.kind === 'like') {
          desires.push({ kind: 'TALK', term: p.term, strength: 1.0, source: 'taught', at: p.at });
        } else if (p.kind === 'interest') {
          desires.push({ kind: 'TALK', term: p.term, strength: 0.85, source: 'taught', at: p.at });
        }
      }
      for (const term of selfPreferenceService.derivedInterests(personaId, 10)) {
        if (!desires.some((d) => d.term === term)) {
          desires.push({ kind: 'TALK', term, strength: 0.4, source: 'derived' });
        }
      }
    } catch { /* 選好が読めなくても本流は止めない */ }
    try {
      for (const g of knowledgeGapService.listOpen(50)) {
        const term = String(g.identity?.target || '').trim();
        if (!term) continue;
        if (desires.some((d) => d.kind === 'LEARN' && d.term === term)) continue;
        const strength = Math.min(0.9, Math.max(0.2, (g.priority || 50) / 100));
        desires.push({ kind: 'LEARN', term, strength, source: 'gap' });
      }
    } catch { /* ギャップが読めなくても本流は止めない */ }
    return desires.sort((a, b) => (b.strength - a.strength) || ((b.at || 0) - (a.at || 0)));
  }
}

export const desireService = new DesireService();
