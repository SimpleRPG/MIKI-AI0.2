import { AbstractSymbolMapping } from '../types';
import { storageService } from './storageService';
import { systemLogger } from './systemLogger';

const SYMBOL_MAPPING_KEY = 'miki_abstract_symbol_mappings_v5';

/**
 * 設計思想 Master v5.0 第10章 10.2節:
 * 抽象設計支援の境界ルール ＆ 抽象シンボル自動サニタイザー
 * 
 * 実在する企業名、個人名、社内パス、本番SQL、実業務VBA全文を外部に持ち込まず、
 * WORKSHEET_A, SUPPLIER_CODE_A, PROCESS_MAIN などの抽象シンボルに置き換える。
 */
class AbstractSanitizerService {
  private mappings: Map<string, AbstractSymbolMapping> = new Map();
  private counters = {
    worksheet: 1,
    supplier_or_entity: 1,
    procedure: 1,
    column: 1,
    path: 1,
    host: 1,
    credential: 1,
    person: 1,
  };

  constructor() {
    this.loadMappings();
  }

  private loadMappings(): void {
    try {
      const raw = storageService.getItem(SYMBOL_MAPPING_KEY);
      if (raw) {
        const parsed: AbstractSymbolMapping[] = JSON.parse(raw);
        for (const item of parsed) {
          this.mappings.set(item.originalValue.toLowerCase(), item);
        }
      }
    } catch (e) {
      console.warn('Failed to load abstract symbol mappings:', e);
    }
  }

  public saveMappings(): void {
    try {
      const list = Array.from(this.mappings.values());
      storageService.setItem(SYMBOL_MAPPING_KEY, JSON.stringify(list));
    } catch (e) {
      console.warn('Failed to save abstract symbol mappings:', e);
    }
  }

  /**
   * 割り当て済みのマッピング一覧を取得
   */
  public getAllMappings(): AbstractSymbolMapping[] {
    return Array.from(this.mappings.values());
  }

  /**
   * 指定カテゴリに応じた次の抽象シンボル名を採番
   */
  private generateSymbolName(category: AbstractSymbolMapping['category']): string {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const index = (this.counters[category] - 1) % 26;
    const cycle = Math.floor((this.counters[category] - 1) / 26);
    const suffix = cycle > 0 ? `_${cycle + 1}` : '';
    const char = alphabet[index];
    this.counters[category]++;

    switch (category) {
      case 'worksheet':
        return `WORKSHEET_${char}${suffix}`;
      case 'supplier_or_entity':
        return `SUPPLIER_CODE_${char}${suffix}`;
      case 'procedure':
        return `PROCESS_${char === 'A' ? 'MAIN' : 'SUB_' + char}${suffix}`;
      case 'column':
        return `COLUMN_FIELD_${char}${suffix}`;
      case 'path':
        return `[SECURE_DIR_${char}${suffix}]`;
      case 'host':
        return `[HOST_INTERNAL_${char}${suffix}]`;
      case 'credential':
        return `[REDACTED_SECRET_${char}${suffix}]`;
      case 'person':
        return `[PERSON_ANONYMOUS_${char}${suffix}]`;
      default:
        return `ABSTRACT_SYMBOL_${char}${suffix}`;
    }
  }

  /**
   * 単一文字列に対するシンボルの取得または新規割り当て
   */
  public getOrCreateSymbol(
    original: string,
    category: AbstractSymbolMapping['category']
  ): string {
    const key = original.trim().toLowerCase();
    if (!key) return original;

    const existing = this.mappings.get(key);
    if (existing) {
      return existing.abstractSymbol;
    }

    const symbol = this.generateSymbolName(category);
    const mapping: AbstractSymbolMapping = {
      originalValue: original.trim(),
      abstractSymbol: symbol,
      category,
      createdAt: Date.now(),
    };
    this.mappings.set(key, mapping);
    this.saveMappings();
    return symbol;
  }

