#!/usr/bin/env python3
"""P288 source-level authority audit for the 37 high-priority src/miki vs src/services pairs.

Consumes SOURCE_FILE_RELATION_LEDGER_P287.json and checks the checked-out archive
sources, direct static importer references, public contract shapes, persistent keys,
singleton/state patterns, and non-import body deltas. It recommends an authority
candidate but never edits/removes runtime implementations automatically.
"""
from __future__ import annotations
import collections
import difflib
import hashlib
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
JSON_IN = ROOT / 'SOURCE_FILE_RELATION_LEDGER_P287.json'
JSON_OUT = ROOT / 'SOURCE_FILE_RELATION_LEDGER_P288.json'
MD_OUT = ROOT / 'SOURCE_FILE_RELATION_LEDGER_P288.md'

# Hand-reviewed interpretation of material differences surfaced by the text diff.
# These are migration constraints, not claims that runtime behavior has been tested.
MANUAL = {
 'PAIR-132': ('IDENTICAL_BODY_IMPORT_PATH_ONLY', 'HIGH', 'Public API and body are identical after excluding imports. The Miki path has more domain consumers and a verification barrel export.', 'Route the legacy caller through the Miki authority after contract test; do not keep two class definitions as separate singleton-capable modules.'),
 'PAIR-127': ('IDENTICAL_BODY_IMPORT_PATH_ONLY', 'HIGH', 'Public API and body are identical after excluding imports; both define a TestAssertionService class with static-instance behavior.', 'Keep one class definition and preserve the src/services import path as a temporary re-export facade until its executionRunnerService caller is migrated.'),
 'PAIR-017': ('IDENTICAL_BODY_SHARED_PERSISTENCE_KEY', 'HIGH', 'Same body with import-path changes and the same persistent key; duplicate module instances can independently cache/write the same data.', 'Use the domain implementation as authority. Confirm storage compatibility and redirect the legacy selection caller; legacy path should re-export.'),
 'PAIR-042': ('IDENTICAL_BODY_SHARED_PERSISTENCE_KEY', 'HIGH', 'Same body and history storage key; both layers have multiple importers.', 'Use the domain implementation as authority and migrate legacy callers while preserving the persisted key and record schema.'),
 'PAIR-072': ('IDENTICAL_BODY_SHARED_PERSISTENCE_KEY', 'HIGH', 'Same body and candidate storage key. Importers include a verifier script and both autonomy/verification runtime paths.', 'Use the Miki domain implementation; update callers and keep the verifier checking the canonical module. Preserve storage key and contract.'),
 'PAIR-014': ('IDENTICAL_BODY_DEPENDENCY_ROOT_DIFFERS', 'HIGH', 'Body is the same, but service dependencies resolve through domain paths in Miki and legacy copies in src/services.', 'Use Miki as authority after redirecting legacy callers; ensure imported event bus, freshness, failure-memory, and registry objects are canonical singletons.'),
 'PAIR-018': ('IDENTICAL_BODY_SHARED_PERSISTENCE_KEY', 'HIGH', 'Body is identical but copies depend on different relative module roots and use a shared persistence key.', 'Use Miki as authority and verify the event-bus and failure-memory object identity before migrating both legacy importers.'),
 'PAIR-058': ('IDENTICAL_BODY_IMPORT_PATH_ONLY', 'HIGH', 'Body is identical after imports are excluded.', 'Use Miki as authority; change legacy service imports to the canonical domain service or a re-export facade.'),
 'PAIR-085': ('DEPENDENCY_SEMANTICS_DIVERGENCE', 'MEDIUM', 'Most source is identical, but embedding calls use deterministicRuntimeService in Miki versus nonLlmRuntimeService in src/services. The same conversation_state key is shared.', 'Prefer Miki as the architectural owner, but compare embedding result type, timeout/fallback behavior and callers before converting legacy path to a facade. Preserve conversation_state schema.'),
 'PAIR-084': ('IDENTICAL_BODY_DEPENDENCY_ROOT_DIFFERS', 'HIGH', 'Body is identical after imports are excluded; privacy guardrail dependency resolves through different module roots.', 'Use Miki authority; check both paths use the same privacy guardrail state/instance after redirects.'),
 'PAIR-062': ('IDENTICAL_BODY_SHARED_PERSISTENCE_KEY', 'HIGH', 'Body is identical with the same dependency responsibilities; the two exported service instances may split in-memory state.', 'Use Miki authority and migrate legacy callers; preserve any persistent schema/key found in the source audit.'),
 'PAIR-129': ('IDENTICAL_BODY_SHARED_PERSISTENCE_KEY', 'HIGH', 'Body is identical except imports; both copies expose the same decision-engine exports.', 'Use Miki authority. Migrate callers and keep one authoritative decision engine/state owner.'),
 'PAIR-098': ('IDENTICAL_BODY_DEPENDENCY_ROOT_DIFFERS', 'HIGH', 'Body is identical after imports are excluded; composition, execution, recovery and verification dependencies map to corresponding domain paths.', 'Use Miki authority and unify dependency singletons before turning the older service path into a facade.'),
 'PAIR-125': ('IDENTICAL_BODY_IMPORT_PATH_ONLY', 'HIGH', 'Body is identical after imports are excluded.', 'Use Miki authority; maintain a compatibility re-export for older callers until they are migrated.'),
 'PAIR-020': ('IDENTICAL_BODY_DEPENDENCY_ROOT_DIFFERS', 'HIGH', 'Body is identical apart from module import roots; dependencies are domain modules on one side and legacy service modules on the other.', 'Use Miki authority, then update callers so one capability reuse and failure-memory state path is used.'),
 'PAIR-002': ('IDENTICAL_BODY_SHARED_PERSISTENCE_KEY_OR_STATE', 'HIGH', 'Body is identical after imports are excluded and the exported service creates its own module instance.', 'Use the Miki self-awareness domain implementation as sole owner after existing callers are redirected.'),
 'PAIR-034': ('IDENTICAL_BODY_SHARED_PERSISTENCE_KEY', 'HIGH', 'Body is identical after imports are excluded; artifact-store state is exposed from two module identities.', 'Use Miki authority and maintain package persistence format during import migration.'),
 'PAIR-074': ('IDENTICAL_BODY_DEPENDENCY_ROOT_DIFFERS', 'HIGH', 'Body is identical after imports are excluded; registry dependencies resolve differently by module root.', 'Use Miki authority and check that registry object identity does not split during migration.'),
 'PAIR-099': ('IDENTICAL_BODY_SHARED_PERSISTENCE_KEY_OR_STATE', 'HIGH', 'Body is identical after import-root changes; safety state may be independently instantiated.', 'Use Miki safety-domain implementation; retain the legacy route only as a re-export facade.'),
 'PAIR-001': ('IDENTICAL_BODY_SHARED_PERSISTENCE_KEY_OR_STATE', 'HIGH', 'Body is identical apart from import roots and exported object construction.', 'Use Miki safety-domain implementation; unify state/instance ownership before removing the old implementation.'),
 'PAIR-048': ('IDENTICAL_BODY_DEPENDENCY_ROOT_DIFFERS', 'HIGH', 'Body is identical after imports are excluded but dependencies route through domain implementations in Miki and legacy copies elsewhere.', 'Use Miki as authority and preserve failure recovery/event side-effect ordering across caller migration.'),
 'PAIR-124': ('IDENTICAL_BODY_DEPENDENCY_ROOT_DIFFERS', 'HIGH', 'Body is identical after imports are excluded; the task orchestrator wires several domain dependencies differently by relative path.', 'Use Miki authority and ensure plan, component registry, memory and execution services are shared singletons.'),
 'PAIR-104': ('BEHAVIORAL_DIVERGENCE_MIKI_HAS_MULTI_INTENT_PLAN', 'HIGH', 'The Miki file includes decomposeMultiIntent and passes intentPlan into compilation; the legacy file omits that step.', 'Use Miki as authority and migrate any legacy callers only after a multi-intent regression case protects the added behavior.'),
 'PAIR-056': ('IDENTICAL_BODY_DEPENDENCY_ROOT_DIFFERS', 'HIGH', 'Body is identical after imports are excluded; legacy imports resolve to sibling services, while Miki imports within the domain.', 'Use Miki authority; inspect downstream ranking callers during migration and preserve deterministic score ordering.'),
 'PAIR-051': ('IDENTICAL_BODY_DEPENDENCY_ROOT_DIFFERS', 'HIGH', 'Body is identical after imports are excluded; event bus and task memory are resolved via different roots.', 'Use Miki authority after confirming one event bus and one task-case-memory instance are used.'),
 'PAIR-046': ('SMALL_SOURCE_FORMAT_OR_LOCAL_BINDING_DIVERGENCE', 'MEDIUM', 'The visible change includes a type-assertion formatting/local-binding rewrite around evaluation records; verify no behavior change in the surrounding branch.', 'Use Miki path as target authority but compare decision-evaluation behavior with regression cases before facade conversion.'),
 'PAIR-095': ('IDENTICAL_BODY_DEPENDENCY_ROOT_DIFFERS', 'HIGH', 'Body is substantially identical and imports point to Miki-domain dependencies versus legacy services.', 'Use Miki safety-domain owner after contract checks for claim database, registry and execution-event behavior.'),
 'PAIR-118': ('BEHAVIORAL_DIVERGENCE_MIKI_USES_DETERMINISTIC_CANDIDATE_FLOW', 'HIGH', 'Miki graduates skills into deterministic capability/experience candidate flow; the legacy copy retains a LoRA dataset route.', 'Use Miki authority consistent with the non-LLM architecture. Preserve any still-used training sample records through an explicit adapter, not a second implementation.'),
 'PAIR-016': ('PUBLIC_METHOD_CONTRACT_DIVERGENCE', 'MEDIUM', 'The legacy capabilityGraphService exposes extra plan arguments (excludedComponentIds/environment) that are not present in the Miki version.', 'Keep Miki as the architecture owner, but port or deliberately deprecate the extra parameters after checking callers. A direct forwarding facade is unsafe until API parity is restored.'),
 'PAIR-080': ('BEHAVIORAL_DIVERGENCE_MIKI_HAS_SEMANTIC_GRAPH_LOOKUP', 'HIGH', 'The Miki dictionary merges semanticDictionaryGraphP209Service lookup results with legacy entries; src/services omits that graph dependency and merge.', 'Use Miki as authority; maintain deduplication/source-priority behavior with semantic graph regression fixtures.'),
 'PAIR-059': ('BEHAVIORAL_DIVERGENCE_LEGACY_RETAINS_LORA_ROUTE', 'HIGH', 'The Miki router sends qualifying experience to verified_candidate; the legacy copy sends it to lora_dataset.', 'Use Miki as authority consistent with deterministic/non-LLM design. Keep the legacy path only as a facade after the destination contract is tested.'),
 'PAIR-067': ('BEHAVIORAL_DIVERGENCE_FEATURE_FLAG_POLICY', 'HIGH', 'Miki marks legacy LoRA as retired and returns DISABLED as an unknown-key fallback; legacy descriptions and fallback differ.', 'Use Miki policy as the intended authority. Test the full feature-flag enum/consumer set before redirecting importers.'),
 'PAIR-063': ('IDENTICAL_BODY_DEPENDENCY_ROOT_DIFFERS', 'HIGH', 'Body is identical after imports are excluded; dependency paths map to the domain’s failure/registry/composition/runner services.', 'Use Miki safety-domain implementation; verify shared dependencies and error recovery ordering before migration.'),
 'PAIR-057': ('PUBLIC_CONTRACT_AND_COUNTERFACTUAL_BEHAVIOR_DIVERGENCE', 'HIGH', 'The Miki runner includes counterfactual measurement/review fields and imports counterfactualEvaluationPolicy; the legacy API omits those fields.', 'Use Miki authority; port any required compatibility type conversions and cover counterfactual approval/rejection with regression tests before legacy facade conversion.'),
 'PAIR-047': ('INPUT_CONTRACT_DIVERGENCE', 'MEDIUM', 'The Miki evolution service accepts CapabilityLearningCandidate while legacy accepts TrainingSampleJSONL; same basename/export name hides a contract mismatch.', 'Treat the Miki service as capability-patch authority. Preserve sample ingestion behind an explicit adapter or give it a distinct service name; do not replace blindly.'),
 'PAIR-079': ('BEHAVIORAL_DIVERGENCE_JAPANESE_ANALYSIS', 'MEDIUM', 'The Miki analysis file contains question-intent detection and analysis fallback flow; legacy has different normalization/empty-input logic and imports morphology via another path.', 'Use Miki research-domain authority only after reconciling the legacy normalization guard and morphology behavior; add question, empty-input, and native/fallback fixtures.'),
 'PAIR-015': ('BEHAVIORAL_DIVERGENCE_CAPABILITY_GAP_EVIDENCE_AND_COORDINATION', 'HIGH', 'Miki includes seeded evidenceIds/source metadata and coordinates with promotion-gate, unknown-task decomposition and experience-link services; legacy omits these integrations.', 'Use Miki capability-domain authority; retain evidence/source metadata and migration defaults for existing persisted records before turning legacy path into a facade.'),
}

