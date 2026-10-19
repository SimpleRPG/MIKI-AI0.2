#!/usr/bin/env python3
"""Generate the P286 unified relation ledger, capability taxonomy and duplicate audit.

This tool analyzes the checked-in P285 ZIP-derived snapshot. It does not change runtime source files.
Similarity scores are triage signals only; they are not proof of semantic equivalence.
"""
from __future__ import annotations
from pathlib import Path, PurePosixPath
from collections import Counter, defaultdict
from difflib import SequenceMatcher
import hashlib, json, re, unicodedata

ROOT = Path(__file__).resolve().parents[1]
SOURCE_JSON = ROOT / 'SOURCE_FILE_RELATION_LEDGER_P285.json'
OUTPUT_JSON = ROOT / 'SOURCE_FILE_RELATION_LEDGER_P286.json'
OUTPUT_MD = ROOT / 'SOURCE_FILE_RELATION_LEDGER_P286.md'
DESIGN = ROOT / 'MIKI-AI0.2_統合設計書_正本.txt'
VALID_DOMAINS = {
    'autonomy', 'capability', 'conversation', 'data', 'execution', 'experience',
    'improvement', 'learning', 'memory', 'promotion', 'research', 'safety',
    'selfAwareness', 'selfDevelopment', 'strategy', 'unknown', 'verification'
}
SOURCE_EXT = {'.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.java', '.kt', '.rs', '.py', '.sh'}
CODE_EXT = {'.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.java', '.kt', '.rs'}

def sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()

def read_text(path: str) -> str:
    try:
        return (ROOT / path).read_text(encoding='utf-8')
    except (OSError, UnicodeDecodeError):
        return ''

def remove_comments_for_heuristics(text: str, suffix: str) -> str:
    # Heuristic only, used to find candidates. Raw SHA-256 remains the exact comparison.
    text = re.sub(r'/\*[\s\S]*?\*/', '', text)
    text = re.sub(r'^\s*//.*$', '', text, flags=re.M)
    if suffix in {'.py', '.sh'}:
        text = re.sub(r'^\s*#.*$', '', text, flags=re.M)
    return text

def remove_import_export_statements(text: str) -> str:
    # Remove module-bound import/export statements; remaining declarations indicate an implementation.
    text = re.sub(r'\b(?:import|export)\s+(?:type\s+)?[\s\S]*?\bfrom\s*[\'\"][^\'\"]+[\'\"]\s*;?', '', text)
    text = re.sub(r'\bimport\s*[\'\"][^\'\"]+[\'\"]\s*;?', '', text)
    text = re.sub(r'\bexport\s*\{[^}]*\}\s*;?', '', text)
    return text.strip(' \t\r\n;')

def reexport_targets(path: str) -> list[str]:
    text = read_text(path)
    if not text:
        return []
    text = remove_comments_for_heuristics(text, PurePosixPath(path).suffix.lower())
    return re.findall(r'\bexport\s+(?:type\s+)?(?:\*\s*(?:as\s+[A-Za-z_$][\w$]*\s*)?|\{[\s\S]*?\})\s+from\s*[\'\"]([^\'\"]+)[\'\"]', text)

def resolve_specifier(path: str, spec: str, all_paths: set[str]) -> str | None:
    if not spec.startswith('.'):
        return None
    base = PurePosixPath(path).parent.joinpath(spec)
    b = str(base)
    candidates = [b]
    for ext in ('.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json', '.kt', '.java', '.rs'):
        candidates.append(b + ext)
    for ext in ('.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json'):
        candidates.append(str(PurePosixPath(b) / ('index' + ext)))
    for c in candidates:
        # normalize dot segments without needing a live filesystem traversal
        parts=[]
        for piece in c.split('/'):
            if piece in ('', '.'): continue
            if piece == '..':
                if parts: parts.pop()
            else: parts.append(piece)
        n='/'.join(parts)
        if n in all_paths:
            return n
    return None

def is_pure_forwarder(path: str) -> tuple[bool, list[str]]:
    text = read_text(path)
    if not text:
        return False, []
    suffix = PurePosixPath(path).suffix.lower()
    clean = remove_comments_for_heuristics(text, suffix)
    targets = reexport_targets(path)
    rest = remove_import_export_statements(clean)
    # Export-only barrel modules are facades, not independent feature implementations.
    pure = bool(targets) and not rest
    if not targets and not rest and re.search(r'\b(?:export|import)\b', clean):
        pure = True
    return pure, targets

def source_similarity(a: str, b: str) -> tuple[float | None, str]:
    if not a or not b:
        return None, 'NOT_TEXT_READABLE'
    na = re.sub(r'\s+', '', unicodedata.normalize('NFC', a))
    nb = re.sub(r'\s+', '', unicodedata.normalize('NFC', b))
    scope = 'FULL_NONWHITESPACE_TEXT'
    if max(len(na), len(nb)) > 50000:
        na, nb = na[:50000], nb[:50000]
        scope = 'FIRST_50000_NONWHITESPACE_CHARACTERS'
    return SequenceMatcher(None, na, nb).ratio(), scope

