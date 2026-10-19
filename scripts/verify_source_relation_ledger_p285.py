#!/usr/bin/env python3
from pathlib import Path
import hashlib,json
ROOT=Path(__file__).resolve().parents[1]
J=ROOT/'SOURCE_FILE_RELATION_LEDGER_P285.json'; M=ROOT/'SOURCE_FILE_RELATION_LEDGER_P285.md'
EX={'node_modules','.git','dist','build','coverage'}
def sha(b): return hashlib.sha256(b).hexdigest()
def main():
 d=json.loads(J.read_text(encoding='utf-8')); rs=d['records']
 if d.get('revision')!='P285' or len(rs)!=1789: raise SystemExit('COUNT_OR_REVISION_INVALID')
 if [r['id'] for r in rs] != [f'F{i:03d}' for i in range(1,1790)]: raise SystemExit('ID_SEQUENCE_INVALID')
 if len({r['path'] for r in rs})!=1789: raise SystemExit('DUPLICATE_PATH')
 for r in rs:
  p=ROOT/r['path']
  if not p.is_file(): raise SystemExit('MISSING:'+r['path'])
  if sha(p.read_bytes())!=r['sourceFacts']['sha256']: raise SystemExit('HASH_MISMATCH:'+r['path'])
 if M.read_text(encoding='utf-8').count('| F')<1789: raise SystemExit('MARKDOWN_INCOMPLETE')
 print(json.dumps({'status':'PASS','records':len(rs),'uniquePaths':len({r['path'] for r in rs}),'sha256Checked':len(rs),'remainingUnrecorded':0},ensure_ascii=False))
if __name__=='__main__': main()
