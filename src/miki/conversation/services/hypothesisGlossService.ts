import { japaneseDictionaryService } from '../../research/services/japaneseDictionaryService';
import { pendingSlotService } from '../../memory/services/pendingSlotService';
import { systemLogger } from '../../../services/systemLogger';

export interface HypothesisGlossPart {
  surface: string;
  gloss: string;
}

export interface HypothesisGloss {
  term: string;
  gloss: string;
  parts: HypothesisGlossPart[];
}

export const INFERRED_SEMANTIC_ID = 'learned:inferred';

// 末尾に付くと「〜の○○」の形で繋ぐと読みやすい接尾の部分。
const SUFFIX_PARTS = new Set(['性', '的', '化', '用', '型', '式', '力', '学', '界', '向け']);

// 漢字・カタカナ・英数字だけの語（ひらがな混じりは助詞・活用の
// 断片を拾いやすいので推測の対象にしない）。
const TERM_SHAPE = /^[一-龠ァ-ヶーA-Za-z0-9]+$/;

/**
 * P900（ブレイクスルー② 仮説先行 v1）: 未知語の仮の意味づけ。
 *
 * 会話に出た未知語が、意味の分かる部分へ完全に分解できる場合に
 * 限り、部分の意味を繋いだ「仮の gloss」を個人辞書に PROVISIONAL
 * （semanticIds: learned:inferred）として登録する。彼女が
 * 「分からない」で止まらず、仮説を宣言して進むための材料。
 *
 * 守る線:
 * - 分解できない語には推測しない（従来の聞き返し／ギャップ行き）。
 * - 推測の上に推測を積まない（部分自体が推測由来なら使わない）。
 * - 事実の断定には使わない。Claim は登録しない。使うのは会話の
 *   継続と仮の理解だけ。
 * - 本物の教わり（user-taught）が来たら即置き換わる。教わり経路側の
 *   ガードも、推測由来だけの gloss は上書き可としてある（P900）。
 */
class HypothesisGlossService {
  /** その語の gloss が推測由来だけかどうか。 */
  public hasInferredOnlyGloss(term: string): boolean {
    try {
      const glossed = japaneseDictionaryService.lookup(term).filter((e) => e.gloss);
      return glossed.length > 0 && glossed.every((e) => (e.semanticIds || []).includes(INFERRED_SEMANTIC_ID));
    } catch { return false; }
  }

  /**
   * 語を「意味の分かる部分」へ完全に分解する。辞書の最長一致を
   * 先頭から繰り返し、全体を覆えて2部分以上、各部分に（推測でない）
   * gloss があるときだけ成功とする。
   */
  public segmentTerm(term: string): HypothesisGlossPart[] | undefined {
    const t = String(term || '').trim();
    if (t.length < 3 || t.length > 12) return undefined;
    if (!TERM_SHAPE.test(t)) return undefined;
    const parts: HypothesisGlossPart[] = [];
    let offset = 0;
    while (offset < t.length) {
      const hit = japaneseDictionaryService.findLongest(t, offset);
      if (!hit || !hit.surface) return undefined;
      const surface = hit.surface;
      if (offset + surface.length > t.length) return undefined;
      if (t.slice(offset, offset + surface.length) !== surface) return undefined;
      if (!TERM_SHAPE.test(surface)) return undefined;
      const entries = japaneseDictionaryService.lookup(surface);
      const glossed = entries.filter((e) => e.gloss);
      if (!glossed.length) return undefined;
      // 推測由来だけの部分は材料にしない（推測の上に推測を積まない）。
      if (glossed.every((e) => (e.semanticIds || []).includes(INFERRED_SEMANTIC_ID))) return undefined;
      parts.push({ surface, gloss: String(glossed[0].gloss) });
      offset += surface.length;
    }
    if (parts.length < 2) return undefined;
    if (parts.map((p) => p.surface).join('') !== t) return undefined;
    return parts;
  }

  /** 部分の gloss を繋いだ仮 gloss。捏造はせず、連結と「の」だけ。 */
  public composeGloss(parts: HypothesisGlossPart[]): string {
    const glosses = parts.map((p) => p.gloss);
    const last = parts[parts.length - 1];
    if (parts.length >= 2 && SUFFIX_PARTS.has(last.surface)) {
      return `${glosses.slice(0, -1).join('')}の${last.gloss}`;
    }
    return glosses.join('');
  }

  /**
   * 未知語に仮の意味を付ける。既に gloss がある語（推測含む）には
   * 何もしない。成功したら宣言用の保留枠も置く（返答側が読む）。
   */
  public tryInfer(term: string): HypothesisGloss | undefined {
    try {
      const t = String(term || '').trim();
      if (!t) return undefined;
      const existing = japaneseDictionaryService.lookup(t);
      if (existing.find((e) => e.gloss)) return undefined;
      const parts = this.segmentTerm(t);
      if (!parts) return undefined;
      const gloss = this.composeGloss(parts);
      if (!gloss) return undefined;
      japaneseDictionaryService.addPersonal(t, { gloss, semanticIds: [INFERRED_SEMANTIC_ID] });
      try { pendingSlotService.set('miki_hypothesis_gloss_v1', { term: t, gloss, at: Date.now() }, 10 * 60000); } catch { /* 補助経路 */ }
      systemLogger.info('CHAT', `💭 [仮説] 「${t}」の意味を部分からの推測で登録しました: ${gloss}（部分: ${parts.map((p) => p.surface).join('＋')}）`);
      return { term: t, gloss, parts };
    } catch { return undefined; }
  }
}

export const hypothesisGlossService = new HypothesisGlossService();
