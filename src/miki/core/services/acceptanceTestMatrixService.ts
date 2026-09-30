import type { SemanticRequirementContract } from './semanticRequirementCompilerService';
export interface AcceptanceTestCase { id:string; criterion:string; scenario:'NORMAL'|'BOUNDARY'|'NEGATIVE'|'REGRESSION'; oracle:string; }
class AcceptanceTestMatrixService {
  create(contract:SemanticRequirementContract):AcceptanceTestCase[]{const rows:AcceptanceTestCase[]=[];let sequence=0;const add=(criterion:string,scenario:AcceptanceTestCase['scenario'],oracle:string)=>{sequence+=1;rows.push({id:`AC-${String(sequence).padStart(3,'0')}`,criterion,scenario,oracle});};for(const criterion of contract.acceptanceCriteria){add(criterion,'NORMAL',`Criterion is observably satisfied: ${criterion}`);add(criterion,'REGRESSION',`Existing behavior remains valid while satisfying: ${criterion}`);}for(const constraint of contract.constraints.slice(0,20))add(constraint,'NEGATIVE',`Implementation must not violate constraint: ${constraint}`);if(contract.ambiguities.length)add('Ambiguity handling','BOUNDARY','Unresolved ambiguity is surfaced and not silently assumed');return rows;}
}
export const acceptanceTestMatrixService=new AcceptanceTestMatrixService();
