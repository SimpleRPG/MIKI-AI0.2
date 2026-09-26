import { canonicalSha256 } from '../../core/services/canonicalSha256Service';
import { selfCodeUnderstandingService } from '../../core/services/selfCodeUnderstandingService';
import type { AstCandidateOperation } from './astCandidateTransformationService';

export interface ContractPropagationRequest {
  fieldName:string;
  fieldType:string;
  interfaceNames:string[];
  producerObjectNames:string[];
  producerExpression:string;
  consumerFunctions?:string[];
  validationFunctions?:string[];
  validationCondition?:string;
  validationFailureStatement?:string;
  callSiteCallees?:string[];
  callArgumentExpression?:string;
  targetPaths:string[];
}

export interface ContractPropagationPlan {
  schemaVersion:1;
  propagationId:string;
  fieldName:string;
  fieldType:string;
  targetPaths:string[];
  transformations:Array<{path:string;operations:AstCandidateOperation[]}>;
  unresolved:string[];
  repositorySnapshotSha256?:string;
}

class ContractPropagationService {
  public plan(request:ContractPropagationRequest):ContractPropagationPlan {
    const targets=this.unique(request.targetPaths);
    const understanding=selfCodeUnderstandingService.ensure(targets);
    const snapshot=selfCodeUnderstandingService.getSnapshot();
    const allowed=new Set([...targets,...understanding.relatedPaths]);
    const transformations=new Map<string,AstCandidateOperation[]>();
    const unresolved:string[]=[];

    for(const interfaceName of this.unique(request.interfaceNames)){
      const matches=(snapshot?.entries||[]).filter(entry=>allowed.has(entry.path)&&entry.symbols.some(symbol=>symbol.kind==='INTERFACE'&&symbol.name===interfaceName));
      if(matches.length!==1){
        unresolved.push(matches.length===0?`INTERFACE_NOT_RESOLVED:${interfaceName}`:`INTERFACE_AMBIGUOUS:${interfaceName}`);
        continue;
      }
      this.add(transformations,matches[0].path,{kind:'ADD_INTERFACE_FIELD',interfaceName,fieldName:request.fieldName,fieldType:request.fieldType});
    }

    for(const variableName of this.unique(request.producerObjectNames)){
      const matches=(snapshot?.entries||[]).filter(entry=>allowed.has(entry.path)&&entry.symbols.some(symbol=>symbol.kind==='VARIABLE'&&symbol.name===variableName));
      if(matches.length!==1){
        unresolved.push(matches.length===0?`PRODUCER_OBJECT_NOT_RESOLVED:${variableName}`:`PRODUCER_OBJECT_AMBIGUOUS:${variableName}`);
        continue;
      }
      this.add(transformations,matches[0].path,{kind:'ADD_OBJECT_PROPERTY',variableName,propertyName:request.fieldName,expression:request.producerExpression});
    }

    for(const functionName of this.unique(request.consumerFunctions||[])){
      const matches=(snapshot?.entries||[]).filter(entry=>allowed.has(entry.path)&&entry.symbols.some(symbol=>(symbol.kind==='FUNCTION'||symbol.kind==='METHOD')&&symbol.name===functionName));
      if(matches.length!==1){unresolved.push(matches.length===0?`CONSUMER_NOT_RESOLVED:${functionName}`:`CONSUMER_AMBIGUOUS:${functionName}`);continue;}
      this.add(transformations,matches[0].path,{kind:'ADD_PARAMETER',functionName,parameterName:request.fieldName,parameterType:request.fieldType});
    }

    for(const functionName of this.unique(request.validationFunctions||[])){
      const matches=(snapshot?.entries||[]).filter(entry=>allowed.has(entry.path)&&entry.symbols.some(symbol=>(symbol.kind==='FUNCTION'||symbol.kind==='METHOD')&&symbol.name===functionName));
      if(matches.length!==1){unresolved.push(matches.length===0?`VALIDATOR_NOT_RESOLVED:${functionName}`:`VALIDATOR_AMBIGUOUS:${functionName}`);continue;}
      const condition=(request.validationCondition||request.fieldName).trim();
      const failureStatement=(request.validationFailureStatement||`throw new Error('MISSING_${request.fieldName.toUpperCase()}');`).trim();
      this.add(transformations,matches[0].path,{kind:'ADD_VALIDATION_GUARD',functionName,condition,failureStatement});
    }

    for(const calleeName of this.unique(request.callSiteCallees||[])){
      const matches=(snapshot?.entries||[]).filter(entry=>allowed.has(entry.path)&&(entry.relations||[]).some(relation=>relation.kind==='CALLS'&&(relation.to===calleeName||relation.to.endsWith(`.${calleeName}`))));
      if(matches.length===0){unresolved.push(`CALL_SITE_NOT_RESOLVED:${calleeName}`);continue;}
      for(const match of matches)this.add(transformations,match.path,{kind:'ADD_CALL_ARGUMENT',calleeName,argumentExpression:(request.callArgumentExpression||request.fieldName).trim()});
    }

    const output=[...transformations.entries()].map(([path,operations])=>({path,operations})).sort((a,b)=>a.path.localeCompare(b.path));
    if(output.length===0)unresolved.push('PROPAGATION_TRANSFORMATIONS_EMPTY');
    const seed={fieldName:request.fieldName,fieldType:request.fieldType,targets,output,repositorySnapshotSha256:understanding.snapshotSha256};
    return {schemaVersion:1,propagationId:`PROP-${canonicalSha256(seed).slice(0,24)}`,fieldName:request.fieldName,fieldType:request.fieldType,targetPaths:targets,transformations:output,unresolved:[...new Set(unresolved)].sort(),repositorySnapshotSha256:understanding.snapshotSha256};
  }

  private add(map:Map<string,AstCandidateOperation[]>,path:string,operation:AstCandidateOperation):void {
    const current=map.get(path)||[];
    if(!current.some(item=>canonicalSha256(item)===canonicalSha256(operation)))current.push(operation);
    map.set(path,current);
  }

  private unique(values:string[]):string[]{return [...new Set(values.map(value=>String(value||'').trim()).filter(Boolean))].sort();}
}

export const contractPropagationService=new ContractPropagationService();
