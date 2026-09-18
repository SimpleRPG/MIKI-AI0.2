import fs from 'node:fs';
const intake=fs.readFileSync('src/miki/core/services/externalReviewIntakeService.ts','utf8');
const learning=fs.readFileSync('src/miki/core/services/reviewLearningArtifactService.ts','utf8');
const gateway=fs.readFileSync('src/miki/core/ui/typedImprovementUiGatewayService.ts','utf8');
for(const token of ["mismatchReasons.push('PACKAGE_ID_MISMATCH')","mismatchReasons.push('PACKAGE_REVISION_MISMATCH')","mismatchReasons.push('CANDIDATE_MANIFEST_SHA256_MISMATCH')","mismatchReasons.push('ZIP_SHA256_MISMATCH')",'zipSha256?: string; promptSha256?: string','claims: toLines','unknownComponents: toLines','questions: toLines','claims: [...record.claims]'])if(!intake.includes(token))throw new Error('priority5 completion missing '+token);
for(const token of ['compareLearningImpact','suspendArtifact','usedEpisodeOrArtifactCount','rejectedMethodRecurrenceBlockIds','correctionReuseIds'])if(!learning.includes(token))throw new Error('priority6 completion missing '+token);
for(const token of ["commandType:'IMPORT_EXTERNAL_FEEDBACK'","commandType:'SUBMIT_REVIEW_DECISION'",'rawResponse:command.rawResponse','decision:command.decision'])if(!gateway.includes(token))throw new Error('core feedback command missing '+token);
if(gateway.includes('externalReviewIntakeService.importResponse')||gateway.includes('externalReviewIntakeService.decide'))throw new Error('UI bypasses core feedback flow');
console.log('PASS priority 5 and 6 completion v121');
