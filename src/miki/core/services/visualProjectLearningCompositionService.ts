import { canonicalSha256Object } from './canonicalSha256Service';
import type { MotionTrend, VisualQualitySpec } from './adaptiveVisualLearningService';
import type { VisualAssetLibraryManifest, VisualLayerKind } from './visualAssetLibraryService';

export type VisualKnowledgeKind='VISUAL_PROFILE'|'STYLE'|'PALETTE'|'FACE'|'BODY'|'CLOTHING'|'MOTION'|'SCENE'|'QUALITY'|'USER_DIRECTION';
export type VisualApplyMode='AUTO_SAFE'|'PROPOSE'|'VARIANT'|'REJECT';
export interface VisualKnowledgeMemory{memoryId:string;kind:VisualKnowledgeKind;subject:string;payload:Record<string,unknown>;confidence:number;status:'PROVISIONAL'|'GROWING'|'STABLE';sourceSha256List:string[];learnedAt:number;memorySha256:string;}
export interface VisualProjectLayer{layerId:string;kind:VisualLayerKind;assetIds:string[];parameters:Record<string,unknown>;locked:boolean;}
export interface VisualProjectRevision{revision:number;parentRevision?:number;createdAt:number;reason:string;layers:VisualProjectLayer[];motionTrends:MotionTrend[];quality:VisualQualitySpec;memoryIds:string[];changedLayerIds:string[];changedMotionKinds:string[];revisionSha256:string;}
export interface VisualProject{projectId:string;title:string;currentRevision:number;revisions:VisualProjectRevision[];memory:VisualKnowledgeMemory[];projectSha256:string;}
export interface VisualLearningProposal{proposalId:string;projectId:string;baseRevision:number;mode:VisualApplyMode;memoryIds:string[];targetLayerIds:string[];targetMotionKinds:string[];reasons:string[];proposalSha256:string;}

class VisualProjectLearningCompositionService{
  createMemory(input:Omit<VisualKnowledgeMemory,'memoryId'|'memorySha256'|'learnedAt'>):VisualKnowledgeMemory{if(input.confidence<0||input.confidence>1||!input.sourceSha256List.length)throw new Error('INVALID_VISUAL_MEMORY');const learnedAt=Date.now();const seed={...input,learnedAt};const memorySha256=canonicalSha256Object(seed);return{memoryId:`VM-${memorySha256.slice(0,24)}`,...seed,memorySha256};}

  createProject(input:{projectId:string;title:string;library:VisualAssetLibraryManifest;quality:VisualQualitySpec;memory:VisualKnowledgeMemory[];motionTrends?:MotionTrend[]}):VisualProject{
    const layers=input.library.layers.map(layer=>({layerId:layer.layerId,kind:layer.kind,assetIds:[...layer.assetIds],parameters:{...layer.parameters},locked:false}));
    const revision=this.revision({revision:1,createdAt:Date.now(),reason:'INITIAL_LEARNING_COMPOSITION',layers,motionTrends:input.motionTrends||[],quality:input.quality,memoryIds:input.memory.map(x=>x.memoryId),changedLayerIds:layers.map(x=>x.layerId),changedMotionKinds:(input.motionTrends||[]).map(x=>x.kind)});
    return this.project({projectId:input.projectId,title:input.title,currentRevision:1,revisions:[revision],memory:[...input.memory]});
  }

  propose(project:VisualProject,incoming:VisualKnowledgeMemory[]):VisualLearningProposal{
    const current=this.current(project);const stable=incoming.filter(x=>x.status==='STABLE'&&x.confidence>=.8);const growing=incoming.filter(x=>x.status==='GROWING'||x.confidence>=.45);const user=incoming.filter(x=>x.kind==='USER_DIRECTION');
    let mode:VisualApplyMode='PROPOSE';const reasons:string[]=[];
    if(user.length){mode='AUTO_SAFE';reasons.push('USER_DIRECTION_PRIORITY');}
    else if(stable.length===incoming.length&&incoming.length>0){mode='AUTO_SAFE';reasons.push('ALL_EVIDENCE_STABLE');}
    else if(growing.length){mode='PROPOSE';reasons.push('GROWING_EVIDENCE_REQUIRES_REVIEW');}
    else{mode='VARIANT';reasons.push('PROVISIONAL_EVIDENCE_AS_VARIANT');}
    const targetLayerIds=[...new Set(incoming.flatMap(memory=>current.layers.filter(layer=>this.layerMatches(memory.kind,layer.kind)).map(layer=>layer.layerId)))];
    const targetMotionKinds=[...new Set(incoming.filter(x=>x.kind==='MOTION').flatMap(x=>Array.isArray(x.payload.motionKinds)?x.payload.motionKinds.filter((v):v is string=>typeof v==='string'):[]))];
    if(!targetLayerIds.length&&!targetMotionKinds.length){mode='REJECT';reasons.push('NO_MATCHING_PROJECT_TARGET');}
    const seed={projectId:project.projectId,baseRevision:project.currentRevision,mode,memoryIds:incoming.map(x=>x.memoryId).sort(),targetLayerIds:targetLayerIds.sort(),targetMotionKinds:targetMotionKinds.sort(),reasons};const proposalSha256=canonicalSha256Object(seed);return{proposalId:`VP-${proposalSha256.slice(0,24)}`,...seed,proposalSha256};
  }

