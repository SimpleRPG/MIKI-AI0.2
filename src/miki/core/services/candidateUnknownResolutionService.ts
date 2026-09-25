import { storageService } from '../../../services/storageService';
import { canonicalSha256 } from './canonicalSha256Service';
import { reusableComponentFactoryService } from './reusableComponentFactoryService';
import { researchQueryPlanningService } from '../../research/services/researchQueryPlanningService';
import { unifiedWebResearchService } from '../../research/services/unifiedWebResearchService';
import {
  WebImplementationMaterial,
  WebMaterialPatternExtractor,
} from '../../research/services/webMaterialPatternExtractor';
import { unifiedUnknownResolutionCoordinatorService } from '../../unknown/services/unifiedUnknownResolutionCoordinatorService';

export type CandidateUnknownKind =
  | 'MISSING_KNOWLEDGE'
  | 'MISSING_REPOSITORY_CONTEXT'
  | 'MISSING_IMPLEMENTATION_PATTERN'
  | 'MISSING_TEST_ORACLE';

export type CandidateUnknownStatus =
  | 'RESOLVED'
  | 'PARTIAL'
  | 'EXTERNAL_QUESTION_REQUIRED';

export interface CandidateUnknownInput {
  runId: string;
  taskId: string;
  objective: string;
  environmentFingerprint: string;
  targetPaths: string[];
  sourcePaths: string[];
  requirements: string[];
  validationRequirements: string[];
}

export interface CandidateUnknownItem {
  unknownId: string;
  kind: CandidateUnknownKind;
  question: string;
  status: CandidateUnknownStatus;
  queryPlanId: string;
  queryPlanSha256: string;
  effectiveText: string;
  evidenceCount: number;
  verificationStatus: 'VERIFIED' | 'UNVERIFIED';
  componentDecision: 'REUSE' | 'ADAPT' | 'CREATE' | 'DEFER';
  componentPackId?: string;
  candidateNote: string;
  externalQuestion?: string;
  implementationMaterialIds?: string[];
}

export interface CandidateUnknownContext {
  contextId: string;
  runId: string;
  items: CandidateUnknownItem[];
  candidateNotes: string[];
  externalQuestions: string[];
  implementationMaterials: WebImplementationMaterial[];
  contextSha256: string;
  createdAt: number;
}

const KEY = 'miki_candidate_unknown_context_v2';

