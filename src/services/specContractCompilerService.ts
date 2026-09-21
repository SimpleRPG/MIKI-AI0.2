/**
 * 設計思想 第159章/130章: 仕様最小化・規範コンパイル。
 * 原文を削除せず、実行時に必要な「追跡可能な最小契約」へ射影する。
 * 生成モデルには依存しない。spec hash が変われば契約は自動的に無効化される。
 */
import fs from 'fs';
import path from 'path';
import { systemLogger } from './systemLogger';
import { storageService } from './storageService';

export type ContractStatus = 'VALID' | 'INVALIDATED' | 'BLOCKED_SPEC_CONFLICT';
export type Norm = 'MUST' | 'MUST_NOT' | 'SHOULD' | 'MAY' | 'UNKNOWN';
export interface SpecContractClause {
  requirementId: string;
  sourceChapter: number;
  sourceLine: number;
  norm: Norm;
  text: string;
  purpose: string;
  conditions: string[];
  dependencies: string[];
  prohibitions: string[];
  acceptanceEvidence: string[];
  supersedes?: string;
}
export interface SpecContract {
  contractId: string;
  sourcePath: string;
  sourceHash: string;
  compiledAt: number;
  status: ContractStatus;
  clauses: SpecContractClause[];
}

const KEY = 'miki_spec_contract_v1';
const DEFAULT_SPEC = path.resolve(process.cwd(), 'MIKI_AI_MASTER_SPECIFICATION_v5_0.txt');

function hash(raw: string): string { let h = 2166136261; for (let i=0;i<raw.length;i++){h ^= raw.charCodeAt(i); h=Math.imul(h,16777619);} return (h>>>0).toString(16).padStart(8,'0'); }
function normOf(text: string): Norm {
  if (/禁止|してはなら|MUST NOT|DO NOT/i.test(text)) return 'MUST_NOT';
  if (/必須|必ず|MUST|絶対/i.test(text)) return 'MUST';
  if (/推奨|望ま|SHOULD/i.test(text)) return 'SHOULD';
  if (/許可|可能|MAY/i.test(text)) return 'MAY';
  return 'UNKNOWN';
}
function chapterOf(line: string, current: number): number {
  const m = line.match(/(?:第\s*|Chapter\s+)(\d+)(?:章)?/i); return m ? Number(m[1]) : current;
}

export class SpecContractCompilerService {
  private contract: SpecContract | null = null;
  constructor() { this.load(); }
  private load() { try { const raw = storageService.getItem(KEY); if (raw) this.contract = JSON.parse(raw); } catch { this.contract = null; } }
  private save() { try { storageService.setItem(KEY, JSON.stringify(this.contract)); } catch {} }

  public compile(specPath = DEFAULT_SPEC): SpecContract {
    const source = fs.existsSync(specPath) ? fs.readFileSync(specPath, 'utf8') : '';
    if (!source) throw new Error(`specification source not found: ${specPath}`);
    const sourceHash = hash(source);
    if (this.contract && this.contract.sourceHash === sourceHash && this.contract.status === 'VALID') return this.contract;
    const lines = source.split(/\r?\n/);
    let chapter = 0;
    const clauses: SpecContractClause[] = [];
    for (let i=0;i<lines.length;i++) {
      const line = lines[i].trim(); if (!line) continue;
      chapter = chapterOf(line, chapter);
      const n = normOf(line);
      if (n === 'UNKNOWN' && !/[：:]/.test(line)) continue;
      const requirementId = `REQ-${chapter}-${i+1}-${hash(line).slice(0,6)}`;
      clauses.push({ requirementId, sourceChapter: chapter, sourceLine: i+1, norm: n, text: line.slice(0,500), purpose: this.purpose(line), conditions: this.extract(line, /(?:条件|場合|when|if)[:：]?\s*(.+)/i), dependencies: this.extract(line, /(?:依存|依存関係|depends? on)[:：]?\s*(.+)/i), prohibitions: n === 'MUST_NOT' ? [line.slice(0,500)] : [], acceptanceEvidence: this.acceptance(line) });
    }
    this.contract = { contractId: `SPEC-${sourceHash}`, sourcePath: specPath, sourceHash, compiledAt: Date.now(), status: 'VALID', clauses: clauses.slice(0,5000) };
    this.save();
    systemLogger.info('SELF_IMPROVEMENT', `[第159章 仕様契約コンパイラ] ${clauses.length} clauses / hash=${sourceHash}`);
    return this.contract;
  }
  private purpose(text:string):string { return /安全|保護|privacy|rollback|禁止/i.test(text) ? 'safety/invariant' : /性能|高速|容量|cache/i.test(text) ? 'performance' : /検証|test|回帰|証拠/i.test(text) ? 'verification' : 'behavior'; }
  private extract(text:string, re:RegExp):string[] { const m=text.match(re); return m ? [m[1].slice(0,300)] : []; }
  private acceptance(text:string):string[] { const a:string[]=[]; if (/検証|テスト|回帰|証拠|再現/i.test(text)) a.push('deterministic verification evidence'); if (/禁止|保護/i.test(text)) a.push('negative/prohibition check'); if (!a.length) a.push('source traceability + regression check'); return a; }
  public getContract(): SpecContract | null { return this.contract ? JSON.parse(JSON.stringify(this.contract)) : null; }
  public audit(specPath = DEFAULT_SPEC): { valid:boolean; currentHash:string|null; contractHash:string|null; invalidated:boolean; clauseCount:number } {
    if (!fs.existsSync(specPath)) return {valid:false,currentHash:null,contractHash:this.contract?.sourceHash||null,invalidated:false,clauseCount:this.contract?.clauses.length||0};
    const currentHash=hash(fs.readFileSync(specPath,'utf8')); const invalidated=!!this.contract && this.contract.sourceHash!==currentHash;
    if (invalidated && this.contract) { this.contract.status='INVALIDATED'; this.save(); }
    return {valid:!invalidated, currentHash, contractHash:this.contract?.sourceHash||null, invalidated, clauseCount:this.contract?.clauses.length||0};
  }
}
export const specContractCompilerService = new SpecContractCompilerService();
