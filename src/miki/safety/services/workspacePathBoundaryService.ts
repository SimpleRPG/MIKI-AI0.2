export interface WorkspaceArchiveLimits {maxFiles:number;maxTotalBytes:number;maxSingleFileBytes:number;allowedExtensions:string[];allowNestedArchives:boolean;}
export interface WorkspacePathDecision {allowed:boolean;code:string;normalizedPath?:string;}
const encodedTraversal=/%2e%2e|%2f|%5c/i;
export const workspacePathBoundaryService={
 validateRelativePath(input:string,limits:WorkspaceArchiveLimits):WorkspacePathDecision{
  const raw=input.trim();
  if(!raw)return {allowed:false,code:'PATH_REQUIRED'};
  if(encodedTraversal.test(raw))return {allowed:false,code:'ENCODED_TRAVERSAL_REJECTED'};
  const normalized=raw.replace(/\\/g,'/');
  if(normalized.startsWith('/')||/^[A-Za-z]:\//.test(normalized))return {allowed:false,code:'ABSOLUTE_PATH_REJECTED'};
  const parts=normalized.split('/');
  if(parts.some(x=>x==='..'||x===''))return {allowed:false,code:'PATH_TRAVERSAL_REJECTED'};
  const lower=normalized.toLowerCase();
  const ext=lower.includes('.')?`.${lower.split('.').pop()}`:'';
  if(limits.allowedExtensions.length&&!limits.allowedExtensions.includes(ext))return {allowed:false,code:'EXTENSION_NOT_ALLOWED'};
  if(!limits.allowNestedArchives&&['.zip','.7z','.rar','.tar','.gz'].includes(ext))return {allowed:false,code:'NESTED_ARCHIVE_REJECTED'};
  return {allowed:true,code:'ALLOWED',normalizedPath:normalized};
 },
 validateArchive(count:number,totalBytes:number,largestBytes:number,limits:WorkspaceArchiveLimits):WorkspacePathDecision{
  if(count>limits.maxFiles)return {allowed:false,code:'FILE_COUNT_LIMIT'};
  if(totalBytes>limits.maxTotalBytes)return {allowed:false,code:'TOTAL_SIZE_LIMIT'};
  if(largestBytes>limits.maxSingleFileBytes)return {allowed:false,code:'SINGLE_FILE_SIZE_LIMIT'};
  return {allowed:true,code:'ALLOWED'};
 }
};