def strip_imports(src: str) -> str:
    lines = src.splitlines()
    out=[]; i=0
    while i < len(lines):
        line=lines[i]
        if re.match(r'^\s*import\b', line):
            buf=line
            while ';' not in buf and i+1 < len(lines):
                i += 1; buf += '\n' + lines[i]
            i += 1
            continue
        out.append(line); i += 1
    return '\n'.join(out)

def export_symbols(source: str) -> list[str]:
    found=set()
    patterns=[r'export\s+(?:default\s+)?(?:abstract\s+)?(?:async\s+)?(?:class|function|const|let|var|interface|type|enum)\s+(\w+)', r'export\s*\{([^}]+)\}']
    for pat in patterns:
        for m in re.finditer(pat, source):
            if m.lastindex == 1:
                vals=m.group(1).split(',') if pat.endswith(r'([^}]+)\}') else [m.group(1)]
                for val in vals:
                    name=re.split(r'\s+as\s+', val.strip())[0].strip()
                    if re.fullmatch(r'[A-Za-z_$][\w$]*', name): found.add(name)
    return sorted(found)

def imported_modules(source: str) -> list[str]:
    return re.findall(r"(?:import|export)\s+(?:type\s+)?(?:[^'\";]*?\s+from\s+)?['\"]([^'\"]+)['\"]", source)

