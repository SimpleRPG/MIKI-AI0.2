import { JapaneseAnalysisResult } from '../../research/services/japaneseAnalysisService';
import { JapaneseAnalysisCompositionResult, japaneseAnalysisCompositionService } from './japaneseAnalysisCompositionService';
export interface JapaneseAnalysisComponentDecision { componentId: 'composed.japanese_analysis'; reason: string; verified: boolean; }
export class JapaneseAnalysisComponentOrchestratorService {
  public async analyze(text: string, mode: 'A' | 'B' | 'C' = 'C'): Promise<{ analysis: JapaneseAnalysisResult; decision: JapaneseAnalysisComponentDecision; composition: JapaneseAnalysisCompositionResult }> {
    const composition = await japaneseAnalysisCompositionService.analyze(text, mode);
    return { analysis: composition.analysis, decision: { componentId: 'composed.japanese_analysis', reason: `Composed Japanese analysis: ${composition.usedComponents.join(', ')}`, verified: composition.components.filter(c => c.available).every(c => c.verified) }, composition };
  }
}
export const japaneseAnalysisComponentOrchestratorService = new JapaneseAnalysisComponentOrchestratorService();
