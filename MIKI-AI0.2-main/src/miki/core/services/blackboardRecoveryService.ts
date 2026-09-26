import { taskBlackboardService } from './taskBlackboardService';
export interface RecoverySummary { recovered:string[]; preservedPaused:string[]; terminal:string[]; }
class BlackboardRecoveryService{
 recoverInterrupted():RecoverySummary{const recovered:string[]=[];const preservedPaused:string[]=[];const terminal:string[]=[];for(const task of taskBlackboardService.list(200)){if(task.status==='ROUTING'){taskBlackboardService.pause(task.taskId,'APPLICATION_RESTART_RECOVERY');recovered.push(task.taskId);}else if(task.status==='PAUSED'){preservedPaused.push(task.taskId);}else if(task.status==='COMPLETED'||task.status==='FAILED'||task.status==='CANCELLED'){terminal.push(task.taskId);}}return {recovered,preservedPaused,terminal};}
}
export const blackboardRecoveryService=new BlackboardRecoveryService();
