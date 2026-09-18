export type ImprovementRunState='IDLE'|'RUNNING'|'FAILED'|'COMPLETED';
export interface ImprovementRunSnapshot { state:ImprovementRunState; cycle:number; maxCycles:number; lastError?:string; persisted:boolean; }
export class SelfImprovementOperationalGuardService {
 private snapshot:ImprovementRunSnapshot={state:'IDLE',cycle:0,maxCycles:1,persisted:false};
 begin(maxCycles:number){if(this.snapshot.state==='RUNNING')return {ok:false,reason:'REENTRY_BLOCKED'} as const;this.snapshot={state:'RUNNING',cycle:0,maxCycles:Math.max(1,maxCycles),persisted:false};return {ok:true} as const;}
 nextCycle(){if(this.snapshot.state!=='RUNNING'||this.snapshot.cycle>=this.snapshot.maxCycles)return false;this.snapshot.cycle++;return true;}
 markPersisted(){if(this.snapshot.state==='RUNNING')this.snapshot.persisted=true;}
 complete(){if(this.snapshot.state!=='RUNNING'||!this.snapshot.persisted)return false;this.snapshot.state='COMPLETED';return true;}
 fail(error:string){this.snapshot.state='FAILED';this.snapshot.lastError=error;return this.getSnapshot();}
 reset(){this.snapshot={state:'IDLE',cycle:0,maxCycles:1,persisted:false};}
 getSnapshot(){return {...this.snapshot};}
}
export const selfImprovementOperationalGuardService=new SelfImprovementOperationalGuardService();
