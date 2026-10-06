import { japaneseDictionaryService } from '../../research/services/japaneseDictionaryService';
import { decideUnknownResearch, type UnknownResearchChoice } from '../../research/services/unknownResearchControlService';
import { canonicalSha256Object } from '../../core/services/canonicalSha256Service';
export interface UnknownVocabularyItem{term:string;normalized:string;reason:'DICTIONARY_MISS'|'LOW_INFORMATION';researchChoice:UnknownResearchChoice;query:string;gapId:string;}
export interface UnknownVocabularyAssessment{unknowns:UnknownVocabularyItem[];knownTerms:string[];requiresResearch:boolean;queries:string[];}
const STOP=new Set(['これ','それ','あれ','ここ','そこ','ため','もの','こと','どう','なぜ','です','ます','して','した','する','ある','ない','問題','確認','意味','用語','定義','使い方','教えて','実装','機能','処理','条件','結果']);
function candidates(text:string):string[]{return[...new Set([...(text.match(/[A-Za-z][A-Za-z0-9_+#.-]{2,}/g)||[]),...(text.match(/[ァ-ヶー]{3,}/g)||[]),...(text.match(/[一-龠]{2,}/g)||[])])].filter(x=>!STOP.has(x));}
class ConversationUnknownVocabularyService{
 assess(text:string,options:{allowResearch?:boolean;forceRetry?:boolean}={}):UnknownVocabularyAssessment{const unknowns:UnknownVocabularyItem[]=[];const knownTerms:string[]=[];for(const term of candidates(text)){if(japaneseDictionaryService.has(term)){knownTerms.push(term);continue;}const researchChoice=decideUnknownResearch(options.forceRetry!==false,options.allowResearch!==false);const normalized=term.normalize('NFKC').toLowerCase();unknowns.push({term,normalized,reason:'DICTIONARY_MISS',researchChoice,query:`${term} 意味 用語 定義`,gapId:`TERM-GAP-${canonicalSha256Object({normalized}).slice(0,18)}`});}return{unknowns,knownTerms,requiresResearch:unknowns.some(x=>x.researchChoice==='SEARCH'),queries:unknowns.filter(x=>x.researchChoice==='SEARCH').map(x=>x.query)};}
}
export const conversationUnknownVocabularyService=new ConversationUnknownVocabularyService();
