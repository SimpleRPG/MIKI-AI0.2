#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

echo '[P0] 1/4 npm ci'
npm ci

echo '[P0] 2/4 TypeScript / lint'
npm run lint

echo '[P0] 3/4 production build'
npm run build

echo '[P0] 4/4 CORE runtime E2E + fail-closed guard'
npx tsx scripts/test_p0_runtime_e2e.ts

echo '[P0] PASS: build, runtime E2E, stale-write guard, and self-improvement fail-closed guard'
