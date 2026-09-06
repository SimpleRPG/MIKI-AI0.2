import { StructuralMemoryItem, WorkspaceFile } from '../types';
import { storageService } from './storageService';
import { systemLogger } from './systemLogger';

const STORAGE_KEY = 'miki_structural_memory_items';

/**
 * 設計思想 Master v5.0 第2章: 全8層完全記憶階層構造
 * ⑥ 構造記憶 (Structural Memory) 管理サービス
 * 
 * コード理解や設計構造から抽出されたシンボル名、関数・Sub、依存関係グラフ、ハッシュを機械的に管理。
 * コード読解時、エピソード記憶（自然言語の曖昧な要約）を経由せず、直接グラフ整合性を検証・提供する。
 */
class StructuralMemoryService {
  private items: StructuralMemoryItem[] = [];
  private isLoaded = false;

  constructor() {
    this.load();
  }

  private load(): void {
    if (this.isLoaded) return;
    try {
      const raw = storageService.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          this.items = parsed;
        }
      }
      this.isLoaded = true;
    } catch (e: any) {
      systemLogger.warn('PERSISTENCE', 'StructuralMemoryService: failed to load items', e);
      this.items = [];
    }
  }

  private save(): void {
    try {
      storageService.setItem(STORAGE_KEY, JSON.stringify(this.items));
    } catch (e: any) {
      systemLogger.error('PERSISTENCE', 'StructuralMemoryService: failed to save items', e);
    }
  }

  public getItems(): StructuralMemoryItem[] {
    this.load();
    return [...this.items];
  }

  public findBySymbol(symbolName: string): StructuralMemoryItem | undefined {
    this.load();
    const query = symbolName.toLowerCase().trim();
    return this.items.find((item) => item.symbolName.toLowerCase() === query);
  }

  public findByFile(filePath: string): StructuralMemoryItem[] {
    this.load();
    return this.items.filter((item) => item.filePath === filePath);
  }

  /**
   * ワークスペースのファイル群からシンボル（関数、Sub、クラス等）を抽出し、構造記憶を同期
   */
  public syncFromWorkspaceFiles(workspaceFiles: WorkspaceFile[]): void {
    this.load();
    let updated = false;

    for (const file of workspaceFiles) {
      if (!file.content) continue;
      const content = file.content;
      const path = file.path || file.name;

      // JS/TS: function xxx, const xxx = () =>
      const jsFunctions = content.matchAll(/(?:function\s+([a-zA-Z0-9_$]+)|(?:const|let|var)\s+([a-zA-Z0-9_$]+)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>)/g);
      for (const match of jsFunctions) {
        const sym = match[1] || match[2];
        if (sym && sym.length > 2) {
          this.upsertSymbol({
            id: `struct_${path}_${sym}`,
            symbolName: sym,
            kind: 'function',
            filePath: path,
            language: file.language || 'typescript',
            dependencies: [],
            dependents: [],
            hash: `${content.length}_${Date.now()}`,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          });
          updated = true;
        }
      }

      // VBA: Sub xxx, Function xxx
      const vbaProcedures = content.matchAll(/(?:Sub|Function)\s+([a-zA-Z0-9_]+)/gi);
      for (const match of vbaProcedures) {
        const sym = match[1];
        if (sym && sym.length > 2) {
          this.upsertSymbol({
            id: `struct_${path}_${sym}`,
            symbolName: sym,
            kind: 'sub',
            filePath: path,
            language: 'vba',
            dependencies: [],
            dependents: [],
            hash: `${content.length}_${Date.now()}`,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          });
          updated = true;
        }
      }
    }

    if (updated) {
      this.save();
    }
  }

  /**
   * シンボル情報の登録または更新
   */
  public upsertSymbol(item: StructuralMemoryItem): void {
    this.load();
    const existingIndex = this.items.findIndex(
      (existing) => existing.symbolName.toLowerCase() === item.symbolName.toLowerCase() && existing.filePath === item.filePath
    );

    if (existingIndex >= 0) {
      this.items[existingIndex] = {
        ...this.items[existingIndex],
        ...item,
        updatedAt: Date.now(),
      };
    } else {
      this.items.push(item);
    }
    this.save();
  }

  /**
   * クエリに登場するシンボルに関連する構造記憶をプロンプト用にフォーマット
   */
  public formatStructuralContextForPrompt(queryTokens: string[]): string {
    this.load();
    if (this.items.length === 0 || queryTokens.length === 0) return '';

    const lowerTokens = new Set(queryTokens.map((t) => t.toLowerCase()));
    const matched = this.items.filter((item) => lowerTokens.has(item.symbolName.toLowerCase()));

    if (matched.length === 0) return '';

    const lines = matched.slice(0, 5).map((item) => {
      const deps = item.dependencies.length > 0 ? ` (依存先: ${item.dependencies.join(', ')})` : '';
      return `- ${item.kind.toUpperCase()}: \`${item.symbolName}\` in \`${item.filePath}\`${deps}`;
    });

    return `【構造記憶 (コード・シンボル参照)】:\n${lines.join('\n')}`;
  }
}

export const structuralMemoryService = new StructuralMemoryService();
