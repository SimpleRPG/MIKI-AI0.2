import fs from 'node:fs';
const app = fs.readFileSync('src/App.tsx','utf8');
const lifecycle = fs.readFileSync('src/app/appRuntimeLifecycleService.ts','utf8');
const checks = [
  ['App uses lifecycle boundary', app.includes('appRuntimeLifecycleService.initialize()')],
  ['App disposes lifecycle boundary', app.includes('appRuntimeLifecycleService.dispose()')],
  ['App no longer initializes domain bootstrap directly', !app.includes('domainIntegrationBootstrapService.initialize()')],
  ['App no longer initializes self improvement controller directly', !app.includes('selfImprovementControllerService.initialize()')],
  ['Lifecycle is idempotent', lifecycle.includes('private initialized = false') && lifecycle.includes('if (this.initialized)')],
  ['Lifecycle owns 18-domain bootstrap', lifecycle.includes('domainIntegrationBootstrapService.initialize()')],
  ['Lifecycle owns cleanup', lifecycle.includes('domainIntegrationBootstrapService.dispose()')],
  ['Runtime services remain initialized', lifecycle.includes('taskExecutionOrchestratorService.initialize()')],
  ['Learning feedback lifecycle retained', lifecycle.includes('taskConversationFeedbackService.initialize()')],
  ['No Math.random in lifecycle', !lifecycle.includes('Math.random')],
];
let failed=0;
for (const [name, ok] of checks) { console.log(`${ok?'PASS':'FAIL'} ${name}`); if(!ok) failed++; }
process.exit(failed?1:0);