def classify_record(r: dict, pair_by_path: dict, forwarder_map: dict) -> dict:
    path = r['path']
    pp = PurePosixPath(path)
    parts = pp.parts
    suffix = pp.suffix.lower()
    domain = None
    category = 'UNCLASSIFIED_REVIEW'
    role = 'UNCLASSIFIED_REVIEW'
    artifact = 'UNKNOWN_ARTIFACT'
    confidence = 'LOW'
    basis = ['path did not match a higher-confidence rule']
    authority_candidate = None
    authority_status = 'REVIEW_REQUIRED'

    # Platform and repository artifact boundaries precede generic extension checks.
    if path.startswith('reference/simple-rpg/'):
        category, role, artifact, confidence = 'REFERENCE_PROJECT', 'REFERENCE_GAME_SOURCE_OR_ASSET', 'REFERENCE_PROJECT_ARTIFACT', 'HIGH'
        basis = ['path prefix reference/simple-rpg/ identifies an isolated reference project']
        authority_status = 'REFERENCE_ONLY_NOT_MIKI_RUNTIME'
    elif path.startswith('fixtures/'):
        category, role, artifact, confidence = 'TEST_SUPPORT', 'FIXTURE_OR_TEST_DATA', 'TEST_FIXTURE', 'HIGH'
        basis = ['path prefix fixtures/']
        authority_status = 'NON_RUNTIME_TEST_SUPPORT'
    elif path.startswith('android-native/src/main/java/'):
        category, role, artifact, confidence = 'NATIVE_ANDROID', 'ANDROID_NATIVE_TEMPLATE_OR_SEED', 'NATIVE_SOURCE', 'HIGH'
        basis = ['path prefix android-native/src/main/java/']
        authority_status = 'TEMPLATE_OR_NATIVE_SUPPORT'
    elif path.startswith('android/app/src/main/java/'):
        category, role, artifact, confidence = 'NATIVE_ANDROID', 'ANDROID_APP_RUNTIME_SOURCE', 'NATIVE_SOURCE', 'HIGH'
        basis = ['path prefix android/app/src/main/java/; compiled Android app source location']
        authority_status = 'ANDROID_APP_RUNTIME_CANDIDATE'
    elif path.startswith('android/'):
        if '/res/' in path or '/assets/' in path:
            category, role, artifact, confidence = 'STATIC_ASSET', 'ANDROID_RESOURCE_ASSET', 'STATIC_ASSET', 'HIGH'
        elif suffix in SOURCE_EXT:
            category, role, artifact, confidence = 'NATIVE_ANDROID', 'ANDROID_BUILD_OR_NATIVE_SUPPORT_SOURCE', 'NATIVE_SOURCE', 'HIGH'
        else:
            category, role, artifact, confidence = 'BUILD_CONFIGURATION', 'ANDROID_BUILD_CONFIGURATION', 'BUILD_CONFIG', 'HIGH'
        basis = ['path prefix android/']
        authority_status = 'NON_18_DOMAIN_TECHNICAL_LAYER'
    elif path.startswith('native/') or (suffix == '.rs' and not path.startswith('reference/')):
        category, role, artifact, confidence = 'NATIVE_RUST', 'RUST_NATIVE_IMPLEMENTATION_OR_BUILD_FILE', 'NATIVE_SOURCE', 'HIGH'
        basis = ['Rust/native path or .rs extension']
        authority_status = 'NATIVE_PLATFORM_BOUNDARY'
    elif path.startswith('P138_GENERATED_PNG/') or path.startswith('P125_VISUAL_OUTPUT/'):
        category, role, artifact, confidence = 'STATIC_ASSET', 'GENERATED_VISUAL_OUTPUT', 'GENERATED_ASSET', 'HIGH'
        basis = ['path identifies generated visual outputs']
        authority_status = 'NON_RUNTIME_CAPABILITY_SOURCE'
    elif path.startswith('docs/') or suffix in {'.md', '.txt'}:
        category, role, artifact, confidence = 'DOCUMENTATION', 'DESIGN_OR_PROJECT_DOCUMENT', 'DOCUMENTATION', 'HIGH'
        basis = ['documentation path or Markdown/text document extension']
        authority_status = 'NON_RUNTIME_DOCUMENTATION'
    elif path.startswith('.github/') or pp.name in {'.gitignore', '.env.example', 'package.json', 'package-lock.json', 'tsconfig.json', 'vite.config.ts', 'capacitor.config.ts', 'metadata.json', 'model_manifest.json'} or path.startswith('android/gradle/'):
        category, role, artifact, confidence = 'BUILD_CONFIGURATION', 'PROJECT_BUILD_OR_ENVIRONMENT_CONFIGURATION', 'BUILD_CONFIG', 'HIGH'
        basis = ['known build, environment, or workflow configuration path/name']
        authority_status = 'NON_RUNTIME_CONFIGURATION'
    elif path.startswith('scripts/'):
        if re.search(r'(^|/)(verify|check|audit|test|assert)[^/]*\.(mjs|cjs|js|ts|py|sh)$', path, re.I) or 'verify' in pp.name.lower() or 'audit' in pp.name.lower():
            category, role, artifact, confidence = 'VERIFICATION_TOOLING', 'VERIFICATION_OR_AUDIT_SCRIPT', 'SCRIPT', 'HIGH'
        elif pp.name.startswith(('install_', 'build_', 'prepare_')):
            category, role, artifact, confidence = 'DEVELOPER_TOOLING', 'INSTALL_BUILD_PREPARATION_SCRIPT', 'SCRIPT', 'HIGH'
        else:
            category, role, artifact, confidence = 'DEVELOPER_TOOLING', 'DEVELOPER_UTILITY_SCRIPT', 'SCRIPT', 'HIGH'
        basis = ['path prefix scripts/ and filename-purpose marker']
        authority_status = 'VERIFICATION_OR_DEVELOPMENT_ONLY'
    elif path.startswith('src/miki/core/'):
        category, domain, artifact, confidence = 'CORE', 'core', 'SOURCE_CODE', 'HIGH'
        if '/ui/' in path:
            role = 'CORE_UI_GATEWAY_OR_BOUNDARY'
        elif pp.name == 'index.ts':
            role = 'CORE_BARREL_ENTRYPOINT'
        else:
            role = 'CORE_IMPLEMENTATION_OR_ADAPTER'
        basis = ['path prefix src/miki/core/ matches the single CORE authority']
        authority_status = 'CORE_ARCHITECTURE_CANDIDATE'
    elif path.startswith('src/miki/') and len(parts) >= 3 and parts[2] in VALID_DOMAINS:
        domain = parts[2]
        category, artifact, confidence = 'DOMAIN:' + domain, 'SOURCE_CODE', 'HIGH'
        if pp.name == 'index.ts':
            role = 'DOMAIN_BARREL_ENTRYPOINT'
        elif len(parts) == 3 and suffix in CODE_EXT:
            role = 'DOMAIN_ENTRYPOINT_OR_EXPORT_SURFACE'
        else:
            pure, targets = is_pure_forwarder(path)
            if pure:
                role = 'DOMAIN_FACADE_TO_SHARED_OR_OTHER_MODULE'
                resolved = [resolve_specifier(path, target, all_paths) for target in targets]
                resolved = [x for x in resolved if x]
                authority_candidate = resolved[0] if len(set(resolved)) == 1 else None
                authority_status = 'FORWARDING_FACADE' if authority_candidate else 'BARREL_OR_MULTI_TARGET_FACADE'
            else:
                role = 'DOMAIN_IMPLEMENTATION_OR_ADAPTER'
        basis = [f'path prefix src/miki/{domain}/ maps to one of the 17 architecture domains']
        if not authority_status.startswith('FORWARDING') and authority_candidate is None:
            authority_status = 'DOMAIN_PATH_CANDIDATE_NOT_RUNTIME_PROOF'
    elif path == 'src/miki/index.ts':
        category, role, artifact, confidence = 'ARCHITECTURE_INDEX', 'MIKI_DOMAIN_BARREL', 'SOURCE_CODE', 'HIGH'
        basis = ['central src/miki/index.ts barrel exports domain entrypoints']
        authority_status = 'BARREL_NOT_SEPARATE_CAPABILITY'
    elif path.startswith('src/components/') or path in {'src/App.tsx', 'src/main.tsx', 'src/index.css'} or path.startswith('src/hooks/'):
        category, role, artifact, confidence = 'UI_APP_BOUNDARY', 'UI_COMPONENT_OR_APP_ENTRY', 'SOURCE_CODE', 'HIGH'
        basis = ['React app/component/hook path']
        authority_status = 'UI_BOUNDARY_TO_CORE'
    elif path.startswith('src/app/'):
        category, role, artifact, confidence = 'APP_RUNTIME_INFRASTRUCTURE', 'APP_STARTUP_OR_LIFECYCLE', 'SOURCE_CODE', 'HIGH'
        basis = ['path prefix src/app/']
        authority_status = 'SHARED_APP_INFRASTRUCTURE'
    elif path.startswith('src/services/'):
        pure, targets = is_pure_forwarder(path)
        resolved = [resolve_specifier(path, target, all_paths) for target in targets]
        resolved = [x for x in resolved if x]
        same_stem_pair = pair_by_path.get(path)
        if pure and resolved:
            authority_candidate = resolved[0] if len(set(resolved)) == 1 else None
            domain_target = domain_from_path(authority_candidate) if authority_candidate else None
            if domain_target:
                category, domain = 'DOMAIN:' + domain_target, domain_target
                role, artifact, confidence = 'COMPATIBILITY_FACADE_TO_DOMAIN', 'SOURCE_CODE', 'HIGH'
                basis = ['export-only module forwarding to a concrete src/miki domain implementation']
                authority_status = 'FACADE_TARGET_EXPLICIT'
            elif authority_candidate and authority_candidate.startswith('src/services/'):
                category, role, artifact, confidence = 'SHARED_INFRASTRUCTURE', 'SHARED_SERVICE_FACADE', 'SOURCE_CODE', 'HIGH'
                basis = ['export-only module forwarding to a shared services module']
                authority_status = 'FACADE_TARGET_EXPLICIT'
            else:
                category, role, artifact, confidence = 'COMPATIBILITY_FACADE', 'REEXPORT_OR_BARREL_FACADE', 'SOURCE_CODE', 'HIGH'
                basis = ['export-only module; resolved module target recorded']
                authority_status = 'FACADE_TARGET_EXPLICIT' if authority_candidate else 'FACADE_TARGET_AMBIGUOUS'
        elif same_stem_pair:
            domain_target = domain_from_path(same_stem_pair['mikiPath'])
            if domain_target and same_stem_pair['status'] in {'HIGH_SIMILARITY_IMPLEMENTATION_CANDIDATE','MEDIUM_SIMILARITY_IMPLEMENTATION_CANDIDATE'}:
                domain = domain_target
                category = 'DOMAIN:' + domain_target
                role = 'PARALLEL_LEGACY_IMPLEMENTATION_CANDIDATE'
                artifact, confidence = 'SOURCE_CODE', 'MEDIUM'
                authority_candidate = same_stem_pair['mikiPath']
                basis = ['same-basename src/miki counterpart plus measured source-text similarity; candidate only']
                authority_status = 'LIKELY_DOMAIN_AUTHORITY_BUT_MIGRATION_NOT_VERIFIED'
            else:
                category, role, artifact, confidence = 'SHARED_INFRASTRUCTURE', 'CROSS_DOMAIN_SERVICE_OR_REVIEW', 'SOURCE_CODE', 'MEDIUM'
                basis = ['path prefix src/services/; same-basename peer did not establish a direct facade']
                authority_status = 'RESPONSIBILITY_REVIEW_REQUIRED'
        else:
            category, role, artifact, confidence = 'SHARED_INFRASTRUCTURE', 'CROSS_DOMAIN_SHARED_SERVICE', 'SOURCE_CODE', 'MEDIUM'
            basis = ['path prefix src/services/; no unique domain owner established by path alone']
            authority_status = 'SHARED_SERVICE_OWNER_REVIEW_REQUIRED'
    elif path.startswith('src/types/') or path.startswith('src/utils/') or path.startswith('src/constants/') or path.startswith('src/lib/'):
        category, role, artifact, confidence = 'SHARED_INFRASTRUCTURE', 'SHARED_TYPES_UTILITIES_OR_LIB', 'SOURCE_CODE', 'HIGH'
        basis = ['shared types/utilities/lib path']
        authority_status = 'SHARED_INFRASTRUCTURE_NOT_DOMAIN'
    elif path.startswith('src/assets/') or suffix in {'.png', '.jpg', '.jpeg', '.webp', '.svg', '.ico', '.woff', '.woff2'}:
        category, role, artifact, confidence = 'STATIC_ASSET', 'APPLICATION_STATIC_ASSET', 'STATIC_ASSET', 'HIGH'
        basis = ['static asset extension or asset path']
        authority_status = 'NON_EXECUTABLE_ASSET'
    elif path.startswith('src/autonomous_modules/'):
        category, role, artifact, confidence = 'UNMAPPED_CAPABILITY_REVIEW', 'UNSCOPED_AUTONOMOUS_MODULE', 'SOURCE_CODE', 'LOW'
        basis = ['legacy/unscoped autonomous_modules path; ownership needs source-level assignment to CORE or a named domain']
        authority_status = 'DOMAIN_OWNER_UNRESOLVED'
    elif path.startswith('src/') and suffix in SOURCE_EXT:
        # Direct Miki entrypoint files such as src/miki/research.ts are handled above;
        # other src modules remain explicit shared/unmapped rather than being guessed into a domain.
        category, role, artifact, confidence = 'SHARED_INFRASTRUCTURE', 'UNSCOPED_APP_SOURCE', 'SOURCE_CODE', 'MEDIUM'
        basis = ['source file under src/ with no validated architecture-domain path']
        authority_status = 'DOMAIN_OWNER_REVIEW_REQUIRED'
    elif path.startswith('src/'):
        category, role, artifact, confidence = 'UI_APP_BOUNDARY', 'APPLICATION_STATIC_OR_SUPPORT_ASSET', 'PROJECT_ASSET', 'MEDIUM'
        basis = ['non-source file under src/']
        authority_status = 'NON_DOMAIN_ASSET'
    elif pp.name.lower().endswith(('_report.json', '_audit.json', '_manifest.json', '_receipt.json')) or re.search(r'(REPORT|AUDIT|MANIFEST|INVENTORY|PHASE\d|P\d{2,3}).*\.json$', pp.name, re.I):
        category, role, artifact, confidence = 'AUDIT_REPORT_DATA', 'MACHINE_READABLE_AUDIT_OR_PHASE_REPORT', 'REPORT_DATA', 'HIGH'
        basis = ['filename identifies report/audit/manifest/inventory data']
        authority_status = 'NON_RUNTIME_AUDIT_ARTIFACT'
    elif path == 'server.ts' or path.startswith('server/'):
        category, role, artifact, confidence = 'BACKEND_RUNTIME', 'SERVER_RUNTIME_ENTRY_OR_SUPPORT', 'SOURCE_CODE', 'HIGH'
        basis = ['server runtime path/name']
        authority_status = 'BACKEND_RUNTIME_BOUNDARY'
    elif suffix in {'.json', '.yaml', '.yml', '.toml', '.xml', '.gradle', '.properties'}:
        category, role, artifact, confidence = 'PROJECT_CONFIGURATION_OR_DATA', 'CONFIGURATION_OR_STRUCTURED_DATA', 'CONFIG_OR_DATA', 'MEDIUM'
        basis = ['configuration/structured-data extension']
        authority_status = 'NON_RUNTIME_OR_BUILD_DATA'
    elif suffix in SOURCE_EXT:
        category, role, artifact, confidence = 'DEVELOPER_OR_RUNTIME_SUPPORT', 'ROOT_LEVEL_SOURCE_OR_TOOL', 'SOURCE_CODE', 'MEDIUM'
        basis = ['source extension at repository root without a validated architecture path']
        authority_status = 'OWNER_REVIEW_REQUIRED'
    else:
        category, role, artifact, confidence = 'PROJECT_ARTIFACT', 'OTHER_PROJECT_ARTIFACT', 'PROJECT_ARTIFACT', 'MEDIUM'
        basis = ['repository artifact not associated with a validated capability implementation path']
        authority_status = 'NON_CAPABILITY_ARTIFACT'

    # Some path-based assignments to top-level src/miki domain barrel files.
    if path.startswith('src/miki/') and len(parts) == 3 and pp.suffix.lower() in CODE_EXT and pp.stem in VALID_DOMAINS:
        domain = pp.stem
        category, role, artifact, confidence = 'DOMAIN:' + domain, 'DOMAIN_ENTRYPOINT_OR_BARREL', 'SOURCE_CODE', 'HIGH'
        basis = [f'top-level src/miki/{domain}.ts entrypoint']
        authority_status = 'DOMAIN_ENTRYPOINT_NOT_SEPARATE_CAPABILITY'

    return {
        'capabilityCategory': category,
        'architectureDomain': domain,
        'artifactKind': artifact,
        'implementationRole': role,
        'classificationConfidence': confidence,
        'classificationEvidence': basis,
        'authorityCandidatePath': authority_candidate,
        'authorityRelationship': authority_status,
    }

