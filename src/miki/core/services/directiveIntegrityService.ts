import type { ParsedDirectiveText } from './unifiedDirectiveParser';
export interface DirectiveIntegrityResult{ok:boolean;errors:string[];warnings:string[];normalized:ParsedDirectiveText;}
class DirectiveIntegrityService{
 validate(parsed:ParsedDirectiveText):DirectiveIntegrityResult{
  const clean=(values:string[])=>[...new Set(values.map(v=>v.trim()).filter(Boolean))];
  const normalized={...parsed,title:parsed.title.trim(),objective:parsed.objective.trim(),targetFiles:clean(parsed.targetFiles),requirements:clean(parsed.requirements),prohibitions:clean(parsed.prohibitions),invariants:clean(parsed.invariants),validationRequirements:clean(parsed.validationRequirements),deliveryRequirements:clean(parsed.deliveryRequirements),relatedIssueIds:clean(parsed.relatedIssueIds)};
  const errors:string[]=[];const warnings:string[]=[];
  if(!normalized.objective)errors.push('DIRECTIVE_OBJECTIVE_MISSING');
  if(normalized.objective.length<8)warnings.push('DIRECTIVE_OBJECTIVE_TOO_SHORT');
  const invalidTargets=normalized.targetFiles.filter(path=>/[*?<>|\0]/.test(path)||path.startsWith('/')||/^[A-Za-z]:[\\/]/.test(path)||path.includes('..'));
  if(invalidTargets.length)errors.push(...invalidTargets.map(path=>`DIRECTIVE_TARGET_UNSAFE:${path}`));
  const allSections=[...normalized.requirements,...normalized.prohibitions,...normalized.invariants,...normalized.validationRequirements,...normalized.deliveryRequirements];
  for(const value of allSections){if(/^(requirements?|要求事項|禁止事項|検証条件|納品条件)\s*[:：]?$/i.test(value))warnings.push(`DIRECTIVE_EMPTY_HEADING_LEAK:${value}`);}
  const conflicts=normalized.requirements.filter(req=>normalized.prohibitions.some(pro=>req===pro));if(conflicts.length)errors.push(...conflicts.map(item=>`DIRECTIVE_REQUIREMENT_PROHIBITION_CONFLICT:${item}`));
  if(normalized.targetFiles.length===0)warnings.push('DIRECTIVE_TARGET_DISCOVERY_REQUIRED');
  if(normalized.validationRequirements.length===0)warnings.push('DIRECTIVE_VALIDATION_DEFAULTS_REQUIRED');
  return {ok:errors.length===0,errors,warnings,normalized};
 }
}
export const directiveIntegrityService=new DirectiveIntegrityService();
