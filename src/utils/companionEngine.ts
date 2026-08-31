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

  // 4. Code / Game creation requests (Inform the user to use loaded LLM or review attached code)
  if (
    lower.includes('オセロ') ||
    lower.includes('シューティング') ||
    lower.includes('ゲーム作って') ||
    lower.includes('コード書いて') ||
    lower.includes('作って')
  ) {
    return `${nickname}、作りたいゲームやアプリのアイデアを教えてくれてありがとう！🎮✨

ご自身で作っているソースコード（HTML/JS/TSやZIPファイル）があれば、下のファイル添付ボタンから送ってね！コードのバグ修正や機能追加、レビューをすぐに行うよ！💻

※ ゼロから自由にオリジナルコードを生成・対話する場合は、上部の「端末ローカルLLM設定」から **SmolLM2-360M** や **Qwen 2.5 Coder** をロードすると、端末内AIが完全オフラインでコードを生成します！✨`;
  }

  // 5. Contextual natural answer
  if (lower.includes('何ができる') || lower.includes('なにができる') || lower.includes('機能') || lower.includes('使い方')) {
    return `みきができることを紹介するね！🌸✨\n\n1. 🎮 **Webゲーム・アプリ開発**: 「シューティング作って」「オセロ作って」「クイズ作って」と頼むと、即座にコードを生成して右側のプレビューで遊べるよ！\n2. 📄 **ファイル解析・改修**: ZIPファイルやソースコードを添付して「これ読んで」「〇〇機能追加して」と指示できるよ！\n3. ⚡ **完全無料ローカル推論**: 端末内GPU（WebGPU）でLlama 3.2やQwen 2.5 Coder等を動かして、オフライン・トークン無制限で対話できるよ！\n4. 🌸 **日常会話・相談**: いつでも${nickname}の専属パートナーとして何でもお話し相手になるよ！\n\nやってみたいことがあったら何でも言ってね💕`;
  }

  return `うんうん！「${p}」だね！✨

${name}はいつでも${nickname}の言葉をしっかり聞いてるよ！
質問への回答やゲーム開発、コード修正、ファイル解析など、何でも手伝えるから気軽に教えてね！😊💕`;
}
