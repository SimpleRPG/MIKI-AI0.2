import { requestTypeCompilerService } from './requestTypeCompilerService';
import { storageService } from './storageService';
import { systemLogger } from './systemLogger';

export type PersonalApiInputKind = 'NATURAL_LANGUAGE' | 'REST' | 'ANDROID_INTENT' | 'FILE' | 'SCHEDULE';
export interface PersonalApiRequest { kind: PersonalApiInputKind; payload: unknown; requestId?: string; authToken?: string; permission?: string; privacyClass?: 'PUBLIC'|'PRIVATE'|'CONFIDENTIAL'; }
export interface PersonalApiAudit { requestId: string; kind: PersonalApiInputKind; accepted: boolean; reason: string; timestamp: number; }

const AUDIT_KEY='miki_personal_api_audit_v1';
export class PersonalApiGatewayService {
  private audit: PersonalApiAudit[]=[];
  constructor(){ try{ const r=storageService.getItem(AUDIT_KEY); const p=r?JSON.parse(r):[]; if(Array.isArray(p))this.audit=p;}catch{} }
  private save(){storageService.setItem(AUDIT_KEY,JSON.stringify(this.audit.slice(-500)));}
  public normalize(input: PersonalApiRequest): { requestId:string; kind:PersonalApiInputKind; text:string } {
    const raw = typeof input.payload === 'string' ? input.payload : JSON.stringify(input.payload ?? '');
    const compiled=requestTypeCompilerService.compile(raw);
    return {requestId: input.requestId || compiled.requestId, kind:input.kind, text:raw};
  }
  public authorize(input: PersonalApiRequest): {allowed:boolean; reason:string} {
    if (input.kind==='REST' && input.authToken !== 'LOCAL_TRUSTED') return {allowed:false, reason:'AUTH_REQUIRED'};
    if (input.privacyClass==='CONFIDENTIAL' && input.kind==='REST') return {allowed:false, reason:'CONFIDENTIAL_REST_BLOCKED_BY_DEFAULT'};
    if (input.kind==='ANDROID_INTENT' && !input.permission) return {allowed:false, reason:'ANDROID_PERMISSION_REQUIRED'};
    return {allowed:true, reason:'BOUNDARY_ACCEPTED'};
  }
  public receive(input: PersonalApiRequest): {accepted:boolean; requestId:string; reason:string} {
    const normalized=this.normalize(input); const auth=this.authorize(input);
    const row={requestId:normalized.requestId,kind:input.kind,accepted:auth.allowed,reason:auth.reason,timestamp:Date.now()};
    this.audit.unshift(row); this.save();
    systemLogger.info('CHAT', `[第67章 Personal API] ${input.kind} ${normalized.requestId}: ${auth.reason}`);
    return {accepted:auth.allowed, requestId:normalized.requestId, reason:auth.reason};
  }
  public getAudit(): PersonalApiAudit[]{return [...this.audit];}
}
export const personalApiGatewayService=new PersonalApiGatewayService();
