import { storageService } from '../../../services/storageService';
export type ImprovementDirection='BALANCED'|'CODE_QUALITY'|'CONVERSATION'|'VBA_EXPERTISE'|'RESEARCH'|'MOBILE_STABILITY';
export interface ImprovementDirectionPolicy { direction:ImprovementDirection; label:string; keywords:string[]; preferredKinds:string[]; priorityBoost:number; updatedAt:number; }
const KEY='miki_self_improvement_direction_v1';
const DEFINITIONS:Record<ImprovementDirection,Omit<ImprovementDirectionPolicy,'updatedAt'>>={
 BALANCED:{direction:'BALANCED',label:'バランス',keywords:[],preferredKinds:[],priorityBoost:0},
 CODE_QUALITY:{direction:'CODE_QUALITY',label:'コードの書き方・品質',keywords:['code','コード','lint','type','test','実装','修正','構文'],preferredKinds:['EXECUTION_FAILURE','CAPABILITY_GAP'],priorityBoost:20},
 CONVERSATION:{direction:'CONVERSATION',label:'会話・理解力',keywords:['会話','回答','訂正','意図','文脈','conversation'],preferredKinds:['KNOWLEDGE_GAP','CLAIM_CONTRADICTION'],priorityBoost:20},
 VBA_EXPERTISE:{direction:'VBA_EXPERTISE',label:'VBA解析・修復',keywords:['vba','macro','マクロ','excel','標準モジュール','構文検証'],preferredKinds:['EXECUTION_FAILURE','CAPABILITY_GAP','KNOWLEDGE_GAP'],priorityBoost:25},
 RESEARCH:{direction:'RESEARCH',label:'ネット調査・未知解決',keywords:['調査','検索','未知','evidence','github','web'],preferredKinds:['KNOWLEDGE_GAP','CLAIM_CONTRADICTION'],priorityBoost:20},
 MOBILE_STABILITY:{direction:'MOBILE_STABILITY',label:'スマホ安定性',keywords:['android','mobile','スマホ','battery','storage','端末'],preferredKinds:['EXECUTION_FAILURE','STALLED_TASK','DOMAIN_DISCONNECTED'],priorityBoost:20},
};
class SelfImprovementDirectionService{
 private policy:ImprovementDirectionPolicy;
 constructor(){this.policy=this.load();}
 setDirection(direction:ImprovementDirection):ImprovementDirectionPolicy{this.policy={...DEFINITIONS[direction],updatedAt:Date.now()};storageService.setItem(KEY,JSON.stringify(this.policy));return this.getPolicy();}
 getPolicy():ImprovementDirectionPolicy{return {...this.policy,keywords:[...this.policy.keywords],preferredKinds:[...this.policy.preferredKinds]};}
 score(kind:string,title:string,detail:string,basePriority:number):number{if(this.policy.direction==='BALANCED')return basePriority;const text=`${title} ${detail}`.toLowerCase();const kindMatch=this.policy.preferredKinds.includes(kind);const keywordMatch=this.policy.keywords.some(keyword=>text.includes(keyword.toLowerCase()));return Math.min(100,basePriority+(kindMatch?this.policy.priorityBoost:0)+(keywordMatch?10:0));}
 private load():ImprovementDirectionPolicy{try{const raw=storageService.getItem(KEY);if(raw){const parsed=JSON.parse(raw) as ImprovementDirectionPolicy;if(parsed.direction in DEFINITIONS)return {...DEFINITIONS[parsed.direction],updatedAt:parsed.updatedAt||Date.now()};}}catch{}return {...DEFINITIONS.BALANCED,updatedAt:Date.now()};}
}
export const selfImprovementDirectionService=new SelfImprovementDirectionService();
