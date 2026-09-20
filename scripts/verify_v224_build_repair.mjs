import fs from 'node:fs';
const root = new URL('..', import.meta.url).pathname;
const mi = fs.readFileSync(new URL('src/miki/unknown/services/multiIntentDecompositionService.ts', import.meta.url), 'utf8');
for (const token of ['export interface MultiIntentPlan','export function decomposeMultiIntent','export function selectMultiIntentHypothesis','export function scoreMultiIntentHypotheses','export class MultiIntentDecompositionService']) {
  if (!mi.includes(token)) throw new Error(`MISSING:${token}`);
}
const domain = fs.readFileSync(new URL('src/miki/core/services/domainRouterService.ts', import.meta.url), 'utf8');
if (!domain.includes("'APPROVE_REVIEWED_CANDIDATE'")) throw new Error('MISSING:APPROVE_REVIEWED_CANDIDATE');
console.log('V224_BUILD_REPAIR_STATIC_CHECK: PASS');
