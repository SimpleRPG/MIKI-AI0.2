import { canonicalSha256Object } from '../../core/services/canonicalSha256Service';
import type { P151Graph } from '../../core/services/unifiedKnowledgeGraphP151Service';
import { storageService } from '../../../services/storageService';

export interface P214Context { activeGoalIds:string[]; openGoalIds:string[]; currentTopic?:string; lastExplicitTarget?:string; latestCorrection?:string }
export interface P214Topic { terms:string[]; conceptIds:string[]; surface:string }
// P391: expressions that point back at the conversation instead of
// naming their object — demonstratives, contextual modifiers, and
// continuation markers. Shared by context(), resolution and the
// topic-stack update rules.
const REFERENTIAL=/それ|これ|あれ|その|この|あの|前の|続き|他は/u;
export interface P214Validation { passed:boolean; missingConstraints:string[]; contradictions:string[]; repair?:string; receiptSha256:string }
const KEY='miki:p214:conversation-graph';
class ConversationGraphCompletionP214Service {
 private goals:string[]=[]; private topic=''; private lastTarget=''; private correction='';
 // P391: the discourse stack. Each entry is one turn's topic as
 // content terms (plus their concept ids), newest last. Referential
 // turns resolve against the newest entry instead of pushing their
 // own thin wording over it.
 private topics:P214Topic[]=[];
 context(goal:string):P214Context {const normalized=goal.trim();const continuation=/続き|それ|前の/u.test(normalized);const active=continuation&&this.goals.length?[this.goals[this.goals.length-1]]:[];return{activeGoalIds:active,openGoalIds:[...this.goals.slice(-8)],currentTopic:this.topic||undefined,lastExplicitTarget:this.lastTarget||undefined,latestCorrection:this.correction||undefined}}
 observeInput(taskId:string,text:string):void{if(!/続き|それ|前の/u.test(text)){this.goals.push(taskId);if(this.goals.length>32)this.goals.shift();this.lastTarget=text.slice(0,256)}if(/違う|訂正|ではなく/u.test(text))this.correction=text.slice(0,256);this.topic=text.slice(0,128)}
 isReferential(text:string):boolean{return REFERENTIAL.test(text)}
 resolveReference(text:string):P214Topic|undefined{if(!this.isReferential(text)||!this.topics.length)return undefined;const top=this.topics[this.topics.length-1];return{terms:[...top.terms],conceptIds:[...top.conceptIds],surface:top.surface}}
 observeTopic(text:string,terms:string[],conceptIds:string[]):void{if(this.isReferential(text)||!terms.length)return;const entry:P214Topic={terms:[...new Set(terms)].slice(0,12),conceptIds:[...new Set(conceptIds)].slice(0,24),surface:text.slice(0,128)};const prev=this.topics[this.topics.length-1];if(prev&&prev.surface===entry.surface)return;this.topics.push(entry);if(this.topics.length>12)this.topics.shift()}
 validate(input:string,response:unknown,constraintIds:string[]):P214Validation {const output=typeof response==='string'?response:JSON.stringify(response);const missing:string[]=[];if(constraintIds.includes('constraint.preserve')&&!/維持|保持|失わ|削除しない/u.test(output))missing.push('constraint.preserve');if(constraintIds.includes('constraint.no-omission')&&!/全部|全て|すべて|省略しない/u.test(output))missing.push('constraint.no-omission');if(constraintIds.includes('constraint.capacity')&&!/容量|サイズ|byte|mb|kb/iu.test(output))missing.push('constraint.capacity');const contradictions:string[]=[];if(/しない/u.test(input)&&/実施した|実行した/u.test(output))contradictions.push('NEGATION_CONTRADICTION');const passed=missing.length===0&&contradictions.length===0;const core={passed,missingConstraints:missing,contradictions,repair:passed?undefined:`回答計画へ必須制約を再注入: ${missing.join(',')}`};return{...core,receiptSha256:canonicalSha256Object(core)}}
 save(graph:P151Graph):boolean {try{const envelope={version:1,savedAt:new Date().toISOString(),graph,graphSha256:graph.graphSha256,context:{goals:this.goals,topic:this.topic,lastTarget:this.lastTarget,correction:this.correction,topics:this.topics}};storageService.setItem(KEY,JSON.stringify(envelope));return true}catch{return false}}
 load():{graph:P151Graph;graphSha256:string}|undefined {try{const raw=storageService.getItem(KEY);if(!raw)return undefined;const parsed=JSON.parse(raw) as {graph:P151Graph;graphSha256:string;context?:{goals:string[];topic:string;lastTarget:string;correction:string;topics?:P214Topic[]}};if(parsed.graph.graphSha256!==parsed.graphSha256)throw new Error('P214_PERSISTED_GRAPH_SHA_MISMATCH');if(parsed.context){this.goals=parsed.context.goals.slice(-32);this.topic=parsed.context.topic;this.lastTarget=parsed.context.lastTarget;this.correction=parsed.context.correction;if(Array.isArray(parsed.context.topics))this.topics=parsed.context.topics.filter(t=>t&&Array.isArray(t.terms)).slice(-12)}return{graph:parsed.graph,graphSha256:parsed.graphSha256}}catch{return undefined}}
 shard(graph:P151Graph,maxNodes=256):Array<{shardId:string;nodes:P151Graph['nodes'];sha256:string}>{const out=[];for(let i=0;i<graph.nodes.length;i+=maxNodes){const nodes=graph.nodes.slice(i,i+maxNodes);const base={shardId:`conversation-${String(i/maxNodes).padStart(6,'0')}`,nodes};out.push({...base,sha256:canonicalSha256Object(base)})}return out}
}
export const conversationGraphCompletionP214Service=new ConversationGraphCompletionP214Service();
