import { systemLogger } from './systemLogger';

export interface ModelDecommissionMetrics {
  avgTps: number;
  timeToFirstTokenMs: number;
  ramUsageMb: number;
  lastUsedAt: number;
  usageCountLast14Days: number;
  regressionScore: number;
  thermalImpact: 'low' | 'medium' | 'high';
  hasBetterAlternative: boolean;
  alternativeModelId?: string;
}

export interface ModelDecommissionEvaluation {
  modelId: string;
  modelName: string;
  isProtected: boolean;
  protectedReason?: string;
  metrics: ModelDecommissionMetrics;
  recommendation: 'KEEP_PROTECTED' | 'RETAIN_ACTIVE' | 'ARCHIVE_COLD' | 'RECOMMEND_DELETION' | 'AUTO_EVICTED';
  evaluationReason: string;
  evaluatedAt: number;
}

/**
 * 旧生成モデルのライフサイクル管理は完全退役。
 * 残存モデルを保持・推奨・自動削除することはせず、空集合を真実として返す。
 */
class ModelLifecycleService {
  public evaluateModelsForDecommission(): ModelDecommissionEvaluation[] {
    return [];
  }

  public runDeepSleepModelReasoning() {
    const thought = '[モデル退役] ローカル生成モデルの実行・保持・自動取得経路は退役済みです。Non-LLM Coreのみを維持します。';
    systemLogger.info('SELF_IMPROVEMENT', thought);
    return { evaluatedCount: 0, protectedCount: 0, deletionCandidates: [], autonomousThought: thought };
  }

  public async evictModel(modelId: string, modelName?: string): Promise<{ success: boolean; message: string }> {
    const message = `モデル「${modelName || modelId}」の管理要求は受理しません。ローカル生成モデルのライフサイクル機能は退役済みです。`;
    systemLogger.info('SELF_IMPROVEMENT', message);
    return { success: false, message };
  }
}

export const modelLifecycleService = new ModelLifecycleService();
