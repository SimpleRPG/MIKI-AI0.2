import fs from 'node:fs';
const evidence=fs.readFileSync('src/miki/memory/services/evidenceService.ts','utf8');
const reply=fs.readFileSync('src/miki/core/services/domainReplyLedgerService.ts','utf8');
const lineage=fs.readFileSync('src/miki/core/services/coreLineageReadModelService.ts','utf8');
for(const token of ['task_id?: string','core_plan_revision?: number','operation_instance_id?: string','reply_id?: string','content_sha256?: string','verification_status?:','bindExecutionLineage'])if(!evidence.includes(token)){console.error(`evidence contract missing: ${token}`);process.exit(1);}
for(const token of ['canonicalSha256Object','bindExecutionLineage(evidenceId','verificationStatus: record.status'])if(!reply.includes(token)){console.error(`reply evidence binding missing: ${token}`);process.exit(1);}
for(const token of ["evidence.kind==='EXECUTION'","evidence.source_id===task.taskId","evidence.metadata?.core_plan_revision","verifiedReplyIds.includes(evidence.metadata.reply_id)","verification_status==='VERIFIED'","content_sha256"])if(!lineage.includes(token)){console.error(`evidence verification missing: ${token}`);process.exit(1);}
console.log('PASS evidence lineage binding v115');
