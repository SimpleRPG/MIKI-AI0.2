/** 第65章: 不明点を原資料→コード→テスト→Web→ツール→ユーザー確認の順で解消候補化する。 */
export type ResolutionRoute='SOURCE'|'CODE'|'TEST'|'WEB'|'TOOL'|'USER'|'STOP';
export interface UnknownResolution{id:string;question:string;routes:ResolutionRoute[];budget:number;attempts:number;status:'OPEN'|'RESOLVED'|'BLOCKED';answer?:string;createdAt:number;}
import {storageService} from './storageService';
const KEY='miki_unknown_resolution_v1';
class UnknownResolutionService{private xs:UnknownResolution[]=[];constructor(){try{const r=storageService.getItem(KEY);if(r)this.xs=JSON.parse(r)}catch{}}
 private save(){try{storageService.setItem(KEY,JSON.stringify(this.xs.slice(-300)))}catch{}}
 open(question:string,budget=6){const x={id:`UNK-${Date.now()}`,question,routes:['SOURCE','CODE','TEST','WEB','TOOL','USER','STOP'] as ResolutionRoute[],budget,attempts:0,status:'OPEN' as const,createdAt:Date.now()};this.xs.push(x);this.save();return x;}
 attempt(id:string,route:ResolutionRoute,result?:string){const x=this.xs.find(y=>y.id===id);if(!x)return;if(x.status!=='OPEN')return;x.attempts++;if(result){x.answer=result;x.status='RESOLVED'}else if(x.attempts>=x.budget){x.status='BLOCKED'}this.save();return x;}
 shouldAskUser(x:UnknownResolution){return x.status==='OPEN'&&x.routes.includes('USER')&&x.attempts>=4&&x.attempts<x.budget;}}
export const unknownResolutionService=new UnknownResolutionService();
