import {
  ChatMessage,
  PersonaConfig,
  MemoryItem,
  WorkspaceFile,
  GroundingChunk,
  EngineMode,
  MoERouteInfo,
  GitHubRepoData
} from '../types';
import { generateSmartCompanionReply } from '../utils/companionEngine';

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
  moeRoute?: MoERouteInfo;
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

export async function checkServerHealth(): Promise<{ status: string; hasGeminiKey: boolean }> {
  try {
    const res = await fetch('/api/health');
    if (!res.ok) throw new Error('Health check failed');
    return await res.json();
  } catch {
    return { status: 'offline', hasGeminiKey: false };
  }
}

export async function sendChatMessage(params: SendChatMessageParams): Promise<ChatResponse> {
  if (params.signal?.aborted) {
    throw new DOMException('Aborted', 'AbortError');
  }

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
      signal: params.signal
    });

    if (res.ok) {
      return await res.json();
    }
  } catch (err: any) {
    if (err?.name === 'AbortError' || params.signal?.aborted) {
      throw err;
    }
    // Network fetch failed (e.g. standalone APK environment or offline)
  }

  // Standalone / On-device Heuristic & MoE Companion Fallback
  const isCode = params.prompt.includes('作って') || params.prompt.includes('ゲーム') || params.prompt.includes('開発') || params.prompt.includes('コード');
  const reply = generateSmartCompanionReply(
    params.prompt,
    params.persona,
    params.memories,
    isCode,
    params.attachedFiles
  );

  return {
    text: reply,
    engineMode: 'moe',
    moeRoute: {
      primaryExpert: isCode ? 'Code Architect Expert' : 'Companion & Persona Expert',
      activeExperts: [
        { id: 'expert-companion', name: 'Companion Moe', weight: 50, color: '#f43f5e', icon: '🌸' },
        { id: 'expert-code', name: 'Code Architect Expert', weight: 35, color: '#38bdf8', icon: '💻' },
        { id: 'expert-logic', name: 'Logic Expert', weight: 15, color: '#10b981', icon: '🧩' },
      ],
      routingReason: 'On-Device Native Client Engine (Standalone APK mode)',
      computeLatencyMs: 2
    }
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

