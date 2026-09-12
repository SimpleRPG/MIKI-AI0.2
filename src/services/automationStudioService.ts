/** 第56章: 実演・説明された定型作業をワークフロー契約へ変換する。 */
import {storageService} from './storageService';
export type WorkflowStage='OBSERVED'|'CANDIDATE'|'VIRTUAL_REPLAY'|'USER_CONFIRMED'|'LIMITED'|'STABLE'|'REJECTED';
export interface WorkflowStep{order:number;action:string;input?:string;output?:string;failureConditions:string[];reversible:boolean;}
export interface WorkflowDefinition{id:string;goal:string;steps:WorkflowStep[];variables:string[];rollback:string[];validation:string[];stage:WorkflowStage;createdAt:number;updatedAt:number;observations:number;virtualPasses:number;confirmationRequired:boolean;lastValidation?:string;}
const KEY='miki_automation_workflows_v1';
const ALLOWED:Record<WorkflowStage,WorkflowStage[]>={OBSERVED:['CANDIDATE','REJECTED'],CANDIDATE:['VIRTUAL_REPLAY','REJECTED'],VIRTUAL_REPLAY:['USER_CONFIRMED','REJECTED'],USER_CONFIRMED:['LIMITED','REJECTED'],LIMITED:['STABLE','REJECTED'],STABLE:['CANDIDATE','REJECTED'],REJECTED:[]};
class AutomationStudioService{private items:WorkflowDefinition[]=[];constructor(){try{const r=storageService.getItem(KEY);if(r)this.items=JSON.parse(r)}catch{}}
 private save(){try{storageService.setItem(KEY,JSON.stringify(this.items.slice(-200)))}catch{}}
 observe(goal:string,steps:WorkflowStep[],variables:string[]=[]):WorkflowDefinition{const now=Date.now();const w={id:`WF-${now}-${this.items.length}`,goal,steps,variables,rollback:steps.filter(s=>s.reversible).map(s=>`undo:${s.action}`),validation:['全ステップ完了','期待出力一致'],stage:'OBSERVED' as WorkflowStage,createdAt:now,updatedAt:now,observations:1,virtualPasses:0,confirmationRequired:true};this.items.push(w);this.save();return w;}
 transition(id:string,stage:WorkflowStage){const w=this.items.find(x=>x.id===id);if(!w)throw new Error('WORKFLOW_NOT_FOUND');if(!ALLOWED[w.stage].includes(stage))throw new Error(`INVALID_WORKFLOW_TRANSITION:${w.stage}->${stage}`);if(stage==='STABLE'&&w.virtualPasses<1)throw new Error('VIRTUAL_REPLAY_REQUIRED');if(stage==='STABLE'&&w.confirmationRequired&&w.stage!=='LIMITED')throw new Error('LIMITED_STAGE_REQUIRED');w.stage=stage;w.updatedAt=Date.now();this.save();return w;}
 recordVirtualReplay(id:string,passed:boolean,validation:string=''):WorkflowDefinition{const w=this.items.find(x=>x.id===id);if(!w)throw new Error('WORKFLOW_NOT_FOUND');if(w.stage!=='CANDIDATE'&&w.stage!=='VIRTUAL_REPLAY')throw new Error('VIRTUAL_REPLAY_STAGE_REQUIRED');w.stage='VIRTUAL_REPLAY';if(passed)w.virtualPasses++;w.lastValidation=validation|| (passed?'PASS':'FAIL');w.updatedAt=Date.now();this.save();return w;}
 confirm(id:string,approved:boolean):WorkflowDefinition{const w=this.items.find(x=>x.id===id);if(!w)throw new Error('WORKFLOW_NOT_FOUND');if(w.stage!=='VIRTUAL_REPLAY')throw new Error('VIRTUAL_REPLAY_REQUIRED');w.stage=approved?'USER_CONFIRMED':'REJECTED';w.updatedAt=Date.now();this.save();return w;}
 findReusable(goal:string){const q=goal.toLowerCase();return this.items.filter(w=>w.stage==='STABLE'&&w.goal.toLowerCase().includes(q)).sort((a,b)=>b.updatedAt-a.updatedAt);}
 list(){return [...this.items].sort((a,b)=>b.updatedAt-a.updatedAt)} }
export const automationStudioService=new AutomationStudioService();
