import { TrainingSampleJSONL } from '../types';
import { storageService } from './storageService';
import { systemLogger } from './systemLogger';
import { answerPlanService } from './answerPlanService';
import { capabilityGapService } from './capabilityGapService';

/**
 * Non-LLM自己改善ループ。
 *
 * 「学習データを重みに入れる」代わりに、検証済みの失敗/修正対を
 * 決定論的な回答骨格・能力状態・回帰監視へコンパイルする。
 * ここでは生成モデル、埋め込みモデル、確率的推論を一切必要としない。
 */
export interface CapabilityPatch {
  id: string;
  capabilityId: string;
  sourceSampleId: string;
  category: TrainingSampleJSONL['category'];
  triggerKeywords: string[];
  rule: string;
  verification: 'verified' | 'pending';
  createdAt: number;
}

const PATCHES_KEY = 'miki_ai_deterministic_capability_patches_v1';

const STOP_WORDS = new Set([
  'これ', 'それ', 'ここ', 'こと', 'もの', 'ため', 'よう', 'する', 'した', 'して',
  'ください', 'お願いします', 'について', '場合', '教えて', 'ほしい', 'できます',
]);

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[\u3000\s]+/g, ' ')
    .replace(/[。、！？!?.,:：;；()[\]{}「」『』]/g, ' ')
    .trim();
}

function extractKeywords(text: string): string[] {
  const normalized = normalize(text);
  const candidates = normalized
    .split(' ')
    .flatMap((token) => token.length >= 2 ? [token] : [])
    .filter((token) => !STOP_WORDS.has(token));

  // 日本語は空白分割できないため、頻出する意味単位も2〜6文字窓で抽出。
  const compact = normalized.replace(/\s/g, '');
  for (let size = 2; size <= 6; size++) {
    for (let i = 0; i + size <= compact.length && candidates.length < 24; i += size) {
      const piece = compact.slice(i, i + size);
      if (!STOP_WORDS.has(piece) && !/^[0-9]+$/.test(piece)) candidates.push(piece);
    }
  }

  return Array.from(new Set(candidates)).slice(0, 12);
}

function inferCapabilityId(sample: TrainingSampleJSONL): string {
  if (sample.category === 'code') return 'cap_code_comprehension';
  if (sample.category === 'correction') return 'cap_correction';
  if (sample.category === 'retrieval') return 'cap_retrieval_grounding';
  if (sample.category === 'tool_use') return 'cap_tool_selection';
  if (sample.category === 'vba') return 'cap_vba_reasoning';
  return 'cap_direct_answer';
}

class DeterministicCapabilityEvolutionService {
  private patches: CapabilityPatch[] = [];

  constructor() {
    this.load();
  }

  private load(): void {
    try {
      const raw = storageService.getItem(PATCHES_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) this.patches = parsed;
    } catch {
      this.patches = [];
    }
  }

  private save(): void {
    try {
      storageService.setItem(PATCHES_KEY, JSON.stringify(this.patches.slice(0, 200)));
    } catch {
      // Storage failure must never break the normal execution path.
    }
  }

  public getPatches(): CapabilityPatch[] {
    return [...this.patches];
  }

  /**
   * 承認済みかつ検証済みのサンプルを能力パッチへコンパイルする。
   * 同一の入力・出力対は二重登録しない。
   */
  public compileVerifiedSample(sample: TrainingSampleJSONL): CapabilityPatch | null {
    if (!sample.approved || sample.verifiedEffective !== true) return null;

    const capabilityId = inferCapabilityId(sample);
    const keywords = extractKeywords(`${sample.instruction} ${sample.failureReason || ''}`);
    if (keywords.length === 0) return null;

    const signature = `${sample.id}:${capabilityId}:${keywords.join('|')}`;
    const existing = this.patches.find((p) => p.id === signature);
    if (existing) return existing;

    const patch: CapabilityPatch = {
      id: signature,
      capabilityId,
      sourceSampleId: sample.id,
      category: sample.category,
      triggerKeywords: keywords,
      rule: [
        `入力カテゴリ=${sample.category}`,
        `重要語=${keywords.join(' / ')}`,
        `失敗原因=${sample.failureReason || '未指定'}`,
        '検証済みの修正結果を優先し、未検証の推測を追加しない',
      ].join('\n'),
      verification: 'verified',
      createdAt: Date.now(),
    };

    this.patches.unshift(patch);
    this.save();

    // 能力パッチを次回実行時に実際に使える回答骨格へコンパイルする。
    answerPlanService.installDeterministicCapabilityPatch({
      patternId: `PATTERN-CAPABILITY-${capabilityId}-${sample.id}`,
      capabilityId,
      triggerKeywords: keywords,
      rule: patch.rule,
      samplePrompt: sample.instruction,
      outputTarget: sample.outputTarget,
      category: sample.category,
    });

    // 既存の能力レジストリへ成功を反映。
    capabilityGapService.recordSuccess(capabilityId);

    systemLogger.info(
      'SELF_IMPROVEMENT',
      `🧩 [Non-LLM能力コンパイル] ${capabilityId} に検証済みパッチを追加: ${sample.id}`
    );

    return patch;
  }

