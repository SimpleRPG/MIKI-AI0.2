#!/usr/bin/env python3
"""Read-only verification for P288 ledger + source-level duplicate authority audit."""
from __future__ import annotations
import hashlib
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LEDGER = ROOT / 'SOURCE_FILE_RELATION_LEDGER_P288.json'
MARKDOWN = ROOT / 'SOURCE_FILE_RELATION_LEDGER_P288.md'
DESIGN = ROOT / 'MIKI-AI0.2_統合設計書_正本.txt'

def require(test: bool, message: str) -> None:
    if not test:
        raise SystemExit('FAIL: ' + message)

def main() -> None:
    data=json.loads(LEDGER.read_text(encoding='utf-8'))
    md=MARKDOWN.read_text(encoding='utf-8')
    require(data.get('revision')=='P288','revision must be P288')
    records=data.get('records',[])
    require(len(records)==1789,'expected 1789 records')
    ids=[r.get('id') for r in records]
    paths=[r.get('path') for r in records]
    require(ids==[f'F{i:03d}' if i<1000 else f'F{i}' for i in range(1,1790)],'record IDs must be continuous F001-F1789')
    require(len(paths)==len(set(paths)),'duplicate paths exist')
    checked=0
    for record in records:
        path=ROOT/record['path']
        require(path.is_file(),f"missing baseline file: {record['path']}")
        expected=record.get('sourceFacts',{}).get('sha256')
        require(bool(expected),f"missing SHA-256: {record['path']}")
        actual=hashlib.sha256(path.read_bytes()).hexdigest()
        require(actual==expected,f"SHA-256 mismatch: {record['path']}")
        checked+=1
    require('正本Revision：2026-10-18-P288' in DESIGN.read_text(encoding='utf-8'),'canonical design revision is not P288')
    audit=data.get('duplicateAudit',{}).get('authorityReviewP288',{})
    pairs=audit.get('pairs',[])
    require(len(pairs)==37,'expected 37 detailed P1 pair audits')
    require(audit.get('counts',{}).get('reviewedPairs')==37,'authority audit counter does not match')
    seen=set()
    for pair in pairs:
        require(pair['pairId'] not in seen,f"duplicate pair audit: {pair['pairId']}")
        seen.add(pair['pairId'])
        for key in ('mikiPath','servicesPath'):
            require((ROOT/pair[key]).is_file(),f"missing audited pair source: {pair[key]}")
        require(pair['authorityFinding'].get('automaticMergeApproved') is False,'automatic merge must remain blocked')
        require(pair['authorityFinding'].get('runtimeTestsPerformed') is False,'runtime test status must remain honest')
        for side in ('miki','services'):
            for edge in pair['staticImporterPaths'][side]:
                require((ROOT/edge['path']).is_file(),f"missing static importer: {edge['path']}")
    md_ids=re.findall(r'^\|\s*(F\d+)\s*\|',md,re.M)
    require(len(md_ids)==1789,'Markdown must contain exactly 1789 ledger rows')
    require(md_ids==ids,'Markdown row IDs/order differ from JSON')
    require('37組' in md and '本文/契約差分候補12組' in md,'Markdown audit summary missing')
    print(json.dumps({
      'status':'PASS','revision':'P288','records':len(records),'uniquePaths':len(set(paths)),
      'sha256Verified':checked,'p1PairsAudited':len(pairs),'markdownRows':len(md_ids),
      'bodyIdenticalAfterImportRemoval':audit['counts']['identicalBodyAfterRemovingImports'],
      'bodyOrContractDivergenceCandidates':audit['counts']['bodyOrContractDivergenceCandidates'],
      'pairsWithSharedPersistentKeyValues':audit['counts']['pairsWithSharedPersistentKeyValues'],
      'pairsWithPotentialStateDivergence':audit['counts']['pairsWithPotentialStateDivergence'],
      'runtimeFilesChanged':False,'githubMainUpdated':False
    },ensure_ascii=False,indent=2))

if __name__=='__main__': main()
