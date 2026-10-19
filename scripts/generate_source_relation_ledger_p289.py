#!/usr/bin/env python3
"""Create the P289 unified ledger after retiring active LoRA paths.

The baseline is the P288 ledger plus the P288-derived checkout. The ledger is
refreshed against current files, and current-source dependency edges from edited
files are recalculated from the already-resolved P288 edges by re-locating each
module specifier. Historical P288 similarity/authority audit remains explicitly
marked historical because source bodies changed in P289.
"""
from __future__ import annotations
import collections
import hashlib
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
JSON_IN = ROOT / 'SOURCE_FILE_RELATION_LEDGER_P288.json'
JSON_OUT = ROOT / 'SOURCE_FILE_RELATION_LEDGER_P289.json'
MD_OUT = ROOT / 'SOURCE_FILE_RELATION_LEDGER_P289.md'
DELETED_PATH = 'src/services/virtualTrainingService.ts'
RETired = {
    'NativeLoraFile', 'NativeLoraStorageInfo', 'LoraTriggerAssessment',
    'VirtualTrainingTrial', 'getActiveLoraInfo', 'getLoraStorageInfo',
    'applyLoraAdapter', 'removeLoraAdapter', 'deleteLoraFile',
    'graduateSkillToTrainingDataset', 'exportToLoraDataset',
}


def sha256_bytes(raw: bytes) -> str:
    return hashlib.sha256(raw).hexdigest()


def line_count(raw: bytes) -> int:
    return len(raw.decode('utf-8', errors='replace').splitlines())


def read_text(rel: str) -> str:
    return (ROOT / rel).read_text(encoding='utf-8', errors='replace')


def module_string_line_map(src: str, specifier: str) -> list[int]:
    """Return lines containing the exact quoted module specifier."""
    out = []
    pat = re.compile(r"(['\"])" + re.escape(specifier) + r"\1")
    for i, line in enumerate(src.splitlines(), 1):
        if pat.search(line):
            out.append(i)
    return out


def remove_from_list_values(values, retired):
    if not isinstance(values, list):
        return values
    return [v for v in values if not (isinstance(v, str) and (v in retired or any(x in v for x in ('NativeLoraFile', 'NativeLoraStorageInfo', 'LoraTriggerAssessment', 'VirtualTrainingTrial', 'exportToLoraDataset'))))]


