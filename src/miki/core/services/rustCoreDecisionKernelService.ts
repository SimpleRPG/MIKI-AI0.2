import{registerPlugin}from'@capacitor/core';
import type{BlackboardTask}from'./taskBlackboardService';
import type{GoalConflictDecision}from'./adaptiveRoutePlannerService';
interface NativeCoreDecisionPlugin{decideCoreGoals(input:{now:number;goals:Array<Record<string,unknown>>}):Promise<GoalConflictDecision&{engine:'RUST';api_version:number}>;}
const NativeCoreDecision=registerPlugin<NativeCoreDecisionPlugin>('MIKINativeRunner');
class RustCoreDecisionKernelService{
 async resolveGoalConflicts(task:BlackboardTask):Promise<GoalConflictDecision>{
  const payloadEntry=task.entries.find(entry=>entry.kind==='INPUT'&&entry.key==='payload');const input=payloadEntry?.value&&typeof payloadEntry.value==='object'&&!Array.isArray(payloadEntry.value)?payloadEntry.value as Record<string,unknown>:{};const raw=Array.isArray(input.goalCandidates)?input.goalCandidates:[];
  const goals:Array<Record<string,unknown>>=[{id:'CURRENT_TASK_GOAL',goal:task.goal,priority:100,foreground:String(input.kind||'')==='USER_REQUEST'||input.foreground===true,safety_required:false,permission_granted:true,deadline_at:null,depends_on:[],conflicts_with:[],status:'ACTIVE'}];
  for(const item of raw){if(!item||typeof item!=='object')continue;const row=item as Record<string,unknown>;const id=String(row.id||'').trim(),goal=String(row.goal||'').trim();if(!id||!goal||id==='CURRENT_TASK_GOAL')continue;goals.push({id,goal,priority:Number(row.priority)||0,foreground:row.foreground===true,safety_required:row.safetyRequired===true,permission_granted:row.permissionGranted!==false,deadline_at:Number.isFinite(Number(row.deadlineAt))?Number(row.deadlineAt):null,depends_on:Array.isArray(row.dependsOn)?row.dependsOn.map(String):[],conflicts_with:Array.isArray(row.conflictsWith)?row.conflictsWith.map(String):[],status:String(row.status||'ACTIVE')});}
  const result=await NativeCoreDecision.decideCoreGoals({now:Date.now(),goals});if(result.engine!=='RUST')throw new Error('RUST_CORE_DECISION_ENGINE_REQUIRED');return{selectedGoalId:result.selectedGoalId,selectedGoal:result.selectedGoal,conflictDetected:result.conflictDetected,pausedGoalIds:result.pausedGoalIds,blockedGoalIds:result.blockedGoalIds,decisions:result.decisions};
 }
}
export const rustCoreDecisionKernelService=new RustCoreDecisionKernelService();
