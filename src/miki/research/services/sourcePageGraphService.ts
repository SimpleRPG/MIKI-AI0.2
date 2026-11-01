import { storageService} from '../../../services/storageService';
import { systemLogger} from '../../../services/systemLogger';
import { canonicalSha256Object} from '../../core/services/canonicalSha256Service';
import { contentTermsFromTokens} from './japaneseAnalysisService';
import { japaneseAnalysisCompositionService} from '../../conversation/services/japaneseAnalysisCompositionService';

export type SourcePageStatementKind = 'SENTENCE' | 'LIST_ITEM' | 'TABLE_ROW';

export interface SourcePageStatement {
id: string;
text: string;
kind: SourcePageStatementKind;
sectionId: string;
}

export interface SourcePageSection {
id: string;
heading: string;
contentTerms: string[];
statementIds: string[];
}

export interface SourcePageGraph {
pageId: string;
url: string;
host: string;
title: string;
evidenceId?: string;
builtAt: number;
textLength: number;
sections: SourcePageSection[];
statements: SourcePageStatement[];
}

export interface SourcePageRelevantStatement {
text: string;
kind: SourcePageStatementKind;
sectionHeading: string;
score: number;
}

const STORAGE_KEY = 'miki_source_page_graphs_v1';
const MAX_STORED_GRAPHS = 30;
const MAX_SECTIONS = 24;
const MAX_STATEMENTS_PER_SECTION = 12;
const MAX_STATEMENTS_PER_PAGE = 48;
const SECTION_WINDOW = 3000;

const HEADING_PATTERNS: RegExp[] = [
/^#{1,6}\s+\S/,
/^[■□◆●▲★※]\s*\S/,
/^]{1,40}】/,
/^第[0-9０-９一二三四五六七八九十]+[章節編部話]\s*\S*/,
/^\d{1,2}[.．、]\s*\S{2,40}$/,
];

function isHeadingLine(line: string): boolean {
const trimmed = line.trim();
if (trimmed.length < 2 || trimmed.length > 60) return false;
if (/[。．.!?！？]$/.test(trimmed)) return false;
return HEADING_PATTERNS.some((pattern) => pattern.test(trimmed));
}

function normalizeKey(value: string): string {
return (value || '').normalize('NFKC').toLowerCase().replace(/[\s\p{P}\p{S}]+/gu, '');
}

interface RawSection { heading: string; text: string}

function splitIntoSections(text: string): RawSection[] {
const lines = text.split(/\n/);
const sections: RawSection[] = [];
let current: RawSection = { heading: '', text: ''};
let sawHeading = false;
for (const line of lines) {
if (isHeadingLine(line) && (current.text.trim().length > 0 || sawHeading)) {
sections.push(current);
current = { heading: line.trim(), text: ''};
sawHeading = true;
} else if (isHeadingLine(line) &&!sawHeading && current.text.trim().length === 0) {
current.heading = line.trim();
sawHeading = true;
} else {
current.text += (current.text? '\n': '') + line;
}
}
sections.push(current);
// Long sections are windowed so no part of a long page is skipped;
// pages without headings fall back to plain windows.
const windowed: RawSection[] = [];
for (const section of sections) {
if (section.text.length <= SECTION_WINDOW * 1.5) { windowed.push(section); continue;}
for (let offset = 0; offset < section.text.length; offset += SECTION_WINDOW) {
windowed.push({ heading: section.heading, text: section.text.slice(offset, offset + SECTION_WINDOW)});
}
}
const kept = windowed.filter((section) => section.text.trim().length > 0 || section.heading);
if (kept.length > MAX_SECTIONS) {
const head = kept.slice(0, MAX_SECTIONS - 1);
const rest = kept.slice(MAX_SECTIONS - 1);
head.push({ heading: rest[0]?.heading || '', text: rest.map((section) => section.text).join('\n').slice(0, SECTION_WINDOW)});
return head;
}
return kept.length? kept: [{ heading: '', text: text.slice(0, SECTION_WINDOW)}];
}

function extractStatements(sectionText: string): Array<{ text: string; kind: SourcePageStatementKind}> {
const out: Array<{ text: string; kind: SourcePageStatementKind}> = [];
const seen = new Set<string>();
for (const rawLine of sectionText.split(/\n+/)) {
const line = rawLine.trim();
if (!line) continue;
const isList = /^[・･\-*＊●○]/.test(line);
const isTable =!isList && (line.includes('｜') || line.includes('\t') || (line.match(/\|/g) || []).length >= 2);
const units = isList || isTable
? [line.replace(/^[・･\-*＊●○]\s*/, '')]
: line.split(/(?<=[。！？])/);
for (const unitRaw of units) {
const statementText = unitRaw.trim();
const key = normalizeKey(statementText);
if (statementText.length < 8 || statementText.length > 280 || seen.has(key)) continue;
seen.add(key);
out.push({ text: statementText, kind: isTable? 'TABLE_ROW': isList? 'LIST_ITEM': 'SENTENCE'});
if (out.length >= MAX_STATEMENTS_PER_SECTION) return out;
}
}
return out;
}

