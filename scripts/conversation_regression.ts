/*
* P534: 会話の回帰テスト（常設）。
*
* 使い方: npm run test:conversation
*
* 彼女の会話まわりの仕組み（P483〜P533で入れた接続）が、後の変更で
* 静かに切れていないかを、決まったシナリオで確認する。実機の代わり
* にはならないが、プッシュ前の事故を減らすための網。
* シナリオは「初期状態＋最小の種まき」で再現できるものだけを置く。
* 失敗したら、その番号の仕組みが切れている。
*/

const results: Array<[string, boolean, string?]> = [];
const check = (name: string, ok: boolean, detail?: string) => {
results.push([name, ok, detail]);
};

async function main() {
const { japaneseDictionaryService} = await import('../src/miki/research/services/japaneseDictionaryService');
const { worldModelGraphService} = await import('../src/miki/selfAwareness/services/worldModelGraphService');
const { claimDatabaseService} = await import('../src/miki/memory/services/claimDatabaseService');
const { paragraphCompositionService} = await import('../src/miki/conversation/services/paragraphCompositionService');
const { conversationCoreService} = await import('../src/miki/safety/services/conversationCoreService');
const { answerContentIrService} = await import('../src/miki/conversation/services/answerContentIrService');
const { surfaceVariationGrowthService} = await import('../src/miki/conversation/services/surfaceVariationGrowthService');
const { conversationFactIntakeService} = await import('../src/miki/conversation/services/conversationFactIntakeService');
const { conversationGraphRuntimeP212Service} = await import('../src/miki/conversation/services/conversationGraphRuntimeP212Service');
const { roleplaySessionService} = await import('../src/miki/conversation/services/roleplaySessionService');
const { classifyDialogueAct } = await import('../src/miki/conversation/services/conversationStateService');

// ---- 種まき（最小限） ----
japaneseDictionaryService.addPersonal('モコロン', { gloss: 'パルワールドに登場する羊のようなパル', semanticIds: ['regression']} as any);
worldModelGraphService.addRelation({ fromName: 'モコロン', toName: 'パル', type: 'IS_A', provisional: false, confidence: 0.9} as any);
worldModelGraphService.addRelation({ fromName: 'モコロン', toName: '綿毛', type: 'USED_FOR', provisional: false, confidence: 0.9} as any);
worldModelGraphService.addRelation({ fromName: '羊', toName: '動物', type: 'IS_A', provisional: false, confidence: 0.9} as any);
worldModelGraphService.addRelation({ fromName: '羊', toName: '毛', type: 'USED_FOR', provisional: false, confidence: 0.9} as any);
worldModelGraphService.addRelation({ fromName: '羊', toName: '群れ', type: 'PART_OF', provisional: false, confidence: 0.8} as any);
claimDatabaseService.registerClaim({ statement: 'モコロンはパルワールドに登場する、羊のような姿のパルです。', world: 'REAL', kind: 'FACT', status: 'SUPPORTED', source: 'regression'} as any);
claimDatabaseService.registerClaim({ statement: 'モコロンは綿毛を生産します。', world: 'REAL', kind: 'FACT', status: 'SUPPORTED', source: 'regression'} as any);
claimDatabaseService.registerClaim({ statement: '教室は窓から光が差し込む、静かな場所です。', world: 'REAL', kind: 'FACT', status: 'SUPPORTED', source: 'regression'} as any);

// ---- 単体 ----
const m = claimDatabaseService.findBestMatchingClaim('モコロンについて教えて');
check('P527 区切り無し文でClaim照合', m.hasMatch, JSON.stringify({ hasMatch: m.hasMatch}));
check('P527 無関係な文は照合しない',!claimDatabaseService.findBestMatchingClaim('あおえうかきくけこ').hasMatch);

const sup1 = paragraphCompositionService.buildSupplements({ subjectTerms: ['モコロン'], supportingClaims: [], excludeText: ''});
check('P528 類推が段落に入る', sup1.some((s) => s.includes('似ています')), JSON.stringify(sup1));
const sup2 = paragraphCompositionService.buildSupplements({ subjectTerms: ['モコロン'], supportingClaims: [], excludeText: ''});
check('P529 新しさで顔ぶれが変わる', sup2[0]!== sup1[0], `1st=${JSON.stringify(sup1)} 2nd=${JSON.stringify(sup2)}`);

const tq = paragraphCompositionService.buildTopicQuestion(['モコロン']);
check('P532 話題の質問を組み立てる', Boolean(tq && tq.includes('モコロン') && tq.includes('か？')), String(tq));

const irQ: any = answerContentIrService.buildAnswerIR({ conclusion: 'そうですね。', target: '日常対話', certainty: 'CERTAIN', detailLevel: 'BRIEF', unknownTerms: ['ズンドコ']});
irQ.strategy = 'ASK_QUESTION';
const surfQ = answerContentIrService.generateSurfaceTextFromIR(irQ, 'GENERAL_ANSWER', undefined).surfaceText;
check('P519 未知語を聞き返す', surfQ.includes('「ズンドコ」という言葉はまだ覚えていません'), surfQ.slice(0, 160));

const irT: any = answerContentIrService.buildAnswerIR({ conclusion: 'そうですね。', target: '日常対話', certainty: 'CERTAIN', detailLevel: 'BRIEF'});
irT.strategy = 'ASK_QUESTION';
irT.topic_question = tq;
const surfT = answerContentIrService.generateSurfaceTextFromIR(irT, 'GENERAL_ANSWER', undefined).surfaceText;
check('P532 話題の質問が表層に出る', Boolean(tq && surfT.includes(tq)), surfT.slice(0, 160));

const badVariant = surfaceVariationGrowthService.verifyCandidate(
'適切なフェーズで、上記のステップをご検討ください。',
'適切なフェーズで、上記のステップをご検討くださいだよ！',
);
check('P533 文体混在の変種を落とす',!badVariant.passed, badVariant.rejectionReason);
const goodVariant = surfaceVariationGrowthService.verifyCandidate(
'適切なフェーズで、上記のステップをご検討ください。',
'適切なフェーズで、上記のステップをご検討くださいませ。',
);
check('P533 丁寧な変種は通す', goodVariant.passed, goodVariant.rejectionReason);

check('P535 陳述文はSTATEMENT', classifyDialogueAct('今日はモコロンを捕まえてすごく嬉しい') === 'STATEMENT', classifyDialogueAct('今日はモコロンを捕まえてすごく嬉しい'));
check('P535 過去形の報告は依頼でない', classifyDialogueAct('散歩してきた') === 'STATEMENT', classifyDialogueAct('散歩してきた'));
check('P535 質問はQUESTIONのまま', classifyDialogueAct('モコロンって何？') === 'QUESTION', classifyDialogueAct('モコロンって何？'));
check('P535 依頼の形はREQUEST', classifyDialogueAct('モコロンについて調べてください') === 'REQUEST', classifyDialogueAct('モコロンについて調べてください'));
check('P535 挨拶はCASUAL_CHATのまま', classifyDialogueAct('おはよう') === 'CASUAL_CHAT', classifyDialogueAct('おはよう'));

// ---- 会話の流れ（コア経由） ----
const greet = await conversationCoreService.execute({ prompt: 'おはよう'} as any);
const gText = String((greet as any).replyText || '');
check('挨拶に段落は付かない',!gText.includes('モコロンはパルの一種です'), gText.slice(0, 120));

await conversationCoreService.execute({ prompt: '疲れた'} as any);
const tired2 = await conversationCoreService.execute({ prompt: '今日も疲れた'} as any);
const tText = String((tired2 as any).replyText || '');
check('P524 疲れの継続に気づく', tText.includes('ここ数日'), tText.slice(0, 160));

const casual = await conversationCoreService.execute({ prompt: '今日はモコロンを捕まえてすごく嬉しい'} as any);
const cText = String((casual as any).replyText || '');
check('P521/P525 雑談に反応＋段落', cText.includes('モコロン') && (cText.includes('パルの一種です') || cText.includes('似ています') || cText.includes('綿毛を生産します')), cText.slice(0, 200));

const cute = await conversationCoreService.execute({ prompt: 'モコロン可愛いよね'} as any);
const cuText = String((cute as any).replyText || '');
check('P531 可愛い（漢字）に反応する', cuText.includes('モコロン') &&!cuText.includes('話してくれてありがとう'), cuText.slice(0, 160));

// ---- 取り込み・想起 ----
conversationFactIntakeService.intakeFromUserText('ホニャララって、伝説の鳥のことだよ', []);
check('P518 教わった意味を覚える', japaneseDictionaryService.has('ホニャララ'));

conversationGraphRuntimeP212Service.ingestInput('regression-p520', 'EFRの鍵はどうする？');
const aspect = conversationGraphRuntimeP212Service.getSelfInquiryAnswer('regression-p520');
check('P520 決め事の側面質問に答える', Boolean(aspect && aspect.includes('鍵')), String(aspect).slice(0, 160));

// ---- なりチャ ----
const role = roleplaySessionService.saveRole({ name: '先生', stance: '教師', world: '教室', toneHint: '', userRole: ''} as any);
roleplaySessionService.startSession(role, 'persona-default');
const texture = paragraphCompositionService.sceneTextureSuffix('今日は生徒がよく頑張っていた');
check('P530 学んだ描写が地の文になる', Boolean(texture && texture.includes('光が差し込む')), String(texture));
const beat1 = paragraphCompositionService.sceneProgressionSuffix();
const beat2 = paragraphCompositionService.sceneProgressionSuffix();
const beat3 = paragraphCompositionService.sceneProgressionSuffix();
check('P536 場面は3歩に1回進む', beat1 === undefined && beat2 === undefined && Boolean(beat3 && beat3.includes('チャイム')), JSON.stringify([beat1, beat2, beat3]));
conversationFactIntakeService.intakeFromUserText('今日は掛け算の練習をした', []);
conversationFactIntakeService.intakeFromUserText('生徒と九九の練習もした', []);
roleplaySessionService.endSession();
const saved = roleplaySessionService.listRoles().find((r) => r.roleId === role.roleId);
check('P523 あらすじが自動で残る', Boolean(saved?.lastSummary && saved.lastSummary.includes('練習')), String(saved?.lastSummary));

// ---- 結果 ----
let fail = 0;
for (const [name, ok, detail] of results) {
console.log(`${ok? 'PASS': 'FAIL'} ${name}${ok? '': ':: ' + (detail || '')}`);
if (!ok) fail++;
}
console.log(fail === 0? `ALL PASS (${results.length} scenarios)`: `${fail} FAILURES / ${results.length} scenarios`);
process.exit(fail === 0? 0: 1);
}

main().catch((e) => {
console.error('ERROR', e);
process.exit(1);
});
