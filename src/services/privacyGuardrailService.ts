import {
  PrivacyAuditResult,
  PrivacyAuditLogEntry,
  PrivacyViolationItem,
  OutboundDataClassification,
} from '../types';
import { storageService } from './storageService';
import { systemLogger } from './systemLogger';
import { abstractSanitizerService } from './abstractSanitizerService';
import { featureFlagsService } from './featureFlagsService';

const PRIVACY_AUDIT_LOG_KEY = 'miki_privacy_audit_logs_v5';
const MAX_AUDIT_LOGS = 50;

/**
 * 設計思想 Master v5.0 第11章 11.1節:
 * セキュリティ境界・プライバシー監査ガードレール (Privacy Guardrail Service)
 * 
 * - 外部送信可能: PUBLIC_SYNTHETIC (合成データ) および抽象シンボル化された ABSTRACTED のみ
 * - 送信絶対禁止: 個人情報、社内認証情報、未検査の生会話全文、実機ファイル
 */
class PrivacyGuardrailService {
  private auditLogs: PrivacyAuditLogEntry[] = [];

  constructor() {
    this.loadLogs();
  }

  private loadLogs(): void {
    try {
      const raw = storageService.getItem(PRIVACY_AUDIT_LOG_KEY);
      if (raw) {
        this.auditLogs = JSON.parse(raw);
      }
    } catch (e) {
      console.warn('Failed to load privacy audit logs:', e);
    }
  }

  public saveLogs(): void {
    try {
      storageService.setItem(PRIVACY_AUDIT_LOG_KEY, JSON.stringify(this.auditLogs.slice(-MAX_AUDIT_LOGS)));
    } catch (e) {
      console.warn('Failed to save privacy audit logs:', e);
    }
  }

  public getLogs(): PrivacyAuditLogEntry[] {
    return [...this.auditLogs];
  }

  public clearLogs(): void {
    this.auditLogs = [];
    storageService.removeItem(PRIVACY_AUDIT_LOG_KEY);
  }

