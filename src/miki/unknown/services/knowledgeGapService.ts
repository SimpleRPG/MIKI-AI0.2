import { storageService } from '../../../services/storageService';
import { systemLogger } from '../../../services/systemLogger';
import type { PotentialUnknownBasis, PotentialUnknownCandidate } from '../../../types';
import { canonicalSha256Object } from '../../core/services/canonicalSha256Service';

const STORAGE_KEY = 'miki_knowledge_gaps_v1';

export type KnowledgeGapType =
  | 'UNKNOWN_TERM' | 'INSUFFICIENT_EVIDENCE' | 'CONTRADICTION' | 'STALE_INFORMATION' | 'UNKNOWN_CAPABILITY' | 'WEAK_COMPONENT'
  | 'UNKNOWN_INTENT' | 'UNKNOWN_REFERENCE' | 'UNKNOWN_USER_CONSTRAINT' | 'UNKNOWN_RELATION' | 'UNKNOWN_CONDITION' | 'UNKNOWN_CAUSE' | 'UNKNOWN_EFFECT'
  | 'UNKNOWN_IMPLEMENTATION' | 'UNKNOWN_COMPATIBILITY' | 'UNKNOWN_VERSION' | 'UNKNOWN_EXCEPTION' | 'UNKNOWN_COUNTEREXAMPLE' | 'UNKNOWN_SOURCE' | 'UNKNOWN_CONFIDENCE' | 'UNKNOWN_DEPENDENCY';

export type KnowledgeGapStatus = 'OPEN' | 'RESEARCHING' | 'RESOLVED' | 'BLOCKED';

export interface KnowledgeGapResolutionPlan {
  planId: string;
  gapId: string;
  phase: 'IDENTIFY' | 'COLLECT_EVIDENCE' | 'VERIFY' | 'RESOLVE';
  missingConditions: string[];
  requiredEvidence: string[];
  verificationMethods: string[];
  researchRoute: 'WEB_SEARCH' | 'EXECUTION_TEST' | 'USER_CLARIFICATION' | 'CORE_REVIEW';
  blackboardAction: 'RESEARCH' | 'EXECUTION_TEST' | 'CLARIFY' | 'BLOCK';
  createdAt: number;
}

export interface KnowledgeGapDetectionContext{target?:string;missingContent?:string;conditions?:string[];environment?:string;taskId?:string;capabilityIds?:string[];claimIds?:string[];}
export interface KnowledgeGapIdentity{target:string;missingContent:string;conditions:string[];environment:string;taskId:string;capabilityIds:string[];claimIds:string[];semanticKey:string;}
export interface KnowledgeGap {
  id: string;
  query: string;
  type: KnowledgeGapType;
  identity?: KnowledgeGapIdentity;
  sourceRequestIds?: string[];
  mergedCount?: number;
  priority: number;
  requiredEvidence: string[];
  status: KnowledgeGapStatus;
  reason: string;
  sourceRequestId?: string;
  createdAt: number;
  updatedAt: number;
  attempts: number;
  lastResearchAt?: number;
  resolutionPlan?: KnowledgeGapResolutionPlan;
}

/**
 * 未知を「答え」で埋めず、調査対象として永続化するための軽量なキュー。
 * Claim DBとは責務を分離し、ここでは真偽判定やClaimへの昇格を行わない。
 */
export class KnowledgeGapService {
  private gaps: KnowledgeGap[] = [];

  constructor() {
    this.load();
  }

