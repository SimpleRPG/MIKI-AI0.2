#!/usr/bin/env python3
"""Verify the P287 ledger's coverage, identity, categories, duplicate evidence, and baseline hashes."""
from pathlib import Path
from collections import Counter
import hashlib, json, re, sys
ROOT=Path(__file__).resolve().parents[1]
JSON=ROOT/'SOURCE_FILE_RELATION_LEDGER_P287.json'
MD=ROOT/'SOURCE_FILE_RELATION_LEDGER_P287.md'
DESIGN=ROOT/'MIKI-AI0.2_統合設計書_正本.txt'
PREV=ROOT/'SOURCE_FILE_RELATION_LEDGER_P286.json'
def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()
def fail(s): raise SystemExit('VERIFY_FAILED:'+s)
def main():
 d=json.loads(JSON.read_text(encoding='utf-8')); records=d.get('records',[])
 if d.get('revision')!='P287': fail('revision')
 if len(records)!=1789: fail('record_count')
 ids=[int(re.search(r'(\d+)$',r.get('id','')).group(1)) for r in records]
 if ids!=list(range(1,1790)): fail('id_sequence')
 paths=[r.get('path') for r in records]
 if len(paths)!=len(set(paths)): fail('duplicate_paths')
 prev=json.loads(PREV.read_text(encoding='utf-8')); old={r['path']:r for r in prev['records']}
 if set(paths)!=set(old): fail('baseline_path_set_changed')
 missing=[]; hash_mismatch=[]; missing_fields=[]
 for r in records:
  p=ROOT/r['path']
  if not p.is_file(): missing.append(r['path']); continue
  if sha(p)!=r.get('sourceFacts',{}).get('sha256'): hash_mismatch.append(r['path'])
  for k in ('capabilityClassification','functionalCapability','duplicateAudit'):
   if not isinstance(r.get(k),dict): missing_fields.append((r['path'],k))
  f=r.get('functionalCapability',{})
  for k in ('primaryFunctionalCapability','functionalCapabilityTags','functionalClassificationConfidence','functionalClassificationEvidence'):
   if k not in f: missing_fields.append((r['path'],'functionalCapability.'+k))
 if missing: fail('missing_files:'+str(missing[:3]))
 if hash_mismatch: fail('source_hash_mismatch:'+str(hash_mismatch[:3]))
 if missing_fields: fail('missing_classification_fields:'+str(missing_fields[:3]))
 cats=Counter(r['capabilityClassification']['capabilityCategory'] for r in records)
 if dict(sorted(cats.items()))!=d['capabilityTaxonomy']['categoryCounts']: fail('architecture_category_counts')
 funcs=Counter(r['functionalCapability']['primaryFunctionalCapability'] for r in records)
 if dict(sorted(funcs.items()))!=d['capabilityFunctionalTaxonomy']['primaryCapabilityCounts']: fail('functional_counts')
 tags=Counter(tag for r in records for tag in r['functionalCapability']['functionalCapabilityTags'])
 if dict(sorted(tags.items()))!=d['capabilityFunctionalTaxonomy']['tagCounts']: fail('functional_tag_counts')
 conf=Counter(r['functionalCapability']['functionalClassificationConfidence'] for r in records)
 if dict(sorted(conf.items()))!=d['capabilityFunctionalTaxonomy']['confidenceCounts']: fail('functional_confidence_counts')
 da=d['duplicateAudit']; dc=da['counts']; pairs=da['srcMikiVsSrcServicesPairs']
 if len(da['byteIdenticalGroups'])!=dc['byteIdenticalGroupCount']: fail('byte_group_count')
 if len(da['normalizedSourceGroups'])!=dc['normalizedSourceDuplicateGroupCount']: fail('normalized_group_count')
 if len(da['sameBasenameGroups'])!=dc['sameBasenameGroupCount']: fail('basename_group_count')
 if len(pairs)!=dc['srcMikiVsSrcServicesPairCount']: fail('cross_layer_pair_count')
 statuses=Counter(p['status'] for p in pairs)
 if dict(sorted(statuses.items()))!=dc['srcMikiVsSrcServicesPairStatuses']: fail('pair_status_counts')
 p1=[p for p in pairs if p['status']=='HIGH_SIMILARITY_IMPLEMENTATION_CANDIDATE' and p.get('mikiReachableFromCoreUiRoots') and p.get('servicesReachableFromCoreUiRoots')]
 if len(p1)!=dc['highSimilarityBothStaticallyReachableCount'] or len(da['priorityOneReviewQueue'])!=len(p1): fail('p1_queue_count')
 design_record=next((r for r in records if r['path']==str(DESIGN.relative_to(ROOT))),None)
 if not design_record or sha(DESIGN)!=design_record['sourceFacts']['sha256']: fail('design_hash')
 md=MD.read_text(encoding='utf-8')
 if md.count('| F')<1789: fail('markdown_record_rows')
 if 'P287 統合マスター（1789件）' not in md: fail('markdown_heading')
 if '正本Revision：2026-10-18-P287' not in DESIGN.read_text(encoding='utf-8'): fail('design_revision')
 print(json.dumps({'status':'PASS','revision':'P287','records':len(records),'uniquePaths':len(set(paths)),'filesMissing':0,'sourceHashMismatches':0,'architectureCategories':len(cats),'functionalCategories':len(funcs),'functionalConfidence':dict(sorted(conf.items())),'byteIdenticalGroups':len(da['byteIdenticalGroups']),'normalizedSourceGroups':len(da['normalizedSourceGroups']),'sameBasenameGroups':len(da['sameBasenameGroups']),'sameBasenameMembers':dc['sameBasenameMemberRecordCount'],'crossLayerPairs':len(pairs),'pairStatuses':dict(sorted(statuses.items())),'priorityOnePairs':len(p1),'markdownRecordRows':md.count('| F')},ensure_ascii=False,indent=2))
if __name__=='__main__': main()
