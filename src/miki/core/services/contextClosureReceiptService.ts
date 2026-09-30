import { storageService } from '../../../services/storageService';
import { canonicalSha256 } from './canonicalSha256Service';
import type { CodeUnderstandingResult } from './selfCodeUnderstandingService';

export interface ContextClosureReceipt {
  receiptId:string;
  repositorySnapshotSha256:string;
  targetPaths:string[];
  relatedPaths:string[];
  impactPathCount:number;
  executionPathCount:number;
  contractValues:string[];
  unresolved:string[];
  status:'CLOSED'|'INCOMPLETE';
  createdAt:number;
}

const KEY='miki_context_closure_receipts_v1';
const MAX_RECEIPTS=200;

class ContextClosureReceiptService {
  create(understanding:CodeUnderstandingResult):ContextClosureReceipt {
    const unresolved=[
      ...understanding.reasons,
      ...understanding.unresolvedEdges.map(value=>`UNRESOLVED_EDGE:${value}`),
      ...(!understanding.snapshotSha256?['UNDERSTANDING_SNAPSHOT_REQUIRED']:[]),
      ...(understanding.targetPaths.length===0?['TARGET_PATHS_REQUIRED']:[]),
    ].filter(Boolean);
    const seed={
      repositorySnapshotSha256:understanding.snapshotSha256||understanding.repoSha256,
      targetPaths:[...understanding.targetPaths].sort(),
      relatedPaths:[...understanding.relatedPaths].sort(),
      impactScopes:understanding.impactScopes.map(item=>({path:item.path,scope:item.scope})),
      contractValues:[...understanding.contractValues].sort(),
      unresolved:[...new Set(unresolved)].sort(),
    };
    const receipt:ContextClosureReceipt={
      receiptId:`CCR-${canonicalSha256(seed).slice(0,24)}`,
      repositorySnapshotSha256:seed.repositorySnapshotSha256,
      targetPaths:seed.targetPaths,
      relatedPaths:seed.relatedPaths,
      impactPathCount:understanding.impactScopes.length,
      executionPathCount:understanding.executionPaths.length,
      contractValues:seed.contractValues,
      unresolved:seed.unresolved,
      status:understanding.ready&&seed.unresolved.length===0?'CLOSED':'INCOMPLETE',
      createdAt:Date.now(),
    };
    this.save(receipt);
    return receipt;
  }

  get(receiptId:string):ContextClosureReceipt|undefined{return this.list().find(item=>item.receiptId===receiptId);}
  list():ContextClosureReceipt[]{
    try{const raw=storageService.getItem(KEY);const rows=raw?JSON.parse(raw):[];return Array.isArray(rows)?rows.filter(item=>item&&typeof item.receiptId==='string'):[];}catch{return [];}
  }
  private save(receipt:ContextClosureReceipt):void{
    const rows=this.list().filter(item=>item.receiptId!==receipt.receiptId);
    rows.push(receipt);
    storageService.setItem(KEY,JSON.stringify(rows.slice(-MAX_RECEIPTS)));
  }
}
export const contextClosureReceiptService=new ContextClosureReceiptService();
