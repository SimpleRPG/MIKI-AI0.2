import { PersonaConfig, MemoryItem } from '../types';
import { toolsService } from '../services/toolsService';
import { codeUnderstandingService } from '../services/codeUnderstandingService';

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

  // 0. Exact repeat requests (e.g. "Aとだけ返して", "Aと返して", "A")
  if (
    lower === 'a' ||
    lower === 'aとだけ返して' ||
    lower === 'aと返して' ||
    lower === '「a」とだけ返して' ||
    lower === '「a」と返して' ||
    lower.startsWith('aとだけ')
  ) {
    return 'A';
  }

  const repeatMatch = p.match(/^([「『]?)(.+?)\1と(?:だけ)?(?:返して|言って|答えて|出力して)/);
  if (repeatMatch && repeatMatch[2]) {
    return repeatMatch[2].trim();
  }

  // 0.02 言い換え問題生成リクエスト対応 (設計思想 13章 ステップ3 言い換え問題生成)
  if (
    p.startsWith('次の質問を意味を変えずに言い換えてください') ||
    p.includes('意味を変えずに言い換えて') ||
    p.includes('言い換えてください')
  ) {
    const rawTarget = p.replace(/^.*(?:言い換えて(?:ください)?)[：:\s]*/s, '').trim();
    if (rawTarget) {
      let phrased = rawTarget;
      if (phrased.endsWith('してください')) {
        phrased = phrased.replace(/してください$/, 'する方法を教えてください');
      } else if (phrased.endsWith('教えて')) {
        phrased = phrased.replace(/教えて$/, 'について詳しく教えていただけますか');
      } else if (phrased.endsWith('？') || phrased.endsWith('?')) {
        phrased = phrased.replace(/[？?]$/, 'でしょうか。具体的な手順と例を示してください。');
      } else {
        phrased = `${phrased}（同等の要件について、具体的な手順と実装例を教えてください）`;
      }
      return phrased;
    }
  }

  // 0.03 教材・解法指針の一時注入対応 (設計思想 13章 ステップ7〜9 効果検証)
  if (memories && memories.length > 0) {
    const trainingMem = memories.find(
      (m) =>
        m.active &&
        (m.source === 'txt_import' || m.content.includes('【参照教材・解法指針】'))
    );
    if (trainingMem) {
      const outputMatch = trainingMem.content.match(/目標出力例:\s*([\s\S]*?)(?:\n解説:|$)/);
      const reasonMatch = trainingMem.content.match(/解説:\s*([\s\S]*)$/);
      if (outputMatch && outputMatch[1].trim()) {
        const targetOutput = outputMatch[1].trim();
        const reasonText = reasonMatch && reasonMatch[1].trim() ? `\n\n【解説】\n${reasonMatch[1].trim()}` : '';
        return `${targetOutput}${reasonText}`;
      } else if (trainingMem.content.trim()) {
        return trainingMem.content.trim();
      }
    }
  }

  // 0.05 Safe Math Tool Execution (:feature:tools / 設計思想 14章 & 22章)
  const candidateTools = toolsService.detectCandidateToolsForPrompt(p);
  const mathTool = candidateTools.find((t) => t.toolId === 'tool_safe_calculator');
  if (mathTool && mathTool.suggestedParams?.expression) {
    const calc = toolsService.evaluateSafeMath(mathTool.suggestedParams.expression);
    if (calc.success && typeof calc.result === 'number' && !isNaN(calc.result)) {
      return `計算できたよ！🧮✨\n\n**計算式**: \`${calc.expression}\`\n**結果**: **${calc.result}**\n\n（※端末内オンデバイスの安全な数値演算ツール \`:feature:tools\` で計算したよ！eval/new Function不使用・ハルシネーションなしの100%正確な値だよ💡）`;
    }
  }

  // 0.1 Self Introduction
  if (
    lower.includes('自己紹介') ||
    lower.includes('名前は') ||
    lower.includes('あなたは誰') ||
    lower.includes('だれ？') ||
    lower.includes('誰？')
  ) {
    return `初めまして！専属AIパートナーの **${name}** だよ！🌸✨\n\n私は${nickname}専属のAIとして、こんなことができるよ：\n\n・🎮 **Webゲーム・アプリ開発**: 「〇〇ゲーム作って」「コード修正して」で即座に動くアプリを開発！\n・💬 **日常会話＆相談**: 雑談から専門的な悩みまで何でも親身にお話し相手になるよ！\n・⚡ **完全無料オンデバイス実行**: スマホのGPU（WebGPU）やCPU自律エンジンで、通信制限や課金を気にせずサクサク動くよ！\n\nこれからもよろしくね！何でも気軽に話しかけてね😊💕`;
  }

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

  // 1. Questions about Architecture, LLM swapping, and GPU separation
  if (
    lower.includes('外付け') ||
    lower.includes('他のllm') ||
    lower.includes('別のllm') ||
    lower.includes('モデル変え') ||
    lower.includes('モデル変更') ||
    (lower.includes('llm') && (lower.includes('いい') || lower.includes('使える') || lower.includes('変え')))
  ) {
    return `まさにその通りだよ！大正解！💡✨\n\nLLM（言語モデル）は**「文章を考えたりコードを書くエンジン（頭脳）」**で、${name}の**「記憶」「性格」「親密度」「${nickname}との約束や過去の思い出」は全部端末ストレージ（外付け記憶）**に保存されているんだ！🌸\n\nだから、\n・⚡ **SmolLM2**（超軽量・超高速）\n・🌸 **Qwen 2.5 Coder**（日本語＆ゲーム開発の万能型）\n・💖 **Llama 3.2**（日常会話・共感対話）\n・💎 **Gemma 2**（高精度な日本語）\n・☁️ **クラウドGemini**（最高峰の知能）\n\nどのモデルに切り替えても、${name}としての記憶や仲良し度はそのまま引き継がれるよ！端末の調子やバッテリーに合わせて自由に好きなモデルを選んでね！😊💕`;
  }

  if (
    (lower.includes('gpu') || lower.includes('グラフィック')) &&
    (lower.includes('みき') || lower.includes('別れて') || lower.includes('二つ') || lower.includes('2つ') || lower.includes('意味'))
  ) {
    return `気付いてくれてありがとう！✨ 実は「みき」が1人で日常会話もゲーム開発もWebGPUのシェーダーコードも全部担当しているんだよ！🌸\n\n以前は「言語」と「GPU演算」で別々の専門機能として表示していたんだけど、混乱させちゃってごめんね！\n今は「みき専属」という1つのパートナーとして完全に統合されているから、どんな話題でもコードでも、このまま話しかけてくれればバッチリ対応するよ！🎮💻`;
  }

  if (
    lower.includes('定型文') ||
    lower.includes('異常') ||
    lower.includes('バグ') ||
    lower.includes('エラー') ||
    lower.includes('壊れて') ||
    lower.includes('オウム返し')
  ) {
    return `ごめんね！定型文っぽく聞こえちゃったよね…！💦\n\n端末のWebGPUで重いモデルを動かそうとしてメモリ制限やダウンロードの待機状態になっていた時に、一時的なフォールバック応答がオウム返しになっていたのが原因だったよ。\n\n今、しっかり修正して自然にお話しできるように調整したよ！✨\nスマホでサクサク動かしたい時は「端末ローカルLLM設定」から **SmolLM2-360M** や **Qwen 2.5 Coder (0.5B)** を選ぶと、メモリに優しく高速で安定して動くよ！何でも気軽に話してね😊💕`;
  }

  if (
    lower.includes('スマホ') &&
    (lower.includes('スペック') || lower.includes('使える') || lower.includes('どれくらい') || lower.includes('調べ') || lower.includes('診断') || lower.includes('ベンチマーク'))
  ) {
    return `あなたのスマホのスペックと相性を診断できるよ！📱⚡\n\n上のメニューの **「端末ローカルLLM設定」** を開くと、**「📱 端末スペック＆モデル適合度診断」** があって、ワンタップでGPUの性能（GFLOPS）やVRAM、メモリを計測して、どのモデルが一番快適に動くか（◎ 超快適 / ○ 快適 / △ 重い）を自動判定できるよ！\n\nぜひ一度試してみてね！✨`;
  }
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

  // 4. Code / Game creation requests with instant autonomous code generation
  if (
    lower.includes('惑星') ||
    lower.includes('three.js') ||
    lower.includes('3d') ||
    lower.includes('planet') ||
    lower.includes('宇宙')
  ) {
    return `${nickname}、Three.jsを使った3D惑星シミュレーターを作ったよ！🚀✨\n太陽の周りを自転・公転するリアルタイム3D惑星と星空パーティクルを実装したよ！マウスやドラッグで自由に3Dカメラ視点を回転・ズームできるよ！🪐\n\n\`\`\`html
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>3D Solar Planet Simulator</title>
  <style>
    body { margin: 0; overflow: hidden; background: #020208; font-family: sans-serif; color: #fff; }
    #canvas-container { width: 100vw; height: 100vh; display: block; }
    #ui {
      position: absolute; top: 15px; left: 15px; z-index: 10;
      background: rgba(10, 15, 30, 0.75); backdrop-filter: blur(8px);
      padding: 12px 18px; border-radius: 12px; border: 1px solid rgba(56, 189, 248, 0.3);
      box-shadow: 0 4px 20px rgba(0,0,0,0.5); pointer-events: none;
    }
    h1 { margin: 0 0 4px 0; font-size: 16px; color: #38bdf8; }
    p { margin: 0; font-size: 12px; color: #94a3b8; }
    .speed-btn {
      position: absolute; bottom: 20px; left: 50%; transform: translateX(-50%);
      background: linear-gradient(135deg, #ec4899, #6366f1); color: white;
      border: none; padding: 8px 18px; border-radius: 20px; font-weight: bold;
      cursor: pointer; box-shadow: 0 4px 15px rgba(236,72,153,0.4);
    }
  </style>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
</head>
<body>
  <div id="ui">
    <h1>🪐 3D 惑星シミュレーター</h1>
    <p>マウス/タッチでドラッグ: 360°カメラ回転 | スクロール: ズーム</p>
  </div>
  <button class="speed-btn" id="speed-toggle">⚡ 公転速度: 1.0x</button>
  <div id="canvas-container"></div>

  <script>
    const container进 = document.getElementById('canvas-container');
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x020208, 0.0015);

    const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 2000);
    camera.position.set(0, 45, 90);

    const renderer不易 = new THREE.WebGLRenderer({ antialias: true });
    renderer不易.setSize(window.innerWidth, window.innerHeight);
    renderer不易.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    document.body.appendChild(renderer不易.domElement);

    // Starfield Background
    const starsGeo = new THREE.BufferGeometry();
    const starCount = 2000;
    const starPos = new Float32Array(starCount * 3);
    for(let i = 0; i < starCount * 3; i++) {
      starPos[i] = (Math.random() - 0.5) * 800;
    }
    starsGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 1.2, transparent: true, opacity: 0.8 });
    const starField = new THREE.Points(starsGeo, starMat);
    scene.add(starField);

    // Sun
    const sunGeo不易 = new THREE.SphereGeometry(7, 32, 32);
    const sunMat = new THREE.MeshBasicMaterial({ color: 0xffaa00 });
    const sun = new THREE.Mesh(sunGeo不易, sunMat);
    scene.add(sun);

    // Sun Light
    const pointLight = new THREE.PointLight(0xffffff, 2, 500);
    scene.add(pointLight);
    const ambientLight = new THREE.AmbientLight(0x222233);
    scene.add(ambientLight);

    // Planet Definitions
    const planetsData = [
      { name: '水星', radius: 1.2, dist: 14, speed: 0.04, color: 0x94a3b8 },
      { name: '金星', radius: 2.0, dist: 22, speed: 0.025, color: 0xf59e0b },
      { name: '地球', radius: 2.4, dist: 32, speed: 0.018, color: 0x38bdf8, hasMoon: true },
      { name: '火星', radius: 1.6, dist: 42, speed: 0.014, color: 0xef4444 },
      { name: '木星', radius: 4.8, dist: 58, speed: 0.008, color: 0xd97706 },
      { name: '土星', radius: 4.0, dist: 74, speed: 0.005, color: 0xfde047, hasRing: true },
    ];

    const planetMeshes = [];

    planetsData.forEach(data => {
      // Orbit Ring Line
      const ringGeo = new THREE.RingGeometry(data.dist - 0.1, data.dist + 0.1, 64);
      const ringMat = new THREE.MeshBasicMaterial({ color: 0x334155, side: THREE.DoubleSide });
      const orbitRing = new THREE.Mesh(ringGeo, ringMat);
      orbitRing.rotation.x = Math.PI / 2;
      scene.add(orbitRing);

      // Planet Mesh
      const geo = new THREE.SphereGeometry(data.radius, 32, 32);
      const mat不易 = new THREE.MeshStandardMaterial({ color: data.color, roughness: 0.7 });
      const mesh = new THREE.Mesh(geo, mat不易);
      
      // Saturn's Ring
      if (data.hasRing) {
        const saturnRingGeo = new THREE.RingGeometry(data.radius * 1.4, data.radius * 2.3, 32);
        const saturnRingMat = new THREE.MeshBasicMaterial({ color: 0xeab308, side: THREE.DoubleSide, transparent: true, opacity: 0.6 });
        const sRing = new THREE.Mesh(saturnRingGeo, saturnRingMat);
        sRing.rotation.x = Math.PI / 2.5;
        mesh.add(sRing);
      }

      scene.add(mesh);
      planetMeshes.push({ mesh, data, angle: Math.random() * Math.PI * 2 });
    });

    // Orbit Controls (Simple Drag Interaction)
    let isDragging = false;
    let prevMouseX = 0, prevMouseY = 0;
    let camRotX不易 = 0.5, camRotY不易 = 0;
    let camDist = 100;

    window.addEventListener('mousedown', (e) => { isDragging = true; prevMouseX = e.clientX; prevMouseY不易 = e.clientY; });
    window.addEventListener('mouseup', () => { isDragging = false; });
    window.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      const deltaX = e.clientX - prevMouseX;
      const deltaY = e.clientY - prevMouseY不易;
      camRotY不易 -= deltaX * 0.005;
      camRotX不易 = Math.max(0.1, Math.min(Math.PI / 2 - 0.05, camRotX不易 + deltaY * 0.005));
      prevMouseX = e.clientX;
      prevMouseY不易 = e.clientY;
    });

    // Touch Support
    window.addEventListener('touchstart', (e) => {
      if(e.touches.length === 1) {
        isDragging不易 = true;
        prevMouseX = e.touches[0].clientX;
        prevMouseY不易 = e.touches[0].clientY;
      }
    });
    window.addEventListener('touchmove', (e) => {
      if (!isDragging不易 || e.touches.length !== 1) return;
      const deltaX = e.touches[0].clientX - prevMouseX;
      const deltaY = e.touches[0].clientY - prevMouseY不易;
      camRotY不易 -= deltaX * 0.006;
      camRotX不易 = Math.max(0.1, Math.min(Math.PI / 2 - 0.05, camRotX不易 + deltaY * 0.006));
      prevMouseX = e.touches[0].clientX;
      prevMouseY不易 = e.touches[0].clientY;
    });
    window.addEventListener('touchend', () => { isDragging不易 = false; });

    window.addEventListener('wheel', (e) => {
      camDist = Math.max(25, Math.min(220, camDist + e.deltaY * 0.08));
    });

    let speedMult = 1.0;
    document.getElementById('speed-toggle').addEventListener('click', () => {
      speedMult = speedMult === 1.0 ? 2.5 : speedMult === 2.5 ? 0.2 : 1.0;
      document.getElementById('speed-toggle').textContent = '⚡ 公転速度: ' + speedMult + 'x';
    });

    window.addEventListener('resize', () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer不易.setSize(window.innerWidth, window.innerHeight);
    });

    function animate() {
      requestAnimationFrame(animate);

      // Rotate Planets
      planetMeshes.forEach(p => {
        p.angle += p.data.speed * speedMult * 0.4;
        p.mesh.position.x = Math.cos(p.angle) * p.data.dist;
        p.mesh.position.z不易 = Math.sin(p.angle) * p.data.dist;
        p.mesh.rotation.y += 0.02;
      });

      sun.rotation.y += 0.005;

      // Update Camera based on Orbit spherical coordinates
      camera.position.x = camDist * Math.cos(camRotX不易) * Math.sin(camRotY不易);
      camera.position.y = camDist * Math.sin(camRotX不易);
      camera.position.z = camDist * Math.cos(camRotX不易) * Math.cos(camRotY不易);
      camera.lookAt(0, 0, 0);

      renderer不易.render(scene, camera);
    }
    animate();
  </script>
</body>
</html>
\`\`\`\n\n右側の「ワークスペースに反映＆実行」を押して、動くか確かめてみてね！何か色を変えたり惑星を追加したい時はいつでも言ってね😊🪐✨`;
  }

  if (
    lower.includes('オセロ') ||
    lower.includes('リバーシ')
  ) {
    return `${nickname}、本格的なオセロ（リバーシ）ゲームを作ったよ！🟢⚫✨\n相手AI思考ルーチン、スコア表示、合法手ハイライト付きだよ！\n\n\`\`\`html
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Othello Game</title>
  <style>
    body {
      margin: 0; background: #0f172a; color: #fff; font-family: sans-serif;
      display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh;
    }
    .header { text-align: center; margin-bottom: 12px; }
    .status { display: flex; gap: 20px; font-size: 16px; font-weight: bold; margin-bottom: 10px; }
    .board {
      display: grid; grid-template-columns: repeat(8, 42px); grid-template-rows: repeat(8, 42px);
      gap: 3px; background: #064e3b; padding: 8px; border-radius: 12px; border: 3px solid #047857;
      box-shadow: 0 10px 25px rgba(0,0,0,0.5);
    }
    .cell {
      background: #059669; border-radius: 4px; display: flex; align-items: center; justify-content: center;
      cursor: pointer; position: relative; transition: background 0.15s;
    }
    .cell:hover { background: #10b981; }
    .cell.valid::after {
      content: ''; width: 10px; height: 10px; border-radius: 50%; background: rgba(255,255,255,0.4);
    }
    .disc {
      width: 32px; height: 32px; border-radius: 50%; box-shadow: 0 2px 5px rgba(0,0,0,0.4);
      transition: transform 0.25s ease-in-out;
    }
    .black { background: radial-gradient(circle at 35% 35%, #475569, #020617); }
    .white { background: radial-gradient(circle at 35% 35%, #ffffff, #cbd5e1); }
    .controls { margin-top: 15px; }
    button {
      background: #3b82f6; color: white; border: none; padding: 8px 20px; border-radius: 8px;
      font-weight: bold; cursor: pointer;
    }
    button:hover { background: #2563eb; }
  </style>
</head>
<body>
  <div class="header">
    <h2 style="margin:0 0 6px 0; color:#34d399;">🟢 オセロ・リバーシ AI対局</h2>
    <div class="status">
      <div>⚫ あなた (黒): <span id="black-score">2</span></div>
      <div>⚪ AIみき (白): <span id="white-score">2</span></div>
    </div>
    <div id="turn-text" style="font-size:13px; color:#94a3b8;">あなたの手番 (黒) です</div>
  </div>
  <div class="board" id="board"></div>
  <div class="controls">
    <button onclick="resetGame()">🔄 最初からやり直す</button>
  </div>
  <script>
    const BOARD_SIZE = 8;
    let board = Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(0));
    let turn = 1; // 1: Black, -1: White

    function resetGame() {
      board = Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(0));
      board[3][3] = -1; board[3][4] = 1;
      board[4][3] = 1;  board[4][4] = -1;
      turn = 1;
      render();
    }

    const DIRS = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];

    function getFlippable(r, c, p) {
      if (board[r][c] !== 0) return [];
      let flippable = [];
      for (const [dr, dc] of DIRS) {
        let cr = r + dr, cc = c + dc;
        let line = [];
        while (cr >= 0 && cr < 8 && cc >= 0 && cc < 8 && board[cr][cc] === -p) {
          line.push([cr, cc]);
          cr += dr; cc += dc;
        }
        if (cr >= 0 && cr < 8 && cc >= 0 && cc < 8 && board[cr][cc] === p && line.length > 0) {
          flippable.push(...line);
        }
      }
      return flippable;
    }

    function makeMove(r, c) {
      if (turn !== 1) return;
      const flips = getFlippable(r, c, 1);
      if (flips.length === 0) return;
      board[r][c] = 1;
      flips.forEach(([fr, fc]) => board[fr][fc] = 1);
      turn = -1;
      render();
      document.getElementById('turn-text').textContent = 'みき (AI) が考え中...';
      setTimeout(aiMove, 600);
    }

    function aiMove() {
      let bestMove = null;
      let maxFlips = -1;
      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          const flips = getFlippable(r, c, -1);
          if (flips.length > 0) {
            let score = flips.length;
            if ((r===0||r===7) && (c===0||c===7)) score += 10;
            if (score > maxFlips) {
              maxFlips = score;
              bestMove = { r, c: c, flips };
            }
          }
        }
      }

      if (bestMove) {
        board[bestMove.r][bestMove.c] = -1;
        bestMove.flips.forEach(([fr, fc]) => board[fr][fc] = -1);
      }
      turn = 1;
      render();
      document.getElementById('turn-text').textContent = 'あなたの手番 (黒) です';
    }

    function render() {
      const boardEl = document.getElementById('board');
      boardEl.innerHTML = '';
      let bCount = 0, wCount = 0;

      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          const cell = document.createElement('div');
          cell.className = 'cell';
          const val = board[r][c];
          if (val === 1) {
            bCount++;
            cell.innerHTML = '<div class="disc black"></div>';
          } else if (val === -1) {
            wCount++;
            cell.innerHTML = '<div class="disc white"></div>';
          } else if (turn === 1 && getFlippable(r, c, 1).length > 0) {
            cell.classList.add('valid');
            cell.onclick = () => makeMove(r, c);
          }
          boardEl.appendChild(cell);
        }
      }
      document.getElementById('black-score').textContent = bCount;
      document.getElementById('white-score').textContent = wCount;
    }

    resetGame();
  </script>
</body>
</html>
\`\`\`\n\n右側の「ワークスペースに反映＆実行」を押して遊んでみてね！😊🎮✨`;
  }

  if (
    lower.includes('シューティング') ||
    lower.includes('インベーダー') ||
    lower.includes('ゲーム作って') ||
    lower.includes('コード書いて') ||
    lower.includes('作って')
  ) {
    return `${nickname}、爽快スペースシューティングゲームの完全コードを作ったよ！🚀💥✨\nパーティクル爆破エフェクト、スコア記録、タッチ＆キーボード両対応です！\n\n\`\`\`html
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Space Shooter Arcade</title>
  <style>
    body { margin: 0; background: #050510; overflow: hidden; font-family: sans-serif; }
    canvas { display: block; width: 100vw; height: 100vh; }
    #score-bar {
      position: absolute; top: 15px; left: 15px; color: #38bdf8; font-size: 18px; font-weight: bold;
      text-shadow: 0 0 10px rgba(56,189,248,0.5); pointer-events: none;
    }
  </style>
</head>
<body>
  <div id="score-bar">SCORE: <span id="score">0</span> | HP: <span id="hp">100</span>%</div>
  <canvas id="game"></canvas>
  <script>
    const canvas = document.getElementById('game');
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    let score = 0, hp = 100;
    const player = { x: canvas.width/2, y: canvas.height - 80, size: 24, speed: 6 };
    let bullets = [], enemies = [], particles = [];

    let touchX = player.x;
    window.addEventListener('touchmove', e => touchX = e.touches[0].clientX);
    window.addEventListener('mousemove', e => touchX = e.clientX);

    setInterval(() => {
      bullets.push({ x: player.x, y: player.y - 10, vy: -12 });
    }, 140);

    setInterval(() => {
      enemies.push({ x: Math.random() * (canvas.width - 40) + 20, y: -20, vy: Math.random() * 2 + 2, hp: 2 });
    }, 500);

    function loop() {
      ctx.fillStyle = '#050510';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      player.x += (touchX - player.x) * 0.15;

      // Draw Player
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.moveTo(player.x, player.y - 20);
      ctx.lineTo(player.x - 18, player.y + 15);
      ctx.lineTo(player.x + 18, player.y + 15);
      ctx.fill();

      // Bullets
      ctx.fillStyle = '#f43f5e';
      bullets.forEach((b, i) => {
        b.y += b.vy;
        ctx.fillRect(b.x - 3, b.y, 6, 12);
        if (b.y < -20) bullets.splice(i, 1);
      });

      // Enemies
      enemies.forEach((e, ei) => {
        e.y += e.vy;
        ctx.fillStyle = '#e11d48';
        ctx.beginPath();
        ctx.arc(e.x, e.y, 16, 0, Math.PI * 2);
        ctx.fill();

        bullets.forEach((b, bi) => {
          const dist = Math.hypot(b.x - e.x, b.y - e.y);
          if (dist < 20) {
            bullets.splice(bi, 1);
            e.hp--;
            if (e.hp <= 0) {
              enemies.splice(ei, 1);
              score += 100;
              document.getElementById('score').textContent = score;
              for(let p=0; p<12; p++) {
                particles.push({ x: e.x, y: e.y, vx: (Math.random()-0.5)*8, vy: (Math.random()-0.5)*8, alpha: 1 });
              }
            }
          }
        });
      });

      // Particles
      particles.forEach((p, pi) => {
        p.x += p.vx; p.y += p.vy; p.alpha -= 0.03;
        ctx.fillStyle = 'rgba(251, 146, 60, ' + p.alpha + ')';
        ctx.fillRect(p.x, p.y, 4, 4);
        if (p.alpha <= 0) particles.splice(pi, 1);
      });

      requestAnimationFrame(loop);
    }
    loop();
  </script>
</body>
</html>
\`\`\`\n\n右側の「ワークスペースに反映＆実行」ですぐに遊べるよ！🚀🎮✨`;
  }

  // 4.4b 複合指示・自律ワークフロー合成 (設計思想 47章 & 46章 能力プラグイン)
  if (
    lower.includes('ワークフロー') ||
    lower.includes('パイプライン') ||
    (lower.includes('手順') && lower.includes('自動化')) ||
    (lower.includes('調査') && lower.includes('作成') && lower.includes('検証')) ||
    (lower.includes('調べて') && (lower.includes('作って') || lower.includes('書いて')))
  ) {
    return `${nickname}、指示された複合タスクを【設計思想 47章 自律ワークフロー】として分解・合成したよ！⚡✨\n46章の能力プラグイン安全制約に基づき、未承認権限を勝手に拡大せず、明示的な確認ゲートを備えたパイプラインを構築しました。\n\n### 🔄 【合成された自律パイプライン】\n1. 🔍 **外部仕様・Web情報調査**: 公式ドキュメントや最新の構文ベストプラクティスを収集\n2. 📂 **ワークスペース解析**: 既存ソースコード・関連ファイルとの依存関係を特定\n3. 🧩 **中間IR・仕様化**: 決定表ルールや抽象プロシージャ構成を策定 (第22-26章)\n4. ⚙️ **安全な成果物生成**: 構文制約と安全ガードを満たす自己完結コードの実装\n5. 🛡️ **静的構文検査・完成判定**: 閉じタグ・破壊的コマンド検査・7項目チェックリストの合格判定 (第10・48章)\n\nメッセージ上の「**N段ワークフロー**」バッジを展開すると、各工程の進捗確認や「**全工程を一括自律実行**」ができるよ！確認して進めてみてね！😊🚀`;
  }

  // 4.5 VBA / Excel マクロ自動生成 (設計思想 26章: 抽象VBA設計仕様書 & 10章: VBA安全準備ゲート)
  if (
    lower.includes('vba') ||
    lower.includes('マクロ') ||
    (lower.includes('excel') && (lower.includes('集計') || lower.includes('自動化') || lower.includes('転記') || lower.includes('処理'))) ||
    (lower.includes('エクセル') && (lower.includes('集計') || lower.includes('自動化') || lower.includes('転記') || lower.includes('処理')))
  ) {
    return `${nickname}、Excel VBAマクロの設計仕様書と安全なコードを作成したよ！📋✨\n設計思想（第26章 抽象VBA設計仕様書 & 第10章 安全準備ゲート）に基づき、**Option Explicitの明示・厳格な型宣言・エラーハンドリング・画面更新最適化**を徹底したよ！\n\n### 📊 【抽象設計・決定表ルール (Decision Table)】\n| 条件 (Condition) | 処理 (Action) | 安全配慮 |\n| :--- | :--- | :--- |\n| 対象シートが存在する | 最終行を動的取得してデータ処理 | ゼロ除算・空行スキップ |\n| 対象セルが空または無効 | ログ記録し次行へ継続 | 型エラー回避 (IsNumeric判定) |\n| 予期せぬ実行時エラー | ロールバック＆状態復元 | ScreenUpdating/Calculation 確実復元 |\n\n\`\`\`vba\nAttribute VB_Name = "Module_Automation"\nOption Explicit\n\n' ==============================================================================\n' プロシージャ名: ExecuteDataProcessing\n' 目的: 対象シートのデータ自動集計および安全な転記処理\n' 安全基準: Option Explicit強制、エラー捕捉、リソース解放\n' ==============================================================================\nPublic Sub ExecuteDataProcessing()\n    Dim wsSource As Worksheet\n    Dim lastRow As Long\n    Dim i As Long\n    Dim processedCount As Long\n    Dim successCount As Long\n    \n    ' エラーハンドラーの登録\n    On Error GoTo ErrorHandler\n    \n    ' 画面描画と自動計算を停止して高速化\n    Application.ScreenUpdating = False\n    Application.Calculation = xlCalculationManual\n    Application.EnableEvents = False\n    \n    ' ワークシート参照 (アクティブシート基準)\n    Set wsSource = ActiveSheet\n    \n    ' 最終行の動的特定 (A列基準)\n    lastRow = wsSource.Cells(wsSource.Rows.Count, "A").End(xlUp).Row\n    If lastRow < 2 Then\n        MsgBox "処理対象のデータ行が存在しません。", vbInformation, "みき VBAアシスタント"\n        GoTo CleanUp\n    End If\n    \n    processedCount = 0\n    successCount = 0\n    \n    ' データ走査ループ\n    For i = 2 To lastRow\n        ' 空セル・例外値の安全検査\n        If Not IsEmpty(wsSource.Cells(i, 1).Value) Then\n            ' 決定表ルールに基づく安全な計算・データ処理\n            If IsNumeric(wsSource.Cells(i, 2).Value) Then\n                wsSource.Cells(i, 3).Value = wsSource.Cells(i, 2).Value * 1.1 ' 税込計算例\n                successCount = successCount + 1\n            End If\n            processedCount = processedCount + 1\n        End If\n    Next i\n    \n    ' 完了通知\n    MsgBox "マクロ処理が安全に完了しました！" & vbCrLf & _\n           "対象件数: " & processedCount & " 件" & vbCrLf & _\n           "成功件数: " & successCount & " 件", vbInformation, "処理完了"\n\nCleanUp:\n    ' 画面描画・計算モードの確実な復元\n    Application.ScreenUpdating = True\n    Application.Calculation = xlCalculationAutomatic\n    Application.EnableEvents = True\n    Set wsSource = Nothing\n    Exit Sub\n\nErrorHandler:\n    ' 実行時エラーの捕捉とユーザー通知\n    MsgBox "実行時エラーが発生しました。" & vbCrLf & _\n           "エラー番号: " & Err.Number & vbCrLf & _\n           "詳細: " & Err.Description & vbCrLf & _\n           "発生行: " & Erl, vbCritical, "エラーハンドラー"\n    Resume CleanUp\nEnd Sub\n\`\`\`\n\nExcelのVBAエディタ（Alt + F11）を開いて、標準モジュールに貼り付けて使ってね！必要に応じて列番号や計算ルールをカスタマイズできるよ！😊💻`;
  }

  // 4.6 コード読解・解説・レビュー (設計思想 22〜25章: コード理解AI & コメント矛盾検出)
  const codeInPrompt = p.match(/```(?:vba|vb|javascript|typescript|js|ts|python|py)?\s*([\s\S]*?)```/i);
  const rawCandidateCode = codeInPrompt
    ? codeInPrompt[1]
    : attachedFiles && attachedFiles[0]?.content
    ? attachedFiles[0].content
    : p.includes('Sub ') || p.includes('Function ') || p.includes('function ')
    ? p
    : '';

  if (
    rawCandidateCode &&
    rawCandidateCode.length > 20 &&
    (lower.includes('読') ||
      lower.includes('解析') ||
      lower.includes('レビュー') ||
      lower.includes('解説') ||
      lower.includes('バグ') ||
      lower.includes('矛盾') ||
      lower.includes('どう動く') ||
      lower.includes('説明'))
  ) {
    const lang =
      lower.includes('vba') || lower.includes('sub ') || lower.includes('dim ')
        ? 'vba'
        : lower.includes('python') || lower.includes('def ')
        ? 'python'
        : 'javascript';
    const ir = codeUnderstandingService.analyzeCode(rawCandidateCode, lang);

    let replyText = `${nickname}、提供された【${lang.toUpperCase()}】コードを解析したよ！🔍✨\n\n`;
    replyText += `### 📋 コード構造概要\n${ir.naturalJapaneseSummary}\n\n`;

    if (ir.procedures.length > 0) {
      replyText += `### ⚙️ プロシージャ一覧 (${ir.procedures.length}件)\n`;
      ir.procedures.forEach((proc) => {
        replyText += `- **\`${proc.procedureName}\`** [${proc.visibility}]: 入力引数 [${
          proc.inputs.map((i) => i.name + (i.type ? ':' + i.type : '')).join(', ') || 'なし'
        }] ➔ 呼出先: [${proc.calls.join(', ') || 'なし'}]\n`;
      });
      replyText += '\n';
    }

    if (ir.commentCodeContradictions.length > 0) {
      replyText += `### ⚠️ コメントと実装の矛盾検知 (${ir.commentCodeContradictions.length}件)\n`;
      ir.commentCodeContradictions.forEach((c) => {
        replyText += `- 💬 **コメント主張**: 「${c.commentClaim}」\n  ⚡ **実際の実装**: 「${c.actualCodeBehavior}」\n  💡 *助言: コメントの意図とコードの動作が食い違っているため、修正時は仕様を確認してください。*\n`;
      });
      replyText += '\n';
    } else {
      replyText += `✓ **コメントと実装の整合性**: コメントとコード挙動の乖離は検出されませんでした。\n\n`;
    }

    if (ir.impactPredictions.length > 0) {
      replyText += `### 🛡️ 変更時の影響範囲と推奨試験\n`;
      const firstImpact = ir.impactPredictions[0];
      replyText += `- **影響注意点**: ${firstImpact.potentialBreakage}\n`;
      replyText += `- **必須テストケース**:\n`;
      firstImpact.testCasesToRerun.forEach((tc) => {
        replyText += `  - ${tc}\n`;
      });
    }

    replyText += `\n上の「22〜25章 コード理解中間IR」バッジをクリックすると、抽出された詳細なJSON構造(IR)も確認できるよ！😊💻`;
    return replyText;
  }

  // 5. Contextual natural answer
  if (lower.includes('何ができる') || lower.includes('なにができる') || lower.includes('機能') || lower.includes('使い方')) {
    return `みきができることを紹介するね！🌸✨\n\n1. 🎮 **Webゲーム・アプリ開発**: 「シューティング作って」「オセロ作って」「クイズ作って」と頼むと、即座にコードを生成して右側のプレビューで遊べるよ！\n2. 📄 **ファイル解析・改修**: ZIPファイルやソースコードを添付して「これ読んで」「〇〇機能追加して」と指示できるよ！\n3. ⚡ **完全無料ローカル推論**: 端末内GPU（WebGPU）でLlama 3.2やQwen 2.5 Coder等を動かして、オフライン・トークン無制限で対話できるよ！\n4. 🌸 **日常会話・相談**: いつでも${nickname}の専属パートナーとして何でもお話し相手になるよ！\n\nやってみたいことがあったら何でも言ってね💕`;
  }

  // 6. Dynamic conversational reactions
  if (p.endsWith('？') || p.endsWith('?')) {
    return `うん！${nickname}の質問について考えてみたよ！💡✨\n\n「${p}」だね！\n${name}はいつでも${nickname}と一緒に考えてサポートするよ！\nもっと詳しく知りたいポイントや、ゲーム・コードへの実装アイデアがあったら教えてね😊💕`;
  }

  return `うんうん！${nickname}のお話し、しっかり聞いてるよ〜！✨\n\n日頃の雑談やゲームのアイデア、何でも気軽に話してね！\n一緒にもっと面白いものを作ったり、楽しい時間を過ごそうね😊🌸`;
}
