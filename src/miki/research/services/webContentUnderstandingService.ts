import { canonicalSha256Object } from '../../core/services/canonicalSha256Service';
import {
  reusableComponentFactoryService,
  type KnowledgeComponentArtifact,
} from '../../core/services/reusableComponentFactoryService';
import { researchGraphConnectorP211Service } from './researchGraphConnectorP211Service';
import { webSemanticRuleLearningService } from './webSemanticRuleLearningService';

export type WebSemanticKnowledgeKind =
  | 'DEFINITION'
  | 'RELATION'
  | 'CAUSE'
  | 'CONDITION'
  | 'PREREQUISITE'
  | 'PROCEDURE'
  | 'EXCEPTION'
  | 'OBSERVATION';

export type WebSemanticRelation =
  | 'DEFINED_AS'
  | 'ASSERTS'
  | 'CAUSE_OR_EXPLANATION'
  | 'CONDITIONAL_ON'
  | 'REQUIRES'
  | 'PROCEDURE_STEP'
  | 'EXCEPTION_TO'
  | 'OBSERVES';

export type WebSemanticPolarity = 'AFFIRMATIVE' | 'NEGATIVE';

export interface WebSemanticUnit {
  unitId: string;
  kind: WebSemanticKnowledgeKind;
  relation: WebSemanticRelation;
  statement: string;
  subject?: string;
  object?: string;
  conditions: string[];
  exceptions: string[];
  polarity: WebSemanticPolarity;
  sequenceMarker?: string;
  scopeSignals: string[];
  sourceStart: number;
  sourceEnd: number;
  sourceFragmentSha256: string;
  extractionRule: string;
  extractionConfidence: number;
}

export interface WebSemanticComponentClaim {
  componentId: string;
  claimId: string;
  unitId: string;
}

export interface WebSemanticLearningResult {
  units: WebSemanticUnit[];
  componentIds: string[];
  componentClaims: WebSemanticComponentClaim[];
  graphNodeIds: string[];
  skippedUnits: number;
  graphFailures: number;
}

interface SentenceSegment {
  statement: string;
  sourceStart: number;
  sourceEnd: number;
}

const MAX_PAGE_UNITS = 8;

/*
 * P440 1-A: ボイラープレート（ナビゲーション等の定型断片）の除外リスト。
 * 観測された定型文言だけを exact match で除く決定論的なもので、意味の
 * 推測ではない。文全体がこのいずれかと一致するものだけを除くため、
 * 本文の文を誤って落とすことはない。
 */
const BOILERPLATE_PHRASES = new Set([
  'skip to content',
  'skip to main content',
  'skip to navigation',
  'jump to content',
  'navigation menu',
  'main menu',
  'table of contents',
  'back to top',
  'privacy policy',
  'terms of service',
  'terms of use',
  'cookie policy',
  'all rights reserved',
  'sign in',
  'log in',
  'sign up',
  'follow us',
  'subscribe',
  'newsletter',
  'advertisement',
  'breadcrumb',
  'サイトマップ',
  'お問い合わせ',
  'ログイン',
  '会員登録',
  'トップページ',
]);

function isBoilerplate(statement: string): boolean {
  const normalized = normalizeText(statement);
  if (BOILERPLATE_PHRASES.has(normalized)) return true;
  // P440 1-A: 短い断片の下限。40文字未満で3語未満の文は、見出し・
  // ナビゲーション断片であることがほとんど（本文の短文は通常これより
  // 長いか、3語以上ある）。exact match と組み合わせた決定論的な判定。
  const words = normalized.split(/\s+/).filter(Boolean);
  return statement.length < 40 && words.length < 3;
}

function normalizeText(value: string): string {
  return value.normalize('NFKC').replace(/\s+/g, ' ').trim().toLowerCase();
}

function sentenceSegments(text: string): SentenceSegment[] {
  const segments: SentenceSegment[] = [];
  const boundary = /[。！？!?]+|\.(?=\s+[A-Z])|\n+/g;
  let cursor = 0;

  const append = (start: number, end: number) => {
    const raw = text.slice(start, end);
    const leadingWhitespace = raw.length - raw.trimStart().length;
    const trimmed = raw.trim();
    if (!trimmed) return;

    const listPrefix = /^(?:[-*•]\s+|\d+[.)、]\s*)/.exec(trimmed)?.[0] ?? '';
    const statement = trimmed.slice(listPrefix.length).trim();
    if (!statement) return;

    const sourceStart = start + leadingWhitespace + listPrefix.length;
    const sourceEnd = sourceStart + statement.length;
    segments.push({ statement, sourceStart, sourceEnd });
  };

  let match: RegExpExecArray | null;
  while ((match = boundary.exec(text)) !== null) {
    const end = match.index + match[0].length;
    append(cursor, end);
    cursor = end;
  }
  append(cursor, text.length);
  return segments;
}

