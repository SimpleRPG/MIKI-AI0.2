// P893: 部品保管庫の読み取りキャッシュ。
// 保管庫は「1キーに全件の JSON 配列」という台帳形で、想起のたびに
// 丸ごと JSON.parse + 走査していた。台帳が育つほど想起が重くなる
// ため、文字列の指紋（長さ＋頭尾）が変わらない間はパース済みを
// 使い回す。書き込み側が台帳を差し替えれば指紋が変わり、自動で
// 読み直す。索引化への第一段（読みの無駄を消す）。
import { storageService } from '../../../services/storageService';

const REPO_KEY = 'miki_reusable_component_repository_v1';

let cache: { fingerprint: string; items: any[] } | null = null;

export const componentRepositoryCacheService = {
  readAll(): any[] {
    try {
      const raw = storageService.getItem(REPO_KEY);
      if (!raw) {
        cache = null;
        return [];
      }
      const fingerprint = `${raw.length}:${raw.slice(0, 64)}:${raw.slice(-64)}`;
      if (cache && cache.fingerprint === fingerprint) return cache.items;
      const parsed = JSON.parse(raw);
      const items = Array.isArray(parsed) ? parsed : [];
      cache = { fingerprint, items };
      return items;
    } catch {
      return [];
    }
  },
};
