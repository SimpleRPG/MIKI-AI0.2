import { resolveAnaphora, defaultConversationState } from '../src/services/conversationStateService';
import { ConversationState } from '../src/types';

function runAnaphoraUnitTests() {
  console.log('================================================================');
  console.log('🧪 フェーズ1: 指示語・省略表現決定的解決 (resolveAnaphora) 単体テスト');
  console.log('================================================================\n');

  let passed = 0;
  let total = 0;

  function assert(title: string, condition: boolean, detail?: string) {
    total++;
    if (condition) {
      passed++;
      console.log(`✅ [PASS] ${title}`);
    } else {
      console.error(`❌ [FAIL] ${title} ${detail ? `(${detail})` : ''}`);
    }
  }

  // ── パターン1: 一意解決 (unique) ──
  console.log('【パターン1: 一意解決 (unique)】');
  {
    const state: ConversationState = {
      ...defaultConversationState(),
      currentTopic: 'TypeScriptの型定義',
      recentEntities: ['TypeScriptの型定義'],
    };

    const res1 = resolveAnaphora('それについてもっと詳しく教えて', state);
    assert(
      '「それ」が単一のトピック/エンティティに一意解決されること',
      res1.confidence === 'unique' && res1.resolved === 'TypeScriptの型定義' && res1.detectedExpression === 'それ',
      JSON.stringify(res1)
    );

    const res2 = resolveAnaphora('さっきのコードを見せて', {
      ...state,
      recentEntities: ['Vueコンポーネント', 'Reactフック'],
    });
    assert(
      '「さっきの」が直近のエンティティ(Reactフック)に一意解決されること',
      res2.confidence === 'unique' && res2.resolved === 'Reactフック' && res2.detectedExpression === 'さっきの',
      JSON.stringify(res2)
    );

    const res3 = resolveAnaphora('前のやつを実行してみて', {
      ...state,
      recentEntities: ['SQLクエリ', 'Expressサーバー'],
    });
    assert(
      '「前のやつ」が直近のエンティティ(Expressサーバー)に一意解決されること',
      res3.confidence === 'unique' && res3.resolved === 'Expressサーバー' && res3.detectedExpression === '前のやつ',
      JSON.stringify(res3)
    );
  }

  // ── パターン2: 曖昧・複数候補 (ambiguous) ──
  console.log('\n【パターン2: 曖昧・複数候補 (ambiguous)】');
  {
    const state: ConversationState = {
      ...defaultConversationState(),
      currentTopic: 'データベース選定',
      recentEntities: ['PostgreSQL', 'SQLite', 'Firestore'],
    };

    const res1 = resolveAnaphora('あれを使いたいんだけどどう思う？', state);
    assert(
      '複数エンティティが存在する場合に「あれ」が ambiguous と判定され選択肢候補が抽出されること',
      res1.confidence === 'ambiguous' && res1.resolved === null && res1.candidates.length >= 2,
      JSON.stringify(res1)
    );

    const res2 = resolveAnaphora('PostgreSQLとSQLiteどっちがいい？', state);
    assert(
      '「AとBどっち」の発言内比較で ambiguous 判定となり、両者が候補になること',
      res2.confidence === 'ambiguous' && res2.candidates.includes('PostgreSQL') && res2.candidates.includes('SQLite'),
      JSON.stringify(res2)
    );

    const res3 = resolveAnaphora('どっちがおすすめ？', state);
    assert(
      '直前候補が複数ある状態での「どっち」が ambiguous 判定になること',
      res3.confidence === 'ambiguous' && res3.candidates.length === 2,
      JSON.stringify(res3)
    );
  }

  // ── パターン3: 該当なし (unresolved) ──
  console.log('\n【パターン3: 該当なし (unresolved)】');
  {
    const emptyState = defaultConversationState();

    const res1 = resolveAnaphora('こんにちは！元気？', emptyState);
    assert(
      '指示語を含まない通常発言では unresolved (detectedExpression: null) となること',
      res1.confidence === 'unresolved' && res1.detectedExpression === null && res1.resolved === null,
      JSON.stringify(res1)
    );

    const res2 = resolveAnaphora('それ教えて', emptyState);
    assert(
      '指示語はあるが会話履歴・エンティティが空の場合、unresolved となること',
      res2.confidence === 'unresolved' && res2.detectedExpression === 'それ' && res2.resolved === null,
      JSON.stringify(res2)
    );

    const res3 = resolveAnaphora('どちらがいいですか？', emptyState);
    assert(
      '比較対象のない状態での「どちら」は unresolved となること',
      res3.confidence === 'unresolved' && res3.detectedExpression === 'どちら' && res3.resolved === null,
      JSON.stringify(res3)
    );
  }

  console.log(`\n================================================================`);
  console.log(`📊 テスト結果: ${passed} / ${total} 通過 (${Math.round((passed / total) * 100)}%)`);
  console.log(`================================================================`);

  if (passed !== total) {
    process.exit(1);
  }
}

runAnaphoraUnitTests();