def public_contracts(source: str) -> list[str]:
    vals=[]
    for line in source.splitlines():
        s=line.strip()
        if re.match(r'(?:public|protected)\s+(?:static\s+)?(?:async\s+)?\w+\s*\(',s):
            vals.append(re.sub(r'\s+',' ',s[:180]))
    return vals[:80]

def literal_keys(source: str) -> list[dict]:
    out=[]
    # Class properties and module constants whose identifier explicitly denotes a key.
    pat=r"(?:const|let|var|private|protected|public)\s+(?:readonly\s+)?([A-Za-z_$][\w$]*(?:key)[A-Za-z0-9_$]*)\s*(?::[^=;]+)?=\s*(['\"`])([^'\"`\n]+)\2"
    for m in re.finditer(pat, source, re.I):
        out.append({'name':m.group(1),'value':m.group(3)})
    # Also capture literal storage keys when passed directly instead of via a named constant.
    direct=r"(?:storageService|localStorage|sessionStorage)\.(?:getItem|setItem|removeItem)\s*\(\s*(['\"`])([^'\"`\n]+)\1"
    for m in re.finditer(direct, source):
        out.append({'name':'DIRECT_STORAGE_LITERAL','value':m.group(2)})
    unique={(x['name'],x['value']) for x in out}
    return [{'name':n,'value':v} for n,v in sorted(unique)]

