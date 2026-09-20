import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const c=readFileSync('src/miki/memory/services/claimDatabaseService.ts','utf8');
const d=readFileSync('docs/MIKI_AI_18_DOMAIN_DESIGN_PHILOSOPHY.txt','utf8');
const checks={
  statusContract:c.includes("export type BeliefRevisionStatus='ACTIVE'|'UNDER_REVIEW'|'CONTRADICTED'|'SUPERSEDED'|'QUARANTINED'"),
  revisionMethod:c.includes('reviseBelief(params:'),
  noAutoTruth:c.includes("status='QUARANTINE_NEW'")&&c.includes('Candidate lacks independently verified support; quarantine without replacing the existing claim.'),
  evidenceGate:c.includes('independentEvidenceClusters.length===0')&&c.includes('candidateVerified===true'),
  confidenceRecalc:c.includes('existingConfidence')&&c.includes('candidateConfidence'),
  explicitCommit:c.includes('if(params.commit)'),
  supersedeLifecycle:c.includes("beliefStatus = 'SUPERSEDED'")&&c.includes("beliefStatus = 'ACTIVE'"),
  quarantinedExcluded:c.includes("beliefStatus !== 'QUARANTINED'"),
  design:d.includes('Knowledge/Belief Revision'),
  noNewTruthDb:!c.includes('BeliefDatabaseService')&&!c.includes('TruthRevisionService'),
};
const passed=Object.values(checks).every(Boolean);
console.log(JSON.stringify({version:'v202',passed,checks},null,2));
if(!passed)process.exit(1);
