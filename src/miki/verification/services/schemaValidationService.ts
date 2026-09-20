import {
  MemoryItem,
  TaskPlan,
  CodeProposal,
  TeacherGeneratedMaterial,
  VbaSafetyAssessment
} from '../../../types';
import { canonicalSha256Object } from '../../core/services/canonicalSha256Service';

export interface ValidationResult<T> {
  valid: boolean;
  data?: T;
  errors: string[];
}


/**
 * COREがTask Blackboardから導出する単一CognitiveStateの検証・Migration契約。
 * Truth DBではなく、既存Task Blackboardへcommitする前の安全ゲートとして使用する。
 */
export interface UnifiedCognitiveStateV2 {
  schemaVersion: 2;
  taskId: string;
  cycle: number;
  revision: number;
  goal: string;
  input: string;
  source: string;
  constraints: string[];
  activeDomains: string[];
  requiredDomains: string[];
  pendingIntentIds: string[];
  evidenceIds: string[];
  unknowns: string[];
  capabilityRefs: string[];
  recentOutcomes: Array<{ kind: string; domain: string; key: string; status?: string }>;
  learningCandidates: Array<{ domain: string; key: string; valueHash: string }>;
  environmentSignature?: string;
  invariantsVersion: 1;
  stateHash: string;
}

const UNIFIED_COGNITIVE_STATE_DOMAINS = new Set([
  'core','autonomy','capability','conversation','data','execution','experience','improvement',
  'learning','memory','promotion','research','safety','selfAwareness','selfDevelopment',
  'strategy','unknown','verification'
]);

function cognitiveStateBody(value: Record<string, unknown>): Record<string, unknown> {
  const { stateHash: _ignored, ...body } = value;
  return body;
}

/**
 * 構造化データのJSON Schema定義 & ランタイム検証サービス (設計思想 8. JSON Schemaと構造化DB)
 */
export class SchemaValidationService {
  /**
   * UnifiedCognitiveStateのInvariant検査。状態保存前にのみ使用し、失敗時はcommitしない。
   */
  public validateUnifiedCognitiveState(input: any): ValidationResult<UnifiedCognitiveStateV2> {
    const errors: string[] = [];
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      return { valid: false, errors: ['COGNITIVE_STATE_NOT_OBJECT'] };
    }
    if (input.schemaVersion !== 2) errors.push('COGNITIVE_STATE_SCHEMA_V2_REQUIRED');
    if (typeof input.taskId !== 'string' || !input.taskId.trim()) errors.push('COGNITIVE_STATE_TASK_ID_REQUIRED');
    if (typeof input.goal !== 'string' || !input.goal.trim()) errors.push('COGNITIVE_STATE_GOAL_REQUIRED');
    if (typeof input.input !== 'string') errors.push('COGNITIVE_STATE_INPUT_REQUIRED');
    if (typeof input.source !== 'string' || !input.source.trim()) errors.push('COGNITIVE_STATE_SOURCE_REQUIRED');
    if (!Number.isInteger(input.cycle) || input.cycle < 0) errors.push('COGNITIVE_STATE_CYCLE_INVALID');
    if (!Number.isInteger(input.revision) || input.revision < 0) errors.push('COGNITIVE_STATE_REVISION_INVALID');
    if (input.invariantsVersion !== 1) errors.push('COGNITIVE_STATE_INVARIANT_VERSION_INVALID');

    const arrays: Array<[string, unknown]> = [
      ['constraints', input.constraints],
      ['activeDomains', input.activeDomains],
      ['requiredDomains', input.requiredDomains],
      ['pendingIntentIds', input.pendingIntentIds],
      ['evidenceIds', input.evidenceIds],
      ['unknowns', input.unknowns],
      ['capabilityRefs', input.capabilityRefs],
      ['recentOutcomes', input.recentOutcomes],
      ['learningCandidates', input.learningCandidates],
    ];
    for (const [name, value] of arrays) if (!Array.isArray(value)) errors.push(`COGNITIVE_STATE_${name.toUpperCase()}_ARRAY_REQUIRED`);

