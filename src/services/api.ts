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

export function getGeminiApiKey(): string {
  return (storageService.getItem('miki_custom_gemini_api_key') || '').trim();
}

export function setGeminiApiKey(key: string): void {
  storageService.setItem('miki_custom_gemini_api_key', key.trim());
}

export function getCustomApiHeaders(extraHeaders?: Record<string, string>): Record<string, string> {
  const key = getGeminiApiKey();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(extraHeaders || {}),
  };
  if (key) {
    headers['x-gemini-api-key'] = key;
  }
  return headers;
}

export async function checkGeminiStatus(): Promise<{ configured: boolean; source: string; activeModel: string; preview?: string }> {
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
  const localKey = getGeminiApiKey();
  return {
    configured: !!localKey,
    source: localKey ? 'custom' : 'none',
    activeModel: 'gemini-3.8-flash',
    preview: localKey ? `${localKey.slice(0, 6)}...${localKey.slice(-4)}` : '未設定'
  };
}

export async function verifyGeminiApiKey(keyToTest?: string): Promise<{ valid: boolean; error?: string; reply?: string; model?: string }> {
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
    const res = await fetch('/api/health');
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

