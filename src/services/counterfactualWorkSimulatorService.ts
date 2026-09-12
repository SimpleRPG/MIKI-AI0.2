import { storageService } from './storageService';
import { systemLogger } from './systemLogger';

export type CounterfactualTrigger = 'FAILURE' | 'HIGH_COST' | 'IMPORTANT';
export interface WorkRoute { id: string; label: string; steps: string[]; estimatedCost: number; risk: number; evidenceIds?: string[]; }
export interface CounterfactualWorkSimulation {
  id: string; taskId: string; trigger: CounterfactualTrigger; selectedRoute: WorkRoute; alternatives: WorkRoute[];
  compared: Array<{ routeId: string; costDelta: number; riskDelta: number; expectedImprovement: number; confidence: number }>;
  status: 'VIRTUAL_ONLY' | 'UNCONFIRMED'; createdAt: number;
}
const KEY = 'miki_counterfactual_work_v1';
export class CounterfactualWorkSimulatorService {
  private history: CounterfactualWorkSimulation[] = [];
  constructor() { try { const r=storageService.getItem(KEY); const p=r?JSON.parse(r):[]; if(Array.isArray(p)) this.history=p; } catch {} }
  private save(){ storageService.setItem(KEY, JSON.stringify(this.history.slice(-200))); }
  public shouldSimulate(trigger: CounterfactualTrigger): boolean { return trigger === 'FAILURE' || trigger === 'HIGH_COST' || trigger === 'IMPORTANT'; }
  public simulate(taskId: string, selectedRoute: WorkRoute, alternatives: WorkRoute[], trigger: CounterfactualTrigger): CounterfactualWorkSimulation | null {
    if (!this.shouldSimulate(trigger) || alternatives.length === 0) return null;
    const compared = alternatives.map(route => ({
      routeId: route.id,
      costDelta: selectedRoute.estimatedCost - route.estimatedCost,
      riskDelta: selectedRoute.risk - route.risk,
      expectedImprovement: Math.max(-1, Math.min(1, (selectedRoute.risk-route.risk)*0.6 + (selectedRoute.estimatedCost-route.estimatedCost)*0.01)),
      confidence: route.evidenceIds?.length ? Math.min(0.9, 0.5 + route.evidenceIds.length*0.05) : 0.25,
    }));
    const record: CounterfactualWorkSimulation = { id:`CWS-${Date.now().toString(36)}`, taskId, trigger, selectedRoute, alternatives, compared, status:'VIRTUAL_ONLY', createdAt:Date.now() };
    this.history.unshift(record); this.save();
    systemLogger.info('SELF_IMPROVEMENT', `[第63章] 反実仮想作業比較: ${taskId} / 候補=${alternatives.length} / 仮想評価のみ`);
    return record;
  }
  public getHistory(taskId?: string): CounterfactualWorkSimulation[] { return this.history.filter(x=>!taskId || x.taskId===taskId); }
}
export const counterfactualWorkSimulatorService = new CounterfactualWorkSimulatorService();
