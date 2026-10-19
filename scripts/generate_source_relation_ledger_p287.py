#!/usr/bin/env python3
"""P287: enrich P286 master with functional capability tags and review triage.

Analysis-only artifact generation. No runtime source implementation is modified.
Keyword similarity and text similarity are review signals, not proof of equivalence.
"""
from __future__ import annotations
from pathlib import Path, PurePosixPath
from collections import Counter, defaultdict
import hashlib, json, re, zipfile

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'SOURCE_FILE_RELATION_LEDGER_P286.json'
JSON_OUT = ROOT / 'SOURCE_FILE_RELATION_LEDGER_P287.json'
MD_OUT = ROOT / 'SOURCE_FILE_RELATION_LEDGER_P287.md'
DESIGN = ROOT / 'MIKI-AI0.2_統合設計書_正本.txt'

# These are capability-topic labels, separate from CORE + 17 architecture domains.
RULES = {
 'orchestration_routing': ['orchestrator','orchestration','taskingress','task_ingress','coregateway','route','router','dispatch','ingress','coordination','routing','統括','振分','ルーティング'],
 'conversation_dialogue': ['conversation','dialogue','chat','prompt','message','response','turn','session','会話','対話','発話','応答'],
 'research_retrieval': ['research','search','web','fetch','searx','wikipedia','duckduckgo','retrieval','retrieve','sourceacquisition','queryplanning','検索','調査','取得','情報収集'],
 'memory_knowledge_evidence': ['memory','claim','knowledge','evidence','vector','embedding','database','knowledgegraph','persist','storage','contextstore','記憶','知識','証拠','永続化','保存','根拠'],
 'learning_feedback': ['learning','learner','outcome','feedback','transfer','adaptation','reinforcement','learningopportunity','学習','フィードバック','転移','結果学習'],
 'capability_assessment': ['capability','skill','competence','ability','capabilityledger','ledgergraph','能力','スキル','能力台帳','能力評価'],
 'self_improvement_code_review': ['selfcode','self_code','self-code','selfimprovement','self_improvement','selfdevelopment','self_development','reviewzip','codecandidate','codespace','自己コード','自己改善','コード候補','レビューzip'],
 'verification_quality_gate': ['verify','verifier','validate','validator','validation','revalidation','qualitygate','quality_gate','contractcheck','staticcheck','検証','再検証','品質ゲート','静的検査'],
 'execution_tools': ['executor','execution','toolcall','tool_call','sandbox','commandrunner','command_runner','actiondispatch','invoke','runner','実行','コマンド','ツール呼出'],
 'safety_policy': ['safety','policy','guard','risk','permission','authorization','injection','refusal','安全','ポリシー','権限','リスク','拒否'],
 'autonomy_scheduling': ['autonomous','autopilot','scheduler','background','heartbeat','proactive','cycle','自律','スケジューラ','バックグラウンド','定期実行'],
 'strategy_planning': ['strategy','plan','planner','planning','goal','objective','decision','計画','戦略','目標','意思決定'],
 'state_checkpoint_recovery': ['checkpoint','resume','receipt','outbox','recovery','snapshot','statehash','restore','復元','チェックポイント','再開','状態復元'],
 'promotion_governance': ['promotion','promote','approval','adoption','rollout','singlepromotion','昇格','承認','採用ゲート'],
 'self_awareness_reflection': ['selfawareness','self_awareness','introspection','reflection','selfmodel','自己認識','内省','自己モデル'],
 'data_schema_management': ['schema','serializer','deserializer','normalization','normalizer','migration','parser','ingestion','dataset','スキーマ','正規化','移行','解析','データセット'],
 'user_experience_personalization': ['experience','personalization','accessibility','notification','interaction','ux','ユーザー体験','個人化','通知','操作性'],
}

def hash_file(p: Path) -> str:
    h=hashlib.sha256()
    with p.open('rb') as f:
        for chunk in iter(lambda:f.read(1024*1024),b''): h.update(chunk)
    return h.hexdigest()

