import { SamplingConfig, SamplingTuningStats, SamplingTuningTrialResult } from '../types';
import { storageService } from './storageService';
import { systemLogger } from './systemLogger';

const SAMPLING_TUNING_KEY = 'miki_sampling_tuning_stats_v1';

const DEFAULT_SAMPLING_CONFIG: SamplingConfig = {
  temperature: 0.7,
  topP: 0.9,
  topK: 40,
  minP: 0.05,
  frequencyPenalty: 0.1,
  presencePenalty: 0.1,
  repeatLastN: 64,
  noRepeatNgramSize: 0,
};

class SamplingTuningService {
  private stats: SamplingTuningStats;

  constructor() {
    this.stats = this.loadStats();
  }

  private loadStats(): SamplingTuningStats {
    try {
      const saved = storageService.getItem(SAMPLING_TUNING_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') {
          return {
            currentConfig: { ...DEFAULT_SAMPLING_CONFIG, ...(parsed.currentConfig || {}) },
            domainConfigs: parsed.domainConfigs || {},
            totalTrials: parsed.totalTrials || 0,
            loopDetectionsCount: parsed.loopDetectionsCount || 0,
            lastTunedAt: parsed.lastTunedAt || Date.now(),
            tuningHistory: Array.isArray(parsed.tuningHistory) ? parsed.tuningHistory.slice(-50) : [],
          };
        }
      }
    } catch (e) {
      console.warn('[samplingTuningService] Failed to load tuning stats, using defaults:', e);
    }

