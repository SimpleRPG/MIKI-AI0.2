import { canonicalSha256 } from '../../core/services/canonicalSha256Service';
export type ContractTestCategory='NORMAL'|'MISSING'|'MISMATCH'|'BOUNDARY'|'REGRESSION';
export interface ContractTestIntent { intentId:string; category:ContractTestCategory; fieldName:string; description:string; expectedSummary:string; source:'REQUIREMENT_CONTRACT'; }
class ContractTestIntentService {
  public create(fieldName:string,condition?:string):ContractTestIntent[]{
    const rows:Array<Omit<ContractTestIntent,'intentId'>>=[
      {category:'NORMAL',fieldName,description:`${fieldName}が全経路で維持される`,expectedSummary:'契約値が一致し処理が成功する',source:'REQUIREMENT_CONTRACT'},
      {category:'MISSING',fieldName,description:`${fieldName}欠落を拒否する`,expectedSummary:'検証がfail closedで拒否する',source:'REQUIREMENT_CONTRACT'},
      {category:'MISMATCH',fieldName,description:`${fieldName}不一致を拒否する`,expectedSummary:'不一致を検出し処理を継続しない',source:'REQUIREMENT_CONTRACT'},
      {category:'BOUNDARY',fieldName,description:condition?`${fieldName}境界条件 ${condition}`:`${fieldName}境界条件`,expectedSummary:'境界条件で期待どおり判定する',source:'REQUIREMENT_CONTRACT'},
      {category:'REGRESSION',fieldName,description:`既存経路の${fieldName}回帰`,expectedSummary:'既存正常系を壊さない',source:'REQUIREMENT_CONTRACT'}
    ];
    return rows.map(row=>({...row,intentId:`CTI-${canonicalSha256(row).slice(0,24)}`}));
  }
}
export const contractTestIntentService=new ContractTestIntentService();
