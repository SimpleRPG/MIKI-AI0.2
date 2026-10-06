import fs from 'node:fs';import path from 'node:path';
const root='src/components/self_improvement';const files=[];const walk=d=>{for(const n of fs.readdirSync(d)){const p=path.join(d,n);const st=fs.statSync(p);if(st.isDirectory())walk(p);else if(/\.tsx?$/.test(p))files.push(p)}};walk(root);
const imports=[];for(const file of files){const text=fs.readFileSync(file,'utf8');for(const m of text.matchAll(/import(?!\s+type)[\s\S]*?from\s+['\"]([^'\"]+)['\"]/g)){if(/miki\/(selfDevelopment|improvement)\/services/.test(m[1]))imports.push({file,spec:m[1]});}}
const externalOrReadOnlyAllowList=new Set([
]);
const prohibited=imports.filter(x=>!externalOrReadOnlyAllowList.has(`${x.file}|${x.spec}`));
const panel=fs.readFileSync('src/components/self_improvement/DevelopmentReviewLifecyclePanel.tsx','utf8');const gateway=fs.readFileSync('src/miki/core/ui/typedImprovementUiGatewayService.ts','utf8');
const checks={reviewPanelUsesCoreGateway:panel.includes('typedImprovementUiGatewayService')&&!panel.includes('developmentReviewLifecycleService'),gatewayOwnsReviewActions:['startDevelopmentReview','decideDevelopmentReview','downloadDevelopmentEvaluationPackage'].every(x=>gateway.includes(x)),noUnclassifiedDirectDomainImports:prohibited.length===0};
const report={phase:'SELF_IMPROVEMENT_UI_BOUNDARY_P99',passed:Object.values(checks).every(Boolean),checks,classifiedExternalOrReadOnly:imports.filter(x=>externalOrReadOnlyAllowList.has(`${x.file}|${x.spec}`)),prohibited};fs.writeFileSync('SELF_IMPROVEMENT_UI_BOUNDARY_P99_REPORT.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));if(!report.passed)process.exit(1);
