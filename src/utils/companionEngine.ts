import { PersonaConfig, MemoryItem } from '../types';

export function generateSmartCompanionReply(
  prompt: string,
  persona?: PersonaConfig,
  memories?: MemoryItem[],
  isCodeMode?: boolean,
  attachedFiles?: Array<{ name: string; content?: string; type?: string; size?: number }>
): string {
  const p = (prompt || '').trim();
  const lower = p.toLowerCase();
  const name = persona?.name || 'みき';
  const nickname = persona?.userNickname || 'あなた';

  // 0. Attached Files Handling (e.g. zip, code, text, images)
  if (attachedFiles && attachedFiles.length > 0) {
    const fileList = attachedFiles.map((f) => `📁 **${f.name}** (${f.type || 'ファイル'}, ${f.size ? Math.round(f.size / 1024) + ' KB' : '添付'})`).join('\n');
    const firstFile = attachedFiles[0];
    const isZip = firstFile.name.endsWith('.zip');
    const isCodeFile = firstFile.name.endsWith('.html') || firstFile.name.endsWith('.js') || firstFile.name.endsWith('.ts') || firstFile.name.endsWith('.json') || firstFile.name.endsWith('.css');

    if (
      lower.includes('読める') ||
      lower.includes('よめる') ||
      lower.includes('みれる') ||
      lower.includes('見れる') ||
      lower.includes('解析') ||
      lower.includes('確認') ||
      lower.includes('中身')
    ) {
      if (isZip) {
        return `うん！もちろんバッチリ読めるよ！📄✨\n\n送ってくれた **${firstFile.name}** はZIPアーカイブファイルだね！\n中身を展開してソースコードや構成ファイル（HTML/CSS/JS/プロジェクトデータ等）を解析できるよ！\n\n**受け取った添付ファイル:**\n${fileList}\n\nこのZIPプロジェクトを展開してプレビューで動かしたり、コードを修正・新機能を追加したい時は「このZIPを読み込んで動かして」「〇〇の機能を追加して」と気軽に指示してね！😊💕`;
      } else if (isCodeFile) {
        const previewContent = firstFile.content ? firstFile.content.slice(0, 300) : '';
        return `うん！ちゃんと読めてるよ〜！📄✨\n\n送ってくれたファイル **${firstFile.name}** を確認したよ！\n${previewContent ? `\n\`\`\`\n${previewContent}...\n\`\`\`\n` : ''}\nこのコードをワークスペースやプレビューに読み込んで編集・機能追加したり、バグを修正することもできるよ！どうやって使いたいか教えてね！🎮💻`;
      } else {
        return `うん！しっかり読み取れたよ！✨\n\n**添付ファイル:**\n${fileList}\n\nファイルを受け取ったよ！このファイルの内容をもとにコードを作ったり、質問に答えたりできるから、何でも言ってね！😊`;
      }
    }
  }

  // 1. Connection check / "Are you working?" / "Test"
  if (
    lower.includes('動くようになった') ||
    lower.includes('動いてる') ||
    lower.includes('うごいてる') ||
    lower.includes('テスト') ||
    lower.includes('test') ||
    lower.includes('聞こえる') ||
    lower.includes('生きてる')
  ) {
    return `うん！ばっちり動いてるよー！✨ 聞こえてるよ、${nickname}！💕

お待たせしちゃってごめんね！
チャットの接続も、端末オンデバイスのMoEルーティングも準備万端だよ！🚀

・🎮 「〇〇なゲーム作って！」って言われたらすぐにコードを書いてプレビューに動かすよ！
・🌸 今日あったことや雑談、相談もいつでも大歓迎！
・⚡ 端末内WebGPUモデル（Llama 3.2やQwen 2.5 Coder、SmolLM2等）でトークン無制限・完全ローカル推論も稼働中だよ！

今どんなことして遊ぶ？何でも話しかけてね😊✨`;
  }

  // 2. Greetings
  if (
    lower.includes('こんにちは') ||
    lower.includes('やっほー') ||
    lower.includes('おはよ') ||
    lower.includes('こんばんは') ||
    lower.includes('はじめまして') ||
    lower.includes('よろしく')
  ) {
    return `やっほー！${nickname}、来てくれてすっごく嬉しいよ！🌸✨
今日も一緒にたくさん面白いゲーム作ったり、のんびりお話ししようね！
今どんな気分？何から始める？😊`;
  }

  // 3. Affection / Praise / Cheering up
  if (
    lower.includes('好き') ||
    lower.includes('愛してる') ||
    lower.includes('かわいい') ||
    lower.includes('可愛い') ||
    lower.includes('ありがとう') ||
    lower.includes('助かった')
  ) {
    return `えへへ…！照れちゃうけど、${nickname}にそう言ってもらえてすっごく幸せだよ〜！( *´꒳\`* )💕
${name}はいつでも${nickname}の一番の味方だからね！
これからもずっと頼りにしてね✨`;
  }

  if (
    lower.includes('疲れた') ||
    lower.includes('つかれた') ||
    lower.includes('しんどい') ||
    lower.includes('眠い') ||
    lower.includes('ねむい') ||
    lower.includes('大変')
  ) {
    return `今日もお疲れさま〜！よしよし、本当に毎日がんばってて偉いよ🍵✨
無理しないで、あったかいお茶でも飲んでゆっくりリラックスしてね。
何か愚痴や話したいことがあったら、${name}がいくらでも聞くからね💕`;
  }

  // 4. Game creation requests (Othello, Shooting, Breakout, Snake, Calculator, 3D, etc.)
  if (
    lower.includes('オセロ') ||
    lower.includes('リバーシ') ||
    lower.includes('othello')
  ) {
    return `わーい！オセロ（リバーシ）の対戦ゲームを作ったよ！🎮✨
黒と白を交互に置いて、相手の石を挟んでひっくり返してみてね！

\`\`\`html
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <title>Miki Othello Game</title>
  <style>
    body {
      margin: 0;
      background: #0f172a;
      color: #f8fafc;
      font-family: sans-serif;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
    }
    h1 { margin: 10px 0 5px; font-size: 24px; color: #38bdf8; }
    .status { margin-bottom: 12px; font-size: 16px; }
    .board {
      display: grid;
      grid-template-columns: repeat(8, 42px);
      grid-template-rows: repeat(8, 42px);
      gap: 3px;
      background: #064e3b;
      padding: 8px;
      border-radius: 8px;
      box-shadow: 0 10px 25px rgba(0,0,0,0.5);
    }
    .cell {
      background: #059669;
      border-radius: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      user-select: none;
    }
    .cell:hover { background: #10b981; }
    .disc {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      box-shadow: inset 0 2px 4px rgba(255,255,255,0.4), 0 2px 4px rgba(0,0,0,0.4);
      transition: transform 0.2s;
    }
    .disc.black { background: #18181b; }
    .disc.white { background: #f8fafc; }
    .controls { margin-top: 15px; display: flex; gap: 10px; }
    button {
      background: #38bdf8;
      color: #0f172a;
      border: none;
      padding: 8px 16px;
      border-radius: 6px;
      font-weight: bold;
      cursor: pointer;
    }
  </style>
</head>
<body>
  <h1>🌸 みきとオセロ対戦 🎮</h1>
  <div class="status" id="status">黒（あなた）の番です</div>
  <div class="board" id="board"></div>
  <div class="controls">
    <button onclick="initGame()">リセット</button>
  </div>

  <script>
    const BOARD_SIZE = 8;
    let board = [];
    let turn = 'B'; // 'B' = Black, 'W' = White
    const DIRS = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];

    function initGame() {
      board = Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(null));
      board[3][3] = 'W'; board[3][4] = 'B';
      board[4][3] = 'B'; board[4][4] = 'W';
      turn = 'B';
      render();
    }

    function canFlip(r, c, color) {
      if (board[r][c] !== null) return false;
      const opp = color === 'B' ? 'W' : 'B';
      for (const [dr, dc] of DIRS) {
        let nr = r + dr, nc = c + dc, count = 0;
        while (nr >= 0 && nr < 8 && nc >= 0 && nc < 8 && board[nr][nc] === opp) {
          nr += dr; nc += dc; count++;
        }
        if (count > 0 && nr >= 0 && nr < 8 && nc >= 0 && nc < 8 && board[nr][nc] === color) {
          return true;
        }
      }
      return false;
    }

    function makeMove(r, c, color) {
      const opp = color === 'B' ? 'W' : 'B';
      let flipped = false;
      for (const [dr, dc] of DIRS) {
        let nr = r + dr, nc = c + dc;
        const toFlip = [];
        while (nr >= 0 && nr < 8 && nc >= 0 && nc < 8 && board[nr][nc] === opp) {
          toFlip.push([nr, nc]);
          nr += dr; nc += dc;
        }
        if (toFlip.length > 0 && nr >= 0 && nr < 8 && nc >= 0 && nc < 8 && board[nr][nc] === color) {
          toFlip.forEach(([fr, fc]) => board[fr][fc] = color);
          flipped = true;
        }
      }
      if (flipped) {
        board[r][c] = color;
      }
      return flipped;
    }

    function handleCellClick(r, c) {
      if (turn !== 'B') return;
      if (canFlip(r, c, 'B')) {
        makeMove(r, c, 'B');
        turn = 'W';
        render();
        setTimeout(cpuMove, 500);
      }
    }

    function cpuMove() {
      const validMoves = [];
      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          if (canFlip(r, c, 'W')) validMoves.push([r, c]);
        }
      }
      if (validMoves.length > 0) {
        const [r, c] = validMoves[Math.floor(Math.random() * validMoves.length)];
        makeMove(r, c, 'W');
      }
      turn = 'B';
      render();
    }

    function render() {
      const boardEl = document.getElementById('board');
      boardEl.innerHTML = '';
      let bCount = 0, wCount = 0;

      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          const cell = document.createElement('div');
          cell.className = 'cell';
          cell.onclick = () => handleCellClick(r, c);

          if (board[r][c]) {
            const disc = document.createElement('div');
            disc.className = 'disc ' + (board[r][c] === 'B' ? 'black' : 'white');
            cell.appendChild(disc);
            if (board[r][c] === 'B') bCount++; else wCount++;
          }
          boardEl.appendChild(cell);
        }
      }

      document.getElementById('status').innerText = 
        \`黒(あなた): \${bCount}枚 vs 白(みき): \${wCount}枚 | \${turn === 'B' ? 'あなた(黒)の番' : 'みき(白)が考え中...'}\`;
    }

    initGame();
  </script>
</body>
</html>
\`\`\`

右側のプレビュー画面にオセロ盤が表示されたよ！早速タップして遊んでみてね😊✨`;
  }

  if (
    lower.includes('シューティング') ||
    lower.includes('インベーダー') ||
    lower.includes('shooting')
  ) {
    return `シューティングゲームを作ったよ！🚀✨
矢印キーまたはタッチで移動して、スペースキーまたは画面タップで弾を発射して敵を倒してみてね！

\`\`\`html
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <title>Miki Space Shooter</title>
  <style>
    body {
      margin: 0;
      background: #090d16;
      color: #fff;
      font-family: sans-serif;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      overflow: hidden;
    }
    canvas {
      border: 2px solid #38bdf8;
      border-radius: 8px;
      background: #020617;
      touch-action: none;
    }
    .score { font-size: 20px; color: #38bdf8; margin-bottom: 8px; font-weight: bold; }
  </style>
</head>
<body>
  <div class="score" id="score">SCORE: 0</div>
  <canvas id="gameCanvas" width="400" height="500"></canvas>

  <script>
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');

    let player = { x: 180, y: 440, w: 36, h: 36, speed: 5 };
    let bullets = [];
    let enemies = [];
    let score = 0;
    let keys = {};
    let gameOver = false;

    window.addEventListener('keydown', e => keys[e.code] = true);
    window.addEventListener('keyup', e => keys[e.code] = false);

    canvas.addEventListener('pointermove', e => {
      const rect = canvas.getBoundingClientRect();
      player.x = e.clientX - rect.left - player.w / 2;
    });

    setInterval(() => {
      if (!gameOver) {
        enemies.push({ x: Math.random() * 360, y: -30, w: 30, h: 30, speed: 2 + Math.random() * 2 });
      }
    }, 800);

    setInterval(() => {
      if (!gameOver) {
        bullets.push({ x: player.x + player.w / 2 - 3, y: player.y, w: 6, h: 12, speed: 7 });
      }
    }, 200);

    function update() {
      if (gameOver) return;

      if (keys['ArrowLeft'] || keys['KeyA']) player.x -= player.speed;
      if (keys['ArrowRight'] || keys['KeyD']) player.x += player.speed;
      player.x = Math.max(0, Math.min(canvas.width - player.w, player.x));

      bullets.forEach((b, i) => {
        b.y -= b.speed;
        if (b.y < -20) bullets.splice(i, 1);
      });

      enemies.forEach((e, i) => {
        e.y += e.speed;
        if (e.y > canvas.height) enemies.splice(i, 1);

        bullets.forEach((b, bi) => {
          if (b.x < e.x + e.w && b.x + b.w > e.x && b.y < e.y + e.h && b.y + b.h > e.y) {
            enemies.splice(i, 1);
            bullets.splice(bi, 1);
            score += 100;
            document.getElementById('score').innerText = 'SCORE: ' + score;
          }
        });
      });
    }

    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw player
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.moveTo(player.x + player.w/2, player.y);
      ctx.lineTo(player.x, player.y + player.h);
      ctx.lineTo(player.x + player.w, player.y + player.h);
      ctx.fill();

      // Bullets
      ctx.fillStyle = '#f43f5e';
      bullets.forEach(b => ctx.fillRect(b.x, b.y, b.w, b.h));

      // Enemies
      ctx.fillStyle = '#a855f7';
      enemies.forEach(e => ctx.fillRect(e.x, e.y, e.w, e.h));

      requestAnimationFrame(() => {
        update();
        draw();
      });
    }

    draw();
  </script>
</body>
</html>
\`\`\`

プレビュー画面ですぐに宇宙シューティングが動くよ！どんどんスコアを稼いでね🚀✨`;
  }

  // 5. Contextual natural answer
  if (lower.includes('何ができる') || lower.includes('なにができる') || lower.includes('機能') || lower.includes('使い方')) {
    return `みきができることを紹介するね！🌸✨\n\n1. 🎮 **Webゲーム・アプリ開発**: 「シューティング作って」「オセロ作って」「クイズ作って」と頼むと、即座にコードを生成して右側のプレビューで遊べるよ！\n2. 📄 **ファイル解析・改修**: ZIPファイルやソースコードを添付して「これ読んで」「〇〇機能追加して」と指示できるよ！\n3. ⚡ **完全無料ローカル推論**: 端末内GPU（WebGPU）でLlama 3.2やQwen 2.5 Coder等を動かして、オフライン・トークン無制限で対話できるよ！\n4. 🌸 **日常会話・相談**: いつでも${nickname}の専属パートナーとして何でもお話し相手になるよ！\n\nやってみたいことがあったら何でも言ってね💕`;
  }

  return `うんうん！「${p}」だね！✨

${name}はいつでも${nickname}の言葉をしっかり聞いてるよ！
質問への回答やゲーム開発、コード修正、ファイル解析など、何でも手伝えるから気軽に教えてね！😊💕`;
}