  apply(project:VisualProject,proposal:VisualLearningProposal,incoming:VisualKnowledgeMemory[],options:{acceptProposal?:boolean;asVariant?:boolean}={}):VisualProject{
    if(proposal.projectId!==project.projectId||proposal.baseRevision!==project.currentRevision)throw new Error('VISUAL_PROPOSAL_STALE');
    if(proposal.mode==='REJECT')throw new Error('VISUAL_PROPOSAL_REJECTED');
    if(proposal.mode==='PROPOSE'&&!options.acceptProposal)throw new Error('VISUAL_PROPOSAL_APPROVAL_REQUIRED');
    const current=this.current(project);const memories=new Map(project.memory.map(x=>[x.memoryId,x]));incoming.forEach(x=>memories.set(x.memoryId,x));
    const layers=current.layers.map(layer=>{if(layer.locked||!proposal.targetLayerIds.includes(layer.layerId))return structuredClone(layer);const updates=incoming.filter(memory=>this.layerMatches(memory.kind,layer.kind));return{...structuredClone(layer),parameters:{...layer.parameters,...Object.assign({},...updates.map(x=>x.payload))}};});
    const motionTrends=current.motionTrends.map(x=>structuredClone(x));
    const revision=this.revision({revision:current.revision+1,parentRevision:current.revision,createdAt:Date.now(),reason:options.asVariant||proposal.mode==='VARIANT'?'LEARNING_VARIANT':'LEARNING_INCREMENTAL_APPLY',layers,motionTrends,quality:current.quality,memoryIds:[...new Set([...current.memoryIds,...incoming.map(x=>x.memoryId)])].sort(),changedLayerIds:proposal.targetLayerIds,changedMotionKinds:proposal.targetMotionKinds});
    return this.project({projectId:project.projectId,title:project.title,currentRevision:revision.revision,revisions:[...project.revisions,revision],memory:[...memories.values()]});
  }

  rollback(project:VisualProject,targetRevision:number):VisualProject{const target=project.revisions.find(x=>x.revision===targetRevision);if(!target)throw new Error('VISUAL_REVISION_NOT_FOUND');const copy=this.revision({...structuredClone(target),revision:project.currentRevision+1,parentRevision:project.currentRevision,createdAt:Date.now(),reason:`ROLLBACK_TO_${targetRevision}`,changedLayerIds:target.layers.map(x=>x.layerId),changedMotionKinds:target.motionTrends.map(x=>x.kind)});return this.project({...project,currentRevision:copy.revision,revisions:[...project.revisions,copy]});}

  exportManifest(project:VisualProject){const current=this.current(project);const seed={projectId:project.projectId,currentRevision:project.currentRevision,projectSha256:project.projectSha256,revisionSha256:current.revisionSha256,memorySha256List:project.memory.map(x=>x.memorySha256).sort(),outputPaths:[`visual/projects/${project.projectId}/project.json`,`visual/projects/${project.projectId}/revisions/r${String(project.currentRevision).padStart(4,'0')}/revision.json`,`visual/projects/${project.projectId}/receipts/learning-memory.json`]};return{...seed,manifestSha256:canonicalSha256Object(seed)};}

  private current(project:VisualProject){const revision=project.revisions.find(x=>x.revision===project.currentRevision);if(!revision)throw new Error('VISUAL_CURRENT_REVISION_MISSING');return revision;}
  private layerMatches(kind:VisualKnowledgeKind,layer:VisualLayerKind){if(kind==='VISUAL_PROFILE'||kind==='STYLE'||kind==='PALETTE')return true;if(kind==='FACE')return layer==='SUBJECT_APPEARANCE';if(kind==='BODY')return layer==='BODY_SHAPE'||layer==='SUBJECT_APPEARANCE';if(kind==='CLOTHING')return layer.startsWith('GARMENT_')||layer==='OUTERWEAR'||layer==='FOOTWEAR'||layer==='ACCESSORY';if(kind==='SCENE')return layer==='BACKGROUND';if(kind==='USER_DIRECTION')return true;return false;}
  private revision(input:Omit<VisualProjectRevision,'revisionSha256'>):VisualProjectRevision{return{...input,revisionSha256:canonicalSha256Object(input)};}
  private project(input:Omit<VisualProject,'projectSha256'>):VisualProject{return{...input,projectSha256:canonicalSha256Object(input)};}
}
export const visualProjectLearningCompositionService=new VisualProjectLearningCompositionService();
