/**
 * 【重要】本スクリプトは、静的コードレビュー環境において非LLM指示語解決ロジック (resolveAnaphora)
 * の健全性を確認するためのシミュレーションデータスクリプトです。実機端末での実測ログではありません。
 */
import {
  resolveAnaphora,
  extractConversationState,
  defaultConversationState,
} from '../src/services/conversationStateService';
import { ConversationState } from '../src/types';

interface TurnScenario {
  turn: number;
  userInput: string;
  simulatedLlmResponse: string;
  description: string;
}

// 20ターンにわたるシミュレーション対話シナリオ (意図的な不一致ケース含む)
const scenarios: TurnScenario[] = [
  {
    turn: 1,
    userInput: 'TypeScriptのユーティリティ型について教えて',
    simulatedLlmResponse: '<state>{"t":"TypeScriptのユーティリティ型","g":"ユーティリティ型の理解"}</state>TypeScriptにはPickやOmitなど便利な型があります。',
    description: '初期トピック開始（指示語なし）',
  },
  {
    turn: 2,
    userInput: 'それの具体的なコード例を見せて',
    simulatedLlmResponse: '<state>{"t":"TypeScriptのユーティリティ型","g":"具体例の提示"}</state>例えばPick<User, "id" | "name">のように使います。',
    description: '指示語「それ」の一意解決',
  },
  {
    turn: 3,
    userInput: 'ReactのuseEffectとuseCallbackも関係ある？',
    simulatedLlmResponse: '<state>{"t":"Reactフック","g":"関係性の確認"}</state>これらはReactのコンポーネントレンダリングを制御するフックです。',
    description: '新エンティティ（Reactフック）の導入',
  },
  {
    turn: 4,
    userInput: 'さっきのユーティリティ型と組み合わせて使える？',
    simulatedLlmResponse: '<state>{"t":"TypeScriptのユーティリティ型","g":"組み合わせ適用"}</state>はい、フックのPropsや引数の型定義で活躍します。',
    description: '指示語「さっきの」による過去エンティティの参照',
  },
  {
    turn: 5,
    userInput: 'PostgreSQLとSQLiteのどちらを使うか迷ってる',
    simulatedLlmResponse: '<state>{"t":"データベース選定","g":"DB選定の比較"}</state>用途によって向いている環境が異なります。',
    description: '比較表現「どちら」を含む質問',
  },
  {
    turn: 6,
    userInput: '軽量アプリならどっちがおすすめ？',
    simulatedLlmResponse: '<state>{"t":"SQLite","g":"軽量環境での選定"}</state>セットアップ不要で単一ファイルで動くSQLiteが最適です。',
    description: '指示語「どっち」による選択肢比較',
  },
  {
    turn: 7,
    userInput: 'これのマイグレーション方法を教えて',
    simulatedLlmResponse: '<state>{"t":"SQLite","g":"マイグレーション手順"}</state>Drizzle ORMやPrismaなどを使うとスムーズに管理できます。',
    description: '指示語「これ」の一意解決',
  },
  {
    turn: 8,
    userInput: 'Drizzle ORMについてもっと詳しく！',
    simulatedLlmResponse: '<state>{"t":"Drizzle ORM","g":"Drizzle詳細解説"}</state>SQLライクで型安全性が高い次世代ORMです。',
    description: '新トピック（Drizzle ORM）',
  },
  {
    turn: 9,
    userInput: '前のやつと比べて何がいいの？',
    simulatedLlmResponse: '<state>{"t":"Drizzle ORM","g":"比較とメリット"}</state>Prismaよりもバンドルサイズが小さく、オーバーヘッドが極小です。',
    description: '指示語「前のやつ」による直前参照',
  },
  {
    turn: 10,
    userInput: 'おはよう！今日もよろしくね',
    simulatedLlmResponse: '<state>{"t":"挨拶","g":"親愛対話"}</state>おはよう！今日も一緒に頑張ろうね！',
    description: '日常挨拶（指示語なし）',
  },
  {
    turn: 11,
    userInput: '昨日のDrizzle ORMのスキーマ定義を復習したい',
    simulatedLlmResponse: '<state>{"t":"Drizzle ORM","g":"スキーマ定義の復習"}</state>sqliteTable関数を使ってテーブルを定義します。',
    description: '明示的トピック再開',
  },
  {
    turn: 12,
    userInput: 'あれはどう書くんだっけ？外部キーのやつ',
    simulatedLlmResponse: '<state>{"t":"Drizzle ORM","g":"外部キー参照記法"}</state>references(() => users.id)のように指定します。',
    description: '指示語「あれ」による参照',
  },
  {
    turn: 13,
    userInput: 'DockerとPodmanどっちが便利？',
    simulatedLlmResponse: '<state>{"t":"コンテナ技術選定","g":"Docker vs Podman比較"}</state>デーモンレスならPodman、エコシステムならDockerです。',
    description: '比較表現「どっち」を含む質問',
  },
  {
    turn: 14,
    userInput: 'どちらか選ぶならどっち？',
    simulatedLlmResponse: '<state>{"t":"Docker","g":"最終推奨"}</state>初学者や情報量を重視するならDockerをおすすめします。',
    description: '指示語「どちら」「どっち」の複合',
  },
  {
    turn: 15,
    userInput: 'これのインストール手順を教えて',
    simulatedLlmResponse: '<state>{"t":"Docker","g":"インストール手順"}</state>公式サイトからDocker Desktopを導入できます。',
    description: '指示語「これ」による参照',
  },
  {
    turn: 16,
    userInput: 'さっきのエラーログを見てほしい',
    simulatedLlmResponse: '<state>{"t":"エラー解析","g":"ログトラブルシューティング"}</state>ログを貼り付けてもらえればすぐに確認します！',
    description: '指示語「さっきの」＋新概念（エラーログ）',
  },
  {
    turn: 17,
    userInput: 'ポート3000が競合してるって出た',
    simulatedLlmResponse: '<state>{"t":"ポート3000競合","g":"ポート競合解消"}</state>kill-port 3000 または lsof -i :3000 でプロセスを終了できます。',
    description: 'エラー詳細（指示語なし）',
  },
  {
    turn: 18,
    userInput: 'それを実行したら直った！ありがとう',
    simulatedLlmResponse: '<state>{"t":"ポート3000競合","g":"解決・完了"}</state>よかった！無事に動いて安心したよ。',
    description: '指示語「それ」による解決手順参照',
  },
  {
    turn: 19,
    userInput: 'ViteとNext.js、今回の個人開発にはどっちがいいかな？',
    simulatedLlmResponse: '<state>{"t":"フレームワーク選定","g":"Vite vs Next.js"}</state>SPA単体で軽快に動かしたいならViteが圧倒的に快適です。',
    description: '比較表現「どっち」',
  },
  {
    turn: 20,
    userInput: 'さっきのやつでプロジェクト作ろう！',
    // 意図的な不一致テストケース: 非LLMは「フレームワーク選定」と解決するが、
    // LLMが文脈を読み飛ばして全く無関係なトピック「天気と雑談」を出力したシミュレーション
    simulatedLlmResponse: '<state>{"t":"天気と雑談","g":"プロジェクト作成開始"}</state>了解！npm create vite@latest でサクッと始めよう！',
    description: '意図的不一致テスト: 指示語「さっきの」に対してLLMが逸脱トピックを出力',
  },
];

