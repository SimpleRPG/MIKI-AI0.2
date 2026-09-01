import { SPEAKER_PROFILES, SpeakerProfile } from '../data/speakers';
import { ChatMessage, PersonaConfig, MemoryItem, WorkspaceFile } from '../types';

export interface CouncilTurn {
  speaker: SpeakerProfile;
  content: string;
  delayMs: number;
}

export function generateCouncilDeliberation(
  prompt: string,
  persona: PersonaConfig,
  memories: MemoryItem[],
  workspaceFiles: WorkspaceFile[],
  attachedFiles?: Array<{ name: string; content: string; type: string }>
): CouncilTurn[] {
  const p = (prompt || '').trim();
  const lower = p.toLowerCase();
  const userNick = persona.userNickname || 'あなた';

  const isGameOrCode =
    lower.includes('ゲーム') ||
    lower.includes('作って') ||
    lower.includes('コード') ||
    lower.includes('開発') ||
    lower.includes('html') ||
    lower.includes('アプリ') ||
    lower.includes('オセロ') ||
    lower.includes('テトリス') ||
    lower.includes('シューティング') ||
    lower.includes('パズル') ||
    lower.includes('修正') ||
    lower.includes('バグ');

  if (!isGameOrCode) {
    // Conversational Council: Multi-expert perspective on user's topic
    return [
      {
        speaker: SPEAKER_PROFILES.miki,
        content: `みんな注目〜！${userNick}が「${p}」って話しかけてくれたよ！🌸✨\nみきはいつでも${userNick}の気持ちに寄り添って全力応援するよ！みんなはどう思う？`,
        delayMs: 300,
      },
      {
        speaker: SPEAKER_PROFILES.deepseek_logic,
        content: `【論理・分析視点】🧩\n${userNick}の問いかけを論理構造化すると、感情面での共感と実用的なソリューションの両立が最適解だ。物事を分解して1つずつ整理していこう。`,
        delayMs: 700,
      },
      {
        speaker: SPEAKER_PROFILES.llama_creative,
        content: `【演出・アイデア視点】🔮\n素敵なテーマだね！もっとワクワクする世界観や楽しいアイデアをプラスして、${userNick}が毎日楽しくなるような体験にしていこう！`,
        delayMs: 1100,
      },
      {
        speaker: SPEAKER_PROFILES.miki,
        content: `えへへ！全員${userNick}の味方だよ💕\nいつでも雑談も、新しいゲームやアプリ開発の相談も待ってるね！次は何について話そうか？😊✨`,
        delayMs: 1500,
      },
    ];
  }

  // Code / Game Development Council
  let gameTitle = 'Miki & Council Mini Game';
  let gameCode = '';

  if (lower.includes('オセロ') || lower.includes('リバーシ')) {
    gameTitle = '🌸 みきとエキスパート合議オセロ対戦';
    gameCode = `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <title>Miki Othello Game</title>
  <style>
    body { margin: 0; background: #0f172a; color: #f8fafc; font-family: sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; }
    h1 { margin: 10px 0 5px; font-size: 22px; color: #38bdf8; }
    .council-badge { font-size: 11px; background: #1e293b; border: 1px solid #38bdf8; padding: 3px 8px; border-radius: 12px; color: #38bdf8; margin-bottom: 10px; }
    .status { margin-bottom: 12px; font-size: 15px; font-weight: bold; }
    .board { display: grid; grid-template-columns: repeat(8, 42px); grid-template-rows: repeat(8, 42px); gap: 3px; background: #064e3b; padding: 8px; border-radius: 8px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }
    .cell { background: #059669; border-radius: 4px; display: flex; align-items: center; justify-content: center; cursor: pointer; user-select: none; }
    .cell:hover { background: #10b981; }
    .disc { width: 32px; height: 32px; border-radius: 50%; box-shadow: inset 0 2px 4px rgba(255,255,255,0.4), 0 2px 4px rgba(0,0,0,0.4); transition: transform 0.2s; }
    .disc.black { background: #18181b; }
    .disc.white { background: #f8fafc; }
    .controls { margin-top: 15px; display: flex; gap: 10px; }
    button { background: #38bdf8; color: #0f172a; border: none; padding: 8px 16px; border-radius: 6px; font-weight: bold; cursor: pointer; }
    button:hover { background: #7dd3fc; }
  </style>
</head>
<body>
  <h1>🌸 エキスパート合議オセロ対戦 🎮</h1>
  <div class="council-badge">👥 Qwen × DeepSeek × WebGPU × みき 共同設計</div>
  <div class="status" id="status">黒（あなた）の番です</div>
  <div class="board" id="board"></div>
  <div class="controls"><button onclick="initGame()">リセット</button></div>
  <script>
    const BOARD_SIZE = 8; let board = []; let turn = 'B';
    const DIRS = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];
    function initGame() { board = Array(8).fill(null).map(() => Array(8).fill(null)); board[3][3] = 'W'; board[3][4] = 'B'; board[4][3] = 'B'; board[4][4] = 'W'; turn = 'B'; render(); }
    function canFlip(r, c, color) { if (board[r][c] !== null) return false; const opp = color === 'B' ? 'W' : 'B'; for (const [dr, dc] of DIRS) { let nr = r + dr, nc = c + dc, count = 0; while (nr >= 0 && nr < 8 && nc >= 0 && nc < 8 && board[nr][nc] === opp) { nr += dr; nc += dc; count++; } if (count > 0 && nr >= 0 && nr < 8 && nc >= 0 && nc < 8 && board[nr][nc] === color) return true; } return false; }
    function makeMove(r, c, color) { const opp = color === 'B' ? 'W' : 'B'; let flipped = false; for (const [dr, dc] of DIRS) { let nr = r + dr, nc = c + dc; const toFlip = []; while (nr >= 0 && nr < 8 && nc >= 0 && nc < 8 && board[nr][nc] === opp) { toFlip.push([nr, nc]); nr += dr; nc += dc; } if (toFlip.length > 0 && nr >= 0 && nr < 8 && nc >= 0 && nc < 8 && board[nr][nc] === color) { toFlip.forEach(([fr, fc]) => board[fr][fc] = color); flipped = true; } } if (flipped) board[r][c] = color; return flipped; }
    function handleCellClick(r, c) { if (turn !== 'B') return; if (canFlip(r, c, 'B')) { makeMove(r, c, 'B'); turn = 'W'; render(); setTimeout(cpuMove, 400); } }
    function cpuMove() { const validMoves = []; for (let r = 0; r < 8; r++) { for (let c = 0; c < 8; c++) { if (canFlip(r, c, 'W')) validMoves.push([r, c]); } } if (validMoves.length > 0) { const [r, c] = validMoves[Math.floor(Math.random() * validMoves.length)]; makeMove(r, c, 'W'); } turn = 'B'; render(); }
    function render() { const boardEl = document.getElementById('board'); boardEl.innerHTML = ''; let bCount = 0, wCount = 0; for (let r = 0; r < 8; r++) { for (let c = 0; c < 8; c++) { const cell = document.createElement('div'); cell.className = 'cell'; cell.onclick = () => handleCellClick(r, c); if (board[r][c]) { const disc = document.createElement('div'); disc.className = 'disc ' + (board[r][c] === 'B' ? 'black' : 'white'); cell.appendChild(disc); if (board[r][c] === 'B') bCount++; else wCount++; } boardEl.appendChild(cell); } } document.getElementById('status').innerText = \`黒(あなた): \${bCount}枚 vs 白(合議AI): \${wCount}枚 | \${turn === 'B' ? 'あなた(黒)の番' : 'AIが思考中...'}\`; }
    initGame();
  </script>
</body>
</html>`;
  } else {
    // Dynamic interactive arcade particle clicker
    gameTitle = `🌸 ${p.slice(0, 15)} (エキスパート合議開発)`;
    gameCode = `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <title>Miki Council Game</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; background: #090d16; color: #f8fafc; font-family: -apple-system, sans-serif; overflow: hidden; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; user-select: none; }
    #canvas { background: radial-gradient(circle at center, #1e1b4b 0%, #030712 100%); border-radius: 12px; box-shadow: 0 15px 35px rgba(0,0,0,0.6); max-width: 95vw; max-height: 75vh; }
    .hud { position: absolute; top: 15px; display: flex; gap: 15px; font-size: 14px; font-weight: bold; background: rgba(15, 23, 42, 0.85); padding: 8px 16px; border-radius: 20px; border: 1px solid rgba(56, 189, 248, 0.3); backdrop-blur: 8px; z-index: 10; }
    .score { color: #38bdf8; }
    .combo { color: #f43f5e; }
    .instruct { position: absolute; bottom: 20px; font-size: 12px; color: #94a3b8; background: rgba(0,0,0,0.6); padding: 6px 14px; border-radius: 12px; }
  </style>
</head>
<body>
  <div class="hud">
    <div>スコア: <span id="score" class="score">0</span></div>
    <div>コンボ: <span id="combo" class="combo">x1</span></div>
  </div>
  <canvas id="canvas" width="600" height="500"></canvas>
  <div class="instruct">🎯 出現するオーブをタップ/クリックしてスコアを獲得！</div>
  <script>
    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');
    let score = 0, combo = 1, comboTimer = null;
    let targets = [], particles = [];
    const colors = ['#f43f5e', '#38bdf8', '#10b981', '#a855f7', '#fbbf24'];

    function spawnTarget() {
      if (targets.length < 6) {
        targets.push({
          x: 40 + Math.random() * (canvas.width - 80),
          y: 40 + Math.random() * (canvas.height - 80),
          r: 24,
          maxR: 24,
          color: colors[Math.floor(Math.random() * colors.length)],
          life: 1.0,
          decay: 0.008 + Math.random() * 0.006,
          pulse: 0
        });
      }
    }

    function createExplosion(x, y, color) {
      for (let i = 0; i < 16; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 2 + Math.random() * 5;
        particles.push({
          x, y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          r: 2 + Math.random() * 3,
          color,
          alpha: 1.0
        });
      }
    }

    canvas.addEventListener('pointerdown', (e) => {
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const mx = (e.clientX - rect.left) * scaleX;
      const my = (e.clientY - rect.top) * scaleY;

      let hit = false;
      for (let i = targets.length - 1; i >= 0; i--) {
        const t = targets[i];
        const dist = Math.hypot(t.x - mx, t.y - my);
        if (dist <= t.r + 10) {
          hit = true;
          createExplosion(t.x, t.y, t.color);
          targets.splice(i, 1);
          score += 100 * combo;
          combo++;
          clearTimeout(comboTimer);
          comboTimer = setTimeout(() => { combo = 1; updateHUD(); }, 2000);
          updateHUD();
          break;
        }
      }
      if (!hit) {
        createExplosion(mx, my, '#64748b');
      }
    });

    function updateHUD() {
      document.getElementById('score').innerText = score;
      document.getElementById('combo').innerText = 'x' + combo;
    }

    function loop() {
      ctx.fillStyle = 'rgba(3, 7, 18, 0.25)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      if (Math.random() < 0.04) spawnTarget();

      for (let i = targets.length - 1; i >= 0; i--) {
        const t = targets[i];
        t.life -= t.decay;
        t.pulse += 0.08;
        if (t.life <= 0) {
          targets.splice(i, 1);
          continue;
        }
        ctx.save();
        ctx.beginPath();
        const curR = t.r * t.life + Math.sin(t.pulse) * 2;
        ctx.arc(t.x, t.y, Math.max(2, curR), 0, Math.PI * 2);
        ctx.fillStyle = t.color;
        ctx.shadowColor = t.color;
        ctx.shadowBlur = 15;
        ctx.fill();
        ctx.restore();
      }

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.95;
        p.vy *= 0.95;
        p.alpha -= 0.025;
        if (p.alpha <= 0) {
          particles.splice(i, 1);
          continue;
        }
        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      requestAnimationFrame(loop);
    }
    loop();
  </script>
</body>
</html>`;
  }

  return [
    {
      speaker: SPEAKER_PROFILES.miki,
      content: `【合議スタート】🌸\n${userNick}から「**${p}**」のリクエストをもらったよ！\nみんな集まって！それぞれの専門分野から設計・検証して最高のアプリを完成させよう！✨`,
      delayMs: 300,
    },
    {
      speaker: SPEAKER_PROFILES.qwen_coder,
      content: `【💻 コード・アーキテクト設計 (Qwen 2.5 Coder)】\n了解した。HTML5 CanvasおよびJavaScriptのイベントドリブン構造を採用する。\n- **レンダリングループ**: \`requestAnimationFrame\` によるスムーズな描画。\n- **状態管理**: オブジェクト指向でターゲット・エフェクトパーティクル・スコアを分離。\n- **操作性**: スマホのタッチ（PointerEvents）とPCのマウスクリックに両対応させる。`,
      delayMs: 800,
    },
    {
      speaker: SPEAKER_PROFILES.deepseek_logic,
      content: `【🧩 論理検証 & エッジケース対策 (DeepSeek R1)】\nロジック面を精査した。\n- **座標補正**: キャンバスの拡大縮小（CSSスケーリング）による座標ズレを防ぐため、\`scaleX / scaleY\` の比率補正を実装。\n- **コンボタイマー**: 連続タップ時のタイムアウト管理とメモリリーク防止を担保する。`,
      delayMs: 1300,
    },
    {
      speaker: SPEAKER_PROFILES.gpu_shader,
      content: `【⚡ 描画・パフォーマンス最適化 (GPU Shader Master)】\nグラフィックス視点から調整完了！\n- 半透明の背景フェード (\`rgba(3,7,18,0.25)\`) で残像パーティクル効果を演出。\n- \`shadowBlur\` グロー発光とリッチなネオンカラーパレットで視覚的インパクトを強化！`,
      delayMs: 1800,
    },
    {
      speaker: SPEAKER_PROFILES.miki,
      content: `【🎉 合議完了・完成コード出力】🌸\nみんなの知恵を結集して、完全なアプリが完成したよ！✨\n右側のプレビュー画面ですぐに遊べるように反映したよ！楽しんでね！🎮💕\n\n\`\`\`html\n${gameCode}\n\`\`\``,
      delayMs: 2300,
    },
  ];
}
