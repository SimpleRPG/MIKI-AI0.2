import { ComponentTxtPackage } from '../types';
import { componentRegistryService } from './componentRegistryService';
import { storageService } from './storageService';
import { systemLogger } from './systemLogger';
import { improvementStaticGuardService } from './improvementStaticGuardService';

export type ImprovementCandidateStatus = 'DRAFT' | 'ANALYZED' | 'TESTING' | 'ADOPTED' | 'REJECTED';

export interface ComponentImprovementCandidate {
  candidate_id: string;
  base_component_id: string;
  candidate_component_id: string;
  base_version: string;
  base_implementation_hash: string;
  candidate_implementation_hash: string;
  change_reason: string;
  diff_summary: string;
  changed_lines: number;
  status: ImprovementCandidateStatus;
  created_at: number;
  updated_at: number;
}

/**
 * 既存Componentを直接書き換えず、改善版を一時Componentとして管理する境界。
 * このサービス自身はコードを生成・実行・VERIFIED化しない。
 */
export class ComponentImprovementCandidateService {
  private static instance: ComponentImprovementCandidateService;
  private readonly storageKey = 'miki_component_improvement_candidates_v1';
  private candidates = new Map<string, ComponentImprovementCandidate>();
  private constructor() { this.load(); }
  public static getInstance() {
    return this.instance || (this.instance = new ComponentImprovementCandidateService());
  }

  public create(baseComponentId: string, implementationTxt: string, reason: string): ComponentImprovementCandidate {
    const base = componentRegistryService.getComponent(baseComponentId);
    if (!base) throw new Error(`基底Componentが存在しません: ${baseComponentId}`);
    if (!implementationTxt.trim()) throw new Error('改善版implementation_txtが空です。');
    if (implementationTxt.trim() === base.implementation_txt.trim()) throw new Error('改善前後の実装が同一です。');
    const guard = improvementStaticGuardService.inspect(base, implementationTxt);
    if (!guard.passed) throw new Error(`静的安全検査に不合格です: ${guard.issues.filter(i => i.severity === 'ERROR').map(i => i.code).join(',')}`);

    const candidateHash = this.hash(implementationTxt.trim());
    const now = Date.now();
    const candidateComponentId = `${baseComponentId}.__candidate_${candidateHash}`;
    const candidate: ComponentImprovementCandidate = {
      candidate_id: `CIC-${this.hash(`${baseComponentId}|${candidateHash}|${now}`)}`,
      base_component_id: baseComponentId,
      candidate_component_id: candidateComponentId,
      base_version: base.version,
      base_implementation_hash: base.implementation_hash,
      candidate_implementation_hash: candidateHash,
      change_reason: reason,
      diff_summary: this.diffSummary(base.implementation_txt, implementationTxt),
      changed_lines: this.changedLines(base.implementation_txt, implementationTxt),
      status: 'DRAFT',
      created_at: now,
      updated_at: now,
    };

    const shadow: ComponentTxtPackage = {
      ...base,
      component_id: candidateComponentId,
      version: `${base.version}-candidate.${candidateHash.slice(-8)}`,
      status: 'ANALYZED',
      implementation_txt: implementationTxt,
      implementation_hash: candidateHash,
      validation_hash: '',
      success_count: 0,
      failure_count: 0,
      history_txt: `${base.history_txt || ''}\nIMPROVEMENT_CANDIDATE: ${candidate.candidate_id}\nBASE_HASH: ${base.implementation_hash}\nREASON: ${reason}`.trim(),
      updated_at: now,
    };
    componentRegistryService.registerComponent(shadow);
    candidate.status = 'ANALYZED';
    this.candidates.set(candidate.candidate_id, candidate);
    this.save();
    systemLogger.info('SELF_IMPROVEMENT', `🧪 [Candidate] ${baseComponentId} -> ${candidateComponentId}`);
    return candidate;
  }

  public get(candidateId: string) { return this.candidates.get(candidateId); }
  public list() { return Array.from(this.candidates.values()).sort((a,b)=>b.created_at-a.created_at); }

  public markTesting(candidateId: string) { return this.mark(candidateId, 'TESTING'); }
  public markRolledBack(candidateId: string, reason?: string) {
    const c = this.candidates.get(candidateId); if (!c) return undefined;
    c.status = 'REJECTED'; c.updated_at = Date.now();
    if (reason) c.diff_summary += `\nROLLBACK_REASON: ${reason}`;
    this.save(); return c;
  }

