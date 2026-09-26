import { canonicalSha256Object } from '../../core/services/canonicalSha256Service';
export type IntentHypothesisKind = 'SEQUENTIAL' | 'PARALLEL' | 'DEPENDENT' | 'ALTERNATIVE';
export interface IntentUnit { id:string; text:string; index:number; goal:string; action:string; target:string; dependencies:string[]; hypothesisIds:string[]; }
export interface IntentHypothesis { id:string; kind:IntentHypothesisKind; intentIds:string[]; confidence:number; rationale:string; }
export interface MultiIntentPlan { isMultiIntent:boolean; units:IntentUnit[]; hypotheses:IntentHypothesis[]; unresolved:string[]; deterministicKey:string; }
export interface IntentHypothesisEvaluationContext { completedIntentIds:string[]; failedIntentIds:string[]; evidenceIntentIds:string[]; }
export interface ScoredIntentHypothesis extends IntentHypothesis { score:number; matchedCompletedIntentIds:string[]; unmetDependencies:string[]; }
export interface IntentHypothesisSelection { selectedId:string|null; selectedKind:IntentHypothesisKind|null; ranked:ScoredIntentHypothesis[]; deterministicKey:string; }

const normalize=(s:string)=>s.normalize('NFKC').replace(/[\u3000\t]+/g,' ').trim();
const hash=(s:string)=>{let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return(h>>>0).toString(16).padStart(8,'0')};
export function scoreMultiIntentHypotheses(plan:MultiIntentPlan, context:IntentHypothesisEvaluationContext):ScoredIntentHypothesis[]{
 const completed=new Set(context.completedIntentIds||[]); const failed=new Set(context.failedIntentIds||[]); const evidence=new Set(context.evidenceIntentIds||[]);
 return plan.hypotheses.map(h=>{
  const matched=h.intentIds.filter(id=>completed.has(id));
  const unmet=plan.units.filter(u=>h.intentIds.includes(u.id)).flatMap(u=>u.dependencies.filter(id=>!completed.has(id)&&h.intentIds.includes(id)));
  let score=h.confidence*35;
  if(h.kind==='SEQUENTIAL') score += matched.length>0 ? 30 : 10;
  if(h.kind==='PARALLEL') score += plan.units.filter(u=>h.intentIds.includes(u.id)&&u.dependencies.length===0).length>1 && failed.size===0 ? 35 : -10;
  if(h.kind==='DEPENDENT') score += unmet.length===0 ? 35 : (evidence.size>0 ? 15 : 5);
  if(matched.length) score += Math.min(15,matched.length*5);
  if(failed.size) score -= Math.min(20,[...failed].filter(id=>h.intentIds.includes(id)).length*10);
  return {...h,score:Math.round(score*100)/100,matchedCompletedIntentIds:matched,unmetDependencies:[...new Set(unmet)]};
 }).sort((a,b)=>b.score-a.score||a.kind.localeCompare(b.kind)||a.id.localeCompare(b.id));
}

export function selectMultiIntentHypothesis(plan:MultiIntentPlan, context:IntentHypothesisEvaluationContext):IntentHypothesisSelection{
 const ranked=scoreMultiIntentHypotheses(plan,context); const selected=ranked[0];
 return {selectedId:selected?.id||null,selectedKind:selected?.kind||null,ranked,deterministicKey:hash(JSON.stringify({planKey:plan.deterministicKey,completed:[...(context.completedIntentIds||[])].sort(),failed:[...(context.failedIntentIds||[])].sort(),evidence:[...(context.evidenceIntentIds||[])].sort(),ranked}))};
}

