import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const planner=readFileSync('src/miki/core/services/adaptiveRoutePlannerService.ts','utf8');
const core=readFileSync('src/miki/core/services/coreOrchestratorService.ts','utf8');
const design=readFileSync('docs/MIKI_AI_18_DOMAIN_DESIGN_PHILOSOPHY.txt','utf8');

const checks={
  goalCandidateContract:planner.includes('export interface CoreGoalCandidate'),
  goalResolver:planner.includes('resolveGoalConflicts(task:BlackboardTask):GoalConflictDecision'),
  precedenceFields:planner.includes('foreground')&&planner.includes('priority')&&planner.includes('safetyRank')&&planner.includes('dependencyRank'),
  canonicalTieBreak:planner.includes('canonicalKey')&&planner.includes('operationInstanceId'),
  coreOwnsResolution:core.includes('adaptiveRoutePlannerService.resolveGoalConflicts(current)'),
  coreRecordsDecision:core.includes('goalConflictResolution:'),
  plannerUsesSelectedGoal:core.includes('const planningTask=goalDecision.selectedGoal!==current.goal'),
  design:design.includes('Goal Conflict / Deterministic Tie-Break'),
  noNewGoalService:!planner.includes('GoalConflictService'),
};
const passed=Object.values(checks).every(Boolean);
console.log(JSON.stringify({version:'v201',passed,checks},null,2));
if(!passed)process.exit(1);
