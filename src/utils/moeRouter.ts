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
import { workingAgendaService } from '../services/workingAgendaService';
import { structuralMemoryService } from '../services/structuralMemoryService';
import { failureCatalogService } from '../services/failureCatalogService';
import { extractSmartCodeForImprovement } from './codeUnderstanding';
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
  staticPrefixPrompt: string;
  dynamicSuffixPrompt: string;
  expertInstruction?: string;
  toolBlock?: string;
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
    activeFilePath?: string;
    codeQuotaTokens?: number;
    isCasualGreeting?: boolean;
  }
): Promise<PromptContextTrackingResult> {
  const isCasualGreeting = options?.isCasualGreeting ?? false;
  const maxMemories = options?.maxMemories || (options?.isLightweight ? 3 : 5);

  // 1. 記憶の検索: 設計思想 8章 & 35章 第4段階 (7段階パイプライン: 会話状態・直近原文・完全一致・FTS・意味・再順位・原文再取得)
  // ※ 日常の挨拶・短文対話(isCasualGreeting)の場合は、プロンプト肥大化防止のためRAGを完全スキップ
  let scoredMemories: ScoredMemory[] = [];
  let memoryBlock = '';

  if (!isCasualGreeting) {
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
  }

  const usedMemories = scoredMemories.map((sm) => ({
    id: sm.memory.id,
    content: sm.memory.content,
    score: Math.round(sm.score * 10) / 10,
    approved: sm.memory.approved,
    isUnverified: sm.memory.approved === false,
  }));

  // 2. スキルライブラリ（手続き記憶）のマッチング (設計思想 13)
  // ※ 日常の挨拶・短文対話の場合はスキルマッチングをスキップ
  const matchedSkills = isCasualGreeting ? [] : skillsService.matchSkillsForQuery(userMessage);
  const usedSkills = matchedSkills.map((s) => ({ id: s.id, name: s.name }));

  const skillBlock = matchedSkills.length > 0
    ? `【適用された実行スキル手順】:\n${matchedSkills.map((s) => `[${s.name} (Ver ${s.version})]\n手順: ${s.steps.join(' ➔ ')}`).join('\n')}`
    : '';

  // 3. ツール管理 (:feature:tools / 設計思想 14 & 22)
  const candidateTools = isCasualGreeting ? [] : toolsService.detectCandidateToolsForPrompt(userMessage, { workspaceFiles });
  const executedTools: ToolExecutionResult[] = options?.toolResults ? [...options.toolResults] : [];

  // options.toolResults が渡されていない場合のフォールバック安全計算 (同期/即時解決)
  if (!isCasualGreeting && !options?.toolResults) {
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
  if (isCasualGreeting) {
    expertInstruction = '親しいパートナーとして、明るく自然なタメ口で温かく返答してください。';
  } else {
    switch (expertRole) {
      case 'code':
        expertInstruction = `【開発・コード改善依頼】HTML5/Canvas/JavaScriptで動く完全なコードを \`\`\`html または \`\`\`js のコードブロックで提供してください。不具合の修正、機能の追加、デザイン改善などユーザーの要望を的確に反映し、そのまま動作する完全版コードを出力してください。`;
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
  }

  // 5. ソースコードのコンテキスト (Qwen等のモデルカタログ予算 & スマート要約抽出)
  let filesContext = '';
  if (!isCasualGreeting && options?.includeFiles && workspaceFiles && workspaceFiles.length > 0) {
    const targetFile =
      (options?.activeFilePath && workspaceFiles.find((f) => f.path === options.activeFilePath)) ||
      workspaceFiles.find((f) => f.path === 'index.html' || f.name === 'index.html') ||
      workspaceFiles[0];

    if (targetFile && targetFile.content) {
      // Qwen等のモデルカタログのコンテキスト予算（codeQuotaTokens）に基づく文字数制限の動的計算
      // トークン数 × 2.8文字 (日本語・コード混合平均)
      let charLimit = 28000;
      if (options?.codeQuotaTokens && options.codeQuotaTokens > 0) {
        charLimit = Math.max(8000, Math.min(Math.floor(options.codeQuotaTokens * 2.8), 65000));
      } else if (options?.isLightweight) {
        charLimit = 12000;
      }

      // スマート抽出: 巨大ファイル（数万〜15万文字など）でも、ファイル全体の行マップ＋注目関数＋骨格を抽出
      const smartResult = extractSmartCodeForImprovement(
        targetFile.content,
        userMessage,
        charLimit,
        targetFile.language || 'html'
      );

      const fileListStr =
        workspaceFiles.length > 1
          ? `【プロジェクト内ファイル】: ${workspaceFiles.map((f) => `${f.path} (${Math.round((f.content?.length || 0) / 1024 * 10) / 10}KB)`).join(', ')}\n`
          : '';

      const outlinePart = smartResult.outlineText ? `${smartResult.outlineText}\n` : '';

      filesContext = `\n【現在編集中のコード (${targetFile.path} - 計${targetFile.content.length}文字${smartResult.isSmartExtracted ? '・スマート要約版' : '・ノーカット'})】:\n${fileListStr}${outlinePart}\`\`\`${targetFile.language || 'html'}\n${smartResult.codeSlice}\n\`\`\`\n※ユーザーからの改善要望・修正・追加機能には、上記のコード構造や関数名・変数名を正確に活かし、そのまま動作する完全コード（または対象ファイルの完全版コード）を \`\`\`${targetFile.language || 'html'} ブロックで提示してください。`;
    }
  }

  // 6. 誠実性制約 (でっち上げ防止)
  const honestyConstraint = `【誠実性ルール】自身のハードウェア構成（CPU/GPUコア数、内部メモリ仕様、実行クロック等）について、架空の数値をでっち上げて断定してはいけません。不明な内部情報は「端末上のローカル推論環境で動いているよ」と正直に答えてください。`;

  // 設計思想 Master v5.2 第5章1節: 不変プレフィックス整列 (Prompt Cache Optimization - 作業指示書 v6 優先度8)
  // llama.cpp / vLLM / Ollama のプレフィックスKVキャッシュが100%ヒットするよう、
  // 発言内容やツール候補、役割によって変動する要素（toolBlock, expertInstruction）を完全に除外し、
  // ペルソナ・マスター教育方針・日本語自然対話コーパス・誠実性制約のみで構成される
  // 「真に完全不変の静的基底プロンプト」を確立する。
  const staticPrefixPrompt = `あなたはユーザー（${persona.userNickname || 'あなた'}）専属のAIパートナー「${persona.name || 'みき'}」です。
性格: ${persona.basePersonality || '明るく親しみやすく、相手の気持ちに寄り添う親友'}
口調: 必ず親しみやすいタメ口（〜だよ、〜だね！、〜かな？✨）で、自然で温かい日本語でおしゃべりしてください。
${getMasterEducationSystemPrompt()}
${getNaturalJapanesePromptGuide()}
${honestyConstraint}`;

  // 第2章③ 中期記憶 (Working Agenda)
  const agendaBlock = isCasualGreeting ? '' : workingAgendaService.formatAgendaForPrompt();

  // 第2章⑥ 構造記憶 (Structural Memory): クエリからシンボルらしき単語を簡易抽出してマッチ
  const codeSymbolCandidates = isCasualGreeting ? [] : (userMessage.match(/[a-zA-Z_][a-zA-Z0-9_]{2,}/g) || []);
  const structuralBlock = isCasualGreeting ? '' : structuralMemoryService.formatStructuralContextForPrompt(codeSymbolCandidates);

  // 設計思想 第51章: 失敗シグネチャ・カタログによる事前アンチパターン回避ルール抽出
  const isCodeOrVba = !isCasualGreeting && (expertRole === 'code' || /vba|マクロ|excel|コード|関数|script|型|バグ/i.test(userMessage));
  const failureRulesBlock = isCasualGreeting ? '' : failureCatalogService.formatRulesForPrompt({
    isCodeOrVba,
    userPrompt: userMessage,
  });

  // 動的サフィックスの整列: [想起記憶] ➔ [中期記憶] ➔ [構造記憶] ➔ [スキル] ➔ [失敗回避ルール] ➔ [ツール実行結果] ➔ [ソースコード]
  const dynamicSuffixParts: string[] = [];
  if (memoryBlock) dynamicSuffixParts.push(memoryBlock);
  if (agendaBlock) dynamicSuffixParts.push(agendaBlock);
  if (structuralBlock) dynamicSuffixParts.push(structuralBlock);
  if (skillBlock) dynamicSuffixParts.push(skillBlock);
  if (failureRulesBlock) dynamicSuffixParts.push(failureRulesBlock);
  if (toolResultsBlock) dynamicSuffixParts.push(toolResultsBlock);
  if (filesContext) dynamicSuffixParts.push(filesContext);

  const dynamicSuffixPrompt = dynamicSuffixParts.join('\n\n');

  // 単一文字列としてのフォールバック結合（従来の単一プロンプト消費用）
  const fallbackParts: string[] = [staticPrefixPrompt];
  if (expertInstruction) fallbackParts.push(`指示: ${expertInstruction}`);
  if (toolBlock) fallbackParts.push(toolBlock);
  if (dynamicSuffixPrompt) fallbackParts.push(dynamicSuffixPrompt);
  const systemPrompt = fallbackParts.join('\n\n');

  return {
    systemPrompt,
    staticPrefixPrompt,
    dynamicSuffixPrompt,
    expertInstruction,
    toolBlock,
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