  /**
   * 外部送信（教師API、Web検索、クラウド同期等）に先立ってコンテンツを監査
   */
  public auditOutboundContent(
    content: string,
    targetService: string = 'external_service',
    options?: { autoSanitize?: boolean; forceAllow?: boolean }
  ): PrivacyAuditResult {
    const flags = featureFlagsService.getFlags();
    const isGuardrailActive = flags.PRIVACY_GUARDRAIL !== 'DISABLED';
    const autoSanitize = options?.autoSanitize ?? (flags.ABSTRACT_SANITIZER !== 'DISABLED');

    if (!isGuardrailActive || options?.forceAllow) {
      return {
        allowed: true,
        classification: 'PUBLIC_SYNTHETIC',
        originalLength: (content || '').length,
        sanitizedText: content || '',
        violations: [],
        symbolReplacements: {},
        auditedAt: Date.now(),
        targetService,
      };
    }

    const text = content || '';
    const violations: PrivacyViolationItem[] = [];

    // 1. 認証情報・APIキー・シークレット
    const apiKeyMatches = text.match(/(?:sk-[a-zA-Z0-9_-]{20,}|ghp_[a-zA-Z0-9]{36}|AIza[0-9A-Za-z_-]{35}|Bearer\s+[a-zA-Z0-9._-]{24,})/g);
    if (apiKeyMatches) {
      for (const snippet of apiKeyMatches) {
        violations.push({
          type: 'CREDENTIAL',
          snippet: snippet.slice(0, 10) + '***',
          message: '外部APIキーまたは認証トークンが検出されました',
          severity: 'CRITICAL',
        });
      }
    }

    // 2. データベース接続情報 (DB Connection String with Password)
    const dbConnMatches = text.match(/(?:(?:Server|Data Source|Host)=[^;\n\r]+;?|(?:mongodb|postgresql|mysql|redis):\/\/[^\s\n\r"']+)/gi);
    if (dbConnMatches) {
      for (const snippet of dbConnMatches) {
        violations.push({
          type: 'DB_CONNECTION',
          snippet: snippet.slice(0, 30) + '...',
          message: '社内データベースまたは本番接続文字列が検出されました',
          severity: 'CRITICAL',
        });
      }
    }

    // 3. 社内ファイルパス (Windows/UNC/Linux Home)
    const pathMatches = text.match(/(?:[A-Za-z]:\\[^<>"|?*\n\r\t]{5,}|\\\\[a-zA-Z0-9._-]+\\[^<>"|?*\n\r\t]+|\/(?:home|Users)\/[a-zA-Z0-9._\-\/]{4,})/g);
    if (pathMatches) {
      for (const snippet of pathMatches) {
        violations.push({
          type: 'INTERNAL_PATH',
          snippet: snippet.slice(0, 35),
          message: '社内またはローカル実機のファイルパスが検出されました',
          severity: 'HIGH',
        });
      }
    }

    // 4. プライベートIP / 内部ホスト名
    const hostMatches = text.match(/\b(?:192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}|[a-zA-Z0-9._-]+\.(?:corp|internal|local))\b/g);
    if (hostMatches) {
      for (const snippet of hostMatches) {
        violations.push({
          type: 'INTERNAL_HOST',
          snippet,
          message: 'プライベートIPアドレスまたは社内ホスト名が検出されました',
          severity: 'HIGH',
        });
      }
    }

    // 5. 個人情報 (メールアドレス、電話番号)
    const emailMatches = text.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g);
    if (emailMatches) {
      for (const snippet of emailMatches) {
        violations.push({
          type: 'PII',
          snippet,
          message: '個人メールアドレスが検出されました',
          severity: 'MEDIUM',
        });
      }
    }

    const telMatches = text.match(/\b0\d{1,4}-\d{1,4}-\d{4}\b/g);
    if (telMatches) {
      for (const snippet of telMatches) {
        violations.push({
          type: 'PII',
          snippet,
          message: '電話番号が検出されました',
          severity: 'MEDIUM',
        });
      }
    }

    // 判定ロジック
    let allowed = true;
    let classification: OutboundDataClassification = 'PUBLIC_SYNTHETIC';
    let sanitizedText = text;
    let symbolReplacements: Record<string, string> = {};
    let blockedReason: string | undefined = undefined;

    if (violations.length > 0) {
      if (autoSanitize) {
        // 抽象シンボルサニタイザーによる自動置換を実行
        const sanitizeResult = abstractSanitizerService.sanitizeText(text);
        sanitizedText = sanitizeResult.sanitized;
        symbolReplacements = sanitizeResult.replacements;
        classification = 'ABSTRACTED';
        allowed = true;

        systemLogger.info(
          'SELF_IMPROVEMENT',
          `🛡️ [セキュリティ境界 11章] 機密項目を検知しましたが、抽象シンボル(${Object.keys(symbolReplacements).length}件)に安全置換して送信許可 (Target: ${targetService})`
        );
      } else {
        // 自動置換が無効で機密が存在する場合は完全遮断
        allowed = false;
        classification = 'BLOCKED_SENSITIVE';
        blockedReason = `セキュリティ境界違反: ${violations.map((v) => v.message).slice(0, 2).join(', ')}`;

        systemLogger.warn(
          'SELF_IMPROVEMENT',
          `🚫 [セキュリティ境界 11章] 外部送信を遮断しました: ${blockedReason} (Target: ${targetService})`
        );
      }
    }

    const auditResult: PrivacyAuditResult = {
      allowed,
      classification,
      originalLength: text.length,
      sanitizedText,
      violations,
      symbolReplacements,
      auditedAt: Date.now(),
      targetService,
      blockedReason,
    };

    // ログ記録
    const logEntry: PrivacyAuditLogEntry = {
      ...auditResult,
      id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      summary: allowed
        ? `[${classification}] ${targetService} への送信を承認 (${violations.length}件検知/置換)`
        : `[BLOCKED] ${targetService} への送信を遮断: ${blockedReason}`,
    };
    this.auditLogs.unshift(logEntry);
    this.saveLogs();

    return auditResult;
  }
}

export const privacyGuardrailService = new PrivacyGuardrailService();
