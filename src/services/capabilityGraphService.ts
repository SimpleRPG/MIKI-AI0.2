import { ComponentTxtPackage } from '../types';
import { componentRegistryService } from './componentRegistryService';
import { systemLogger } from './systemLogger';
import { capabilityLearningService } from './capabilityLearningService';
import { failureMemoryService } from './failureMemoryService';
import { executionRouteRankingService } from './executionRouteRankingService';
import { verifiedKnowledgePromotionService } from './verifiedKnowledgePromotionService';
import { verifiedCapabilityPromotionService } from './verifiedCapabilityPromotionService';
import { capabilityConfidenceService } from './capabilityConfidenceService';

export interface CapabilityNode {
  component_id: string;
  purpose: string;
  entry_point: string;
  status: string;
  tags: string[];
}

export interface CapabilityEdge {
  from_component_id: string;
  to_component_id: string;
  matched_types: string[];
  reason: string;
}

export interface ComponentPlan {
  plan_id: string;
  goal: string;
  component_ids: string[];
  score: number;
  verified: boolean;
  composable: boolean;
  reasons: string[];
}

/**
 * 非LLM中心設計の能力グラフ。
 * 部品を「意味が近い」だけでなく、I/O型・依存関係・検証状態から合成候補として扱う。
 */
export class CapabilityGraphService {
  private static instance: CapabilityGraphService;
  private constructor() {}

  public static getInstance(): CapabilityGraphService {
    if (!this.instance) this.instance = new CapabilityGraphService();
    return this.instance;
  }

  public buildNodes(verifiedOnly = true): CapabilityNode[] {
    return componentRegistryService.getAllComponents()
      .filter(c => !verifiedOnly || c.status === 'VERIFIED')
      .map(c => ({
        component_id: c.component_id,
        purpose: c.purpose,
        entry_point: c.entry_point,
        status: c.status,
        tags: this.tags(c),
      }));
  }

  public buildEdges(verifiedOnly = true): CapabilityEdge[] {
    const components = componentRegistryService.getAllComponents()
      .filter(c => !verifiedOnly || c.status === 'VERIFIED');
    const edges: CapabilityEdge[] = [];
    for (const from of components) {
      for (const to of components) {
        if (from.component_id === to.component_id) continue;
        const matched = this.matchOutputsToInputs(from, to);
        if (matched.length > 0) {
          edges.push({
            from_component_id: from.component_id,
            to_component_id: to.component_id,
            matched_types: matched,
            reason: `出力→入力の型一致: ${matched.join(', ')}`,
          });
        }
      }
    }
    return edges;
  }

  /**
   * COMPONENT_ID → ENTRY_POINT → tags/purpose → I/O → composability の順で候補を評価。
   * スコア計算は決定論的で、LLM呼び出しを必要としない。
   */
  public plan(goal: string, maxComponents = 4, excludedComponentIds: string[] = [], environment?: string): ComponentPlan | undefined {
    const query = goal.trim().toLowerCase();
    if (!query) return undefined;
    const excluded = new Set(excludedComponentIds);
    const all = componentRegistryService.getAllComponents().filter(c => c.status === 'VERIFIED' && !excluded.has(c.component_id) && this.supportsEnvironment(c, environment));
    if (!all.length) return undefined;

    const learned = capabilityLearningService.findPreferredComponentSets(goal, environment);
    const learnedBoost = new Map<string, number>();
    for (const set of learned) for (const id of set.component_ids) {
      learnedBoost.set(id, Math.max(learnedBoost.get(id) || 0, set.score));
    }
    const routeScores = environment ? new Map(executionRouteRankingService.rank(all.map(c => c.component_id), environment).map(x => [x.component_id, x])) : new Map();
    const knowledgeBoosts = verifiedKnowledgePromotionService.rankCapabilityKnowledge(all.map(c => c.component_id), goal);
    const verifiedCapabilityBoosts = verifiedCapabilityPromotionService.rank(all.map(c => c.component_id), goal);
    const confidenceMap = capabilityConfidenceService.rank(all.map(c => c.component_id), environment);
    const scored = all.map(c => {
      const risk = environment ? failureMemoryService.assessRisk(c.component_id, environment, c.implementation_hash).risk_score : 0;
      const route = routeScores.get(c.component_id);
      const routeBoost = route ? route.score * 0.8 : 0;
      const knowledgeBoost = (knowledgeBoosts.get(c.component_id) || 0) + (verifiedCapabilityBoosts.get(c.component_id) || 0);
      const confidence = confidenceMap.get(c.component_id);
      const confidenceBoost = confidence?.revalidationRequired ? 0 : Math.max(0, ((confidence?.confidence || 50) - 50) * 0.8);
      return { component: c, risk, score: this.score(c, query) + (learnedBoost.get(c.component_id) || 0) + routeBoost + knowledgeBoost + confidenceBoost - risk * 1.2, confidence };
    })
      .filter(x => x.score > 0 && x.risk < 80)
      .sort((a, b) => b.score - a.score || a.component.component_id.localeCompare(b.component.component_id));
    if (!scored.length) return undefined;

    const selected: ComponentTxtPackage[] = [];
    const reasons: string[] = [];
    for (const item of scored) {
      if (selected.length >= maxComponents) break;
      if (!selected.length) {
        selected.push(item.component);
        const learned = learnedBoost.has(item.component.component_id);
        const route = environment ? executionRouteRankingService.score(item.component.component_id, environment) : undefined;
        reasons.push(`${item.component.component_id}: 目的/ID/入口/タグ一致 score=${item.score.toFixed(1)} risk=${item.risk}${learned ? ' + 学習済み実績優先' : ''}${knowledgeBoosts.has(item.component.component_id) ? ' + 検証済み知識ブースト' : ''}${item.confidence?.revalidationRequired ? ' + 再検証要求(信頼度ブースト停止)' : ` + 信頼度(${item.confidence?.confidence ?? 0})`}${route ? ` + 経路評価(${route.reason})` : ''}`);
        continue;
      }
      const composable = selected.some(prev => this.matchOutputsToInputs(prev, item.component).length > 0);
      const sameDomain = this.domainOverlap(selected, item.component);
      if (composable || sameDomain) {
        selected.push(item.component);
        const route = environment ? executionRouteRankingService.score(item.component.component_id, environment) : undefined;
        reasons.push(`${item.component.component_id}: ${composable ? 'I/O合成可能' : '同一目的領域'} risk=${item.risk}${learnedBoost.has(item.component.component_id) ? ' + 学習済み実績優先' : ''}${knowledgeBoosts.has(item.component.component_id) ? ' + 検証済み知識ブースト' : ''}${item.confidence?.revalidationRequired ? ' + 再検証要求(信頼度ブースト停止)' : ` + 信頼度(${item.confidence?.confidence ?? 0})`}${route ? ` + 経路評価(${route.reason})` : ''}`);
      }
    }

    // 依存関係の明示も満たす必要がある。未解決依存は計画から除外。
    const dependencySet = new Set(selected.flatMap(c => c.dependencies || []));
    const ids = new Set(selected.map(c => c.component_id));
    const missing = [...dependencySet].filter(dep => !ids.has(dep) && !all.some(c => c.component_id === dep));
    if (missing.length) return undefined;

    const total = selected.reduce((sum, c) => sum + this.score(c, query), 0);
    const planId = `CAP-${this.hash(`${query}|${selected.map(c => c.component_id).join('|')}`)}`;
    const result: ComponentPlan = {
      plan_id: planId,
      goal,
      component_ids: selected.map(c => c.component_id),
      score: total,
      verified: selected.every(c => c.status === 'VERIFIED'),
      environment,
      composable: selected.length <= 1 || selected.every((c, i) => i === 0 || selected.slice(0, i).some(p => this.matchOutputsToInputs(p, c).length > 0) || this.domainOverlap(selected.slice(0, i), c)),
      reasons,
    };
    systemLogger.info('TOOLS', `🧩 [CapabilityGraph] ${planId}: ${result.component_ids.join(' → ')}`);
    return result;
  }