def uniq(xs):
    out=[]; seen=set()
    for x in xs:
        if x not in seen: seen.add(x); out.append(x)
    return out

def category_score(path: str, purpose: str, exports: list[str], patterns: list[str]) -> tuple[int,list[str]]:
    lp=path.casefold(); lt=purpose.casefold(); le=' '.join(str(x) for x in exports).casefold()
    matched=[]; score=0
    for term in patterns:
        t=term.casefold()
        # Require a non-trivial text match. Path and exports are stronger than a purpose phrase.
        if t in lp:
            score += 4 if len(t)>=8 else 3; matched.append('path:'+term)
        elif t in le:
            score += 3 if len(t)>=8 else 2; matched.append('export:'+term)
        elif t in lt:
            score += 2 if len(t)>=6 or any(ord(c)>127 for c in t) else 1; matched.append('purpose:'+term)
    return score, matched

def artifact_default(r: dict, cc: dict) -> tuple[str,str]:
    path=r['path']; c=cc['capabilityCategory']; artifact=cc['artifactKind']; role=cc['implementationRole']
    if c=='REFERENCE_PROJECT': return 'reference_project', 'path identifies isolated reference project'
    if c=='NATIVE_ANDROID': return 'native_android_runtime_or_template', 'Android source/build boundary'
    if c=='NATIVE_RUST': return 'native_rust_runtime', 'Rust/native source boundary'
    if c=='UI_APP_BOUNDARY': return 'ui_presentation_and_interaction', 'UI/app boundary path'
    if c=='APP_RUNTIME_INFRASTRUCTURE': return 'application_lifecycle', 'app runtime lifecycle path'
    if c=='VERIFICATION_TOOLING': return 'verification_and_quality_gates', 'verification/audit tool path'
    if c=='DEVELOPER_TOOLING': return 'developer_build_and_maintenance', 'developer/install/build tooling path'
    if c=='DOCUMENTATION': return 'documentation_and_design_specification', 'documentation artifact'
    if c=='AUDIT_REPORT_DATA': return 'audit_reporting_and_evidence', 'machine-readable report/audit artifact'
    if c=='BUILD_CONFIGURATION': return 'build_and_environment_configuration', 'build/configuration artifact'
    if c=='STATIC_ASSET': return 'static_or_generated_asset', 'non-executable asset path/extension'
    if c=='TEST_SUPPORT': return 'test_fixture_and_support', 'test/fixture path'
    if c=='SHARED_INFRASTRUCTURE': return 'cross_domain_shared_infrastructure', 'shared types/utils/services path'
    if c=='COMPATIBILITY_FACADE': return 'compatibility_and_module_facade', 'forwarding/barrel module'
    if c=='UNMAPPED_CAPABILITY_REVIEW': return 'capability_owner_unresolved', 'owner not established from validated architecture path'
    if c.startswith('DOMAIN:'):
        return 'domain_service:'+c.split(':',1)[1], 'domain path provides architecture-domain fallback'
    if c=='CORE': return 'core_runtime_coordination', 'CORE path provides architecture fallback'
    if artifact=='SOURCE_CODE': return 'unmapped_application_source', 'source path does not establish a narrower responsibility'
    return 'project_artifact_or_data', 'non-runtime project artifact'

