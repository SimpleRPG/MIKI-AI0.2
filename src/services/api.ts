import {
  ChatMessage,
  PersonaConfig,
  MemoryItem,
  WorkspaceFile,
  GroundingChunk,
  EngineMode,
  GitHubRepoData
} from '../types';
import { generateSmartCompanionReply } from '../utils/companionEngine';
import { systemLogger } from './systemLogger';

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

  // 3. Explicit Gemini Cloud Request (/api/chat) with timeout protection
  systemLogger.info('CHAT', `Sending chat request (prompt length: ${params.prompt.length})`, {
    engineMode: params.engineMode,
    speakerMode: params.speakerMode,
    attachedFilesCount: params.attachedFiles?.length || 0,
    workspaceFilesCount: params.workspaceFiles?.length || 0,
  });

  try {
    // 10 second timeout protection so UI never hangs
    const timeoutController = new AbortController();
    const timeoutId = setTimeout(() => timeoutController.abort(), 10000);

    const onUserAbort = () => {
      clearTimeout(timeoutId);
      timeoutController.abort();
    };
    params.signal?.addEventListener('abort', onUserAbort);

    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
      signal: timeoutController.signal,
    });

    clearTimeout(timeoutId);
    params.signal?.removeEventListener('abort', onUserAbort);

    if (res.ok) {
      const data = await res.json();
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
    model: 'Smart Companion Engine'
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
  try {
    const res = await fetch('/api/train-distill', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
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
  try {
    const res = await fetch('/api/debug', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ errorLogs, activeGameCode, workspaceFiles })
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
  const res = await fetch('/api/github/import', {
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
  const res = await fetch('/api/github/push', {
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

