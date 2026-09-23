import { storageService } from '../../../services/storageService';
import { coreTaskIngressService } from './coreTaskIngressService';
import { canonicalSha256Object } from './canonicalSha256Service';
import { setSearxngBaseUrlItem } from '../../../services/api';
export type ExternalConnectionId='termux'|'searxng'|'github'|'gemini'|'teacher'|'embedding'|'backend';
export type ExternalConnectionStatus='DISABLED'|'NOT_CONFIGURED'|'CHECKING'|'AVAILABLE'|'DEGRADED'|'AUTHENTICATION_FAILED'|'PERMISSION_DENIED'|'ENDPOINT_NOT_FOUND'|'CONNECTION_REFUSED'|'TIMEOUT'|'RATE_LIMITED'|'INVALID_RESPONSE'|'ENVIRONMENT_BLOCKED'|'UNKNOWN';
export interface ExternalConnectionConfig {id:ExternalConnectionId;enabled:boolean;name:string;baseUrl:string;path:string;timeoutMs:number;retryCount:number;inheritTermux:boolean;secretRef?:string;model?:string;repositoryUrl?:string;branch?:string;roles?:Array<'REVIEWER'|'UNKNOWN_COMPONENT_AUTHOR'|'TEACHER'>;}
export interface ExternalConnectionView {config:ExternalConnectionConfig;status:ExternalConnectionStatus;lastCheckedAt?:number;failureStage?:string;sanitizedMessage?:string;endpointFingerprint?:string;coreTaskId?:string;}
const CONFIG_KEY='miki_external_connection_config_v1';const SECRET_KEY='miki_external_connection_secret_refs_v1';const STATUS_KEY='miki_external_connection_status_v1';
const defaults:ExternalConnectionConfig[]=[
{id:'termux',enabled:false,name:'Termux Bridge',baseUrl:'',path:'/health',timeoutMs:8000,retryCount:1,inheritTermux:false},
{id:'searxng',enabled:true,name:'SearXNG',baseUrl:'http://127.0.0.1:8888',path:'/search',timeoutMs:12000,retryCount:1,inheritTermux:true},
{id:'github',enabled:false,name:'GitHub',baseUrl:'',path:'',timeoutMs:15000,retryCount:1,inheritTermux:true,repositoryUrl:'',branch:'main'},
{id:'gemini',enabled:false,name:'Gemini API',baseUrl:'',path:'',timeoutMs:30000,retryCount:1,inheritTermux:false,model:'',roles:['REVIEWER']},
{id:'teacher',enabled:false,name:'外部教師API',baseUrl:'',path:'/health',timeoutMs:30000,retryCount:1,inheritTermux:false},
{id:'embedding',enabled:false,name:'Embedding Server',baseUrl:'',path:'/health',timeoutMs:15000,retryCount:1,inheritTermux:true},
{id:'backend',enabled:true,name:'MIKI-AI Backend',baseUrl:'',path:'/api/health',timeoutMs:8000,retryCount:1,inheritTermux:false},
];
class ExternalConnectionUiService{
 list():ExternalConnectionView[]{const configs=this.read<ExternalConnectionConfig[]>(CONFIG_KEY,defaults);const statuses=this.read<Record<string,Partial<ExternalConnectionView>>>(STATUS_KEY,{});return configs.map(config=>{return {config:{...config,roles:config.roles?[...config.roles]:undefined},status:config.enabled?(this.configured(config)?'UNKNOWN':'NOT_CONFIGURED'):'DISABLED',...(statuses[config.id]||{})};});}
 async save(config:ExternalConnectionConfig,secret?:string):Promise<{coreTaskId:string;configReceiptId:string;secretReceiptId?:string}>{this.validate(config);const result=await coreTaskIngressService.submit({kind:'USER_REQUEST',goal:`${config.name}の外部接続設定を保存する`,source:'conversation',payload:{operation:'SAVE_EXTERNAL_CONNECTION_CONFIG',connectionId:config.id,config:this.sanitizeConfig(config)},maxCycles:18});if(result.task.status!=='COMPLETED')throw new Error('CORE_CONFIG_SAVE_NOT_COMPLETED');const rows=this.read<ExternalConnectionConfig[]>(CONFIG_KEY,defaults);storageService.setItem(CONFIG_KEY,JSON.stringify(rows.map(row=>row.id===config.id?{...config,enabled:config.id==='backend'||this.configured({...config,secretRef:secret?`${config.id.toUpperCase()}_SECRET_REF`:row.secretRef}),secretRef:secret?`${config.id.toUpperCase()}_SECRET_REF`:row.secretRef}:row)));if(config.id==='searxng')setSearxngBaseUrlItem(config.baseUrl);let secretReceiptId:string|undefined;if(secret){const refs=this.read<Record<string,{set:boolean;updatedAt:number}>>(SECRET_KEY,{});refs[config.id]={set:true,updatedAt:Date.now()};storageService.setItem(SECRET_KEY,JSON.stringify(refs));secretReceiptId=`SEC-${canonicalSha256Object({id:config.id,at:refs[config.id].updatedAt}).slice(0,20)}`;}return {coreTaskId:result.task.taskId,configReceiptId:`CFG-${canonicalSha256Object(this.sanitizeConfig(config)).slice(0,20)}`,secretReceiptId};}
 async test(id:ExternalConnectionId):Promise<ExternalConnectionView>{const current=this.list().find(item=>item.config.id===id);if(!current)throw new Error('CONNECTION_NOT_FOUND');this.setStatus(id,{status:'CHECKING',lastCheckedAt:Date.now()});const validation=this.validate(current.config,false);const result=await coreTaskIngressService.submit({kind:'SYSTEM_TASK',goal:`${current.config.name}の非破壊接続診断を行う`,source:'conversation',payload:{operation:'TEST_EXTERNAL_CONNECTION',connectionId:id,config:this.sanitizeConfig(current.config),destructive:false},maxCycles:18});const status:ExternalConnectionStatus=!validation?'NOT_CONFIGURED':result.task.status==='COMPLETED'?'AVAILABLE':'UNKNOWN';this.setStatus(id,{status,lastCheckedAt:Date.now(),failureStage:status==='AVAILABLE'?undefined:'CORE_DIAGNOSTIC',sanitizedMessage:status==='AVAILABLE'?'接続確認が完了しました':'core診断結果を確認してください',endpointFingerprint:canonicalSha256Object({baseUrl:current.config.baseUrl,path:current.config.path}).slice(0,16),coreTaskId:result.task.taskId});return this.list().find(item=>item.config.id===id)!;}
 exportSanitized():string{return JSON.stringify({formatVersion:1,connections:this.list().map(item=>({config:this.sanitizeConfig(item.config),status:item.status,lastCheckedAt:item.lastCheckedAt,failureStage:item.failureStage}))},null,2);}
 private sanitizeConfig(config:ExternalConnectionConfig){const {secretRef,...safe}=config;return {...safe,secretRef:secretRef?'SET':undefined,baseUrl:this.rejectCredentialUrl(config.baseUrl)};}
 private configured(config:ExternalConnectionConfig){return config.id==='github'?Boolean(config.repositoryUrl):config.id==='gemini'?Boolean(config.model&&config.secretRef):Boolean(config.baseUrl||config.id==='backend');}
 private validate(config:ExternalConnectionConfig,throwError=true){let ok=true;if(config.enabled&&!this.configured(config))ok=false;if(config.timeoutMs<1000||config.retryCount<0)ok=false;try{this.rejectCredentialUrl(config.baseUrl);if(config.repositoryUrl)this.rejectCredentialUrl(config.repositoryUrl);}catch(error){if(throwError)throw error;ok=false;}if(!ok&&throwError)throw new Error('CONNECTION_CONFIG_INVALID');return ok;}
 private rejectCredentialUrl(value:string){if(!value)return value;const decoded=decodeURIComponent(value);if(/(?:api[_-]?key|token|password|passwd|secret)=/i.test(decoded)||/https?:\/\/[^/@:]+:[^/@]+@/i.test(decoded))throw new Error('CREDENTIAL_IN_URL_REJECTED');return value;}
 private setStatus(id:ExternalConnectionId,value:Partial<ExternalConnectionView>){const rows=this.read<Record<string,Partial<ExternalConnectionView>>>(STATUS_KEY,{});rows[id]=value;storageService.setItem(STATUS_KEY,JSON.stringify(rows));}
 private read<T>(key:string,fallback:T):T{
  try{
    const raw=storageService.getItem(key);
    if(raw===null||raw===undefined||raw==='')return fallback;
    if(typeof raw==='string')return JSON.parse(raw) as T;
    return raw as T;
  }catch{return fallback;}
 }
}
export const externalConnectionUiService=new ExternalConnectionUiService();