def add_functional_classification(r: dict):
    cc=r.get('capabilityClassification',{})
    path=r['path']; purpose=str(r.get('purpose','') or '')
    exports=r.get('sourceFacts',{}).get('exportedSymbols',[]) or []
    scored=[]
    for cat, patterns in RULES.items():
        score, evidence=category_score(path,purpose,exports,patterns)
        if score: scored.append((cat,score,evidence))
    scored.sort(key=lambda x:(-x[1],x[0]))
    default, default_reason=artifact_default(r,cc)
    # Keep non-executable and isolated-project artifacts categorized by artifact, while retaining semantic tags.
    non_code=cc.get('artifactKind')!='SOURCE_CODE'
    artifact_primary={
        'REFERENCE_PROJECT','NATIVE_ANDROID','NATIVE_RUST','UI_APP_BOUNDARY','APP_RUNTIME_INFRASTRUCTURE',
        'VERIFICATION_TOOLING','DEVELOPER_TOOLING','DOCUMENTATION','AUDIT_REPORT_DATA','BUILD_CONFIGURATION',
        'STATIC_ASSET','TEST_SUPPORT','PROJECT_CONFIGURATION_OR_DATA','PROJECT_ARTIFACT','PROJECT_ARTIFACT',
    }
    if non_code or (cc.get('capabilityCategory') in artifact_primary and not path.startswith('src/miki/')):
        primary=default
        confidence='HIGH' if cc.get('classificationConfidence')=='HIGH' else 'MEDIUM'
    elif scored and scored[0][1] >= 3:
        primary=scored[0][0]
        confidence='HIGH' if ('path:' in ' '.join(scored[0][2]) or 'export:' in ' '.join(scored[0][2])) and scored[0][1]>=4 else 'MEDIUM'
    else:
        primary=default
        confidence='LOW' if cc.get('classificationConfidence')=='LOW' or cc.get('capabilityCategory')=='UNMAPPED_CAPABILITY_REVIEW' else 'MEDIUM'
    tags=[]
    if cc.get('architectureDomain'):
        tags.append('architecture_domain:'+str(cc['architectureDomain']))
    tags.append('artifact_kind:'+str(cc.get('artifactKind','UNKNOWN_ARTIFACT')).lower())
    if cc.get('capabilityCategory'):
        tags.append('capability_category:'+str(cc['capabilityCategory']))
    # Include supported functional tags. A keyword hit is not itself proof of ownership.
    if scored:
        top=scored[0][1]
        for cat,score,evidence in scored:
            if score>=max(2,top*0.42) and len(tags)<12:
                tags.append('function:'+cat)
    # Primary is included to make grouping stable.
    tags.append('primary_function:'+primary)
    tags=uniq(tags)
    evidence=[]
    if primary==default:
        evidence.append(default_reason)
    for cat,score,ev in scored[:5]:
        if cat==primary or score>=max(3,scored[0][1]*0.65 if scored else 999):
            evidence.append(f'{cat} score={score}: '+', '.join(ev[:5]))
    if not evidence: evidence=['No strong lexical responsibility marker; broad category retained as fallback']
    return {
        'primaryFunctionalCapability':primary,
        'functionalCapabilityTags':tags,
        'functionalClassificationConfidence':confidence,
        'functionalClassificationEvidence':uniq(evidence),
        'functionalClassifierMethod':'Path/purpose/export-name weighted keyword evidence plus existing architecture/artifact classification; not a runtime behavior proof.'
    }