  private supportsEnvironment(c: ComponentTxtPackage, environment?: string): boolean {
    if (!environment) return true;
    const declared = (c.supported_environments || []).map(v => String(v).trim().toLowerCase()).filter(Boolean);
    if (!declared.length) return true;

    // supported_environments is intentionally human-readable (e.g. "Excel 365",
    // "Windows", "Galaxy S25 / Android").  Do not compare it literally to
    // the execution enum; normalize both into capability families first.
    const requested = String(environment).trim().toLowerCase();
    const matches = (patterns: RegExp[]) => declared.some(value => patterns.some(pattern => pattern.test(value)));

    switch (requested) {
      case 'android':
        return matches([/\bandroid\b/, /galaxy/]);
      case 'termux':
        // Historical compatibility only. Termux is not a production target.
        return matches([/\btermux\b/, /\bandroid\b/]);
      case 'excel_windows':
        return matches([/\bwindows\b/, /excel/]) && !matches([/\bmac(?:os)?\b/]) || matches([/excel[^a-z]*(?:2016|365|windows)/]);
      case 'excel_mac':
        return matches([/\bmac(?:os)?\b/]) && matches([/excel/]);
      case 'external_runner':
        return matches([/external/, /runner/, /http/]);
      default:
        return declared.includes(requested);
    }
  }

  private score(c: ComponentTxtPackage, q: string): number {
    const id = c.component_id.toLowerCase();
    const entry = c.entry_point.toLowerCase();
    const purpose = c.purpose.toLowerCase();
    let score = 0;
    if (id === q) score += 1000;
    if (entry === q) score += 800;
    for (const token of this.tokens(q)) {
      if (id.includes(token)) score += 120;
      if (entry.includes(token)) score += 100;
      if (purpose.includes(token)) score += 50;
      if (this.tags(c).includes(token)) score += 80;
    }
    return score;
  }

  private tags(c: ComponentTxtPackage): string[] {
    return this.tokens(`${c.component_id} ${c.purpose} ${c.entry_point}`);
  }

  private tokens(text: string): string[] {
    return text.toLowerCase().split(/[^a-z0-9_\u3040-\u30ff\u3400-\u9fff]+/).filter(t => t.length >= 2).slice(0, 40);
  }

  private matchOutputsToInputs(from: ComponentTxtPackage, to: ComponentTxtPackage): string[] {
    const out = new Set((from.outputs || []).map(x => x.type.toLowerCase()));
    return (to.inputs || []).map(x => x.type.toLowerCase()).filter(t => out.has(t));
  }

  private domainOverlap(list: ComponentTxtPackage[], c: ComponentTxtPackage): boolean {
    const target = new Set(this.tags(c));
    return list.some(x => this.tags(x).some(t => target.has(t)));
  }

  private hash(raw: string): string {
    let h = 2166136261;
    for (let i = 0; i < raw.length; i++) { h ^= raw.charCodeAt(i); h = Math.imul(h, 16777619); }
    return (h >>> 0).toString(16).padStart(8, '0');
  }
}

export const capabilityGraphService = CapabilityGraphService.getInstance();
