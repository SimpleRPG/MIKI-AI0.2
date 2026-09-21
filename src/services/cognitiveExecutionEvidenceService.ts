import { executionEventBusService, ExecutionEvent } from './executionEventBusService';
import { knowledgeOperatingSystemService } from './knowledgeOperatingSystemService';
import { unifiedMikiExperienceService } from './unifiedMikiExperienceService';
import { systemLogger } from './systemLogger';

export interface ExecutionEvidenceRecord {
  id: string; requestId: string; componentId: string; implementationHash: string;
  status: 'PASS'|'FAIL'|'REJECTED'|'INCONCLUSIVE'; testCategory: string;
  output: string; environment: string; durationMs: number; createdAt: number;
  knowledgeObjectId?: string;
}

/** Chapter 60/62: execution evidence -> experience -> Knowledge OS.
 * Execution itself remains the authority; this service only records and links evidence.
 */
class CognitiveExecutionEvidenceService {
  private records: ExecutionEvidenceRecord[] = [];
  private initialized = false;
  private unsub: (()=>void)[] = [];

  initialize(): void {
    if (this.initialized) return;
    this.initialized = true;
    for (const type of ['execution.completed','execution.failed','execution.rejected','execution.inconclusive'] as const) {
      this.unsub.push(executionEventBusService.subscribe(type, e => this.ingest(e)));
    }
    systemLogger.info('TOOLS','[Chapter 60/62] execution evidence bridge initialized');
  }

  dispose(): void { this.unsub.forEach(x=>x()); this.unsub=[]; this.initialized=false; }

  ingest(event: ExecutionEvent): ExecutionEvidenceRecord {
    const status = event.type === 'execution.completed' ? (event.passed ? 'PASS' : 'FAIL') :
      event.type === 'execution.failed' ? 'FAIL' : event.type === 'execution.rejected' ? 'REJECTED' : 'INCONCLUSIVE';
    const id = `XEV-${this.hash(`${event.event_id}|${event.request_id}`)}`;
    const existing = this.records.find(r=>r.id===id);
    if (existing) return existing;
    const record: ExecutionEvidenceRecord = { id, requestId:event.request_id, componentId:event.component_id,
      implementationHash:event.implementation_hash, status, testCategory:event.test_category,
      output:event.output_summary || event.error_message || '', environment:event.environment,
      durationMs:event.duration_ms || 0, createdAt:event.created_at };
    const ko = knowledgeOperatingSystemService.register({ id:`EXEC-${id}`, type:'EVIDENCE',
      title:`実行証拠 ${event.component_id} / ${status}`, content:record.output,
      sourceIds:[event.request_id], evidenceIds:[], dependsOn:[], replaces:[], conditions:[event.environment],
      confidence:status==='PASS'?1:0.5, freshness:1,
      metadata:{executionEvidenceId:id, status, testCategory:event.test_category, implementationHash:event.implementation_hash} });
    record.knowledgeObjectId = ko.id;
    this.records.unshift(record); if(this.records.length>2000)this.records.length=2000;
    unifiedMikiExperienceService.observeExecution({action:event.test_category || 'execution', goal:event.metadata?.goal?.toString() || event.component_id, outcome:status==='PASS'?'SUCCESS':status==='FAIL'?'FAILURE':status==='REJECTED'?'BLOCKED':'UNKNOWN', verified:status==='PASS', capabilityIds:[event.component_id], lesson:event.error_message || event.output_summary || undefined});
    return record;
  }

  list(limit=100): ExecutionEvidenceRecord[]{ return this.records.slice(0,Math.max(1,limit)); }
  summary(){ const c={PASS:0,FAIL:0,REJECTED:0,INCONCLUSIVE:0}; for(const r of this.records)c[r.status]++; return {total:this.records.length,...c}; }
  private hash(s:string){let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return (h>>>0).toString(16).padStart(8,'0');}
}
export const cognitiveExecutionEvidenceService = new CognitiveExecutionEvidenceService();
