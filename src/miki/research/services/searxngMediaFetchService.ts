import { canonicalSha256Object } from '../../core/services/canonicalSha256Service';

export type MediaKind = 'IMAGE' | 'VIDEO';
export interface MediaSearchIntent { query:string; kind:MediaKind; maxResults:number; }
export interface MediaReference {
  mediaKind:MediaKind; title:string; sourcePageUrl:string; mediaUrl?:string; thumbnailUrl?:string;
  mimeType?:string; width?:number; height?:number; durationSeconds?:number; creator?:string;
  license?:string; licenseUrl?:string; attribution?:string; searchProvider:'searxng'; sourceEngine?:string;
  sourceVerified:boolean; extractionEvidence:string[];
}
export interface MediaReferencePacket { intent:MediaSearchIntent; references:MediaReference[]; rejected:string[]; packetSha256:string; }

class SearxngMediaFetchService {
  buildSearchParameters(intent:MediaSearchIntent) {
    return { q:intent.query, format:'json', categories:intent.kind === 'IMAGE' ? 'images' : 'videos', safesearch:'1' };
  }

  normalizeSearxng(intent:MediaSearchIntent, payload:unknown):MediaReferencePacket {
    const rows = Array.isArray((payload as any)?.results) ? (payload as any).results : [];
    const rejected:string[]=[];
    const references:MediaReference[]=[];
    for (const row of rows.slice(0, Math.max(1, Math.min(50, intent.maxResults)))) {
      const sourcePageUrl=this.httpUrl(row.url);
      const mediaUrl=this.httpUrl(row.img_src || row.image || row.media_url || row.video_url);
      const thumbnailUrl=this.httpUrl(row.thumbnail_src || row.thumbnail || row.thumbnail_url);
      if(!sourcePageUrl){rejected.push('SEARXNG_SOURCE_PAGE_URL_MISSING');continue;}
      references.push({mediaKind:intent.kind,title:String(row.title||'').trim(),sourcePageUrl,mediaUrl,thumbnailUrl,
        mimeType:this.string(row.mime_type||row.type),width:this.number(row.width),height:this.number(row.height),
        durationSeconds:this.duration(row.duration),creator:this.string(row.author||row.creator),searchProvider:'searxng',
        sourceEngine:this.string(row.engine || (Array.isArray(row.engines)?row.engines.join(','):'')),sourceVerified:false,
        extractionEvidence:['SEARXNG_RESULT',...(mediaUrl?['DIRECT_MEDIA_URL']:[]),...(thumbnailUrl?['THUMBNAIL_URL']:[])]});
    }
    return this.packet(intent,references,rejected);
  }

  enrichFromHtml(reference:MediaReference, html:string):MediaReference {
    const metadata=this.parseMetadata(html,reference.sourcePageUrl);
    const mediaUrl= reference.mediaUrl || (reference.mediaKind==='IMAGE' ? metadata.imageUrl : metadata.videoUrl);
    const thumbnailUrl=reference.thumbnailUrl || metadata.thumbnailUrl || metadata.imageUrl;
    const license=metadata.license;
    const evidence=[...reference.extractionEvidence,...metadata.evidence];
    return {...reference,mediaUrl,thumbnailUrl,mimeType:reference.mimeType||metadata.mimeType,
      width:reference.width||metadata.width,height:reference.height||metadata.height,
      durationSeconds:reference.durationSeconds||metadata.durationSeconds,creator:reference.creator||metadata.creator,
      license,licenseUrl:metadata.licenseUrl,attribution:metadata.attribution,
      sourceVerified:Boolean(mediaUrl && license && metadata.licenseUrl),extractionEvidence:[...new Set(evidence)]};
  }

  conversationDelivery(packet:MediaReferencePacket) {
    return packet.references.map(reference=>({type:reference.mediaKind==='IMAGE'?'IMAGE_CARD':'VIDEO_LINK',title:reference.title,
      imageUrl:reference.mediaKind==='IMAGE'?reference.mediaUrl||reference.thumbnailUrl:reference.thumbnailUrl,
      videoUrl:reference.mediaKind==='VIDEO'?reference.mediaUrl:undefined,sourcePageUrl:reference.sourcePageUrl,
      license:reference.license,licenseUrl:reference.licenseUrl,attribution:reference.attribution,verified:reference.sourceVerified}));
  }

