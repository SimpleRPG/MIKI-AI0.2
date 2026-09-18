import fs from 'node:fs';
const ui=fs.readFileSync('src/components/AutonomousImprovementHome.tsx','utf8');
const model=fs.readFileSync('src/miki/core/services/priorityOneRuntimeReadModelService.ts','utf8');
const checks=[
['getLoopState call count is zero',!ui.includes('getLoopState()')],
['getRuns call count is zero',!ui.includes('getRuns()')],
['old loop type removed',!ui.includes('AutonomousLoopState')],
['old run type removed',!ui.includes('ImprovementRun')],
['runtime list is the UI state source',ui.includes('useState<PriorityOneRuntimeItem[]>')&&ui.includes('listRestoredPriorityOneRuntime()')],
['current task is derived from runtime list',ui.includes('const coreRuntime = coreRuntimes[coreRuntimes.length - 1]')],
['queue is derived from incomplete core tasks',ui.includes('pendingCoreRuntimes = coreRuntimes.filter')],
['history is derived from core runtime items',ui.includes('const canonicalRuns = coreRuntimes.map')],
['runtime model exposes canonical update time',model.includes('updatedAt:number')&&model.includes('updatedAt:task.updatedAt')],
];
let failed=0;for(const [n,ok]of checks){console.log(`${ok?'PASS':'FAIL'} ${n}`);if(!ok)failed++;}if(failed)process.exit(1);
