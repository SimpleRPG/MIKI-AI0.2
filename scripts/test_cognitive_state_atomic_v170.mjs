import fs from 'node:fs';
const read=p=>fs.readFileSync(p,'utf8');
const bb=read('src/miki/core/services/taskBlackboardService.ts');
const core=read('src/miki/core/services/coreOrchestratorService.ts');
const checks={atomicApi:bb.includes('appendIfRevision(taskId:string,expectedRevision:number'),expectedRevisionCheck:bb.includes('task.revision!==expectedRevision'),coreUsesAtomic:core.includes('appendIfRevision(taskId,stateBase.revision'),conflictReplan:core.includes('cognitiveStateCommitConflict:${cycles}')&&core.includes("action:'REPLAN'"),stateStillBlackboard:!core.includes('new CognitiveStateStore')};
const passed=Object.values(checks).every(Boolean);
console.log(JSON.stringify({version:'v170',passed,checks},null,2));if(!passed)process.exit(1);
