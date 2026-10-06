import { canonicalSha256Object } from './canonicalSha256Service';
export interface P190SeatObservation { subjectId:string; sourceSha256:string; foregroundRatio:number; bboxNorm:number[]; seatBandOccupancy:number; floorContactOccupancy:number; leftRightBalance:number; luminanceMean:number; synthetic:true; }
export interface P190Node { nodeId:string; kind:'FICTIONAL_PERSON_OBSERVATION'|'SEATED_STRUCTURE_PRIOR'|'FICTIONAL_CHARACTER_PROFILE'; subjectId:string; payload:Record<string,unknown>; sourceRefs:string[]; confidence:number; uncertainty:number; nodeSha256:string; }
export interface P190Edge { edgeId:string; from:string; to:string; type:'GENERALIZES_TO'|'SUPPORTS_CHARACTER'; confidence:number; edgeSha256:string; }
export interface P190Graph { nodes:P190Node[]; edges:P190Edge[]; graphSha256:string; }
class FictionalPersonGraphLearningP190Service {
 learn(observations:P190SeatObservation[]):P190Graph {
  if(new Set(observations.map(x=>x.subjectId)).size<10) throw new Error('P190_REQUIRES_TEN_DISTINCT_SYNTHETIC_SUBJECTS');
  if(new Set(observations.map(x=>x.sourceSha256)).size!==observations.length) throw new Error('P190_DUPLICATE_SOURCE');
  const makeNode=(kind:P190Node['kind'],subjectId:string,payload:Record<string,unknown>,sourceRefs:string[],confidence:number,uncertainty:number):P190Node=>{const seed={kind,subjectId,payload,sourceRefs,confidence,uncertainty};const nodeSha256=canonicalSha256Object(seed);return{nodeId:`P190N-${nodeSha256.slice(0,24)}`,...seed,nodeSha256};};
  const nodes:P190Node[]=observations.map(o=>makeNode('FICTIONAL_PERSON_OBSERVATION',o.subjectId,{...o},[o.sourceSha256],.82,.18));
  const mean=(k:keyof P190SeatObservation)=>observations.reduce((sum,o)=>sum+Number(o[k]),0)/observations.length;
  const variance=(k:keyof P190SeatObservation,m:number)=>observations.reduce((sum,o)=>sum+(Number(o[k])-m)**2,0)/observations.length;
  const features:Array<keyof P190SeatObservation>=['foregroundRatio','seatBandOccupancy','floorContactOccupancy','leftRightBalance','luminanceMean'];
  const summary:Record<string,unknown>={};
  for(const k of features){const m=mean(k);summary[k]={mean:m,stdDev:Math.sqrt(variance(k,m)),min:Math.min(...observations.map(o=>Number(o[k]))),max:Math.max(...observations.map(o=>Number(o[k])))};}
  const prior=makeNode('SEATED_STRUCTURE_PRIOR','GENERAL:SEATED_STRUCTURE',{sampleCount:observations.length,summary,usage:'STRUCTURE_ONLY',forbiddenTransfer:['source_pixels','individual_face_texture','individual_clothing_texture']},observations.map(o=>o.sourceSha256),.84,.16);
  const characterPayload={characterId:'FICTIONAL-SEATED-001',origin:'CREATIVE_SYNTHESIS',seatedStructure:{foregroundRatio:Number((mean('foregroundRatio')*.96).toFixed(6)),seatBandOccupancy:Number((mean('seatBandOccupancy')*1.03).toFixed(6)),floorContactOccupancy:Number((mean('floorContactOccupancy')*.91).toFixed(6)),leftRightBalance:Number((-mean('leftRightBalance')*.77).toFixed(6))},novelty:{usesNoSourcePixels:true,noSingleObservationDominates:true,structureOnly:true}};
  const character=makeNode('FICTIONAL_CHARACTER_PROFILE','FICTIONAL-SEATED-001',characterPayload,[prior.nodeSha256],.78,.22);
  nodes.push(prior,character);
  const edges:P190Edge[]=[];
  for(const n of nodes.filter(x=>x.kind==='FICTIONAL_PERSON_OBSERVATION')) edges.push(this.edge(n.nodeId,prior.nodeId,'GENERALIZES_TO',.82));
  edges.push(this.edge(prior.nodeId,character.nodeId,'SUPPORTS_CHARACTER',.78));
  const core:P190Graph={nodes,edges,graphSha256:''};core.graphSha256=canonicalSha256Object({...core,graphSha256:''});return core;
 }
 private edge(from:string,to:string,type:P190Edge['type'],confidence:number):P190Edge { const seed={from,to,type,confidence};const edgeSha256=canonicalSha256Object(seed);return{edgeId:`P190E-${edgeSha256.slice(0,24)}`,...seed,edgeSha256}; }
}
export const fictionalPersonGraphLearningP190Service=new FictionalPersonGraphLearningP190Service();
