export type LifecycleTransitionKind='DIRECTIVE'|'REVIEW_PACKAGE';
export type LifecycleTransitionContext='NORMAL'|'PROMOTION_COMPENSATION'|'RECOVERY';

const directiveTerminal=new Set(['ACCEPTED','REJECTED']);
const packageTerminal=new Set(['ACCEPTED','REJECTED']);

class LifecycleTransitionPolicyService{
 assert(kind:LifecycleTransitionKind,from:string,to:string,context:LifecycleTransitionContext='NORMAL'):void{
  if(from===to)return;
  if(context==='PROMOTION_COMPENSATION'){
   if(kind==='REVIEW_PACKAGE'&&from==='ACCEPTED'&&to==='EXTERNAL_REVIEW_PENDING')return;
   if(kind==='DIRECTIVE'&&from==='ACCEPTED'&&to==='ADOPTION_PENDING')return;
  }
  const terminal=kind==='DIRECTIVE'?directiveTerminal:packageTerminal;
  if(terminal.has(from))throw new Error(`${kind}_TERMINAL_STATUS_REGRESSION:${from}->${to}`);
  if(kind==='DIRECTIVE')this.assertDirective(from,to);
  else this.assertReviewPackage(from,to);
 }
 private assertDirective(from:string,to:string):void{
  const decisionSources=new Set(['REVIEW_READY','ADOPTION_PENDING','CHANGES_REQUESTED','HOLD','PARTIALLY_ACCEPTED','PARTIALLY_REJECTED']);
  const decisionTargets=new Set(['ADOPTION_PENDING','CHANGES_REQUESTED','HOLD','PARTIALLY_ACCEPTED','PARTIALLY_REJECTED','ACCEPTED','REJECTED']);
  if(decisionTargets.has(to)&&!decisionSources.has(from))throw new Error(`DIRECTIVE_DECISION_FROM_INVALID_STATUS:${from}->${to}`);
  if(from==='ADOPTION_PENDING'&&!new Set(['ACCEPTED','ADOPTION_PENDING']).has(to))throw new Error(`DIRECTIVE_ADOPTION_PENDING_REGRESSION:${from}->${to}`);
 }
 private assertReviewPackage(from:string,to:string):void{
  if(to==='ACCEPTED'&&from!=='EXTERNAL_REVIEW_PENDING')throw new Error(`REVIEW_PACKAGE_ACCEPT_FROM_INVALID_STATUS:${from}`);
  if(from==='NEEDS_CHANGES'&&to!=='NEEDS_CHANGES')throw new Error(`REVIEW_PACKAGE_NEEDS_CHANGES_IS_REVISION_TERMINAL:${to}`);
  if(from==='HOLD'&&to!=='HOLD')throw new Error(`REVIEW_PACKAGE_HOLD_IS_REVISION_TERMINAL:${to}`);
 }
 isDecisionEligiblePackageStatus(status:string):boolean{return status==='EXTERNAL_REVIEW_PENDING';}
}
export const lifecycleTransitionPolicyService=new LifecycleTransitionPolicyService();
