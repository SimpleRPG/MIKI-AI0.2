import { storageService } from '../../../services/storageService';
import { canonicalSha256Object } from '../../core/services/canonicalSha256Service';
import { webResearchPolicyService } from './webResearchPolicyService';
import { queryPatternSelectionService } from './queryPatternSelectionService';

export type QueryIntentType='BASELINE'|'OFFICIAL_SPECIFICATION'|'CURRENT_ENVIRONMENT'|'COMPATIBILITY'|'VERSION_SPECIFIC'|'LIMITATION'|'COUNTEREVIDENCE'|'ALTERNATIVE'|'ERROR_DIAGNOSIS'|'IMPLEMENTATION_EXAMPLE'|'SECURITY'|'PRIMARY_SOURCE'|'UPDATE_OR_RETRACTION';
export type QueryReadiness='READY'|'TOO_BROAD'|'TOO_NARROW'|'AMBIGUOUS'|'ENVIRONMENT_MISMATCH'|'PRIVACY_BLOCKED'|'DUPLICATE_QUERY';
export type EnvironmentApplicability='DIRECTLY_APPLICABLE'|'APPLICABLE_WITH_ADAPTATION'|'REFERENCE_ONLY'|'NOT_APPLICABLE'|'ENVIRONMENT_UNKNOWN'|'CONFLICTING_ENVIRONMENT'|'REQUIRES_DEVICE_TEST'|'REQUIRES_EXTERNAL_ENVIRONMENT';
export interface EnvironmentFingerprint {os:string;device:string;architecture:string;runtime:string;executionLocation:string;apiLevel?:string;runtimeVersion?:string;requiredCapabilities:string[];requiredPermissions:string[];desktopUiRequired:boolean;dockerRequired:boolean;rootRequired:boolean;}
export interface GapFocusMaterialInput {
  slotNames:string[];
  targetPaths:string[];
  // 戦略は researchService 側で試行記録から決める。ここでは未指定でよい。
  strategy?:'GITHUB_CODE'|'STACK_EXCHANGE'|'WEB_DOCS';
  gapReason?:string;
  nextStep?:string;
}

// P440 D6: 既存クラスタ・既読 URL の除外条件。同じ出典の繰り返しを
// 避けるため、既存の証拠クラスタのホストと既読 URL を渡す。
export interface ResearchQueryExclusion {
  excludedHosts:string[];
  excludedUrls:string[];
}

