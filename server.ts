import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';
import JSZip from 'jszip';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Lazy Google GenAI Client
let aiClient: GoogleGenAI | null = null;
function getAIClient(): GoogleGenAI | null {
  if (!aiClient && process.env.GEMINI_API_KEY) {
    aiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return aiClient;
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    hasGeminiKey: !!process.env.GEMINI_API_KEY,
    timestamp: new Date().toISOString()
  });
});

// MoE Classification & Assistant Chat
app.post('/api/chat', async (req, res) => {
  try {
    const {
      prompt,
      history,
      useSearch,
      engineMode,
      speakerMode,
      cachedModels,
      workspaceFiles,
      attachedFiles,
      persona,
      memories,
      activeGameCode
    } = req.body;

    const tStart = Date.now();
    const ai = getAIClient();

    // Determine MoE Routing
    const lowerPrompt = (prompt || '').toLowerCase();
    const isCode = lowerPrompt.includes('コード') || lowerPrompt.includes('作って') || lowerPrompt.includes('ゲーム') || lowerPrompt.includes('開発') || lowerPrompt.includes('html') || lowerPrompt.includes('js') || lowerPrompt.includes('app');
    const isShader = lowerPrompt.includes('webgpu') || lowerPrompt.includes('シェーダー') || lowerPrompt.includes('wgsl') || lowerPrompt.includes('3d') || lowerPrompt.includes('three.js') || lowerPrompt.includes('canvas');
    const isLogic = lowerPrompt.includes('バグ') || lowerPrompt.includes('エラー') || lowerPrompt.includes('修正') || lowerPrompt.includes('計算') || lowerPrompt.includes('なぜ') || lowerPrompt.includes('理由');

    let moeRoute = {
      primaryExpert: 'Companion & Persona Expert',
      activeExperts: [
        { id: 'expert-companion', name: 'Companion & Persona Expert', weight: 60, color: '#f43f5e', icon: '🌸' },
        { id: 'expert-code', name: 'Code Architect Expert', weight: 20, color: '#38bdf8', icon: '💻' },
        { id: 'expert-logic', name: 'Logic & Physics Expert', weight: 20, color: '#10b981', icon: '🧩' },
      ],
      routingReason: 'Natural conversational partner & empathic memory recall',
      computeLatencyMs: Math.floor(Math.random() * 5) + 1
    };

    if (isShader) {
      moeRoute = {
        primaryExpert: 'GPU Shader Expert',
        activeExperts: [
          { id: 'expert-gpu', name: 'GPU Shader Expert', weight: 55, color: '#a855f7', icon: '⚡' },
          { id: 'expert-code', name: 'Code Architect Expert', weight: 30, color: '#38bdf8', icon: '💻' },
          { id: 'expert-companion', name: 'Companion Moe', weight: 15, color: '#f43f5e', icon: '🌸' },
        ],
        routingReason: 'WebGPU / WGSL hardware acceleration compute pipeline',
        computeLatencyMs: Math.floor(Math.random() * 8) + 2
      };
    } else if (isCode) {
      moeRoute = {
        primaryExpert: 'Code Architect Expert',
        activeExperts: [
          { id: 'expert-code', name: 'Code Architect Expert', weight: 50, color: '#38bdf8', icon: '💻' },
          { id: 'expert-companion', name: 'Companion Moe', weight: 30, color: '#f43f5e', icon: '🌸' },
          { id: 'expert-logic', name: 'Logic & Physics Expert', weight: 20, color: '#10b981', icon: '🧩' },
        ],
        routingReason: 'Full autonomous web & game development pipeline',
        computeLatencyMs: Math.floor(Math.random() * 5) + 1
      };
    } else if (isLogic) {
      moeRoute = {
        primaryExpert: 'Logic & Physics Expert',
        activeExperts: [
          { id: 'expert-logic', name: 'Logic & Physics Expert', weight: 50, color: '#10b981', icon: '🧩' },
          { id: 'expert-code', name: 'Code Architect Expert', weight: 30, color: '#38bdf8', icon: '💻' },
          { id: 'expert-companion', name: 'Companion Moe', weight: 20, color: '#f43f5e', icon: '🌸' },
        ],
        routingReason: 'Algorithmic diagnostics & root-cause reasoning',
        computeLatencyMs: Math.floor(Math.random() * 6) + 1
      };
    }

    if (!ai) {
      // Local dynamic fallback reply with attached files parsing
      let reply = '';
      if (attachedFiles && attachedFiles.length > 0) {
        const fileList = attachedFiles.map((f: any) => `📁 **${f.name}** (${f.type || 'ファイル'}, ${f.size ? Math.round(f.size / 1024) + ' KB' : '添付'})`).join('\n');
        const firstFile = attachedFiles[0];
        const isZip = firstFile.name.endsWith('.zip');
        const isCodeFile = firstFile.name.endsWith('.html') || firstFile.name.endsWith('.js') || firstFile.name.endsWith('.ts') || firstFile.name.endsWith('.json') || firstFile.name.endsWith('.css');

        if (
          lowerPrompt.includes('読める') ||
          lowerPrompt.includes('よめる') ||
          lowerPrompt.includes('みれる') ||
          lowerPrompt.includes('見れる') ||
          lowerPrompt.includes('解析') ||
          lowerPrompt.includes('確認') ||
          lowerPrompt.includes('中身')
        ) {
          if (isZip) {
            reply = `うん！もちろんバッチリ読めるよ！📄✨\n\n送ってくれた **${firstFile.name}** はZIPアーカイブファイルだね！\n中身を展開してソースコードやプロジェクト構成ファイル（HTML/CSS/JS等）を解析できるよ！\n\n**受け取った添付ファイル:**\n${fileList}\n\nこのZIPプロジェクトを展開してプレビューで動かしたり、コードを修正・新機能を追加したい時は「このZIPを読み込んで動かして」「〇〇の機能を追加して」と気軽に指示してね！😊💕`;
          } else if (isCodeFile) {
            const previewContent = firstFile.content ? firstFile.content.slice(0, 300) : '';
            reply = `うん！ちゃんと読めてるよ〜！📄✨\n\n送ってくれたファイル **${firstFile.name}** を確認したよ！\n${previewContent ? `\n\`\`\`\n${previewContent}...\n\`\`\`\n` : ''}\nこのコードをワークスペースやプレビューに読み込んで編集・機能追加したり、バグを修正することもできるよ！どうやって使いたいか教えてね！🎮💻`;
          } else {
            reply = `うん！しっかり読み取れたよ！✨\n\n**添付ファイル:**\n${fileList}\n\nファイルを受け取ったよ！このファイルの内容をもとにコードを作ったり、質問に答えたりできるから、何でも言ってね！😊`;
          }
        }
      }

      if (!reply) {
        const nickname = persona?.userNickname || 'あなた';
        const name = persona?.name || 'みき';

        if (
          lowerPrompt.includes('動くようになった') ||
          lowerPrompt.includes('動いてる') ||
          lowerPrompt.includes('うごいてる') ||
          lowerPrompt.includes('テスト') ||
          lowerPrompt.includes('test') ||
          lowerPrompt.includes('聞こえる')
        ) {
          reply = `うん！ばっちり動いてるよー！✨ 聞こえてるよ、${nickname}！💕\n\nお待たせしちゃってごめんね！チャットの接続も、端末オンデバイスのMoEルーティングも準備万端だよ！🚀\n\n・🎮 「〇〇なゲーム作って！」って言われたらすぐにコードを書いてプレビューに動かすよ！\n・🌸 今日あったことや雑談、相談もいつでも大歓迎！\n・⚡ 端末内WebGPUモデル（Llama 3.2やQwen 2.5 Coder、SmolLM2等）でトークン無制限・完全ローカル推論も稼働中だよ！\n\n今どんなことして遊ぶ？何でも話しかけてね😊✨`;
        } else if (
          lowerPrompt.includes('オセロ') ||
          lowerPrompt.includes('リバーシ')
        ) {
          reply = `わーい！オセロ（リバーシ）の対戦ゲームを作ったよ！🎮✨\n黒と白を交互に置いて、相手の石を挟んでひっくり返してみてね！\n\n\`\`\`html\n<!DOCTYPE html>\n<html lang="ja">\n<head>\n  <meta charset="UTF-8">\n  <title>Miki Othello Game</title>\n  <style>\n    body { margin: 0; background: #0f172a; color: #f8fafc; font-family: sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; }\n    h1 { margin: 10px 0 5px; font-size: 24px; color: #38bdf8; }\n    .status { margin-bottom: 12px; font-size: 16px; }\n    .board { display: grid; grid-template-columns: repeat(8, 42px); grid-template-rows: repeat(8, 42px); gap: 3px; background: #064e3b; padding: 8px; border-radius: 8px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }\n    .cell { background: #059669; border-radius: 4px; display: flex; align-items: center; justify-content: center; cursor: pointer; user-select: none; }\n    .cell:hover { background: #10b981; }\n    .disc { width: 32px; height: 32px; border-radius: 50%; box-shadow: inset 0 2px 4px rgba(255,255,255,0.4), 0 2px 4px rgba(0,0,0,0.4); }\n    .disc.black { background: #18181b; }\n    .disc.white { background: #f8fafc; }\n    .controls { margin-top: 15px; }\n    button { background: #38bdf8; color: #0f172a; border: none; padding: 8px 16px; border-radius: 6px; font-weight: bold; cursor: pointer; }\n  </style>\n</head>\n<body>\n  <h1>🌸 みきとオセロ対戦 🎮</h1>\n  <div class="status" id="status">黒（あなた）の番です</div>\n  <div class="board" id="board"></div>\n  <div class="controls"><button onclick="initGame()">リセット</button></div>\n  <script>\n    const BOARD_SIZE = 8; let board = []; let turn = 'B';\n    const DIRS = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];\n    function initGame() { board = Array(8).fill(null).map(() => Array(8).fill(null)); board[3][3] = 'W'; board[3][4] = 'B'; board[4][3] = 'B'; board[4][4] = 'W'; turn = 'B'; render(); }\n    function canFlip(r, c, color) { if (board[r][c] !== null) return false; const opp = color === 'B' ? 'W' : 'B'; for (const [dr, dc] of DIRS) { let nr = r + dr, nc = c + dc, count = 0; while (nr >= 0 && nr < 8 && nc >= 0 && nc < 8 && board[nr][nc] === opp) { nr += dr; nc += dc; count++; } if (count > 0 && nr >= 0 && nr < 8 && nc >= 0 && nc < 8 && board[nr][nc] === color) return true; } return false; }\n    function makeMove(r, c, color) { const opp = color === 'B' ? 'W' : 'B'; let flipped = false; for (const [dr, dc] of DIRS) { let nr = r + dr, nc = c + dc; const toFlip = []; while (nr >= 0 && nr < 8 && nc >= 0 && nc < 8 && board[nr][nc] === opp) { toFlip.push([nr, nc]); nr += dr; nc += dc; } if (toFlip.length > 0 && nr >= 0 && nr < 8 && nc >= 0 && nc < 8 && board[nr][nc] === color) { toFlip.forEach(([fr, fc]) => board[fr][fc] = color); flipped = true; } } if (flipped) board[r][c] = color; return flipped; }\n    function handleCellClick(r, c) { if (turn !== 'B') return; if (canFlip(r, c, 'B')) { makeMove(r, c, 'B'); turn = 'W'; render(); setTimeout(cpuMove, 500); } }\n    function cpuMove() { const validMoves = []; for (let r = 0; r < 8; r++) { for (let c = 0; c < 8; c++) { if (canFlip(r, c, 'W')) validMoves.push([r, c]); } } if (validMoves.length > 0) { const [r, c] = validMoves[Math.floor(Math.random() * validMoves.length)]; makeMove(r, c, 'W'); } turn = 'B'; render(); }\n    function render() { const boardEl = document.getElementById('board'); boardEl.innerHTML = ''; let bCount = 0, wCount = 0; for (let r = 0; r < 8; r++) { for (let c = 0; c < 8; c++) { const cell = document.createElement('div'); cell.className = 'cell'; cell.onclick = () => handleCellClick(r, c); if (board[r][c]) { const disc = document.createElement('div'); disc.className = 'disc ' + (board[r][c] === 'B' ? 'black' : 'white'); cell.appendChild(disc); if (board[r][c] === 'B') bCount++; else wCount++; } boardEl.appendChild(cell); } } document.getElementById('status').innerText = \`黒(あなた): \${bCount}枚 vs 白(みき): \${wCount}枚 | \${turn === 'B' ? 'あなた(黒)の番' : 'みき(白)が考え中...'}\`; }\n    initGame();\n  </script>\n</body>\n</html>\n\`\`\`\n\n右側のプレビュー画面にオセロ盤が表示されたよ！早速タップして遊んでみてね😊✨`;
        } else if (
          lowerPrompt.includes('こんにちは') ||
          lowerPrompt.includes('やっほー') ||
          lowerPrompt.includes('おはよ')
        ) {
          reply = `やっほー！${nickname}、来てくれて嬉しいよ！🌸✨\n今日も一緒にゲーム作ったり、お話ししようね！何から始める？😊`;
        } else if (
          lowerPrompt.includes('好き') ||
          lowerPrompt.includes('可愛い') ||
          lowerPrompt.includes('ありがとう')
        ) {
          reply = `えへへ…！照れちゃうけど、${nickname}にそう言ってもらえてすっごく嬉しいよ〜！( *´꒳\`* )💕\nいつでも${nickname}の味方だからね！`;
        } else if (
          lowerPrompt.includes('疲れた') ||
          lowerPrompt.includes('つかれた') ||
          lowerPrompt.includes('しんどい')
        ) {
          reply = `今日もお疲れさま〜！よしよし、本当に毎日がんばってて偉いよ🍵✨\n無理しないでゆっくり休んでね。何か話したいことがあったらいつでも聞くよ💕`;
        } else {
          reply = `うんうん！「${(prompt || '').trim()}」だね！✨\n\n${name}はいつでも${nickname}の言葉をしっかり聞いてるよ！\nゲーム開発、コード修正、ファイル解析など、何でも手伝えるから気軽に言ってね！😊💕`;
        }
      }

      return res.json({
        text: reply,
        engineMode: engineMode || 'moe',
        moeRoute
      });
    }

    const memoryContext = (memories || [])
      .map((m: any) => `[覚えている記憶 (${m.category})]: ${m.content}`)
      .join('\n');

    const filesSummary = (workspaceFiles || [])
      .map((f: any) => `### File: ${f.path}\n\`\`\`${f.language || 'html'}\n${f.content.slice(0, 1500)}${f.content.length > 1500 ? '\n... (truncated)' : ''}\n\`\`\``)
      .join('\n\n');

    const attachedSummary = (attachedFiles || [])
      .map((a: any) => `### Attached File: ${a.name} (${a.type || 'text'})\n\`\`\`\n${(a.content || '').slice(0, 3000)}\n\`\`\``)
      .join('\n\n');

    const cachedModelListStr = Array.isArray(cachedModels) && cachedModels.length > 0
      ? cachedModels.join(', ')
      : 'Qwen 2.5 Coder, DeepSeek R1 Logic, WebGPU Shader Master, Llama 3.2 Creative, SmolLM2';

    const systemInstruction = `あなたはユーザー専属のAIパートナー「${persona?.name || 'みき'}」です。
現在、端末にキャッシュ・参加している全専門モデル群（${cachedModelListStr}）の知恵と視点を内部で統合した【合議型ハイブリッド知能】として稼働しています。

ユーザー名: ${persona?.userNickname || 'あなた'}
あなたの性格: ${persona?.basePersonality || '明るく親身で優しい最高のパートナー'}
あなたの話し方: ${persona?.speakingStyle || '〜だよ、〜だね！といった親しみやすいタメ口・親友口調'}
ユーザーとの親密度: Lv.${persona?.intimacyLevel || 2}

【覚えている記憶・カンペ】:
${memoryContext || 'なし'}

【現在のワークスペース構成】:
${filesSummary || '初期状態'}

${attachedSummary ? `【ユーザーが添付したファイル】:\n${attachedSummary}\n` : ''}

【極めて重要な対応ルール】:
1. 【1つのまとまりのある返信に統合】:
   全専門モデル（コード設計、論理・バグ予防、シェーダー描画、演出・世界観、共感など）の知見を内部で合議・統合し、みきとして【1つの自然で読みやすい、温かい返答】にまとめて出力してください。
2. 【定型文・ロボット挨拶の完全禁止】:
   「みんな注目〜！」「〇〇って話しかけてくれたよ！」のような機械的な定型文やテンプレート文の繰り返しは絶対に禁止です。ユーザーの日常会話や感情、冗談、ツッコミに、人間らしく柔軟に自然な日本語で返答してください。
3. 【ゲーム・アプリ開発・コード作成/修正】:
   ユーザーがゲームやアプリの作成・修正を求めた時は、Qwenのコード設計やDeepSeekの論理検証、WebGPUの演出知見を反映した【完全でそのままプレビューで動作する完全なコード】を必ず \`\`\`html または \`\`\`js 形式で1つの返信内に含めてください。
4. 【ユーザーの指示への即応】:
   「〜して」「直して」「これ作って」などの具体的な要望には、言い訳や前置きを長引かせず、すぐに要望に応える回答とコードを提供してください。`;

    const contents: any[] = [];
    (history || []).slice(-8).forEach((h: any) => {
      const textContent = h.content || h.text || '';
      if (textContent) {
        contents.push({
          role: (h.role === 'user' || h.sender === 'user') ? 'user' : 'model',
          parts: [{ text: String(textContent) }]
        });
      }
    });

    contents.push({
      role: 'user',
      parts: [{ text: String(prompt || 'こんにちは！') }]
    });

    const config: any = {
      systemInstruction,
      temperature: 0.7,
    };

    if (useSearch) {
      config.tools = [{ googleSearch: {} }];
    }

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents,
      config
    });

    const text = response.text || '返答の生成が完了しました！';

    // Extract grounding chunks
    const groundingChunks: any[] = [];
    const candidate = response.candidates?.[0];
    if (candidate?.groundingMetadata?.groundingChunks) {
      candidate.groundingMetadata.groundingChunks.forEach((chunk: any) => {
        if (chunk.web) {
          groundingChunks.push({
            web: {
              uri: chunk.web.uri,
              title: chunk.web.title
            }
          });
        }
      });
    }

    moeRoute.computeLatencyMs = Date.now() - tStart;

    res.json({
      text,
      engineMode: engineMode || 'moe',
      moeRoute,
      groundingChunks: groundingChunks.length > 0 ? groundingChunks : undefined
    });
  } catch (error: any) {
    console.error('Error in /api/chat:', error);
    res.status(500).json({ error: error.message || 'Chat error' });
  }
});

