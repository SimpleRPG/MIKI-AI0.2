/*
 * P490: 出典の信頼度ルール。
 *
 * 「このドメインは一次情報に近い」「ここはまとめ（転載）側」という
 * 調べ方の知識を、ドメイン単位の決定的なルールとして持つ。真偽の
 * 判定ではなく、検索結果の並びと読み優先度のための「使い勝手」の
 * 知識。ボーナスは小さく抑え、関連度そのものを覆すことはない。
 */

export type SourceTrustTier = 'OFFICIAL' | 'STANDARD' | 'AGGREGATOR';

const OFFICIAL_SUFFIXES = ['.go.jp', '.lg.jp', '.gov', '.ac.jp'];
const OFFICIAL_HOSTS = new Set([
  'ja.wikipedia.org', 'en.wikipedia.org', 'www.wikipedia.org',
  'www.wikidata.org', 'openalex.org', 'api.openalex.org',
  'developer.android.com', 'developer.mozilla.org', 'docs.python.org',
  'www.w3.org', 'learn.microsoft.com', 'support.google.com',
]);
// まとめ・転載系の目印（ホスト名に含まれる場合）。
const AGGREGATOR_HOST_MARKERS = ['matome', 'まとめ'];

export function sourceTrustTierForUrl(urlRaw: string): SourceTrustTier {
  let host = '';
  try {
    host = new URL(String(urlRaw || '')).hostname.toLowerCase();
  } catch {
    return 'STANDARD';
  }
  if (!host) return 'STANDARD';
  if (AGGREGATOR_HOST_MARKERS.some((marker) => host.includes(marker))) return 'AGGREGATOR';
  if (OFFICIAL_HOSTS.has(host)) return 'OFFICIAL';
  if (OFFICIAL_SUFFIXES.some((suffix) => host.endsWith(suffix))) return 'OFFICIAL';
  return 'STANDARD';
}

/** 並び替え専用の小さなボーナス。関連度を覆す大きさにはしない。 */
export function sourceTrustBonus(urlRaw: string): number {
  const tier = sourceTrustTierForUrl(urlRaw);
  return tier === 'OFFICIAL' ? 0.04 : tier === 'AGGREGATOR' ? -0.04 : 0;
}

export const sourceTrustService = {
  tierForUrl: sourceTrustTierForUrl,
  bonusForUrl: sourceTrustBonus,
};
