import { storageService } from '../../../services/storageService';
export interface UserFeedbackGovernanceRecord { id:string; subjectType:'CHAT_RESPONSE'|'PAIR_REVIEW'; subjectId:string; polarity:'POSITIVE'|'NEGATIVE'|'PARTIAL'|'NEUTRAL'; userText?:string; reason:string; source:'THUMBS'|'PAIR_REVIEW'; decision:'EVIDENCE_ONLY'|'REQUIRES_CORROBORATION'; finalStateChanged:false; observedAt:number; }
const KEY='miki_user_feedback_governance_records_v1';
class UserFeedbackGovernanceService {
 private records:UserFeedbackGovernanceRecord[]=[];
 constructor(){try{const raw=storageService.getItem(KEY);const parsed=raw?JSON.parse(raw):[];if(Array.isArray(parsed))this.records=parsed;}catch{this.records=[];}}
 record(input:Omit<UserFeedbackGovernanceRecord,'id'|'decision'|'finalStateChanged'|'observedAt'>):UserFeedbackGovernanceRecord{
  const record:UserFeedbackGovernanceRecord={...input,id:`UFG-${Date.now()}-${this.records.length+1}`,decision:input.polarity==='NEUTRAL'?'EVIDENCE_ONLY':'REQUIRES_CORROBORATION',finalStateChanged:false,observedAt:Date.now()};
  this.records.push(record);this.records=this.records.slice(-5000);storageService.setItem(KEY,JSON.stringify(this.records));return record;
 }
 list(subjectId?:string){return this.records.filter(record=>!subjectId||record.subjectId===subjectId).map(record=>({...record}));}
}
export const userFeedbackGovernanceService=new UserFeedbackGovernanceService();
