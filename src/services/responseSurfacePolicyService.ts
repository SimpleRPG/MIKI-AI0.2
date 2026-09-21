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

class ResponseSurfacePolicyService {
  private static instance: ResponseSurfacePolicyService;
  private connectorStats: Record<string, { success: number; failure: number }> = {};

  private constructor() { this.load(); }

  public static getInstance(): ResponseSurfacePolicyService {
    if (!this.instance) this.instance = new ResponseSurfacePolicyService();
    return this.instance;
  }

  private load(): void {
    try {
      const raw = storageService.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      if (parsed && typeof parsed === 'object') this.connectorStats = parsed;
    } catch {
      this.connectorStats = {};
    }
  }

  private save(): void {
    storageService.setItem(STORAGE_KEY, JSON.stringify(this.connectorStats));
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

  private connectorScore(text: string): number {
    const stat = this.connectorStats[text];
    if (!stat) return 50;
    const total = stat.success + stat.failure;
    if (!total) return 50;
    return (stat.success / total) * 100;
  }

  private chooseEnding(persona: MultiAxisPersonaConfig): string {
    if (persona.politeness === 'VERY_POLITE' || persona.formality === 'HIGH') return 'です。';
    if (persona.politeness === 'CASUAL') return 'だよ。';
    return 'です！';
  }

  /** 13.2: 表現候補だけを学習対象にする。意味・安全基準は変更しない。 */
  public recordConnectorOutcome(connector: string, success: boolean): void {
    if (!connector) return;
    const current = this.connectorStats[connector] || { success: 0, failure: 0 };
    current[success ? 'success' : 'failure'] += 1;
    this.connectorStats[connector] = current;
    this.save();
  }
}

export const responseSurfacePolicyService = ResponseSurfacePolicyService.getInstance();
