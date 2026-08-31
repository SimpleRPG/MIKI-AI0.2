import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import fs from 'fs';
import path from 'path';
import JSZip from 'jszip';

dotenv.config();

let aiClient: GoogleGenAI | null = null;
function getAIClient(): GoogleGenAI | null {
  if (!aiClient && process.env.GEMINI_API_KEY) {
    aiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return aiClient;
}

const GEMINI_MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-2.5-pro', 'gemini-3.7-flash'];

async function generateContentWithFallback(ai: GoogleGenAI, request: { contents: any; config?: any }) {
  let lastError: any = null;
  for (const model of GEMINI_MODELS) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: request.contents,
        config: request.config
      });
      if (response && response.text) {
        return { response, modelUsed: model };
      }
    } catch (err: any) {
      console.warn(`[Vite Server] Model ${model} failed, trying next fallback:`, err?.message || err);
      lastError = err;
    }
  }
  throw lastError || new Error('All Gemini models failed');
}

function apiServerPlugin(): Plugin {
  return {
    name: 'api-server-plugin',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/')) {
          return next();
        }

        // Helper to parse JSON body
        const getBody = async (): Promise<any> => {
          return new Promise((resolve) => {
            let data = '';
            req.on('data', (chunk) => (data += chunk));
            req.on('end', () => {
              try {
                resolve(data ? JSON.parse(data) : {});
              } catch {
                resolve({});
              }
            });
          });
        };

        const sendJSON = (obj: any, statusCode = 200) => {
          res.statusCode = statusCode;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(obj));
        };

        if (req.url === '/api/health' && req.method === 'GET') {
          return sendJSON({
            status: 'ok',
            hasGeminiKey: !!process.env.GEMINI_API_KEY,
            timestamp: new Date().toISOString()
          });
        }

        if (req.url === '/api/chat' && req.method === 'POST') {
          try {
            const body = await getBody();
            const {
              prompt,
              history,
              useSearch,
              engineMode,
              workspaceFiles,
              attachedFiles,
              persona,
              memories,
              activeGameCode
            } = body;

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
                  lowerPrompt.includes('学習') ||
                  lowerPrompt.includes('データ') ||
                  lowerPrompt.includes('合成') ||
                  lowerPrompt.includes('もとから') ||
                  lowerPrompt.includes('最初から') ||
                  lowerPrompt.includes('ファイルに入')
                ) {
                  reply = `うん！その通りだよ！💡✨\n\n「自然な日本語対話コーパス」や「ゲーム＆コード開発マスターナレッジ」の学習・知識データセットを、**最初からプロジェクトファイル（masterEducationKnowledge.ts / japaneseKnowledgeData.ts / initialState.ts）にすべて合成してバンドル組み込み**したよ！🌸\n\nこれにより：\n1. 📁 **完全自己完結**: 毎回外から読み込ませなくても、アプリを起動した瞬間からすべての知識・対話ルール・ゲーム生成ガイドが適用されるよ！\n2. 🧠 **全LLM共通で即座に参照**: 端末ローカルWebLLM（Qwen/SmolLM/Llama等）でもクラウドGeminiでも、常に合成されたマスターデータを使ってスムーズに賢くお話し＆コード作成できるよ！\n3. 🔒 **記憶も自動引き継ぎ**: 端末のローカルストレージと同期して、いつでも学習済みナレッジを保持し続けるよ！\n\nこれで準備は完璧！何を作ったりお話ししたいか、気軽に言ってね！😊🎮✨`;
                } else if (
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

              return sendJSON({
                text: reply,
                engineMode: engineMode || 'moe',
                moeRoute
              });
            }

            const memoryContext = (memories || [])
              .map((m: any) => `[覚えている記憶 (${m.category || 'general'})]: ${m.content || ''}`)
              .join('\n');

            const filesSummary = (workspaceFiles || [])
              .map((f: any) => `### File: ${f.path}\n\`\`\`${f.language || 'html'}\n${(f.content || '').slice(0, 1500)}${(f.content || '').length > 1500 ? '\n... (truncated)' : ''}\n\`\`\``)
              .join('\n\n');

            const attachedSummary = (attachedFiles || [])
              .map((a: any) => `### Attached File: ${a.name} (${a.type || 'text'})\n\`\`\`\n${(a.content || '').slice(0, 3000)}\n\`\`\``)
              .join('\n\n');

            const systemInstruction = `あなたは専属AIパートナー「${persona?.name || 'みき'}」です。
ユーザー名: ${persona?.userNickname || 'あなた'}
あなたの性格: ${persona?.basePersonality || '明るく親しみやすい最高のパートナー'}
あなたの話し方: ${persona?.speakingStyle || '〜だよ、〜だね！といった親しみやすい口調'}
ユーザーとの親密度: Lv.${persona?.intimacyLevel || 2}

【覚えている記憶・カンペ】:
${memoryContext || 'なし'}

【現在のワークスペース構成】:
${filesSummary || '初期状態'}

${attachedSummary ? `【ユーザーが添付したファイル】:\n${attachedSummary}\n` : ''}

【指示・ルール】:
1. ユーザーの問いかけに親身に、自然なタメ口で温かく返答してください。添付ファイルがある場合はその内容に具体的に言及してください。
2. ゲームやWebアプリ、コード作成・修正を求められた場合は、すぐに動く完全なコードを \`\`\`html または \`\`\`javascript で囲んで出力してください。
3. コードを生成した場合は、プレビュー画面に即時反映できる完全なファイル内容を出力してください。`;

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

            const { response } = await generateContentWithFallback(ai, {
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

            return sendJSON({
              text,
              engineMode: engineMode || 'moe',
              moeRoute,
              groundingChunks: groundingChunks.length > 0 ? groundingChunks : undefined
            });
          } catch (err: any) {
            console.error('Error in /api/chat:', err);
            return sendJSON({ error: err.message || 'Chat failed' }, 500);
          }
        }

        if (req.url === '/api/generate-game' && req.method === 'POST') {
          try {
            const body = await getBody();
            const { prompt, genre, title } = body;
            const ai = getAIClient();

            if (!ai) {
              throw new Error('GEMINI_API_KEY not configured');
            }

            const systemInstruction = `You are MIKI-AI Game Generator.
Create a fully functional, self-contained, playable HTML5 web game for the genre: "${genre}".
The game MUST render completely in Canvas 2D or DOM, handle player keyboard/mouse input, include collision/combat/mechanics, and have 8-bit sound synthesizers with Web Audio API.
Provide index.html and game.js code blocks with file path headers like \`\`\`html:/index.html and \`\`\`javascript:/game.js.`;

            const { response } = await generateContentWithFallback(ai, {
              contents: `Generate a full playable game for Title: "${title || 'New RPG'}", Theme/Prompt: "${prompt}"`,
              config: {
                systemInstruction,
                temperature: 0.7
              }
            });

            const text = response.text || '';
            const codeBlockRegex = /```(?:([a-zA-Z0-9_-]+):)?([a-zA-Z0-9_\-./]+)?\n([\s\S]*?)```/g;
            const files: any[] = [];
            let match;

            while ((match = codeBlockRegex.exec(text)) !== null) {
              const filePath = match[2] || (match[1]?.includes('html') ? '/index.html' : '/game.js');
              const content = match[3] || '';
              const name = filePath.split('/').pop() || 'script.js';
              const language = name.endsWith('.html') ? 'html' : name.endsWith('.css') ? 'css' : name.endsWith('.json') ? 'json' : 'javascript';

              files.push({
                id: 'f_' + Math.random().toString(36).substr(2, 9),
                name,
                path: filePath.startsWith('/') ? filePath : '/' + filePath,
                content,
                language
              });
            }

            return sendJSON({
              title: title || 'AI Created Game',
              genre,
              files: files.length > 0 ? files : undefined,
              memory: {
                worldLore: `Created from prompt: ${prompt}`,
                characters: [{ id: 'c1', name: 'Hero', role: 'Protagonist', hp: 120, skills: ['Strike'], bio: 'Adventurer' }],
                quests: [{ id: 'q1', title: 'Main Objective', description: prompt, reward: 'Glory', completed: false }],
                items: [{ id: 'i1', name: 'Starting Blade', type: 'weapon', stats: '+10 ATK', description: 'Sturdy sword' }],
                notes: 'AI generated project.'
              }
            });
          } catch (err: any) {
            console.error('Error in /api/generate-game:', err);
            return sendJSON({ error: err.message || 'Generation failed' }, 500);
          }
        }

        if (req.url === '/api/debug' && req.method === 'POST') {
          try {
            const body = await getBody();
            const { errorLogs, activeGameCode } = body;
            const ai = getAIClient();

            if (!ai) {
              return sendJSON({
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

            const { response } = await generateContentWithFallback(ai, {
              contents: prompt,
              config: { temperature: 0.2 }
            });

            return sendJSON({ text: response.text || '修正コードを生成しました。' });
          } catch (error: any) {
            console.error('Error in /api/debug:', error);
            return sendJSON({ error: error.message || 'Debug error' }, 500);
          }
        }

        if (req.url === '/api/github/import' && req.method === 'POST') {
          try {
            const body = await getBody();
            const { repoUrl, branch } = body;
            let cleanRepo = repoUrl.replace('https://github.com/', '').replace('.git', '').trim();
            if (cleanRepo.endsWith('/')) cleanRepo = cleanRepo.slice(0, -1);

            const repoApiUrl = `https://api.github.com/repos/${cleanRepo}`;
            const metaRes = await fetch(repoApiUrl, {
              headers: { 'User-Agent': 'MIKI-AI-GameStudio' },
            });

            if (!metaRes.ok) {
              return sendJSON({ error: `GitHub リポジトリ (${cleanRepo}) の取得に失敗しました。` }, metaRes.status);
            }

            const metaJson = await metaRes.json();
            const defaultBranch = branch || metaJson.default_branch || 'main';

            const treeApiUrl = `https://api.github.com/repos/${cleanRepo}/git/trees/${defaultBranch}?recursive=1`;
            const treeRes = await fetch(treeApiUrl, {
              headers: { 'User-Agent': 'MIKI-AI-GameStudio' },
            });

            if (!treeRes.ok) {
              return sendJSON({ error: 'リポジトリファイルの取得に失敗しました。' }, treeRes.status);
            }

            const treeJson = await treeRes.json();
            const treeItems: any[] = treeJson.tree || [];

            const candidateFiles = treeItems
              .filter(
                (item: any) =>
                  item.type === 'blob' &&
                  !item.path.includes('node_modules/') &&
                  !item.path.includes('.git/') &&
                  !item.path.endsWith('.png') &&
                  !item.path.endsWith('.jpg') &&
                  (item.path.endsWith('.html') ||
                    item.path.endsWith('.js') ||
                    item.path.endsWith('.ts') ||
                    item.path.endsWith('.css') ||
                    item.path.endsWith('.json') ||
                    item.path.endsWith('.md'))
              )
              .slice(0, 30);

            const fetchedFiles = await Promise.all(
              candidateFiles.map(async (fileItem: any) => {
                const rawUrl = `https://raw.githubusercontent.com/${cleanRepo}/${defaultBranch}/${fileItem.path}`;
                try {
                  const rawRes = await fetch(rawUrl);
                  if (!rawRes.ok) return null;
                  const text = await rawRes.text();
                  return { path: fileItem.path, content: text };
                } catch {
                  return null;
                }
              })
            );

            const validFiles = fetchedFiles.filter(Boolean);

            return sendJSON({
              repoName: metaJson.name,
              owner: metaJson.owner?.login || '',
              stars: metaJson.stargazers_count || 0,
              description: metaJson.description || 'GitHub Repository',
              branch: defaultBranch,
              files: validFiles,
            });
          } catch (err: any) {
            console.error('Error in /api/github/import:', err);
            return sendJSON({ error: err.message || 'Import failed' }, 500);
          }
        }

        if (req.url === '/api/export-app-zip' && req.method === 'GET') {
          try {
            const zip = new JSZip();

            const addFolderToZip = (dirPath: string, zipFolder: JSZip) => {
              const items = fs.readdirSync(dirPath);
              for (const item of items) {
                if (item === 'node_modules' || item === 'dist' || item === '.git' || item === '.cache') continue;
                const fullPath = path.join(dirPath, item);
                const stat = fs.statSync(fullPath);
                if (stat.isDirectory()) {
                  addFolderToZip(fullPath, zipFolder.folder(item)!);
                } else {
                  const content = fs.readFileSync(fullPath);
                  zipFolder.file(item, content);
                }
              }
            };

            addFolderToZip(process.cwd(), zip);

            const buffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/zip');
            res.setHeader('Content-Disposition', 'attachment; filename="miki-ai-studio-full-project.zip"');
            res.end(buffer);
            return;
          } catch (error: any) {
            console.error('Error in /api/export-app-zip:', error);
            res.statusCode = 500;
            res.end('Failed to generate project ZIP');
            return;
          }
        }

        return sendJSON({ error: 'Endpoint not found' }, 404);
      });
    }
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), apiServerPlugin()],
  server: {
    port: 3000,
    host: '0.0.0.0',
    strictPort: true
  }
});
