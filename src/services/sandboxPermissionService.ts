/**
 * 設計思想 第169章: 未知環境安全探索・段階権限昇格 (Least-Privilege Sandbox & Gradual Permission Escalation)
 *
 * 【目的】
 * 1. 初めて実行される外部スクリプトやツール、未知のAPI呼び出しに対して、
 *    読み取り専用・ネットワーク遮断の「最小権限サンドボックス（Level 0）」で探索させる。
 * 2. 安全性実績（エラー率ゼロ、不変条件違反ゼロ、副作用なし）が証明された段階でのみ、
 *    Level 1（ローカル書き込み）➔ Level 2（外部制限通信）➔ Level 3（全機能解放）へと段階的に昇格する。
 * 3. 異常な挙動を検知した瞬間、即座に権限をLevel 0へ強制降格（Revoke）する。
 */

import { systemLogger } from './systemLogger';

export type SandboxPermissionLevel =
  | 'LEVEL_0_ISOLATED_READ_ONLY'
  | 'LEVEL_1_LOCAL_SCRATCHPAD'
  | 'LEVEL_2_OUTBOUND_CONFIRMED'
  | 'LEVEL_3_FULL_INTEGRATION';

export interface SandboxExecutionContext {
  toolOrScriptId: string;
  currentLevel: SandboxPermissionLevel;
  totalInvocations: number;
  successfulInvocations: number;
  violationsCount: number;
  isEscalationEligible: boolean;
  registeredAt: string;
}

class SandboxPermissionService {
  private contexts: Map<string, SandboxExecutionContext> = new Map();

  /**
   * 未知ツールのサンドボックス登録
   */
  public registerTool(toolId: string): SandboxExecutionContext {
    const ctx: SandboxExecutionContext = {
      toolOrScriptId: toolId,
      currentLevel: 'LEVEL_0_ISOLATED_READ_ONLY',
      totalInvocations: 0,
      successfulInvocations: 0,
      violationsCount: 0,
      isEscalationEligible: false,
      registeredAt: new Date().toISOString(),
    };

    this.contexts.set(toolId, ctx);
    systemLogger.info('SELF_IMPROVEMENT', `[第169章 サンドボックス] ツール「${toolId}」を最小権限 (Level 0: 隔離読取専用) で登録しました`);
    return ctx;
  }

  /**
   * 実行記録と安全実績による権限昇格判定
   */
  public recordExecution(toolId: string, hadViolation: boolean): SandboxExecutionContext {
    let ctx = this.contexts.get(toolId);
    if (!ctx) {
      ctx = this.registerTool(toolId);
    }

    ctx.totalInvocations++;
    if (hadViolation) {
      ctx.violationsCount++;
      ctx.currentLevel = 'LEVEL_0_ISOLATED_READ_ONLY'; // 違反時は即時Level 0へ降格
      ctx.isEscalationEligible = false;
      systemLogger.warn('SELF_IMPROVEMENT', `🚨 [第169章 権限剥奪] ツール「${toolId}」で違反を検知。Level 0へ強制降格しました`);
    } else {
      ctx.successfulInvocations++;
      // 成功回数に応じて昇格可能フラグを更新
      if (ctx.successfulInvocations >= 5 && ctx.violationsCount === 0) {
        ctx.isEscalationEligible = true;
      }
    }

    return ctx;
  }

  /**
   * 段階的権限昇格を実行
   */
  public escalatePermission(toolId: string): boolean {
    const ctx = this.contexts.get(toolId);
    if (!ctx || !ctx.isEscalationEligible) return false;

    if (ctx.currentLevel === 'LEVEL_0_ISOLATED_READ_ONLY') {
      ctx.currentLevel = 'LEVEL_1_LOCAL_SCRATCHPAD';
    } else if (ctx.currentLevel === 'LEVEL_1_LOCAL_SCRATCHPAD') {
      ctx.currentLevel = 'LEVEL_2_OUTBOUND_CONFIRMED';
    } else if (ctx.currentLevel === 'LEVEL_2_OUTBOUND_CONFIRMED') {
      ctx.currentLevel = 'LEVEL_3_FULL_INTEGRATION';
    }

    ctx.isEscalationEligible = false;
    systemLogger.info('SELF_IMPROVEMENT', `🛡️ [第169章 権限昇格] ツール「${toolId}」の安全実績を確認し、権限を [${ctx.currentLevel}] へ昇格しました`);
    return true;
  }

  public getContext(toolId: string): SandboxExecutionContext | undefined {
    return this.contexts.get(toolId);
  }
}

export const sandboxPermissionService = new SandboxPermissionService();