def domain_from_path(path: str | None) -> str | None:
    if not path or not path.startswith('src/miki/'):
        return None
    parts = PurePosixPath(path).parts
    if len(parts) >= 3 and parts[2] in VALID_DOMAINS:
        return parts[2]
    if len(parts) == 3 and PurePosixPath(path).stem in VALID_DOMAINS:
        return PurePosixPath(path).stem
    return None

def generate():
    if not SOURCE_JSON.exists():
        raise SystemExit('P285_SOURCE_LEDGER_MISSING')
    data = json.loads(SOURCE_JSON.read_text(encoding='utf-8'))
    records = data['records']
    if len(records) != 1789:
        raise SystemExit(f'P285_RECORD_COUNT_INVALID:{len(records)}')
    if len({r['path'] for r in records}) != len(records):
        raise SystemExit('P285_SOURCE_PATH_DUPLICATES')
    paths = {r['path'] for r in records}
    # Evidence guard: do not build on a modified or inconsistent source snapshot.
    for r in records:
        p = ROOT / r['path']
        if not p.is_file():
            raise SystemExit('P285_SOURCE_FILE_MISSING:' + r['path'])
        current_hash = sha(p.read_bytes())
        if current_hash != r.get('sourceFacts', {}).get('sha256') and r['path'] != str(DESIGN.relative_to(ROOT)):
            raise SystemExit('P285_SOURCE_HASH_MISMATCH:' + r['path'])

    # Add current P286 facts to the single canonical design document; no runtime code is edited.
    design_path = str(DESIGN.relative_to(ROOT))
    design = DESIGN.read_text(encoding='utf-8')
    design = re.sub(r'^正本Revision：.*$', '正本Revision：2026-10-18-P286', design, count=1, flags=re.M)
    design = re.sub(r'^- 現行Revision: .*$', '- 現行Revision: 2026-10-18-P286', design, count=1, flags=re.M)
    start = design.find('■ ファイル関係台帳（P284・統合1500ファイル）')
    end = design.find('■ 自己能力台帳グラフ', start)
    if start >= 0 and end > start:
        replacement = '''■ ファイル関係台帳（P286・単一マスター1789ファイル）

- 現行正本は`SOURCE_FILE_RELATION_LEDGER_P286.json`、閲覧用の対応表は`SOURCE_FILE_RELATION_LEDGER_P286.md`。同じF001〜F1789の1,789レコードを収録し、分割バッチを現行正本として扱わない。
- 台帳の対象はP285 ZIP由来の基準スナップショット1,789ファイル。P286のJSON/Markdown・生成スクリプト・検証スクリプトは台帳自身を自己参照させないため基準インベントリ対象外。GitHub main同期・commit・PUSHを意味しない。
- 分類は1つの`domain`欄へ能力・技術層・成果物種別を混在させない。各レコードの`capabilityCategory`、`architectureDomain`、`artifactKind`、`implementationRole`、`classificationConfidence`、`classificationEvidence`を別々に記録する。CORE＋17分類は能力領域の軸であり、UI、共有基盤、Native、参照プロジェクト、検証スクリプト、設定、レポート、設計資料は能力Domainと混同しない。
- `src/miki/core/`をCORE候補、`src/miki/{autonomy,capability,conversation,data,execution,experience,improvement,learning,memory,promotion,research,safety,selfAwareness,selfDevelopment,strategy,unknown,verification}/`を17分類候補として整理する。`src/services/`からDomain実装への転送Facade、共有基盤、責務類似の旧実装候補は`implementationRole`と`authorityRelationship`で区別する。パス分類はアーキテクチャ上の候補であり、runtime実使用や最終Authorityの証明とは扱わない。
- 重複監査はバイト一致、コメント・空白除去後のソース一致候補、同名basename、同じbasenameの`src/miki/`対`src/services/`ペア、純転送Facadeを別々に記録する。P286のスナップショットでは、全ファイルのバイト一致グループ4組（うちソースペア2組、Android資産2組）、正規化ソース一致グループ2組、同名basenameグループ156組／349レコードを検出した。
- `src/miki/`と`src/services/`の同名ペア138組を個別比較した結果、明確な純転送Facade候補27組、非Facadeの高類似実装候補91組、中類似15組、低類似5組を記録した。高類似91組中37組では両パスがCORE/UIの静的import到達集合に含まれる。これは責務重複の強い調査候補だが、ソース類似度だけでは完全な意味同一性を証明しないため、P286では実装を削除・統合していない。
- 特に各ペアの静的import元数、CORE/UIからの到達性、共有Export名、比較に使ったソース類似度と計算範囲、正規実装候補、追加確認事項を台帳へ記録した。両方が到達可能な候補は、保存キー・singleton・副作用・UI/runtime接続を確認するまで削除禁止扱いとする。
- Androidの同一Kotlinファイルは、`scripts/install_android_japanese_morphology.sh`が`android-native/`側をテンプレートとしてAndroid appへコピーすることを根拠に、テンプレートとアプリ配置コピーとして記録する。一方、WorkManager Workerの同一内容ペアは現在のインストーラがアプリ側の存在を検証し、native側からコピーしないため、アプリ側runtime候補とnative側同一内容ファイルを区別し、追加Authority確認を要求する。
- 静的依存先／import元は、ソース相対import/export/re-export/side-effect/dynamic-importの関係である。関数がどのruntime経路で呼ばれるか、Native bridgeが実機で動作するかの証明ではない。`reference/simple-rpg/`は別の参照プロジェクトとして分離し、MIKI本体の18分類へ混入させない。
- `unknown`、`LEGACY_OR_SHARED`などの旧`domain`値を機能カテゴリとして盲目的に採用しない。P286は既存`domain`を履歴値として残し、新分類フィールドを追加した。`UNMAPPED_CAPABILITY_REVIEW`、`DOMAIN_OWNER_REVIEW_REQUIRED`、`REVIEW_REQUIRED`は未確定のまま記録し、名前だけで能力を断定しない。
- P286対象はP285由来ZIPスナップショットである。GitHub main同期、commit/PUSH、CI、TypeScript検査、Android build/APK、実機E2Eは未実施。P286は調査台帳・設計記録更新であり、runtime実装変更を実施したものではない。

'''
        design = design[:start] + replacement + design[end:]
    if '【2026-10-18-P286 能力分類と重複Authority監査】' not in design:
        design += '''\n【2026-10-18-P286 能力分類と重複Authority監査】

- P285単一マスターの全1,789基準ファイルへ、能力領域・技術/成果物区分・実装役割・分類根拠を分離した分類を付与した。
- 17Domain＋COREと、UI境界、共有基盤、Native、参照プロジェクト、検証/開発ツール、設計資料、設定、監査データ、静的資産を別軸に分ける分類方式へ移行した。
- バイト一致4グループ、正規化ソース一致2グループ、同名グループ156組、同名のsrc/miki対src/servicesペア138組を記録。うち純転送Facade候補27組、高類似91組、中類似15組、低類似5組。高類似91組のうち37組は両方とも静的CORE/UI到達可能であり、優先的な責務統合調査対象とする。
- 類似コードを即削除せず、確定Authority・singleton・永続化・呼び出し元を確認するまで「候補」として保持する。P286ではruntimeコードを変更していない。
- 生成元はP285 ZIP由来のソーススナップショットであり、GitHub main、CI、ビルド、実機での動作確認は行っていない。\n'''
    DESIGN.write_text(design, encoding='utf-8')

    # Build same-basename group and source-forwarder index from actual source text.
    by_basename = defaultdict(list)
    raw_hash_map = defaultdict(list)
    normalized_source_map = defaultdict(list)
    wrapper_meta = {}
    for r in records:
        path = r['path']
        by_basename[PurePosixPath(path).name].append(path)
        p = ROOT / path
        payload = p.read_bytes()
        raw_hash_map[sha(payload)].append(path)
        suffix = p.suffix.lower()
        if suffix in CODE_EXT:
            text = read_text(path)
            clean = remove_comments_for_heuristics(text, suffix)
            normalized = re.sub(r'\s+', '', unicodedata.normalize('NFC', clean))
            if normalized:
                normalized_source_map[sha(normalized.encode('utf-8'))].append(path)
        pure, targets = is_pure_forwarder(path)
        resolved = [resolve_specifier(path, target, paths) for target in targets]
        resolved = sorted({x for x in resolved if x})
        if pure:
            wrapper_meta[path] = {'pureForwarder': True, 'reexportSpecifiers': targets, 'resolvedTargets': resolved}

    groups_same = {name: sorted(ps) for name, ps in by_basename.items() if len(ps) > 1}
    pair_by_path = {}
    pair_candidates = []
    group_records = []
    group_id_by_path = defaultdict(list)
    for idx, (name, ps) in enumerate(sorted(groups_same.items()), 1):
        gid = f'BASE-{idx:03d}'
        pair_items = []
        for i in range(len(ps)):
            for j in range(i + 1, len(ps)):
                a, b = ps[i], ps[j]
                ta, tb = read_text(a), read_text(b)
                similarity, scope = source_similarity(ta, tb)
                ext_a, ext_b = PurePosixPath(a).suffix.lower(), PurePosixPath(b).suffix.lower()
                raw_equal = (ROOT / a).read_bytes() == (ROOT / b).read_bytes()
                forward_a, forward_b = a in wrapper_meta, b in wrapper_meta
                if raw_equal:
                    finding = 'BYTE_IDENTICAL_CONTENT'
                elif forward_a or forward_b:
                    finding = 'FORWARDER_OR_BARREL_PRESENT'
                elif similarity is not None and similarity >= .80:
                    finding = 'HIGH_CONTENT_SIMILARITY_CANDIDATE'
                elif similarity is not None and similarity >= .50:
                    finding = 'MEDIUM_CONTENT_SIMILARITY_CANDIDATE'
                else:
                    finding = 'BASENAME_COLLISION_ONLY_OR_LOW_SIMILARITY'
                item = {
                    'pathA': a, 'pathB': b, 'byteIdentical': raw_equal,
                    'textSimilarity': round(similarity, 4) if similarity is not None else None,
                    'similarityScope': scope, 'pureForwarderA': forward_a, 'pureForwarderB': forward_b,
                    'finding': finding,
                }
                pair_items.append(item)
                group_id_by_path[a].append(gid); group_id_by_path[b].append(gid)
        # Group-wide classification is not the strongest pair result; list every pair-level result.
        statuses = Counter(x['finding'] for x in pair_items)
        group_records.append({
            'id': gid, 'basename': name, 'memberCount': len(ps), 'members': ps,
            'pairComparisonCount': len(pair_items), 'pairFindingCounts': dict(sorted(statuses.items())),
            'pairs': pair_items,
            'interpretation': 'Same basename triggers review only. A group may contain different responsibilities or generated/resource variants.'
        })

    # Runtime architecture overlap candidates: identical basename under src/miki and src/services.
    cross_counts = Counter()
    for grp in group_records:
        members = grp['members']
        miki_paths = [p for p in members if p.startswith('src/miki/')]
        service_paths = [p for p in members if p.startswith('src/services/')]
        if not miki_paths or not service_paths:
            continue
        for mp in miki_paths:
            for sp in service_paths:
                ta, tb = read_text(mp), read_text(sp)
                sim, scope = source_similarity(ta, tb)
                miki_forward, miki_targets = wrapper_meta.get(mp, {}).get('pureForwarder'), wrapper_meta.get(mp, {}).get('resolvedTargets', [])
                svc_forward, svc_targets = wrapper_meta.get(sp, {}).get('pureForwarder'), wrapper_meta.get(sp, {}).get('resolvedTargets', [])
                exports_a = set(next((r.get('sourceFacts', {}).get('exportedSymbols', []) for r in records if r['path']==mp), []))
                exports_b = set(next((r.get('sourceFacts', {}).get('exportedSymbols', []) for r in records if r['path']==sp), []))
                shared_exports = sorted(exports_a & exports_b)
                if miki_forward or svc_forward:
                    status = 'PURE_FORWARDING_FACADE'
                    priority = 'LOW_ALIAS_NOT_DUPLICATE_IMPLEMENTATION'
                    recommendation = 'Keep the façade only while callers require it; verify that it forwards to the single canonical target and does not own state.'
                elif sim is not None and sim >= .80:
                    status = 'HIGH_SIMILARITY_IMPLEMENTATION_CANDIDATE'
                    both_reach = bool(next(r for r in records if r['path']==mp).get('reachableFromCoreUiRootsByResolvedLocalImports')) and bool(next(r for r in records if r['path']==sp).get('reachableFromCoreUiRootsByResolvedLocalImports'))
                    priority = 'P1_BOTH_PATHS_STATically_REACHABLE' if both_reach else 'P2_HIGH_SIMILARITY_REVIEW'
                    recommendation = 'Compare behavior and state ownership, test both importer sets, then redirect callers to one implementation. Do not delete until singleton/storage/side-effect parity is proven.'
                elif sim is not None and sim >= .50:
                    status = 'MEDIUM_SIMILARITY_RESPONSIBILITY_CANDIDATE'
                    priority = 'P2_SEMANTIC_REVIEW'
                    recommendation = 'Review exports and behavioral differences; determine whether this is split responsibility, evolved implementation, or partial duplicate.'
                else:
                    status = 'LOW_SIMILARITY_SAME_NAME_REVIEW'
                    priority = 'P3_NAME_COLLISION_REVIEW'
                    recommendation = 'Same name is not enough to merge; document distinct responsibility or assign owner after call-site inspection.'
                rec_m = next(r for r in records if r['path']==mp)
                rec_s = next(r for r in records if r['path']==sp)
                item = {
                    'id': f'PAIR-{len(pair_candidates)+1:03d}', 'basename': grp['basename'], 'mikiPath': mp, 'servicesPath': sp,
                    'status': status, 'priority': priority,
                    'sourceTextSimilarity': round(sim, 4) if sim is not None else None, 'similarityScope': scope,
                    'byteIdentical': (ROOT/mp).read_bytes() == (ROOT/sp).read_bytes(),
                    'mikiStaticImporterCount': len(rec_m.get('staticImporters', [])),
                    'servicesStaticImporterCount': len(rec_s.get('staticImporters', [])),
                    'mikiReachableFromCoreUiRoots': bool(rec_m.get('reachableFromCoreUiRootsByResolvedLocalImports')),
                    'servicesReachableFromCoreUiRoots': bool(rec_s.get('reachableFromCoreUiRootsByResolvedLocalImports')),
                    'sharedExportedSymbolCount': len(shared_exports), 'sharedExportedSymbolsSample': shared_exports[:30],
                    'mikiResolvedForwarderTargets': miki_targets or [], 'servicesResolvedForwarderTargets': svc_targets or [],
                    'authorityCandidate': mp if status in {'HIGH_SIMILARITY_IMPLEMENTATION_CANDIDATE','MEDIUM_SIMILARITY_RESPONSIBILITY_CANDIDATE'} else (svc_targets[0] if svc_forward and len(svc_targets)==1 else miki_targets[0] if miki_forward and len(miki_targets)==1 else None),
                    'authorityConfidence': 'ARCHITECTURE_PATH_CANDIDATE_ONLY' if status in {'HIGH_SIMILARITY_IMPLEMENTATION_CANDIDATE','MEDIUM_SIMILARITY_RESPONSIBILITY_CANDIDATE'} else ('EXPLICIT_FORWARDING_TARGET' if status=='PURE_FORWARDING_FACADE' else 'UNRESOLVED'),
                    'evidence': 'Same basename plus local source inspection, static importer counts, CORE/UI static reachability, export-name intersection and whitespace-insensitive source similarity. Static edges do not prove runtime execution.',
                    'recommendation': recommendation,
                }
                pair_candidates.append(item)
                for p in (mp,sp):
                    pair_by_path[p] = item
                    group_id_by_path[p].append(item['id'])
                cross_counts[status] += 1

    # Exact byte identity across all baseline inventory files.
    identical_groups=[]
    for idx, (digest, ps) in enumerate(sorted(raw_hash_map.items(), key=lambda kv: (kv[1][0], kv[0])), 1):
        if len(ps) < 2:
            continue
        paths_sorted=sorted(ps)
        group_id=f'HASH-{len(identical_groups)+1:03d}'
        if set(paths_sorted) == {'android-native/src/main/java/com/miki/ai/MIKIJapaneseMorphologyPlugin.kt','android/app/src/main/java/com/miki/ai/MIKIJapaneseMorphologyPlugin.kt'}:
            assessment='SOURCE_TEMPLATE_AND_ANDROID_APP_COPY_CONFIRMED'
            recommendation='Keep source template and app copy linked by scripts/install_android_japanese_morphology.sh; future change should update template first and copy through installer.'
        elif set(paths_sorted) == {'android-native/src/main/java/com/miki/ai/MikiBackgroundWorker.kt','android/app/src/main/java/com/miki/ai/MikiBackgroundWorker.kt'}:
            assessment='IDENTICAL_NATIVE_FILE_AUTHORITY_REVIEW_REQUIRED'
            recommendation='The checked-in Android app path is runtime source; current installer validates but does not copy the android-native Worker. Confirm why an identical android-native copy is maintained before deleting either file.'
        elif 'ic_launcher.xml' in [PurePosixPath(p).name for p in paths_sorted] and any('ic_launcher_round.xml' in p for p in paths_sorted):
            assessment='ANDROID_RESOURCE_ALIAS_LIKELY_INTENTIONAL'
            recommendation='Two Android resource names currently point to the same background/foreground assets; keep unless launcher-specific artwork is required.'
        elif all(PurePosixPath(p).name == 'splash.png' for p in paths_sorted):
            assessment='ANDROID_QUALIFIER_FALLBACK_ASSET_LIKELY_INTENTIONAL'
            recommendation='Resource qualifier variants currently contain identical bytes; keep as fallback/landscape resource unless measured asset divergence is required.'
        else:
            assessment='BYTE_IDENTICAL_CONTENT_REVIEW_REQUIRED'
            recommendation='Review ownership and runtime/build usage before consolidation.'
        identical_groups.append({'id':group_id,'sha256':digest,'members':paths_sorted,'memberCount':len(ps),'assessment':assessment,'recommendation':recommendation})
        for p in paths_sorted: group_id_by_path[p].append(group_id)

    norm_groups=[]
    for digest, ps in sorted(normalized_source_map.items(), key=lambda kv: sorted(kv[1])[0]):
        if len(ps)>1:
            paths_sorted=sorted(ps)
            gid=f'NORM-{len(norm_groups)+1:03d}'
            norm_groups.append({'id':gid,'normalizedSha256':digest,'members':paths_sorted,'memberCount':len(paths_sorted),'method':'NFC Unicode normalization + comments heuristic removal + whitespace removal; candidate detector only'})
            for p in paths_sorted: group_id_by_path[p].append(gid)

    # Apply record classifications and duplicate pointers.
    all_paths = paths
    classified_counts=Counter()
    role_counts=Counter()
    artifact_counts=Counter()
    unresolved=[]
    for r in records:
        classification = classify_record(r, pair_by_path, wrapper_meta)
        r['capabilityClassification'] = classification
        classified_counts[classification['capabilityCategory']] += 1
        role_counts[classification['implementationRole']] += 1
        artifact_counts[classification['artifactKind']] += 1
        r['duplicateAudit'] = {
            'groupIds': sorted(set(group_id_by_path.get(r['path'], []))),
            'sameBasenameMember': len(by_basename[PurePosixPath(r['path']).name]) > 1,
            'crossLayerPairIds': sorted(i['id'] for i in pair_candidates if r['path'] in {i['mikiPath'], i['servicesPath']}),
        }
        if classification['classificationConfidence']=='LOW' or classification['capabilityCategory'] in {'UNMAPPED_CAPABILITY_REVIEW','UNCLASSIFIED_REVIEW'}:
            unresolved.append({'path':r['path'],'category':classification['capabilityCategory'],'role':classification['implementationRole'],'reason':classification['classificationEvidence']})
        payload=(ROOT/r['path']).read_bytes()
        r.setdefault('sourceFacts', {})['sha256'] = sha(payload)
        try:
            r['sourceFacts']['lineCount'] = len(payload.decode('utf-8').splitlines())
        except UnicodeDecodeError:
            r['sourceFacts']['lineCount'] = None

    domain_categories = {k:v for k,v in sorted(classified_counts.items()) if k=='CORE' or k.startswith('DOMAIN:')}
    non_domain_categories = {k:v for k,v in sorted(classified_counts.items()) if not (k=='CORE' or k.startswith('DOMAIN:'))}
    both_reachable = [p for p in pair_candidates if p['mikiReachableFromCoreUiRoots'] and p['servicesReachableFromCoreUiRoots']]
    similarity_counts = Counter(p['status'] for p in pair_candidates)
    pair_high_both = [p for p in pair_candidates if p['status']=='HIGH_SIMILARITY_IMPLEMENTATION_CANDIDATE' and p['mikiReachableFromCoreUiRoots'] and p['servicesReachableFromCoreUiRoots']]

    data['revision']='P286'
    data['generatedAt']='2026-10-18'
    data['title']='MIKI-AI0.2 File Relation Ledger — P286 master with capability categories and duplicate authority audit'
    data['sourceSnapshot']='P285 ZIP-derived 1789-file baseline; canonical design document hash/line count refreshed after P286 audit note; P286 ledger/generator/verifier outputs are excluded from baseline records to avoid self-reference; GitHub main synchronization not performed.'
    data['selectionPolicy']='One canonical P286 JSON master with records F001-F1789. All 1789 records are preserved from the P285 baseline; each has separate capability/artifact classification and duplicate-audit pointers. P286 did not delete or merge runtime implementations.'
    data['methodology'] = {
        **data.get('methodology',{}),
        'capabilityClassification':'Added independent capabilityCategory, architectureDomain, artifactKind, implementationRole, classificationConfidence, classificationEvidence, authorityCandidatePath, and authorityRelationship fields. Path is the primary evidence; low-confidence/unscoped sources remain explicit review items. Non-domain technical/artifact categories are not counted as extra MIKI capability domains.',
        'duplicateAudit':'Computed exact byte SHA-256 groups across all 1789 baseline records, comment/whitespace-normalized source hash candidates, same-basename groups, and src/miki versus src/services same-basename pairs. Similarity scores are triage heuristics, not proof of semantic equivalence. Pure re-export facades are separated from full implementation candidates.',
        'authoritySelection':'The src/miki domain path is listed as a likely authority candidate only when duplicate implementation similarity supports a review candidate; static importers and CORE/UI reachability are provided. No runtime implementation was removed, merged, or automatically declared equivalent.',
        'runtimeCaveat':'A module import does not prove an exported function is called in every path. Capacitor/JavaScript bridges, reflection, event subscriptions, storage-driven dispatch, native build source sets, and runtime-only references may not appear as ordinary local imports.'
    }
    data['counts'] = {
        **data.get('counts',{}),
        'recordIdRange':'F001-F1789', 'selectedFileCount':len(records), 'uniquePaths':len({r['path'] for r in records}),
        'classifiedRecordCount':len(records), 'capabilityCategoryCount':len(classified_counts),
        'architectureDomainCategories':domain_categories, 'nonDomainTechnicalOrArtifactCategories':non_domain_categories,
        'sourceRecordCount':sum(1 for r in records if r['capabilityClassification']['artifactKind']=='SOURCE_CODE'),
        'nonSourceOrNativeAssetRecordCount':sum(1 for r in records if r['capabilityClassification']['artifactKind']!='SOURCE_CODE'),
    }
    data['capabilityTaxonomy'] = {
        'architectureInvariant':'CORE + exactly 17 named domains = 18 capability architecture areas. UI, platform/runtime, shared utilities, reference project, scripts, configuration, documentation, reports, fixtures and static assets are separate technical/artifact categories.',
        'namedDomains':['autonomy','capability','conversation','data','execution','experience','improvement','learning','memory','promotion','research','safety','selfAwareness','selfDevelopment','strategy','unknown','verification'],
        'categoryCounts':dict(sorted(classified_counts.items())),
        'implementationRoleCounts':dict(sorted(role_counts.items())),
        'artifactKindCounts':dict(sorted(artifact_counts.items())),
        'unresolvedClassificationCount':len(unresolved),
        'unresolvedClassificationPaths':unresolved,
        'classificationRules':'See capabilityClassification on each record. Classification uses path, direct forwarding evidence, and same-basename peer evidence; it does not infer runtime use from names alone.'
    }
    data['duplicateAudit'] = {
        'scope':'All 1789 baseline files; audit files generated by P286 are excluded from its own record scope.',
        'counts':{
            'byteIdenticalGroupCount':len(identical_groups),
            'byteIdenticalFileCount':sum(g['memberCount'] for g in identical_groups),
            'normalizedSourceDuplicateGroupCount':len(norm_groups),
            'sameBasenameGroupCount':len(group_records),
            'sameBasenameMemberRecordCount':sum(g['memberCount'] for g in group_records),
            'sameBasenamePairComparisonCount':sum(g['pairComparisonCount'] for g in group_records),
            'srcMikiVsSrcServicesPairCount':len(pair_candidates),
            'srcMikiVsSrcServicesPairStatuses':dict(sorted(similarity_counts.items())),
            'srcMikiVsSrcServicesBothStaticallyReachableCount':len(both_reachable),
            'highSimilarityBothStaticallyReachableCount':len(pair_high_both),
            'srcServicesPathReachablePairCount':sum(p['servicesReachableFromCoreUiRoots'] for p in pair_candidates),
        },
        'byteIdenticalGroups':identical_groups,
        'normalizedSourceGroups':norm_groups,
        'sameBasenameGroups':group_records,
        'srcMikiVsSrcServicesPairs':pair_candidates,
        'reviewPolicy':'No implementation is deleted based only on the same name or similarity. P1 requires both implementations to be reachable from CORE/UI by static imports; inspect caller paths, singleton/state ownership, persistent storage keys, side effects, Native/API contracts and behavior before consolidation.'
    }
    data['consolidation'] = {
        'canonicalJson':'SOURCE_FILE_RELATION_LEDGER_P286.json',
        'humanReadableView':'SOURCE_FILE_RELATION_LEDGER_P286.md',
        'recordRanges':[{'range':'F001-F1789','recordCount':1789,'historicalOrigin':'P285 unified master; classification and duplicate audit added in P286'}],
        'supersedesSplitFiles':['SOURCE_FILE_RELATION_LEDGER_P280.json','SOURCE_FILE_RELATION_LEDGER_P280.md','SOURCE_FILE_RELATION_LEDGER_P281.json','SOURCE_FILE_RELATION_LEDGER_P281.md','SOURCE_FILE_RELATION_LEDGER_P282.json','SOURCE_FILE_RELATION_LEDGER_P282.md','SOURCE_FILE_RELATION_LEDGER_P283.json','SOURCE_FILE_RELATION_LEDGER_P283.md','SOURCE_FILE_RELATION_LEDGER_P284.json','SOURCE_FILE_RELATION_LEDGER_P284.md','SOURCE_FILE_RELATION_LEDGER_P285.json','SOURCE_FILE_RELATION_LEDGER_P285.md'],
        'runtimeSourceFilesModified':False,
        'gitHubMainUpdated':False
    }

    # Markdown view, generated from exactly the same JSON records.
    lines=[]
    lines += ['# MIKI-AI0.2 ファイル関係台帳 — P286 統合マスター（1789件）','',
      '- **正本JSON**: `SOURCE_FILE_RELATION_LEDGER_P286.json`。F001〜F1789を一つのマスターへ統合。',
      '- **基準スナップショット**: P285 ZIP由来の1,789ファイル。P286生成台帳・生成/検証スクリプトは自己参照回避のため基準件数外。',
      '- **今回の範囲**: 18能力領域に照らしたカテゴリ整理、同一内容・同名・同責務候補の比較、Authority候補と静的到達の記録。runtime実装は削除・統合していない。',
      '- **GitHub main**: 未同期・未PUSH。CI・build・実機動作は未確認。','',
      '## 1. 全体サマリー','',
      f'- 登録レコード: **{len(records)}** / 一意パス: **{len({r["path"] for r in records})}** / 未記載の基準ファイル: **0**',
      f'- 能力カテゴリ分類済み: **{len(records)}** / カテゴリ種類: **{len(classified_counts)}**',
      f'- バイト一致グループ: **{len(identical_groups)}** / 正規化ソース一致候補: **{len(norm_groups)}**',
      f'- 同名basenameグループ: **{len(group_records)}組・{sum(g["memberCount"] for g in group_records)}レコード**',
      f'- `src/miki/`対`src/services/`同名ペア: **{len(pair_candidates)}組** — 転送Facade {similarity_counts.get("PURE_FORWARDING_FACADE",0)}、高類似実装候補 {similarity_counts.get("HIGH_SIMILARITY_IMPLEMENTATION_CANDIDATE",0)}、中類似 {similarity_counts.get("MEDIUM_SIMILARITY_RESPONSIBILITY_CANDIDATE",0)}、低類似 {similarity_counts.get("LOW_SIMILARITY_SAME_NAME_REVIEW",0)}',
      f'- 両側ともCORE/UI静的到達可能な同名ペア: **{len(both_reachable)}組**。うち高類似候補: **{len(pair_high_both)}組**。','',
      '類似度は空白を除去したソース本文の文字列比較であり、意味同一性の証明ではない。実装の削除・統合はこの監査では行っていない。','',
      '## 2. 能力分類のルール','',
      '- `capabilityCategory`: CORE、`DOMAIN:<name>`、UI、共有基盤、Native、参照プロジェクト、検証/開発ツール、文書、設定、レポート、資産などの機能/技術層区分。',
      '- `architectureDomain`: COREまたは17分類のいずれか。能力領域に属さない成果物はnull。',
      '- `artifactKind`: 実装コード、Nativeコード、設定、文書、レポート、スクリプト、fixture、assetなどの種別。',
      '- `implementationRole`: 正規経路候補、互換Facade、旧並行実装候補、barrel、UI入口、検証スクリプト等の役割。',
      '- `classificationConfidence` と `classificationEvidence`: 分類の確度と根拠。low/unmappedは未確定として残す。','',
      '### カテゴリ件数','',
      '| カテゴリ | 件数 |','|---|---:|']
    for k,v in sorted(classified_counts.items()): lines.append(f'| `{k}` | {v} |')
    lines += ['', '### 実装ロール件数','', '| ロール | 件数 |','|---|---:|']
    for k,v in sorted(role_counts.items()): lines.append(f'| `{k}` | {v} |')
    lines += ['', '## 3. バイト一致・正規化一致','',
      '| ID | 判定 | 対象ファイル | 対応方針 |','|---|---|---|---|']
    for g in identical_groups:
        lines.append(f'| `{g["id"]}` | `{g["assessment"]}` | ' + '<br>'.join(f'`{p}`' for p in g['members']) + f' | {g["recommendation"]} |')
    for g in norm_groups:
        lines.append(f'| `{g["id"]}` | `NORMALIZED_SOURCE_IDENTICAL_CANDIDATE` | ' + '<br>'.join(f'`{p}`' for p in g['members']) + ' | 正規化後の一致は候補印。コメント除去は簡易ヒューリスティック。 |')
    lines += ['', '## 4. 責務重複の優先調査候補：src/miki と src/services','',
      '同名で並ぶコードを別々に確認した。`src/miki/<domain>`側をアーキテクチャ上の候補Authorityとして示すが、実際のruntime Authorityと同一とは断定していない。','',
      '| Pair ID | 判定/優先度 | Domain候補 | src/miki実装 | src/services側 | 類似度 | 呼出元数 M/S | CORE/UI到達 M/S | 共通Export数 |','|---|---|---|---|---|---:|---:|---|---:|']
    for p in pair_candidates:
        domain = domain_from_path(p['mikiPath']) or 'unknown'
        reach = ('Y' if p['mikiReachableFromCoreUiRoots'] else 'N') + '/' + ('Y' if p['servicesReachableFromCoreUiRoots'] else 'N')
        sim = f'{p["sourceTextSimilarity"]:.3f}' if p['sourceTextSimilarity'] is not None else '—'
        lines.append(f'| `{p["id"]}` | `{p["status"]}` / `{p["priority"]}` | `{domain}` | `{p["mikiPath"]}` | `{p["servicesPath"]}` | {sim} | {p["mikiStaticImporterCount"]}/{p["servicesStaticImporterCount"]} | {reach} | {p["sharedExportedSymbolCount"]} |')
    lines += ['', '## 5. 全同名basenameグループ','',
      '同名であることは重複実装の証拠ではない。詳細なペア比較・各メンバーは正本JSONの`duplicateAudit.sameBasenameGroups`を参照。','',
      '| Group ID | basename | メンバー数 | ペア比較数 | 判定内訳 |','|---|---|---:|---:|---|']
    for g in group_records:
        summary = ', '.join(f'{k}:{v}' for k,v in sorted(g['pairFindingCounts'].items())) or 'single-pair not applicable'
        lines.append(f'| `{g["id"]}` | `{g["basename"]}` | {g["memberCount"]} | {g["pairComparisonCount"]} | {summary} |')
    lines += ['', '## 6. 全ファイル台帳','',
      '| ID | File path | 能力/技術カテゴリ | Architecture domain | Artifact kind | Implementation role | Confidence | Authority relationship | 静的import元 | 静的依存先 | Duplicate groups | 役割候補 |',
      '|---|---|---|---|---|---|---|---|---|---|---|---|']
    for r in records:
        c=r['capabilityClassification']; da=r['duplicateAudit']
        callers=', '.join(PurePosixPath(x.get('path','') if isinstance(x,dict) else x).name for x in r.get('staticImporters',[])[:4]) or '—'
        deps=', '.join(PurePosixPath(x).name for x in r.get('staticDependencies',[])[:4]) or '—'
        dom=c['architectureDomain'] or '—'
        groups=', '.join(da['groupIds'][:6]) or '—'
        purpose=(r.get('purpose','') or '').replace('|','\\|').replace('\n',' ')[:150]
        lines.append(f'| {r["id"]} | `{r["path"]}` | `{c["capabilityCategory"]}` | `{dom}` | `{c["artifactKind"]}` | `{c["implementationRole"]}` | `{c["classificationConfidence"]}` | `{c["authorityRelationship"]}` | {callers} | {deps} | {groups} | {purpose} |')
    lines += ['', '## 7. Interpretation and safeguards','',
      '- Static import paths and CORE/UI reachability are evidence of static module linkage only; they do not prove every imported function executes in production.',
      '- A high text-similarity pair may differ in persistence keys, singleton construction, fallback behavior, or side effects. Both reachable implementations are P1 review candidates; do not delete either before caller and state ownership review.',
      '- A direct re-export façade is not a second implementation when it forwards to the canonical module; preserve it while callers still depend on its public path, or intentionally migrate callers before removal.',
      '- The morphology plugin pair is a source template and app copy because the installer explicitly copies from `android-native/`. The Worker pair is byte-identical but its installer does not copy the native-side file; ownership remains a review item.',
      '- P286 updated the ledger and design documentation only. No runtime service files were removed or edited; GitHub main/CI/build/device behavior is not verified.','']
    md='\n'.join(lines)
    OUTPUT_JSON.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    OUTPUT_MD.write_text(md,encoding='utf-8')
    print(json.dumps({
        'revision':'P286','records':len(records),'uniquePaths':len({r['path'] for r in records}),
        'categories':dict(sorted(classified_counts.items())),
        'roles':dict(sorted(role_counts.items())),
        'byteIdenticalGroups':len(identical_groups),'normalizedSourceGroups':len(norm_groups),
        'sameBasenameGroups':len(group_records),'sameBasenameMembers':sum(g['memberCount'] for g in group_records),
        'mikiServicesPairs':len(pair_candidates),'pairStatuses':dict(sorted(similarity_counts.items())),
        'bothReachablePairs':len(both_reachable),'highSimilarityBothReachable':len(pair_high_both),
        'unresolvedClassificationCount':len(unresolved),'json':str(OUTPUT_JSON),'markdown':str(OUTPUT_MD)
    },ensure_ascii=False,indent=2))

if __name__ == '__main__':
    all_paths = set()
    # Filled from P285 before classification; initialized here for resolve_specifier helper.
    try:
        _d = json.loads(SOURCE_JSON.read_text(encoding='utf-8'))
        all_paths = {r['path'] for r in _d['records']}
    except Exception:
        pass
    generate()
