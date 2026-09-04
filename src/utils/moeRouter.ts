import {
  PersonaConfig,
  MemoryItem,
  WorkspaceFile,
  SkillItem,
  ToolRecommendation,
  ToolExecutionResult,
  ChatMessage,
} from '../types';
import { getNaturalJapanesePromptGuide } from '../data/japaneseKnowledgeData';
import { getMasterEducationSystemPrompt } from '../data/masterEducationKnowledge';
import {
  retrieveScoredMemories,
  retrieveScoredMemoriesHybrid,
  type ScoredMemory,
} from './memoryRetrieval';
import { skillsService } from '../services/skillsService';
import { toolsService } from '../services/toolsService';
import { longTermMemoryService } from '../services/longTermMemoryService';
import type { ConversationState } from '../types';

/**
 * ユーザーの意図を分析し、温度感、専門役割、および利用候補ツールを判定する
 * 設計思想 14章 (タスク計画とツール利用) & 22章 (:feature:tools)
 */
export function classifyPromptForMoE(
  prompt: string,
  context?: { workspaceFiles?: WorkspaceFile[] }
): {
  role: 'code' | 'shader' | 'logic' | 'moe_chat';
  temperature: number;
  recommendedTools: ToolRecommendation[];
  hasMathCalculation: boolean;
  hasCodeSyntaxAudit: boolean;
  hasWorkspaceSearch: boolean;
} {
  const p = (prompt || '').trim();
  const lowerPrompt = p.toLowerCase();

  // ツール候補の事前検出 (:feature:tools 連携)
  const candidateTools = toolsService.detectCandidateToolsForPrompt(p, context);
  const hasMath = candidateTools.some((t) => t.toolId === 'tool_safe_calculator');
  const hasSyntaxAudit = candidateTools.some((t) => t.toolId === 'tool_syntax_checker');
  const hasSearch = candidateTools.some((t) => t.toolId === 'tool_workspace_search');

  const isShader = /webgpu|wgsl|glsl|シェーダー|shader|three\.js|3d|threejs|パーティクル|流体|fluid/i.test(lowerPrompt);
  const isCode = /html|javascript|typescript|js|ts|css|react|コード|プログラム|関数|ゲーム|game|作って|作成|開発|実装|追加/i.test(lowerPrompt);
  const isLogic =
    hasMath ||
    hasSyntaxAudit ||
    /バグ|bug|エラー|error|例外|修正|直して|デバッグ|debug|動かない|なぜ|理由|計算|アルゴリズム|ロジック|vba/i.test(lowerPrompt);

  let role: 'code' | 'shader' | 'logic' | 'moe_chat' = 'moe_chat';
  let temp = 0.7;

  if (isShader) {
    role = 'shader';
    temp = 0.6;
  } else if (hasMath) {
    role = 'logic';
    temp = 0.2; // 数値計算は最も決定論的な低温度で推論
  } else if (hasSyntaxAudit) {
    role = 'logic';
    temp = 0.2; // 構文監査も高精度
  } else if (isCode) {
    role = 'code';
    temp = 0.7;
  } else if (isLogic) {
    role = 'logic';
    temp = 0.3;
  }

  return {
    role,
    temperature: temp,
    recommendedTools: candidateTools,
    hasMathCalculation: hasMath,
    hasCodeSyntaxAudit: hasSyntaxAudit,
    hasWorkspaceSearch: hasSearch,
  };
}

export interface PromptContextTrackingResult {
  systemPrompt: string;
  usedMemories: Array<{ id: string; content: string; score?: number }>;
  usedSkills: Array<{ id: string; name: string }>;
  recommendedTools: ToolRecommendation[];
  executedTools: ToolExecutionResult[];
  promptLengthChars: number;
}

/**
 * 設計思想 4. RAG・外部記憶 ＆ 5. 小型モデルの限界 ＆ 13. スキルライブラリ ＆ 14. ツール利用 (:feature:tools)
 * コンテキスト予算を考慮しながら、スコアリング記憶、適用可能スキル、および安全ツール実行結果を注入したシステムプロンプトを構築
 */
