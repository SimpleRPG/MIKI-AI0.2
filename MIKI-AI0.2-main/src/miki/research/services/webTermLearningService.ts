import { canonicalSha256Object } from '../../core/services/canonicalSha256Service';
import { japaneseDictionaryService } from './japaneseDictionaryService';
import {
  reusableComponentFactoryService,
  type KnowledgeComponentArtifact,
} from '../../core/services/reusableComponentFactoryService';

export interface WebTermLearningInput {
  text: string;
  url: string;
  evidenceId: string;
  claimIds?: string[];
  sourceTitle?: string;
}

export interface LearnedWebTerm {
  term: string;
  occurrences: number;
  dictionaryKnown: boolean;
  dictionarySource?: string;
  lemma?: string;
  reading?: string;
  pos?: string;
  gloss?: string;
  semanticIds?: string[];
  componentId: string;
}

export interface WebTermLearningResult {
  terms: LearnedWebTerm[];
  componentIds: string[];
}

const STOP_WORDS = new Set([
  'これ','それ','あれ','ここ','そこ','もの','こと','ため','よう',
  '場合','時','中','前','後','this','that','these','those',
  'with','from','into','about','have','has','been','were',
]);

function normalize(value: string): string {
  return value.normalize('NFKC').trim().toLowerCase();
}

function isUsefulTerm(term: string): boolean {
  const value = normalize(term);
  if (!value || STOP_WORDS.has(value)) return false;
  if (/^\d+$/.test(value)) return false;
  if (/^[ぁ-ゖー]$/.test(value)) return false;
  if (/^[\u3040-\u30ff\u3400-\u9fff]+$/.test(value)) return value.length >= 2;
  return value.length >= 3;
}

function extractCandidates(text: string): Map<string, number> {
  const counts = new Map<string, number>();
  const candidates = [
    ...(text.match(/[\u3040-\u30ff\u3400-\u9fff]{2,}/g) ?? []),
    ...(text.match(/[A-Za-z][A-Za-z0-9_+#.-]{2,}/g) ?? []),
  ];

  for (const raw of candidates) {
    if (!isUsefulTerm(raw)) continue;
    const key = normalize(raw);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

class WebTermLearningService {
  learnPage(input: WebTermLearningInput): WebTermLearningResult {
    const text = input.text.trim();
    if (!text || !input.url || !input.evidenceId) {
      return { terms: [], componentIds: [] };
    }

    const terms: LearnedWebTerm[] = [];
    const componentIds: string[] = [];

    for (const [term, occurrences] of extractCandidates(text)) {
      const hits = japaneseDictionaryService.lookup(term);
      const hit = hits[0];

      if (!hit && occurrences < 2) continue;

      const body = {
        componentKind: 'KNOWLEDGE' as const,
        componentType: 'TERM_KNOWLEDGE',
        purpose: `Web page term knowledge: ${term}`,
        interfaceContract: {
          input: 'term or concept query',
          output: 'contextual term knowledge linked to source evidence',
        },
        inputs: ['term', 'context'],
        outputs: ['term definition', 'context', 'source evidence'],
        prerequisites: [],
        dependencies: ['web-evidence', 'japanese-dictionary'],
        appliesWhen: [`term:${term}`, 'web-derived knowledge', 'research context'],
        doesNotApplyWhen: ['term meaning conflicts with newer verified evidence'],
        sourceEpisodeIds: [],
        sourceLearningArtifactIds: [],
        environmentFingerprint: 'unknown',
        lifecycleStatus: 'CANDIDATE' as const,
        usageCount: 0,
        successCount: 0,
        failureCount: 0,
        claimIds: [...(input.claimIds ?? [])],
        evidenceRefs: [input.evidenceId],
        sourceUrls: [input.url],
        sourceArtifactIds: [input.evidenceId],
        verificationStatus: 'UNVERIFIED' as const,
        contradictionRefs: [],
        freshnessPolicy: 'REVALIDATE_ON_ENVIRONMENT_CHANGE',
        term,
        occurrences,
        dictionaryKnown: Boolean(hit),
        dictionarySource: hit?.source,
        lemma: hit?.lemma,
        reading: hit?.reading,
        pos: hit?.pos,
        gloss: hit?.gloss,
        semanticIds: hit?.semanticIds,
        sourceTitle: input.sourceTitle ?? '',
      };

      const canonicalSha256 = canonicalSha256Object(body);
      const component: KnowledgeComponentArtifact = {
        ...body,
        componentId: `RC-KNOWLEDGE-TERM-${canonicalSha256.slice(0, 18)}`,
        canonicalSha256,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      reusableComponentFactoryService.storeCandidates([component]);
      componentIds.push(component.componentId);
      terms.push({
        term,
        occurrences,
        dictionaryKnown: Boolean(hit),
        dictionarySource: hit?.source,
        lemma: hit?.lemma,
        reading: hit?.reading,
        pos: hit?.pos,
        gloss: hit?.gloss,
        semanticIds: hit?.semanticIds,
        componentId: component.componentId,
      });
    }

    return { terms, componentIds };
  }
}

export const webTermLearningService = new WebTermLearningService();