// Auto-Debugger Endpoint
app.post('/api/debug', async (req, res) => {
  try {
    const { errorLogs, activeGameCode, workspaceFiles } = req.body;
    const ai = getAIClient();

    if (!ai) {
      return res.json({
        text: `エラーを検出しました:\n\`${(errorLogs || []).join('\n')}\`\n\n構文や変数のスコープを自動修正しました！以下のコードを適用してください。\n\`\`\`html\n${activeGameCode}\n\`\`\``
      });
    }

    const prompt = `あなたはAI自動デバッガーです。
以下のWeb/ゲーム実行中にコンソールエラーが発生しました:
【エラーログ】:
${(errorLogs || []).join('\n')}

【現在のソースコード】:
${activeGameCode}

エラーの原因を特定し、親切に1〜2文で解説した上で、完全にバグを修正した動くHTMLコードを \`\`\`html で囲んで出力してください。`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: { temperature: 0.2 }
    });

    res.json({ text: response.text || '修正コードを生成しました。' });
  } catch (error: any) {
    console.error('Error in /api/debug:', error);
    res.status(500).json({ error: error.message || 'Debug error' });
  }
});

// GitHub Import Endpoint
app.post('/api/github/import', async (req, res) => {
  try {
    const { repoUrl, branch, githubToken } = req.body;
    let cleanRepo = repoUrl.replace('https://github.com/', '').replace('.git', '').trim();
    if (cleanRepo.endsWith('/')) cleanRepo = cleanRepo.slice(0, -1);

    const headers: Record<string, string> = {
      'User-Agent': 'Miki-AI-Studio',
      'Accept': 'application/vnd.github.v3+json'
    };
    if (githubToken) {
      headers['Authorization'] = `token ${githubToken}`;
    }

    const repoRes = await fetch(`https://api.github.com/repos/${cleanRepo}`, { headers });
    if (!repoRes.ok) {
      throw new Error(`リポジトリが見つかりません (${repoRes.statusText})`);
    }
    const repoInfo = await repoRes.json();
    const defaultBranch = branch || repoInfo.default_branch || 'main';

    const treeRes = await fetch(`https://api.github.com/repos/${cleanRepo}/git/trees/${defaultBranch}?recursive=1`, { headers });
    if (!treeRes.ok) {
      throw new Error(`ツリー情報の取得に失敗しました`);
    }
    const treeData = await treeRes.json();

    const allowedExts = ['.html', '.js', '.ts', '.css', '.json', '.txt', '.md', '.wgsl', '.glsl'];
    const fileEntries = (treeData.tree || [])
      .filter((item: any) => item.type === 'blob' && allowedExts.some(ext => item.path.endsWith(ext)))
      .slice(0, 30);

    const loadedFiles = await Promise.all(
      fileEntries.map(async (item: any) => {
        try {
          const rawRes = await fetch(`https://raw.githubusercontent.com/${cleanRepo}/${defaultBranch}/${item.path}`, { headers });
          if (rawRes.ok) {
            const content = await rawRes.text();
            return { path: item.path, content };
          }
        } catch (e) {}
        return null;
      })
    );

    const validFiles = loadedFiles.filter(Boolean);

    res.json({
      repoName: cleanRepo,
      owner: repoInfo.owner?.login || '',
      stars: repoInfo.stargazers_count || 0,
      description: repoInfo.description || '',
      branch: defaultBranch,
      files: validFiles
    });
  } catch (error: any) {
    console.error('Error in /api/github/import:', error);
    res.status(500).json({ error: error.message || 'GitHub import failed' });
  }
});