class CandidateUnknownResolutionService {
  async resolve(input: CandidateUnknownInput): Promise<CandidateUnknownContext> {
    const questions = this.detect(input);
    const items: CandidateUnknownItem[] = [];
    const implementationMaterials: WebImplementationMaterial[] = [];

    for (const entry of questions) {
      const plan = researchQueryPlanningService.buildPlan(entry.question);

      const resolution =
        await unifiedUnknownResolutionCoordinatorService.resolveForChat({
          question: entry.question,
          useSearch: true,
          unknownTerms: [entry.question],
          hasAttachments: input.sourcePaths.length > 0,
        });

      let collectedMaterials: WebImplementationMaterial[] = [];

      /*
       * MIKI自身による実装材料収集。
       *
       * Coordinatorは未知解決の入口として利用する。
       * 実装方式が不足している場合は、既存のResearch基盤を直接再利用し、
       * SearXNG / Wikipedia / DuckDuckGo の検索結果を取得した後、
       * 既存のRendered Page読取経路で本文まで取得する。
       */
      if (entry.kind === 'MISSING_IMPLEMENTATION_PATTERN') {
        try {
          const search = await unifiedWebResearchService.executeSearch(
            entry.question,
            { maxResults: 4, preferredProvider: 'auto' },
          );

          if (search.results.length > 0) {
            const pages =
              await unifiedWebResearchService.readSearchResultPages(
                entry.question,
                search.results,
                { maxPages: 3 },
              );

            for (const page of pages) {
              if (!page.success || !page.text.trim()) continue;

              const materials =
                WebMaterialPatternExtractor.extractImplementationMaterialsFromWebText({
                  text: page.text,
                  sourceQuery: entry.question,
                  sourceUrl: page.url,
                  provider: search.provider,
                  fetchMethod: 'headless_webview',
                });

              collectedMaterials.push(...materials);
            }
          }
        } catch {
          // Research失敗はUNKNOWNのまま保持し、コードを推測して埋めない。
        }
      }

      implementationMaterials.push(...collectedMaterials);

      const verified =
        resolution.status === 'REUSED_SUPPORTED' ||
        resolution.status === 'LOCAL_EVIDENCE';

      const componentPack =
        reusableComponentFactoryService.plan({
          taskId: input.taskId,
          purpose: entry.question,
          environmentFingerprint: input.environmentFingerprint,
          requiredKinds:
            entry.kind === 'MISSING_IMPLEMENTATION_PATTERN'
              ? ['CODE']
              : ['KNOWLEDGE', 'CODE'],
        });

      const hasReusable =
        componentPack.usedKnowledgeComponentIds.length +
        componentPack.usedCodeComponentIds.length > 0;

      const hasImplementationMaterial =
        collectedMaterials.some(material => material.codeExamples.length > 0);

      const componentDecision = hasReusable
        ? 'REUSE'
        : entry.kind === 'MISSING_IMPLEMENTATION_PATTERN' &&
            hasImplementationMaterial
          ? 'CREATE'
          : entry.kind === 'MISSING_IMPLEMENTATION_PATTERN'
            ? 'DEFER'
            : entry.kind === 'MISSING_REPOSITORY_CONTEXT'
              ? 'DEFER'
              : 'ADAPT';

      const status: CandidateUnknownStatus =
        verified
          ? 'RESOLVED'
          : resolution.evidenceCount > 0 || collectedMaterials.length > 0
            ? 'PARTIAL'
            : 'EXTERNAL_QUESTION_REQUIRED';

      const unknownId = `CUNK-${canonicalSha256({
        runId: input.runId,
        kind: entry.kind,
        question: entry.question,
      }).slice(0, 20)}`;

      items.push({
        unknownId,
        kind: entry.kind,
        question: entry.question,
        status,
        queryPlanId: plan.queryPlanId,
        queryPlanSha256: plan.planSha256,
        effectiveText: resolution.effectiveText,
        evidenceCount:
          resolution.evidenceCount + collectedMaterials.length,
        verificationStatus: verified ? 'VERIFIED' : 'UNVERIFIED',
        componentDecision,
        componentPackId: componentPack.componentPackId,
        candidateNote:
          collectedMaterials.length > 0
            ? `MIKI autonomously collected ${collectedMaterials.length} implementation material set(s): ${entry.question}`
            : status === 'RESOLVED'
              ? `Resolved ${entry.kind}: ${entry.question}`
              : `Unverified ${entry.kind}: ${entry.question}`,
        externalQuestion:
          status === 'EXTERNAL_QUESTION_REQUIRED'
            ? `External reviewer question [${entry.kind}]: ${entry.question}`
            : undefined,
        implementationMaterialIds: collectedMaterials.map(
          material => material.materialId,
        ),
      });
    }

    const body = {
      runId: input.runId,
      items,
      candidateNotes: items
        .filter(item => item.status !== 'RESOLVED')
        .map(item => item.candidateNote),
      externalQuestions: items
        .map(item => item.externalQuestion)
        .filter((value): value is string => Boolean(value)),
      implementationMaterials,
      createdAt: Date.now(),
    };

    const contextSha256 = canonicalSha256(body);
    const context: CandidateUnknownContext = {
      contextId: `CUC-${contextSha256.slice(0, 20)}`,
      ...body,
      contextSha256,
    };

    this.save(context);
    return context;
  }

  get(runId: string): CandidateUnknownContext | undefined {
    return this.list()
      .filter(item => item.runId === runId)
      .sort((a, b) => b.createdAt - a.createdAt)[0];
  }

  list(): CandidateUnknownContext[] {
    try {
      const raw = storageService.getItem(KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  private detect(
    input: CandidateUnknownInput,
  ): Array<{ kind: CandidateUnknownKind; question: string }> {
    const rows: Array<{
      kind: CandidateUnknownKind;
      question: string;
    }> = [];

    if (input.sourcePaths.length < input.targetPaths.length) {
      rows.push({
        kind: 'MISSING_REPOSITORY_CONTEXT',
        question: `Repository context is incomplete for targets: ${input.targetPaths
          .filter(path => !input.sourcePaths.includes(path))
          .join(', ')}`,
      });
    }

    if (
      input.requirements.some(value =>
        /unknown|未確認|不明/i.test(value),
      )
    ) {
      rows.push({
        kind: 'MISSING_KNOWLEDGE',
        question: `Resolve requirement knowledge for ${input.objective}: ${input.requirements.join(' / ')}`,
      });
    }

    if (input.validationRequirements.length === 0) {
      rows.push({
        kind: 'MISSING_TEST_ORACLE',
        question: `Define test oracle and expected validation for ${input.objective}`,
      });
    }

    if (
      input.requirements.some(value =>
        /component|pattern|実装|部品/i.test(value),
      )
    ) {
      rows.push({
        kind: 'MISSING_IMPLEMENTATION_PATTERN',
        question: `Select reusable, adaptable, or new implementation component for ${input.objective}`,
      });
    }

    return rows;
  }

  private save(value: CandidateUnknownContext): void {
    const values = this.list().filter(
      item => item.contextId !== value.contextId,
    );

    values.push(value);
    storageService.setItem(
      KEY,
      JSON.stringify(values.slice(-500)),
    );
  }
}

export const candidateUnknownResolutionService =
  new CandidateUnknownResolutionService();
