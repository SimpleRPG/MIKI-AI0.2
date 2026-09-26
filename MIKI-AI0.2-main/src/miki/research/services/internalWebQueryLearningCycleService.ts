import { canonicalSha256Object } from '../../core/services/canonicalSha256Service';

export type ResearchEnvironmentKind = 'GALAXY_S25' | 'ANDROID' | 'TERMUX' | 'PC' | 'WINDOWS' | 'UNKNOWN';
export type WebContentKind = 'HTML' | 'MARKDOWN';

export interface RenderedPageInput {
  url: string;
  content: string;
  contentKind: WebContentKind;
  selector?: string;
  xpath?: string;
}

export interface RenderedPageSections {
  main: string;
  navigation: string;
  advertisements: string;
  menus: string;
  footer: string;
}

export interface InternalResearchEvidence {
  evidenceId: string;
  sourceUrl: string;
  excerpt: string;
  environment: ResearchEnvironmentKind;
  evidenceSha256: string;
}

export interface InternalResearchClaim {
  claimId: string;
  statement: string;
  evidenceIds: string[];
  claimSha256: string;
}

export interface LearnedTerm {
  term: string;
  occurrences: number;
  evidenceIds: string[];
}

export interface InternalKnowledgeComponent {
  componentId: string;
  environment: ResearchEnvironmentKind;
  claimIds: string[];
  evidenceIds: string[];
  terms: LearnedTerm[];
  componentSha256: string;
}

export interface QueryRevisionPair {
  before: string;
  after: string;
  reason: string;
  revisionSha256: string;
}

export interface InternalWebQueryCycleResult {
  query: string;
  environment: ResearchEnvironmentKind;
  pages: Array<{ url: string; sections: RenderedPageSections; selectedText: string }>;
  evidence: InternalResearchEvidence[];
  claims: InternalResearchClaim[];
  terms: LearnedTerm[];
  knowledgeComponent: InternalKnowledgeComponent;
  coverage: { requestedPageCount: number; processedPageCount: number; evidencePageCount: number; ratio: number };
  queryOutcome: { status: 'EVIDENCE_GAINED' | 'NO_RESULTS'; evidenceIds: string[]; environmentApplicability: string };
  revisionPair: QueryRevisionPair;
  resultSha256: string;
}

