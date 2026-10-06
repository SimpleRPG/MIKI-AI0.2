import { canonicalSha256Object } from './canonicalSha256Service';
import { MIKI_WORKER_DOMAINS, isMikiDomain } from './domainCatalogService';
import { coreCognitiveGraphP155Service, type P155MutationCandidate, type P155SemanticKind } from './coreCognitiveGraphP155Service';
import { unifiedKnowledgeGraphP151Service, type P151Graph } from './unifiedKnowledgeGraphP151Service';
import type { MikiDomain } from './crossDomainCirculationService';

export type P211GraphEventKind = 'INPUT'|'OUTPUT'|'DECISION'|'ACTION'|'RESULT'|'ERROR'|'CORRECTION'|'UNKNOWN'|'VALIDATION';
export interface P211GraphEvent { domain:MikiDomain; eventKind:P211GraphEventKind; subjectId:string; payload:Record<string,unknown>; confidence:number; uncertainty:number; sourceRefs:string[]; participantDomains?:MikiDomain[]; relatedNodeIds?:string[]; requiresVerification?:boolean; }
export interface P211ConnectionReceipt { transactionId:string; domain:MikiDomain; acceptedCandidateIds:string[]; rejectedCandidateIds:string[]; createdNodeIds:string[]; graphSha256:string; eventSha256:string; byteLength:number; receiptSha256:string; }
export interface P211ConnectionStats { connectedDomains:MikiDomain[]; eventCount:number; rejectedCount:number; graphNodes:number; graphEdges:number; graphSha256:string; residentBytes:number; maxResidentBytes:number; }
const SEMANTIC:Record<P211GraphEventKind,P155SemanticKind>={INPUT:'DATA',OUTPUT:'RESULT',DECISION:'DECISION',ACTION:'ACTION',RESULT:'RESULT',ERROR:'EXPERIENCE',CORRECTION:'CORRECTION',UNKNOWN:'UNKNOWN',VALIDATION:'VALIDATION'};
const MAX_PAYLOAD_BYTES=64*1024,MAX_RESIDENT_BYTES=4*1024*1024;
class CrossDomainGraphConnectionP211Service {
 private graph:P151Graph=unifiedKnowledgeGraphP151Service.build([],[]);
 private eventCount=0;
 private rejectedCount=0;
 private residentBytes=0;
 private connected=new Set<MikiDomain>();
 connect(event:P211GraphEvent):P211ConnectionReceipt {
  this.validate(event);
  const compactPayload=this.compact(event.payload);
  const eventSha256=canonicalSha256Object({...event,payload:compactPayload,participantDomains:[...(event.participantDomains||[])].sort(),relatedNodeIds:[...(event.relatedNodeIds||[])].sort()});
  const nodeCandidate=coreCognitiveGraphP155Service.propose(event.domain,{operation:'ADD_NODE',node:{semanticKind:SEMANTIC[event.eventKind],ownerDomain:event.domain,participantDomains:[...new Set([event.domain,...(event.participantDomains||[])])],subjectId:event.subjectId,payload:{eventKind:event.eventKind,eventSha256,...compactPayload},confidence:event.confidence,uncertainty:event.uncertainty,sourceRefs:[...new Set(event.sourceRefs)].sort()},requiresVerification:event.requiresVerification??event.confidence<0.8});
  const candidates:P155MutationCandidate[]=[nodeCandidate];
  const predictedNodeId=this.predictNodeId(nodeCandidate);
  for(const related of [...new Set(event.relatedNodeIds||[])]) candidates.push(coreCognitiveGraphP155Service.propose(event.domain,{operation:'ADD_EDGE',edge:{from:related,to:predictedNodeId,type:`P211_${event.eventKind}_RELATES_TO`,confidence:event.confidence,sourceRefs:[...new Set(event.sourceRefs)].sort()},requiresVerification:false}));
  const committed=coreCognitiveGraphP155Service.commit(this.graph,candidates);
  this.graph=committed.graph;
  this.eventCount+=1;
  this.rejectedCount+=committed.receipt.rejected.length;
  this.connected.add(event.domain);
  const byteLength=new TextEncoder().encode(JSON.stringify(compactPayload)).byteLength;
  this.residentBytes=Math.min(MAX_RESIDENT_BYTES,this.residentBytes+byteLength);
  const base={transactionId:committed.receipt.commitId,domain:event.domain,acceptedCandidateIds:committed.receipt.acceptedCandidateIds,rejectedCandidateIds:committed.receipt.rejected.map(item=>item.candidateId),createdNodeIds:this.graph.nodes.filter(node=>(node.payload as Record<string,unknown>).eventSha256===eventSha256).map(node=>node.nodeId),graphSha256:this.graph.graphSha256,eventSha256,byteLength};
  return {...base,receiptSha256:canonicalSha256Object(base)};
 }
 snapshot():P151Graph{return unifiedKnowledgeGraphP151Service.build(this.graph.nodes,this.graph.edges)}
 restore(snapshot:P151Graph):void{const verified=unifiedKnowledgeGraphP151Service.build(snapshot.nodes,snapshot.edges);if(verified.graphSha256!==snapshot.graphSha256)throw new Error('P211_SNAPSHOT_SHA_MISMATCH');this.graph=verified;this.residentBytes=Math.min(MAX_RESIDENT_BYTES,new TextEncoder().encode(JSON.stringify(verified)).byteLength)}
 stats():P211ConnectionStats{return{connectedDomains:[...this.connected].sort(),eventCount:this.eventCount,rejectedCount:this.rejectedCount,graphNodes:this.graph.nodes.length,graphEdges:this.graph.edges.length,graphSha256:this.graph.graphSha256,residentBytes:this.residentBytes,maxResidentBytes:MAX_RESIDENT_BYTES}}
 missingDomains():MikiDomain[]{return MIKI_WORKER_DOMAINS.filter(domain=>!this.connected.has(domain))}
 reset():void{this.graph=unifiedKnowledgeGraphP151Service.build([],[]);this.eventCount=0;this.rejectedCount=0;this.residentBytes=0;this.connected.clear()}
 private validate(event:P211GraphEvent):void{if(event.domain==='core'||!isMikiDomain(event.domain))throw new Error('P211_INVALID_WORKER_DOMAIN');if(!event.subjectId.trim())throw new Error('P211_EMPTY_SUBJECT');if(event.confidence<0||event.confidence>1||event.uncertainty<0||event.uncertainty>1)throw new Error('P211_INVALID_SCORE');const bytes=new TextEncoder().encode(JSON.stringify(event.payload)).byteLength;if(bytes>MAX_PAYLOAD_BYTES)throw new Error('P211_PAYLOAD_TOO_LARGE');if((event.relatedNodeIds||[]).some(id=>!this.graph.nodes.some(node=>node.nodeId===id)))throw new Error('P211_DANGLING_RELATED_NODE')}
 private compact(payload:Record<string,unknown>):Record<string,unknown>{const out:Record<string,unknown>={};for(const key of Object.keys(payload).sort()){const value=payload[key];if(value===undefined)continue;if(typeof value==='string'&&value.length>4096){out[key]={truncated:true,length:value.length,sha256:canonicalSha256Object(value),preview:value.slice(0,512)};continue}out[key]=value}return out}
 private predictNodeId(candidate:P155MutationCandidate):string{if(!candidate.node)throw new Error('P211_NODE_CANDIDATE_REQUIRED');const n=candidate.node;return unifiedKnowledgeGraphP151Service.node({domain:this.mapDomain(n.ownerDomain),kind:`COGNITIVE_${n.semanticKind}`,subjectId:n.subjectId,payload:{semanticKind:n.semanticKind,ownerDomain:n.ownerDomain,participantDomains:n.participantDomains,...n.payload},confidence:n.confidence,uncertainty:n.uncertainty,sourceRefs:n.sourceRefs}).nodeId}
 private mapDomain(domain:MikiDomain){if(domain==='conversation')return 'CONVERSATION' as const;if(domain==='memory')return 'MEMORY' as const;if(domain==='experience'||domain==='learning'||domain==='improvement')return 'EXPERIENCE' as const;if(domain==='verification'||domain==='safety')return 'VALIDATION' as const;if(domain==='data')return 'REQUIREMENT' as const;return 'REQUIREMENT' as const}
}
export const crossDomainGraphConnectionP211Service=new CrossDomainGraphConnectionP211Service();
