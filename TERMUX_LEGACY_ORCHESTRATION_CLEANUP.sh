#!/data/data/com.termux/files/usr/bin/bash
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

echo "===== MIKI-AI0.2 legacy orchestration cleanup ====="

if [[ -n "$(git status --short -- . ":!TERMUX_LEGACY_ORCHESTRATION_CLEANUP.sh")" ]]; then
  echo "ERROR: working tree is not clean."
  git status --short
  echo
  echo "先に現在の変更をcommit/stashしてから再実行してください。"
  exit 1
fi

BACKUP_BRANCH="backup/before-legacy-orchestration-cleanup-$(date +%Y%m%d-%H%M%S)"
git branch "$BACKUP_BRANCH"

echo
echo "Safety branch created:"
echo "$BACKUP_BRANCH"

echo
echo "===== DELETE CANDIDATES ====="

DELETE_FILES=(
  "src/miki/core/services/domainSequentialWorkflowService.ts"
  "src/miki/core/services/adaptiveWorkflowOrchestratorService.ts"
  "src/miki/selfAwareness/services/integratedCognitionControllerService.ts"
  "scripts/test_domain_runtime_adapters_v20.mjs"
)

printf '%s\n' "${DELETE_FILES[@]}"

echo
echo "===== CHECK CURRENT REFERENCES ====="

for f in "${DELETE_FILES[@]}"; do
  echo
  echo "--- $f ---"
  git grep -n -F "$f" -- ':!TERMUX_LEGACY_ORCHESTRATION_CLEANUP.sh' || true
done

echo
echo "===== REMOVE OBSOLETE BARREL EXPORTS ====="

python - <<'PY'
from pathlib import Path

p = Path("src/miki/core.ts")
if p.exists():
    s = p.read_text()
    s = s.replace(
        "export { domainSequentialWorkflowService } from './core/services/domainSequentialWorkflowService';\n",
        ""
    )
    s = s.replace(
        "export { adaptiveWorkflowOrchestratorService } from './core/services/adaptiveWorkflowOrchestratorService';\n",
        ""
    )
    p.write_text(s)

p = Path("src/miki/selfAwareness.ts")
if p.exists():
    s = p.read_text()
    s = s.replace(
        "export { integratedCognitionControllerService } from './selfAwareness/services/integratedCognitionControllerService';\n",
        ""
    )
    p.write_text(s)
PY

echo
echo "===== REMOVE OLD INTEGRATED COGNITION IMPLEMENTATION ====="

python - <<'PY'
from pathlib import Path

p = Path("src/services/chapter69_90PlatformServices.ts")
if not p.exists():
    print("chapter69_90PlatformServices.ts not found; skipping")
    raise SystemExit

s = p.read_text()

start = s.find("export type CognitiveRoute=")

if start == -1:
    print("Old IntegratedCognitionControllerService block not found; leaving file unchanged.")
else:
    end_marker = "export const integratedCognitionControllerService"
    end = s.find(end_marker, start)

    if end == -1:
        print("Old cognition export marker not found; leaving file unchanged.")
    else:
        # Include the export declaration through the end of its statement/object.
        next_newline = s.find("\n", end)
        if next_newline == -1:
            next_newline = len(s)

        s = s[:start] + s[next_newline + 1:]
        p.write_text(s)
        print("Removed old IntegratedCognitionControllerService block.")
PY

echo
echo "===== REMOVE RETIRED FILES ====="

for f in "${DELETE_FILES[@]}"; do
  if [[ -f "$f" ]]; then
    rm -f "$f"
    echo "deleted: $f"
  else
    echo "already absent: $f"
  fi
done

echo
echo "===== CHECK REMAINING RUNTIME REFERENCES ====="

for pattern in \
  "domainSequentialWorkflowService" \
  "adaptiveWorkflowOrchestratorService" \
  "integratedCognitionControllerService"
do
  echo
  echo "--- $pattern ---"
  git grep -n "$pattern" -- \
    'src/**' \
    'server.ts' \
    'package.json' \
    'scripts/**' \
    ':!TERMUX_LEGACY_ORCHESTRATION_CLEANUP.sh' || true
done

echo
echo "===== INTENTIONALLY RETAINED ====="

cat <<'LIST'
src/miki/selfAwareness/services/mikiCognitiveKernelService.ts
src/miki/learning/services/executionLearningCoordinatorService.ts
src/miki/safety/services/recoveryOrchestratorService.ts
src/miki/execution/services/taskExecutionOrchestratorService.ts
src/miki/improvement/services/selfImprovementControllerService.ts
src/miki/core/services/legacyEvolutionCoreOperationService.ts
src/miki/improvement/services/selfImprovementIngressService.ts
src/miki/selfAwareness/services/autonomousSelfImprovementLoopService.ts
LIST

echo
echo "===== GIT DIFF ====="
git status --short
git diff --stat

echo
echo "===== BUILD ====="
npm run build

echo
echo "===== TESTS ====="

node scripts/test_core_18_domain_authority_v21.mjs
node scripts/test_core_ingress_convergence_v25.mjs
node scripts/test_core_deduplication_v22.mjs
node scripts/test_18_domain_connectivity_v14.mjs
npx tsx scripts/test_chapter_69_90.ts
node scripts/test_bibi_remove_legacy_research_providers_v2.mjs

echo
echo "=============================================="
echo "LEGACY ORCHESTRATION CLEANUP PASSED"
echo "=============================================="
echo
echo "次のcommit:"
echo
echo 'git add -A && git commit -m "refactor: remove retired legacy orchestration facades"'
echo
echo "※ このスクリプトはpushしません。"
echo "※ legacyResearchProviderMigrationService.ts は今回削除していません。"
echo
