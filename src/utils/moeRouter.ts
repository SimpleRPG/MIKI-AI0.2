import { PersonaConfig, MemoryItem, WorkspaceFile, SkillItem } from '../types';
import { getNaturalJapanesePromptGuide } from '../data/japaneseKnowledgeData';
import { getMasterEducationSystemPrompt } from '../data/masterEducationKnowledge';
import { retrieveScoredMemories } from './memoryRetrieval';
import { skillsService } from '../services/skillsService';

/**
 * ユーザーの意図を分析し、温度感と専門役割を判定する
 */
export function classifyPromptForMoE(prompt: string): {
  role: 'code' | 'shader' | 'logic' | 'moe_chat';
  temperature: number;
} {
  const p = (prompt || '').trim();
  const lowerPrompt = p.toLowerCase();

  const isShader = /webgpu|wgsl|glsl|シェーダー|shader|three\.js|3d|threejs|パーティクル|流体|fluid/i.test(lowerPrompt);
  const isCode = /html|javascript|typescript|js|ts|css|react|コード|プログラム|関数|ゲーム|game|作って|作成|開発|実装|追加/i.test(lowerPrompt);
  const isLogic = /バグ|bug|エラー|error|例外|修正|直して|デバッグ|debug|動かない|なぜ|理由|計算|アルゴリズム|ロジック|vba/i.test(lowerPrompt);

  let role: 'code' | 'shader' | 'logic' | 'moe_chat' = 'moe_chat';
  let temp = 0.7;

  if (isShader) {
    role = 'shader';
    temp = 0.6;
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
  };
}

export interface PromptContextTrackingResult {
  systemPrompt: string;
  usedMemories: Array<{ id: string; content: string; score?: number }>;
  usedSkills: Array<{ id: string; name: string }>;
  promptLengthChars: number;
}

/**
 * 設計思想 4. RAG・外部記憶 ＆ 5. 小型モデルの限界 ＆ 13. スキルライブラリ
 * コンテキスト予算を考慮しながら、スコアリング記憶と適用可能スキルを注入したシステムプロンプトを構築
 */
export function buildExpertSystemPromptWithTracking(
  expertRole: 'code' | 'shader' | 'logic' | 'moe_chat',
  persona: PersonaConfig,
  memories: MemoryItem[],
  workspaceFiles: WorkspaceFile[],
  userMessage: string = '',
  options?: { isLightweight?: boolean; includeFiles?: boolean; maxMemories?: number }
): PromptContextTrackingResult {
  const maxMemories = options?.maxMemories || (options?.isLightweight ? 3 : 5);

  // 1. 記憶のRAG検索 (バイグラム + 👍/👎 + 承認状態 + 重要度スコアリング)
  // 設計思想 25: profile/preference等の事実性カテゴリは未承認情報を確定事実として使わない (onlyApprovedForFacts)
  const scoredMemories = retrieveScoredMemories(userMessage, memories, {
    limit: maxMemories,
    alwaysIncludePinned: true,
    filterExpired: true,
    onlyApprovedForFacts: true,
  });

  const usedMemories = scoredMemories.map((sm) => ({
    id: sm.memory.id,
    content: sm.memory.content,
    score: Math.round(sm.score * 10) / 10,
    approved: sm.memory.approved,
    isUnverified: sm.memory.approved === false,
  }));

  const memoryBlock = scoredMemories.length > 0
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

  // 2. スキルライブラリ（手続き記憶）のマッチング
  const matchedSkills = skillsService.matchSkillsForQuery(userMessage);
  const usedSkills = matchedSkills.map((s) => ({ id: s.id, name: s.name }));

  const skillBlock = matchedSkills.length > 0
    ? `【適用された実行スキル手順】:\n${matchedSkills.map((s) => `[${s.name} (Ver ${s.version})]\n手順: ${s.steps.join(' ➔ ')}`).join('\n')}`
    : '';

  // 3. 役割別インストラクション
  let expertInstruction = '';
  switch (expertRole) {
    case 'code':
      expertInstruction = `【開発依頼】HTML5/Canvas/JavaScriptで動く完全なコードを \`\`\`html のコードブロックで提供してください。`;
      break;

    case 'shader':
      expertInstruction = `【グラフィック依頼】WebGPU/Canvasを用いた描画コードを \`\`\`html のコードブロックで提供してください。`;
      break;

    case 'logic':
      expertInstruction = `【デバッグ・ロジック依頼】不具合の原因を簡潔に説明し、修正済みの完全なコードをコードブロックで出力してください。`;
      break;

    case 'moe_chat':
    default:
      expertInstruction = `親しみやすく温かいタメ口（〜だよ、〜だね！✨）で自然に返答してください。`;
      break;
  }

  // 4. ソースコードのコンテキスト
  let filesContext = '';
  if (options?.includeFiles && workspaceFiles && workspaceFiles.length > 0) {
    const mainFile = workspaceFiles.find((f) => f.path === 'index.html' || f.name === 'index.html') || workspaceFiles[0];
    if (mainFile && mainFile.content) {
      filesContext = `\n【現在のソースコード】:\n\`\`\`${mainFile.language || 'html'}\n${mainFile.content.slice(0, 600)}\n\`\`\``;
    }
  }

  // 5. 設計思想 5. 小型モデルの限界・誠実性制約 (でっち上げ防止)
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
${filesContext}`;

  return {
    systemPrompt,
    usedMemories,
    usedSkills,
    promptLengthChars: systemPrompt.length,
  };
}

/**
 * 互換性のための従来ラッパー
 */
export function buildExpertSystemPrompt(
  expertRole: 'code' | 'shader' | 'logic' | 'moe_chat',
  persona: PersonaConfig,
  memories: MemoryItem[],
  workspaceFiles: WorkspaceFile[],
  options?: { isLightweight?: boolean; includeFiles?: boolean }
): string {
  const result = buildExpertSystemPromptWithTracking(
    expertRole,
    persona,
    memories,
    workspaceFiles,
    '',
    options
  );
  return result.systemPrompt;
}
