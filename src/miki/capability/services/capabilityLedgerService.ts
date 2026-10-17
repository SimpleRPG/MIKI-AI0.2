import { storageService } from '../../../services/storageService';
import { componentRegistryService } from './componentRegistryService';
import { componentArtifactStoreService } from './componentArtifactStoreService';
import { capabilityConfidenceService } from './capabilityConfidenceService';
import { knowledgeGapService } from '../../unknown/services/knowledgeGapService';

export type CapabilityLedgerState =
  | 'VERIFIED_EVIDENCE'
  | 'VERIFIED_REGISTRY_ONLY'
  | 'REVALIDATION_REQUIRED'
  | 'IMPLEMENTED_UNVERIFIED'
  | 'UNASSESSED';

export interface CapabilityLedgerComponent {
  id: string;
  purpose: string;
  entryPoint: string;
  registryStatus: string;
  state: CapabilityLedgerState;
  implementationHash: string;
  confidence: number;
  sampleCount: number;
  successes: number;
  failures: number;
  revalidationRequired: boolean;
  artifactAvailable: boolean;
  reason: string;
}

export interface CapabilityLedgerGap {
  id: string;
  query: string;
  type: string;
  priority: number;
  status: string;
  reason: string;
  requiredEvidence: string[];
}

export interface CapabilityLedgerSnapshot {
  snapshotAt: string;
  registryCount: number;
  assessedCount: number;
  componentsTruncated: boolean;
  components: CapabilityLedgerComponent[];
  openGapCountAtLeast: number;
  gapsTruncated: boolean;
  openGaps: CapabilityLedgerGap[];
  historyCount: number;
  statusCounts: Record<CapabilityLedgerState, number>;
}

export interface CapabilityLedgerCandidate extends CapabilityLedgerComponent {
  matchScore: number;
  matchedTerms: string[];
}

export interface CapabilityLedgerAssessment {
  goal: string;
  registryCount: number;
  checkedCount: number;
  componentsTruncated: boolean;
  candidates: CapabilityLedgerCandidate[];
  summary: string;
  noCandidateIsNotProofOfAbsence: true;
}

interface LedgerHistoryItem {
  snapshotAt: string;
  registryCount: number;
  assessedCount: number;
  verifiedWithEvidence: number;
  registryOnly: number;
  revalidationRequired: number;
  implementedUnverified: number;
  unassessed: number;
  openGapCountAtLeast: number;
}

const HISTORY_KEY = 'miki_capability_ledger_history_v1';
const COMPONENT_LIMIT = 500;
const GAP_LIMIT = 500;

