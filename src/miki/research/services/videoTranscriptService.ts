// P875: 動画から学ぶ受け口（字幕経由）。
// 動画URLを受け取り、字幕テキストを取得して「読んだもの」として
// 保存する。映像そのものの理解ではなく、動画の語り（字幕）を
// テキストとして読む形。字幕の無い動画は正直に失敗を返す。
// 学んだ内容は保存テキストへの検索で会話から引ける。
// 取得は通常の fetch。端末側で弾かれる場合はネイティブ経由が要る
// （実機確認事項）。
import { storageService } from '../../../services/storageService';

const STORE_KEY = 'miki_video_learnings_v1';
const MAX_VIDEOS = 10;
const MAX_TEXT = 20000;

export interface VideoLearning {
  videoId: string;
  title: string;
  url: string;
  at: number;
  text: string;
}

type FetchFn = (url: string) => Promise<string>;
let fetchOverride: FetchFn | null = null;

async function fetchText(url: string): Promise<string> {
  if (fetchOverride) return fetchOverride(url);
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/<[^>]+>/g, '');
}

function readStore(): VideoLearning[] {
  try {
    const raw = storageService.getItem(STORE_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function writeStore(list: VideoLearning[]): void {
  try {
    storageService.setItem(STORE_KEY, JSON.stringify(list.slice(-MAX_VIDEOS)));
  } catch { /* 保存は補助 */ }
}

interface CaptionTrack { baseUrl: string; lang: string; asr: boolean }

// watch ページの埋め込みJSONから字幕トラックを取り出す。
function parseCaptionTracks(html: string): CaptionTrack[] {
  const tracks: CaptionTrack[] = [];
  const parts = html.split('"baseUrl":"');
  for (let i = 1; i < parts.length; i++) {
    const seg = parts[i];
    const end = seg.indexOf('"');
    if (end < 0) continue;
    const url = seg.slice(0, end).replace(/\\u0026/g, '&').replace(/\\\//g, '/');
    if (!url.includes('timedtext')) continue;
    const near = seg.slice(end, end + 400);
    const lang = near.match(/"languageCode":"([^"]+)"/)?.[1] ?? '';
    const asr = /"kind":"asr"/.test(near);
    tracks.push({ baseUrl: url, lang, asr });
  }
  return tracks;
}

function chooseTrack(tracks: CaptionTrack[]): CaptionTrack | undefined {
  const rank = (t: CaptionTrack): number => {
    const ja = t.lang.startsWith('ja');
    const en = t.lang.startsWith('en');
    if (ja && !t.asr) return 0;
    if (ja) return 1;
    if (en && !t.asr) return 2;
    if (en) return 3;
    return 4;
  };
  return [...tracks].sort((a, b) => rank(a) - rank(b))[0];
}

// timedtext の本文（JSON3 または XML）を平文にする。
function parseTimedText(body: string): string {
  const trimmed = body.trim();
  if (trimmed.startsWith('{')) {
    try {
      const data = JSON.parse(trimmed);
      const lines: string[] = [];
      for (const ev of data.events ?? []) {
        const line = (ev.segs ?? []).map((s: any) => String(s?.utf8 ?? '')).join('');
        if (line.trim()) lines.push(line.trim());
      }
      return lines.join(' ');
    } catch { /* XMLとして続行 */ }
  }
  const lines: string[] = [];
  const re = /<text[^>]*>([\s\S]*?)<\/text>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) {
    const line = decodeEntities(m[1]).replace(/\s+/g, ' ').trim();
    if (line) lines.push(line);
  }
  return lines.join(' ');
}

export const videoTranscriptService = {
  extractVideoId(url: string): string | undefined {
    const m = url.match(/(?:watch\?v=|youtu\.be\/|shorts\/|live\/)([\w-]{6,})/);
    return m?.[1];
  },

  // テスト用に取得関数差し替える。
  setFetchForTest(fn: FetchFn | null): void {
    fetchOverride = fn;
  },

  listLearned(): VideoLearning[] {
    return readStore();
  },

  async learnFromUrl(url: string): Promise<{ ok: boolean; title?: string; reason?: string }> {
    const videoId = this.extractVideoId(url);
    if (!videoId) return { ok: false, reason: 'URLから動画を特定できませんでした' };
    let html: string;
    try {
      html = await fetchText(`https://www.youtube.com/watch?v=${videoId}`);
    } catch {
      return { ok: false, reason: '動画ページを取得できませんでした' };
    }
    const title = (html.match(/<title>([^<]+)<\/title>/)?.[1] ?? '')
      .replace(/\s*-\s*YouTube\s*$/, '').trim() || '（タイトル不明）';
    const track = chooseTrack(parseCaptionTracks(html));
    if (!track) return { ok: false, reason: '字幕が見つかりませんでした' };
    let body: string;
    try {
      body = await fetchText(`${track.baseUrl}&fmt=json3`);
    } catch {
      return { ok: false, reason: '字幕を取得できませんでした' };
    }
    let text = parseTimedText(body);
    if (!text) {
      try {
        body = await fetchText(track.baseUrl);
        text = parseTimedText(body);
      } catch { /* 下で判定 */ }
    }
    if (!text) return { ok: false, reason: '字幕の中身を読めませんでした' };
    const list = readStore().filter((v) => v.videoId !== videoId);
    list.push({ videoId, title: decodeEntities(title), url, at: Date.now(), text: text.slice(0, MAX_TEXT) });
    writeStore(list);
    return { ok: true, title: decodeEntities(title) };
  },

  // 学んだ動画の本文から、キーワード周辺の抜粋を返す。
  searchInLearned(keyword: string): { title: string; excerpt: string } | undefined {
    if (!keyword) return undefined;
    const list = readStore();
    for (let i = list.length - 1; i >= 0; i--) {
      const idx = list[i].text.indexOf(keyword);
      if (idx >= 0) {
        const from = Math.max(0, idx - 60);
        const excerpt = list[i].text.slice(from, idx + keyword.length + 90);
        return { title: list[i].title, excerpt: `${from > 0 ? '…' : ''}${excerpt}…` };
      }
    }
    return undefined;
  },

  latest(): VideoLearning | undefined {
    const list = readStore();
    return list[list.length - 1];
  },
};
