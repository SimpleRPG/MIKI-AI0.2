import { storageService } from './storageService';
import { systemLogger } from './systemLogger';
import { mikiUnifiedLearningContinuumService } from './mikiUnifiedLearningContinuumService';

export type ContractClauseKind = 'PRECONDITION' | 'INVARIANT' | 'POSTCONDITION' | 'PROHIBITION';
export type ContractRefinementStatus = 'PROPOSED' | 'QUARANTINED' | 'VALIDATED';

export interface ContractClause {
  id: string;
  kind: ContractClauseKind;
  text: string;
  source: string;
}

export interface ContractRefinementRecord {
  refinementId: string;
  sourceFailureId: string;
  componentId: string;
  environment: string;
  counterexample: string;
  sourceClaimIds: string[];
  clauses: ContractClause[];
  status: ContractRefinementStatus;
  minimalityScore: number;
  reason: string;
  createdAt: number;
  updatedAt: number;
}

/**
 * 第125/128/142/145/159/163/172章に対応する、反例駆動の契約精錬層。
 * Web知識や失敗をそのまま仕様へ書き込まず、最小の契約候補へ変換する。
 * コード生成・Component直接変更・VERIFIED化は行わない。
 */
export class CounterexampleContractRefinementService {
  private static instance: CounterexampleContractRefinementService;
  private readonly storageKey = 'miki_counterexample_contract_refinement_v1';
  private records: ContractRefinementRecord[] = [];

  private constructor() { this.load(); }
  public static getInstance() {
    return this.instance || (this.instance = new CounterexampleContractRefinementService());
  }

  public refine(params: {
    sourceFailureId: string;
    componentId: string;
    environment: string;
    counterexample: string;
    claimIds?: string[];
    verifiedStatement?: string;
  }): ContractRefinementRecord {
    const source = `${params.counterexample} ${params.verifiedStatement || ''}`.trim();
    const clauses = this.extractMinimalClauses(source);
    const minimalityScore = Math.max(0, Math.min(1, 1 - Math.max(0, clauses.length - 4) * 0.12));
    const unsafe = this.hasOverBroadClause(clauses);
    const status: ContractRefinementStatus = unsafe || clauses.length === 0 ? 'QUARANTINED' : 'PROPOSED';
    const refinementId = `CRR-${this.hash(`${params.sourceFailureId}|${params.componentId}|${params.environment}|${clauses.map(c => c.text).join('|')}`)}`;
    const existing = this.records.find(r => r.refinementId === refinementId);
    if (existing) return { ...existing, clauses: existing.clauses.map(c => ({ ...c })), sourceClaimIds: [...existing.sourceClaimIds] };

    const now = Date.now();
    const record: ContractRefinementRecord = {
      refinementId,
      sourceFailureId: params.sourceFailureId,
      componentId: params.componentId,
      environment: params.environment,
      counterexample: params.counterexample,
      sourceClaimIds: Array.from(new Set(params.claimIds || [])),
      clauses,
      status,
      minimalityScore,
      reason: status === 'QUARANTINED'
        ? '反例から安全な最小契約を確定できないため、仕様へ自動確定せず検疫しました。'
        : '反例を排除する最小契約候補を生成しました。正常系・互換性対照試験を通過するまで確定しません。',
      createdAt: now,
      updatedAt: now,
    };
    this.records.unshift(record);
    this.records = this.records.slice(0, 500);
    this.save();

    mikiUnifiedLearningContinuumService.observe({
      domain: 'system',
      action: status === 'QUARANTINED' ? 'contract_refinement_quarantined' : 'contract_refinement_proposed',
      input: `${params.componentId} ${params.counterexample}`,
      outcome: status === 'QUARANTINED' ? 'FAILURE' : 'SUCCESS',
      verified: false,
      capabilityIds: [params.componentId],
      lesson: `${refinementId}:${status}:clauses=${clauses.length}`,
    });
    systemLogger.info('SELF_IMPROVEMENT', `📐 [ContractRefinement] ${refinementId}: ${status}, clauses=${clauses.length}`);
    return { ...record, clauses: record.clauses.map(c => ({ ...c })), sourceClaimIds: [...record.sourceClaimIds] };
  }