def symbols_and_state(source: str) -> dict:
    singletonPatterns=[]
    for name, pat in [
        ('exported_new_instance', r'export\s+const\s+\w+\s*=\s*new\s+\w+\s*\('),
        ('static_instance_getter', r'static\s+instance\b[\s\S]{0,800}?getInstance\s*\('),
        ('module_singleton', r'export\s+const\s+\w+\s*=\s*\w+\.getInstance\s*\('),
    ]:
        if re.search(pat, source): singletonPatterns.append(name)
    fields=[]
    for line in source.splitlines():
        m=re.match(r'\s*(?:private|protected)\s+(?:readonly\s+)?(\w+)\s*[:=]',line)
        if m: fields.append(m.group(1))
    side=[]
    for token in ['storageService.getItem','storageService.setItem','storageService.removeItem','localStorage','sessionStorage','indexedDB','Date.now','Math.random','systemLogger.','dispatchEvent(','addEventListener(','setTimeout(','setInterval(','fetch(','crypto.subtle']:
        c=source.count(token)
        if c: side.append({'name':token,'count':c})
    return {'singletonPatterns':singletonPatterns,'privateStateFields':fields[:40], 'privateStateFieldCount':len(fields), 'stateAndSideEffectMarkers':side, 'persistentKeys':literal_keys(source)}

def importer_usage(path: str, exports: list[str], record_map: dict) -> list[dict]:
    result=[]
    for edge in record_map.get(path,{}).get('staticImporters',[]):
        importer=edge['path']; fp=ROOT/importer
        row={'path':importer,'line':edge.get('line'),'kind':edge.get('kind'),'specifier':edge.get('specifier'),'usedExports':[]}
        if fp.exists():
            lines=fp.read_text(errors='replace').splitlines()
            for name in exports:
                hits=[]
                for i,line in enumerate(lines,1):
                    if re.search(r'\b'+re.escape(name)+r'\b',line) and i != edge.get('line'):
                        if re.match(r'\s*(import|export)\b',line): continue
                        hits.append({'line':i,'excerpt':line.strip()[:180]})
                if hits:
                    row['usedExports'].append({'name':name,'occurrenceCount':len(hits),'examples':hits[:2]})
        result.append(row)
    return result

def body_delta(a: str, b: str) -> dict:
    la=strip_imports(a).splitlines(); lb=strip_imports(b).splitlines()
    matcher=difflib.SequenceMatcher(a=la,b=lb,autojunk=False)
    hunks=[]
    for tag,i1,i2,j1,j2 in matcher.get_opcodes():
        if tag=='equal': continue
        # skip empty diff blocks defensively
        old=[s.strip() for s in la[i1:i2] if s.strip()]
        new=[s.strip() for s in lb[j1:j2] if s.strip()]
        if not old and not new: continue
        hunks.append({'operation':tag,'mikiLines':[i1+1,i2],'servicesLines':[j1+1,j2], 'mikiExcerpt':' | '.join(old[:3])[:300], 'servicesExcerpt':' | '.join(new[:3])[:300]})
    return {'identicalAfterRemovingImports':len(hunks)==0,'changeHunkCount':len(hunks),'changeHunks':hunks[:12]}

