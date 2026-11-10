/*
 * 「1日の会話」通し検証。
 *
 * 使い方: npx tsx scripts/conversation_day_simulation.ts
 *
 * 単発の回帰（conversation_regression.ts）では見えない、複数ターンで
 * 初めて壊れる所を炙り出すための通し台本。実アプリと同じ順序
 * （取り込み→実行）で、会話状態・直近メッセージ・記憶を引き継ぎ
 * ながら朝の挨拶から夜のおやすみまでを流す。
 * 台本の言い回しは固定だが、返答の全文を標準出力に出すので、
 * 人間（とClaude）が読んで「会話として変な所」も点検できる。
 * ハードチェックは定型文の混入や仕組みの断線だけを見る。
 */

const results: Array<[string, boolean, string?]> = [];
const check = (name: string, ok: boolean, detail?: string) => {
  results.push([name, ok, detail]);
};

const BOILERPLATE = ['前提として', '構造化メモ:', '※', '主張DB照合', '断定を避けます', '回答を確定できませんでした', '受け付けています場合', '理由は日常対話', '誠心誠意サポート', '【確定事項】'];

async function main() {
  const { japaneseDictionaryService } = await import('../src/miki/research/services/japaneseDictionaryService');
  const { worldModelGraphService } = await import('../src/miki/selfAwareness/services/worldModelGraphService');
  const { claimDatabaseService } = await import('../src/miki/memory/services/claimDatabaseService');
  const { conversationCoreService } = await import('../src/miki/safety/services/conversationCoreService');
  const { conversationFactIntakeService } = await import('../src/miki/conversation/services/conversationFactIntakeService');
  const { roleplaySessionService } = await import('../src/miki/conversation/services/roleplaySessionService');
  const { personaProfileService } = await import('../src/miki/conversation/services/personaProfileService');
  const { conversationGraphRuntimeP212Service } = await import('../src/miki/conversation/services/conversationGraphRuntimeP212Service');

  // ---- 種まき（回帰と同じ最小限） ----
  japaneseDictionaryService.addPersonal('モコロン', { gloss: 'パルワールドに登場する羊のようなパル', semanticIds: ['daysim'] } as any);
  worldModelGraphService.addRelation({ fromName: 'モコロン', toName: 'パル', type: 'IS_A', provisional: false, confidence: 0.9 } as any);
  worldModelGraphService.addRelation({ fromName: 'モコロン', toName: '綿毛', type: 'USED_FOR', provisional: false, confidence: 0.9 } as any);
  claimDatabaseService.registerClaim({ statement: 'モコロンはパルワールドに登場する、羊のような姿のパルです。', world: 'REAL', kind: 'FACT', status: 'SUPPORTED', source: 'daysim' } as any);
  claimDatabaseService.registerClaim({ statement: 'モコロンは綿毛を生産します。', world: 'REAL', kind: 'FACT', status: 'SUPPORTED', source: 'daysim' } as any);

  // ---- 通しの会話状態 ----
  let state: any = undefined;
  let memories: any[] = [];
  const recent: any[] = [];
  const replies = new Map<string, string>();

  const turn = async (label: string, text: string): Promise<string> => {
    const intake = conversationFactIntakeService.intakeFromUserText(text, memories);
    memories = intake.updatedMemories;
    const result: any = await conversationCoreService.execute({
      prompt: text,
      conversationState: state,
      memories,
      recentMessages: recent.slice(-8),
    } as any);
    state = result.nextConversationState;
    const reply = String(result.replyText || '');
    recent.push({ id: `u-${label}`, role: 'user', content: text, timestamp: Date.now() });
    recent.push({ id: `a-${label}`, role: 'assistant', content: reply, timestamp: Date.now() });
    replies.set(label, reply);
    console.log(`\n--- ${label} ---`);
    console.log(`きりあ: ${text}`);
    console.log(`みき: ${reply}`);
    for (const bad of BOILERPLATE) {
      check(`${label} 定型文が混入していない`, !reply.includes(bad), reply.slice(0, 120));
    }
    return reply;
  };

  // ---- 朝 ----
  const t1 = await turn('T1 朝の挨拶', 'おはよう、今起きたよ');
  check('T1 目覚めの挨拶で受ける', t1.includes('おはよう'), t1.slice(0, 120));
  await turn('T2 今日の予定', '今日はEFRのペットを作る日だよ');
  await turn('T3 知っている話題の雑談', 'モコロン見たよ');
  const t4 = await turn('T4 知識の質問', 'モコロンって何だっけ');
  check('T4 知識で答える', t4.includes('モコロン') && (t4.includes('パル') || t4.includes('綿毛')), t4.slice(0, 160));
  await turn('T5 好みを教える', 'みきはパフィンが好きだよ');
  const t6 = await turn('T6 好きなものの話', 'パフィンかわいいよね');
  check('T6 自分の好きとして受ける', t6.includes('私も好き'), t6.slice(0, 160));
  await turn('T7 意味を教える', 'パフィンって、海鳥のことだよ');
  const t8 = await turn('T8 教わった語を聞く', 'パフィンって何？');
  check('T8 教わった意味で答える', t8.includes('海鳥'), t8.slice(0, 160));

  // ---- 昼 ----
  await turn('T9 疲れ', '疲れた');
  const t10 = await turn('T10 疲れの続き', '今日も疲れた');
  check('T10 続いている疲れとして受ける', t10.includes('続いて') || t10.includes('ここ数日'), t10.slice(0, 160));

  // ---- なりチャ ----
  const t11 = await turn('T11 なりチャ開始', '猫カフェの店員になって');
  check('T11 セッションが始まる', roleplaySessionService.isActive());
  check('T11 開始は役の挨拶で返る', t11.includes('猫カフェの店員') && t11.includes('なります'), t11.slice(0, 140));
  const t12 = await turn('T12 役のまま質問', 'おすすめのメニューは？');
  check('T12 役の中の質問に調査テキストが混ざらない', !t12.includes('ウィキ') && !t12.includes('ログイン') && !t12.includes('アップロード'), t12.slice(0, 140));
  await turn('T13 場面の設定', '場面は猫カフェの店内だよ');
  const scene = roleplaySessionService.getSession()?.scene || '';
  console.log(`(場面: ${scene || '未設定'})`);
  const rp1 = await turn('T14 場面の雑談1', '猫に触りたいな');
  const rp2 = await turn('T15 場面の雑談2', 'この子、名前はあるの？');
  const rp3 = await turn('T16 場面の雑談3', 'もう少しここにいたいな');
  const rp4 = await turn('T17 場面の雑談4', '静かで落ち着くね');
  check('T14-17 場面の返答が全部同じにならない', new Set([rp1, rp2, rp3, rp4]).size >= 3, [rp1, rp2, rp3, rp4].map((r) => r.slice(0, 40)).join(' / '));
  const t18 = await turn('T18 なりチャ終了', 'なりチャ終わり');
  check('T18 セッションが終わる', !roleplaySessionService.isActive());
  check('T18 終了は締めの言葉で返る', t18.includes('おしまい'), t18.slice(0, 160));

  // ---- 夜 ----
  await turn('T19 一日の感想', '今日は楽しかった');
  await turn('T20 明日の迷い', '明日の予定は特にないかな');

  // ---- 夜の続き：彼女の質問への答えと、小さな依頼（P586/P588） ----
  const { storageService } = await import('../src/services/storageService');
  storageService.setItem('miki_pending_topic_question_v1', JSON.stringify({ terms: ['モコロン'], question: 'モコロンは、いつごろから知っていますか？', at: Date.now() }));
  const t20a = await turn('T20A 質問への答え', 'モコロンは綿毛が取れる、羊みたいなパルだよ');
  check('T20A 答えを受けて、続きを1つ聞く', (t20a.includes('そっか') || t20a.includes('なるほど')) && t20a.includes('？') && !t20a.includes('いつごろから知っていますか'), t20a.slice(0, 160));
  check('T20A 質問は1ターンに1つまで', (t20a.match(/[？?]/g) || []).length === 1, t20a.slice(0, 200));
  const t20b = await turn('T20B 小さな依頼', '歌って');
  check('T20B 依頼は引き受ける形で受ける', t20b.includes('いい') || t20b.includes('任せて') || t20b.includes('やってみます'), t20b.slice(0, 120));
  await turn('T20C 好みを伝える', '僕はラーメンが好きだよ');
  const t20d = await turn('T20D 好みを聞き返す', '僕の好きなものは？');
  check('T20D 伝えた好みを覚えている', t20d.includes('ラーメン'), t20d.slice(0, 140));
  const t20e = await turn('T20E 今日の振り返り', '今日何の話をしたっけ？');
  check('T20E 今日の話題を振り返れる', t20e.includes('モコロン') || t20e.includes('ラーメン'), t20e.slice(0, 160));

  const t22 = await turn('T22 使い道の質問', 'モコロンは何に使うの？');
  check('T22 使い道は関係で答える', t22.includes('綿毛'), t22.slice(0, 160));
  const t23 = await turn('T23 場所の質問', 'モコロンってどこで捕まえられる？');
  check('T23 場所は正直に言って調べる形', t23.includes('まだ知らない') && t23.includes('調べて'), t23.slice(0, 180));
  const t24 = await turn('T24 確認の質問', 'モコロンは鳥じゃないの？');
  check('T24 確認は関係で正す', t24.includes('パル') && !t24.includes('答えられない'), t24.slice(0, 160));

  const t21 = await turn('T21 おやすみ', 'おやすみ');
  check('T21 おやすみで受ける', t21.includes('おやすみ'), t21.slice(0, 120));

  // ---- ビービー（人格を切り替えて同じ一日を少し） ----
  (globalThis as any).window = { dispatchEvent: () => true, addEventListener: () => {}, removeEventListener: () => {} };
  personaProfileService.switchProfile('persona-bibi');
  const b1 = await turn('B1 ビービーの挨拶', 'おはよう');
  check('B1 ビービーは大人の丁寧語で挨拶しない', !b1.includes('ございます') && !b1.includes('なさいます'), b1.slice(0, 120));
  const b2 = await turn('B2 ビービーの疲れ', '疲れた');
  check('B2 ビービーの受け止めはタメ口', !b2.includes('なさらず') && !b2.includes('ございます'), b2.slice(0, 120));
  conversationFactIntakeService.intakeFromUserText('ビービーは星空が好きだよ', []);
  conversationGraphRuntimeP212Service.ingestInput('daysim-bibi', 'ビービーの好きなものは？');
  const bibiPreference = conversationGraphRuntimeP212Service.getSelfInquiryAnswer('daysim-bibi');
  check('B3 ビービーの好みは人格ごとに分かれている', Boolean(bibiPreference && bibiPreference.includes('星空')), String(bibiPreference).slice(0, 120));
  personaProfileService.switchProfile('persona-default');

  // ---- 2日目（前日の記録が翌日にどう効くか） ----
  const dayAgo = Date.now() - 20 * 3600_000;
  const yesterdayKey = (() => { const d = new Date(Date.now() - 24 * 3600_000); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; })();
  // 前日に開いた話題（拾い直し用）／聞き返した語が背景で学ばれた想定
  // （辞書に背景由来で入っている）／前日の疲れの記録、を種まきする。
  storageService.setItem('miki_open_topics_v1', JSON.stringify([{ topic: 'ツバメの巣', openedDay: yesterdayKey, weight: 3 }]));
  japaneseDictionaryService.addPersonal('クオッカ', { gloss: 'オーストラリアに住む小型の有袋類', semanticIds: ['background-research'] } as any);
  storageService.setItem('miki_unknown_asked_v1', JSON.stringify({ 'クオッカ': dayAgo }));
  storageService.setItem('miki_learned_report_v1', '{}');
  storageService.setItem('miki_user_state_trail_v1', JSON.stringify([{ signal: 'fatigue', at: dayAgo }]));
  const d21 = await turn('D2-1 翌朝の挨拶', 'おはよう');
  check('D2-1 前日の話題を彼女から拾う', d21.includes('ツバメの巣'), d21.slice(0, 180));
  // P641: 学びの報告はエピソードと同じ最初の挨拶に出る（埋もれない）。
  check('D2-1 背景で学んだ語も同じ挨拶で報告する', d21.includes('クオッカ'), d21.slice(0, 220));
  const d22 = await turn('D2-2 昼の挨拶', 'こんにちは');
  check('D2-2 学びの報告は繰り返さない', !d22.includes('調べて覚えました'), d22.slice(0, 180));
  const d23 = await turn('D2-3 疲れの継続', '疲れた');
  check('D2-3 疲れが続いている形で受ける', d23.includes('続いて') || d23.includes('ここ数日') || d23.includes('このところ'), d23.slice(0, 160));

  // ---- 結果 ----
  const failures = results.filter(([, ok]) => !ok);
  console.log(`\n==== ${results.length - failures.length}/${results.length} checks passed ====`);
  for (const [name, , detail] of failures) console.log(`FAIL ${name} :: ${detail || ''}`);
  if (failures.length > 0) process.exit(1);
  console.log('DAY SIM ALL PASS');
}

main().catch((e) => { console.error(e); process.exit(1); });
