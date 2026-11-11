import { japaneseDictionaryService } from '../../research/services/japaneseDictionaryService';
import { decideUnknownResearch, type UnknownResearchChoice } from '../../research/services/unknownResearchControlService';
import { lexicalRelationService } from '../../memory/services/lexicalRelationService';
import { canonicalSha256Object } from '../../core/services/canonicalSha256Service';
export interface UnknownVocabularyItem{term:string;normalized:string;reason:'DICTIONARY_MISS'|'LOW_INFORMATION';researchChoice:UnknownResearchChoice;query:string;gapId:string;}
export interface UnknownVocabularyAssessment{unknowns:UnknownVocabularyItem[];knownTerms:string[];requiresResearch:boolean;queries:string[];/** P493: 辞書にあるが多義で、この文脈では意味を確定できなかった語。「知らない語」ではなく「知ってるつもりの語の取り違え」リスク（共有層の意味確定と同じ物差し）。 */senseRisks:string[];}
const STOP=new Set(['これ','それ','あれ','ここ','そこ','ため','もの','こと','どう','なぜ','です','ます','して','した','する','ある','ない','問題','確認','意味','用語','定義','使い方','教えて','実装','機能','処理','条件','結果']);
const SELF_NAMES=new Set(['ビービー','みき']);
function candidates(text:string):string[]{return[...new Set([...(text.match(/[A-Za-z][A-Za-z0-9_+#.-]{2,}/g)||[]),...(text.match(/[ァ-ヶー]{3,}/g)||[]),...(text.match(/[一-龠]{2,}/g)||[])])].filter(x=>!STOP.has(x)&&!SELF_NAMES.has(x));}
class ConversationUnknownVocabularyService{
 assess(text:string,options:{allowResearch?:boolean;forceRetry?:boolean}={}):UnknownVocabularyAssessment{const unknowns:UnknownVocabularyItem[]=[];const knownTerms:string[]=[];const senseRisks:string[]=[];for(const term of candidates(text)){if(japaneseDictionaryService.has(term)){knownTerms.push(term);/* P493: 既知語でも多義語は意味の確定を試みる。確定できなければ「取り違えリスク」として surface する（従来は辞書ヒットで素通りだった）。 */if(lexicalRelationService.sensesOf(term).length>=2&&!lexicalRelationService.disambiguate(term,text))senseRisks.push(term);continue;}const researchChoice=decideUnknownResearch(options.forceRetry!==false,options.allowResearch!==false);const normalized=term.normalize('NFKC').toLowerCase();unknowns.push({term,normalized,reason:'DICTIONARY_MISS',researchChoice,query:`${term} 意味 用語 定義`,gapId:`TERM-GAP-${canonicalSha256Object({normalized}).slice(0,18)}`});}return{unknowns,knownTerms,requiresResearch:unknowns.some(x=>x.researchChoice==='SEARCH'),queries:unknowns.filter(x=>x.researchChoice==='SEARCH').map(x=>x.query),senseRisks};}
}
export const conversationUnknownVocabularyService=new ConversationUnknownVocabularyService();