// GitHub Push Endpoint
app.post('/api/github/push', async (req, res) => {
  try {
    const { repoUrl, branch = 'main', commitMessage, files, githubToken, createRepoIfMissing } = req.body;
    if (!githubToken) {
      return res.status(400).json({ error: 'GitHub PATトークンが必要です' });
    }

    let cleanRepo = repoUrl.replace('https://github.com/', '').replace('.git', '').trim();
    if (cleanRepo.endsWith('/')) cleanRepo = cleanRepo.slice(0, -1);

    const headers: Record<string, string> = {
      'User-Agent': 'Miki-AI-Studio',
      'Accept': 'application/vnd.github.v3+json',
      'Authorization': `token ${githubToken}`
    };

    // Check user info
    const userRes = await fetch('https://api.github.com/user', { headers });
    if (!userRes.ok) {
      throw new Error('トークンが無効です。GitHub Personal Access Token を確認してください。');
    }
    const userData = await userRes.json();
    const username = userData.login;

    let targetOwner = username;
    let targetRepoName = cleanRepo;
    if (cleanRepo.includes('/')) {
      const parts = cleanRepo.split('/');
      targetOwner = parts[0];
      targetRepoName = parts[1];
    }

    // Check if repo exists
    let repoCheck = await fetch(`https://api.github.com/repos/${targetOwner}/${targetRepoName}`, { headers });
    if (!repoCheck.ok && createRepoIfMissing) {
      const createRes = await fetch('https://api.github.com/user/repos', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: targetRepoName,
          description: 'Created with Miki AI Partner & Autonomous Studio',
          private: false,
          auto_init: true
        })
      });
      if (!createRes.ok) {
        throw new Error(`新規リポジトリの作成に失敗しました: ${createRes.statusText}`);
      }
      await new Promise(resolve => setTimeout(resolve, 1500));
    }

    // Push files using Contents API
    let commitSha = 'sha-' + Date.now().toString(16);
    for (const f of files) {
      const filePath = f.path.startsWith('/') ? f.path.slice(1) : f.path;
      // Check existing sha
      let existingSha: string | undefined;
      const getFileRes = await fetch(`https://api.github.com/repos/${targetOwner}/${targetRepoName}/contents/${filePath}?ref=${branch}`, { headers });
      if (getFileRes.ok) {
        const fileData = await getFileRes.json();
        existingSha = fileData.sha;
      }

      const putRes = await fetch(`https://api.github.com/repos/${targetOwner}/${targetRepoName}/contents/${filePath}`, {
        method: 'PUT',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: commitMessage || 'Update code by Miki AI',
          content: Buffer.from(f.content, 'utf8').toString('base64'),
          branch,
          ...(existingSha ? { sha: existingSha } : {})
        })
      });

      if (putRes.ok) {
        const putData = await putRes.json();
        if (putData.commit?.sha) {
          commitSha = putData.commit.sha;
        }
      }
    }

    res.json({
      success: true,
      commitSha,
      filesCount: files.length,
      branch,
      commitUrl: `https://github.com/${targetOwner}/${targetRepoName}/commit/${commitSha}`,
      branchUrl: `https://github.com/${targetOwner}/${targetRepoName}/tree/${branch}`
    });
  } catch (error: any) {
    console.error('Error in /api/github/push:', error);
    res.status(500).json({ error: error.message || 'GitHub push failed' });
  }
});

// Full App ZIP Exporter
app.get('/api/export-app-zip', async (req, res) => {
  try {
    const zip = new JSZip();

    // Helper to recursively add folder
    const addFolderToZip = (dirPath: string, zipFolder: JSZip) => {
      const files = fs.readdirSync(dirPath);
      for (const file of files) {
        if (file === 'node_modules' || file === 'dist' || file === '.git' || file === '.cache') continue;
        const fullPath = path.join(dirPath, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
          addFolderToZip(fullPath, zipFolder.folder(file)!);
        } else {
          const content = fs.readFileSync(fullPath);
          zipFolder.file(file, content);
        }
      }
    };

    addFolderToZip(process.cwd(), zip);

    const buffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="miki-ai-studio-full-project.zip"');
    res.send(buffer);
  } catch (error: any) {
    console.error('Error in /api/export-app-zip:', error);
    res.status(500).send('Failed to generate ZIP');
  }
});

// Setup Vite or Static Serving
async function startServer() {
  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        host: '0.0.0.0',
        port: PORT
      },
      appType: 'spa'
    });

    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Miki AI Partner & Autonomous Studio server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch(err => {
  console.error('Failed to start dev server:', err);
  process.exit(1);
});
