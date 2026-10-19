#!/usr/bin/env python3
"""Verify P292 LoRA retirement remains intact after CORE autonomy fixes."""
from __future__ import annotations
import collections
import hashlib
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LEDGER = ROOT / 'SOURCE_FILE_RELATION_LEDGER_P292.json'
RETIRED_SERVICE = 'src/services/virtualTrainingService.ts'
WORD = re.compile(r'\b(?:lora_dataset|LORA_TRAINING|NativeLoraFile|NativeLoraStorageInfo|LoraTriggerAssessment|VirtualTrainingTrial|applyLoraAdapter|removeLoraAdapter|deleteLoraFile|exportToLoraDataset|virtualTrainingService|LoRA|lora)\b', re.I)
SOURCE_EXTS = {'.ts', '.tsx', '.js', '.jsx'}
errors: list[str] = []
checks: list[str] = []


def check(condition: bool, message: str) -> None:
    if condition:
        checks.append(message)
    else:
        errors.append(message)


def digest(path: Path) -> str:
    h = hashlib.sha256()
    with path.open('rb') as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b''):
            h.update(chunk)
    return h.hexdigest()


def main() -> int:
    check(LEDGER.is_file(), 'P292 JSON ledger exists')
    if not LEDGER.is_file():
        return finish()
    data = json.loads(LEDGER.read_text(encoding='utf-8'))
    records = data.get('records', [])
    paths = [r.get('path') for r in records]
    check(data.get('revision') == 'P292', 'ledger revision is P292')
    check(len(records) == 1787, 'ledger contains 1,787 repository-path records')
    check(len(paths) == len(set(paths)), 'ledger paths are unique')
    check([r.get('id') for r in records] == [f'F{i:03d}' for i in range(1, len(records) + 1)], 'ledger IDs are continuous F001-F1787')
    check(RETIRED_SERVICE not in paths and not (ROOT / RETIRED_SERVICE).exists(), 'obsolete virtualTrainingService is removed from source and ledger')
    check(data.get('counts', {}).get('allResolvedLocalImportEdges') == len(data.get('edgesTouchingSelectedFiles', [])), 'ledger static-edge count matches current edge list')
    check(data.get('counts', {}).get('selectedFileCount') == len(records), 'ledger selectedFileCount matches record count')
    check(data.get('counts', {}).get('uniquePaths') == len(set(paths)), 'ledger uniquePaths matches record paths')
    check(data.get('consolidation', {}).get('gitHubMainUpdated') is False, 'ledger accurately records GitHub main as not updated')
    check('historicalDuplicateAuditP288' in data and data['historicalDuplicateAuditP288'].get('status') == 'HISTORICAL_P288_PRE_P289_SOURCE_EDITS', 'P288 source similarity audit is marked historical')
    check('duplicateAuditP290Current' in data, 'historical P290 duplicate/authority audit remains available')
    check(data.get('authorityConvergenceP290', {}).get('counts', {}).get('currentBodyDuplicatePairs') == 0, '37 service pairs have no independent legacy implementation')

    record_map = {r['path']: r for r in records}
    for r in records:
        rel = r['path']
        file = ROOT / rel
        if not file.is_file():
            errors.append(f'missing recorded file: {rel}')
            continue
        sf = r.get('sourceFacts', {})
        if sf.get('sha256') != digest(file):
            errors.append(f'SHA-256 mismatch: {rel}')
        current_lines = len(file.read_bytes().decode('utf-8', errors='replace').splitlines())
        if sf.get('lineCount') != current_lines:
            errors.append(f'lineCount mismatch: {rel}')
        for dep in r.get('staticDependencies', []):
            if not (ROOT / dep).is_file():
                errors.append(f'missing static dependency: {rel} -> {dep}')
        for imp in r.get('staticImporters', []):
            if not (ROOT / imp.get('path', '')).is_file():
                errors.append(f'missing static importer: {rel} <- {imp.get("path")}')
    check(not any('missing recorded file:' in e for e in errors), 'all ledger files exist')
    check(not any('SHA-256 mismatch:' in e for e in errors), 'all ledger SHA-256 hashes match')
    check(not any('lineCount mismatch:' in e for e in errors), 'all ledger line counts match')
    check(not any('missing static dependency:' in e or 'missing static importer:' in e for e in errors), 'all listed static dependencies/importers exist')

    # Check that edge list and inverse importer rows are exactly aligned for recorded targets.
    edge_counter = collections.Counter(
        (e.get('to'), e.get('from'), e.get('kind'), e.get('line'), e.get('specifier'))
        for e in data.get('edgesTouchingSelectedFiles', []) if e.get('to') in record_map
    )
    importer_counter = collections.Counter(
        (target, i.get('path'), i.get('kind'), i.get('line'), i.get('specifier'))
        for target, r in record_map.items() for i in r.get('staticImporters', [])
    )
    check(edge_counter == importer_counter, 'static import edges and inverse importer rows agree')

    # Active source-code references may remain only in the designated one-time migrations.
    remaining = []
    for file in (ROOT / 'src').rglob('*'):
        if not file.is_file() or file.suffix.lower() not in SOURCE_EXTS:
            continue
        rel = file.relative_to(ROOT).as_posix()
        for n, line in enumerate(file.read_text(encoding='utf-8', errors='replace').splitlines(), 1):
            if not WORD.search(line):
                continue
            allowed = False
            if rel == 'src/services/storageService.ts' and "memory?.destination !== 'lora_dataset'" in line:
                allowed = True
            elif rel == 'src/miki/safety/services/featureFlagsService.ts' and (
                'SystemFeatureFlags & { LORA_TRAINING?: unknown }' in line
                or "call(persisted, 'LORA_TRAINING')" in line
                or 'delete (flags as any).LORA_TRAINING' in line
            ):
                allowed = True
            if allowed:
                remaining.append((rel, n, line.strip(), 'MIGRATION_ONLY'))
            else:
                errors.append(f'active/unknown LoRA-related source reference: {rel}:{n}: {line.strip()}')
    check(len(remaining) == 4, 'only 4 LoRA identifier occurrences remain, all in one-time storage/feature-flag migrations')

    mem = (ROOT / 'src/services/storageService.ts').read_text(encoding='utf-8')
    check("destination: 'quarantine'" in mem and 'approved: false' in mem and 'active: false' in mem, 'legacy LoRA-destination memories migrate into inactive unapproved quarantine')
    flags_default = (ROOT / 'src/services/featureFlagsService.ts').read_text(encoding='utf-8')
    flags_domain = (ROOT / 'src/miki/safety/services/featureFlagsService.ts').read_text(encoding='utf-8')
    check("export * from '../miki/safety/services/featureFlagsService'" in flags_default, 'legacy feature-flag path is a compatibility facade')
    check(not re.search(r'^\s*LORA_TRAINING\s*:', flags_domain, re.M), 'canonical domain feature flags have no active LORA_TRAINING default')
    for path in ('src/components/MemoryModal.tsx', 'src/miki/core/ui/typedMemoryUiGatewayService.ts'):
        txt = (ROOT / path).read_text(encoding='utf-8')
        check(not re.search(r'handleExportTrainingData|loraPreviewModalOpen|loraPreviewContent|loraPreviewCount|exportToLoraDataset|getTrainingSamples\s*\(', txt), f'LoRA dataset UI/export wrapper removed from {path}')
    for path in ('src/services/nonLlmRuntimeService.ts', 'src/miki/safety/services/deterministicRuntimeService.ts'):
        txt = (ROOT / path).read_text(encoding='utf-8')
        check(not re.search(r'NativeLora|applyLoraAdapter|removeLoraAdapter|deleteLoraFile|getLoraStorageInfo|getActiveLoraInfo', txt), f'Native runtime LoRA API removed from {path}')
    for path in ('src/services/storagePlanningService.ts', 'src/miki/execution/services/storagePlanningService.ts'):
        txt = (ROOT / path).read_text(encoding='utf-8').lower()
        check('lora' not in txt, f'LoRA storage partition removed from {path}')
    types = (ROOT / 'src/types.ts').read_text(encoding='utf-8')
    check('LoraTriggerAssessment' not in types and 'VirtualTrainingTrial' not in types, 'retired LoRA/virtual-training aliases removed from shared types')
    router = (ROOT / 'src/services/experienceRouterService.ts').read_text(encoding='utf-8')
    check('exportToLoraDataset' not in router and "destination: 'lora_dataset'" not in router, 'legacy LoRA route and export API removed')

    eval_service = (ROOT / 'src/miki/learning/services/capabilityEvaluationService.ts').read_text(encoding='utf-8')
    check("miki_capability_evaluation_trials_v33" in eval_service and "miki_virtual_training_trials_v32" in eval_service, 'legacy trial storage migration remains explicit')
    check(eval_service.index('storageService.setItem(CAPABILITY_TRIALS_KEY') < eval_service.index('storageService.removeItem(LEGACY_CAPABILITY_TRIALS_KEY'), 'legacy trial key is removed only after saving migrated records')
    skills = (ROOT / 'src/miki/capability/services/skillsService.ts').read_text(encoding='utf-8')
    check('registerGraduatedSkillAsCapabilityCandidate' in skills and 'registerCapabilityCandidate' in skills, 'deterministic skill-to-capability-candidate path remains')
    check((ROOT / 'src/services/deterministicCapabilityEvolutionService.ts').is_file(), 'deterministic capability evolution service remains')

    if errors:
        print(json.dumps({'status': 'FAIL', 'checksPassed': len(checks), 'errors': errors}, ensure_ascii=False, indent=2))
        return 1
    print(json.dumps({'status': 'PASS', 'checksPassed': len(checks), 'records': len(records), 'staticEdges': len(data.get('edgesTouchingSelectedFiles', [])), 'duplicatePaths': 0, 'currentLoRAIdentifiersAllowedForMigrationOnly': len(remaining), 'checks': checks}, ensure_ascii=False, indent=2))
    return 0


def finish() -> int:
    print(json.dumps({'status':'FAIL','errors':errors}, ensure_ascii=False, indent=2))
    return 1

if __name__ == '__main__':
    sys.exit(main())