def main():
    data=json.loads(JSON_IN.read_text())
    record_map={r['path']:r for r in data['records']}
    pairs=data['duplicateAudit']['srcMikiVsSrcServicesPairs']
    by_id={p['id']:p for p in pairs}
    audits=[]
    for q in data['duplicateAudit']['priorityOneReviewQueue']:
        p=by_id[q['pairId']]
        mp=p['mikiPath']; sp=p['servicesPath']
        ma=ROOT/mp; sb=ROOT/sp
        if not ma.exists() or not sb.exists(): raise SystemExit(f'missing pair source: {mp} / {sp}')
        miki_src=ma.read_text(errors='replace'); services_src=sb.read_text(errors='replace')
        mr=record_map[mp]; sr=record_map[sp]
        category, confidence, evidence, recommendation=MANUAL[p['id']]
        m_exports=export_symbols(miki_src); s_exports=export_symbols(services_src)
        m_state=symbols_and_state(miki_src); s_state=symbols_and_state(services_src)
        shared_keys=sorted({x['value'] for x in m_state['persistentKeys']} & {x['value'] for x in s_state['persistentKeys']})
        md=body_delta(miki_src,services_src)
        m_imp=imported_modules(miki_src); s_imp=imported_modules(services_src)
        audits.append({
            'rank':q['rank'],'pairId':p['id'],'basename':p['basename'],
            'mikiPath':mp,'servicesPath':sp,
            'sourceTextSimilarity':p['sourceTextSimilarity'],
            'bothStaticallyReachableFromCoreUi':bool(p.get('mikiReachableFromCoreUiRoots') and p.get('servicesReachableFromCoreUiRoots')),
            'staticImporterCounts':{'miki':len(mr.get('staticImporters',[])),'services':len(sr.get('staticImporters',[]))},
            'staticImporterPaths':{'miki':importer_usage(mp,m_exports,record_map),'services':importer_usage(sp,s_exports,record_map)},
            'publicContract':{'mikiExportedSymbols':m_exports,'servicesExportedSymbols':s_exports,'exportSetsIdentical':m_exports==s_exports,'mikiPublicMethods':public_contracts(miki_src),'servicesPublicMethods':public_contracts(services_src)},
            'dependencyModules':{'miki':m_imp,'services':s_imp,'sameModuleSpecifierSet':sorted(m_imp)==sorted(s_imp)},
            'stateOwnership':{'miki':m_state,'services':s_state,'sharedPersistentKeyValues':shared_keys,'sharedPersistentKeyCount':len(shared_keys),'bothExportModuleInstance':bool('exported_new_instance' in m_state['singletonPatterns'] and 'exported_new_instance' in s_state['singletonPatterns']),'potentialDuplicateServiceInstance':bool(('exported_new_instance' in m_state['singletonPatterns'] and 'exported_new_instance' in s_state['singletonPatterns']) or ('static_instance_getter' in m_state['singletonPatterns'] and 'static_instance_getter' in s_state['singletonPatterns'])),'statefulInstanceInEitherCopy':bool(m_state['privateStateFieldCount'] or s_state['privateStateFieldCount'] or shared_keys),'potentialStateDivergence':bool((('exported_new_instance' in m_state['singletonPatterns'] and 'exported_new_instance' in s_state['singletonPatterns']) or ('static_instance_getter' in m_state['singletonPatterns'] and 'static_instance_getter' in s_state['singletonPatterns'])) and (m_state['privateStateFieldCount'] or s_state['privateStateFieldCount'] or shared_keys))},
            'bodyDiffAfterRemovingImports':md,
            'authorityFinding':{'classification':category,'confidence':confidence,'canonicalAuthorityPathAtDesignLevel':mp,'designCanonicalAuthoritySelected':True,'runtimeAuthorityConverged':False,'legacyPathRoleRecommendation':'COMPATIBILITY_FACADE_AFTER_CALLER_MIGRATION_OR_EXPLICIT_ADAPTER','evidence':evidence,'nextStep':recommendation,'automaticMergeApproved':False,'runtimeTestsPerformed':False},
        })
    status_counts=collections.Counter(x['authorityFinding']['classification'] for x in audits)
    exact_body=sum(1 for x in audits if x['bodyDiffAfterRemovingImports']['identicalAfterRemovingImports'])
    shared_keys=sum(1 for x in audits if x['stateOwnership']['sharedPersistentKeyCount']>0)
    splitstate=sum(1 for x in audits if x['stateOwnership']['potentialStateDivergence'])
    miki_more=sum(1 for x in audits if x['staticImporterCounts']['miki']>x['staticImporterCounts']['services'])
    data['revision']='P288'
    data['generatedAt']='2026-10-18'
    data['sourceSnapshot']='P285 ZIP-derived baseline paths of 1789 tracked files carried forward through P287; P288 adds source-level authority review of all 37 high-priority pairs. The canonical design document was updated and its hash/lineCount synchronized; P288 ledger/scripts are outside the 1789-record baseline. No GitHub main synchronization and no runtime source edits.'
    data['methodology']['authorityReviewP288']='All 37 P287 P1 cross-layer pairs were re-opened in the P287 source snapshot. For each side, direct static importer paths/lines and export identifier references were collected; public contract signatures, direct dependency specifiers, persistent string-key constants, singleton/state/side-effect markers, and source-body diff hunks after excluding import statements were compared. Architecture-layer path is a recommended authority candidate, not a proof of runtime ownership. Behaviorally divergent pairs are explicitly assigned migration constraints. No runtime files were deleted, merged, or redirected.'
    data['duplicateAudit']['authorityReviewP288']={
        'scope':'All 37 P287 P1 pairs whose src/miki and src/services paths are both statically reachable from CORE/UI and have high similarity.',
        'method':'Inspect actual source for both paths; compare imports separately from body differences; record public symbols/methods, direct importers and symbol-use snippets, persistence literal keys, singleton/state and side-effect markers; recommend a Miki-domain authority target under the CORE+17Domain architecture; block blind facade conversion where public contract or behavior differs.',
        'counts':{'reviewedPairs':len(audits),'identicalBodyAfterRemovingImports':exact_body,'bodyOrContractDivergenceCandidates':len(audits)-exact_body,'pairsWithSharedPersistentKeyValues':shared_keys,'pairsWithPotentialStateDivergence':splitstate,'pairsWhereMikiHasMoreDirectStaticImporters':miki_more,'classificationCounts':dict(sorted(status_counts.items()))},
        'authorityRule':'The design-level canonical implementation target is selected as src/miki/<domain>/services/<name> for all 37 reviewed pairs, aligning with CORE + 17-domain architecture and greater direct static-importer counts in 36/37 pairs. This selects architecture ownership, not proof that runtime ownership has converged: source code still contains both implementations. src/services/<name> is a compatibility-facade candidate only after all callers and unique behavior are migrated. Where behavior/contracts differ, preserve the unique behavior or add an explicit adapter before facade conversion; do not blindly re-export or delete.',
        'runtimeStatus':'AUDIT_ONLY_NO_RUNTIME_SOURCE_MODIFICATIONS; no build, CI, native build or device E2E was executed.',
        'pairs':audits,
    }
    data['counts']['authorityReviewP288']={'reviewedPairs':len(audits),'identicalBodyAfterRemovingImports':exact_body,'bodyOrContractDivergenceCandidates':len(audits)-exact_body,'pairsWithSharedPersistentKeyValues':shared_keys,'pairsWithPotentialStateDivergence':splitstate,'pairsWhereMikiHasMoreDirectStaticImporters':miki_more}
    data['consolidation']['canonicalJson']='SOURCE_FILE_RELATION_LEDGER_P288.json'
    data['consolidation']['humanReadableView']='SOURCE_FILE_RELATION_LEDGER_P288.md'
    data['consolidation']['recordRanges']=[{'range':'F001-F1789','recordCount':1789,'historicalOrigin':'P285 baseline carried through P287; P288 adds source-level authority audit for all 37 P1 pairs'}]
    data['consolidation']['runtimeSourceFilesModified']=False
    data['consolidation']['gitHubMainUpdated']=False
    # The canonical design document is part of the 1789-file baseline and was extended for P288.
    design_path='MIKI-AI0.2_統合設計書_正本.txt'
    design_record=next((r for r in data['records'] if r['path']==design_path),None)
    if design_record and (ROOT/design_path).exists():
        raw=(ROOT/design_path).read_bytes()
        design_record['sourceFacts']['sha256']=hashlib.sha256(raw).hexdigest()
        design_record['sourceFacts']['lineCount']=len(raw.decode('utf-8',errors='replace').splitlines())
        design_record['purpose']='唯一の設計正本。CORE＋17Domain、実装規則、P288重複Authority/状態所有監査を含む。'
    JSON_OUT.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
    md=render_markdown(data)
    MD_OUT.write_text(md)
    print(json.dumps({'revision':'P288','records':len(data['records']),'pairsAudited':len(audits),'identicalBodyAfterRemovingImports':exact_body,'bodyOrContractDivergenceCandidates':len(audits)-exact_body,'pairsWithSharedPersistentKeyValues':shared_keys,'pairsWithPotentialStateDivergence':splitstate,'pairsWhereMikiHasMoreDirectStaticImporters':miki_more,'classificationCounts':dict(sorted(status_counts.items()))},ensure_ascii=False,indent=2))

