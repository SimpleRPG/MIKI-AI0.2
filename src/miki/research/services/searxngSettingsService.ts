import { storageService } from '../../../services/storageService';

export interface SearxngSearchSettings {
  baseUrl: string;
  path: string;
  timeoutMs: number;
}

const BASE_URL_KEYS = ['miki_searxng_base_url'];
const PATH_KEYS = ['miki_searxng_search_path', 'miki_searxng_path'];
const TIMEOUT_KEYS = ['miki_searxng_timeout_ms', 'miki_searxng_timeout'];

function readString(keys: string[]): string | undefined {
  for (const key of keys) {
    const value = storageService.getItem(key);
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return undefined;
}

function readNumber(keys: string[]): number | undefined {
  for (const key of keys) {
    const value = storageService.getItem(key);
    const numeric = typeof value === 'number' ? value : Number(value);
    if (Number.isFinite(numeric) && numeric > 0) return Math.trunc(numeric);
  }
  return undefined;
}

function normalizeBaseUrl(value: string): string {
  return value.trim().replace(/\/+$/, '') || 'http://127.0.0.1:8888';
}

function normalizePath(value: string): string {
  const path = value.trim();
  if (!path) return '/search';
  return path.startsWith('/') ? path : `/${path}`;
}

export function getSearxngSearchSettings(): SearxngSearchSettings {
  const baseUrl = normalizeBaseUrl(readString(BASE_URL_KEYS) || 'http://127.0.0.1:8888');
  const path = normalizePath(readString(PATH_KEYS) || '/search');
  const timeoutMs = Math.min(30000, Math.max(500, readNumber(TIMEOUT_KEYS) ?? 8000));
  return { baseUrl, path, timeoutMs };
}

/*
 * P1142: 検索文の言語を SearXNG に伝える。日本語（かな・漢字）を
 * 含む検索文では language=ja を付け、結果の並びが日本語寄りに
 * なるようにする。これまでは q と format しか送っておらず、
 * 日本語の問いでも言語指定なしで検索していた。
 */
export function detectSearxngLanguage1142(query: string): string | undefined {
  return /[぀-ゟ゠-ヿ一-鿿]/.test(String(query || '')) ? 'ja' : undefined;
}

export function buildSearxngSearchUrl(settings: SearxngSearchSettings, query: string): string {
  const base = normalizeBaseUrl(settings.baseUrl);
  const path = normalizePath(settings.path);
  const url = new URL(`${base}${path}`);
  url.searchParams.set('q', query);
  url.searchParams.set('format', 'json');
  const language = detectSearxngLanguage1142(query);
  if (language) url.searchParams.set('language', language);
  return url.toString();
}
