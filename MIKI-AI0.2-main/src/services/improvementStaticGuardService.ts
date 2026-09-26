import { ComponentTxtPackage } from '../types';
import { componentRegistryService } from './componentRegistryService';
import { systemLogger } from './systemLogger';

export type ImprovementGuardSeverity = 'ERROR' | 'WARNING';
export interface ImprovementGuardIssue {
  severity: ImprovementGuardSeverity;
  code: string;
  message: string;
}
export interface ImprovementGuardResult {
  passed: boolean;
  issues: ImprovementGuardIssue[];
  normalizedHash: string;
  checkedAt: number;
}

/**
 * Cloud AI改善案を候補化する直前の静的安全境界。
 * 実行・VERIFIED昇格・権限変更は行わない。
 */
export class ImprovementStaticGuardService {
  private static instance: ImprovementStaticGuardService;
  private constructor() {}
  public static getInstance() {
    return this.instance || (this.instance = new ImprovementStaticGuardService());
  }

  public inspect(base: ComponentTxtPackage, candidateCode: string): ImprovementGuardResult {
    const issues: ImprovementGuardIssue[] = [];
    const code = candidateCode.trim();
    const lower = code.toLowerCase();

    if (!code) this.error(issues, 'EMPTY_IMPLEMENTATION', '改善実装が空です。');

    // 候補コードからの任意実行・外部送信・権限昇格を明示的に拒否。
    const forbidden: Array<[string, RegExp, string]> = [
      ['PROCESS_EXECUTION', /\b(shell|exec|spawn|fork|runtime\.getruntime|processbuilder|child_process)\b/i, 'プロセス/シェル実行は候補段階で禁止です。'],
      ['NETWORK_SIDE_EFFECT', /\b(http|https|fetch\s*\(|axios|webrequest|xmlhttp|winhttp|socket|websocket)\b/i, '外部通信を伴う実装は自動改善候補として禁止です。'],
      ['FILE_SYSTEM_ESCAPE', /(?:\.\.\/|\.\.\\|file:\/\/|readfilesync|writefilesync|deletefilesync|open\s+for\s+(?:output|append|binary))/i, '任意ファイルシステム操作は候補段階で禁止です。'],
      ['SECRET_ACCESS', /\b(api[_-]?key|access[_-]?token|secret|password|credential|private[_-]?key)\b/i, '資格情報・秘密情報へのアクセスを示す語を検出しました。'],
      ['PRIVILEGE_ESCALATION', /\b(sudo|su\s+|chmod\s+7|setuid|root|administrator|privileged)\b/i, '権限昇格を示す処理は禁止です。'],
      ['DYNAMIC_EVAL', /\b(eval|new\s+function|function\s*\(|vm\.run|compile\s*\()/i, '動的コード評価は候補段階で禁止です。'],
    ];
    for (const [codeId, pattern, message] of forbidden) {
      if (pattern.test(code)) this.error(issues, codeId, message);
    }

    // 改善版でも契約を壊さない。ENTRY_POINTは可能なら文字列として保持する。
    if (base.entry_point && !this.containsIdentifier(code, base.entry_point)) {
      this.error(issues, 'ENTRY_POINT_CHANGED', `ENTRY_POINT「${base.entry_point}」が候補実装に見つかりません。`);
    }
    for (const input of base.inputs || []) {
      if (input.name && !this.containsIdentifier(code, input.name)) {
        this.warn(issues, 'INPUT_CONTRACT_UNCLEAR', `入力「${input.name}」の参照を静的に確認できません。`);
      }
    }

    // 宣言された依存関係を勝手に増やさない。
    const declaredDeps = new Set((base.dependencies || []).map(String).map(v => v.toLowerCase()));
    const importLike = code.match(/(?:import\s+[^;]+from\s+['"]([^'"]+)['"]|require\s*\(\s*['"]([^'"]+)['"]\s*\)|^\s*(?:references?|dependency)\s*:\s*(\S+))/gim) || [];
    for (const line of importLike) {
      const m = line.match(/['"]([^'"]+)['"]['"]?|:\s*(\S+)$/);
      const dep = (m?.[1] || m?.[2] || '').toLowerCase();
      if (dep && !declaredDeps.has(dep)) this.error(issues, 'NEW_DEPENDENCY', `未宣言の依存関係「${dep}」を検出しました。`);
    }

    // SECURITY_CLASSを自動で強くしない。
    const baseSecurity = String(base.security_class || 'READ_ONLY').toUpperCase();
    const inferredNetwork = /\b(http|https|fetch|axios|socket|webrequest)\b/i.test(code);
    const inferredProcess = /\b(shell|exec|spawn|processbuilder|child_process)\b/i.test(code);
    if (baseSecurity === 'READ_ONLY' && /\b(write|save|delete|remove|update)\b/i.test(lower)) {
      this.error(issues, 'SIDE_EFFECT_ESCALATION', 'READ_ONLY部品に書込み系処理を追加する変更は自動採用できません。');
    }
    if (inferredNetwork || inferredProcess) {
      this.error(issues, 'SECURITY_CLASS_ESCALATION', 'ネットワーク/プロセス実行を伴う候補は自動改善境界を越えます。');
    }

    const result: ImprovementGuardResult = {
      passed: !issues.some(i => i.severity === 'ERROR'),
      issues,
      normalizedHash: this.hash(this.normalize(code)),
      checkedAt: Date.now(),
    };
    systemLogger.info('SELF_IMPROVEMENT', `🔎 [ImprovementStaticGuard] ${base.component_id}: ${result.passed ? 'PASS' : 'REJECT'} issues=${issues.length}`);
    return result;
  }

  private containsIdentifier(code: string, identifier: string) {
    const escaped = identifier.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`\\b${escaped}\\b`, 'i').test(code);
  }
  private normalize(value: string) { return value.replace(/\s+/g, ' ').trim().toLowerCase(); }
  private error(issues: ImprovementGuardIssue[], code: string, message: string) { issues.push({ severity: 'ERROR', code, message }); }
  private warn(issues: ImprovementGuardIssue[], code: string, message: string) { issues.push({ severity: 'WARNING', code, message }); }
  private hash(raw: string) { let h=2166136261; for(let i=0;i<raw.length;i++){h^=raw.charCodeAt(i);h=Math.imul(h,16777619);} return (h>>>0).toString(16).padStart(8,'0'); }
}
export const improvementStaticGuardService = ImprovementStaticGuardService.getInstance();
