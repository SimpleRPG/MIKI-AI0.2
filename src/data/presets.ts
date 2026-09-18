import { WorkspaceFile } from '../types';

export interface WorkspaceTemplate {
  id: string;
  name: string;
  description: string;
  files: WorkspaceFile[];
}

export const WORKSPACE_TEMPLATES: WorkspaceTemplate[] = [
  {
    id: 'retro-rpg',
    name: 'Retro Action RPG Studio',
    description: '2D Action RPG with player movement, slash combat, enemy AI, particles, and Web Audio synthesizers',
    files: [
      {
        path: 'index.html',
        name: 'index.html',
        language: 'html',
        content: `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <title>Miki Retro Action RPG</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; user-select: none; }
    body {
      background: #090d16;
      color: #e2e8f0;
      font-family: monospace;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100vh;
      overflow: hidden;
    }
    #gameContainer {
      position: relative;
      width: 800px;
      height: 500px;
      border: 2px solid #6366f1;
      border-radius: 12px;
      background: #0f172a;
      box-shadow: 0 0 30px rgba(99, 102, 241, 0.25);
      overflow: hidden;
    }
    canvas {
      display: block;
      width: 100%;
      height: 100%;
    }
    #uiOverlay {
      position: absolute;
      top: 12px;
      left: 12px;
      right: 12px;
      display: flex;
      justify-content: space-between;
      pointer-events: none;
      font-size: 14px;
      font-weight: bold;
      text-shadow: 0 2px 4px rgba(0,0,0,0.8);
    }
    .bar-wrap {
      background: rgba(15, 23, 42, 0.85);
      border: 1px solid #334155;
      padding: 6px 12px;
      border-radius: 8px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .hp-bar {
      width: 120px;
      height: 10px;
      background: #334155;
      border-radius: 5px;
      overflow: hidden;
    }
    .hp-fill {
      height: 100%;
      width: 100%;
      background: #f43f5e;
      transition: width 0.15s ease;
    }
    #instructions {
      position: absolute;
      bottom: 12px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(15, 23, 42, 0.85);
      border: 1px solid #334155;
      padding: 4px 14px;
      border-radius: 20px;
      font-size: 11px;
      color: #94a3b8;
      pointer-events: none;
    }
  </style>
</head>
<body>
  <div id="gameContainer">
    <canvas id="gameCanvas" width="800" height="500"></canvas>
    <div id="uiOverlay">
      <div class="bar-wrap">
        <span>HP:</span>
        <div class="hp-bar"><div id="hpFill" class="hp-fill"></div></div>
        <span id="hpText" style="color:#f43f5e;">100/100</span>
      </div>
      <div class="bar-wrap">
        <span>SCORE:</span>
        <span id="scoreText" style="color:#38bdf8;">0</span>
      </div>
    </div>
    <div id="instructions">WASD / 矢印キー: 移動 | スペースキー: 剣攻撃 | クリック: ファイアボール</div>
  </div>

  <script>
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
    const hpFill = document.getElementById('hpFill');
    const hpText = document.getElementById('hpText');
    const scoreText = document.getElementById('scoreText');

    // Web Audio Synthesizer
    let audioCtx = null;
    function playSound(type) {
      try {
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        if (audioCtx.state === 'suspended') audioCtx.resume();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        const now = audioCtx.currentTime;

        if (type === 'slash') {
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(440, now);
          osc.frequency.exponentialRampToValueAtTime(110, now + 0.1);
          gain.gain.setValueAtTime(0.3, now);
          gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
          osc.start(now);
          osc.stop(now + 0.1);
        } else if (type === 'hit') {
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(220, now);
          osc.frequency.exponentialRampToValueAtTime(55, now + 0.15);
          gain.gain.setValueAtTime(0.4, now);
          gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
          osc.start(now);
          osc.stop(now + 0.15);
        } else if (type === 'fireball') {
          osc.type = 'sine';
          osc.frequency.setValueAtTime(600, now);
          osc.frequency.exponentialRampToValueAtTime(200, now + 0.2);
          gain.gain.setValueAtTime(0.25, now);
          gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
          osc.start(now);
          osc.stop(now + 0.2);
        }
      } catch(e) {}
    }

    // Game State
    const player = {
      x: 400,
      y: 250,
      radius: 16,
      speed: 4,
      hp: 100,
      maxHp: 100,
      score: 0,
      slashTimer: 0,
      slashAngle: 0
    };

    const keys = {};
    const enemies = [];
    const projectiles = [];
    const particles = [];

    window.addEventListener('keydown', (e) => {
      keys[e.key.toLowerCase()] = true;
      if (e.code === 'Space' && player.slashTimer <= 0) {
        player.slashTimer = 12;
        playSound('slash');
        // Check melee hit
        enemies.forEach(en => {
          const dist = Math.hypot(en.x - player.x, en.y - player.y);
          if (dist < 60) {
            en.hp -= 35;
            playSound('hit');
            createParticles(en.x, en.y, '#f43f5e', 8);
          }
        });
      }
    });

    window.addEventListener('keyup', (e) => {
      keys[e.key.toLowerCase()] = false;
    });

    canvas.addEventListener('mousedown', (e) => {
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const mouseX = (e.clientX - rect.left) * scaleX;
      const mouseY = (e.clientY - rect.top) * scaleY;
      const angle = Math.atan2(mouseY - player.y, mouseX - player.x);

      projectiles.push({
        x: player.x,
        y: player.y,
        vx: Math.cos(angle) * 7,
        vy: Math.sin(angle) * 7,
        radius: 6,
        color: '#38bdf8'
      });
      playSound('fireball');
    });

    function createParticles(x, y, color, count) {
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 4 + 1;
        particles.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          radius: Math.random() * 3 + 1,
          color,
          life: 20
        });
      }
    }

    // Spawn Enemy
    let spawnTimer = 0;
    function spawnEnemy() {
      const edge = Math.floor(Math.random() * 4);
      let x = 0, y = 0;
      if (edge === 0) { x = Math.random() * 800; y = -20; }
      else if (edge === 1) { x = 820; y = Math.random() * 500; }
      else if (edge === 2) { x = Math.random() * 800; y = 520; }
      else { x = -20; y = Math.random() * 500; }

      enemies.push({
        x,
        y,
        radius: 14,
        speed: Math.random() * 1.5 + 1.2,
        hp: 40,
        maxHp: 40,
        color: '#a855f7'
      });
    }

    function update() {
      // Movement
      let dx = 0, dy = 0;
      if (keys['w'] || keys['arrowup']) dy -= 1;
      if (keys['s'] || keys['arrowdown']) dy += 1;
      if (keys['a'] || keys['arrowleft']) dx -= 1;
      if (keys['d'] || keys['arrowright']) dx += 1;

      if (dx !== 0 && dy !== 0) {
        dx *= 0.7071;
        dy *= 0.7071;
      }

      player.x = Math.max(player.radius, Math.min(800 - player.radius, player.x + dx * player.speed));
      player.y = Math.max(player.radius, Math.min(500 - player.radius, player.y + dy * player.speed));

      if (dx !== 0 || dy !== 0) {
        player.slashAngle = Math.atan2(dy, dx);
      }

      if (player.slashTimer > 0) player.slashTimer--;

      // Projectiles
      for (let i = projectiles.length - 1; i >= 0; i--) {
        const p = projectiles[i];
        p.x += p.vx;
        p.y += p.vy;

        // Collision with enemies
        for (let j = enemies.length - 1; j >= 0; j--) {
          const en = enemies[j];
          if (Math.hypot(p.x - en.x, p.y - en.y) < p.radius + en.radius) {
            en.hp -= 25;
            playSound('hit');
            createParticles(en.x, en.y, '#38bdf8', 6);
            projectiles.splice(i, 1);
            break;
          }
        }

        if (p.x < 0 || p.x > 800 || p.y < 0 || p.y > 500) {
          projectiles.splice(i, 1);
        }
      }

      // Enemies
      spawnTimer++;
      if (spawnTimer > 70) {
        spawnEnemy();
        spawnTimer = 0;
      }

      for (let i = enemies.length - 1; i >= 0; i--) {
        const en = enemies[i];
        const angle = Math.atan2(player.y - en.y, player.x - en.x);
        en.x += Math.cos(angle) * en.speed;
        en.y += Math.sin(angle) * en.speed;

        // Touch player
        if (Math.hypot(player.x - en.x, player.y - en.y) < player.radius + en.radius) {
          player.hp -= 0.3;
          if (player.hp < 0) player.hp = 0;
          hpFill.style.width = (player.hp / player.maxHp * 100) + '%';
          hpText.innerText = Math.round(player.hp) + '/100';
        }

        // Death
        if (en.hp <= 0) {
          player.score += 100;
          scoreText.innerText = player.score;
          createParticles(en.x, en.y, '#a855f7', 16);
          enemies.splice(i, 1);
        }
      }

      // Particles
      for (let i = particles.length - 1; i >= 0; i--) {
        const pt = particles[i];
        pt.x += pt.vx;
        pt.y += pt.vy;
        pt.life--;
        if (pt.life <= 0) particles.splice(i, 1);
      }
    }

    function render() {
      ctx.clearRect(0, 0, 800, 500);

      // Grid background
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 1;
      for (let x = 0; x < 800; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, 500);
        ctx.stroke();
      }
      for (let y = 0; y < 500; y += 40) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(800, y);
        ctx.stroke();
      }

      // Projectiles
      projectiles.forEach(p => {
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      });

      // Enemies
      enemies.forEach(en => {
        ctx.fillStyle = en.color;
        ctx.beginPath();
        ctx.arc(en.x, en.y, en.radius, 0, Math.PI * 2);
        ctx.fill();
        // Eye
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(en.x, en.y - 2, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        ctx.arc(en.x, en.y - 2, 2, 0, Math.PI * 2);
        ctx.fill();
      });

      // Slash arc
      if (player.slashTimer > 0) {
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 4;
        ctx.shadowColor = '#38bdf8';
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.arc(player.x, player.y, 48, player.slashAngle - 1, player.slashAngle + 1);
        ctx.stroke();
        ctx.shadowBlur = 0;
      }

      // Player
      ctx.fillStyle = '#38bdf8';
      ctx.shadowColor = '#38bdf8';
      ctx.shadowBlur = 15;
      ctx.beginPath();
      ctx.arc(player.x, player.y, player.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      // Particles
      particles.forEach(pt => {
        ctx.fillStyle = pt.color;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, pt.radius, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    function loop() {
      update();
      render();
      requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
  </script>
</body>
</html>`
      }
    ]
  },
  {
    id: 'blank-slate',
    name: 'Blank Canvas',
    description: 'A clean slate for building anything with Miki',
    files: [
      {
        path: 'index.html',
        name: 'index.html',
        language: 'html',
        content: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>New Project</title>
  <style>
    body {
      background: #0f172a;
      color: #f8fafc;
      font-family: sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100vh;
      margin: 0;
    }
    .card {
      background: #1e293b;
      padding: 30px;
      border-radius: 12px;
      border: 1px solid #334155;
      text-align: center;
      max-width: 400px;
    }
  </style>
</head>
<body>
  <div class="card">
    <h2>✨ Blank Canvas</h2>
    <p style="color:#94a3b8; font-size:14px; margin-top:10px;">
      チャットで「〜なゲームを作って」と指示すると、ここにリアルタイムでコードが生成されます！
    </p>
  </div>
</body>
</html>`
      }
    ]
  }
];
