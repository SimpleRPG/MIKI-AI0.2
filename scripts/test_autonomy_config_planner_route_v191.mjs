import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const p=readFileSync('src/miki/core/services/adaptiveRoutePlannerService.ts','utf8');
const d=readFileSync('docs/MIKI_AI_18_DOMAIN_DESIGN_PHILOSOPHY.txt','utf8');
const checks={
  plannerRoutesToAutonomy:p.includes("const coreOwnedAutonomyOperations=new Set(['SAVE_AUTONOMY_CONFIG']);")&&p.includes("target:'autonomy',\n        command:'SAVE_AUTONOMY_CONFIG'") ,
  plannerReturnsEarly:p.includes("reason:`CORE selected the autonomy classification for operation ${operation}`"),
  completionUsesAutonomy:p.includes("coreCompletionGateService.evaluateCoreOwnedOperation(task,operation,'autonomy')"),
  spec:d.includes('Autonomy設定のCORE計画ルート固定')
};
const passed=Object.values(checks).every(Boolean);
console.log(JSON.stringify({version:'v191',passed,checks},null,2));
if(!passed)process.exit(1);