  /**
   * テキスト全体を走査し、機密・実体・パス・接続文字列を抽象シンボルへ置換
   */
  public sanitizeText(text: string): {
    sanitized: string;
    replacements: Record<string, string>;
    detectedCount: number;
  } {
    if (!text || typeof text !== 'string') {
      return { sanitized: text, replacements: {}, detectedCount: 0 };
    }

    let sanitized = text;
    const replacements: Record<string, string> = {};
    let detectedCount = 0;

    // 1. APIキー・トークン・シークレット
    const apiKeyRegex = /(?:sk-[a-zA-Z0-9_-]{20,}|ghp_[a-zA-Z0-9]{36}|AIza[0-9A-Za-z_-]{35}|Bearer\s+[a-zA-Z0-9._-]{24,})/g;
    sanitized = sanitized.replace(apiKeyRegex, (match) => {
      const sym = this.getOrCreateSymbol(match, 'credential');
      replacements[match] = sym;
      detectedCount++;
      return sym;
    });

    // 2. データベース接続文字列 (Server=..., Data Source=..., mongodb://..., postgresql://...)
    const dbConnRegex = /(?:(?:Server|Data Source|Host|Database)=[^;\n\r]+;?|(?:mongodb|postgresql|mysql|redis):\/\/[^\s\n\r"']+)/gi;
    sanitized = sanitized.replace(dbConnRegex, (match) => {
      const sym = this.getOrCreateSymbol(match, 'credential');
      replacements[match] = sym;
      detectedCount++;
      return sym;
    });

    // 3. Windows / UNC / Linux ファイルパス
    const pathRegex = /(?:[A-Za-z]:\\[^<>"|?*\n\r\t]+|\\\\[a-zA-Z0-9._-]+\\[^<>"|?*\n\r\t]+|\/(?:home|etc|var|Users)\/[a-zA-Z0-9._\-\/]+)/g;
    sanitized = sanitized.replace(pathRegex, (match) => {
      const sym = this.getOrCreateSymbol(match, 'path');
      replacements[match] = sym;
      detectedCount++;
      return sym;
    });

    // 4. プライベートIP / 内部ホスト名
    const hostRegex = /\b(?:192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}|[a-zA-Z0-9._-]+\.(?:corp|internal|local))\b/g;
    sanitized = sanitized.replace(hostRegex, (match) => {
      const sym = this.getOrCreateSymbol(match, 'host');
      replacements[match] = sym;
      detectedCount++;
      return sym;
    });

    // 5. メールアドレス
    const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
    sanitized = sanitized.replace(emailRegex, (match) => {
      const sym = this.getOrCreateSymbol(match, 'person');
      replacements[match] = sym;
      detectedCount++;
      return sym;
    });

    // 6. 電話番号 (日本国内ハイフン形式)
    const telRegex = /\b0\d{1,4}-\d{1,4}-\d{4}\b/g;
    sanitized = sanitized.replace(telRegex, (match) => {
      const sym = this.getOrCreateSymbol(match, 'person');
      replacements[match] = sym;
      detectedCount++;
      return sym;
    });

    // 7. 既知のマッピングの適用 (過去に登録されたシート名やコード名)
    for (const mapping of this.mappings.values()) {
      if (mapping.originalValue.length >= 3 && sanitized.includes(mapping.originalValue)) {
        const regex = new RegExp(this.escapeRegExp(mapping.originalValue), 'g');
        sanitized = sanitized.replace(regex, mapping.abstractSymbol);
        replacements[mapping.originalValue] = mapping.abstractSymbol;
      }
    }

    if (detectedCount > 0) {
      systemLogger.info(
        'SELF_IMPROVEMENT',
        `🛡️ [10.2 抽象サニタイザー] ${detectedCount}件の実体・パス・機密を抽象シンボルに自動置換完了`
      );
    }

    return { sanitized, replacements, detectedCount };
  }

  /**
   * 端末ローカル表示用: 抽象シンボルから元テキストへの復元
   * ※注意: 外部送信には絶対に復元後のテキストを渡さないこと
   */
  public deSanitizeText(sanitizedText: string): string {
    if (!sanitizedText) return '';
    let restored = sanitizedText;
    for (const mapping of this.mappings.values()) {
      if (restored.includes(mapping.abstractSymbol)) {
        const regex = new RegExp(this.escapeRegExp(mapping.abstractSymbol), 'g');
        restored = restored.replace(regex, mapping.originalValue);
      }
    }
    return restored;
  }

  /**
   * マッピングのクリア（セッション終了や明示的リセット時）
   */
  public clearMappings(): void {
    this.mappings.clear();
    this.counters = {
      worksheet: 1,
      supplier_or_entity: 1,
      procedure: 1,
      column: 1,
      path: 1,
      host: 1,
      credential: 1,
      person: 1,
    };
    storageService.removeItem(SYMBOL_MAPPING_KEY);
  }

  private escapeRegExp(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}

export const abstractSanitizerService = new AbstractSanitizerService();
