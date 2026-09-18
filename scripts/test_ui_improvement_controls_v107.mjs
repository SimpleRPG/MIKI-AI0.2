import fs from 'node:fs';
const ui=fs.readFileSync('src/components/AutonomousImprovementHome.tsx','utf8');
const required=['handleStartSpecifiedImprovement','handleDiscoverImprovementTarget','handleResumeImprovementTask','startSpecifiedImprovement','discoverImprovementTarget','resumeImprovementTask','改善対象を指定','自動で改善対象を探す','既存Runを再開','planRevision','operationInstanceId','domainReplyIds'];
const missing=required.filter(token=>!ui.includes(token));if(missing.length){console.error(`UI improvement controls missing: ${missing.join(',')}`);process.exit(1);}
for(const forbidden of ['onClick={handleEnqueueRun}','onClick={handleResumeLoop}'])if(ui.includes(forbidden)){console.error(`old direct UI action remains: ${forbidden}`);process.exit(1);}
console.log('PASS UI improvement controls v107');