    return {
      currentConfig: { ...DEFAULT_SAMPLING_CONFIG },
      domainConfigs: {
        coding: {
          temperature: 0.3,
          topP: 0.85,
          topK: 30,
          minP: 0.08,
          frequencyPenalty: 0.15,
          presencePenalty: 0.1,
          repeatLastN: 128,
        },
        vba: {
          temperature: 0.25,
          topP: 0.8,
          topK: 25,
          minP: 0.1,
          frequencyPenalty: 0.2,
          presencePenalty: 0.1,
          repeatLastN: 128,
        },
        conversation: {
          temperature: 0.75,
          topP: 0.92,
          topK: 45,
          minP: 0.05,
          frequencyPenalty: 0.1,
          presencePenalty: 0.1,
          repeatLastN: 64,
        },
      },
      totalTrials: 0,
      loopDetectionsCount: 0,
      lastTunedAt: Date.now(),
      tuningHistory: [],
    };
  }

  private saveStats(): void {
    try {
      storageService.setItem(SAMPLING_TUNING_KEY, JSON.stringify(this.stats));
    } catch (e) {
      console.warn('[samplingTuningService] Failed to save tuning stats:', e);
    }
  }

  /**
   * 指定ドメイン（または全般）の最適なサンプリング設定を取得
   */
  public getSamplingConfig(domain?: string): SamplingConfig {
    if (domain && this.stats.domainConfigs[domain]) {
      return { ...this.stats.currentConfig, ...this.stats.domainConfigs[domain] };
    }
    return { ...this.stats.currentConfig };
  }

  /**
   * サンプリング設定を更新
   */
  public updateSamplingConfig(config: Partial<SamplingConfig>, domain?: string): SamplingConfig {
    if (domain) {
      this.stats.domainConfigs[domain] = {
        ...(this.stats.domainConfigs[domain] || this.stats.currentConfig),
        ...config,
      };
      this.stats.lastTunedAt = Date.now();
      this.saveStats();
      systemLogger.info('SELF_IMPROVEMENT', `[第22章 サンプリング自律調整] ドメイン「${domain}」のサンプリング設定を更新しました。`);
      return this.stats.domainConfigs[domain];
    }

    this.stats.currentConfig = {
      ...this.stats.currentConfig,
      ...config,
    };
    this.stats.lastTunedAt = Date.now();
    this.saveStats();
    systemLogger.info('SELF_IMPROVEMENT', '[第22章 サンプリング自律調整] 基本サンプリング設定を更新しました。');
    return this.stats.currentConfig;
  }

  /**
   * ループ検出時に呼び出され、ペナルティパラメータを自動調整
   */
  public recordLoopDetection(context?: { domain?: string; text?: string }): void {
    const domain = context?.domain || 'general';
    this.stats.loopDetectionsCount++;

    const current = this.getSamplingConfig(domain);

    // ループ抑制のためのペナルティ調整
    const newFreqPenalty = Math.min(0.6, (current.frequencyPenalty ?? 0.1) + 0.05);
    const newPresPenalty = Math.min(0.5, (current.presencePenalty ?? 0.1) + 0.05);
    const newRepeatLastN = Math.min(256, Math.max(64, (current.repeatLastN ?? 64) + 32));
    const newTemp = Math.max(0.2, (current.temperature ?? 0.7) - 0.05);

    const tunedConfig: SamplingConfig = {
      ...current,
      frequencyPenalty: Number(newFreqPenalty.toFixed(2)),
      presencePenalty: Number(newPresPenalty.toFixed(2)),
      repeatLastN: newRepeatLastN,
      temperature: Number(newTemp.toFixed(2)),
    };

    if (domain !== 'general') {
      this.stats.domainConfigs[domain] = tunedConfig;
    } else {
      this.stats.currentConfig = tunedConfig;
    }

    const trial: SamplingTuningTrialResult = {
      id: `sampling_tune_${Date.now()}`,
      timestamp: Date.now(),
      domain,
      config: tunedConfig,
      loopDetected: true,
      repetitionScore: 0.85,
      diversityScore: 0.4,
      coherenceScore: 0.6,
      success: true,
      notes: `トークンループ検知に伴い、frequencyPenalty=${tunedConfig.frequencyPenalty}, presencePenalty=${tunedConfig.presencePenalty}, repeatLastN=${tunedConfig.repeatLastN} へ自律調整しました。`,
    };

    this.stats.totalTrials++;
    this.stats.lastTunedAt = Date.now();
    this.stats.tuningHistory.push(trial);
    if (this.stats.tuningHistory.length > 50) {
      this.stats.tuningHistory.shift();
    }

    this.saveStats();
    systemLogger.warn(
      'SELF_IMPROVEMENT',
      `[第22章 サンプリング自律調整] ループ検知による緊急チューニング発動 (domain: ${domain}, freqPenalty: ${tunedConfig.frequencyPenalty})`
    );
  }

  /**
   * チューニング結果を履歴に記録し統計を更新
   */
  public recordTuningTrial(trialResult: Partial<SamplingTuningTrialResult>): SamplingTuningTrialResult {
    const trial: SamplingTuningTrialResult = {
      id: trialResult.id || `tune_trial_${Date.now()}`,
      timestamp: trialResult.timestamp || Date.now(),
      domain: trialResult.domain || 'general',
      config: trialResult.config || this.getSamplingConfig(trialResult.domain),
      loopDetected: !!trialResult.loopDetected,
      repetitionScore: trialResult.repetitionScore ?? 0.1,
      diversityScore: trialResult.diversityScore ?? 0.8,
      coherenceScore: trialResult.coherenceScore ?? 0.85,
      success: trialResult.success ?? true,
      notes: trialResult.notes,
    };

    this.stats.totalTrials++;
    this.stats.lastTunedAt = Date.now();
    this.stats.tuningHistory.push(trial);
    if (this.stats.tuningHistory.length > 50) {
      this.stats.tuningHistory.shift();
    }

    this.saveStats();
    return trial;
  }

  public getStats(): SamplingTuningStats {
    return { ...this.stats };
  }

  public resetStats(): void {
    this.stats = {
      currentConfig: { ...DEFAULT_SAMPLING_CONFIG },
      domainConfigs: {},
      totalTrials: 0,
      loopDetectionsCount: 0,
      lastTunedAt: Date.now(),
      tuningHistory: [],
    };
    this.saveStats();
  }
}

export const samplingTuningService = new SamplingTuningService();