    const domainArrays = [input.activeDomains, input.requiredDomains].filter(Array.isArray);
    for (const list of domainArrays as unknown[][]) {
      const seen = new Set<string>();
      for (const value of list) {
        if (typeof value !== 'string' || !value.trim()) errors.push('COGNITIVE_STATE_DOMAIN_VALUE_INVALID');
        else {
          if (!UNIFIED_COGNITIVE_STATE_DOMAINS.has(value)) errors.push(`COGNITIVE_STATE_UNKNOWN_DOMAIN:${value}`);
          if (seen.has(value)) errors.push(`COGNITIVE_STATE_DUPLICATE_DOMAIN:${value}`);
          seen.add(value);
        }
      }
    }

    const intentIds = Array.isArray(input.pendingIntentIds) ? input.pendingIntentIds : [];
    if (intentIds.some((x: unknown) => typeof x !== 'string' || !x.trim())) errors.push('COGNITIVE_STATE_PENDING_INTENT_INVALID');
    if (new Set(intentIds).size !== intentIds.length) errors.push('COGNITIVE_STATE_PENDING_INTENT_DUPLICATE');

    const evidenceIds = Array.isArray(input.evidenceIds) ? input.evidenceIds : [];
    if (evidenceIds.some((x: unknown) => typeof x !== 'string' || !x.trim())) errors.push('COGNITIVE_STATE_EVIDENCE_ID_INVALID');
    if (new Set(evidenceIds).size !== evidenceIds.length) errors.push('COGNITIVE_STATE_EVIDENCE_DUPLICATE');

    if (!Array.isArray(input.recentOutcomes) || input.recentOutcomes.some((x: unknown) => !x || typeof x !== 'object')) {
      errors.push('COGNITIVE_STATE_OUTCOME_RECORD_INVALID');
    }
    if (!Array.isArray(input.learningCandidates) || input.learningCandidates.some((x: unknown) => !x || typeof x !== 'object')) {
      errors.push('COGNITIVE_STATE_LEARNING_CANDIDATE_INVALID');
    }
    if (input.environmentSignature !== undefined && typeof input.environmentSignature !== 'string') errors.push('COGNITIVE_STATE_ENVIRONMENT_SIGNATURE_INVALID');
    if (typeof input.stateHash !== 'string' || !/^[a-f0-9]{64}$/i.test(input.stateHash)) errors.push('COGNITIVE_STATE_HASH_INVALID');