def render_markdown(d):
    counts=d['duplicateAudit']['authorityReviewP288']['counts']
    out=[]
    out += ['# MIKI-AI0.2 ファイル関係台帳 — P288 統合マスター（1789件）','',
      '- 正本JSON: `SOURCE_FILE_RELATION_LEDGER_P288.json`。F001〜F1789の単一マスター。',
      '- 基準: P285 ZIP由来の1,789ファイル。P288台帳/スクリプトは自己参照を避けるため基準対象外。',
      '- P288ではP287のP1優先候補37組を実ファイルで再確認し、直接import元・公開API・依存先・状態/永続化・import除外後の実装差分を記録。',
      '- GitHub main同期/PUSH、CI、build、Android APK、実機動作は未確認。', '',
      '## 1. 全体サマリー','',
      f"- レコード数: **{len(d['records'])}** / 一意パス: **{d['counts']['uniquePaths']}** / 基準スナップショット内の未記載ファイル: **{d['counts']['remainingUnrecordedRepositoryFiles']}**",
      f"- 能力領域/技術カテゴリ: **{d['counts']['capabilityCategoryCount']}**種類、機能主カテゴリ: **{d['counts']['functionalCapabilityCount']}**種類",
      f"- 重複監査: バイト一致{d['duplicateAudit']['counts']['byteIdenticalGroupCount']}組、正規化ソース一致候補{d['duplicateAudit']['counts']['normalizedSourceDuplicateGroupCount']}組、同名グループ{d['duplicateAudit']['counts']['sameBasenameGroupCount']}組、src/miki対src/servicesペア{d['duplicateAudit']['counts']['srcMikiVsSrcServicesPairCount']}組",
      f"- P288 Authority監査: **{counts['reviewedPairs']}組**確認、import除外後の本文一致{counts['identicalBodyAfterRemovingImports']}組、本文/契約差分候補{counts['bodyOrContractDivergenceCandidates']}組、永続キー共有{counts['pairsWithSharedPersistentKeyValues']}組、潜在的状態分岐{counts['pairsWithPotentialStateDivergence']}組。",'',
      '**Authority判断:** 37組すべての設計上の正規実装先を `src/miki/<domain>/services/` に選定しました。これはCORE＋17Domainの設計と、36/37組でMiki側の直接import元が多いことに基づく判断です。ただしruntime実装はまだ両方存在します。`src/services/` 側の一意な挙動・API・依存関係を移行する前に直接転送Facadeへ置き換えることは禁止。今回runtimeコードは変更していません。','',
      '## 2. P288：37組の実コードAuthority監査','','|順位|Pair|機能|本文類型|類似度|Miki静的import元|Legacy静的import元|共有永続キー|安全な次作業|','|---:|---|---|---|---:|---:|---:|---:|---|']
    for p in d['duplicateAudit']['authorityReviewP288']['pairs']:
        a=p['authorityFinding']; state=p['stateOwnership']; mdiff=p['bodyDiffAfterRemovingImports']
        typ='本文一致（import差のみ）' if mdiff['identicalAfterRemovingImports'] else '本文/契約差分あり'
        keys=', '.join(state['sharedPersistentKeyValues']) or '—'
        action=a['nextStep'].replace('|','/').replace('\n',' ')
        out.append(f"|{p['rank']}|`{p['pairId']}`|`{p['basename']}`|{typ}|{p['sourceTextSimilarity']:.4f}|{p['staticImporterCounts']['miki']}|{p['staticImporterCounts']['services']}|{keys}|{action}|")
    out += ['', '## 3. 個別ペアの根拠・呼び出し元・状態所有', '']
    for p in d['duplicateAudit']['authorityReviewP288']['pairs']:
        a=p['authorityFinding']; state=p['stateOwnership']; con=p['publicContract']; dep=p['dependencyModules']; diff=p['bodyDiffAfterRemovingImports']
        out += [f"### {p['rank']}. {p['basename']} — {p['pairId']}", '',
          f"- Miki: `{p['mikiPath']}`", f"- Legacy: `{p['servicesPath']}`",
          f"- 判定: `{a['classification']}`（確度 {a['confidence']}）。設計上の正規Authority: `{a['canonicalAuthorityPathAtDesignLevel']}`。実装一意化: `{a['runtimeAuthorityConverged']}`。",
          f"- 根拠: {a['evidence']}",
          f"- 静的import元: Miki {p['staticImporterCounts']['miki']}件 / Legacy {p['staticImporterCounts']['services']}件。両側CORE/UI静的到達={p['bothStaticallyReachableFromCoreUi']}。",
          f"- 公開export一致={con['exportSetsIdentical']}。Miki exports: {', '.join(con['mikiExportedSymbols']) or '—'}; Legacy exports: {', '.join(con['servicesExportedSymbols']) or '—'}。",
          f"- 依存モジュール: Miki `{', '.join(dep['miki']) or '—'}`; Legacy `{', '.join(dep['services']) or '—'}`。",
          f"- 共有persistent key: {', '.join(state['sharedPersistentKeyValues']) or '—'}。potential state divergence={state['potentialStateDivergence']}。",
          f"- importを除いた本文一致={diff['identicalAfterRemovingImports']}。本文差分hunk={diff['changeHunkCount']}。",
          f"- 移行条件: {a['nextStep']}",
          '- runtime動作・実呼出・native/bridge動作はこの静的監査だけでは未証明。自動統合・runtime編集は実施していない。','']
        if diff['changeHunks']:
            out += ['|Miki側行|Legacy側行|Miki側差分|Legacy側差分|','|---:|---:|---|---|']
            for h in diff['changeHunks'][:6]:
                out.append(f"|{h['mikiLines'][0]}–{h['mikiLines'][1]}|{h['servicesLines'][0]}–{h['servicesLines'][1]}|{h['mikiExcerpt'].replace('|','/')}|{h['servicesExcerpt'].replace('|','/')}|")
            out.append('')
        out += ['**Miki側直接import元（最大12件）**', '']
        for edge in p['staticImporterPaths']['miki'][:12]:
            used=', '.join(f"{x['name']}×{x['occurrenceCount']}" for x in edge['usedExports']) or '使用箇所を静的に拾えず'
            out.append(f"- `{edge['path']}:{edge['line']}` ({edge['kind']}) — {used}")
        if len(p['staticImporterPaths']['miki'])>12: out.append(f"- 他{len(p['staticImporterPaths']['miki'])-12}件（JSONに全件）")
        out += ['', '**Legacy側直接import元（最大12件）**','']
        for edge in p['staticImporterPaths']['services'][:12]:
            used=', '.join(f"{x['name']}×{x['occurrenceCount']}" for x in edge['usedExports']) or '使用箇所を静的に拾えず'
            out.append(f"- `{edge['path']}:{edge['line']}` ({edge['kind']}) — {used}")
        if len(p['staticImporterPaths']['services'])>12: out.append(f"- 他{len(p['staticImporterPaths']['services'])-12}件（JSONに全件）")
        out.append('')
    out += ['## 4. 前回から引き継いだ監査', '',
      'P287の機能分類、全ファイル関係、全138組のsrc/miki対src/services同名比較、全同名グループ、バイト一致グループ、正規化ソース候補をそのまま保持。P288はその上に37組のソースレベル詳細監査を追加した。',
      '', '## 5. Interpretation safeguards','',
      '- 同名・高い文字列類似度は責務重複候補であり、意味論の同一性やruntime呼出を証明しない。',
      '- import除外後の本文一致も、import先のsingleton/state identityや副作用の一致を保証しない。',
      '- 同じ永続化キーを二つの独立クラス/インスタンスが使うと、メモリ状態の分裂や上書き競合が発生し得る。',
      '- 差分表の行番号はimport文除外後の本文を基準とする。実ファイルの元行番号とは一致しない場合がある。',
      '- P288のAuthorityは推奨配置。コードを統合/リダイレクトする前に、移行先に固有挙動を移植し、対象callerと回帰テストを確認する。',
      '- GitHub main、CI、build、APK、実機E2Eは未確認。','',
      '## 6. 全ファイル台帳','',
      '| ID | Path | Functional primary | Functional tags | Domain/category | Artifact | Role | Confidence | Authority | Importers | Dependencies | Duplicate groups | Purpose |',
      '|---|---|---|---|---|---|---|---|---|---:|---:|---|---|']
    for r in d['records']:
        c=r.get('capabilityClassification',{}); f=r.get('functionalCapability',{}); du=r.get('duplicateAudit',{})
        tags=', '.join(f.get('functionalCapabilityTags',[])[:8])
        groups=', '.join(du.get('groupIds',[]))
        purpose=' '.join((r.get('purpose') or '').split()).replace('|','/').replace('`','')[:280]
        authority=r.get('capabilityClassification',{}).get('authorityCandidatePath') or '—'
        out.append('| '+' | '.join([
            r.get('id',''), '`'+r.get('path','')+'`', f.get('primaryFunctionalCapability','—'), tags or '—',
            (c.get('architectureDomain') or '—')+'/'+(c.get('capabilityCategory') or '—'), c.get('artifactKind') or '—', c.get('implementationRole') or '—',
            c.get('classificationConfidence','—'), '`'+authority+'`' if authority!='—' else '—',
            str(len(r.get('staticImporters',[]))), str(len(r.get('staticDependencies',[]))), groups or '—', purpose
        ])+' |')
    return '\n'.join(out)+'\n'

if __name__=='__main__': main()
