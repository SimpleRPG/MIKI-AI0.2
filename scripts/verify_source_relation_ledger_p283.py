#!/usr/bin/env python3
"""Validate the unified P284 1500-record repository-file relation ledger."""
from __future__ import annotations
import hashlib, json, re
from collections import defaultdict, deque
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
JSON_PATH=ROOT/'SOURCE_FILE_RELATION_LEDGER_P284.json'
MD_PATH=ROOT/'SOURCE_FILE_RELATION_LEDGER_P284.md'
SOURCE_EXTS={'.ts','.tsx','.js','.jsx','.mjs','.cjs','.java','.kt','.rs','.py'}
IGNORE_PARTS={'node_modules','.git','dist','build','coverage'}
ROOTS=['src/main.tsx','src/App.tsx','src/miki/core/services/coreOrchestratorService.ts','src/miki/core/services/domainIntegrationBootstrapService.ts']
def sha(raw): return hashlib.sha256(raw).hexdigest()
def rel(p): return p.relative_to(ROOT).as_posix()
ALL=sorted((p for p in ROOT.rglob('*') if p.is_file() and p.suffix in SOURCE_EXTS and not any(x in IGNORE_PARTS for x in p.parts)), key=lambda p:p.as_posix())
BY_REL={rel(p):p for p in ALL}
def resolve_spec(src,spec):
    if not spec.startswith('.'): return None
    base=(src.parent/spec).resolve(); cands=[base]
    suffix_map={'.js':['.ts','.tsx','.js','.jsx','.mjs','.cjs'],'.jsx':['.tsx','.jsx'],'.mjs':['.mts','.mjs','.ts','.js'],'.cjs':['.cts','.cjs','.ts','.js']}
    if base.suffix in suffix_map: cands.extend(base.with_suffix(s) for s in suffix_map[base.suffix])
    else: cands.extend(base.with_suffix(s) for s in ['.ts','.tsx','.js','.jsx','.mjs','.cjs','.java','.kt','.rs','.py'])
    cands.extend(base/('index'+s) for s in ['.ts','.tsx','.js','.jsx','.mjs','.cjs'])
    for c in cands:
        try: rp=c.relative_to(ROOT).as_posix()
        except ValueError: continue
        if rp in BY_REL and c.is_file(): return rp
    return None
def parse_imports(path):
    s=path.read_text(encoding='utf-8',errors='replace'); found={}
    patterns=[(re.compile(r'\bfrom\s*[\'\"]([^\'\"]+)[\'\"]'),'module_clause'),(re.compile(r'\bimport\s*\(\s*[\'\"]([^\'\"]+)[\'\"]\s*\)'),'dynamic_import'),(re.compile(r'^\s*import\s*[\'\"]([^\'\"]+)[\'\"]',re.M),'side_effect')]
    for pat,default in patterns:
        for m in pat.finditer(s):
            spec=m.group(1); start=s.rfind('\n',0,m.start())+1; prefix=s[start:m.start()]; kind=default
            if default=='module_clause':
                if re.search(r'\bexport\b',prefix): kind='reexport'
                elif re.search(r'\bimport\b',prefix): kind='import'
            found[(spec,kind)]={'specifier':spec,'kind':kind,'line':s.count('\n',0,m.start())+1,'resolvedPath':resolve_spec(path,spec)}
    return sorted(found.values(),key=lambda x:(x['line'],x['specifier'],x['kind']))
IMPORTS={path:parse_imports(p) for path,p in BY_REL.items()}; IMPORTERS=defaultdict(list); EDGES=[]
for importer,rows in IMPORTS.items():
    for row in rows:
        if row['resolvedPath']:
            e={'from':importer,'to':row['resolvedPath'],'specifier':row['specifier'],'kind':row['kind'],'line':row['line']}; EDGES.append(e); IMPORTERS[row['resolvedPath']].append(e)
REACHABLE=set(); q=deque(x for x in ROOTS if x in BY_REL)
while q:
    cur=q.popleft()
    if cur in REACHABLE: continue
    REACHABLE.add(cur); q.extend(r['resolvedPath'] for r in IMPORTS.get(cur,[]) if r.get('resolvedPath') and r['resolvedPath'] not in REACHABLE)
