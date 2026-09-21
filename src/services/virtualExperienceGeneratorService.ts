import { storageService } from './storageService';
import { systemLogger } from './systemLogger';
import { mikiUnifiedLearningContinuumService } from './mikiUnifiedLearningContinuumService';
import { counterexampleContractRefinementService } from './counterexampleContractRefinementService';

export interface VirtualExperienceCase {
  id: string;
  componentId: string;
  environment: string;
  scenario: string;
  expectedInvariant: string;
  simulatedOutcome: 'PASS' | 'FAIL';
  reason: string;
  createdAt: number;
}

/** 第145章: 実障害を待たず、既知の反例/契約から安全な仮想経験を生成する。実コードは実行しない。 */
class VirtualExperienceGeneratorService {
  private readonly key = 'miki_virtual_experience_generator_v1';
  private cases: VirtualExperienceCase[] = [];
  constructor(){ this.load(); }

  generateFromContracts(limit = 10): VirtualExperienceCase[] {
    const refinements = counterexampleContractRefinementService.list(Math.max(1, limit));
    const created: VirtualExperienceCase[] = [];
    for (const r of refinements) {
      const scenario = `${r.componentId} / ${r.environment}: ${r.counterexample}`;
      const id = `VEXP-${this.hash(`${r.refinementId}|${r.status}`)}`;
      if (this.cases.some(c => c.id === id)) continue;
      const invariant = r.clauses.find(c => c.kind === 'INVARIANT')?.text || r.clauses[0]?.text || '観測された失敗条件を再現可能な検証条件として保持すること';
      const simulatedOutcome = r.status === 'VALIDATED' ? 'PASS' : 'FAIL';
      const item: VirtualExperienceCase = { id, componentId:r.componentId, environment:r.environment, scenario, expectedInvariant:invariant, simulatedOutcome, reason:'実環境を変更せず、契約・反例だけを用いた仮想評価です。PASSは実行成功を意味せず、実Regressionへ直接昇格しません。', createdAt:Date.now() };
      this.cases.unshift(item); created.push(item);
      mikiUnifiedLearningContinuumService.observe({ domain:'system', action:'virtual_experience_generated', input:scenario, outcome:simulatedOutcome === 'PASS' ? 'SUCCESS':'FAILURE', verified:false, capabilityIds:[r.componentId], lesson:`${id}:virtual_only` });
    }
    this.cases=this.cases.slice(0,500); this.save();
    if(created.length) systemLogger.info('SELF_IMPROVEMENT', `🧪 [VirtualExperience] ${created.length}件の仮想経験を生成（実行昇格なし）`);
    return created.map(x=>({...x}));
  }
  list(limit=50){return this.cases.slice(0,Math.max(1,limit)).map(x=>({...x}));}
  private hash(raw:string){let h=2166136261;for(let i=0;i<raw.length;i++){h^=raw.charCodeAt(i);h=Math.imul(h,16777619);}return(h>>>0).toString(16).padStart(8,'0');}
  private load(){try{const raw=storageService.getItem(this.key);if(raw)this.cases=JSON.parse(raw)}catch{}}
  private save(){try{storageService.setItem(this.key,JSON.stringify(this.cases))}catch{}}
}
export const virtualExperienceGeneratorService = new VirtualExperienceGeneratorService();
