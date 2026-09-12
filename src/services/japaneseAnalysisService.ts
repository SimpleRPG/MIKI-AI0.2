import { systemLogger } from './systemLogger';
import { japaneseDictionaryService, JapaneseDictionaryEntry } from './japaneseDictionaryService';
import { japaneseMorphologyService, NativeJapaneseMorpheme } from './japaneseMorphologyService';

/**
 * 設計思想 4.2/12.3 の日本語解析基盤。
 * 外部形態素ライブラリを必須にせず、WebView/Androidでも動く段階的実装。
 * Intl.Segmenter が使える環境では word segmentation を優先し、未対応環境では
 * 決定論的な機能語・接辞辞書＋文字N-gramへフォールバックする。
 *
 * 重要: これは「完全なSudachi互換」を名乗らない。将来SudachiをNative/Worker
 * adapterとして差し替えられる契約を先に固定するための基盤である。
 */
export type JapaneseTokenKind = 'WORD' | 'PARTICLE' | 'AUXILIARY' | 'PUNCTUATION' | 'UNKNOWN';

export interface JapaneseToken {
  surface: string;
  normalized: string;
  kind: JapaneseTokenKind;
  start: number;
  end: number;
  lemma?: string;
  reading?: string;
  pos?: string;
  semanticIds?: string[];
  dictionarySource?: string;
}

