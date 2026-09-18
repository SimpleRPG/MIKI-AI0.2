import { storageService } from '../../../services/storageService';
import type { MikiDomain } from './crossDomainCirculationService';
export interface NegativeKnowledgeRecord { fingerprint:string; domain:MikiDomain; command:string; reason:string; failures:number; firstSeenAt:number; lastSeenAt:number; retryAfter:number; alternativeDomains:MikiDomain[]; }
const KEY='miki_negative_knowledge_v1';
class NegativeKnowledgeService{
 private records=new Map<string,NegativeKnowledgeRecord>();
 constructor(){this.load();}
 fingerprint(domain:MikiDomain,command:string,reason:string):string{let h=2166136261;for(const ch of `${domain}|${command}|${reason}`.toLowerCase()){h^=ch.charCodeAt(0);h=Math.imul(h,16777619);}return `NEG-${(h>>>0).toString(16).padStart(8,'0')}`;}
 record(domain:MikiDomain,command:string,reason:string,alternatives:MikiDomain[]=[]):NegativeKnowledgeRecord{const now=Date.now();const fingerprint=this.fingerprint(domain,command,reason);const old=this.records.get(fingerprint);const failures=(old?.failures||0)+1;const next={fingerprint,domain,command,reason,failures,firstSeenAt:old?.firstSeenAt||now,lastSeenAt:now,retryAfter:now+Math.min(86400000,failures*900000),alternativeDomains:[...new Set(alternatives)]};this.records.set(fingerprint,next);this.save();return {...next,alternativeDomains:[...next.alternativeDomains]};}
 canRetry(domain:MikiDomain,command:string,reason:string):boolean{const item=this.records.get(this.fingerprint(domain,command,reason));return !item||Date.now()>=item.retryAfter;}
 list():NegativeKnowledgeRecord[]{return [...this.records.values()].sort((a,b)=>b.lastSeenAt-a.lastSeenAt).map(x=>({...x,alternativeDomains:[...x.alternativeDomains]}));}
 private save():void{storageService.setItem(KEY,JSON.stringify(this.list().slice(0,500)));}
 private load():void{try{const raw=storageService.getItem(KEY);const all=raw?JSON.parse(raw):[];if(Array.isArray(all))for(const item of all)this.records.set(item.fingerprint,item);}catch{this.records.clear();}}
}
export const negativeKnowledgeService=new NegativeKnowledgeService();
