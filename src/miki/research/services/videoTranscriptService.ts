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
// P890: 字幕が無い動画のための音声認識サービス（端末ローカル）。
// きりあの Termux で whisper.cpp サービスが起動している間だけ届く。
// 届かなければ今まで通り「字幕なし」で正直に失敗する（既定値＝localhost）。
const ASR_URL_KEY = 'miki_asr_service_url_v1';
const ASR_DEFAULT_URL = 'http://127.0.0.1:8899/transcribe';
const ASR_TIMEOUT_MS = 240000;

export interface VideoLearning {
  videoId: string;
  title: string;
  url: string;
  at: number;
  text: string;
  // P888: 字幕で繰り返し出てきた内容語（話題の見出し）。
  topics?: string[];
  // P889: 抽出型要約（要点文を最大3つ、元の順序で）。
  summary?: string[];
  // P890: 学びの経路。字幕か、音声認識（端末ローカルのASRサービス）か。
  via?: 'captions' | 'asr';
}

const TOPIC_STOP = new Set(['動画', '今回', '自分', '相手', '人間', '時間', '全部', '本当', '以上', '以下', '感じ', '部分', '状態', '場合', '結果', '方法', '必要', '可能', '最初', '最後', '最近', '現在', '今日', '明日', '昨日', 'もの', 'こと', 'ため', 'よう', 'チャンネル', 'コメント', 'お願い', '登録', '高評価']);

// P888: 字幕本文から話題の見出しを決定的に抜く。カタカナ・漢字・
// 英字の内容語を数え、3回以上出たものを頻度順に最大6件。
// 学んだ動画を「キーワード一致でしか引けない保管庫」にせず、
// 会話で概要を返し、知らない語は意味学習へ繋ぐための材料にする。
function extractTopics(text: string): string[] {
  const counts = new Map<string, number>();
  const re = /[ァ-ヶー]{2,}|[一-龯]{2,}|[A-Za-z][A-Za-z0-9]{2,}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const w = m[0];
    if (TOPIC_STOP.has(w)) continue;
    counts.set(w, (counts.get(w) ?? 0) + 1);
  }
  return [...counts.entries()]
    .filter(([, c]) => c >= 3)
    .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)
    .slice(0, 6)
    .map(([w]) => w);
}

// P889: 抽出型要約。文を「話題の見出しへの触れ方＋内容語の濃さ」で
// 採点し、上位3文を元の順序で返す。生成ではなく抽出なので、
// 字幕に無いことは言わない。
function summarizeText(text: string, topics: string[]): string[] {
  const sentences = text
    .split(/(?<=[。！？])/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 10 && s.length <= 140);
  if (sentences.length === 0) return [];
  const scored = sentences.map((s, i) => {
    const topicHits = topics.reduce((acc, t) => acc + (s.split(t).length - 1), 0);
    const words = new Set(s.match(/[ァ-ヶー]{2,}|[一-龯]{2,}|[A-Za-z][A-Za-z0-9]{2,}/g) ?? []);
    return { s, i, score: topicHits * 3 + Math.min(words.size, 8) };
  });
  return scored
    .sort((a, b) => b.score - a.score || a.i - b.i)
    .slice(0, 3)
    .sort((a, b) => a.i - b.i)
    .map((x) => x.s);
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

// P890: 字幕が無いときに、端末ローカルの音声認識サービスへ回す。
// サービスが起動していなければ接続自体が失敗して null（＝従来動作）。
let asrFetchOverride: ((url: string, body: string) => Promise<string>) | null = null;

async function postAsr(endpoint: string, body: string): Promise<string> {
  if (asrFetchOverride) return asrFetchOverride(endpoint, body);
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  });
  if (!res.ok) throw new Error(`asr http ${res.status}`);
  return res.text();
}

async function tryAsr(url: string): Promise<{ text: string; title?: string } | null> {
  try {
    const endpoint = storageService.getItem(ASR_URL_KEY)?.trim() || ASR_DEFAULT_URL;
    const timeout = new Promise<never>((_, reject) => {
      const t = setTimeout(() => reject(new Error('asr timeout')), ASR_TIMEOUT_MS);
      (t as any)?.unref?.();
    });
    const raw = await Promise.race([postAsr(endpoint, JSON.stringify({ url })), timeout]);
    const parsed = JSON.parse(raw) as { text?: string; title?: string };
    const text = String(parsed.text ?? '').replace(/\s+/g, ' ').trim();
    if (text.length < 10) return null;
    return { text, title: parsed.title ? String(parsed.title) : undefined };
  } catch {
    return null;
  }
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

  // P890: テスト用にASR送信関数を差し替え。
  setAsrFetchForTest(fn: ((url: string, body: string) => Promise<string>) | null): void {
    asrFetchOverride = fn;
  },

  listLearned(): VideoLearning[] {
    return readStore();
  },

  async learnFromUrl(url: string): Promise<{ ok: boolean; title?: string; reason?: string; topics?: string[]; via?: 'captions' | 'asr' }> {
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
    // 保存処理は字幕・音声認識で共通（見出し抽出・要約まで同じ土俵）。
    const storeAndReturn = (rawText: string, finalTitle: string, via: 'captions' | 'asr') => {
      const storedText = rawText.slice(0, MAX_TEXT);
      const topics = extractTopics(storedText);
      const summary = summarizeText(storedText, topics);
      const list = readStore().filter((v) => v.videoId !== videoId);
      list.push({ videoId, title: decodeEntities(finalTitle), url, at: Date.now(), text: storedText, topics, summary, via });
      writeStore(list);
      return { ok: true, title: decodeEntities(finalTitle), topics, via } as const;
    };
    const track = chooseTrack(parseCaptionTracks(html));
    if (!track) {
      // P890: 字幕が無い → 端末ローカルの音声認識へ（起動していれば）。
      const asr = await tryAsr(url);
      if (asr) return storeAndReturn(asr.text, asr.title || title, 'asr');
      return { ok: false, reason: '字幕が見つかりませんでした' };
    }
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
    if (!text) {
      // P890: 字幕トラックはあるが中身が読めない場合も音声認識を試す。
      const asr = await tryAsr(url);
      if (asr) return storeAndReturn(asr.text, asr.title || title, 'asr');
      return { ok: false, reason: '字幕の中身を読めませんでした' };
    }
    return storeAndReturn(text, title, 'captions');
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
