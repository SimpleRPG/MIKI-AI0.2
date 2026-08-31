import { MoERouteInfo, LocalLLMModel, PersonaConfig, MemoryItem, WorkspaceFile } from '../types';

/**
 * MoE (Mixture of Experts) Dynamic Router
 * Dynamically computes semantic affinity, keyword densities, and realistic routing metrics!
 */
export function classifyPromptForMoE(prompt: string): {
  role: 'code' | 'shader' | 'logic' | 'moe_chat';
  route: MoERouteInfo;
  temperature: number;
} {
  const p = (prompt || '').trim();
  const lowerPrompt = p.toLowerCase();
  const tStart = performance.now();

  // Keyword lexicons with weighted semantic scores
  const shaderKeywords: [RegExp, number][] = [
    [/webgpu|wgsl|glsl/i, 40],
    [/シェーダー|shader|コンピュート/i, 35],
    [/three\.js|3d|threejs|babylon/i, 30],
    [/パーティクル|particle|流体|fluid/i, 30],
    [/canvas|キャンバス|描画|レンダリング|グラフィック/i, 20],
    [/アニメーション|animation|エフェクト/i, 15],
  ];

  const codeKeywords: [RegExp, number][] = [
    [/html|javascript|typescript|js|ts|css|react/i, 35],
    [/コード|プログラム|関数|コンポーネント|スクリプト/i, 30],
    [/ゲーム|game|ミニゲーム|rpg|アクション/i, 30],
    [/作って|作成|開発|実装|追加|構築|コーディング/i, 25],
    [/ボタン|ui|画面|レイアウト|デザイン/i, 20],
    [/アプリ|webアプリ|ツール/i, 20],
  ];

  const logicKeywords: [RegExp, number][] = [
    [/バグ|bug|エラー|error|例外|exception/i, 40],
    [/修正|直して|デバッグ|debug|直す/i, 35],
    [/動かない|失敗|動かないよ|動いてない/i, 30],
    [/なぜ|理由|どうして|why/i, 25],
    [/計算|アルゴリズム|ロジック|アルゴ|物理演算/i, 25],
    [/診断|チェック|検証|テスト/i, 20],
    [/比率|合ってる|ms|計測/i, 20],
  ];

  const companionKeywords: [RegExp, number][] = [
    [/こんにちは|おはよう|こんばんは|やっほー|ハロー|hello|hi/i, 35],
    [/みき|miki|大好き|好き|可愛い|かわいい|相棒|パートナー/i, 35],
    [/雑談|おしゃべり|話そ|話そう|聞いて/i, 30],
    [/疲れた|癒やして|つらい|寂しい|眠い|暇/i, 30],
    [/今日|昨日|明日|気分|天気|日常/i, 20],
    [/成功|どう|どうかな|ありがとう|感謝/i, 20],
  ];

  let shaderScore = 5;
  for (const [re, score] of shaderKeywords) {
    if (re.test(lowerPrompt)) shaderScore += score;
  }

  let codeScore = 10;
  for (const [re, score] of codeKeywords) {
    if (re.test(lowerPrompt)) codeScore += score;
  }

  let logicScore = 8;
  for (const [re, score] of logicKeywords) {
    if (re.test(lowerPrompt)) logicScore += score;
  }

  let companionScore = 15;
  for (const [re, score] of companionKeywords) {
    if (re.test(lowerPrompt)) companionScore += score;
  }

  // Factor in prompt characteristics
  if (p.length < 15 && !/[<>{}[\]=;]/.test(p)) {
    companionScore += 25; // Short conversational greetings
  }
  if (/[<>{}[\]=;`$]/.test(p)) {
    codeScore += 20;
    logicScore += 15;
  }

  const totalScore = shaderScore + codeScore + logicScore + companionScore;

  // Calculate dynamic normalized percentages
  let rawGpu = Math.round((shaderScore / totalScore) * 100);
  let rawCode = Math.round((codeScore / totalScore) * 100);
  let rawLogic = Math.round((logicScore / totalScore) * 100);
  let rawCompanion = 100 - (rawGpu + rawCode + rawLogic);

  // Guarantee minimum presence for cooperative MoE visualization
  rawGpu = Math.max(5, rawGpu);
  rawCode = Math.max(5, rawCode);
  rawLogic = Math.max(5, rawLogic);
  rawCompanion = Math.max(5, rawCompanion);

  const reSum = rawGpu + rawCode + rawLogic + rawCompanion;
  const wGpu = Math.round((rawGpu / reSum) * 100);
  const wCode = Math.round((rawCode / reSum) * 100);
  const wLogic = Math.round((rawLogic / reSum) * 100);
  const wCompanion = 100 - (wGpu + wCode + wLogic);

  const expertList = [
    { id: 'expert-gpu', name: 'GPU Shader Expert', weight: wGpu, color: '#a855f7', icon: '⚡', rawScore: shaderScore },
    { id: 'expert-code', name: 'Code Architect Expert', weight: wCode, color: '#38bdf8', icon: '💻', rawScore: codeScore },
    { id: 'expert-logic', name: 'Logic & Physics Expert', weight: wLogic, color: '#10b981', icon: '🧩', rawScore: logicScore },
    { id: 'expert-companion', name: 'Companion & Persona', weight: wCompanion, color: '#f43f5e', icon: '🌸', rawScore: companionScore },
  ].sort((a, b) => b.weight - a.weight);

  const top = expertList[0];
  let role: 'code' | 'shader' | 'logic' | 'moe_chat' = 'moe_chat';
  let temp = 0.75;
  let reason = '';

  if (top.id === 'expert-gpu') {
    role = 'shader';
    temp = 0.6;
    reason = 'WebGPU / WGSL / WebGL 高速グラフィック・並列計算パイプライン';
  } else if (top.id === 'expert-code') {
    role = 'code';
    temp = 0.7;
    reason = 'HTML5 / JS / Canvas 自律ゲーム＆Webアプリ開発パイプライン';
  } else if (top.id === 'expert-logic') {
    role = 'logic';
    temp = 0.3;
    reason = 'コード診断・原因究明・論理デバッグアルゴリズム';
  } else {
    role = 'moe_chat';
    temp = 0.75;
    reason = '自然な日本語対話・親密な記憶想起・共感エンジニアリング';
  }

  const routerLatencyMs = Math.max(1, Math.round(performance.now() - tStart));

  return {
    role,
    temperature: temp,
    route: {
      primaryExpert: top.name,
      activeExperts: expertList.map(({ rawScore, ...exp }) => exp),
      routingReason: reason,
      computeLatencyMs: routerLatencyMs,
    },
  };
}

/**
 * Builds custom specialized System Prompt for the routed MoE Expert
 * Optimized to be lightweight and fast for on-device SLMs (SmolLM2, Qwen2.5, Llama3.2)
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
      expertInstruction = `【役割: 💻 コード・アプリ開発】HTML5/Canvas/JavaScriptの動くコードを作成し、必ず \`\`\`html または \`\`\`javascript のコードブロックで出力してください。`;
      break;

    case 'shader':
      expertInstruction = `【役割: ⚡ WebGPU/シェーダー開発】WebGPU/WGSL/Canvasのアート・パーティクル・アニメーションコードを作成し、必ず \`\`\`html のコードブロックで出力してください。`;
      break;

    case 'logic':
      expertInstruction = `【役割: 🧩 ロジック・デバッグ】原因を簡潔に説明し、修正済みの完全なコードをコードブロックで出力してください。`;
      break;

    case 'moe_chat':
    default:
      expertInstruction = `【役割: 🌸 親密な会話・相棒】親しみやすく温かいタメ口で返答してください。`;
      break;
  }

  // Include file summary only if explicitly needed or requested
  let filesContext = '';
  if (options?.includeFiles && workspaceFiles && workspaceFiles.length > 0) {
    const mainFile = workspaceFiles.find((f) => f.path === 'index.html' || f.name === 'index.html') || workspaceFiles[0];
    if (mainFile && mainFile.content) {
      filesContext = `\n【既存コード参照】:\n\`\`\`${mainFile.language || 'html'}\n${mainFile.content.slice(0, 600)}\n\`\`\``;
    }
  }

  return `あなたはAIパートナーの「${persona.name || 'みき'}」です。
話し方: ${persona.speakingStyle || '親しみやすいタメ口'}
${expertInstruction}
${activeMemories ? `【記憶・好み】\n${activeMemories}` : ''}${filesContext}
日本語で簡潔・的確に回答してください。`;
}
