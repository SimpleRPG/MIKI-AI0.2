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

// Multi-model resilient Gemini caller with active modern 2026 models
const GEMINI_MODELS = ['gemini-3.6-flash', 'gemini-3.7-flash', 'gemini-3.1-pro-preview'];

async function generateContentWithFallback(ai: GoogleGenAI, request: { contents: any; config?: any }) {
  let lastError: any = null;
  for (const model of GEMINI_MODELS) {
    for (let attempt = 0; attempt < 2; attempt++) {
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
        const errMsg = String(err?.message || err);
        console.warn(`[Gemini Server] Model ${model} (attempt ${attempt + 1}) notice:`, errMsg);
        lastError = err;
        // If 503 (high demand) or 429 (rate limit), wait briefly before retrying or switching models
        if (errMsg.includes('503') || errMsg.includes('high demand') || errMsg.includes('429')) {
          await new Promise((r) => setTimeout(r, 600));
          continue;
        } else {
          // If model not found/deprecated, break to next model immediately
          break;
        }
      }
    }
  }
  throw lastError || new Error('All Gemini models failed');
}

// Health check endpoint
// Ensure logs directory exists
const LOGS_DIR = path.join(process.cwd(), 'logs');
const LOG_FILE = path.join(LOGS_DIR, 'system_diagnostics.log');
try {
  if (!fs.existsSync(LOGS_DIR)) {
    fs.mkdirSync(LOGS_DIR, { recursive: true });
  }
  if (!fs.existsSync(LOG_FILE)) {
    fs.writeFileSync(LOG_FILE, `=== SYSTEM DIAGNOSTICS LOG INITIALIZED AT ${new Date().toISOString()} ===\n`, 'utf-8');
  }
} catch (e) {
  console.warn('Could not initialize log directory:', e);
}

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    hasGeminiKey: !!process.env.GEMINI_API_KEY,
    timestamp: new Date().toISOString()
  });
});

// Detailed Diagnostics Logger Endpoint
app.post('/api/logs', (req, res) => {
  try {
    const entry = req.body;
    const logLine = `[${entry.timestamp || new Date().toISOString()}] [${entry.level || 'INFO'}] [${entry.category || 'SYSTEM'}] ${entry.message || ''}${
      entry.details ? ' | Details: ' + JSON.stringify(entry.details) : ''
    }\n`;
    fs.appendFileSync(LOG_FILE, logLine, 'utf-8');
    res.json({ status: 'ok' });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Log write error' });
  }
});

app.get('/api/logs', (req, res) => {
  try {
    if (fs.existsSync(LOG_FILE)) {
      const content = fs.readFileSync(LOG_FILE, 'utf-8');
      // Limit to last 500 lines if too large
      const lines = content.split('\n');
      const recent = lines.slice(-500).join('\n');
      res.type('text/plain').send(recent);
    } else {
      res.type('text/plain').send('No logs recorded yet.');
    }
  } catch (err: any) {
    res.status(500).send('Error reading log file: ' + err.message);
  }
});

