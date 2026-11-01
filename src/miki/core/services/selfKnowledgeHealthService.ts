import { storageService } from '../../../services/storageService';
import { reusableComponentFactoryService } from './reusableComponentFactoryService';
import { selfCodeSpaceService } from './selfCodeSpaceService';
import { selfCodeUnderstandingService } from './selfCodeUnderstandingService';

// P375: self-inventory health. MIKI's work stands on its own grasp
// of its parts and knowledge (the built-in catalog, the self-code
// source and index, the improvement loop's persisted queue). When
// one of those bases silently breaks, everything downstream fails
// in confusing ways — the catalog seed defect fixed in P369 was
// only found from the outside. These checks let MIKI notice the
// breakage itself and report it in one place. A FAIL blocks the
// self-improvement preflight; a WARN (for example a stale index,
// which rebuilds itself) is surfaced but does not block.
export type SelfKnowledgeCheckStatus = 'OK' | 'WARN' | 'FAIL';
export interface SelfKnowledgeHealthCheck {
  id: string;
  status: SelfKnowledgeCheckStatus;
  detail: string;
}
export interface SelfKnowledgeHealthReport {
  status: 'OK' | 'DEGRADED' | 'BROKEN';
  checks: SelfKnowledgeHealthCheck[];
  checkedAt: number;
}

const REPORT_KEY = 'miki_self_knowledge_health_v1';
const LOOP_KEY = 'miki_autonomous_self_improvement_loop_v2';

class SelfKnowledgeHealthService {
  check(): SelfKnowledgeHealthReport {
    const checks: SelfKnowledgeHealthCheck[] = [];

    const probe = reusableComponentFactoryService.probeBuiltInCatalog();
    checks.push({
      id: 'KNOWLEDGE_CATALOG_BUILDS',
      status: probe.ok ? 'OK' : 'FAIL',
      detail: probe.ok ? `catalog entries=${probe.count}` : `catalog build failed: ${probe.error || 'EMPTY'}`,
    });

    const snapshot = selfCodeSpaceService.get();
    const manifest = selfCodeSpaceService.getLightManifest();
    const fullCount = snapshot?.files.length || 0;
    const lightCount = manifest?.files.length || 0;
    checks.push({
      id: 'SELF_CODE_SOURCE_PRESENT',
      status: fullCount > 0 || lightCount > 0 ? 'OK' : 'FAIL',
      detail: `full files=${fullCount}; light files=${lightCount}`,
    });

    const changeset = selfCodeSpaceService.getLightChangeset();
    if (manifest) {
      if (!manifest.commitSha) {
        checks.push({ id: 'LIGHT_MANIFEST_CONSISTENT', status: 'FAIL', detail: 'manifest commitSha empty' });
      } else if (changeset && changeset.baseCommitSha !== manifest.commitSha) {
        checks.push({
          id: 'LIGHT_MANIFEST_CONSISTENT',
          status: 'FAIL',
          detail: `changeset base ${changeset.baseCommitSha} != manifest commit ${manifest.commitSha}`,
        });
      } else {
        checks.push({
          id: 'LIGHT_MANIFEST_CONSISTENT',
          status: 'OK',
          detail: `commit=${manifest.commitSha}; pending changes=${changeset?.files.length || 0}`,
        });
      }
    } else {
      checks.push({
        id: 'LIGHT_MANIFEST_CONSISTENT',
        status: fullCount > 0 ? 'OK' : 'WARN',
        detail: 'no light manifest (classic full-snapshot mode)',
      });
    }

    const index = selfCodeUnderstandingService.getSnapshot();
    if (!index) {
      checks.push({ id: 'UNDERSTANDING_INDEX_FRESH', status: 'WARN', detail: 'no understanding index snapshot' });
    } else if (manifest?.commitSha && index.sourceCommitSha && index.sourceCommitSha !== manifest.commitSha) {
      checks.push({
        id: 'UNDERSTANDING_INDEX_FRESH',
        status: 'WARN',
        detail: `index source ${index.sourceCommitSha} != manifest commit ${manifest.commitSha}`,
      });
    } else {
      checks.push({
        id: 'UNDERSTANDING_INDEX_FRESH',
        status: 'OK',
        detail: `entries=${index.entries.length}; sourceCommit=${index.sourceCommitSha || 'none'}`,
      });
    }

    checks.push(this.loopPersistenceCheck());

    const status: SelfKnowledgeHealthReport['status'] = checks.some(item => item.status === 'FAIL')
      ? 'BROKEN'
      : checks.some(item => item.status === 'WARN')
        ? 'DEGRADED'
        : 'OK';
    const report: SelfKnowledgeHealthReport = { status, checks, checkedAt: Date.now() };
    try {
      storageService.setItem(REPORT_KEY, JSON.stringify(report));
    } catch {
      // Reporting must never break the caller.
    }
    return report;
  }

  private loopPersistenceCheck(): SelfKnowledgeHealthCheck {
    try {
      const raw = storageService.getItem(LOOP_KEY);
      if (raw === null) return { id: 'LOOP_PERSISTENCE_READABLE', status: 'OK', detail: 'no persisted loop state yet' };
      const parsed: unknown = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object' || !Array.isArray((parsed as { queue?: unknown }).queue)) {
        return { id: 'LOOP_PERSISTENCE_READABLE', status: 'FAIL', detail: 'loop state has no queue array' };
      }
      return {
        id: 'LOOP_PERSISTENCE_READABLE',
        status: 'OK',
        detail: `queued=${((parsed as { queue: unknown[] }).queue).length}`,
      };
    } catch (error) {
      return {
        id: 'LOOP_PERSISTENCE_READABLE',
        status: 'FAIL',
        detail: `loop state unreadable: ${String(error instanceof Error ? error.message : error)}`,
      };
    }
  }

  lastReport(): SelfKnowledgeHealthReport | undefined {
    try {
      const raw = storageService.getItem(REPORT_KEY);
      return raw ? (JSON.parse(raw) as SelfKnowledgeHealthReport) : undefined;
    } catch {
      return undefined;
    }
  }
}

export const selfKnowledgeHealthService = new SelfKnowledgeHealthService();
