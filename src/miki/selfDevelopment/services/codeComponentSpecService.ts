import { storageService } from '../../../services/storageService';
import { systemLogger } from '../../../services/systemLogger';

/**
 * P918: コード生成・第3段の続き。会話で合成が止まった不足について、
 * その場の要求コンパイル結果（対象・成果物・受入条件・制約）から
 * 「部品仕様の下書き」を作って台帳に残す。
 *
 * 目的は、不足を漠然としたギャップから「作れる形の仕様」に
 * 変えること。実装そのものは推測で書かない（未検証コードの
 * 捏造になるため）。仕様があれば、教師教材や供給パッケージの
 * 受け口で実装とテストが届いたときに、既存の検証・登録
 * （generatedComponentVerificationRegistrationService）の線へ
 * そのまま渡せる。renderRequestList は教師へ渡すための
 * 依頼リスト（Markdown）を返す。
 */
export interface CodeComponentSpec {
  capabilityId: string;
  purpose: string;
  target: string;
  deliverables: string[];
  acceptanceCriteria: string[];
  constraints: string[];
  sampleCount: number;
  firstSeenAt: number;
  lastSeenAt: number;
  status: 'SPEC_DRAFT';
}

const STORAGE_KEY = 'miki_code_component_specs_v1';
const MAX_SPECS = 100;

class CodeComponentSpecService {
  private static instance: CodeComponentSpecService;
  private specs: Map<string, CodeComponentSpec> | undefined;

  public static getInstance(): CodeComponentSpecService {
    if (!CodeComponentSpecService.instance) {
      CodeComponentSpecService.instance = new CodeComponentSpecService();
    }
    return CodeComponentSpecService.instance;
  }

  private load(): Map<string, CodeComponentSpec> {
    if (this.specs) return this.specs;
    const map = new Map<string, CodeComponentSpec>();
    try {
      const raw = storageService.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as CodeComponentSpec[];
        if (Array.isArray(parsed)) {
          for (const spec of parsed) {
            if (spec && typeof spec.capabilityId === 'string') map.set(spec.capabilityId, spec);
          }
        }
      }
    } catch { /* 台帳が読めなくても会話は止めない */ }
    this.specs = map;
    return map;
  }

  private save(): void {
    try {
      const all = [...this.load().values()].slice(-MAX_SPECS);
      storageService.setItem(STORAGE_KEY, JSON.stringify(all));
    } catch { /* 保存は補助経路 */ }
  }

  /** 要求コンパイル結果から仕様の下書きを記録する（同じ不足は集約）。 */
  public recordFromRequest(input: {
    capabilityId: string;
    prompt: string;
    target?: string;
    deliverables?: string[];
    acceptanceCriteria?: string[];
    constraints?: string[];
  }): CodeComponentSpec {
    const specs = this.load();
    const existing = specs.get(input.capabilityId);
    const now = Date.now();
    if (existing) {
      existing.sampleCount += 1;
      existing.lastSeenAt = now;
      this.save();
      return existing;
    }
    const spec: CodeComponentSpec = {
      capabilityId: input.capabilityId,
      purpose: input.prompt.slice(0, 120),
      target: (input.target || '').slice(0, 120),
      deliverables: (input.deliverables || []).slice(0, 5).map((v) => String(v).slice(0, 120)),
      acceptanceCriteria: (input.acceptanceCriteria || []).slice(0, 5).map((v) => String(v).slice(0, 160)),
      constraints: (input.constraints || []).slice(0, 5).map((v) => String(v).slice(0, 120)),
      sampleCount: 1,
      firstSeenAt: now,
      lastSeenAt: now,
      status: 'SPEC_DRAFT',
    };
    specs.set(spec.capabilityId, spec);
    this.save();
    systemLogger.info('SELF_IMPROVEMENT', `🧩 [部品仕様] 不足から仕様の下書きを作成: ${spec.capabilityId} 「${spec.purpose}」`);
    return spec;
  }

  public list(): CodeComponentSpec[] {
    return [...this.load().values()].sort((a, b) => b.sampleCount - a.sampleCount || b.lastSeenAt - a.lastSeenAt);
  }

  public summary(): { drafted: number } {
    return { drafted: this.load().size };
  }

  /** 教師へ渡すための依頼リスト。頻度の高い順。 */
  public renderRequestList(limit = 10): string {
    const specs = this.list().slice(0, limit);
    if (specs.length === 0) return '（部品の不足は記録されていません）';
    const lines = ['# 不足しているコード部品の依頼リスト', ''];
    for (const spec of specs) {
      lines.push(`## ${spec.purpose}`);
      lines.push(`- 依頼回数: ${spec.sampleCount}`);
      if (spec.target) lines.push(`- 対象: ${spec.target}`);
      if (spec.deliverables.length > 0) lines.push(`- 成果物: ${spec.deliverables.join(' / ')}`);
      if (spec.acceptanceCriteria.length > 0) lines.push(`- 受入条件: ${spec.acceptanceCriteria.join(' / ')}`);
      if (spec.constraints.length > 0) lines.push(`- 制約: ${spec.constraints.join(' / ')}`);
      lines.push('');
    }
    return lines.join('\n');
  }
}

export const codeComponentSpecService = CodeComponentSpecService.getInstance();
