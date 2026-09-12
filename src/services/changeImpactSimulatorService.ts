/** 設計思想 第31章 31.7: 変更影響シミュレーター */
import { CodeUnderstandingIR } from '../types';
import { codeMapService } from './codeMapService';

export type ImpactCertainty = 'STATIC_FACT' | 'STATIC_INFERENCE' | 'UNCONFIRMED';
export interface ChangeImpactSimulation {
  simulationId: string; target: string; certainty: ImpactCertainty;
  affectedProcedures: string[]; affectedData: string[]; affectedDependencies: string[];
  affectedSideEffects: string[]; rerunTestCases: string[]; risks: string[]; assumptions: string[]; createdAt: number;
}
class ChangeImpactSimulatorService {
  public simulate(ir: CodeUnderstandingIR, target: string, changeKind = 'SIGNATURE_OR_BEHAVIOR_CHANGE'): ChangeImpactSimulation {
    const proc = ir.procedures.find(p => p.procedureName.toLowerCase() === target.toLowerCase());
    const affectedProcedures = new Set<string>(); const affectedData = new Set<string>();
    const affectedDependencies = new Set<string>(); const affectedSideEffects = new Set<string>();
    const rerunTestCases = new Set<string>(); const risks: string[] = []; const assumptions: string[] = [];
    if (!proc) {
      return { simulationId: `impact_${Date.now()}`, target, certainty: 'UNCONFIRMED', affectedProcedures: [], affectedData: [], affectedDependencies: [], affectedSideEffects: [], rerunTestCases: [], risks: ['対象プロシージャを静的IRから特定できない'], assumptions: ['実行時の動的呼出・リフレクションは未観測'], createdAt: Date.now() };
    }
    affectedProcedures.add(proc.procedureName);
    proc.calls.forEach(x => affectedProcedures.add(x));
    proc.reads.forEach(x => affectedData.add(x)); proc.writes.forEach(x => affectedData.add(x));
    proc.external_dependencies.forEach(x => affectedDependencies.add(x)); proc.side_effects.forEach(x => affectedSideEffects.add(x));
    const prediction = ir.impactPredictions.find(p => p.targetProcedure === proc.procedureName);
    prediction?.affectedCallers.forEach(x => affectedProcedures.add(x)); prediction?.testCasesToRerun.forEach(x => rerunTestCases.add(x));
    if (changeKind.includes('SIGNATURE')) risks.push('呼出元の引数・戻り値契約が壊れる可能性');
    if (proc.writes.length) risks.push('保存データ/シートの副作用が変化する可能性');
    if (proc.external_dependencies.length) risks.push('外部依存の互換性・権限条件を再確認する必要');
    assumptions.push('静的解析で検出できない動的呼出は未確認');
    assumptions.push('実データによる実行結果はまだ含めない');
    void codeMapService.build(ir, [target]);
    return { simulationId: `impact_${Date.now()}_${Math.random().toString(36).slice(2,6)}`, target, certainty: 'STATIC_INFERENCE', affectedProcedures: [...affectedProcedures], affectedData: [...affectedData], affectedDependencies: [...affectedDependencies], affectedSideEffects: [...affectedSideEffects], rerunTestCases: [...rerunTestCases], risks, assumptions, createdAt: Date.now() };
  }
}
export const changeImpactSimulatorService = new ChangeImpactSimulatorService();