def update_design(design: str, stats: dict) -> str:
    design=re.sub(r'^正本Revision：.*$', '正本Revision：2026-10-18-P287', design, count=1, flags=re.M)
    design=re.sub(r'^- 現行Revision: .*$', '- 現行Revision: 2026-10-18-P287', design, count=1, flags=re.M)
    # Replace current P286 ledger section in place, retaining nearby design content.
    start=design.find('■ ファイル関係台帳（P286・単一マスター1789ファイル）')
    end=design.find('■ 自己能力台帳グラフ', start)
    if start>=0 and end>start:
        replacement=f'''■ ファイル関係台帳（P287・能力細分類／重複Authority監査1789ファイル）

- 現行正本は`SOURCE_FILE_RELATION_LEDGER_P287.json`、閲覧用の対応表は`SOURCE_FILE_RELATION_LEDGER_P287.md`。F001〜F1789の1,789レコードを単一JSONへ収録し、Markdownは同じ記録の閲覧版とする。
- P285 ZIP由来の基準スナップショット1,789ファイルを保全し、P286の全ファイル分類・重複監査を引き継いだうえで、`primaryFunctionalCapability`、`functionalCapabilityTags`、分類確度、分類根拠を追加した。能力細分類の語彙分類は、パス・purpose・export名の重み付きキーワードに基づく調査支援であり、実装の意味や実行時責務の証明とは扱わない。
- 能力分類は、CORE＋17Domainの`architectureDomain`、技術/成果物カテゴリ`capabilityCategory`、成果物種別`artifactKind`、実装役割`implementationRole`、機能タグ`functionalCapabilityTags`の別軸で管理する。UI、Native、共有基盤、資料、設定、検証ツール、監査レポート、資産、参照プロジェクトは追加Domainとして数えない。
- 重複・Authority監査では、バイト一致グループ{stats['byteGroups']}組、正規化ソース一致候補{stats['normalizedGroups']}組、同名basenameグループ{stats['basenameGroups']}組／{stats['basenameMembers']}レコード、`src/miki/`対`src/services/`同名ペア{stats['crossPairs']}組を個別管理する。クロス層ペアは純転送Facade {stats['facades']}組、高類似実装候補 {stats['high']}組、中類似 {stats['medium']}組、低類似 {stats['low']}組。高類似候補のうち{stats['highBoth']}組は双方がCORE/UIの静的import到達集合に含まれる。
- 同一バイト、正規化後一致、同名、文字列類似、純転送Facadeは別判定であり、件数を単純合算しない。Androidのアプリコピー/テンプレート、用途別Androidリソース、互換Facade、同じbasenameだけの衝突も区別する。実装を削除・統合する前に、呼び出し元、singleton/状態所有、永続キー、副作用、Android source set、native bridge、公開APIとbehavior parityを確認する。
- 監査で検出した高類似候補は、特に双方が静的到達可能な37組をP1として優先確認する。これは今後の確認キューであり、重複実装と確定した結果ではない。P287ではruntimeソースの削除・統合を行っていない。
- パス/静的importの静的証拠は、実行時呼出しの証明ではない。パス分類・キーワード分類に強い根拠がない記録は未確定のまま残す。GitHub main同期、commit/PUSH、CI、型検査、Android build/APK、実機E2Eは未実施。

'''
        design=design[:start]+replacement+design[end:]
    if '【2026-10-18-P287 能力細分類と重複Authority優先レビュー】' not in design:
        design += f'''\n【2026-10-18-P287 能力細分類と重複Authority優先レビュー】

- P286の1,789件の分類と重複照合を維持し、各レコードへ機能の主カテゴリ、補助タグ、根拠、分類確度を追加する。CORE＋17Domainのアーキテクチャ軸と機能タグは別物として扱う。
- 重複監査の現行集計：バイト一致{stats['byteGroups']}組、正規化ソース一致候補{stats['normalizedGroups']}組、同名グループ{stats['basenameGroups']}組、src/miki対src/servicesの同名ペア{stats['crossPairs']}組。ペア判定はFacade {stats['facades']}、高類似{stats['high']}、中類似{stats['medium']}、低類似{stats['low']}。
- 高類似ペアは責務重複の候補として優先確認するが、類似度や同名だけで正規実装を確定しない。静的呼出元・両方の到達性・公開export・状態/永続化/副作用を確認し、根拠を台帳に残してから統合判断する。
- P287は監査台帳・設計記録・検証スクリプトの更新であり、runtimeコードの削除・統合、GitHub main同期、CI/build/APK、実機E2Eは未実施。
'''
    return design