def main():
    data=json.loads(JSON_PATH.read_text(encoding='utf-8')); records=data.get('records')
    if data.get('revision')!='P284' or not isinstance(records,list) or len(records)!=1500: raise SystemExit('LEDGER_COUNT_OR_REVISION_INVALID')
    if [r.get('id') for r in records] != [f'F{i:03d}' for i in range(1,1501)]: raise SystemExit('LEDGER_ID_SEQUENCE_INVALID')
    paths=[r.get('path') for r in records]; selected=set(paths)
    if len(selected)!=1500: raise SystemExit('LEDGER_PATH_DUPLICATE')
    all_repo={p.relative_to(ROOT).as_posix():p for p in ROOT.rglob('*') if p.is_file() and not any(x in IGNORE_PARTS for x in p.parts)}
    for r in records:
        path=r['path']
        if path not in all_repo: raise SystemExit(f'LEDGER_FILE_MISSING: {r["id"]} {path}')
        if sha(all_repo[path].read_bytes()) != r.get('sourceFacts',{}).get('sha256'): raise SystemExit(f'LEDGER_FILE_HASH_MISMATCH: {r["id"]} {path}')
        if path in BY_REL:
            if r.get('reachableFromCoreUiRootsByResolvedLocalImports') != (path in REACHABLE): raise SystemExit(f'LEDGER_REACHABILITY_MISMATCH: {r["id"]} {path}')
            deps=[]
            for row in IMPORTS.get(path,[]):
                if row.get('resolvedPath') and row['resolvedPath'] not in deps: deps.append(row['resolvedPath'])
            if r.get('staticDependencies') != deps: raise SystemExit(f'LEDGER_DEPENDENCY_MISMATCH: {r["id"]} {path}')
            callers=[{'path':e['from'],'kind':e['kind'],'line':e['line'],'specifier':e['specifier']} for e in IMPORTERS.get(path,[])]
            if r.get('staticImporters') != callers: raise SystemExit(f'LEDGER_IMPORTER_MISMATCH: {r["id"]} {path}')
        else:
            if r.get('staticDependencies') or r.get('staticImporters'): raise SystemExit(f'NON_SOURCE_HAS_MODULE_EDGES: {r["id"]} {path}')
    touching=[e for e in EDGES if e['from'] in selected or e['to'] in selected]
    source_selected=sum(p in BY_REL for p in paths)
    expected={'repositorySourceFilesScanned':len(ALL),'repositoryFilesScannedAtSelection':data['counts']['repositoryFilesScannedAtSelection'],'allResolvedLocalImportEdges':len(EDGES),'edgesTouchingSelectedFiles':len(touching),'selectedSourceFilesReachableFromCoreUiRootsByResolvedLocalImports':sum(p in REACHABLE for p in paths if p in BY_REL),'uniquePaths':len(selected),'selectedFileCount':len(records),'sourceRecords':source_selected,'nonSourceArtifactRecords':len(records)-source_selected,'recordIdRange':'F001-F1500','selectedSourceFilesWithSameBasenamePeers':sum(bool(r.get('duplicateBasenameReview',{}).get('sameBasenamePeers')) for r in records if r['path'] in BY_REL)}
    for k,v in expected.items():
        if data.get('counts',{}).get(k)!=v: raise SystemExit(f'LEDGER_COUNT_MISMATCH: {k} expected={v} stored={data.get("counts",{}).get(k)}')
    if data.get('edgesTouchingSelectedFiles')!=touching: raise SystemExit('LEDGER_EDGE_LIST_MISMATCH')
    md=MD_PATH.read_text(encoding='utf-8')
    if md.count('| F')<1500 or 'F001-F1500' not in md: raise SystemExit('MARKDOWN_LEDGER_INCOMPLETE')
    print(json.dumps({'status':'PASS','records':len(records),'uniquePaths':len(selected),'sha256Checked':len(records),**expected},ensure_ascii=False))
if __name__=='__main__': main()
