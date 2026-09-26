/** 第54章: 能動知覚・状況認識OS。常時監視せず、許可されたイベントだけを状況モデルへ統合する。 */
import { storageService } from './storageService';
import { systemLogger } from './systemLogger';
export type PerceptionSource='APP'|'FILE'|'NOTIFICATION'|'AUDIO'|'CAMERA'|'DEVICE'|'TASK';
export interface PerceptionEvent { id:string; source:PerceptionSource; type:string; summary:string; changed:boolean; importance:number; createdAt:number; permission:string; }
export interface SituationModel { updatedAt:number; activeSources:PerceptionSource[]; recentEvents:PerceptionEvent[]; taskSummary?:string; deviceState?:Record<string,string|number|boolean>; }
const KEY='miki_situation_model_v1';
class SituationalAwarenessService {
 private model:SituationModel={updatedAt:0,activeSources:[],recentEvents:[]};
 private allowed=new Set<PerceptionSource>();
 initialize(){try{const r=storageService.getItem(KEY);if(r)this.model=JSON.parse(r);}catch{} }
 setPermission(source:PerceptionSource,allowed:boolean){allowed?this.allowed.add(source):this.allowed.delete(source);}
 ingest(e:Omit<PerceptionEvent,'id'|'createdAt'|'permission'>):PerceptionEvent|undefined{if(!this.allowed.has(e.source))return undefined;const ev={...e,id:`PER-${Date.now()}-${this.model.recentEvents.length + 1}`,createdAt:Date.now(),permission:e.source};this.model={...this.model,updatedAt:Date.now(),activeSources:[...new Set([...this.model.activeSources,e.source])],recentEvents:[...this.model.recentEvents,ev].filter(x=>Date.now()-x.createdAt<7*86400000).slice(-100)};try{storageService.setItem(KEY,JSON.stringify(this.model));}catch{};systemLogger.info('PERCEPTION',`状況イベント受理: ${e.source}/${e.type}`);return ev;}
 getModel(){return JSON.parse(JSON.stringify(this.model)) as SituationModel;}
 getMeaningfulChanges(){return this.model.recentEvents.filter(e=>e.changed&&e.importance>=60);}
}
export const situationalAwarenessService=new SituationalAwarenessService();
