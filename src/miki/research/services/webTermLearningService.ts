import { canonicalSha256Object } from '../../core/services/canonicalSha256Service';
import { japaneseDictionaryService } from './japaneseDictionaryService';
import { unitConversionService } from '../../memory/services/unitConversionService';
import { definitionPatternService, type ExtractedDefinition } from './definitionPatternService';
import { lexicalRelationService } from '../../memory/services/lexicalRelationService';
import { systemLogger } from '../../../services/systemLogger';
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
  // P494: いま意味を必要としている語（調査を止めている未知語）。
  // 候補抽出の単位から漏れても定義抽出と登録の対象にする。
  priorityTerms?: string[];
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
  // P494: このページの定義文から新しく覚えた意味。
  learnedDefinitions: Array<{ term: string; gloss: string; sense: string }>;
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
  // P497: gloss の出所（'dictionary' または定義形のパターン ID）。
  // 弱い定義形由来の gloss を強い定義で上書きする判定に使う。
  glossPatternId?: string;
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
      return { terms: [], componentIds: [], glossedCount: 0, duplicateCount: 0, needsGlossCount: 0, learnedDefinitions: [] };
    }

    // P494: 定義文の抽出は候補ランキングと独立に先に行う。辞書に
    // gloss が無い語は、ページ内の定義の明示から意味を得る。
    const extractions = new Map<string, ExtractedDefinition>();
    for (const def of definitionPatternService.extractDefinitions(text)) {
      extractions.set(normalize(def.term), def);
    }
    const learnedByTerm = new Map<string, ExtractedDefinition>();

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
    const candidatesMap = extractCandidates(text);
    // P494: 優先語（意味が必要な語）は候補の単位から漏れても対象に
    // 入れる。本文に実在することだけは確認する。
    for (const priority of input.priorityTerms ?? []) {
      const key = normalize(priority);
      if (key && !candidatesMap.has(key) && text.includes(priority)) {
        candidatesMap.set(key, 2);
      }
    }
    const ranked = [...candidatesMap]
      .map(([term, occurrences]) => {
        const hits = japaneseDictionaryService.lookup(term);
        const hit = hits[0];
        // P491: 単位の語は辞書に gloss が無くても、換算ルールから
        // 意味（代表的な換算）を付けられる。
        if (!hit?.gloss) {
          const unitGloss = unitConversionService.glossForTerm(term);
          if (unitGloss) {
            return { term, occurrences, hit: { ...(hit || {}), gloss: unitGloss } as typeof hit };
          }
        }
        // P494: 辞書に gloss が無い語は、このページの定義文から
        // 意味を得る（推測ではなく、定義の明示がある場合だけ）。
        // P497: 定義文の記録は辞書ヒットの有無にかかわらず行う
        // （辞書に弱い gloss で入っている語へ、強い定義で
        // 上書きする判定が統合側で必要になるため）。
        const extraction = extractions.get(normalize(term));
        if (extraction) {
          learnedByTerm.set(normalize(term), extraction);
          if (!hit?.gloss) {
            return {
              term,
              occurrences,
              hit: {
                ...(hit || {}),
                gloss: extraction.gloss,
                reading: hit?.reading ?? extraction.reading,
              } as typeof hit,
            };
          }
        }
        return { term, occurrences, hit };
      })
      .sort((a, b) => {
        const glossDiff = Number(Boolean(b.hit?.gloss)) - Number(Boolean(a.hit?.gloss));
        if (glossDiff !== 0) return glossDiff;
        return b.occurrences - a.occurrences;
      })
      .slice(0, MAX_PAGE_TERMS);

    for (const { term, occurrences, hit } of ranked) {
      if (!hit && occurrences < 2) continue;
      const learnedDef = learnedByTerm.get(normalize(term));

      // P497: gloss の有無は辞書ヒットだけでなく、定義文から
      // 抽出した意味でも判定する（従来は定義で学んだ語も
      // needsGloss のまま部品化され、意味があるのに「意味なし」
      // として扱われ続けていた）。
      const effectiveGloss = hit?.gloss ?? learnedDef?.gloss;
      const needsGloss = !effectiveGloss;
      if (needsGloss) needsGlossCount++;
      else glossedCount++;

      const existing = existingByTerm.get(term);
      if (existing) {
        // 同じ語の証拠を束ねるだけ。意味の推測はしない。gloss は辞書
        // ヒットか、本文の定義文から抽出したもの（P494）で補う。
        // P497: 統合側で定義 gloss を落とすと、先に gloss 無しで
        // 部品化された語は、後から定義を学んでも部品側だけ
        // 永久に gloss 無しのまま残っていた。
        let mergedGloss = existing.gloss ?? hit?.gloss ?? learnedDef?.gloss;
        let mergedGlossPatternId = existing.gloss
          ? existing.glossPatternId
          : learnedDef
            ? learnedDef.patternId
            : hit?.gloss
              ? 'dictionary'
              : undefined;
        // P497: 「Xとは〜」の明示定義は、「Xは〜である」由来の
        // 弱い gloss より優先する（辞書由来は最優先のまま）。
        if (
          learnedDef?.gloss &&
          learnedDef.patternId === 'seed-jp-towa' &&
          mergedGlossPatternId === 'seed-jp-ha-dearu'
        ) {
          mergedGloss = learnedDef.gloss;
          mergedGlossPatternId = learnedDef.patternId;
        }
        const merged: StoredTermComponent = {
          ...existing,
          claimIds: [...new Set([...existing.claimIds, ...(input.claimIds ?? [])])],
          evidenceRefs: [...new Set([...existing.evidenceRefs, input.evidenceId])],
          sourceUrls: [...new Set([...existing.sourceUrls, input.url])],
          sourceArtifactIds: [...new Set([...existing.sourceArtifactIds, input.evidenceId])],
          occurrences: (existing.occurrences ?? 0) + occurrences,
          gloss: mergedGloss,
          glossPatternId: mergedGlossPatternId,
          needsGloss: !mergedGloss,
          exampleSentence: existing.exampleSentence ?? findExampleSentence(text, term),
          updatedAt: Date.now(),
        };
        reusableComponentFactoryService.storeCandidates([merged]);
        duplicateCount++;
        componentIds.push(existing.componentId);
        terms.push({
          term,
          occurrences: merged.occurrences ?? occurrences,
          dictionaryKnown: Boolean(hit) && !learnedDef,
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
        dictionaryKnown: Boolean(hit) && !learnedDef,
        dictionarySource: hit?.source,
        lemma: hit?.lemma,
        reading: hit?.reading,
        pos: hit?.pos,
        gloss: effectiveGloss,
        glossPatternId: learnedDef ? learnedDef.patternId : hit?.gloss ? 'dictionary' : undefined,
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
        dictionaryKnown: Boolean(hit) && !learnedDef,
        dictionarySource: hit?.source,
        lemma: hit?.lemma,
        reading: hit?.reading,
        pos: hit?.pos,
        gloss: effectiveGloss,
        semanticIds: hit?.semanticIds,
        componentId: component.componentId,
        needsGloss,
      });
    }

    // P494: 定義文から学んだ意味を、意味ストア（多義は分岐として）
    // と個人辞書へ登録し、意味学習のループを閉じる。辞書に既にある
    // 語は個人辞書で上書きしない（意味の分岐だけが増える）。
    const learnedDefinitions: Array<{ term: string; gloss: string; sense: string }> = [];
    const registeredKeys = new Set<string>();
    const registerDefinition = (def: ExtractedDefinition) => {
      const key = normalize(def.term);
      if (registeredKeys.has(key)) return;
      registeredKeys.add(key);
      const sense = lexicalRelationService.addLearnedSense(def.term, {
        description: def.gloss,
        hypernyms: def.hypernym ? [def.hypernym] : [],
        enLabel: def.enLabel,
        sourceUrl: input.url,
      });
      if (def.hypernym) {
        lexicalRelationService.addRelation(def.term, def.hypernym, 'HYPERNYM', 'learned');
      }
      if (def.enLabel) {
        lexicalRelationService.addRelation(def.term, def.enLabel, 'TRANSLATION', 'learned');
      }
      if (!japaneseDictionaryService.has(def.term)) {
        japaneseDictionaryService.addPersonal(def.term, {
          gloss: def.gloss,
          reading: def.reading,
          semanticIds: ['learned:definition', `pattern:${def.patternId}`],
        });
      } else if (def.patternId === 'seed-jp-towa') {
        // P497: 弱い定義形（Xは〜である）で先に個人辞書へ入った語に、
        // 明示定義（Xとは〜）が後から来たら gloss を強い方へ差し
        // 替える。本物の辞書由来の語は対象外（個人辞書の学習
        // エントリだけが差し替え対象）。
        const existingLearned = japaneseDictionaryService
          .lookup(def.term)
          .find((e) => e.source === 'PERSONAL' && (e.semanticIds || []).includes('learned:definition'));
        if (existingLearned && !(existingLearned.semanticIds || []).includes('pattern:seed-jp-towa')) {
          japaneseDictionaryService.addPersonal(def.term, {
            gloss: def.gloss,
            reading: def.reading ?? existingLearned.reading,
            semanticIds: ['learned:definition', `pattern:${def.patternId}`],
          });
        }
      }
      learnedDefinitions.push({ term: def.term, gloss: def.gloss, sense });
      systemLogger.info(
        'SELF_IMPROVEMENT',
        `📖 [意味学習] 「${def.term}」: ${def.gloss.slice(0, 60)} (意味=${sense}, 出所=${input.url})`,
      );
    };
    const rankedTermKeys = new Set(terms.map((t) => normalize(t.term)));
    for (const def of learnedByTerm.values()) {
      if (rankedTermKeys.has(normalize(def.term))) registerDefinition(def);
    }
    let overflow = 0;
    for (const def of extractions.values()) {
      if (overflow >= 3) break;
      if (registeredKeys.has(normalize(def.term))) continue;
      registerDefinition(def);
      overflow++;
    }

    return { terms, componentIds, glossedCount, duplicateCount, needsGlossCount, learnedDefinitions };
  }
}

export const webTermLearningService = new WebTermLearningService();