/**
* P388: a small graph per source. For every page actually read by
* research, keep a model of what the source says — site (host) ->
* page -> sections -> statements -> concepts — instead of only the
* page's first characters. This graph is NOT knowledge: it records
* what one source claims, with its evidence id, and whether MIKI
* believes it stays with the evidence gates and the claim store.
* Later research first recalls statements from graphs it already
* built, so a known compilation site is traversed, not re-searched
* from zero.
*/
class SourcePageGraphService {
private graphs = new Map<string, SourcePageGraph>();
private loaded = false;

private load(): void {
if (this.loaded) return;
this.loaded = true;
try {
const saved = storageService.getJson<{ graphs?: SourcePageGraph[]}>(STORAGE_KEY, { graphs: []});
for (const graph of saved?.graphs || []) {
if (graph?.pageId) this.graphs.set(graph.pageId, graph);
}
} catch { /* a missing or broken store means an empty graph set */}
}

private save(): void {
try {
const graphs = [...this.graphs.values()].sort((a, b) => b.builtAt - a.builtAt).slice(0, MAX_STORED_GRAPHS);
this.graphs = new Map(graphs.map((graph) => [graph.pageId, graph]));
storageService.setItem(STORAGE_KEY, JSON.stringify({ version: 1, graphs}));
} catch { /* persistence is best-effort; the in-memory graph still serves this session */}
}

public buildFromPage(params: {
url: string;
title: string;
text: string;
questionTerms?: string[];
}): { graph: SourcePageGraph; relevantStatements: SourcePageRelevantStatement[]} {
this.load();
const text = (params.text || '').trim();
const pageId = `page_${canonicalSha256Object({ url: params.url}).slice(0, 20)}`;
let host = '';
try { host = new URL(params.url).hostname.toLowerCase().replace(/^www\./, '');} catch { host = '';}
const rawSections = splitIntoSections(text);
const sections: SourcePageSection[] = [];
const statements: SourcePageStatement[] = [];
rawSections.forEach((raw, sectionIndex) => {
if (statements.length >= MAX_STATEMENTS_PER_PAGE) return;
const sectionId = `${pageId}:s${sectionIndex}`;
let contentTerms: string[] = [];
try {
const analysis = japaneseAnalysisCompositionService.analyzeSync(raw.heading? `${raw.heading}\n${raw.text}`: raw.text);
contentTerms = contentTermsFromTokens(analysis.analysis?.tokens?? []);
} catch { contentTerms = [];}
const extracted = extractStatements(raw.text).slice(0, Math.max(0, MAX_STATEMENTS_PER_PAGE - statements.length));
const statementIds: string[] = [];
extracted.forEach((item, statementIndex) => {
const id = `${sectionId}:t${statementIndex}`;
statements.push({ id, text: item.text, kind: item.kind, sectionId});
statementIds.push(id);
});
sections.push({ id: sectionId, heading: raw.heading, contentTerms, statementIds});
});
const graph: SourcePageGraph = {
pageId,
url: params.url,
host,
title: params.title || '',
builtAt: Date.now(),
textLength: text.length,
sections,
statements,
};
this.graphs.set(pageId, graph);
this.save();
systemLogger.info('SELF_IMPROVEMENT', `[SourcePageGraph] built ${pageId} host=${host} sections=${sections.length} statements=${statements.length} chars=${text.length}`);
return { graph, relevantStatements: this.relevantStatements(graph, params.questionTerms || [])};
}

public attachEvidenceId(pageId: string, evidenceId: string): void {
this.load();
const graph = this.graphs.get(pageId);
if (!graph) return;
graph.evidenceId = evidenceId;
this.save();
}

public relevantStatements(graph: SourcePageGraph, questionTerms: string[]): SourcePageRelevantStatement[] {
const terms = [...new Set((questionTerms || []).filter(Boolean))];
const sectionById = new Map(graph.sections.map((section) => [section.id, section]));
const scored = graph.statements.map((statement) => {
const section = sectionById.get(statement.sectionId);
const statementHits = terms.filter((term) => statement.text.includes(term)).length;
const sectionHits = section? terms.filter((term) => section.contentTerms.includes(term)).length: 0;
return {
text: statement.text,
kind: statement.kind,
sectionHeading: section?.heading || '',
score: statementHits * 2 + sectionHits,
};
});
if (terms.length) {
return scored.filter((item) => item.score > 0).sort((a, b) => b.score - a.score);
}
return scored;
}

public getGraphForUrl(url: string): SourcePageGraph | undefined {
this.load();
const pageId = `page_${canonicalSha256Object({ url}).slice(0, 20)}`;
return this.graphs.get(pageId);
}

public listGraphsForHost(host: string): SourcePageGraph[] {
this.load();
const normalized = (host || '').toLowerCase().replace(/^www\./, '');
return [...this.graphs.values()].filter((graph) => graph.host === normalized);
}

public searchStatements(terms: string[], limit = 4): Array<{ graph: SourcePageGraph; statement: SourcePageStatement; sectionHeading: string; score: number}> {
this.load();
const cleanTerms = [...new Set((terms || []).filter((term) => term && term.length >= 2))];
if (!cleanTerms.length) return [];
const hits: Array<{ graph: SourcePageGraph; statement: SourcePageStatement; sectionHeading: string; score: number}> = [];
for (const graph of this.graphs.values()) {
for (const relevant of this.relevantStatements(graph, cleanTerms)) {
if (relevant.score <= 0) continue;
const statement = graph.statements.find((item) => item.text === relevant.text);
if (statement) hits.push({ graph, statement, sectionHeading: relevant.sectionHeading, score: relevant.score});
}
}
return hits.sort((a, b) => b.score - a.score).slice(0, Math.max(1, limit));
}

public getStats(): { pages: number; hosts: number; statements: number} {
this.load();
const graphs = [...this.graphs.values()];
return {
pages: graphs.length,
hosts: new Set(graphs.map((graph) => graph.host)).size,
statements: graphs.reduce((sum, graph) => sum + graph.statements.length, 0),
};
}
}

export const sourcePageGraphService = new SourcePageGraphService();
