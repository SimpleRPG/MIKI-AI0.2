/**
 * 設計思想 第171章: ネット大海探索・自律コード発掘サービス (Autonomous Code Excavation Service)
 * 
 * 【目的】
 * 1. モデル生成系ランタイム がネットの海（GitHub, NPM, Web, Tech Docs）から能動的にコードスニペットを発掘する。
 * 2. 取得したコードを3Bモデルのコンテキスト容量に配慮した「AST高密度スライス（Lean AST Slice）」へ圧縮。
 * 3. 不足しているツールの仕様を自動提案し、ツール創成工房（dynamicToolFactoryService）へ接続する。
 */

import { WebCodeSearchResult, WebCodeSnippet } from '../types';
import { systemLogger } from './systemLogger';

export interface CodeSearchOptions {
  language?: string;
  maxResults?: number;
}

export class CodeSearchService {
  private cache: Map<string, WebCodeSearchResult> = new Map();

  /**
   * ネットの海からコード・アルゴリズム・ライブラリを発掘
   * (作業指示書 v21: (B) クライアントから直接GitHub Search API等をfetch()する形に統一)
   */
  public async searchCode(query: string, options?: CodeSearchOptions): Promise<WebCodeSearchResult> {
    const cleanQuery = query.trim();
    const language = options?.language || 'typescript';
    const cacheKey = `${cleanQuery}_${language}`;

    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    systemLogger.info('SELF_IMPROVEMENT', `[第171章 コード発掘] GitHub公開APIから「${cleanQuery}」のコードを直接探索中...`);

    const maxResults = options?.maxResults || 4;

    try {
      const ghUrl = `https://api.github.com/search/repositories?q=${encodeURIComponent(`${cleanQuery} language:${language}`)}&sort=stars&order=desc&per_page=${maxResults}`;
      const res = await fetch(ghUrl, {
        headers: {
          Accept: 'application/vnd.github.v3+json',
        },
        signal: AbortSignal.timeout(6000),
      });

      if (res.ok) {
        const ghData = await res.json();
        const items = ghData?.items || [];
        const snippets: WebCodeSnippet[] = items.map((repo: any) => ({
          id: `gh_${repo.id}`,
          title: `${repo.full_name} (${repo.stargazers_count || 0}★)`,
          language: repo.language || language,
          code: `// Repository: ${repo.html_url}\n// Description: ${repo.description || 'No description'}\n// Default branch: ${repo.default_branch}\n`,
          sourceUrl: repo.html_url,
          sourceType: 'web',
          description: repo.description || `GitHub Repository ${repo.full_name}`,
        }));

        const result: WebCodeSearchResult = {
          query: cleanQuery,
          language,
          snippets,
          suggestedTools: items.slice(0, 2).map((repo: any) => ({
            name: `${repo.name.replace(/[^a-zA-Z0-9]/g, '')}Integration`,
            description: `${repo.name}の機能を活用する連携ツール`,
            targetProblem: repo.description || cleanQuery,
          })),
          summary: `GitHubから「${cleanQuery}」に関連するリポジトリ・コードを ${snippets.length} 件取得しました。`,
          searchedAt: Date.now(),
        };

        this.cache.set(cacheKey, result);
        return result;
      }
    } catch (err: any) {
      systemLogger.warn('SELF_IMPROVEMENT', `[第171章 コード発掘] 直接GitHub検索エラー: ${err?.message}`);
    }

    // 検索失敗時（オフラインまたはレートリミット）: 架空のコードを捏造せず事実のみを返す
    const failureResult: WebCodeSearchResult = {
      query: cleanQuery,
      language,
      snippets: [],
      suggestedTools: [],
      summary: `「${cleanQuery}」のコード検索に失敗しました（オフライン、または接続失敗）。`,
      searchedAt: Date.now(),
    };
    return failureResult;
  }

  /**
   * モデル生成系ランタイム 用 AST高密度スライス抽出
   * 長大なコードから不要なコメントや空行を削ぎ落とし、シグネチャと重要ブロックのみに圧縮
   */
  public sliceToLeanAst(rawCode: string, maxLines = 30): string {
    const lines = rawCode.split('\n');
    const filtered = lines.filter((l) => {
      const trimmed = l.trim();
      return !trimmed.startsWith('//') && !trimmed.startsWith('/*') && !trimmed.startsWith('*') && trimmed.length > 0;
    });

    if (filtered.length <= maxLines) {
      return filtered.join('\n');
    }

    const head = filtered.slice(0, Math.floor(maxLines * 0.7));
    const tail = filtered.slice(-Math.floor(maxLines * 0.3));
    return [...head, '  // ... [モデル生成系ランタイム コンテキスト最適化: 中略] ...', ...tail].join('\n');
  }
}

export const codeSearchService = new CodeSearchService();
