/**
 * MIKI-AI 自己改善API共通クライアント
 * 
 * 【不変原則】
 * サーバー未接続時や通信エラー時に、架空の合格スコア・架空の成功データを捏造してはならない。
 * 失敗時は正直に offline / failure を返し、UI側で「未測定・オフライン」として扱う。
 */

import { getCustomApiHeaders, apiUrl } from './api';

export interface ApiFailureResult {
  success: false;
  offline: boolean;
  error: string;
  reason: string;
}

export async function callSelfCodeApi<T>(
  url: string,
  options?: {
    method?: 'GET' | 'POST';
    body?: any;
    headers?: Record<string, string>;
  }
): Promise<T | ApiFailureResult> {
  try {
    let resolvedUrl = url;
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      const configuredBase = apiUrl(url);
      // llama-server (例: :8080) が誤って miki_api_base_url に指定されている場合、
      // llama-server は /api/self-code/* を持たないため、同一オリジンの Express (3000) または相対パスを優先
      if (configuredBase.includes(':8080') || configuredBase.includes(':11434')) {
        resolvedUrl = url;
      } else {
        resolvedUrl = configuredBase;
      }
    }

    const method = options?.method || (options?.body ? 'POST' : 'GET');
    let res = await fetch(resolvedUrl, {
      method,
      headers: {
        ...getCustomApiHeaders(),
        ...(options?.headers || {}),
      },
      body: options?.body ? JSON.stringify(options.body) : undefined,
    });

    // 外部ベースURLで 404 / 接続拒否になった場合、同一オリジンの相対パスで一度だけ自動再試行
    if (!res.ok && res.status === 404 && resolvedUrl !== url) {
      try {
        const retryRes = await fetch(url, {
          method,
          headers: {
            ...getCustomApiHeaders(),
            ...(options?.headers || {}),
          },
          body: options?.body ? JSON.stringify(options.body) : undefined,
        });
        if (retryRes.ok) {
          res = retryRes;
        }
      } catch {
        // 同一オリジン再試行失敗はスルーして元のエラーハンドリングへ
      }
    }

    if (!res.ok) {
      const errorText = await res.text().catch(() => '');
      return {
        success: false,
        offline: false,
        error: `HTTP ${res.status}: ${res.statusText} ${errorText}`.trim(),
        reason: `サーバーエラーが発生しました (HTTP ${res.status})`,
      };
    }

    const data = await res.json();
    return data as T;
  } catch (err: any) {
    // 外部URLで例外が発生した場合も、同一オリジンでフォールバック再試行
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      try {
        const method = options?.method || (options?.body ? 'POST' : 'GET');
        const fallbackRes = await fetch(url, {
          method,
          headers: {
            ...getCustomApiHeaders(),
            ...(options?.headers || {}),
          },
          body: options?.body ? JSON.stringify(options.body) : undefined,
        });
        if (fallbackRes.ok) {
          const data = await fallbackRes.json();
          return data as T;
        }
      } catch {
        // ignore fallback error
      }
    }

    return {
      success: false,
      offline: true,
      error: err?.message || 'Network unreachable',
      reason: 'サーバーに接続できないため、測定・実行できませんでした（オフライン）。架空の成功判定は行いません。',
    };
  }
}

export function isApiFailure(result: any): result is ApiFailureResult {
  return Boolean(result && result.success === false && (result.offline !== undefined || result.error));
}
