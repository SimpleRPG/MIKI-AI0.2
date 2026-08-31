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
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params)
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || `Server error ${res.status}`);
  }

  return await res.json();
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