export function decomposeMultiIntent(input:string):MultiIntentPlan{
 const raw=normalize(input);
 const pieces=raw.split(/(?:\s*\n+\s*|\s*(?:そして|それから|さらに|そのうえ|また|ついでに)\s*|[、,。！？]\s*|\s*;\s*|\s+and\s+|\s+then\s+)/i).map(normalize).filter(Boolean);
 const units=pieces.map((text,index):IntentUnit=>({id:`intent-${index+1}-${hash(text)}`,text,index,goal:/調べ|検索|確認|教えて|知りたい/.test(text)?'KNOWLEDGE':/作って|作成|実装|修正|直して/.test(text)?'BUILD_OR_CHANGE':'INTERACT',action:/調べ|検索|確認/.test(text)?'RESEARCH':/作って|作成|実装/.test(text)?'CREATE':/修正|直して/.test(text)?'MODIFY':'RESPOND',target:(text.match(/(?:を|の|について)\s*([^、。！？]+)/)?.[1]||text).trim(),dependencies:[],hypothesisIds:[]}));
 const unresolved:string[]=[]; if(units.length>1&&units.some(u=>u.action==='MODIFY')&&units.some(u=>u.action==='RESEARCH')) unresolved.push('RESEARCH_BEFORE_MODIFY');
 const ids=units.map(u=>u.id); const hypotheses:IntentHypothesis[]=[];
 if(units.length>1){
  hypotheses.push({id:`hyp-seq-${hash(raw)}`,kind:'SEQUENTIAL',intentIds:ids,confidence:.75,rationale:'入力順序を保持し前段結果を後段入力候補にする'});
  hypotheses.push({id:`hyp-par-${hash(raw)}`,kind:'PARALLEL',intentIds:ids,confidence:.25,rationale:'相互依存が明示されない処理は独立実行可能性を保持'});
  if(units.some(u=>u.action==='RESEARCH')&&units.some(u=>u.action==='CREATE'||u.action==='MODIFY')){const research=units.filter(u=>u.action==='RESEARCH').map(u=>u.id);for(const u of units)if(u.action==='CREATE'||u.action==='MODIFY')u.dependencies.push(...research);hypotheses.push({id:`hyp-dep-${hash(raw)}`,kind:'DEPENDENT',intentIds:ids,confidence:.9,rationale:'Research結果が後続作成/修正の前提になり得る'});}
  for(const u of units)u.hypothesisIds=hypotheses.map(h=>h.id);
 }
 return {isMultiIntent:units.length>1,units,hypotheses,unresolved,deterministicKey:hash(JSON.stringify({raw,units,hypotheses,unresolved}))};
}

// Backward-compatible service API used by CORE ingress. The function API above
// remains the canonical routing contract; this adapter exposes the newer
// object-oriented entry without introducing another orchestrator.
export interface DecomposedIntent {
  intentId: string;
  text: string;
  sourceText: string;
  index: number;
  confidence: number;
  reason: 'EXPLICIT_CONNECTOR' | 'PUNCTUATION' | 'SINGLE_INTENT';
}

export interface MultiIntentDecompositionResult {
  sourceText: string;
  isMultiIntent: boolean;
  intents: DecomposedIntent[];
  signature: string;
}

export class MultiIntentDecompositionService {
  public decompose(input: string): MultiIntentDecompositionResult {
    const sourceText = normalize(String(input || ''));
    const plan = decomposeMultiIntent(sourceText);
    const intents = plan.units.map((unit) => ({
      intentId: unit.id,
      text: unit.text,
      sourceText,
      index: unit.index,
      confidence: plan.isMultiIntent ? 0.9 : 1,
      reason: plan.isMultiIntent
        ? (/[、,\n\r]/.test(sourceText) ? 'PUNCTUATION' : 'EXPLICIT_CONNECTOR')
        : 'SINGLE_INTENT',
    } as DecomposedIntent));
    return { sourceText, isMultiIntent: plan.isMultiIntent, intents, signature: canonicalSha256Object(intents.map(({ intentId, text, index }) => ({ intentId, text, index }))) };
  }
}

export const multiIntentDecompositionService = new MultiIntentDecompositionService();
