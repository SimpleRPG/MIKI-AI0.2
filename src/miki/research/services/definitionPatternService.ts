import { storageService} from '../../../services/storageService';
import { systemLogger} from '../../../services/systemLogger';

/**
* P494: 定義形レジストリ。
*
* 「意味を学ぶ」とは、読んだページの中にある定義の明示（「Xとは〜」
* 「Xは、〜である。」）を拾って自分の辞書にすること。その定義形は
* 固定の決め打ちにせず、レジストリとして持つ: 種（内蔵）＋教師教材
* から供給された形＋手動追加分（永続化）。形が増えれば、学べる
* ページの書き方が増える。
*
* 形は正規表現で、名前付きグループ (?<term>...) と (?<gloss>...) を
* 必須とし、任意で (?<reading>...) を取れる。検証は「コンパイル
* できること＋必須グループがあること＋煙テストで例外が出ないこと」。
*/

export interface DefinitionPattern {
id: string;
name: string;
source: 'seed' | 'teacher' | 'manual';
regex: string;
enabled: boolean;
addedAt: number;
}

export interface ExtractedDefinition {
term: string;
gloss: string;
reading?: string;
enLabel?: string;
hypernym?: string;
sentence: string;
patternId: string;
}

const PATTERNS_KEY = 'miki_definition_patterns_v1';
const MAX_PATTERNS = 60;

// 主語になり得ない語（指示語・形式名詞で始まる/終わるもの）。
const BAD_TERM_PREFIX = /^(この|その|あの|これ|それ|あれ|当|同)/;
const BAD_TERM_SUFFIX = /(こと|もの|ため|よう|はず)$/;

const SEED_PATTERNS: Array<Omit<DefinitionPattern, 'addedAt'>> = [
{
id: 'seed-jp-towa',
name: '「Xとは、〜」型',
source: 'seed',
enabled: true,
regex:
'(?<term>[^\\s、。・「」『』()（）はがをにへとやも]{2,30}?)(?:[（(](?<reading>[^）)]{1,30})[）)])?とは[、,]?\\s*(?<gloss>[^。！？\\n]{4,200})',
},
{
id: 'seed-jp-ha-dearu',
name: '「Xは、〜である。」型（文頭）',
source: 'seed',
enabled: true,
regex:
'^\\s*(?<term>[^\\s、。・「」『』()（）はがをにへとやも]{2,30}?)(?:[（(](?<reading>[^）)]{1,30})[）)])?は[、,]?\\s*(?<gloss>[^。！？\\n]{4,160}?)(?:である|です|を指す|とされる|を意味する)',
},
{
id: 'seed-en-is',
name: '"X is a/an/the 〜" 型',
source: 'seed',
enabled: true,
regex:
'(?<term>[A-Z][A-Za-z0-9&.\' -]{1,40}?)\\s+is\\s+(?:a|an|the)\\s+(?<gloss>[^.;\\n]{4,160})',
},
];

const SMOKE_SENTENCES = [
'銀行とは、預金の受け入れと貸し出しを行う金融機関である。',
'彼は昨日、駅前の店で傘を買った。',
'TypeScript is a programming language developed by Microsoft.',
'今日の天気は晴れで、気温は25度まで上がる見込みだ。',
];

function normalizeKey(value: string): string {
return value.normalize('NFKC').trim().toLowerCase();
}

function cleanTerm(raw: string): string | undefined {
const term = (raw || '').normalize('NFKC').trim().replace(/^[・、,\s]+|[・、,\s]+$/g, '');
if (term.length < 2 || term.length > 30) return undefined;
if (BAD_TERM_PREFIX.test(term) || BAD_TERM_SUFFIX.test(term)) return undefined;
if (/^\d+$/.test(term)) return undefined;
if (/[はがをにへとやも]$/.test(term)) return undefined;
return term;
}

