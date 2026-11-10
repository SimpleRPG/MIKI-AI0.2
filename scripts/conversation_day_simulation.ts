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
  await turn('T11 なりチャ開始', '猫カフェの店員になって');
  check('T11 セッションが始まる', roleplaySessionService.isActive());
  await turn('T12 役のまま質問', 'おすすめのメニューは？');
  await turn('T13 場面の設定', '場面は猫カフェの店内だよ');
  const scene = roleplaySessionService.getSession()?.scene || '';
  console.log(`(場面: ${scene || '未設定'})`);
  const rp1 = await turn('T14 場面の雑談1', '猫に触りたいな');
  const rp2 = await turn('T15 場面の雑談2', 'この子、名前はあるの？');
  const rp3 = await turn('T16 場面の雑談3', 'もう少しここにいたいな');
  const rp4 = await turn('T17 場面の雑談4', '静かで落ち着くね');
  check('T14-17 場面の返答が全部同じにならない', new Set([rp1, rp2, rp3, rp4]).size >= 3, [rp1, rp2, rp3, rp4].map((r) => r.slice(0, 40)).join(' / '));
  await turn('T18 なりチャ終了', 'なりチャ終わり');
  check('T18 セッションが終わる', !roleplaySessionService.isActive());

  // ---- 夜 ----
  await turn('T19 一日の感想', '今日は楽しかった');
  await turn('T20 明日の迷い', '明日の予定は特にないかな');
  const t21 = await turn('T21 おやすみ', 'おやすみ');
  check('T21 おやすみで受ける', t21.includes('おやすみ'), t21.slice(0, 120));

  // ---- 結果 ----
  const failures = results.filter(([, ok]) => !ok);
  console.log(`\n==== ${results.length - failures.length}/${results.length} checks passed ====`);
  for (const [name, , detail] of failures) console.log(`FAIL ${name} :: ${detail || ''}`);
  if (failures.length > 0) process.exit(1);
  console.log('DAY SIM ALL PASS');
}

main().catch((e) => { console.error(e); process.exit(1); });
