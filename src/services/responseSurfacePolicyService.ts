import { AnswerSkeletonType, MultiAxisPersonaConfig, ResponseLength } from '../types';
import { storageService } from './storageService';

/**
 * 設計思想 5.2 / 13.2 / 13.4
 * 回答内容IRの「何を言うか」には触れず、「どう言うか」だけを決定する。
 * 回答骨格、解像度、接続表現、語尾を小さな決定論的ポリシーとして分離する。
 *
 * ここで骨格同士を合成しない。複合的な内容が必要な場合も、Answer IRの
 * conclusion/reasons/conditions/exceptions/next_actionsを同一骨格内で段階的に
 * 表層化する。これにより、表現の改善が意味内容を変更しない境界を保つ。
 */
export type SurfaceResolution = 'BRIEF' | 'STANDARD' | 'DETAILED';

export interface SurfacePolicy {
  resolution: SurfaceResolution;
  sectionOrder: Array<'conclusion' | 'reasons' | 'conditions' | 'exceptions' | 'next_actions'>;
  connector: string;
  ending: string;
}

const STORAGE_KEY = 'miki_response_surface_policy_v1';

export interface VariationOutcomeStats {
  success: number;
  failure: number;
  score: number;
}

class ResponseSurfacePolicyService {
  private static instance: ResponseSurfacePolicyService;
  private variationStats: Record<string, { success: number; failure: number }> = {};
  private lastTurnUsedVariationIds: string[] = [];

  private constructor() { this.load(); }

  public static getInstance(): ResponseSurfacePolicyService {
    if (!this.instance) this.instance = new ResponseSurfacePolicyService();
    return this.instance;
  }

  private load(): void {
    try {
      const raw = storageService.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      if (parsed && typeof parsed === 'object') this.variationStats = parsed;
    } catch {
      this.variationStats = {};
    }
  }

  private save(): void {
    storageService.setItem(STORAGE_KEY, JSON.stringify(this.variationStats));
  }

  /** 後方互換用コネクタ統計アクセス */
  public get connectorStats(): Record<string, { success: number; failure: number }> {
    return this.variationStats;
  }

  public resolveResolution(detailLevel: ResponseLength | undefined, persona: MultiAxisPersonaConfig): SurfaceResolution {
    if (detailLevel === 'short' || persona.currentScene === 'SHORT_MODE' || persona.verbosity === 'CONCISE') return 'BRIEF';
    if (detailLevel === 'detailed' || persona.currentScene === 'DETAILED_MODE' || persona.verbosity === 'DETAILED') return 'DETAILED';
    return 'STANDARD';
  }

  public choosePolicy(
    skeleton: AnswerSkeletonType,
    detailLevel: ResponseLength | undefined,
    persona: MultiAxisPersonaConfig,
  ): SurfacePolicy {
    const resolution = this.resolveResolution(detailLevel, persona);
    const order = this.sectionOrder(skeleton, resolution);
    return {
      resolution,
      sectionOrder: order,
      connector: this.chooseConnector(skeleton, persona),
      ending: this.chooseEnding(persona),
    };
  }

  private sectionOrder(skeleton: AnswerSkeletonType, resolution: SurfaceResolution): SurfacePolicy['sectionOrder'] {
    switch (skeleton) {
      case 'RECOMMENDATION':
        if (resolution === 'BRIEF') return ['conclusion', 'reasons'];
        if (resolution === 'DETAILED') return ['conclusion', 'reasons', 'exceptions', 'conditions', 'next_actions'];
        return ['conclusion', 'reasons', 'exceptions', 'conditions'];
      case 'CORRECTION':
        if (resolution === 'BRIEF') return ['conclusion'];
        if (resolution === 'DETAILED') return ['conclusion', 'conditions', 'exceptions', 'reasons', 'next_actions'];
        return ['conclusion', 'conditions', 'exceptions'];
      case 'UNKNOWN_INVESTIGATION':
        if (resolution === 'BRIEF') return ['conclusion', 'next_actions'];
        return ['conclusion', 'exceptions', 'conditions', 'next_actions'];
      case 'TASK_COMPLETION':
        if (resolution === 'BRIEF') return ['conclusion'];
        if (resolution === 'DETAILED') return ['conclusion', 'reasons', 'conditions', 'exceptions', 'next_actions'];
        return ['conclusion', 'reasons', 'conditions', 'next_actions'];
      case 'GENERAL_ANSWER':
      default:
        if (resolution === 'BRIEF') return ['conclusion'];
        if (resolution === 'DETAILED') return ['conclusion', 'reasons', 'conditions', 'exceptions', 'next_actions'];
        return ['conclusion', 'conditions', 'reasons', 'next_actions'];
    }
  }

