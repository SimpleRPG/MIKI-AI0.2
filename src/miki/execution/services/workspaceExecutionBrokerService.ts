export interface WorkspaceExecutionRequest {commandId:string;executable:string;args:string[];cwd:string;environment:Record<string,string>;networkPolicy:'NONE'|'LOOPBACK';timeoutMs:number;outputLimitBytes:number;coreDecisionId:string;trustStatus:string;shell?:boolean;}
export interface WorkspaceExecutionDecision {accepted:boolean;code:string;}
const ALLOWED=new Set(['node','npm','npx','git','python','python3','java','gradle','./gradlew']);
const FORBIDDEN_ARGUMENTS=[/(^|\s)(?:sudo|su)(?:\s|$)/i,/postinstall/i,/force-push/i,/--force-with-lease/i,/(^|\s)--force(?:\s|$)/i,/git[- ]hook/i,/\.\.[\\/]/,/^[\\/]/,/^[A-Za-z]:[\\/]/];
const FORBIDDEN_ENVIRONMENT=/KEY|TOKEN|SECRET|PASSWORD|PASSWD|AUTHORIZATION|COOKIE|PRIVATE/i;
const CONTROL_CHARACTER=/[\u0000-\u001f\u007f]/;
export const workspaceExecutionBrokerService={
 authorize(request:WorkspaceExecutionRequest):WorkspaceExecutionDecision{
  if(!request.commandId.trim())return {accepted:false,code:'COMMAND_ID_REQUIRED'};
  if(!request.coreDecisionId.trim())return {accepted:false,code:'CORE_DECISION_REQUIRED'};
  if(request.trustStatus!=='TRUSTED_FOR_BUILD'&&request.trustStatus!=='TRUSTED_FOR_PREVIEW')return {accepted:false,code:'WORKSPACE_TRUST_REQUIRED'};
  if(request.shell===true)return {accepted:false,code:'SHELL_TRUE_FORBIDDEN'};
  if(!ALLOWED.has(request.executable))return {accepted:false,code:'EXECUTABLE_NOT_ALLOWED'};
  if(!request.cwd.trim())return {accepted:false,code:'CWD_REQUIRED'};
  if(CONTROL_CHARACTER.test(request.cwd)||request.args.some(value=>CONTROL_CHARACTER.test(value)))return {accepted:false,code:'CONTROL_CHARACTER_FORBIDDEN'};
  if(request.args.some(value=>FORBIDDEN_ARGUMENTS.some(pattern=>pattern.test(value))))return {accepted:false,code:'ARGUMENT_FORBIDDEN'};
  if(Object.keys(request.environment).some(key=>FORBIDDEN_ENVIRONMENT.test(key)))return {accepted:false,code:'SECRET_ENVIRONMENT_FORBIDDEN'};
  if(Object.values(request.environment).some(value=>/\bBearer\s+|(?:api[_-]?key|token|secret|password)\s*[=:]/i.test(value)))return {accepted:false,code:'SECRET_VALUE_FORBIDDEN'};
  if(request.networkPolicy==='NONE'&&request.args.some(value=>/https?:\/\//i.test(value)))return {accepted:false,code:'NETWORK_ARGUMENT_FORBIDDEN'};
  if(request.timeoutMs<1||request.timeoutMs>600000)return {accepted:false,code:'TIMEOUT_INVALID'};
  if(request.outputLimitBytes<1024||request.outputLimitBytes>50*1024*1024)return {accepted:false,code:'OUTPUT_LIMIT_INVALID'};
  return {accepted:true,code:'AUTHORIZED'};
 }
};