// P440 D6/1-B: 独立証拠の追加探索の対象。既存の証拠クラスタとは
// 別の独立出典を探す主張と、不足しているクラスタ数。
export interface IndependentEvidenceFocus {
  claimIds:string[];
  neededClusters:number;
}
export interface ResearchQueryIntent {queryId:string;queryPlanId:string;parentQueryId?:string;researchQuestionId:string;intentType:QueryIntentType;targetClaimIds:string[];missingEvidenceType:string;environmentConstraints:EnvironmentFingerprint;sourceTierTarget:string;language:string;termsIncluded:string[];termsExcluded:string[];exactPhrases:string[];siteOrDomainConstraints:string[];timeConstraint?:string;expectedEvidence:string;stopCondition:string;createdBy:'CORE_18_DOMAINS';createdAt:number;queryText:string;readiness:QueryReadiness;applicability:EnvironmentApplicability;validationReasons:string[];}
export interface QueryPlanningPolicy {enabled:boolean;maxQueriesPerPlan:number;maxRevisionPerQuery:number;maxParallelQueries:number;maxTotalSearchRequests:number;maxQueryExecutionTimeMs:number;maxCandidateUrlsPerQuery:number;stopWhenEvidenceSatisfied:boolean;preferOfficialSources:boolean;requireCurrentEnvironmentCheck:boolean;requireCounterEvidenceSearch:boolean;linkAutoIndependentSourcePolicy:boolean;updatedAt:number;}
export interface ResearchQueryPlan {queryPlanId:string;researchQuestionId:string;canonicalResearchIntent:string;environment:EnvironmentFingerprint;policy:QueryPlanningPolicy;queries:ResearchQueryIntent[];usedQueryPatternIds:string[];excludedQueryPatternIds:string[];queryPatternSelectionId:string;queryPatternSelectionSha256:string;status:'DRAFT'|'READY'|'BLOCKED'|'RUNNING'|'COMPLETED'|'STOPPED';planSha256:string;createdAt:number;updatedAt:number;}
export interface QueryRevisionPair {revisionPairId:string;queryId:string;originalQuery:string;revisedQuery:string;revisionReason:string;termsAdded:string[];termsRemoved:string[];beforeOutcome:Record<string,unknown>;afterOutcome?:Record<string,unknown>;resultingEvidenceIds:string[];acceptedByCore:boolean;pairSha256:string;createdAt:number;}
const POLICY_KEY='miki_research_query_planning_policy_v1';
const PLAN_KEY='miki_research_query_plans_v1';
const REVISION_KEY='miki_research_query_revision_pairs_v1';
const DEFAULT_POLICY:QueryPlanningPolicy={enabled:true,maxQueriesPerPlan:6,maxRevisionPerQuery:2,maxParallelQueries:2,maxTotalSearchRequests:12,maxQueryExecutionTimeMs:120000,maxCandidateUrlsPerQuery:10,stopWhenEvidenceSatisfied:true,preferOfficialSources:true,requireCurrentEnvironmentCheck:true,requireCounterEvidenceSearch:true,linkAutoIndependentSourcePolicy:true,updatedAt:0};
const DEVICE:EnvironmentFingerprint={os:'Android',device:'Galaxy S25',architecture:'arm64',runtime:'APK/Capacitor WebView',executionLocation:'GALAXY_S25',requiredCapabilities:[],requiredPermissions:[],desktopUiRequired:false,dockerRequired:false,rootRequired:false};
const clamp=(value:number,min:number,max:number)=>Math.min(max,Math.max(min,Math.trunc(Number.isFinite(value)?value:min)));
const normalize=(text:string)=>text.normalize('NFKC').replace(/\s+/g,' ').trim();
const extractSiteConstraints=(text:string):string[]=>[...text.matchAll(/(?:^|\s)site:([^\s]+)/gi)].map(m=>m[1].trim()).filter(Boolean);
/*
 * P460: 研究クエリの組み立て段。長い説明文・診断文をそのまま検索文に
 * しないため、対象（gapFocus）・引用・識別子・内容語から短いクエリを
 * 組み立てる。考え方はコード調査側 githubCodeMaterialService.shapeQueries
 * と P439 の gapFocus クエリと同じで、切り詰め（slice）ではなく抽出。
 * 抽出元が何も無い場合だけ、最後の手段として先頭を切り取る。
 */
