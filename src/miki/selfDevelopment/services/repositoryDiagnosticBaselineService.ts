import { canonicalSha256 } from '../../core/services/canonicalSha256Service';
export interface RepositoryDiagnosticBaseline { baselineId:string; environmentDiagnostics:string[]; codeDiagnostics:string[]; passed:boolean; }
class RepositoryDiagnosticBaselineService{classify(lines:string[]):RepositoryDiagnosticBaseline{const unique=[...new Set(lines.filter(Boolean))];const environmentDiagnostics=unique.filter(line=>/TS2307: Cannot find module/.test(line));const codeDiagnostics=unique.filter(line=>!environmentDiagnostics.includes(line));return {baselineId:`TSCBASE-${canonicalSha256(unique).slice(0,24)}`,environmentDiagnostics,codeDiagnostics,passed:codeDiagnostics.length===0};}}
export const repositoryDiagnosticBaselineService=new RepositoryDiagnosticBaselineService();
