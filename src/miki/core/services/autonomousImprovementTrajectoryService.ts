import { canonicalSha256Object } from './canonicalSha256Service';
export type ImprovementTrajectoryEventKind='PLAN'|'READ'|'EDIT'|'VALIDATE'|'REPAIR'|'REVIEW'|'PROMOTE'|'ROLLBACK';
export interface ImprovementTrajectoryEvent{sequence:number;kind:ImprovementTrajectoryEventKind;path?:string;inputSha256?:string;outputSha256?:string;result:'PASS'|'FAIL'|'INFO';reason?:string;recordedAt:number;}
export interface ImprovementTrajectory{trajectoryId:string;taskId:string;baseRevision:string;events:ImprovementTrajectoryEvent[];status:'ACTIVE'|'PASSED'|'FAILED'|'ROLLED_BACK';trajectorySha256:string;}
class AutonomousImprovementTrajectoryService{
 private rows=new Map<string,ImprovementTrajectory>();
 start(taskId:string,baseRevision:string):ImprovementTrajectory{const seed={taskId,baseRevision,createdAt:Date.now()};const row:ImprovementTrajectory={trajectoryId:`TRAJ-${canonicalSha256Object(seed).slice(0,24)}`,taskId,baseRevision,events:[],status:'ACTIVE',trajectorySha256:''};row.trajectorySha256=this.hash(row);this.rows.set(row.trajectoryId,row);return structuredClone(row);}
 append(id:string,event:Omit<ImprovementTrajectoryEvent,'sequence'|'recordedAt'>):ImprovementTrajectory{const row=this.required(id);if(row.status!=='ACTIVE')throw new Error('TRAJECTORY_NOT_ACTIVE');row.events.push({...event,sequence:row.events.length+1,recordedAt:Date.now()});row.trajectorySha256=this.hash(row);return structuredClone(row);}
 finish(id:string,status:'PASSED'|'FAILED'|'ROLLED_BACK'):ImprovementTrajectory{const row=this.required(id);row.status=status;row.trajectorySha256=this.hash(row);return structuredClone(row);}
 replayPlan(id:string){const row=this.required(id);return{trajectoryId:id,baseRevision:row.baseRevision,steps:row.events.map(({sequence,kind,path,inputSha256,outputSha256,result,reason})=>({sequence,kind,path,inputSha256,outputSha256,result,reason})),replaySha256:canonicalSha256Object({baseRevision:row.baseRevision,events:row.events.map(({recordedAt,...event})=>event)})};}
 detectFailures(id:string){const row=this.required(id);const failures:string[]=[];for(const event of row.events){if(event.result==='FAIL')failures.push(`FAILED_STEP:${event.sequence}:${event.kind}`);if(event.kind==='EDIT'&&!event.outputSha256)failures.push(`EDIT_OUTPUT_HASH_MISSING:${event.sequence}`);if((event.kind==='VALIDATE'||event.kind==='PROMOTE')&&!event.reason)failures.push(`EVIDENCE_REASON_MISSING:${event.sequence}`);}return[...new Set(failures)];}
 private hash(row:ImprovementTrajectory){return canonicalSha256Object({trajectoryId:row.trajectoryId,taskId:row.taskId,baseRevision:row.baseRevision,events:row.events,status:row.status});}
 private required(id:string){const row=this.rows.get(id);if(!row)throw new Error('TRAJECTORY_NOT_FOUND');return row;}
}
export const autonomousImprovementTrajectoryService=new AutonomousImprovementTrajectoryService();
