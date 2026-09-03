import {
  MemoryItem,
  TaskPlan,
  CodeProposal,
  TeacherGeneratedMaterial,
  VbaSafetyAssessment
} from '../types';

export interface ValidationResult<T> {
  valid: boolean;
  data?: T;
  errors: string[];
}

/**
 * 構造化データのJSON Schema定義 & ランタイム検証サービス (設計思想 8. JSON Schemaと構造化DB)
 */
export class SchemaValidationService {
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
