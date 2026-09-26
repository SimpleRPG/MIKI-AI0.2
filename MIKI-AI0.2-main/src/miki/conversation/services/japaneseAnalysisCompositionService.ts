import { JapaneseAnalysisResult, JapaneseToken, japaneseAnalysisService } from '../../research/services/japaneseAnalysisService';
import { japaneseMorphologyService } from '../../research/services/japaneseMorphologyService';

export type JapaneseAnalysisComponentId = 'SUDACHI_NATIVE' | 'INTL_SEGMENTER' | 'DETERMINISTIC_DICTIONARY_NGRAM';
export interface JapaneseAnalysisComponentResult { componentId: JapaneseAnalysisComponentId; available: boolean; verified: boolean; analysis?: JapaneseAnalysisResult; reason: string; }
export interface JapaneseAnalysisBoundaryConflict { start: number; end: number; surfaces: string[]; components: JapaneseAnalysisComponentId[]; }
export interface JapaneseAnalysisCompositionResult { analysis: JapaneseAnalysisResult; components: JapaneseAnalysisComponentResult[]; conflicts: JapaneseAnalysisBoundaryConflict[]; usedComponents: JapaneseAnalysisComponentId[]; mode: 'PARALLEL_COMPOSITION' | 'SYNCHRONOUS_COMPOSITION'; }

const tokenKey = (token: JapaneseToken) => `${token.start}:${token.end}:${token.normalized}`;
const unique = (groups: string[][]) => [...new Set(groups.flat().filter(Boolean))];

function conflicts(components: JapaneseAnalysisComponentResult[]): JapaneseAnalysisBoundaryConflict[] {
  const ranges = new Map<string, { surfaces: Set<string>; components: Set<JapaneseAnalysisComponentId> }>();
  for (const component of components) for (const token of component.analysis?.tokens || []) {
    const key = `${token.start}:${token.end}`;
    const value = ranges.get(key) || { surfaces: new Set<string>(), components: new Set<JapaneseAnalysisComponentId>() };
    value.surfaces.add(token.surface); value.components.add(component.componentId); ranges.set(key, value);
  }
  return [...ranges.entries()].filter(([, value]) => value.surfaces.size > 1).map(([key, value]) => {
    const [start, end] = key.split(':').map(Number);
    return { start, end, surfaces: [...value.surfaces], components: [...value.components] };
  });
}

function compose(components: JapaneseAnalysisComponentResult[]): JapaneseAnalysisResult {
  const available = components.filter(component => component.available && component.analysis);
  const primary = available.find(component => component.componentId === 'SUDACHI_NATIVE')?.analysis
    || available.find(component => component.componentId === 'INTL_SEGMENTER')?.analysis
    || available.find(component => component.componentId === 'DETERMINISTIC_DICTIONARY_NGRAM')?.analysis
    || japaneseAnalysisService.analyzeDeterministic('');
  const tokens = new Map<string, JapaneseToken>();
  for (const component of available) for (const token of component.analysis?.tokens || []) {
    const key = tokenKey(token); const old = tokens.get(key);
    tokens.set(key, old ? { ...old, lemma: old.lemma || token.lemma, reading: old.reading || token.reading, pos: old.pos || token.pos, semanticIds: unique([old.semanticIds || [], token.semanticIds || []]), dictionarySource: old.dictionarySource || token.dictionarySource } : token);
  }
  const mergedTokens = [...tokens.values()].sort((a, b) => a.start - b.start || a.end - b.end);
  const semanticRoles = available.flatMap(component => component.analysis?.semanticRoles || []).filter((role, index, all) => all.findIndex(other => other.role === role.role && other.token === role.token && other.particle === role.particle) === index);
  const rank = { LOW: 0, MEDIUM: 1, HIGH: 2 } as const;
  const confidence = available.reduce<JapaneseAnalysisResult['confidence']>((best, component) => rank[component.analysis?.confidence || 'LOW'] > rank[best] ? component.analysis!.confidence : best, 'LOW');
  return { ...primary, tokens: mergedTokens, contentTokens: unique(available.map(c => c.analysis?.contentTokens || [])), particles: unique(available.map(c => c.analysis?.particles || [])), bigrams: unique(available.map(c => c.analysis?.bigrams || [])), hasQuestion: available.some(c => c.analysis?.hasQuestion), hasCorrection: available.some(c => c.analysis?.hasCorrection), confidence, dictionaryHits: mergedTokens.filter(token => token.dictionarySource).length, dictionarySources: unique(available.map(c => c.analysis?.dictionarySources || [])), semanticRoles };
}

export class JapaneseAnalysisCompositionService {
  public analyzeSync(text: string): JapaneseAnalysisCompositionResult {
    const intl = japaneseAnalysisService.analyzeIntl(text);
    const deterministic = japaneseAnalysisService.analyzeDeterministic(text);
    const components: JapaneseAnalysisComponentResult[] = [
      { componentId: 'INTL_SEGMENTER', available: Boolean(intl), verified: Boolean(intl), analysis: intl, reason: intl ? 'Intl.Segmenter result included' : 'Intl.Segmenter unavailable' },
      { componentId: 'DETERMINISTIC_DICTIONARY_NGRAM', available: true, verified: true, analysis: deterministic, reason: 'Deterministic dictionary and N-gram result included' },
    ];
    return { analysis: compose(components), components, conflicts: conflicts(components), usedComponents: components.filter(c => c.available).map(c => c.componentId), mode: 'SYNCHRONOUS_COMPOSITION' };
  }
  public async analyze(text: string, mode: 'A' | 'B' | 'C' = 'C'): Promise<JapaneseAnalysisCompositionResult> {
    const sync = this.analyzeSync(text);
    const status = await japaneseMorphologyService.status();
    let native: JapaneseAnalysisResult | undefined;
    if (status.available) { const candidate = await japaneseAnalysisService.analyzeNativeFirst(text, mode); if (candidate.analyzer === 'SUDACHI') native = candidate; }
    const nativeComponent: JapaneseAnalysisComponentResult = { componentId: 'SUDACHI_NATIVE', available: Boolean(native), verified: Boolean(native), analysis: native, reason: native ? `Sudachi native result included (${status.dictionaryVersion || 'dictionary version unknown'})` : 'Sudachi native unavailable' };
    const components = [nativeComponent, ...sync.components];
    return { analysis: compose(components), components, conflicts: conflicts(components), usedComponents: components.filter(c => c.available).map(c => c.componentId), mode: 'PARALLEL_COMPOSITION' };
  }
}
export const japaneseAnalysisCompositionService = new JapaneseAnalysisCompositionService();