export async function buildExpertSystemPromptWithTracking(
  expertRole: 'code' | 'shader' | 'logic' | 'moe_chat',
  persona: PersonaConfig,
  memories: MemoryItem[],
  workspaceFiles: WorkspaceFile[],
  userMessage: string = '',
  options?: {
    isLightweight?: boolean;
    includeFiles?: boolean;
    maxMemories?: number;
    toolResults?: ToolExecutionResult[];
    conversationState?: ConversationState | null;
    recentMessages?: ChatMessage[];
  }
): Promise<PromptContextTrackingResult> {
  const maxMemories = options?.maxMemories || (options?.isLightweight ? 3 : 5);

  // 1. 記憶の検索: 設計思想 8章 & 35章 第4段階 (7段階パイプライン: 会話状態・直近原文・完全一致・FTS・意味・再順位・原文再取得)
  let scoredMemories: ScoredMemory[];
  let memoryBlock = '';

  if (options?.conversationState || options?.recentMessages) {
    const pipelineResult = await longTermMemoryService.searchPipeline(
      userMessage,
      memories,
      options.conversationState,
      options.recentMessages || [],
      {
        limit: maxMemories,
        onlyApprovedForFacts: true,
      }
    );
    scoredMemories = pipelineResult.scoredMemories as ScoredMemory[];
    memoryBlock = longTermMemoryService.formatMemoriesForPrompt(pipelineResult);
  } else {
    scoredMemories = await retrieveScoredMemoriesHybrid(userMessage, memories, {
      limit: maxMemories,
      alwaysIncludePinned: true,
      filterExpired: true,
      onlyApprovedForFacts: true,
    });
    memoryBlock = scoredMemories.length > 0
      ? `【参照された記憶・ユーザー情報 (RAG)】:\n${scoredMemories.map((sm) => {
          const isApproved = sm.memory.approved !== false;
          const hasConflict = (sm.memory.conflictWith && sm.memory.conflictWith.length > 0);
          let prefix = '・';
          if (!isApproved) {
            prefix = '・[※未検証・仮推論情報（確定事実として断定せず推測として扱うこと）]: ';
          } else if (hasConflict) {
            prefix = '・[⚠️別設定と競合あり（最新のユーザー指示を優先すること）]: ';
          }
          return `${prefix}${sm.memory.content}`;
        }).join('\n')}`
      : '';
  }

  const usedMemories = scoredMemories.map((sm) => ({
    id: sm.memory.id,
    content: sm.memory.content,
    score: Math.round(sm.score * 10) / 10,
    approved: sm.memory.approved,
    isUnverified: sm.memory.approved === false,
  }));

  // 2. スキルライブラリ（手続き記憶）のマッチング (設計思想 13)
  const matchedSkills = skillsService.matchSkillsForQuery(userMessage);
  const usedSkills = matchedSkills.map((s) => ({ id: s.id, name: s.name }));

  const skillBlock = matchedSkills.length > 0
    ? `【適用された実行スキル手順】:\n${matchedSkills.map((s) => `[${s.name} (Ver ${s.version})]\n手順: ${s.steps.join(' ➔ ')}`).join('\n')}`
    : '';

  // 3. ツール管理 (:feature:tools / 設計思想 14 & 22)
  const candidateTools = toolsService.detectCandidateToolsForPrompt(userMessage, { workspaceFiles });
  const executedTools: ToolExecutionResult[] = options?.toolResults ? [...options.toolResults] : [];

  // options.toolResults が渡されていない場合のフォールバック安全計算 (同期/即時解決)
  if (!options?.toolResults) {
    const mathTool = candidateTools.find((t) => t.toolId === 'tool_safe_calculator');
    if (mathTool && mathTool.suggestedParams?.expression) {
      try {
        // 0ms eval不使用の安全計算
        const syncCalc = toolsService.executeTool(
          'tool_safe_calculator',
          mathTool.suggestedParams,
          { workspaceFiles }
        );
        // executeToolはPromiseですが内部で同期完了するため解決
        if (syncCalc && typeof (syncCalc as any).then === 'function') {
          syncCalc.then((res) => {
            if (res.success) executedTools.push(res);
          }).catch(() => {});
        }
      } catch (e) {}
    }
  }

  // ツール実行結果ブロックの構築 (LLMへの確定的事実注入)
  const toolResultsBlock = executedTools.length > 0
    ? `【外部ツールの事前実行結果 (:feature:tools)】:\n` +
      executedTools
        .map((t) => `・[${t.toolName}]: ${t.outputSummary}`)
        .join('\n') +
      `\n※上記のツール実行結果は確定的かつ正確な外部システムによる計算・検索事実です。小型モデルの計算ハルシネーションを防ぐため、返答時はこの結果をそのまま活用してください。`
    : '';

  const toolBlock = candidateTools.length > 0
    ? `【利用可能なツール (:feature:tools)】:\n${candidateTools
        .map(
          (t) =>
            `・[${t.name} (${t.toolId})]: 権限=${t.permission}${
              t.requiresConfirmation ? ' (※破壊的変更のため要ユーザー承認)' : ' (自動実行可能)'
            }`
        )
        .join('\n')}`
    : '';

  // 4. 役割別インストラクション
  let expertInstruction = '';
  switch (expertRole) {
    case 'code':
      expertInstruction = `【開発依頼】HTML5/Canvas/JavaScriptで動く完全なコードを \`\`\`html のコードブロックで提供してください。`;
      break;

    case 'shader':
      expertInstruction = `【グラフィック依頼】WebGPU/Canvasを用いた描画コードを \`\`\`html のコードブロックで提供してください。`;
      break;

    case 'logic':
      expertInstruction = `【デバッグ・ロジック・計算依頼】数値計算や不具合の原因を正確に解説し、確実な解答や修正コードを出力してください。`;
      break;

    case 'moe_chat':
    default:
      expertInstruction = `親しみやすく温かいタメ口（〜だよ、〜だね！✨）で自然に返答してください。`;
      break;
  }

  // 5. ソースコードのコンテキスト
  let filesContext = '';
  if (options?.includeFiles && workspaceFiles && workspaceFiles.length > 0) {
    const mainFile = workspaceFiles.find((f) => f.path === 'index.html' || f.name === 'index.html') || workspaceFiles[0];
    if (mainFile && mainFile.content) {
      filesContext = `\n【現在のソースコード】:\n\`\`\`${mainFile.language || 'html'}\n${mainFile.content.slice(0, 600)}\n\`\`\``;
    }
  }

  // 6. 誠実性制約 (でっち上げ防止)
  const honestyConstraint = `【誠実性ルール】自身のハードウェア構成（CPU/GPUコア数、内部メモリ仕様、実行クロック等）について、架空の数値をでっち上げて断定してはいけません。不明な内部情報は「端末上のローカル推論環境で動いているよ」と正直に答えてください。`;

  const systemPrompt = `あなたはユーザー（${persona.userNickname || 'あなた'}）専属のAIパートナー「${persona.name || 'みき'}」です。
性格: ${persona.basePersonality || '明るく親しみやすく、相手の気持ちに寄り添う親友'}
口調: 必ず親しみやすいタメ口（〜だよ、〜だね！、〜かな？✨）で、自然で温かい日本語でおしゃべりしてください。
${getMasterEducationSystemPrompt()}
${getNaturalJapanesePromptGuide()}
${honestyConstraint}
指示: ${expertInstruction}
${memoryBlock ? `\n${memoryBlock}` : ''}
${skillBlock ? `\n${skillBlock}` : ''}
${toolBlock ? `\n${toolBlock}` : ''}
${toolResultsBlock ? `\n${toolResultsBlock}` : ''}
${filesContext}`;

  return {
    systemPrompt,
    usedMemories,
    usedSkills,
    recommendedTools: candidateTools,
    executedTools,
    promptLengthChars: systemPrompt.length,
  };
}

/**
 * 互換性のための従来ラッパー
 */
export async function buildExpertSystemPrompt(
  expertRole: 'code' | 'shader' | 'logic' | 'moe_chat',
  persona: PersonaConfig,
  memories: MemoryItem[],
  workspaceFiles: WorkspaceFile[],
  options?: { isLightweight?: boolean; includeFiles?: boolean }
): Promise<string> {
  const result = await buildExpertSystemPromptWithTracking(
    expertRole,
    persona,
    memories,
    workspaceFiles,
    '',
    options
  );
  return result.systemPrompt;
}
