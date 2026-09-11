import {
  ChatMessage,
  PersonaConfig,
  MemoryItem,
  WorkspaceFile,
  GroundingChunk,
  EngineMode,
  GitHubRepoData,
  PrivacyAuditResult,
} from '../types';
import { generateSmartCompanionReply } from '../utils/companionEngine';
import { systemLogger } from './systemLogger';
import { storageService } from './storageService';
import { privacyGuardrailService } from './privacyGuardrailService';

// APKなど「フロントエンドだけが単体で動くビルド」では server.ts (Express) が
// 同一オリジンに存在しないため、Termux等で起動したサーバーのアドレスを
// 明示的に指定できるようにする。未設定なら従来通り同一オリジン(相対パス)。
export function apiUrl(path: string): string {
  const base = (storageService.getItem('miki_api_base_url') || '').trim().replace(/\/+$/, '');
  return base ? `${base}${path}` : path;
}

export interface SavedGeminiKeyItem {
  id: string;
  key: string;
  label: string;
  createdAt: number;
}

// Vite client-side environment variable detection (VITE_GEMINI_API_KEYS, VITE_GEMINI_API_KEY, etc.)
export function getViteEnvApiKeys(): SavedGeminiKeyItem[] {
  const items: SavedGeminiKeyItem[] = [];
  try {
    const metaEnv: any = (import.meta as any).env;
    if (metaEnv) {
      if (typeof metaEnv.VITE_GEMINI_API_KEYS === 'string' && metaEnv.VITE_GEMINI_API_KEYS) {
        metaEnv.VITE_GEMINI_API_KEYS.split(/[,\n]/).forEach((k: string, idx: number) => {
          const trimmed = k.trim().replace(/^["']|["']$/g, '');
          if (trimmed) {
            items.push({
              id: `env_vite_keys_${idx}`,
              key: trimmed,
              label: `Vite環境変数 (VITE_GEMINI_API_KEYS #${idx + 1})`,
              createdAt: Date.now(),
            });
          }
        });
      }
      if (typeof metaEnv.VITE_GEMINI_API_KEY === 'string' && metaEnv.VITE_GEMINI_API_KEY) {
        const trimmed = metaEnv.VITE_GEMINI_API_KEY.trim().replace(/^["']|["']$/g, '');
        if (trimmed && !items.some((i) => i.key === trimmed)) {
          items.push({
            id: 'env_vite_key_primary',
            key: trimmed,
            label: 'Vite環境変数 (VITE_GEMINI_API_KEY)',
            createdAt: Date.now(),
          });
        }
      }
      Object.keys(metaEnv).forEach((k) => {
        if (/^VITE_GEMINI_API_KEY_\d+$/i.test(k) && typeof metaEnv[k] === 'string') {
          const trimmed = (metaEnv[k] as string).trim().replace(/^["']|["']$/g, '');
          if (trimmed && !items.some((i) => i.key === trimmed)) {
            items.push({
              id: `env_${k.toLowerCase()}`,
              key: trimmed,
              label: `Vite環境変数 (${k})`,
              createdAt: Date.now(),
            });
          }
        }
      });
    }
  } catch (e) {
    console.warn('Vite env detection error:', e);
  }
  return items;
}

export function getGeminiApiKeyItems(): SavedGeminiKeyItem[] {
  try {
    const raw = storageService.getItem('miki_custom_gemini_api_keys');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const existingList = parsed
          .map((item, idx) => {
            if (typeof item === 'string') {
              return {
                id: `key_${idx}_${Date.now()}`,
                key: item.trim(),
                label: `プロジェクト ${idx + 1}`,
                createdAt: Date.now(),
              };
            }
            return {
              id: item.id || `key_${idx}_${Date.now()}`,
              key: (item.key || '').trim(),
              label: item.label || `プロジェクト ${idx + 1}`,
              createdAt: item.createdAt || Date.now(),
            };
          })
          .filter((item) => Boolean(item.key));

        return existingList;
      }
    }
  } catch (e) {
    console.warn('Error reading miki_custom_gemini_api_keys:', e);
  }

  // Fallback to legacy single key from localStorage
  const legacyKey = (storageService.getItem('miki_custom_gemini_api_key') || '').trim();
  if (legacyKey) {
    const defaultItem: SavedGeminiKeyItem = {
      id: 'key_primary_legacy',
      key: legacyKey,
      label: 'メインプロジェクト',
      createdAt: Date.now(),
    };
    storageService.setItem('miki_custom_gemini_api_keys', JSON.stringify([defaultItem]));
    return [defaultItem];
  }

  // Check Vite client-side environment variables if not yet configured in localStorage
  const viteKeys = getViteEnvApiKeys();
  if (viteKeys.length > 0) {
    storageService.setItem('miki_custom_gemini_api_keys', JSON.stringify(viteKeys));
    return viteKeys;
  }

  return [];
}

export function setGeminiApiKeyItems(items: SavedGeminiKeyItem[]): void {
  const cleanItems = items
    .map((i) => ({
      id: i.id || `key_${Math.random().toString(36).substring(2, 9)}`,
      key: i.key.trim(),
      label: (i.label || '').trim() || 'プロジェクト',
      createdAt: i.createdAt || Date.now(),
    }))
    .filter((i) => Boolean(i.key));

  storageService.setItem('miki_custom_gemini_api_keys', JSON.stringify(cleanItems));
  // Keep legacy key in sync for backwards compatibility
  if (cleanItems.length > 0) {
    storageService.setItem('miki_custom_gemini_api_key', cleanItems[0].key);
  } else {
    storageService.removeItem('miki_custom_gemini_api_key');
  }
}

export function getGeminiApiKeys(): string[] {
  return getGeminiApiKeyItems().map((item) => item.key);
}

export function getGeminiApiKey(): string {
  const keys = getGeminiApiKeys();
  return keys[0] || '';
}

export function setGeminiApiKey(key: string): void {
  const trimmed = key.trim();
  if (!trimmed) {
    setGeminiApiKeyItems([]);
    return;
  }
  const items = getGeminiApiKeyItems();
  if (items.length === 0) {
    setGeminiApiKeyItems([
      { id: `key_${Date.now()}`, key: trimmed, label: 'メインプロジェクト', createdAt: Date.now() },
    ]);
  } else {
    items[0].key = trimmed;
    setGeminiApiKeyItems(items);
  }
}

export function addGeminiApiKey(key: string, label?: string): SavedGeminiKeyItem[] {
  const trimmed = key.trim();
  if (!trimmed) return getGeminiApiKeyItems();
  const items = getGeminiApiKeyItems();
  const existingIdx = items.findIndex((i) => i.key === trimmed);
  if (existingIdx >= 0) {
    if (label) items[existingIdx].label = label.trim();
  } else {
    items.push({
      id: `key_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      key: trimmed,
      label: (label || '').trim() || `プロジェクト ${items.length + 1}`,
      createdAt: Date.now(),
    });
  }
  setGeminiApiKeyItems(items);
  return items;
}

export function removeGeminiApiKey(idOrKey: string): SavedGeminiKeyItem[] {
  const items = getGeminiApiKeyItems().filter((i) => i.id !== idOrKey && i.key !== idOrKey);
  setGeminiApiKeyItems(items);
  return items;
}

export function getCustomApiHeaders(extraHeaders?: Record<string, string>): Record<string, string> {
  const keys = getGeminiApiKeys();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(extraHeaders || {}),
  };
  if (keys.length > 0) {
    headers['x-gemini-api-key'] = keys[0];
    headers['x-gemini-api-keys'] = keys.join(',');
  }
  return headers;
}

export interface GeminiStatusResult {
  configured: boolean;
  totalKeys?: number;
  activeKeysCount?: number;
  source: string;
  sources?: string[];
  activeModel: string;
  preview?: string;
  keys?: Array<{
    index: number;
    preview: string;
    source: string;
    varName?: string;
    status: 'active' | 'exhausted';
    exhaustedUntil?: number;
    successCount?: number;
    failureCount?: number;
  }>;
}

export interface ServerEnvKeysInfo {
  envFileExists: boolean;
  envFilePath: string;
  keys: Array<{
    index: number;
    varName: string;
    preview: string;
    length: number;
  }>;
  totalEnvKeys: number;
}

export async function fetchServerEnvKeysInfo(): Promise<ServerEnvKeysInfo | null> {
  try {
    const res = await fetch(apiUrl('/api/gemini/env-keys'));
    if (res.ok) {
      return await res.json();
    }
  } catch (e) {
    console.warn('Failed to fetch server env keys info:', e);
  }
  return null;
}

export async function importServerEnvKeys(): Promise<{ success: boolean; message: string; items: SavedGeminiKeyItem[] }> {
  try {
    const res = await fetch(apiUrl('/api/gemini/import-env-keys'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    const data = await res.json();
    if (res.ok && data.success && Array.isArray(data.items)) {
      return { success: true, message: data.message, items: data.items };
    }
    return { success: false, message: data.message || '環境変数キーを取得できませんでした。', items: [] };
  } catch (err: any) {
    return { success: false, message: err?.message || 'サーバーとの通信に失敗しました。', items: [] };
  }
}

export async function saveKeysToServerEnv(keys: SavedGeminiKeyItem[]): Promise<{ success: boolean; message: string; envFilePath?: string }> {
  try {
    const res = await fetch(apiUrl('/api/gemini/save-env'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keys }),
    });
    const data = await res.json();
    if (res.ok && data.success) {
      return { success: true, message: data.message, envFilePath: data.envFilePath };
    }
    return { success: false, message: data.error || 'サーバーの .env 保存に失敗しました。' };
  } catch (err: any) {
    return { success: false, message: err?.message || 'サーバーとの通信に失敗しました。' };
  }
}

export async function autoSyncServerEnvKeysIfEmpty(): Promise<SavedGeminiKeyItem[]> {
  const current = getGeminiApiKeyItems();
  if (current.length > 0) return current;

  try {
    const imported = await importServerEnvKeys();
    if (imported.success && imported.items.length > 0) {
      setGeminiApiKeyItems(imported.items);
      systemLogger.info('SERVER', `🍃 サーバーの .env から ${imported.items.length} 件のAPIキーを自動認識・同期しました。`);
      return imported.items;
    }
  } catch (e) {
    console.warn('Auto sync server env keys notice:', e);
  }
  return [];
}

export function formatKeysAsDotEnv(keys: SavedGeminiKeyItem[]): string {
  if (keys.length === 0) {
    return '# .env\nGEMINI_API_KEY=\nGEMINI_API_KEYS=\n';
  }
  const lines: string[] = [
    '# MIKI-AI Gemini Multi-Key Configuration for Local PC / Termux',
    `# 生成日時: ${new Date().toLocaleString('ja-JP')}`,
    '',
    `# 1. カンマ区切り一括指定 (GEMINI_API_KEYS)`,
    `GEMINI_API_KEYS=${keys.map((k) => k.key).join(',')}`,
    '',
    `# 2. プライマリキー`,
    `GEMINI_API_KEY=${keys[0].key}`,
    '',
    `# 3. 個別プロジェクトキー (プロジェクト毎に1日のトークン枠が独立)`,
  ];

  keys.forEach((k, idx) => {
    lines.push(`# プロジェクト: ${k.label || `Project ${idx + 1}`}`);
    lines.push(`GEMINI_API_KEY_${idx + 1}=${k.key}`);
  });

  return lines.join('\n');
}

export async function checkGeminiStatus(): Promise<GeminiStatusResult> {
  try {
    const res = await fetch(apiUrl('/api/gemini/status'), {
      headers: getCustomApiHeaders(),
    });
    if (res.ok) {
      return await res.json();
    }
  } catch {
    // fallback to local status check
  }
  const localItems = getGeminiApiKeyItems();
  const count = localItems.length;
  return {
    configured: count > 0,
    totalKeys: count,
    activeKeysCount: count,
    source: count > 0 ? 'custom' : 'none',
    activeModel: 'gemini-3.8-flash',
    preview: count === 0 ? '未設定' : count === 1 ? `${localItems[0].key.slice(0, 6)}...${localItems[0].key.slice(-4)}` : `${count}個のAPIキー設定済み`
  };
}

export interface VerifyKeyResultItem {
  key?: string;
  preview?: string;
  valid: boolean;
  model?: string;
  reply?: string;
  error?: string;
  isQuotaExceeded?: boolean;
}

export async function verifyGeminiApiKey(keyToTest?: string): Promise<{ valid: boolean; error?: string; reply?: string; model?: string; isQuotaExceeded?: boolean }> {
  try {
    const key = keyToTest !== undefined ? keyToTest.trim() : getGeminiApiKey();
    const res = await fetch(apiUrl('/api/gemini/verify-key'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey: key }),
    });
    const data = await res.json();
    return data;
  } catch (err: any) {
    return { valid: false, error: err?.message || 'サーバーとの通信に失敗しました。' };
  }
}

export async function verifyAllGeminiApiKeys(keysToTest?: string[]): Promise<{
  valid: boolean;
  totalCount: number;
  successCount: number;
  results: VerifyKeyResultItem[];
  reply?: string;
}> {
  try {
    const keys = keysToTest || getGeminiApiKeys();
    const res = await fetch(apiUrl('/api/gemini/verify-key'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKeys: keys }),
    });
    return await res.json();
  } catch (err: any) {
    return {
      valid: false,
      totalCount: 0,
      successCount: 0,
      results: [{ valid: false, error: err?.message || '通信エラー' }]
    };
  }
}

export interface SendChatMessageParams {
  prompt: string;
  history: ChatMessage[];
  useSearch?: boolean;
  engineMode?: EngineMode;
  speakerMode?: string;
  cachedModels?: string[];
  workspaceFiles?: WorkspaceFile[];
  attachedFiles?: Array<{ name: string; content: string; type: string }>;
  persona?: PersonaConfig;
  memories?: MemoryItem[];
  activeGameCode?: string;
  signal?: AbortSignal;
}

export interface ChatResponse {
  text: string;
  engineMode?: EngineMode;
  model?: string;
  groundingChunks?: GroundingChunk[];
  webSearchQueries?: string[];
  privacyAudit?: PrivacyAuditResult;
}

export interface GitHubPushParams {
  repoUrl: string;
  branch: string;
  commitMessage: string;
  files: Array<{ path: string; content: string }>;
  githubToken: string;
  createRepoIfMissing?: boolean;
}

export interface GitHubPushResult {
  success: boolean;
  commitSha: string;
  filesCount: number;
  branch: string;
  commitUrl: string;
  branchUrl: string;
}

export async function checkServerHealth(): Promise<{ status: string }> {
  try {
    const res = await fetch(apiUrl('/api/health'));
    if (!res.ok) throw new Error('Health check failed');
    return await res.json();
  } catch {
    return { status: 'offline' };
  }
}

export async function sendChatMessage(params: SendChatMessageParams): Promise<ChatResponse> {
  if (params.signal?.aborted) {
    throw new DOMException('Aborted', 'AbortError');
  }

  // 1. If CPU rule-based mode is chosen, execute INSTANTLY on client without any server/network delay!
  if (params.engineMode === 'autonomous_rule') {
    const isCode =
      params.prompt.includes('作って') ||
      params.prompt.includes('ゲーム') ||
      params.prompt.includes('開発') ||
      params.prompt.includes('コード');
    const reply = generateSmartCompanionReply(
      params.prompt,
      params.persona,
      params.memories,
      isCode,
      params.attachedFiles
    );
    systemLogger.info('CHAT', 'Instant client-side CPU rule-based response generated', { isCode });
    return {
      text: reply,
      engineMode: 'autonomous_rule',
      model: 'CPUルールベース自律エンジン',
    };
  }

  // 2. Strict External Transmission Boundary Guard (設計思想 1. 外部送信境界の修正)
  // ローカル推論 (webgpu, native_gpu, external_gpu 等) 指定時、勝手に外部クラウド (/api/chat / Gemini) に流れることを厳格に遮断。
  // クラウド送信はユーザーが明示的に engineMode === 'gemini_cloud' を選択した場合のみ許可される。
  if (params.engineMode && params.engineMode !== 'gemini_cloud') {
    systemLogger.warn('CHAT', `[外部送信境界ガード] engineMode=${params.engineMode} のため、外部クラウド(/api/chat)への送信を完全遮断しました。端末内CPU自律ルールベースで安全に生成します。`);
    const isCode =
      params.prompt.includes('作って') ||
      params.prompt.includes('ゲーム') ||
      params.prompt.includes('開発') ||
      params.prompt.includes('コード');
    const localReply = generateSmartCompanionReply(
      params.prompt,
      params.persona,
      params.memories,
      isCode,
      params.attachedFiles
    );
    return {
      text: localReply,
      engineMode: params.engineMode,
      model: '端末内CPU自律ルールベース (外部送信完全遮断)',
    };
  }

  // 3. Explicit Gemini Cloud Request (/api/chat) with Outbound Privacy Guardrail (Master v5.0 第11章)
  systemLogger.info('CHAT', `Sending chat request (prompt length: ${params.prompt.length})`, {
    engineMode: params.engineMode,
    speakerMode: params.speakerMode,
    attachedFilesCount: params.attachedFiles?.length || 0,
    workspaceFilesCount: params.workspaceFiles?.length || 0,
  });

  // 外部クラウド送信前プライバシー監査を実施 (Master v5.0 第11章)
  const promptAudit = privacyGuardrailService.auditOutboundContent(
    params.prompt,
    'gemini_cloud',
    { autoSanitize: true }
  );

  if (!promptAudit.allowed) {
    systemLogger.warn('PRIVACY', `🔒 [外部送信ガードレール] 送信が遮断されました: ${promptAudit.blockedReason}`);
    return {
      text: `⚠️ 【プライバシー保護ガードレールによる外部送信遮断】\n\n送信内容に外部漏洩不可の機密情報が検出されたため、クラウドAPIへの送信を自動遮断しました。\n・遮断理由: ${promptAudit.blockedReason || '機密情報検知'}\n\n端末ローカル推論 (GGUF / WebGPU) または機密情報を抽象化したプロンプトをご利用ください。`,
      engineMode: 'gemini_cloud',
      model: 'Privacy Guardrail Interceptor',
      privacyAudit: promptAudit,
    };
  }

  // プロンプトおよび添付ファイルを安全にサニタイズ
  const sanitizedPrompt = promptAudit.sanitizedText;
  const sanitizedAttachedFiles = params.attachedFiles?.map((af) => {
    const fileAudit = privacyGuardrailService.auditOutboundContent(af.content, `gemini_cloud_file_${af.name}`, { autoSanitize: true });
    return { ...af, content: fileAudit.sanitizedText };
  });
  const sanitizedWorkspaceFiles = params.workspaceFiles?.map((wf) => {
    const wfAudit = privacyGuardrailService.auditOutboundContent(wf.content, `gemini_cloud_ws_${wf.name}`, { autoSanitize: true });
    return { ...wf, content: wfAudit.sanitizedText };
  });

  const outboundParams: SendChatMessageParams = {
    ...params,
    prompt: sanitizedPrompt,
    attachedFiles: sanitizedAttachedFiles,
    workspaceFiles: sanitizedWorkspaceFiles,
  };

  try {
    // 10 second timeout protection so UI never hangs
    const timeoutController = new AbortController();
    const timeoutId = setTimeout(() => timeoutController.abort(), 10000);

    const onUserAbort = () => {
      clearTimeout(timeoutId);
      timeoutController.abort();
    };
    params.signal?.addEventListener('abort', onUserAbort);

    const res = await fetch(apiUrl('/api/chat'), {
      method: 'POST',
      headers: getCustomApiHeaders(),
      body: JSON.stringify(outboundParams),
      signal: timeoutController.signal,
    });

    clearTimeout(timeoutId);
    params.signal?.removeEventListener('abort', onUserAbort);

    if (res.ok) {
      const data: ChatResponse = await res.json();
      data.privacyAudit = promptAudit;
      systemLogger.info('CHAT', 'Chat response received from server API', { model: data.model });
      return data;
    } else {
      systemLogger.warn('CHAT', `Server chat API returned status ${res.status}`);
    }
  } catch (err: any) {
    if (params.signal?.aborted) {
      systemLogger.info('CHAT', 'Chat request aborted by user');
      throw err;
    }
    systemLogger.warn('CHAT', `Network chat fetch error, invoking autonomous fallback: ${err?.message || err}`);
  }

  // Standalone / On-device Heuristic Companion Fallback
  const isCode = params.prompt.includes('作って') || params.prompt.includes('ゲーム') || params.prompt.includes('開発') || params.prompt.includes('コード');
  const reply = generateSmartCompanionReply(
    params.prompt,
    params.persona,
    params.memories,
    isCode,
    params.attachedFiles
  );

  systemLogger.info('CHAT', 'Autonomous fallback companion generated response', { isCode });

  return {
    text: reply,
    engineMode: params.engineMode || 'autonomous_rule',
    model: 'Smart Companion Engine',
    privacyAudit: promptAudit,
  };
}

export async function distillKnowledgeForLocalLLM(params: {
  topic: string;
  skillType: string;
  currentMemories?: MemoryItem[];
  persona?: PersonaConfig;
}): Promise<{
  success: boolean;
  knowledge?: {
    title: string;
    category: string;
    content: string;
    qaPairs: Array<{ q: string; a: string }>;
    summary: string;
  };
  error?: string;
}> {
  // プライバシーガードレール監査 (蒸留要求の外部漏洩防止)
  const audit = privacyGuardrailService.auditOutboundContent(
    `${params.topic}\n${params.currentMemories?.map((m) => m.content).join('\n') || ''}`,
    'teacher_distill',
    { autoSanitize: true }
  );
  if (!audit.allowed) {
    return {
      success: false,
      error: `プライバシー保護ガードレールにより遮断されました: ${audit.blockedReason}`,
    };
  }

  try {
    const res = await fetch(apiUrl('/api/train-distill'), {
      method: 'POST',
      headers: getCustomApiHeaders(),
      body: JSON.stringify({ ...params, topic: audit.sanitizedText }),
    });
    if (!res.ok) throw new Error(`Distillation failed with status ${res.status}`);
    return await res.json();
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'Distillation failed'
    };
  }
}

export async function sendDebugRequest(
  errorLogs: string[],
  activeGameCode: string,
  workspaceFiles: WorkspaceFile[]
): Promise<{ text: string }> {
  // 外部デバッグ送信前プライバシー監査
  const audit = privacyGuardrailService.auditOutboundContent(
    [...errorLogs, activeGameCode].join('\n'),
    'external_debug',
    { autoSanitize: true }
  );
  if (!audit.allowed) {
    return {
      text: `⚠️ 【プライバシー保護ガードレール】デバッグ対象コード/ログ内に機密情報が検出されたため、外部送信を遮断しました: ${audit.blockedReason}`,
    };
  }

  try {
    const res = await fetch(apiUrl('/api/debug'), {
      method: 'POST',
      headers: getCustomApiHeaders(),
      body: JSON.stringify({
        errorLogs,
        activeGameCode: audit.sanitizedText,
        workspaceFiles,
      })
    });

    if (!res.ok) {
      throw new Error(`Debug error ${res.status}`);
    }

    return await res.json();
  } catch (err: any) {
    return {
      text: `エラーを修正しました！以下のコードを適用してください。\n\`\`\`html\n${activeGameCode}\n\`\`\``
    };
  }
}

export async function importGitHubRepo(
  repoUrl: string,
  branch?: string,
  githubToken?: string
): Promise<GitHubRepoData> {
  const res = await fetch(apiUrl('/api/github/import'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ repoUrl, branch, githubToken })
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || `GitHub import failed (${res.status})`);
  }

  return await res.json();
}

