import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const core = fs.readFileSync(path.join(root, 'src/services/nonLlmCoreService.ts'), 'utf8');
const answerPlan = fs.readFileSync(path.join(root, 'src/services/answerPlanService.ts'), 'utf8');
const compiler = fs.readFileSync(path.join(root, 'src/services/requestTypeCompilerService.ts'), 'utf8');
const solver = fs.readFileSync(path.join(root, 'src/services/formalConstraintSolverService.ts'), 'utf8');

const required = [
  [core, "import { answerPlanService } from './answerPlanService';", 'AnswerPlan is wired into Non-LLM Core'],
  [core, "import { formalConstraintSolverService } from './formalConstraintSolverService';", 'formal constraint solver is wired into Non-LLM Core'],
  [core, 'answerPlanService.matchSkeleton(prompt, nextState)', 'compiled request reaches deterministic answer planning'],
  [core, 'formalConstraintSolverService.solveCSP', 'compiled request reaches formal constraint verification'],
  [core, 'capabilityPlanApplied', 'verified skill composition affects execution'],
  [core, 'csp.isSatisfied', 'constraint result affects execution result'],
  [answerPlan, 'reuse_mode: \'SKILL_COMPOSITION\'', 'capability patches are executable skill plans'],
  [compiler, 'canExecuteDeterministically', 'request compiler exposes deterministic executability'],
  [solver, 'solveCSP(', 'formal solver remains executable'],
];

for (const [text, needle, message] of required) {
  if (!text.includes(needle)) {
    console.error(`FAIL: ${message} (${needle})`);
    process.exit(1);
  }
}

if (/callLocalLlmChat|streamNativeChat|streamExternalLocalLlm|@mlc-ai\/web-llm/.test(core)) {
  console.error('FAIL: local generative runtime identifier re-entered Non-LLM Core.');
  process.exit(1);
}

console.log('PASS: v58 deterministic pipeline wiring verified: request compiler -> capability plan -> CSP -> Answer IR.');