  private load(): void {
    try {
      const raw = storageService.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) this.gaps = parsed;
      }
    } catch (error) {
      systemLogger.warn('SELF_IMPROVEMENT', `KnowledgeGapの読み込みに失敗しました: ${String(error)}`);
      this.gaps = [];
    }
  }

  private save(): void {
    try {
      storageService.setItem(STORAGE_KEY, JSON.stringify(this.gaps.slice(0, 500)));
    } catch (error) {
      systemLogger.warn('SELF_IMPROVEMENT', `KnowledgeGapの保存に失敗しました: ${String(error)}`);
    }
  }

  public detect(params: {query:string;reason?:string;type?:KnowledgeGapType;priority?:number;requiredEvidence?:string[];sourceRequestId?:string;target?:string;missingContent?:string;conditions?:string[];environment?:string;taskId?:string;capabilityIds?:string[];claimIds?:string[]}): KnowledgeGap {
    const query=params.query.trim(); const identity=this.buildIdentity(params); const existing=this.findOpen(query,params);
    if(existing)return this.mergeInto(existing,params,identity);
    const now=Date.now(); const gap:KnowledgeGap={id:this.makeId(query),query,type:params.type||this.inferType(query,params.reason||''),identity,sourceRequestIds:params.sourceRequestId?[params.sourceRequestId]:[],mergedCount:0,priority:Math.max(1,Math.min(100,params.priority??50)),requiredEvidence:params.requiredEvidence?.filter(Boolean)||['信頼できる一次資料または再現可能な検証結果'],status:'OPEN',reason:params.reason||'端末内の既知知識だけでは結論を確定できない',sourceRequestId:params.sourceRequestId,createdAt:now,updatedAt:now,attempts:0};
    this.gaps.unshift(gap); this.save(); systemLogger.info('SELF_IMPROVEMENT',`🔎 [Knowledge Gap] ${gap.id}: ${gap.type} / ${gap.query}`); return gap;
  }

  /**
   * v211 / 設計思想P3-13:
   * 既知のClaim / Capability / Failure / Environment構造から、まだKnowledge Gap化されていない
   * 「存在する可能性が高い未知」を決定論的に候補化する。
   *
   * 重要: ここでは事実もKnowledgeも保存しない。候補は非永続で、明示的にpromotePotentialUnknown()
   * されたものだけが既存Knowledge Gapキューへ入り、既存ResearchServiceへ渡せる状態になる。
   */
  public predictPotentialUnknowns(params: {
    claims?: Array<{ claim_id?: string; statement?: string; status?: string; scope?: unknown; confidence_score?: number }>;
    capabilityGaps?: Array<{ capabilityId?: string; description?: string; status?: string; samples?: string[]; frequency?: number; impact?: string }>;
    failures?: Array<{ component_id?: string; environment?: string; error_signature?: string; count?: number; last_seen_at?: number }>;
    environment?: string;
    currentQuery?: string;
    limit?: number;
  }): PotentialUnknownCandidate[] {
    const candidates: PotentialUnknownCandidate[] = [];
    const seen = new Set<string>();
    const now = Date.now();
    const currentQuery = this.normalize(params.currentQuery || '');

    const add = (question: string, basis: PotentialUnknownBasis[], evidence: string[], confidence: number) => {
      const q = question.trim();
      const key = this.normalize(q);
      if (!q || key.length < 8 || seen.has(key) || this.findOpen(q)) return;
      seen.add(key);
      candidates.push({
        id: this.makePotentialUnknownId(q),
        question: q,
        basis: Array.from(new Set(basis)),
        evidence: evidence.filter(Boolean).slice(0, 6),
        confidence: Math.max(0, Math.min(1, confidence)),
        status: 'CANDIDATE',
        generatedAt: now,
      });
    };

    // Knowledge scope edges: a confirmed/strong claim can still expose an unverified condition/exception.
    for (const claim of (params.claims || []).slice(0, 30)) {
      const statement = String(claim.statement || '').trim();
      if (!statement) continue;
      if (!/(場合|条件|前提|ただし|なら|であれば|環境によって|例外|依存)/.test(statement)) continue;
      if (claim.status === 'FALSE' || claim.status === 'SUPERSEDED') continue;
      const short = statement.slice(0, 140);
      add(
        `既知の主張「${short}」には未確認の適用条件・例外・依存関係がないか確認する`,
        ['KNOWLEDGE_SCOPE_EDGE'],
        [`Claim=${claim.claim_id || 'unknown'}`, `状態=${claim.status || 'unknown'}`, `主張=${short}`],
        claim.confidence_score && claim.confidence_score >= 0.85 ? 0.84 : 0.76,
      );
    }

    // Capability gaps indicate variants that have not yet been observed/tested.
    for (const gap of (params.capabilityGaps || []).filter(g => g.status !== 'RESOLVED').slice(0, 15)) {
      const capability = String(gap.capabilityId || '').trim();
      const description = String(gap.description || '').trim();
      if (!capability && !description) continue;
      const sample = (gap.samples || [])[0];
      add(
        `能力「${capability || description.slice(0, 60)}」が未観測の別条件・別入力でも成立するか確認する`,
        ['CAPABILITY_VARIANT', ...(params.environment ? ['ENVIRONMENT_VARIANT' as const] : [])],
        [`CapabilityGap=${capability || 'unknown'}`, `説明=${description.slice(0, 120)}`, sample ? `例=${sample.slice(0, 100)}` : ''],
        Math.min(0.93, 0.78 + Math.min(0.1, Number(gap.frequency || 0) * 0.01)),
      );
    }

    // Failure boundaries: do not treat past failure as fact about all environments; predict the unobserved boundary.
    const failureGroups = new Map<string, { envs: Set<string>; count: number; signatures: Set<string> }>();
    for (const failure of (params.failures || []).slice(0, 80)) {
      const component = String(failure.component_id || '').trim();
      if (!component) continue;
      const key = component;
      const group = failureGroups.get(key) || { envs: new Set<string>(), count: 0, signatures: new Set<string>() };
      if (failure.environment) group.envs.add(String(failure.environment));
      group.count += Number(failure.count || 1);
      if (failure.error_signature) group.signatures.add(String(failure.error_signature));
      failureGroups.set(key, group);
    }
    for (const [component, group] of failureGroups) {
      if (group.count < 2) continue;
      const knownEnvironments = Array.from(group.envs).join(', ') || '環境不明';
      const targetEnvironment = params.environment && !group.envs.has(params.environment)
        ? params.environment
        : '未観測の別環境';
      add(
        `Component「${component}」の失敗境界が環境依存か、${targetEnvironment}で再現・非再現になるか確認する`,
        ['FAILURE_BOUNDARY', ...(params.environment && !group.envs.has(params.environment) ? ['ENVIRONMENT_VARIANT' as const] : [])],
        [`既知失敗環境=${knownEnvironments}`, `失敗累積=${group.count}`, `signature数=${group.signatures.size}`],
        Math.min(0.92, 0.80 + Math.min(0.1, group.count * 0.01)),
      );
    }

    // Cross-signal combination: a capability problem and an environment signal together imply an unobserved variant.
    if (params.environment && (params.capabilityGaps || []).length > 0 && (params.failures || []).length > 0) {
      add(
        `現在環境「${params.environment}」で、既知のCapability不足とFailure履歴が同じ処理境界に共存していないか確認する`,
        ['COMBINATION_GAP', 'CAPABILITY_VARIANT', 'FAILURE_BOUNDARY', 'ENVIRONMENT_VARIANT'],
        [
          `現在環境=${params.environment}`,
          `CapabilityGap件数=${params.capabilityGaps?.length || 0}`,
          `Failure件数=${params.failures?.length || 0}`,
        ],
        0.83,
      );
    }

    // Current query relation is only used to prefer immediately relevant candidates, never as evidence of truth.
    candidates.sort((a, b) => {
      const ar = currentQuery && this.normalize(a.question).includes(currentQuery.slice(0, 24)) ? 1 : 0;
      const br = currentQuery && this.normalize(b.question).includes(currentQuery.slice(0, 24)) ? 1 : 0;
      return b.confidence - a.confidence || br - ar || a.id.localeCompare(b.id);
    });
    return candidates.slice(0, Math.max(1, Math.min(8, params.limit ?? 5)));
  }

  /** 候補を既存Knowledge Gapへ安全に昇格する。Claim/事実への自動昇格は行わない。 */
  public promotePotentialUnknown(candidate: PotentialUnknownCandidate, sourceRequestId?: string): KnowledgeGap {
    const gap = this.detect({
      query: candidate.question,
      type: this.inferType(candidate.question, `PotentialUnknown: ${candidate.basis.join(',')}`),
      priority: Math.round(candidate.confidence * 100),
      requiredEvidence: ['候補となった条件を直接検証できるEvidenceまたは再現可能な試験結果'],
      reason: `Potential UnknownからResearch対象へ昇格: ${candidate.basis.join(', ')}`, 
      sourceRequestId,
    });
    candidate.status = 'PROMOTED';
    candidate.promotedGapId = gap.id;
    systemLogger.info('SELF_IMPROVEMENT', `🧭 [Potential Unknown→Knowledge Gap] ${candidate.id} → ${gap.id}: ${candidate.question}`);
    return gap;
  }

  public findOpen(query: string, context: KnowledgeGapDetectionContext = {}): KnowledgeGap | undefined {
    const semanticKey=this.buildIdentity({query,...context}).semanticKey;
    const normalized=this.normalize(query);
    return this.gaps.find((gap)=>{
      if(gap.status==='RESOLVED'||gap.status==='BLOCKED')return false;
      const legacyIdentity=this.buildIdentity({query:gap.query,target:gap.identity?.target,missingContent:gap.identity?.missingContent,conditions:gap.identity?.conditions,environment:gap.identity?.environment,taskId:gap.identity?.taskId,capabilityIds:gap.identity?.capabilityIds,claimIds:gap.identity?.claimIds});
      return legacyIdentity.semanticKey===semanticKey || (!Object.keys(context).length&&this.normalize(gap.query)===normalized);
    });
  }

  private buildIdentity(params:{query:string;target?:string;missingContent?:string;conditions?:string[];environment?:string;taskId?:string;capabilityIds?:string[];claimIds?:string[]}):KnowledgeGapIdentity{
    const target=this.semanticNormalize(params.target||''); const missingContent=this.semanticNormalize(params.missingContent||params.query); const conditions=[...new Set((params.conditions||[]).map(x=>this.semanticNormalize(x)).filter(Boolean))].sort(); const environment=this.semanticNormalize(params.environment||''); const taskId=this.semanticNormalize(params.taskId||''); const capabilityIds=[...new Set((params.capabilityIds||[]).map(x=>this.semanticNormalize(x)).filter(Boolean))].sort(); const claimIds=[...new Set((params.claimIds||[]).map(x=>this.semanticNormalize(x)).filter(Boolean))].sort(); const canonical={target,missingContent,conditions,environment,taskId,capabilityIds,claimIds}; return {...canonical,semanticKey:canonicalSha256Object(canonical)};
  }
  private mergeInto(existing:KnowledgeGap,params:{priority?:number;requiredEvidence?:string[];sourceRequestId?:string;reason?:string},identity:KnowledgeGapIdentity):KnowledgeGap{
    const evidence=new Set([...(existing.requiredEvidence||[]),...(params.requiredEvidence||[])].filter(Boolean)); const sources=new Set([...(existing.sourceRequestIds||[]),...(existing.sourceRequestId?[existing.sourceRequestId]:[]),params.sourceRequestId||''].filter(Boolean)); existing.identity=existing.identity||identity; existing.priority=Math.max(existing.priority,Math.max(1,Math.min(100,params.priority??existing.priority))); existing.requiredEvidence=[...evidence]; existing.sourceRequestIds=[...sources]; existing.mergedCount=(existing.mergedCount||0)+1; if(params.reason&&!existing.reason.includes(params.reason))existing.reason=`${existing.reason} / ${params.reason}`.slice(0,2000); existing.updatedAt=Date.now(); this.save(); return existing;
  }
  private semanticNormalize(text:string):string{
    let value=this.normalize(text).replace(/[「」『』【】()[\]{}<>]/g,' ').replace(/[？?！!。、，,：:;；]/g,' ').replace(/\b(what|which|how|why|when|where|is|are|the|a|an|to|of|for|with)\b/gi,' ').replace(/(とは|について|を|が|は|の|に|へ|で|と|から|まで|です|ます|ください|知りたい|教えて|どう|どのように|方法|仕組み|やり方)/g,' ').replace(/\s+/g,' ').trim();
    const aliases:[RegExp,string][]=[[/検索結果|search[\s_-]*results?/gi,'search_results'],[/重複処理|重複除外|deduplication|dedupe/gi,'deduplication'],[/統合|集約|まとめ|マージ|combine|combining|integration/gi,'integration'],[/原因|なぜ|cause|why/gi,'cause'],[/条件|when|condition/gi,'condition'],[/依存関係|依存|dependency|dependencies/gi,'dependency'],[/互換性|互換|compatibility|compatible/gi,'compatibility'],[/バージョン|version/gi,'version'],[/例外|exception/gi,'exception'],[/反例|counterexample/gi,'counterexample'],[/出典|根拠|source/gi,'source'],[/信頼度|確信|confidence/gi,'confidence']]; for(const [pattern,replacement] of aliases)value=value.replace(pattern,` ${replacement} `); return value.replace(/\s+/g,' ').trim();
  }

  public getById(id: string): KnowledgeGap | undefined {
    return this.gaps.find((gap) => gap.id === id);
  }

  public listOpen(limit = 20): KnowledgeGap[] {
    return this.gaps
      .filter((gap) => gap.status === 'OPEN' || gap.status === 'RESEARCHING')
      .sort((a, b) => b.priority - a.priority || b.updatedAt - a.updatedAt)
      .slice(0, limit)
      .map((gap) => ({ ...gap, requiredEvidence: [...gap.requiredEvidence] }));
  }

  public buildResolutionPlan(gapOrId: KnowledgeGap | string, options?: {
    environment?: string;
    preferredRoute?: KnowledgeGapResolutionPlan['researchRoute'];
  }): KnowledgeGapResolutionPlan | undefined {
    const gap = typeof gapOrId === 'string' ? this.getById(gapOrId) : gapOrId;
    if (!gap) return undefined;
    const missingConditions = [
      ...(gap.identity?.conditions || []),
      ...(gap.identity?.environment ? [`environment=${gap.identity.environment}`] : []),
      ...(options?.environment && options.environment !== gap.identity?.environment ? [`currentEnvironment=${options.environment}`] : []),
    ].filter(Boolean);
    const researchRoute = options?.preferredRoute || (/実装|再現|性能|互換|環境/.test(`${gap.query} ${gap.reason}`) ? 'EXECUTION_TEST' : 'WEB_SEARCH');
    const verificationMethods = researchRoute === 'EXECUTION_TEST'
      ? ['再現可能な実行テスト', '成果物・実装・テストケース・環境の照合', 'Verifierによる明示検証']
      : ['独立Evidenceの収集', 'Claim/Evidence照合', 'Verifierによる明示検証'];
    const plan: KnowledgeGapResolutionPlan = {
      planId: `GAPPLAN-${canonicalSha256Object({ gapId: gap.id, missingConditions, requiredEvidence: gap.requiredEvidence, researchRoute }).slice(0, 20)}`,
      gapId: gap.id,
      phase: 'IDENTIFY',
      missingConditions: [...new Set(missingConditions)].slice(0, 12),
      requiredEvidence: [...new Set(gap.requiredEvidence)].slice(0, 12),
      verificationMethods,
      researchRoute,
      blackboardAction: researchRoute === 'EXECUTION_TEST' ? 'EXECUTION_TEST' : 'RESEARCH',
      createdAt: Date.now(),
    };
    const updated = this.update(gap.id, { resolutionPlan: plan, status: gap.status === 'RESOLVED' ? 'RESOLVED' : gap.status });
    return updated?.resolutionPlan ? { ...updated.resolutionPlan, missingConditions: [...updated.resolutionPlan.missingConditions], requiredEvidence: [...updated.resolutionPlan.requiredEvidence], verificationMethods: [...updated.resolutionPlan.verificationMethods] } : undefined;
  }

  public advanceResolutionPlan(id: string, phase: KnowledgeGapResolutionPlan['phase'], blackboardAction?: KnowledgeGapResolutionPlan['blackboardAction']): KnowledgeGap | undefined {
    const gap = this.getById(id);
    if (!gap?.resolutionPlan) return undefined;
    return this.update(id, { resolutionPlan: { ...gap.resolutionPlan, phase, blackboardAction: blackboardAction || gap.resolutionPlan.blackboardAction } });
  }

  public markResearching(id: string): KnowledgeGap | undefined {
    return this.update(id, { status: 'RESEARCHING', lastResearchAt: Date.now(), attempts: (this.getById(id)?.attempts || 0) + 1 });
  }

  public markResolved(id: string): KnowledgeGap | undefined {
    return this.update(id, { status: 'RESOLVED' });
  }

  public markBlocked(id: string, reason?: string): KnowledgeGap | undefined {
    return this.update(id, { status: 'BLOCKED', reason: reason || this.getById(id)?.reason || '調査不能' });
  }

  private update(id: string, patch: Partial<KnowledgeGap>): KnowledgeGap | undefined {
    const index = this.gaps.findIndex((gap) => gap.id === id);
    if (index < 0) return undefined;
    this.gaps[index] = { ...this.gaps[index], ...patch, updatedAt: Date.now() };
    this.save();
    return this.gaps[index];
  }


  private normalize(text:string):string{return String(text||'').toLowerCase().replace(/\s+/g,' ').trim();}

  private makePotentialUnknownId(question: string): string {
    let hash = 2166136261;
    const input = this.normalize(question);
    for (let i = 0; i < input.length; i++) {
      hash ^= input.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return `PUNK-${(hash >>> 0).toString(16).padStart(8, '0')}`;
  }

  private inferType(query:string,reason:string):KnowledgeGapType{
    const text=`${query} ${reason}`; if(/意図|何をしたい|intent/i.test(text))return 'UNKNOWN_INTENT'; if(/これ|それ|あれ|指示語|照応|reference/i.test(text))return 'UNKNOWN_REFERENCE'; if(/制約|希望|条件指定|constraint/i.test(text))return 'UNKNOWN_USER_CONSTRAINT'; if(/矛盾|contradict|食い違|一致しない/i.test(text))return 'CONTRADICTION'; if(/関係|relationship|relation/i.test(text))return 'UNKNOWN_RELATION'; if(/条件|condition|when /i.test(text))return 'UNKNOWN_CONDITION'; if(/原因|なぜ|cause|why/i.test(text))return 'UNKNOWN_CAUSE'; if(/影響|効果|effect/i.test(text))return 'UNKNOWN_EFFECT'; if(/実装方法|実装手段|implement|implementation/i.test(text))return 'UNKNOWN_IMPLEMENTATION'; if(/互換|compatib/i.test(text))return 'UNKNOWN_COMPATIBILITY'; if(/バージョン|version/i.test(text))return 'UNKNOWN_VERSION'; if(/例外|exception/i.test(text))return 'UNKNOWN_EXCEPTION'; if(/反例|counterexample/i.test(text))return 'UNKNOWN_COUNTEREXAMPLE'; if(/出典|根拠|source/i.test(text))return 'UNKNOWN_SOURCE'; if(/確信|信頼度|confidence/i.test(text))return 'UNKNOWN_CONFIDENCE'; if(/依存|dependency/i.test(text))return 'UNKNOWN_DEPENDENCY'; if(/古い|更新|最新|obsolete|stale/i.test(text))return 'STALE_INFORMATION'; if(/部品|component|能力/i.test(text))return 'UNKNOWN_CAPABILITY'; if(/用語|意味|定義|とは/i.test(text))return 'UNKNOWN_TERM'; if(/実装|コード/i.test(text))return 'UNKNOWN_IMPLEMENTATION'; return 'INSUFFICIENT_EVIDENCE';
  }

  private makeId(query: string): string {
    let hash = 2166136261;
    const input = this.normalize(query);
    for (let i = 0; i < input.length; i++) {
      hash ^= input.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return `GAP-${(hash >>> 0).toString(16).padStart(8, '0')}`;
  }
}

export const knowledgeGapService = new KnowledgeGapService();