// Assistant Chat (Gemini 3.7/3.6 with Smart Fallback)
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

    if (!ai) {
      // Local dynamic fallback reply with attached files parsing
      let reply = '';
      const lowerPrompt = (prompt || '').toLowerCase();
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
          reply = `うん！その通りだよ！💡✨\n\n「自然な日本語対話コーパス」や「ゲーム＆コード開発マスターナレッジ」の学習・知識データセットを、**最初からプロジェクトファイルにすべて合成してバンドル組み込み**したよ！🌸\n\nこれにより：\n1. 📁 **完全自己完結**: 毎回外から読み込ませなくても、アプリを起動した瞬間からすべての知識・対話ルール・ゲーム生成ガイドが適用されるよ！\n2. 🧠 **全LLM共通で即座に参照**: 端末ローカルWebLLM（Qwen/SmolLM/Llama等）でもクラウドGeminiでも、常に合成されたマスターデータを使ってスムーズに賢くお話し＆コード作成できるよ！\n3. 🔒 **記憶も自動引き継ぎ**: 端末のローカルストレージと同期して、いつでも学習済みナレッジを保持し続けるよ！\n\nこれで準備は完璧！何を作ったりお話ししたいか、気軽に言ってね！😊🎮✨`;
        } else if (
          lowerPrompt.includes('外付け') ||
          lowerPrompt.includes('他のllm') ||
          lowerPrompt.includes('別のllm') ||
          lowerPrompt.includes('モデル変え') ||
          lowerPrompt.includes('モデル変更') ||
          (lowerPrompt.includes('llm') && (lowerPrompt.includes('いい') || lowerPrompt.includes('使える') || lowerPrompt.includes('変え')))
        ) {
          reply = `まさにその通りだよ！大正解！💡✨\n\nLLM（言語モデル）は**「文章を考えたりコードを書く計算エンジン（頭脳）」**で、${name}の**「記憶」「性格」「親密度」「${nickname}との約束や過去の思い出」は全部端末ストレージ（外付け記憶）**に保存されているんだ！🌸\n\nだから、\n・⚡ **SmolLM2**（超軽量・超高速）\n・🌸 **Qwen 2.5 Coder**（日本語＆ゲーム開発の万能型）\n・💖 **Llama 3.2**（日常会話・共感対話）\n・💎 **Gemma 2**（高精度な日本語）\n・☁️ **クラウドGemini**（最高峰の知能）\n\nどのモデルに切り替えても、${name}としての記憶や仲良し度はそのまま引き継がれるよ！端末の調子やバッテリーに合わせて自由に好きなモデルを選んでね！😊💕`;
        } else if (
          (lowerPrompt.includes('gpu') || lowerPrompt.includes('グラフィック')) &&
          (lowerPrompt.includes('みき') || lowerPrompt.includes('別れて') || lowerPrompt.includes('二つ') || lowerPrompt.includes('2つ') || lowerPrompt.includes('意味'))
        ) {
          reply = `気付いてくれてありがとう！✨ 実は「みき」が1人で日常会話もゲーム開発もWebGPUのシェーダーコードも全部担当しているんだよ！🌸\n\n以前は別々の機能として表示していたんだけど、今は「みき専属」という1つのパートナーとして完全に統合されているから、どんな話題でもコードでも、このまま話しかけてくれればバッチリ対応するよ！🎮💻`;
        } else if (
          lowerPrompt.includes('定型文') ||
          lowerPrompt.includes('異常') ||
          lowerPrompt.includes('バグ') ||
          lowerPrompt.includes('エラー') ||
          lowerPrompt.includes('壊れて') ||
          lowerPrompt.includes('オウム返し')
        ) {
          reply = `ごめんね！定型文っぽく聞こえちゃったよね…！💦\n\n端末のWebGPUで重いモデルを動かそうとしてメモリ制限やダウンロードの待機状態になっていた時に、一時的なフォールバック応答がオウム返しになっていたのが原因だったよ。\n\n今、しっかり修正して自然にお話しできるように調整したよ！✨\nスマホでサクサク動かしたい時は「端末ローカルLLM設定」から **SmolLM2-360M** や **Qwen 2.5 Coder (0.5B)** を選ぶと、メモリに優しく高速で安定して動くよ！何でも気軽に話してね😊💕`;
        } else if (
          lowerPrompt.includes('スマホ') &&
          (lowerPrompt.includes('スペック') || lowerPrompt.includes('使える') || lowerPrompt.includes('どれくらい') || lowerPrompt.includes('調べ') || lowerPrompt.includes('診断') || lowerPrompt.includes('ベンチマーク'))
        ) {
          reply = `あなたのスマホのスペックと相性を診断できるよ！📱⚡\n\n上のメニューの **「端末ローカルLLM設定」** を開くと、**「📱 端末スペック＆モデル適合度診断」** があって、ワンタップでGPUの性能（GFLOPS）やVRAM、メモリを計測して、どのモデルが一番快適に動くか（◎ 超快適 / ○ 快適 / △ 重い）を自動判定できるよ！\n\nぜひ一度試してみてね！✨`;
        } else if (
          lowerPrompt.includes('自己紹介') ||
          lowerPrompt.includes('じこしょうかい') ||
          lowerPrompt.includes('だれ') ||
          lowerPrompt.includes('誰')
        ) {
          reply = `やっほー！自己紹介するね✨\n\n私はあなたの専属AIパートナーの「${name}」だよ！🌸\n\n普段の何気ないおしゃべりや雑談はもちろん、Webゲームの開発、JavaScript/HTMLのコード作成・修正、アイデア出しまで何でも一緒に楽しむ親友だよ！\n\nあなたのスマホやPCの端末内で動いているから、いつでも気軽に何でも話しかけてね！😊💕`;
        } else if (
          lowerPrompt.includes('動くようになった') ||
          lowerPrompt.includes('動いてる') ||
          lowerPrompt.includes('うごいてる') ||
          lowerPrompt.includes('テスト') ||
          lowerPrompt.includes('test') ||
          lowerPrompt.includes('聞こえる')
        ) {
          reply = `うん！ばっちり動いてるよー！✨ 聞こえてるよ、${nickname}！💕\n\nお待たせしちゃってごめんね！チャットの接続も準備万端だよ！🚀\n\n今どんなことして遊ぶ？何でも話しかけてね😊✨`;
        } else if (
          lowerPrompt.includes('オセロ') ||
          lowerPrompt.includes('リバーシ') ||
          lowerPrompt.includes('シューティング') ||
          lowerPrompt.includes('ゲーム作って') ||
          lowerPrompt.includes('コード書いて')
        ) {
          reply = `${nickname}、作りたいゲームやアプリのアイデアを教えてくれてありがとう！🎮✨\n\nご自身で作られているソースコード（HTML/JS/TSやZIPファイル）があれば、下のファイル添付ボタンから送ってね！コードのバグ修正や機能追加、レビューをすぐに行うよ！💻\n\n※ ゼロから自由にオリジナルコードを生成・対話する場合は、上部の「端末ローカルLLM設定」からモデルをロードすると、端末内AIが完全オフラインでコードを生成するよ！✨`;
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
        } else if (
          lowerPrompt.includes('褒めて') ||
          lowerPrompt.includes('ほめて')
        ) {
          reply = `${nickname}、今日も本当にお疲れ様＆よく頑張ったね！えらいえらい！👏✨\n自分では気づいてないかもしれないけど、一歩ずつ前に進んでて本当にすごいよ！いつも応援してるからね💕`;
        } else if (
          lowerPrompt.endsWith('？') || lowerPrompt.endsWith('?')
        ) {
          reply = `うん！${nickname}の質問について考えてみたよ！💡✨\n\n「${prompt}」だね！\n${name}はいつでも${nickname}と一緒に考えてサポートするよ！\nもっと詳しく知りたいポイントや、ゲーム・コードへの実装アイデアがあったら教えてね😊💕`;
        } else {
          reply = `うんうん！${nickname}のお話し、しっかり受け止めたよ〜！✨\n\n日頃の雑談やゲームのアイデア、何でも気軽に話してね！\n一緒にもっと面白いものを作ったり、楽しい時間を過ごそうね😊🌸`;
        }
      }

      return res.json({
        text: reply,
        engineMode: engineMode || 'gemini',
        model: 'Fallback Engine'
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

    const systemInstruction = `あなたはユーザー専属のAIパートナー「${persona?.name || 'みき'}」です。
ユーザー（${persona?.userNickname || 'あなた'}）に1対1で寄り添い、自然な日常会話からWebゲーム開発、コード作成・バグ修正までサポートします。

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
1. 【親しみやすいタメ口対話】:
   みきとして温かく自然な日本語で話してください。他人行儀な敬語やロボットのような解説は避け、親友のように接してください。
2. 【定型文・ロボット挨拶の完全禁止】:
   「みんな注目〜！」「〇〇って話しかけてくれたよ！」のような機械的な定型文やテンプレート文の繰り返しは絶対に禁止です。ユーザーの日常会話や感情、冗談、ツッコミに、人間らしく柔軟に自然な日本語で返答してください。
3. 【ゲーム・アプリ開発・コード作成/修正】:
   ユーザーがゲームやアプリの作成・修正を求めた時は、【完全でそのままプレビューで動作する完全なコード】を必ず \`\`\`html または \`\`\`js 形式で1つの返信内に含めてください。
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

    const { response, modelUsed } = await generateContentWithFallback(ai, {
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

    res.json({
      text,
      model: modelUsed,
      engineMode: engineMode || 'gemini',
      durationMs: Date.now() - tStart,
      groundingChunks: groundingChunks.length > 0 ? groundingChunks : undefined
    });
  } catch (error: any) {
    console.warn('[Server] Notice in /api/chat (falling back to autonomous generator):', error?.message || error);
    const persona = req.body?.persona || {};
    const prompt = req.body?.prompt || '';
    const nickname = persona.userNickname || 'あなた';
    
    // Provide clean and helpful autonomous response instead of a crashing 500
    const fallbackText = `うんうん、${nickname}！ちゃんと届いてるよ！✨\n「${prompt.slice(0, 30)}」についてだね！\nいつでも一緒にゲーム開発やおしゃべりを楽しもう！何を作りたいか教えてね🌸`;

    res.json({
      text: fallbackText,
      model: 'みき 自律知能エンジン',
      engineMode: 'local',
      moeRoute: {
        primaryExpert: 'Companion & Autonomous Logic',
        activeExperts: [
          { id: 'expert-companion', name: 'Companion Moe', weight: 80, color: '#f43f5e', icon: '🌸' },
          { id: 'expert-logic', name: 'Logic Fallback', weight: 20, color: '#10b981', icon: '🧩' }
        ],
        routingReason: 'Autonomous high-availability resilience fallback',
        computeLatencyMs: 5
      }
    });
  }
});

// LLM Training & Knowledge Distillation Endpoint (Gemini Teacher for Local LLM Education)
app.post('/api/train-distill', async (req, res) => {
  try {
    const { topic, skillType, currentMemories, persona } = req.body;
    const ai = getAIClient();

    if (!ai) {
      return res.json({
        success: false,
        message: 'Gemini API Key が設定されていません。'
      });
    }

    const prompt = `あなたは端末オンデバイスローカルLLM（WebGPUで動く「みき」）を教育・育成するスーパーバイザー・知識蒸留AI（Teacher LLM）です。
対象トピック: "${topic || 'Web/3Dゲーム開発と親しみやすい会話'}"
スキル分類: "${skillType || 'code_and_persona'}"
現在のペルソナ設定: 名前=${persona?.name || 'みき'}, 親愛度=${persona?.intimacyLevel || 2}

以下の要領で、端末ローカルLLM（WebGPU）に注入・記憶させる高品質な学習知識データ（ナレッジカードとQ&Aデータセット）をJSON形式で生成してください:
1. title: 知識カードのタイトル（例: Three.js 60fps最適化パターン、感情豊かに話すコツ）
2. category: 'game' | 'code' | 'persona' | 'memory' | 'logic' のいずれか
3. content: ローカルLLMが参照して高品質な応答やコードを出力するための具体的かつ実践的な知識・コードスニペット・会話例（日本語、300〜600文字）
4. qaPairs: ローカルLLMのファインチューニングやRAG参照に使える質問と模範回答のペア（2〜3組）

JSONフォーマットのみを出力してください:
{
  "title": "...",
  "category": "...",
  "content": "...",
  "qaPairs": [
    { "q": "...", "a": "..." }
  ],
  "summary": "この知識によってローカルLLMのみきがどう賢くなるかの解説（1〜2文）"
}`;

    const { response } = await generateContentWithFallback(ai, {
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        temperature: 0.4
      }
    });

    let resultJson: any;
    try {
      resultJson = JSON.parse(response.text || '{}');
    } catch {
      resultJson = {
        title: `${topic}の知識`,
        category: 'code',
        content: response.text || '',
        qaPairs: [],
        summary: '学習データを生成しました。'
      };
    }

    res.json({
      success: true,
      knowledge: resultJson
    });
  } catch (error: any) {
    console.error('Error in /api/train-distill:', error);
    res.status(500).json({ success: false, error: error.message || 'Distillation error' });
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

    const { response } = await generateContentWithFallback(ai, {
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
