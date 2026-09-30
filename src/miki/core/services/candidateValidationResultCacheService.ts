import { storageService } from '../../../services/storageService';
export interface CachedValidationResult { key:string; body:Record<string,unknown>; savedAt:number; }
const STORAGE_KEY='miki_candidate_validation_result_cache_v1';
const TTL_MS=24*60*60*1000;
class CandidateValidationResultCacheService {
  private rows:CachedValidationResult[]=[];
  constructor(){this.load();}
  get(key:string):Record<string,unknown>|undefined {const now=Date.now();this.rows=this.rows.filter(row=>now-row.savedAt<=TTL_MS);const row=this.rows.find(item=>item.key===key);if(!row){this.save();return undefined;}return structuredClone(row.body);}
  put(key:string,body:Record<string,unknown>):void {if(body.passed!==true)return;this.rows=this.rows.filter(row=>row.key!==key);this.rows.push({key,body:structuredClone(body),savedAt:Date.now()});this.rows=this.rows.slice(-50);this.save();}
  clear():void {this.rows=[];this.save();}
  private save():void {storageService.setItem(STORAGE_KEY,JSON.stringify(this.rows));}
  private load():void {try{const raw=storageService.getItem(STORAGE_KEY);this.rows=raw?JSON.parse(raw):[];}catch{this.rows=[];}}
}
export const candidateValidationResultCacheService=new CandidateValidationResultCacheService();
