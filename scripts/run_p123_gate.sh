#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

echo '[P123] 1/6 npm ci'
npm ci

echo '[P123] 2/6 TypeScript / lint'
npm run lint

echo '[P123] 3/6 production build'
npm run build

echo '[P123] 4/6 P0 runtime E2E'
npx tsx scripts/test_p0_runtime_e2e.ts

echo '[P123] 5/6 P1/P2/P3 deterministic implementation checks'
for test in \
  scripts/test_multi_intent_decomposition_v224.mjs \
  scripts/test_knowledge_gap_resolution_plan_v224.mjs \
  scripts/test_action_lineage_service_v224.mjs \
  scripts/test_claim_evidence_service_v224.mjs \
  scripts/test_runtime_conversation_composition_v224.mjs \
  scripts/test_environment_drift_v224.mjs \
  scripts/test_research_meaningfulness_v224.mjs; do
  node "$test"
done

echo '[P123] 6/6 original V160/V223 boundary audits'
node scripts/test_parallel_research_providers_v160.mjs
node scripts/test_environment_drift_v165.mjs
node scripts/test_action_lineage_v176.mjs
node scripts/test_autonomy_fail_closed_determinism_v183.mjs
node scripts/test_claim_sentence_evidence_v173.mjs

echo '[P123] PASS'