export const RESEARCH_QUERY_MAX_CHARS=180;
const SHORT_QUERY_MAX_TERMS=10;
const LONG_INTENT_CHARS=200;
const LONG_INTENT_WORDS=24;
const QUERY_TERM_STOPWORDS=new Set(['the','and','for','with','from','that','this','are','was','were','will','would','can','could','should','into','about','over','under','between','through','find','needed','objective','current','context','structured','latent','deliverables','determine','required']);
const JP_TERM_STOP_SEGMENTS=new Set(['について','として','により','ため','こと','もの','これ','それ','場合','以上','以下','今回','前回','自分','相手','検索意図','不足文字列','意味化']);
export function isLongResearchIntent(text:string):boolean{const n=normalize(text);return n.length>LONG_INTENT_CHARS||n.split(/\s+/).filter(Boolean).length>LONG_INTENT_WORDS;}
export function buildShortResearchQuery(text:string,focus?:GapFocusMaterialInput):string{
 const normalized=normalize(text);
 if(!normalized)return '';
 if(!isLongResearchIntent(normalized))return normalized;
 const terms:string[]=[];
 const push=(value:string)=>{const term=normalize(value);if(term&&!terms.includes(term))terms.push(term);};
 for(const slot of (focus?.slotNames??[]).slice(0,3))push(slot);
 for(const path of (focus?.targetPaths??[]).slice(0,3))push(String(path||'').split('/').pop()||'');
 for(const m of normalized.matchAll(/「([^」]{2,40})」|『([^』]{2,40})』|"([^"]{2,40})"/g))push(m[1]||m[2]||m[3]||'');
 for(const m of normalized.matchAll(/[A-Za-z][A-Za-z0-9_$.-]{2,}/g)){if(!QUERY_TERM_STOPWORDS.has(m[0].toLowerCase()))push(m[0]);if(terms.length>=14)break;}
 for(const m of normalized.matchAll(/[ァ-ヶー]{2,}|[一-龠々]{2,}/g)){if(!JP_TERM_STOP_SEGMENTS.has(m[0]))push(m[0]);if(terms.length>=22)break;}
 const chosen:string[]=[];
 for(const term of terms){
   if(chosen.length>=SHORT_QUERY_MAX_TERMS)break;
   chosen.push(term);
   while(chosen.join(' ').length>RESEARCH_QUERY_MAX_CHARS&&chosen.length>1)chosen.pop();
   if(chosen.join(' ').length>RESEARCH_QUERY_MAX_CHARS)break;
 }
 const query=chosen.join(' ').trim();
 return query||normalized.slice(0,RESEARCH_QUERY_MAX_CHARS);
}
class ResearchQueryPlanningService {
 getPolicy():QueryPlanningPolicy {const value=(()=>{const raw=storageService.getItem(POLICY_KEY);try{return raw?JSON.parse(raw) as QueryPlanningPolicy:DEFAULT_POLICY;}catch{return DEFAULT_POLICY;}})();return this.normalizePolicy(value||DEFAULT_POLICY);}
 savePolicy(input:QueryPlanningPolicy):{policy:QueryPlanningPolicy;receiptId:string;policySha256:string}{const policy=this.normalizePolicy({...input,updatedAt:Date.now()});storageService.setItem(POLICY_KEY,JSON.stringify(policy));const policySha256=canonicalSha256Object(policy);return {policy,receiptId:`RQPR-${policySha256.slice(0,20)}`,policySha256};}
 listPlans():ResearchQueryPlan[]{return (()=>{const raw=storageService.getItem(PLAN_KEY);try{return raw?JSON.parse(raw) as ResearchQueryPlan[]:[];}catch{return [];}})();}
 listRevisionPairs():QueryRevisionPair[]{return (()=>{const raw=storageService.getItem(REVISION_KEY);try{return raw?JSON.parse(raw) as QueryRevisionPair[]:[];}catch{return [];}})();}
 buildPlan(question:string,targetClaimIds:string[]=[],gapFocus?:GapFocusMaterialInput,exclusion?:ResearchQueryExclusion,independentFocus?:IndependentEvidenceFocus):ResearchQueryPlan {const intent=normalize(question);if(!intent)throw new Error('RESEARCH_INTENT_REQUIRED');const effectiveIntent=isLongResearchIntent(intent)?(buildShortResearchQuery(intent,gapFocus)||intent):intent;const policy=this.getPolicy();const researchQuestionId=`RQ-${canonicalSha256Object({intent}).slice(0,20)}`;const queryPlanId=`RQP-${canonicalSha256Object(gapFocus?{intent,environment:DEVICE,policy,gapFocus}:{intent,environment:DEVICE,policy}).slice(0,20)}`;const specs:Array<[QueryIntentType,string,string]>=[];specs.push(['BASELINE',effectiveIntent,'全体条件を保持した基準検索']);
/*
 * P439: 不足スロット向けの材料探索クエリを1本足す（gapFocus がある場合）。
 * 戦略ごとに探索先を変える（GitHub コード検索／Stack Exchange／Web 文書）。
 * 基準検索の直後に入れるため、最大クエリ数で切られても残る。
 * gapFocus を渡さない既存の呼び出しは従来の計画のまま。
 */
if(gapFocus&&Array.isArray(gapFocus.slotNames)&&gapFocus.slotNames.length>0){
  const slotText=gapFocus.slotNames.map(value=>String(value||'').trim()).filter(Boolean).slice(0,3).join(' ');
  const targetText=(Array.isArray(gapFocus.targetPaths)?gapFocus.targetPaths:[]).map(path=>String(path||'').split('/').pop()||'').filter(Boolean).slice(0,3).join(' ');
  const siteHint=gapFocus.strategy==='GITHUB_CODE'?'site:github.com':gapFocus.strategy==='STACK_EXCHANGE'?'site:stackoverflow.com':'';
  const materialQuery=[slotText,'TypeScript implementation example',targetText,siteHint].map(value=>value.trim()).filter(Boolean).join(' ');
  if(materialQuery)specs.push(['IMPLEMENTATION_EXAMPLE',materialQuery,'不足スロット向け実装材料']);
}

/*
 * P440 D6/1-B: 独立証拠の追加探索クエリを1本足す（independentFocus
 * がある場合）。既存の証拠クラスタとは別の独立出典を探す意図を載せる。
 * intent を先頭に置くため、基準検索との意図の一致は保たれる。
 * なお queryPlanId のハッシュには exclusion・independentFocus を含め
 * ない。除外条件を変えた再試行も同一の計画として改訂履歴に残る。
 */
if(independentFocus&&Array.isArray(independentFocus.claimIds)&&independentFocus.claimIds.length>0){
  const independentQuery=`${effectiveIntent} independent source evidence official documentation counterevidence`;
  specs.push(['PRIMARY_SOURCE',independentQuery,'独立出典の追加証拠']);
}

const implementationRequired=/(?:実装|実装方法|実装例|部品|component|pattern|algorithm|implementation|implement|code|コード|修正|追加|作成|生成)/i.test(effectiveIntent);
if(implementationRequired){
  specs.push([
    'IMPLEMENTATION_EXAMPLE',
    `${effectiveIntent} implementation example source code algorithm`,
    '実装方式・明示的コード例・アルゴリズム'
  ]);
}

if(policy.preferOfficialSources)specs.push(['OFFICIAL_SPECIFICATION',`${effectiveIntent} official specification documentation`,'一次・公式情報']);if(policy.requireCurrentEnvironmentCheck)specs.push(['CURRENT_ENVIRONMENT',`${effectiveIntent} Android arm64 Termux compatibility`,'Galaxy S25環境適合']);if(policy.requireCounterEvidenceSearch)specs.push(['COUNTEREVIDENCE',`${effectiveIntent} limitation unsupported known issue`,'反証・制限']);const webPolicy=webResearchPolicyService.get();if(webPolicy.requirePrimarySource&&!specs.some(x=>x[0]==='PRIMARY_SOURCE'||x[0]==='OFFICIAL_SPECIFICATION'))specs.push(['PRIMARY_SOURCE',`${effectiveIntent} primary source`,'一次情報']);const unique=new Map<string,[QueryIntentType,string,string]>();for(const item of specs){const key=normalize(item[1]).toLowerCase();if(!unique.has(key))unique.set(key,item);}const chosen=[...unique.values()].slice(0,policy.maxQueriesPerPlan);const queries=chosen.map((item,index)=>this.makeQuery(queryPlanId,researchQuestionId,effectiveIntent,item[0],item[1],item[2],index,targetClaimIds,exclusion));const patternSelection=queryPatternSelectionService.select(effectiveIntent,chosen.map(item=>item[0]),DEVICE,Math.min(3,policy.maxQueriesPerPlan));const status=policy.enabled&&queries.every(q=>q.readiness==='READY')?'READY':'BLOCKED';const base= {queryPlanId,researchQuestionId,canonicalResearchIntent:intent,environment:DEVICE,policy,queries,usedQueryPatternIds:patternSelection.selectedPatternIds,excludedQueryPatternIds:patternSelection.excludedPatternIds,queryPatternSelectionId:patternSelection.selectionId,queryPatternSelectionSha256:patternSelection.selectionSha256,status:status as ResearchQueryPlan['status'],createdAt:Date.now(),updatedAt:Date.now()};const plan:{planSha256:string}&typeof base={...base,planSha256:canonicalSha256Object(base)};const plans=[plan,...this.listPlans().filter(x=>x.queryPlanId!==plan.queryPlanId)].slice(0,100);storageService.setItem(PLAN_KEY,JSON.stringify(plans));return plan;}
 reviseQuery(planId:string,queryId:string,revisedText:string,reason:string,beforeOutcome:Record<string,unknown>):QueryRevisionPair {const plan=this.listPlans().find(x=>x.queryPlanId===planId);const query=plan?.queries.find(x=>x.queryId===queryId);if(!plan||!query)throw new Error('QUERY_NOT_FOUND');const revised=normalize(revisedText);if(!revised||revised===query.queryText)throw new Error('QUERY_REVISION_REQUIRED');const before=new Set(query.queryText.split(/\s+/));const after=new Set(revised.split(/\s+/));const base={queryId,originalQuery:query.queryText,revisedQuery:revised,revisionReason:normalize(reason)||'UNSPECIFIED',termsAdded:[...after].filter(x=>!before.has(x)),termsRemoved:[...before].filter(x=>!after.has(x)),beforeOutcome,resultingEvidenceIds:[],acceptedByCore:false,createdAt:Date.now()};const pair:{revisionPairId:string;pairSha256:string}&typeof base={...base,pairSha256:canonicalSha256Object(base),revisionPairId:''};pair.revisionPairId=`QRP-${pair.pairSha256.slice(0,20)}`;storageService.setItem(REVISION_KEY,JSON.stringify([pair,...this.listRevisionPairs()].slice(0,500)));return pair;}
 private makeQuery(planId:string,rqid:string,canonical:string,intentType:QueryIntentType,text:string,expected:string,index:number,targetClaimIds:string[]=[],exclusion?:ResearchQueryExclusion):ResearchQueryIntent {const queryText=normalize(text);
 /*
  * P440 D6: 既存クラスタ由来の除外をクエリに載せる。termsExcluded は
  * これまで常に空だったため、ここに除外ホストを入れる。クエリ文には
  * -site: を最大2件まで足す（単語数24の上限を超えない場合のみ）。
  * ただしクエリ自体が site: で指定しているホストは除外しない
  * （材料探索の site:github.com 等と矛盾するため）。
  */
 const excludedHosts=[...new Set((exclusion?.excludedHosts??[]).map(host=>String(host||'').toLowerCase().replace(/^www\./,'').trim()).filter(Boolean))].slice(0,8);
 const positiveSites=new Set([...queryText.matchAll(/(?:^|\s)site:([^\s]+)/gi)].map(m=>m[1].toLowerCase()));
 const siteExclusions=excludedHosts.filter(host=>!positiveSites.has(host)).slice(0,2).map(host=>`-site:${host}`).join(' ');
 const finalQueryText=siteExclusions&&`${queryText} ${siteExclusions}`.split(/\s+/).filter(Boolean).length<=24?`${queryText} ${siteExclusions}`:queryText;
 const validation=this.validate(finalQueryText,canonical,intentType);const queryId=`RQI-${canonicalSha256Object({planId,intentType,queryText:finalQueryText,index}).slice(0,20)}`;return {queryId,queryPlanId:planId,researchQuestionId:rqid,intentType,targetClaimIds:[...new Set(targetClaimIds.filter(Boolean))],missingEvidenceType:expected,environmentConstraints:DEVICE,sourceTierTarget:intentType.includes('OFFICIAL')||intentType==='PRIMARY_SOURCE'?'PRIMARY_OR_OFFICIAL':'ANY_VERIFIABLE',language:'ja',termsIncluded:finalQueryText.split(/\s+/),termsExcluded:excludedHosts,exactPhrases:[],siteOrDomainConstraints:extractSiteConstraints(finalQueryText),expectedEvidence:expected,stopCondition:'EVIDENCE_SATISFIED_OR_BUDGET_REACHED',createdBy:'CORE_18_DOMAINS',createdAt:Date.now(),queryText:finalQueryText,readiness:validation.readiness,applicability:validation.applicability,validationReasons:validation.reasons};}
 private validate(query:string,canonical:string,type:QueryIntentType):{readiness:QueryReadiness;applicability:EnvironmentApplicability;reasons:string[]}{const reasons:string[]=[];if(/(?:api[_-]?key|token|password|secret)\s*[=:]\s*\S+/i.test(query))return {readiness:'PRIVACY_BLOCKED',applicability:'ENVIRONMENT_UNKNOWN',reasons:['SECRET_LIKE_TEXT_DETECTED']};const words=query.split(/\s+/).filter(Boolean);if(words.length<2)reasons.push('QUERY_TOO_BROAD');if(words.length>24)reasons.push('QUERY_TOO_NARROW');if(!normalize(query).toLowerCase().includes(normalize(canonical).toLowerCase().slice(0,Math.min(12,canonical.length)).toLowerCase()))reasons.push('CANONICAL_INTENT_WEAK_MATCH');const pcOnly=/\b(?:windows|x64|docker|desktop only)\b/i.test(query)&&!/android|termux|arm64/i.test(query);return {readiness:reasons.includes('QUERY_TOO_BROAD')?'TOO_BROAD':reasons.includes('QUERY_TOO_NARROW')?'TOO_NARROW':'READY',applicability:pcOnly?'REFERENCE_ONLY':type==='CURRENT_ENVIRONMENT'?'DIRECTLY_APPLICABLE':'ENVIRONMENT_UNKNOWN',reasons};}
 private normalizePolicy(value:QueryPlanningPolicy):QueryPlanningPolicy{return {...DEFAULT_POLICY,...value,maxQueriesPerPlan:clamp(value.maxQueriesPerPlan,1,20),maxRevisionPerQuery:clamp(value.maxRevisionPerQuery,0,5),maxParallelQueries:clamp(value.maxParallelQueries,1,3),maxTotalSearchRequests:clamp(value.maxTotalSearchRequests,1,50),maxQueryExecutionTimeMs:clamp(value.maxQueryExecutionTimeMs,10000,600000),maxCandidateUrlsPerQuery:clamp(value.maxCandidateUrlsPerQuery,1,50)};}
}
export const researchQueryPlanningService=new ResearchQueryPlanningService();
export const CURRENT_MIKI_ENVIRONMENT=DEVICE;