function cleanGloss(raw: string): string | undefined {
let gloss = (raw || '').normalize('NFKC').trim();
gloss = gloss.replace(/^[、,・\s]+/, '');
gloss = gloss.replace(/(である|です|とされる|を指す|を意味する|のことである|のこと|と呼ばれる|をいう)[。．.]?\s*$/, '');
gloss = gloss.replace(/[。．.]$/, '').trim();
if (gloss.length < 4) return undefined;
if (gloss.length > 140) gloss = gloss.slice(0, 140);
if (/https?:\/\//.test(gloss)) return undefined;
return gloss;
}

function extractHypernym(gloss: string): string | undefined {
const m = gloss.match(/([一-龯ァ-ヶーA-Za-z0-9]{2,16})の(?:一種|総称|一形態|カテゴリ|カテゴリー)/);
if (!m) return undefined;
const candidate = m[1].trim();
if (candidate.length < 2 || BAD_TERM_SUFFIX.test(candidate)) return undefined;
return candidate;
}

function extractEnLabel(sentence: string): string | undefined {
const m = sentence.match(/[（(]\s*英\s*[:：]\s*([A-Za-z][A-Za-z0-9.'-]{1,40})\s*[）)]/);
return m? m[1].trim(): undefined;
}

function splitSentences(text: string): string[] {
return text
.split(/(?<=[。！？!?])|\n+/)
.map((s) => s.trim())
.filter((s) => s.length >= 8 && s.length <= 240);
}

class DefinitionPatternService {
private additions: DefinitionPattern[] = [];
private loaded = false;
private compiled: Array<{ pattern: DefinitionPattern; regex: RegExp}> = [];

private load(): void {
if (this.loaded) return;
this.loaded = true;
try {
const raw = storageService.getItem(PATTERNS_KEY);
const parsed = raw? JSON.parse(raw): null;
if (Array.isArray(parsed)) {
this.additions = parsed.filter(
(p: any) => p && typeof p.regex === 'string' && typeof p.id === 'string',
);
}
} catch { /* 追加分が読めなくても種だけで動く */}
this.rebuild();
}

private save(): void {
try {
storageService.setItem(PATTERNS_KEY, JSON.stringify(this.additions.slice(-MAX_PATTERNS)));
} catch (e) {
systemLogger.warn('PERSISTENCE', 'Failed to save definition patterns', e);
}
}

private rebuild(): void {
this.compiled = [];
for (const pattern of [...SEED_PATTERNS.map((p) => ({...p, addedAt: 0})),...this.additions]) {
if (!pattern.enabled) continue;
try {
this.compiled.push({ pattern, regex: new RegExp(pattern.regex, 'u')});
} catch { /* 壊れた形は使わない（登録時の検証で弾くのが本線） */}
}
}

public listPatterns(): DefinitionPattern[] {
this.load();
return [...SEED_PATTERNS.map((p) => ({...p, addedAt: 0})),...this.additions];
}

/**
* 定義形を1件追加する（教師教材・手動）。検証を通らなければ
* 理由付きで却下する。同じ正規表現の二重登録はしない。
*/
public addPattern(input: {
id?: string;
name?: string;
regex: string;
source: 'teacher' | 'manual';
}): { ok: boolean; reason?: string; id?: string} {
this.load();
const regexText = (input.regex || '').trim();
if (regexText.length < 20 || regexText.length > 800) {
return { ok: false, reason: 'PATTERN_LENGTH'};
}
if (!regexText.includes('(?<term>') ||!regexText.includes('(?<gloss>')) {
return { ok: false, reason: 'PATTERN_MISSING_GROUPS'};
}
let compiled: RegExp;
try {
compiled = new RegExp(regexText, 'u');
} catch {
return { ok: false, reason: 'PATTERN_NOT_COMPILING'};
}
try {
for (const sample of SMOKE_SENTENCES) compiled.exec(sample);
} catch {
return { ok: false, reason: 'PATTERN_SMOKE_FAILED'};
}
if (this.listPatterns().some((p) => p.regex === regexText)) {
return { ok: false, reason: 'PATTERN_DUPLICATE'};
}
if (this.additions.length >= MAX_PATTERNS) {
return { ok: false, reason: 'PATTERN_LIMIT'};
}
const id = (input.id || `pattern-${Date.now().toString(36)}`).slice(0, 60);
this.additions.push({
id,
name: (input.name || id).slice(0, 80),
source: input.source,
regex: regexText,
enabled: true,
addedAt: Date.now(),
});
this.save();
this.rebuild();
systemLogger.info('SELF_IMPROVEMENT', `📖 [定義形] 新しい定義形を登録: ${id} (source=${input.source})`);
return { ok: true, id};
}

/**
* ページ本文から定義の明示を抽出する。1ページ・1語につき最初の
* 定義だけを返す（多義はページ/文脈を跨いで意味ストア側が持つ）。
*/
public extractDefinitions(text: string, options?: { limit?: number}): ExtractedDefinition[] {
this.load();
const limit = options?.limit?? 12;
const out = new Map<string, ExtractedDefinition>();
const sentences = splitSentences(text || '').slice(0, 60);
for (const sentence of sentences) {
for (const { pattern, regex} of this.compiled) {
const m = regex.exec(sentence);
if (!m?.groups) continue;
const term = cleanTerm(m.groups.term || '');
if (!term) continue;
const key = normalizeKey(term);
if (out.has(key)) continue;
const gloss = cleanGloss(m.groups.gloss || '');
if (!gloss) continue;
if (gloss === term || gloss === `${term}のこと` || gloss === `${term}のもの`) continue;
out.set(key, {
term,
gloss,
reading: m.groups.reading?.trim() || undefined,
enLabel: extractEnLabel(sentence),
hypernym: extractHypernym(gloss),
sentence,
patternId: pattern.id,
});
break;
}
if (out.size >= limit) break;
}
return [...out.values()];
}
}

export const definitionPatternService = new DefinitionPatternService();