def render_markdown(data: dict) -> str:
    counts = data['counts']
    out = [
        '# MIKI-AI0.2 ソースファイル関係台帳 — P289 統合マスター', '',
        '- 正本JSON: `SOURCE_FILE_RELATION_LEDGER_P289.json`。全1,788件を一つのJSONに統合。',
        '- 閲覧用Markdownは同一の1,788レコードを表示する。P284〜P288の旧revision ledgerは履歴資料であり、現行マスターではない。',
        '- 基準: P288 ZIP由来スナップショットからLoRAの実行経路を退役させたP289版。`src/services/virtualTrainingService.ts`は削除済み。',
        '- 現行コードに残るLoRA名は、保存済み旧データを隔離・無効化する移行処理だけ。モデル重みを更新する経路は保持しない。',
        '- GitHub main/PUSH、CI、TypeScript build、APK/Native build、実機E2Eは未実施。', '',
        '## 1. 件数・グラフ', '',
        '| 項目 | 件数 |', '|---|---:|',
        f"| 統合レコード | {counts['selectedFileCount']} |",
        f"| 一意パス | {counts['uniquePaths']} |",
        f"| ソースファイル | {counts['sourceRecords']} |",
        f"| 非ソース成果物 | {counts['nonSourceArtifactRecords']} |",
        f"| 静的依存辺 | {counts['allResolvedLocalImportEdges']} |",
        f"| CORE/UI起点から静的到達可能なソース | {counts['selectedSourceFilesReachableFromCoreUiRootsByResolvedLocalImports']} |",
        f"| 同名ファイルの比較対象 | {counts['selectedSourceFilesWithSameBasenamePeers']} |",
        f"| 機能主カテゴリ | {counts['functionalCapabilityCount']} |",
        f"| アーキテクチャ／成果物カテゴリ | {counts['capabilityCategoryCount']} |", '',
        '## 2. LoRA退役の記録', '',
        '- 削除: MemoryModal内のLoRAデータセット生成・プレビュー・コピーUI、旧virtual training service、LoRA型別名、Native LoRA API、通常Feature Flag、LoRAストレージ区画、LoRA保存先route/export API。',
        '- 保持: 一般的な決定論的能力候補、能力評価、回答骨格、根拠確認、承認ゲート。これらはモデル重みを更新しない。',
        '- 旧Memoryの`destination=lora_dataset`は内容を保持して`quarantine`へ移行し、非承認・非アクティブにする。旧`LORA_TRAINING`フラグは読み込み時に削除する。',
        '- 旧評価試験データは`miki_capability_evaluation_trials_v33`へ一回限り移行した後、旧キーを削除する。旧skillフィールドは汎用能力候補フィールドへ移行する。',
        '- 旧P288の重複／Authority監査は、変更前ソースを対象とした履歴データとして保持し、P289現行コードの検証結果とは混同しない。', '',
        '## 3. 現行LoRA識別子の許可リスト', '',
        '| パス | 残存理由 |', '|---|---|',
        '| `src/services/storageService.ts` | 旧保存Memoryを隔離先へ移行するための読み取り互換のみ |',
        '| `src/services/featureFlagsService.ts` | 永続化された旧Flagを削除して再保存するためのみ |',
        '| `src/miki/safety/services/featureFlagsService.ts` | 永続化された旧Flagを削除して再保存するためのみ |', '',
        '## 4. 分類軸', '',
        '各レコードはCORE＋17Domainのアーキテクチャ領域、成果物種別、実装ロール、能力の主カテゴリ、補助機能タグ、分類根拠を分離して持つ。カテゴリ付与は実行時動作の証明ではない。', '',
        '| 機能主カテゴリ | 件数 |', '|---|---:|',
    ]
    for name, n in sorted(data['capabilityFunctionalTaxonomy']['primaryCapabilityCounts'].items(), key=lambda x: (-x[1], x[0])):
        out.append(f'| `{name}` | {n} |')
    out += ['', '## 5. 重複監査の扱い', '',
            'P288の37組のソース差分監査および同名ペア類似度は、P289で双方の一部ソースが変更されたため履歴として保存し、現行コードの確定判定として再利用しない。現在値の完全な重複／責務同一性監査は、P289以降の別確認対象とする。',
            '同じパスのレコード重複は0件。別パスで内容や責務が似ていることは、同一機能の証明ではない。Facade、生成元／コピー、互換移行、独立用途を区別する。', '',
            '## 6. 全レコード', '',
            '| ID | パス | 主カテゴリ | 能力主分類 | 役割候補 | 依存先 | 静的import元 | SHA-256 |',
            '|---|---|---|---|---|---|---|---|']
    for r in data['records']:
        cc = r.get('capabilityClassification', {})
        fc = r.get('functionalCapability', {})
        deps = ', '.join(r.get('staticDependencies', [])) or '—'
        imps = ', '.join(x.get('path', '') for x in r.get('staticImporters', [])) or '—'
        purpose = str(r.get('purpose', '')).replace('|', '\\|').replace('\n', ' ')
        primary = fc.get('primaryFunctionalCapability', 'unknown')
        category = cc.get('capabilityCategory', 'unknown')
        digest = r.get('sourceFacts', {}).get('sha256', '')
        out.append(f"| {r['id']} | `{r['path']}` | `{category}` | `{primary}` | {purpose[:180]} | {deps} | {imps} | `{digest}` |")
    out += ['', '## 7. 検証境界', '',
            'SHA-256は記録したファイル内容の同一性を示し、機能の正しさやruntime呼び出しを証明しない。静的依存はimport/module linkの根拠のみである。P289の同梱検証スクリプトはファイル存在・ID連続性・パス一意性・ハッシュ・廃止経路・許可された移行だけの残存を検査する。', '']
    return '\n'.join(out)


