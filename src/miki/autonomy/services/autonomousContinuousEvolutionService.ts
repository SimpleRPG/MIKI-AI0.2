/**
 * 設計思想 第29章, 第30章, 第53章, 第80章, 第123-128章, 第170章:
 * みき自律自動巡回・自己コード改善エンジン (Autonomous Continuous Self-Evolution & Auto-Pilot Engine)
 *
 * 【目的】
 * 1. みきが人間の手を介さず、自律的にコードベースを監査・仕様ドリフト検知・コード合成・AST構文検査・TDDテスト検証・不変条件チェック・安全配備・自己修復を一貫して全自動で実行する。
 * 2. バックグラウンド自動巡回モード（Auto-Pilot）とワンクリック即時実行（One-Click Autonomous Cycle）をサポート。
 * 3. 構文エラーやテスト失敗発生時は、エラー診断ログをもとに最大3回の自律修復反復（Iterative Self-Healing Loop）を実行。
 * 4. 変更前スナップショットの自動作成により、いつでもワンクリックで元に戻せる100%安全な自己進化を保証。
 */


async function calculateArtifactSha256(source: string): Promise<string> {
  const normalized = source.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const data = new TextEncoder().encode(normalized);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest)).map((value) => value.toString(16).padStart(2, '0')).join('');
}
import { systemLogger } from '../../../services/systemLogger';
import { selfImprovementRequestEventService } from '../../improvement/services/selfImprovementRequestEventService';
import { mikiSelfCodingSuperchargerService, MutationTestResult } from '../../selfDevelopment/services/mikiSelfCodingSuperchargerService';
import { AutonomousVerificationData } from '../../../types';
import { ChangeSetID, SelfImprovementFailureCategory, CausalExperimentResult, CounterexampleGateResult, GeneralizationGateResult, AdoptionState, DeploymentLifecycleState, NoChangeDecision } from '../../../types/evidenceSelfImprovementTypes';
export interface AutonomousEvolutionStepEvent {
  phase:
    | 'AUDIT'
    | 'PROPOSAL'
    | 'SYNTHESIS'
    | 'SYNTAX_CHECK'
    | 'TDD_TEST'
    | 'COUNTEREXAMPLE_GATE'
    | 'GENERALIZATION_GATE'
    | 'CAUSAL_EXPERIMENT'
    | 'CONTRACT_EVALUATION'
    | 'MUTATION_TEST'
    | 'DEPENDENCY_CHECK'
    | 'APPROVAL_GATE'
    | 'SELF_HEALING'
    | 'INVARIANTS'
    | 'NO_CHANGE_DECISION'
    | 'COMPLETED'
    | 'FAILED';
  title: string;
  detail: string;
  status: 'RUNNING' | 'SUCCESS' | 'WARNING' | 'FAILED';
  timestamp: number;
}



export interface AutonomousEvolutionRecord {
  id: string;
  changeSetId?: ChangeSetID;
  timestamp: number;
  chapterNumber?: number;
  chapterTitle?: string;
  targetFile: string;
  prompt: string;
  reasoning: string;
  commitHash?: string;
  snapshotId?: string;
  previousScore: number;
  newScore: number;
  verification: AutonomousVerificationData;
  selfHealingAttempts: number;
  invariantsPassed: boolean;
  applied: boolean;
  steps: AutonomousEvolutionStepEvent[];
  beforeCode?: string;
  afterCode?: string;
  mutationTestResult?: MutationTestResult;
  awaitingApproval?: boolean;
  lesson?: {
    title: string;
    rule: string;
  };
  // ── v24: 14項目拡張 ──
  requirementContractId?: string;
  implementationEvidenceId?: string;
  causalExperimentResult?: CausalExperimentResult;
  counterexampleResult?: CounterexampleGateResult;
  generalizationResult?: GeneralizationGateResult;
  selectedStrategyId?: string;
  selectedStrategyName?: string;
  adoptionState?: AdoptionState;
  deploymentState?: DeploymentLifecycleState;
  failureCategory?: SelfImprovementFailureCategory;
  noChangeDecision?: NoChangeDecision;
}

export interface AutopilotConfig {
  enabled: boolean;
  intervalMinutes: number;
  requireApproval: boolean;
  targetDomain: 'ALL' | 'SPECIFICATION_CHAPTERS' | 'PERFORMANCE' | 'SAFETY' | 'RESILIENCE';
  maxContinuousRuns: number;
  autoHealLimit: number;
}

const AUTOPILOT_CONFIG_KEY = 'miki_autopilot_config_v1';
const EVOLUTION_HISTORY_KEY = 'miki_evolution_history_v1';

export class AutonomousContinuousEvolutionService {
  private config: AutopilotConfig = {
    enabled: false,
    intervalMinutes: 360,
    requireApproval: true,
    targetDomain: 'ALL',
    maxContinuousRuns: 5,
    autoHealLimit: 3,
  };

  private history: AutonomousEvolutionRecord[] = [];
  private isRunningCycle: boolean = false;
  private timerId: any = null;
  private listeners: Array<(record: AutonomousEvolutionRecord | null, isRunning: boolean) => void> = [];
  private stepListeners: Array<(step: AutonomousEvolutionStepEvent) => void> = [];

  constructor() {
    this.loadConfig();
    this.loadHistory();
  }