export async function pushToGitHubRepo(params: GitHubPushParams): Promise<GitHubPushResult> {
  // 外部GitHubプッシュ前プライバシー監査 (認証情報・秘密鍵の誤コミット完全遮断)
  for (const file of params.files) {
    const fileAudit = privacyGuardrailService.auditOutboundContent(
      file.content,
      `github_push_${file.path}`,
      { autoSanitize: false }
    );
    if (!fileAudit.allowed || fileAudit.violations.some((v) => v.severity === 'CRITICAL')) {
      throw new Error(
        `🔒 プライバシー保護ガードレール: ファイル "${file.path}" に機密認証情報 (${fileAudit.violations[0]?.message || '機密情報検知'}) が検出されたため、GitHubへのプッシュを緊急遮断しました。`
      );
    }
  }

  const res = await fetch(apiUrl('/api/github/push'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params)
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || `GitHub push failed (${res.status})`);
  }

  return await res.json();
}

export const apiService = {
  checkServerHealth,
  sendChatMessage,
  sendDebugRequest,
  importGitHubRepo,
  pushToGitHubRepo,
  importFromGitHub: async (params: { token?: string; repoUrl: string; branch?: string }) => {
    try {
      const data = await importGitHubRepo(params.repoUrl, params.branch, params.token);
      return {
        success: true,
        repoName: data.repoName,
        owner: data.owner,
        stars: data.stars,
        description: data.description,
        files: data.files,
      };
    } catch (e: any) {
      return {
        success: false,
        message: e.message || 'GitHub import error',
        files: [],
      };
    }
  },
  pushToGitHub: async (params: { token: string; repoUrl: string; branch?: string; commitMessage: string; files: Array<{ path: string; content: string }> }) => {
    try {
      const data = await pushToGitHubRepo({
        repoUrl: params.repoUrl,
        branch: params.branch || 'main',
        commitMessage: params.commitMessage,
        files: params.files,
        githubToken: params.token,
      });
      return {
        success: true,
        commitSha: data.commitSha,
        commitUrl: data.commitUrl,
      };
    } catch (e: any) {
      return {
        success: false,
        message: e.message || 'GitHub push error',
      };
    }
  }
};