  private chooseConnector(skeleton: AnswerSkeletonType, persona: MultiAxisPersonaConfig): string {
    const candidates = skeleton === 'CORRECTION'
      ? ['そのため', 'なので', 'この前提なら']
      : skeleton === 'UNKNOWN_INVESTIGATION'
        ? ['現時点では', 'そのため', '次に']
        : persona.directness === 'HIGH'
          ? ['結論として', '理由は', 'そのうえで']
          : ['まず', 'その理由は', '続いて'];

    return candidates
      .map((text) => ({ text, score: this.connectorScore(text) }))
      .sort((a, b) => b.score - a.score || a.text.localeCompare(b.text))[0].text;
  }

  public getOutcomeScore(idOrText: string): number {
    if (!idOrText) return 50;
    const stat = this.variationStats[idOrText];
    if (!stat) return 50;
    const total = stat.success + stat.failure;
    if (total === 0) return 50;
    return (stat.success / total) * 100;
  }

  private connectorScore(text: string): number {
    return this.getOutcomeScore(text);
  }

  private chooseEnding(persona: MultiAxisPersonaConfig): string {
    if (persona.politeness === 'VERY_POLITE' || persona.formality === 'HIGH') return 'です。';
    if (persona.politeness === 'CASUAL') return 'だよ。';
    return 'です！';
  }

  /**
   * 13.2 / 作業指示書 1.2:
   * 表現選択（接続表現・文末表現・見出し・装飾表現）の成功・失敗フィードバックを記録。
   * ※ surfaceVariationGrowthService の verifyCandidate（意味保持・文法検査）とは独立した仕組み。
   * こちらは「文法的に正しいか」ではなく「ユーザーに実際に好評だったか」を学習する層。
   */
  public recordVariationOutcome(idOrText: string, success: boolean): void {
    if (!idOrText || !idOrText.trim()) return;
    const key = idOrText.trim();
    const current = this.variationStats[key] || { success: 0, failure: 0 };
    current[success ? 'success' : 'failure'] += 1;
    this.variationStats[key] = current;
    this.save();
  }

  /** 複数表現の成否フィードバックを一括記録 */
  public recordVariationOutcomes(ids: string[], success: boolean): void {
    if (!Array.isArray(ids)) return;
    ids.forEach((id) => this.recordVariationOutcome(id, success));
  }

  /** 後方互換用：コネクタのフィードバック記録 */
  public recordConnectorOutcome(connector: string, success: boolean): void {
    this.recordVariationOutcome(connector, success);
  }

  /** 全表現の学習統計サマリーを取得 */
  public getStats(): Record<string, VariationOutcomeStats> {
    const res: Record<string, VariationOutcomeStats> = {};
    for (const [key, val] of Object.entries(this.variationStats)) {
      const total = val.success + val.failure;
      res[key] = {
        success: val.success,
        failure: val.failure,
        score: total > 0 ? (val.success / total) * 100 : 50,
      };
    }
    return res;
  }

  /** 直前ターンで実際に選ばれた表現ID群を一時保存 */
  public recordLastTurnUsedVariations(ids: string[]): void {
    this.lastTurnUsedVariationIds = Array.from(new Set(ids.filter(Boolean)));
  }

  /** 直前ターンで使われた表現ID群を取得 */
  public getLastTurnUsedVariationIds(): string[] {
    return [...this.lastTurnUsedVariationIds];
  }

  /** 直前ターン表現ID群をクリア */
  public clearLastTurnUsedVariations(): void {
    this.lastTurnUsedVariationIds = [];
  }
}

export const responseSurfacePolicyService = ResponseSurfacePolicyService.getInstance();
