import { canonicalSha256 } from '../../core/services/canonicalSha256Service';
import { selfCodeUnderstandingService } from '../../core/services/selfCodeUnderstandingService';

export type FeatureTaskKind='MODEL'|'SERVICE'|'CORE_ROUTE'|'UI'|'PERSISTENCE'|'VALIDATION'|'TEST'|'EXPORT';
export interface FeatureAcceptanceCriterion { criterionId:string; statement:string; evidenceKind:'STATIC'|'TYPECHECK'|'REGRESSION'|'UI'|'PERSISTENCE'|'EXPORT'; required:boolean; }
export interface FeatureImplementationTask { taskId:string; kind:FeatureTaskKind; objective:string; targetPaths:string[]; dependencies:string[]; reuseRequired:boolean; }
export interface FeatureDevelopmentPlan { schemaVersion:1; planId:string; objective:string; useCases:string[]; acceptanceCriteria:FeatureAcceptanceCriterion[]; tasks:FeatureImplementationTask[]; repositorySnapshotSha256?:string; unresolved:string[]; }

class FeatureDevelopmentPlannerService {
  public plan(objective:string,targetPaths:string[]=[]):FeatureDevelopmentPlan {
    const normalized=objective.trim();const unresolved:string[]=[];
    if(!normalized)unresolved.push('FEATURE_OBJECTIVE_REQUIRED');
    const understanding=selfCodeUnderstandingService.ensure(targetPaths);
    const useCases=this.sentences(normalized).map(value=>`利用者が${value}`);
    const taskKinds=this.inferKinds(normalized);
    const tasks:FeatureImplementationTask[]=[];
    for(const kind of taskKinds){
      const dependencies=tasks.length>0?[tasks[tasks.length-1].taskId]:[];
      const seed={kind,objective:normalized,targetPaths,dependencies};
      tasks.push({taskId:`FTASK-${canonicalSha256(seed).slice(0,20)}`,kind,objective:this.taskObjective(kind,normalized),targetPaths:[...new Set([...targetPaths,...understanding.relatedPaths])].sort(),dependencies,reuseRequired:true});
    }
    const criteria=this.criteria(normalized,taskKinds);
    const planSeed={objective:normalized,useCases,criteria,tasks:tasks.map(task=>({kind:task.kind,objective:task.objective,targetPaths:task.targetPaths}))};
    return {schemaVersion:1,planId:`FEATURE-${canonicalSha256(planSeed).slice(0,24)}`,objective:normalized,useCases,acceptanceCriteria:criteria,tasks,repositorySnapshotSha256:understanding.snapshotSha256,unresolved};
  }

  private inferKinds(text:string):FeatureTaskKind[]{
    const kinds:FeatureTaskKind[]=['MODEL','SERVICE','CORE_ROUTE','VALIDATION','TEST'];
    if(/画面|UI|入力欄|表示|button|react/i.test(text))kinds.splice(3,0,'UI');
    if(/保存|履歴|永続|database|store/i.test(text))kinds.splice(2,0,'PERSISTENCE');
    if(/zip|出力|export|download/i.test(text))kinds.push('EXPORT');
    return [...new Set(kinds)];
  }
  private criteria(objective:string,kinds:FeatureTaskKind[]):FeatureAcceptanceCriterion[]{
    const rows:Array<[string,FeatureAcceptanceCriterion['evidenceKind']]>= [
      [`要求「${objective}」の主要経路が実行可能である`,'REGRESSION'],['TypeScript型検査で新規診断がない','TYPECHECK'],['既存機能の回帰検査が成功する','REGRESSION']
    ];
    if(kinds.includes('UI'))rows.push(['UIから入力・実行・結果確認ができる','UI']);
    if(kinds.includes('PERSISTENCE'))rows.push(['保存後の再読込で同じ状態を復元できる','PERSISTENCE']);
    if(kinds.includes('EXPORT'))rows.push(['成果物を完全な形式で出力できる','EXPORT']);
    return rows.map(([statement,evidenceKind])=>({criterionId:`AC-${canonicalSha256({statement,evidenceKind}).slice(0,20)}`,statement,evidenceKind,required:true}));
  }
  private taskObjective(kind:FeatureTaskKind,objective:string):string{return `${kind}:${objective}`;}
  private sentences(text:string):string[]{return text.split(/[。\n]+/).map(value=>value.trim()).filter(Boolean).slice(0,20);}
}
export const featureDevelopmentPlannerService=new FeatureDevelopmentPlannerService();
