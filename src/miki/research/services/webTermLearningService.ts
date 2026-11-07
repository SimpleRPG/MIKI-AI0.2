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
  // P440 1-A: gloss の有無による段階制。gloss が無い用語は捨てずに
  // needsGloss の印を付け、意味の補完対象にする（推測で捏造しない）。
  needsGloss: boolean;
}

export interface WebTermLearningResult {
  terms: LearnedWebTerm[];
  componentIds: string[];
  // P440 D5: 学習進捗の診断ログ用の集計。
  glossedCount: number;
  duplicateCount: number;
  needsGlossCount: number;
}

const STOP_WORDS = new Set([
  'これ','それ','あれ','ここ','そこ','もの','こと','ため','よう',
  '場合','時','中','前','後','this','that','these','those',
  'with','from','into','about','have','has','been','were',
]);

// P440 1-A: 用語学習のページ内上限。既存の流儀（命題学習は
// 8ユニット／ページ・24／ラン）に合わせ、24語／ページとする。
// 上限がないと1回の調査で古い知識が押し出されうる。
const MAX_PAGE_TERMS = 24;

// P440 1-A: learnPage で作る用語部品の本体に付く、型に無い項目。
type StoredTermComponent = KnowledgeComponentArtifact & {
  term?: string;
  occurrences?: number;
  gloss?: string;
  needsGloss?: boolean;
  // P463: その語が実際に使われていた文（使い方ごと覚えるための最小保持）。
  exampleSentence?: string;
};

// P463: ページテキストから、その語を含む最初の文を1つ抜く。
function findExampleSentence(text: string, term: string): string | undefined {
  const sentences = text.split(/(?<=[。！？!?])|\n+/);
  for (const sentence of sentences) {
    const clean = sentence.trim();
    if (clean && clean.includes(term)) return clean.slice(0, 140);
  }
  return undefined;
}

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
      return { terms: [], componentIds: [], glossedCount: 0, duplicateCount: 0, needsGlossCount: 0 };
    }

    const terms: LearnedWebTerm[] = [];
    const componentIds: string[] = [];
    let glossedCount = 0;
    let duplicateCount = 0;
    let needsGlossCount = 0;

    // P440 1-A: 語単位の重複排除。同じ語の部品が既にあれば、証拠を
    // 束ねて1件にする。ハッシュは変えない（既存の重複判定を壊さない）。
    // 対象は learnPage が作る用語部品（RC-KNOWLEDGE-TERM- 始まり）だけ。
    const existingByTerm = new Map<string, StoredTermComponent>();
    for (const item of reusableComponentFactoryService.list()) {
      if (item.componentKind !== 'KNOWLEDGE' || item.componentType !== 'TERM_KNOWLEDGE') continue;
      if (!item.componentId.startsWith('RC-KNOWLEDGE-TERM-')) continue;
      const stored = item as StoredTermComponent;
      if (typeof stored.term === 'string' && stored.term) {
        existingByTerm.set(stored.term, stored);
      }
    }

    // 辞書引きは1回だけ行い、gloss 付きを先に・出現回数の多い順に並べて
    // ページ内上限で切る。gloss の軸は「辞書ヒット」ではなく「gloss 有無」
    // （辞書にあっても gloss 無しが多数あるため。P440 D7）。
    const ranked = [...extractCandidates(text)]
      .map(([term, occurrences]) => {
        const hits = japaneseDictionaryService.lookup(term);
        return { term, occurrences, hit: hits[0] };
      })
      .sort((a, b) => {
        const glossDiff = Number(Boolean(b.hit?.gloss)) - Number(Boolean(a.hit?.gloss));
        if (glossDiff !== 0) return glossDiff;
        return b.occurrences - a.occurrences;
      })
      .slice(0, MAX_PAGE_TERMS);

    for (const { term, occurrences, hit } of ranked) {
      if (!hit && occurrences < 2) continue;

      const needsGloss = !hit?.gloss;
      if (needsGloss) needsGlossCount++;
      else glossedCount++;

      const existing = existingByTerm.get(term);
      if (existing) {
        // 同じ語の証拠を束ねるだけ。意味の推測はしない。gloss は辞書
        // ヒットがある場合だけ補う（無ければ gloss 無しのまま）。
        const merged: StoredTermComponent = {
          ...existing,
          claimIds: [...new Set([...existing.claimIds, ...(input.claimIds ?? [])])],
          evidenceRefs: [...new Set([...existing.evidenceRefs, input.evidenceId])],
          sourceUrls: [...new Set([...existing.sourceUrls, input.url])],
          sourceArtifactIds: [...new Set([...existing.sourceArtifactIds, input.evidenceId])],
          occurrences: (existing.occurrences ?? 0) + occurrences,
          gloss: existing.gloss ?? hit?.gloss,
          needsGloss: !(existing.gloss ?? hit?.gloss),
          exampleSentence: existing.exampleSentence ?? findExampleSentence(text, term),
          updatedAt: Date.now(),
        };
        reusableComponentFactoryService.storeCandidates([merged]);
        duplicateCount++;
        componentIds.push(existing.componentId);
        terms.push({
          term,
          occurrences: merged.occurrences ?? occurrences,
          dictionaryKnown: Boolean(hit),
          dictionarySource: hit?.source,
          lemma: hit?.lemma,
          reading: hit?.reading,
          pos: hit?.pos,
          gloss: merged.gloss,
          semanticIds: hit?.semanticIds,
          componentId: existing.componentId,
          needsGloss: merged.needsGloss ?? needsGloss,
        });
        continue;
      }

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
        needsGloss,
        exampleSentence: findExampleSentence(text, term),
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
        needsGloss,
      });
    }

    return { terms, componentIds, glossedCount, duplicateCount, needsGlossCount };
  }
}

export const webTermLearningService = new WebTermLearningService();