  /** 未検証の失敗はモデル学習ではなく能力ギャップとして記録する。 */
  public recordFailure(sample: Pick<TrainingSampleJSONL, 'instruction' | 'category' | 'failureReason'>): void {
    const capabilityId = inferCapabilityId(sample as TrainingSampleJSONL);
    capabilityGapService.recordGap({
      description: sample.failureReason || `${sample.category}カテゴリで期待結果と実結果の差異を検出`,
      gap_type: 'failure',
      capabilityId,
      impact: 'MEDIUM',
      current_workaround: '検証済みの修正対を回答骨格・技能・規則へコンパイル',
      candidate_solution: '入力特徴・制約・期待結果を決定論的な能力パッチとして登録し、回帰試験で再検証',
      samplePrompt: sample.instruction,
    });
  }


  /**
   * Execution Evidenceを能力として再利用可能な形へ昇格する。
   * モデル重みを更新せず、現在もVERIFIEDなComponent構成と成功証拠だけを
   * 次回の決定論的計画へ戻す。
   */
  public compileExecutionEvidence(input: {
    taskId: string;
    requestId: string;
    goal: string;
    environment: string;
    componentIds: string[];
    implementationHashes: Record<string, string>;
    evidenceEventId: string;
    outputSummary?: string;
  }): { installed: boolean; capabilityId: string; patternId?: string } {
    if (!input.goal.trim() || !input.componentIds.length || !input.evidenceEventId) {
      return { installed: false, capabilityId: 'cap_unknown' };
    }
    const capabilityId = `cap_exec_${this.hash(`${input.environment}|${input.goal}`)}`;
    const keywords = extractKeywords(input.goal);
    if (!keywords.length) return { installed: false, capabilityId };

    const valid = input.componentIds.every((id) => {
      const hash = input.implementationHashes[id];
      return Boolean(id && hash);
    });
    if (!valid) return { installed: false, capabilityId };

    const patternId = `PATTERN-EXECUTION-${this.hash(`${input.taskId}|${input.evidenceEventId}`)}`;
    const existing = answerPlanService.getSkeletonById(patternId);
    if (!existing) {
      answerPlanService.installDeterministicCapabilityPatch({
        patternId,
        capabilityId,
        triggerKeywords: keywords,
        rule: [
          `成功実行環境=${input.environment}`,
          `検証済みComponent=${input.componentIds.join(' > ')}`,
          `実装ハッシュ=${input.componentIds.map((id) => `${id}:${input.implementationHashes[id]}`).join(' | ')}`,
          `成功証拠=${input.evidenceEventId}`,
          input.outputSummary ? `成功出力=${input.outputSummary.slice(0, 240)}` : '成功出力=記録なし',
          '同一条件では検証済み構成を優先し、現在のRegistry検証に失敗した場合は再利用しない',
        ].join('\n'),
        samplePrompt: input.goal,
        outputTarget: input.outputSummary || 'Execution Evidence PASS',
        category: 'tool_use',
      });
    }

    systemLogger.info('SELF_IMPROVEMENT',
      `🧩 [Execution Evidence→Capability] ${capabilityId} <- ${input.evidenceEventId}`);
    return { installed: true, capabilityId, patternId };
  }

  private hash(raw: string): string {
    let h = 2166136261;
    for (let i = 0; i < raw.length; i++) { h ^= raw.charCodeAt(i); h = Math.imul(h, 16777619); }
    return (h >>> 0).toString(16).padStart(8, '0');
  }

  /** 承認済みサンプルの蓄積を、実行可能な骨格へ変換する。 */
  public compileBatch(samples: TrainingSampleJSONL[]): { compiled: number; skipped: number } {
    let compiled = 0;
    let skipped = 0;
    for (const sample of samples) {
      if (this.compileVerifiedSample(sample)) compiled++;
      else skipped++;
    }
    return { compiled, skipped };
  }
}

export const deterministicCapabilityEvolutionService = new DeterministicCapabilityEvolutionService();