  public markRejected(candidateId: string, reason?: string) {
    const c = this.candidates.get(candidateId); if (!c) return undefined;
    c.status = 'REJECTED'; c.updated_at = Date.now();
    if (reason) c.diff_summary += `\nREJECT_REASON: ${reason}`;
    this.save(); return c;
  }

  /** Limited/Canary開始時に呼ぶ。正式VERIFIEDにはせず、基底IDへ候補版を反映する。 */
  public commitForLimited(candidateId: string): { accepted: boolean; reason: string } {
    const c = this.candidates.get(candidateId);
    if (!c) return { accepted: false, reason: '改善候補が存在しません。' };
    const candidate = componentRegistryService.getComponent(c.candidate_component_id);
    const base = componentRegistryService.getComponent(c.base_component_id);
    if (!candidate || !base) return { accepted: false, reason: '候補または基底Componentが存在しません。' };
    if (candidate.implementation_hash !== c.candidate_implementation_hash) return { accepted: false, reason: '候補実装hashが登録時と一致しません。' };
    if (base.implementation_hash !== c.base_implementation_hash) return { accepted: false, reason: '基底Componentが候補作成後に変更されています。再候補化が必要です。' };
    if (candidate.status !== 'DEVICE_TESTED' && candidate.status !== 'ANALYZED') return { accepted: false, reason: `候補状態=${candidate.status}。ANALYZED/DEVICE_TESTEDが必要です。` };

    const next: ComponentTxtPackage = {
      ...candidate,
      component_id: c.base_component_id,
      version: this.bumpVersion(base.version),
      status: 'DEVICE_TESTED',
      history_txt: `${base.history_txt || ''}\nADOPTED_CANDIDATE: ${c.candidate_id}\nPREVIOUS_HASH: ${base.implementation_hash}\nNEW_HASH: ${candidate.implementation_hash}`.trim(),
      created_at: base.created_at,
      updated_at: Date.now(),
    };
    componentRegistryService.registerComponent(next);
    // 採用後も候補IDを正式能力として残さない。監査用履歴だけ保持する。
    componentRegistryService.registerComponent({
      ...candidate,
      status: 'DEPRECATED',
      history_txt: `${candidate.history_txt || ''}\nADOPTED_TO: ${c.base_component_id}\nDEPRECATED_AT: ${new Date().toISOString()}`.trim(),
      updated_at: Date.now(),
    });
    c.status = 'ADOPTED'; c.updated_at = Date.now(); this.save();
    return { accepted: true, reason: `改善候補 ${c.candidate_id} を ${c.base_component_id} のLIMITED/Canary版として反映しました。正式VERIFIEDはCanary通過後に行います。` };
  }

  /** 互換用。正式採用はCanary通過後にSafeImprovementPipelineから実行する。 */
  public commitAdopted(candidateId: string): { accepted: boolean; reason: string } {
    return this.commitForLimited(candidateId);
  }

  private mark(id: string, status: ImprovementCandidateStatus) { const c=this.candidates.get(id); if (!c) return undefined; c.status=status; c.updated_at=Date.now(); this.save(); return c; }
  private save(){ try{storageService.setItem(this.storageKey, JSON.stringify(this.list().slice(0,200)));}catch{} }
  private load(){ try{const raw=storageService.getItem(this.storageKey); if(raw) for(const c of JSON.parse(raw) as ComponentImprovementCandidate[]) this.candidates.set(c.candidate_id,c);}catch{} }
  private hash(raw:string){let h=2166136261;for(let i=0;i<raw.length;i++){h^=raw.charCodeAt(i);h=Math.imul(h,16777619);}return (h>>>0).toString(16).padStart(8,'0');}
  private changedLines(a:string,b:string){const aa=a.split(/\r?\n/),bb=b.split(/\r?\n/);const n=Math.max(aa.length,bb.length);let changed=0;for(let i=0;i<n;i++)if((aa[i]||'')!==(bb[i]||''))changed++;return changed;}
  private diffSummary(a:string,b:string){const aa=a.split(/\r?\n/),bb=b.split(/\r?\n/);const n=Math.max(aa.length,bb.length);const out:string[]=[];for(let i=0;i<n&&out.length<12;i++)if((aa[i]||'')!==(bb[i]||''))out.push(`L${i+1}: ${aa[i]||'∅'} -> ${bb[i]||'∅'}`);return out.length?out.join('\n'):'差分なし';}
  private bumpVersion(v:string){const m=v.match(/^(\d+)\.(\d+)\.(\d+)/);if(!m)return `${v}.improved`;return `${m[1]}.${m[2]}.${Number(m[3])+1}`;}
}
export const componentImprovementCandidateService = ComponentImprovementCandidateService.getInstance();
