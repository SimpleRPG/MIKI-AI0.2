/**
 * 学習・改善 相互連携化 作業指示書 v1 (優先度B - 2.1):
 * 共通ID (experienceId) による横断的な紐付け・追跡基盤 (ExperienceLinkService)
 *
 * 既存の各サービス（trainingSamples, capabilityGaps, heuristicRules, responseSkeletons, selfCodeProposals等）
 * を1つの巨大クラスに統合することなく、共通の experienceId を通じて
 * 「どの経験・失敗から何を学び、どのコードが変わり、何の証拠で成功と判断したか」を
 * 串刺しで横断検索・追跡できるようにする。
 */

import { ExperienceLink } from '../types';
import { storageService } from './storageService';
import { systemLogger } from './systemLogger';

const EXPERIENCE_LINKS_KEY = 'miki_experience_links_v1';

export class ExperienceLinkService {
  private links: Map<string, ExperienceLink> = new Map();
  private isLoaded = false;

  constructor() {
    this.load();
  }

  private load(): void {
    if (this.isLoaded) return;
    try {
      const raw = storageService.getItem(EXPERIENCE_LINKS_KEY);
      if (raw) {
        const arr: ExperienceLink[] = JSON.parse(raw);
        if (Array.isArray(arr)) {
          this.links = new Map(arr.map((l) => [l.experienceId, l]));
        }
      }
      this.isLoaded = true;
    } catch (e) {
      systemLogger.warn('SELF_IMPROVEMENT', 'ExperienceLinkService load failed, using empty store', e);
      this.links = new Map();
      this.isLoaded = true;
    }
  }

  private save(): void {
    try {
      const arr = Array.from(this.links.values()).slice(0, 500);
      storageService.setItem(EXPERIENCE_LINKS_KEY, JSON.stringify(arr));
    } catch (e) {
      systemLogger.error('SELF_IMPROVEMENT', 'ExperienceLinkService save failed', e);
    }
  }

  public generateExperienceId(prefix: string = 'exp'): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  }

  public getOrCreateLink(
    experienceId: string,
    source: ExperienceLink['source'] = 'conversation',
    description?: string
  ): ExperienceLink {
    this.load();
    let link = this.links.get(experienceId);
    if (!link) {
      link = {
        experienceId,
        timestamp: Date.now(),
        source,
        description,
        evidenceIds: [],
        relatedTrainingSampleIds: [],
        relatedCapabilityGapIds: [],
        relatedHeuristicRuleIds: [],
        relatedSelfCodeProposalIds: [],
        relatedRegressionResultIds: [],
        relatedResponseSkeletonIds: [],
        relatedReflectionIds: [],
      };
      this.links.set(experienceId, link);
      this.save();
    }
    return link;
  }

  public createExperienceLink(params: {
    experienceId: string;
    source?: ExperienceLink['source'];
    description?: string;
    initialEvidence?: string[];
    failureLogId?: string;
    reflectionId?: string;
    ruleId?: string;
    sampleId?: string;
    gapId?: string;
  }): ExperienceLink {
    const link: ExperienceLink = {
      experienceId: params.experienceId,
      timestamp: Date.now(),
      source: params.source || 'conversation',
      evidenceIds: params.initialEvidence,
      failureLogId: params.failureLogId,
      relatedReflectionIds: params.reflectionId ? [params.reflectionId] : [],
      relatedHeuristicRuleIds: params.ruleId ? [params.ruleId] : [],
      relatedTrainingSampleIds: params.sampleId ? [params.sampleId] : [],
      relatedCapabilityGapIds: params.gapId ? [params.gapId] : [],
    };
    this.registerLink(link);
    return link;
  }

  public registerLink(link: ExperienceLink): void {
    this.load();
    const existing = this.links.get(link.experienceId);
    if (existing) {
      this.links.set(link.experienceId, {
        ...existing,
        ...link,
        relatedTrainingSampleIds: Array.from(
          new Set([...(existing.relatedTrainingSampleIds || []), ...(link.relatedTrainingSampleIds || [])])
        ),
        relatedCapabilityGapIds: Array.from(
          new Set([...(existing.relatedCapabilityGapIds || []), ...(link.relatedCapabilityGapIds || [])])
        ),
        relatedHeuristicRuleIds: Array.from(
          new Set([...(existing.relatedHeuristicRuleIds || []), ...(link.relatedHeuristicRuleIds || [])])
        ),
        relatedSelfCodeProposalIds: Array.from(
          new Set([...(existing.relatedSelfCodeProposalIds || []), ...(link.relatedSelfCodeProposalIds || [])])
        ),
        relatedRegressionResultIds: Array.from(
          new Set([...(existing.relatedRegressionResultIds || []), ...(link.relatedRegressionResultIds || [])])
        ),
        relatedResponseSkeletonIds: Array.from(
          new Set([...(existing.relatedResponseSkeletonIds || []), ...(link.relatedResponseSkeletonIds || [])])
        ),
        relatedReflectionIds: Array.from(
          new Set([...(existing.relatedReflectionIds || []), ...(link.relatedReflectionIds || [])])
        ),
      });
    } else {
      this.links.set(link.experienceId, link);
    }
    this.save();
  }

  public linkEntity(
    experienceId: string,
    type:
      | 'trainingSample'
      | 'candidate'
      | 'evidence'
      | 'failureLog'
      | 'capabilityGap'
      | 'heuristicRule'
      | 'selfCodeProposal'
      | 'regressionResult'
      | 'responseSkeleton'
      | 'reflection',
    entityId: string
  ): void {
    if (!experienceId || !entityId) return;
    this.load();
    let link = this.links.get(experienceId);
    if (!link) {
      link = {
        experienceId,
        timestamp: Date.now(),
        source: 'conversation',
      };
      this.links.set(experienceId, link);
    }

    switch (type) {
      case 'trainingSample':
      case 'candidate':
        link.relatedTrainingSampleIds = Array.from(new Set([...(link.relatedTrainingSampleIds || []), entityId]));
        break;
      case 'evidence':
        link.evidenceIds = Array.from(new Set([...(link.evidenceIds || []), entityId]));
        break;
      case 'failureLog':
        link.failureLogId = entityId;
        break;
      case 'capabilityGap':
        link.relatedCapabilityGapIds = Array.from(new Set([...(link.relatedCapabilityGapIds || []), entityId]));
        break;
      case 'heuristicRule':
        link.relatedHeuristicRuleIds = Array.from(new Set([...(link.relatedHeuristicRuleIds || []), entityId]));
        break;
      case 'selfCodeProposal':
        link.relatedSelfCodeProposalIds = Array.from(new Set([...(link.relatedSelfCodeProposalIds || []), entityId]));
        break;
      case 'regressionResult':
        link.relatedRegressionResultIds = Array.from(new Set([...(link.relatedRegressionResultIds || []), entityId]));
        break;
      case 'responseSkeleton':
        link.relatedResponseSkeletonIds = Array.from(new Set([...(link.relatedResponseSkeletonIds || []), entityId]));
        break;
      case 'reflection':
        link.relatedReflectionIds = Array.from(new Set([...(link.relatedReflectionIds || []), entityId]));
        break;
    }
    this.save();
  }

  public getLink(experienceId: string): ExperienceLink | undefined {
    this.load();
    return this.links.get(experienceId);
  }

  public getAllLinks(): ExperienceLink[] {
    this.load();
    return Array.from(this.links.values()).sort((a, b) => b.timestamp - a.timestamp);
  }
}

export const experienceLinkService = new ExperienceLinkService();
