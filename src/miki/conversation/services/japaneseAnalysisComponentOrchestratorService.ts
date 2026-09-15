import { componentRegistryService } from '../../capability/services/componentRegistryService';
import { JapaneseAnalysisResult, japaneseAnalysisService } from '../../research/services/japaneseAnalysisService';
import { japaneseMorphologyService } from '../../research/services/japaneseMorphologyService';
import { systemLogger } from '../../../services/systemLogger';

export interface JapaneseAnalysisComponentDecision {
  componentId: 'android.japanese_morphology_selftest' | 'javascript.japanese_analysis_fallback';
  reason: string;
  verified: boolean;
}

/**
 * 日本語解析能力を交換可能な部品として選択する。
 * 会話中核はSudachiという実装へ直接依存せず、VERIFIED部品だけを優先利用する。
 */
export class JapaneseAnalysisComponentOrchestratorService {
  public async analyze(text: string, mode: 'A' | 'B' | 'C' = 'C'): Promise<{
    analysis: JapaneseAnalysisResult;
    decision: JapaneseAnalysisComponentDecision;
  }> {
    const nativeComponent = componentRegistryService.getComponent('android.japanese_morphology_selftest');
    if (nativeComponent?.status === 'VERIFIED') {
      const status = await japaneseMorphologyService.status();
      if (status.available) {
        const analysis = await japaneseAnalysisService.analyzeNativeFirst(text, mode);
        if (analysis.analyzer === 'SUDACHI') {
          return {
            analysis,
            decision: {
              componentId: 'android.japanese_morphology_selftest',
              reason: `VERIFIED native morphology component selected (${status.dictionaryVersion || 'dictionary version unknown'})`,
              verified: true,
            },
          };
        }
      }
      systemLogger.warn('CHAT', '[JapaneseAnalysisOrchestrator] VERIFIED Native部品を利用できないためfallbackへ切替');
    }

    return {
      analysis: japaneseAnalysisService.analyze(text),
      decision: {
        componentId: 'javascript.japanese_analysis_fallback',
        reason: nativeComponent?.status === 'VERIFIED' ? 'Native unavailable' : 'Native morphology component is not VERIFIED',
        verified: false,
      },
    };
  }
}

export const japaneseAnalysisComponentOrchestratorService = new JapaneseAnalysisComponentOrchestratorService();
