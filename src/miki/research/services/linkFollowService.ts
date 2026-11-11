/**
 * P803: リンク巡回の選択規則（調査の「運転」の一部）。
 *
 * 読んだページのリンク一覧から、調査対象に結びつくものだけを
 * 次に読むページとして選ぶ。判断は規則ベース：
 * - アンカーテキストに対象語が含まれる（または対象語がアンカーを含む）
 * - 既読・除外済みの URL は辿らない
 * - ログイン・編集・履歴などの操作系 URL、PDF・画像などの
 *   非テキスト資源は辿らない
 * - スコアは「一致した対象語の長さ」優先、同点は出現順
 *
 * 巡回は浅く保つ（1調査あたりの上限は呼び出し側が管理する）。
 * 型に合わないページ構造では何も選ばれず、従来の検索パスに委ねられる。
 */

export interface FollowLinkCandidate {
  url: string;
  title: string;
  viaUrl: string;
}

const NON_CONTENT_URL = /(?:[/?&#](?:action|mode)=(?:edit|history|login)|login|signin|sign-in|signup|sign-up|register|account|edit[/?&#]|history[/?&#]|[?&]oldid=|Special:|%E7%89%B9%E5%88%A5:)/i;
const NON_TEXT_EXT = /\.(?:pdf|jpe?g|png|gif|svg|webp|zip|tar|gz|mp3|mp4|mov|avi|dmg|exe)(?:[?#]|$)/i;

function normalizeForMatch(s: string): string {
  return String(s || '').replace(/[\s　]/g, '').toLowerCase();
}

export const linkFollowService = {
  /**
   * 読んだページ群から、次に読むべきリンクを選ぶ。
   * @param pages リンク一覧を持つページ（url はそのページ自身）
   * @param terms 調査対象の語（対象名・未知語など、2文字以上を使う）
   * @param excludeUrls 既読・除外済み URL
   * @param limit 最大件数
   */
  selectFollowLinks(
    pages: Array<{ url: string; links?: Array<{ href: string; text: string }> }>,
    terms: string[],
    excludeUrls: Set<string>,
    limit: number,
  ): FollowLinkCandidate[] {
    const cleanTerms = [...new Set((terms || []).map((t) => normalizeForMatch(t)).filter((t) => t.length >= 2))];
    if (cleanTerms.length === 0 || limit <= 0) return [];
    const scored: Array<FollowLinkCandidate & { score: number; order: number }> = [];
    const seen = new Set<string>();
    let order = 0;
    for (const page of pages) {
      for (const link of page.links || []) {
        order++;
        const href = String(link?.href || '');
        if (!/^https?:\/\//i.test(href)) continue;
        if (href === page.url) continue;
        if (excludeUrls.has(href) || seen.has(href)) continue;
        if (NON_CONTENT_URL.test(href) || NON_TEXT_EXT.test(href)) continue;
        const anchor = normalizeForMatch(link?.text || '');
        if (anchor.length < 2) continue;
        let score = 0;
        for (const term of cleanTerms) {
          if (anchor.includes(term)) score = Math.max(score, term.length);
          else if (anchor.length >= 3 && term.includes(anchor)) score = Math.max(score, anchor.length);
        }
        if (score <= 0) continue;
        seen.add(href);
        scored.push({ url: href, title: String(link.text || '').trim().slice(0, 80), viaUrl: page.url, score, order });
      }
    }
    scored.sort((a, b) => b.score - a.score || a.order - b.order);
    return scored.slice(0, limit).map(({ url, title, viaUrl }) => ({ url, title, viaUrl }));
  },
};
