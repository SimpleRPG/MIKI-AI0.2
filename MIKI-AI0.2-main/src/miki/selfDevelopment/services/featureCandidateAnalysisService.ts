import ts from 'typescript';
import path from 'node:path';
import { canonicalSha256 } from '../../core/services/canonicalSha256Service';
import type { WiredFeatureArtifact } from './featureArtifactWiringService';

export interface FeatureProgramDiagnostic { path:string; code:number; category:string; message:string; }
export interface FeatureCandidateAnalysis { analysisId:string; passed:boolean; diagnostics:FeatureProgramDiagnostic[]; cycles:string[][]; }
class FeatureCandidateAnalysisService {
  public analyze(artifacts:WiredFeatureArtifact[]):FeatureCandidateAnalysis {
    const files=new Map(artifacts.map(item=>[path.posix.normalize(item.path),item.source]));
    const options:ts.CompilerOptions={target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,moduleResolution:ts.ModuleResolutionKind.Bundler,jsx:ts.JsxEmit.ReactJSX,noEmit:true,skipLibCheck:true};
    const host=ts.createCompilerHost(options);const originalRead=host.readFile.bind(host);const originalExists=host.fileExists.bind(host);
    host.readFile=fileName=>files.get(path.posix.normalize(fileName))||originalRead(fileName);host.fileExists=fileName=>files.has(path.posix.normalize(fileName))||originalExists(fileName);
    host.getSourceFile=(fileName,languageVersion)=>{const content=host.readFile(fileName);return content===undefined?undefined:ts.createSourceFile(fileName,content,languageVersion,true,fileName.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);};
    const program=ts.createProgram([...files.keys()],options,host);const diagnostics=ts.getPreEmitDiagnostics(program).filter(item=>files.has(path.posix.normalize(item.file?.fileName||''))).map(item=>({path:path.posix.normalize(item.file?.fileName||''),code:item.code,category:ts.DiagnosticCategory[item.category],message:ts.flattenDiagnosticMessageText(item.messageText,' ')}));
    const cycles=this.cycles(artifacts);
    return {analysisId:`ANALYSIS-${canonicalSha256({diagnostics,cycles}).slice(0,24)}`,passed:diagnostics.length===0&&cycles.length===0,diagnostics,cycles};
  }
  private cycles(artifacts:WiredFeatureArtifact[]):string[][]{const paths=new Set(artifacts.map(item=>item.path));const graph=new Map<string,string[]>();for(const artifact of artifacts){const deps=artifact.imports.map(line=>line.match(/from\s+['"]([^'"]+)/)?.[1]).filter((value):value is string=>Boolean(value)).map(value=>this.resolve(artifact.path,value,paths)).filter((value):value is string=>Boolean(value));graph.set(artifact.path,deps);}const cycles:string[][]=[];const visit=(node:string,stack:string[],seen:Set<string>)=>{const index=stack.indexOf(node);if(index>=0){cycles.push([...stack.slice(index),node]);return;}if(seen.has(node))return;seen.add(node);for(const next of graph.get(node)||[])visit(next,[...stack,node],new Set(seen));};for(const node of graph.keys())visit(node,[],new Set());return cycles.filter((cycle,index,all)=>all.findIndex(item=>item.join('>')===cycle.join('>'))===index);}
  private resolve(from:string,value:string,paths:Set<string>):string|undefined{if(!value.startsWith('.'))return undefined;const base=path.posix.normalize(path.posix.join(path.posix.dirname(from),value));return [...paths].find(item=>item.replace(/\.(tsx?|mjs)$/,'')===base);}
}
export const featureCandidateAnalysisService=new FeatureCandidateAnalysisService();