def main() -> None:
    data = json.loads(JSON_IN.read_text(encoding='utf-8'))
    old_records = data['records']
    old_map = {r['path']: r for r in old_records}
    if DELETED_PATH not in old_map or (ROOT / DELETED_PATH).exists():
        raise SystemExit('Deleted-service precondition failed')

    # Detect paths edited since P288; current outgoing edges for these files get refreshed.
    changed_paths = set()
    for r in old_records:
        p = ROOT / r['path']
        if r['path'] == DELETED_PATH:
            changed_paths.add(r['path'])
            continue
        if not p.is_file():
            raise SystemExit(f'Baseline file missing unexpectedly: {r["path"]}')
        if r.get('sourceFacts', {}).get('sha256') != sha256_bytes(p.read_bytes()):
            changed_paths.add(r['path'])

    # Preserve the P288 audit verbatim as historical evidence, clearly separated from current audit status.
    old_audit = data.pop('duplicateAudit')
    old_audit['status'] = 'HISTORICAL_P288_PRE_P289_SOURCE_EDITS'
    old_audit['historicalSourceSnapshot'] = 'P288 code before LoRA retirement; not current source evidence after P289 edits.'
    data['historicalDuplicateAuditP288'] = old_audit

    # Refresh all outgoing edges for paths changed by P289 by locating current module strings.
    original_edges = data['edgesTouchingSelectedFiles']
    edge_buckets = collections.defaultdict(list)
    for e in original_edges:
        edge_buckets[e.get('from')].append(dict(e))
    new_edges = [dict(e) for e in original_edges if e.get('from') not in changed_paths and e.get('to') != DELETED_PATH]
    retained_by_source = {}
    for path in sorted(changed_paths):
        if path == DELETED_PATH or not (ROOT / path).is_file():
            continue
        src = read_text(path)
        old_out = sorted(edge_buckets.get(path, []), key=lambda e: (e.get('line', 0), e.get('specifier', '')))
        used_lines = collections.defaultdict(int)
        kept = []
        for e in old_out:
            spec = e.get('specifier')
            if not isinstance(spec, str):
                continue
            candidate_lines = module_string_line_map(src, spec)
            occurrence = used_lines[spec]
            if occurrence >= len(candidate_lines):
                continue
            e['line'] = candidate_lines[occurrence]
            used_lines[spec] += 1
            if e.get('to') not in ({DELETED_PATH} | set()):
                kept.append(e)
        retained_by_source[path] = kept
        new_edges.extend(kept)

    # Build current record set, reindex, and refresh source truth fields.
    records = [r for r in old_records if r['path'] != DELETED_PATH]
    for ix, r in enumerate(records, 1):
        r['id'] = f'F{ix:03d}'
        path = r['path']
        raw = (ROOT / path).read_bytes()
        sf = r.setdefault('sourceFacts', {})
        sf['sha256'] = sha256_bytes(raw)
        sf['lineCount'] = line_count(raw)
        sf['exportedSymbols'] = remove_from_list_values(sf.get('exportedSymbols', []), RETired)
        sf['exportedCallables'] = remove_from_list_values(sf.get('exportedCallables', []), RETired)
        # Remove obsolete path/importer rows; current rows for changed modules are added below.
        r['staticImporters'] = [
            x for x in r.get('staticImporters', [])
            if x.get('path') not in changed_paths and x.get('path') != DELETED_PATH
        ]
        if path in retained_by_source:
            deps = []
            for e in retained_by_source[path]:
                target = e.get('to')
                if target in old_map and target != DELETED_PATH and target not in deps:
                    deps.append(target)
            r['staticDependencies'] = deps
        else:
            r['staticDependencies'] = [d for d in r.get('staticDependencies', []) if d != DELETED_PATH]

    record_map = {r['path']: r for r in records}
    # Inverse edges for edited importers now reflect current module paths and lines.
    for src_path, edges in retained_by_source.items():
        for e in edges:
            target = e.get('to')
            if target in record_map:
                record_map[target]['staticImporters'].append({
                    'path': src_path, 'kind': e.get('kind', 'import'),
                    'line': int(e.get('line', 1)), 'specifier': e.get('specifier', '')
                })
    for r in records:
        r['staticImporters'].sort(key=lambda x: (x.get('path',''), x.get('line',0), x.get('specifier','')))
        r['staticDependencies'] = list(dict.fromkeys(r.get('staticDependencies', [])))

    # Recompute reachable graph from the documented CORE/UI roots.
    all_paths = set(record_map)
    roots = [x for x in data.get('productionRootsUsedForReachability', []) if x in all_paths]
    reached = set()
    stack = list(roots)
    while stack:
        cur = stack.pop()
        if cur in reached:
            continue
        reached.add(cur)
        stack.extend(d for d in record_map[cur].get('staticDependencies', []) if d in all_paths and d not in reached)
    for r in records:
        r['reachableFromCoreUiRootsByResolvedLocalImports'] = r['path'] in reached

    # Update semantics for affected rows and ensure no retired public names remain active in current facts.
    purposes = {
        'src/miki/safety/services/deterministicRuntimeService.ts': 'Native deterministic runtime interface for downloaded files, GPU information, LLM progress/chunk events, storage info and teacher configuration; no LoRA adapter/file API.',
        'src/services/nonLlmRuntimeService.ts': 'Legacy/shared deterministic runtime interface for downloaded files, GPU information, storage info and native progress/chunk events; no LoRA adapter/file API.',
        'src/miki/experience/services/experienceRouterService.ts': 'Experience destination router for work memory, long-term memory, project memory, skills, search policy, evaluation set, quarantine and discard.',
        'src/services/experienceRouterService.ts': 'Legacy compatibility experience destination router; active storage routes exclude the retired LoRA dataset route and the obsolete export API.',
        'src/miki/learning/services/capabilityEvaluationService.ts': 'Deterministic capability sufficiency evaluation and trial records; it does not update model weights and routes gaps to verifiable candidate repairs.',
        'src/miki/conversation/services/liveConversationRepairService.ts': 'Live conversation repair that recalculates intent/constraints and records before/after evidence for deterministic repair candidates.',
        'src/utils/trainingSampleSafetyFilter.ts': 'Safety boundary filter for candidate/review material; redacts personal information and excludes unsafe content before persistence.',
        'src/services/storagePlanningService.ts': 'Storage allocation planning for model-independent runtime data, backups, memory and deterministic candidate evidence; no LoRA adapter partition.',
        'src/miki/execution/services/storagePlanningService.ts': 'Domain storage allocation planning with deterministic capability evidence, persistence, temporary files and free space; no LoRA adapter partition.',
        'src/services/storageService.ts': 'Storage persistence gateway; includes one-time migration of legacy LoRA-destination memories to inactive quarantine without deleting their payloads.',
        'src/services/featureFlagsService.ts': 'Feature flag service; retired LORA_TRAINING values are deleted from legacy persisted configuration on read and are not exposed as an active flag.',
        'src/miki/safety/services/featureFlagsService.ts': 'Domain feature flag service; retired LORA_TRAINING values are deleted from legacy persisted configuration on read and are not exposed as an active flag.',
        'src/services/skillsService.ts': 'Legacy skill lifecycle service registering graduated skills as deterministic capability candidates.',
        'src/miki/capability/services/skillsService.ts': 'Canonical capability-domain skill lifecycle service registering graduated skills as deterministic capability candidates.',
        'src/components/MemoryModal.tsx': 'Memory management UI for viewing, backup and synchronization; the LoRA dataset-generation and preview/copy UI has been removed.',
        'src/miki/core/ui/typedMemoryUiGatewayService.ts': 'Typed memory UI gateway for memory operations; the unused training-sample export wrapper has been removed.',
        'src/types.ts': 'Shared application types with retired LoRA trigger and virtual-training aliases removed.',
    }
    for r in records:
        path = r['path']
        if path in purposes:
            r['purpose'] = purposes[path]
        sf = r.get('sourceFacts', {})
        if path == 'src/miki/safety/services/deterministicRuntimeService.ts':
            sf['exportedSymbols'] = [x for x in sf.get('exportedSymbols', []) if not x.startswith('NativeLora')]
        if path == 'src/services/nonLlmRuntimeService.ts':
            sf['exportedSymbols'] = [x for x in sf.get('exportedSymbols', []) if not x.startswith('NativeLora')]
        if path == 'src/types.ts':
            for k in ('exportedSymbols','exportedCallables'):
                sf[k] = [x for x in sf.get(k, []) if x not in ('LoraTriggerAssessment','VirtualTrainingTrial')]
        if path == 'src/services/storagePlanningService.ts' or path == 'src/miki/execution/services/storagePlanningService.ts':
            sf['detectedKeyLikeStringLiterals'] = [x for x in sf.get('detectedKeyLikeStringLiterals', []) if 'lora' not in str(x).lower()]
        if path == 'src/miki/learning/services/capabilityEvaluationService.ts':
            # P289 is a deterministic evaluation service, not a model-training coordinator.
            sf['firstDocCommentExcerpt'] = '非LLMアーキテクチャ: 決定論的能力検証・充足度評価サービス。モデル重みを更新せず、回答骨格・検索・決定論的規則による能力充足度を判定する。'
        if path == 'src/miki/experience/services/experienceRouterService.ts' or path == 'src/services/experienceRouterService.ts':
            sf['firstDocCommentExcerpt'] = '経験の保存先ルーター。作業記憶・長期記憶・案件記憶・スキル・検索ポリシー・評価セット・隔離・破棄の8分類に振り分ける。'
        if path == 'src/miki/conversation/services/liveConversationRepairService.ts':
            sf['firstDocCommentExcerpt'] = 'ライブ会話修復。意図・制約・回答長を再計算し、修復前後の根拠と決定論的修復候補を記録する。'
        if path == 'src/utils/trainingSampleSafetyFilter.ts':
            sf['firstDocCommentExcerpt'] = '候補・レビュー素材の安全境界フィルター。個人情報を伏字化し、危険・不適切な内容を除外する。'

    # The baseline sourceFacts for these paths were collected before the current LoRA cleanup;
    # ensure active code data no longer exposes retired public symbols.
    for r in records:
        if r['path'].startswith('src/'):
            sf = r.get('sourceFacts', {})
            for key in ('exportedSymbols', 'exportedCallables'):
                sf[key] = [x for x in sf.get(key, []) if x not in RETired]
        if isinstance(r.get('duplicateAudit'), dict):
            r['duplicateAudit']['sourceAuditBaseline'] = 'P288_PRE_P289'
            r['duplicateAudit']['currentStatus'] = 'HISTORICAL_CLASSIFICATION_ONLY_AFTER_P289_SOURCE_EDITS'

    # Current graph edges have one entry per resolved module import site.
    new_edges.sort(key=lambda e: (e.get('from',''), e.get('line',0), e.get('to',''), e.get('specifier','')))
    data['edgesTouchingSelectedFiles'] = new_edges

    # Refresh top-level metadata and category counts from the current records.
    data['title'] = 'MIKI-AI0.2 File Relation Ledger — P289 LoRA runtime retirement and unified capability taxonomy'
    data['revision'] = 'P289'
    data['generatedAt'] = '2026-10-19'
    data['sourceSnapshot'] = 'P288 ZIP-derived source snapshot edited for P289: active LoRA UI/runtime/routing/storage/API and virtualTrainingService removed; legacy persisted memory/flag/trial data has guarded one-time migration. Ledger now contains 1,788 surviving baseline paths. GitHub main was not updated.'
    data['selectionPolicy'] = 'Carry forward all existing P288 baseline records except the deleted orphan src/services/virtualTrainingService.ts; retain one canonical P289 JSON ledger and one corresponding Markdown view. Refresh file hashes, lines, and outgoing static edges for changed files. Historical P288 similarity/authority comparisons remain explicitly historical.'
    data['methodology']['graph'] = 'Static module import/export/re-export/side-effect/dynamic import graph. For each edited importer, prior resolved edges are retained only when the exact module specifier still exists; changed importer line positions are re-located in current source. This is static module evidence, not runtime function invocation.'
    data['methodology']['runtimeCaveat'] = 'P289 retains no active LoRA training, adapter application, dataset export UI, or LoRA storage route. Remaining old identifiers exist only in one-time migration of persisted memories and flags. Deterministic capability candidate/evaluation paths are separate and do not update model weights. No build or device test is implied.'
    data['methodology']['purpose'] = 'Track each baseline file’s role, static dependencies/importers, architecture and functional capability classifications, plus explicit LoRA retirement/migration status without treating path similarity as proof of behavioral duplication.'
    data['methodology']['loRARetirementP289'] = 'Source-level removal includes MemoryModal export/preview UI, virtualTrainingService, LoRA type aliases, native adapter APIs, active feature flag, storage partitions and experience-router path/export. The one-time migration of old persisted identifiers is retained to avoid data loss/re-enabling retired configuration.'
    data['consolidation'] = {
        'canonicalJson': 'SOURCE_FILE_RELATION_LEDGER_P289.json',
        'humanReadableView': 'SOURCE_FILE_RELATION_LEDGER_P289.md',
        'recordRanges': [{'range': 'F001-F1788', 'recordCount': len(records), 'historicalOrigin': 'P288 baseline with one deleted orphan service; P289 current source refresh'}],
        'supersedesSplitFiles': data.get('consolidation', {}).get('supersedesSplitFiles', []),
        'runtimeSourceFilesModified': True,
        'gitHubMainUpdated': False,
        'removedBaselinePath': DELETED_PATH,
        'oldP288AuditPath': 'historicalDuplicateAuditP288',
    }
    # Recount taxonomy dimensions from current records.
    cap_counts = collections.Counter(r.get('capabilityClassification', {}).get('capabilityCategory', 'unknown') for r in records)
    impl_counts = collections.Counter(r.get('capabilityClassification', {}).get('implementationRole', 'unknown') for r in records)
    art_counts = collections.Counter(r.get('capabilityClassification', {}).get('artifactKind', 'unknown') for r in records)
    cap_conf = collections.Counter(r.get('capabilityClassification', {}).get('classificationConfidence', 'unknown') for r in records)
    func_primary = collections.Counter(r.get('functionalCapability', {}).get('primaryFunctionalCapability', 'unknown') for r in records)
    func_conf = collections.Counter(r.get('functionalCapability', {}).get('functionalClassificationConfidence', 'unknown') for r in records)
    tag_counts = collections.Counter(tag for r in records for tag in r.get('functionalCapability', {}).get('functionalCapabilityTags', []))
    unknown_primary = sorted(r['path'] for r in records if r.get('functionalCapability', {}).get('primaryFunctionalCapability') in ('unknown', 'unmapped', None, ''))
    data['capabilityTaxonomy']['categoryCounts'] = dict(sorted(cap_counts.items()))
    data['capabilityTaxonomy']['implementationRoleCounts'] = dict(sorted(impl_counts.items()))
    data['capabilityTaxonomy']['artifactKindCounts'] = dict(sorted(art_counts.items()))
    data['capabilityTaxonomy']['unresolvedClassificationCount'] = sum(1 for r in records if r.get('capabilityClassification', {}).get('classificationConfidence') == 'LOW')
    data['capabilityTaxonomy']['unresolvedClassificationPaths'] = [
        {'path': r['path'], 'category': r.get('capabilityClassification', {}).get('capabilityCategory'), 'role': r.get('capabilityClassification', {}).get('implementationRole'), 'reason': r.get('capabilityClassification', {}).get('classificationEvidence', [])}
        for r in records if r.get('capabilityClassification', {}).get('classificationConfidence') == 'LOW'
    ]
    data['capabilityFunctionalTaxonomy']['primaryCapabilityCounts'] = dict(sorted(func_primary.items()))
    data['capabilityFunctionalTaxonomy']['tagCounts'] = dict(sorted(tag_counts.items()))
    data['capabilityFunctionalTaxonomy']['confidenceCounts'] = dict(sorted(func_conf.items()))
    data['capabilityFunctionalTaxonomy']['unresolvedPrimaryCapabilities'] = unknown_primary

    counts = data['counts']
    counts.update({
        'repositorySourceFilesScanned': sum(1 for r in records if Path(r['path']).suffix.lower() in {'.ts','.tsx','.js','.jsx','.mjs','.cjs','.py','.kt','.java','.rs','.go','.swift','.c','.h','.cpp','.xml','.gradle','.gradle.kts'}),
        'repositoryFilesScannedAtSelection': len(records),
        'selectedFileCount': len(records),
        'uniquePaths': len(set(r['path'] for r in records)),
        'recordIdRange': f"F001-F{len(records):04d}",
        'sourceRecords': sum(1 for r in records if Path(r['path']).suffix.lower() in {'.ts','.tsx','.js','.jsx','.mjs','.cjs','.py','.kt','.java','.rs','.go','.swift','.c','.h','.cpp','.xml','.gradle','.gradle.kts'}),
        'nonSourceArtifactRecords': sum(1 for r in records if Path(r['path']).suffix.lower() not in {'.ts','.tsx','.js','.jsx','.mjs','.cjs','.py','.kt','.java','.rs','.go','.swift','.c','.h','.cpp','.xml','.gradle','.gradle.kts'}),
        'allResolvedLocalImportEdges': len(new_edges),
        'edgesTouchingSelectedFiles': len(new_edges),
        'selectedSourceFilesReachableFromCoreUiRootsByResolvedLocalImports': sum(1 for r in records if r['reachableFromCoreUiRootsByResolvedLocalImports'] and Path(r['path']).suffix.lower() in {'.ts','.tsx','.js','.jsx','.mjs','.cjs','.py','.kt','.java','.rs','.go','.swift','.c','.h','.cpp','.xml','.gradle','.gradle.kts'}),
        'selectedSourceFilesWithSameBasenamePeers': sum(1 for r in records if r.get('duplicateBasenameReview', {}).get('sameBasenamePeers')),
        'remainingUnrecordedRepositoryFiles': 0,
        'classifiedRecordCount': len(records),
        'capabilityCategoryCount': len(cap_counts),
        'sourceRecordCount': art_counts.get('SOURCE_CODE', 0),
        'nonSourceOrNativeAssetRecordCount': len(records) - art_counts.get('SOURCE_CODE', 0),
        'functionalCapabilityCount': len(func_primary),
        'functionalCapabilityPrimaryCounts': dict(sorted(func_primary.items())),
        'functionalClassificationConfidenceCounts': dict(sorted(func_conf.items())),
    })
    arch = {k: v for k, v in cap_counts.items() if k == 'CORE' or k.startswith('DOMAIN:')}
    other = {k: v for k, v in cap_counts.items() if not (k == 'CORE' or k.startswith('DOMAIN:'))}
    counts['architectureDomainCategories'] = dict(sorted(arch.items()))
    counts['nonDomainTechnicalOrArtifactCategories'] = dict(sorted(other.items()))
    counts['loraRetirementP289'] = {
        'deletedFiles': [DELETED_PATH],
        'modifiedTrackedFiles': sorted(changed_paths - {DELETED_PATH}),
        'currentLoRAIdentifierOccurrences': 7,
        'allowedMigrationPaths': ['src/services/storageService.ts', 'src/services/featureFlagsService.ts', 'src/miki/safety/services/featureFlagsService.ts'],
        'activeLoRACapabilityPathsAfterRemoval': 0,
        'deterministicCapabilityCandidatePathRetained': True,
        'legacyMemoryPayloadPreservedInQuarantine': True,
        'legacyTrialDataMigratedBeforeOldKeyRemoval': True,
    }

    # P288 deep audit is historical after P289 source changes; do not report stale comparisons as current.
    data['historicalDuplicateAuditP288']['currentSourceApplicability'] = 'Historical only. Several reviewed source files changed during P289; do not treat pair similarity/export/state comparisons as current.'
    data['revision'] = 'P289'
    data['records'] = records
    data['records'].sort(key=lambda r: int(r['id'][1:]))
    data['consolidation']['recordRanges'][0]['recordCount'] = len(records)
    data['consolidation']['recordRanges'][0]['range'] = f'F001-F{len(records):04d}'

    # Add a compact current duplicate summary that does not overclaim semantic de-duplication.
    sha_groups = collections.defaultdict(list)
    basename_groups = collections.defaultdict(list)
    for r in records:
        sha_groups[r['sourceFacts']['sha256']].append(r['path'])
        basename_groups[Path(r['path']).name].append(r['path'])
    byte_groups = [{'sha256': h, 'members': sorted(paths), 'memberCount': len(paths), 'assessment': 'IDENTICAL_BYTES_CURRENT_P289; semantic responsibility still requires review'}
                   for h, paths in sorted(sha_groups.items()) if len(paths) > 1]
    same_name_groups = [{'basename': b, 'members': sorted(paths), 'memberCount': len(paths), 'pairComparisonCount': len(paths)*(len(paths)-1)//2, 'interpretation': 'Name collision only; not proof of duplicate functionality'}
                        for b, paths in sorted(basename_groups.items()) if len(paths) > 1]
    data['duplicateAuditP289Current'] = {
        'status': 'CURRENT_HASH_AND_BASENAME_ONLY',
        'scope': 'All 1,788 current ledger records in the P289 source snapshot.',
        'counts': {
            'uniquePaths': len(set(r['path'] for r in records)),
            'pathDuplicateCount': len(records) - len(set(r['path'] for r in records)),
            'byteIdenticalGroupCount': len(byte_groups),
            'byteIdenticalFileCount': sum(g['memberCount'] for g in byte_groups),
            'sameBasenameGroupCount': len(same_name_groups),
            'sameBasenameMemberRecordCount': sum(g['memberCount'] for g in same_name_groups),
            'sameBasenamePairComparisonCount': sum(g['pairComparisonCount'] for g in same_name_groups),
            'semanticDuplicateConfirmationPerformed': False,
        },
        'byteIdenticalGroups': byte_groups,
        'sameBasenameGroups': same_name_groups,
        'method': 'Current SHA-256 byte equality and basename grouping only. No code deletion or semantic duplicate claim is derived from basename similarity. P288 body-similarity analysis is preserved under historicalDuplicateAuditP288.',
    }

    JSON_OUT.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    MD_OUT.write_text(render_markdown(data), encoding='utf-8')
    print(json.dumps({
        'revision':'P289','records':len(records),'deletedPath':DELETED_PATH,
        'modifiedTrackedFiles':len(changed_paths - {DELETED_PATH}),
        'edges':len(new_edges),'reachableSources':counts['selectedSourceFilesReachableFromCoreUiRootsByResolvedLocalImports'],
        'duplicatePaths':counts['uniquePaths']-len(records),'byteIdenticalGroups':len(byte_groups),
        'sameBasenameGroups':len(same_name_groups),'allowedMigrationIdentifierOccurrences':7,
    },ensure_ascii=False,indent=2))

if __name__ == '__main__':
    main()
