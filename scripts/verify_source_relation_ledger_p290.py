#!/usr/bin/env python3
"""Read-only verifier for the P290 unified source relation ledger."""
from __future__ import annotations
import hashlib, json, re
from collections import defaultdict
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
LEDGER=ROOT/'SOURCE_FILE_RELATION_LEDGER_P290.json'
MARKDOWN=ROOT/'SOURCE_FILE_RELATION_LEDGER_P290.md'
DESIGN=ROOT/'MIKI-AI0.2_統合設計書_正本.txt'
REPORT=ROOT/'SERVICE_AUTHORITY_CONVERGENCE_P290.json'
def require(ok,msg):
    if not ok: raise SystemExit('FAIL: '+msg)
def main():
    d=json.loads(LEDGER.read_text(encoding='utf-8'))
    md=MARKDOWN.read_text(encoding='utf-8')
    report=json.loads(REPORT.read_text(encoding='utf-8'))
    rs=d.get('records',[]); paths=[r.get('path') for r in rs]; ids=[r.get('id') for r in rs]
    require(d.get('revision')=='P290','ledger revision must be P290')
    require(len(rs)==1787,'expected 1,787 repository-path records after excluding generated cache')
    require(ids==[f'F{i:03d}' if i<1000 else f'F{i}' for i in range(1,1788)],'record IDs must be continuous F001-F1787')
    require(len(paths)==len(set(paths)),'duplicate path records')
    require(not any('__pycache__' in Path(x).parts or Path(x).suffix=='.pyc' for x in paths),'generated Python cache must not be inventoried')
    pathset=set(paths); rmap={r['path']:r for r in rs}
    checked=0
    for r in rs:
        p=ROOT/r['path']
        require(p.is_file(),f"missing baseline file: {r['path']}")
        raw=p.read_bytes()
        require(hashlib.sha256(raw).hexdigest()==r.get('sourceFacts',{}).get('sha256'),f"SHA mismatch: {r['path']}")
        require(len(raw.decode('utf-8',errors='replace').splitlines())==r.get('sourceFacts',{}).get('lineCount'),f"line count mismatch: {r['path']}")
        checked+=1
    edges=d.get('edgesTouchingSelectedFiles',[])
    require(len(edges)==d['counts']['allResolvedLocalImportEdges'],'top-level edge count mismatch')
    expected_deps=defaultdict(set); expected_imps=defaultdict(list)
    for e in edges:
        require(e['from'] in pathset and e['to'] in pathset,f"graph edge leaves record set: {e}")
        expected_deps[e['from']].add(e['to'])
        expected_imps[e['to']].append({'path':e['from'],'kind':e.get('kind','import'),'line':int(e.get('line',1)),'specifier':e.get('specifier','')})
    for r in rs:
        p=r['path']
        require(set(r.get('staticDependencies',[]))==expected_deps[p],f'dependency projection mismatch: {p}')
        actual=sorted(r.get('staticImporters',[]),key=lambda x:(x['path'],x['line'],x['specifier']))
        expected=sorted(expected_imps[p],key=lambda x:(x['path'],x['line'],x['specifier']))
        require(actual==expected,f'importer projection mismatch: {p}')
    roots=[p for p in d.get('productionRootsUsedForReachability',[]) if p in pathset]
    seen=set(); stack=list(roots)
    while stack:
        cur=stack.pop()
        if cur in seen: continue
        seen.add(cur); stack.extend(x for x in expected_deps[cur] if x not in seen)
    for r in rs:
        require(bool(r.get('reachableFromCoreUiRootsByResolvedLocalImports'))==(r['path'] in seen),f'reachability mismatch: {r["path"]}')
    pairs=report.get('pairs',[])
    require(len(pairs)==37,'expected 37 current service pairs')
    for pair in pairs:
        legacy,canonical=pair['legacyPath'],pair['canonicalPath']
        require(legacy in rmap and canonical in rmap,'pair absent from ledger')
        text=(ROOT/legacy).read_text(encoding='utf-8')
        spec='../'+canonical[len('src/'):].removesuffix('.ts')
        require(text.strip().endswith(f"export * from '{spec}';"),f'facade is not pure re-export: {legacy}')
        require(rmap[legacy]['staticDependencies']==[canonical],f'facade graph edge mismatch: {legacy}')
        require(rmap[legacy]['capabilityClassification']['implementationRole']=='COMPATIBILITY_RE_EXPORT_FACADE',f'facade role mismatch: {legacy}')
    md_ids=re.findall(r'^\|\s*(F\d+)\s*\|',md,re.M)
    require(len(md_ids)==len(rs) and md_ids==ids,'Markdown rows do not match JSON records')
    design=DESIGN.read_text(encoding='utf-8')
    require('正本Revision：2026-10-19-P290' in design,'design revision does not match P290')
    require('【2026-10-19-P290 重複サービスの実装Authority統合】' in design,'P290 design authority section missing')
    require(d['duplicateAuditP290Current']['counts']['highPriorityCurrentBodyDuplicatePairs']==0,'high-priority pair body duplicates remain')
    print(json.dumps({'status':'PASS','revision':'P290','records':len(rs),'sha256Verified':checked,'uniquePaths':len(set(paths)),'currentEdges':len(edges),'reachabilityVerified':len(seen),'facadesVerified':len(pairs),'markdownRows':len(md_ids),'duplicatePaths':0},ensure_ascii=False,indent=2))
if __name__=='__main__': main()