function extractConditions(statement: string): string[] {
  const cue = /(?:の場合|のとき|の時|とき|時|条件|なら|if\b|when\b|unless\b|provided that)/i;
  const match = cue.exec(statement);
  if (!match || match.index === undefined) return [];
  const start = Math.max(0, match.index - 80);
  const end = Math.min(statement.length, match.index + match[0].length + 40);
  return [statement.slice(start, end).trim()];
}

function extractExceptions(statement: string): string[] {
  const cue = /ただし|但し|例外|を除く|except|however|unless|not applicable when/i;
  const match = cue.exec(statement);
  if (!match || match.index === undefined) return [];
  return [statement.slice(match.index).trim()];
}

function extractScopeSignals(statement: string): string[] {
  const pattern = /\b(?:Android|iOS|Windows|Linux|macOS|WebView|Chrome|Firefox|Node\.?js|Python|Java|Minecraft|Bedrock|TypeScript|JavaScript)\b|\bv?\d+(?:\.\d+){1,3}\b/gi;
  return [...new Set(statement.match(pattern) ?? [])].slice(0, 5);
}

function stripTrailingPunctuation(value: string | undefined): string | undefined {
  const result = value?.replace(/[。！？!?.,;；:：]+$/g, '').trim();
  return result || undefined;
}

