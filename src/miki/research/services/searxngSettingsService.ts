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
  const timeoutMs = Math.min(30000, Math.max(500, readNumber(TIMEOUT_KEYS) ?? 2500));
  return { baseUrl, path, timeoutMs };
}

export function buildSearxngSearchUrl(settings: SearxngSearchSettings, query: string): string {
  const base = normalizeBaseUrl(settings.baseUrl);
  const path = normalizePath(settings.path);
  const url = new URL(`${base}${path}`);
  url.searchParams.set('q', query);
  url.searchParams.set('format', 'json');
  return url.toString();
}
