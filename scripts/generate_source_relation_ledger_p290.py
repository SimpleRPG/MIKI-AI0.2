#!/usr/bin/env python3
"""Refresh the unified relation ledger after P290 service-authority convergence.

The P289 inventory is the fixed audited baseline. Supporting ledger/generator
artifacts are deliberately not recursively included in that inventory.
"""
from __future__ import annotations
import collections
import hashlib
import json
import re
from pathlib import Path, PurePosixPath

ROOT = Path(__file__).resolve().parents[1]
IN_JSON = ROOT / 'SOURCE_FILE_RELATION_LEDGER_P289.json'
OUT_JSON = ROOT / 'SOURCE_FILE_RELATION_LEDGER_P290.json'
OUT_MD = ROOT / 'SOURCE_FILE_RELATION_LEDGER_P290.md'
CONVERGENCE_JSON = ROOT / 'SERVICE_AUTHORITY_CONVERGENCE_P290.json'
SOURCE_EXTS = {'.ts','.tsx','.js','.jsx','.mjs','.cjs','.py','.kt','.java','.rs','.go','.swift','.c','.h','.cpp','.xml','.gradle','.kts'}


def sha(raw: bytes) -> str:
    return hashlib.sha256(raw).hexdigest()

def lines(raw: bytes) -> int:
    return len(raw.decode('utf-8', errors='replace').splitlines())

def quote_lines(text: str, spec: str) -> list[int]:
    pat = re.compile(r"(['\"])" + re.escape(spec) + r"\1")
    return [i for i, line in enumerate(text.splitlines(), 1) if pat.search(line)]

def esc(value) -> str:
    return str(value if value is not None else '').replace('|','\\|').replace('\n',' ').replace('\r',' ')

