import { canonicalSha256Object } from './canonicalSha256Service';

export type VisualOutputCapability='INTENT_PARSE'|'MEDIA_REFERENCE'|'PROJECT_COMPOSITION'|'RECT_CIRCLE_TEXT_CANVAS'|'INDEXED_PIXEL_DATA'|'RICH_PIXEL_CHARACTER'|'RICH_SCENE'|'PNG_BINARY'|'ANIMATED_PREVIEW';
export interface VisualCapabilityReceipt{capability:VisualOutputCapability;implemented:boolean;verified:boolean;evidence:string[];limitations:string[];}
export interface VisualOutputTruthReceipt{requested:string;receipts:VisualCapabilityReceipt[];claimLevel:'CONTRACT_ONLY'|'BASIC_RENDERABLE'|'BINARY_RENDERED'|'RICH_OUTPUT_VERIFIED';allowedClaims:string[];blockedClaims:string[];receiptSha256:string;}
export interface DeliverySizeAudit{totalBytes:number;includedBytes:number;excludedBytes:number;excludedGroups:Record<string,number>;largestIncluded:{path:string;bytes:number}[];warnings:string[];auditSha256:string;}

class VisualOutputTruthAndSizeGateService{
  evaluate(requested:string,available:Partial<Record<VisualOutputCapability,{implemented:boolean;verified:boolean;evidence?:string[];limitations?:string[]}>>):VisualOutputTruthReceipt{
    const capabilities:VisualOutputCapability[]=['INTENT_PARSE','MEDIA_REFERENCE','PROJECT_COMPOSITION','RECT_CIRCLE_TEXT_CANVAS','INDEXED_PIXEL_DATA','RICH_PIXEL_CHARACTER','RICH_SCENE','PNG_BINARY','ANIMATED_PREVIEW'];
    const receipts=capabilities.map(capability=>({capability,implemented:available[capability]?.implemented===true,verified:available[capability]?.verified===true,evidence:available[capability]?.evidence||[],limitations:available[capability]?.limitations||[]}));
    const ok=(capability:VisualOutputCapability)=>receipts.some(x=>x.capability===capability&&x.implemented&&x.verified);
    let claimLevel:VisualOutputTruthReceipt['claimLevel']='CONTRACT_ONLY';
    if(ok('RECT_CIRCLE_TEXT_CANVAS')||ok('INDEXED_PIXEL_DATA'))claimLevel='BASIC_RENDERABLE';
    if(ok('PNG_BINARY'))claimLevel='BINARY_RENDERED';
    if(ok('RICH_PIXEL_CHARACTER')&&ok('RICH_SCENE')&&ok('PNG_BINARY'))claimLevel='RICH_OUTPUT_VERIFIED';
    const allowedClaims:string[]=[];const blockedClaims:string[]=[];
    if(ok('INTENT_PARSE'))allowedClaims.push('通常会話のVisual Intentを構造化できる');
    if(ok('MEDIA_REFERENCE'))allowedClaims.push('SearXNG由来の画像Card・動画Linkを構造化できる');
    if(ok('PROJECT_COMPOSITION'))allowedClaims.push('複数Visual ProjectとRevisionを構成できる');
    if(claimLevel==='BASIC_RENDERABLE'||claimLevel==='BINARY_RENDERED'||claimLevel==='RICH_OUTPUT_VERIFIED')allowedClaims.push('基礎CanvasまたはIndexed Pixel Dataを生成できる');
    if(claimLevel==='BINARY_RENDERED'||claimLevel==='RICH_OUTPUT_VERIFIED')allowedClaims.push('実Binary Previewを生成済みと表明できる');else blockedClaims.push('完成PNG/WebPを生成済みと表明しない');
    if(claimLevel==='RICH_OUTPUT_VERIFIED')allowedClaims.push('詳細人物Spriteと探索Sceneを実出力検証済みと表明できる');else blockedClaims.push('デモ画像と同等の詳細成果物が出ると表明しない');
    const seed={requested,receipts,claimLevel,allowedClaims,blockedClaims};return{...seed,receiptSha256:canonicalSha256Object(seed)};
  }

  auditDelivery(files:{path:string;bytes:number;included:boolean;group:string}[]):DeliverySizeAudit{
    const totalBytes=files.reduce((n,x)=>n+x.bytes,0);const included=files.filter(x=>x.included);const includedBytes=included.reduce((n,x)=>n+x.bytes,0);const excludedBytes=totalBytes-includedBytes;const excludedGroups:Record<string,number>={};
    for(const file of files.filter(x=>!x.included))excludedGroups[file.group]=(excludedGroups[file.group]||0)+file.bytes;
    const warnings:string[]=[];if(includedBytes>25*1024*1024)warnings.push('DELIVERY_OVER_25_MIB');if(included.some(x=>x.path.startsWith('dist/')))warnings.push('DIST_INCLUDED');if(included.some(x=>x.path.includes('/assets/public/')))warnings.push('ANDROID_WEB_ASSET_COPY_INCLUDED');if(included.some(x=>x.path.endsWith('.map')))warnings.push('SOURCE_MAP_INCLUDED');
    const largestIncluded=included.sort((a,b)=>b.bytes-a.bytes).slice(0,20).map(({path,bytes})=>({path,bytes}));const seed={totalBytes,includedBytes,excludedBytes,excludedGroups,largestIncluded,warnings};return{...seed,auditSha256:canonicalSha256Object(seed)};
  }
}
export const visualOutputTruthAndSizeGateService=new VisualOutputTruthAndSizeGateService();