  private persistConfig(): void {
    try {
      storageService.setItem(AUTOPILOT_CONFIG_KEY, JSON.stringify(this.config));
    } catch (e) {
      console.warn('Failed to save autopilot config:', e);
    }
  }

  private syncAutopilotTimer(): void {
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
    if (!this.config.enabled) return;
    this.timerId = setInterval(() => {
      if (!this.isRunningCycle && this.config.enabled) {
        selfImprovementRequestEventService.publish({
          trigger: 'autopilot-scheduled',
          requestedAt: Date.now(),
          source: 'AUTOPILOT',
        });
      }
    }, Math.max(60, this.config.intervalMinutes) * 60 * 1000);
  }

  private loadConfig(): void {
    try {
      const raw = storageService.getItem(AUTOPILOT_CONFIG_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<AutopilotConfig> & { intervalSeconds?: number };
        const migratedMinutes = parsed.intervalMinutes ?? (parsed.intervalSeconds ? Math.ceil(parsed.intervalSeconds / 60) : undefined);
        this.config = {
          ...this.config,
          ...parsed,
          intervalMinutes: Math.min(10080, Math.max(60, migratedMinutes ?? this.config.intervalMinutes)),
          requireApproval: parsed.requireApproval ?? true,
          maxContinuousRuns: Math.max(1, Math.min(100, Number(parsed.maxContinuousRuns ?? this.config.maxContinuousRuns))),
          autoHealLimit: Math.max(0, Math.min(20, Number(parsed.autoHealLimit ?? this.config.autoHealLimit))),
        };
        this.persistConfig();
      }
      this.syncAutopilotTimer();
    } catch (e) {
      console.warn('Failed to load autopilot config:', e);
      this.timerId = null;
    }
  }

  public saveConfig(newConfig: Partial<AutopilotConfig>): void {
    const next: AutopilotConfig = {
      ...this.config,
      ...newConfig,
      intervalMinutes: Math.min(10080, Math.max(60, Number(newConfig.intervalMinutes ?? this.config.intervalMinutes))),
      maxContinuousRuns: Math.max(1, Math.min(100, Number(newConfig.maxContinuousRuns ?? this.config.maxContinuousRuns))),
      autoHealLimit: Math.max(0, Math.min(20, Number(newConfig.autoHealLimit ?? this.config.autoHealLimit))),
    };
    this.config = next;
    this.persistConfig();
    this.syncAutopilotTimer();
    this.notifyState();
  }

  public getConfig(): AutopilotConfig {
    return { ...this.config };
  }

  private loadHistory(): void {
    try {
      const raw = storageService.getItem(EVOLUTION_HISTORY_KEY);
      if (raw) {
        this.history = JSON.parse(raw);
      }
    } catch (e) {
      console.warn('Failed to load evolution history:', e);
    }
  }

  private saveHistory(): void {
    try {
      storageService.setItem(EVOLUTION_HISTORY_KEY, JSON.stringify(this.history.slice(0, 30)));
    } catch (e) {
      console.warn('Failed to save evolution history:', e);
    }
  }

  public getHistory(): AutonomousEvolutionRecord[] {
    return [...this.history];
  }

  public isBusy(): boolean {
    return this.isRunningCycle;
  }

  public isAutopilotActive(): boolean {
    return this.config.enabled;
  }

  // ──【リスナー購読】──
  public subscribe(fn: (record: AutonomousEvolutionRecord | null, isRunning: boolean) => void): () => void {
    this.listeners.push(fn);
    fn(this.history[0] || null, this.isRunningCycle);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== fn);
    };
  }

  public subscribeSteps(fn: (step: AutonomousEvolutionStepEvent) => void): () => void {
    this.stepListeners.push(fn);
    return () => {
      this.stepListeners = this.stepListeners.filter((l) => l !== fn);
    };
  }

  public onStep(fn: (step: AutonomousEvolutionStepEvent) => void): () => void {
    return this.subscribeSteps(fn);
  }

  private emitStep(step: AutonomousEvolutionStepEvent): void {
    this.stepListeners.forEach((fn) => {
      try {
        fn(step);
      } catch {}
    });
  }

  private notifyState(record?: AutonomousEvolutionRecord): void {
    const latest = record || this.history[0] || null;
    this.listeners.forEach((fn) => {
      try {
        fn(latest, this.isRunningCycle);
      } catch {}
    });
  }

  // ──【自動巡回タイマー制御】──
  public startAutopilot(): void {
    this.config.enabled = true;
    this.persistConfig();
    this.syncAutopilotTimer();
    systemLogger.info('SELF_IMPROVEMENT', `🤖 [自動巡回開始] みきの自律コード自己改善デーモンを起動しました (巡回間隔: ${this.config.intervalMinutes}分)`);
    this.notifyState();
  }

  public stopAutopilot(): void {
    this.config.enabled = false;
    this.persistConfig();
    this.syncAutopilotTimer();
    systemLogger.info('SELF_IMPROVEMENT', '⏹️ [自動巡回停止] みきの自律コード自己改善デーモンを停止しました');
    this.notifyState();
  }
  public async runMutationTestOnTarget(code: string, targetName: string = 'TargetModule'): Promise<MutationTestResult> {
    return await mikiSelfCodingSuperchargerService.runMutationTest(code, targetName);
  }
}

export const autonomousContinuousEvolutionService = new AutonomousContinuousEvolutionService();
