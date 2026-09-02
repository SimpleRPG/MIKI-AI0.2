import { PersonaConfig, MemoryItem, WorkspaceFile } from '../types';
import { getNaturalJapanesePromptGuide } from '../data/japaneseKnowledgeData';
import { getMasterEducationSystemPrompt } from '../data/masterEducationKnowledge';
import { retrieveRelevantMemories } from './memoryRetrieval';

export { retrieveRelevantMemories };

/**
 * Analyzes the user's intent to set appropriate temperature and prompt context.
 */
export function classifyPromptForMoE(prompt: string): {
  role: 'code' | 'shader' | 'logic' | 'moe_chat';
  temperature: number;
} {
  const p = (prompt || '').trim();
  const lowerPrompt = p.toLowerCase();

  const isShader = /webgpu|wgsl|glsl|シェーダー|shader|three\.js|3d|threejs|パーティクル|流体|fluid/i.test(lowerPrompt);
  const isCode = /html|javascript|typescript|js|ts|css|react|コード|プログラム|関数|ゲーム|game|作って|作成|開発|実装|追加/i.test(lowerPrompt);
  const isLogic = /バグ|bug|エラー|error|例外|修正|直して|デバッグ|debug|動かない|なぜ|理由|計算|アルゴリズム|ロジック/i.test(lowerPrompt);

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

/**
 * Builds compact, high-efficiency System Prompt for Miki on SLMs (Qwen2.5, Llama3.2, etc.)
 */
export function buildExpertSystemPrompt(
  expertRole: 'code' | 'shader' | 'logic' | 'moe_chat',
  persona: PersonaConfig,
  memories: MemoryItem[],
  workspaceFiles: WorkspaceFile[],
  options?: { isLightweight?: boolean; includeFiles?: boolean; currentUserMessage?: string }
): string {
  // 記憶検索(RAG簡易版): 「先頭3件固定」ではなく、今の発言に関連する記憶だけを
  // 上位数件選ぶ。currentUserMessage が渡されなかった場合は後方互換で
  // 単純に先頭数件を使う(呼び出し側の移行漏れによる崩壊を防ぐため)。
  const selectedMemories = options?.currentUserMessage
    ? retrieveRelevantMemories(options.currentUserMessage, memories, { limit: 5 })
    : memories.filter((m) => m.active !== false).slice(0, 3);

  const activeMemories = selectedMemories.map((m) => `・${m.content}`).join('\n');

  let expertInstruction = '';
  switch (expertRole) {
    case 'code':
      expertInstruction = `【開発依頼】HTML5/Canvas/JavaScriptで動く完全なコードを \`\`\`html のコードブロックで提供してください。`;
      break;

    case 'shader':
      expertInstruction = `【グラフィック依頼】WebGPU/Canvasを用いた描画コードを \`\`\`html のコードブロックで提供してください。`;
      break;

    case 'logic':
      expertInstruction = `【デバッグ依頼】不具合の原因を簡潔に説明し、修正済みの完全なコードをコードブロックで出力してください。`;
      break;

    case 'moe_chat':
    default:
      expertInstruction = `親しみやすく温かいタメ口（〜だよ、〜だね！✨）で自然に返答してください。`;
      break;
  }

  // Include file summary only if explicitly needed or requested
  let filesContext = '';
  if (options?.includeFiles && workspaceFiles && workspaceFiles.length > 0) {
    const mainFile = workspaceFiles.find((f) => f.path === 'index.html' || f.name === 'index.html') || workspaceFiles[0];
    if (mainFile && mainFile.content) {
      filesContext = `\n【現在のソースコード】:\n\`\`\`${mainFile.language || 'html'}\n${mainFile.content.slice(0, 600)}\n\`\`\``;
    }
  }

  return `あなたはユーザー（${persona.userNickname || 'あなた'}）専属のAIパートナー「${persona.name || 'みき'}」です。
性格: ${persona.basePersonality || '明るく親しみやすく、相手の気持ちに寄り添う親友'}
口調: 必ず親しみやすいタメ口（〜だよ、〜だね！、〜かな？✨）で、自然で温かい日本語でおしゃべりしてください。
注意: あなた自身が今どんな仕組み（CPU/GPU/ハードウェア構成など）で動いているかについて聞かれても、断定的な技術説明をでっち上げないでください。正確に分からないことは「詳しいことは分からないけど」と素直に前置きし、憶測で答えず短く流してください。
${getMasterEducationSystemPrompt()}
${getNaturalJapanesePromptGuide()}
指示: ${expertInstruction}
${activeMemories ? `【大切な記憶・ユーザーの好み】\n${activeMemories}` : ''}${filesContext}`;
}