def render_markdown(data: dict) -> str:
    counts = data['counts']
    authority = data['authorityConvergenceP290']
    out = [
      '# MIKI-AI0.2 ソースファイル関係台帳 — P290 実装Authority統合版','',
      f"- 正本JSON: `SOURCE_FILE_RELATION_LEDGER_P290.json`。生成キャッシュを除外した{counts['selectedFileCount']:,}パスを一つの統合台帳に保持。",
      '- P289 ZIP作業スナップショットを基礎に重複サービスの実装を統合。GitHub mainとは同期していない。',
      '- 37組の `src/services/` 実装を `src/miki/<domain>/services/` への再エクスポート専用ファサードに変更。既存importパスは維持し、実装とsingleton/stateの二重所有を除去。',
      '- P288/P289の旧類似度監査は履歴として保存。今回の37組の統合判定はP290の現行ソース確認に基づく。',
      '- ビルド・TypeScript全体型検査・Androidビルド・実機E2E・GitHub PUSHは未実施。', '',
      '## 1. 件数・グラフ','',
      '| 項目 | 件数 |','|---|---:|',
      f"| 台帳レコード | {counts['selectedFileCount']} |",
      f"| 一意パス | {counts['uniquePaths']} |",
      f"| ソースファイル | {counts['sourceRecords']} |",
      f"| 非ソース成果物 | {counts['nonSourceArtifactRecords']} |",
      f"| 静的import/re-export辺 | {counts['allResolvedLocalImportEdges']} |",
      f"| CORE/UI起点から静的到達可能なソース | {counts['selectedSourceFilesReachableFromCoreUiRootsByResolvedLocalImports']} |",
      f"| 同名ファイルの比較対象レコード | {counts['selectedSourceFilesWithSameBasenamePeers']} |",
      f"| 機能主カテゴリ | {counts['functionalCapabilityCount']} |",
      f"| アーキテクチャ／成果物カテゴリ | {counts['capabilityCategoryCount']} |", '',
      '## 2. P290実装Authority統合結果','',
      '| 項目 | 結果 |','|---|---:|',
      f"| 精査したサービス組 | {authority['counts']['reviewedHighPriorityPairs']} |",
      f"| 正本の実装 | {authority['counts']['canonicalImplementations']} |",
      f"| 旧パスから独立実装を除去 | {authority['counts']['legacyIndependentImplementationsRemoved']} |",
      f"| 互換ファサードとして保持 | {authority['counts']['legacyReExportFacadesRetained']} |",
      f"| 対象37組内の二重実装 | {authority['counts']['currentBodyDuplicatePairs']} |",
      f"| 固有挙動の差分を正本側に集約 | {authority['counts']['sourceBehaviorDivergencePairsMergedToCanonical']} |", '',
      '各ファサードは `export * from` のみを持ちます。既存利用側は従来の `src/services/` パスを使い続けられ、Mikiドメイン側と別々のsingletonや状態を持たなくなります。',
      '12組の挙動差分候補は正本側にあったより新しい契約・処理を保持する形で統合しました。具体的には複合意図計画、決定論的能力候補、辞書グラフ、経験ルーティング、Feature Flag旧値移行、counterfactual検証、能力ギャップの根拠統合、日本語解析の空入力処理などです。', '',
      '| サービス | 旧互換パス | 正本実装パス |', '|---|---|---|'
    ]
    for p in authority['pairs']:
        out.append(f"| `{esc(p['basename'])}` | `{esc(p['legacyPath'])}` | `{esc(p['canonicalPath'])}` |")
    out += ['', '## 3. LoRA機能の状態','',
      '- LoRAの学習・adapter操作・dataset exportを行う実行経路は退役済み。',
      '- 残存識別子は保存済み旧設定・記録の一回限り移行／隔離に限定し、アクティブなLoRA実装を再導入していない。',
      '- 決定論的な能力評価・候補作成・レビュー承認経路は別の機能として保持。', '',
      '## 4. 同一バイトのまま保持したパス','',
      '以下は内容が同じでも役割・パス要件が異なるため削除していません。', '',
      '| ファイル群 | 判定 |', '|---|---|'
    ]
    for g in data['duplicateAuditP290Current']['byteIdenticalGroups']:
        members = '<br>'.join(f"`{esc(x)}`" for x in g['members'])
        out.append(f"| {members} | {esc(g.get('assessment','用途確認後に保持'))} |")
    out += ['',
      '形態素プラグインは `android-native` の元ファイルをインストーラが `android/app` 側へコピーします。ランチャー／splashの画像はAndroidのqualifier/name lookupで別パスが必要です。背景ワーカーはAndroidアプリ側のコピーをインストーラが上書きしない契約と検証参照があるため、今回削除せず次回の実行時参照確認対象として残しています。', '',
      '## 5. 分類軸','',
      '各レコードはアーキテクチャ領域、成果物種別、実装ロール、機能主カテゴリ、補助タグ、分類根拠を分けて記録します。分類・静的importは、単独では実行時呼び出しの証明になりません。','',
      '| 機能主カテゴリ | 件数 |','|---|---:|'
    ]
    for name, n in sorted(data['capabilityFunctionalTaxonomy']['primaryCapabilityCounts'].items(), key=lambda x: (-x[1], x[0])):
        out.append(f'| `{esc(name)}` | {n} |')
    out += ['', '## 6. 全レコード','',
      '| ID | パス | 主カテゴリ | 能力主分類 | 役割 | 依存先 | 静的import元 | SHA-256 |',
      '|---|---|---|---|---|---|---|---|']
    for r in data['records']:
        cc = r.get('capabilityClassification', {})
        fc = r.get('functionalCapability', {})
        deps = ', '.join(r.get('staticDependencies', [])) or '—'
        imps = ', '.join(x.get('path', '') for x in r.get('staticImporters', [])) or '—'
        purpose = esc(r.get('purpose', ''))[:180]
        category = cc.get('capabilityCategory', 'unknown')
        primary = fc.get('primaryFunctionalCapability', 'unknown')
        role = cc.get('implementationRole', 'unknown')
        digest = r.get('sourceFacts', {}).get('sha256', '')
        out.append(f"| {r['id']} | `{esc(r['path'])}` | `{esc(category)}` | `{esc(primary)}` | `{purpose}` ({esc(role)}) | {esc(deps)} | {esc(imps)} | `{digest}` |")
    out += ['', '## 7. 検証境界','',
      'P290の静的回帰検証は37ファサードの転送先、余分な独立実装の不在、正本機能契約、LoRA実行経路の不在、台帳内のSHA-256・importグラフ整合を検査します。型チェック・アプリビルド・実機テストは別途必要です。','']
    return '\n'.join(out)

