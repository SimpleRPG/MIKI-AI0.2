/**
 * P636: 日付キー（YYYY-MM-DD、ローカル日付）の生成を一元化する。
 *
 * 以前は開いた話題・エピソード・時間感覚・P212 の振り返りが
 * それぞれに日付キーを作っており、ゼロ詰めの有無まで揃って
 * いなかった（timeSense は無詰め、他は詰め）。日をまたぐ仕組み
 * （拾い直し、エピソード、週次、1日1回の台帳）はすべてこの
 * キーで突き合わせるため、生成は共有の基礎に置く。
 */

export function dayKeyOf(at: number): string {
  const d = new Date(at);
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
}

export function todayKey(): string {
  return dayKeyOf(Date.now());
}

/** n 日前の日付キー（ローカル日付の算術で求める）。 */
export function daysAgoKey(n: number): string {
  const now = new Date();
  return dayKeyOf(new Date(now.getFullYear(), now.getMonth(), now.getDate() - n).getTime());
}

export function yesterdayKey(): string {
  return daysAgoKey(1);
}

export const dayKeyService = {
  of: dayKeyOf,
  today: todayKey,
  yesterday: yesterdayKey,
  daysAgo: daysAgoKey,
};