async function runShadowComparison() {
  console.log('================================================================');
  console.log('📊 フェーズ1: 非LLM決定的指示語解決 (resolveAnaphora) シャドー比較集計');
  console.log('   ※本出力はシミュレーションデータによるロジック健全性検証です');
  console.log('================================================================\n');

  let state: ConversationState = defaultConversationState();
  let anaphoraTurnsCount = 0;
  let matchesCount = 0;
  let ambiguousCount = 0;
  let divergedCount = 0;
  let unresolvedCount = 0;

  const comparisonRows: Array<{
    turn: number;
    input: string;
    detected: string | null;
    nonLlmResolved: string | null;
    confidence: string;
    llmTopic: string;
    eval: 'MATCH' | 'DIVERGED' | 'AMBIGUOUS' | 'UNRESOLVED' | 'NO_ANAPHORA';
  }> = [];

  for (const s of scenarios) {
    // 1. ユーザー入力直後・LLM呼び出し前の非LLM純粋関数実行
    const shadowResult = resolveAnaphora(s.userInput, state);

    // 2. LLMの応答パース (会話状態の更新)
    const { state: nextState } = extractConversationState(s.simulatedLlmResponse, state, {
      userPrompt: s.userInput,
    });

    let evalStatus: 'MATCH' | 'DIVERGED' | 'AMBIGUOUS' | 'UNRESOLVED' | 'NO_ANAPHORA' = 'NO_ANAPHORA';

    if (shadowResult.detectedExpression) {
      anaphoraTurnsCount++;
      if (shadowResult.confidence === 'unique' && shadowResult.resolved) {
        // LLMの話題トピック、または次ステートのエンティティと一致しているか
        const matchLlm =
          nextState.currentTopic.includes(shadowResult.resolved) ||
          shadowResult.resolved.includes(nextState.currentTopic);
        if (matchLlm) {
          matchesCount++;
          evalStatus = 'MATCH';
        } else {
          // 不一致を正直に DIVERGED として判定
          divergedCount++;
          evalStatus = 'DIVERGED';
        }
      } else if (shadowResult.confidence === 'ambiguous') {
        ambiguousCount++;
        evalStatus = 'AMBIGUOUS';
      } else {
        unresolvedCount++;
        evalStatus = 'UNRESOLVED';
      }
    }

    comparisonRows.push({
      turn: s.turn,
      input: s.userInput,
      detected: shadowResult.detectedExpression,
      nonLlmResolved: shadowResult.resolved || (shadowResult.candidates.length ? `[${shadowResult.candidates.join(', ')}]` : '-'),
      confidence: shadowResult.confidence,
      llmTopic: nextState.currentTopic,
      eval: evalStatus,
    });

    state = nextState;
  }

  // ログ出力
  console.log('| Turn | 入力スニペット | 指示語検知 | 非LLM解決結果 (candidates) | 確信度 | LLM申告topic | 評価判定 |');
  console.log('|------|----------------|------------|----------------------------|--------|--------------|----------|');
  for (const r of comparisonRows) {
    const inp = r.input.length > 20 ? r.input.slice(0, 19) + '…' : r.input;
    const res = r.nonLlmResolved && r.nonLlmResolved.length > 24 ? r.nonLlmResolved.slice(0, 23) + '…' : r.nonLlmResolved;
    console.log(
      `| ${String(r.turn).padStart(4)} | ${inp.padEnd(14)} | ${(r.detected || '-').padEnd(10)} | ${(res || '-').padEnd(26)} | ${r.confidence.padEnd(10)} | ${r.llmTopic.padEnd(12)} | ${r.eval} |`
    );
  }

  const evaluatedCount = matchesCount + divergedCount;
  const matchRate = evaluatedCount > 0 ? Math.round((matchesCount / evaluatedCount) * 100) : 0;
  const coverageRate = anaphoraTurnsCount > 0 ? Math.round(((matchesCount + ambiguousCount) / anaphoraTurnsCount) * 100) : 0;

  console.log('\n================================================================');
  console.log('📈 【シミュレーション比較集計結果 (全20ターン)】');
  console.log(`・総対話ターン数: ${scenarios.length} ターン`);
  console.log(`・指示語・省略表現検知ターン数: ${anaphoraTurnsCount} ターン`);
  console.log(`  - 一意解決一致 (MATCH): ${matchesCount} 件`);
  console.log(`  - 不一致・乖離 (DIVERGED): ${divergedCount} 件 (意図的テストケース検知)`);
  console.log(`  - 曖昧・選択肢提示 (AMBIGUOUS): ${ambiguousCount} 件 (※設計書4.2節に準拠し聞き返し対象)`);
  console.log(`  - 未解決 (UNRESOLVED): ${unresolvedCount} 件`);
  console.log(`・一意解決一致率 (Match Rate): ${matchRate}% (${matchesCount} / ${evaluatedCount})`);
  console.log(`・指示語カバー率 (Coverage Rate: MATCH + AMBIGUOUS): ${coverageRate}%`);
  console.log('================================================================');
}

runShadowComparison();
