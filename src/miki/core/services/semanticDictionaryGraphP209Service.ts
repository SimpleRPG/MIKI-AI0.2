import { canonicalSha256Object } from './canonicalSha256Service';
import { P209_DICTIONARY_SOURCE_SHA, P209_DICTIONARY_STRINGS, P209_DICTIONARY_TUPLES } from '../generated/semanticDictionaryP209';

export type GraphDictionaryPos='NOUN'|'VERB'|'ADJECTIVE'|'ADVERB'|'PRONOUN'|'PROPER_NOUN'|'TECHNICAL'|'FUNCTION'|'UNKNOWN';
export interface GraphDictionaryEntry{assetId:string;surface:string;normalized:string;lemma:string;reading:string;pos:GraphDictionaryPos;source:'GRAPH_BUILTIN';priority:number;semanticIds:string[];sha256:string}
export interface GraphDictionaryLookup{entries:GraphDictionaryEntry[];source:'GRAPH'|'MISS';graphSha256:string}
class SemanticDictionaryGraphP209Service{
 private readonly byNormalized=new Map<string,GraphDictionaryEntry[]>();readonly graphSha256:string;
 constructor(){for(const tuple of P209_DICTIONARY_TUPLES){const surface=P209_DICTIONARY_STRINGS[tuple[0]],normalized=P209_DICTIONARY_STRINGS[tuple[1]],lemma=P209_DICTIONARY_STRINGS[tuple[2]],reading=P209_DICTIONARY_STRINGS[tuple[3]],pos=P209_DICTIONARY_STRINGS[tuple[4]] as GraphDictionaryPos,priority=tuple[5];const base={assetId:`lexeme:${canonicalSha256Object({normalized,pos}).slice(0,24)}`,surface,normalized,lemma,reading,pos,source:'GRAPH_BUILTIN' as const,priority,semanticIds:[`concept:lexeme:${normalized}`]};const entry={...base,sha256:canonicalSha256Object(base)};const list=this.byNormalized.get(normalized)||[];list.push(entry);this.byNormalized.set(normalized,list)}this.graphSha256=canonicalSha256Object({sourceSha256:P209_DICTIONARY_SOURCE_SHA,entries:[...this.byNormalized.values()].flat().map(e=>e.sha256).sort()})}
 lookup(surface:string):GraphDictionaryLookup{const normalized=surface.normalize('NFKC').toLowerCase();const entries=this.byNormalized.get(normalized)||[];return{entries:[...entries],source:entries.length?'GRAPH':'MISS',graphSha256:this.graphSha256}}
 has(surface:string):boolean{return this.lookup(surface).entries.length>0}
 findLongest(text:string,offset:number):GraphDictionaryEntry|undefined{let best:GraphDictionaryEntry|undefined;for(const entries of this.byNormalized.values()){for(const entry of entries){if(text.startsWith(entry.surface,offset)&&(!best||entry.surface.length>best.surface.length))best=entry}}return best}
 getStats(){return{entries:[...this.byNormalized.values()].reduce((n,x)=>n+x.length,0),normalizedKeys:this.byNormalized.size,sourceSha256:P209_DICTIONARY_SOURCE_SHA,graphSha256:this.graphSha256,storage:'INTERNED_COMPACT_TUPLES',maxResidentShards:1}}
}
export const semanticDictionaryGraphP209Service=new SemanticDictionaryGraphP209Service();