class CapabilityLedgerService {
  private readHistory(): LedgerHistoryItem[] {
    try {
      const raw = storageService.getItem(HISTORY_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed.slice(0, 30) : [];
    } catch {
      return [];
    }
  }

  private recordHistory(snapshot: CapabilityLedgerSnapshot): void {
    const item: LedgerHistoryItem = {
      snapshotAt: snapshot.snapshotAt,
      registryCount: snapshot.registryCount,
      assessedCount: snapshot.assessedCount,
      verifiedWithEvidence: snapshot.statusCounts.VERIFIED_EVIDENCE,
      registryOnly: snapshot.statusCounts.VERIFIED_REGISTRY_ONLY,
      revalidationRequired: snapshot.statusCounts.REVALIDATION_REQUIRED,
      implementedUnverified: snapshot.statusCounts.IMPLEMENTED_UNVERIFIED,
      unassessed: snapshot.statusCounts.UNASSESSED,
      openGapCountAtLeast: snapshot.openGapCountAtLeast,
    };
    try {
      storageService.setItem(
        HISTORY_KEY,
        JSON.stringify([item, ...this.readHistory()].slice(0, 30)),
      );
    } catch {
      // 履歴の保存失敗だけで能力台帳の表示を妨げない。
    }
  }

  public getSnapshot(recordHistory = true): CapabilityLedgerSnapshot {
    const allComponents = componentRegistryService.getAllComponents();
    const selected = allComponents.slice(0, COMPONENT_LIMIT);
    const components: CapabilityLedgerComponent[] = selected.map((entry) => {
      const component = entry as unknown as Record<string, any>;
      const id = String(component.component_id || 'UNKNOWN_COMPONENT');
      const implementationHash = String(component.implementation_hash || '');

      let confidence: any;
      let artifact: any;
      try {
        confidence = capabilityConfidenceService.evaluate(id);
      } catch {
        confidence = {
          confidence: 0,
          sampleCount: 0,
          successes: 0,
          failures: 0,
          revalidationRequired: true,
          currentImplementationHash: implementationHash,
          observedImplementationHash: undefined,
          reason: 'CapabilityConfidenceの評価を完了できなかったため再確認が必要',
        };
      }

      try {
        artifact = componentArtifactStoreService.get(id);
      } catch {
        artifact = undefined;
      }

      const registryStatus = String(component.status || 'UNKNOWN');
      const verified =
        registryStatus === 'VERIFIED' ||
        registryStatus === 'DEVICE_VERIFIED';

      const matchingHashEvidence =
        confidence.sampleCount > 0 &&
        confidence.successes > 0 &&
        !!implementationHash &&
        confidence.currentImplementationHash === implementationHash &&
        confidence.observedImplementationHash === implementationHash;

      let state: CapabilityLedgerState;
      let reason: string;

      if (confidence.sampleCount > 0 && confidence.revalidationRequired) {
        state = 'REVALIDATION_REQUIRED';
        reason = confidence.reason || '既存実行根拠の再検証が必要';
      } else if (verified && matchingHashEvidence) {
        state = 'VERIFIED_EVIDENCE';
        reason = 'Registryの検証状態に加え、現在の実装hashと一致する成功実行根拠を確認';
      } else if (verified) {
        state = 'VERIFIED_REGISTRY_ONLY';
        reason = 'Registry上は検証済みだが、現在の実装hashと一致する成功実行根拠を確認できていない';
      } else if (
        !!implementationHash ||
        !!String(component.implementation_txt || '').trim() ||
        !!String(artifact?.implementation_txt || '').trim()
      ) {
        state = 'IMPLEMENTED_UNVERIFIED';
        reason = '実装またはArtifactの存在は確認したが、検証済み能力とは判定していない';
      } else {
        state = 'UNASSESSED';
        reason = '実装・検証状態をこの台帳だけでは評価できない';
      }

      return {
        id,
        purpose: String(component.purpose || ''),
        entryPoint: String(component.entry_point || ''),
        registryStatus,
        state,
        implementationHash,
        confidence: Number.isFinite(confidence.confidence) ? confidence.confidence : 0,
        sampleCount: Number.isFinite(confidence.sampleCount) ? confidence.sampleCount : 0,
        successes: Number.isFinite(confidence.successes) ? confidence.successes : 0,
        failures: Number.isFinite(confidence.failures) ? confidence.failures : 0,
        revalidationRequired: !!confidence.revalidationRequired,
        artifactAvailable: !!artifact,
        reason,
      };
    });

    const fetchedGaps = knowledgeGapService.listOpen(GAP_LIMIT + 1);
    const openGaps = fetchedGaps.slice(0, GAP_LIMIT).map((gap) => ({
      id: String(gap.id),
      query: String(gap.query),
      type: String(gap.type),
      priority: Number(gap.priority) || 0,
      status: String(gap.status),
      reason: String(gap.reason || ''),
      requiredEvidence: Array.isArray(gap.requiredEvidence)
        ? gap.requiredEvidence.filter(Boolean).slice(0, 5).map(String)
        : [],
    }));

    const statusCounts: Record<CapabilityLedgerState, number> = {
      VERIFIED_EVIDENCE: 0,
      VERIFIED_REGISTRY_ONLY: 0,
      REVALIDATION_REQUIRED: 0,
      IMPLEMENTED_UNVERIFIED: 0,
      UNASSESSED: 0,
    };
    for (const component of components) {
      statusCounts[component.state] += 1;
    }

    const snapshot: CapabilityLedgerSnapshot = {
      snapshotAt: new Date().toISOString(),
      registryCount: allComponents.length,
      assessedCount: components.length,
      componentsTruncated: allComponents.length > COMPONENT_LIMIT,
      components,
      openGapCountAtLeast: openGaps.length,
      gapsTruncated: fetchedGaps.length > GAP_LIMIT,
      openGaps,
      historyCount: this.readHistory().length,
      statusCounts,
    };

    if (recordHistory) {
      this.recordHistory(snapshot);
      snapshot.historyCount = this.readHistory().length;
    }
    return snapshot;
  }

  public assessGoal(goal: string, limit = 8): CapabilityLedgerAssessment {
    const snapshot = this.getSnapshot(false);
    const queryTokens = this.tokens(goal);
    const querySet = new Set(queryTokens);
    const candidates: CapabilityLedgerCandidate[] = [];

    for (const component of snapshot.components) {
      const sourceTokens = new Set(
        this.tokens([
          component.id,
          component.purpose,
          component.entryPoint,
          component.registryStatus,
        ].join(' ')),
      );
      const matchedTerms = queryTokens.filter((token) => sourceTokens.has(token));
      if (matchedTerms.length === 0) continue;

      candidates.push({
        ...component,
        matchScore: querySet.size
          ? Math.round((new Set(matchedTerms).size / querySet.size) * 100)
          : 0,
        matchedTerms: [...new Set(matchedTerms)].slice(0, 12),
      });
    }

    candidates.sort(
      (a, b) =>
        b.matchScore - a.matchScore ||
        b.confidence - a.confidence ||
        a.id.localeCompare(b.id),
    );

    const selected = candidates.slice(0, Math.max(1, Math.min(12, limit)));
    return {
      goal: goal.slice(0, 400),
      registryCount: snapshot.registryCount,
      checkedCount: snapshot.assessedCount,
      componentsTruncated: snapshot.componentsTruncated,
      candidates: selected,
      summary:
        `語句一致による候補=${candidates.length}件、表示候補=${selected.length}件、` +
        `台帳評価=${snapshot.assessedCount}/${snapshot.registryCount}件。候補一致は能力の証明ではない。`,
      noCandidateIsNotProofOfAbsence: true,
    };
  }

  private tokens(text: string): string[] {
    const result = new Set<string>();
    const lower = String(text || '').toLowerCase();

    for (const token of lower.match(/[a-z0-9_]{2,}/g) || []) {
      result.add(token);
    }
    for (const group of lower.match(/[\u3040-\u30ff\u3400-\u9fff]+/g) || []) {
      if (group.length >= 2 && group.length <= 30) result.add(group);
      for (let index = 0; index + 1 < group.length; index += 1) {
        result.add(group.slice(index, index + 2));
      }
    }
    return [...result].slice(0, 100);
  }

  public buildCoreContext(goal: string): string {
    const snapshot = this.getSnapshot(false);
    const assessment = this.assessGoalFromSnapshot(goal, snapshot, 4);
    const candidates = assessment.candidates.length
      ? assessment.candidates
          .map((item) => `${item.id}[${item.state},score=${item.matchScore}]`)
          .join(', ')
      : '一致候補なし（一致なしは能力不在の証拠ではない）';

    const gaps = snapshot.openGaps
      .slice(0, 3)
      .map((gap) => `${gap.id}:${gap.type}:${gap.query.slice(0, 90)}`)
      .join(' / ') || '取得範囲ではOPEN/RESEARCHINGを確認できない';

    return [
      '自己能力台帳（自己改善Task用・要約）',
      `Registry=${snapshot.registryCount}, evaluated=${snapshot.assessedCount}, truncated=${snapshot.componentsTruncated}`,
      `根拠付き成功実行確認=${snapshot.statusCounts.VERIFIED_EVIDENCE}`,
      `Registryのみ検証済み=${snapshot.statusCounts.VERIFIED_REGISTRY_ONLY}`,
      `再検証要求=${snapshot.statusCounts.REVALIDATION_REQUIRED}`,
      `実装未検証=${snapshot.statusCounts.IMPLEMENTED_UNVERIFIED}`,
      `未評価=${snapshot.statusCounts.UNASSESSED}`,
      `目標候補=${candidates}`,
      `未解決Knowledge Gap=${gaps}`,
      '一致候補は能力証明ではない。一致なしは能力不在の証拠ではない。自動昇格・Gap解決・成功記録は行わない。',
    ].join('\n').slice(0, 1800);
  }

  private assessGoalFromSnapshot(
    goal: string,
    snapshot: CapabilityLedgerSnapshot,
    limit: number,
  ): CapabilityLedgerAssessment {
    const tokens = this.tokens(goal);
    const tokenSet = new Set(tokens);
    const candidates: CapabilityLedgerCandidate[] = [];

    for (const component of snapshot.components) {
      const sourceTokens = new Set(
        this.tokens(`${component.id} ${component.purpose} ${component.entryPoint} ${component.registryStatus}`),
      );
      const matchedTerms = tokens.filter((token) => sourceTokens.has(token));
      if (matchedTerms.length === 0) continue;

      candidates.push({
        ...component,
        matchScore: tokenSet.size
          ? Math.round((new Set(matchedTerms).size / tokenSet.size) * 100)
          : 0,
        matchedTerms: [...new Set(matchedTerms)].slice(0, 12),
      });
    }

    candidates.sort(
      (a, b) =>
        b.matchScore - a.matchScore ||
        b.confidence - a.confidence ||
        a.id.localeCompare(b.id),
    );

    return {
      goal: goal.slice(0, 400),
      registryCount: snapshot.registryCount,
      checkedCount: snapshot.assessedCount,
      componentsTruncated: snapshot.componentsTruncated,
      candidates: candidates.slice(0, Math.max(1, Math.min(12, limit))),
      summary:
        `語句一致による候補=${candidates.length}件、` +
        `表示候補=${Math.min(candidates.length, limit)}件。能力の確定には実装と根拠の検証が必要。`,
      noCandidateIsNotProofOfAbsence: true,
    };
  }

  public toText(snapshot: CapabilityLedgerSnapshot = this.getSnapshot(false)): string {
    const lines = [
      'MIKI-AI 自己能力台帳',
      `snapshotAt=${snapshot.snapshotAt}`,
      `registryCount=${snapshot.registryCount}`,
      `assessedCount=${snapshot.assessedCount}`,
      `componentsTruncated=${snapshot.componentsTruncated}`,
      `openGapCountAtLeast=${snapshot.openGapCountAtLeast}`,
      `gapsTruncated=${snapshot.gapsTruncated}`,
      `historyCount=${snapshot.historyCount}`,
      '',
      '【状態数】',
      ...Object.entries(snapshot.statusCounts).map(([key, value]) => `${key}=${value}`),
      '',
      '【能力一覧・最大500件】',
    ];

    for (const component of snapshot.components) {
      lines.push(
        `[${component.state}] ${component.id} | registry=${component.registryStatus} | ` +
        `hash=${component.implementationHash || 'NONE'} | confidence=${component.confidence} | ` +
        `samples=${component.sampleCount} | successes=${component.successes} | ` +
        `failures=${component.failures} | artifact=${component.artifactAvailable} | ` +
        `${component.purpose} | ${component.reason}`,
      );
    }

    lines.push('', '【未解決Knowledge Gap・最大500件】');
    for (const gap of snapshot.openGaps) {
      lines.push(
        `[${gap.status}] priority=${gap.priority} ${gap.id} ${gap.type} | ${gap.query} | ${gap.reason}`,
      );
      if (gap.requiredEvidence.length) {
        lines.push(`  requiredEvidence=${gap.requiredEvidence.join(' / ')}`);
      }
    }

    lines.push(
      '',
      '判定境界: 語句一致は能力証明ではない。一致候補なしは能力不在の証拠ではない。',
      '自動的にCapability GapやKnowledge Gapを解決せず、Claimや部品を昇格させない。',
    );
    return lines.join('\n') + '\n';
  }
}

export const capabilityLedgerService = new CapabilityLedgerService();
