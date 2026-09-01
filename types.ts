export type EngineMode = 'native_gpu' | 'webgpu' | 'external_gpu' | 'autonomous_rule' | 'gemini_cloud';

export interface PersonaConfig {
  id: string;
  name: string;
  avatar: string;
  tagline: string;
  basePersonality: string;
  speakingStyle: string;
  userNickname: string;
  intimacyLevel: number;
  intimacyExp: number;
  autoExtractMemories: boolean;
}

export interface MemoryItem {
  id: string;
  category: 'chat' | 'relationship' | 'gamedev' | 'preference' | 'profile' | 'memory';
  content: string;
  importance?: number;
  pinned?: boolean;
  active?: boolean;
  createdAt?: number;
  updatedAt?: number;
  source?: 'auto' | 'manual' | 'txt_import';
  tags?: string[];
}

export interface WorkspaceFile {
  path: string;
  name: string;
  content: string;
  language?: string;
  isModified?: boolean;
}

export interface GroundingChunk {
  web?: {
    uri: string;
    title: string;
  };
  maps?: {
    uri: string;
    title: string;
  };
}

export interface ExecutionStep {
  stepNumber: number;
  totalSteps: number;
  title: string;
  category: string;
  elapsedMs: number;
  relativeMs?: number;
  relativeDeltaMs?: number;
  status: 'pending' | 'active' | 'success' | 'warn' | 'error';
  details?: any;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  speaker?: {
    id: string;
    name: string;
    avatar: string;
    roleName: string;
    color: string;
  };
  attachedFiles?: Array<{
    name: string;
    size: number;
    type: string;
  }>;
  engineMode?: EngineMode;
  groundingChunks?: GroundingChunk[];
  webSearchQueries?: string[];
  metrics?: {
    engine?: string;
    modelName?: string;
    tokens?: number;
    tokensPerSec?: number;
    ttftMs?: number;
    totalDurationMs?: number;
  };
  executionSteps?: ExecutionStep[];
  isStreaming?: boolean;
  isError?: boolean;
  fallbackDiagnostic?: {
    category: string;
    cause: string;
    tip: string;
    modelId: string;
  };
}

export interface ConsoleLogItem {
  id: string;
  level: 'log' | 'warn' | 'error' | 'info';
  message: string;
  timestamp: number;
}

export interface GitHubRepoData {
  repoName: string;
  owner: string;
  stars: number;
  description: string;
  files: Array<{
    path: string;
    content: string;
  }>;
  branch: string;
}

export interface LocalLLMModel {
  id: string;
  name: string;
  expertRole: 'code' | 'shader' | 'logic' | 'moe_chat' | 'general';
  expertName: string;
  icon: string;
  sizeMB: number;
  parameters: string;
  quantization: string;
  vramMB: number;
  description: string;
  huggingFaceRepo: string;
  format?: 'gguf' | 'mlc';
  downloadUrl?: string;
  fileName?: string;
  downloadStatus: 'not_downloaded' | 'downloading' | 'cached' | 'loaded_in_vram' | 'error';
  downloadProgress: number;
  statusText?: string;
  errorMessage?: string;
  downloadSpeed?: string;
  etaSeconds?: number;
  lastUpdatedTime?: number;
  isStalled?: boolean;
}

export interface WebGPUStatus {
  supported: boolean;
  adapterName: string;
  vendor: string;
  architecture?: string;
  maxBufferSize?: number;
  maxComputeInvocations?: number;
  status: 'ready' | 'loading' | 'unsupported' | 'error';
}