const decodeEntities = (value: string): string => value
  .replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')
  .replace(/&quot;/gi, '"').replace(/&#39;/gi, "'");
const textOnly = (value: string): string => decodeEntities(value.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
const markdownOnly = (value: string): string => value.replace(/```[\s\S]*?```/g, ' ').replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
  .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/^#{1,6}\s+/gm, '').replace(/[>*_`~-]/g, ' ').replace(/\s+/g, ' ').trim();
const removeBlocks = (html: string, pattern: RegExp): { removed: string; remaining: string } => {
  const removed: string[] = [];
  const remaining = html.replace(pattern, match => { removed.push(textOnly(match)); return ' '; });
  return { removed: removed.filter(Boolean).join(' '), remaining };
};
const unique = <T>(items: T[]): T[] => [...new Set(items)];

const extractSelector = (html: string, selector?: string): string => {
  if (!selector) return '';
  const selectorValue = selector.startsWith('#') || selector.startsWith('.') ? selector.slice(1) : selector;
  const escaped = selectorValue.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  let pattern: RegExp | undefined;
  if (selector.startsWith('#')) pattern = new RegExp(`<([a-z0-9]+)[^>]*\\bid=["']${escaped}["'][^>]*>[\\s\\S]*?<\\/\\1>`, 'i');
  if (selector.startsWith('.')) pattern = new RegExp(`<([a-z0-9]+)[^>]*\\bclass=["'][^"']*\\b${escaped}\\b[^"']*["'][^>]*>[\\s\\S]*?<\\/\\1>`, 'i');
  if (/^[a-z][a-z0-9-]*$/i.test(selector)) pattern = new RegExp(`<(${escaped})\\b[^>]*>[\\s\\S]*?<\\/\\1>`, 'i');
  return pattern ? textOnly(html.match(pattern)?.[0] ?? '') : '';
};
const extractXpath = (html: string, xpath?: string): string => {
  const match = xpath?.match(/^\/\/([a-z][a-z0-9-]*)(?:\[@(?:id|class)=["']([^"']+)["']\])?$/i);
  if (!match) return '';
  return extractSelector(html, match[2] ? (xpath?.includes('@id') ? `#${match[2]}` : `.${match[2]}`) : match[1]);
};

export class InternalWebQueryLearningCycleService {
  separate(content: string, kind: WebContentKind): RenderedPageSections {
    if (kind === 'MARKDOWN') return { main: markdownOnly(content), navigation: '', advertisements: '', menus: '', footer: '' };
    let current = content;
    const navigation = removeBlocks(current, /<nav\b[^>]*>[\s\S]*?<\/nav>/gi); current = navigation.remaining;
    const advertisements = removeBlocks(current, /<([a-z0-9]+)\b[^>]*(?:class|id)=["'][^"']*(?:advert|ads?|sponsor)[^"']*["'][^>]*>[\s\S]*?<\/\1>/gi); current = advertisements.remaining;
    const menus = removeBlocks(current, /<([a-z0-9]+)\b[^>]*(?:class|id)=["'][^"']*(?:menu|sidebar)[^"']*["'][^>]*>[\s\S]*?<\/\1>/gi); current = menus.remaining;
    const footer = removeBlocks(current, /<footer\b[^>]*>[\s\S]*?<\/footer>/gi); current = footer.remaining;
    const mainMatch = current.match(/<main\b[^>]*>[\s\S]*?<\/main>/i) ?? current.match(/<article\b[^>]*>[\s\S]*?<\/article>/i);
    return { main: textOnly(mainMatch?.[0] ?? current), navigation: navigation.removed, advertisements: advertisements.removed, menus: menus.removed, footer: footer.removed };
  }

  run(query: string, environment: ResearchEnvironmentKind, inputs: RenderedPageInput[]): InternalWebQueryCycleResult {
    const pages = inputs.map(input => {
      const sections = this.separate(input.content, input.contentKind);
      const selectedText = input.contentKind === 'HTML'
        ? (extractSelector(input.content, input.selector) || extractXpath(input.content, input.xpath) || sections.main)
        : sections.main;
      return { url: input.url, sections, selectedText };
    });
    const evidence = pages.filter(page => page.selectedText.length > 0).map(page => {
      const excerpt = page.selectedText.slice(0, 1200);
      const evidenceSha256 = canonicalSha256Object({ sourceUrl: page.url, excerpt, environment });
      return { evidenceId: `EVD-${evidenceSha256.slice(0, 20)}`, sourceUrl: page.url, excerpt, environment, evidenceSha256 };
    });
    const claims = evidence.map(item => {
      const statement = item.excerpt.split(/(?<=[.!?。！？])\s*/)[0].trim() || item.excerpt;
      const claimSha256 = canonicalSha256Object({ statement, evidenceIds: [item.evidenceId] });
      return { claimId: `CLM-${claimSha256.slice(0, 20)}`, statement, evidenceIds: [item.evidenceId], claimSha256 };
    });
    const termMap = new Map<string, { count: number; evidenceIds: string[] }>();
    for (const item of evidence) for (const term of item.excerpt.match(/[A-Za-z][A-Za-z0-9_.-]{2,}|[\u30a1-\u30ff\u3400-\u9fff]{2,}/g) ?? []) {
      const key = term.toLowerCase(); const current = termMap.get(key) ?? { count: 0, evidenceIds: [] };
      current.count += 1; current.evidenceIds.push(item.evidenceId); termMap.set(key, current);
    }
    const terms = [...termMap.entries()].sort((a, b) => b[1].count - a[1].count || a[0].localeCompare(b[0])).slice(0, 30)
      .map(([term, value]) => ({ term, occurrences: value.count, evidenceIds: unique(value.evidenceIds) }));
    const componentBase = { environment, claimIds: claims.map(item => item.claimId), evidenceIds: evidence.map(item => item.evidenceId), terms };
    const componentSha256 = canonicalSha256Object(componentBase);
    const knowledgeComponent = { componentId: `KCP-${componentSha256.slice(0, 20)}`, ...componentBase, componentSha256 };
    const after = evidence.length > 0 ? query.trim() : `${query.trim()} official documentation ${environment}`.trim();
    const revisionBase = { before: query.trim(), after, reason: evidence.length > 0 ? 'EVIDENCE_GAINED_NO_REVISION' : 'NO_RESULTS_ENVIRONMENT_REFINEMENT' };
    const revisionPair = { ...revisionBase, revisionSha256: canonicalSha256Object(revisionBase) };
    const coverage = { requestedPageCount: inputs.length, processedPageCount: pages.length, evidencePageCount: evidence.length, ratio: inputs.length === 0 ? 0 : evidence.length / inputs.length };
    const queryOutcome = { status: evidence.length > 0 ? 'EVIDENCE_GAINED' as const : 'NO_RESULTS' as const, evidenceIds: evidence.map(item => item.evidenceId), environmentApplicability: environment };
    const resultBase = { query: query.trim(), environment, pages, evidence, claims, terms, knowledgeComponent, coverage, queryOutcome, revisionPair };
    return { ...resultBase, resultSha256: canonicalSha256Object(resultBase) };
  }
}

export const internalWebQueryLearningCycleService = new InternalWebQueryLearningCycleService();