    if (!errors.length) {
      const expected = canonicalSha256Object(cognitiveStateBody(input));
      if (expected !== String(input.stateHash).toLowerCase()) errors.push('COGNITIVE_STATE_HASH_MISMATCH');
    }
    return { valid: errors.length === 0, data: errors.length === 0 ? input as UnifiedCognitiveStateV2 : undefined, errors };
  }

  /**
   * 旧schemaVersion=1をV2へ移行する。意味を推測して補完せず、追加フィールドは安全な空配列で初期化する。
   */
  public migrateUnifiedCognitiveState(input: any): ValidationResult<UnifiedCognitiveStateV2> {
    if (!input || typeof input !== 'object' || Array.isArray(input)) return { valid: false, errors: ['COGNITIVE_STATE_NOT_OBJECT'] };
    if (input.schemaVersion === 2) return this.validateUnifiedCognitiveState(input);
    if (input.schemaVersion !== 1) return { valid: false, errors: ['COGNITIVE_STATE_UNSUPPORTED_SCHEMA'] };
    const body: Record<string, unknown> = {
      schemaVersion: 2,
      taskId: String(input.taskId || ''),
      cycle: Number.isInteger(input.cycle) ? input.cycle : 0,
      revision: Number.isInteger(input.revision) ? input.revision : 0,
      goal: typeof input.goal === 'string' ? input.goal : '',
      input: typeof input.input === 'string' ? input.input : '',
      source: typeof input.source === 'string' ? input.source : 'core',
      constraints: Array.isArray(input.constraints) ? input.constraints.filter((x: unknown): x is string => typeof x === 'string' && x.trim()).map((x: string) => x.trim()) : [],
      activeDomains: Array.isArray(input.activeDomains) ? [...new Set(input.activeDomains.filter((x: unknown): x is string => typeof x === 'string' && UNIFIED_COGNITIVE_STATE_DOMAINS.has(x)))] : [],
      requiredDomains: Array.isArray(input.requiredDomains) ? [...new Set(input.requiredDomains.filter((x: unknown): x is string => typeof x === 'string' && UNIFIED_COGNITIVE_STATE_DOMAINS.has(x)))] : [],
      pendingIntentIds: Array.isArray(input.pendingIntentIds) ? [...new Set(input.pendingIntentIds.filter((x: unknown): x is string => typeof x === 'string' && x.trim()))] : [],
      evidenceIds: Array.isArray(input.evidenceIds) ? [...new Set(input.evidenceIds.filter((x: unknown): x is string => typeof x === 'string' && x.trim()))] : [],
      unknowns: Array.isArray(input.unknowns) ? input.unknowns.filter((x: unknown): x is string => typeof x === 'string' && x.trim()) : [],
      capabilityRefs: Array.isArray(input.capabilityRefs) ? input.capabilityRefs.filter((x: unknown): x is string => typeof x === 'string' && x.trim()) : [],
      recentOutcomes: Array.isArray(input.recentOutcomes) ? input.recentOutcomes : [],
      learningCandidates: Array.isArray(input.learningCandidates) ? input.learningCandidates : [],
      environmentSignature: typeof input.environmentSignature === 'string' ? input.environmentSignature : undefined,
      invariantsVersion: 1,
    };
    const migrated = { ...body, stateHash: canonicalSha256Object(body) };
    const result = this.validateUnifiedCognitiveState(migrated);
    return result.valid ? result : { valid: false, errors: ['COGNITIVE_STATE_MIGRATION_FAILED', ...result.errors] };
  }

  /**
   * 記憶アイテム (MemoryItem) のスキーマ検証
   */
  public validateMemoryItem(input: any): ValidationResult<MemoryItem> {
    const errors: string[] = [];
    if (!input || typeof input !== 'object') {
      return { valid: false, errors: ['Input must be a non-null object'] };
    }

    if (typeof input.id !== 'string' || input.id.trim().length === 0) {
      errors.push('id must be a non-empty string');
    }

    const validCategories = ['chat', 'relationship', 'gamedev', 'preference', 'profile', 'memory', 'vba', 'code'];
    if (!validCategories.includes(input.category)) {
      errors.push(`category must be one of: ${validCategories.join(', ')}`);
    }

    if (typeof input.content !== 'string' || input.content.trim().length === 0) {
      errors.push('content must be a non-empty string');
    }

    if (input.importance !== undefined && (typeof input.importance !== 'number' || input.importance < 0 || input.importance > 1)) {
      errors.push('importance must be a number between 0.0 and 1.0');
    }

    if (input.memoryType !== undefined) {
      const validTypes = ['raw', 'structural', 'semantic', 'episodic', 'procedural', 'meta', 'working'];
      if (!validTypes.includes(input.memoryType)) {
        errors.push(`memoryType must be one of: ${validTypes.join(', ')}`);
      }
    }

    return {
      valid: errors.length === 0,
      data: errors.length === 0 ? (input as MemoryItem) : undefined,
      errors,
    };
  }

  /**
   * コード提案 (CodeProposal) のスキーマ検証
   */
  public validateCodeProposal(input: any): ValidationResult<CodeProposal> {
    const errors: string[] = [];
    if (!input || typeof input !== 'object') {
      return { valid: false, errors: ['Input must be a non-null object'] };
    }

    if (typeof input.id !== 'string' || input.id.trim().length === 0) {
      errors.push('id must be a non-empty string');
    }

    if (!Array.isArray(input.files) || input.files.length === 0) {
      errors.push('files must be a non-empty array of ProposedCodeFile');
    } else {
      input.files.forEach((file: any, index: number) => {
        if (!file || typeof file !== 'object') {
          errors.push(`files[${index}] must be an object`);
        } else {
          if (typeof file.path !== 'string') errors.push(`files[${index}].path must be a string`);
          if (typeof file.name !== 'string') errors.push(`files[${index}].name must be a string`);
          if (typeof file.content !== 'string') errors.push(`files[${index}].content must be a string`);
        }
      });
    }

    const validStatus = ['pending', 'applied', 'rejected'];
    if (!validStatus.includes(input.status)) {
      errors.push(`status must be one of: ${validStatus.join(', ')}`);
    }

    return {
      valid: errors.length === 0,
      data: errors.length === 0 ? (input as CodeProposal) : undefined,
      errors,
    };
  }

  /**
   * 外部教師教材 (TeacherGeneratedMaterial) のスキーマ検証
   */
  public validateTeacherMaterial(input: any): ValidationResult<TeacherGeneratedMaterial> {
    const errors: string[] = [];
    if (!input || typeof input !== 'object') {
      return { valid: false, errors: ['Input must be a non-null object'] };
    }

    if (typeof input.instruction !== 'string' || input.instruction.trim().length < 5) {
      errors.push('instruction must be a string of at least 5 characters');
    }

    if (typeof input.outputTarget !== 'string' || input.outputTarget.trim().length < 5) {
      errors.push('outputTarget must be a string of at least 5 characters');
    }

    if (input.instruction === input.outputTarget) {
      errors.push('instruction and outputTarget cannot be identical');
    }

    return {
      valid: errors.length === 0,
      data: errors.length === 0 ? (input as TeacherGeneratedMaterial) : undefined,
      errors,
    };
  }

  /**
   * VBAスクリプトの安全検証ゲート (設計思想 10. VBA準備ゲート)
   */
  public evaluateVbaSafety(code: string): VbaSafetyAssessment {
    const warnings: string[] = [];
    const codeLower = code.toLowerCase();

    // 1. ファイルシステム操作の検査
    const fsPatterns = [
      'filesystemobject',
      'scripting.filesystemobject',
      'kill ',
      'rmdir ',
      'mkdir ',
      'open ',
      'for output',
      'for append',
      'binary'
    ];
    const hasFileSystemAccess = fsPatterns.some((pat) => codeLower.includes(pat));
    if (hasFileSystemAccess) {
      warnings.push('ローカルファイルシステムの読み書き・削除コマンドが含まれています');
    }

    // 2. シェル・外部コマンド実行の検査
    const shellPatterns = [
      'wscript.shell',
      'shell(',
      'cmd.exe',
      'powershell',
      'createobject("wscript.shell")',
      'createobject("shell.application")'
    ];
    const hasShellExecution = shellPatterns.some((pat) => codeLower.includes(pat));
    if (hasShellExecution) {
      warnings.push('外部シェルコマンド(cmd/PowerShell)の実行命令が含まれています');
    }

    // 3. 外部ネットワークアクセスの検査
    const netPatterns = [
      'msxml2.xmlhttp',
      'msxml2.serverxmlhttp',
      'winhttp.winhttprequest',
      'urldownloadtofile'
    ];
    const hasNetworkCall = netPatterns.some((pat) => codeLower.includes(pat));
    if (hasNetworkCall) {
      warnings.push('外部URLへの通信・ダウンロードAPI呼び出しが含まれています');
    }

    // 4. 自動実行イベントの検査
    const autoPatterns = [
      'workbook_open',
      'auto_open',
      'document_open',
      'workbook_beforesave'
    ];
    const hasAutoExecEvent = autoPatterns.some((pat) => codeLower.includes(pat));
    if (hasAutoExecEvent) {
      warnings.push('ファイル開封時に自動実行されるマクロイベントが設定されています');
    }

    // 総合ステータス決定
    let status: VbaSafetyAssessment['status'] = 'safe';
    if (hasShellExecution) {
      status = 'restricted';
    } else if (hasFileSystemAccess || hasNetworkCall || hasAutoExecEvent) {
      status = 'warning';
    }

    let targetApplication: VbaSafetyAssessment['targetApplication'] = 'Excel';
    if (codeLower.includes('access.') || codeLower.includes('currentdb') || codeLower.includes('docmd')) {
      targetApplication = 'Access';
    } else if (codeLower.includes('activedocument') || codeLower.includes('selection.typetext')) {
      targetApplication = 'Word';
    }

    return {
      status,
      hasFileSystemAccess,
      hasShellExecution,
      hasNetworkCall,
      hasAutoExecEvent,
      warnings,
      reviewed: false,
      targetApplication,
    };
  }
}

export const schemaValidationService = new SchemaValidationService();
