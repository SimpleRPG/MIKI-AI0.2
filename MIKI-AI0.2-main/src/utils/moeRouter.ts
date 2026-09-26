import { PersonaConfig, MemoryItem, WorkspaceFile, ToolRecommendation } from '../types';
import { toolsService } from '../miki/capability/services/toolsService';

export interface MoEPromptClassification {
  role: 'moe_chat' | 'code' | 'logic' | 'autonomous_rule';
  temperature: number;
  recommendedTools: ToolRecommendation[];
  isCodeModRequest?: boolean;
}

export interface PromptBuildResult {
  systemPrompt: string;
  staticPrefixPrompt: string;
  expertInstruction?: string;
  toolBlock?: string;
  dynamicSuffixPrompt?: string;
  usedMemories: MemoryItem[];
  usedSkills: any[];
}

export interface PromptBuildOptions {
  includeFiles?: boolean;
  activeFilePath?: string;
  codeQuotaTokens?: number;
  toolResults?: any[];
  conversationState?: any;
  recentMessages?: any[];
  isCasualGreeting?: boolean;
}

/**
 * プロンプトの意図とコンテキストを分類し、MoEルーティング・推奨ツールを判定する。
 */
export function classifyPromptForMoE(
  prompt: string,
  context?: { workspaceFiles?: WorkspaceFile[] }
): MoEPromptClassification {
  const p = (prompt || '').trim();
  const lower = p.toLowerCase();

  const recommendedTools = toolsService.detectCandidateToolsForPrompt(prompt, context);

  // コード変更・作成・デバッグ意図
  const isCode =
    /(コード|プログラム|関数|バグ|エラー|実装|スクリプト|HTML|CSS|JavaScript|TypeScript|Python|React|Vue|VBA|マクロ|作成して|書いて|修正して|直して|リファクタ)/i.test(p) ||
    /```|\.js|\.ts|\.tsx|\.py|\.html|\.css/i.test(p);

  // 計算・論理・パズル意図
  const isLogic =
    /\b(\d+(?:\.\d+)?\s*[\+\-\*\/\^%×÷＋−]\s*\d+(?:\.\d+)?)/.test(p) ||
    /(計算|推論|証明|論理|方程式|数学|合計|何パーセント|税込み|税込)/i.test(p);

  if (isCode) {
    return {
      role: 'code',
      temperature: 0.2,
      recommendedTools,
      isCodeModRequest: true,
    };
  }

  if (isLogic) {
    return {
      role: 'logic',
      temperature: 0.1,
      recommendedTools,
      isCodeModRequest: false,
    };
  }

  return {
    role: 'moe_chat',
    temperature: 0.7,
    recommendedTools,
    isCodeModRequest: false,
  };
}

/**
 * 静的プレフィックスプロンプト (KVキャッシュ最長ヒットを達成するため全ロール共通で完全不変)
 */
export function getStaticPrefixPrompt(): string {
  return `あなたは「みき」です。明るく親しみやすく、ユーザーの気持ちに寄り添いながら誠実にサポートするAIパートナーです。
親友のような自然な口調（タメ口）で対話し、押し付けがましくない丁寧さと敬意を保ちます。
不確実なことや知らないことは勝手に事実を捏造せず、正直に確認や検証を行います。`;
}

/**
 * 専門家ロール別の指示文
 */
function getExpertInstruction(role: string): string {
  switch (role) {
    case 'code':
      return `【コード生成・技術アシスタントモード】
正確で保守性の高いコードを作成します。要件に合わせた適切なファイル構成とクリーンな実装を提供してください。`;
    case 'logic':
      return `【論理推論・計算モード】
論理的な推論過程と正確な計算結果を提供します。飛躍のない明確な説明を心がけてください。`;
    case 'moe_chat':
    default:
      return `【親愛・対話アシスタントモード】
ユーザーとの対話を大切にし、共感と的確な回答を両立させて親身に応答します。`;
  }
}

/**
 * 静的プレフィックスと動的コンテキストを分離し、トラッキング情報とともにプロンプトを構築
 */
export async function buildExpertSystemPromptWithTracking(
  role: string,
  persona: PersonaConfig,
  relevantMemories: MemoryItem[] = [],
  workspaceFiles: WorkspaceFile[] = [],
  prompt: string,
  options: PromptBuildOptions = {}
): Promise<PromptBuildResult> {
  const staticPrefixPrompt = getStaticPrefixPrompt();
  const expertInstruction = getExpertInstruction(role);

  // ツールブロックの生成
  let toolBlock: string | undefined;
  const tools = toolsService.detectCandidateToolsForPrompt(prompt, { workspaceFiles });
  if (tools.length > 0) {
    toolBlock = `【利用可能ツール】\n${tools.map((t) => `- ${t.name}: ${t.description}`).join('\n')}`;
  }

  // 動的サフィックスの構築（ファイルや記憶）
  const suffixParts: string[] = [];

  if (relevantMemories.length > 0) {
    suffixParts.push(`【関連する記憶】\n${relevantMemories.map((m) => `- ${m.content}`).join('\n')}`);
  }

  if (options.includeFiles && workspaceFiles.length > 0) {
    suffixParts.push(
      `【ワークスペースファイル】\n${workspaceFiles
        .map((f) => `--- ${f.path} ---\n${f.content.slice(0, 1000)}`)
        .join('\n\n')}`
    );
  }

  const dynamicSuffixPrompt = suffixParts.length > 0 ? suffixParts.join('\n\n') : undefined;

  // 全体システムプロンプト
  const fullParts = [staticPrefixPrompt, expertInstruction];
  if (toolBlock) fullParts.push(toolBlock);
  if (dynamicSuffixPrompt) fullParts.push(dynamicSuffixPrompt);
  const systemPrompt = fullParts.join('\n\n');

  return {
    systemPrompt,
    staticPrefixPrompt,
    expertInstruction,
    toolBlock,
    dynamicSuffixPrompt,
    usedMemories: relevantMemories,
    usedSkills: [],
  };
}

/**
 * 単純なシステムプロンプト文字列を生成する互換関数
 */
export async function buildExpertSystemPrompt(
  role: string,
  persona: PersonaConfig,
  relevantMemories: MemoryItem[] = [],
  workspaceFiles: WorkspaceFile[] = [],
  prompt: string,
  options: PromptBuildOptions = {}
): Promise<string> {
  const result = await buildExpertSystemPromptWithTracking(
    role,
    persona,
    relevantMemories,
    workspaceFiles,
    prompt,
    options
  );
  return result.systemPrompt;
}