  private parseMetadata(html:string,baseUrl:string){
    const meta=(key:string)=>this.match(html,new RegExp(`<meta[^>]+(?:property|name)=["']${this.escape(key)}["'][^>]+content=["']([^"']+)["']`,`i`)) || this.match(html,new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${this.escape(key)}["']`,`i`));
    const link=(rel:string)=>this.match(html,new RegExp(`<link[^>]+rel=["'][^"']*${this.escape(rel)}[^"']*["'][^>]+href=["']([^"']+)["']`,`i`));
    const imageUrl=this.absolute(meta('og:image')||meta('twitter:image')||link('image_src'),baseUrl);
    const videoUrl=this.absolute(meta('og:video:secure_url')||meta('og:video:url')||meta('og:video')||meta('twitter:player:stream')||this.match(html,/<(?:video|source)[^>]+src=["']([^"']+)["']/i),baseUrl);
    const thumbnailUrl=this.absolute(meta('thumbnailUrl')||meta('og:video:image'),baseUrl);
    const licenseUrl=this.absolute(link('license')||meta('license')||this.jsonLdValue(html,'license'),baseUrl);
    const creator=meta('author')||meta('article:author')||this.jsonLdValue(html,'creator')||this.jsonLdValue(html,'author');
    const license=this.licenseName(licenseUrl||meta('license')||'');
    const width=this.number(meta('og:image:width')||meta('og:video:width'));
    const height=this.number(meta('og:image:height')||meta('og:video:height'));
    const mimeType=meta(videoUrl?'og:video:type':'og:image:type');
    const durationSeconds=this.duration(this.jsonLdValue(html,'duration'));
    const evidence=[imageUrl?'OPEN_GRAPH_IMAGE':'',videoUrl?'OPEN_GRAPH_OR_HTML_VIDEO':'',licenseUrl?'LICENSE_LINK':'',creator?'CREATOR_METADATA':''].filter(Boolean);
    return{imageUrl,videoUrl,thumbnailUrl,licenseUrl,license,creator,attribution:creator&&license?`${creator} / ${license}`:undefined,width,height,mimeType,durationSeconds,evidence};
  }
  private packet(intent:MediaSearchIntent,references:MediaReference[],rejected:string[]):MediaReferencePacket{const seed={intent,references,rejected};return{...seed,packetSha256:canonicalSha256Object(seed)};}
  private jsonLdValue(html:string,key:string){for(const match of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)){try{const value=this.findKey(JSON.parse(match[1]),key);if(typeof value==='string')return value;if(value&&typeof value==='object'&&typeof value.name==='string')return value.name;}catch{continue;}}return undefined;}
  private findKey(value:any,key:string):any{if(!value||typeof value!=='object')return undefined;if(Object.prototype.hasOwnProperty.call(value,key))return value[key];for(const child of Object.values(value)){const found=this.findKey(child,key);if(found!==undefined)return found;}return undefined;}
  private match(value:string,pattern:RegExp){return pattern.exec(value)?.[1]?.trim();}
  private absolute(value:string|undefined,base:string){if(!value)return undefined;try{return new URL(value,base).toString();}catch{return undefined;}}
  private httpUrl(value:unknown){if(typeof value!=='string'||!value.trim())return undefined;try{const url=new URL(value);return url.protocol==='http:'||url.protocol==='https:'?url.toString():undefined;}catch{return undefined;}}
  private string(value:unknown){return typeof value==='string'&&value.trim()?value.trim():undefined;}
  private number(value:unknown){const number=Number(value);return Number.isFinite(number)&&number>0?number:undefined;}
  private duration(value:unknown){if(typeof value==='number'&&value>=0)return value;if(typeof value!=='string')return undefined;const iso=/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?$/i.exec(value);if(iso)return Number(iso[1]||0)*3600+Number(iso[2]||0)*60+Number(iso[3]||0);const parts=value.split(':').map(Number);if(parts.every(Number.isFinite))return parts.reduce((sum,item)=>sum*60+item,0);return undefined;}
  private licenseName(value:string){const lower=value.toLowerCase();if(lower.includes('creativecommons.org/publicdomain/zero')||lower.includes('cc0'))return'CC0';if(lower.includes('creativecommons.org/licenses/by-sa'))return'CC-BY-SA';if(lower.includes('creativecommons.org/licenses/by'))return'CC-BY';if(lower.includes('public domain'))return'PUBLIC_DOMAIN';return value.trim()||undefined;}
  private escape(value:string){return value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');}
}
export const searxngMediaFetchService=new SearxngMediaFetchService();

export interface MediaFetchRuntimeOptions { timeoutMs?:number; maxHtmlBytes?:number; maxMediaBytes?:number; allowPrivateHosts?:boolean; }
export interface MediaBinaryReceipt { sourcePageUrl:string; mediaUrl:string; mimeType:string; bytes:number; sha256:string; data:Uint8Array; }

export class SearxngMediaFetchRuntime {
  constructor(private readonly service:SearxngMediaFetchService=searxngMediaFetchService){}

  async execute(searchEndpoint:string,intent:MediaSearchIntent,options:MediaFetchRuntimeOptions={}):Promise<MediaReferencePacket>{
    const endpoint=this.withParams(searchEndpoint,this.service.buildSearchParameters(intent));
    this.assertAllowedUrl(endpoint,Boolean(options.allowPrivateHosts));
    const response=await this.request(endpoint,options.timeoutMs??10000,'application/json');
    const payload=await response.json();
    const initial=this.service.normalizeSearxng(intent,payload);
    const enriched:MediaReference[]=[];
    for(const reference of initial.references){
      try{enriched.push(await this.fetchAndEnrich(reference,options));}
      catch(error){enriched.push({...reference,sourceVerified:false,extractionEvidence:[...reference.extractionEvidence,`SOURCE_FETCH_FAILED:${this.reason(error)}`]});}
    }
    const seed={intent,references:enriched,rejected:initial.rejected};
    return{...seed,packetSha256:canonicalSha256Object(seed)};
  }

  async fetchAndEnrich(reference:MediaReference,options:MediaFetchRuntimeOptions={}):Promise<MediaReference>{
    this.assertAllowedUrl(reference.sourcePageUrl,Boolean(options.allowPrivateHosts));
    const response=await this.request(reference.sourcePageUrl,options.timeoutMs??10000,'text/html');
    const html=await this.readTextLimited(response,options.maxHtmlBytes??2_000_000);
    return this.service.enrichFromHtml(reference,html);
  }

  async download(reference:MediaReference,options:MediaFetchRuntimeOptions={}):Promise<MediaBinaryReceipt>{
    if(!reference.sourceVerified)throw new Error('MEDIA_SOURCE_NOT_VERIFIED');
    if(!reference.mediaUrl)throw new Error('MEDIA_URL_MISSING');
    this.assertAllowedUrl(reference.mediaUrl,Boolean(options.allowPrivateHosts));
    const response=await this.request(reference.mediaUrl,options.timeoutMs??15000,reference.mediaKind==='IMAGE'?'image/':'video/');
    const mimeType=(response.headers.get('content-type')||'').split(';')[0].trim().toLowerCase();
    if(reference.mediaKind==='IMAGE'&&!mimeType.startsWith('image/'))throw new Error(`MEDIA_MIME_MISMATCH:${mimeType}`);
    if(reference.mediaKind==='VIDEO'&&!mimeType.startsWith('video/'))throw new Error(`MEDIA_MIME_MISMATCH:${mimeType}`);
    const declared=Number(response.headers.get('content-length')||0);
    const limit=options.maxMediaBytes??20_000_000;
    if(declared>limit)throw new Error('MEDIA_SIZE_LIMIT_EXCEEDED');
    const data=new Uint8Array(await response.arrayBuffer());
    if(data.byteLength>limit)throw new Error('MEDIA_SIZE_LIMIT_EXCEEDED');
    const sha256=await this.sha256(data);
    return{sourcePageUrl:reference.sourcePageUrl,mediaUrl:reference.mediaUrl,mimeType,bytes:data.byteLength,sha256,data};
  }

  private async request(url:string,timeoutMs:number,accept:string){const response=await fetch(url,{signal:AbortSignal.timeout(timeoutMs),headers:{Accept:accept,'User-Agent':'MIKI-AI/0.2 visual-research'}});if(!response.ok)throw new Error(`HTTP_${response.status}`);return response;}
  private async readTextLimited(response:Response,limit:number){const declared=Number(response.headers.get('content-length')||0);if(declared>limit)throw new Error('HTML_SIZE_LIMIT_EXCEEDED');const text=await response.text();if(new TextEncoder().encode(text).byteLength>limit)throw new Error('HTML_SIZE_LIMIT_EXCEEDED');return text;}
  private withParams(endpoint:string,params:Record<string,string>){const url=new URL(endpoint);Object.entries(params).forEach(([key,value])=>url.searchParams.set(key,value));return url.toString();}
  private assertAllowedUrl(value:string,allowPrivateHosts:boolean){const url=new URL(value);if(url.protocol!=='http:'&&url.protocol!=='https:')throw new Error('MEDIA_URL_PROTOCOL_REJECTED');const host=url.hostname.toLowerCase();const privateHost=host==='localhost'||host==='127.0.0.1'||host==='::1'||host.endsWith('.local')||/^10\./.test(host)||/^192\.168\./.test(host)||/^172\.(1[6-9]|2\d|3[01])\./.test(host);if(privateHost&&!allowPrivateHosts)throw new Error('MEDIA_PRIVATE_HOST_REJECTED');}
  private async sha256(data:Uint8Array){const copy=new Uint8Array(data.byteLength);copy.set(data);const digest=await crypto.subtle.digest('SHA-256',copy.buffer);return Array.from(new Uint8Array(digest)).map(value=>value.toString(16).padStart(2,'0')).join('');}
  private reason(error:unknown){return error instanceof Error?error.message:String(error);}
}
export const searxngMediaFetchRuntime=new SearxngMediaFetchRuntime();
