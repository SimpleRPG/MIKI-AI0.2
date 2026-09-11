import { workflowSynthesisService } from '../src/services/workflowSynthesisService';
import { codeSkeletonService } from '../src/services/codeSkeletonService';
import { codeVerificationService } from '../src/services/codeVerificationService';

async function runWorkflowSynthesisTests() {
  console.log('================================================================');
  console.log('🧪 フェーズ5: 自然言語ワークフロー合成エンジン (WorkflowSynthesisEngine) テスト');
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

  // ── 1. 単発会話 vs 複合ワークフロー要求の判定 (shouldSynthesizeWorkflow) ──
  console.log('【1. ワークフロー合成要求検知 (shouldSynthesizeWorkflow)】');
  const simplePrompt = 'こんにちは！今日の天気を教えて';
  const workflowPrompt = 'まず最新の公式仕様をWebで調査して、既存のExcel VBAマクロを修正して、最後に静的構文検査と安全性検証を行って出力して';

  const shouldNotSynth = workflowSynthesisService.shouldSynthesizeWorkflow(simplePrompt);
  const shouldSynth = workflowSynthesisService.shouldSynthesizeWorkflow(workflowPrompt);

  console.log(`  単発入力: "${simplePrompt}" ➔ shouldSynthesize=${shouldNotSynth}`);
  assert('単発の会話入力でワークフロー合成がトリガーされないこと', shouldNotSynth === false);

  console.log(`  多段複合指示: "${workflowPrompt.slice(0, 35)}..." ➔ shouldSynthesize=${shouldSynth}`);
  assert('多段複合指示でワークフロー合成が正常にトリガーされること', shouldSynth === true);

  // ── 1b. 誤トリガー（False Positive）防止 回帰テストスイート（最低15件） ──
  console.log('\n【1b. 誤トリガー(False Positive)防止 回帰テスト (日常会話・単発質問・境界文字数)】');
  const falsePositiveSamples: { text: string; category: string; len: number }[] = [
    { text: 'こんにちは！今日の東京の天気を教えていただけますか？傘は必要でしょうか？', category: '雑談・天気', len: 37 },
    { text: 'ReactのuseEffectとuseCallbackの違いについて初心者向けに分かりやすく教えて', category: '単発技術質問', len: 42 },
    { text: 'TypeScriptでユニオン型から特定の型を抽出する方法ってどう書けばいいの？', category: '単発コード質問', len: 39 },
    { text: '昨日のサッカーの試合結果はどうだった？ハイライトの要約を聞きたいな', category: '雑談・ニュース', len: 34 },
    { text: 'カレーライスの美味しい作り方と隠し味のスパイスを教えてください', category: '日常会話・料理', len: 32 },
    { text: 'ポート3000が既に使用されていますというエラーが出て困っています', category: 'エラー相談', len: 33 },
    { text: 'Pythonのリスト内包表記の基本的な書き方と使用例をいくつか教えて', category: '単発コード質問', len: 34 },
    { text: 'Gitのコミットメッセージを直前の一つだけ修正したい時のコマンドは何？', category: '単発コマンド質問', len: 36 },
    { text: 'SQLのINNER JOINとLEFT JOINの違いを図解っぽく説明してほしい', category: '概念比較質問', len: 38 },
    { text: '最近おすすめのSF映画やアニメがあれば3つほど紹介してくれますか？', category: '雑談・推薦', len: 34 },
    { text: 'Dockerコンテナをバックグラウンドで起動するためのコマンドオプションは何？', category: '単発ツール質問', len: 39 },
    { text: 'VBAでActiveSheetのA1セルの値をメッセージボックスに表示したい', category: '単発VBA質問', len: 37 },
    { text: 'Webサイトのパフォーマンスを改善するための一般的な施策を箇条書きで教えて', category: 'Web単発質問', len: 37 },
    { text: '明日の朝9時にアラームを設定したいんだけど、どうすればいいかな？', category: '日常生活質問', len: 33 },
    { text: 'コードの可読性を高めるための変数名の付け方のベストプラクティスを教えて', category: '設計単発質問', len: 36 },
    { text: 'こんにちは！今日も一日お仕事頑張りましょうね！', category: '境界文字数(25字付近)', len: 24 },
    { text: 'Reactでカウンターコンポーネントを作る基本の書き方は？', category: '境界文字数(28字)', len: 28 },
    { text: 'Webサイトで調べたエラーなんだけど、このコードの理由を教えて', category: 'Web・調べ・コード含む質問', len: 31 },
  ];

  let fpCount = 0;
  for (const sample of falsePositiveSamples) {
    const isFp = workflowSynthesisService.shouldSynthesizeWorkflow(sample.text);
    if (isFp) {
      fpCount++;
      console.error(`  ❌ 誤トリガー検知: [${sample.category}] "${sample.text}" (len=${sample.len})`);
    } else {
      console.log(`  ✓ 正常拒絶: [${sample.category}] (len=${sample.len}) "${sample.text.slice(0, 24)}..." ➔ false`);
    }
    assert(`誤判定なし: [${sample.category}] がfalseを返すこと`, isFp === false);
  }
  console.log(`  誤トリガー防止テスト完了: ${falsePositiveSamples.length - fpCount}/${falsePositiveSamples.length} 件 正常拒絶`);

  // ── 2. ワークフロー合成 (synthesizeWorkflow) とDAG/ステップ構成の検証 ──
  console.log('\n【2. 複合指示からのDAG/パイプライン合成 (synthesizeWorkflow)】');
  const wf = workflowSynthesisService.synthesizeWorkflow(workflowPrompt);
  console.log(`  ワークフローID: ${wf.workflowId}`);
  console.log(`  総ステップ数: ${wf.steps.length}`);
  console.log(`  予算見積もり: 所要時間=${wf.budgetEstimate.estimatedDurationMs}ms, トークン=${wf.budgetEstimate.estimatedTokens}, リスク=${wf.budgetEstimate.riskLevel}`);

  assert('ワークフローが生成され steps が 4件以上あること', wf.steps.length >= 4);
  assert('予算見積もりが計算されていること', wf.budgetEstimate.estimatedTokens > 0 && wf.budgetEstimate.estimatedDurationMs > 0);

  const stepNames = wf.steps.map((s) => s.name);
  console.log(`  合成ステップ一覧: [${stepNames.join(' ➔ ')}]`);
  assert('外部調査ステップが含まれること', stepNames.some((n) => n.includes('Web情報調査')));
  assert('コード骨格(Code Skeleton)ステップが含まれること', stepNames.some((n) => n.includes('コード骨格')));
  assert('静的構文検査ステップが含まれること', stepNames.some((n) => n.includes('静的構文検査')));

  // ── 3. パイプライン結合実行 (executeAllSteps) と権限同意ゲート検証 ──
  console.log('\n【3. パイプライン結合実行 (executeAllSteps) と安全同意ゲート】');
  
  // まず未同意状態での実行テスト (設計思想 46章 & 47章: 権限のないプラグインは自動昇格せず中断)
  console.log('  [テストA] 未同意状態での実行 ➔ 権限同意ゲートによる安全な中断を確認');
  const initialExecution = await workflowSynthesisService.executeAllSteps(wf.workflowId);
  const webStep = initialExecution?.steps.find((s) => s.pluginId === 'plugin_web_search');
  console.log(`    Step 1 結果: requiresConsent=${webStep?.requiresConsent}, status=${webStep?.status}, result=${webStep?.resultExcerpt}`);
  assert('未同意プラグインを含むステップで権限同意要求が発生し中断すること', webStep?.status === 'ready' || webStep?.resultExcerpt?.includes('同意'));

  // 次にユーザーによる明示的な権限承認 (grantConsentAndActivate) をシミュレート
  console.log('\n  [テストB] ユーザーが明示的に権限を承認 (grantConsentAndActivate)');
  const { capabilityPluginService } = await import('../src/services/capabilityPluginService');
  capabilityPluginService.grantConsentAndActivate('plugin_web_search', ['network_cloud', 'sensitive_filter'], 'テスト用明示承認');
  
  // 承認後のフルパイプライン自律実行
  console.log('  [テストC] 承認後のフルパイプライン再開・完遂');
  const executedWf = await workflowSynthesisService.executeAllSteps(wf.workflowId, (progress) => {
    const completedCount = progress.steps.filter((s) => s.status === 'completed').length;
    console.log(`    [進行状況] ${completedCount} / ${progress.steps.length} 完了`);
  });

  assert('全ステップが実行されワークフローが completed になること', executedWf?.status === 'completed');

  for (const s of executedWf?.steps || []) {
    console.log(`      Step ${s.stepNumber} [${s.name}]: status=${s.status}, excerpt=${s.resultExcerpt?.slice(0, 45)}...`);
    assert(`ステップ「${s.name}」が completed で成果物抜粋が存在すること`, s.status === 'completed' && !!s.resultExcerpt);
  }

  // ── 4. コード骨格・検証エンジンの単体健全性確認 ──
  console.log('\n【4. コード骨格および静的検証サービスの直接健全性】');
  const templates = codeSkeletonService.getAllTemplates();
  console.log(`  登録済み骨格テンプレート数: ${templates.length}件`);
  assert('コード骨格テンプレートが取得できること', templates.length >= 2);

  const sampleVba = 'Option Explicit\nSub TestMacro()\n  Dim ws As Worksheet\n  Set ws = ThisWorkbook.Sheets("Sheet1")\nEnd Sub';
  const verif = codeVerificationService.verifyCode(`\`\`\`vba\n${sampleVba}\n\`\`\``);
  console.log(`  VBA静的検査結果: safetyLevel=${verif.safetyLevel}, score=${verif.safetyScore}, errors=${verif.syntaxErrors.length}`);
  assert('VBA静的検査が正常にパスすること', verif.syntaxValid && verif.safetyLevel === 'PASS_SAFE');

  console.log(`\n================================================================`);
  console.log(`📊 テスト結果: ${passed} / ${total} 通過 (${Math.round((passed / total) * 100)}%)`);
  console.log('================================================================');

  if (passed !== total) {
    process.exit(1);
  }
  process.exit(0);
}

runWorkflowSynthesisTests();