def main() -> None:
    data = json.loads(IN_JSON.read_text(encoding='utf-8'))
    report = json.loads(CONVERGENCE_JSON.read_text(encoding='utf-8'))
    records = [r for r in data['records'] if not ('__pycache__' in PurePosixPath(r['path']).parts or PurePosixPath(r['path']).suffix == '.pyc')]
    for idx, record in enumerate(records, 1):
        record['id'] = f"F{idx:03d}" if idx < 1000 else f"F{idx}"
    data['records'] = records
    rec_by = {r['path']: r for r in records}
    pair_by_legacy = {p['legacyPath']: p for p in report['pairs']}
    pair_by_canonical = {p['canonicalPath']: p for p in report['pairs']}
    expected_pairs = len(report['pairs'])
    if expected_pairs != 37 or len(rec_by) != 1787:
        raise SystemExit(f'baseline mismatch pairs={expected_pairs} records={len(rec_by)}')
    for p in report['pairs']:
        if p['legacyPath'] not in rec_by or p['canonicalPath'] not in rec_by:
            raise SystemExit(f"ledger missing duplicate pair {p['basename']}")
        if not (ROOT/p['legacyPath']).is_file() or not (ROOT/p['canonicalPath']).is_file():
            raise SystemExit(f"source missing for pair {p['basename']}")

    # Keep old duplicate audit but explicitly demote it to historical status.
    old_audit = data.pop('duplicateAuditP289Current', None)
    if old_audit:
        old_audit['status'] = 'HISTORICAL_P289_HASH_AND_BASENAME_AUDIT'
        old_audit['historicalSourceSnapshot'] = 'P289 before P290 service implementation convergence.'
        data['historicalDuplicateAuditP289'] = old_audit

    changed = set()
    for r in records:
        rel = r['path']
        path = ROOT/rel
        if not path.is_file():
            raise SystemExit(f'baseline path missing: {rel}')
        raw = path.read_bytes()
        if r.get('sourceFacts', {}).get('sha256') != sha(raw):
            changed.add(rel)

    old_edges = data['edgesTouchingSelectedFiles']
    edges_by_from = collections.defaultdict(list)
    for edge in old_edges:
        edges_by_from[edge['from']].append(dict(edge))
    legacy_paths = set(pair_by_legacy)
    new_edges = [dict(e) for e in old_edges if e['from'] in rec_by and e['to'] in rec_by and e['from'] not in changed]

    # Re-resolve unchanged import specifiers of modified files. Facade files are
    # specially modelled as a single re-export edge because their old bodies are gone.
    retained_by_source = {}
    for rel in sorted(changed):
        if rel in legacy_paths:
            p = pair_by_legacy[rel]
            facade = (ROOT/rel).read_text(encoding='utf-8')
            spec = '../' + p['canonicalPath'][len('src/'):].removesuffix('.ts')
            line_no = next((i for i, line in enumerate(facade.splitlines(), 1) if f"export * from '{spec}'" in line), None)
            if line_no is None:
                raise SystemExit(f'facade export not found: {rel}')
            kept = [{'from': rel, 'to': p['canonicalPath'], 'specifier': spec, 'kind':'reexport', 'line':line_no}]
        else:
            src = (ROOT/rel).read_text(encoding='utf-8', errors='replace')
            old_out = sorted(edges_by_from.get(rel, []), key=lambda e: (e.get('line',0),e.get('specifier','')))
            used = collections.defaultdict(int)
            kept = []
            for e in old_out:
                spec = e.get('specifier')
                if not isinstance(spec, str):
                    continue
                nums = quote_lines(src, spec)
                occurrence = used[spec]
                if occurrence >= len(nums):
                    continue
                e['line'] = nums[occurrence]
                used[spec] += 1
                kept.append(e)
        retained_by_source[rel] = kept
        new_edges.extend(kept)

    # Refresh all source facts against the post-P290 checkout. Existing named API
    # lists are preserved for old paths, but facades inherit the canonical API set.
    for r in records:
        rel = r['path']
        raw = (ROOT/rel).read_bytes()
        sf = r.setdefault('sourceFacts', {})
        sf['sha256'] = sha(raw)
        sf['lineCount'] = lines(raw)
        if rel in pair_by_legacy:
            p = pair_by_legacy[rel]
            canonical = rec_by[p['canonicalPath']]
            csf = canonical['sourceFacts']
            sf['exportedSymbols'] = list(csf.get('exportedSymbols', []))
            sf['exportedCallables'] = list(csf.get('exportedCallables', []))
            sf['firstDocCommentExcerpt'] = 'P290 compatibility facade; named API is forwarded to the domain canonical service.'
            r['type'] = 'compatibility-re-export-facade'
            r['purpose'] = f"P290 compatibility-only path for {p['basename']}; re-exports {p['canonicalPath']} without independent behavior or state."
            cc = r.setdefault('capabilityClassification', {})
            cc['implementationRole'] = 'COMPATIBILITY_RE_EXPORT_FACADE'
            cc['classificationConfidence'] = 'HIGH'
            cc['classificationEvidence'] = ['P290 source inspection: only one export-star re-export to the explicit domain canonical service.']
            cc['authorityCandidatePath'] = p['canonicalPath']
            cc['authorityRelationship'] = 'COMPATIBILITY_FACADE_TO_DOMAIN_CANONICAL'
            da = r.setdefault('duplicateAudit', {})
            da['sourceAuditBaseline'] = 'P290_CURRENT_SOURCE'
            da['currentStatus'] = 'IMPLEMENTATION_REMOVED_COMPATIBILITY_FACADE_RETAINS_OLD_IMPORT_PATH'
            da['authorityConvergenceP290'] = {'role':'legacy compatibility facade','canonicalPath':p['canonicalPath']}
        elif rel in pair_by_canonical:
            p = pair_by_canonical[rel]
            r['purpose'] = f"Canonical {p['basename']} implementation and single owner of behavior/state; legacy src/services path re-exports this module."
            da = r.setdefault('duplicateAudit', {})
            da['sourceAuditBaseline'] = 'P290_CURRENT_SOURCE'
            da['currentStatus'] = 'CANONICAL_IMPLEMENTATION_SINGLE_OWNER_LEGACY_BODY_REMOVED'
            da['authorityConvergenceP290'] = {'role':'canonical implementation','legacyFacadePath':p['legacyPath']}

    # Current graph is rebuilt from old edges for unchanged sources plus refreshed
    # outgoing edges for changed sources. Keep import sites through legacy facades.
    new_edges.sort(key=lambda e: (e.get('from',''), e.get('line',0), e.get('to',''), e.get('specifier','')))
    data['edgesTouchingSelectedFiles'] = new_edges
    for r in records:
        r['staticDependencies'] = []
        r['staticImporters'] = []
    for e in new_edges:
        src, dst = e['from'], e['to']
        if src not in rec_by or dst not in rec_by:
            raise SystemExit(f'edge leaves ledger baseline: {src} -> {dst}')
        if dst not in rec_by[src]['staticDependencies']:
            rec_by[src]['staticDependencies'].append(dst)
        rec_by[dst]['staticImporters'].append({'path':src,'kind':e.get('kind','import'),'line':int(e.get('line',1)),'specifier':e.get('specifier','')})
    for r in records:
        r['staticImporters'].sort(key=lambda x:(x['path'],x['line'],x['specifier']))

    # Recompute reachability from documented entry roots through refreshed edges.
    all_paths = set(rec_by)
    roots = [x for x in data.get('productionRootsUsedForReachability', []) if x in all_paths]
    seen, stack = set(), list(roots)
    while stack:
        cur = stack.pop()
        if cur in seen: continue
        seen.add(cur)
        stack.extend(d for d in rec_by[cur]['staticDependencies'] if d not in seen)
    for r in records:
        r['reachableFromCoreUiRootsByResolvedLocalImports'] = r['path'] in seen

    # Refresh taxonomy totals while preserving the existing classification rules.
    cap_counts = collections.Counter(r.get('capabilityClassification',{}).get('capabilityCategory','unknown') for r in records)
    role_counts = collections.Counter(r.get('capabilityClassification',{}).get('implementationRole','unknown') for r in records)
    art_counts = collections.Counter(r.get('capabilityClassification',{}).get('artifactKind','unknown') for r in records)
    cap_conf = collections.Counter(r.get('capabilityClassification',{}).get('classificationConfidence','unknown') for r in records)
    func_primary = collections.Counter(r.get('functionalCapability',{}).get('primaryFunctionalCapability','unknown') for r in records)
    func_conf = collections.Counter(r.get('functionalCapability',{}).get('functionalClassificationConfidence','unknown') for r in records)
    tag_counts = collections.Counter(t for r in records for t in r.get('functionalCapability',{}).get('functionalCapabilityTags',[]))
    unknown_primary = sorted(r['path'] for r in records if r.get('functionalCapability',{}).get('primaryFunctionalCapability') in ('unknown','unmapped',None,''))
    data['capabilityTaxonomy']['categoryCounts'] = dict(sorted(cap_counts.items()))
    data['capabilityTaxonomy']['implementationRoleCounts'] = dict(sorted(role_counts.items()))
    data['capabilityTaxonomy']['artifactKindCounts'] = dict(sorted(art_counts.items()))
    data['capabilityTaxonomy']['unresolvedClassificationCount'] = sum(1 for r in records if r.get('capabilityClassification',{}).get('classificationConfidence') == 'LOW')
    data['capabilityTaxonomy']['unresolvedClassificationPaths'] = [
      {'path':r['path'],'category':r.get('capabilityClassification',{}).get('capabilityCategory'),'role':r.get('capabilityClassification',{}).get('implementationRole'),'reason':r.get('capabilityClassification',{}).get('classificationEvidence',[])}
      for r in records if r.get('capabilityClassification',{}).get('classificationConfidence') == 'LOW']
    data['capabilityFunctionalTaxonomy']['primaryCapabilityCounts'] = dict(sorted(func_primary.items()))
    data['capabilityFunctionalTaxonomy']['tagCounts'] = dict(sorted(tag_counts.items()))
    data['capabilityFunctionalTaxonomy']['confidenceCounts'] = dict(sorted(func_conf.items()))
    data['capabilityFunctionalTaxonomy']['unresolvedPrimaryCapabilities'] = unknown_primary

    # Current byte-identity audit is recomputed; basename collisions remain hints,
    # not evidence that every same-named pair is a duplicate.
    sha_groups = collections.defaultdict(list)
    base_groups = collections.defaultdict(list)
    for r in records:
        sha_groups[r['sourceFacts']['sha256']].append(r['path'])
        base_groups[PurePosixPath(r['path']).name].append(r['path'])
    intentional = {
      frozenset(['android-native/src/main/java/com/miki/ai/MIKIJapaneseMorphologyPlugin.kt','android/app/src/main/java/com/miki/ai/MIKIJapaneseMorphologyPlugin.kt']): 'SOURCE_TEMPLATE_AND_ANDROID_APP_COPY_CONFIRMED',
      frozenset(['android-native/src/main/java/com/miki/ai/MikiBackgroundWorker.kt','android/app/src/main/java/com/miki/ai/MikiBackgroundWorker.kt']): 'IDENTICAL_NATIVE_FILE_AUTHORITY_REVIEW_REQUIRED',
      frozenset(['android/app/src/main/res/drawable-land-mdpi/splash.png','android/app/src/main/res/drawable/splash.png']): 'ANDROID_QUALIFIER_FALLBACK_ASSET_LIKELY_INTENTIONAL',
      frozenset(['android/app/src/main/res/mipmap-anydpi-v26/ic_launcher.xml','android/app/src/main/res/mipmap-anydpi-v26/ic_launcher_round.xml']): 'ANDROID_RESOURCE_ALIAS_LIKELY_INTENTIONAL',
    }
    byte_groups = []
    for digest, members in sorted(sha_groups.items()):
        if len(members) < 2: continue
        key = frozenset(members)
        assessment = intentional.get(key, 'IDENTICAL_BYTES_CURRENT_P290_REQUIRES_ROLE_REVIEW')
        byte_groups.append({'sha256':digest,'members':sorted(members),'memberCount':len(members),'assessment':assessment})
    name_groups = [{'basename':b,'members':sorted(paths),'memberCount':len(paths),'pairComparisonCount':len(paths)*(len(paths)-1)//2,'interpretation':'Basename collision only; not proof of duplicate behavior.'} for b,paths in sorted(base_groups.items()) if len(paths)>1]

    # Preserve the historical duplicate basename evidence, but make the 37-pair
    # implementation convergence explicitly current and separately auditable.
    data['authorityConvergenceP290'] = {
      'status':'CURRENT_SOURCE_AUTHORITY_CONVERGENCE_STATICALLY_VERIFIED',
      'canonicalPolicy':report['canonicalPolicy'],
      'sourceSnapshot':report['sourceSnapshot'],
      'counts':report['counts'],
      'pairs':report['pairs'],
      'mergedBehaviorPreservation':report['mergedBehaviorPreservation'],
      'compatibilityNotes':report.get('compatibilityNotes',[]),
      'validation':report.get('validation',{}),
      'note':'Current code-level convergence for the 37 audited pairs only. Other basename collisions are not automatically classified as functional duplicates.'
    }
    data['duplicateAuditP290Current'] = {
      'status':'CURRENT_HASH_BASENAME_AND_37_PAIR_AUTHORITY_AUDIT',
      'scope':'The P289 baseline refreshed against P290, excluding generated Python __pycache__/*.pyc artifacts that were mistakenly inventoried as repository files. Newly created audit/generator outputs are also excluded to avoid recursive self-indexing.',
      'counts':{
        'uniquePaths':len(set(r['path'] for r in records)),
        'pathDuplicateCount':len(records)-len(set(r['path'] for r in records)),
        'byteIdenticalGroupCount':len(byte_groups),
        'byteIdenticalFileCount':sum(g['memberCount'] for g in byte_groups),
        'sameBasenameGroupCount':len(name_groups),
        'sameBasenameMemberRecordCount':sum(g['memberCount'] for g in name_groups),
        'sameBasenamePairComparisonCount':sum(g['pairComparisonCount'] for g in name_groups),
        'highPriorityServicePairsAudited':37,
        'highPriorityIndependentImplementationsRemoved':37,
        'highPriorityCanonicalServices':37,
        'highPriorityCurrentBodyDuplicatePairs':0,
        'semanticDuplicateConfirmationPerformedForAllOtherBasenamePairs':False,
      },
      'byteIdenticalGroups':byte_groups,
      'sameBasenameGroups':name_groups,
      'method':'SHA-256 byte identity and basename grouping, plus actual source/import/API inspection of the 37 high-priority service pairs. Same-basename collisions outside those 37 remain unconfirmed.',
    }
    data['title'] = 'MIKI-AI0.2 File Relation Ledger — P290 service authority convergence'
    data['revision'] = 'P290'
    data['generatedAt'] = '2026-10-19'
    data['sourceSnapshot'] = 'P289 ZIP-derived source snapshot edited locally for P290: 37 src/services service implementations replaced by compatibility re-export facades into src/miki domain canonical implementations; 1 generated Python cache artifact excluded; 1,787 repository paths refreshed. GitHub main not updated.'
    data['selectionPolicy'] = 'Retain the unified F001-F1787 repository-path inventory after removing one mistakenly inventoried generated .pyc/__pycache__ artifact from the P289 input. Audit/generator artifacts added as part of P289/P290 are excluded from the fixed baseline to avoid self-reference; refresh hashes, line counts, module edges, importers and reachability for all baseline records. Current duplicate body/authority results for the 37 audited services are separately recorded.'
    data['methodology']['graph'] = 'Current static module import/export/re-export/side-effect/dynamic-import graph. P290 replaces outgoing edges from each legacy service path with one re-export edge to its canonical src/miki domain module; callers through existing legacy paths remain in the graph. This is static module evidence, not runtime function invocation.'
    data['methodology']['runtimeCaveat'] = 'P290 uses one canonical implementation/singleton per each of the 37 audited service pairs. Legacy import paths remain as export-star compatibility facades. LoRA active execution remains retired; full typecheck/build/device verification is not implied.'
    data['methodology']['purpose'] = 'Track path-level code roles, current static dependencies/importers, classifications and proven authority consolidations. Similar filenames are not treated as duplicates without source and contract review.'
    data['methodology']['authorityConvergenceP290'] = 'P290 reviewed all 37 former src/miki/<domain>/services vs src/services parallel implementation pairs. The Miki domain implementation is canonical; legacy path forwards exports only. Divergent behavior is preserved on canonical implementations after contract and caller checks.'
    prior_consol = data.get('consolidation', {})
    data['consolidation'] = {
      'canonicalJson':'SOURCE_FILE_RELATION_LEDGER_P290.json',
      'humanReadableView':'SOURCE_FILE_RELATION_LEDGER_P290.md',
      'recordRanges':[{'range':f"F001-F{len(records):04d}",'recordCount':len(records),'historicalOrigin':'P288 baseline -> P289 LoRA retirement -> P290 service-authority convergence'}],
      'supersedesSplitFiles':prior_consol.get('supersedesSplitFiles',[]),
      'runtimeSourceFilesModified':True,
      'gitHubMainUpdated':False,
      'removedBaselinePath':prior_consol.get('removedBaselinePath','src/services/virtualTrainingService.ts'),
      'oldP288AuditPath':'historicalDuplicateAuditP288',
      'oldP289DuplicateAuditPath':'historicalDuplicateAuditP289',
      'authorityConvergenceReport':'SERVICE_AUTHORITY_CONVERGENCE_P290.json',
    }
    counts = data['counts']
    source_records = sum(1 for r in records if PurePosixPath(r['path']).suffix.lower() in SOURCE_EXTS)
    counts.update({
      'repositoryFilesScannedAtSelection':len(records),'selectedFileCount':len(records),'uniquePaths':len(set(r['path'] for r in records)),'generatedCacheArtifactsExcludedFromP289Input':1,
      'recordIdRange':f"F001-F{len(records):04d}",'sourceRecords':source_records,'nonSourceArtifactRecords':len(records)-source_records,
      'allResolvedLocalImportEdges':len(new_edges),'edgesTouchingSelectedFiles':len(new_edges),
      'selectedSourceFilesReachableFromCoreUiRootsByResolvedLocalImports':sum(1 for r in records if r['reachableFromCoreUiRootsByResolvedLocalImports'] and PurePosixPath(r['path']).suffix.lower() in SOURCE_EXTS),
      'selectedSourceFilesWithSameBasenamePeers':sum(1 for r in records if len(base_groups[PurePosixPath(r['path']).name])>1),
      'remainingUnrecordedRepositoryFiles':None,
      'classifiedRecordCount':len(records),'capabilityCategoryCount':len(cap_counts),
      'sourceRecordCount':art_counts.get('SOURCE_CODE',0),'nonSourceOrNativeAssetRecordCount':len(records)-art_counts.get('SOURCE_CODE',0),
      'functionalCapabilityCount':len(func_primary),'functionalCapabilityPrimaryCounts':dict(sorted(func_primary.items())),
      'functionalClassificationConfidenceCounts':dict(sorted(func_conf.items())),
      'authorityConvergenceP290':report['counts'],
      'authorityConvergenceAuditOutputsExcludedFromBaseline':True,
    })
    counts['architectureDomainCategories'] = dict(sorted({k:v for k,v in cap_counts.items() if k=='CORE' or k.startswith('DOMAIN:')}.items()))
    counts['nonDomainTechnicalOrArtifactCategories'] = dict(sorted({k:v for k,v in cap_counts.items() if not (k=='CORE' or k.startswith('DOMAIN:') or k=='LEGACY_OR_SHARED')}.items()))
    # Keep historical LoRA retirement metadata but clarify P290 has not restored the path.
    counts['loraRetirementP289'] = data['counts'].get('loraRetirementP289', {})
    data['records'] = sorted(records, key=lambda r:int(r['id'][1:]))

    OUT_JSON.write_text(json.dumps(data, ensure_ascii=False, indent=2)+'\n',encoding='utf-8')
    OUT_MD.write_text(render_markdown(data),encoding='utf-8')
    print(json.dumps({
      'revision':'P290','records':len(records),'uniquePaths':len(set(r['path'] for r in records)),
      'changedBaselinePaths':len(changed),'updatedEdges':len(new_edges),
      'reachableSources':counts['selectedSourceFilesReachableFromCoreUiRootsByResolvedLocalImports'],
      'legacyFacades':len(pair_by_legacy),'canonicalImplementations':len(pair_by_canonical),
      'byteIdenticalGroupsRetained':len(byte_groups),'sameBasenameGroups':len(name_groups),
      'duplicatePaths':len(records)-len(set(r['path'] for r in records)),
      'remainingUnrecordedRepositoryFiles':'not asserted for fixed historical baseline'
    },ensure_ascii=False,indent=2))

if __name__ == '__main__':
    main()
