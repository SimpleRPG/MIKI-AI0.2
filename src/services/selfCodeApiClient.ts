/**
 * MIKI-AI 自己改善API共通クライアント
 * 
 * 【不変原則】
 * サーバー未接続時や通信エラー時に、架空の合格スコア・架空の成功データを捏造してはならない。
 * 失敗時は正直に offline / failure を返し、UI側で「未測定・オフライン」として扱う。
 */

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
    const fullUrl =
      url.startsWith('http://') || url.startsWith('https://')
        ? url
        : typeof window !== 'undefined'
        ? url
        : `http://localhost:3000${url.startsWith('/') ? '' : '/'}${url}`;

    const method = options?.method || (options?.body ? 'POST' : 'GET');
    const res = await fetch(fullUrl, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(options?.headers || {}),
      },
      body: options?.body ? JSON.stringify(options.body) : undefined,
    });

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