  public validate(refinementId: string, params: { normalCasePassed: boolean; compatibilityPassed: boolean; regressionPassed: boolean }): ContractRefinementRecord | undefined {
    const record = this.records.find(r => r.refinementId === refinementId);
    if (!record || record.status === 'QUARANTINED') return record;
    if (params.normalCasePassed && params.compatibilityPassed && params.regressionPassed) {
      record.status = 'VALIDATED';
      record.reason = '正常系・互換性・Regressionの対照試験を通過した契約候補として検証済みです。正式仕様への確定は別Gateで行います。';
    } else {
      record.status = 'QUARANTINED';
      record.reason = '過剰制約または回帰影響を排除できないため契約候補を検疫しました。';
    }
    record.updatedAt = Date.now();
    this.save();
    return { ...record, clauses: record.clauses.map(c => ({ ...c })), sourceClaimIds: [...record.sourceClaimIds] };
  }

  public list(limit = 100) {
    return this.records.slice(0, Math.max(1, limit)).map(r => ({ ...r, clauses: r.clauses.map(c => ({ ...c })), sourceClaimIds: [...r.sourceClaimIds] }));
  }

  public get(id: string) { return this.records.find(r => r.refinementId === id); }

  private extractMinimalClauses(text: string): ContractClause[] {
    const out: ContractClause[] = [];
    const lower = text.toLowerCase();
    const add = (kind: ContractClauseKind, clause: string, source: string) => {
      const normalized = clause.replace(/\s+/g, ' ').trim();
      if (!normalized || normalized.length < 8 || normalized.length > 180) return;
      if (out.some(c => c.text === normalized)) return;
      out.push({ id: `CLAUSE-${this.hash(`${kind}|${normalized}`)}`, kind, text: normalized, source });
    };

    if (/permission|権限|認証|credential|secret|token/i.test(lower)) add('PRECONDITION', '必要な権限・認証条件を満たしていること', 'failure/claim keyword');
    if (/version|互換|api|dependency|依存|version/i.test(lower)) add('INVARIANT', '対象API・依存版・実装版の互換条件を維持すること', 'failure/claim keyword');
    if (/timeout|通信|network|connection|通信断/i.test(lower)) add('PRECONDITION', '通信依存が必要な処理では接続状態を検査してから実行すること', 'failure/claim keyword');
    if (/input|入力|format|形式|parse|json/i.test(lower)) add('PRECONDITION', '入力形式を実行前に検証し、不正形式を正常処理として扱わないこと', 'failure/claim keyword');
    if (/rollback|rollback|rollback/i.test(lower)) add('POSTCONDITION', '変更失敗時に直前安定状態へ戻せること', 'failure/claim keyword');
    if (/never|禁止|not allowed|不能|無効/i.test(lower)) add('PROHIBITION', '未検証の条件を成功根拠として採用しないこと', 'failure/claim keyword');
    if (out.length === 0) add('INVARIANT', '今回観測された失敗条件を再現可能な検証条件として保持すること', 'failure evidence');
    return out.slice(0, 6);
  }

  private hasOverBroadClause(clauses: ContractClause[]): boolean {
    return clauses.some(c => /常に|すべて|あらゆる|always|everything|never/i.test(c.text)) || clauses.length > 6;
  }
  private hash(raw: string) { let h=2166136261; for(let i=0;i<raw.length;i++){h^=raw.charCodeAt(i);h=Math.imul(h,16777619);} return (h>>>0).toString(16).padStart(8,'0'); }
  private load(){ try { const raw=storageService.getItem(this.storageKey); if(raw){const p=JSON.parse(raw); if(Array.isArray(p)) this.records=p;} } catch {} }
  private save(){ try { storageService.setItem(this.storageKey, JSON.stringify(this.records)); } catch {} }
}
export const counterexampleContractRefinementService = CounterexampleContractRefinementService.getInstance();
