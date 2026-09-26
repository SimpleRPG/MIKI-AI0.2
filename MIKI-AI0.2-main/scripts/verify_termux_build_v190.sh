#!/data/data/com.termux/files/usr/bin/bash
set -euo pipefail
cd "${MIKI_REPO_ROOT:-$HOME/MIKI-AI0.2}"
command -v npm >/dev/null 2>&1 || { echo "ERROR: npm is required" >&2; exit 1; }
[ -d node_modules ] || { echo "ERROR: node_modules is missing; run npm install first" >&2; exit 1; }
printf "===== V190 TYPECHECK =====\n"
npm run lint
printf "===== V190 BUILD =====\n"
npm run build
printf "===== V190 BUILD ARTIFACTS =====\n"
[ -f dist/index.html ] || { echo "ERROR: dist/index.html missing after build" >&2; exit 1; }
[ -f dist/server.cjs ] || { echo "ERROR: dist/server.cjs missing after build" >&2; exit 1; }
printf "V190 BUILD_GATE_PASS\n"
