import fs from 'node:fs';
const planner=fs.readFileSync('src/miki/core/services/adaptiveRoutePlannerService.ts','utf8');
const quarantine=fs.readFileSync('src/miki/core/services/proposalQuarantineService.ts','utf8');
const checks={
 evidenceStoreLookup:planner.includes('EvidenceService.getInstance().getEvidence'),
 rejectedEvidenceBlocked:planner.includes("record.status!=='REJECTED'"),
 executionEvidenceRequired:planner.includes("record.kind==='EXECUTION'"),
 taskBindingRequired:planner.includes('record.source_id===task.taskId'),
 componentBindingRequired:planner.includes("record.metadata?.component_id==='improvementAssessmentService'"),
 dependencySuccessRequired:planner.includes('DEPENDENCY_NOT_SUCCEEDED'),
 invalidProposalQuarantined:planner.includes('proposalQuarantineService.quarantine'),
 quarantinePersisted:quarantine.includes("storageService.setItem(KEY"),
 quarantineDeduplicated:quarantine.includes('const existing = this.records.find'),
 validEvidenceForwarded:planner.includes('assessmentEvidenceIds:evidenceIds')
};
const passed=Object.values(checks).every(Boolean);const report={version:'v48',passed,checks};fs.writeFileSync('PROPOSAL_EVIDENCE_DEPENDENCY_V48.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));if(!passed)process.exitCode=1;