function isCodeLike(statement: string): boolean {
  return /^\s*(?:```|(?:import|export|const|let|var|function|class|return)\s)/i.test(statement)
    || /^https?:\/\/\S+$/i.test(statement);
}

export function extractWebSemanticUnits(
  text: string,
  maxUnits = MAX_PAGE_UNITS,
  sourceKey = '',
): { units: WebSemanticUnit[]; skippedBoilerplate: number } {
  const limit = Number.isFinite(maxUnits)
    ? Math.max(0, Math.min(MAX_PAGE_UNITS, Math.floor(maxUnits)))
    : MAX_PAGE_UNITS;
  if (!text.trim() || limit === 0) return { units: [], skippedBoilerplate: 0 };

  const units: WebSemanticUnit[] = [];
  let skippedBoilerplate = 0;
  for (const segment of sentenceSegments(text)) {
    const statement = segment.statement;
    if (statement.length < 15 || statement.length > 500 || isCodeLike(statement)) continue;
    if (/^(?:目次|参考文献|copyright|all rights reserved)\b/i.test(statement)) continue;
    // P440 1-A: ナビゲーション等のボイラープレート断片を除く。
    if (isBoilerplate(statement)) {
      skippedBoilerplate++;
      continue;
    }

    const polarity: WebSemanticPolarity =
      /ない|ません|ではない|でない|なく|禁止|不可|\bnot\b|\bnever\b|\bcannot\b|\bcan't\b|\bno\b/i.test(statement)
        ? 'NEGATIVE'
        : 'AFFIRMATIVE';

    const japaneseDefinition = statement.match(
      /^(.{1,80}?)(?:とは|というのは)[、,\s]*(.{2,220}?)(?:です|である|を指す|をいう|という意味です)?[。！？!?]*$/,
    );
    const englishDefinition = statement.match(
      /^(.{1,80}?)\s+(?:is defined as|means|refers to|is a|are|is)\s+(.{2,180})[.!?]*$/i,
    );
    const definition = japaneseDefinition || englishDefinition;

    const exceptionCue = /ただし|但し|例外|を除く|except|however|unless|not applicable when/i.test(statement);
    const conditionCue = /場合|のとき|の時|とき|条件|なら|\bif\b|\bwhen\b|\bunless\b|provided that/i.test(statement);
    const causeCue = /のため[、,]?|ために|なので|その結果|原因で|because|therefore|causes?|results? in|leads? to/i.test(statement);
    const prerequisiteCue = /必要|必須|前提|要求され|requires?|must\s+(?:be|have|use)|is\s+required|depends on/i.test(statement);
    const procedureCue = /^(?:まず|次に|その後|最後に|手順|ステップ|step\s*\d+\b|(?:\d+[.)、]\s*)?(?:install|run|configure|click|open|select|execute|create|set)\b)|(?:を実行|を設定|をインストール|をクリック|を読み込|を保存|を作成)/i.test(statement);

    const japaneseRelation = statement.match(
      /^(.{1,80}?)(?:は|が)(.{2,180}?)(?:です|である|だ|します|する|している|できる|含む|持つ|起きる|発生する|停止する)[。！？!?]*$/,
    );
    const englishRelation = statement.match(
      /^(.{1,80}?)\s+(requires?|supports|contains|includes|uses|provides|has|have|is|are|can|cannot)\s+(.{2,180})[.!?]*$/i,
    );
    const relationMatch = japaneseRelation || englishRelation;

    let kind: WebSemanticKnowledgeKind;
    let relation: WebSemanticRelation;
    let extractionRule: string;
    let extractionConfidence: number;

    if (exceptionCue) {
      kind = 'EXCEPTION';
      relation = 'EXCEPTION_TO';
      extractionRule = 'EXCEPTION_CUE';
      extractionConfidence = 0.60;
    } else if (conditionCue) {
      kind = 'CONDITION';
      relation = 'CONDITIONAL_ON';
      extractionRule = 'CONDITION_CUE';
      extractionConfidence = 0.62;
    } else if (causeCue) {
      kind = 'CAUSE';
      relation = 'CAUSE_OR_EXPLANATION';
      extractionRule = 'CAUSE_CUE';
      extractionConfidence = 0.58;
    } else if (prerequisiteCue) {
      kind = 'PREREQUISITE';
      relation = 'REQUIRES';
      extractionRule = 'PREREQUISITE_CUE';
      extractionConfidence = 0.62;
    } else if (procedureCue) {
      kind = 'PROCEDURE';
      relation = 'PROCEDURE_STEP';
      extractionRule = 'PROCEDURE_CUE';
      extractionConfidence = 0.60;
    } else if (definition) {
      kind = 'DEFINITION';
      relation = 'DEFINED_AS';
      extractionRule = japaneseDefinition ? 'JA_DEFINITION' : 'EN_DEFINITION';
      extractionConfidence = 0.72;
    } else if (relationMatch) {
      kind = 'RELATION';
      relation = 'ASSERTS';
      extractionRule = japaneseRelation ? 'JA_DECLARATIVE_RELATION' : 'EN_DECLARATIVE_RELATION';
      extractionConfidence = 0.64;
    } else {
      const learnedRule = webSemanticRuleLearningService.match(statement, polarity);
      if (learnedRule) {
        kind = learnedRule.kind;
        relation = learnedRule.relation;
        extractionRule = `LEARNED_CUE_${learnedRule.ruleId}`;
        extractionConfidence = learnedRule.confidence;
      } else if (
        /(?:です|ます|である|だ|する|している|できる|含む|持つ|発生する|停止する)[。！？!?]*$/.test(statement)
        || /\b(?:is|are|has|have|uses|supports|contains|includes|provides|works|fails|stores|returns)\b[^.!?]*[.!?]*$/i.test(statement)
      ) {
        kind = 'OBSERVATION';
        relation = 'OBSERVES';
        extractionRule = 'DECLARATIVE_SENTENCE';
        extractionConfidence = 0.48;
      } else {
        continue;
      }
    }

    const conditionValues = extractConditions(statement);
    const exceptionValues = extractExceptions(statement);
    const subject = definition
      ? stripTrailingPunctuation(definition[1])
      : relationMatch && kind !== 'CAUSE'
        ? stripTrailingPunctuation(relationMatch[1])
        : undefined;
    const object = definition
      ? stripTrailingPunctuation(definition[2])
      : relationMatch && kind !== 'CAUSE'
        ? stripTrailingPunctuation(relationMatch[3] ?? relationMatch[2])
        : undefined;
    const sequenceMarker = /^(まず|次に|その後|最後に|手順|ステップ|step\s*\d+|\d+[.)、])/i.exec(statement)?.[0];
    const sourceFragmentSha256 = canonicalSha256Object(normalizeText(statement));
    const unitBase = {
      kind,
      relation,
      statement,
      subject,
      object,
      conditions: conditionValues,
      exceptions: exceptionValues,
      polarity,
      sequenceMarker,
      scopeSignals: extractScopeSignals(statement),
      sourceStart: segment.sourceStart,
      sourceEnd: segment.sourceEnd,
      sourceFragmentSha256,
      extractionRule,
      extractionConfidence,
    };
    const unitId = `WEB-SEM-${canonicalSha256Object({
      sourceKey,
      sourceStart: segment.sourceStart,
      statementHash: sourceFragmentSha256,
      kind,
      relation,
    }).slice(0, 20)}`;

    units.push({ unitId, ...unitBase });
    if (units.length >= limit) break;
  }
  return { units, skippedBoilerplate };
}

export class WebContentUnderstandingService {
  learnPage(input: {
    text: string;
    url: string;
    evidenceId: string;
    sourceTitle?: string;
    maxUnits?: number;
    registerClaim: (statement: string) => string | undefined;
  }): WebSemanticLearningResult {
    const empty: WebSemanticLearningResult = {
      units: [],
      componentIds: [],
      componentClaims: [],
      graphNodeIds: [],
      skippedUnits: 0,
      graphFailures: 0,
    };
    if (!input.text.trim() || !input.url.trim() || !input.evidenceId.trim()) return empty;

    const { units, skippedBoilerplate } = extractWebSemanticUnits(input.text, input.maxUnits, input.url);
    const components: KnowledgeComponentArtifact[] = [];
    const componentClaims: WebSemanticComponentClaim[] = [];
    // P440 1-A: ボイラープレートで除いた件数も skippedUnits に数える。
    let skippedUnits = skippedBoilerplate;

    for (const unit of units) {
      const claimId = input.registerClaim(unit.statement);
      if (!claimId) {
        skippedUnits++;
        continue;
      }

      const body = {
        componentKind: 'KNOWLEDGE' as const,
        componentType: 'WEB_SEMANTIC_PROPOSITION',
        purpose: `Web semantic ${unit.kind}: ${unit.statement.slice(0, 160)}`,
        interfaceContract: {
          schemaVersion: 'WEB_SEMANTIC_PROPOSITION_V1',
          unit,
          provenance: {
            sourceTitle: input.sourceTitle ?? '',
            sourceUrl: input.url,
            evidenceId: input.evidenceId,
            sourceFragmentSha256: unit.sourceFragmentSha256,
            sourceStart: unit.sourceStart,
            sourceEnd: unit.sourceEnd,
          },
          gate: 'CORE_CLAIM_VERIFICATION_REQUIRED',
        },
        inputs: ['source sentence', 'research context'],
        outputs: ['structured proposition', 'conditions', 'exceptions', 'scope signals', 'source lineage'],
        prerequisites: ['Claim must pass CORE verification before knowledge promotion'],
        dependencies: ['WebResearch', 'ClaimVerifier', 'P211 semantic graph'],
        appliesWhen: [
          unit.kind,
          unit.relation,
          unit.subject ?? '',
          ...unit.conditions,
          ...unit.scopeSignals,
        ].filter(Boolean),
        doesNotApplyWhen: [
          ...unit.exceptions,
          ...(unit.polarity === 'NEGATIVE' ? ['Do not reinterpret as an affirmative claim'] : []),
          'Claim has not passed CORE verification',
        ],
        sourceEpisodeIds: [],
        sourceLearningArtifactIds: [],
        environmentFingerprint: 'unknown',
        lifecycleStatus: 'CANDIDATE' as const,
        usageCount: 0,
        successCount: 0,
        failureCount: 0,
        claimIds: [claimId],
        evidenceRefs: [input.evidenceId],
        sourceUrls: [input.url],
        sourceArtifactIds: [input.evidenceId],
        verificationStatus: 'UNVERIFIED' as const,
        contradictionRefs: [],
        freshnessPolicy: 'REVALIDATE_ON_ENVIRONMENT_CHANGE',
      };

      const canonicalSha256 = canonicalSha256Object(body);
      const component: KnowledgeComponentArtifact = {
        ...body,
        componentId: `RC-KNOWLEDGE-WEB-SEMANTIC-${canonicalSha256.slice(0, 18)}`,
        canonicalSha256,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      components.push(component);
      componentClaims.push({ componentId: component.componentId, claimId, unitId: unit.unitId });
    }

    if (components.length > 0) {
      reusableComponentFactoryService.storeCandidates(components);
    }

    const graphNodeIds: string[] = [];
    let graphFailures = 0;
    for (const component of components) {
      const contract = component.interfaceContract;
      const unit = contract.unit as WebSemanticUnit;
      const claimId = component.claimIds[0];
      try {
        const receipt = researchGraphConnectorP211Service.connect({
          eventKind: 'SEMANTIC_CANDIDATE',
          subjectId: component.componentId,
          payload: {
            schemaVersion: 'WEB_SEMANTIC_GRAPH_CANDIDATE_P303',
            componentId: component.componentId,
            claimId,
            verificationStatus: 'UNVERIFIED',
            lifecycleStatus: 'CANDIDATE',
            unit,
            sourceUrl: input.url,
            evidenceId: input.evidenceId,
            sourceTitle: input.sourceTitle ?? '',
          },
          confidence: unit.extractionConfidence,
          uncertainty: 1 - unit.extractionConfidence,
          sourceRefs: [
            input.evidenceId,
            input.url,
            unit.sourceFragmentSha256,
            `claim:${claimId}`,
          ],
          requiresVerification: true,
        });
        graphNodeIds.push(...receipt.createdNodeIds);
      } catch {
        // Candidate knowledge remains stored with provenance; failed graph
        // connection must not be reported as a successful graph insertion.
        graphFailures++;
      }
    }

    return {
      units,
      componentIds: components.map(item => item.componentId),
      componentClaims,
      graphNodeIds: [...new Set(graphNodeIds)],
      skippedUnits,
      graphFailures,
    };
  }
}

export const webContentUnderstandingService = new WebContentUnderstandingService();
