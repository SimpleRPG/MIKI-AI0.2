import { canonicalSha256Object } from './canonicalSha256Service';
import type { VisualProject, VisualKnowledgeMemory } from './visualProjectLearningCompositionService';
import type { MediaReference, MediaReferencePacket } from '../../research/services/searxngMediaFetchService';

export type VisualConversationAction='CREATE_NEW_PROJECT'|'EDIT_EXISTING_PROJECT'|'CREATE_VARIANT'|'RESEARCH_REFERENCES'|'LEARN_REFERENCES';
export type VisualOutputKind='PIXEL_ART'|'CANVAS'|'AVATAR'|'SPRITE_SHEET'|'TILE_MAP';
export type VisualMemoryScope='PROJECT_LOCAL'|'PROJECT_FAMILY'|'VISUAL_LIBRARY'|'GLOBAL_TREND';
export interface VisualConversationIntent{action:VisualConversationAction;outputKind:VisualOutputKind;projectId?:string;query:string;needsResearch:boolean;mediaKinds:('IMAGE'|'VIDEO')[];width?:number;height?:number;paletteSize?:number;preserveOriginal:boolean;intentSha256:string;}
export interface VisualProjectRegistryEntry{projectId:string;title:string;familyId?:string;project:VisualProject;createdAt:number;updatedAt:number;tags:string[];registryEntrySha256:string;}
export interface ScopedVisualMemory{scope:VisualMemoryScope;projectId?:string;familyId?:string;memory:VisualKnowledgeMemory;}
export interface VisualConversationDelivery{type:'IMAGE_CARD'|'VIDEO_LINK'|'VISUAL_PROJECT'|'SELF_CODE_IMPROVEMENT_EVIDENCE';projectId?:string;title:string;previewUrl?:string;mediaUrl?:string;sourcePageUrl?:string;license?:string;attribution?:string;verified?:boolean;payloadSha256:string;}

class VisualConversationProjectGatewayService{
  parse(prompt:string,activeProjectId?:string):VisualConversationIntent{
    const text=prompt.trim();const lower=text.toLowerCase();
    const edit=/(さっき|その|この|今の|既存|修正|変えて|長く|短く|暗く|明るく|編集)/.test(text)&&!!activeProjectId;
    const variant=/(別版|派生|元を残|バリアント|variant|色版|冬服版)/i.test(text);
    const research=/(探して|検索|参考|候補|調べて)/.test(text);
    const learn=/(学習|傾向|覚えて|記憶)/.test(text);
    const outputKind:VisualOutputKind=/(ドット|pixel)/i.test(text)?'PIXEL_ART':/(アバター|avatar)/i.test(text)?'AVATAR':/(スプライト|sprite)/i.test(text)?'SPRITE_SHEET':/(タイル|tile)/i.test(text)?'TILE_MAP':'CANVAS';
    const size=text.match(/(\d{1,4})\s*[x×]\s*(\d{1,4})/i);const palette=text.match(/(\d{1,5})\s*色/);
    const action:VisualConversationAction=research?'RESEARCH_REFERENCES':learn?'LEARN_REFERENCES':variant?'CREATE_VARIANT':edit?'EDIT_EXISTING_PROJECT':'CREATE_NEW_PROJECT';
    const mediaKinds:('IMAGE'|'VIDEO')[]=[];if(/動画|video|動き|歩行|走行/i.test(text))mediaKinds.push('VIDEO');if(!mediaKinds.length||/画像|image|写真|イラスト/i.test(text))mediaKinds.push('IMAGE');
    const seed={action,outputKind,projectId:edit||variant?activeProjectId:undefined,query:text,needsResearch:research||/(参考に|似た傾向|学習した)/.test(text),mediaKinds,width:size?Number(size[1]):undefined,height:size?Number(size[2]):undefined,paletteSize:palette?Number(palette[1]):undefined,preserveOriginal:variant||/元を残/.test(text)};return{...seed,intentSha256:canonicalSha256Object(seed)};
  }

  register(entries:VisualProjectRegistryEntry[],project:VisualProject,title:string,tags:string[]=[],familyId?:string):VisualProjectRegistryEntry[]{
    const now=Date.now();const seed={projectId:project.projectId,title,familyId,project,createdAt:now,updatedAt:now,tags:[...new Set(tags)].sort()};const entry={...seed,registryEntrySha256:canonicalSha256Object(seed)};return[...entries.filter(x=>x.projectId!==project.projectId),entry];
  }

  resolve(entries:VisualProjectRegistryEntry[],projectId:string):VisualProjectRegistryEntry{const entry=entries.find(x=>x.projectId===projectId);if(!entry)throw new Error('VISUAL_PROJECT_NOT_FOUND');return entry;}

  scopeMemory(memories:ScopedVisualMemory[],incoming:ScopedVisualMemory):ScopedVisualMemory[]{
    if(incoming.scope==='PROJECT_LOCAL'&&!incoming.projectId)throw new Error('PROJECT_LOCAL_MEMORY_REQUIRES_PROJECT');
    if(incoming.scope==='PROJECT_FAMILY'&&!incoming.familyId)throw new Error('PROJECT_FAMILY_MEMORY_REQUIRES_FAMILY');
    const key=(x:ScopedVisualMemory)=>`${x.scope}:${x.projectId||''}:${x.familyId||''}:${x.memory.memoryId}`;return[...memories.filter(x=>key(x)!==key(incoming)),incoming];
  }

  applicableMemory(memories:ScopedVisualMemory[],entry:VisualProjectRegistryEntry):VisualKnowledgeMemory[]{return memories.filter(x=>x.scope==='GLOBAL_TREND'||x.scope==='VISUAL_LIBRARY'||(x.scope==='PROJECT_LOCAL'&&x.projectId===entry.projectId)||(x.scope==='PROJECT_FAMILY'&&x.familyId===entry.familyId)).map(x=>x.memory);}

  mediaDeliveries(packet:MediaReferencePacket):VisualConversationDelivery[]{return packet.references.map(reference=>this.mediaDelivery(reference));}

  selfImprovementEvidence(entry:VisualProjectRegistryEntry,deliveries:VisualConversationDelivery[]){const seed={evidenceKind:'VISUAL_SELF_CODE_IMPROVEMENT',projectId:entry.projectId,projectSha256:entry.project.projectSha256,referenceSha256List:deliveries.map(x=>x.payloadSha256).sort(),uses:['CANVAS_CANDIDATE','PIXEL_ART_CANDIDATE','AVATAR_CANDIDATE','VISUAL_REGRESSION_FIXTURE'],directProductionMutation:false};return{...seed,evidenceSha256:canonicalSha256Object(seed)};}

  private mediaDelivery(reference:MediaReference):VisualConversationDelivery{const seed={type:reference.mediaKind==='IMAGE'?'IMAGE_CARD' as const:'VIDEO_LINK' as const,title:reference.title,previewUrl:reference.thumbnailUrl||reference.mediaUrl,mediaUrl:reference.mediaUrl,sourcePageUrl:reference.sourcePageUrl,license:reference.license,attribution:reference.attribution,verified:reference.sourceVerified};return{...seed,payloadSha256:canonicalSha256Object(seed)};}
}
export const visualConversationProjectGatewayService=new VisualConversationProjectGatewayService();