export interface JapaneseSemanticRole {
  role: 'SUBJECT' | 'OBJECT' | 'SOURCE' | 'DESTINATION' | 'LOCATION' | 'METHOD' | 'TOPIC' | 'COMPARISON' | 'OTHER';
  token: string;
  particle?: string;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface JapaneseAnalysisResult {
  text: string;
  tokens: JapaneseToken[];
  contentTokens: string[];
  particles: string[];
  normalizedText: string;
  bigrams: string[];
  hasQuestion: boolean;
  hasCorrection: boolean;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  analyzer: 'SUDACHI' | 'INTL_SEGMENTER' | 'DETERMINISTIC_FALLBACK';
  dictionaryHits: number;
  dictionarySources: string[];
  semanticRoles: JapaneseSemanticRole[];
}

const PARTICLES = new Set([
  'は','が','を','に','へ','と','で','から','まで','より','も','の','や','ね','よ','ぞ','さ','な','って','ので','のに','けど','けれど','なら','しか','だけ','ほど','くらい','ばかり','でも','とか','こそ','さえ','すら'
]);
const AUXILIARIES = new Set(['です','ます','でした','ません','ない','なかった','たい','たがる','られる','れる','よう','そう','だ','だった','である']);
const PUNCT = new Set(Array.from('、。！？!?「」『』（）()［］[]【】〈〉<>・,.:：;；/\\〜~…'));
const CORRECTION = /違う|そうじゃない|ではなく|じゃなく|間違|訂正|修正|前提が変|勘違い/;

function enrichToken(token: JapaneseToken): JapaneseToken {
  const hit: JapaneseDictionaryEntry | undefined = japaneseDictionaryService.lookup(token.surface)[0];
  if (!hit) return token;
  return { ...token, lemma: hit.lemma, reading: hit.reading, pos: hit.pos, semanticIds: hit.semanticIds, dictionarySource: hit.source };
}

function normalize(text: string): string {
  return text.normalize('NFKC').replace(/\s+/g, ' ').trim();
}

function classify(surface: string): JapaneseTokenKind {
  if (PUNCT.has(surface)) return 'PUNCTUATION';
  if (PARTICLES.has(surface)) return 'PARTICLE';
  if (AUXILIARIES.has(surface)) return 'AUXILIARY';
  return 'WORD';
}

function fallbackTokens(text: string): JapaneseToken[] {
  const result: JapaneseToken[] = [];
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (/\s/.test(ch)) { i++; continue; }
    if (PUNCT.has(ch)) { result.push({ surface: ch, normalized: ch, kind: 'PUNCTUATION', start: i, end: i + 1 }); i++; continue; }
    let matched = '';
    for (const candidate of [...PARTICLES, ...AUXILIARIES].sort((a,b) => b.length - a.length)) {
      if (text.startsWith(candidate, i)) { matched = candidate; break; }
    }
    if (matched) {
      result.push({ surface: matched, normalized: matched.normalize('NFKC'), kind: classify(matched), start: i, end: i + matched.length });
      i += matched.length;
      continue;
    }
    // Latin/digit runs stay together; Japanese content is grouped until a function word/punctuation.
    if (/[A-Za-z0-9_+#.-]/.test(ch)) {
      let j = i + 1;
      while (j < text.length && /[A-Za-z0-9_+#.-]/.test(text[j])) j++;
      const s = text.slice(i, j);
      result.push({ surface: s, normalized: s.toLowerCase(), kind: 'WORD', start: i, end: j });
      i = j;
      continue;
    }
    let j = i + 1;
    while (j < text.length && !PUNCT.has(text[j]) && !/\s/.test(text[j]) &&
      ![...PARTICLES, ...AUXILIARIES].some(w => text.startsWith(w, j))) j++;
    const s = text.slice(i, j);
    result.push({ surface: s, normalized: s.normalize('NFKC'), kind: 'WORD', start: i, end: j });
    i = j;
  }
  return result;
}

function extractSemanticRoles(tokens: JapaneseToken[]): JapaneseSemanticRole[] {
  const roles: JapaneseSemanticRole[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    const next = tokens[i + 1];
    if (!next || next.kind !== 'PARTICLE') continue;
    const particle = next.surface;
    const role = particle === 'は' ? 'TOPIC' : particle === 'が' ? 'SUBJECT' : particle === 'を' ? 'OBJECT' :
      particle === 'に' ? 'DESTINATION' : particle === 'へ' ? 'DESTINATION' : particle === 'で' ? 'LOCATION' :
      particle === 'から' ? 'SOURCE' : particle === 'と' ? 'COMPARISON' : particle === 'より' ? 'COMPARISON' :
      particle === 'によって' ? 'METHOD' : 'OTHER';
    roles.push({ role, token: t.surface, particle, confidence: role === 'OTHER' ? 'LOW' : 'MEDIUM' });
  }
  return roles;
}

class JapaneseAnalysisService {
  private static instance: JapaneseAnalysisService;
  private correctionHistory: Array<{ input: string; target: string; at: number }> = [];
  private constructor() {
    try {
      const raw = localStorage.getItem('miki_japanese_correction_history_v1');
      if (raw) this.correctionHistory = JSON.parse(raw);
    } catch { /* storage unavailable: keep in-memory fallback */ }
  }
  public static getInstance(): JapaneseAnalysisService {
    if (!this.instance) this.instance = new JapaneseAnalysisService();
    return this.instance;
  }

  public analyze(text: string): JapaneseAnalysisResult {
    const normalizedText = normalize(text || '');
    if (!normalizedText) return { text: '', tokens: [], contentTokens: [], particles: [], normalizedText: '', bigrams: [], hasQuestion: false, hasCorrection: false, confidence: 'LOW', analyzer: 'DETERMINISTIC_FALLBACK', dictionaryHits: 0, dictionarySources: [], semanticRoles: [] };

    let tokens: JapaneseToken[] = [];
    let analyzer: JapaneseAnalysisResult['analyzer'] = 'DETERMINISTIC_FALLBACK';
    try {
      const Segmenter = (Intl as any)?.Segmenter;
      if (Segmenter) {
        const segmenter = new Segmenter('ja', { granularity: 'word' });
        tokens = Array.from(segmenter.segment(normalizedText)).map((part: any) => ({
          surface: part.segment,
          normalized: part.segment.normalize('NFKC').toLowerCase(),
          kind: classify(part.segment),
          start: Number(part.index),
          end: Number(part.index) + part.segment.length,
        })).map(enrichToken);
        analyzer = 'INTL_SEGMENTER';
      }
    } catch { /* fallback below */ }
    if (!tokens.length) tokens = fallbackTokens(normalizedText).map(enrichToken);
    else tokens = tokens.map(enrichToken);

    const contentTokens = tokens.filter(t => t.kind === 'WORD' && t.normalized.length > 0)
      .map(t => t.normalized)
      .filter((v, i, a) => a.indexOf(v) === i);
    const particles = tokens.filter(t => t.kind === 'PARTICLE' || t.kind === 'AUXILIARY').map(t => t.normalized);
    const compact = normalizedText.replace(/\s+/g, '');
    const bigrams = Array.from({ length: Math.max(0, compact.length - 1) }, (_, i) => compact.slice(i, i + 2));
    const hasQuestion = /[？?]/.test(normalizedText) || /どう|なぜ|何|いつ|どこ|誰|どれ|いくら|できる/.test(normalizedText);
    const hasCorrection = CORRECTION.test(normalizedText);
    const dictionaryHits = tokens.filter(t => !!t.dictionarySource).length;
    const dictionarySources = [...new Set(tokens.map(t => t.dictionarySource).filter(Boolean) as string[])];
    const confidence = analyzer === 'INTL_SEGMENTER' && dictionaryHits > 0 ? 'HIGH' : (contentTokens.length ? 'MEDIUM' : 'LOW');
    const semanticRoles = extractSemanticRoles(tokens);
    return { text, tokens, contentTokens, particles, normalizedText, bigrams, hasQuestion, hasCorrection, confidence, analyzer, dictionaryHits, dictionarySources, semanticRoles };
  }

  /**
   * Android実機ではSudachi Native Adapterを優先する非同期経路。
   * Nativeが無い場合は既存の同期解析器へ戻る。
   */
  public async analyzeNativeFirst(text: string, mode: 'A' | 'B' | 'C' = 'C'): Promise<JapaneseAnalysisResult> {
    const normalizedText = normalize(text || '');
    if (!normalizedText) return this.analyze('');
    const native = await japaneseMorphologyService.tokenize(normalizedText, mode);
    if (!native?.length) return this.analyze(text);
    const tokens: JapaneseToken[] = native.map((m: NativeJapaneseMorpheme) => {
      const hit = japaneseDictionaryService.lookup(m.surface)[0];
      const pos = m.partOfSpeech?.[0] || hit?.pos || 'UNKNOWN';
      const kind: JapaneseTokenKind = pos === '助詞' ? 'PARTICLE' : (pos === '助動詞' ? 'AUXILIARY' : (PUNCT.has(m.surface) ? 'PUNCTUATION' : 'WORD'));
      return {
        surface: m.surface, normalized: m.normalizedForm || m.surface.normalize('NFKC').toLowerCase(), kind,
        start: m.begin, end: m.end, lemma: m.dictionaryForm || hit?.lemma, reading: m.readingForm || hit?.reading,
        pos, semanticIds: hit?.semanticIds, dictionarySource: hit?.source || 'SUDACHI'
      };
    });
    const contentTokens = tokens.filter(t => t.kind === 'WORD' && t.normalized).map(t => t.normalized).filter((v,i,a)=>a.indexOf(v)===i);
    const particles = tokens.filter(t => t.kind === 'PARTICLE' || t.kind === 'AUXILIARY').map(t => t.normalized);
    const compact = normalizedText.replace(/\s+/g, '');
    return {
      text, tokens, contentTokens, particles, normalizedText,
      bigrams: Array.from({ length: Math.max(0, compact.length - 1) }, (_, i) => compact.slice(i, i + 2)),
      hasQuestion: /[？?]/.test(normalizedText) || /どう|なぜ|何|いつ|どこ|誰|どれ|いくら|できる/.test(normalizedText),
      hasCorrection: CORRECTION.test(normalizedText), confidence: 'HIGH', analyzer: 'SUDACHI',
      dictionaryHits: tokens.filter(t => !!t.dictionarySource).length, dictionarySources: [...new Set(tokens.map(t => t.dictionarySource).filter(Boolean) as string[])], semanticRoles: extractSemanticRoles(tokens)
    } as JapaneseAnalysisResult;
  }

  /** 訂正が成立したときだけ語の正規化対応を学習候補として記録する。 */
  public recordCorrection(input: string, target: string): void {
    if (!input.trim() || !target.trim()) return;
    this.correctionHistory.push({ input: normalize(input), target: normalize(target), at: Date.now() });
    if (this.correctionHistory.length > 100) this.correctionHistory.shift();
    try { localStorage.setItem('miki_japanese_correction_history_v1', JSON.stringify(this.correctionHistory)); } catch { /* fallback */ }
    systemLogger.info('CHAT', `🈯 [JapaneseAnalysis] correction candidate recorded: ${target.slice(0, 60)}`);
  }

  /**
   * ユーザーが明示的に採用した訂正だけを個人辞書へ昇格する。
   * 自動訂正候補はこのメソッドを通らない限り辞書を書き換えない。
   */
  public promoteCorrectionToPersonalDictionary(input: string, target: string, confirmedByUser: boolean): boolean {
    if (!confirmedByUser || !input.trim() || !target.trim()) return false;
    const source = normalize(input);
    const lemma = normalize(target);
    if (!source || !lemma) return false;
    japaneseDictionaryService.addPersonal({
      surface: source, normalized: source.normalize('NFKC').toLowerCase(), lemma,
      reading: undefined, pos: 'PERSONAL_CORRECTION', source: 'PERSONAL', priority: 100,
      semanticIds: ['personal:correction']
    });
    return true;
  }

  public getCorrectionHistory(): Array<{ input: string; target: string; at: number }> { return [...this.correctionHistory]; }
}

export const japaneseAnalysisService = JapaneseAnalysisService.getInstance();
