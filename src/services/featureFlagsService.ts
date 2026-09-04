import { FeatureFlagState, SystemFeatureFlags } from '../types';
import { storageService } from './storageService';
import { systemLogger } from './systemLogger';

const FLAGS_STORAGE_KEY = 'miki_system_feature_flags_v32';

/**
 * 設計思想 31章: 機能フラグ初期定義
 */
export const DEFAULT_FEATURE_FLAGS: SystemFeatureFlags = {
  CHAT_CORE: 'STABLE',
  SHORT_TERM_CONTEXT: 'STABLE',
  LONG_TERM_RETRIEVAL: 'LIMITED',
  ANSWER_PLAN_CACHE: 'STABLE',
  TEACHER_ROUTER: 'DEVELOPMENT',
  MULTI_STEP_REASONING: 'SHADOW',
  LORA_TRAINING: 'DISABLED', // 16.2の発動条件を満たすまで長期固定
  CODE_UNDERSTANDING: 'DEVELOPMENT',
  VBA_DESIGN_ASSISTANT: 'DEVELOPMENT',
};

export const FEATURE_FLAG_DESCRIPTIONS: Record<keyof SystemFeatureFlags, { title: string; desc: string }> = {
  CHAT_CORE: {
    title: '基盤チャット・ストリーミング (Chat Core)',
    desc: 'ローカルモデルの安定起動、ストリーミング出力、会話ログ保存（1〜5章）。',
  },
  SHORT_TERM_CONTEXT: {
    title: '会話状態管理 (Short-Term Context)',
    desc: '話題、最上位目的、確定事項、訂正イベント、無効化前提の追跡（7章）。',
  },
  LONG_TERM_RETRIEVAL: {
    title: '長期記憶・7段階検索 (Long-Term Retrieval)',
    desc: '完全一致検索、全文検索、メタデータ一致、関連原文の再取得（8章）。',
  },
  ANSWER_PLAN_CACHE: {
    title: '回答骨格と思考節約 (Answer Plan Cache)',
    desc: '状況分類に基づく定型骨格の適用、思考手順の定型化と推論計算量削減（9章）。',
  },
  TEACHER_ROUTER: {
    title: '外部教師ルーター (Teacher Router)',
    desc: '不確実性駆動の教師送信、無料枠予算管理、対策骨格の生成要請（10〜15, 20章）。',
  },
  MULTI_STEP_REASONING: {
    title: '多段推論 (Multi-Step Reasoning)',
    desc: '直接回答で解けない複雑問題の分解。過剰思考を抑制するためシャドウ運用（6章）。',
  },
  LORA_TRAINING: {
    title: 'LoRA追加学習 (LoRA Training)',
    desc: '重み更新。16.2の発動条件を満たすまで長期DISABLED固定（16, 17, 31章）。',
  },
  CODE_UNDERSTANDING: {
    title: 'コード理解AI (Code Understanding)',
    desc: '構文抽出、呼出関係、中間JSON表現(CodeIR)、読解確認質問、矛盾検査（22〜25章）。',
  },
  VBA_DESIGN_ASSISTANT: {
    title: '抽象VBA設計支援 (VBA Design Assistant)',
    desc: '抽象要件整理、決定表化、構成案、テストケース、外部Copilot用指示書生成（26章）。',
  },
};

class FeatureFlagsService {
  private flags: SystemFeatureFlags;

  constructor() {
    this.flags = this.loadFlags();
  }

  private loadFlags(): SystemFeatureFlags {
    try {
      const raw = storageService.getItem(FLAGS_STORAGE_KEY);
      if (raw) {
        return { ...DEFAULT_FEATURE_FLAGS, ...JSON.parse(raw) };
      }
    } catch (e) {
      console.warn('Failed to load feature flags:', e);
    }
    return { ...DEFAULT_FEATURE_FLAGS };
  }

  public saveFlags(): void {
    try {
      storageService.setItem(FLAGS_STORAGE_KEY, JSON.stringify(this.flags));
    } catch (e) {
      console.warn('Failed to save feature flags:', e);
    }
  }

  public getFlags(): SystemFeatureFlags {
    return { ...this.flags };
  }

  public getAllFlags(): SystemFeatureFlags {
    return this.getFlags();
  }

  public getFlag(key: keyof SystemFeatureFlags): FeatureFlagState {
    return this.flags[key];
  }

  public setFlag(key: keyof SystemFeatureFlags, state: FeatureFlagState): void {
    const old = this.flags[key];
    this.flags[key] = state;
    this.saveFlags();
    systemLogger.info('FEATURE_FLAGS', `機能フラグ更新: ${key} [${old} -> ${state}]`);
  }

  public setFlagState(key: keyof SystemFeatureFlags, state: FeatureFlagState): void {
    this.setFlag(key, state);
  }

  public isEnabled(key: keyof SystemFeatureFlags): boolean {
    const state = this.flags[key];
    return state === 'DEVELOPMENT' || state === 'LIMITED' || state === 'STABLE';
  }

  public resetToDefaults(): void {
    this.flags = { ...DEFAULT_FEATURE_FLAGS };
    this.saveFlags();
  }
}

export const featureFlagsService = new FeatureFlagsService();
