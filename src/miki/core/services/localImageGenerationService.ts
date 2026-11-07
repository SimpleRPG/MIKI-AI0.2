import { storageService } from '../../../services/storageService';

/*
 * P471: ローカル画像生成クライアント —「みきが自分の端末の中で絵を生成する」ための受け口。
 *
 * 背景（2026-11-07、きりあの方針）: クラウドの画像生成はポリシー・利用枠・
 * サービス変更で制限され得る。みきの自立性のため、生成も検索（SearXNG）と同じく
 * 端末内の localhost で完結させる。想定する相手は Local Dream のような
 * オンデバイス生成アプリの HTTP サーバ（既定 http://127.0.0.1:8081、
 * /health と /generate を持つ形）。ただし相手に縛られないよう、向き先は
 * 設定で差し替え可能にし、応答形式の揺れ（base64 の JSON / 画像バイナリ直返し）
 * はここで吸収する。
 *
 * 生成が使えないときは失敗を正直に返し、呼び出し側が彼女自身の手続き描画
 * （P138系）へ落ちられるようにする。クラウドへのフォールバックはしない
 * （それは自立性の方針に反する）。
 *
 * 注意: /generate の正確な要求・応答形式は相手アプリの内部仕様であり、
 * 実機での突き合わせが別途必要。ここではモックサーバで契約を検証済み。
 */

export interface LocalImageGenerationSettings {
  baseUrl: string;
  timeoutMs: number;
}

export interface LocalImageGenerationRequest {
  prompt: string;
  negativePrompt?: string;
  width?: number;
  height?: number;
  steps?: number;
  seed?: number;
}

export type LocalImageGenerationResult =
  | { ok: true; dataUrl: string; bytes: number; source: 'LOCAL_ENDPOINT' | 'PROCEDURAL_FALLBACK'; endpoint?: string }
  | { ok: false; reason: string };

const BASE_URL_KEYS = ['miki_image_gen_base_url'];
const TIMEOUT_KEYS = ['miki_image_gen_timeout_ms'];

function readString(keys: string[]): string | undefined {
  for (const key of keys) {
    const value = storageService.getItem(key);
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return undefined;
}

function readNumber(keys: string[]): number | undefined {
  for (const key of keys) {
    const value = storageService.getItem(key);
    const numeric = typeof value === 'number' ? value : Number(value);
    if (Number.isFinite(numeric) && numeric > 0) return Math.trunc(numeric);
  }
  return undefined;
}

export function getLocalImageGenerationSettings(): LocalImageGenerationSettings {
  const baseUrl = (readString(BASE_URL_KEYS) || 'http://127.0.0.1:8081').replace(/\/+$/, '');
  // 生成は数十秒かかるのが普通なので、検索より長い上限を許す
  const timeoutMs = Math.min(600000, Math.max(5000, readNumber(TIMEOUT_KEYS) ?? 180000));
  return { baseUrl, timeoutMs };
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export const localImageGenerationService = {
  /** 生成サーバが生きているか（短いタイムアウトで /health を見る）。 */
  async health(settings: LocalImageGenerationSettings = getLocalImageGenerationSettings()): Promise<boolean> {
    try {
      const res = await fetchWithTimeout(`${settings.baseUrl}/health`, { method: 'GET' }, Math.min(settings.timeoutMs, 5000));
      return res.ok;
    } catch {
      return false;
    }
  },

  /** 端末内の生成エンドポイントへ1枚頼む。失敗は理由つきで正直に返す。 */
  async generate(
    request: LocalImageGenerationRequest,
    settings: LocalImageGenerationSettings = getLocalImageGenerationSettings(),
  ): Promise<LocalImageGenerationResult> {
    const prompt = request.prompt.trim();
    if (!prompt) return { ok: false, reason: 'EMPTY_PROMPT' };
    let res: Response;
    try {
      res = await fetchWithTimeout(
        `${settings.baseUrl}/generate`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt,
            negative_prompt: request.negativePrompt ?? '',
            width: request.width ?? 512,
            height: request.height ?? 512,
            steps: request.steps ?? 20,
            seed: request.seed ?? -1,
          }),
        },
        settings.timeoutMs,
      );
    } catch (error) {
      return { ok: false, reason: `ENDPOINT_UNREACHABLE: ${error instanceof Error ? error.message : String(error)}` };
    }
    if (!res.ok) return { ok: false, reason: `ENDPOINT_HTTP_${res.status}` };
    const contentType = res.headers.get('content-type') ?? '';
    try {
      if (contentType.includes('application/json')) {
        const json = (await res.json()) as { image?: string; images?: string[] };
        const raw = json.image ?? json.images?.[0];
        if (!raw) return { ok: false, reason: 'ENDPOINT_RESPONSE_HAS_NO_IMAGE' };
        const dataUrl = raw.startsWith('data:') ? raw : `data:image/png;base64,${raw}`;
        const bytes = Math.floor((raw.length * 3) / 4);
        return { ok: true, dataUrl, bytes, source: 'LOCAL_ENDPOINT', endpoint: settings.baseUrl };
      }
      const buf = new Uint8Array(await res.arrayBuffer());
      if (buf.length === 0) return { ok: false, reason: 'ENDPOINT_EMPTY_BODY' };
      const mime = contentType.includes('image/') ? contentType.split(';')[0] : 'image/png';
      return { ok: true, dataUrl: `data:${mime};base64,${toBase64(buf)}`, bytes: buf.length, source: 'LOCAL_ENDPOINT', endpoint: settings.baseUrl };
    } catch (error) {
      return { ok: false, reason: `ENDPOINT_BAD_RESPONSE: ${error instanceof Error ? error.message : String(error)}` };
    }
  },

  /*
   * 生成を試み、使えなければ呼び出し側の手続き描画（dataUrl）に落ちる。
   * どちらで描いたかを source で必ず区別して返す（出所の正直さ）。
   */
  async generatePreferred(
    request: LocalImageGenerationRequest,
    fallbackDataUrl: string,
    settings: LocalImageGenerationSettings = getLocalImageGenerationSettings(),
  ): Promise<LocalImageGenerationResult> {
    if (await this.health(settings)) {
      const generated = await this.generate(request, settings);
      if (generated.ok) return generated;
      return { ok: true, dataUrl: fallbackDataUrl, bytes: 0, source: 'PROCEDURAL_FALLBACK', endpoint: settings.baseUrl };
    }
    return { ok: true, dataUrl: fallbackDataUrl, bytes: 0, source: 'PROCEDURAL_FALLBACK', endpoint: settings.baseUrl };
  },
};
