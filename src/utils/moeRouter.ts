import { MoERouteInfo, PersonaConfig, MemoryItem, WorkspaceFile } from '../types';
import { getNaturalJapanesePromptGuide } from '../data/japaneseKnowledgeData';
import { getMasterEducationSystemPrompt } from '../data/masterEducationKnowledge';

/**
 * Intelligent Prompt Analyzer for Unified Miki Assistant
 * Analyzes the user's intent to set appropriate temperature and instruction guidelines.
 */
export function classifyPromptForMoE(prompt: string): {
  role: 'code' | 'shader' | 'logic' | 'moe_chat';
  route: MoERouteInfo;
  temperature: number;
} {
  const p = (prompt || '').trim();
  const lowerPrompt = p.toLowerCase();
  const tStart = performance.now();

  const isShader = /webgpu|wgsl|glsl|シェーダー|shader|three\.js|3d|threejs|パーティクル|流体|fluid/i.test(lowerPrompt);
  const isCode = /html|javascript|typescript|js|ts|css|react|コード|プログラム|関数|ゲーム|game|作って|作成|開発|実装|追加/i.test(lowerPrompt);
  const isLogic = /バグ|bug|エラー|error|例外|修正|直して|デバッグ|debug|動かない|なぜ|理由|計算|アルゴリズム|ロジック/i.test(lowerPrompt);

  let role: 'code' | 'shader' | 'logic' | 'moe_chat' = 'moe_chat';
  let temp = 0.7;
  let primaryExpert = '🌸 みき (親密対話)';
  let reason = '自然な日本語対話・親密な記憶想起・日常のおしゃべり';

  if (isShader) {
    role = 'shader';
    temp = 0.6;
    primaryExpert = '⚡ みき (WebGPU & グラフィック)';
    reason = 'WebGPU / WGSL / Canvas 高速グラフィック・並列計算';
  } else if (isCode) {
    role = 'code';
    temp = 0.7;
    primaryExpert = '💻 みき (コード & アプリ開発)';
    reason = 'HTML5 / JS / Canvas 自律ゲーム＆Webアプリ開発';
  } else if (isLogic) {
    role = 'logic';
    temp = 0.3;
    primaryExpert = '🧩 みき (ロジック & デバッグ)';
    reason = 'コード診断・原因究明・論理デバッグ';
  }

  const computeLatencyMs = Math.max(1, Math.round(performance.now() - tStart));

  return {
    role,
    temperature: temp,
    route: {
      primaryExpert,
      activeExperts: [
        { id: 'unified-miki', name: primaryExpert, weight: 100, color: '#f43f5e', icon: '🌸' }
      ],
      routingReason: reason,
      computeLatencyMs,
    },
  };
}

/**
 * Builds compact, high-efficiency System Prompt for Unified Miki on SLMs (Qwen2.5, Llama3.2, etc.)
 */
export function buildExpertSystemPrompt(
  expertRole: 'code' | 'shader' | 'logic' | 'moe_chat',
  persona: PersonaConfig,
  memories: MemoryItem[],
  workspaceFiles: WorkspaceFile[],
  options?: { isLightweight?: boolean; includeFiles?: boolean }
): string {
  const activeMemories = memories
    .filter((m) => m.active !== false)
    .slice(0, 3)
    .map((m) => `・${m.content}`)
    .join('\n');

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
${getNaturalJapanesePromptGuide()}
指示: ${expertInstruction}
${activeMemories ? `【大切な記憶・ユーザーの好み】\n${activeMemories}` : ''}${filesContext}`;
}