def main():
    if not SOURCE.exists(): raise SystemExit('P286_MASTER_NOT_FOUND')
    data=json.loads(SOURCE.read_text(encoding='utf-8'))
    records=data.get('records',[])
    if len(records)!=1789 or len({r['path'] for r in records})!=1789: raise SystemExit('P286_LEDGER_COUNT_OR_PATH_DUPLICATE')
    if [r['id'] for r in records] != [f'F{i:03d}' if i<1000 else f'F{i:04d}' for i in range(1,1790)]:
        # Check numeric continuity without depending on zero-padding width.
        if [int(re.search(r'(\d+)$',r['id']).group(1)) for r in records] != list(range(1,1790)):
            raise SystemExit('P286_RECORD_ID_SEQUENCE_INVALID')
    design_rel=str(DESIGN.relative_to(ROOT))
    for r in records:
        p=ROOT/r['path']
        if not p.is_file(): raise SystemExit('BASELINE_FILE_MISSING:'+r['path'])
        old=r.get('sourceFacts',{}).get('sha256')
        if r['path']!=design_rel and old and hash_file(p)!=old:
            raise SystemExit('BASELINE_HASH_MISMATCH:'+r['path'])

    # Correct the two earlier count typos in the historical P286 section before appending P287.
    design=DESIGN.read_text(encoding='utf-8')
    design=design.replace('純転送Facade候補27組、高類似91組、中類似15組、低類似5組','純転送Facade候補28組、高類似91組、中類似15組、低類似4組')
    design=design.replace('純転送Facade候補27組、非Facadeの高類似実装候補91組、中類似15組、低類似5組','純転送Facade候補28組、非Facadeの高類似実装候補91組、中類似15組、低類似4組')
    design=design.replace('うち純転送Facade候補27組、高類似91組、中類似15組、低類似5組','うち純転送Facade候補28組、高類似91組、中類似15組、低類似4組')
    DESIGN.write_text(design,encoding='utf-8')

    functional=Counter()
    tag_counts=Counter()
    confidence_counts=Counter()
    for r in records:
        r['functionalCapability']=add_functional_classification(r)
        f=r['functionalCapability']
        functional[f['primaryFunctionalCapability']]+=1
        confidence_counts[f['functionalClassificationConfidence']]+=1
        for tag in f['functionalCapabilityTags']:
            tag_counts[tag]+=1
        # Fresh hash and line count after design document revision; all other baseline files have been hash-guarded.
        payload=(ROOT/r['path']).read_bytes()
        r.setdefault('sourceFacts',{})['sha256']=hashlib.sha256(payload).hexdigest()
        try:r['sourceFacts']['lineCount']=len(payload.decode('utf-8').splitlines())
        except UnicodeDecodeError:r['sourceFacts']['lineCount']=None

    da=data['duplicateAudit']; counts=da['counts']
    status=counts['srcMikiVsSrcServicesPairStatuses']
    stats={
        'byteGroups':counts['byteIdenticalGroupCount'], 'normalizedGroups':counts['normalizedSourceDuplicateGroupCount'],
        'basenameGroups':counts['sameBasenameGroupCount'], 'basenameMembers':counts['sameBasenameMemberRecordCount'],
        'crossPairs':counts['srcMikiVsSrcServicesPairCount'], 'facades':status.get('PURE_FORWARDING_FACADE',0),
        'high':status.get('HIGH_SIMILARITY_IMPLEMENTATION_CANDIDATE',0), 'medium':status.get('MEDIUM_SIMILARITY_RESPONSIBILITY_CANDIDATE',0),
        'low':status.get('LOW_SIMILARITY_SAME_NAME_REVIEW',0), 'highBoth':counts['highSimilarityBothStaticallyReachableCount']
    }
    # Add an ordered explicit P1 review queue. This is still a candidate queue, not a list of confirmed duplicates.
    pairs=da.get('srcMikiVsSrcServicesPairs',[])
    priority=[p for p in pairs if p['status']=='HIGH_SIMILARITY_IMPLEMENTATION_CANDIDATE' and p['mikiReachableFromCoreUiRoots'] and p['servicesReachableFromCoreUiRoots']]
    priority.sort(key=lambda p:(-float(p.get('sourceTextSimilarity') or 0),-(p.get('mikiStaticImporterCount',0)+p.get('servicesStaticImporterCount',0)),p['basename']))
    for i,p in enumerate(priority,1): p['reviewQueueRankP1']=i
    da['priorityOneReviewQueue']=[{
        'rank':p['reviewQueueRankP1'],'pairId':p['id'],'basename':p['basename'],'sourceTextSimilarity':p.get('sourceTextSimilarity'),
        'mikiPath':p['mikiPath'],'servicesPath':p['servicesPath'],
        'staticImporterCountMiki':p.get('mikiStaticImporterCount',0),'staticImporterCountServices':p.get('servicesStaticImporterCount',0),
        'sharedExportedSymbolCount':p.get('sharedExportedSymbolCount',0),
        'nextChecks':['inspect all static importers and public API callers','compare state/singleton creation and persistence keys','compare side effects/fallback/error behavior','run targeted regression tests before any merge']
    } for p in priority]
    da['interpretationNotes']=[
        'Exact byte duplicate, normalized source duplicate, same basename, and high text similarity are separate findings and their counts must not be added as if they were disjoint.',
        'The normalized source groups overlap with raw-byte groups for both Android Kotlin pairs; they are not two additional independent implementations.',
        'High similarity indicates text resemblance only. It does not prove runtime responsibility or behavioral equivalence.',
        'A forwarding facade can be necessary for compatibility and is not a second implementation if it only re-exports a single target.',
        'Android resources with different qualifier/name may intentionally contain identical bytes; use resource selection/build usage before consolidating.'
    ]
    data['revision']='P287'
    data['generatedAt']='2026-10-18'
    data['title']='MIKI-AI0.2 File Relation Ledger — P287 functional capability taxonomy and duplicate authority review'
    data['sourceSnapshot']='P285 ZIP-derived baseline of 1789 tracked files carried forward from P286; P287 ledger and scripts are outside the baseline to avoid self-reference. No GitHub main synchronization.'
    data['selectionPolicy']='Preserve all 1789 baseline files and F001-F1789 IDs. Add a separate functional capability taxonomy and prioritize suspicious same-basename source pairs; no runtime files are removed or merged.'
    data['methodology']['functionalCapabilityClassification']='Each record gets primaryFunctionalCapability, functionalCapabilityTags, confidence, and evidence from weighted matches in path, prior purpose description, and exported symbols. This is triage metadata, not a semantic/runtime proof.'
    data['methodology']['duplicateAudit'] += ' P287 adds an ordered P1 review queue for high-similarity cross-layer pairs where both paths are statically reachable from CORE/UI and adds interpretation notes to prevent overlapping findings from being summed.'
    data['capabilityFunctionalTaxonomy']={
        'purpose':'Functional responsibility tags are orthogonal to CORE + 17 architecture domains and to artifact kind.',
        'rules':{k:v for k,v in RULES.items()},
        'primaryCapabilityCounts':dict(sorted(functional.items())),
        'tagCounts':dict(sorted(tag_counts.items())),
        'confidenceCounts':dict(sorted(confidence_counts.items())),
        'classificationMethod':'Weighted exact substring matches: path stronger than export names, export names stronger than purpose descriptions; if no strong match use architecture/artifact fallback. Manually review LOW-confidence entries.',
        'unresolvedPrimaryCapabilities':[{'path':r['path'],'primary':r['functionalCapability']['primaryFunctionalCapability'],'confidence':r['functionalCapability']['functionalClassificationConfidence']} for r in records if r['functionalCapability']['functionalClassificationConfidence']=='LOW']
    }
    data['counts']['functionalCapabilityCount']=len(functional)
    data['counts']['functionalCapabilityPrimaryCounts']=dict(sorted(functional.items()))
    data['counts']['functionalClassificationConfidenceCounts']=dict(sorted(confidence_counts.items()))
    data['consolidation']['canonicalJson']='SOURCE_FILE_RELATION_LEDGER_P287.json'
    data['consolidation']['humanReadableView']='SOURCE_FILE_RELATION_LEDGER_P287.md'
    data['consolidation']['recordRanges']=[{'range':'F001-F1789','recordCount':1789,'historicalOrigin':'P285 baseline carried through P286; functional taxonomy and duplicate review queue added in P287'}]
    data['consolidation']['runtimeSourceFilesModified']=False
    data['consolidation']['gitHubMainUpdated']=False

    design=update_design(DESIGN.read_text(encoding='utf-8'),stats)
    DESIGN.write_text(design,encoding='utf-8')
    # Refresh the design document facts after editing.
    for r in records:
        if r['path']==design_rel:
            payload=DESIGN.read_bytes(); r['sourceFacts']['sha256']=hashlib.sha256(payload).hexdigest(); r['sourceFacts']['lineCount']=len(payload.decode('utf-8').splitlines())

    # Markdown generated from the same JSON records.
    lines=['# MIKI-AI0.2 ファイル関係台帳 — P287 統合マスター（1789件）','',
      '- 正本JSON: `SOURCE_FILE_RELATION_LEDGER_P287.json`。F001〜F1789の単一マスター。',
      '- 基準: P285 ZIP由来の1,789ファイル。P287台帳/スクリプトは自己参照を避けるため基準対象外。',
      '- P287では機能別の主カテゴリとタグを追加。CORE＋17Domain、成果物種別、機能タグは別軸。',
      '- GitHub mainへの同期/PUSH、CI、build、Android APK、実機動作は未確認。','',
      '## 1. 全体サマリー','',
      f'- レコード数: **{len(records)}** / 一意パス: **{len({r["path"] for r in records})}** / 基準スナップショット内の未記載ファイル: **0**',
      f'- 能力領域/技術カテゴリ: **{len(data["counts"]["capabilityCategoryCount"] if False else data["capabilityTaxonomy"]["categoryCounts"])}**種類、機能主カテゴリ: **{len(functional)}**種類',
      f'- 機能分類の確度: '+', '.join(f'{k}={v}' for k,v in sorted(confidence_counts.items())),
      f'- 重複監査: バイト一致{stats["byteGroups"]}組、正規化ソース一致候補{stats["normalizedGroups"]}組、同名グループ{stats["basenameGroups"]}組/{stats["basenameMembers"]}レコード、src/miki対src/servicesペア{stats["crossPairs"]}組',
      f'- ペア判定: Facade={stats["facades"]}、高類似={stats["high"]}、中類似={stats["medium"]}、低類似={stats["low"]}; 高類似かつ両側静的到達可能={stats["highBoth"]}組','',
      '重複の数値は検出手法ごとに重なりがあるため合算しない。類似度は同一責務の証明ではない。','',
      '## 2. 機能別主カテゴリ','', '| 機能カテゴリ | 件数 |','|---|---:|']
    for k,v in sorted(functional.items()): lines.append(f'| `{k}` | {v} |')
    lines += ['', '## 3. 18能力領域/技術カテゴリ（既存分類）','', '| カテゴリ | 件数 |','|---|---:|']
    for k,v in sorted(data['capabilityTaxonomy']['categoryCounts'].items()): lines.append(f'| `{k}` | {v} |')
    lines += ['', '## 4. バイト一致・正規化ソース一致','', '| ID | 判定 | ファイル | 推奨扱い |','|---|---|---|---|']
    for g in da.get('byteIdenticalGroups',[]):
        lines.append(f'| `{g["id"]}` | `{g["assessment"]}` | '+'<br>'.join(f'`{p}`' for p in g['members'])+f' | {g["recommendation"]} |')
    for g in da.get('normalizedSourceGroups',[]):
        lines.append(f'| `{g["id"]}` | `NORMALIZED_SOURCE_IDENTICAL_CANDIDATE` | '+'<br>'.join(f'`{p}`' for p in g['members'])+' | バイト一致監査との重なりもあるため独立重複として加算しない。 |')
    lines += ['', '## 5. 優先度P1：両側CORE/UI静的到達可能かつ高類似','', '| 順位 | Pair | 類似度 | src/miki | src/services | import元数 M/S |','|---:|---|---:|---|---|---:|']
    for p in da['priorityOneReviewQueue']:
        lines.append(f'| {p["rank"]} | `{p["pairId"]}` | {p["sourceTextSimilarity"]:.3f} | `{p["mikiPath"]}` | `{p["servicesPath"]}` | {p["staticImporterCountMiki"]}/{p["staticImporterCountServices"]} |')
    lines += ['', '## 6. 全138件：src/miki 対 src/services同名ペア','', '| Pair | 判定 | 類似度 | src/miki | src/services | 根拠/次の確認 |','|---|---|---:|---|---|---|']
    for p in da.get('srcMikiVsSrcServicesPairs',[]):
        sim=f'{p["sourceTextSimilarity"]:.3f}' if p.get('sourceTextSimilarity') is not None else '—'
        lines.append(f'| `{p["id"]}` | `{p["status"]}` | {sim} | `{p["mikiPath"]}` | `{p["servicesPath"]}` | {p.get("recommendation","")} |')
    lines += ['', '## 7. 全同名グループ','', '| Group | basename | members | pair comparisons | 判定内訳 |','|---|---|---:|---:|---|']
    for g in da.get('sameBasenameGroups',[]):
        summary=', '.join(f'{k}:{v}' for k,v in sorted(g['pairFindingCounts'].items())) or '—'
        lines.append(f'| `{g["id"]}` | `{g["basename"]}` | {g["memberCount"]} | {g["pairComparisonCount"]} | {summary} |')
    lines += ['', '## 8. 全ファイル台帳','', '| ID | Path | Functional primary | Functional tags | Domain/category | Artifact | Role | Confidence | Authority | Importers | Dependencies | Duplicate groups | Purpose |','|---|---|---|---|---|---|---|---|---|---|---|---|---|']
    for r in records:
        cc=r.get('capabilityClassification',{}); fc=r['functionalCapability']; da_rec=r.get('duplicateAudit',{})
        importers=', '.join(PurePosixPath(x.get('path','') if isinstance(x,dict) else x).name for x in r.get('staticImporters',[])[:4]) or '—'
        deps=', '.join(PurePosixPath(x).name for x in r.get('staticDependencies',[])[:4]) or '—'
        tags=', '.join(fc['functionalCapabilityTags'][:5])
        purpose=str(r.get('purpose','') or '').replace('|','\\|').replace('\n',' ')[:120]
        lines.append(f'| {r["id"]} | `{r["path"]}` | `{fc["primaryFunctionalCapability"]}` | {tags} | `{cc.get("capabilityCategory","?")}` / `{cc.get("architectureDomain") or "—"}` | `{cc.get("artifactKind","?")}` | `{cc.get("implementationRole","?")}` | `{fc["functionalClassificationConfidence"]}` | `{cc.get("authorityRelationship","?")}` | {importers} | {deps} | {", ".join(da_rec.get("groupIds",[])[:5]) or "—"} | {purpose} |')
    lines += ['', '## 9. Interpretation safeguards','',
      '- Same basename is a trigger for review, not proof of duplicate responsibility.',
      '- Exact byte-identical groups and normalized-source groups overlap; counts are not additive.',
      '- Similar source bodies and shared export names are review signals, not semantic equivalence.',
      '- Forwarding facades can be valid compatibility APIs; do not delete while callers depend on the path.',
      '- The top P1 list has 37 pairs whose both paths are statically reachable and highly similar; compare persistence, singleton/state, side effects, callers and regression behavior before choosing an authority.',
      '- No runtime source implementation was deleted or merged. GitHub main, CI, build, APK and device E2E remain unverified.','']
    MD_OUT.write_text('\n'.join(lines),encoding='utf-8')
    JSON_OUT.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    # Update design doc after JSON info produced so counts are accurate.
    print(json.dumps({'revision':'P287','records':len(records),'uniquePaths':len({r['path'] for r in records}),'functionalCategories':dict(sorted(functional.items())),'functionalConfidence':dict(sorted(confidence_counts.items())),'duplicateStats':stats,'p1Queue':len(priority),'json':str(JSON_OUT),'markdown':str(MD_OUT)},ensure_ascii=False,indent=2))

if __name__=='__main__':
    main()
