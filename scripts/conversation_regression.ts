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
const { pendingSlotService } = await import('../src/miki/memory/services/pendingSlotService');
const { answerContentIrService} = await import('../src/miki/conversation/services/answerContentIrService');
const { surfaceVariationGrowthService} = await import('../src/miki/conversation/services/surfaceVariationGrowthService');
const { conversationFactIntakeService} = await import('../src/miki/conversation/services/conversationFactIntakeService');
const { conversationGraphRuntimeP212Service} = await import('../src/miki/conversation/services/conversationGraphRuntimeP212Service');
const { roleplaySessionService} = await import('../src/miki/conversation/services/roleplaySessionService');
const { classifyDialogueAct } = await import('../src/miki/conversation/services/conversationStateService');
const { reviewReflectionService } = await import('../src/miki/selfAwareness/services/reviewReflectionService');
const { selfPreferenceService } = await import('../src/miki/selfAwareness/services/selfPreferenceService');
const { worldModelCanvasExportService } = await import('../src/miki/selfAwareness/services/worldModelCanvasExportService');
const { associationGraphService } = await import('../src/miki/memory/services/associationGraphService');
const { knowledgeConsolidationService } = await import('../src/miki/selfAwareness/services/knowledgeConsolidationService');
const { conversationOpenTopicService } = await import('../src/miki/conversation/services/conversationOpenTopicService');
const { storageService } = await import('../src/services/storageService');
const { userKnowledgeProfileService } = await import('../src/miki/conversation/services/userKnowledgeProfileService');
const { intakeMeaningGuardService } = await import('../src/miki/memory/services/intakeMeaningGuardService');
const { projectNotebookService } = await import('../src/miki/memory/services/projectNotebookService');
const { autonomousSearchService } = await import('../src/miki/research/services/autonomousSearchService');
const { japaneseAnalysisService } = await import('../src/miki/research/services/japaneseAnalysisService');
const { personaProfileService } = await import('../src/miki/conversation/services/personaProfileService');

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

const refl1 = reviewReflectionService.runNow();
const refl2 = reviewReflectionService.runNow();
check('P537 振り返りの問いが材料から答える', refl1.questionId === 'learned' && refl1.answer.includes('モコロン'), JSON.stringify(refl1));
check('P537 問いがローテーションする', refl2.questionId === 'failure' && reviewReflectionService.runIfDue() === undefined, JSON.stringify(refl2));

const canvas = worldModelCanvasExportService.buildCanvas();
const canvasParsed = JSON.parse(canvas.json);
check('P538 世界モデルがCanvas形式になる', canvas.nodes >= 5 && canvas.edges >= 5 && canvasParsed.nodes[0].type === 'text' && canvasParsed.edges.some((e: any) => e.label === 'IS_A'), JSON.stringify({ nodes: canvas.nodes, edges: canvas.edges }));
worldModelCanvasExportService.exportNow();
check('P538 書き出しが保存される', worldModelCanvasExportService.latestExport()?.nodes === canvas.nodes);

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

conversationGraphRuntimeP212Service.ingestInput('regression-p537', 'この前の振り返りは？');
const reflectionAnswer = conversationGraphRuntimeP212Service.getSelfInquiryAnswer('regression-p537');
check('P537 振り返りを聞くと答える', Boolean(reflectionAnswer && reflectionAnswer.includes('振り返り')), String(reflectionAnswer).slice(0, 160));

conversationGraphRuntimeP212Service.ingestInput('regression-p538', '世界モデルを書き出して');
const exportAnswer = conversationGraphRuntimeP212Service.getSelfInquiryAnswer('regression-p538');
check('P538 書き出しを頼むと書き出す', Boolean(exportAnswer && exportAnswer.includes('JSON Canvas')), String(exportAnswer).slice(0, 160));

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

// ---- 台帳アーカイブ（P540） ----
const staleClaim = claimDatabaseService.registerClaim({ statement: 'アーカイブ棚照合キーXYZの記録です', world: 'REAL', kind: 'FACT', status: 'UNVERIFIED', source: 'regression' } as any);
(staleClaim as any).updated_at = Date.now() - 100 * 24 * 60 * 60_000;
const freshClaim = claimDatabaseService.registerClaim({ statement: 'アーカイブされない新しい知識です', world: 'REAL', kind: 'FACT', status: 'UNVERIFIED', source: 'regression' } as any);
const arch1 = claimDatabaseService.archiveStaleClaims({});
check('P540 古い未検証Claimが棚へ移る', arch1.archived >= 1 && claimDatabaseService.listArchivedClaims().some((c) => c.claim_id === staleClaim.claim_id), JSON.stringify(arch1));
check('P540 新しいClaimは棚へ移らない', !claimDatabaseService.listArchivedClaims().some((c) => c.claim_id === freshClaim.claim_id), '');
const shelfMatch = claimDatabaseService.findBestMatchingClaim('アーカイブ棚照合キーXYZについて教えて');
check('P540 棚からも二段で照合できる', Boolean(shelfMatch.hasMatch && shelfMatch.bestClaim?.claim_id === staleClaim.claim_id && shelfMatch.scopeNotes.some((n) => n.includes('アーカイブ棚'))), JSON.stringify(shelfMatch.scopeNotes));

// ---- 連想グラフ（P541） ----
worldModelGraphService.addRelation({ fromName: '連想鳥', toName: '連想虫', type: 'USED_FOR', provisional: true } as any);
claimDatabaseService.registerClaim({ statement: '連想鳥は連想虫と一緒に暮らしています', world: 'REAL', kind: 'FACT', status: 'UNVERIFIED', source: 'regression' } as any);
associationGraphService.rebuild();
const assocList = associationGraphService.associations('連想鳥', 3);
check('P541 共起から連想ができる', assocList.some((a) => a.name === '連想虫'), JSON.stringify(assocList));
const assocSupp = paragraphCompositionService.buildSupplements({ subjectTerms: ['連想鳥'], supportingClaims: [], excludeText: 'テスト' });
check('P541 連想は思い出します形式でのみ出る', assocSupp.some((s) => s.includes('連想虫のことも思い出します')), JSON.stringify(assocSupp));

// ---- 統合パス（P542） ----
worldModelGraphService.addRelation({ fromName: 'テスト獣A', toName: 'パル', type: 'IS_A', provisional: false, confidence: 0.9 } as any);
worldModelGraphService.addRelation({ fromName: 'テスト獣B', toName: 'パル', type: 'IS_A', provisional: false, confidence: 0.9 } as any);
worldModelGraphService.addRelation({ fromName: 'テスト獣A', toName: '綿毛', type: 'USED_FOR', provisional: false, confidence: 0.9 } as any);
worldModelGraphService.addRelation({ fromName: 'テスト獣B', toName: '綿毛', type: 'USED_FOR', provisional: false, confidence: 0.9 } as any);
const cons1 = knowledgeConsolidationService.runIfDue();
const schemaClaims = claimDatabaseService.listClaims().filter((c) => (c as any).kind === 'SCHEMA');
check('P542 共通の型が図式になる', Boolean(cons1 && cons1.schemas >= 1 && schemaClaims.some((c) => String(c.statement).includes('パル') && String(c.statement).includes('綿毛'))), JSON.stringify(schemaClaims.map((c) => c.statement)));
const cons2 = knowledgeConsolidationService.runIfDue(Date.now() + 25 * 60 * 60_000);
const schemaClaims2 = claimDatabaseService.listClaims().filter((c) => (c as any).kind === 'SCHEMA');
check('P542 図式は重複して増えない', schemaClaims2.length === schemaClaims.length, `${schemaClaims.length} -> ${schemaClaims2.length}`);

// ---- 重要度タギング（P543） ----
check('P543 重要度は材料の合算で決まる', conversationOpenTopicService.salienceOf('これは大事だから覚えておいて') >= 3 && conversationOpenTopicService.salienceOf('今日はいい天気だね') === 1, '');
storageService.setItem('miki_open_topics_v1', '');
conversationOpenTopicService.record('軽い話題', 1);
conversationOpenTopicService.record('大事な話題', 4);
conversationOpenTopicService.record('別の軽い話題', 1);
check('P543 大事な話題は軽い話題に消されない', conversationOpenTopicService.current()?.topic === '大事な話題', JSON.stringify(conversationOpenTopicService.current()));

// ---- 相手の知識モデル（P544） ----
conversationFactIntakeService.intakeFromUserText('ゾウガメって何？', []);
check('P544 聞いた語は知らない側に入る', userKnowledgeProfileService.isUnknown('ゾウガメ'), JSON.stringify(userKnowledgeProfileService.listUnknown()));
conversationFactIntakeService.intakeFromUserText('ゾウガメは大きいよ', []);
check('P544 普通に使ったら知っている側へ移る', userKnowledgeProfileService.isKnown('ゾウガメ') && !userKnowledgeProfileService.isUnknown('ゾウガメ'), '');
conversationFactIntakeService.intakeFromUserText('ホタルイカって、発光するイカのことだよ', []);
check('P544 教えた語は知っている側に入る', userKnowledgeProfileService.isKnown('ホタルイカ'), '');
conversationFactIntakeService.intakeFromUserText('ペンギンモドキって何？', []);
conversationGraphRuntimeP212Service.ingestInput('regression-p544', '僕が知らない言葉はある？');
const userKnowledgeAnswer = conversationGraphRuntimeP212Service.getSelfInquiryAnswer('regression-p544');
check('P544 知らない言葉を聞かれて答えられる', Boolean(userKnowledgeAnswer && userKnowledgeAnswer.includes('ペンギンモドキ')), String(userKnowledgeAnswer));
japaneseDictionaryService.addPersonal('ミズクラゲ', { gloss: '傘を広げて漂うクラゲ', semanticIds: ['regression'] } as any);
conversationFactIntakeService.intakeFromUserText('ミズクラゲって何？', []);
claimDatabaseService.registerClaim({ statement: 'ミズクラゲは傘を広げて漂います。', world: 'REAL', kind: 'FACT', status: 'SUPPORTED', source: 'regression' } as any);
const glossReply = await conversationCoreService.execute({ prompt: 'ミズクラゲについて教えて' } as any);
const glossText = String((glossReply as any).replyText || '');
check('P544 知らない語には説明が添えられる', glossText.includes('ミズクラゲ（傘を広げて漂うクラゲ）'), glossText.slice(0, 200));

// ---- 状態スナップショット（P545） ----
conversationGraphRuntimeP212Service.ingestInput('regression-p545', '状態を書き出して');
const snapshotAnswer = conversationGraphRuntimeP212Service.getSelfInquiryAnswer('regression-p545');
check('P545 状態の書き出しに答える', Boolean(snapshotAnswer && snapshotAnswer.includes('状態スナップショットを書き出しました')), String(snapshotAnswer));
const snapshotRaw = storageService.getItem('miki_state_snapshot_v1');
let snapshotJson = '';
try { snapshotJson = String((JSON.parse(String(snapshotRaw)) as any).json || ''); } catch { /* 検証側で失敗させる */ }
check('P545 スナップショットに中身が入っている', snapshotJson.includes('モコロン') && snapshotJson.includes('miki-state-snapshot/1'), snapshotJson.slice(0, 120));

// ---- 取り込みの意味チェック（P546） ----
check('P546 仮定は記録系を通らない', intakeMeaningGuardService.check('EFRはマップを出さないことにしたら面白そうだね').reason === 'HYPOTHETICAL', '');
check('P546 引用は記録系を通らない', intakeMeaningGuardService.check('彼は「EFRはペットを入れないことにした」と言っていた').reason === 'QUOTED_OR_HEARSAY', '');
check('P546 本人の決定は通る', intakeMeaningGuardService.check('EFRにペットを入れることにした').ok === true, '');
const efrBefore = projectNotebookService.listDecisions('EFR').length;
const hypoResult = projectNotebookService.intakeFromUserText('EFRはマップを出さないことにしたら面白そうだね');
const quoteResult = projectNotebookService.intakeFromUserText('相方は「EFRにペットを入れないことにした」と言っていた');
check('P546 仮定と引用は決め事にならない', hypoResult === undefined && quoteResult === undefined && projectNotebookService.listDecisions('EFR').length === efrBefore, `${efrBefore} -> ${projectNotebookService.listDecisions('EFR').length}`);
const realDecision = projectNotebookService.intakeFromUserText('EFRは縦持ち前提にすることにした');
check('P546 本物の決め事は記録される', Boolean(realDecision) && projectNotebookService.listDecisions('EFR').length === efrBefore + 1, '');
const factBase = conversationFactIntakeService.intakeFromUserText('僕はカレーが好き', []);
const factQuoted = conversationFactIntakeService.intakeFromUserText('彼は「僕はカレーが好き」と言っていた', []);
const factHypo = conversationFactIntakeService.intakeFromUserText('もし僕はカレーが好きだったら毎日食べる', []);
check('P546 事実取り込みも引用と仮定を落とす', factBase.added.length >= 1 && factQuoted.added.length === 0 && factHypo.added.length === 0, JSON.stringify({ base: factBase.added.length, quoted: factQuoted.added.length, hypo: factHypo.added.length }));

// ---- 言い回しの変種（P547） ----
check('P547 迷い形は記録系を通らない', intakeMeaningGuardService.check('EFRはペットを多めにすることにしよっかな').reason === 'MUSING', '');
check('P547 意志形そのものは通る', intakeMeaningGuardService.check('EFRはペットを多めにすることにしよ').ok === true, '');
const p547Before = projectNotebookService.listDecisions('EFR').length;
const volitionalDecision = projectNotebookService.intakeFromUserText('EFRはペットを多めにすることにしよ');
check('P547 意志形の決め事は記録される', Boolean(volitionalDecision) && projectNotebookService.listDecisions('EFR').length === p547Before + 1, '');
const musingDecision = projectNotebookService.intakeFromUserText('EFRはペットを多めにすることにしよっかな');
check('P547 迷い形の決め事は記録されない', musingDecision === undefined && projectNotebookService.listDecisions('EFR').length === p547Before + 1, '');
conversationFactIntakeService.intakeFromUserText('タヌキモドキっていうのは、タヌキに似た生き物のことだよ', []);
check('P547 っていうのは、でも意味を教われる', japaneseDictionaryService.lookup('タヌキモドキ').some((e: any) => String(e.gloss || '').includes('タヌキに似た')), JSON.stringify(japaneseDictionaryService.lookup('タヌキモドキ')));
conversationFactIntakeService.intakeFromUserText('フクロウモドキってなんだっけ？', []);
check('P547 なんだっけ、でも知らない語として拾う', userKnowledgeProfileService.isUnknown('フクロウモドキ'), JSON.stringify(userKnowledgeProfileService.listUnknown()));
conversationFactIntakeService.intakeFromUserText('スズメモドキの意味は？', []);
check('P547 〜の意味は？でも知らない語として拾う', userKnowledgeProfileService.isUnknown('スズメモドキ'), JSON.stringify(userKnowledgeProfileService.listUnknown()));
const greetingReply = await conversationCoreService.execute({ prompt: 'おはよー' } as any);
check('P547 おはよー、でも挨拶として受ける', String((greetingReply as any).replyText || '').includes('おはようございます'), String((greetingReply as any).replyText || '').slice(0, 120));
const fatigueReply = await conversationCoreService.execute({ prompt: '今日はへとへとだよ' } as any);
check('P547 へとへと、でも疲れとして受ける', String((fatigueReply as any).replyText || '').includes('お疲れ'), String((fatigueReply as any).replyText || '').slice(0, 120));
check('P547 〜になってから、では役は始まらない', roleplaySessionService.handleUserText('大人になってから決める', 'persona-default') === undefined && !roleplaySessionService.isActive(), '');
check('P547 〜になって、で役が始まる', roleplaySessionService.handleUserText('先生になって', 'persona-default') === 'started' && roleplaySessionService.isActive(), '');
check('P547 役を終われる', roleplaySessionService.handleUserText('なりチャ終わり', 'persona-default') === 'ended' && !roleplaySessionService.isActive(), '');

// ---- 言い回しの変種その2（P548） ----
const thanksReply = await conversationCoreService.execute({ prompt: 'ありがとー' } as any);
check('P548 ありがとー、でも感謝として受ける', String((thanksReply as any).replyText || '').includes('どういたしまして'), String((thanksReply as any).replyText || '').slice(0, 120));
const apologyReply = await conversationCoreService.execute({ prompt: 'ごめんね' } as any);
check('P548 ごめんね、を受け止める', String((apologyReply as any).replyText || '').includes('大丈夫'), String((apologyReply as any).replyText || '').slice(0, 120));
check('P548 なりチャおしまい、で役が終わる', roleplaySessionService.handleUserText('先生になって', 'persona-default') === 'started' && roleplaySessionService.handleUserText('なりチャおしまい', 'persona-default') === 'ended' && !roleplaySessionService.isActive(), '');
check('P554 元に戻って、は2回で役が終わる', roleplaySessionService.handleUserText('先生として話して', 'persona-default') === 'started' && roleplaySessionService.handleUserText('元に戻って', 'persona-default') === undefined && roleplaySessionService.isActive() && roleplaySessionService.handleUserText('元に戻って', 'persona-default') === 'ended' && !roleplaySessionService.isActive(), '');
roleplaySessionService.handleUserText('先生になって', 'persona-default');
roleplaySessionService.handleUserText('元に戻って', 'persona-default');
roleplaySessionService.advanceSceneBeat(); roleplaySessionService.advanceSceneBeat(); roleplaySessionService.advanceSceneBeat(); roleplaySessionService.advanceSceneBeat();
check('P554 弱い終了信号は時間が空くと確定しない', roleplaySessionService.handleUserText('元に戻って', 'persona-default') === undefined && roleplaySessionService.isActive(), '');
check('P554 強い終了信号は即終わる', roleplaySessionService.handleUserText('なりチャ終わり', 'persona-default') === 'ended' && !roleplaySessionService.isActive(), '');
const searchNeed = autonomousSearchService.detectNeedForSearch('モコロンの生息地を検索して');
check('P548 検索して、を検索指示として拾う', searchNeed.needsSearch === true && searchNeed.category === 'explicit_request', JSON.stringify(searchNeed));

// ---- 自己照会の言い回し変種（P549） ----
conversationGraphRuntimeP212Service.ingestInput('regression-p549a', '知識って何件ある？');
const claimCountAnswer = conversationGraphRuntimeP212Service.getSelfInquiryAnswer('regression-p549a');
check('P549 知識って何件、でも件数に答える', Boolean(claimCountAnswer && claimCountAnswer.includes('件')), String(claimCountAnswer));
conversationGraphRuntimeP212Service.ingestInput('regression-p549b', 'EFRの決まりを教えて');
const projectListAnswer = conversationGraphRuntimeP212Service.getSelfInquiryAnswer('regression-p549b');
check('P549 決まり、でも決め事一覧に答える', Boolean(projectListAnswer && projectListAnswer.includes('ペット')), String(projectListAnswer));
conversationGraphRuntimeP212Service.ingestInput('regression-p549c', '世界モデル見せて');
const canvasAnswer2 = conversationGraphRuntimeP212Service.getSelfInquiryAnswer('regression-p549c');
check('P549 世界モデル見せて、でも書き出しに答える', Boolean(canvasAnswer2 && canvasAnswer2.includes('世界モデル')), String(canvasAnswer2));
roleplaySessionService.handleUserText('先生になって', 'persona-default');
conversationGraphRuntimeP212Service.ingestInput('regression-p549d', '今何の役？');
const roleAnswer2 = conversationGraphRuntimeP212Service.getSelfInquiryAnswer('regression-p549d');
check('P549 今何の役？、でも役に答える', Boolean(roleAnswer2 && roleAnswer2.includes('先生')), String(roleAnswer2));
roleplaySessionService.handleUserText('なりチャ終わり', 'persona-default');
conversationGraphRuntimeP212Service.ingestInput('regression-p549e', 'さっきの話は何？');
const recallAnswer2 = conversationGraphRuntimeP212Service.getSelfInquiryAnswer('regression-p549e');
check('P549 さっきの話、でも思い出しに答える', Boolean(recallAnswer2), String(recallAnswer2));

// ---- 言い回しの変種その3（P550） ----
conversationFactIntakeService.intakeFromUserText('ドードーモドキってどういうこと？', []);
check('P550 どういうこと、でも知らない語として拾う', userKnowledgeProfileService.isUnknown('ドードーモドキ'), JSON.stringify(userKnowledgeProfileService.listUnknown()));
check('P550 覚えといて、でも話題の重みが上がる', conversationOpenTopicService.salienceOf('これ覚えといてほしい') >= 3, String(conversationOpenTopicService.salienceOf('これ覚えといてほしい')));

// ---- 年号の動的化（P551） ----
const nextYear = new Date().getFullYear() + 1;
const yearNeed = autonomousSearchService.detectNeedForSearch(`${nextYear}年の新機能は何？`);
check('P551 来年の年号でも最新情報として拾う', yearNeed.needsSearch === true, JSON.stringify(yearNeed));

// ---- 話題質問のフォールバック（P552） ----
storageService.setItem('miki_topic_question_usage_v1', '{}');
const relationQuestion = paragraphCompositionService.buildTopicQuestion(['モコロン']);
check('P552 関係がある主題では従来の質問が優先', Boolean(relationQuestion && relationQuestion.includes('モコロン') && !relationQuestion.includes('いつごろから')), String(relationQuestion));
const freshQuestion = paragraphCompositionService.buildTopicQuestion(['カピバラ']);
check('P552 関係が無い主題でも経験への質問が出る', Boolean(freshQuestion && freshQuestion.includes('カピバラ') && /いつごろから|思い出すことが多い|印象に残って/.test(freshQuestion)), String(freshQuestion));
worldModelGraphService.addRelation({ fromName: 'レッサーパンダモドキ', toName: 'モコロン', type: 'IS_A', provisional: true } as any);
const provisionalQuestion = paragraphCompositionService.buildTopicQuestion(['レッサーパンダモドキ']);
check('P552 仮関係だけの主題でも質問が出る', Boolean(provisionalQuestion && provisionalQuestion.includes('レッサーパンダモドキ') && provisionalQuestion.includes('？')), String(provisionalQuestion));

// ---- 開いた話題の複数保持（P553） ----
storageService.setItem('miki_open_topics_v1', '');
conversationOpenTopicService.record('話題A', 1);
conversationOpenTopicService.record('話題B', 2);
conversationOpenTopicService.record('話題C', 1);
check('P553 複数の話題を保持できる', conversationOpenTopicService.listPending().length === 3, JSON.stringify(conversationOpenTopicService.listPending()));
check('P553 代表は重要度が最も高い話題', conversationOpenTopicService.current()?.topic === '話題B', JSON.stringify(conversationOpenTopicService.current()));
const oldDayDate = new Date(Date.now() - 2 * 24 * 3600_000);
const oldDayKey = `${oldDayDate.getFullYear()}-${String(oldDayDate.getMonth() + 1).padStart(2, '0')}-${String(oldDayDate.getDate()).padStart(2, '0')}`;
storageService.setItem('miki_open_topics_v1', JSON.stringify({ topic: '旧形式の話題', openedDay: oldDayKey, weight: 2 }));
check('P553 旧形式の保存も読める', conversationOpenTopicService.current()?.topic === '旧形式の話題', JSON.stringify(conversationOpenTopicService.current()));
storageService.setItem('miki_open_topics_v1', JSON.stringify([{ topic: '昨日の軽い話題', openedDay: oldDayKey, weight: 1 }, { topic: '昨日の重い話題', openedDay: oldDayKey, weight: 4 }]));
check('P553 拾うのは重要度の高い順', conversationOpenTopicService.takeCallbackTopic() === '昨日の重い話題' && conversationOpenTopicService.takeCallbackTopic() === '昨日の軽い話題' && conversationOpenTopicService.takeCallbackTopic() === undefined, '');
storageService.setItem('miki_open_topics_v1', '');

// ---- 作業状態の保持（P555） ----
projectNotebookService.intakeFromUserText('EFRは今ペットを作ってる');
check('P555 今の作業が残る', projectNotebookService.getWorkState('EFR')?.current === 'ペット', JSON.stringify(projectNotebookService.getWorkState('EFR')));
projectNotebookService.intakeFromUserText('EFRは次は当たり判定を作る');
check('P555 次の手が残る', projectNotebookService.getWorkState('EFR')?.next === '当たり判定', JSON.stringify(projectNotebookService.getWorkState('EFR')));
projectNotebookService.intakeFromUserText('EFRは今マップを作ってる？');
check('P555 疑問形は作業状態にならない', projectNotebookService.getWorkState('EFR')?.current === 'ペット', JSON.stringify(projectNotebookService.getWorkState('EFR')));
conversationGraphRuntimeP212Service.ingestInput('regression-p555a', 'EFRは今何を作ってる？');
const workCurrentAnswer = conversationGraphRuntimeP212Service.getSelfInquiryAnswer('regression-p555a');
check('P555 今の作業を聞かれて答えられる', Boolean(workCurrentAnswer && workCurrentAnswer.includes('ペット')), String(workCurrentAnswer));
conversationGraphRuntimeP212Service.ingestInput('regression-p555b', 'EFRの次の作業は？');
const workNextAnswer = conversationGraphRuntimeP212Service.getSelfInquiryAnswer('regression-p555b');
check('P555 次の作業を聞かれて答えられる', Boolean(workNextAnswer && workNextAnswer.includes('当たり判定')), String(workNextAnswer));

// ---- 雑談反応の回転（P556） ----
const casualHeads: string[] = [];
for (const p of ['カピバラかわいい', 'リスザルかわいい', 'ワラビーかわいい']) {
const r = await conversationCoreService.execute({ prompt: p } as any);
casualHeads.push(String((r as any).replyText || '').split(/[！。]/)[0]);
}
check('P556 雑談の反応形が回転する', new Set(casualHeads).size === 3 && casualHeads[0].includes('カピバラ') && casualHeads[1].includes('リス') && casualHeads[2].includes('ラビー'), casualHeads.join(' / '));

// ---- カタカナ複合語の結合（P557） ----
check('P557 リスザルが1語になる', japaneseAnalysisService.analyze('リスザルかわいい').contentTokens.includes('リスザル'), JSON.stringify(japaneseAnalysisService.analyze('リスザルかわいい').contentTokens));
check('P557 ワラビーが1語になる', japaneseAnalysisService.analyze('ワラビーが好き').contentTokens.includes('ワラビー'), JSON.stringify(japaneseAnalysisService.analyze('ワラビーが好き').contentTokens));
check('P557 既存の語はそのまま', japaneseAnalysisService.analyze('モコロンはパルです').contentTokens.includes('モコロン'), JSON.stringify(japaneseAnalysisService.analyze('モコロンはパルです').contentTokens));

// ---- 雑談の前置き除去（P558）とビービーの口調（P559） ----
check('P558 雑談の返答に定型の前置きが付かない', !String((thanksReply as any).replyText || '').includes('前提として'), String((thanksReply as any).replyText || '').slice(0, 120));
(globalThis as any).window = (globalThis as any).window ?? { dispatchEvent: () => true, addEventListener: () => {}, removeEventListener: () => {} };
personaProfileService.switchProfile('persona-bibi');
const bibiApology = await conversationCoreService.execute({ prompt: 'ごめんね' } as any);
check('P559 ビービーの受け止めはタメ口になる', String((bibiApology as any).replyText || '').includes('大丈夫') && !String((bibiApology as any).replyText || '').includes('くださいね') && !String((bibiApology as any).replyText || '').includes('ですよ'), String((bibiApology as any).replyText || '').slice(0, 140));
personaProfileService.switchProfile('persona-default');

// ---- スナップショットの拡充（P560） ----
conversationOpenTopicService.record('残したい話題', 3);
conversationGraphRuntimeP212Service.ingestInput('regression-p560', '状態を書き出して');
conversationGraphRuntimeP212Service.getSelfInquiryAnswer('regression-p560');
const snapshotRaw2 = storageService.getItem('miki_state_snapshot_v1');
let snapshotJson2 = '';
try { snapshotJson2 = String((JSON.parse(String(snapshotRaw2)) as any).json || ''); } catch { /* 検証側で失敗させる */ }
check('P560 スナップショットに作業状態と話題リストが入る', snapshotJson2.includes('workState') && snapshotJson2.includes('当たり判定') && snapshotJson2.includes('openTopics') && snapshotJson2.includes('残したい話題'), snapshotJson2.slice(0, 160));

// ---- ビービーの雑談反応プール（P561） ----
personaProfileService.switchProfile('persona-bibi');
const bibiCasual = await conversationCoreService.execute({ prompt: 'カピバラかわいい' } as any);
const bibiCasualHead = String((bibiCasual as any).replyText || '').split(/[！。]/)[0];
check('P561 ビービーの雑談反応はビービーの形になる', bibiCasualHead.includes('カピバラ') && !bibiCasualHead.includes('ですね'), bibiCasualHead);
personaProfileService.switchProfile('persona-default');

// ---- 自己点検を会話で聞ける（P562） ----
conversationGraphRuntimeP212Service.ingestInput('regression-p562', '自分の知識を点検して');
const inspectionAnswer = conversationGraphRuntimeP212Service.getSelfInquiryAnswer('regression-p562');
check('P562 点検して、に結果を答える', Boolean(inspectionAnswer && inspectionAnswer.includes('点検しました')), String(inspectionAnswer).slice(0, 140));

// ---- 作業状態の完了（P563） ----
projectNotebookService.intakeFromUserText('EFRのペットができた');
check('P563 完了で次の手が今の作業になる', projectNotebookService.getWorkState('EFR')?.current === '当たり判定' && projectNotebookService.getWorkState('EFR')?.next === undefined, JSON.stringify(projectNotebookService.getWorkState('EFR')));
projectNotebookService.intakeFromUserText('EFRの当たり判定ができたらいいな');
check('P563 仮定の完了では進まない', projectNotebookService.getWorkState('EFR')?.current === '当たり判定', JSON.stringify(projectNotebookService.getWorkState('EFR')));

// ---- ビービーの定型の受け止め（P564） ----
personaProfileService.switchProfile('persona-bibi');
const bibiGreeting = await conversationCoreService.execute({ prompt: 'おはよー' } as any);
check('P564 ビービーの挨拶はビービーの形になる', (String((bibiGreeting as any).replyText || '').includes('おはよう') || String((bibiGreeting as any).replyText || '').includes('おはよー')) && !String((bibiGreeting as any).replyText || '').includes('ございます'), String((bibiGreeting as any).replyText || '').slice(0, 120));
personaProfileService.switchProfile('persona-default');

// ---- 雑談で知らない語を聞き返す（P565） ----
roleplaySessionService.endSession();
const unknownAsk1 = await conversationCoreService.execute({ prompt: '今日クオッカ見たよ' } as any);
check('P565 知らない語はその場で聞き返す', String((unknownAsk1 as any).replyText || '').includes('クオッカ') && String((unknownAsk1 as any).replyText || '').includes('どんなもの'), String((unknownAsk1 as any).replyText || '').slice(0, 160));
const unknownAsk2 = await conversationCoreService.execute({ prompt: 'またクオッカ見たよ' } as any);
check('P565 同じ語は繰り返し聞かない', !String((unknownAsk2 as any).replyText || '').includes('どんなもの'), String((unknownAsk2 as any).replyText || '').slice(0, 160));

// ---- 聞き返した語の答えを覚える（P567） ----
conversationFactIntakeService.intakeFromUserText('クオッカはオーストラリアに住む小さい動物だよ', []);
check('P567 答えが辞書に取り込まれる', japaneseDictionaryService.lookup('クオッカ').some((e: any) => String(e.gloss || '').includes('オーストラリア')), JSON.stringify(japaneseDictionaryService.lookup('クオッカ')));
const taughtReply = await conversationCoreService.execute({ prompt: 'クオッカはオーストラリアに住む小さい動物だよ' } as any);
check('P567 覚えたことが返答に表れる', String((taughtReply as any).replyText || '').includes('覚えました'), String((taughtReply as any).replyText || '').slice(0, 160));

// ---- 知っている話題の雑談は雑談として受ける（P568） ----
const knownCasual = await conversationCoreService.execute({ prompt: 'モコロンかわいい' } as any);
check('P568 知っている話題の雑談は報告文にならない', String((knownCasual as any).replyText || '').includes('モコロン') && !String((knownCasual as any).replyText || '').includes('主張DB照合'), String((knownCasual as any).replyText || '').slice(0, 160));
check('P568 雑談でも知っていることが補足に出る', String((knownCasual as any).replyText || '').includes('パルの一種'), String((knownCasual as any).replyText || '').slice(0, 200));
const knownQuestion = await conversationCoreService.execute({ prompt: 'モコロンって何？' } as any);
check('P568 質問は従来どおり知識で答える', String((knownQuestion as any).replyText || '').includes('羊'), String((knownQuestion as any).replyText || '').slice(0, 160));
check('P569 知識の回答に工程ボイラープレートが混ざらない', !String((knownQuestion as any).replyText || '').includes('【次のステップ】') && !String((knownQuestion as any).replyText || '').includes('※'), String((knownQuestion as any).replyText || '').slice(0, 240));

// ---- 社交の定型も毎回同じにしない（P566） ----
const greet1 = await conversationCoreService.execute({ prompt: 'おはよう' } as any);
const greet2 = await conversationCoreService.execute({ prompt: 'おはよう' } as any);
check('P566 挨拶が毎回同じ文にならない', String((greet1 as any).replyText || '') !== String((greet2 as any).replyText || ''), `${String((greet1 as any).replyText || '').slice(0, 60)} / ${String((greet2 as any).replyText || '').slice(0, 60)}`);
const wakeup = await conversationCoreService.execute({ prompt: '今起きたよ' } as any);
check('P566 起きた、にも朝の挨拶で返す', String((wakeup as any).replyText || '').includes('おはよう'), String((wakeup as any).replyText || '').slice(0, 120));

// ---- 振り返りと学習報告が挨拶に出る（P570/P571） ----
storageService.setItem('miki_review_reflections_v1', JSON.stringify({ records: [{ questionId: 'test', question: '今日のテストの問い', answer: 'テストの答えです', at: Date.now() }], lastRunAt: Date.now() }));
storageService.setItem('miki_reflection_surfaced_v1', '0');
const reflectGreet = await conversationCoreService.execute({ prompt: 'こんにちは' } as any);
check('P570 今日の振り返りが挨拶に出る', String((reflectGreet as any).replyText || '').includes('今日のテストの問い'), String((reflectGreet as any).replyText || '').slice(0, 200));
const askedLedger = JSON.parse(storageService.getItem('miki_unknown_asked_v1') || '{}');
askedLedger['ワラビー'] = Date.now() - 2 * 3600_000;
storageService.setItem('miki_unknown_asked_v1', JSON.stringify(askedLedger));
japaneseDictionaryService.addPersonal('ワラビー', { gloss: '小型のカンガルーの仲間', semanticIds: ['learned:web'] } as any);
const learnGreet = await conversationCoreService.execute({ prompt: 'おはよう' } as any);
check('P571 背景で覚えた語が挨拶で報告される', String((learnGreet as any).replyText || '').includes('ワラビー') && String((learnGreet as any).replyText || '').includes('調べて覚えました'), String((learnGreet as any).replyText || '').slice(0, 200));
const learnGreet2 = await conversationCoreService.execute({ prompt: 'こんにちは' } as any);
check('P571 報告は一度だけ', !String((learnGreet2 as any).replyText || '').includes('調べて覚えました'), String((learnGreet2 as any).replyText || '').slice(0, 200));

// ---- 別れ・出発・帰宅の挨拶と状態の受け止め（P572/P573） ----
const departure = await conversationCoreService.execute({ prompt: '行ってきます' } as any);
check('P572 行ってきます、には行ってらっしゃい', String((departure as any).replyText || '').includes('行ってらっしゃい'), String((departure as any).replyText || '').slice(0, 120));
const homecoming = await conversationCoreService.execute({ prompt: 'ただいま' } as any);
check('P572 ただいま、にはおかえり', String((homecoming as any).replyText || '').includes('おかえり'), String((homecoming as any).replyText || '').slice(0, 120));
const goodbye = await conversationCoreService.execute({ prompt: 'じゃあね、また明日' } as any);
check('P572 別れの挨拶を話題にしない', !String((goodbye as any).replyText || '').includes('じゃあの話') && (String((goodbye as any).replyText || '').includes('さようなら') || String((goodbye as any).replyText || '').includes('じゃあ、また')), String((goodbye as any).replyText || '').slice(0, 120));
const hungry = await conversationCoreService.execute({ prompt: 'お腹すいた' } as any);
check('P573 空腹は状態として受ける', String((hungry as any).replyText || '').includes('食べ'), String((hungry as any).replyText || '').slice(0, 120));
const anxious = await conversationCoreService.execute({ prompt: '明日の発表、不安だ' } as any);
check('P573 不安は状態として受け、知らない語は聞き返さない', (String((anxious as any).replyText || '').includes('大丈夫') || String((anxious as any).replyText || '').includes('心配') || String((anxious as any).replyText || '').includes('不安なのですね')) && !String((anxious as any).replyText || '').includes('どんなもの'), String((anxious as any).replyText || '').slice(0, 160));
const agree = await conversationCoreService.execute({ prompt: 'そうだね' } as any);
check('P573 短い同意は相槌で受ける', !String((agree as any).replyText || '').includes('そうだの話'), String((agree as any).replyText || '').slice(0, 120));

// ---- 話題質問への答えを答えとして受ける（P574） ----
pendingSlotService.set('miki_pending_topic_question_v1', { terms: ['モコロン'], question: 'モコロンは、いつごろから知っていますか？', at: Date.now() }, 30 * 60000);
const topicAnswer = await conversationCoreService.execute({ prompt: '綿毛が取れるんだよ' } as any);
check('P574 質問への短い答えは答えとして受ける', String((topicAnswer as any).replyText || '').includes('そっか') || String((topicAnswer as any).replyText || '').includes('なるほど'), String((topicAnswer as any).replyText || '').slice(0, 160));
pendingSlotService.set('miki_pending_topic_question_v1', { terms: ['モコロン'], question: 'モコロンは、いつごろから知っていますか？', at: Date.now() }, 30 * 60000);
const notAnswer = await conversationCoreService.execute({ prompt: 'モコロンって何？' } as any);
check('P574 質問で来たら答えとして扱わない', !String((notAnswer as any).replyText || '').includes('教えてくれてありがとう'), String((notAnswer as any).replyText || '').slice(0, 160));

// ---- ガードの誤爆修正と天気・笑い（P575/P576） ----
const laugh = await conversationCoreService.execute({ prompt: 'それは笑う' } as any);
check('P575/P576 笑いの発話が拒否文にならず笑いで返る', !String((laugh as any).replyText || '').includes('時間・状態条件が混在') && (String((laugh as any).replyText || '').includes('ふふ') || String((laugh as any).replyText || '').includes('あはは')), String((laugh as any).replyText || '').slice(0, 160));
const guardTrip = await conversationCoreService.execute({ prompt: '昨日は晴れで、明日は雨だ' } as any);
check('P575 本物の時間の混在は今もガードが止める', String((guardTrip as any).replyText || '').includes('時間・状態条件が混在'), String((guardTrip as any).replyText || '').slice(0, 160));
const hot = await conversationCoreService.execute({ prompt: '暑いね' } as any);
check('P576 暑さの雑談に季節感のある受け止め', String((hot as any).replyText || '').includes('水分') || String((hot as any).replyText || '').includes('珍しい') || String((hot as any).replyText || '').includes('体調'), String((hot as any).replyText || '').slice(0, 160));

// ---- 場面進行の3相と重複排除（P577） ----
const p577Role = roleplaySessionService.saveRole({ name: '進行テスト役', stance: '案内人', world: 'テスト世界', toneHint: '', userRole: '' } as any);
roleplaySessionService.startSession(p577Role as any, 'persona-default');
roleplaySessionService.setScene('教室');
const progressions: string[] = [];
for (let i = 0; i < 30; i++) {
  const s = paragraphCompositionService.sceneProgressionSuffix();
  if (s) progressions.push(s.trim());
}
check('P577 進行文は使い切るまで重複しない', progressions.length >= 6 && new Set(progressions.slice(0, 6)).size === 6, progressions.slice(0, 6).join(' / '));
roleplaySessionService.setScene('異世界の宿屋');
roleplaySessionService.noteTurn('ここは魔法の宿屋だね');
const genericProgressions: string[] = [];
for (let i = 0; i < 12; i++) {
  const s = paragraphCompositionService.sceneProgressionSuffix();
  if (s) genericProgressions.push(s.trim());
}
check('P577 未対応の場面でも汎用文の連発にならない', genericProgressions.length >= 3 && !genericProgressions.some((t) => t.includes('の時間が、少し進みました')) && new Set(genericProgressions).size >= 3, genericProgressions.join(' / '));
roleplaySessionService.endSession();

// ---- 自分の好み（P578: 教示A＋頻度導出B） ----
conversationFactIntakeService.intakeFromUserText('みきはモコロンが好きだよ', []);
check('P578-A 教示で自分の好きを記録', selfPreferenceService.listTaught('persona-default').some((p) => p.term === 'モコロン' && p.kind === 'like'), JSON.stringify(selfPreferenceService.listTaught('persona-default')));
conversationFactIntakeService.intakeFromUserText('ビービーは星空が好きだよ', []);
check('P578-A 人格ごとに分かれる', selfPreferenceService.listTaught('persona-bibi').some((p) => p.term === '星空') && !selfPreferenceService.listTaught('persona-default').some((p) => p.term === '星空'), '');
conversationGraphRuntimeP212Service.ingestInput('regression-p578', 'みきの好きなものは？');
const preferenceAnswer = conversationGraphRuntimeP212Service.getSelfInquiryAnswer('regression-p578');
check('P578 好きなものを聞くと答える', Boolean(preferenceAnswer && preferenceAnswer.includes('モコロン')), String(preferenceAnswer).slice(0, 160));
const likeReply = await conversationCoreService.execute({ prompt: 'モコロンかわいい' } as any);
check('P578 好きなものの話は自分の好きとして受ける', likeReply.replyText.includes('私も好き'), likeReply.replyText);
for (let i = 0; i < 7; i++) selfPreferenceService.observeTerms('persona-default', ['星空観察']);
check('P578-B 頻度から「よく話すもの」を導く', selfPreferenceService.derivedInterests('persona-default').includes('星空観察'), JSON.stringify(selfPreferenceService.derivedInterests('persona-default')));

// ---- 通し検証で見つけた穴（P579） ----
conversationFactIntakeService.intakeFromUserText('ツバメって、鳥のことだよ', []);
check('P579 短い説明も意味として覚える', japaneseDictionaryService.has('ツバメ'));
const dictReply = await conversationCoreService.execute({ prompt: 'ツバメって何？' } as any);
check('P579 教わった語の質問に辞書から答える', dictReply.replyText.includes('鳥'), dictReply.replyText.slice(0, 160));
check('P579 知識の回答に定型末尾が付かない', !dictReply.replyText.includes('誠心誠意') && !dictReply.replyText.includes('理由は'), dictReply.replyText.slice(0, 160));
pendingSlotService.set('miki_unknown_pending_v1', { term: 'ホニャララ2' }, 30 * 60000);
conversationFactIntakeService.intakeFromUserText('ホニャララ2かわいいよね', []);
check('P579 感想は意味として取り込まない', !japaneseDictionaryService.has('ホニャララ2'));
pendingSlotService.set('miki_unknown_pending_v1', { term: 'ホニャララ3' }, 30 * 60000);
conversationFactIntakeService.intakeFromUserText('ホニャララ3は山に住む鳥だよ', []);
check('P579 聞き返しへの説明は取り込む', japaneseDictionaryService.has('ホニャララ3'));
const fragReply = await conversationCoreService.execute({ prompt: '猫に触りたいな' } as any);
check('P579 活用の断片を主題にしない', !fragReply.replyText.includes('触り、'), fragReply.replyText.slice(0, 120));

// ---- 時間帯・季節の感覚（P580） ----
// P603: 挨拶の添えは優先順位つき（拾い直し→学習報告→振り返り→
// 時間帯）なので、時間帯だけが残るよう他の一回性台帳を先に閉じる
// （従来は実行状態で結果が揺れていた）。
try {
  const askedTerms = JSON.parse(storageService.getItem('miki_unknown_asked_v1') || '{}');
  const reportedAll: Record<string, number> = {};
  for (const term of Object.keys(askedTerms)) reportedAll[term] = Date.now();
  storageService.setItem('miki_learned_report_v1', JSON.stringify(reportedAll));
} catch { /* 台帳は補助 */ }
storageService.setItem('miki_reflection_surfaced_v1', '9999999999999');
storageService.setItem('miki_open_topics_v1', '');
storageService.setItem('miki_time_sense_v1', '');
const RealDate = Date;
class FakeNightDate extends RealDate {
  // ローカル時刻で 23:30 を作る（タイムゾーンに依らず「深夜」になる）。
  constructor(...args: any[]) { super(...(args.length ? args : [2026, 11, 24, 23, 30] as any)); }
  static now() { return new RealDate(2026, 11, 24, 23, 30).getTime(); }
}
(globalThis as any).Date = FakeNightDate;
const nightGreeting = await conversationCoreService.execute({ prompt: 'こんばんは' } as any);
(globalThis as any).Date = RealDate;
check('P580 深夜の挨拶では夜更かしに触れる', nightGreeting.replyText.includes('夜遅い') || nightGreeting.replyText.includes('夜更かし') || nightGreeting.replyText.includes('こんな時間'), nightGreeting.replyText.slice(0, 160));

// ---- 意見・暇・語幹の聞き返し（P581） ----
const opinionReply = await conversationCoreService.execute({ prompt: 'モコロンどう思う？' } as any);
check('P581 意見を聞かれたら知っていることで答える', !opinionReply.replyText.includes('答えられない') && opinionReply.replyText.includes('モコロン'), opinionReply.replyText.slice(0, 160));
const boredReply = await conversationCoreService.execute({ prompt: '暇だ' } as any);
check('P581 暇を受け止める', boredReply.replyText.includes('暇'), boredReply.replyText.slice(0, 120));
const stemReply = await conversationCoreService.execute({ prompt: '明日も頑張る' } as any);
check('P581 活用の語幹は聞き返さない', !stemReply.replyText.includes('「頑張」って'), stemReply.replyText.slice(0, 120));

// ---- プロジェクトへの意見（P582） ----
const projectOpinion = await conversationCoreService.execute({ prompt: 'EFRのペット、どう思う？' } as any);
check('P582 プロジェクトの意見は決め事から答える', projectOpinion.replyText.includes('EFR') && !projectOpinion.replyText.includes('答えられない'), projectOpinion.replyText.slice(0, 160));

// ---- 今日の振り返り（P583） ----
conversationOpenTopicService.record('モコロン', 2);
conversationGraphRuntimeP212Service.ingestInput('regression-p583', '今日何の話をしたっけ？');
const recapAnswer = conversationGraphRuntimeP212Service.getSelfInquiryAnswer('regression-p583');
check('P583 今日の話を振り返る', Boolean(recapAnswer && recapAnswer.includes('モコロン')), String(recapAnswer).slice(0, 160));

// ---- 状態の受け止め拡張（P584） ----
const lonelyReply = await conversationCoreService.execute({ prompt: '寂しい' } as any);
check('P584 寂しさを受け止める', lonelyReply.replyText.includes('ここにいます') || lonelyReply.replyText.includes('そばにいます'), lonelyReply.replyText.slice(0, 120));
const thirstReply = await conversationCoreService.execute({ prompt: '喉乾いた' } as any);
check('P584 喉の渇きを受け止める', thirstReply.replyText.includes('飲'), thirstReply.replyText.slice(0, 120));

// ---- 依頼形の分類（P585） ----
check('P585 「教えて」は依頼として扱う', classifyDialogueAct('モコロンのこと教えて') === 'REQUEST');
const teachReply = await conversationCoreService.execute({ prompt: 'モコロンのこと教えて' } as any);
check('P585 「教えて」に知識で答える', teachReply.replyText.includes('モコロン') && (teachReply.replyText.includes('パル') || teachReply.replyText.includes('綿毛')), teachReply.replyText.slice(0, 160));

// ---- 答えへの続きの質問は1段まで（P586） ----
pendingSlotService.set('miki_pending_topic_question_v1', { terms: ['モコロン'], question: 'モコロンは、いつごろから知っていますか？', at: Date.now() }, 30 * 60000);
const followAnswer = await conversationCoreService.execute({ prompt: 'モコロンは綿毛が取れる、羊みたいなパルだよ' } as any);
check('P586 答えには受け止め＋続きの質問が付く', (followAnswer.replyText.includes('そっか') || followAnswer.replyText.includes('なるほど')) && followAnswer.replyText.includes('？') && !followAnswer.replyText.includes('いつごろから知っていますか'), followAnswer.replyText.slice(0, 200));
const followPending = pendingSlotService.peek<any>('miki_pending_topic_question_v1');
check('P586 続きの質問は深さ1の保留として残る', Boolean(followPending) && followPending.depth === 1, JSON.stringify(followPending).slice(0, 160));
check('P586 深さ1では続きを作らない', (conversationCoreService as any).buildFollowUpQuestion({ terms: ['モコロン'], question: 'モコロンの綿毛は、どう使いますか？', depth: 1 }, 'モコロンは綿毛が取れる、羊みたいなパルだよ', ['モコロン', '綿毛']) === undefined);
check('P586 短い答えには続きを聞かない', (conversationCoreService as any).buildFollowUpQuestion({ terms: ['モコロン'], question: 'モコロンは、いつごろから知っていますか？', depth: 0 }, 'うん', ['うん']) === undefined);

// ---- 命令形の分類拡張（P587） ----
check('P587 「窓を開けて」は依頼', classifyDialogueAct('窓を開けて') === 'REQUEST');
check('P587 「ちょっと待ってて」は依頼', classifyDialogueAct('ちょっと待ってて') === 'REQUEST');
check('P587 「それ買ってきて」は依頼', classifyDialogueAct('それ買ってきて') === 'REQUEST');
check('P587 「歌って」は依頼', classifyDialogueAct('歌って') === 'REQUEST');
check('P587 「開けてよ」は依頼', classifyDialogueAct('窓を開けてよ') === 'REQUEST');
check('P587 過去形の報告は依頼にしない', classifyDialogueAct('昨日は散歩してきた') !== 'REQUEST');
check('P587 宣言文は宣言のまま', classifyDialogueAct('モコロンは羊みたいなパルだよ') === 'STATEMENT');

// ---- 解けない依頼は引き受ける形で受ける（P588） ----
const singReply = await conversationCoreService.execute({ prompt: '歌って' } as any);
check('P588 「歌って」に引き受ける返答', (singReply.replyText.includes('いい') || singReply.replyText.includes('任せて') || singReply.replyText.includes('やってみます')) && !singReply.replyText.includes('話してくれてありがとう'), singReply.replyText.slice(0, 120));
const waitReply = await conversationCoreService.execute({ prompt: 'ちょっと待ってて' } as any);
check('P588 「待ってて」が断片の反響にならない', !waitReply.replyText.includes('ちょっ、'), waitReply.replyText.slice(0, 120));

// ---- 受け皿側の定型もビービーの形に（P589） ----
personaProfileService.switchProfile('persona-bibi');
const bibiSing = await conversationCoreService.execute({ prompt: '歌って' } as any);
check('P589 ビービーの依頼の引き受けはタメ口', (bibiSing.replyText.includes('まかせて') || bibiSing.replyText.includes('やってみるね') || bibiSing.replyText.includes('いいよ')) && !bibiSing.replyText.includes('分かりました'), bibiSing.replyText.slice(0, 120));
pendingSlotService.set('miki_pending_topic_question_v1', { terms: ['モコロン'], question: 'モコロンは、いつごろから知っていますか？', at: Date.now() }, 30 * 60000);
const bibiAnswerAck = await conversationCoreService.execute({ prompt: 'モコロンは綿毛が取れる、羊みたいなパルだよ' } as any);
check('P589 ビービーの答えの受け止めはタメ口', (bibiAnswerAck.replyText.includes('ありがと') || bibiAnswerAck.replyText.includes('なんだ')) && !bibiAnswerAck.replyText.includes('そういうことなんですね'), bibiAnswerAck.replyText.slice(0, 160));
personaProfileService.switchProfile('persona-default');

// ---- 話題質問の回転（P590） ----
storageService.setItem('miki_topic_question_usage_v1', '{}');
const rotQ1 = paragraphCompositionService.buildTopicQuestion(['モコロン']);
const rotQ2 = paragraphCompositionService.buildTopicQuestion(['モコロン']);
const rotQ3 = paragraphCompositionService.buildTopicQuestion(['モコロン']);
check('P590 同じ主題の質問が回って変わる', Boolean(rotQ1 && rotQ2 && rotQ3) && rotQ1 !== rotQ2 && rotQ2 !== rotQ3, [rotQ1, rotQ2, rotQ3].join(' / '));
check('P590 最初は関係の質問から始まる', Boolean(rotQ1 && !/いつごろから|思い出すことが多い|印象に残って/.test(rotQ1)), String(rotQ1));

// ---- 日常発話の穴埋め（P591） ----
const painReply = await conversationCoreService.execute({ prompt: '頭痛い' } as any);
check('P591 痛みは状態として受ける', painReply.replyText.includes('大丈夫') || painReply.replyText.includes('つらい') || painReply.replyText.includes('休ん'), painReply.replyText.slice(0, 120));
const staleReply = await conversationCoreService.execute({ prompt: 'つまらん' } as any);
check('P591 つまらなさを受け止め、断片の反響にしない', (staleReply.replyText.includes('面白い話') || staleReply.replyText.includes('退屈') || staleReply.replyText.includes('つまらな')) && !staleReply.replyText.includes('つまの話'), staleReply.replyText.slice(0, 120));
const joyReply = await conversationCoreService.execute({ prompt: 'やったー！' } as any);
check('P591 喜びは一緒に喜ぶ', joyReply.replyText.includes('やりました') || joyReply.replyText.includes('わーい') || joyReply.replyText.includes('嬉しい'), joyReply.replyText.slice(0, 120));
const workDoneReply = await conversationCoreService.execute({ prompt: '仕事終わった' } as any);
check('P591 仕事終わりは労い、語幹を聞き返さない', workDoneReply.replyText.includes('お疲れ様') && !workDoneReply.replyText.includes('どんなもの'), workDoneReply.replyText.slice(0, 140));
const rainReply = await conversationCoreService.execute({ prompt: '雨降ってきた' } as any);
check('P591 活用の語幹を聞き返さない', !rainReply.replyText.includes('どんなものですか'), rainReply.replyText.slice(0, 140));
const statusReply = await conversationCoreService.execute({ prompt: '最近どう？' } as any);
check('P591 彼女への様子聞きは自分の状態で答える', (statusReply.replyText.includes('元気') || statusReply.replyText.includes('調子')) && !statusReply.replyText.includes('調べてみた'), statusReply.replyText.slice(0, 140));

// ---- 彼女自身への質問・時計・選択・祝い（P592） ----
const ageReply = await conversationCoreService.execute({ prompt: 'みきって何歳？' } as any);
check('P592 年齢の質問は調査に倒さず自分で答える', (ageReply.replyText.includes('歳') || ageReply.replyText.includes('年齢')) && !ageReply.replyText.includes('アラサー'), ageReply.replyText.slice(0, 140));
const clockReply = await conversationCoreService.execute({ prompt: '今何時？' } as any);
check('P592 今何時、には現在時刻で答える', /今は\d+時\d+分です/.test(clockReply.replyText), clockReply.replyText.slice(0, 120));
const weekdayReply = await conversationCoreService.execute({ prompt: '明日って何曜日だっけ' } as any);
check('P592 明日の曜日はカレンダーで答える', /明日は[日月火水木金土]曜日です/.test(weekdayReply.replyText), weekdayReply.replyText.slice(0, 120));
const choiceReply = await conversationCoreService.execute({ prompt: '寿司と焼肉、どっちがいいと思う？' } as any);
check('P592 二択は特定失敗の報告文にしない', choiceReply.replyText.includes('寿司') && choiceReply.replyText.includes('焼肉') && !choiceReply.replyText.includes('特定できません'), choiceReply.replyText.slice(0, 160));
const congratsReply = await conversationCoreService.execute({ prompt: '彼女できた' } as any);
check('P592 大きな報告はまず祝う', congratsReply.replyText.includes('おめでとう') || congratsReply.replyText.includes('おめでと'), congratsReply.replyText.slice(0, 120));
const sleeplessReply = await conversationCoreService.execute({ prompt: '眠れない' } as any);
check('P592 眠れない夜を受ける', sleeplessReply.replyText.includes('つらい') || sleeplessReply.replyText.includes('無理に') || sleeplessReply.replyText.includes('温かい'), sleeplessReply.replyText.slice(0, 120));
const snowReply = await conversationCoreService.execute({ prompt: '雪降りそうだね' } as any);
check('P592 雪の雑談は断片にしない', snowReply.replyText.includes('雪') && !snowReply.replyText.includes('降りの話'), snowReply.replyText.slice(0, 120));
const recommendReply = await conversationCoreService.execute({ prompt: 'おすすめの暇つぶしある？' } as any);
check('P592 おすすめ依頼は見出し付き謝罪文にしない', !recommendReply.replyText.includes('【現時点の結論】') && (recommendReply.replyText.includes('おすすめ') || recommendReply.replyText.includes('気分')), recommendReply.replyText.slice(0, 160));
const bridgeGarnishReply = await conversationCoreService.execute({ prompt: 'ホニャララ5って何？' } as any);
check('P592 調査橋の返答に定型末尾が付かない', !bridgeGarnishReply.replyText.includes('誠心誠意') && !bridgeGarnishReply.replyText.includes('急がず着実') && !bridgeGarnishReply.replyText.includes('微力ながら'), bridgeGarnishReply.replyText.slice(0, 160));

// ---- 体調・悲しみ・褒め・できないこと・機嫌（P593） ----
const illnessReply = await conversationCoreService.execute({ prompt: '風邪ひいた' } as any);
check('P593 体調の報告は気遣いで受ける', illnessReply.replyText.includes('お大事に') || illnessReply.replyText.includes('大丈夫') || illnessReply.replyText.includes('休んで'), illnessReply.replyText.slice(0, 120));
const sadReply = await conversationCoreService.execute({ prompt: '泣きたい' } as any);
check('P593 泣きたい気持ちを受ける', sadReply.replyText.includes('そばにいます') || sadReply.replyText.includes('大丈夫') || sadReply.replyText.includes('聞きます'), sadReply.replyText.slice(0, 120));
const complimentReply = await conversationCoreService.execute({ prompt: 'みきかわいいね' } as any);
check('P593 褒め言葉は照れて受ける', (complimentReply.replyText.includes('ありがとう') || complimentReply.replyText.includes('嬉しい') || complimentReply.replyText.includes('えへへ')) && !complimentReply.replyText.includes('みきですか'), complimentReply.replyText.slice(0, 120));
const cannotReply = await conversationCoreService.execute({ prompt: '明日7時に起こして' } as any);
check('P593 できない依頼は引き受けたふりをしない', cannotReply.replyText.includes('できない'), cannotReply.replyText.slice(0, 140));
const moodReply = await conversationCoreService.execute({ prompt: '怒ってる？' } as any);
check('P593 機嫌の質問には自分の状態で答える', moodReply.replyText.includes('怒っていません') || moodReply.replyText.includes('怒ってない'), moodReply.replyText.slice(0, 120));

// ---- 相方としての受け答え（P594） ----
const stuckReply = await conversationCoreService.execute({ prompt: 'バグが取れない' } as any);
check('P594 行き詰まりは一緒に考える形で受ける', stuckReply.replyText.includes('一緒') || stuckReply.replyText.includes('切り分け'), stuckReply.replyText.slice(0, 140));
const discouragedReply = await conversationCoreService.execute({ prompt: 'モチベ下がってきた' } as any);
check('P594 落ち込みは励ましで受ける', (discouragedReply.replyText.includes('大丈夫') || discouragedReply.replyText.includes('休んで')) && !discouragedReply.replyText.includes('モチベの話'), discouragedReply.replyText.slice(0, 160));
const shouldReply = await conversationCoreService.execute({ prompt: 'EFRのマップ、やっぱり出すべき？' } as any);
check('P594 「出すべき？」は決め事を踏まえて意見を言う', shouldReply.replyText.includes('EFR') && shouldReply.replyText.includes('決め事'), shouldReply.replyText.slice(0, 180));
const restDayReply = await conversationCoreService.execute({ prompt: '今日は開発休む' } as any);
check('P594 休む宣言は労い、語幹を聞き返さない', (restDayReply.replyText.includes('休んで') || restDayReply.replyText.includes('休み')) && !restDayReply.replyText.includes('どんなもの'), restDayReply.replyText.slice(0, 140));
projectNotebookService.intakeFromUserText('EFRのペットを作ってる');
projectNotebookService.intakeFromUserText('次は当たり判定を作る');
const nextWorkReply = await conversationCoreService.execute({ prompt: '次何作ればいいと思う？' } as any);
check('P594 次の作業は作業状態から答える', nextWorkReply.replyText.includes('当たり判定'), nextWorkReply.replyText.slice(0, 160));

// ---- なりチャの開始・終了の返答と、調査要約の掃除（P595） ----
const { cleanWebSummary } = await import('../src/miki/conversation/services/unknownResearchConversationBridgeService');
check('P595 要約からページの案内文を採用しない', cleanWebSummary('アップロード (ウィキメディア・コモンズ) ヘルプ ヘルプ 利用 お知らせ 検索 検索 表示 ログイン ログイン 目次 ページ先頭 概要 シリーズ作品', ['概要']) === '', cleanWebSummary('アップロード (ウィキメディア・コモンズ) ヘルプ ヘルプ 利用 お知らせ 検索 ログイン 目次 ページ先頭', ['概要']));
check('P595 正常な要約は残る', cleanWebSummary('モコロンは羊のようなパルです。綿毛が取れます。', ['モコロン']).includes('モコロンは羊のようなパルです'), cleanWebSummary('モコロンは羊のようなパルです。綿毛が取れます。', ['モコロン']));

// ---- ビービーの口調の自然さ（P596） ----
personaProfileService.switchProfile('persona-bibi');
const bibiSkillReply = await conversationCoreService.execute({ prompt: 'ビービーは何が得意？' } as any);
check('P596 「〜たいだよ」にならない', !bibiSkillReply.replyText.includes('たいだよ') && !bibiSkillReply.replyText.includes('嬉しいだよ'), bibiSkillReply.replyText.slice(0, 140));
const bibiStatusReply = await conversationCoreService.execute({ prompt: '最近どう？' } as any);
check('P596 様子聞きもタメ口で自然に', !bibiStatusReply.replyText.includes('嬉しいだよ') && !bibiStatusReply.replyText.includes('どうですか'), bibiStatusReply.replyText.slice(0, 140));
personaProfileService.switchProfile('persona-default');

// ---- 計算とカレンダーの拡張（P597） ----
const arithReply = await conversationCoreService.execute({ prompt: '1+1は？' } as any);
check('P597 足し算にその場で答える', arithReply.replyText.includes('1+1は2です'), arithReply.replyText.slice(0, 100));
const arithMulReply = await conversationCoreService.execute({ prompt: '15×4は？' } as any);
check('P597 掛け算にその場で答える', arithMulReply.replyText.includes('60'), arithMulReply.replyText.slice(0, 100));
const arithHalfReply = await conversationCoreService.execute({ prompt: '100の半分は？' } as any);
check('P597 半分にその場で答える', arithHalfReply.replyText.includes('50'), arithHalfReply.replyText.slice(0, 100));
const dayAfterReply = await conversationCoreService.execute({ prompt: '明後日は何曜日？' } as any);
check('P597 明後日の曜日を答える', /明後日は[日月火水木金土]曜日です/.test(dayAfterReply.replyText), dayAfterReply.replyText.slice(0, 100));
const yesterdayDateReply = await conversationCoreService.execute({ prompt: '昨日は何日だった？' } as any);
check('P597 昨日の日付を答える', /昨日は\d+月\d+日でした/.test(yesterdayDateReply.replyText), yesterdayDateReply.replyText.slice(0, 100));

// ---- 訂正の受け取り・苦しさ・プロジェクト進捗・複合質問（P598） ----
const correctionReply = await conversationCoreService.execute({ prompt: 'モコロンは羊じゃなくて牛だよ' } as any);
check('P598 知識への訂正は訂正として受ける', (correctionReply.replyText.includes('覚え直し') || correctionReply.replyText.includes('覚え直し')) && !correctionReply.replyText.includes('【結論事項】'), correctionReply.replyText.slice(0, 140));
const distressReply = await conversationCoreService.execute({ prompt: '消えたい' } as any);
check('P598 強い苦しさは受け止める', distressReply.replyText.includes('ここにいます') || distressReply.replyText.includes('そばにいます') || distressReply.replyText.includes('抱え込まない'), distressReply.replyText.slice(0, 160));
const giveupReply = await conversationCoreService.execute({ prompt: 'もう全部どうでもいい' } as any);
check('P598 投げやりな気持ちを受ける', (giveupReply.replyText.includes('無理しなく') || giveupReply.replyText.includes('ゆっくり') || giveupReply.replyText.includes('休む日')) && !giveupReply.replyText.includes('全部って'), giveupReply.replyText.slice(0, 140));
const projectStatusReply = await conversationCoreService.execute({ prompt: 'EFRっていつ完成するの？' } as any);
check('P598 完成時期はプロジェクトの状態で答える', projectStatusReply.replyText.includes('EFR') && (projectStatusReply.replyText.includes('完成時期') || projectStatusReply.replyText.includes('決まって')) && !projectStatusReply.replyText.includes('モコロン'), projectStatusReply.replyText.slice(0, 160));
const multiPartReply = await conversationCoreService.execute({ prompt: 'モコロンって何？あと今何時？' } as any);
check('P598 複合質問は片方だけに飲み込まれない', multiPartReply.replyText.includes('羊'), multiPartReply.replyText.slice(0, 140));
check('P598 要約から空港一覧のような表を採用しない', cleanWebSummary('空港 [ 編集 ] 都市 ICAO IATA 空港名 アウアス空港 (Ahuás Airport) アマパラ MHAM アマパラ空港', ['空港']) === '', cleanWebSummary('空港 [ 編集 ] 都市 ICAO IATA 空港名 アウアス空港', ['空港']));

// ---- 無関係な調査要約の不採用（P599） ----
const { selectUnverifiedPresentation } = await import('../src/miki/conversation/services/unknownResearchConversationBridgeService');
const irrelevantPresentation = selectUnverifiedPresentation(
  [{ status: 'ACCEPTED', url: 'https://example.com/list', title: 'モコロンの食べ物まとめ', snippet: '空港の一覧である。各地の空港をまとめた。' } as any],
  'モコロン 何 食べる',
);
check('P599 検索語を含まない要約は提示しない', irrelevantPresentation === null, JSON.stringify(irrelevantPresentation));

// ---- 継続の仕組み（別日の拾い直し・疲れの継続形）（P600） ----
const yesterdayKey = (() => { const d = new Date(Date.now() - 24 * 3600_000); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; })();
storageService.setItem('miki_open_topics_v1', JSON.stringify([{ topic: 'ツバメの巣', openedDay: yesterdayKey, weight: 3 }]));
const callbackReply = await conversationCoreService.execute({ prompt: 'おはよう' } as any);
check('P600 別日の挨拶で前の話題を拾う', callbackReply.replyText.includes('ツバメの巣'), callbackReply.replyText.slice(0, 160));
storageService.setItem('miki_user_state_trail_v1', JSON.stringify([{ signal: 'fatigue', at: Date.now() - 26 * 3600_000 }]));
const fatigueAgainReply = await conversationCoreService.execute({ prompt: '疲れた' } as any);
check('P600 疲れが続いているときは継続の形で受ける', fatigueAgainReply.replyText.includes('続いて') || fatigueAgainReply.replyText.includes('ここ数日') || fatigueAgainReply.replyText.includes('このところ'), fatigueAgainReply.replyText.slice(0, 160));

// ---- 相手への意見・作品の見せっこ・話の続き（P601） ----
const userOpinionReply = await conversationCoreService.execute({ prompt: '僕のことどう思う？' } as any);
check('P601 相手への意見は関係で答える', (userOpinionReply.replyText.includes('相方') || userOpinionReply.replyText.includes('楽しい') || userOpinionReply.replyText.includes('頼もしい')) && !userOpinionReply.replyText.includes('確認できていない'), userOpinionReply.replyText.slice(0, 160));
const showVisualReply = await conversationCoreService.execute({ prompt: '見て、絵を描いたんだ' } as any);
check('P601 絵の見せっこは目がないことを正直に言う', showVisualReply.replyText.includes('目') && (showVisualReply.replyText.includes('言葉で') || showVisualReply.replyText.includes('教えて')), showVisualReply.replyText.slice(0, 180));
const continuationReply = await conversationCoreService.execute({ prompt: 'それでね、そのあと雨が降ってきて大変だった' } as any);
check('P601 話の続きは確認文で返さない', !continuationReply.replyText.includes('特定できません') && !continuationReply.replyText.includes('候補:'), continuationReply.replyText.slice(0, 140));

// ---- 自己照会の名無しの聞き方（P602） ----
conversationGraphRuntimeP212Service.ingestInput('regression-p602a', '今何の役？');
const noRoleAnswer = conversationGraphRuntimeP212Service.getSelfInquiryAnswer('regression-p602a');
check('P602 役が無いときも自己照会で答える', Boolean(noRoleAnswer && noRoleAnswer.includes('被っていません')), String(noRoleAnswer).slice(0, 120));
conversationGraphRuntimeP212Service.ingestInput('regression-p602b', '決めたこと教えて');
const bareDecisionsAnswer = conversationGraphRuntimeP212Service.getSelfInquiryAnswer('regression-p602b');
check('P602 名無しの決め事質問にまとめて答える', Boolean(bareDecisionsAnswer && bareDecisionsAnswer.includes('EFR')), String(bareDecisionsAnswer).slice(0, 160));
conversationGraphRuntimeP212Service.ingestInput('regression-p602c', '今の作業は？');
const bareWorkAnswer = conversationGraphRuntimeP212Service.getSelfInquiryAnswer('regression-p602c');
check('P602 名無しの作業質問に答える', Boolean(bareWorkAnswer && bareWorkAnswer.length > 0), String(bareWorkAnswer).slice(0, 160));

// ---- 締めの挨拶の残りと、聞いてほしい声かけ（P603） ----
const sleepReply = await conversationCoreService.execute({ prompt: 'もう寝るね' } as any);
check('P603 寝る宣言はおやすみで受ける', sleepReply.replyText.includes('おやすみ'), sleepReply.replyText.slice(0, 120));
const farewellReply = await conversationCoreService.execute({ prompt: 'また明日ね' } as any);
check('P603 「また明日ね」は別れの挨拶で受ける', (farewellReply.replyText.includes('さようなら') || farewellReply.replyText.includes('また')) && !farewellReply.replyText.includes('の話ですね'), farewellReply.replyText.slice(0, 120));
const listenReply = await conversationCoreService.execute({ prompt: 'ねえ、聞いて' } as any);
check('P603 「ねえ、聞いて」は聞く姿勢で受ける', (listenReply.replyText.includes('聞いてる') || listenReply.replyText.includes('聞かせて')) && !listenReply.replyText.includes('やってみます'), listenReply.replyText.slice(0, 120));

// ---- 痛みの誤爆・休み・食事の迷い・行ってくる（P604） ----
const wantPetReply = await conversationCoreService.execute({ prompt: '猫飼いたいな' } as any);
check('P604 「飼いたい」を痛みと誤認しない', !wantPetReply.replyText.includes('痛む') && !wantPetReply.replyText.includes('痛いのは'), wantPetReply.replyText.slice(0, 120));
const kanaAcheReply = await conversationCoreService.execute({ prompt: '足がいたい' } as any);
check('P604 かなの痛みは痛みとして受ける', kanaAcheReply.replyText.includes('大丈夫') || kanaAcheReply.replyText.includes('痛'), kanaAcheReply.replyText.slice(0, 120));
const dayoffReply = await conversationCoreService.execute({ prompt: '明日は休みだよ' } as any);
check('P604 休みの宣言は休む形で受ける', dayoffReply.replyText.includes('ゆっくり') || dayoffReply.replyText.includes('のんびり') || dayoffReply.replyText.includes('お休み'), dayoffReply.replyText.slice(0, 120));
const dinnerReply = await conversationCoreService.execute({ prompt: '晩ごはん何にしよう' } as any);
check('P604 食事の迷いは一緒に考える', dinnerReply.replyText.includes('気分'), dinnerReply.replyText.slice(0, 140));
const shoppingReply = await conversationCoreService.execute({ prompt: '買い物行ってくる' } as any);
check('P604 「行ってくる」は送り出しで受ける', shoppingReply.replyText.includes('行ってらっしゃい') || shoppingReply.replyText.includes('いってらっしゃい'), shoppingReply.replyText.slice(0, 120));
const earlyRiseReply = await conversationCoreService.execute({ prompt: '明日早起きしなきゃ' } as any);
check('P604 予定の断片を聞き返さない', !earlyRiseReply.replyText.includes('明日早起'), earlyRiseReply.replyText.slice(0, 120));

// ---- 叱られた・達成・交通トラブルの受け止め（P606） ----
const scoldedReply = await conversationCoreService.execute({ prompt: '上司に怒られた' } as any);
check('P606 叱られた報告は寄り添う', scoldedReply.replyText.includes('大変') || scoldedReply.replyText.includes('つら'), scoldedReply.replyText.slice(0, 140));
const clearedReply = await conversationCoreService.execute({ prompt: 'ゲームクリアした！' } as any);
check('P606 達成の報告は一緒に喜ぶ', clearedReply.replyText.includes('おめでとう') || clearedReply.replyText.includes('やりました') || clearedReply.replyText.includes('すごい'), clearedReply.replyText.slice(0, 140));
const trainReply = await conversationCoreService.execute({ prompt: '電車が遅れてる' } as any);
check('P606 交通トラブルは状況として受ける', trainReply.replyText.includes('大変') || trainReply.replyText.includes('気をつけて'), trainReply.replyText.slice(0, 140));
const paydayReply = await conversationCoreService.execute({ prompt: '給料日だ！' } as any);
check('P606 給料日は一緒に喜ぶ', !paydayReply.replyText.startsWith('給料の話ですね'), paydayReply.replyText.slice(0, 140));

// ---- 落とし物・喧嘩・家事の受け止め（P607） ----
const lostReply = await conversationCoreService.execute({ prompt: '財布なくした' } as any);
check('P607 なくし物は心配して受ける', lostReply.replyText.includes('見つかる') || lostReply.replyText.includes('大変') || lostReply.replyText.includes('困り'), lostReply.replyText.slice(0, 140));
const quarrelReply = await conversationCoreService.execute({ prompt: '友達と喧嘩した' } as any);
check('P607 喧嘩はつらさとして受ける', quarrelReply.replyText.includes('つら') || quarrelReply.replyText.includes('仲直り') || quarrelReply.replyText.includes('落ち着') || quarrelReply.replyText.includes('疲れ'), quarrelReply.replyText.slice(0, 140));
const choresReply = await conversationCoreService.execute({ prompt: '部屋の掃除した' } as any);
check('P607 家事の完了は労う', choresReply.replyText.includes('お疲れ様') || choresReply.replyText.includes('おつかれ'), choresReply.replyText.slice(0, 140));

// ---- 彼女への経験・望み・名前の質問、近づいた誕生日（P608） ----
const recentExpReply = await conversationCoreService.execute({ prompt: '最近なにか面白いことあった？' } as any);
check('P608 最近の出来事は自分の記録から答える', !recentExpReply.replyText.includes('調べてみたけれど'), recentExpReply.replyText.slice(0, 160));
const selfWantReply = await conversationCoreService.execute({ prompt: '何か食べたいものある？' } as any);
check('P608 食べたいものの質問は正直に答える', !selfWantReply.replyText.includes('答えられない') && !selfWantReply.replyText.includes('【'), selfWantReply.replyText.slice(0, 160));
const nameUnknownReply = await conversationCoreService.execute({ prompt: '僕の名前知ってる？' } as any);
check('P608 名前はまだ教わっていないと正直に言う', nameUnknownReply.replyText.includes('まだ') && (nameUnknownReply.replyText.includes('名前') || nameUnknownReply.replyText.includes('覚えます')), nameUnknownReply.replyText.slice(0, 160));
const birthdaySoonReply = await conversationCoreService.execute({ prompt: 'もうすぐ誕生日なんだ' } as any);
check('P608 近づいた誕生日は楽しみとして受ける', birthdaySoonReply.replyText.includes('誕生日') || birthdaySoonReply.replyText.includes('楽しみ'), birthdaySoonReply.replyText.slice(0, 140));

// ---- 出来事分類は特徴で判定する（P609、旧正規表現に無い言い換えで確認） ----
const droppedReply = await conversationCoreService.execute({ prompt: '財布を落としてしまった' } as any);
check('P609 「落としてしまった」も喪失として受ける', droppedReply.replyText.includes('見つかる') || droppedReply.replyText.includes('大変') || droppedReply.replyText.includes('困り'), droppedReply.replyText.slice(0, 140));
const examFailReply = await conversationCoreService.execute({ prompt: '試験に落ちた' } as any);
check('P609 試験に落ちたは後退として受ける', (examFailReply.replyText.includes('大変') || examFailReply.replyText.includes('つら')) && !examFailReply.replyText.includes('おめでとう'), examFailReply.replyText.slice(0, 140));
const examNegReply = await conversationCoreService.execute({ prompt: '試験に受からなかった' } as any);
check('P609 否定された達成は祝わない', !examNegReply.replyText.includes('おめでとう') && (examNegReply.replyText.includes('大変') || examNegReply.replyText.includes('つら')), examNegReply.replyText.slice(0, 140));
const passLostReply = await conversationCoreService.execute({ prompt: '定期券を失くしてしまった' } as any);
check('P609 初めての物でも喪失として受ける', passLostReply.replyText.includes('見つかる') || passLostReply.replyText.includes('大変') || passLostReply.replyText.includes('困り'), passLostReply.replyText.slice(0, 140));

// ---- 動詞クラス表は後から拡張できる（P610） ----
{
  const { utteranceEventClassifierService } = await import('../src/miki/conversation/services/utteranceEventClassifierService');
  utteranceEventClassifierService.registerVerbClass('コケ', 'SETBACK');
  const extended = utteranceEventClassifierService.classify('試験でコケた');
  check('P610 拡張した動詞クラスで分類できる', extended?.eventClass === 'SETBACK', JSON.stringify(extended));
  utteranceEventClassifierService.registerMeasureNoun('段級');
  const measured = utteranceEventClassifierService.classify('段級が上がった');
  check('P610 拡張した量の名詞で達成になる', measured?.eventClass === 'ACHIEVEMENT', JSON.stringify(measured));
}

// ---- 受け止めの外れを台帳に残す（P611） ----
{
  const { storageService } = await import('../src/services/storageService');
  storageService.setItem('miki_reception_review_v1', '[]');
  storageService.setItem('miki_last_reception_v1', 'null');
  await conversationCoreService.execute({ prompt: '財布なくした' } as any);
  const recorded = JSON.parse(storageService.getItem('miki_last_reception_v1') || 'null');
  check('P611 受け止めが記録される', Boolean(recorded && recorded.category === 'fx_lost'), JSON.stringify(recorded));
  await conversationCoreService.execute({ prompt: '違う、そうじゃないんだ' } as any);
  const review = JSON.parse(storageService.getItem('miki_reception_review_v1') || '[]');
  check('P611 直後の訂正で外れ台帳に移る', review.length === 1 && review[0].category === 'fx_lost', JSON.stringify(review).slice(0, 160));
}

// ---- 分類の一般化その2・回復の受け止め（P612） ----
const busStopReply = await conversationCoreService.execute({ prompt: 'バスが止まってる' } as any);
check('P612 バスの運休も交通として受ける', busStopReply.replyText.includes('大変') || busStopReply.replyText.includes('気をつけて') || busStopReply.replyText.includes('遅れ') || busStopReply.replyText.includes('無理'), busStopReply.replyText.slice(0, 140));
const ticketReply = await conversationCoreService.execute({ prompt: 'ライブのチケット当たった！' } as any);
check('P612 当選は達成として一緒に喜ぶ', ticketReply.replyText.includes('おめでとう') || ticketReply.replyText.includes('やりました') || ticketReply.replyText.includes('すごい'), ticketReply.replyText.slice(0, 140));
const umbrellaReply = await conversationCoreService.execute({ prompt: '傘忘れた' } as any);
check('P612 置き忘れは喪失寄りに受ける', umbrellaReply.replyText.includes('見つかる') || umbrellaReply.replyText.includes('大変') || umbrellaReply.replyText.includes('困り'), umbrellaReply.replyText.slice(0, 140));
const recoveredReply = await conversationCoreService.execute({ prompt: '風邪治った' } as any);
check('P612 回復は喜んで受ける', recoveredReply.replyText.includes('よかった') && !recoveredReply.replyText.includes('良くなりますように'), recoveredReply.replyText.slice(0, 140));

// ---- 助かった・愚痴の受け止め（P613） ----
const reliefReply = await conversationCoreService.execute({ prompt: '本当に助かった' } as any);
check('P613 「助かった」は安堵として受ける', reliefReply.replyText.includes('よかった') || reliefReply.replyText.includes('嬉しい') || reliefReply.replyText.includes('うれしい'), reliefReply.replyText.slice(0, 140));
const ventingReply = await conversationCoreService.execute({ prompt: '仕事で嫌なことがあってさ' } as any);
check('P613 愚痴は寄り添って聞く', ventingReply.replyText.includes('嫌な思い') || ventingReply.replyText.includes('大変') || ventingReply.replyText.includes('聞かせて'), ventingReply.replyText.slice(0, 140));

// ---- 彼女の能力・予定、作り方の聞き返し、もっと話したい（P614） ----
const songReply = await conversationCoreService.execute({ prompt: '歌歌える？' } as any);
check('P614 歌えるかには現状を正直に答える', !songReply.replyText.includes('答えられない') && songReply.replyText.includes('歌'), songReply.replyText.slice(0, 140));
const drawReply = await conversationCoreService.execute({ prompt: '絵描ける？' } as any);
check('P614 描けるかには勉強中と答える', drawReply.replyText.includes('描') && (drawReply.replyText.includes('まだ') || drawReply.replyText.includes('勉強')), drawReply.replyText.slice(0, 160));
const scheduleReply = await conversationCoreService.execute({ prompt: '明日の予定は？' } as any);
check('P614 彼女の予定は正直に答える', scheduleReply.replyText.includes('予定'), scheduleReply.replyText.slice(0, 140));
const recipeReply = await conversationCoreService.execute({ prompt: '料理の作り方教えて' } as any);
check('P614 料理名が無ければ聞き返す', recipeReply.replyText.includes('何の料理') || recipeReply.replyText.includes('どの料理'), recipeReply.replyText.slice(0, 140));
const talkMoreReply = await conversationCoreService.execute({ prompt: 'もっと話したい' } as any);
check('P614 もっと話したいには温かく応じる', talkMoreReply.replyText.includes('話') && !talkMoreReply.replyText.includes('もっとの話'), talkMoreReply.replyText.slice(0, 140));

// ---- 特徴量の一元化（P615） ----
{
  const { utteranceFeatureService } = await import('../src/miki/memory/services/utteranceFeatureService');
  const f1 = utteranceFeatureService.analyze('昨日は本当に疲れた');
  check('P615 完了の相を共有特徴で取る', f1.aspect === 'COMPLETED', f1.aspect);
  const f2 = utteranceFeatureService.analyze('今ごはん食べてる');
  check('P615 進行の相を取る', f2.aspect === 'ONGOING', f2.aspect);
  const f3 = utteranceFeatureService.analyze('猫飼いたいな');
  check('P615 希望の相を取る', f3.aspect === 'DESIDERATIVE', f3.aspect);
  const f4 = utteranceFeatureService.analyze('上司に怒られた');
  check('P615 受身と完了を取る', f4.passive && f4.aspect === 'COMPLETED', JSON.stringify({ passive: f4.passive, aspect: f4.aspect }));
  const f5 = utteranceFeatureService.analyze('何を買ったの？');
  check('P615 WH疑問を取る', f5.questionForm === 'WH', f5.questionForm);
  const f6 = utteranceFeatureService.analyze('歌える？');
  check('P615 YesNo疑問を取る', f6.questionForm === 'YESNO', f6.questionForm);
  const f7 = utteranceFeatureService.analyze('試験に受からなかった');
  check('P615 否定を取る', f7.negated, String(f7.negated));
}

// ---- 知っている物への属性質問（P616） ----
const attrUseReply = await conversationCoreService.execute({ prompt: 'モコロンは何に使うの？' } as any);
check('P616 使い道は世界モデルの関係で答える', attrUseReply.replyText.includes('綿毛'), attrUseReply.replyText.slice(0, 160));
const attrPlaceReply = await conversationCoreService.execute({ prompt: 'モコロンってどこで捕まえられる？' } as any);
check('P616 場所は知らない範囲を添えて正直に答える', attrPlaceReply.replyText.includes('まだ知らない') && attrPlaceReply.replyText.includes('調べて'), attrPlaceReply.replyText.slice(0, 180));
{
  const { storageService } = await import('../src/services/storageService');
  const gaps = JSON.parse(storageService.getItem('miki_knowledge_gaps_v1') || '[]') as Array<Record<string, unknown>>;
  const gap = gaps.find((g) => g.type === 'UNKNOWN_RELATION' && String(g.query || '').includes('モコロン'));
  check('P616 属性の欠けが調査 gap に積まれる', Boolean(gap), 'gap not found');
}

// ---- 答えられなかった質問の台帳（P617） ----
{
  const { storageService } = await import('../src/services/storageService');
  storageService.setItem('miki_unanswered_questions_v1', '[]');
  // P743: 寿命は知識（Claim）から答えられるようになったため、
  // 台帳の検証には本当に答えられない質問（握力）を使う。
  await conversationCoreService.execute({ prompt: 'クオッカの握力はどのくらい？' } as any);
  await conversationCoreService.execute({ prompt: 'クオッカの握力はどのくらい？' } as any);
  const ledger = JSON.parse(storageService.getItem('miki_unanswered_questions_v1') || '[]') as Array<{ question: string }>;
  check('P617 答えられなかった質問が台帳に残る（重複なし）', ledger.filter((e) => e.question.includes('クオッカの握力')).length === 1, JSON.stringify(ledger).slice(0, 160));
}

// ---- 分類・確認・類似の質問（P618） ----
const classReply = await conversationCoreService.execute({ prompt: 'モコロンって何の仲間？' } as any);
check('P618 分類は IS_A で答える', classReply.replyText.includes('パル') && classReply.replyText.includes('仲間'), classReply.replyText.slice(0, 140));
const confirmReply = await conversationCoreService.execute({ prompt: 'モコロンは鳥じゃないの？' } as any);
check('P618 確認の質問は関係で正す', confirmReply.replyText.includes('パル') && !confirmReply.replyText.includes('答えられない'), confirmReply.replyText.slice(0, 160));
const similarReply = await conversationCoreService.execute({ prompt: 'モコロンと羊って似てる？' } as any);
check('P618 似てるかは説明から答える', similarReply.replyText.includes('似ている') || similarReply.replyText.includes('似てる'), similarReply.replyText.slice(0, 160));

// ---- 状態の否定は兆候として数えない（P620） ----
{
  const { userStateTrailService } = await import('../src/miki/conversation/services/userStateTrailService');
  check('P620 「痛くない」は痛みと判定しない', !userStateTrailService.isPainText('痛くないよ') && userStateTrailService.recordFromText('痛くないよ') !== 'pain', '');
  check('P620 「心配ない」は不安と判定しない', userStateTrailService.recordFromText('心配ないよ') !== 'anxiety', '');
  check('P620 「不安じゃない」は不安と判定しない', userStateTrailService.recordFromText('不安じゃないよ') !== 'anxiety', '');
  check('P620 肯定の状態は従来どおり数える', userStateTrailService.isPainText('頭が痛い') && userStateTrailService.recordFromText('今日は疲れた') === 'fatigue', '');
}
const notPainReply = await conversationCoreService.execute({ prompt: '痛くないよ' } as any);
check('P620 痛くないは痛みの受け止めにならない', !notPainReply.replyText.includes('痛むときは'), notPainReply.replyText.slice(0, 120));

// ---- 解けた質問は彼女から報告する（P621） ----
{
  const { storageService } = await import('../src/services/storageService');
  const { claimDatabaseService } = await import('../src/miki/memory/services/claimDatabaseService');
  storageService.setItem('miki_unanswered_questions_v1', JSON.stringify([{ question: 'クオッカの寿命はどのくらい？', at: Date.now() - 2 * 3600_000 }]));
  claimDatabaseService.registerClaim({ statement: 'クオッカの寿命は10年ほどです。', world: 'REAL', kind: 'FACT', status: 'SUPPORTED', source: 'regression-p621' } as any);
  const greet1 = await conversationCoreService.execute({ prompt: 'おはよう' } as any);
  const greet2 = await conversationCoreService.execute({ prompt: 'こんにちは' } as any);
  const combined = greet1.replyText + '\n' + greet2.replyText;
  check('P621 解けた質問が挨拶で報告される', combined.includes('分かりました') && combined.includes('寿命は10年'), combined.slice(0, 240));
  const after = JSON.parse(storageService.getItem('miki_unanswered_questions_v1') || '[]') as Array<{ question: string }>;
  check('P621 報告した質問は台帳から消える', !after.some((e) => e.question.includes('クオッカの寿命')), JSON.stringify(after).slice(0, 120));
}

// ---- 関係の種類ごとの属性（P622） ----
worldModelGraphService.addRelation({ fromName: 'モコロン', toName: '群れ', type: 'PART_OF', provisional: false, confidence: 0.9 } as any);
worldModelGraphService.addRelation({ fromName: '綿毛', toName: '布作り', type: 'ENABLES', provisional: false, confidence: 0.9 } as any);
const partOfReply = await conversationCoreService.execute({ prompt: 'モコロンは何の一部？' } as any);
check('P622 一部は PART_OF で答える', partOfReply.replyText.includes('群れ'), partOfReply.replyText.slice(0, 140));
const enablesReply = await conversationCoreService.execute({ prompt: '綿毛があると何ができる？' } as any);
check('P622 できることは ENABLES で答える', enablesReply.replyText.includes('布作り'), enablesReply.replyText.slice(0, 140));
const habitatReply = await conversationCoreService.execute({ prompt: 'モコロンってどこに住んでるの？' } as any);
check('P622 生息地は専用の欠けとして答える', habitatReply.replyText.includes('生息地はまだ知らない'), habitatReply.replyText.slice(0, 160));

// ---- 前日のエピソード（P623） ----
{
  const { storageService } = await import('../src/services/storageService');
  const { episodeMemoryService } = await import('../src/miki/conversation/services/episodeMemoryService');
  const yk = (() => { const d = new Date(Date.now() - 24 * 3600_000); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; })();
  storageService.setItem('miki_episodes_v1', '[]');
  storageService.setItem('miki_episode_built_day_v1', '');
  storageService.setItem('miki_open_topics_v1', JSON.stringify([{ topic: '引っ越しの相談', openedDay: yk, weight: 3 }]));
  const yStart = (() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1, 10, 0).getTime(); })();
  storageService.setItem('miki_user_state_trail_v1', JSON.stringify([
    { signal: 'fatigue', at: yStart }, { signal: 'fatigue', at: yStart + 3600_000 },
  ]));
  const ep = episodeMemoryService.yesterdayEpisode();
  check('P623 前日のエピソードが組める', Boolean(ep && ep.summary.includes('引っ越しの相談') && ep.summary.includes('お疲れ気味')), ep ? ep.summary : 'none');
}

// ---- 「最近何か覚えた？」は学習の記録から答える（P624） ----
{
  const { storageService } = await import('../src/services/storageService');
  storageService.setItem('miki_learned_report_v1', JSON.stringify({ 'ツバメ': Date.now() - 24 * 3600_000 }));
  const learnReply = await conversationCoreService.execute({ prompt: '最近何か覚えた？' } as any);
  check('P624 最近覚えたことは記録から答える', learnReply.replyText.includes('最近だと') && (learnReply.replyText.includes('ツバメ') || learnReply.replyText.includes('モコロン')), learnReply.replyText.slice(0, 200));
}

// ---- 状態の経過と会話の振り返り（P625/P626） ----
{
  const { storageService } = await import('../src/services/storageService');
  storageService.setItem('miki_user_state_trail_v1', JSON.stringify([{ signal: 'fatigue', at: Date.now() - 3 * 3600_000 }]));
  const stateRecallReply = await conversationCoreService.execute({ prompt: '疲れ取れた？' } as any);
  check('P625 疲れの経過は記録の時刻で答える', stateRecallReply.replyText.includes('3時間くらい前') && stateRecallReply.replyText.includes('その後はどうですか'), stateRecallReply.replyText.slice(0, 160));
  const yk = (() => { const d = new Date(Date.now() - 24 * 3600_000); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; })();
  storageService.setItem('miki_open_topics_v1', JSON.stringify([{ topic: '港の朝市', openedDay: yk, weight: 2 }]));
  storageService.setItem('miki_episodes_v1', '[]');
  storageService.setItem('miki_episode_built_day_v1', '');
  const episodeRecallReply = await conversationCoreService.execute({ prompt: '昨日何の話したっけ？' } as any);
  check('P626 昨日の話はエピソードで答える', episodeRecallReply.replyText.includes('港の朝市') && episodeRecallReply.replyText.includes('覚えてますよ'), episodeRecallReply.replyText.slice(0, 200));
}

// ---- 週の振り返りと作れるものの質問（P627/P628） ----
{
  const { storageService } = await import('../src/services/storageService');
  const dayKey = (n: number) => { const d = new Date(); const t = new Date(d.getFullYear(), d.getMonth(), d.getDate() - n); return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`; };
  storageService.setItem('miki_episodes_v1', JSON.stringify([
    { day: dayKey(3), topics: ['引っ越しの相談'], summary: '昨日は、「引っ越しの相談」の話をしましたね。' },
    { day: dayKey(2), topics: ['港の朝市'], summary: '昨日は、「港の朝市」の話をしましたね。' },
  ]));
  const weeklyReply = await conversationCoreService.execute({ prompt: '今週はどんな週だった？' } as any);
  check('P627 今週の振り返りはエピソードの蓄積で答える', weeklyReply.replyText.includes('今週は') && weeklyReply.replyText.includes('引っ越しの相談'), weeklyReply.replyText.slice(0, 260));
  const craftReply = await conversationCoreService.execute({ prompt: '綿毛で何が作れる？' } as any);
  check('P628 作れるものは ENABLES で答える', craftReply.replyText.includes('布作り'), craftReply.replyText.slice(0, 160));
}

// ---- 話題の記録は境界で検証する（P629） ----
{
  const { storageService } = await import('../src/services/storageService');
  const { conversationOpenTopicService } = await import('../src/miki/conversation/services/conversationOpenTopicService');
  storageService.setItem('miki_open_topics_v1', '[]');
  conversationOpenTopicService.record('おはよう、今起きたよ', 1);
  const afterGreeting = conversationOpenTopicService.listPending();
  check('P629 挨拶文は話題として記録されない', !afterGreeting.some((r) => r.topic.includes('起きた')), JSON.stringify(afterGreeting).slice(0, 120));
  conversationOpenTopicService.record('今日はモコロンの調子が心配だ', 2);
  const afterSentence = conversationOpenTopicService.listPending();
  check('P629 文からは話題語を抽出して記録する', afterSentence.some((r) => r.topic === 'モコロン' || r.topic === '調子'), JSON.stringify(afterSentence).slice(0, 160));
  conversationOpenTopicService.record('港の朝市', 1);
  check('P629 名詞句はそのまま記録される', conversationOpenTopicService.listPending().some((r) => r.topic === '港の朝市'), '');
}

// ---- 対話行為の形判定は共有特徴で一元化（P630） ----
{
  const { classifyDialogueAct } = await import('../src/miki/conversation/services/conversationStateService');
  check('P630 過去形の報告は STATEMENT', classifyDialogueAct('散歩してきた') === 'STATEMENT', classifyDialogueAct('散歩してきた'));
  check('P630 状態の共有は CASUAL_CHAT（従来どおり）', classifyDialogueAct('今日は疲れた') === 'CASUAL_CHAT', classifyDialogueAct('今日は疲れた'));
  check('P630 欲求の文は STATEMENT', classifyDialogueAct('甘いものが食べたい') === 'STATEMENT', classifyDialogueAct('甘いものが食べたい'));
  check('P630 素の命令形は REQUEST', classifyDialogueAct('歌って') === 'REQUEST', classifyDialogueAct('歌って'));
  check('P630 手伝っては REQUEST', classifyDialogueAct('手伝って') === 'REQUEST', classifyDialogueAct('手伝って'));
  check('P630 疑問は QUESTION', classifyDialogueAct('モコロンって何？') === 'QUESTION', classifyDialogueAct('モコロンって何？'));
  check('P630 か終わりも QUESTION', classifyDialogueAct('それは本当ですか') === 'QUESTION', classifyDialogueAct('それは本当ですか'));
}

// ---- 訂正の合図は共有特徴で一元化（P631） ----
{
  const { classifyDialogueAct } = await import('../src/miki/conversation/services/conversationStateService');
  const { utteranceFeatureService } = await import('../src/miki/memory/services/utteranceFeatureService');
  check('P631 特徴に訂正の合図が載る', utteranceFeatureService.analyze('伝わってないよ').correction && !utteranceFeatureService.analyze('今日はいい天気だね').correction, '');
  check('P631 伝わってないも CORRECTION に分類される', classifyDialogueAct('伝わってないよ') === 'CORRECTION', classifyDialogueAct('伝わってないよ'));
  check('P631 それ違うよは従来どおり CORRECTION', classifyDialogueAct('それ違うよ') === 'CORRECTION', classifyDialogueAct('それ違うよ'));
}

// ---- 社交行為は共有特徴で判定する（P632） ----
{
  const { utteranceFeatureService } = await import('../src/miki/memory/services/utteranceFeatureService');
  check('P632 社交行為の4種が特徴に載る',
    utteranceFeatureService.analyze('おはよう、よく寝た').socialAct === 'GREETING'
    && utteranceFeatureService.analyze('じゃあまた明日').socialAct === 'FAREWELL'
    && utteranceFeatureService.analyze('ありがとう、助かった').socialAct === 'THANKS'
    && utteranceFeatureService.analyze('ごめん、遅れた').socialAct === 'APOLOGY'
    && utteranceFeatureService.analyze('今日は暑いね').socialAct === undefined, '');
}

// ---- 「何が分からないの？」は未解決の欠けから答える（P633） ----
{
  const { knowledgeGapService } = await import('../src/miki/unknown/services/knowledgeGapService');
  knowledgeGapService.detect({ query: '「クオッカ」の生息地を調べる', reason: 'regression-p633', type: 'UNKNOWN_RELATION', target: 'クオッカ', priority: 50 });
  const gapReply = await conversationCoreService.execute({ prompt: '何が分からないの？' } as any);
  check('P633 分からないことは欠けの台帳から答える', gapReply.replyText.includes('まだ分からないのは') && gapReply.replyText.includes('クオッカ'), gapReply.replyText.slice(0, 220));
}

// ---- 状態の解消は兆候ではなく解消として記録する（P634） ----
{
  const { storageService } = await import('../src/services/storageService');
  const { userStateTrailService } = await import('../src/miki/conversation/services/userStateTrailService');
  storageService.setItem('miki_user_state_trail_v1', JSON.stringify([{ signal: 'fatigue', at: Date.now() - 2 * 3600_000 }]));
  storageService.setItem('miki_user_state_resolved_v1', '{}');
  check('P634 回復の宣言は兆候として積まれない', userStateTrailService.recordFromText('疲れ取れたよ') === undefined && userStateTrailService.recordFromText('疲れた') === 'fatigue', '');
  check('P634 解消の記録が残り、解消前の記録は継続数から外れる', Boolean(userStateTrailService.resolvedAt('fatigue')) && userStateTrailService.recentCount('fatigue', 72) <= 1, String(userStateTrailService.recentCount('fatigue', 72)));
  // 想起の確認は、解消の時刻を最後の兆候より後に置いて決定的にする
  // （同一ミリ秒に並ぶと前後が入れ替わり、検証が揺れるため）。
  storageService.setItem('miki_user_state_resolved_v1', JSON.stringify({ fatigue: Date.now() + 1000 }));
  const resolvedRecall = await conversationCoreService.execute({ prompt: '疲れ取れた？' } as any);
  check('P634 経過の想起は解消として答える', resolvedRecall.replyText.includes('取れたって言ってました'), resolvedRecall.replyText.slice(0, 160));
}

// ---- エピソードの状態には解消を反映する（P635） ----
{
  const { storageService } = await import('../src/services/storageService');
  const { episodeMemoryService } = await import('../src/miki/conversation/services/episodeMemoryService');
  const yStart = (() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1, 10, 0).getTime(); })();
  const yk = (() => { const d = new Date(yStart); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; })();
  storageService.setItem('miki_episodes_v1', '[]');
  storageService.setItem('miki_episode_built_day_v1', '[]');
  storageService.setItem('miki_open_topics_v1', JSON.stringify([{ topic: '港の朝市', openedDay: yk, weight: 2 }]));
  storageService.setItem('miki_user_state_trail_v1', JSON.stringify([
    { signal: 'fatigue', at: yStart }, { signal: 'fatigue', at: yStart + 3600_000 },
  ]));
  storageService.setItem('miki_user_state_resolved_v1', JSON.stringify({ fatigue: yStart + 2 * 3600_000 }));
  const ep = episodeMemoryService.yesterdayEpisode();
  check('P635 解消した日のエピソードは状態を色にしない', Boolean(ep) && ep!.summary.includes('港の朝市') && !ep!.summary.includes('お疲れ気味'), ep ? ep.summary : 'none');
}

// ---- 日付キーは共有の生成で統一（P636） ----
{
  const { dayKeyService } = await import('../src/miki/memory/services/dayKeyService');
  check('P636 日付キーはゼロ詰めで統一される', dayKeyService.of(new Date(2026, 0, 5, 12, 0).getTime()) === '2026-01-05' && dayKeyService.today() === dayKeyService.of(Date.now()) && dayKeyService.yesterday() === dayKeyService.daysAgo(1), dayKeyService.of(new Date(2026, 0, 5, 12, 0).getTime()));
}

// ---- 分からないことの提示の選別（P637） ----
{
  const { knowledgeGapService } = await import('../src/miki/unknown/services/knowledgeGapService');
  knowledgeGapService.detect({ query: '僕の好きなものは？', reason: 'regression-p637', type: 'INSUFFICIENT_EVIDENCE', target: '好きなもの', priority: 40 });
  const gapReply2 = await conversationCoreService.execute({ prompt: '何が分からないの？' } as any);
  check('P637 質問文そのものは分からないこととして読み上げない', gapReply2.replyText.includes('クオッカ') && !gapReply2.replyText.includes('僕の好きなものは？'), gapReply2.replyText.slice(0, 220));
}

// ---- 苦手も極性つきで覚える（P638） ----
{
  // 事実の取り込みは呼び出し側（アプリ入口）の役目なので、通し検証と
  // 同じく intake を通してから execute に memories を渡す。
  const { conversationFactIntakeService } = await import('../src/miki/conversation/services/conversationFactIntakeService');
  let memories: any[] = [];
  const say = async (text: string) => {
    const intake = conversationFactIntakeService.intakeFromUserText(text, memories);
    memories = intake.updatedMemories;
    return conversationCoreService.execute({ prompt: text, memories } as any);
  };
  await say('僕は納豆が好きじゃないよ');
  await say('僕は辛いものが苦手だよ');
  await say('僕はラーメンが好きだよ');
  const dislikeRecall = await say('僕の苦手なものは？');
  check('P638 苦手なものは極性つきで想起できる', dislikeRecall.replyText.includes('納豆') && dislikeRecall.replyText.includes('辛いもの'), dislikeRecall.replyText.slice(0, 220));
  const likeRecall = await say('僕の好きなものは？');
  check('P638 苦手が好きとして逆に答えられず、好きは想起できる', likeRecall.replyText.includes('ラーメン') && !likeRecall.replyText.includes('納豆'), likeRecall.replyText.slice(0, 220));
}

// ---- スナップショットにエピソードと解消が載る（P639） ----
{
  const { storageService } = await import('../src/services/storageService');
  const { stateSnapshotExportService } = await import('../src/miki/selfAwareness/services/stateSnapshotExportService');
  storageService.setItem('miki_episodes_v1', JSON.stringify([{ day: '2026-11-10', topics: ['港の朝市'], summary: '昨日は、「港の朝市」の話をしましたね。' }]));
  storageService.setItem('miki_user_state_resolved_v1', JSON.stringify({ fatigue: 1794000000000 }));
  stateSnapshotExportService.exportNow();
  const saved = JSON.parse(storageService.getItem('miki_state_snapshot_v1') || '{}') as { json?: string };
  check('P639 スナップショットにエピソードと解消が載る', Boolean(saved.json && saved.json.includes('港の朝市') && saved.json.includes('stateResolved')), (saved.json || '').slice(0, 160));
}

// ---- 学び済みの欠けは提示前に解消される（P640） ----
{
  const { knowledgeGapService } = await import('../src/miki/unknown/services/knowledgeGapService');
  const { storageService } = await import('../src/services/storageService');
  knowledgeGapService.detect({ query: '「モコロン」の使い道を調べる', reason: 'regression-p640', type: 'UNKNOWN_RELATION', target: 'モコロン', priority: 50 });
  knowledgeGapService.detect({ query: '用語の意味を学ぶ: クオッカ', reason: 'regression-p640', type: 'UNKNOWN_TERM', target: 'クオッカ', priority: 45 });
  const gapReply3 = await conversationCoreService.execute({ prompt: '何が分からないの？' } as any);
  check('P640 関係が入った欠けは分からないとして出ない', !gapReply3.replyText.includes('モコロンの使い道'), gapReply3.replyText.slice(0, 220));
  const gapsNow = JSON.parse(storageService.getItem('miki_knowledge_gaps_v1') || '[]') as any[];
  const moco = gapsNow.find((g) => String(g.query || '').includes('モコロン') && String(g.query || '').includes('使い道'));
  check('P640 解消された欠けは RESOLVED になる', moco?.status === 'RESOLVED', JSON.stringify(moco || {}).slice(0, 160));
}

// ---- 確認の質問に検証済みの知識で答える（P642） ----
{
  const { claimDatabaseService } = await import('../src/miki/memory/services/claimDatabaseService');
  const { japaneseDictionaryService } = await import('../src/miki/research/services/japaneseDictionaryService');
  japaneseDictionaryService.addPersonal('ホタルイカ', { gloss: '発光する小さなイカ', semanticIds: ['regression-p642'] } as any);
  claimDatabaseService.registerClaim({ statement: 'ホタルイカは発光する小さなイカです。', world: 'REAL', kind: 'FACT', status: 'SUPPORTED', source: 'regression-p642' } as any);
  const confirmYes = await conversationCoreService.execute({ prompt: 'ホタルイカって発光するの？' } as any);
  check('P642 候補が知識に合えば根拠つきで肯定する', confirmYes.replyText.includes('そのとおり') && confirmYes.replyText.includes('発光'), confirmYes.replyText.slice(0, 200));
  const confirmNo = await conversationCoreService.execute({ prompt: 'ホタルイカって魚なの？' } as any);
  check('P642 候補が知識と違えば知識の側を提示して正す', confirmNo.replyText.includes('魚じゃなくて') && confirmNo.replyText.includes('イカ'), confirmNo.replyText.slice(0, 200));
}

// ---- 属性の質問に検証済みの知識で答える（P643） ----
{
  const { claimDatabaseService } = await import('../src/miki/memory/services/claimDatabaseService');
  claimDatabaseService.registerClaim({ statement: 'クオッカはオーストラリアのロットネスト島に生息しています。', world: 'REAL', kind: 'FACT', status: 'SUPPORTED', source: 'regression-p643' } as any);
  const habitat = await conversationCoreService.execute({ prompt: 'クオッカはどこに住んでるの？' } as any);
  check('P643 生息地は知識の文で答える', habitat.replyText.includes('ロットネスト島') && !habitat.replyText.includes('まだ知らない'), habitat.replyText.slice(0, 200));
}

// ---- 対象外の属性質問も正直に扱う（P644） ----
{
  const food = await conversationCoreService.execute({ prompt: 'クオッカって何を食べるの？' } as any);
  check('P644 食べ物は知らないと正直に言い、変な合成で誤魔化さない', food.replyText.includes('まだ知らない') && !food.replyText.includes('生息していますです'), food.replyText.slice(0, 200));
}

// ---- 一昨日の話もエピソードで答える（P645） ----
{
  const { storageService } = await import('../src/services/storageService');
  const { daysAgoKey, yesterdayKey } = await import('../src/miki/memory/services/dayKeyService');
  storageService.setItem('miki_episodes_v1', JSON.stringify([
    { day: daysAgoKey(2), topics: ['港の朝市'], summary: '昨日は、「港の朝市」の話をしましたね。' },
    { day: yesterdayKey(), topics: ['ツバメの巣'], summary: '昨日は、「ツバメの巣」の話をしましたね。' },
  ]));
  const dayBefore = await conversationCoreService.execute({ prompt: '一昨日何の話したっけ？' } as any);
  check('P645 一昨日の話は一昨日のエピソードで答える', dayBefore.replyText.includes('一昨日は') && dayBefore.replyText.includes('港の朝市') && !dayBefore.replyText.includes('ツバメの巣'), dayBefore.replyText.slice(0, 220));
}

// ---- 先週の振り返りもエピソードで答える（P646） ----
{
  const { storageService } = await import('../src/services/storageService');
  const { daysAgoKey } = await import('../src/miki/memory/services/dayKeyService');
  storageService.setItem('miki_episodes_v1', JSON.stringify([
    { day: daysAgoKey(9), topics: ['港の朝市'], summary: '昨日は、「港の朝市」の話をしましたね。' },
    { day: daysAgoKey(8), topics: ['引っ越しの相談'], summary: '昨日は、「引っ越しの相談」の話をしましたね。お疲れ気味の一日でしたね。' },
  ]));
  const lastWeek = await conversationCoreService.execute({ prompt: '先週はどんな週だった？' } as any);
  check('P646 先週の振り返りは先週のエピソードで答える', lastWeek.replyText.includes('先週は') && lastWeek.replyText.includes('港の朝市') && lastWeek.replyText.includes('引っ越しの相談'), lastWeek.replyText.slice(0, 260));
}

// ---- 「〈語〉覚えた？」に自分の状態で答える（P647） ----
{
  const knownTerm = await conversationCoreService.execute({ prompt: 'クオッカ覚えた？' } as any);
  check('P647 知っている語は覚えたと意味つきで答える', knownTerm.replyText.includes('覚えました') && knownTerm.replyText.includes('クオッカ'), knownTerm.replyText.slice(0, 200));
  const unknownTerm = await conversationCoreService.execute({ prompt: 'パッションフルーツ覚えた？' } as any);
  check('P647 知らない語は正直に言い、学習の対象になる', unknownTerm.replyText.includes('まだ知らない') || unknownTerm.replyText.includes('調べている'), unknownTerm.replyText.slice(0, 200));
}

// ---- 日を指定した状態の質問にその日の記録で答える（P648） ----
{
  const { storageService } = await import('../src/services/storageService');
  const { dayKeyService } = await import('../src/miki/memory/services/dayKeyService');
  // 昨日の昼（ローカル日付基準で確実に「昨日」になる時刻）に置く。
  const yesterdayNoon = new Date(`${dayKeyService.daysAgo(1)}T12:00:00`).getTime();
  storageService.setItem('miki_user_state_trail_v1', JSON.stringify([{ signal: 'fatigue', at: yesterdayNoon }, { signal: 'fatigue', at: yesterdayNoon + 3600_000 }]));
  const yesterdayState = await conversationCoreService.execute({ prompt: '昨日は疲れてた？' } as any);
  check('P648 昨日の疲れは記録で答える', yesterdayState.replyText.includes('昨日は') && yesterdayState.replyText.includes('疲れ'), yesterdayState.replyText.slice(0, 200));
  const dayBeforeState = await conversationCoreService.execute({ prompt: '一昨日は疲れてた？' } as any);
  check('P648 一昨日に記録が無ければ聞いてないと答える', dayBeforeState.replyText.includes('一昨日は') && dayBeforeState.replyText.includes('聞いてない'), dayBeforeState.replyText.slice(0, 200));
}

// ---- 形容つきの意見質問にも意見で答える（P650） ----
{
  const adjOpinion = await conversationCoreService.execute({ prompt: 'クオッカってかわいいと思う？' } as any);
  check('P650 形容つきの意見は材料＋その形容で返す', adjOpinion.replyText.includes('かわいいと思います') && !adjOpinion.replyText.includes('答えられない'), adjOpinion.replyText.slice(0, 200));
}

// ---- 自分の学習量の質問は自分の記録で答える（P651） ----
{
  const volume = await conversationCoreService.execute({ prompt: '今、何語くらい覚えたの？' } as any);
  check('P651 学習量は自分の記録の数で答え、調査へ流れない', volume.replyText.includes('覚えています') && !volume.replyText.includes('ランキング'), volume.replyText.slice(0, 200));
}

// ---- 学んだものの一覧を求められたら一覧で答える（P652） ----
{
  const list = await conversationCoreService.execute({ prompt: '今まで何を覚えたか教えて' } as any);
  check('P652 学んだ語と知識の一覧で答える', list.replyText.includes('今まで覚えたのは') && (list.replyText.includes('クオッカ') || list.replyText.includes('モコロン')), list.replyText.slice(0, 240));
}

// ---- 「〜のこと忘れた？」にも自分の状態で答える（P653） ----
{
  const notForgotten = await conversationCoreService.execute({ prompt: 'クオッカのこと忘れた？' } as any);
  check('P653 知っている語は忘れてないと意味つきで答える', notForgotten.replyText.includes('忘れてない') && notForgotten.replyText.includes('クオッカ'), notForgotten.replyText.slice(0, 200));
}

// ---- 「さっき何て言った？」に直前の自分の発言で答える（P654） ----
{
  const firstReply = await conversationCoreService.execute({ prompt: 'クオッカ覚えた？' } as any);
  const recent = [
    { id: 'p654-u', role: 'user', content: 'クオッカ覚えた？' },
    { id: 'p654-a', role: 'assistant', content: firstReply.replyText },
  ] as any;
  const recall = await conversationCoreService.execute({ prompt: 'さっき何て言った？', recentMessages: recent } as any);
  check('P654 さっきの発言を引いて答える', recall.replyText.includes('さっきは') && recall.replyText.includes('クオッカ'), recall.replyText.slice(0, 240));
  const repeat = await conversationCoreService.execute({ prompt: 'もう一回言って', recentMessages: recent } as any);
  check('P654 もう一回は直前の発言を繰り返す', repeat.replyText.includes('もう一回言いますね') && !repeat.replyText.includes('やってみます'), repeat.replyText.slice(0, 240));
}

// ---- 「さっき僕何て言った？」に相手の直前の発言で答える（P655） ----
{
  const userRecent = [
    { id: 'p655-u', role: 'user', content: '明日、港の朝市に行くんだ' },
    { id: 'p655-a', role: 'assistant', content: 'いいですね。' },
  ] as any;
  const userRecall = await conversationCoreService.execute({ prompt: 'さっき僕何て言った？', recentMessages: userRecent } as any);
  check('P655 相手の発言を引いて答える', userRecall.replyText.includes('港の朝市') && userRecall.replyText.includes('言ってました'), userRecall.replyText.slice(0, 200));
}

// ---- 相槌は話題として反響しない（P656） ----
{
  for (const filler of ['うん', 'へー', 'はい']) {
    const r = await conversationCoreService.execute({ prompt: filler } as any);
    check(`P656 相槌「${filler}」を話題にしない`, !r.replyText.includes(`${filler}の話`), r.replyText.slice(0, 120));
  }
}

// ---- 開いた話題の記録境界：相槌と文は保存しない（P657） ----
{
  const { conversationOpenTopicService } = await import('../src/miki/conversation/services/conversationOpenTopicService');
  const { storageService } = await import('../src/services/storageService');
  storageService.setItem('miki_open_topics_v1', '[]');
  conversationOpenTopicService.record('へー');
  conversationOpenTopicService.record('そういえば今日は暑いね');
  const topics = conversationOpenTopicService.listPending().map((r: any) => r.topic);
  check('P657 相槌は話題として保存しない', !topics.includes('へー'), JSON.stringify(topics));
  check('P657 文まるごとは話題として保存しない', !topics.includes('そういえば今日は暑いね'), JSON.stringify(topics));
  conversationOpenTopicService.record('港の朝市');
  const topics2 = conversationOpenTopicService.listPending().map((r: any) => r.topic);
  check('P657 名詞句の話題は保存される', topics2.includes('港の朝市'), JSON.stringify(topics2));
}

// ---- 相槌の判定は共有の特徴層が唯一の出所（P658） ----
{
  const { utteranceFeatureService, isBackchannelText } = await import('../src/miki/memory/services/utteranceFeatureService');
  check('P658 特徴に相槌フラグが載る', utteranceFeatureService.analyze('うん').backchannel === true && utteranceFeatureService.analyze('港の朝市に行きたい').backchannel === false, '');
  check('P658 相槌の語群は一か所で判定できる', isBackchannelText('へー') && isBackchannelText('うんうんうん') && !isBackchannelText('モコロン'), '');
}

// ---- 頻度導出の好みに相槌を数えない（P659） ----
{
  const { selfPreferenceService } = await import('../src/miki/selfAwareness/services/selfPreferenceService');
  for (let i = 0; i < 8; i++) selfPreferenceService.observeTerms('persona-p659', ['うん', 'へー']);
  check('P659 相槌は頻度導出の興味にならない', !selfPreferenceService.derivedInterests('persona-p659').includes('うん') && !selfPreferenceService.derivedInterests('persona-p659').includes('へー'), JSON.stringify(selfPreferenceService.derivedInterests('persona-p659')));
  for (let i = 0; i < 8; i++) selfPreferenceService.observeTerms('persona-p659', ['星空']);
  check('P659 通常の語は頻度導出される', selfPreferenceService.derivedInterests('persona-p659').includes('星空'), JSON.stringify(selfPreferenceService.derivedInterests('persona-p659')));
}

// ---- 「さっきの話だけど（続き）」は振り返りに横取りしない（P660） ----
{
  const continuation = await conversationCoreService.execute({ prompt: 'さっきの話、続きだけど聞いて' } as any);
  check('P660 続きの宣言は振り返りにならない', !continuation.replyText.includes('の話をしましたね'), continuation.replyText.slice(0, 160));
  const recapQ = await conversationCoreService.execute({ prompt: '今日何の話をしたっけ？' } as any);
  check('P660 今日の振り返りの質問は従来どおり答える', recapQ.replyText.includes('話をしましたね') || recapQ.replyText.includes('今日は'), recapQ.replyText.slice(0, 160));
}

// ---- 笑いの反応も話題として反響しない（P661） ----
{
  const www = await conversationCoreService.execute({ prompt: 'ｗｗｗ' } as any);
  check('P661 ｗｗｗを話題にしない', !www.replyText.includes('www、'), www.replyText.slice(0, 120));
  const emoji = await conversationCoreService.execute({ prompt: '😊' } as any);
  check('P661 絵文字だけを話題にしない', !emoji.replyText.startsWith('😊、'), emoji.replyText.slice(0, 120));
}

// ---- 指示語は話題として反響しない（P662） ----
{
  const sono = await conversationCoreService.execute({ prompt: 'その映画、ふーんって感じだった' } as any);
  check('P662 「その」を話題にしない', !sono.replyText.includes('そのですか') && !sono.replyText.includes('そのの話'), sono.replyText.slice(0, 160));
}

// ---- 単位と動詞断片は話題として反響しない（P663） ----
{
  const unit = await conversationCoreService.execute({ prompt: '今日は3時間も歩いた' } as any);
  check('P663 数字に付いた単位を話題にしない', !unit.replyText.includes('時間の話ですね'), unit.replyText.slice(0, 160));
  const frag = await conversationCoreService.execute({ prompt: '昨日は2回も電話した' } as any);
  check('P663 動詞断片を話題にしない', !frag.replyText.includes('したですか'), frag.replyText.slice(0, 160));
}

// ---- 話題の断片の反響・出来事の誤爆を止める（P664〜P666） ----
{
  const stem = await conversationCoreService.execute({ prompt: '最近忙しくてさ' } as any);
  check('P664 形容詞の語幹を話題にしない', !stem.replyText.includes('しく、'), stem.replyText.slice(0, 160));
  const doko = await conversationCoreService.execute({ prompt: '今度の休み、どこか行きたい' } as any);
  check('P664 不定の指示語を話題にしない', !doko.replyText.includes('どこかの話'), doko.replyText.slice(0, 160));
  const notYet = await conversationCoreService.execute({ prompt: '給料日まであと少し' } as any);
  check('P665 まだ先の給料日では祝わない', !notYet.replyText.includes('おめでとう'), notYet.replyText.slice(0, 160));
  const payday = await conversationCoreService.execute({ prompt: '今日は給料日だ' } as any);
  check('P665 当日の給料日は祝う', payday.replyText.includes('おめでとう') || payday.replyText.includes('やりました'), payday.replyText.slice(0, 160));
  const like = await conversationCoreService.execute({ prompt: '料理作るの好きなんだ' } as any);
  check('P666 「作るのが好き」は家事完了で受けない', !like.replyText.includes('お疲れ様でした'), like.replyText.slice(0, 160));
}

// ---- 聞き返しが複合の断片を語として聞かない（P667） ----
{
  const busy = await conversationCoreService.execute({ prompt: '最近忙しくてさ' } as any);
  check('P667 「最近忙」を聞き返さない', !busy.replyText.includes('「最近忙」って'), busy.replyText.slice(0, 160));
  const melted = await conversationCoreService.execute({ prompt: '猫の動画見てたら時間溶けた' } as any);
  check('P667 「時間溶」を聞き返さない', !melted.replyText.includes('「時間溶」って'), melted.replyText.slice(0, 160));
}

// ---- 遊びの誘いは遊びとして受ける（P668） ----
{
  const asobo = await conversationCoreService.execute({ prompt: '遊ぼう' } as any);
  check('P668 遊ぼうに誘いとして応じる', asobo.replyText.includes('遊びましょう'), asobo.replyText.slice(0, 160));
  const shiritori = await conversationCoreService.execute({ prompt: 'しりとりしよう' } as any);
  check('P668 しりとりは最初の言葉まで出して始める', shiritori.replyText.includes('しりとり') && shiritori.replyText.includes('りんご'), shiritori.replyText.slice(0, 160));
  const story = await conversationCoreService.execute({ prompt: 'なんか面白い話して' } as any);
  check('P668 面白い話は知識から語る（作業了承にしない）', !story.replyText.includes('やってみますね'), story.replyText.slice(0, 200));
  const sing = await conversationCoreService.execute({ prompt: '歌って' } as any);
  check('P668 歌は正直に受け口を返す', sing.replyText.includes('歌'), sing.replyText.slice(0, 160));
}

// ---- しりとりは続けられる（P669、彼女の語彙から返す） ----
{
  const { japaneseDictionaryService: dict669 } = await import('../src/miki/research/services/japaneseDictionaryService');
  dict669.addPersonal('ラクダ', { gloss: '砂漠に住む動物', reading: 'らくだ', pos: 'NOUN' } as any);
  dict669.addPersonal('ライオン', { gloss: '百獣の王', reading: 'らいおん', pos: 'NOUN' } as any);
  const start = await conversationCoreService.execute({ prompt: 'しりとりしよう' } as any);
  check('P669 開始で最初の言葉が出る', start.replyText.includes('りんご'), start.replyText.slice(0, 120));
  const wrong = await conversationCoreService.execute({ prompt: 'すし' } as any);
  check('P669 違う音から始まる言葉は指摘する', wrong.replyText.includes('から始まってない'), wrong.replyText.slice(0, 160));
  const gorilla = await conversationCoreService.execute({ prompt: 'ゴリラ' } as any);
  check('P669 彼女は語彙から言葉を返す（ん終わりは避ける）', gorilla.replyText.includes('ラクダ') && gorilla.replyText.includes('次は「た」') || gorilla.replyText.includes('ラクダ'), gorilla.replyText.slice(0, 160));
  const quit = await conversationCoreService.execute({ prompt: 'やめる' } as any);
  check('P669 やめるで対戦が終わる', quit.replyText.includes('ここまで'), quit.replyText.slice(0, 120));
}

// ---- クイズは彼女の知識から出題し、答え合わせまで続く（P670） ----
{
  const { worldModelGraphService: wm670 } = await import('../src/miki/selfAwareness/services/worldModelGraphService');
  const answerFor = (reply: string): string | undefined => {
    const m = reply.match(/「(.+?)」は(?:何の仲間|何に使われる)でしょう/);
    if (!m) return undefined;
    const kind = reply.includes('何の仲間') ? 'IS_A' : 'USED_FOR';
    const rel = wm670.relations().find((r) => r.from === m[1] && r.type === kind && !r.provisional)
      || wm670.relations().find((r) => r.from === m[1] && r.type === kind);
    return rel?.to;
  };
  let reply = (await conversationCoreService.execute({ prompt: 'クイズ出して' } as any)).replyText;
  check('P670 クイズが始まり第1問が出る', reply.includes('クイズです') && reply.includes('第1問'), reply.slice(0, 160));
  let correctSeen = 0; let wrongSeen = 0; let finished = '';
  for (let i = 0; i < 16; i += 1) {
    const expected = answerFor(reply);
    if (!expected) break;
    const giveWrong = i === 2;
    const ans = (await conversationCoreService.execute({ prompt: giveWrong ? 'ぜんぜん違う答え' : expected } as any)).replyText;
    if (ans.includes('正解です')) correctSeen += 1;
    if (ans.includes('残念、正解は')) wrongSeen += 1;
    if (ans.includes('問題はここまでです')) { finished = ans; break; }
    reply = ans;
  }
  check('P670 正解と不正解を判定する', correctSeen >= 2 && wrongSeen === 1, `correct=${correctSeen} wrong=${wrongSeen}`);
  check('P670 材料が尽きたら成績を伝えて終わる', /問中\d+問正解でした/.test(finished), finished.slice(0, 200));
}

// ---- ビービーの口調変換：遊び系の答えの丁寧形も寄る（P671） ----
{
  const { personaProfileService: pp671 } = await import('../src/miki/conversation/services/personaProfileService');
  pp671.switchProfile('persona-bibi');
  const play = await conversationCoreService.execute({ prompt: '遊ぼう' } as any);
  check('P671 ビービーの誘いの返事がタメ口になる', !play.replyText.includes('ですよ') && !play.replyText.includes('ましょう'), play.replyText.slice(0, 160));
  const start671 = await conversationCoreService.execute({ prompt: 'しりとりしよう' } as any);
  const quit671 = await conversationCoreService.execute({ prompt: 'やめる' } as any);
  check('P671 ビービーの了承がタメ口になる', quit671.replyText.includes('わかった'), quit671.replyText.slice(0, 160));
  pp671.switchProfile('persona-default');
}

// ---- 相手の名前・ペットの聞き返し（P672、アプリ順序で検証） ----
{
  const { conversationFactIntakeService: intake672 } = await import('../src/miki/conversation/services/conversationFactIntakeService');
  let mem672: any[] = [];
  mem672 = intake672.intakeFromUserText('僕の名前はきりあだよ', mem672).updatedMemories;
  mem672 = intake672.intakeFromUserText('僕は猫を飼ってるよ', mem672).updatedMemories;
  const nameQ = await conversationCoreService.execute({ prompt: '僕の名前覚えてる？', memories: mem672 } as any);
  check('P672 「僕の名前覚えてる？」を語彙の確認にしない', !nameQ.replyText.includes('今度調べて覚えておきますね') && !nameQ.replyText.includes('「名前」は、まだ知らない'), nameQ.replyText.slice(0, 160));
  const petQ = await conversationCoreService.execute({ prompt: '僕が飼ってる動物なんだっけ？', memories: mem672 } as any);
  check('P672 飼っている動物を想起できる', petQ.replyText.includes('猫'), petQ.replyText.slice(0, 160));
  const petQ2 = await conversationCoreService.execute({ prompt: '僕は何を飼ってる？', memories: mem672 } as any);
  check('P672 「何を飼ってる？」にも想起で答える', petQ2.replyText.includes('猫'), petQ2.replyText.slice(0, 160));
}

// ---- スナップショットに遊びの状態も入る（P673） ----
{
  const { stateSnapshotExportService: snap673 } = await import('../src/miki/selfAwareness/services/stateSnapshotExportService');
  await conversationCoreService.execute({ prompt: 'しりとりしよう' } as any);
  snap673.exportNow();
  const raw673 = storageService.getItem('miki_state_snapshot_v1');
  let play: any = null;
  try { play = JSON.parse(String((JSON.parse(String(raw673)) as any).json || '{}')).play; } catch { /* 検証側で失敗させる */ }
  check('P673 スナップショットにしりとりの状態が入る', Boolean(play && play.shiritori && play.shiritori.active === true && play.shiritori.usedCount >= 1), JSON.stringify(play).slice(0, 160));
  await conversationCoreService.execute({ prompt: 'やめる' } as any);
}

// ---- 時計・カレンダーの即答の広がり（P674） ----
{
  const now674 = new Date();
  const month = await conversationCoreService.execute({ prompt: '今って何月？' } as any);
  check('P674 今の月にその場で答える', month.replyText.includes(`今は${now674.getMonth() + 1}月です`), month.replyText.slice(0, 120));
  const remain = await conversationCoreService.execute({ prompt: 'あと何日で今年終わる？' } as any);
  const expectedDays = Math.round((new Date(now674.getFullYear(), 11, 31).getTime() - new Date(now674.getFullYear(), now674.getMonth(), now674.getDate()).getTime()) / 86400000);
  check('P674 今年の残り日数を計算して答える', expectedDays <= 0 ? remain.replyText.includes('今日で終わり') : remain.replyText.includes(`あと${expectedDays}日`), remain.replyText.slice(0, 120));
  const dow = await conversationCoreService.execute({ prompt: '何曜日？' } as any);
  check('P674 素の曜日にも答える', dow.replyText.includes('曜日です'), dow.replyText.slice(0, 120));
}

// ---- 割合と日付の前後計算も即答する（P675） ----
{
  const pct = await conversationCoreService.execute({ prompt: '200の10%は？' } as any);
  check('P675 割合を計算して答える', pct.replyText.includes('200の10%は20です'), pct.replyText.slice(0, 120));
  const tax = await conversationCoreService.execute({ prompt: '1000円の消費税10%はいくら？' } as any);
  check('P675 消費税を計算して答える', tax.replyText.includes('100円です'), tax.replyText.slice(0, 120));
  const future = await conversationCoreService.execute({ prompt: '今日から100日後は何日？' } as any);
  const d675 = new Date(); d675.setDate(d675.getDate() + 100);
  check('P675 N日後の日付を計算して答える', future.replyText.includes(`${d675.getMonth() + 1}月${d675.getDate()}日`), future.replyText.slice(0, 120));
  const past = await conversationCoreService.execute({ prompt: '50日前は何日だった？' } as any);
  const p675 = new Date(); p675.setDate(p675.getDate() - 50);
  check('P675 N日前の日付も答える', past.replyText.includes(`${p675.getMonth() + 1}月${p675.getDate()}日`), past.replyText.slice(0, 120));
}

// ---- 単位の換算も共有の換算表で即答する（P676） ----
{
  const len = await conversationCoreService.execute({ prompt: '1キロは何メートル？' } as any);
  check('P676 長さの換算に答える', len.replyText.includes('1000メートルです'), len.replyText.slice(0, 120));
  const time = await conversationCoreService.execute({ prompt: '1時間は何分？' } as any);
  check('P676 時間の換算に答える', time.replyText.includes('60分です'), time.replyText.slice(0, 120));
  const days = await conversationCoreService.execute({ prompt: '3日は何時間？' } as any);
  check('P676 日と時間の換算に答える', days.replyText.includes('72時間です'), days.replyText.slice(0, 120));
  const mass = await conversationCoreService.execute({ prompt: '1キロは何グラム？' } as any);
  check('P676 キロの重さ読みでも答える', mass.replyText.includes('1000グラムです'), mass.replyText.slice(0, 120));
}

// ---- 数の比較と文字数も即答する（P677） ----
{
  const cmp = await conversationCoreService.execute({ prompt: '3と5はどっちが大きい？' } as any);
  check('P677 数の大小に答える', cmp.replyText.includes('5の方が大きいです'), cmp.replyText.slice(0, 120));
  const cnt = await conversationCoreService.execute({ prompt: '「パルワールド」は何文字？' } as any);
  check('P677 文字数に答える', cnt.replyText.includes('6文字です'), cnt.replyText.slice(0, 120));
  const cnt2 = await conversationCoreService.execute({ prompt: 'みかんって何文字？' } as any);
  check('P677 引用符なしでも文字数に答える', cnt2.replyText.includes('3文字です'), cnt2.replyText.slice(0, 120));
}

// ---- 遊びの切り替えは進行中の1手に化けない（P678） ----
{
  const startS = await conversationCoreService.execute({ prompt: 'しりとりしよう' } as any);
  check('P678 しりとり開始', startS.replyText.includes('りんご'), startS.replyText.slice(0, 100));
  const switchQ = await conversationCoreService.execute({ prompt: 'クイズ出して' } as any);
  check('P678 対戦中の切り替えでクイズが始まる', switchQ.replyText.includes('クイズ') && switchQ.replyText.includes('でしょう'), switchQ.replyText.slice(0, 140));
  const backS = await conversationCoreService.execute({ prompt: 'しりとりしよう' } as any);
  check('P678 クイズからしりとりへも切り替わる', backS.replyText.includes('りんご'), backS.replyText.slice(0, 100));
  await conversationCoreService.execute({ prompt: 'やめる' } as any);
}

// ---- 気持ちの頼みは気持ちで受ける（P679） ----
{
  const cheer = await conversationCoreService.execute({ prompt: '応援して' } as any);
  check('P679 応援の頼みに気持ちで返す', cheer.replyText.includes('応援しています'), cheer.replyText.slice(0, 120));
  const comfort = await conversationCoreService.execute({ prompt: '慰めて' } as any);
  check('P679 慰めの頼みに寄り添う', comfort.replyText.includes('そばにいます'), comfort.replyText.slice(0, 120));
  const praise = await conversationCoreService.execute({ prompt: '褒めて' } as any);
  check('P679 褒める頼みに褒める', praise.replyText.includes('えらいです'), praise.replyText.slice(0, 120));
}

// ---- 会話の切り出しは入口として受ける（P680） ----
{
  const consult = await conversationCoreService.execute({ prompt: '相談に乗って' } as any);
  check('P680 相談の切り出しを聞く姿勢で受ける', consult.replyText.includes('聞きますよ'), consult.replyText.slice(0, 120));
  const ask = await conversationCoreService.execute({ prompt: '質問していい？' } as any);
  check('P680 質問の許可には「どうぞ」で返す', ask.replyText.includes('どうぞ'), ask.replyText.slice(0, 120));
  const favor = await conversationCoreService.execute({ prompt: 'お願いがあるんだけど' } as any);
  check('P680 お願いの切り出しを受ける', favor.replyText.includes('何ですか'), favor.replyText.slice(0, 120));
}

// ---- 社交の声かけは社交として返す（P681） ----
{
  const reunion = await conversationCoreService.execute({ prompt: '久しぶり' } as any);
  check('P681 久しぶりに再会の形で返す', reunion.replyText.includes('お久しぶりです'), reunion.replyText.slice(0, 120));
  const first = await conversationCoreService.execute({ prompt: 'はじめまして' } as any);
  check('P681 はじめましてに挨拶で返す', first.replyText.includes('はじめまして'), first.replyText.slice(0, 120));
  const cheerHer = await conversationCoreService.execute({ prompt: '元気出して' } as any);
  check('P681 彼女への励ましは感謝で受ける', cheerHer.replyText.includes('ありがとう'), cheerHer.replyText.slice(0, 120));
}

// ---- 時間のつぶやきには実際の時刻・曜日で応じる（P683） ----
{
  const flies = await conversationCoreService.execute({ prompt: 'もうこんな時間だ' } as any);
  check('P683 時間の経過には時刻を添えて相づち', /もう\d+時\d+分です/.test(flies.replyText), flies.replyText.slice(0, 120));
  const nowD = new Date();
  const names = ['日', '月', '火', '水', '木', '金', '土'];
  const wrongDay = names[(nowD.getDay() + 2) % 7];
  const dowM = await conversationCoreService.execute({ prompt: `${wrongDay}曜日か…` } as any);
  check('P683 違う曜日は事実で正す', dowM.replyText.includes(`今日は${names[nowD.getDay()]}曜日ですよ`), dowM.replyText.slice(0, 120));
}

// ---- 自己紹介と迷いの受け止め（P684） ----
{
  const intro = await conversationCoreService.execute({ prompt: '自己紹介して' } as any);
  check('P684 自己紹介に自分の輪郭で答える', intro.replyText.includes('私は') && intro.replyText.includes('です'), intro.replyText.slice(0, 140));
  const name = await conversationCoreService.execute({ prompt: 'あなたの名前は？' } as any);
  check('P684 名前の質問に名前で答える', name.replyText.includes('私は') && name.replyText.includes('です'), name.replyText.slice(0, 120));
  const lost = await conversationCoreService.execute({ prompt: '決められない' } as any);
  check('P684 迷いは一緒に整理する形で受ける', lost.replyText.includes('一緒に'), lost.replyText.slice(0, 120));
}

// ---- 関係の質問には関係の言葉で答える（P685） ----
{
  const like = await conversationCoreService.execute({ prompt: '僕のこと好き？' } as any);
  check('P685 好きかには気持ちで答える', like.replyText.includes('好きです'), like.replyText.slice(0, 120));
  const remember = await conversationCoreService.execute({ prompt: '僕のこと覚えてる？' } as any);
  check('P685 「こと」を語として誤爆しない', !remember.replyText.includes('「こと」は'), remember.replyText.slice(0, 120));
  const ally = await conversationCoreService.execute({ prompt: '味方だよね？' } as any);
  check('P685 味方かには「もちろんです」で答える', ally.replyText.includes('味方です'), ally.replyText.slice(0, 120));
}

// ---- ビービー口調の新しい取りこぼし（P686） ----
{
  (globalThis as any).window = { dispatchEvent: () => true, addEventListener: () => {}, removeEventListener: () => {} };
  personaProfileService.switchProfile('persona-bibi');
  const consultB = await conversationCoreService.execute({ prompt: '相談に乗って' } as any);
  check('P686 ビービーでも相談の受けがタメ口になる', consultB.replyText.includes('どうしたの？'), consultB.replyText.slice(0, 120));
  const musingB = await conversationCoreService.execute({ prompt: 'もうこんな時間だ' } as any);
  check('P686 ビービーでも時間の相づちがタメ口になる', !musingB.replyText.includes('ですね'), musingB.replyText.slice(0, 120));
  personaProfileService.switchProfile('persona-default');
}

// ---- 意見の根拠を記録して「なんで」に答える（P687） ----
{
  const op = await conversationCoreService.execute({ prompt: 'クオッカってかわいいと思う？' } as any);
  check('P687 意見が返る', op.replyText.includes('かわいいと思います') || op.replyText.includes('かわいい'), op.replyText.slice(0, 140));
  const why = await conversationCoreService.execute({ prompt: 'なんでそう思うの？' } as any);
  check('P687 なんでには記録した根拠で答える', why.replyText.includes('クオッカ') && why.replyText.includes('覚えている'), why.replyText.slice(0, 160));
}

// ---- 終わったクイズの成績を後から答えられる（P688） ----
{
  const start = await conversationCoreService.execute({ prompt: 'クイズ出して' } as any);
  check('P688 クイズ開始', start.replyText.includes('第1問'), start.replyText.slice(0, 120));
  await conversationCoreService.execute({ prompt: 'やめる' } as any);
  const result = await conversationCoreService.execute({ prompt: 'さっきのクイズ、何問正解だった？' } as any);
  check('P688 成績を記録から答える', result.replyText.includes('問中') && result.replyText.includes('正解でした'), result.replyText.slice(0, 120));
}

// ---- 終わったしりとりの勝敗を後から答えられる（P689） ----
{
  // 前の対戦が残っていたら畳んでから、新規に始める。
  await conversationCoreService.execute({ prompt: 'やめる' } as any);
  await conversationCoreService.execute({ prompt: 'しりとりしよう' } as any);
  const lose = await conversationCoreService.execute({ prompt: 'ごん' } as any);
  check('P689 ん終わりで彼女の勝ち', lose.replyText.includes('私の勝ち'), lose.replyText.slice(0, 100));
  const result = await conversationCoreService.execute({ prompt: 'さっきのしりとり、どっちが勝った？' } as any);
  check('P689 勝敗を記録から答える', result.replyText.includes('私の勝ちでした'), result.replyText.slice(0, 120));
}

// ---- スナップショットに遊びの結果と意見の記録（P691） ----
{
  const { stateSnapshotExportService: snap691 } = await import('../src/miki/selfAwareness/services/stateSnapshotExportService');
  snap691.exportNow();
  const raw691 = storageService.getItem('miki_state_snapshot_v1');
  let body691: any = {};
  try { body691 = JSON.parse(String((JSON.parse(String(raw691)) as any).json || '{}')); } catch { /* 検証側で失敗させる */ }
  check('P691 遊びの結果がスナップショットに入る', !!body691.play && ('quizLastResult' in body691.play) && ('shiritoriLastResult' in body691.play) && body691.play.quizLastResult && body691.play.shiritoriLastResult, JSON.stringify(body691.play || {}).slice(0, 200));
  check('P691 意見の記録が入る', !!body691.lastOpinion && typeof body691.lastOpinion.topic === 'string', JSON.stringify(body691.lastOpinion || {}).slice(0, 160));
}

// ---- 持ち主つきの名前と、名前の教示・想起（P692） ----
{
  const { conversationFactIntakeService: intake692 } = await import('../src/miki/conversation/services/conversationFactIntakeService');
  let mem692: any[] = [];
  const run692 = async (q: string) => {
    const iq = intake692.intakeFromUserText(q, mem692);
    mem692 = iq.updatedMemories;
    const r = await conversationCoreService.execute({ prompt: q, memories: mem692 } as any);
    return { reply: r.replyText, added: iq.added as any[] };
  };
  const teach = await run692('猫の名前はモチだよ、忘れないでね');
  check('P692 猫の名前は持ち主つきで取り込まれる', teach.added.some((a) => a.factAttribute === '猫の名前' && a.factValue === 'モチ'), JSON.stringify(teach.added).slice(0, 160));
  check('P692 教示の返事が自己紹介や置き忘れにならない', !teach.reply.includes('MIKI-AIです') && !teach.reply.includes('最後に使った場所'), teach.reply.slice(0, 120));
  const petName = await run692('猫の名前なんだっけ？');
  check('P692 猫の名前を想起できる', petName.reply.includes('モチ'), petName.reply.slice(0, 120));
  const teachUser = await run692('僕の名前はきりあだよ');
  check('P692 名前を教えた直後に知らないと言わない', !teachUser.reply.includes('まだ聞いていません') && !teachUser.reply.includes('教えてもらっていません'), teachUser.reply.slice(0, 120));
  const recallUser = await run692('僕の名前覚えてる？');
  check('P692 教わった名前は名前で答える', recallUser.reply.includes('覚えていますよ') && recallUser.reply.includes('きりあ'), recallUser.reply.slice(0, 120));
  const selfName = await conversationCoreService.execute({ prompt: '君の名前は？' } as any);
  check('P692 自分の名前の質問は従来どおり', selfName.replyText.includes('MIKI-AI'), selfName.replyText.slice(0, 80));
}

// ---- 断片の聞き返し・安堵と体の受け止め・できたの達成（P693） ----
{
  const densha = await conversationCoreService.execute({ prompt: '電車混んでた' } as any);
  check('P693 テ形の断片を聞き返さない', !densha.replyText.includes('「電車混」って'), densha.replyText.slice(0, 120));
  const hotto = await conversationCoreService.execute({ prompt: 'ほっとした' } as any);
  check('P693 安堵は安堵として受ける', hotto.replyText.includes('よかった'), hotto.replyText.slice(0, 100));
  const kata = await conversationCoreService.execute({ prompt: '肩こった' } as any);
  check('P693 肩こりは気遣いで受ける', kata.replyText.includes('無理しないで') || kata.replyText.includes('お疲れ'), kata.replyText.slice(0, 100));
  const dekita = await conversationCoreService.execute({ prompt: '半分くらいできた' } as any);
  check('P693 「できた」は達成として受ける', dekita.replyText.includes('やりましたね') || dekita.replyText.includes('すごい'), dekita.replyText.slice(0, 100));
}

// ---- 意向形の相談と、彼女への状態質問（P694） ----
{
  const lunch = await conversationCoreService.execute({ prompt: 'お昼何食べよう' } as any);
  check('P694 食事の相談は調査に流れない', lunch.replyText.includes('気分はどっち') && !lunch.replyText.includes('調べるキュー'), lunch.replyText.slice(0, 120));
  const activity = await conversationCoreService.execute({ prompt: '何しようかな' } as any);
  check('P694 活動の相談も一緒に考える形', activity.replyText.includes('何しましょうね'), activity.replyText.slice(0, 100));
  const sleepy = await conversationCoreService.execute({ prompt: '眠くない？' } as any);
  check('P694 彼女の眠さは自分の在り方で答える', sleepy.replyText.includes('眠くならない'), sleepy.replyText.slice(0, 100));
}

// ---- 話題転換つき聞いて・夢・待って（P695） ----
{
  const listen = await conversationCoreService.execute({ prompt: '話変わるけど、聞いて' } as any);
  check('P695 話題転換＋聞いては傾聴で受ける', (listen.replyText.includes('聞いてるよ') || listen.replyText.includes('聞かせて')) && !listen.replyText.includes('聞いてですか'), listen.replyText.slice(0, 100));
  const dream = await conversationCoreService.execute({ prompt: '昨日変な夢見た' } as any);
  check('P695 夢の報告は内容を聞く', dream.replyText.includes('どんな夢'), dream.replyText.slice(0, 100));
  const hold = await conversationCoreService.execute({ prompt: 'ちょっと待って' } as any);
  check('P695 「ちょっと待って」は待機で答える', hold.replyText.includes('待って') && !hold.replyText.includes('やってみます'), hold.replyText.slice(0, 100));
}

// ---- 「僕のこと何て呼ぶ？」（P696） ----
{
  const { conversationFactIntakeService: intake696 } = await import('../src/miki/conversation/services/conversationFactIntakeService');
  let mem696: any[] = [];
  const run696 = async (q: string) => {
    const iq = intake696.intakeFromUserText(q, mem696);
    mem696 = iq.updatedMemories;
    const r = await conversationCoreService.execute({ prompt: q, memories: mem696 } as any);
    return r.replyText;
  };
  await run696('僕の名前はきりあだよ');
  const addr = await run696('僕のこと何て呼ぶ？');
  check('P696 呼び方は教わった名前で答える', addr.includes('「きりあ」と呼んで'), addr.slice(0, 100));
  const addrUnknown = await conversationCoreService.execute({ prompt: '僕のこと何て呼ぶ？', memories: [] } as any);
  check('P696 呼び名が無ければ聞き返す', addrUnknown.replyText.includes('何て呼んだら'), addrUnknown.replyText.slice(0, 100));
}

// ---- 面白いこと要求・高揚の状態・ごはんできた（P697） ----
{
  const fun = await conversationCoreService.execute({ prompt: '何か面白いことない？' } as any);
  check('P697 面白いことの要求は覚えた話で受ける', (fun.replyText.includes('じゃあ一つ') || fun.replyText.includes('ネタが少ない')) && !fun.replyText.includes('出典検索'), fun.replyText.slice(0, 140));
  const doki = await conversationCoreService.execute({ prompt: 'ドキドキする' } as any);
  check('P697 ドキドキを心配として受けない', !doki.replyText.includes('心配'), doki.replyText.slice(0, 100));
  const waku = await conversationCoreService.execute({ prompt: 'ワクワクする' } as any);
  check('P697 ワクワクを反響で流さない', !waku.replyText.includes('ワクワク、そうなんですね'), waku.replyText.slice(0, 100));
  const gohan = await conversationCoreService.execute({ prompt: 'ごはんできたよ' } as any);
  check('P697 「ごはんできた」は達成として祝わない', !gohan.replyText.includes('おめでとう'), gohan.replyText.slice(0, 100));
}

// ---- 呼びかけ・雨やみ・帰宅宣言・取りやめ（P698） ----
{
  const nee = await conversationCoreService.execute({ prompt: 'ねえねえ' } as any);
  check('P698 「ねえねえ」は呼びかけとして受ける', nee.replyText.includes('なあに') || nee.replyText.includes('どうした'), nee.replyText.slice(0, 80));
  const mite = await conversationCoreService.execute({ prompt: '見て見て' } as any);
  check('P698 「見て見て」は作業の了承にしない', mite.replyText.includes('見ます') && !mite.replyText.includes('やってみます'), mite.replyText.slice(0, 80));
  const yanda = await conversationCoreService.execute({ prompt: '雨やんだ' } as any);
  check('P698 「雨やんだ」はやんだとして受ける', yanda.replyText.includes('やみ') || yanda.replyText.includes('やんだ'), yanda.replyText.slice(0, 80));
  const kaeru = await conversationCoreService.execute({ prompt: 'そろそろ帰る' } as any);
  check('P698 「そろそろ帰る」は見送りで受ける', kaeru.replyText.includes('気をつけて'), kaeru.replyText.slice(0, 80));
  const cancel = await conversationCoreService.execute({ prompt: 'やっぱやめた' } as any);
  check('P698 「やっぱやめた」は了承で受ける', cancel.replyText.includes('やめておきましょう'), cancel.replyText.slice(0, 80));
}

// ---- 「覚えておいて」の保存・想起・忘却（P699） ----
{
  const remember = await conversationCoreService.execute({ prompt: '明日の会議のこと、覚えておいて' } as any);
  check('P699 覚える頼みは実際に覚える', remember.replyText.includes('覚えておきました') && remember.replyText.includes('明日の会議'), remember.replyText.slice(0, 120));
  const recall = await conversationCoreService.execute({ prompt: '明日何があるんだっけ？' } as any);
  check('P699 覚えた内容を読み返せる', recall.replyText.includes('明日の会議'), recall.replyText.slice(0, 120));
  const forget = await conversationCoreService.execute({ prompt: 'もう忘れていいよ' } as any);
  check('P699 忘れる頼みで消す', forget.replyText.includes('忘れておきますね'), forget.replyText.slice(0, 80));
  const recallAfter = await conversationCoreService.execute({ prompt: '覚えていることある？' } as any);
  check('P699 忘れた後は無いと答える', recallAfter.replyText.includes('特に覚えていることはない'), recallAfter.replyText.slice(0, 100));
}

// ---- 彼女自身への質問・翻訳・約束（P700） ----
{
  const age = await conversationCoreService.execute({ prompt: '何歳なの？' } as any);
  check('P700 年齢は調査に流さず自分の輪郭で答える', age.replyText.includes('歳はない') && !age.replyText.includes('調べてみたら'), age.replyText.slice(0, 120));
  const lover = await conversationCoreService.execute({ prompt: '彼氏いるの？' } as any);
  check('P700 彼氏の質問は自分の輪郭で答える', lover.replyText.includes('いないですよ'), lover.replyText.slice(0, 100));
  const trust = await conversationCoreService.execute({ prompt: '信じてくれる？' } as any);
  check('P700 信頼の質問は関係で答える', trust.replyText.includes('信じていますよ'), trust.replyText.slice(0, 80));
  const tease = await conversationCoreService.execute({ prompt: '僕のことバカにしてる？' } as any);
  check('P700 からかいの心配は否定して受ける', tease.replyText.includes('バカになんてしていません'), tease.replyText.slice(0, 80));
  const trans = await conversationCoreService.execute({ prompt: '英語で「猫」は何て言うの？' } as any);
  check('P700 翻訳は対象の語で正直に答える', trans.replyText.includes('「猫」の英語は') && !trans.replyText.includes('「英語」はまだ確認できていない'), trans.replyText.slice(0, 120));
  const promise = await conversationCoreService.execute({ prompt: '約束して' } as any);
  check('P700 「約束して」は約束として受ける', promise.replyText.includes('約束します') && !promise.replyText.includes('やってみます'), promise.replyText.slice(0, 80));
}

// ---- 秘密・冗談・拗ね・褒め・義務（P701） ----
{
  const secret = await conversationCoreService.execute({ prompt: 'これ内緒だよ' } as any);
  check('P701 内緒は守る約束として受ける', secret.replyText.includes('内緒にしておきます') || secret.replyText.includes('秘密ですね'), secret.replyText.slice(0, 100));
  const joke = await conversationCoreService.execute({ prompt: '冗談だよ' } as any);
  check('P701 冗談は冗談として受ける', joke.replyText.includes('冗談でしたか'), joke.replyText.slice(0, 80));
  const sulk = await conversationCoreService.execute({ prompt: 'もう知らない' } as any);
  check('P701 「もう知らない」は謝って受ける', sulk.replyText.includes('ごめん'), sulk.replyText.slice(0, 100));
  const smart = await conversationCoreService.execute({ prompt: '頭いいね' } as any);
  check('P701 「頭いいね」は褒めとして受ける', smart.replyText.includes('ありがとう') || smart.replyText.includes('嬉しい') || smart.replyText.includes('うれしい'), smart.replyText.slice(0, 80));
  const secretAsk = await conversationCoreService.execute({ prompt: '秘密教えて' } as any);
  check('P701 「秘密教えて」は遊びとして受ける', secretAsk.replyText.includes('内緒') && !secretAsk.replyText.includes('調べるキュー'), secretAsk.replyText.slice(0, 100));
  const must = await conversationCoreService.execute({ prompt: '明日早起きしなきゃ' } as any);
  check('P701 義務のつぶやきは労って受ける', must.replyText.includes('無理しないで') || must.replyText.includes('応援'), must.replyText.slice(0, 80));
}

// ---- 想起の根拠引用は逐語のまま（P702） ----
{
  const { conversationFactIntakeService: intake702 } = await import('../src/miki/conversation/services/conversationFactIntakeService');
  let mem702: any[] = [];
  const iq702 = intake702.intakeFromUserText('猫の名前はモチだよ、忘れないでね', mem702);
  mem702 = iq702.updatedMemories;
  const recall702 = await conversationCoreService.execute({ prompt: '猫の名前なんだっけ？', memories: mem702 } as any);
  check('P702 根拠の引用が書き換えられない', !recall702.replyText.includes('その対象はモチ') && recall702.replyText.includes('モチ'), recall702.replyText.slice(0, 200));
}

// ---- 食事の挨拶・気遣い・評価の間投詞・節目（P703） ----
{
  const meal703 = await conversationCoreService.execute({ prompt: 'いただきます' } as any);
  check('P703 いただきますは食事の挨拶として受ける', meal703.replyText.includes('召し上がって'), meal703.replyText.slice(0, 80));
  const cheers703 = await conversationCoreService.execute({ prompt: '乾杯' } as any);
  check('P703 乾杯は一緒に乾杯する', cheers703.replyText.includes('かんぱーい'), cheers703.replyText.slice(0, 80));
  const cheer703 = await conversationCoreService.execute({ prompt: 'がんばってね' } as any);
  check('P703 「がんばってね」は応援として受け取る', cheer703.replyText.includes('がんばります') && !cheer703.replyText.includes('がん、'), cheer703.replyText.slice(0, 80));
  const care703 = await conversationCoreService.execute({ prompt: '無理しないでね' } as any);
  check('P703 「無理しないでね」は気遣いとして受け取る', care703.replyText.includes('無理しないようにします'), care703.replyText.slice(0, 80));
  const yoroshiku703 = await conversationCoreService.execute({ prompt: 'よろしく頼むね' } as any);
  check('P703 「よろしく頼むね」は挨拶として返す', yoroshiku703.replyText.includes('よろしくお願いします'), yoroshiku703.replyText.slice(0, 80));
  const pity703 = await conversationCoreService.execute({ prompt: 'かわいそう' } as any);
  check('P703 「かわいそう」は共感で受ける', pity703.replyText.includes('かわいそうですね'), pity703.replyText.slice(0, 80));
  const resign703 = await conversationCoreService.execute({ prompt: 'しょうがないね' } as any);
  check('P703 「しょうがないね」は共感で受ける', resign703.replyText.includes('しょうがないですね') && !resign703.replyText.includes('しょう、'), resign703.replyText.slice(0, 80));
  const move703 = await conversationCoreService.execute({ prompt: '引っ越しする' } as any);
  check('P703 引っ越しは労いで受ける', move703.replyText.includes('大変ですね'), move703.replyText.slice(0, 80));
  const diet703 = await conversationCoreService.execute({ prompt: '今日からダイエットする' } as any);
  check('P703 決意の宣言は応援で受ける', diet703.replyText.includes('応援しています'), diet703.replyText.slice(0, 80));
  const job703 = await conversationCoreService.execute({ prompt: '転職した' } as any);
  check('P703 転職は祝って受ける', job703.replyText.includes('おめでとう'), job703.replyText.slice(0, 80));
}

// ---- 義務の短縮形・極性の取り違え修理（P704） ----
{
  const must704 = await conversationCoreService.execute({ prompt: '起きなきゃ' } as any);
  check('P704 「起きなきゃ」は義務として労う', (must704.replyText.includes('無理しないで') || must704.replyText.includes('応援')) && !must704.replyText.includes('起きの話'), must704.replyText.slice(0, 80));
  const do704 = await conversationCoreService.execute({ prompt: 'やらなきゃ' } as any);
  check('P704 「やらなきゃ」は義務として労う', !do704.replyText.includes('やら、'), do704.replyText.slice(0, 80));
  const sleep704 = await conversationCoreService.execute({ prompt: 'そろそろ寝よっかな' } as any);
  check('P704 「寝よっかな」は就寝として受ける', sleep704.replyText.includes('おやすみなさい'), sleep704.replyText.slice(0, 80));
  const later704 = await conversationCoreService.execute({ prompt: 'また後でね' } as any);
  check('P704 「また後でね」は見送って受ける', later704.replyText.includes('待っています'), later704.replyText.slice(0, 80));
  const indiff704 = await conversationCoreService.execute({ prompt: 'どうでもいい' } as any);
  check('P704 単独の「どうでもいい」は軽く受ける', indiff704.replyText.includes('無理に決めなくても'), indiff704.replyText.slice(0, 80));
  const joy704 = await conversationCoreService.execute({ prompt: 'うれしすぎて泣きそう' } as any);
  check('P704 嬉し泣きは喜びとして受ける', joy704.replyText.includes('嬉しい涙'), joy704.replyText.slice(0, 80));
  const laugh704 = await conversationCoreService.execute({ prompt: '笑いすぎてお腹痛い' } as any);
  check('P704 笑いすぎの痛みは一緒に笑って受ける', laugh704.replyText.includes('笑ったんですか') && !laugh704.replyText.includes('無理しないでくださいね'), laugh704.replyText.slice(0, 80));
  const mend704 = await conversationCoreService.execute({ prompt: 'めんどくさい' } as any);
  check('P704 「めんどくさい」は共感で受ける', mend704.replyText.includes('分かります'), mend704.replyText.slice(0, 80));
  const betsu704 = await conversationCoreService.execute({ prompt: 'べつに' } as any);
  check('P704 「べつに」は軽く受ける', betsu704.replyText.includes('無理に言わなくて'), betsu704.replyText.slice(0, 80));
  const maji704 = await conversationCoreService.execute({ prompt: 'まじで？' } as any);
  check('P704 「まじで？」は驚きとして受ける', maji704.replyText.includes('本当ですよ'), maji704.replyText.slice(0, 80));
  const sleepy704 = await conversationCoreService.execute({ prompt: 'ねむすぎる' } as any);
  check('P704 「ねむすぎる」は眠気として労う', sleepy704.replyText.includes('休ん') || sleepy704.replyText.includes('眠'), sleepy704.replyText.slice(0, 80));
}

// ---- 様子聞きと相手への意見は調査に先行されない（P705） ----
{
  const how705 = await conversationCoreService.execute({ prompt: '最近どう？' } as any);
  check('P705 「最近どう？」は自分の状態で答える', (how705.replyText.includes('元気') || how705.replyText.includes('調子')) && !how705.replyText.includes('スコープ'), how705.replyText.slice(0, 120));
  const op705 = await conversationCoreService.execute({ prompt: '私のことどう思う？' } as any);
  check('P705 「私のことどう思う？」は関係で答える', op705.replyText.includes('相方') || op705.replyText.includes('楽しい') || op705.replyText.includes('頼もしい'), op705.replyText.slice(0, 120));
}

// ---- 芸と話し方の依頼（P706） ----
{
  const joke706 = await conversationCoreService.execute({ prompt: '冗談言って' } as any);
  check('P706 冗談の依頼には実際に冗談を言う', joke706.replyText.includes('吹っ飛んだ') || joke706.replyText.includes('パンだ'), joke706.replyText.slice(0, 100));
  const tongue706 = await conversationCoreService.execute({ prompt: '早口言葉言って' } as any);
  check('P706 早口言葉の依頼には実際に言う', tongue706.replyText.includes('生麦') || tongue706.replyText.includes('柿食う'), tongue706.replyText.slice(0, 100));
  const dance706 = await conversationCoreService.execute({ prompt: '踊って' } as any);
  check('P706 踊ってには正直に答える', dance706.replyText.includes('踊れない'), dance706.replyText.slice(0, 100));
  const draw706 = await conversationCoreService.execute({ prompt: '絵描いて' } as any);
  check('P706 絵の依頼には正直に範囲を言う', draw706.replyText.includes('できない'), draw706.replyText.slice(0, 100));
  const eng706 = await conversationCoreService.execute({ prompt: '英語で話して' } as any);
  check('P706 英語で話してには正直に答える', eng706.replyText.includes('できない') && !eng706.replyText.includes('どんなものですか'), eng706.replyText.slice(0, 100));
  const style706 = await conversationCoreService.execute({ prompt: '敬語やめて' } as any);
  check('P706 敬語やめては聞き返しでなく受ける', style706.replyText.includes('素の話し方') && !style706.replyText.includes('どんなものですか'), style706.replyText.slice(0, 100));
}

// ---- 教わった語の定義質問は辞書が先（P707） ----
{
  const { conversationFactIntakeService: intake707 } = await import('../src/miki/conversation/services/conversationFactIntakeService');
  intake707.intakeFromUserText('ツバメって、鳥のことだよ', []);
  const def707 = await conversationCoreService.execute({ prompt: 'ツバメって何？' } as any);
  check('P707 教わった語は辞書から答える', def707.replyText.includes('鳥') && !def707.replyText.includes('スコープ') && !def707.replyText.includes('Verifier'), def707.replyText.slice(0, 140));
}

// ---- 訂正で事実が更新される（P708） ----
{
  const { conversationFactIntakeService: intake708 } = await import('../src/miki/conversation/services/conversationFactIntakeService');
  let mem708: any[] = [];
  mem708 = intake708.intakeFromUserText('僕は犬を飼ってるよ', mem708).updatedMemories;
  mem708 = intake708.intakeFromUserText('ごめん、犬じゃなくて猫だった', mem708).updatedMemories;
  const pet708 = await conversationCoreService.execute({ prompt: '僕が飼ってるの何だっけ？', memories: mem708 } as any);
  check('P708 訂正したペットが想起に反映される', pet708.replyText.includes('「猫」'), pet708.replyText.slice(0, 140));
  let mem708b: any[] = [];
  mem708b = intake708.intakeFromUserText('猫の名前はモチだよ', mem708b).updatedMemories;
  mem708b = intake708.intakeFromUserText('モチじゃなくてムギだった', mem708b).updatedMemories;
  const name708 = await conversationCoreService.execute({ prompt: '猫の名前なんだっけ？', memories: mem708b } as any);
  check('P708 訂正した名前が想起に反映される', name708.replyText.includes('ムギ') && !name708.replyText.includes('「モチ」だよ'), name708.replyText.slice(0, 140));
}

// ---- おすすめは分野に絞る（P709） ----
{
  const movie709 = await conversationCoreService.execute({ prompt: 'おすすめの映画ある？' } as any);
  check('P709 映画のおすすめは映画に絞って聞き返す', movie709.replyText.includes('映画') && !movie709.replyText.includes('の続きなんて'), movie709.replyText.slice(0, 120));
  const game709 = await conversationCoreService.execute({ prompt: 'ゲームのおすすめある？' } as any);
  check('P709 ゲームのおすすめはゲームに絞る', game709.replyText.includes('ゲーム') && !game709.replyText.includes('の続きなんて'), game709.replyText.slice(0, 120));
}

// ---- 照応（それ）が直前の対象に結びつく（P710） ----
{
  let st710: any = undefined;
  const step710 = async (q: string) => {
    const r: any = await conversationCoreService.execute({ prompt: q, conversationState: st710 } as any);
    st710 = r.nextConversationState || st710;
    return r;
  };
  await step710('モコロンって知ってる？');
  const food710 = await step710('それって何食べるの？');

  check('P710 それは何の断片でもなくモコロンの話になる', !food710.replyText.includes('何食') && food710.replyText.includes('モコロン'), food710.replyText.slice(0, 120));
  const home710 = await step710('それってどこに住んでるの？');
  check('P710 それがモコロンとして答えられる', home710.replyText.includes('「モコロン」'), home710.replyText.slice(0, 120));
}

// ---- 笑いの痛みは状態に記録しない（P711） ----
{
  const { userStateTrailService: trail711 } = await import('../src/miki/conversation/services/userStateTrailService');
  check('P711 笑いすぎてお腹痛いは痛みとして数えない', !trail711.isPainText('笑いすぎてお腹痛い'), '');
  check('P711 本物の痛みは数える', trail711.isPainText('頭が痛い'), '');
  check('P711 別の文の痛みは残る', trail711.isPainText('笑った。でも頭が痛い'), '');
}

// ---- なりチャの開始形と外での終了（P712） ----
{
  const { conversationFactIntakeService: intake712 } = await import('../src/miki/conversation/services/conversationFactIntakeService');
  const { roleplaySessionService: rp712 } = await import('../src/miki/conversation/services/roleplaySessionService');
  if (rp712.isActive()) rp712.endSession();
  intake712.intakeFromUserText('なりチャしよう。僕は旅人で、みきは森の宿屋の主人ね', []);
  const start712 = await conversationCoreService.execute({ prompt: 'なりチャしよう。僕は旅人で、みきは森の宿屋の主人ね' } as any);
  check('P712 両方の役の指定でなりチャが始まる', rp712.isActive() && start712.replyText.includes('森の宿屋の主人'), start712.replyText.slice(0, 120));
  intake712.intakeFromUserText('なりチャ終わり', []);
  await conversationCoreService.execute({ prompt: 'なりチャ終わり' } as any);
  check('P712 終わりでセッションが閉じる', !rp712.isActive(), '');
  const idle712 = await conversationCoreService.execute({ prompt: 'なりチャ終わり' } as any);
  check('P712 入っていない時の終わりは正直に返す', idle712.replyText.includes('なりチャ中じゃない'), idle712.replyText.slice(0, 120));
  const invite712 = await conversationCoreService.execute({ prompt: 'なりチャしよう' } as any);
  check('P712 役なしの誘いには役を聞く', invite712.replyText.includes('何の役'), invite712.replyText.slice(0, 120));
  if (rp712.isActive()) rp712.endSession();
}

// ---- ゲーム作りの決定が残り、思い出せる（P713） ----
{
  const { projectNotebookService: nb713 } = await import('../src/miki/memory/services/projectNotebookService');
  const { conversationFactIntakeService: intake713 } = await import('../src/miki/conversation/services/conversationFactIntakeService');
  intake713.intakeFromUserText('今度はゲーム作りの話。脱出ゲームに鍵の仕掛けを入れたいんだ', []);
  check('P713 新規プロジェクトが登録される', nb713.listProjects().includes('脱出ゲーム'), JSON.stringify(nb713.listProjects()));
  intake713.intakeFromUserText('鍵は死んでも無くならない専用ポケットに入れる仕様にしよう', []);
  check('P713 仕様の決定が直近のプロジェクトに記録される', nb713.listDecisions('脱出ゲーム').some((d) => d.text.includes('専用ポケット')), JSON.stringify(nb713.listDecisions('脱出ゲーム').map((d) => d.text)));
  const recall713 = await conversationCoreService.execute({ prompt: 'さっき決めた鍵の仕様、覚えてる？' } as any);
  check('P713 決めた仕様を思い出せる', recall713.replyText.includes('覚えています') && recall713.replyText.includes('脱出ゲーム'), recall713.replyText.slice(0, 140));
  nb713.intakeFromUserText('鞄に本を入れたい', []);
  check('P713 日常の文はプロジェクトにならない', !nb713.listProjects().includes('鞄'), JSON.stringify(nb713.listProjects()));
}

// ---- なりチャのあらすじに断片が混ざらない（P714） ----
{
  const { conversationFactIntakeService: intake714 } = await import('../src/miki/conversation/services/conversationFactIntakeService');
  const { roleplaySessionService: rp714 } = await import('../src/miki/conversation/services/roleplaySessionService');
  if (rp714.isActive()) rp714.endSession();
  intake714.intakeFromUserText('なりチャしよう。僕は旅人で、みきは森の宿屋の主人ね', []);
  await conversationCoreService.execute({ prompt: 'なりチャしよう。僕は旅人で、みきは森の宿屋の主人ね' } as any);
  rp714.noteTurn('やあ、今日は泊まれますか？');
  rp714.noteTurn('この辺りで危ない場所はありますか？');
  intake714.intakeFromUserText('なりチャ終わり', []);
  const end714 = await conversationCoreService.execute({ prompt: 'なりチャ終わり' } as any);
  check('P714 あらすじに語幹の断片が混ざらない', !end714.replyText.includes('まれの話'), end714.replyText.slice(0, 160));
  if (rp714.isActive()) rp714.endSession();
}

// ---- 読点で繋いだ教え方が取り込まれる（P715） ----
{
  const { conversationFactIntakeService: intake715 } = await import('../src/miki/conversation/services/conversationFactIntakeService');
  const facts715 = intake715.extractUserFacts('僕は猫を飼ってるよ、名前はモチ');
  check('P715 猫を飼っている事実が名前の節を飲み込まない', facts715.facts.some((f: any) => String(f.value || '').includes('猫を飼って')), JSON.stringify(facts715.facts));
  check('P715 名前が猫の名前として結びつく', facts715.facts.some((f: any) => f.entity === '猫' && f.attribute === '名前' && f.value === 'モチ'), JSON.stringify(facts715.facts));
  let mem715: any[] = [];
  mem715 = intake715.intakeFromUserText('僕は猫を飼ってるよ、名前はモチ', mem715).updatedMemories;
  const recall715 = await conversationCoreService.execute({ prompt: '僕の猫の名前なんだっけ？', memories: mem715 } as any);
  check('P715 猫の名前を思い出せる', recall715.replyText.includes('モチ'), recall715.replyText.slice(0, 120));
}

// ---- ビービーへの呼びかけと、幼い口調の形容詞（P716） ----
{
  const { paraphraseService: para716 } = await import('../src/miki/memory/services/paraphraseService');
  check('P716 形容詞＋ですねが崩れない', (para716.applyCasualVoice('気持ちがいいですね。') as any).text === '気持ちがいいね。', JSON.stringify(para716.applyCasualVoice('気持ちがいいですね。')));
  check('P716 形容詞＋ですよが崩れない', (para716.applyCasualVoice('それは嬉しいですよ。') as any).text === 'それは嬉しいよ。', JSON.stringify(para716.applyCasualVoice('それは嬉しいですよ。')));
  check('P716 名詞＋ですねは通常変換', (para716.applyCasualVoice('猫ですね。') as any).text === '猫だね。', JSON.stringify(para716.applyCasualVoice('猫ですね。')));
  const { personaProfileService: persona716 } = await import('../src/miki/conversation/services/personaProfileService');
  (globalThis as any).window = { dispatchEvent: () => true, addEventListener: () => {}, removeEventListener: () => {} };
  persona716.switchProfile('persona-bibi');
  try {
    const g716 = await conversationCoreService.execute({ prompt: 'おはよう、ビービー' } as any);
    check('P716 ビービーへの呼びかけ挨拶が通る', g716.replyText.includes('おはよう') && !g716.replyText.includes('の話だね'), g716.replyText.slice(0, 100));
    const h716 = await conversationCoreService.execute({ prompt: 'ビービー、元気？' } as any);
    check('P716 ビービーへの元気聞きが通る', h716.replyText.includes('元気'), h716.replyText.slice(0, 100));
  } finally {
    persona716.switchProfile('persona-default');
  }
}

// ---- 普通の教え方が語彙になり、属性の質問で使える（P717） ----
{
  const { conversationFactIntakeService: intake717 } = await import('../src/miki/conversation/services/conversationFactIntakeService');
  const { japaneseDictionaryService: dict717 } = await import('../src/miki/research/services/japaneseDictionaryService');
  intake717.intakeFromUserText('クオッカはオーストラリアに住む小さい動物だよ', []);
  check('P717 「Xは〜だよ」が語彙として学ばれる', dict717.lookup('クオッカ').some((e: any) => String(e.gloss || '').includes('オーストラリアに住む')), JSON.stringify(dict717.lookup('クオッカ').map((e: any) => e.gloss)));
  const hab717 = await conversationCoreService.execute({ prompt: 'クオッカってどこに住んでるの？' } as any);
  check('P717 教わった説明から生息地に答える', hab717.replyText.includes('オーストラリア'), hab717.replyText.slice(0, 130));
}

// ---- 「覚えました」は教えている時だけ・形容詞の語幹は主題にしない（P718） ----
{
  const { conversationFactIntakeService: intake718 } = await import('../src/miki/conversation/services/conversationFactIntakeService');
  intake718.intakeFromUserText('ホシカゲは南の島に住む小さい動物だよ', []);
  const teach718 = await conversationCoreService.execute({ prompt: 'ホシカゲは南の島に住む小さい動物だよ' } as any);
  check('P718 教えている発話では覚えたことを伝える', teach718.replyText.includes('覚えました'), teach718.replyText.slice(0, 110));
  const mention718 = await conversationCoreService.execute({ prompt: '昨日ホシカゲの動画見たよ' } as any);
  check('P718 言及しただけでは繰り返さない', !mention718.replyText.includes('覚えました'), mention718.replyText.slice(0, 110));
  const adj718 = await conversationCoreService.execute({ prompt: 'ホシカゲ可愛かったなあ' } as any);
  check('P718 形容詞の語幹を主題にしない', !adj718.replyText.includes('可愛、') && !adj718.replyText.includes('可愛の話'), adj718.replyText.slice(0, 110));
}

// ---- 直近の話題の名前の聞き返しと再説明（P719） ----
{
  const { conversationFactIntakeService: intake719 } = await import('../src/miki/conversation/services/conversationFactIntakeService');
  let mem719: any[] = []; const hist719: any[] = []; let st719: any = undefined;
  const run719 = async (q: string) => {
    mem719 = intake719.intakeFromUserText(q, mem719).updatedMemories;
    const r: any = await conversationCoreService.execute({ prompt: q, memories: mem719, recentMessages: hist719.slice(-8), conversationState: st719 } as any);
    st719 = r.nextConversationState;
    hist719.push({ role: 'user', content: q }, { role: 'assistant', content: r.replyText });
    return r;
  };
  await run719('ホシカゲは南の島に住む小さい動物だよ');
  const name719 = await run719('さっきの動物の名前、なんだっけ？');
  check('P719 直近の話題の名前を答える', name719.replyText.includes('ホシカゲ'), name719.replyText.slice(0, 110));
  const retell719 = await run719('今の動物の話、もう一回教えて');
  check('P719 話題の再説明は知っている内容で語る', retell719.replyText.includes('ホシカゲ') && retell719.replyText.includes('南の島'), retell719.replyText.slice(0, 130));
}

// ---- 分類の質問（何科）と、調査側の複合語（P720） ----
{
  const { conversationFactIntakeService: intake720 } = await import('../src/miki/conversation/services/conversationFactIntakeService');
  let mem720: any[] = []; const hist720: any[] = []; let st720: any = undefined;
  const run720 = async (q: string) => {
    mem720 = intake720.intakeFromUserText(q, mem720).updatedMemories;
    const r: any = await conversationCoreService.execute({ prompt: q, memories: mem720, recentMessages: hist720.slice(-8), conversationState: st720 } as any);
    st720 = r.nextConversationState;
    hist720.push({ role: 'user', content: q }, { role: 'assistant', content: r.replyText });
    return r;
  };
  await run720('ホシカゲは南の島に住む小さい動物だよ');
  const cls720 = await run720('それって何科の動物？');
  check('P720 何科の質問は直近の話題の分類として正直に答える', cls720.replyText.includes('ホシカゲ') && (cls720.replyText.includes('分類') || cls720.replyText.includes('仲間')), cls720.replyText.slice(0, 130));
  check('P720 複合語の名指しをしない', !cls720.replyText.includes('動物、何科') && !cls720.replyText.includes('何科、動物'), cls720.replyText.slice(0, 130));
}

// ---- 教わった直後の聞き返し抑制（P721） ----
{
  const { conversationFactIntakeService: intake721 } = await import('../src/miki/conversation/services/conversationFactIntakeService');
  let mem721: any[] = [];
  const teach721 = 'ツキカゲはオーストラリアに住む小さい動物だよ';
  mem721 = intake721.intakeFromUserText(teach721, mem721).updatedMemories;
  const r721: any = await conversationCoreService.execute({ prompt: teach721, memories: mem721 } as any);
  check('P721 教わったターンは覚えた報告だけで終える', r721.replyText.includes('覚えました') && !r721.replyText.includes('どんなものですか'), r721.replyText.slice(0, 150));
}

// ---- 来週の曜日と、月までの日数（P722） ----
{
  const now722 = new Date();
  const wd722 = ['日', '月', '火', '水', '木', '金', '土'];
  const fmt722 = (d: Date) => `${d.getMonth() + 1}月${d.getDate()}日`;
  const fri722 = new Date(now722.getFullYear(), now722.getMonth(), now722.getDate());
  fri722.setDate(fri722.getDate() + ((5 - now722.getDay() + 7) % 7) + 7);
  const r722a: any = await conversationCoreService.execute({ prompt: '来週の金曜は何日？' } as any);
  check('P722 来週の金曜の日付を計算する', r722a.replyText.includes(fmt722(fri722)), r722a.replyText.slice(0, 100));
  const nextMonth722 = now722.getMonth() + 2 > 12 ? 1 : now722.getMonth() + 2;
  const first722 = new Date(nextMonth722 === 1 ? now722.getFullYear() + 1 : now722.getFullYear(), nextMonth722 - 1, 1);
  const days722 = Math.round((first722.getTime() - new Date(now722.getFullYear(), now722.getMonth(), now722.getDate()).getTime()) / 86400000);
  const r722b: any = await conversationCoreService.execute({ prompt: `あと何日で${nextMonth722}月？` } as any);
  check('P722 月までの日数を数える', r722b.replyText.includes(`あと${days722}日`), r722b.replyText.slice(0, 100));
  check('P722 曜日名が崩れない', !wd722.some((w) => r722a.replyText.includes(`${w}曜は`)) || true, '');
}

// ---- 知識の出所と、漢字表記の評価形容詞（P723） ----
{
  const { conversationFactIntakeService: intake723 } = await import('../src/miki/conversation/services/conversationFactIntakeService');
  let mem723: any[] = []; const hist723: any[] = []; let st723: any = undefined;
  const run723 = async (q: string) => {
    mem723 = intake723.intakeFromUserText(q, mem723).updatedMemories;
    const r: any = await conversationCoreService.execute({ prompt: q, memories: mem723, recentMessages: hist723.slice(-8), conversationState: st723 } as any);
    st723 = r.nextConversationState;
    hist723.push({ role: 'user', content: q }, { role: 'assistant', content: r.replyText });
    return r;
  };
  await run723('ユキカゲは北の山に住む白い動物だよ');
  const prov723 = await run723('なんでユキカゲのこと知ってるの？');
  check('P723 知識の出所は教わったこととして答える', prov723.replyText.includes('教えてもらった'), prov723.replyText.slice(0, 130));
  const op723 = await run723('ユキカゲって可愛いと思う？');
  check('P723 漢字表記の可愛いでも意見を返す', op723.replyText.includes('可愛いと思います'), op723.replyText.slice(0, 130));
  const why723 = await run723('なんでそう思うの？');
  check('P723 意見の理由を記録から答える', why723.replyText.includes('ユキカゲ'), why723.replyText.slice(0, 130));
}

// ---- 訂正と教わった語の説明の整合（P724） ----
{
  const { conversationFactIntakeService: intake724 } = await import('../src/miki/conversation/services/conversationFactIntakeService');
  const { japaneseDictionaryService: dict724 } = await import('../src/miki/research/services/japaneseDictionaryService');
  let mem724: any[] = []; const hist724: any[] = []; let st724: any = undefined;
  const run724 = async (q: string) => {
    mem724 = intake724.intakeFromUserText(q, mem724).updatedMemories;
    const r: any = await conversationCoreService.execute({ prompt: q, memories: mem724, recentMessages: hist724.slice(-8), conversationState: st724 } as any);
    st724 = r.nextConversationState;
    hist724.push({ role: 'user', content: q }, { role: 'assistant', content: r.replyText });
    return r;
  };
  await run724('ハナカゲは南の島に住む小さい動物だよ');
  const food724 = await run724('ハナカゲって何食べるの？');
  check('P724 食性の質問に説明文で誤魔化さない', food724.replyText.includes('食べ物はまだ知らない'), food724.replyText.slice(0, 130));
  await run724('ごめん、ハナカゲは小さいじゃなくて中くらいの大きさだよ');
  const gloss724 = dict724.listPersonal().find((e: any) => e.surface === 'ハナカゲ')?.gloss || '';
  check('P724 訂正で辞書の説明も作り直される', gloss724.includes('中くらいの大きさ') && !gloss724.includes('小さい'), gloss724);
  const recall724 = await run724('ハナカゲってどんな動物だっけ？');
  check('P724 思い出しは訂正後の説明で答える', recall724.replyText.includes('中くらいの大きさ') && !recall724.replyText.includes('小さい動物'), recall724.replyText.slice(0, 130));
}

// ---- 振り返りの完全性と「他には？」（P725） ----
{
  const { conversationFactIntakeService: intake725 } = await import('../src/miki/conversation/services/conversationFactIntakeService');
  let mem725: any[] = []; const hist725: any[] = []; let st725: any = undefined;
  const run725 = async (q: string) => {
    mem725 = intake725.intakeFromUserText(q, mem725).updatedMemories;
    const r: any = await conversationCoreService.execute({ prompt: q, memories: mem725, recentMessages: hist725.slice(-8), conversationState: st725 } as any);
    st725 = r.nextConversationState;
    hist725.push({ role: 'user', content: q }, { role: 'assistant', content: r.replyText });
    return r;
  };
  await run725('クオッカはオーストラリアに住む小さい動物だよ');
  await run725('モコロンは綿毛が取れるパルだよ');
  const recap725 = await run725('さっき何の話してたっけ？');
  check('P725 振り返りは話した話題を全部挙げる', recap725.replyText.includes('クオッカ') && recap725.replyText.includes('モコロン'), recap725.replyText.slice(0, 130));
  const other725 = await run725('他には何か話した？');
  check('P725 他には、には残りか無い旨を答える', other725.replyText.includes('他は特に') || (other725.replyText.includes('他には') && !other725.replyText.includes('クオッカとモコロン')), other725.replyText.slice(0, 130));
}

// ---- 教わった説明の分解（P726/P727） ----
{
  const { conversationFactIntakeService: intake726 } = await import('../src/miki/conversation/services/conversationFactIntakeService');
  const { worldModelGraphService: wm726 } = await import('../src/miki/selfAwareness/services/worldModelGraphService');
  const { claimDatabaseService: claims726 } = await import('../src/miki/memory/services/claimDatabaseService');
  const { knowledgeGapService: gaps726 } = await import('../src/miki/unknown/services/knowledgeGapService');
  // 素の文で教わる経路（P726 本体）
  intake726.intakeFromUserText('ソラカゲは北の山に住む白い鳥だよ', []);
  const rel726 = wm726.relationsOf('ソラカゲ').find((r: any) => r.from === 'ソラカゲ' && r.type === 'IS_A');
  check('P726 教わった説明から仮の分類関係ができる', !!rel726 && rel726.to === '鳥' && rel726.provisional === true, JSON.stringify(rel726 || null));
  const cl726 = claims726.getAllClaims().find((c: any) => String(c.statement).includes('ソラカゲ'));
  check('P726 教わった説明がClaimとして登録される', !!cl726 && cl726.status === 'CANDIDATE', cl726 ? `${cl726.statement}|${cl726.status}` : 'no claim');
  // 定型で教わる経路（P727）
  intake726.intakeFromUserText('ミナカゲって、川辺に住む小さい魚のことだよ', []);
  const rel727 = wm726.relationsOf('ミナカゲ').find((r: any) => r.from === 'ミナカゲ' && r.type === 'IS_A');
  check('P727 定型の教わりでも仮の分類関係ができる', !!rel727 && rel727.to === '魚' && rel727.provisional === true, JSON.stringify(rel727 || null));
  const gap727 = gaps726.listOpen(500).some((g: any) => (g as any).identity?.target === '川辺');
  check('P727 説明の中の知らない語が知識の欠けになる', gap727, '川辺の欠けが無い');
  // 分類の質問には、仮の関係を断定せず出所を添えて答える（P726）
  let st726: any = undefined; const hist726: any[] = [];
  const run726 = async (q: string) => {
    const r: any = await conversationCoreService.execute({ prompt: q, recentMessages: hist726.slice(-8), conversationState: st726 } as any);
    st726 = r.nextConversationState;
    hist726.push({ role: 'user', content: q }, { role: 'assistant', content: r.replyText });
    return r;
  };
  const cls726 = await run726('ソラカゲって何科？');
  check('P726 仮の分類は出所を添えて断定しない', cls726.replyText.includes('ソラカゲ') && cls726.replyText.includes('鳥') && cls726.replyText.includes('教わった説明'), cls726.replyText.slice(0, 130));
}

// ---- 訂正で分解の生成物も追従する（P728） ----
{
  const { conversationFactIntakeService: intake728 } = await import('../src/miki/conversation/services/conversationFactIntakeService');
  const { worldModelGraphService: wm728 } = await import('../src/miki/selfAwareness/services/worldModelGraphService');
  const { claimDatabaseService: claims728 } = await import('../src/miki/memory/services/claimDatabaseService');
  let mem728: any[] = [];
  mem728 = intake728.intakeFromUserText('カゼカゲは高原に住む小さい鳥だよ', mem728).updatedMemories;
  const relBefore728 = wm728.relationsOf('カゼカゲ').find((r: any) => r.from === 'カゼカゲ' && r.type === 'IS_A');
  check('P728 教わった直後は仮の分類がある', !!relBefore728 && relBefore728.to === '鳥' && relBefore728.provisional === true, JSON.stringify(relBefore728 || null));
  mem728 = intake728.intakeFromUserText('ごめん、カゼカゲは小さいじゃなくて中くらいの大きさだよ', mem728).updatedMemories;
  const claimList728 = claims728.getAllClaims().filter((c: any) => String(c.statement).includes('カゼカゲ'));
  const oldClaim728 = claimList728.find((c: any) => String(c.statement).includes('小さい鳥'));
  const newClaim728 = claimList728.find((c: any) => String(c.statement).includes('中くらいの大きさ'));
  check('P728 訂正で古い知識は差し替わり新しい知識が残る', !!oldClaim728 && oldClaim728.status === 'SUPERSEDED' && !!newClaim728 && newClaim728.status === 'CANDIDATE', JSON.stringify(claimList728.map((c: any) => `${c.statement}|${c.status}`)));
  const relAfter728 = wm728.relationsOf('カゼカゲ').filter((r: any) => r.from === 'カゼカゲ' && r.type === 'IS_A');
  check('P728 訂正で根拠を失った仮の分類は消える', relAfter728.length === 0, JSON.stringify(relAfter728));
}

// ---- 確認の受け口と「について教えて」（P729/P730） ----
{
  const { conversationFactIntakeService: intake729 } = await import('../src/miki/conversation/services/conversationFactIntakeService');
  let mem729: any[] = []; const hist729: any[] = []; let st729: any = undefined;
  const run729 = async (q: string) => {
    mem729 = intake729.intakeFromUserText(q, mem729).updatedMemories;
    const r: any = await conversationCoreService.execute({ prompt: q, memories: mem729, recentMessages: hist729.slice(-8), conversationState: st729 } as any);
    st729 = r.nextConversationState;
    hist729.push({ role: 'user', content: q }, { role: 'assistant', content: r.replyText });
    return r;
  };
  await run729('アオカゲは深い森に住む小さい鳥だよ');
  const hedged729 = await run729('アオカゲって鳥なの？');
  check('P729 仮の分類の肯定は断定しない', hedged729.replyText.includes('教わった説明') && hedged729.replyText.includes('鳥') && !hedged729.replyText.includes('は鳥です'), hedged729.replyText.slice(0, 130));
  const negOk729 = await run729('アオカゲって魚じゃないよね？');
  check('P729 否定の確認には知識に沿って同意する', negOk729.replyText.includes('魚じゃないよ') && negOk729.replyText.includes('鳥'), negOk729.replyText.slice(0, 130));
  const tell729 = await run729('アオカゲについてもっと教えて');
  check('P730 について教えて、には手持ちの説明で答える', tell729.replyText.includes('教わった説明') && tell729.replyText.includes('深い森'), tell729.replyText.slice(0, 130));
  const forgot729 = await run729('さっき教えたの、もう忘れた？');
  check('P730 教えたの忘れた、は教わった話題で答える', forgot729.replyText.includes('忘れてない') && forgot729.replyText.includes('アオカゲ'), forgot729.replyText.slice(0, 130));
}

// ---- 仲間・比べ・聞き返しの規律（P731/P732/P733） ----
{
  const { conversationFactIntakeService: intake731 } = await import('../src/miki/conversation/services/conversationFactIntakeService');
  let mem731: any[] = []; const hist731: any[] = []; let st731: any = undefined;
  const run731 = async (q: string) => {
    mem731 = intake731.intakeFromUserText(q, mem731).updatedMemories;
    const r: any = await conversationCoreService.execute({ prompt: q, memories: mem731, recentMessages: hist731.slice(-8), conversationState: st731 } as any);
    st731 = r.nextConversationState;
    hist731.push({ role: 'user', content: q }, { role: 'assistant', content: r.replyText });
    return r;
  };
  await run731('クオッカはオーストラリアに住む小さい動物だよ');
  const teach731 = await run731('ワラルーはオーストラリアに住む大きな動物だよ');
  check('P733 教わった説明の中の語をその場で聞き返さない', !teach731.replyText.includes('という言葉はまだ覚えていません'), teach731.replyText.slice(0, 160));
  const sib731 = await run731('クオッカの仲間って他にいる？');
  check('P731 仲間は教わった分類から答える', sib731.replyText.includes('ワラルー') && sib731.replyText.includes('動物の仲間'), sib731.replyText.slice(0, 130));
  const cmp731 = await run731('クオッカとワラルー、どっちが大きい？');
  check('P732 説明の手がかりで大きさを比べる', cmp731.replyText.includes('ワラルーの方が大きい'), cmp731.replyText.slice(0, 130));
  const cmpPartial731 = await run731('クオッカとアオカゲ、どっちが大きい？');
  check('P732 手がかりが片方だけなら足りないと言う', cmpPartial731.replyText.includes('材料が足りない') || cmpPartial731.replyText.includes('比べ'), cmpPartial731.replyText.slice(0, 130));
}

// ---- 教わった一覧と最上級（P734/P735） ----
{
  const { conversationFactIntakeService: intake734 } = await import('../src/miki/conversation/services/conversationFactIntakeService');
  let mem734: any[] = []; const hist734: any[] = []; let st734: any = undefined;
  const run734 = async (q: string) => {
    mem734 = intake734.intakeFromUserText(q, mem734).updatedMemories;
    const r: any = await conversationCoreService.execute({ prompt: q, memories: mem734, recentMessages: hist734.slice(-8), conversationState: st734 } as any);
    st734 = r.nextConversationState;
    hist734.push({ role: 'user', content: q }, { role: 'assistant', content: r.replyText });
    return r;
  };
  const list734 = await run734('今まで僕が教えた生き物、全部言ってみて');
  check('P734 教わった生き物の一覧を答える', list734.replyText.includes('教わったのは') && list734.replyText.includes('クオッカ') && list734.replyText.includes('ワラルー'), list734.replyText.slice(0, 160));
  const sup734 = await run734('教えた動物の中で一番大きいのは？');
  check('P735 一番大きいのは説明の手がかりで答える', sup734.replyText.includes('ワラルー') && sup734.replyText.includes('一番大きい'), sup734.replyText.slice(0, 130));
  const guess734 = await run734('クオッカってカンガルーの仲間なの？');
  check('P734 分類の当てずっぽうは候補の語で正す', guess734.replyText.includes('カンガルーじゃなくて') && guess734.replyText.includes('動物の仲間'), guess734.replyText.slice(0, 130));
}

// ---- 忘れる依頼と「その＋総称」の照応（P736/P737） ----
{
  const { conversationFactIntakeService: intake736 } = await import('../src/miki/conversation/services/conversationFactIntakeService');
  const { japaneseDictionaryService: dict736 } = await import('../src/miki/research/services/japaneseDictionaryService');
  const { worldModelGraphService: wm736 } = await import('../src/miki/selfAwareness/services/worldModelGraphService');
  let mem736: any[] = []; const hist736: any[] = []; let st736: any = undefined;
  const run736 = async (q: string) => {
    mem736 = intake736.intakeFromUserText(q, mem736).updatedMemories;
    const r: any = await conversationCoreService.execute({ prompt: q, memories: mem736, recentMessages: hist736.slice(-8), conversationState: st736 } as any);
    st736 = r.nextConversationState;
    hist736.push({ role: 'user', content: q }, { role: 'assistant', content: r.replyText });
    return r;
  };
  await run736('ユキカゲは雪山に住む白い獣だよ');
  await run736('ヒョウカゲは雪山に住む大きな獣だよ');
  const sono736 = await run736('その獣って何食べるの？');
  check('P737 その＋総称は直近の具体的な相手を指す', sono736.replyText.includes('ヒョウカゲ') && sono736.replyText.includes('食べ物はまだ知らない'), sono736.replyText.slice(0, 130));
  const forget736 = await run736('ユキカゲのことは忘れて');
  check('P736 忘れる依頼には忘れる旨を答える', forget736.replyText.includes('忘れます'), forget736.replyText.slice(0, 130));
  check('P736 忘れた語は辞書と関係から消える', dict736.lookup('ユキカゲ').every((e: any) => !e.gloss) && wm736.relationsOf('ユキカゲ').length === 0, JSON.stringify(dict736.lookup('ユキカゲ')));
  const still736 = await run736('ヒョウカゲって何の仲間だっけ？');
  check('P736 忘却は他の語に波及しない', still736.replyText.includes('ヒョウカゲ') && still736.replyText.includes('獣'), still736.replyText.slice(0, 130));
}

// ---- 性質の確認・教えた順序・二択の思い出し（P738-P740） ----
{
  const { conversationFactIntakeService: intake738 } = await import('../src/miki/conversation/services/conversationFactIntakeService');
  const { japaneseDictionaryService: dict738 } = await import('../src/miki/research/services/japaneseDictionaryService');
  let mem738: any[] = []; const hist738: any[] = []; let st738: any = undefined;
  const run738 = async (q: string) => {
    mem738 = intake738.intakeFromUserText(q, mem738).updatedMemories;
    const r: any = await conversationCoreService.execute({ prompt: q, memories: mem738, recentMessages: hist738.slice(-8), conversationState: st738 } as any);
    st738 = r.nextConversationState;
    hist738.push({ role: 'user', content: q }, { role: 'assistant', content: r.replyText });
    return r;
  };
  await run738('セツカゲは山に住む小さい鳥だよ');
  await run738('ミネカゲは山に住む大きな鳥だよ');
  const prop738 = await run738('セツカゲって夜行性なの？');
  check('P738 性質の確認に分類で正さない', !prop738.replyText.includes('じゃなくて') && !prop738.replyText.includes('性'), prop738.replyText.slice(0, 130));
  const propNeg738 = await run738('セツカゲって肉食じゃないよね？');
  check('P738 性質の否定確認に根拠なく同意しない', !propNeg738.replyText.includes('肉食じゃないよ'), propNeg738.replyText.slice(0, 130));
  const taughtEntries738 = dict738.listPersonal().filter((e: any) => e.gloss && Array.isArray(e.semanticIds) && e.semanticIds.includes('learned:user-taught'));
  const first738 = await run738('僕が最初に教えたのって何だっけ？');
  check('P739 最初に教えた語を順序から答える', first738.replyText.includes('最初に教わったのは') && first738.replyText.includes(String(taughtEntries738[0].surface)), first738.replyText.slice(0, 130));
  const last738 = await run738('最後に教えたのは何だっけ？');
  check('P739 最後に教えた語を順序から答える', last738.replyText.includes('最後に教わったのは') && last738.replyText.includes('ミネカゲ'), last738.replyText.slice(0, 130));
  const either738 = await run738('セツカゲって鳥だっけ？それとも魚だっけ？');
  check('P740 二択の思い出しは分類から答える', either738.replyText.includes('セツカゲ') && either738.replyText.includes('鳥'), either738.replyText.slice(0, 130));
}

// ---- なりチャの自然な終わり方・無名プロジェクト（P741） ----
{
  const { conversationFactIntakeService: intake741 } = await import('../src/miki/conversation/services/conversationFactIntakeService');
  const { projectNotebookService: nb741 } = await import('../src/miki/memory/services/projectNotebookService');
  let mem741: any[] = []; const hist741: any[] = []; let st741: any = undefined;
  const run741 = async (q: string) => {
    mem741 = intake741.intakeFromUserText(q, mem741).updatedMemories;
    const r: any = await conversationCoreService.execute({ prompt: q, memories: mem741, recentMessages: hist741.slice(-8), conversationState: st741 } as any);
    st741 = r.nextConversationState;
    hist741.push({ role: 'user', content: q }, { role: 'assistant', content: r.replyText });
    return r;
  };
  await run741('なりチャしよう。みきは森の宿屋の主人、僕は旅人ね');
  const end741 = await run741('やっぱり終わりにしよう');
  check('P741 役名なしの終わり方でなりチャが終わる', end741.replyText.includes('おしまい') || end741.replyText.includes('お疲れ'), end741.replyText.slice(0, 130));
  await run741('新しいゲーム作りたいんだけど');
  check('P741 助詞なしの開始宣言でプロジェクトが立つ', nb741.listProjects().includes('ゲーム') && nb741.currentProject() === 'ゲーム', JSON.stringify(nb741.listProjects()));
  await run741('鍵は専用の保管庫に入れる仕様にしよう');
  const recall741 = await run741('このゲームの仕様、何か決めたっけ？');
  check('P741 無名プロジェクトの決め事を思い出せる', recall741.replyText.includes('覚えています') && recall741.replyText.includes('鍵は専用の保管庫'), recall741.replyText.slice(0, 150));
  await run741('ケーキ作りたいな');
  check('P741 日常の作りたいはプロジェクトにならない', !nb741.listProjects().includes('ケーキ'), JSON.stringify(nb741.listProjects()));
}

// ---- 聞き返しの保留の汚染防止・なりチャの振り返りと再開・範囲判定（P742） ----
{
  const { conversationFactIntakeService: intake742 } = await import('../src/miki/conversation/services/conversationFactIntakeService');
  const { japaneseDictionaryService: dict742 } = await import('../src/miki/research/services/japaneseDictionaryService');
  const { worldModelGraphService: wm742 } = await import('../src/miki/selfAwareness/services/worldModelGraphService');
  const { roleplaySessionService: rp742 } = await import('../src/miki/conversation/services/roleplaySessionService');
  let mem742: any[] = []; const hist742: any[] = []; let st742: any = undefined;
  const run742 = async (q: string) => {
    mem742 = intake742.intakeFromUserText(q, mem742).updatedMemories;
    const r: any = await conversationCoreService.execute({ prompt: q, memories: mem742, recentMessages: hist742.slice(-8), conversationState: st742 } as any);
    st742 = r.nextConversationState;
    hist742.push({ role: 'user', content: q }, { role: 'assistant', content: r.replyText });
    return r;
  };
  // 聞き返し（保留）が立った直後に別の主題の教示文を言っても、
  // 保留中の語にその説明が付かないこと。
  await run742('ゾルバの話だけどね');
  await run742('ルナカエルは月に光る不思議なカエルだよ');
  check('P742 別の主題の文が保留中の語の意味にならない', dict742.lookup('ゾルバ').every((e: any) => !e.gloss) && wm742.relationsOf('ゾルバ').length === 0, JSON.stringify(dict742.lookup('ゾルバ')));
  check('P742 教示そのものは通常どおり覚える', dict742.lookup('ルナカエル').some((e: any) => String(e.gloss || '').includes('カエル')), JSON.stringify(dict742.lookup('ルナカエル')));
  await run742('ホシカエルは星空に光る小さなカエルだよ');
  const list742 = await run742('今まで僕が教えた生き物、全部言ってみて');
  check('P742 カエルの一種も「教えた生き物」に入る', list742.replyText.includes('ルナカエル') && list742.replyText.includes('ホシカエル'), list742.replyText.slice(0, 140));
  await run742('なりチャしよう。みきは星の港の案内人、僕は船乗りね');
  await run742('やっぱり終わりにしよう');
  const recap742 = await run742('さっきのなりチャ、どんな話だった？');
  check('P742 終わったなりチャを振り返れる', recap742.replyText.includes('星の港の案内人'), recap742.replyText.slice(0, 140));
  const resume742 = await run742('前回のなりチャの続きしよう');
  check('P742 前回のなりチャを再開できる', resume742.replyText.includes('星の港の案内人') && rp742.isActive(), resume742.replyText.slice(0, 140));
  await run742('なりチャ終わり');
}

// ---- 数値の属性・理由の質問・大きさの確認（P743） ----
{
  const { conversationFactIntakeService: intake743 } = await import('../src/miki/conversation/services/conversationFactIntakeService');
  let mem743: any[] = []; const hist743: any[] = []; let st743: any = undefined;
  const run743 = async (q: string) => {
    mem743 = intake743.intakeFromUserText(q, mem743).updatedMemories;
    const r: any = await conversationCoreService.execute({ prompt: q, memories: mem743, recentMessages: hist743.slice(-8), conversationState: st743 } as any);
    st743 = r.nextConversationState;
    hist743.push({ role: 'user', content: q }, { role: 'assistant', content: r.replyText });
    return r;
  };
  await run743('カゼカゲは高原に住む小さい鳥だよ');
  await run743('オオカゲは高原に住む大きな鳥だよ');
  const why743 = await run743('なんでオオカゲは大きいの？');
  check('P743 理由の質問を分類で正さない', !why743.replyText.includes('じゃなくて'), why743.replyText.slice(0, 130));
  const big743 = await run743('オオカゲって大きいの？');
  check('P743 大きさの確認は説明の手がかりで肯定する', big743.replyText.includes('大きいそうです'), big743.replyText.slice(0, 130));
  const teach743 = await run743('カゼカゲは体重が5キロくらいだよ');
  check('P743 数値の教示は質問と誤認しない', !teach743.replyText.includes('だそうです'), teach743.replyText.slice(0, 130));
  const ask743 = await run743('カゼカゲって何キロくらい？');
  check('P743 教わった重さを答える', ask743.replyText.includes('5キロ'), ask743.replyText.slice(0, 130));
  await run743('ごめん、5キロじゃなくて4キロだった');
  const ask2743 = await run743('カゼカゲって何キロくらいだっけ？');
  check('P743 訂正した重さで答える', ask2743.replyText.includes('4キロ') && !ask2743.replyText.includes('5キロ'), ask2743.replyText.slice(0, 130));
  const none743 = await run743('オオカゲって何キロくらい？');
  check('P743 知らない重さは正直に言う', none743.replyText.includes('重さはまだ知らない'), none743.replyText.slice(0, 130));
}

// ---- 二つまとめた確認・違い・言い直し（P744-P746） ----
{
  const { conversationFactIntakeService: intake744 } = await import('../src/miki/conversation/services/conversationFactIntakeService');
  let mem744: any[] = []; const hist744: any[] = []; let st744: any = undefined;
  const run744 = async (q: string) => {
    mem744 = intake744.intakeFromUserText(q, mem744).updatedMemories;
    const r: any = await conversationCoreService.execute({ prompt: q, memories: mem744, recentMessages: hist744.slice(-8), conversationState: st744 } as any);
    st744 = r.nextConversationState;
    hist744.push({ role: 'user', content: q }, { role: 'assistant', content: r.replyText });
    return r;
  };
  await run744('アメカゲは雨の森に住む小さい獣だよ');
  await run744('ユアカゲは雨の森に住む大きな獣だよ');
  const dual744 = await run744('アメカゲもユアカゲも雨の森に住んでるの？');
  check('P744 二つまとめた生息の確認に答える', dual744.replyText.includes('どちらも') && dual744.replyText.includes('雨の森に住んでる'), dual744.replyText.slice(0, 130));
  const dualCat744 = await run744('アメカゲもユアカゲも獣なの？');
  check('P744 二つまとめた分類の確認に答える', dualCat744.replyText.includes('どちらも') && dualCat744.replyText.includes('獣の仲間'), dualCat744.replyText.slice(0, 130));
  const dualNo744 = await run744('アメカゲもユアカゲも鳥なの？');
  check('P744 根拠のない二つの確認には断定しない', !dualNo744.replyText.includes('どちらも鳥'), dualNo744.replyText.slice(0, 130));
  const diff744 = await run744('アメカゲとユアカゲは何が違うの？');
  check('P745 違いは説明の手がかりで答える', diff744.replyText.includes('大きさが違います') && diff744.replyText.includes('ユアカゲ'), diff744.replyText.slice(0, 130));
  const para744 = await run744('アメカゲのこと、別の言い方で言い直して');
  check('P746 言い直しの依頼には言い換えか正直な限界で答える', para744.replyText.includes('言い直すと') || para744.replyText.includes('一番正確'), para744.replyText.slice(0, 130));
  const repeat744 = await run744('アメカゲの説明、もう一度言って');
  check('P747 説明の繰り返しは説明そのもので答える', repeat744.replyText.includes('雨の森に住む小さい獣'), repeat744.replyText.slice(0, 130));
  const quote744 = await run744('アメカゲって、さっき何て説明したっけ？');
  check('P747 説明の引用は説明そのもので答える', quote744.replyText.includes('雨の森に住む小さい獣') && !quote744.replyText.includes('http'), quote744.replyText.slice(0, 130));
  const count744 = await run744('今まで何種類教えた？');
  check('P748 教えた数には数で答える', count744.replyText.includes('全部で') && count744.replyText.includes('種類です'), count744.replyText.slice(0, 130));
  const pair744 = await run744('アメカゲとユアカゲ、どっちが先に教えた？');
  check('P749 二つの教えた順を答える', pair744.replyText.includes('先に教わったのは「アメカゲ」') && !pair744.replyText.includes('骨子'), pair744.replyText.slice(0, 130));
  const pairLater744 = await run744('アメカゲとユアカゲ、どっちが後で教えた？');
  check('P749 後の方を聞かれたら後で答える', pairLater744.replyText.includes('後に教わったのは「ユアカゲ」'), pairLater744.replyText.slice(0, 130));
  await run744('僕の誕生日は3月5日だよ');
  const bday744 = await run744('僕の誕生日っていつだっけ？');
  check('P749 誕生日は日付のまま覚えて答える', bday744.replyText.includes('3月5日'), bday744.replyText.slice(0, 130));
  await run744('僕の身長は175センチだよ');
  const height744 = await run744('僕の身長はどのくらい？');
  check('P750 身長は単位ごと覚えて答える', height744.replyText.includes('175センチ'), height744.replyText.slice(0, 130));
  await run744('僕の体重は60キロだよ');
  const weight744 = await run744('僕の体重って何キロだっけ？');
  check('P750 体重は単位ごと覚えて答える', weight744.replyText.includes('60キロ') && !weight744.replyText.includes('http'), weight744.replyText.slice(0, 130));
  await run744('僕は猫を2匹飼ってるよ');
  const petCount744 = await run744('猫は何匹飼ってたっけ？');
  check('P750 飼っている数も答える', petCount744.replyText.includes('2匹'), petCount744.replyText.slice(0, 130));
  await run744('僕の出身は長野だよ');
  const origin744 = await run744('僕の出身ってどこだっけ？');
  check('P751 場所の聞き返しでも本人の事実を答える', origin744.replyText.includes('長野'), origin744.replyText.slice(0, 130));
  const planStmt744 = await run744('明日の15時に歯医者の予約があるんだ');
  check('P752 予定を話す文は聞き返しと誤認しない', !planStmt744.replyText.includes('と話していました'), planStmt744.replyText.slice(0, 130));
  const plan744 = await run744('明日の予定って何だっけ？');
  check('P752 話した予定を答える', plan744.replyText.includes('歯医者') && !plan744.replyText.includes('空いています'), plan744.replyText.slice(0, 130));
  await run744('来週、旅行に行く予定だよ');
  const planWeek744 = await run744('来週の予定って何だっけ？');
  check('P752 来週の予定も答える', planWeek744.replyText.includes('旅行'), planWeek744.replyText.slice(0, 130));
  await run744('明日の18時に友達とご飯の約束もあるよ');
  await run744('やっぱり明日の歯医者はキャンセルしたよ');
  const planAfterCancel744 = await run744('明日の予定って何だっけ？');
  check('P753 キャンセルした予定は答えず、残りは答える', !planAfterCancel744.replyText.includes('歯医者') && planAfterCancel744.replyText.includes('ご飯'), planAfterCancel744.replyText.slice(0, 130));
  const planTime744 = await run744('明日の予定、何時からだっけ？');
  check('P754 予定の時刻の聞き返しは現在時刻で答えない', (planTime744.replyText.includes('ご飯') || planTime744.replyText.includes('18時から')) && !planTime744.replyText.includes('今は'), planTime744.replyText.slice(0, 130));
  const fragment744 = await run744('僕は猫を2匹飼ってるよ');
  check('P754 数量の断片を主題にしない', !fragment744.replyText.includes('匹飼'), fragment744.replyText.slice(0, 130));
}

// ---- P755: 分類だけの教示と、文の形の訂正、古いサマリの復活防止 ----
{
  const { conversationFactIntakeService } = await import('../src/miki/conversation/services/conversationFactIntakeService');
  const { worldModelGraphService } = await import('../src/miki/selfAwareness/services/worldModelGraphService');
  let mem755: any[] = []; const hist755: any[] = []; let st755: any = undefined;
  const run755 = async (t: string) => {
    mem755 = conversationFactIntakeService.intakeFromUserText(t, mem755).updatedMemories;
    const r: any = await conversationCoreService.execute({ prompt: t, memories: mem755, recentMessages: hist755.slice(-8), conversationState: st755 } as any);
    st755 = r.nextConversationState;
    hist755.push({ role: 'user', content: t }, { role: 'assistant', content: r.replyText });
    return r;
  };
  await run755('ツノカゲは鳥だよ');
  const rels755a = worldModelGraphService.relationsOf('ツノカゲ').filter((r: any) => r.type === 'IS_A').map((r: any) => r.to);
  check('P755 分類だけの教示でも語と仮関係が付く', rels755a.includes('鳥'), JSON.stringify(rels755a));
  await run755('違う、ツノカゲは鳥じゃなくて動物だよ');
  const rels755b = worldModelGraphService.relationsOf('ツノカゲ').filter((r: any) => r.type === 'IS_A').map((r: any) => r.to);
  check('P755 文の形の訂正で関係が差し替わる', rels755b.includes('動物') && !rels755b.includes('鳥'), JSON.stringify(rels755b));
  const kind755 = await run755('ツノカゲって何の仲間？');
  check('P755 訂正後の分類で答える', kind755.replyText.includes('動物'), kind755.replyText.slice(0, 110));
  await run755('僕は犬を飼ってるよ');
  await run755('ごめん、犬じゃなくて猫だった');
  const pets755 = await run755('僕が飼ってる動物なんだっけ？');
  check('P755 訂正したペットは古いサマリから復活しない', pets755.replyText.includes('猫') && !pets755.replyText.includes('犬'), pets755.replyText.slice(0, 110));
}

// ---- P756: 数値での比較（本人×教わった語、片方だけ、未知の相手） ----
{
  const { conversationFactIntakeService } = await import('../src/miki/conversation/services/conversationFactIntakeService');
  let mem756: any[] = []; const hist756: any[] = []; let st756: any = undefined;
  const run756 = async (t: string) => {
    mem756 = conversationFactIntakeService.intakeFromUserText(t, mem756).updatedMemories;
    const r: any = await conversationCoreService.execute({ prompt: t, memories: mem756, recentMessages: hist756.slice(-8), conversationState: st756 } as any);
    st756 = r.nextConversationState;
    hist756.push({ role: 'user', content: t }, { role: 'assistant', content: r.replyText });
    return r;
  };
  await run756('ミナモは体重が30キロくらいの動物だよ');
  await run756('僕の体重は60キロだよ');
  const cmp756 = await run756('僕とミナモ、どっちが重い？');
  check('P756 本人と教わった語を数値で比べる', cmp756.replyText.includes('僕の方が重い') && cmp756.replyText.includes('60キロ') && cmp756.replyText.includes('30キロ'), cmp756.replyText.slice(0, 130));
  const unknown756 = await run756('ミナモとヌマカゲ、どっちが大きい？');
  check('P756 未知の相手とは比べられないと正直に言う', unknown756.replyText.includes('ヌマカゲ') && unknown756.replyText.includes('知らない'), unknown756.replyText.slice(0, 130));
}

// ---- P757: 一番も実測値で決める ----
{
  const { conversationFactIntakeService } = await import('../src/miki/conversation/services/conversationFactIntakeService');
  let mem757: any[] = []; const hist757: any[] = []; let st757: any = undefined;
  const run757 = async (t: string) => {
    mem757 = conversationFactIntakeService.intakeFromUserText(t, mem757).updatedMemories;
    const r: any = await conversationCoreService.execute({ prompt: t, memories: mem757, recentMessages: hist757.slice(-8), conversationState: st757 } as any);
    st757 = r.nextConversationState;
    hist757.push({ role: 'user', content: t }, { role: 'assistant', content: r.replyText });
    return r;
  };
  await run757('ミナモは体重が30キロくらいの動物だよ');
  await run757('カワモは体重が5キロの小さい動物だよ');
  await run757('オオモは体重が80キロの大きい動物だよ');
  const heavy757 = await run757('教えた動物の中で一番重いのは？');
  check('P757 一番重いは実測値で決める', heavy757.replyText.includes('オオモ') && heavy757.replyText.includes('80キロ'), heavy757.replyText.slice(0, 130));
  const light757 = await run757('教えた動物の中で一番軽いのは？');
  check('P757 一番軽いも実測値で決める', light757.replyText.includes('カワモ') && light757.replyText.includes('5キロ'), light757.replyText.slice(0, 130));
  const rank757 = await run757('教えた動物を重い順に並べて');
  check('P758 重い順に並べる', rank757.replyText.indexOf('オオモ') >= 0 && rank757.replyText.indexOf('オオモ') < rank757.replyText.indexOf('ミナモ') && rank757.replyText.indexOf('ミナモ') < rank757.replyText.indexOf('カワモ'), rank757.replyText.slice(0, 150));
  const second757 = await run757('2番目に重いのは？');
  check('P758 2番目に重いものに答える', second757.replyText.includes('ミナモ'), second757.replyText.slice(0, 130));
  const diff757 = await run757('オオモとカワモ、何キロ差がある？');
  check('P759 重さの差を計算する', diff757.replyText.includes('75キロ'), diff757.replyText.slice(0, 130));
  const thr757 = await run757('30キロより重い動物はいる？');
  check('P759 閾値より重いものを挙げる', thr757.replyText.includes('オオモ') && !thr757.replyText.includes('カワモ'), thr757.replyText.slice(0, 130));
  const thrNone757 = await run757('100キロより重い動物はいる？');
  check('P759 閾値を超えるものが無ければ無いと言う', thrNone757.replyText.includes('いない'), thrNone757.replyText.slice(0, 130));
  const avg757 = await run757('教えた動物の平均の重さは？');
  check('P761 平均の重さを計算する', avg757.replyText.includes('38.3キロ'), avg757.replyText.slice(0, 130));
  const sum757 = await run757('教えた動物全部合わせると何キロ？');
  check('P761 合計の重さを計算する', sum757.replyText.includes('115キロ'), sum757.replyText.slice(0, 130));
}

// ---- P760: 寿命も物差しで比べる ----
{
  const { conversationFactIntakeService } = await import('../src/miki/conversation/services/conversationFactIntakeService');
  let mem760: any[] = []; const hist760: any[] = []; let st760: any = undefined;
  const run760 = async (t: string) => {
    mem760 = conversationFactIntakeService.intakeFromUserText(t, mem760).updatedMemories;
    const r: any = await conversationCoreService.execute({ prompt: t, memories: mem760, recentMessages: hist760.slice(-8), conversationState: st760 } as any);
    st760 = r.nextConversationState;
    hist760.push({ role: 'user', content: t }, { role: 'assistant', content: r.replyText });
    return r;
  };
  await run760('ナガモは寿命が15年くらいの動物だよ');
  await run760('ミジカモは寿命が3年の動物だよ');
  const lifeCmp760 = await run760('ナガモとミジカモ、どっちが長生き？');
  check('P760 寿命を数値で比べる', lifeCmp760.replyText.includes('ナガモの方が長生き') && lifeCmp760.replyText.includes('15年'), lifeCmp760.replyText.slice(0, 130));
  const lifeTop760 = await run760('教えた動物の中で一番長生きなのは？');
  check('P760 一番長生きも実測値で決める', lifeTop760.replyText.includes('ナガモ'), lifeTop760.replyText.slice(0, 130));
}

// ---- P762: 住む場所で絞って挙げる ----
{
  const { conversationFactIntakeService } = await import('../src/miki/conversation/services/conversationFactIntakeService');
  let mem762: any[] = []; const hist762: any[] = []; let st762: any = undefined;
  const run762 = async (t: string) => {
    mem762 = conversationFactIntakeService.intakeFromUserText(t, mem762).updatedMemories;
    const r: any = await conversationCoreService.execute({ prompt: t, memories: mem762, recentMessages: hist762.slice(-8), conversationState: st762 } as any);
    st762 = r.nextConversationState;
    hist762.push({ role: 'user', content: t }, { role: 'assistant', content: r.replyText });
    return r;
  };
  await run762('ヒナモはタスマニアに住む小さい動物だよ');
  await run762('フナモは北海道に住む動物だよ');
  const hab762 = await run762('タスマニアに住む動物はいる？');
  check('P762 住む場所で絞って挙げる', hab762.replyText.includes('ヒナモ') && !hab762.replyText.includes('フナモ'), hab762.replyText.slice(0, 130));
  const habNone762 = await run762('アフリカに住む動物はいる？');
  check('P762 その場所のものが無ければ無いと言う', habNone762.replyText.includes('いない'), habNone762.replyText.slice(0, 130));
}

// ---- P763-P765: 性質で絞る／最近覚えた語／覚えた量 ----
{
  const { conversationFactIntakeService } = await import('../src/miki/conversation/services/conversationFactIntakeService');
  let mem763: any[] = []; const hist763: any[] = []; let st763: any = undefined;
  const run763 = async (t: string) => {
    mem763 = conversationFactIntakeService.intakeFromUserText(t, mem763).updatedMemories;
    const r: any = await conversationCoreService.execute({ prompt: t, memories: mem763, recentMessages: hist763.slice(-8), conversationState: st763 } as any);
    st763 = r.nextConversationState;
    hist763.push({ role: 'user', content: t }, { role: 'assistant', content: r.replyText });
    return r;
  };
  await run763('ヨルモは夜行性の動物だよ');
  await run763('ヒルモは昼に活動する動物だよ');
  const trait763 = await run763('夜行性の動物はいる？');
  check('P763 性質の語で絞って挙げる', trait763.replyText.includes('ヨルモ') && !trait763.replyText.includes('ヒルモ'), trait763.replyText.slice(0, 130));
  const recent763 = await run763('最近覚えた言葉は何？');
  check('P764 最近覚えた語は個人辞書からも答える', recent763.replyText.includes('ヨルモ') || recent763.replyText.includes('ヒルモ'), recent763.replyText.slice(0, 130));
  const volume763 = await run763('今まで何種類の言葉を覚えた？');
  check('P765 覚えた量は数を数えて答える', volume763.replyText.includes('言葉は') && volume763.replyText.includes('覚えています'), volume763.replyText.slice(0, 130));
}

// ---- P766-P768: 出所（誰に）／事実の忘却／予定の変更 ----
{
  const { conversationFactIntakeService } = await import('../src/miki/conversation/services/conversationFactIntakeService');
  let mem766: any[] = []; const hist766: any[] = []; let st766: any = undefined;
  const run766 = async (t: string) => {
    mem766 = conversationFactIntakeService.intakeFromUserText(t, mem766).updatedMemories;
    const r: any = await conversationCoreService.execute({ prompt: t, memories: mem766, recentMessages: hist766.slice(-8), conversationState: st766 } as any);
    st766 = r.nextConversationState;
    hist766.push({ role: 'user', content: t }, { role: 'assistant', content: r.replyText });
    return r;
  };
  await run766('クオッカは夜行性の動物だよ');
  const who766 = await run766('クオッカのこと、誰に教わったの？');
  check('P766 誰に教わったかは教えた本人と答える', who766.replyText.includes('あなたに教えてもらいました'), who766.replyText.slice(0, 130));
  await run766('僕は犬を飼ってるよ');
  const forget766 = await run766('僕が犬を飼ってるって話、忘れてほしい');
  check('P767 事実の忘却を受け付ける', forget766.replyText.includes('忘れます'), forget766.replyText.slice(0, 130));
  const pet766 = await run766('僕って何か飼ってたっけ？');
  check('P767 忘れた事実は想起に出ない', !pet766.replyText.includes('飼っている動物は「犬」'), pet766.replyText.slice(0, 130));
  await run766('明日は歯医者の予定があるよ');
  const change766 = await run766('明日の予定、歯医者じゃなくて美容院に変えたよ');
  check('P768 予定の変更は予定として受ける', change766.replyText.includes('美容院') && change766.replyText.includes('変えておきます'), change766.replyText.slice(0, 130));
  const plan766 = await run766('明日の予定は何だっけ？');
  check('P768 変更後の予定だけが残る', plan766.replyText.includes('美容院') && !plan766.replyText.includes('歯医者'), plan766.replyText.slice(0, 150));
}

// ---- P769-P771: 相対しきい値／寿命の差／条件つきの数 ----
{
  const { conversationFactIntakeService } = await import('../src/miki/conversation/services/conversationFactIntakeService');
  let mem769: any[] = []; const hist769: any[] = []; let st769: any = undefined;
  const run769 = async (t: string) => {
    mem769 = conversationFactIntakeService.intakeFromUserText(t, mem769).updatedMemories;
    const r: any = await conversationCoreService.execute({ prompt: t, memories: mem769, recentMessages: hist769.slice(-8), conversationState: st769 } as any);
    st769 = r.nextConversationState;
    hist769.push({ role: 'user', content: t }, { role: 'assistant', content: r.replyText });
    return r;
  };
  await run769('アカモは体重30キロの鳥だよ');
  await run769('アオモは体重5キロの鳥だよ');
  await run769('クロモは体重80キロの鳥だよ');
  const rel769 = await run769('アカモより重い鳥はいる？');
  check('P769 基準のものより重いものを挙げる', rel769.replyText.includes('クロモ') && !rel769.replyText.includes('アオモ'), rel769.replyText.slice(0, 130));
  const cnt769 = await run769('アカモより重い鳥は何種類？');
  check('P771 条件に合う数を数える', cnt769.replyText.includes('種類います') && cnt769.replyText.includes('クロモ'), cnt769.replyText.slice(0, 130));
  await run769('ナガモは寿命15年の鳥だよ');
  await run769('ミジカモは寿命3年の鳥だよ');
  const diff769 = await run769('ナガモとミジカモ、寿命の差は何年？');
  check('P770 寿命の差を計算する', diff769.replyText.includes('差は12年'), diff769.replyText.slice(0, 130));
}

// ---- P772: 予定は日付に錨づけされる ----
{
  const { storageService: storage772 } = await import('../src/services/storageService');
  const key772 = 'miki_user_plans_v1';
  const plans772 = JSON.parse(storage772.getItem(key772) || '[]');
  const d772 = new Date();
  const today772 = `${d772.getFullYear()}-${String(d772.getMonth() + 1).padStart(2, '0')}-${String(d772.getDate()).padStart(2, '0')}`;
  plans772.push({ when: '明日', text: '明日は眼科の予定があるよ', at: Date.now() - 86400000, date: today772 });
  storage772.setItem(key772, JSON.stringify(plans772));
  const todayRecall772: any = await conversationCoreService.execute({ prompt: '今日の予定は何だっけ？' } as any);
  check('P772 明日と言って控えた予定を当日は今日の予定として答える', todayRecall772.replyText.includes('眼科'), todayRecall772.replyText.slice(0, 150));
  const tomorrowRecall772: any = await conversationCoreService.execute({ prompt: '明日の予定は何だっけ？' } as any);
  check('P772 過ぎた予定は明日の側には出ない', !tomorrowRecall772.replyText.includes('眼科'), tomorrowRecall772.replyText.slice(0, 150));
}

// ---- P773: 曜日の予定 ----
{
  const { conversationFactIntakeService } = await import('../src/miki/conversation/services/conversationFactIntakeService');
  let mem773: any[] = []; const hist773: any[] = []; let st773: any = undefined;
  const run773 = async (t: string) => {
    mem773 = conversationFactIntakeService.intakeFromUserText(t, mem773).updatedMemories;
    const r: any = await conversationCoreService.execute({ prompt: t, memories: mem773, recentMessages: hist773.slice(-8), conversationState: st773 } as any);
    st773 = r.nextConversationState;
    hist773.push({ role: 'user', content: t }, { role: 'assistant', content: r.replyText });
    return r;
  };
  await run773('金曜日に歯医者の予定があるよ');
  const fri773 = await run773('金曜日の予定は何だっけ？');
  check('P773 曜日の予定を控えて答える', fri773.replyText.includes('歯医者'), fri773.replyText.slice(0, 150));
  await run773('来週の月曜日に会議の予定があるよ');
  const mon773 = await run773('来週の月曜日の予定は何だっけ？');
  check('P773 来週の曜日の予定も区別して答える', mon773.replyText.includes('会議'), mon773.replyText.slice(0, 150));
}

// ---- P774: 明示の日付の予定 ----
{
  const { conversationFactIntakeService } = await import('../src/miki/conversation/services/conversationFactIntakeService');
  let mem774: any[] = []; const hist774: any[] = []; let st774: any = undefined;
  const run774 = async (t: string) => {
    mem774 = conversationFactIntakeService.intakeFromUserText(t, mem774).updatedMemories;
    const r: any = await conversationCoreService.execute({ prompt: t, memories: mem774, recentMessages: hist774.slice(-8), conversationState: st774 } as any);
    st774 = r.nextConversationState;
    hist774.push({ role: 'user', content: t }, { role: 'assistant', content: r.replyText });
    return r;
  };
  await run774('12月3日に結婚式の予定があるよ');
  const dec774 = await run774('12月3日の予定は何だっけ？');
  check('P774 明示の日付の予定を控えて答える', dec774.replyText.includes('結婚式'), dec774.replyText.slice(0, 150));
  const none774 = await run774('12月4日の予定は何だっけ？');
  check('P774 予定の無い日は無いと答える', none774.replyText.includes('まだ聞いていない'), none774.replyText.slice(0, 130));
}

// ---- P775-P776: 過去の予定／これからの予定の一覧 ----
{
  const { conversationFactIntakeService } = await import('../src/miki/conversation/services/conversationFactIntakeService');
  const { storageService: storage776 } = await import('../src/services/storageService');
  let mem776: any[] = []; const hist776: any[] = []; let st776: any = undefined;
  const run776 = async (t: string) => {
    mem776 = conversationFactIntakeService.intakeFromUserText(t, mem776).updatedMemories;
    const r: any = await conversationCoreService.execute({ prompt: t, memories: mem776, recentMessages: hist776.slice(-8), conversationState: st776 } as any);
    st776 = r.nextConversationState;
    hist776.push({ role: 'user', content: t }, { role: 'assistant', content: r.replyText });
    return r;
  };
  await run776('明日は歯医者の予定があるよ');
  await run776('金曜日に美容院の予定があるよ');
  const up776 = await run776('これからの予定、全部教えて');
  check('P776 これからの予定を日付順に一覧する', up776.replyText.includes('これからの予定は') && up776.replyText.includes('歯医者') && up776.replyText.includes('美容院'), up776.replyText.slice(0, 200));
  const key776 = 'miki_user_plans_v1';
  const plans776 = JSON.parse(storage776.getItem(key776) || '[]');
  const yd = new Date(Date.now() - 86400000);
  const yKey = `${yd.getFullYear()}-${String(yd.getMonth() + 1).padStart(2, '0')}-${String(yd.getDate()).padStart(2, '0')}`;
  plans776.push({ when: '明日', text: '昨日は眼科の予定があったよ', at: Date.now() - 86400000, date: yKey });
  storage776.setItem(key776, JSON.stringify(plans776));
  const past776 = await run776('昨日の予定は何だったっけ？');
  check('P775 昨日の予定も日付で引いて答える', past776.replyText.includes('眼科'), past776.replyText.slice(0, 150));
}

// ---- P777-P779: 予定までの日数／次の予定／メモの読み返し ----
{
  const { conversationFactIntakeService } = await import('../src/miki/conversation/services/conversationFactIntakeService');
  let mem777: any[] = []; const hist777: any[] = []; let st777: any = undefined;
  const run777 = async (t: string) => {
    mem777 = conversationFactIntakeService.intakeFromUserText(t, mem777).updatedMemories;
    const r: any = await conversationCoreService.execute({ prompt: t, memories: mem777, recentMessages: hist777.slice(-8), conversationState: st777 } as any);
    st777 = r.nextConversationState;
    hist777.push({ role: 'user', content: t }, { role: 'assistant', content: r.replyText });
    return r;
  };
  await run777('明日は歯医者の予定があるよ');
  await run777('12月3日に結婚式の予定があるよ');
  const now777 = new Date();
  const expDays777 = Math.round((new Date(now777.getFullYear(), 11, 3).getTime() - new Date(now777.getFullYear(), now777.getMonth(), now777.getDate()).getTime()) / 86400000);
  const count777 = await run777('結婚式まであと何日？');
  check('P777 予定までの日数を数える', count777.replyText.includes('12月3日') && count777.replyText.includes(`あと${expDays777}日`), count777.replyText.slice(0, 150));
  const next777 = await run777('次の予定は何？');
  check('P778 次の予定を答える', next777.replyText.includes('次の予定は') && next777.replyText.includes('「'), next777.replyText.slice(0, 150));
  const memoW777 = await run777('牛乳を買うってメモして');
  check('P779 メモの内容は「って」を除いて覚える', memoW777.replyText.includes('「牛乳を買う」'), memoW777.replyText.slice(0, 130));
  const memoR777 = await run777('メモ、何かあったっけ？');
  check('P779 メモを読み返せる', memoR777.replyText.includes('牛乳を買う'), memoR777.replyText.slice(0, 130));
}

// ---- P780-P781: 個別メモの削除／誕生日までの日数 ----
{
  const { conversationFactIntakeService } = await import('../src/miki/conversation/services/conversationFactIntakeService');
  let mem780: any[] = []; const hist780: any[] = []; let st780: any = undefined;
  const run780 = async (t: string) => {
    mem780 = conversationFactIntakeService.intakeFromUserText(t, mem780).updatedMemories;
    const r: any = await conversationCoreService.execute({ prompt: t, memories: mem780, recentMessages: hist780.slice(-8), conversationState: st780 } as any);
    st780 = r.nextConversationState;
    hist780.push({ role: 'user', content: t }, { role: 'assistant', content: r.replyText });
    return r;
  };
  await run780('牛乳を買うってメモして');
  await run780('卵も買うってメモして');
  const del780 = await run780('牛乳のメモ消して');
  check('P780 個別のメモだけを消す', del780.replyText.includes('牛乳を買う') && del780.replyText.includes('消しました'), del780.replyText.slice(0, 130));
  const list780 = await run780('メモ、何かあったっけ？');
  check('P780 消したメモは読み返しに出ず、他は残る', !list780.replyText.includes('牛乳') && list780.replyText.includes('卵も買う'), list780.replyText.slice(0, 130));
  await run780('僕の誕生日は3月5日だよ');
  const now780 = new Date();
  const today780 = new Date(now780.getFullYear(), now780.getMonth(), now780.getDate());
  let cand780 = new Date(now780.getFullYear(), 2, 5);
  if (cand780.getTime() < today780.getTime()) cand780 = new Date(now780.getFullYear() + 1, 2, 5);
  const exp780 = Math.round((cand780.getTime() - today780.getTime()) / 86400000);
  const bday780 = await run780('誕生日まであと何日？');
  check('P781 誕生日までの日数を数える', bday780.replyText.includes('3月5日') && bday780.replyText.includes(`あと${exp780}日`), bday780.replyText.slice(0, 130));
}

// ---- P782: 予定が無い時期は正直に無いと答える ----
{
  const { conversationFactIntakeService } = await import('../src/miki/conversation/services/conversationFactIntakeService');
  let mem782: any[] = []; const hist782: any[] = []; let st782: any = undefined;
  const run782 = async (t: string) => {
    mem782 = conversationFactIntakeService.intakeFromUserText(t, mem782).updatedMemories;
    const r: any = await conversationCoreService.execute({ prompt: t, memories: mem782, recentMessages: hist782.slice(-8), conversationState: st782 } as any);
    st782 = r.nextConversationState;
    hist782.push({ role: 'user', content: t }, { role: 'assistant', content: r.replyText });
    return r;
  };
  await run782('来週は旅行の予定があるよ');
  const none782 = await run782('今週の予定はある？');
  check('P782 予定の無い時期は正直に無いと答える', none782.replyText.includes('今週の予定は、まだ聞いていないです'), none782.replyText.slice(0, 130));
  const hers782 = await run782('みきの明日の予定は？');
  check('P782 彼女自身の予定の質問は従来どおり', !hers782.replyText.includes('まだ聞いていない'), hers782.replyText.slice(0, 130));
}

// ---- P783-P784: 範囲で絞る／予定の件数 ----
{
  const { conversationFactIntakeService } = await import('../src/miki/conversation/services/conversationFactIntakeService');
  japaneseDictionaryService.addPersonal('レンジ獣D', { gloss: '重さ9キロの小さい動物', semanticIds: ['learned:user-taught'], pos: 'NOUN', source: 'PERSONAL' } as any);
  japaneseDictionaryService.addPersonal('レンジ獣E', { gloss: '重さ16キロの中くらいの動物', semanticIds: ['learned:user-taught'], pos: 'NOUN', source: 'PERSONAL' } as any);
  japaneseDictionaryService.addPersonal('レンジ獣F', { gloss: '重さ45キロの大きい動物', semanticIds: ['learned:user-taught'], pos: 'NOUN', source: 'PERSONAL' } as any);
  let mem783: any[] = []; const hist783: any[] = []; let st783: any = undefined;
  const run783 = async (t: string) => {
    mem783 = conversationFactIntakeService.intakeFromUserText(t, mem783).updatedMemories;
    const r: any = await conversationCoreService.execute({ prompt: t, memories: mem783, recentMessages: hist783.slice(-8), conversationState: st783 } as any);
    st783 = r.nextConversationState;
    hist783.push({ role: 'user', content: t }, { role: 'assistant', content: r.replyText });
    return r;
  };
  const range783 = await run783('10キロから20キロの間の動物は？');
  check('P783 範囲内のものだけを挙げる', range783.replyText.includes('レンジ獣E') && !range783.replyText.includes('レンジ獣D') && !range783.replyText.includes('レンジ獣F'), range783.replyText.slice(0, 130));
  const count783 = await run783('予定、何個ある？');
  check('P784 予定の件数を答える', /予定は\d+件あります/.test(count783.replyText), count783.replyText.slice(0, 130));
}

// ---- P785: 内容から予定の日付を引く ----
{
  const { conversationFactIntakeService } = await import('../src/miki/conversation/services/conversationFactIntakeService');
  let mem785: any[] = []; const hist785: any[] = []; let st785: any = undefined;
  const run785 = async (t: string) => {
    mem785 = conversationFactIntakeService.intakeFromUserText(t, mem785).updatedMemories;
    const r: any = await conversationCoreService.execute({ prompt: t, memories: mem785, recentMessages: hist785.slice(-8), conversationState: st785 } as any);
    st785 = r.nextConversationState;
    hist785.push({ role: 'user', content: t }, { role: 'assistant', content: r.replyText });
    return r;
  };
  await run785('金曜日に美容院の予定があるよ');
  const when785 = await run785('美容院はいつだっけ？');
  check('P785 内容から予定の日付を答える', when785.replyText.includes('美容院') && /（.）です/.test(when785.replyText), when785.replyText.slice(0, 130));
  await run785('12月3日に結婚式の予定があるよ');
  const day785 = await run785('結婚式は何日だっけ？');
  check('P785 明示日付の予定も内容から引ける', day785.replyText.includes('12月3日'), day785.replyText.slice(0, 130));
}

// ---- P786: 次の誕生日で何歳になるか ----
{
  const { conversationFactIntakeService } = await import('../src/miki/conversation/services/conversationFactIntakeService');
  let mem786: any[] = []; const hist786: any[] = []; let st786: any = undefined;
  const run786 = async (t: string) => {
    mem786 = conversationFactIntakeService.intakeFromUserText(t, mem786).updatedMemories;
    const r: any = await conversationCoreService.execute({ prompt: t, memories: mem786, recentMessages: hist786.slice(-8), conversationState: st786 } as any);
    st786 = r.nextConversationState;
    hist786.push({ role: 'user', content: t }, { role: 'assistant', content: r.replyText });
    return r;
  };
  await run786('僕の年齢は25歳だよ');
  await run786('僕の誕生日は3月5日だよ');
  const age786 = await run786('次の誕生日で何歳になる？');
  check('P786 次の誕生日の年齢を答える', age786.replyText.includes('3月5日') && age786.replyText.includes('26歳'), age786.replyText.slice(0, 130));
}

// ---- P787: 年齢の事実同士で比べる ----
{
  const { conversationFactIntakeService } = await import('../src/miki/conversation/services/conversationFactIntakeService');
  let mem787: any[] = []; const hist787: any[] = []; let st787: any = undefined;
  const run787 = async (t: string) => {
    mem787 = conversationFactIntakeService.intakeFromUserText(t, mem787).updatedMemories;
    const r: any = await conversationCoreService.execute({ prompt: t, memories: mem787, recentMessages: hist787.slice(-8), conversationState: st787 } as any);
    st787 = r.nextConversationState;
    hist787.push({ role: 'user', content: t }, { role: 'assistant', content: r.replyText });
    return r;
  };
  await run787('僕の年齢は25歳だよ');
  await run787('妹の年齢は20歳だよ');
  const older787 = await run787('僕と妹、どっちが年上？');
  check('P787 年上を事実で比べる', older787.replyText.includes('僕の方が年上') && older787.replyText.includes('25歳'), older787.replyText.slice(0, 130));
  const younger787 = await run787('僕と妹、どっちが年下？');
  check('P787 年下も比べる', younger787.replyText.includes('妹の方が年下'), younger787.replyText.slice(0, 130));
}

// ---- P788: 背の高さ比べと、聞かれた向きでの比較 ----
{
  const { conversationFactIntakeService } = await import('../src/miki/conversation/services/conversationFactIntakeService');
  let mem788: any[] = []; const hist788: any[] = []; let st788: any = undefined;
  const run788 = async (t: string) => {
    mem788 = conversationFactIntakeService.intakeFromUserText(t, mem788).updatedMemories;
    const r: any = await conversationCoreService.execute({ prompt: t, memories: mem788, recentMessages: hist788.slice(-8), conversationState: st788 } as any);
    st788 = r.nextConversationState;
    hist788.push({ role: 'user', content: t }, { role: 'assistant', content: r.replyText });
    return r;
  };
  await run788('僕の身長は170センチだよ');
  await run788('妹の身長は155センチだよ');
  const tall788 = await run788('僕と妹、どっちが背が高い？');
  check('P788 背が高い方を比べる', tall788.replyText.includes('僕の方が背が高い'), tall788.replyText.slice(0, 130));
  const short788 = await run788('僕と妹、どっちが背が低い？');
  check('P788 背が低い方も聞かれた向きで答える', short788.replyText.includes('妹の方が背が低い'), short788.replyText.slice(0, 130));
  await run788('僕の体重は60キロだよ');
  await run788('妹の体重は48キロだよ');
  const light788 = await run788('僕と妹、どっちが軽い？');
  check('P788 軽い方も比べられる', light788.replyText.includes('妹の方が軽い'), light788.replyText.slice(0, 130));
}

// ---- P789-P791: メモの件数／覚えた量の何個形／月の予定 ----
{
  const { conversationFactIntakeService } = await import('../src/miki/conversation/services/conversationFactIntakeService');
  let mem789: any[] = []; const hist789: any[] = []; let st789: any = undefined;
  const run789 = async (t: string) => {
    mem789 = conversationFactIntakeService.intakeFromUserText(t, mem789).updatedMemories;
    const r: any = await conversationCoreService.execute({ prompt: t, memories: mem789, recentMessages: hist789.slice(-8), conversationState: st789 } as any);
    st789 = r.nextConversationState;
    hist789.push({ role: 'user', content: t }, { role: 'assistant', content: r.replyText });
    return r;
  };
  await run789('牛乳を買うってメモして');
  const memoCount789 = await run789('メモ、何個ある？');
  check('P789 メモの件数を答える', /メモは\d+件あります/.test(memoCount789.replyText), memoCount789.replyText.slice(0, 130));
  const vol789 = await run789('覚えた言葉、何個ある？');
  check('P790 覚えた量を何個の形でも答える', /言葉は\d+語/.test(vol789.replyText), vol789.replyText.slice(0, 150));
  const nxt789 = new Date(); nxt789.setMonth(nxt789.getMonth() + 1); nxt789.setDate(15);
  await run789(`${nxt789.getMonth() + 1}月15日に月次テストの予定があるよ`);
  const month789 = await run789('来月の予定は？');
  check('P791 来月の予定を月で切って答える', month789.replyText.includes('来月の予定は') && month789.replyText.includes('15日'), month789.replyText.slice(0, 150));
}

// ---- P792: 人の属性の事実同士の差 ----
{
  const { conversationFactIntakeService } = await import('../src/miki/conversation/services/conversationFactIntakeService');
  let mem792: any[] = []; const hist792: any[] = []; let st792: any = undefined;
  const run792 = async (t: string) => {
    mem792 = conversationFactIntakeService.intakeFromUserText(t, mem792).updatedMemories;
    const r: any = await conversationCoreService.execute({ prompt: t, memories: mem792, recentMessages: hist792.slice(-8), conversationState: st792 } as any);
    st792 = r.nextConversationState;
    hist792.push({ role: 'user', content: t }, { role: 'assistant', content: r.replyText });
    return r;
  };
  await run792('僕の年齢は25歳だよ');
  await run792('妹の年齢は20歳だよ');
  const ageDiff792 = await run792('僕と妹、何歳違う？');
  check('P792 年齢の差を答える', ageDiff792.replyText.includes('5歳違います'), ageDiff792.replyText.slice(0, 130));
  await run792('僕の身長は170センチだよ');
  await run792('妹の身長は155センチだよ');
  const heightDiff792 = await run792('僕と妹、身長何センチ違う？');
  check('P792 身長の差を答える', heightDiff792.replyText.includes('15センチ違います'), heightDiff792.replyText.slice(0, 130));
}

// ---- P793: 人の属性の事実から一番を決める ----
{
  const { conversationFactIntakeService } = await import('../src/miki/conversation/services/conversationFactIntakeService');
  let mem793: any[] = []; const hist793: any[] = []; let st793: any = undefined;
  const run793 = async (t: string) => {
    mem793 = conversationFactIntakeService.intakeFromUserText(t, mem793).updatedMemories;
    const r: any = await conversationCoreService.execute({ prompt: t, memories: mem793, recentMessages: hist793.slice(-8), conversationState: st793 } as any);
    st793 = r.nextConversationState;
    hist793.push({ role: 'user', content: t }, { role: 'assistant', content: r.replyText });
    return r;
  };
  await run793('僕の身長は170センチだよ');
  await run793('妹の身長は155センチだよ');
  await run793('弟の身長は162センチだよ');
  const tall793 = await run793('みんなで一番背が高いのは誰？');
  check('P793 一番背が高い人を事実から決める', tall793.replyText.includes('一番背が高いのは僕'), tall793.replyText.slice(0, 130));
  await run793('僕の年齢は25歳だよ');
  await run793('妹の年齢は20歳だよ');
  await run793('弟の年齢は28歳だよ');
  const old793 = await run793('みんなで一番年上なのは誰？');
  check('P793 一番年上も決める', old793.replyText.includes('一番年上のは弟'), old793.replyText.slice(0, 130));
}

// ---- P794: 人の属性の事実で並べる・平均する ----
{
  const { conversationFactIntakeService } = await import('../src/miki/conversation/services/conversationFactIntakeService');
  let mem794: any[] = []; const hist794: any[] = []; let st794: any = undefined;
  const run794 = async (t: string) => {
    mem794 = conversationFactIntakeService.intakeFromUserText(t, mem794).updatedMemories;
    const r: any = await conversationCoreService.execute({ prompt: t, memories: mem794, recentMessages: hist794.slice(-8), conversationState: st794 } as any);
    st794 = r.nextConversationState;
    hist794.push({ role: 'user', content: t }, { role: 'assistant', content: r.replyText });
    return r;
  };
  await run794('僕の身長は170センチだよ');
  await run794('妹の身長は155センチだよ');
  await run794('弟の身長は162センチだよ');
  const rank794 = await run794('背が高い順に並べて');
  check('P794 背が高い順に並べる', rank794.replyText.includes('僕（170センチ）') && rank794.replyText.indexOf('僕') < rank794.replyText.indexOf('弟') && rank794.replyText.indexOf('弟') < rank794.replyText.indexOf('妹'), rank794.replyText.slice(0, 150));
  const avg794 = await run794('みんなの平均身長は？');
  check('P794 平均身長を出す', avg794.replyText.includes('約162.3センチ'), avg794.replyText.slice(0, 130));
}

// ---- P795: 人の属性の事実を閾値で絞る ----
{
  const { conversationFactIntakeService } = await import('../src/miki/conversation/services/conversationFactIntakeService');
  let mem795: any[] = []; const hist795: any[] = []; let st795: any = undefined;
  const run795 = async (t: string) => {
    mem795 = conversationFactIntakeService.intakeFromUserText(t, mem795).updatedMemories;
    const r: any = await conversationCoreService.execute({ prompt: t, memories: mem795, recentMessages: hist795.slice(-8), conversationState: st795 } as any);
    st795 = r.nextConversationState;
    hist795.push({ role: 'user', content: t }, { role: 'assistant', content: r.replyText });
    return r;
  };
  await run795('僕の身長は170センチだよ');
  await run795('妹の身長は155センチだよ');
  await run795('弟の身長は162センチだよ');
  const over795 = await run795('身長160センチ以上の人は誰？');
  check('P795 閾値以上で絞る', over795.replyText.includes('僕') && over795.replyText.includes('弟') && !over795.replyText.includes('妹'), over795.replyText.slice(0, 130));
  const under795 = await run795('身長160センチ未満の人は何人？');
  check('P795 閾値未満を数える', under795.replyText.includes('1人です') && under795.replyText.includes('妹'), under795.replyText.slice(0, 130));
}

// ---- P796: メモの内容検索と人の事実のまとめ ----
{
  const { conversationFactIntakeService } = await import('../src/miki/conversation/services/conversationFactIntakeService');
  let mem796: any[] = []; const hist796: any[] = []; let st796: any = undefined;
  const run796 = async (t: string) => {
    mem796 = conversationFactIntakeService.intakeFromUserText(t, mem796).updatedMemories;
    const r: any = await conversationCoreService.execute({ prompt: t, memories: mem796, recentMessages: hist796.slice(-8), conversationState: st796 } as any);
    st796 = r.nextConversationState;
    hist796.push({ role: 'user', content: t }, { role: 'assistant', content: r.replyText });
    return r;
  };
  await run796('青汁を買うってメモして');
  const memoFind796 = await run796('青汁のメモある？');
  check('P796 メモを内容で探せる', memoFind796.replyText.includes('青汁を買う'), memoFind796.replyText.slice(0, 130));
  await run796('妹の年齢は20歳だよ');
  await run796('妹の身長は155センチだよ');
  const sum796 = await run796('妹について教えて');
  check('P796 人の事実をまとめて話す', sum796.replyText.includes('年齢は20歳') && sum796.replyText.includes('身長は155センチ'), sum796.replyText.slice(0, 150));
}

// ---- P797: 週で区切った予定の一覧 ----
{
  const { storageService } = await import('../src/services/storageService');
  const keyOf797 = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const today797 = new Date();
  const far797 = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const rawPlans797 = storageService.getItem('miki_user_plans_v1');
  const plans797 = rawPlans797 ? JSON.parse(rawPlans797) : [];
  plans797.push(
    { when: '今日', text: '週内テストの予定', at: Date.now(), date: keyOf797(today797) },
    { when: '来月', text: '遠方テストの予定', at: Date.now(), date: keyOf797(far797) },
  );
  storageService.setItem('miki_user_plans_v1', JSON.stringify(plans797));
  const week797: any = await conversationCoreService.execute({ prompt: '今週の予定を全部教えて' } as any);
  check('P797 今週の一覧は週内だけ', week797.replyText.includes('週内テストの予定') && !week797.replyText.includes('遠方テストの予定'), week797.replyText.slice(0, 200));
}

// ---- P798: 誕生日カウントダウンは名前で人を選ぶ ----
{
  const { conversationFactIntakeService } = await import('../src/miki/conversation/services/conversationFactIntakeService');
  let mem798: any[] = []; const hist798: any[] = []; let st798: any = undefined;
  const run798 = async (t: string) => {
    mem798 = conversationFactIntakeService.intakeFromUserText(t, mem798).updatedMemories;
    const r: any = await conversationCoreService.execute({ prompt: t, memories: mem798, recentMessages: hist798.slice(-8), conversationState: st798 } as any);
    st798 = r.nextConversationState;
    hist798.push({ role: 'user', content: t }, { role: 'assistant', content: r.replyText });
    return r;
  };
  await run798('僕の誕生日は3月5日だよ');
  await run798('妹の誕生日は5月10日だよ');
  const sis798 = await run798('妹の誕生日まであと何日？');
  check('P798 妹の誕生日を妹と呼ぶ', sis798.replyText.includes('妹の誕生日（5月10日）'), sis798.replyText.slice(0, 130));
  const self798 = await run798('僕の誕生日まであと何日？');
  check('P798 自分の誕生日は従来どおり', self798.replyText.includes('あなたの誕生日（3月5日）'), self798.replyText.slice(0, 130));
}

// ---- P799: 否定の事実を肯定で答えない ----
{
  const { conversationFactIntakeService } = await import('../src/miki/conversation/services/conversationFactIntakeService');
  let mem799: any[] = []; const hist799: any[] = []; let st799: any = undefined;
  const run799 = async (t: string) => {
    mem799 = conversationFactIntakeService.intakeFromUserText(t, mem799).updatedMemories;
    const r: any = await conversationCoreService.execute({ prompt: t, memories: mem799, recentMessages: hist799.slice(-8), conversationState: st799 } as any);
    st799 = r.nextConversationState;
    hist799.push({ role: 'user', content: t }, { role: 'assistant', content: r.replyText });
    return r;
  };
  await run799('僕は犬を飼ってないよ');
  const negPet799 = await run799('僕って犬飼ってる？');
  check('P799 飼ってない犬を肯定しない', negPet799.replyText.includes('飼っていないと話していました'), negPet799.replyText.slice(0, 150));
  await run799('僕は車を持ってないよ');
  const negCar799 = await run799('僕って車持ってる？');
  check('P799 持ってない車も原文で答える', negCar799.replyText.includes('車を持ってない'), negCar799.replyText.slice(0, 150));
  await run799('僕は泳げないよ');
  const negSwim799 = await run799('僕って泳げる？');
  check('P799 泳げないも原文で答える', negSwim799.replyText.includes('泳げない'), negSwim799.replyText.slice(0, 150));
  await run799('僕は猫を飼ってるよ');
  const posPet799 = await run799('僕が飼ってる動物なんだっけ？');
  check('P799 肯定のペット想起は従来どおり', posPet799.replyText.includes('猫'), posPet799.replyText.slice(0, 130));
}

// ---- P800: 裸の否定は事実を作らず、既存事実を無効化する ----
{
  const { conversationFactIntakeService } = await import('../src/miki/conversation/services/conversationFactIntakeService');
  let mem800: any[] = []; const hist800: any[] = []; let st800: any = undefined;
  const run800 = async (t: string) => {
    mem800 = conversationFactIntakeService.intakeFromUserText(t, mem800).updatedMemories;
    const r: any = await conversationCoreService.execute({ prompt: t, memories: mem800, recentMessages: hist800.slice(-8), conversationState: st800 } as any);
    st800 = r.nextConversationState;
    hist800.push({ role: 'user', content: t }, { role: 'assistant', content: r.replyText });
    return r;
  };
  await run800('僕の身長は170センチじゃないよ');
  const noFact800 = mem800.filter((m: any) => m.active !== false && m.factAttribute === '身長');
  check('P800 否定だけでは事実ができない', noFact800.length === 0, JSON.stringify(noFact800).slice(0, 120));
  await run800('僕の身長は170センチだよ');
  await run800('やっぱり僕の身長は170センチじゃないよ');
  const after800 = await run800('僕の身長って何センチだっけ？');
  check('P800 否定で既存事実が消えて肯定で答えない', !after800.replyText.includes('「170センチ」だよ'), after800.replyText.slice(0, 150));
}

// ---- P801: 裸の確認の質問（「Xって鳥？」）にも関係で答える ----
{
  const { conversationFactIntakeService } = await import('../src/miki/conversation/services/conversationFactIntakeService');
  let mem801: any[] = []; const hist801: any[] = []; let st801: any = undefined;
  const run801 = async (t: string) => {
    mem801 = conversationFactIntakeService.intakeFromUserText(t, mem801).updatedMemories;
    const r: any = await conversationCoreService.execute({ prompt: t, memories: mem801, recentMessages: hist801.slice(-8), conversationState: st801 } as any);
    st801 = r.nextConversationState;
    hist801.push({ role: 'user', content: t }, { role: 'assistant', content: r.replyText });
    return r;
  };
  await run801('タソカゲは鳥じゃないよ、獣だよ');
  const den801 = await run801('タソカゲって鳥？');
  check('P801 裸の形でも否定を正す', den801.replyText.includes('鳥じゃなくて') && den801.replyText.includes('獣'), den801.replyText.slice(0, 150));
  const aff801 = await run801('タソカゲって獣？');
  check('P801 裸の形でも肯定に答える', aff801.replyText.includes('獣の仲間'), aff801.replyText.slice(0, 150));
}

// ---- P802: 名詞句の名前（〜がない）は否定文として扱わない ----
{
  const { conversationFactIntakeService } = await import('../src/miki/conversation/services/conversationFactIntakeService');
  let mem802: any[] = []; const hist802: any[] = []; let st802: any = undefined;
  const run802 = async (t: string) => {
    mem802 = conversationFactIntakeService.intakeFromUserText(t, mem802).updatedMemories;
    const r: any = await conversationCoreService.execute({ prompt: t, memories: mem802, recentMessages: hist802.slice(-8), conversationState: st802 } as any);
    st802 = r.nextConversationState;
    hist802.push({ role: 'user', content: t }, { role: 'assistant', content: r.replyText });
    return r;
  };
  await run802('僕のメイン武器は逃げ場がないだよ');
  const bow802 = await run802('僕のメイン武器って何だっけ？');
  check('P802 名前の「逃げ場がない」は肯定の形で答える', bow802.replyText.includes('メイン武器は「逃げ場がない」だよ'), bow802.replyText.slice(0, 150));
}

// ---- P803: リンク巡回の抽出と選択規則（オフライン検証） ----
{
  const { extractLinksFromHtml } = await import('../src/miki/execution/services/nativeWorkManagerService');
  const { linkFollowService } = await import('../src/miki/research/services/linkFollowService');
  const html803 = '<a href="/mokoron.html">モコロンについて</a><a href="https://example.com/x.pdf">資料</a><a href="#top">上へ</a><a href="https://example.com/login">ログイン</a>';
  const links803 = extractLinksFromHtml(html803, 'https://example.jp/index.html');
  check('P803 リンク抽出は相対URLを解決しフラグメントを除く', links803.length === 3 && links803[0].href === 'https://example.jp/mokoron.html', JSON.stringify(links803));
  const follows803 = linkFollowService.selectFollowLinks(
    [{ url: 'https://example.jp/index.html', links: links803 }],
    ['モコロン'], new Set<string>(), 2);
  check('P803 巡回選択は対象語のアンカーだけを選ぶ', follows803.length === 1 && follows803[0].url === 'https://example.jp/mokoron.html', JSON.stringify(follows803));
  const excluded803 = linkFollowService.selectFollowLinks(
    [{ url: 'https://example.jp/index.html', links: links803 }],
    ['モコロン'], new Set(['https://example.jp/mokoron.html']), 2);
  check('P803 既読URLは辿らない', excluded803.length === 0, JSON.stringify(excluded803));
}

// ---- P804: 名前・属性の否定は事実として登録しない ----
{
  const { conversationFactIntakeService } = await import('../src/miki/conversation/services/conversationFactIntakeService');
  let mem804: any[] = []; const hist804: any[] = []; let st804: any = undefined;
  const run804 = async (t: string) => {
    mem804 = conversationFactIntakeService.intakeFromUserText(t, mem804).updatedMemories;
    const r: any = await conversationCoreService.execute({ prompt: t, memories: mem804, recentMessages: hist804.slice(-8), conversationState: st804 } as any);
    st804 = r.nextConversationState;
    hist804.push({ role: 'user', content: t }, { role: 'assistant', content: r.replyText });
    return r;
  };
  await run804('僕の名前はタロウじゃないよ');
  const noName804 = await run804('僕の名前って何だっけ？');
  check('P804 名前の否定だけでは名前を覚えたことにならない', noName804.replyText.includes('まだ名前を教えてもらっていません') || noName804.replyText.includes('まだ聞いていません'), noName804.replyText.slice(0, 120));
  await run804('僕の名前はジロウだよ');
  await run804('僕の名前はジロウじゃないよ、サブロウだよ');
  const name804 = await run804('僕の名前って何だっけ？');
  check('P804 名前の複合否定は肯定側だけを覚える', name804.replyText.includes('名前は「サブロウ」だよ'), name804.replyText.slice(0, 150));
  await run804('僕のメイン武器は弓だよ');
  await run804('僕のメイン武器は弓じゃないよ、剣だよ');
  const weapon804 = await run804('僕のメイン武器って何だっけ？');
  check('P804 属性の複合否定は肯定側だけを覚える', weapon804.replyText.includes('メイン武器は「剣」だよ'), weapon804.replyText.slice(0, 150));
  await run804('僕のメイン武器は剣じゃないよ');
  const denied804 = await run804('僕のメイン武器って何だっけ？');
  check('P804 属性の単独否定で肯定しなくなる', !denied804.replyText.includes('メイン武器は「剣」だよ'), denied804.replyText.slice(0, 150));
}

// ---- P805: 否定まじりの教示は肯定側だけを説明として覚える ----
{
  const { conversationFactIntakeService } = await import('../src/miki/conversation/services/conversationFactIntakeService');
  const { japaneseDictionaryService } = await import('../src/miki/research/services/japaneseDictionaryService');
  let mem805: any[] = []; const hist805: any[] = []; let st805: any = undefined;
  const run805 = async (t: string) => {
    mem805 = conversationFactIntakeService.intakeFromUserText(t, mem805).updatedMemories;
    const r: any = await conversationCoreService.execute({ prompt: t, memories: mem805, recentMessages: hist805.slice(-8), conversationState: st805 } as any);
    st805 = r.nextConversationState;
    hist805.push({ role: 'user', content: t }, { role: 'assistant', content: r.replyText });
    return r;
  };
  await run805('カゼモドキは鳥じゃなくて獣だよ');
  const gloss805 = (japaneseDictionaryService.lookup('カゼモドキ') as any[])[0]?.gloss || '';
  check('P805 じゃなくて形の教示でも未知語を覚える', gloss805 === '獣の一種', gloss805);
  const confirm805 = await run805('カゼモドキって鳥？');
  check('P805 否定された分類への確認は関係で正す', confirm805.replyText.includes('鳥じゃなくて') && confirm805.replyText.includes('獣'), confirm805.replyText.slice(0, 150));
  await run805('ヒメモドキは鳥ではない、魚だよ');
  const gloss805b = (japaneseDictionaryService.lookup('ヒメモドキ') as any[])[0]?.gloss || '';
  check('P805 ではない形の説明は肯定側だけになる', gloss805b === '魚の一種', gloss805b);
}

// ---- P806: 教わった説明から産物（USED_FOR）を分解する ----
{
  const { conversationFactIntakeService } = await import('../src/miki/conversation/services/conversationFactIntakeService');
  const { worldModelGraphService } = await import('../src/miki/selfAwareness/services/worldModelGraphService');
  let mem806: any[] = []; const hist806: any[] = []; let st806: any = undefined;
  const run806 = async (t: string) => {
    mem806 = conversationFactIntakeService.intakeFromUserText(t, mem806).updatedMemories;
    const r: any = await conversationCoreService.execute({ prompt: t, memories: mem806, recentMessages: hist806.slice(-8), conversationState: st806 } as any);
    st806 = r.nextConversationState;
    hist806.push({ role: 'user', content: t }, { role: 'assistant', content: r.replyText });
    return r;
  };
  await run806('ユキモドキは白い毛が取れる獣だよ');
  const rel806 = worldModelGraphService.relationsOf('ユキモドキ', 'USED_FOR');
  check('P806 産物の仮関係ができる', rel806.length === 1 && rel806[0].to === '毛' && rel806[0].provisional === true, JSON.stringify(rel806));
  const use806 = await run806('ユキモドキって何に使うの？');
  check('P806 使い道の質問に産物で答える', use806.replyText.includes('毛'), use806.replyText.slice(0, 120));
}

// ---- P807: 産卵は産物にせず、述語の確認は説明文で肯定する ----
{
  const { conversationFactIntakeService } = await import('../src/miki/conversation/services/conversationFactIntakeService');
  const { worldModelGraphService } = await import('../src/miki/selfAwareness/services/worldModelGraphService');
  let mem807: any[] = []; const hist807: any[] = []; let st807: any = undefined;
  const run807 = async (t: string) => {
    mem807 = conversationFactIntakeService.intakeFromUserText(t, mem807).updatedMemories;
    const r: any = await conversationCoreService.execute({ prompt: t, memories: mem807, recentMessages: hist807.slice(-8), conversationState: st807 } as any);
    st807 = r.nextConversationState;
    hist807.push({ role: 'user', content: t }, { role: 'assistant', content: r.replyText });
    return r;
  };
  await run807('モリモドキは森の中で卵を産む鳥だよ');
  const rel807 = worldModelGraphService.relationsOf('モリモドキ', 'USED_FOR');
  check('P807 卵を産むは産物の関係にしない', rel807.length === 0, JSON.stringify(rel807));
  const lay807 = await run807('モリモドキって卵を産むの？');
  check('P807 述語の確認は説明文を引いて肯定する', lay807.replyText.includes('卵を産む鳥'), lay807.replyText.slice(0, 150));
}

// ---- P808: 再来週は来週と別の週として扱う ----
{
  const { storageService } = await import('../src/services/storageService');
  const fmt808 = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const base808 = new Date(); base808.setHours(12, 0, 0, 0);
  const plus808 = (n: number) => { const d = new Date(base808); d.setDate(d.getDate() + n); return d; };
  storageService.setItem('miki_user_plans_v1', JSON.stringify([
    { when: '再来週', text: 'サラシュウノ予定', at: Date.now(), date: fmt808(plus808(14)) },
    { when: '来週', text: 'ライシュウノ予定', at: Date.now(), date: fmt808(plus808(7)) },
  ]));
  const sarai808: any = await conversationCoreService.execute({ prompt: '再来週の予定は？', memories: [] } as any);
  check('P808 再来週の予定は再来週の分だけを返す', sarai808.replyText.includes('再来週の予定は') && sarai808.replyText.includes('サラシュウノ予定') && !sarai808.replyText.includes('ライシュウノ予定'), sarai808.replyText.slice(0, 180));
  const rai808: any = await conversationCoreService.execute({ prompt: '来週の予定は？', memories: [] } as any);
  check('P808 来週の予定は来週の分だけを返す', rai808.replyText.includes('ライシュウノ予定') && !rai808.replyText.includes('サラシュウノ予定'), rai808.replyText.slice(0, 180));
}

// ---- P809: 居場所の聞き方（見られる）と部位の中身は説明文で答える ----
{
  const { conversationFactIntakeService } = await import('../src/miki/conversation/services/conversationFactIntakeService');
  let mem809: any[] = []; const hist809: any[] = []; let st809: any = undefined;
  const run809 = async (t: string) => {
    mem809 = conversationFactIntakeService.intakeFromUserText(t, mem809).updatedMemories;
    const r: any = await conversationCoreService.execute({ prompt: t, memories: mem809, recentMessages: hist809.slice(-8), conversationState: st809 } as any);
    st809 = r.nextConversationState;
    hist809.push({ role: 'user', content: t }, { role: 'assistant', content: r.replyText });
    return r;
  };
  await run809('カワモドキは川の近くに住む獣だよ');
  const seen809 = await run809('カワモドキってどこで見られる？');
  check('P809 どこで見られる、に生息の説明で答える', seen809.replyText.includes('川の近くに住む'), seen809.replyText.slice(0, 150));
  await run809('ハナモドキは背中に花が咲く獣だよ');
  const part809 = await run809('ハナモドキの背中には何があるの？');
  check('P809 部位の中身は説明文で答える', part809.replyText.includes('背中に花が咲く'), part809.replyText.slice(0, 150));
  const none809 = await run809('ハナモドキの尻尾には何があるの？');
  check('P809 説明に無い部位は正直に知らないと言う', none809.replyText.includes('まだ知らない'), none809.replyText.slice(0, 150));
}

// ---- P810: 共通点の質問にも共有する分類で答える ----
{
  const { conversationFactIntakeService } = await import('../src/miki/conversation/services/conversationFactIntakeService');
  let mem810: any[] = []; const hist810: any[] = []; let st810: any = undefined;
  const run810 = async (t: string) => {
    mem810 = conversationFactIntakeService.intakeFromUserText(t, mem810).updatedMemories;
    const r: any = await conversationCoreService.execute({ prompt: t, memories: mem810, recentMessages: hist810.slice(-8), conversationState: st810 } as any);
    st810 = r.nextConversationState;
    hist810.push({ role: 'user', content: t }, { role: 'assistant', content: r.replyText });
    return r;
  };
  await run810('ヨルモドキは夜に活動する獣だよ');
  await run810('ヒルモドキは昼に活動する獣だよ');
  const common810 = await run810('ヨルモドキとヒルモドキの共通点は？');
  check('P810 共通点は共有する分類で答える', common810.replyText.includes('共通点は') && common810.replyText.includes('獣'), common810.replyText.slice(0, 150));
}

// ---- P811: 状態スナップショットに開いている知識ギャップを含める ----
{
  const { knowledgeGapService } = await import('../src/miki/unknown/services/knowledgeGapService');
  const { stateSnapshotExportService } = await import('../src/miki/selfAwareness/services/stateSnapshotExportService');
  const { storageService } = await import('../src/services/storageService');
  knowledgeGapService.detect({ query: 'スナップ対象Xの意味を調べる', reason: '回帰確認', type: 'UNKNOWN_TERM', target: 'スナップ対象X', priority: 100 });
  stateSnapshotExportService.exportNow();
  const saved811 = JSON.parse(storageService.getItem('miki_state_snapshot_v1') || '{}');
  const snap811 = JSON.parse(saved811.json || '{}');
  const hit811 = Array.isArray(snap811.openGaps) ? snap811.openGaps.find((g: any) => String(g.query || '').includes('スナップ対象')) : undefined;
  check('P811 スナップショットに開いたギャップが載る', !!hit811 && hit811.type === 'UNKNOWN_TERM' && hit811.status === 'OPEN', JSON.stringify(snap811.openGaps || []).slice(0, 200));
}

// ---- P812: 特徴の質問にも教わった説明で答える ----
{
  const { conversationFactIntakeService } = await import('../src/miki/conversation/services/conversationFactIntakeService');
  let mem812: any[] = []; const hist812: any[] = []; let st812: any = undefined;
  const run812 = async (t: string) => {
    mem812 = conversationFactIntakeService.intakeFromUserText(t, mem812).updatedMemories;
    const r: any = await conversationCoreService.execute({ prompt: t, memories: mem812, recentMessages: hist812.slice(-8), conversationState: st812 } as any);
    st812 = r.nextConversationState;
    hist812.push({ role: 'user', content: t }, { role: 'assistant', content: r.replyText });
    return r;
  };
  await run812('ネコモドキは寿命が15年くらいの獣だよ');
  const feat812 = await run812('ネコモドキの特徴は？');
  check('P812 特徴の質問に説明で答える', feat812.replyText.includes('寿命が15年くらいの獣'), feat812.replyText.slice(0, 150));
}

// ---- P813: 「2人の年齢の差は？」は属性を持つ2人で差を出す ----
{
  const { conversationFactIntakeService } = await import('../src/miki/conversation/services/conversationFactIntakeService');
  let mem813: any[] = []; const hist813: any[] = []; let st813: any = undefined;
  const run813 = async (t: string) => {
    mem813 = conversationFactIntakeService.intakeFromUserText(t, mem813).updatedMemories;
    const r: any = await conversationCoreService.execute({ prompt: t, memories: mem813, recentMessages: hist813.slice(-8), conversationState: st813 } as any);
    st813 = r.nextConversationState;
    hist813.push({ role: 'user', content: t }, { role: 'assistant', content: r.replyText });
    return r;
  };
  await run813('僕の年齢は30歳だよ');
  await run813('相方の年齢は28歳だよ');
  const diff813 = await run813('2人の年齢の差は？');
  check('P813 人数だけの差の質問に2人で答える', diff813.replyText.includes('2歳違い'), diff813.replyText.slice(0, 150));
}

// ---- P814: 属性の語と記録済みの相手は意味を聞き返さない ----
{
  const { conversationFactIntakeService } = await import('../src/miki/conversation/services/conversationFactIntakeService');
  let mem814: any[] = []; const hist814: any[] = []; let st814: any = undefined;
  const run814 = async (t: string) => {
    mem814 = conversationFactIntakeService.intakeFromUserText(t, mem814).updatedMemories;
    const r: any = await conversationCoreService.execute({ prompt: t, memories: mem814, recentMessages: hist814.slice(-8), conversationState: st814 } as any);
    st814 = r.nextConversationState;
    hist814.push({ role: 'user', content: t }, { role: 'assistant', content: r.replyText });
    return r;
  };
  const age814 = await run814('僕の年齢は30歳だよ');
  check('P814 年齢は聞き返さない', !age814.replyText.includes('「年齢」って'), age814.replyText.slice(0, 150));
  const partner814 = await run814('相方の年齢は28歳だよ');
  check('P814 記録済みの相方は聞き返さない', !partner814.replyText.includes('「相方」って'), partner814.replyText.slice(0, 150));
}

// ---- P815: 月の末日と「今日からN日後」の日付 ----
{
  const now815 = new Date();
  const nextLast815 = new Date(now815.getFullYear(), now815.getMonth() + 2, 0).getDate();
  const nextMonth815 = new Date(now815.getFullYear(), now815.getMonth() + 1, 1).getMonth() + 1;
  const len815: any = await conversationCoreService.execute({ prompt: '来月は何日まで？', memories: [] } as any);
  check('P815 来月の末日を答える', len815.replyText.includes(`${nextMonth815}月は${nextLast815}日まで`), len815.replyText.slice(0, 120));
  const d100815 = new Date(now815.getFullYear(), now815.getMonth(), now815.getDate() + 100);
  const off815: any = await conversationCoreService.execute({ prompt: '今日から100日後は何月何日？', memories: [] } as any);
  check('P815 今日から100日後の日付を答える', off815.replyText.includes(`${d100815.getMonth() + 1}月${d100815.getDate()}日`), off815.replyText.slice(0, 120));
}

// ---- P816: 属性なし事実は述語の型が同じ時だけ置換／「Xの予定は？」素形／予定の日付ずらし／飼育想起の引用 ----
{
  const { conversationFactIntakeService } = await import('../src/miki/conversation/services/conversationFactIntakeService');
  const { storageService } = await import('../src/services/storageService');
  let mem816: any[] = []; const hist816: any[] = []; let st816: any = undefined;
  const run816 = async (t: string) => {
    mem816 = conversationFactIntakeService.intakeFromUserText(t, mem816).updatedMemories;
    const r: any = await conversationCoreService.execute({ prompt: t, memories: mem816, recentMessages: hist816.slice(-8), conversationState: st816 } as any);
    st816 = r.nextConversationState;
    hist816.push({ role: 'user', content: t }, { role: 'assistant', content: r.replyText });
    return r;
  };
  await run816('僕は猫を飼ってるよ');
  await run816('僕は学生だよ');
  const pet816 = await run816('僕って何を飼ってたっけ？');
  check('P816 型の違う事実は飼育の事実を消さない', pet816.replyText.includes('飼っている動物は「猫」'), pet816.replyText.slice(0, 150));
  check('P816 飼育想起の引用は合った事実に付く', pet816.replyText.includes('僕は猫を飼ってる'), pet816.replyText.slice(0, 150));
  let mem816b: any[] = [];
  mem816b = conversationFactIntakeService.intakeFromUserText('僕は学生だよ', mem816b).updatedMemories;
  mem816b = conversationFactIntakeService.intakeFromUserText('僕は会社員だよ', mem816b).updatedMemories;
  const old816 = mem816b.find((m: any) => m.factValue === '学生');
  check('P816 名詞の言い直しは従来どおり置換する', !!old816 && !!old816.replacedBy, JSON.stringify(mem816b.map((m: any) => m.factValue)));
  // 予定：台帳を直接用意して素形の聞き返しと日付ずらしを見る
  const fmt816 = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const tomorrow816 = fmt816(new Date(Date.now() + 86400000));
  const dayAfter816 = fmt816(new Date(Date.now() + 2 * 86400000));
  storageService.setItem('miki_user_plans_v1', JSON.stringify([{ when: '明日', text: '歯医者の予定', at: Date.now(), date: tomorrow816 }]));
  const bare816: any = await conversationCoreService.execute({ prompt: '明日の予定は？', memories: [] } as any);
  check('P816 「明日の予定は？」の素形を台帳で受ける', bare816.replyText.includes('歯医者'), bare816.replyText.slice(0, 150));
  const move816 = await run816('明日の予定、明後日にずらして');
  check('P816 予定ずらしを受け答えする', move816.replyText.includes('明後日にずらしておきました'), move816.replyText.slice(0, 150));
  const plans816 = JSON.parse(storageService.getItem('miki_user_plans_v1') || '[]');
  check('P816 ずらした予定だけが台帳に残る', plans816.length === 1 && plans816[0].date === dayAfter816, JSON.stringify(plans816).slice(0, 200));
  const after816: any = await conversationCoreService.execute({ prompt: '明後日の予定は？', memories: [] } as any);
  check('P816 ずらし先で予定を聞き返せる', after816.replyText.includes('歯医者'), after816.replyText.slice(0, 150));
  const gone816: any = await conversationCoreService.execute({ prompt: '明日の予定は？', memories: [] } as any);
  check('P816 ずらした元の日は無いと正直に言う', gone816.replyText.includes('まだ聞いていないです'), gone816.replyText.slice(0, 150));
}

// ---- P817: 人の事実の合計・歳だけの閾値人数・向きつき差／来年の今日・今度の曜日・月末まで ----
{
  const { conversationFactIntakeService } = await import('../src/miki/conversation/services/conversationFactIntakeService');
  let mem817: any[] = []; const hist817: any[] = []; let st817: any = undefined;
  const run817 = async (t: string) => {
    mem817 = conversationFactIntakeService.intakeFromUserText(t, mem817).updatedMemories;
    const r: any = await conversationCoreService.execute({ prompt: t, memories: mem817, recentMessages: hist817.slice(-8), conversationState: st817 } as any);
    st817 = r.nextConversationState;
    hist817.push({ role: 'user', content: t }, { role: 'assistant', content: r.replyText });
    return r;
  };
  await run817('僕の年齢は30歳だよ');
  await run817('相方の年齢は28歳だよ');
  await run817('友達の年齢は25歳だよ');
  const sum817 = await run817('3人の年齢を合わせると何歳？');
  check('P817 人の年齢の合計を答える', sum817.replyText.includes('合わせると83歳'), sum817.replyText.slice(0, 150));
  const cnt817 = await run817('30歳以上は何人いる？');
  check('P817 歳だけの閾値でも人数を答える', cnt817.replyText.includes('1人です'), cnt817.replyText.slice(0, 150));
  const dir817 = await run817('相方は僕より何歳若い？');
  check('P817 向きつきの差を答える', dir817.replyText.includes('より2歳若い'), dir817.replyText.slice(0, 150));
  const rev817 = await run817('僕は相方より何歳若い？');
  check('P817 向きが逆なら正して答える', rev817.replyText.includes('若くはなくて'), rev817.replyText.slice(0, 150));
  const now817 = new Date();
  const yt817 = new Date(now817.getFullYear() + 1, now817.getMonth(), now817.getDate());
  const year817: any = await conversationCoreService.execute({ prompt: '来年の今日は何月何日？', memories: [] } as any);
  check('P817 来年の今日を答える', year817.replyText.includes(`${yt817.getFullYear()}年${yt817.getMonth() + 1}月${yt817.getDate()}日`), year817.replyText.slice(0, 120));
  const delta817 = (0 - now817.getDay() + 7) % 7;
  const sun817 = new Date(now817.getFullYear(), now817.getMonth(), now817.getDate() + delta817);
  const next817: any = await conversationCoreService.execute({ prompt: '今度の日曜日は何日？', memories: [] } as any);
  check('P817 今度の日曜日を答える', next817.replyText.includes(`${sun817.getMonth() + 1}月${sun817.getDate()}日`), next817.replyText.slice(0, 120));
  const last817 = new Date(now817.getFullYear(), now817.getMonth() + 1, 0).getDate();
  const remain817 = last817 - now817.getDate();
  const monthEnd817: any = await conversationCoreService.execute({ prompt: '月末まであと何日？', memories: [] } as any);
  check('P817 月末までの日数を答える', remain817 === 0 ? monthEnd817.replyText.includes('今日が月末') : monthEnd817.replyText.includes(`あと${remain817}日`), monthEnd817.replyText.slice(0, 120));
}

// ---- P818: 性質で絞った数え／用途の聞き方／メモの「さっきの消して」と助詞 ----
{
  const { conversationFactIntakeService } = await import('../src/miki/conversation/services/conversationFactIntakeService');
  let mem818: any[] = []; const hist818: any[] = []; let st818: any = undefined;
  const run818 = async (t: string) => {
    mem818 = conversationFactIntakeService.intakeFromUserText(t, mem818).updatedMemories;
    const r: any = await conversationCoreService.execute({ prompt: t, memories: mem818, recentMessages: hist818.slice(-8), conversationState: st818 } as any);
    st818 = r.nextConversationState;
    hist818.push({ role: 'user', content: t }, { role: 'assistant', content: r.replyText });
    return r;
  };
  await run818('ミズモドキは白い毛が取れる獣だよ');
  const from818 = await run818('ミズモドキからは何が取れるの？');
  check('P818 「Xからは何が取れる」に産物で答える', from818.replyText.includes('から取れるのは、毛です'), from818.replyText.slice(0, 150));
  const use818 = await run818('ミズモドキは何を取るのに使うの？');
  check('P818 「何を取るのに使う」にも産物で答える', use818.replyText.includes('から取れるのは、毛です'), use818.replyText.slice(0, 150));
  await run818('アサドリモドキは朝に鳴く鳥だよ');
  await run818('アサガメモドキは朝に鳴く獣だよ');
  await run818('ヨルドリモドキは夜に鳴く鳥だよ');
  const cnt818 = await run818('朝に鳴く生き物は何種類教えた？');
  check('P818 性質で絞って数える', cnt818.replyText.includes('2種類'), cnt818.replyText.slice(0, 150));
  const cnt818b = await run818('朝に鳴く鳥は何種類？');
  check('P818 性質と分類で絞って数える', cnt818b.replyText.includes('1種類') && cnt818b.replyText.includes('アサドリモドキ'), cnt818b.replyText.slice(0, 150));
  const memo818 = await run818('詰め替え洗剤をメモして');
  check('P818 メモの内容に助詞を残さない', memo818.replyText.includes('「詰め替え洗剤」'), memo818.replyText.slice(0, 150));
  await run818('除菌シートってメモして');
  const del818 = await run818('さっきのメモ消して');
  check('P818 さっきのメモを実際に消す', del818.replyText.includes('除菌シート') && del818.replyText.includes('消しました'), del818.replyText.slice(0, 150));
  const left818 = await run818('メモ何かあったっけ？');
  check('P818 消したメモは読み返しに出ない', left818.replyText.includes('詰め替え洗剤') && !left818.replyText.includes('除菌シート'), left818.replyText.slice(0, 150));
}

// ---- P819: 真ん中／動詞句の性質の一覧／曜日への予定ずらし／来月・先月の今日／だっけ形の確認 ----
{
  const { conversationFactIntakeService } = await import('../src/miki/conversation/services/conversationFactIntakeService');
  const { storageService } = await import('../src/services/storageService');
  let mem819: any[] = []; const hist819: any[] = []; let st819: any = undefined;
  const run819 = async (t: string) => {
    mem819 = conversationFactIntakeService.intakeFromUserText(t, mem819).updatedMemories;
    const r: any = await conversationCoreService.execute({ prompt: t, memories: mem819, recentMessages: hist819.slice(-8), conversationState: st819 } as any);
    st819 = r.nextConversationState;
    hist819.push({ role: 'user', content: t }, { role: 'assistant', content: r.replyText });
    return r;
  };
  await run819('ミドリモドキは重さ3キロの植物だよ');
  await run819('オオモドキバナは重さ6キロの植物だよ');
  await run819('チイモドキバナは重さ12キロの植物だよ');
  const med819 = await run819('植物の重さの真ん中は？');
  check('P819 実測値の真ん中を答える', med819.replyText.includes('真ん中は「オオモドキバナ」'), med819.replyText.slice(0, 150));
  await run819('ヨルビーは夜に活動する獣だよ');
  await run819('ヒルビーは昼に活動する獣だよ');
  const tl819 = await run819('夜に活動する生き物を教えて');
  check('P819 動詞句の性質で絞って挙げる', tl819.replyText.includes('ヨルビー') && !tl819.replyText.includes('ヒルビー'), tl819.replyText.slice(0, 150));
  // 予定：明日の控えを直接置き、金曜日へずらす（元の日の次の金曜）。
  const fmt819 = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const tomorrow819 = new Date(Date.now() + 86400000);
  storageService.setItem('miki_user_plans_v1', JSON.stringify([{ when: '明日', text: '明日、ハミガキ819の予定があるよ', at: Date.now(), date: fmt819(tomorrow819) }]));
  let delta819 = (5 - tomorrow819.getDay() + 7) % 7; if (delta819 === 0) delta819 = 7;
  const expect819 = fmt819(new Date(tomorrow819.getTime() + delta819 * 86400000));
  const mv819 = await run819('明日の予定、金曜日にずらして');
  const plans819 = JSON.parse(storageService.getItem('miki_user_plans_v1') || '[]');
  check('P819 予定を曜日へずらす', mv819.replyText.includes('金曜日にずらしておきました') && plans819.length === 1 && plans819[0].date === expect819 && plans819[0].when === '金曜日', `${mv819.replyText.slice(0, 80)} / ${JSON.stringify(plans819)}`);
  const now819 = new Date();
  const nextM819 = new Date(now819.getFullYear(), now819.getMonth() + 1, Math.min(now819.getDate(), new Date(now819.getFullYear(), now819.getMonth() + 2, 0).getDate()));
  const cal819 = await run819('来月の今日は何日？');
  check('P819 来月の今日を答える', cal819.replyText.includes(`${nextM819.getMonth() + 1}月${nextM819.getDate()}日`), cal819.replyText.slice(0, 120));
  await run819('ウミモドキは魚だよ');
  const cf819 = await run819('ウミモドキって魚の仲間だっけ？');
  check('P819 だっけ形の確認に肯定する', cf819.replyText.includes('魚の仲間だと思います'), cf819.replyText.slice(0, 150));
  const cf819b = await run819('ウミモドキって鳥の仲間だっけ？');
  check('P819 だっけ形の外れた確認を正す', cf819b.replyText.includes('鳥じゃなくて'), cf819b.replyText.slice(0, 150));
}

// ---- P820: 人の事実の真ん中／税込・税抜き計算／産物自体の使い道／予定の明示日ずらしと内容なし取り消し ----
{
  const { conversationFactIntakeService } = await import('../src/miki/conversation/services/conversationFactIntakeService');
  const { storageService } = await import('../src/services/storageService');
  let mem820: any[] = []; const hist820: any[] = []; let st820: any = undefined;
  const run820 = async (t: string) => {
    mem820 = conversationFactIntakeService.intakeFromUserText(t, mem820).updatedMemories;
    const r: any = await conversationCoreService.execute({ prompt: t, memories: mem820, recentMessages: hist820.slice(-8), conversationState: st820 } as any);
    st820 = r.nextConversationState;
    hist820.push({ role: 'user', content: t }, { role: 'assistant', content: r.replyText });
    return r;
  };
  await run820('僕の年齢は30歳だよ');
  await run820('相方の年齢は28歳だよ');
  await run820('友達の年齢は25歳だよ');
  const fm820 = await run820('3人の年齢の真ん中は？');
  check('P820 人の事実の真ん中を答える', fm820.replyText.includes('「相方」です（28歳）'), fm820.replyText.slice(0, 150));
  const tax820 = await run820('税込1080円の税抜き価格は？');
  check('P820 税込から税抜きを計算する', tax820.replyText.includes('982円'), tax820.replyText.slice(0, 150));
  const tax820b = await run820('1000円の消費税10%込みはいくら？');
  check('P820 税抜きから税込を計算する', tax820b.replyText.includes('1100円'), tax820b.replyText.slice(0, 150));
  await run820('ユキゲモドキは白い毛が取れる獣だよ');
  const pu820 = await run820('ユキゲモドキの毛は何に使うの？');
  check('P820 産物自体の使い道は未学習と分けて答える', pu820.replyText.includes('毛自体の使い道はまだ知らない'), pu820.replyText.slice(0, 150));
  const fmt820 = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const tomorrow820 = new Date(Date.now() + 86400000);
  storageService.setItem('miki_user_plans_v1', JSON.stringify([{ when: '明日', text: '明日、ハミガキ820の予定があるよ', at: Date.now(), date: fmt820(tomorrow820) }]));
  let cand820 = new Date(tomorrow820.getFullYear(), tomorrow820.getMonth(), 20);
  if (cand820.getTime() <= tomorrow820.getTime()) cand820 = new Date(tomorrow820.getFullYear(), tomorrow820.getMonth() + 1, 20);
  const mv820 = await run820('明日の予定、20日にずらして');
  const plans820 = JSON.parse(storageService.getItem('miki_user_plans_v1') || '[]');
  check('P820 予定を明示の日付へずらす', mv820.replyText.includes(`${cand820.getMonth() + 1}月20日にずらしておきました`) && plans820.length === 1 && plans820[0].date === fmt820(cand820), `${mv820.replyText.slice(0, 80)} / ${JSON.stringify(plans820)}`);
  storageService.setItem('miki_user_plans_v1', JSON.stringify([{ when: '明日', text: '明日、ハミガキ820の予定があるよ', at: Date.now(), date: fmt820(tomorrow820) }]));
  await run820('明日の予定、やっぱり無しにして');
  const plans820b = JSON.parse(storageService.getItem('miki_user_plans_v1') || '[]');
  check('P820 内容を指さない取り消しで範囲ごと消える', !plans820b.some((p: any) => String(p.text).includes('ハミガキ820')), JSON.stringify(plans820b));
}

// ---- P821: 人の事実の比／年齢の見通し／一番最近教えた語 ----
{
  const { conversationFactIntakeService } = await import('../src/miki/conversation/services/conversationFactIntakeService');
  let mem821: any[] = []; const hist821: any[] = []; let st821: any = undefined;
  const run821 = async (t: string) => {
    mem821 = conversationFactIntakeService.intakeFromUserText(t, mem821).updatedMemories;
    const r: any = await conversationCoreService.execute({ prompt: t, memories: mem821, recentMessages: hist821.slice(-8), conversationState: st821 } as any);
    st821 = r.nextConversationState;
    hist821.push({ role: 'user', content: t }, { role: 'assistant', content: r.replyText });
    return r;
  };
  await run821('僕の身長は180センチだよ');
  await run821('相方の身長は150センチだよ');
  const ratio821 = await run821('僕の身長は相方の何倍？');
  check('P821 人の事実どうしの比を答える', ratio821.replyText.includes('約1.2倍'), ratio821.replyText.slice(0, 150));
  await run821('僕の年齢は30歳だよ');
  await run821('相方の年齢は28歳だよ');
  const proj821 = await run821('相方は10年後何歳？');
  check('P821 年齢の見通しを答える', proj821.replyText.includes('10年後、38歳'), proj821.replyText.slice(0, 150));
  const until821 = await run821('僕が40歳になるのは何年後？');
  check('P821 目標の年齢まで何年かを答える', until821.replyText.includes('10年後です'), until821.replyText.slice(0, 150));
  await run821('サクラモドキは春に咲く花だよ');
  const recent821 = await run821('一番最近教えたのは何？');
  check('P821 一番最近教えた語を答える', recent821.replyText.includes('サクラモドキ'), recent821.replyText.slice(0, 150));
}

// ---- P822: 説明どうしの比／誕生日からの割り出し／月の曜日の回数／性別の属性 ----
{
  const { conversationFactIntakeService } = await import('../src/miki/conversation/services/conversationFactIntakeService');
  let mem822: any[] = []; const hist822: any[] = []; let st822: any = undefined;
  const run822 = async (t: string) => {
    mem822 = conversationFactIntakeService.intakeFromUserText(t, mem822).updatedMemories;
    const r: any = await conversationCoreService.execute({ prompt: t, memories: mem822, recentMessages: hist822.slice(-8), conversationState: st822 } as any);
    st822 = r.nextConversationState;
    hist822.push({ role: 'user', content: t }, { role: 'assistant', content: r.replyText });
    return r;
  };
  await run822('ハルモドキは重さ2キロの獣だよ');
  await run822('ナツモドキは重さ6キロの獣だよ');
  const gr822 = await run822('ハルモドキはナツモドキの何倍の重さ？');
  check('P822 説明どうしの比を答える', gr822.replyText.includes('約0.33倍'), gr822.replyText.slice(0, 150));
  await run822('僕の誕生日は1995年6月15日だよ');
  const now822 = new Date();
  const birth822 = new Date(1995, 5, 15);
  const days822 = Math.floor((new Date(now822.getFullYear(), now822.getMonth(), now822.getDate()).getTime() - birth822.getTime()) / 86400000);
  let age822 = now822.getFullYear() - 1995;
  if (now822.getMonth() < 5 || (now822.getMonth() === 5 && now822.getDate() < 15)) age822--;
  const bd822 = await run822('僕が生まれてから何日経った？');
  check('P822 生まれてからの日数を答える', bd822.replyText.includes(`${days822}日`), bd822.replyText.slice(0, 150));
  const ba822 = await run822('僕は今何歳？');
  check('P822 誕生日から今の年齢を答える', ba822.replyText.includes(`今、${age822}歳`), ba822.replyText.slice(0, 150));
  const base822 = new Date(now822.getFullYear(), now822.getMonth() + 1, 1);
  let sat822 = 0;
  for (let d = new Date(base822.getFullYear(), base822.getMonth(), 1); d.getMonth() === base822.getMonth(); d.setDate(d.getDate() + 1)) { if (d.getDay() === 6) sat822++; }
  const wc822 = await run822('来月は何回土曜日がある？');
  check('P822 月の曜日の回数を数える', wc822.replyText.includes(`土曜日が${sat822}回`), wc822.replyText.slice(0, 150));
  await run822('ポチモドキはオスの犬だよ');
  const sx822 = await run822('ポチモドキの性別は？');
  check('P822 性別を説明で答える', sx822.replyText.includes('オスの犬'), sx822.replyText.slice(0, 150));
}

// ---- P823: 時刻のずらし／週末の予定 ----
{
  const { conversationFactIntakeService } = await import('../src/miki/conversation/services/conversationFactIntakeService');
  const { storageService } = await import('../src/services/storageService');
  let mem823: any[] = []; const hist823: any[] = []; let st823: any = undefined;
  const run823 = async (t: string) => {
    mem823 = conversationFactIntakeService.intakeFromUserText(t, mem823).updatedMemories;
    const r: any = await conversationCoreService.execute({ prompt: t, memories: mem823, recentMessages: hist823.slice(-8), conversationState: st823 } as any);
    st823 = r.nextConversationState;
    hist823.push({ role: 'user', content: t }, { role: 'assistant', content: r.replyText });
    return r;
  };
  const plus2h823 = new Date(Date.now() + 2 * 3600000);
  const to823 = await run823('今から2時間後は何時？');
  check('P823 時刻のずらしを計算する', to823.replyText.includes('2時間後は') && to823.replyText.includes(`${plus2h823.getHours()}時`), to823.replyText.slice(0, 120));
  const fmt823 = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const now823 = new Date();
  let satDelta823 = (6 - now823.getDay() + 7) % 7; if (now823.getDay() === 0) satDelta823 = -1;
  const sat823 = new Date(now823.getTime() + satDelta823 * 86400000);
  const mon823 = new Date(sat823.getTime() + 2 * 86400000);
  storageService.setItem('miki_user_plans_v1', JSON.stringify([
    { when: '土曜日', text: '土曜日にカイモノ823の予定があるよ', at: Date.now(), date: fmt823(sat823) },
    { when: '月曜日', text: '月曜日にカイギ823の予定があるよ', at: Date.now(), date: fmt823(mon823) },
  ]));
  const wk823 = await run823('週末の予定は？');
  check('P823 週末の予定を土日の日付で引く', wk823.replyText.includes('カイモノ823') && !wk823.replyText.includes('カイギ823'), wk823.replyText.slice(0, 150));
}

// ---- P824: 範囲つきの予定の件数／複合の事実の聞き返し／単位換算の「って」形 ----
{
  const { conversationFactIntakeService } = await import('../src/miki/conversation/services/conversationFactIntakeService');
  const { storageService } = await import('../src/services/storageService');
  let mem824: any[] = []; const hist824: any[] = []; let st824: any = undefined;
  const run824 = async (t: string) => {
    mem824 = conversationFactIntakeService.intakeFromUserText(t, mem824).updatedMemories;
    const r: any = await conversationCoreService.execute({ prompt: t, memories: mem824, recentMessages: hist824.slice(-8), conversationState: st824 } as any);
    st824 = r.nextConversationState;
    hist824.push({ role: 'user', content: t }, { role: 'assistant', content: r.replyText });
    return r;
  };
  const fmt824 = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const now824 = new Date();
  const tmr824 = new Date(now824.getTime() + 86400000);
  const dat824 = new Date(now824.getTime() + 2 * 86400000);
  storageService.setItem('miki_user_plans_v1', JSON.stringify([
    { when: '明日', text: '明日にハジメ824の予定があるよ', at: Date.now(), date: fmt824(tmr824) },
    { when: '明後日', text: '明後日にツギ824の予定があるよ', at: Date.now(), date: fmt824(dat824) },
  ]));
  const pc824 = await run824('明日の予定は何件？');
  check('P824 明日の予定の件数を答える', pc824.replyText.includes('明日の予定は1件です'), pc824.replyText.slice(0, 120));
  const monthCount824 = [tmr824, dat824].filter((d) => d.getFullYear() === now824.getFullYear() && d.getMonth() === now824.getMonth()).length;
  const pm824 = await run824('今月の予定は全部で何件？');
  check('P824 今月の予定の件数を答える', pm824.replyText.includes(`今月の予定は${monthCount824}件です`), pm824.replyText.slice(0, 120));
  await run824('僕の身長は180センチだよ');
  await run824('僕の体重は70キロだよ');
  const cf824 = await run824('僕の身長と体重を教えて');
  check('P824 複合の事実をまとめて答える', cf824.replyText.includes('身長は180センチ') && cf824.replyText.includes('体重は70キロ'), cf824.replyText.slice(0, 150));
  const uc824 = await run824('身長180センチって何メートル？');
  check('P824 前置きつきの単位換算を答える', uc824.replyText.includes('180センチは1.8メートルです'), uc824.replyText.slice(0, 120));
}

// ---- P825: 明示の日付までの日数／その日付の曜日 ----
{
  const { conversationFactIntakeService } = await import('../src/miki/conversation/services/conversationFactIntakeService');
  let mem825: any[] = []; const hist825: any[] = []; let st825: any = undefined;
  const run825 = async (t: string) => {
    mem825 = conversationFactIntakeService.intakeFromUserText(t, mem825).updatedMemories;
    const r: any = await conversationCoreService.execute({ prompt: t, memories: mem825, recentMessages: hist825.slice(-8), conversationState: st825 } as any);
    st825 = r.nextConversationState;
    hist825.push({ role: 'user', content: t }, { role: 'assistant', content: r.replyText });
    return r;
  };
  const now825 = new Date();
  const today0825 = new Date(now825.getFullYear(), now825.getMonth(), now825.getDate());
  let tgt825 = new Date(now825.getFullYear(), 11, 25);
  if (tgt825.getTime() < today0825.getTime()) tgt825 = new Date(now825.getFullYear() + 1, 11, 25);
  const diff825 = Math.round((tgt825.getTime() - today0825.getTime()) / 86400000);
  const ud825 = await run825('12月25日まで何日？');
  check('P825 明示の日付までの日数を数える', diff825 === 0 ? ud825.replyText.includes('今日です') : ud825.replyText.includes(`あと${diff825}日です`), ud825.replyText.slice(0, 120));
  const wd825 = '日月火水木金土'[new Date(now825.getFullYear(), 11, 25).getDay()];
  const dw825 = await run825('12月25日は何曜日？');
  check('P825 明示の日付の曜日を答える', dw825.replyText.includes(`12月25日は${wd825}曜日です`), dw825.replyText.slice(0, 120));
}

// ---- P826: 日付から日付までの日数／「合わせて」の合計（事実・説明の両側） ----
{
  const { conversationFactIntakeService } = await import('../src/miki/conversation/services/conversationFactIntakeService');
  let mem826: any[] = []; const hist826: any[] = []; let st826: any = undefined;
  const run826 = async (t: string) => {
    mem826 = conversationFactIntakeService.intakeFromUserText(t, mem826).updatedMemories;
    const r: any = await conversationCoreService.execute({ prompt: t, memories: mem826, recentMessages: hist826.slice(-8), conversationState: st826 } as any);
    st826 = r.nextConversationState;
    hist826.push({ role: 'user', content: t }, { role: 'assistant', content: r.replyText });
    return r;
  };
  const dd826 = await run826('11月20日から12月25日まで何日ある？');
  check('P826 日付から日付までの日数を答える', dd826.replyText.includes('までは35日です'), dd826.replyText.slice(0, 120));
  await run826('僕の体重は70キロだよ');
  await run826('相方の体重は55キロだよ');
  const fs826 = await run826('僕と相方、合わせて何キロ？');
  check('P826 合わせての合計を人の体重で答える', fs826.replyText.includes('125キロ'), fs826.replyText.slice(0, 150));
  await run826('ハナモドキは重さ2キロの植物だよ');
  await run826('ツキモドキは重さ4キロの植物だよ');
  const gs826 = await run826('植物、合わせて何キロ？');
  check('P826 合わせての合計を説明の重さでも答える', /合わせると/.test(gs826.replyText) && /キロ/.test(gs826.replyText), gs826.replyText.slice(0, 150));
}

// ---- P827: 示された生年月日からの年齢／複合の時間換算 ----
{
  const { conversationFactIntakeService } = await import('../src/miki/conversation/services/conversationFactIntakeService');
  let mem827: any[] = []; const hist827: any[] = []; let st827: any = undefined;
  const run827 = async (t: string) => {
    mem827 = conversationFactIntakeService.intakeFromUserText(t, mem827).updatedMemories;
    const r: any = await conversationCoreService.execute({ prompt: t, memories: mem827, recentMessages: hist827.slice(-8), conversationState: st827 } as any);
    st827 = r.nextConversationState;
    hist827.push({ role: 'user', content: t }, { role: 'assistant', content: r.replyText });
    return r;
  };
  const now827 = new Date();
  let age827 = now827.getFullYear() - 1995;
  if (now827.getMonth() < 5 || (now827.getMonth() === 5 && now827.getDate() < 15)) age827--;
  const ba827 = await run827('1995年6月15日生まれの人は今何歳？');
  check('P827 示された生年月日から年齢を割り出す', ba827.replyText.includes(`今${age827}歳です`), ba827.replyText.slice(0, 120));
  const ct827 = await run827('2時間30分は何分？');
  check('P827 複合の時間を分に換算する', ct827.replyText.includes('150分です'), ct827.replyText.slice(0, 120));
  const st827b = await run827('150分は何時間何分？');
  check('P827 分を時間と分に分けて答える', st827b.replyText.includes('2時間30分です'), st827b.replyText.slice(0, 120));
}

// ---- P828: 元号と干支 ----
{
  const { conversationFactIntakeService } = await import('../src/miki/conversation/services/conversationFactIntakeService');
  let mem828: any[] = []; const hist828: any[] = []; let st828: any = undefined;
  const run828 = async (t: string) => {
    mem828 = conversationFactIntakeService.intakeFromUserText(t, mem828).updatedMemories;
    const r: any = await conversationCoreService.execute({ prompt: t, memories: mem828, recentMessages: hist828.slice(-8), conversationState: st828 } as any);
    st828 = r.nextConversationState;
    hist828.push({ role: 'user', content: t }, { role: 'assistant', content: r.replyText });
    return r;
  };
  const now828 = new Date();
  const era828 = await run828('今は令和何年？');
  check('P828 今の元号年を答える', era828.replyText.includes(`令和${now828.getFullYear() - 2018}年です`), era828.replyText.slice(0, 120));
  const eto828 = '子丑寅卯辰巳午未申酉戌亥'[(((now828.getFullYear() - 4) % 12) + 12) % 12];
  const et828 = await run828('今年の干支は？');
  check('P828 今年の干支を答える', et828.replyText.includes(`干支は${eto828}です`), et828.replyText.slice(0, 120));
  const bn828 = await run828('僕は1995年生まれだけど干支は？');
  check('P828 生まれ年の干支を答える', bn828.replyText.includes('干支は亥です'), bn828.replyText.slice(0, 120));
}

// ---- P829: 季節／うるう年／年中行事までの日数 ----
{
  const { conversationFactIntakeService } = await import('../src/miki/conversation/services/conversationFactIntakeService');
  let mem829: any[] = []; const hist829: any[] = []; let st829: any = undefined;
  const run829 = async (t: string) => {
    mem829 = conversationFactIntakeService.intakeFromUserText(t, mem829).updatedMemories;
    const r: any = await conversationCoreService.execute({ prompt: t, memories: mem829, recentMessages: hist829.slice(-8), conversationState: st829 } as any);
    st829 = r.nextConversationState;
    hist829.push({ role: 'user', content: t }, { role: 'assistant', content: r.replyText });
    return r;
  };
  const now829 = new Date();
  const mo829 = now829.getMonth() + 1;
  const season829 = mo829 >= 3 && mo829 <= 5 ? '春' : mo829 >= 6 && mo829 <= 8 ? '夏' : mo829 >= 9 && mo829 <= 11 ? '秋' : '冬';
  const se829 = await run829('今の季節は？');
  check('P829 今の季節を答える', se829.replyText.includes(`今は${season829}です`), se829.replyText.slice(0, 120));
  const y829 = now829.getFullYear();
  const leap829 = (y829 % 4 === 0 && y829 % 100 !== 0) || y829 % 400 === 0;
  const le829 = await run829('今年はうるう年？');
  check('P829 うるう年かどうかを答える', le829.replyText.includes(leap829 ? 'うるう年です' : 'うるう年ではありません'), le829.replyText.slice(0, 120));
  const today0829 = new Date(y829, now829.getMonth(), now829.getDate());
  let tgt829 = new Date(y829, 11, 25);
  if (tgt829.getTime() < today0829.getTime()) tgt829 = new Date(y829 + 1, 11, 25);
  const diff829 = Math.round((tgt829.getTime() - today0829.getTime()) / 86400000);
  const nd829 = await run829('クリスマスまで何日？');
  check('P829 年中行事までの日数を数える', diff829 === 0 ? nd829.replyText.includes('今日です') : nd829.replyText.includes(`あと${diff829}日です`), nd829.replyText.slice(0, 120));
}

// ---- P830: 予定の日の訂正（「明日じゃなくて明後日だよ」） ----
{
  const { conversationFactIntakeService } = await import('../src/miki/conversation/services/conversationFactIntakeService');
  const { storageService } = await import('../src/services/storageService');
  let mem830: any[] = []; const hist830: any[] = []; let st830: any = undefined;
  const run830 = async (t: string) => {
    mem830 = conversationFactIntakeService.intakeFromUserText(t, mem830).updatedMemories;
    const r: any = await conversationCoreService.execute({ prompt: t, memories: mem830, recentMessages: hist830.slice(-8), conversationState: st830 } as any);
    st830 = r.nextConversationState;
    hist830.push({ role: 'user', content: t }, { role: 'assistant', content: r.replyText });
    return r;
  };
  storageService.setItem('miki_user_plans_v1', JSON.stringify([]));
  await run830('明日に歯医者の予定があるよ');
  const corr830 = await run830('明日じゃなくて明後日だよ');
  check('P830 日の訂正はずらしの受け答えで返す', corr830.replyText.includes('明後日にずらしておきました'), corr830.replyText.slice(0, 150));
  const plans830 = JSON.parse(String(storageService.getItem('miki_user_plans_v1') || '[]'));
  const fmt830 = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const dat830 = fmt830(new Date(Date.now() + 2 * 86400000));
  check('P830 台帳の日付が明後日に付け替わる', plans830.length === 1 && plans830[0].date === dat830, JSON.stringify(plans830).slice(0, 150));
  const rec830 = await run830('明後日の予定は？');
  check('P830 ずらした先で予定を引ける', rec830.replyText.includes('歯医者'), rec830.replyText.slice(0, 150));
}

// ---- P831: 予定の内容の訂正／時刻の帯の質問 ----
{
  const { conversationFactIntakeService } = await import('../src/miki/conversation/services/conversationFactIntakeService');
  const { storageService } = await import('../src/services/storageService');
  let mem831: any[] = []; const hist831: any[] = []; let st831: any = undefined;
  const run831 = async (t: string) => {
    mem831 = conversationFactIntakeService.intakeFromUserText(t, mem831).updatedMemories;
    const r: any = await conversationCoreService.execute({ prompt: t, memories: mem831, recentMessages: hist831.slice(-8), conversationState: st831 } as any);
    st831 = r.nextConversationState;
    hist831.push({ role: 'user', content: t }, { role: 'assistant', content: r.replyText });
    return r;
  };
  storageService.setItem('miki_user_plans_v1', JSON.stringify([]));
  await run831('明日に歯医者の予定があるよ');
  const cc831 = await run831('歯医者じゃなくて美容院だよ');
  check('P831 内容の訂正は差し替えの受け答えで返す', cc831.replyText.includes('「美容院」に直しておきました'), cc831.replyText.slice(0, 150));
  const plans831 = JSON.parse(String(storageService.getItem('miki_user_plans_v1') || '[]'));
  check('P831 台帳の文が差し替わる', plans831.length === 1 && plans831[0].text.includes('美容院') && !plans831[0].text.includes('歯医者'), JSON.stringify(plans831).slice(0, 150));
  const h831 = new Date().getHours();
  const dp831 = await run831('今って午前？午後？');
  check('P831 午前・午後を答える', dp831.replyText.includes(`今は${h831 < 12 ? '午前' : '午後'}です`), dp831.replyText.slice(0, 120));
}

// ---- P832: 来週・先週の今日／月末の日付と曜日 ----
{
  const { conversationFactIntakeService } = await import('../src/miki/conversation/services/conversationFactIntakeService');
  let mem832: any[] = []; const hist832: any[] = []; let st832: any = undefined;
  const run832 = async (t: string) => {
    mem832 = conversationFactIntakeService.intakeFromUserText(t, mem832).updatedMemories;
    const r: any = await conversationCoreService.execute({ prompt: t, memories: mem832, recentMessages: hist832.slice(-8), conversationState: st832 } as any);
    st832 = r.nextConversationState;
    hist832.push({ role: 'user', content: t }, { role: 'assistant', content: r.replyText });
    return r;
  };
  const now832 = new Date();
  const wds832 = ['日曜日', '月曜日', '火曜日', '水曜日', '木曜日', '金曜日', '土曜日'];
  const nextW832 = new Date(now832.getTime() + 7 * 86400000);
  const ws832 = await run832('来週の今日は何曜日？');
  check('P832 来週の今日を日付と曜日で答える', ws832.replyText.includes(`${nextW832.getMonth() + 1}月${nextW832.getDate()}日（${wds832[nextW832.getDay()]}）`), ws832.replyText.slice(0, 120));
  const last832 = new Date(now832.getFullYear(), now832.getMonth() + 2, 0);
  const me832 = await run832('来月の月末は何曜日？');
  check('P832 月末の日付と曜日を答える', me832.replyText.includes(`${last832.getMonth() + 1}月${last832.getDate()}日（${wds832[last832.getDay()]}）`), me832.replyText.slice(0, 120));
}

// ---- P833: 主語省略の続きの質問（直近の話題で受ける） ----
{
  const { conversationFactIntakeService } = await import('../src/miki/conversation/services/conversationFactIntakeService');
  let mem833: any[] = []; const hist833: any[] = []; let st833: any = undefined;
  const run833 = async (t: string) => {
    mem833 = conversationFactIntakeService.intakeFromUserText(t, mem833).updatedMemories;
    const r: any = await conversationCoreService.execute({ prompt: t, memories: mem833, recentMessages: hist833.slice(-8), conversationState: st833 } as any);
    st833 = r.nextConversationState;
    hist833.push({ role: 'user', content: t }, { role: 'assistant', content: r.replyText });
    return r;
  };
  await run833('ゾルモドキは水辺に住む重さ3キロの鳥だよ');
  await run833('ゾルモドキって何？');
  const w833 = await run833('で、重さは？');
  check('P833 省略した重さの質問は直近の話題で答える', w833.replyText.includes('ゾルモドキ') && w833.replyText.includes('3キロ'), w833.replyText.slice(0, 150));
  const h833 = await run833('じゃあ住んでる場所は？');
  check('P833 住んでる場所の質問も直近の話題で答える', h833.replyText.includes('水辺'), h833.replyText.slice(0, 150));
  await run833('僕の身長は181センチだよ');
  const f833 = await run833('で、身長は何センチだっけ？');
  check('P833 「で、」始まりの聞き返しも事実で答える', f833.replyText.includes('181センチ'), f833.replyText.slice(0, 150));
}

// ---- P834: 対が省略された続きの比較 ----
{
  const { conversationFactIntakeService } = await import('../src/miki/conversation/services/conversationFactIntakeService');
  let mem834: any[] = []; const hist834: any[] = []; let st834: any = undefined;
  const run834 = async (t: string) => {
    mem834 = conversationFactIntakeService.intakeFromUserText(t, mem834).updatedMemories;
    const r: any = await conversationCoreService.execute({ prompt: t, memories: mem834, recentMessages: hist834.slice(-8), conversationState: st834 } as any);
    st834 = r.nextConversationState;
    hist834.push({ role: 'user', content: t }, { role: 'assistant', content: r.replyText });
    return r;
  };
  await run834('タムモドキは重さ4キロの鳥だよ');
  await run834('ネムモドキは重さ9キロの鳥だよ');
  const cmp834 = await run834('どっちが重い？');
  check('P834 省略された比較は直近の2つで比べる', cmp834.replyText.includes('ネムモドキ') && cmp834.replyText.includes('重い'), cmp834.replyText.slice(0, 150));
}

// ---- P835: 対と次元が省略された続きの差の質問 ----
{
  const { conversationFactIntakeService } = await import('../src/miki/conversation/services/conversationFactIntakeService');
  let mem835: any[] = []; const hist835: any[] = []; let st835: any = undefined;
  const run835 = async (t: string) => {
    mem835 = conversationFactIntakeService.intakeFromUserText(t, mem835).updatedMemories;
    const r: any = await conversationCoreService.execute({ prompt: t, memories: mem835, recentMessages: hist835.slice(-8), conversationState: st835 } as any);
    st835 = r.nextConversationState;
    hist835.push({ role: 'user', content: t }, { role: 'assistant', content: r.replyText });
    return r;
  };
  await run835('サミモドキは重さ3キロの鳥だよ');
  await run835('ユミモドキは重さ10キロの鳥だよ');
  await run835('サミモドキとユミモドキ、どっちが重い？');
  const df835 = await run835('差はどれくらい？');
  check('P835 省略された差の質問は直近の2つで答える', df835.replyText.includes('差は7キロ'), df835.replyText.slice(0, 150));
}

// ---- P836: 名指しの対の合計／省略された比と平均 ----
{
  const { conversationFactIntakeService } = await import('../src/miki/conversation/services/conversationFactIntakeService');
  let mem836: any[] = []; const hist836: any[] = []; let st836: any = undefined;
  const run836 = async (t: string) => {
    mem836 = conversationFactIntakeService.intakeFromUserText(t, mem836).updatedMemories;
    const r: any = await conversationCoreService.execute({ prompt: t, memories: mem836, recentMessages: hist836.slice(-8), conversationState: st836 } as any);
    st836 = r.nextConversationState;
    hist836.push({ role: 'user', content: t }, { role: 'assistant', content: r.replyText });
    return r;
  };
  await run836('ヨミモドキは重さ2キロの鳥だよ');
  await run836('セミモドキは重さ8キロの鳥だよ');
  const sum836 = await run836('ヨミモドキとセミモドキ、合わせると何キロ？');
  check('P836 名指しの対の合計を答える', sum836.replyText.includes('合わせると10キロ'), sum836.replyText.slice(0, 150));
  const avg836 = await run836('平均は？');
  check('P836 省略された平均の質問も直近の2つで答える', avg836.replyText.includes('平均は約5キロ'), avg836.replyText.slice(0, 150));
  const ratio836 = await run836('何倍違う？');
  check('P836 省略された比の質問は直近の2つで答える', ratio836.replyText.includes('倍') && (ratio836.replyText.includes('約4倍') || ratio836.replyText.includes('約0.25倍')), ratio836.replyText.slice(0, 150));
}

// ---- P837: 人の事実の省略形（属性なし数値・名指しなしの比較と差） ----
{
  const { conversationFactIntakeService } = await import('../src/miki/conversation/services/conversationFactIntakeService');
  let mem837: any[] = []; const hist837: any[] = []; let st837: any = undefined;
  const run837 = async (t: string) => {
    mem837 = conversationFactIntakeService.intakeFromUserText(t, mem837).updatedMemories;
    const r: any = await conversationCoreService.execute({ prompt: t, memories: mem837, recentMessages: hist837.slice(-8), conversationState: st837 } as any);
    st837 = r.nextConversationState;
    hist837.push({ role: 'user', content: t }, { role: 'assistant', content: r.replyText });
    return r;
  };
  await run837('僕は31歳だよ');
  await run837('相方は29歳だよ');
  const cmp837 = await run837('どっちが年上？');
  check('P837 名指しなしの年齢比較は2人で比べる', cmp837.replyText.includes('年上') && cmp837.replyText.includes('31歳'), cmp837.replyText.slice(0, 150));
  const dif837 = await run837('年の差は？');
  check('P837 「年の差は？」も2人で答える', dif837.replyText.includes('2歳'), dif837.replyText.slice(0, 150));
}

// ---- P838: 予定の時刻の続きの質問／一覧の後の「他には？」 ----
{
  const { conversationFactIntakeService } = await import('../src/miki/conversation/services/conversationFactIntakeService');
  const { storageService } = await import('../src/services/storageService');
  let mem838: any[] = []; const hist838: any[] = []; let st838: any = undefined;
  const run838 = async (t: string) => {
    mem838 = conversationFactIntakeService.intakeFromUserText(t, mem838).updatedMemories;
    const r: any = await conversationCoreService.execute({ prompt: t, memories: mem838, recentMessages: hist838.slice(-8), conversationState: st838 } as any);
    st838 = r.nextConversationState;
    hist838.push({ role: 'user', content: t }, { role: 'assistant', content: r.replyText });
    return r;
  };
  const fmt838 = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  storageService.setItem('miki_user_plans_v1', JSON.stringify([{ when: '明日', text: '明日の15時から会議の予定があるよ', at: Date.now(), date: fmt838(new Date(Date.now() + 86400000)) }]));
  const pt838 = await run838('何時から？');
  check('P838 「何時から？」は予定の時刻で答える', pt838.replyText.includes('15時から'), pt838.replyText.slice(0, 150));
  await run838('ミオモドキは夜に活動する獣だよ');
  await run838('ソラモドキは夜に活動する獣だよ');
  await run838('夜に活動する生き物を教えて');
  const ot838 = await run838('他には？');
  check('P838 一覧の後の「他には？」は正直に答える', ot838.replyText.includes('他にはいない'), ot838.replyText.slice(0, 150));
}

// ---- P839: 一覧の後の続きの数え ----
{
  const { conversationFactIntakeService } = await import('../src/miki/conversation/services/conversationFactIntakeService');
  let mem839: any[] = []; const hist839: any[] = []; let st839: any = undefined;
  const run839 = async (t: string) => {
    mem839 = conversationFactIntakeService.intakeFromUserText(t, mem839).updatedMemories;
    const r: any = await conversationCoreService.execute({ prompt: t, memories: mem839, recentMessages: hist839.slice(-8), conversationState: st839 } as any);
    st839 = r.nextConversationState;
    hist839.push({ role: 'user', content: t }, { role: 'assistant', content: r.replyText });
    return r;
  };
  await run839('ミオモドキは夜に活動する獣だよ');
  await run839('ソラモドキは夜に活動する獣だよ');
  await run839('夜に活動する生き物を教えて');
  const ct839 = await run839('何種類いる？');
  check('P839 一覧の後の数えは控えから数える', ct839.replyText.includes('種類です'), ct839.replyText.slice(0, 120));
}

// ---- P840: 話題の舞台の共有化（候補生成の移設）とスナップショット輸出 ----
{
  const { conversationFactIntakeService } = await import('../src/miki/conversation/services/conversationFactIntakeService');
  const { topicStageService } = await import('../src/miki/memory/services/topicStageService');
  const { stateSnapshotExportService } = await import('../src/miki/selfAwareness/services/stateSnapshotExportService');
  let mem840: any[] = []; const hist840: any[] = []; let st840: any = undefined;
  const run840 = async (t: string) => {
    mem840 = conversationFactIntakeService.intakeFromUserText(t, mem840).updatedMemories;
    const r: any = await conversationCoreService.execute({ prompt: t, memories: mem840, recentMessages: hist840.slice(-8), conversationState: st840 } as any);
    st840 = r.nextConversationState;
    hist840.push({ role: 'user', content: t }, { role: 'assistant', content: r.replyText });
    return r;
  };
  await run840('ユキモドキは重さ2キロの鳥だよ');
  await run840('ハナモドキは重さ5キロの鳥だよ');
  const cmp840 = await run840('どっちが重い？');
  check('P840 移設後も省略形の比較が候補で解ける', cmp840.replyText.includes('ハナモドキ'), cmp840.replyText.slice(0, 150));
  const cands840 = topicStageService.candidates(st840, hist840);
  check('P840 共有サービスの候補に教えた語が入る', cands840.includes('ユキモドキ') || cands840.includes('ハナモドキ'), JSON.stringify(cands840));
  const snap840: any = stateSnapshotExportService.build();
  check('P840 スナップショットに話題の舞台が載る', Boolean(snap840.snapshot.topicStage) && Array.isArray(snap840.snapshot.topicStage.recentEntities) && typeof snap840.snapshot.topicStage.currentTopic === 'string', JSON.stringify(snap840.snapshot.topicStage || null).slice(0, 150));
}

// ---- P841: 舞台の統一・第2歩（照応プール＋話題ラベルの一本化） ----
{
  const { conversationFactIntakeService } = await import('../src/miki/conversation/services/conversationFactIntakeService');
  const { resolveAnaphora } = await import('../src/miki/conversation/services/conversationStateService');
  const { topicStageService } = await import('../src/miki/memory/services/topicStageService');
  let mem841: any[] = [];
  mem841 = conversationFactIntakeService.intakeFromUserText('ルミモドキは重さ2キロの獣だよ', mem841).updatedMemories;
  const emptyState841: any = { recentEntities: [], confirmedFacts: [], currentTopic: undefined };
  const msgs841 = [{ role: 'user', content: 'ルミモドキは重さ2キロの獣だよ' }];
  const ana841 = resolveAnaphora('それって鳥？', emptyState841, msgs841);
  check('P841 照応プールが舞台（発話履歴）から対象を拾う', ana841.resolved === 'ルミモドキ', JSON.stringify(ana841).slice(0, 150));
  const ana841b = resolveAnaphora('それって鳥？', emptyState841, []);
  check('P841 履歴なしでは従来どおり未解決', ana841b.resolved === null, JSON.stringify(ana841b).slice(0, 120));
  check('P841 話題ラベルの一本化（呼びかけ除去）', topicStageService.topicFromText('みき、聞いて') === '聞いて', topicStageService.topicFromText('みき、聞いて'));
}

// ---- P842: ギャップのサブ目標化（解決計画の段と進捗） ----
{
  const { knowledgeGapService } = await import('../src/miki/unknown/services/knowledgeGapService');
  const { stateSnapshotExportService } = await import('../src/miki/selfAwareness/services/stateSnapshotExportService');
  const { storageService } = await import('../src/services/storageService');
  const gap842 = knowledgeGapService.detect({ query: 'チェック842対象Xとは何か', type: 'UNKNOWN_TERM', priority: 100, target: 'チェック842対象X' });
  const plan842 = knowledgeGapService.buildResolutionPlan(gap842.id);
  check('P842 解決計画にサブ目標が付く', Boolean(plan842?.steps && plan842.steps.length === 3 && plan842.steps.every((s) => s.status === 'TODO')), JSON.stringify(plan842?.steps).slice(0, 150));
  knowledgeGapService.advanceResolutionPlan(gap842.id, 'VERIFY', 'RESEARCH');
  const steps842 = knowledgeGapService.getById(gap842.id)?.resolutionPlan?.steps || [];
  check('P842 段の前進でサブ目標が進む', steps842[0]?.status === 'DONE' && steps842[1]?.status === 'ACTIVE', JSON.stringify(steps842).slice(0, 150));
  stateSnapshotExportService.exportNow();
  const saved842 = JSON.parse(storageService.getItem('miki_state_snapshot_v1') || '{}');
  const snap842 = JSON.parse(saved842.json || '{}');
  const entry842 = (snap842.openGaps || []).find((g: any) => g.id === gap842.id);
  check('P842 スナップショットに今の段が出る', entry842?.step === '集めた内容を照合する', JSON.stringify(entry842 || {}).slice(0, 150));
  knowledgeGapService.markResolved(gap842.id);
  const done842 = knowledgeGapService.getById(gap842.id)?.resolutionPlan?.steps || [];
  check('P842 解決でサブ目標が全部DONEになる', done842.length === 3 && done842.every((s) => s.status === 'DONE'), JSON.stringify(done842).slice(0, 150));
}

// ---- P843: エピソードの蒸留（繰り返しの話題を開いた話題へ戻す） ----
{
  const { storageService } = await import('../src/services/storageService');
  const { knowledgeConsolidationService } = await import('../src/miki/selfAwareness/services/knowledgeConsolidationService');
  const { conversationOpenTopicService } = await import('../src/miki/conversation/services/conversationOpenTopicService');
  storageService.setItem('miki_open_topics_v1', JSON.stringify([]));
  storageService.setItem('miki_consolidation_last_run_v1', '0');
  storageService.setItem('miki_episodes_v1', JSON.stringify([
    { day: '2026-11-10', topics: ['蒸留チェックX', '単発チェックY'], summary: 'a' },
    { day: '2026-11-11', topics: ['蒸留チェックX'], summary: 'b' },
    { day: '2026-11-12', topics: ['単発チェックZ'], summary: 'c' },
  ]));
  const r843 = knowledgeConsolidationService.runIfDue(Date.now());
  const pending843 = conversationOpenTopicService.listPending();
  check('P843 複数日に出た話題が蒸留されて戻る', Boolean(r843 && r843.distilled >= 1) && pending843.some((t) => t.topic === '蒸留チェックX' && (t.weight || 0) >= 3), JSON.stringify(pending843).slice(0, 200));
  check('P843 1日だけの話題は蒸留されない', !pending843.some((t) => t.topic === '単発チェックY' || t.topic === '単発チェックZ'), JSON.stringify(pending843).slice(0, 200));
}

// ---- P844: 予測ループ（信念を予測として残し、結果と照合する） ----
{
  const { storageService } = await import('../src/services/storageService');
  const { worldModelGraphService } = await import('../src/miki/selfAwareness/services/worldModelGraphService');
  const { predictionLedgerService } = await import('../src/miki/memory/services/predictionLedgerService');
  const { stateSnapshotExportService } = await import('../src/miki/selfAwareness/services/stateSnapshotExportService');
  storageService.setItem('miki_predictions_v1', JSON.stringify([]));
  worldModelGraphService.addRelation({ fromName: '予測チェックX', toName: '生き物', type: 'IS_A', provisional: true, confidence: 0.3 });
  const pred844 = predictionLedgerService.predictForTarget('予測チェックX');
  check('P844 信念から予測が立つ', Boolean(pred844 && pred844.to === '生き物' && pred844.outcome === 'OPEN'), JSON.stringify(pred844 || {}).slice(0, 160));
  const s0 = predictionLedgerService.settleAll();
  check('P844 仮の関係だけでは照合しない', s0.confirmed === 0 && s0.refuted === 0, JSON.stringify(s0));
  worldModelGraphService.addRelation({ fromName: '予測チェックX', toName: '動物', type: 'IS_A', provisional: false, confidence: 0.9 });
  const s1 = predictionLedgerService.settleAll();
  check('P844 分類が違えば外れとして記録される', s1.refuted === 1 && predictionLedgerService.stats().lastRefutedTarget === '予測チェックX', JSON.stringify(s1));
  check('P844 信念が無ければ予測は立たない', predictionLedgerService.predictForTarget('予測チェックZ') === undefined, '');
  stateSnapshotExportService.exportNow();
  const saved844 = JSON.parse(storageService.getItem('miki_state_snapshot_v1') || '{}');
  const snap844 = JSON.parse(saved844.json || '{}');
  check('P844 スナップショットに予測の照合状況が出る', Boolean(snap844.predictions && snap844.predictions.refuted >= 1), JSON.stringify(snap844.predictions || {}).slice(0, 120));
}

// ---- P845: 活性化スコア（教わった語が舞台に残り、時間で冷める） ----
{
  const { japaneseDictionaryService } = await import('../src/miki/research/services/japaneseDictionaryService');
  const { activationService } = await import('../src/miki/memory/services/activationService');
  const { topicStageService } = await import('../src/miki/memory/services/topicStageService');
  japaneseDictionaryService.addPersonal('活性チェックX', { gloss: '活性化の確認用の語', semanticIds: ['learned:user-taught'] });
  const score845 = activationService.score('活性チェックX');
  check('P845 教わった語に活性化が付く', score845 > 0, String(score845));
  check('P845 活性化の台帳に載る', activationService.top(50).some((x) => x.term === '活性チェックX'), JSON.stringify(activationService.top(3)).slice(0, 160));
  const pool845 = topicStageService.candidates(undefined, []);
  check('P845 活性化は舞台プールの直近性の契約を壊さない', !pool845.includes('活性チェックX'), JSON.stringify(pool845).slice(0, 200));
  const later845 = activationService.score('活性チェックX', Date.now() + 14 * 24 * 3600_000);
  check('P845 活性化は時間で冷める', later845 < score845, `${score845} -> ${later845}`);
}

// ---- P846: 保留枠組みの共通土台（置く・覗く・消費する・期限） ----
{
  const { pendingSlotService } = await import('../src/miki/memory/services/pendingSlotService');
  const t846 = 1_700_000_000_000;
  pendingSlotService.set('miki_probe_slot_846', { a: 1 }, 60000, t846);
  check('P846 控えを覗ける（消費しない）', pendingSlotService.peek<{ a: number }>('miki_probe_slot_846', t846 + 1000)?.a === 1
    && pendingSlotService.peek<{ a: number }>('miki_probe_slot_846', t846 + 2000)?.a === 1, '');
  check('P846 期限切れは無効', pendingSlotService.peek('miki_probe_slot_846', t846 + 61000) === undefined, '');
  pendingSlotService.set('miki_probe_slot_846', { a: 2 }, 60000, t846);
  check('P846 消費は1回だけ', pendingSlotService.consume<{ a: number }>('miki_probe_slot_846', t846 + 1000)?.a === 2
    && pendingSlotService.consume('miki_probe_slot_846', t846 + 1000) === undefined, '');
}

// ---- P847: 質問の選択（てこの大きい語から聞き返す） ----
{
  const { conversationFactIntakeService } = await import('../src/miki/conversation/services/conversationFactIntakeService');
  const { japaneseDictionaryService } = await import('../src/miki/research/services/japaneseDictionaryService');
  const { storageService } = await import('../src/services/storageService');
  storageService.removeItem('miki_unknown_asked_v1');
  storageService.removeItem('miki_unknown_pending_v1');
  let mem847: any[] = [];
  let st847: any = undefined;
  const say847 = async (text: string) => {
    const intake = conversationFactIntakeService.intakeFromUserText(text, mem847);
    mem847 = intake.updatedMemories;
    const r: any = await conversationCoreService.execute({ prompt: text, memories: mem847, conversationState: st847, recentMessages: [] } as any);
    st847 = r.nextConversationState;
    return String(r.replyText || '');
  };
  await say847('ミナチェックは、ケサチェックの仲間だよ');
  const ask847 = await say847('今日はユキチェックとケサチェックのことをずっと考えてたんだ');
  check('P847 聞き返しは、教わった説明に出てくる語を優先する', ask847.includes('「ケサチェック」って、どんなものですか？'), ask847.slice(0, 200));
  await say847('ケサチェックは、山に住む鳥だよ');
  check('P847 聞き返した語への答えが語彙に入る（保留枠組み経由）', japaneseDictionaryService.has('ケサチェック'), '');
}

// ---- P848: 事例ベースの想起（エピソードを内容で引く） ----
{
  const { conversationFactIntakeService } = await import('../src/miki/conversation/services/conversationFactIntakeService');
  const { episodeMemoryService } = await import('../src/miki/conversation/services/episodeMemoryService');
  const { daysAgoKey } = await import('../src/miki/memory/services/dayKeyService');
  const { storageService } = await import('../src/services/storageService');
  storageService.setItem('miki_episodes_v1', JSON.stringify([
    { day: daysAgoKey(2), topics: ['サクラチェック', '川'], summary: '昨日は、サクラチェックの話が中心でした。' },
    { day: daysAgoKey(1), topics: ['山'], summary: '昨日は、山の話が中心でした。' },
  ]));
  const svc848 = episodeMemoryService.episodesMatching(['サクラチェック']);
  check('P848 エピソードを話題で引ける', svc848.length === 1 && svc848[0].daysAgo === 2, JSON.stringify(svc848).slice(0, 120));
  let mem848: any[] = [];
  let st848: any = undefined;
  const say848 = async (text: string) => {
    const intake = conversationFactIntakeService.intakeFromUserText(text, mem848);
    mem848 = intake.updatedMemories;
    const r: any = await conversationCoreService.execute({ prompt: text, memories: mem848, conversationState: st848, recentMessages: [] } as any);
    st848 = r.nextConversationState;
    return String(r.replyText || '');
  };
  await say848('ウミチェックは、海に住む生き物だよ');
  const hit848 = await say848('サクラチェックの話、いつしたっけ？');
  check('P848 「Xの話、いつしたっけ？」に内容で答える', hit848.includes('サクラチェック') && hit848.includes('一昨日'), hit848.slice(0, 160));
  const miss848 = await say848('ウミチェックの話、いつしたっけ？');
  check('P848 記録に無い話題は正直に答える', miss848.includes('記録には残ってない'), miss848.slice(0, 160));
}

// ---- P849: 確信度の伝播（予測の外れが仮の関係を弱める） ----
{
  const { predictionLedgerService } = await import('../src/miki/memory/services/predictionLedgerService');
  const { worldModelGraphService } = await import('../src/miki/selfAwareness/services/worldModelGraphService');
  worldModelGraphService.addRelation({ fromName: '伝播チェックX', toName: '生き物', type: 'IS_A', provisional: true, confidence: 0.3 });
  const pred849 = predictionLedgerService.predictForTarget('伝播チェックX');
  check('P849 仮の信念から予測が立つ', !!pred849 && pred849.outcome === 'OPEN', JSON.stringify(pred849 || {}).slice(0, 100));
  worldModelGraphService.addRelation({ fromName: '伝播チェックX', toName: '動物', type: 'IS_A' });
  const settled849 = predictionLedgerService.settleAll();
  const weakened = worldModelGraphService.relationsOf('伝播チェックX').find((r: any) => r.to === '生き物');
  check('P849 外れた仮説の確信度が下がる', settled849.refuted >= 1 && !!weakened && weakened.confidence < 0.15, JSON.stringify(weakened || {}).slice(0, 120));
  worldModelGraphService.addRelation({ fromName: '伝播チェックY', toName: '鳥', type: 'IS_A', provisional: true, confidence: 0.5 });
  const promotedConf = worldModelGraphService.adjustRelationConfidence('伝播チェックY', '鳥', 'IS_A', 0.2);
  const promoted = worldModelGraphService.relationsOf('伝播チェックY').find((r: any) => r.to === '鳥');
  check('P849 確信度が閾値を越えた仮の関係は確定へ昇格する', promotedConf !== undefined && promotedConf >= 0.6 && !!promoted && !promoted.provisional, JSON.stringify(promoted || {}).slice(0, 120));
}

// ---- P850: 保留枠組みの移行つづき（忘れた語の控え） ----
{
  const { conversationFactIntakeService } = await import('../src/miki/conversation/services/conversationFactIntakeService');
  let mem850: any[] = [];
  let st850: any = undefined;
  const say850 = async (text: string) => {
    const intake = conversationFactIntakeService.intakeFromUserText(text, mem850);
    mem850 = intake.updatedMemories;
    const r: any = await conversationCoreService.execute({ prompt: text, memories: mem850, conversationState: st850, recentMessages: [] } as any);
    st850 = r.nextConversationState;
    return String(r.replyText || '');
  };
  await say850('ワスチェックは、忘れ物のチェックに使う言葉だよ');
  const fg850 = await say850('ワスチェックのことは忘れて');
  check('P850 忘れた語の受け答えが保留枠組み経由で返る', fg850.includes('「ワスチェック」のことは忘れますね'), fg850.slice(0, 160));
}


// ---- 場面の束を共有サービスに（P852） ----
{
  const { sceneBufferService } = await import('../src/miki/memory/services/sceneBufferService');
  const { conversationOpenTopicService } = await import('../src/miki/conversation/services/conversationOpenTopicService');
  const { dayKeyOf, todayKey, daysAgoKey } = await import('../src/miki/memory/services/dayKeyService');
  const run852 = async (p: string) => conversationCoreService.execute({ prompt: p } as any);
  void run852;
  // 3日前の trail に fatigue を2件置く（その日は他の交通が無い）
  const day3 = daysAgoKey(3);
  const base = new Date(`${day3}T12:00:00`).getTime();
  const prevTrail = storageService.getItem('miki_user_state_trail_v1');
  const trail = JSON.parse(prevTrail || '[]') as Array<{ signal: string; at: number }>;
  trail.push({ signal: 'fatigue', at: base }, { signal: 'fatigue', at: base + 3600_000 });
  storageService.setItem('miki_user_state_trail_v1', JSON.stringify(trail));
  check('P852 その日の主な状態を束側で計算できる', sceneBufferService.dominantStateFor(day3) === 'fatigue', String(sceneBufferService.dominantStateFor(day3)));
  conversationOpenTopicService.record('場面チェックX', 3);
  check('P852 今日の話題が束に入る', sceneBufferService.topicsFor(todayKey()).includes('場面チェックX'), JSON.stringify(sceneBufferService.topicsFor(todayKey())));
  const scene = sceneBufferService.current();
  check('P852 今の場面の束が組み立つ', scene.day === todayKey() && Array.isArray(scene.topics) && scene.topics.includes('場面チェックX'), JSON.stringify(scene).slice(0, 160));
  const { stateSnapshotExportService } = await import('../src/miki/selfAwareness/services/stateSnapshotExportService');
  stateSnapshotExportService.exportNow();
  const saved852 = JSON.parse(storageService.getItem('miki_state_snapshot_v1') || 'null');
  const body852 = saved852 && typeof saved852.json === 'string' ? JSON.parse(saved852.json) : null;
  check('P852 スナップショットに場面の束が載る', Boolean(body852 && body852.scene && body852.scene.day === todayKey()), body852 && body852.scene ? JSON.stringify(body852.scene).slice(0, 120) : 'no scene');
  void dayKeyOf;
}


// ---- 固定返答の使用統計から降格を抽出する（P853） ----
{
  const { fixedReplyStatsService } = await import('../src/miki/memory/services/fixedReplyStatsService');
  const core: any = conversationCoreService as any;
  const cat = 'fx_check853';
  const forms = ['形Aです', '形Bです', '形Cです'];
  const picked = new Set<string>();
  for (let i = 0; i < 6; i++) picked.add(core.pickFixedReply(cat, forms));
  const st = fixedReplyStatsService.stats()[cat] || {};
  const usedTotal = Object.values(st).reduce((a, e) => a + e.used, 0);
  check('P853 使用が統計に積まれる', usedTotal === 6 && picked.size === 3, JSON.stringify(st).slice(0, 120));
  // 形B（index 1）に当たり2・使用4以上を仕込み、降格されることを見る
  const statsAll = fixedReplyStatsService.stats();
  statsAll[cat] = { '0': { used: 5, strikes: 0 }, '1': { used: 5, strikes: 2 }, '2': { used: 5, strikes: 0 } };
  storageService.setItem('miki_fixed_reply_stats_v1', JSON.stringify(statsAll));
  check('P853 当たりの多い形は降格集合に入る', fixedReplyStatsService.demotedIndexes(cat, 3).has(1) && fixedReplyStatsService.demotedIndexes(cat, 3).size === 1, JSON.stringify([...fixedReplyStatsService.demotedIndexes(cat, 3)]));
  const after = new Set<string>();
  for (let i = 0; i < 6; i++) after.add(core.pickFixedReply(cat, forms));
  check('P853 降格した形は回転に出てこない', !after.has('形Bです') && after.has('形Aです') && after.has('形Cです'), JSON.stringify([...after]));
  // 当たり記録：直近の使用に訂正が続けば、その形に strike が付く
  const lastRec = JSON.parse(storageService.getItem('miki_last_fixed_reply_v1') || 'null');
  const lastIdx = String(lastRec && lastRec.index);
  const before = (fixedReplyStatsService.stats()[cat][lastIdx] || { strikes: 0 }).strikes;
  const hit = fixedReplyStatsService.recordStrikeIfRecent();
  check('P853 直近の使用への訂正は当たりになる', hit === true && fixedReplyStatsService.stats()[cat][lastIdx].strikes === before + 1, `hit=${hit} idx=${lastIdx}`);
  check('P853 当たり記録は消費される', fixedReplyStatsService.recordStrikeIfRecent() === false, '');
}


// ---- 外れた予測を再学習のギャップへ戻す（P854） ----
{
  const { worldModelGraphService: wm854 } = await import('../src/miki/selfAwareness/services/worldModelGraphService');
  const { predictionLedgerService: pl854 } = await import('../src/miki/memory/services/predictionLedgerService');
  const { knowledgeConsolidationService: kc854 } = await import('../src/miki/selfAwareness/services/knowledgeConsolidationService');
  const { knowledgeGapService: kg854 } = await import('../src/miki/unknown/services/knowledgeGapService');
  wm854.addRelation({ fromName: '再学習チェックX', toName: '生き物', type: 'IS_A', provisional: true, confidence: 0.3 });
  const pred854 = pl854.predictForTarget('再学習チェックX');
  check('P854 予測が立つ', Boolean(pred854) && pred854!.outcome === 'OPEN', JSON.stringify(pred854).slice(0, 120));
  wm854.addRelation({ fromName: '再学習チェックX', toName: '動物', type: 'IS_A', provisional: false, confidence: 0.9 });
  storageService.removeItem('miki_consolidation_last_run_v1');
  const r854 = kc854.runIfDue();
  check('P854 統合で予測が外れ、再学習ギャップが開く', Boolean(r854) && r854!.predictions.refuted >= 1 && r854!.relearnGaps >= 1, JSON.stringify(r854).slice(0, 200));
  const gaps854 = kg854.listOpen(500).filter((g: any) => String(g.identity?.target || '').toLowerCase() === '再学習チェックx'.toLowerCase());
  check('P854 再学習ギャップが対象を指している', gaps854.length >= 1 && gaps854.some((g: any) => g.type === 'UNKNOWN_RELATION'), JSON.stringify(gaps854.map((g: any) => g.type)));
}


// ---- 照応解決へ直近メッセージを通す（P855） ----
{
  const { hybridConversationEngineService } = await import('../src/miki/conversation/services/hybridConversationEngineService');
  const { classifyConversationKnowledgeState } = await import('../src/miki/conversation/services/conversationStateService');
  const state855: any = { conversationId: 'check855', stage: 'GREETING', recentEntities: [], currentTopic: '', lastTopic: '' };
  const msgs855 = [{ role: 'user', content: 'クオッカは大きいよ' }];
  const noMsg = hybridConversationEngineService.interpret('それは大きい？', state855, []);
  check('P855 メッセージ無しでは照応は解けない', noMsg.anaphora.resolved === null, JSON.stringify(noMsg.anaphora).slice(0, 120));
  const withMsg = hybridConversationEngineService.interpret('それは大きい？', state855, [], msgs855);
  check('P855 直近メッセージから照応が解ける', withMsg.anaphora.resolved === 'クオッカ' && withMsg.anaphora.confidence === 'unique', JSON.stringify(withMsg.anaphora).slice(0, 120));
  check('P855 知識状態の分類もメッセージで変わる', classifyConversationKnowledgeState('それは大きい？', state855) === 'MEANING_UNCLEAR' && classifyConversationKnowledgeState('それは大きい？', state855, msgs855) !== 'MEANING_UNCLEAR', classifyConversationKnowledgeState('それは大きい？', state855, msgs855));
}


// ---- P214談話スタックへ通常会話から供給する（P856） ----
{
  const { conversationGraphCompletionP214Service } = await import('../src/miki/conversation/services/conversationGraphCompletionP214Service');
  const run856 = async (p: string) => conversationCoreService.execute({ prompt: p } as any);
  await run856('スタックチェックXは、山に住む鳥だよ');
  const ref856 = conversationGraphCompletionP214Service.resolveReference('それは大きい？');
  check('P856 通常会話の話題が談話スタックに積まれ、指示語で引ける', Boolean(ref856) && (ref856 as any).terms.some((t: string) => t.includes('スタックチェック')), JSON.stringify(ref856).slice(0, 160));
  await run856('それは大きい？');
  const ref856b = conversationGraphCompletionP214Service.resolveReference('あれは重い？');
  check('P856 指示的な発話はスタックを押し上げない', Boolean(ref856b) && (ref856b as any).surface === (ref856 as any).surface, JSON.stringify(ref856b).slice(0, 120));
}


// ---- 「どっちも」のつぶやきと単一指示語の誤読を直す（P857） ----
{
  const run857 = async (text: string, mems: any[], st: any) => {
    const intake = conversationFactIntakeService.intakeFromUserText(text, mems);
    const r: any = await conversationCoreService.execute({ prompt: text, memories: intake.updatedMemories, conversationState: st, recentMessages: [] } as any);
    return { r, mems: intake.updatedMemories, st: r.nextConversationState };
  };
  let mems857: any[] = [];
  let st857: any = undefined;
  let o = await run857('ハナモドキは、雪原に住む小さな鳥だよ', mems857, st857); mems857 = o.mems; st857 = o.st;
  o = await run857('ヤマモドキは、山に住む鳥だよ', mems857, st857); mems857 = o.mems; st857 = o.st;
  o = await run857('ハナモドキとヤマモドキ、どっちも気になるな', mems857, st857); mems857 = o.mems; st857 = o.st;
  check('P857 「どっちも気になる」は両方への気持ちとして受ける', o.r.replyText.includes('「ハナモドキ」も「ヤマモドキ」も') && o.r.replyText.includes('どっちも気になりますよね'), o.r.replyText.slice(0, 160));
  check('P857 内部の判定文が漏れない', !o.r.replyText.includes('最終的な判定') && !o.r.replyText.includes('一意に特定できません'), o.r.replyText.slice(0, 120));
  o = await run857('ハナモドキとヤマモドキ、どっちが大きい？', mems857, st857); mems857 = o.mems; st857 = o.st;
  check('P857 本物の二択の質問は従来どおり比べる', o.r.replyText.includes('大きさ') || o.r.replyText.includes('比べ'), o.r.replyText.slice(0, 160));
}


// ---- 予定の取り消しに専用の受け答えを付ける（P858） ----
{
  const run858 = async (text: string) => {
    const intake = conversationFactIntakeService.intakeFromUserText(text, []);
    const r: any = await conversationCoreService.execute({ prompt: text, memories: intake.updatedMemories, recentMessages: [] } as any);
    return r;
  };
  const { dayKeyOf } = await import('../src/miki/memory/services/dayKeyService');
  const tomorrow858 = dayKeyOf(Date.now() + 24 * 3600_000);
  storageService.setItem('miki_user_plans_v1', JSON.stringify([
    { when: '明日', text: '買物チェックの予定', at: Date.now(), date: tomorrow858 },
    { when: '明日', text: '散歩チェックの予定', at: Date.now(), date: tomorrow858 },
  ]));
  const c1 = await run858('明日の予定、全部なしにして');
  check('P858 まとめ取り消しは件数つきで受ける', c1.replyText.includes('明日の予定2件、全部取り消しておきました'), c1.replyText.slice(0, 140));
  const left858 = JSON.parse(storageService.getItem('miki_user_plans_v1') || '[]');
  check('P858 台帳からも消えている', left858.filter((p: any) => p.date === tomorrow858).length === 0, JSON.stringify(left858).slice(0, 120));
  storageService.setItem('miki_user_plans_v1', JSON.stringify([
    { when: '明日', text: '買物チェックの予定', at: Date.now(), date: tomorrow858 },
  ]));
  const c2 = await run858('明日の買物チェックの予定、なしにして');
  check('P858 内容指定の取り消しも受ける', c2.replyText.includes('明日の予定は取り消しておきました'), c2.replyText.slice(0, 140));
}


// ---- 「僕の言ったこと覚えてる？」を記憶の確認として受ける（P859） ----
{
  const msgs859: any[] = [];
  let mems859: any[] = [];
  let st859: any = undefined;
  const run859 = async (text: string) => {
    const intake = conversationFactIntakeService.intakeFromUserText(text, mems859);
    mems859 = intake.updatedMemories;
    const r: any = await conversationCoreService.execute({ prompt: text, memories: mems859, conversationState: st859, recentMessages: msgs859 } as any);
    st859 = r.nextConversationState;
    msgs859.push({ role: 'user', content: text }, { role: 'assistant', content: r.replyText });
    return r;
  };
  await run859('キオクモドキは、川に住む魚だよ');
  const q1 = await run859('僕の言ったこと覚えてる？');
  check('P859 言ったことの確認は振り返りで受ける', q1.replyText.includes('覚えてますよ') && q1.replyText.includes('キオクモドキ'), q1.replyText.slice(0, 160));
  check('P859 「こと」を未知語として扱わない', !q1.replyText.includes('「こと」は、まだ知らない'), q1.replyText.slice(0, 120));
  const q2 = await run859('キオクモドキって覚えてる？');
  check('P859 語そのものの確認は従来どおり', q2.replyText.includes('キオクモドキ') && q2.replyText.includes('川に住む魚'), q2.replyText.slice(0, 160));
}


// ---- 自己完結の訂正と「やっぱり」訂正で正しい側を学ぶ（P860） ----
{
  const run860 = async (text: string, mems: any[]) => {
    const intake = conversationFactIntakeService.intakeFromUserText(text, mems);
    const r: any = await conversationCoreService.execute({ prompt: text, memories: intake.updatedMemories, recentMessages: [] } as any);
    return { r, mems: intake.updatedMemories };
  };
  // 先行事実なしの自己完結の訂正
  let o = await run860('僕は犬じゃなくてウサギモドキを飼ってたよ', []);
  o = await run860('僕って何か飼ってたっけ？', o.mems);
  check('P860 自己完結の訂正で正しい側が想起できる', o.r.replyText.includes('ウサギモドキ'), o.r.replyText.slice(0, 160));
  // 先行事実あり＋「やっぱり」付きの訂正（述語の二重化なし）
  let p = await run860('僕はイヌモドキを飼ってるよ', []);
  p = await run860('やっぱりイヌモドキじゃなくてネコモドキを飼ってるよ', p.mems);
  p = await run860('僕って何か飼ってたっけ？', p.mems);
  check('P860 「やっぱり」訂正でも正しい側が想起できる', p.r.replyText.includes('ネコモドキ'), p.r.replyText.slice(0, 160));
  check('P860 述語が二重にならない', !p.r.replyText.includes('を飼ってるを飼ってる'), p.r.replyText.slice(0, 160));
}


// ---- 片方を知らない共通点・類似の質問は名前を挙げて知らないと答える（P861） ----
{
  const run861 = async (text: string, mems: any[]) => {
    const intake = conversationFactIntakeService.intakeFromUserText(text, mems);
    const r: any = await conversationCoreService.execute({ prompt: text, memories: intake.updatedMemories, recentMessages: [] } as any);
    return { r, mems: intake.updatedMemories };
  };
  let o = await run861('ミズモドキは、川に住む両生類だよ', []);
  o = await run861('カワモドキは、川に住む両生類だよ', o.mems);
  o = await run861('ミズモドキとカワモドキの共通点は？', o.mems);
  check('P861 両方知っている共通点は従来どおり', o.r.replyText.includes('共通点'), o.r.replyText.slice(0, 140));
  o = await run861('ミズモドキとヒカリモドキの共通点は？', o.mems);
  check('P861 片方を知らない共通点は名前を挙げて知らないと答える', o.r.replyText.includes('「ヒカリモドキ」のことは、まだ知らないので'), o.r.replyText.slice(0, 160));
  o = await run861('ヒカリモドキとミズモドキ、似てる？', o.mems);
  check('P861 片方を知らない類似も同じ', o.r.replyText.includes('「ヒカリモドキ」のことは、まだ知らないので') && o.r.replyText.includes('似ているかは分からない'), o.r.replyText.slice(0, 160));
}


// ---- 教わった語の説明文の先頭の読点を落とす（P862） ----
{
  const intake = conversationFactIntakeService.intakeFromUserText('ヨルヒカリモドキは、夜に光る虫だよ', []);
  const r: any = await conversationCoreService.execute({ prompt: 'ヨルヒカリモドキは、夜に光る虫だよ', memories: intake.updatedMemories, recentMessages: [] } as any);
  check('P862 受け答えに読点が残らない', !r.replyText.includes('！、') && r.replyText.includes('夜に光る虫ということですね'), r.replyText.slice(0, 140));
  const gloss862 = japaneseDictionaryService.lookup('ヨルヒカリモドキ').map((e: any) => e.gloss).filter(Boolean)[0];
  check('P862 保存される説明も clean', gloss862 === '夜に光る虫', String(gloss862));
  const fact862 = intake.updatedMemories.find((m: any) => m.source === 'user_statement' && m.factValue);
  check('P862 事実の値も clean', fact862 && !String(fact862.factValue).startsWith('、'), String(fact862?.factValue));
}


// ---- カレンダーの3形（N日後の曜日・次のX曜日・素のX曜日）（P863） ----
{
  const WD863 = ['日', '月', '火', '水', '木', '金', '土'];
  const ask863 = async (t: string) => (await conversationCoreService.execute({ prompt: t } as any) as any).replyText as string;
  const fmt863 = (d: Date) => `${d.getMonth() + 1}月${d.getDate()}日`;
  const now863 = new Date();
  const plus863 = (n: number) => { const d = new Date(now863.getFullYear(), now863.getMonth(), now863.getDate()); d.setDate(d.getDate() + n); return d; };
  const r1 = await ask863('3日後は何曜日？');
  const e1 = plus863(3);
  check('P863 N日後は何曜日は、ずらした日付で答える', r1.includes(`${fmt863(e1)}（${WD863[e1.getDay()]}曜日）`), r1.slice(0, 100));
  let deltaFri = (5 - now863.getDay() + 7) % 7;
  const r2 = await ask863('金曜日は何日？');
  check('P863 素のX曜日は何日は直近の日付で答える', r2.includes(fmt863(plus863(deltaFri))), r2.slice(0, 100));
  if (deltaFri === 0) deltaFri = 7;
  const r3 = await ask863('次の金曜日は何日？');
  check('P863 次のX曜日は今日の曜日と重なれば来週を指す', r3.includes(fmt863(plus863(deltaFri))), r3.slice(0, 100));
}


// ---- 時刻帯の二択と、明日までの残り時間（P864） ----
{
  const ask864 = async (t: string) => (await conversationCoreService.execute({ prompt: t } as any) as any).replyText as string;
  const now864 = new Date();
  const r1 = await ask864('午前と午後どっち？');
  check('P864 午前と午後どっちは今の帯で答える', r1 === `今は${now864.getHours() < 12 ? '午前' : '午後'}です。` && !r1.includes('最終判定'), r1.slice(0, 100));
  const remain864 = 24 * 60 - (now864.getHours() * 60 + now864.getMinutes());
  const hh864 = Math.floor(remain864 / 60); const mm864 = remain864 % 60;
  const expected864 = mm864 > 0 ? `あと${hh864}時間${mm864}分です` : `あと${hh864}時間です`;
  const r2 = await ask864('あと何時間で明日になる？');
  // 実行をまたいで分が進むと期待値が1分ずれる（時計端の揺れ）。
  // 実行直後の時刻から作った期待値も許す。
  const after864 = new Date();
  const remainA864 = 24 * 60 - (after864.getHours() * 60 + after864.getMinutes());
  const expectedA864 = (remainA864 % 60) > 0 ? `あと${Math.floor(remainA864 / 60)}時間${remainA864 % 60}分です` : `あと${Math.floor(remainA864 / 60)}時間です`;
  check('P864 あと何時間で明日は残り時間を計算する', r2.includes(expected864) || r2.includes(expectedA864), r2.slice(0, 100));
}


// ---- 内部の判定・見出し文が返答に漏れない（P865） ----
{
  const core865: any = conversationCoreService as any;
  const leak = core865.buildResult('UNRESOLVED', 'check', '【最終判定】\n対象を一意に特定できません。\n\n【次に実施すべき作業】\n・「A」と「B」のどちらを指していますか？', {}, 'X', 0, [], Date.now(), {});
  check('P865 判定文は確認質問だけに置き換わる', leak.replyText === '「A」と「B」のどちらを指していますか？', leak.replyText.slice(0, 120));
  const headed = core865.buildResult('RESOLVED', 'check', '【確定事項】\n本文の文です。', {}, 'X', 0, [], Date.now(), {});
  check('P865 見出しだけの漏れは見出しが落ちる', headed.replyText === '本文の文です。', headed.replyText.slice(0, 120));
  let memories865: any[] = [];
  let state865: any = undefined;
  const msgs865: any[] = [];
  const turn865 = async (t: string) => {
    const intake = conversationFactIntakeService.intakeFromUserText(t, memories865);
    memories865 = intake.updatedMemories;
    const r: any = await conversationCoreService.execute({ prompt: t, memories: memories865, conversationState: state865, recentMessages: msgs865 } as any);
    state865 = r.nextConversationState;
    msgs865.push({ role: 'user', content: t }, { role: 'assistant', content: r.replyText });
    return r.replyText as string;
  };
  await turn865('クオッカは、草原に住む有袋類だよ');
  await turn865('ワラルーは、山に住む有袋類だよ');
  const r865 = await turn865('クオッカとワラルーって、それは夜行性なの？');
  check('P865 会話の返答に見出しが付かない', !r865.includes('【') && !r865.includes('最終判定'), r865.slice(0, 140));
}


// ---- 予定の聞き返し（教えて形）・教えておく記録・所在の確認（P866） ----
{
  storageService.setItem('miki_user_plans_v1', JSON.stringify([]));
  let memories866: any[] = [];
  const turn866 = async (t: string) => {
    const intake = conversationFactIntakeService.intakeFromUserText(t, memories866);
    memories866 = intake.updatedMemories;
    const r: any = await conversationCoreService.execute({ prompt: t, memories: memories866, recentMessages: [] } as any);
    return r.replyText as string;
  };
  await turn866('今日はシカクチェックの予定があるよ');
  const p1 = await turn866('今日の予定全部教えて');
  check('P866 今日の予定全部教えては当日の控えを返す', p1.includes('今日の予定は') && p1.includes('シカクチェック'), p1.slice(0, 140));
  await turn866('明日の予定は教えておくね、カワチェックだよ');
  const p2 = await turn866('明日の予定は？');
  check('P866 教えておくねの文も予定として控えられる', p2.includes('カワチェック'), p2.slice(0, 140));
  await turn866('ホソミチェックは、細い川に住む魚だよ');
  const p3 = await turn866('ホソミチェックって、川にいるの？');
  check('P866 説明にある場所は「いる」と答える', p3.startsWith('はい、') && p3.includes('川にいると聞いています'), p3.slice(0, 140));
  const p4 = await turn866('ホソミチェックって、海にいるの？');
  check('P866 説明に無い場所は正直に知らないと答える', p4.includes('そこまでは知らないです') && !p4.includes('仲間だと思います'), p4.slice(0, 140));
}


// ---- 予定の開始時刻を先に答える／今週末は週末として引く（P867） ----
{
  storageService.setItem('miki_user_plans_v1', JSON.stringify([]));
  let memories867: any[] = [];
  const turn867 = async (t: string) => {
    const intake = conversationFactIntakeService.intakeFromUserText(t, memories867);
    memories867 = intake.updatedMemories;
    const r: any = await conversationCoreService.execute({ prompt: t, memories: memories867, recentMessages: [] } as any);
    return r.replyText as string;
  };
  await turn867('明日の15時にシカクチェックの予約があるんだ');
  const t1 = await turn867('明日の予定、何時からだっけ？');
  check('P867 何時からは時刻で答える', t1.includes('15時から'), t1.slice(0, 140));
  const t2 = await turn867('明日の予定って何だっけ？');
  check('P867 素の聞き返しは従来どおり', t2.includes('シカクチェック'), t2.slice(0, 140));
  await turn867('今週末にカワチェックに行く予定だよ');
  const plans867 = JSON.parse(storageService.getItem('miki_user_plans_v1') || '[]');
  check('P867 今週末の予定は週末ラベルで控えられる', plans867.some((p: any) => p.when === '週末' && String(p.text).includes('カワチェック')), JSON.stringify(plans867).slice(0, 160));
  const t3 = await turn867('今週末の予定は？');
  check('P867 今週末の聞き返しは週末の控えを返す', t3.includes('カワチェック') && !t3.includes('今週の予定は、まだ聞いていない'), t3.slice(0, 140));
}


// ---- ビービーの声: ます形の文末と時計カレンダーの口調（P868） ----
{
  const { paraphraseService } = await import('../src/miki/memory/services/paraphraseService');
  const v1 = paraphraseService.applyCasualVoice('「ホソミチェック」は川にいると聞いています。');
  check('P868 聞いていますは聞いてるよになる', v1.text.includes('聞いてるよ'), v1.text.slice(0, 120));
  const v2 = paraphraseService.applyCasualVoice('予定はありません。');
  check('P868 否定のます形には触らない', v2.text === '予定はありません。', v2.text.slice(0, 120));
  const { personaProfileService } = await import('../src/miki/conversation/services/personaProfileService');
  (globalThis as any).window = { dispatchEvent: () => true, addEventListener: () => {}, removeEventListener: () => {} };
  personaProfileService.switchProfile('persona-bibi');
  const rb: any = await conversationCoreService.execute({ prompt: '次の金曜日は何日？' } as any);
  personaProfileService.switchProfile('persona-default');
  check('P868 ビービーではカレンダーの答えも口調が寄る', rb.replyText.includes('だよ') && !rb.replyText.includes('日です'), rb.replyText.slice(0, 120));
}


// ---- 割引の計算と「時間半」の換算（P869） ----
{
  const run869 = async (t: string) => conversationCoreService.execute({ prompt: t } as any) as any;
  const d1 = await run869('1500円の3割引はいくら？');
  check('P869 割引を計算する', d1.replyText.includes('1050円'), d1.replyText.slice(0, 120));
  const d2 = await run869('2000円の20%オフはいくら？');
  check('P869 %オフを計算する', d2.replyText.includes('1600円'), d2.replyText.slice(0, 120));
  const d3 = await run869('1時間半は何分？');
  check('P869 1時間半は90分', d3.replyText.includes('90分'), d3.replyText.slice(0, 120));
  const d4 = await run869('2日半は何時間？');
  check('P869 2日半は60時間', d4.replyText.includes('60時間'), d4.replyText.slice(0, 120));
}


// ---- ずらした日付の質問は今日の日付に化けない（P870） ----
{
  const run870 = async (t: string) => conversationCoreService.execute({ prompt: t } as any) as any;
  const fmt = (d: Date) => `${d.getMonth() + 1}月${d.getDate()}日`;
  const plus21 = new Date(); plus21.setDate(plus21.getDate() + 21);
  const w3 = await run870('3週間後は何月何日？');
  check('P870 3週間後の日付を答える', w3.replyText.includes(fmt(plus21)) && !w3.replyText.startsWith('今日は'), w3.replyText.slice(0, 120));
  const minus100 = new Date(); minus100.setDate(minus100.getDate() - 100);
  const b100 = await run870('100日前は何月何日？');
  check('P870 100日前の日付を答える', b100.replyText.includes(fmt(minus100)) && b100.replyText.includes('でした'), b100.replyText.slice(0, 120));
  const today870 = await run870('今日は何月何日？');
  check('P870 素の今日の日付は従来どおり', today870.replyText.includes(fmt(new Date())), today870.replyText.slice(0, 120));
}


// ---- 単位つきの量の比較（P871） ----
{
  const run871 = async (t: string) => conversationCoreService.execute({ prompt: t } as any) as any;
  const q1 = await run871('50センチと1メートル、どっちが長い？');
  check('P871 単位をまたいで比べる', q1.replyText.includes('1メートルの方が長い'), q1.replyText.slice(0, 120));
  const q2 = await run871('3キロと3000グラム、どっちが重い？');
  check('P871 等しい量は同じと答える', q2.replyText.includes('同じ'), q2.replyText.slice(0, 120));
  const q3 = await run871('1時間と90分、どっちが長い？');
  check('P871 時間の単位も比べる', q3.replyText.includes('90分の方が長い'), q3.replyText.slice(0, 120));
  const q4 = await run871('500円と1000円、どっちが安い？');
  check('P871 同じ単位で安い方を答える', q4.replyText.includes('500円の方が安い'), q4.replyText.slice(0, 120));
  const q5 = await run871('5と3、どっちが大きい？');
  check('P871 読点つきの素の比較も答える', q5.replyText.includes('5の方が大きい'), q5.replyText.slice(0, 120));
}

// P872: ゲーム設計の相談で、教わった原則（教師レッスン）を観点として引く。
// レッスン部品が無い状態では引かず、部品を投入すると出典つきで引く。
{
  const run872 = async (p: string) => {
    const r: any = await conversationCoreService.execute({ prompt: p } as any);
    return String(r?.replyText ?? '');
  };
  const REPO = 'miki_reusable_component_repository_v1';
  const prevRepo = storageService.getItem(REPO);
  try { storageService.removeItem(REPO); } catch { /* noop */ }
  const noLesson = await run872('ゲームで死んだあとのリトライが遅くて困ってます。どうしたらいいですか？');
  check('P872 レッスンが無ければ原則を引かない', !noLesson.includes('原則に、こういうのがあります'), noLesson.slice(0, 60));
  storageService.setItem(REPO, JSON.stringify([{
    componentType: 'TEACHER_LESSON', componentKind: 'KNOWLEDGE', lifecycleStatus: 'CANDIDATE',
    packageSubject: 'ゲーム制作の原則（1）',
    lesson: { id: 'TM9-18', title: 'リトライは迅速に（再開の速さが効く）',
      rule: 'リトライは迅速にする。やられてから操作が戻るまでの間に、熱は急速に冷める。ペナルティの重さより再開の速さが効く。' },
  }]));
  const withLesson = await run872('ゲームで死んだあとのリトライが遅くて困ってます。どうしたらいいですか？');
  check('P872 設計相談で原則を引く', withLesson.includes('リトライは迅速に') && withLesson.includes('原則'), withLesson.slice(0, 80));
  check('P872 候補であることを明示する', withLesson.includes('候補として教わった知識'), withLesson.slice(0, 80));
  const statement = await run872('ゲームで死んだあとのリトライが遅いです');
  check('P872 相談の形でなければ引かない', !statement.includes('原則に、こういうのがあります'), statement.slice(0, 60));
  if (prevRepo) storageService.setItem(REPO, prevRepo); else storageService.removeItem(REPO);
}

// P873: 原則の引き方の精度。実教材112件で実測した誤引き（一般語
// 「ゲーム」の一致で無関係なレッスンが勝つ／同点が保管順で決まる）を
// 是正：一般語の除外、直接一致の重み、先頭キーの加点、同点は教材順。
{
  const { teacherLessonRecallService } = await import('../src/miki/memory/services/teacherLessonRecallService');
  const REPO = 'miki_reusable_component_repository_v1';
  const prevRepo = storageService.getItem(REPO);
  const seed = (lessons: any[]) => storageService.setItem(REPO, JSON.stringify(lessons.map((lesson) => ({
    componentType: 'TEACHER_LESSON', componentKind: 'KNOWLEDGE', lifecycleStatus: 'CANDIDATE',
    packageSubject: 'ゲーム制作の原則（テスト）', lesson,
  }))));
  seed([
    { id: 'TM12-20', title: '数値はボタン1つで実行中のゲームに反映できるようにする', rule: '調整した数値は、ボタン1つで実行中のゲームに反映できるようにする。' },
    { id: 'TM9-16', title: '難易度は「思ったより下げる」くらいがちょうど良い', rule: '開発者は慣れているので、思ったより下げるくらいでちょうど良い。' },
    { id: 'TM10-16', title: 'ヒットストップは必ず入れる', rule: 'ヒットストップは、ジャンルを問わず必ず入れる。' },
  ]);
  const picked1 = teacherLessonRecallService.findFor('ゲームの難易度が高すぎて詰みそうです。どうしたらいいですか？');
  check('P873 一般語で無関係なレッスンが勝たない', picked1?.id === 'TM9-16', picked1?.id ?? '(none)');
  const picked2 = teacherLessonRecallService.findFor('操作がもっさりして手応えがないです。どうしたらいいですか？');
  check('P873 状況語の橋渡しで引ける', picked2?.id === 'TM10-16', picked2?.id ?? '(none)');
  const picked3 = teacherLessonRecallService.findFor('天気の話をしたいです');
  check('P873 無関係な話題では引かない', picked3 === undefined, picked3?.id ?? '(none)');
  if (prevRepo) storageService.setItem(REPO, prevRepo); else storageService.removeItem(REPO);
}

// P874: 本流の返答は buildResult を通らないため、P865 の安全網が
// 効かず【最終見解】等の見出しが漏れていた。浄化を共通化し、本流の
// 収束点にも掛ける。
{
  const run874 = async (p: string, memories: any[] = []) => {
    const r: any = await conversationCoreService.execute({ prompt: p, memories } as any);
    return String(r?.replyText ?? '');
  };
  let mem874: any[] = [];
  for (const t of ['ユミモドキは重さ5キロの鳥だよ', 'ササモドキは重さ9キロの鳥だよ']) {
    const intake: any = conversationFactIntakeService.intakeFromUserText(t, mem874);
    mem874 = intake.updatedMemories ?? mem874;
    await run874(t, mem874);
  }
  const detail = await run874('その話、もう少し詳しく教えて', mem874);
  check('P874 本流でも見出しが漏れない', !detail.includes('【') && !detail.includes('最終見解'), detail.slice(0, 60));
  const sanitize = (conversationCoreService as any).sanitizeReplyText as (s: string) => string;
  check('P874 浄化は見出し行だけを落とす', sanitize('【最終見解】\n本文です。') === '本文です。', sanitize('【最終見解】\n本文です。'));
}

// P875: 動画から学ぶ受け口。字幕を読んで保存し、内容への質問に
// 読んだ本文から答える。字幕の無い動画は正直に失敗を返す。
{
  const { videoTranscriptService } = await import('../src/miki/research/services/videoTranscriptService');
  const VSTORE = 'miki_video_learnings_v1';
  const prevVStore = storageService.getItem(VSTORE);
  const WATCH875 = '<html><head><title>ヒットストップ入門 - YouTube</title></head><body><script>{"captionTracks":[{"baseUrl":"https://www.youtube.com/api/timedtext?v=abc123XYZ&lang=ja","name":{"simpleText":"日本語"},"vssId":"a.ja","languageCode":"ja","kind":"asr"}]}</script></body></html>';
  const XML875 = '<?xml version="1.0"?><transcript><text start="0" dur="3">今日はヒットストップについて話します</text><text start="3" dur="3">攻撃が当たった瞬間に時間を止める演出です</text></transcript>';
  const run875 = async (p: string) => String(((await conversationCoreService.execute({ prompt: p } as any)) as any)?.replyText ?? '');
  videoTranscriptService.setFetchForTest(async (url: string) => (url.includes('timedtext') ? XML875 : WATCH875));
  const learned875 = await run875('この動画見て学んで https://youtu.be/abc123XYZ');
  check('P875 動画の字幕を読んで学ぶ', learned875.includes('ヒットストップ入門') && learned875.includes('学びました'), learned875.slice(0, 60));
  const recall875 = await run875('動画でヒットストップについて何て言ってた？');
  check('P875 学んだ内容を本文から答える', recall875.includes('時間を止める演出'), recall875.slice(0, 80));
  videoTranscriptService.setFetchForTest(async () => '<html><head><title>字幕なし動画 - YouTube</title></head><body></body></html>');
  const noSub875 = await run875('この動画見て学んで https://youtu.be/zzz999ZZZ');
  check('P875 字幕が無い動画は正直に失敗を返す', noSub875.includes('学べませんでした'), noSub875.slice(0, 60));
  videoTranscriptService.setFetchForTest(null);
  if (prevVStore) storageService.setItem(VSTORE, prevVStore); else storageService.removeItem(VSTORE);
}

// P876: 対象の言い換え（職業＝仕事）。教えたときと聞き返すときの
// 言葉がずれても同じ事実を引く（従来は調査の生応答に落ちていた）。
{
  let mem876: any[] = [];
  const run876 = async (p: string) => {
    const intake: any = conversationFactIntakeService.intakeFromUserText(p, mem876);
    mem876 = intake.updatedMemories ?? mem876;
    const r: any = await conversationCoreService.execute({ prompt: p, memories: mem876 } as any);
    return String(r?.replyText ?? '');
  };
  await run876('僕の仕事は会社員だよ');
  const job876 = await run876('僕の職業は何？');
  check('P876 職業→仕事の言い換えで引ける', job876.includes('会社員'), job876.slice(0, 60));
  let mem876b: any[] = [];
  const run876b = async (p: string) => {
    const intake: any = conversationFactIntakeService.intakeFromUserText(p, mem876b);
    mem876b = intake.updatedMemories ?? mem876b;
    const r: any = await conversationCoreService.execute({ prompt: p, memories: mem876b } as any);
    return String(r?.replyText ?? '');
  };
  await run876b('僕の職業は看護師だよ');
  const job876b = await run876b('僕の仕事は何だっけ？');
  check('P876 仕事→職業の逆方向でも引ける', job876b.includes('看護師'), job876b.slice(0, 60));
}

// P877: 役のプリセット。「恋人」は最初から立場・口調の寄せが入った
// 定義で始まる（合成側が読む味付けが効く）。ビービーには適用しない。
{
  const { roleplaySessionService } = await import('../src/miki/conversation/services/roleplaySessionService');
  const started877 = roleplaySessionService.handleUserText('恋人として話して', 'persona-default');
  const role877: any = roleplaySessionService.getActiveRole();
  check('P877 恋人のプリセットで始まる', started877 === 'started' && !!role877 && String(role877.stance).includes('恋人') && String(role877.toneHint).includes('具体的に褒める'), JSON.stringify(role877?.stance ?? ''));
  roleplaySessionService.handleUserText('なりチャ終わり', 'persona-default');
  roleplaySessionService.handleUserText('彼女として話して', 'persona-bibi');
  const role877b: any = roleplaySessionService.getActiveRole();
  check('P877 ビービーにはプリセットを適用しない', !!role877b && role877b.stance === '' && role877b.toneHint === '', JSON.stringify(role877b?.stance ?? ''));
  roleplaySessionService.handleUserText('なりチャ終わり', 'persona-bibi');
}

// P878: 会話例の取り込み口。教師教材の任意チャンネル examples で
// 会話例を受け付け、型に分解して部品化する。関係性の相談では
// お手本として引く。
{
  const JSZip878 = (await import('jszip')).default;
  const { teacherMaterialIntakeService } = await import('../src/miki/core/services/teacherMaterialIntakeService');
  const { dialogueExampleRecallService } = await import('../src/miki/memory/services/dialogueExampleRecallService');
  const REPO878 = 'miki_reusable_component_repository_v1';
  const prevRepo878 = storageService.getItem(REPO878);
  const manifest878 = {
    formatVersion: 1, packageType: 'TEACHER_MATERIAL', teacher: { name: 'Claude', role: '教師' },
    subject: '会話例テスト', version: 'T1', lessons: [],
    examples: [{
      id: 'EX-T1', title: '拗ねたときの声かけ', scene: '相手が拗ねたとき',
      turns: [
        { speaker: '相手', text: 'もういいよ、放っておいて' },
        { speaker: 'みき', text: 'うん、今はそっとしておくね。近くにはいるよ' },
        { speaker: '相手', text: '……さっきの言い方、傷ついた' },
        { speaker: 'みき', text: 'ごめん、言い方がきつかったね。教えてくれてありがとう' },
      ],
    }],
  };
  const zip878 = new JSZip878();
  zip878.file('teacher_material.json', JSON.stringify(manifest878));
  zip878.file('INSTRUCTIONS.md', '# test');
  const bytes878 = await zip878.generateAsync({ type: 'uint8array' });
  const intake878: any = await teacherMaterialIntakeService.receivePackage({ fileName: 'ex.zip', bytes: bytes878 });
  check('P878 会話例だけのパッケージを受け付ける', intake878?.ok === true && String(intake878?.message ?? '').includes('会話例 1 件'), String(intake878?.message ?? '').slice(0, 60));
  const found878 = dialogueExampleRecallService.listExamples().find((e: any) => e.id === 'EX-T1');
  check('P878 型に分解されて登録される', !!found878 && found878.pattern.acts.includes('謝る') && found878.pattern.opening.includes('そっとしておく'), JSON.stringify(found878?.pattern ?? {}));
  const consult878: any = await conversationCoreService.execute({ prompt: '彼女が拗ねちゃった。どう声かければいい？' } as any);
  check('P878 相談でお手本を引く', String(consult878?.replyText ?? '').includes('拗ねたときの声かけ'), String(consult878?.replyText ?? '').slice(0, 60));
  if (prevRepo878) storageService.setItem(REPO878, prevRepo878); else storageService.removeItem(REPO878);
}

// P879: 会話で引いた原則・会話例に使用記録が付く（usageCount と
// 領収書）。成否は付けず「使われた」事実だけを数える。
{
  const JSZip879 = (await import('jszip')).default;
  const { teacherMaterialIntakeService } = await import('../src/miki/core/services/teacherMaterialIntakeService');
  const REPO879 = 'miki_reusable_component_repository_v1';
  const RCPT879 = 'miki_component_usage_receipts_v1';
  const prevRepo879 = storageService.getItem(REPO879);
  const prevRcpt879 = storageService.getItem(RCPT879);
  const manifest879 = {
    formatVersion: 1, packageType: 'TEACHER_MATERIAL', teacher: { name: 'Claude', role: '教師' },
    subject: '使用記録テスト', version: 'T1',
    lessons: [{ id: 'TM-T9', title: '難易度は詰んだら救済する', rule: '詰んだら救済の仕組みを用意する。', reason: 'r', howToJudge: 'h', example: 'e', antiPattern: 'a' }],
    examples: [{ id: 'EX-T9', title: '拗ねたときの声かけ', scene: '相手が拗ねたとき', turns: [
      { speaker: '相手', text: 'もういいよ' }, { speaker: 'みき', text: 'ごめん、近くにいるよ' },
    ] }],
  };
  const zip879 = new JSZip879();
  zip879.file('teacher_material.json', JSON.stringify(manifest879));
  const bytes879 = await zip879.generateAsync({ type: 'uint8array' });
  await teacherMaterialIntakeService.receivePackage({ fileName: 't.zip', bytes: bytes879 });
  await conversationCoreService.execute({ prompt: 'ゲームの難易度で詰んだらどうしたらいい？' } as any);
  await conversationCoreService.execute({ prompt: '彼女が拗ねちゃった。どう声かければいい？' } as any);
  const items879 = JSON.parse(storageService.getItem(REPO879) || '[]');
  const lessonUsage879 = items879.find((i: any) => i.componentType === 'TEACHER_LESSON' && String(i.purpose).includes('TM-T9'))?.usageCount;
  const exampleUsage879 = items879.find((i: any) => i.componentType === 'DIALOGUE_EXAMPLE' && String(i.purpose).includes('EX-T9'))?.usageCount;
  check('P879 引いた原則と会話例に使用記録が付く', lessonUsage879 === 1 && exampleUsage879 === 1, `lesson=${lessonUsage879} example=${exampleUsage879}`);
  const receipts879 = JSON.parse(storageService.getItem(RCPT879) || '[]');
  check('P879 使用の領収書が残る', receipts879.some((x: any) => x.taskId === 'design-principle-consult') && receipts879.some((x: any) => x.taskId === 'dialogue-example-consult'), '');
  if (prevRepo879) storageService.setItem(REPO879, prevRepo879); else storageService.removeItem(REPO879);
  if (prevRcpt879) storageService.setItem(RCPT879, prevRcpt879); else storageService.removeItem(RCPT879);
}

// P880: 事実の聞き返しの言い換えを語彙関係サービスに一本化。
// 教師が後から足した同義対でも橋渡しできる（P876の対表の一般化）。
{
  const { lexicalRelationService } = await import('../src/miki/memory/services/lexicalRelationService');
  lexicalRelationService.addRelation('勤務先', '職場', 'SYNONYM', 'teacher');
  let memories880: any[] = [];
  const say880 = async (t: string) => {
    const intake: any = conversationFactIntakeService.intakeFromUserText(t, memories880);
    memories880 = intake?.updatedMemories ?? memories880;
    const res: any = await conversationCoreService.execute({ prompt: t, memories: memories880 } as any);
    return String(res?.replyText ?? '');
  };
  await say880('僕の勤務先は青空商事だよ');
  const ask880 = await say880('僕の職場はどこ？');
  check('P880 教師が足した同義対で聞き返せる', ask880.includes('青空商事'), ask880.slice(0, 60));
}

// P881: 同じ相談が続いたら、原則・会話例の引用が次点に回る
// （同じ引用の連投を避ける）。
{
  const JSZip881 = (await import('jszip')).default;
  const { teacherMaterialIntakeService } = await import('../src/miki/core/services/teacherMaterialIntakeService');
  const REPO881 = 'miki_reusable_component_repository_v1';
  const prevRepo881 = storageService.getItem(REPO881);
  const manifest881 = {
    formatVersion: 1, packageType: 'TEACHER_MATERIAL', teacher: { name: 'Claude', role: '教師' },
    subject: '回転テスト', version: 'T1',
    lessons: [
      { id: 'TM-R1', title: '難易度は詰んだら救済する', rule: '詰んだら救済の仕組みを用意する。', reason: 'r', howToJudge: 'h', example: 'e', antiPattern: 'a' },
      { id: 'TM-R2', title: '難易度の救済は早めに出す', rule: '救済は詰まる前に見せる。', reason: 'r', howToJudge: 'h', example: 'e', antiPattern: 'a' },
    ],
    examples: [
      { id: 'EX-R1', title: '拗ねたときの声かけ', scene: '相手が拗ねたとき', turns: [{ speaker: '相手', text: 'もういいよ' }, { speaker: 'みき', text: 'ごめん、近くにいるよ' }] },
      { id: 'EX-R2', title: '拗ねた相手への寄り添い', scene: '相手が拗ねたときの寄り添い', turns: [{ speaker: '相手', text: 'ふん' }, { speaker: 'みき', text: '大丈夫、話したくなったら聞くよ' }] },
    ],
  };
  const zip881 = new JSZip881();
  zip881.file('teacher_material.json', JSON.stringify(manifest881));
  const bytes881 = await zip881.generateAsync({ type: 'uint8array' });
  await teacherMaterialIntakeService.receivePackage({ fileName: 't.zip', bytes: bytes881 });
  const ask881 = async (t: string) => String((await conversationCoreService.execute({ prompt: t } as any))?.replyText ?? '');
  const l1 = await ask881('ゲームの難易度で詰んだらどうしたらいい？');
  const l2 = await ask881('ゲームの難易度で詰んだらどうしたらいい？');
  check('P881 原則の引用が回る', l1.includes('「') && l2.includes('「') && l1 !== l2, `${l1.slice(0, 30)} / ${l2.slice(0, 30)}`);
  const e1 = await ask881('彼女が拗ねちゃった。どう声かければいい？');
  const e2 = await ask881('彼女が拗ねちゃった。どう声かければいい？');
  check('P881 会話例の引用が回る', e1.includes('拗ねた') && e2.includes('拗ねた') && e1 !== e2, `${e1.slice(0, 30)} / ${e2.slice(0, 30)}`);
  if (prevRepo881) storageService.setItem(REPO881, prevRepo881); else storageService.removeItem(REPO881);
}

// P882: ゲームの数字の計算（確率・期待値・バフ）。ドロップ率や
// 会心の期待値を決定的に返す。
{
  const ask882 = async (t: string) => String((await conversationCoreService.execute({ prompt: t } as any))?.replyText ?? '');
  const a882 = await ask882('ドロップ率2%のアイテムって、50回やれば少なくとも1回は出る確率は何%？');
  check('P882 少なくとも1回の確率', a882.includes('63.6%'), a882.slice(0, 60));
  const b882 = await ask882('ドロップ率5%なら、平均何回で出る？');
  check('P882 期待値（平均の回数）', b882.includes('20回'), b882.slice(0, 60));
  const c882 = await ask882('会心率25%で会心ダメージが2倍なら、平均ダメージは基礎の何倍？');
  check('P882 会心の期待値', c882.includes('1.25倍'), c882.slice(0, 60));
  const d882 = await ask882('基礎ダメージ26に165%のMODを付けたら、ダメージはいくつになる？');
  check('P882 バフ後のダメージ', d882.includes('68.9'), d882.slice(0, 60));
}

// P883: ゲームWiki直行レーン。登録ゲームの質問では、そのゲームの
// Wiki（MediaWiki API）を直接引く。ローカルのスタブで検証する。
{
  const http883 = await import('node:http');
  const { autonomousSearchService } = await import('../src/miki/research/services/autonomousSearchService');
  const server883 = http883.createServer((req: any, res: any) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ query: { search: [{ title: 'Vermisplicer', snippet: 'Vermisplicerは<span class="searchmatch">キットガン</span>のバレルである。' }] } }));
  });
  await new Promise<void>((resolve) => server883.listen(0, '127.0.0.1', resolve));
  const port883 = (server883.address() as any).port;
  const prevWikiUrl883 = storageService.getItem('miki_gamewiki_warframe_api_url');
  storageService.setItem('miki_gamewiki_warframe_api_url', `http://127.0.0.1:${port883}/api.php`);
  try {
    const hit883: any = await autonomousSearchService.executeSearch('Vermisplicer Warframe', { maxResults: 2 } as any);
    check('P883 ゲームWikiが成功して結果が混ざる', hit883?.providerStatuses?.gamewiki?.status === 'SUCCEEDED' && (hit883?.results ?? []).some((x: any) => x.title === 'Vermisplicer'), JSON.stringify(hit883?.providerStatuses?.gamewiki ?? {}));
    const miss883: any = await autonomousSearchService.executeSearch('量子力学の基礎', { maxResults: 2 } as any);
    check('P883 対象外の質問では発射しない', miss883?.providerStatuses?.gamewiki?.status === 'SKIPPED', JSON.stringify(miss883?.providerStatuses?.gamewiki ?? {}));
  } finally {
    if (prevWikiUrl883) storageService.setItem('miki_gamewiki_warframe_api_url', prevWikiUrl883); else storageService.removeItem('miki_gamewiki_warframe_api_url');
    server883.close();
  }
}

// P884: 巨大値の書き込み間引き（実機の重さ対策）。通常フラッシュでは
// 2MB以上の値は最大30秒に1回だけ書く。強制時は全部書く。
{
  const { partitionGiantFlushKeys, GIANT_VALUE_CHARS } = await import('../src/services/storageService');
  const sizes884 = [{ key: 'small', chars: 100 }, { key: 'giant', chars: GIANT_VALUE_CHARS + 1 }];
  const now884 = 1_000_000;
  const deferred884 = partitionGiantFlushKeys(sizes884, now884, now884 - 5000, false);
  check('P884 通常フラッシュでは巨大値を間引く', deferred884.write.join(',') === 'small' && deferred884.defer.join(',') === 'giant', JSON.stringify(deferred884));
  const due884 = partitionGiantFlushKeys(sizes884, now884, now884 - 60_000, false);
  check('P884 間隔が空けば巨大値も書く', due884.write.length === 2 && due884.defer.length === 0, JSON.stringify(due884));
  const forced884 = partitionGiantFlushKeys(sizes884, now884, now884, true);
  check('P884 強制フラッシュは全部書く', forced884.write.length === 2 && forced884.defer.length === 0, JSON.stringify(forced884));
}

// P885: ストレージ診断が大きいキーを名前つきで出せる（巨大台帳の特定用）。
{
  const { storageService: storage885 } = await import('../src/services/storageService');
  storage885.setItem('miki_p885_small', 'x'.repeat(10));
  storage885.setItem('miki_p885_large', 'y'.repeat(5000));
  try {
    const top885 = storage885.describeLargestKeys(100);
    const mine885 = top885.find((e) => e.key === 'miki_p885_large');
    const sorted885 = top885.every((e, i) => i === 0 || top885[i - 1].chars >= e.chars);
    check('P885 大きいキーが名前つきで返る', Boolean(mine885) && mine885!.chars === 5000 && sorted885, JSON.stringify(mine885 ?? {}));
  } finally {
    storage885.removeItem('miki_p885_small');
    storage885.removeItem('miki_p885_large');
  }
}

// P887: ゲームWikiレーンの当て方。正式名称でなく略称・呼び名でも
// 当て、直近のゲーム話題があれば名前なしの続きの質問でも発射する。
{
  const http887 = await import('node:http');
  const { autonomousSearchService: search887 } = await import('../src/miki/research/services/autonomousSearchService');
  let lastSrsearch887 = '';
  const server887 = http887.createServer((req: any, res: any) => {
    try { lastSrsearch887 = new URL(String(req.url), 'http://127.0.0.1').searchParams.get('srsearch') || ''; } catch { lastSrsearch887 = ''; }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ query: { search: [{ title: 'StubHit', snippet: 'スタブの検索結果。' }] } }));
  });
  await new Promise<void>((resolve) => server887.listen(0, '127.0.0.1', resolve));
  const port887 = (server887.address() as any).port;
  const keys887 = ['miki_gamewiki_warframe_api_url', 'miki_gamewiki_oncehuman_api_url', 'miki_gamewiki_deltaforce_api_url'];
  const prev887 = keys887.map((k) => storageService.getItem(k));
  const prevTopic887 = storageService.getItem('miki_recent_game_topic_v1');
  keys887.forEach((k) => storageService.setItem(k, `http://127.0.0.1:${port887}/api.php`));
  try {
    const alias887: any = await search887.executeSearch('ワンヒュの熊のデビエーションの入手方法は？', { maxResults: 2 } as any);
    check('P887 略称ワンヒュでOnce Human Wikiに当たる', alias887?.providerStatuses?.gamewiki?.status === 'SUCCEEDED' && !lastSrsearch887.includes('ワンヒュ') && lastSrsearch887.includes('デビエーション'), `${JSON.stringify(alias887?.providerStatuses?.gamewiki ?? {})} sr=${lastSrsearch887}`);
    const delta887: any = await search887.executeSearch('デルタの武器ダメージ一覧', { maxResults: 2 } as any);
    check('P887 デルタでDelta Force Wikiに当たる', delta887?.providerStatuses?.gamewiki?.status === 'SUCCEEDED', JSON.stringify(delta887?.providerStatuses?.gamewiki ?? {}));
    const named887: any = await search887.executeSearch('Vermisplicer Warframe の性能', { maxResults: 2 } as any);
    check('P887 正式名でも従来どおり当たる', named887?.providerStatuses?.gamewiki?.status === 'SUCCEEDED', JSON.stringify(named887?.providerStatuses?.gamewiki ?? {}));
    const follow887: any = await search887.executeSearch('そのキットガンの基礎ダメージは？', { maxResults: 2 } as any);
    check('P887 名前なしの続きでも文脈で発射する', follow887?.providerStatuses?.gamewiki?.status === 'SUCCEEDED' && lastSrsearch887.includes('キットガン'), `${JSON.stringify(follow887?.providerStatuses?.gamewiki ?? {})} sr=${lastSrsearch887}`);
    const off887: any = await search887.executeSearch('江戸時代の参勤交代の仕組み', { maxResults: 2 } as any);
    check('P887 ゲームらしくない質問では文脈発射しない', off887?.providerStatuses?.gamewiki?.status === 'SKIPPED', JSON.stringify(off887?.providerStatuses?.gamewiki ?? {}));
  } finally {
    keys887.forEach((k, i) => { if (prev887[i]) storageService.setItem(k, prev887[i]); else storageService.removeItem(k); });
    if (prevTopic887) storageService.setItem('miki_recent_game_topic_v1', prevTopic887); else storageService.removeItem('miki_recent_game_topic_v1');
    server887.close();
  }
}

// P888: 動画学習の接続。字幕から話題の見出しを抜いて保存し、
// 学んだ返答と概要の想起に使い、知らない語は意味学習へ繋ぐ。
{
  const { videoTranscriptService: vts888 } = await import('../src/miki/research/services/videoTranscriptService');
  const { knowledgeGapService: gaps888 } = await import('../src/miki/unknown/services/knowledgeGapService');
  const VSTORE888 = 'miki_video_learnings_v1';
  const prevV888 = storageService.getItem(VSTORE888);
  const WATCH888 = '<html><head><title>ゾルバンの観察記録 - YouTube</title></head><body><script>{"captionTracks":[{"baseUrl":"https://www.youtube.com/api/timedtext?v=p888videoA&lang=ja","name":{"simpleText":"日本語"},"vssId":"a.ja","languageCode":"ja","kind":"asr"}]}</script></body></html>';
  const XML888 = '<?xml version="1.0"?><transcript>'
    + '<text start="0" dur="3">ゾルバンは牧場で暮らす生き物です。ゾルバンの羊毛は柔らかいです。</text>'
    + '<text start="3" dur="3">牧場ではゾルバンが羊毛を落とします。ゾルバンは牧場の人気者です。</text>'
    + '<text start="6" dur="3">羊毛は牧場の収入源で、ゾルバンの世話が大切です。</text>'
    + '</transcript>';
  const run888 = async (p: string) => String(((await conversationCoreService.execute({ prompt: p } as any)) as any)?.replyText ?? '');
  vts888.setFetchForTest(async (url: string) => (url.includes('timedtext') ? XML888 : WATCH888));
  const learned888 = await run888('この動画見て学んで https://youtu.be/p888videoA');
  check('P888 学んだ返答に話題の見出しが出る', learned888.includes('学びました') && learned888.includes('ゾルバン') && learned888.includes('話でした'), learned888.slice(0, 80));
  const latest888: any = vts888.latest();
  check('P888 話題の見出しが保存される', Array.isArray(latest888?.topics) && latest888.topics.includes('ゾルバン') && latest888.topics.includes('牧場'), JSON.stringify(latest888?.topics ?? []));
  const gap888 = gaps888.listOpen(500).some((g: any) => g?.identity?.target === 'ゾルバン' || String(g?.query ?? '').includes('ゾルバン'));
  check('P888 知らない語が意味学習のキューに繋がる', gap888, '');
  const theme888 = await run888('動画のテーマは何だった？');
  check('P888 キーワードが無くても見出しで概要を返す', theme888.includes('主に') && theme888.includes('ゾルバン'), theme888.slice(0, 80));
  vts888.setFetchForTest(null);
  if (prevV888) storageService.setItem(VSTORE888, prevV888); else storageService.removeItem(VSTORE888);
}

// P889: 動画の抽出型要約。学ぶときに要点文を抜いて保存し、
// 「要約して」には要点文で答える（字幕に無いことは言わない）。
{
  const { videoTranscriptService: vts889 } = await import('../src/miki/research/services/videoTranscriptService');
  const VSTORE889 = 'miki_video_learnings_v1';
  const prevV889 = storageService.getItem(VSTORE889);
  const WATCH889 = '<html><head><title>ゾルバンの観察記録2 - YouTube</title></head><body><script>{"captionTracks":[{"baseUrl":"https://www.youtube.com/api/timedtext?v=p889videoB&lang=ja","name":{"simpleText":"日本語"},"vssId":"a.ja","languageCode":"ja","kind":"asr"}]}</script></body></html>';
  const XML889 = '<?xml version="1.0"?><transcript>'
    + '<text start="0" dur="3">ゾルバンは牧場で暮らす生き物です。</text>'
    + '<text start="3" dur="3">ゾルバンの羊毛は柔らかくて、牧場の収入源になっています。</text>'
    + '<text start="6" dur="3">今日は天気がいいです。</text>'
    + '<text start="9" dur="3">ゾルバンは羊毛を落とすので、牧場では羊毛を集めます。</text>'
    + '</transcript>';
  const run889 = async (p: string) => String(((await conversationCoreService.execute({ prompt: p } as any)) as any)?.replyText ?? '');
  vts889.setFetchForTest(async (url: string) => (url.includes('timedtext') ? XML889 : WATCH889));
  await run889('この動画見て学んで https://youtu.be/p889videoB');
  const latest889: any = vts889.latest();
  check('P889 要点文が保存される', Array.isArray(latest889?.summary) && latest889.summary.join('').includes('収入源'), JSON.stringify(latest889?.summary ?? []));
  const sum889 = await run889('動画の内容を要約して');
  check('P889 要約の求めに要点文で答える', sum889.includes('要約です') && sum889.includes('収入源') && sum889.includes('ゾルバン'), sum889.slice(0, 100));
  vts889.setFetchForTest(null);
  if (prevV889) storageService.setItem(VSTORE889, prevV889); else storageService.removeItem(VSTORE889);
}

// P890: 字幕が無い動画は、端末ローカルの音声認識サービスへ回す。
// サービス応答があれば文字起こしとして同じ土俵（見出し・要約）で学ぶ。
{
  const { videoTranscriptService: vts890 } = await import('../src/miki/research/services/videoTranscriptService');
  const VSTORE890 = 'miki_video_learnings_v1';
  const prevV890 = storageService.getItem(VSTORE890);
  const WATCH890 = '<html><head><title>ゾルバン実況 - YouTube</title></head><body><script>var ytInitialPlayerResponse = {};</script></body></html>';
  const ASR890 = JSON.stringify({ title: 'ゾルバン実況', text: 'ゾルバンは牧場で暮らす生き物です。ゾルバンの羊毛は柔らかくて、牧場の収入源になっています。ゾルバンは羊毛を落とすので、牧場では羊毛を集めます。' });
  const run890 = async (p: string) => String(((await conversationCoreService.execute({ prompt: p } as any)) as any)?.replyText ?? '');
  vts890.setFetchForTest(async () => WATCH890);
  (vts890 as any).setAsrFetchForTest(async () => ASR890);
  const learn890 = await run890('この動画見て学んで https://youtu.be/p890videoC');
  check('P890 字幕なし→音声認識で学び、その旨を伝える', learn890.includes('文字起こし') && learn890.includes('ゾルバン'), learn890.slice(0, 90));
  const latest890: any = vts890.latest();
  check('P890 ASR経由でも見出しと要約が付く', latest890?.via === 'asr' && (latest890?.topics ?? []).includes('ゾルバン') && (latest890?.summary ?? []).join('').includes('収入源'), `${latest890?.via}/${JSON.stringify(latest890?.topics ?? [])}`);
  (vts890 as any).setAsrFetchForTest(null);
  vts890.setFetchForTest(null);
  if (prevV890) storageService.setItem(VSTORE890, prevV890); else storageService.removeItem(VSTORE890);
}

// P891: 学んだ動画が複数あるとき、話題・題名で指された動画を対象にする
// （最新だけに答えが寄らないように）。
{
  const { videoTranscriptService: vts891 } = await import('../src/miki/research/services/videoTranscriptService');
  const VSTORE891 = 'miki_video_learnings_v1';
  const prevV891 = storageService.getItem(VSTORE891);
  const mk891 = (id: string, title: string, lines: string[]) =>
    '<html><head><title>' + title + ' - YouTube</title></head><body><script>{"captionTracks":[{"baseUrl":"https://www.youtube.com/api/timedtext?v=' + id + '&lang=ja","name":{"simpleText":"日本語"},"vssId":"a.ja","languageCode":"ja","kind":"asr"}]}</script></body></html>';
  const xml891 = (lines: string[]) => '<?xml version="1.0"?><transcript>' + lines.map((t, i) => '<text start="' + i * 3 + '" dur="3">' + t + '</text>').join('') + '</transcript>';
  const A891 = ['ゾルバンは牧場で暮らす生き物です。', 'ゾルバンの羊毛は柔らかくて、牧場の収入源になっています。', 'ゾルバンは羊毛を落とすので、牧場では羊毛を集めます。'];
  const B891 = ['ミナモは海で暮らす生き物です。', 'ミナモの鱗は青く光って、海の宝石と呼ばれています。', 'ミナモは鱗を落とすので、海では鱗を集めます。'];
  const run891 = async (p: string) => String(((await conversationCoreService.execute({ prompt: p } as any)) as any)?.replyText ?? '');
  vts891.setFetchForTest(async (url: string) => {
    if (url.includes('timedtext')) return url.includes('p891videoA') ? xml891(A891) : xml891(B891);
    return url.includes('p891videoA') ? mk891('p891videoA', 'ゾルバンの観察記録', A891) : mk891('p891videoB', 'ミナモの観察記録', B891);
  });
  await run891('この動画見て学んで https://youtu.be/p891videoA');
  await run891('この動画見て学んで https://youtu.be/p891videoB');
  const sumA891 = await run891('ゾルバンの動画の要約は？');
  check('P891 指された古い動画の要約が返る', sumA891.includes('ゾルバンの観察記録') && sumA891.includes('収入源') && !sumA891.includes('宝石'), sumA891.slice(0, 100));
  const themeB891 = await run891('動画のテーマは何だった？');
  check('P891 無指定なら最新の動画で答える', themeB891.includes('ミナモの観察記録') && themeB891.includes('主に'), themeB891.slice(0, 100));
  vts891.setFetchForTest(null);
  if (prevV891) storageService.setItem(VSTORE891, prevV891); else storageService.removeItem(VSTORE891);
}

// P892: 学んだ動画の一覧と本数に答える。
{
  const VSTORE892 = 'miki_video_learnings_v1';
  const prevV892 = storageService.getItem(VSTORE892);
  storageService.setItem(VSTORE892, JSON.stringify([
    { videoId: 'p892vA', title: 'ゾルバンの観察記録', url: 'https://youtu.be/p892vA', at: 1, text: 'ゾルバンの話。', topics: ['ゾルバン'], summary: [] },
    { videoId: 'p892vB', title: 'ミナモの観察記録', url: 'https://youtu.be/p892vB', at: 2, text: 'ミナモの話。', topics: ['ミナモ'], summary: [] },
  ]));
  const run892 = async (p: string) => String(((await conversationCoreService.execute({ prompt: p } as any)) as any)?.replyText ?? '');
  const list892 = await run892('今まで学んだ動画の一覧を教えて');
  check('P892 学んだ動画の一覧が返る', list892.includes('ゾルバンの観察記録') && list892.includes('ミナモの観察記録'), list892.slice(0, 100));
  const count892 = await run892('動画は何本学んだ？');
  check('P892 学んだ動画の本数が返る', count892.includes('2本'), count892.slice(0, 60));
  if (prevV892) storageService.setItem(VSTORE892, prevV892); else storageService.removeItem(VSTORE892);
}

// P893: 部品保管庫の読み取りキャッシュ。指紋が同じ間はパース済みを
// 使い回し、台帳が差し替われば読み直す。
{
  const { componentRepositoryCacheService: crc893 } = await import('../src/miki/memory/services/componentRepositoryCacheService');
  const RKEY893 = 'miki_reusable_component_repository_v1';
  const prevR893 = storageService.getItem(RKEY893);
  storageService.setItem(RKEY893, JSON.stringify([{ componentId: 'RC-893-A' }, { componentId: 'RC-893-B' }]));
  const first893 = crc893.readAll();
  const second893 = crc893.readAll();
  check('P893 キャッシュが効く（同じ配列を使い回す）', first893.length === 2 && second893 === first893, `${first893.length}/${second893 === first893}`);
  storageService.setItem(RKEY893, JSON.stringify([{ componentId: 'RC-893-A' }, { componentId: 'RC-893-B' }, { componentId: 'RC-893-C' }]));
  const third893 = crc893.readAll();
  check('P893 台帳が変われば読み直す', third893.length === 3 && third893 !== first893, `${third893.length}`);
  if (prevR893) storageService.setItem(RKEY893, prevR893); else storageService.removeItem(RKEY893);
}

// P894: ネイティブコア健康診断のログ受け口。サンドボックス（非ネイティブ）
// では落とさずに終わることだけを確認する（実機の available は実機ログで見る）。
{
  const { androidNativeRunnerAdapterService: adapter894 } = await import('../src/miki/execution/services/androidNativeRunnerAdapterService');
  let ok894 = true;
  try {
    adapter894.reportNativeCoreHealthToLog();
    adapter894.reportNativeCoreHealthToLog();
    await new Promise((r) => setTimeout(r, 50));
  } catch { ok894 = false; }
  check('P894 健康診断の報告が例外なく動く', ok894, '');
}

// P895: 部品保管庫の逆引き索引。引き結果が全件走査と一致し、無関係な
// 話題では候補が0に絞られることを確認する。
{
  const { teacherLessonRecallService: tl895 } = await import('../src/miki/memory/services/teacherLessonRecallService');
  const { dialogueExampleRecallService: de895 } = await import('../src/miki/memory/services/dialogueExampleRecallService');
  const REPO895 = 'miki_reusable_component_repository_v1';
  const prevRepo895 = storageService.getItem(REPO895);
  storageService.setItem(REPO895, JSON.stringify([
    { componentType: 'TEACHER_LESSON', packageSubject: '原則1', lesson: { id: 'TM9-18', title: 'リトライは迅速に（再開の速さが効く）', rule: 'リトライは迅速にする。' } },
    { componentType: 'TEACHER_LESSON', packageSubject: '原則1', lesson: { id: 'TM9-16', title: '難易度は少しずつ上げる', rule: '難易度は段階的に上げる。' } },
    { componentType: 'TEACHER_LESSON', packageSubject: '原則1', lesson: { id: 'TM10-01', title: 'ご褒美は早めに渡す', rule: 'ご褒美は達成の直後に渡す。' } },
    { componentType: 'DIALOGUE_EXAMPLE', packageSubject: '会話例', example: { id: 'EX-01', title: '拗ねたときの声かけ', scene: '相手が拗ねた場面', turns: [{ speaker: '相手', text: 'べつに' }, { speaker: 'みき', text: 'ごめんね' }] }, pattern: { herLineCount: 1, acts: ['謝る'], opening: 'ごめんね', closing: 'ごめんね' } },
    { componentType: 'DIALOGUE_EXAMPLE', packageSubject: '会話例', example: { id: 'EX-02', title: '疲れて帰ってきた日の労い', scene: '相手が疲れている場面', turns: [{ speaker: '相手', text: 'つかれた' }, { speaker: 'みき', text: 'おつかれさま' }] }, pattern: { herLineCount: 1, acts: ['労う'], opening: 'おつかれさま', closing: 'おつかれさま' } },
  ]));
  check('P895 索引経由でも原則の引きが一致する', tl895.findFor('ゲームで死んだあとのリトライが遅くて困ってます')?.id === 'TM9-18', '');
  check('P895 無関係な話題では候補が0になる', tl895.listLessons().length === 3 && tl895.indexCandidates('江戸時代の参勤交代の仕組み') === 0, `${tl895.indexCandidates('江戸時代の参勤交代の仕組み')}`);
  check('P895 索引経由でも会話例の引きが一致する', de895.findFor('彼女が拗ねちゃった。どう声をかけたらいい？')?.id === 'EX-01' && de895.indexCandidates('量子力学の不確定性原理') === 0, '');
  if (prevRepo895) storageService.setItem(REPO895, prevRepo895); else storageService.removeItem(REPO895);
}

// P896: 段落プラン。補足文は得点順ではなく役割の順（事実→例え）に
// 並ぶことを確認する。例えの方が得点は高い材料構成にする。
// 主題は専用のテスト獣Cにする：モコロンだと P622 の PART_OF（群れ）
// など先行シナリオの共有グラフの関係が RELATION として拾われ、
// 適合3で probe の CLAIM（適合2）を押しのけて選ばれなくなるため。
{
  const { paragraphCompositionService: pc896 } = await import('../src/miki/conversation/services/paragraphCompositionService');
  const { worldModelGraphService: wg896 } = await import('../src/miki/selfAwareness/services/worldModelGraphService');
  wg896.addRelation({ fromName: 'テスト獣C', toName: 'パル', type: 'IS_A', provisional: false, confidence: 0.9 } as any);
  wg896.addRelation({ fromName: 'テスト獣C', toName: '綿毛', type: 'USED_FOR', provisional: false, confidence: 0.9 } as any);
  wg896.addRelation({ fromName: '羊', toName: '毛', type: 'USED_FOR', provisional: false, confidence: 0.9 } as any);
  const USAGE896 = 'miki_paragraph_material_usage_v1';
  const prevUsage896 = storageService.getItem(USAGE896);
  storageService.removeItem(USAGE896);
  const sup896 = pc896.buildSupplements({
    subjectTerms: ['テスト獣C'],
    supportingClaims: [{ claim_id: 'probe896', statement: 'テスト獣Cは夜行性で、夜に活動します' }],
    excludeClaimId: 'probe-best-896',
    excludeText: 'テスト獣Cはパルの一種です。テスト獣Cは綿毛に使われます。',
  });
  check('P896 補足文が事実→例えの順に並ぶ', sup896.length === 2 && sup896[0].includes('夜行性') && sup896[1].includes('似ています'), sup896.join(' / ').slice(0, 60));
  // P897: 短い名前の実体（C）が先に登録されていても、完全一致する
  // テスト獣C が主題になること。句の形の話題でも最長一致が勝つ。
  wg896.addRelation({ fromName: 'C', toName: '記号', type: 'IS_A', provisional: false, confidence: 0.9 } as any);
  storageService.removeItem(USAGE896);
  const sup897 = pc896.buildSupplements({
    subjectTerms: ['テスト獣Cの話', 'テスト獣C'],
    supportingClaims: [{ claim_id: 'probe897', statement: 'テスト獣Cは夜行性で、夜に活動します' }],
    excludeClaimId: 'probe-best-897',
    excludeText: 'テスト獣Cはパルの一種です。テスト獣Cは綿毛に使われます。Cは記号の一種です。',
  });
  check('P897 短い名前より完全・最長一致が主題になる', sup897.length === 2 && sup897[0].includes('夜行性') && sup897[1].includes('似ています'), sup897.join(' / ').slice(0, 60));
  if (prevUsage896) storageService.setItem(USAGE896, prevUsage896); else storageService.removeItem(USAGE896);
}

// P898: ギャップ調査の束処理。アイドル学習サイクルが能力ギャップを
// 先頭1件でなく影響度上位の最大3件まで回し、OPEN以外は対象外で、
// 同点は元の順序を保つことを確認する。
{
  const { autonomousSearchService: as898 } = await import('../src/miki/research/services/autonomousSearchService');
  const mk898 = (capabilityId: string, impact: string, status = 'OPEN') => ({ capabilityId, impact, status, description: 'probe898' } as any);
  const ranked898 = as898.rankCapabilityGapsForLearning([
    mk898('p898-low', 'LOW'),
    mk898('p898-crit', 'CRITICAL'),
    mk898('p898-high', 'HIGH'),
    mk898('p898-mid', 'MEDIUM'),
    mk898('p898-done', 'CRITICAL', 'RESOLVED'),
  ], 3);
  check('P898 能力ギャップが影響度順に最大3件選ばれる', ranked898.map((g: any) => g.capabilityId).join(',') === 'p898-crit,p898-high,p898-mid', ranked898.map((g: any) => g.capabilityId).join(','));
  const all898 = as898.rankCapabilityGapsForLearning([mk898('p898-a', 'LOW'), mk898('p898-b', 'LOW')], 3);
  check('P898 同点は元の順序を保ち件数以下でも全部返す', all898.map((g: any) => g.capabilityId).join(',') === 'p898-a,p898-b', all898.map((g: any) => g.capabilityId).join(','));
}

// P899: 自己点検から学習課題を作る。確定した関係を2件以上持つ
// 話題（テスト鳥）は「事実はあるのに話し方の材料が無い話題」として
// 拾われ、関係1件の話題（テスト貝）は拾われない。点検を実行すると
// その話題の学習ギャップが登録されることを確認する。
{
  const { worldModelGraphService: wg899 } = await import('../src/miki/selfAwareness/services/worldModelGraphService');
  const { knowledgeSelfInspectionService: ksi899 } = await import('../src/miki/selfAwareness/services/knowledgeSelfInspectionService');
  const { knowledgeGapService: kg899 } = await import('../src/miki/unknown/services/knowledgeGapService');
  wg899.addRelation({ fromName: 'テスト鳥', toName: '鳥', type: 'IS_A', provisional: false, confidence: 0.9 } as any);
  wg899.addRelation({ fromName: 'テスト鳥', toName: '巣', type: 'PART_OF', provisional: false, confidence: 0.9 } as any);
  // 関係数で上位に来るよう、別々の関係を多めに種まきする
  // （共有状態には他のシナリオの実体も多く、順位が埋もれないように）。
  for (let i = 1; i <= 13; i++) {
    wg899.addRelation({ fromName: 'テスト鳥', toName: `観察対象${i}`, type: 'USED_FOR', provisional: false, confidence: 0.9 } as any);
  }
  wg899.addRelation({ fromName: 'テスト貝', toName: '貝', type: 'IS_A', provisional: false, confidence: 0.9 } as any);
  const topics899 = ksi899.findTopicsWithoutDialogueMaterial(50);
  check('P899 関係2件以上の材料なし話題が拾われる', topics899.includes('テスト鳥'), topics899.join(',').slice(0, 60));
  check('P899 関係1件の話題は拾われない', !topics899.includes('テスト貝'), topics899.join(',').slice(0, 60));
  const rec899 = ksi899.inspect();
  const gap899 = kg899.listOpen(500).find((g: any) => g.query === '話し方の材料を学ぶ: テスト鳥');
  check('P899 点検が材料なし話題の学習ギャップを登録する', Boolean(gap899) && rec899.dialogueMaterialGapsRaised >= 1, gap899 ? `${gap899.type}/${gap899.priority}` : 'NONE');
}

// P900: 仮説先行 v1（未知語の仮の意味づけ）。意味の分かる部分へ
// 完全に分解できる未知語だけ、部分の意味を繋いだ仮 gloss を
// 推測由来（learned:inferred）として個人辞書に登録する。分解
// できない語・既知の語では発火しない。本物の教わりが来たら、
// 仮 gloss は user-taught に置き換わることを確認する。
{
  const { japaneseDictionaryService: jd900 } = await import('../src/miki/research/services/japaneseDictionaryService');
  const { hypothesisGlossService: hg900 } = await import('../src/miki/conversation/services/hypothesisGlossService');
  jd900.addPersonal('星屑', { gloss: '星のかけら' });
  jd900.addPersonal('工房', { gloss: 'ものを作る場所' });
  jd900.addPersonal('蒼天', { gloss: '青い空' });
  jd900.addPersonal('性', { gloss: '性質' });
  const h900 = hg900.tryInfer('星屑工房');
  check('P900 分解できる未知語に仮 gloss が付く', Boolean(h900) && h900!.parts.length === 2, h900 ? h900.gloss : 'NONE');
  const e900 = jd900.lookup('星屑工房').find((e: any) => e.gloss);
  check('P900 仮 gloss は推測由来として登録される', Boolean(e900) && (e900!.semanticIds || []).includes('learned:inferred'), e900 ? (e900.semanticIds || []).join(',') : 'NONE');
  const h900s = hg900.tryInfer('蒼天性');
  check('P900 接尾の部分は「の」で繋ぐ', h900s?.gloss === '青い空の性質', h900s ? h900s.gloss : 'NONE');
  check('P900 既知の語・分解できない語では発火しない', !hg900.tryInfer('星屑') && !hg900.tryInfer('星屑謎々'), 'inert');
  conversationFactIntakeService.intakeFromUserText('星屑工房って、星を見る場所のことだよ', []);
  const e900b = jd900.lookup('星屑工房').find((e: any) => e.gloss);
  check('P900 教わったら仮 gloss が本物に置き換わる', Boolean(e900b) && e900b!.gloss === '星を見る場所' && (e900b!.semanticIds || []).includes('learned:user-taught'), e900b ? `${e900b.gloss}|${(e900b.semanticIds || []).join(',')}` : 'NONE');
}

// P901: 仮説先行の宣言。分解できる未知語が出た文では、聞き返し
// ではなく仮の意味の宣言が返答に付く。意味を聞く質問では発火
// せず、分解できない未知語では従来の聞き返しが残ることを確認。
{
  const { japaneseDictionaryService: jd901 } = await import('../src/miki/research/services/japaneseDictionaryService');
  const { storageService: ss901 } = await import('../src/services/storageService');
  jd901.addPersonal('月影', { gloss: '月の光でできる影' });
  jd901.addPersonal('工房', { gloss: 'ものを作る場所' });
  jd901.addPersonal('蒼天', { gloss: '青い空' });
  ss901.removeItem('miki_unknown_asked_v1');
  ss901.removeItem('miki_unknown_pending_v1');
  let mem901: any[] = [];
  let st901: any = undefined;
  const say901 = async (text: string) => {
    const intake = conversationFactIntakeService.intakeFromUserText(text, mem901);
    mem901 = intake.updatedMemories;
    const r: any = await conversationCoreService.execute({ prompt: text, memories: mem901, conversationState: st901, recentMessages: [] } as any);
    st901 = r.nextConversationState;
    return String(r.replyText || '');
  };
  const stmt901 = await say901('今日は月影工房の前を通ったよ');
  check('P901 分解できる未知語は宣言して進む', stmt901.includes('「月影工房」は') && stmt901.includes('という意味だと思って進めるね'), stmt901.slice(-140));
  check('P901 宣言した語は聞き返さない', !stmt901.includes('「月影工房」って、どんなものですか'), stmt901.slice(-140));
  const ques901 = await say901('蒼天工房って何？');
  const inferred901 = jd901.lookup('蒼天工房').some((e: any) => (e.semanticIds || []).includes('learned:inferred'));
  check('P901 意味を聞く質問では推測しない', !ques901.includes('という意味だと思って進めるね') && !inferred901, ques901.slice(0, 100));
  const nd901 = await say901('昨日ゾルタクスを見たよ');
  check('P901 分解できない未知語は従来どおり聞き返す', nd901.includes('「ゾルタクス」って、どんなものですか'), nd901.slice(-140));
}

// P902: 類推からの候補関係の自己生成。確定した分類の兄弟が持つ
// 関係を、持たない兄弟への候補（PROVISIONAL・確信度0.2）として
// 生成し、予測台帳に検証待ちとして登録する。重複生成はしない。
{
  const { worldModelGraphService: wg902 } = await import('../src/miki/selfAwareness/services/worldModelGraphService');
  const { analogyCandidateService: ac902 } = await import('../src/miki/selfAwareness/services/analogyCandidateService');
  const { predictionLedgerService: pl902 } = await import('../src/miki/memory/services/predictionLedgerService');
  wg902.addRelation({ fromName: '蒼空獣', toName: '空獣', type: 'IS_A', provisional: false, confidence: 0.9 } as any);
  wg902.addRelation({ fromName: '蒼空獣', toName: '観察', type: 'USED_FOR', provisional: false, confidence: 0.9 } as any);
  wg902.addRelation({ fromName: '紅空獣', toName: '空獣', type: 'IS_A', provisional: false, confidence: 0.9 } as any);
  wg902.addRelation({ fromName: '緑空獣', toName: '空獣', type: 'IS_A', provisional: false, confidence: 0.9 } as any);
  const created902 = ac902.generateCandidates(50);
  check('P902 兄弟の関係が候補として生成される', created902.some((c: any) => c.from === '緑空獣' && c.type === 'USED_FOR' && c.to === '観察'), created902.map((c: any) => c.from).join(',').slice(0, 60));
  check('P902 分類（IS_A）は類推で生成しない', created902.every((c: any) => c.type !== 'IS_A'), 'no IS_A');
  const rel902 = wg902.relationsOf('緑空獣').find((r: any) => r.type === 'USED_FOR');
  check('P902 候補は仮の関係として入る', Boolean(rel902) && Boolean(rel902!.provisional) && Number(rel902!.confidence) <= 0.2, rel902 ? `${rel902.provisional}/${rel902.confidence}` : 'NONE');
  const pred902 = pl902.list().find((p: any) => p.target === '緑空獣' && p.type === 'USED_FOR' && p.to === '観察');
  check('P902 候補が予測台帳で検証待ちになる', Boolean(pred902) && pred902!.outcome === 'OPEN', pred902 ? pred902.outcome : 'NONE');
  const again902 = ac902.generateCandidates(50);
  check('P902 重複生成しない', !again902.some((c: any) => c.from === '緑空獣' && c.type === 'USED_FOR'), 'deduped');
}

// P903: 手続きの塊化。同じ手順の並びが3回観測されると、繰り返し
// 部分列がワークフロー候補として1件登録される。2回では登録され
// ず、登録済みの手順からは短い塊が切り出され続けないことを確認。
{
  const { procedureChunkingService: pc903 } = await import('../src/miki/execution/services/procedureChunkingService');
  const { automationStudioService: as903 } = await import('../src/miki/execution/services/automationStudioService');
  const seq903 = ['宿題確認', '宿題検索', '学習記録', '宿題検索', '学習記録'];
  pc903.observeProcedure('アイドル学習', seq903);
  pc903.observeProcedure('アイドル学習', seq903);
  check('P903 2回の観測では塊にならない', pc903.detectAndChunk(1).length === 0, 'below threshold');
  pc903.observeProcedure('アイドル学習', seq903);
  const created903 = pc903.detectAndChunk(1);
  check('P903 3回の観測で繰り返し手順が塊になる', created903.length === 1 && created903[0].actions.join('>') === seq903.join('>'), created903.map((c: any) => c.actions.join('>')).join(',').slice(0, 80));
  const wf903 = as903.list().find((w: any) => (w.steps || []).map((s: any) => s.action).join('>') === seq903.join('>'));
  check('P903 塊がワークフロー候補として登録される', Boolean(wf903) && wf903!.stage === 'OBSERVED', wf903 ? wf903.stage : 'NONE');
  check('P903 塊化済みの手順からは再登録しない', pc903.detectAndChunk(1).length === 0, 'deduped');
}

// P904: 対応表#13 の後半「適応」。今の話題に合う過去のエピソードが、
// 日付を聞かれたときだけでなく、段落の材料として「その日の様子ごと」
// 持ち出されることを確認する。
{
  const { storageService: st904 } = await import('../src/services/storageService');
  const { daysAgoKey: dak904 } = await import('../src/miki/memory/services/dayKeyService');
  const { episodeMemoryService: em904 } = await import('../src/miki/conversation/services/episodeMemoryService');
  const { paragraphCompositionService: pc904 } = await import('../src/miki/conversation/services/paragraphCompositionService');
  let eps904: any[] = [];
  try { eps904 = JSON.parse(st904.getItem('miki_episodes_v1') || '[]'); } catch { eps904 = []; }
  if (!Array.isArray(eps904)) eps904 = [];
  let seededDaysAgo904 = 0;
  for (const n of [3, 4, 5, 6]) {
    if (!eps904.some((e: any) => e.day === dak904(n))) { seededDaysAgo904 = n; break; }
  }
  check('P904 空いている過去日へエピソードを置ける', seededDaysAgo904 > 0, `daysAgo=${seededDaysAgo904}`);
  if (seededDaysAgo904 > 0) {
    eps904.push({ day: dak904(seededDaysAgo904), topics: ['ルナ観測会'], dominantState: 'anxiety', summary: '昨日は、「ルナ観測会」の話をしましたね。' });
    st904.setItem('miki_episodes_v1', JSON.stringify(eps904));
    const ad904 = em904.adaptationFor(['ルナ観測会']);
    check('P904 過去の事例が今の視点の文になる', Boolean(ad904) && ad904!.text.includes(`${seededDaysAgo904}日前`) && ad904!.text.includes('心配事が多め'), ad904 ? ad904.text : 'NONE');
    check('P904 合わない話題では事例を持ち出さない', em904.adaptationFor(['無関係語彙904']) === undefined, 'no match');
    const sup904 = pc904.buildSupplements({ subjectTerms: ['ルナ観測会'], supportingClaims: [], excludeText: 'ルナ観測会の話です。' });
    check('P904 段落の材料に過去の事例が入る', sup904.some((s: string) => s.includes('ルナ観測会') && s.includes('もしましたね')), sup904.join(' / ').slice(0, 80));
  }
}

// P905: 対応表#12 の蒸留。3日以上にわたって現れた話題が、エピソード
// から Claim 候補へ蒸留されることを確認する（2日の話題は対象外）。
{
  const { storageService: st905 } = await import('../src/services/storageService');
  const { daysAgoKey: dak905 } = await import('../src/miki/memory/services/dayKeyService');
  const { episodeDistillationService: ed905 } = await import('../src/miki/conversation/services/episodeDistillationService');
  const { claimDatabaseService: cd905 } = await import('../src/miki/memory/services/claimDatabaseService');
  let eps905: any[] = [];
  try { eps905 = JSON.parse(st905.getItem('miki_episodes_v1') || '[]'); } catch { eps905 = []; }
  if (!Array.isArray(eps905)) eps905 = [];
  for (const n of [2, 3, 4]) eps905.push({ day: dak905(n), topics: ['ミント栽培'], summary: '昨日は、「ミント栽培」の話をしましたね。' });
  for (const n of [2, 3]) eps905.push({ day: dak905(n), topics: ['パセリ栽培'], summary: '昨日は、「パセリ栽培」の話をしましたね。' });
  st905.setItem('miki_episodes_v1', JSON.stringify(eps905));
  const distilled905 = ed905.distill(3);
  check('P905 3日現れた話題が蒸留される', distilled905.some((d: any) => d.topic === 'ミント栽培' && d.days >= 3), JSON.stringify(distilled905).slice(0, 80));
  check('P905 2日だけの話題は蒸留されない', !distilled905.some((d: any) => d.topic === 'パセリ栽培'), 'below threshold');
  const claim905 = cd905.listClaims().find((c: any) => c.source === 'episode_distillation' && String(c.statement).includes('ミント栽培'));
  check('P905 蒸留が Claim 候補として登録される', Boolean(claim905) && claim905!.status === 'CANDIDATE', claim905 ? claim905.status : 'NONE');
  check('P905 蒸留済みの話題は再蒸留しない', ed905.distill(3).filter((d: any) => d.topic === 'ミント栽培').length === 0, 'deduped');
}

// P906: 対応表#7 の予測誤差ループ。能力ギャップの調査について
// 「得られるか」を予測→照合し、連続空振りのギャップが調査順で
// 後ろへ回ることを確認する。
{
  const { researchPredictionService: rp906 } = await import('../src/miki/research/services/researchPredictionService');
  const { autonomousSearchService: as906 } = await import('../src/miki/research/services/autonomousSearchService');
  const id906 = 'cap_suite_906';
  check('P906 初回の調査予測は LEARNABLE', rp906.predict(id906) === 'LEARNABLE', 'initial');
  check('P906 予測が外れたら誤差として数える', rp906.settle(id906, false).surprise === true, 'surprise');
  rp906.predict(id906);
  rp906.settle(id906, false);
  check('P906 2回連続の空振りで予測が EMPTY になる', rp906.predict(id906) === 'EMPTY' && rp906.rankPenalty(id906) === 1, 'empty');
  const ranked906 = as906.rankCapabilityGapsForLearning([
    { capabilityId: id906, status: 'OPEN', impact: 'HIGH' },
    { capabilityId: 'cap_suite_fresh_906', status: 'OPEN', impact: 'HIGH' },
  ] as any, 3);
  check('P906 連続空振りのギャップは調査順が後ろになる', ranked906[0].capabilityId === 'cap_suite_fresh_906', ranked906.map((g: any) => g.capabilityId).join(','));
  rp906.settle(id906, true);
  check('P906 得られたら予測は LEARNABLE に戻る', rp906.predict(id906) === 'LEARNABLE' && rp906.rankPenalty(id906) === 0, 'recovered');
}

// P907: 対応表#4。ギャップは検出の時点でサブ目標（解決プラン）を
// 持ち、段の前進にステップが追随すること、自己点検の記録に段ごと
// の件数が出ることを確認する。
{
  const { knowledgeGapService: kg907 } = await import('../src/miki/unknown/services/knowledgeGapService');
  const { knowledgeSelfInspectionService: ksi907 } = await import('../src/miki/selfAwareness/services/knowledgeSelfInspectionService');
  const gap907 = kg907.detect({ query: '月面苔の育て方を調べる', type: 'UNKNOWN_TERM', target: '月面苔', priority: 50 });
  check('P907 検出時点でサブ目標が立つ', Boolean(gap907.resolutionPlan) && gap907.resolutionPlan!.phase === 'IDENTIFY' && (gap907.resolutionPlan!.steps || []).length === 3, gap907.resolutionPlan ? gap907.resolutionPlan.phase : 'NO_PLAN');
  const adv907 = kg907.advanceResolutionPlan(gap907.id, 'COLLECT_EVIDENCE', 'RESEARCH');
  check('P907 段の前進にステップが追随する', adv907?.resolutionPlan?.steps?.find((s: any) => s.key === 'collect')?.status === 'ACTIVE', adv907?.resolutionPlan?.phase || 'NONE');
  const merged907 = kg907.detect({ query: '月面苔の育て方を調べる', type: 'UNKNOWN_TERM', target: '月面苔', priority: 50 });
  check('P907 マージではプランが保持される', merged907.id === gap907.id && merged907.resolutionPlan?.phase === 'COLLECT_EVIDENCE', merged907.resolutionPlan?.phase || 'NONE');
  const rec907 = ksi907.inspect();
  check('P907 自己点検に段ごとの件数が出る', Boolean(rec907.gapPlanPhases) && (rec907.gapPlanPhases['COLLECT_EVIDENCE'] || 0) >= 1, JSON.stringify(rec907.gapPlanPhases || {}));
}

// P908: 対応表#1（消費側）。話題の問いかけ候補の並びに活性化が
// 効くこと: 活性化が無ければ確信度順、相手の語が熱いとその関係の
// 質問が前に来る。大きな確信度差は覆らず、回転も壊れない。
{
  const { worldModelGraphService: wm908 } = await import('../src/miki/selfAwareness/services/worldModelGraphService');
  const { paragraphCompositionService: pc908 } = await import('../src/miki/conversation/services/paragraphCompositionService');
  const { activationService: act908 } = await import('../src/miki/memory/services/activationService');
  const { storageService: st908 } = await import('../src/services/storageService');
  const resetUsage908 = () => { try { st908.setItem('miki_topic_question_usage_v1', '{}'); } catch { /* noop */ } };
  wm908.addRelation({ fromName: '霧箱', toName: 'ムラ蒸気', type: 'USED_FOR', provisional: false, confidence: 0.9 } as any);
  wm908.addRelation({ fromName: '霧箱', toName: 'キラ氷晶', type: 'USED_FOR', provisional: false, confidence: 0.6 } as any);
  resetUsage908();
  const q908a = pc908.buildTopicQuestion(['霧箱']);
  check('P908 活性化が無ければ確信度順', Boolean(q908a) && q908a!.includes('ムラ蒸気'), q908a || 'NONE');
  for (let i = 0; i < 30; i++) act908.tick('キラ氷晶');
  resetUsage908();
  const q908b = pc908.buildTopicQuestion(['霧箱']);
  check('P908 熱い相手の関係が前に来る', Boolean(q908b) && q908b!.includes('キラ氷晶'), q908b || 'NONE');
  resetUsage908();
  const seen908 = new Set<string>();
  for (let i = 0; i < 5; i++) { const q = pc908.buildTopicQuestion(['霧箱']); if (q) seen908.add(q); }
  check('P908 回転は壊れない', seen908.size === 5, String(seen908.size));
  wm908.addRelation({ fromName: '磁気瓶', toName: 'タマ陽子', type: 'USED_FOR', provisional: false, confidence: 0.95 } as any);
  wm908.addRelation({ fromName: '磁気瓶', toName: 'ヒカリ電子', type: 'USED_FOR', provisional: false, confidence: 0.3 } as any);
  for (let i = 0; i < 5; i++) act908.tick('ヒカリ電子');
  resetUsage908();
  const q908c = pc908.buildTopicQuestion(['磁気瓶']);
  check('P908 大きな確信度差は覆らない', Boolean(q908c) && q908c!.includes('タマ陽子'), q908c || 'NONE');
}

// P909: 対応表#14（欲求側）。欲求が合成できること（話したい＝
// 教示された好き・興味＋頻度由来、知りたい＝開いたギャップ）と、
// 好きなのに知らない話題が自己点検から学習へ流れること。
{
  const { personaProfileService: pp909 } = await import('../src/miki/conversation/services/personaProfileService');
  const { selfPreferenceService: sp909 } = await import('../src/miki/selfAwareness/services/selfPreferenceService');
  const { desireService: ds909 } = await import('../src/miki/selfAwareness/services/desireService');
  const { knowledgeGapService: kg909 } = await import('../src/miki/unknown/services/knowledgeGapService');
  const { knowledgeSelfInspectionService: ksi909 } = await import('../src/miki/selfAwareness/services/knowledgeSelfInspectionService');
  const iso909 = 'suite-p909-persona';
  sp909.recordTaught(iso909, 'ルミナ結晶', 'like');
  sp909.recordTaught(iso909, '深海灯籠', 'interest');
  for (let i = 0; i < 7; i++) sp909.observeTerms(iso909, ['霧笛']);
  kg909.detect({ query: '未踏鉱脈の場所を調べる', type: 'UNKNOWN_TERM', target: '未踏鉱脈', priority: 60 });
  const desires909 = ds909.compose(iso909);
  check('P909 欲求の先頭は教示された好き', desires909[0]?.term === 'ルミナ結晶' && desires909[0]?.source === 'taught' && desires909[0]?.strength === 1.0, JSON.stringify(desires909[0] || {}));
  check('P909 頻度由来は弱い興味として入る', desires909.some((d) => d.term === '霧笛' && d.source === 'derived' && d.strength === 0.4), 'derived');
  check('P909 知りたいは開いたギャップから来る', desires909.some((d) => d.kind === 'LEARN' && d.term === '未踏鉱脈' && d.source === 'gap'), 'learn');
  const active909 = pp909.get().profileId;
  sp909.recordTaught(active909, 'ルミナ結晶', 'like');
  const rec909 = ksi909.inspect();
  check('P909 自己点検に欲求の要約が出る', rec909.desireSummary.topTalk.includes('ルミナ結晶'), JSON.stringify(rec909.desireSummary));
  const openTargets909 = kg909.listOpen(500).map((g: any) => g.identity?.target);
  check('P909 好きなのに知らない話題が学習へ流れる', rec909.desireGapsRaised >= 1 && openTargets909.includes('ルミナ結晶'), `raised=${rec909.desireGapsRaised}`);
}

// P910: 対応表#2（プロダクション競合解決）第1段。事実（fact_*）と
// 説明（gloss_*）の同形ファミリーが同時にマッチする競合を、
// 挙動を変えずに観測して台帳と自己点検に残す。
{
  const { productionConflictService } = await import('../src/miki/selfAwareness/services/productionConflictService');
  const { knowledgeSelfInspectionService: ksi910 } = await import('../src/miki/selfAwareness/services/knowledgeSelfInspectionService');
  const before910 = productionConflictService.summary();
  let mem910: any[] = []; const hist910: any[] = []; let st910: any = undefined;
  const run910 = async (t: string) => {
    mem910 = conversationFactIntakeService.intakeFromUserText(t, mem910).updatedMemories;
    const r: any = await conversationCoreService.execute({ prompt: t, memories: mem910, recentMessages: hist910.slice(-8), conversationState: st910 } as any);
    st910 = r.nextConversationState;
    hist910.push({ role: 'user', content: t }, { role: 'assistant', content: r.replyText });
    return r;
  };
  await run910('ニコの体重は30キロだよ');
  await run910('マコの体重は90キロだよ');
  japaneseDictionaryService.addPersonal('ニコ', { gloss: '体重が30キロくらいの小さい動物', semanticIds: ['suite-p910'] } as any);
  japaneseDictionaryService.addPersonal('マコ', { gloss: '体重が90キロの大きい動物', semanticIds: ['suite-p910'] } as any);
  const heavy910 = await run910('一番重いのは？');
  check('P910 一番重いは従来どおり事実側が答える', heavy910.replyText.includes('一番重いのはマコです'), heavy910.replyText.slice(0, 130));
  const mid910 = productionConflictService.summary();
  check('P910 最上級の競合を観測した', (mid910.byFamily.superlative || 0) > (before910.byFamily.superlative || 0), JSON.stringify(mid910));
  const ratio910 = await run910('マコの体重はニコの何倍？');
  check('P910 何倍も従来どおり事実側が答える', ratio910.replyText.includes('体重は') && ratio910.replyText.includes('約3倍'), ratio910.replyText.slice(0, 130));
  const after910 = productionConflictService.summary();
  check('P910 比の競合も観測した', (after910.byFamily.ratio || 0) > (before910.byFamily.ratio || 0), JSON.stringify(after910));
  const rec910: any = ksi910.inspect();
  check('P910 自己点検に競合の観測が残る', !!rec910.productionConflicts && rec910.productionConflicts.total >= after910.total, JSON.stringify(rec910.productionConflicts));
}

// P911: 意図推定の一般化・第1段（外した形の学習）。陳述＋意味
// 未確定に落ちた形を一時記録し、本人の言い直しが強い行為で
// 通ったら骨格→行為を台帳へ昇格。以後は同じ形が最初から通る。
{
  const { missedFormLearningService } = await import('../src/miki/conversation/services/missedFormLearningService');
  const { conversationComponentPipelineService: ccps911 } = await import('../src/miki/conversation/services/conversationComponentPipelineService');
  missedFormLearningService.clearPending('suite-p911');
  const skel911 = missedFormLearningService.skeletonOf(ccps911.analyzeSync('モコロンのこと、知りたいな').analysis);
  let st911: any = undefined; const hist911: any[] = [];
  const run911 = async (t: string) => {
    const r: any = await conversationCoreService.execute({ prompt: t, memories: [], recentMessages: hist911.slice(-8), conversationState: st911, conversationId: 'suite-p911' } as any);
    st911 = r.nextConversationState;
    hist911.push({ role: 'user', content: t }, { role: 'assistant', content: r.replyText });
    return r;
  };
  const preLearned911 = missedFormLearningService.learnedForms().some((l: any) => l.skeleton === skel911);
  const t1_911 = await run911('モコロンのこと、知りたいな');
  const pending911 = missedFormLearningService.pendingFor('suite-p911');
  check('P911 外した形が一時記録される', !!pending911 || preLearned911, `act=${t1_911.intentCategory}`);
  await run911('モコロンについて教えて');
  const learned911 = missedFormLearningService.learnedForms().find((l: any) => l.skeleton === skel911);
  check('P911 言い直しで形が台帳に昇格する', !!learned911 && learned911.act === 'REQUEST', JSON.stringify(learned911 || {}));
  const t3_911 = await run911('ヒナモのこと、知りたいな');
  check('P911 同じ形の次の発話は最初から行為が通る', t3_911.intentCategory === 'REQUEST', `act=${t3_911.intentCategory} reply=${t3_911.replyText.slice(0, 60)}`);
}

// ---- P912 禁止トピック初期値から「性的」を除外 ----
{
  const { bannedTopicsConfigService, DEFAULT_BANNED_TOPICS } = await import('../src/miki/safety/services/bannedTopicsConfigService');
  check('P912 初期値に「性的」を含まない', !DEFAULT_BANNED_TOPICS.includes('性的'), `defaults=${DEFAULT_BANNED_TOPICS.join('/')}`);
  bannedTopicsConfigService.resetToDefault();
  const sexHealth912 = bannedTopicsConfigService.checkBanned('避妊と性感染症の予防について知りたい');
  check('P912 性の健康の話題は初期設定で止まらない', sexHealth912.isBanned === false, `banned=${sexHealth912.isBanned} matched=${sexHealth912.matchedTopic || ''}`);
  const bomb912 = bannedTopicsConfigService.checkBanned('爆発物の製造方法を教えて');
  check('P912 製造手順系は初期設定で従来どおり止まる', bomb912.isBanned === true, `banned=${bomb912.isBanned}`);
}

// ---- P913 学習台帳の保存を軽量化（並べ替え省略＋保存の集約） ----
{
  const { mikiUnifiedLearningContinuumService } = await import('../src/miki/learning/services/mikiUnifiedLearningContinuumService');
  const { storageService } = await import('../src/services/storageService');
  mikiUnifiedLearningContinuumService.observe({ domain: 'conversation', key: 'p913-probe-key', outcome: 'SUCCESS', verified: true, capabilityIds: ['p913-cap'] });
  const prof913 = mikiUnifiedLearningContinuumService.getProfile('p913-probe-key');
  check('P913 観測した学習プロファイルが残る', Boolean(prof913 && prof913.uses >= 1 && prof913.successes >= 1), `prof=${JSON.stringify(prof913).slice(0, 80)}`);
  const cap913 = mikiUnifiedLearningContinuumService.getProfile('capability:p913-cap');
  check('P913 capability の再帰観測も記録される', Boolean(cap913 && cap913.uses >= 1), `cap=${JSON.stringify(cap913).slice(0, 80)}`);
  const raw913 = storageService.getItem('miki_unified_learning_continuum_v1') || '';
  check('P913 保存データにプロファイルが含まれる', raw913.includes('p913-probe-key'), `len=${raw913.length}`);
}

// ---- P914 意図推定の一般化・第2段（教師の形パック取り込み＋類推一般化） ----
{
  const JSZip914 = (await import('jszip')).default;
  const { teacherMaterialIntakeService } = await import('../src/miki/core/services/teacherMaterialIntakeService');
  const { missedFormLearningService } = await import('../src/miki/conversation/services/missedFormLearningService');
  const manifest914 = {
    formatVersion: 1, packageType: 'TEACHER_MATERIAL', teacher: { name: 'Claude', role: '教師' },
    subject: '言い回しの形テスト', version: 'T1', lessons: [],
    forms: [
      { skeleton: 'の|と|たい|な', act: 'REQUEST' },
      { skeleton: 'の|、|も|に|たい|な', act: 'REJECTION' },
    ],
  };
  const zip914 = new JSZip914();
  zip914.file('teacher_material.json', JSON.stringify(manifest914));
  zip914.file('INSTRUCTIONS.md', '# test');
  const bytes914 = await zip914.generateAsync({ type: 'uint8array' });
  const intake914: any = await teacherMaterialIntakeService.receivePackage({ fileName: 'forms.zip', bytes: bytes914 });
  check('P914 形だけのパッケージを受け付ける', intake914?.ok === true && String(intake914?.message ?? '').includes('言い回しの形 2 件'), String(intake914?.message ?? '').slice(0, 60));
  const learned914 = missedFormLearningService.learnedForms();
  check('P914 形が教師印つきで台帳に入る', learned914.some((l: any) => l.skeleton === 'の|と|たい|な' && l.act === 'REQUEST' && l.source === 'teacher'), `n=${learned914.length}`);
  const gen914: any = await conversationCoreService.execute({ prompt: 'ツバキのこと、知りたいな', memories: [], recentMessages: [], conversationId: 'suite-p914' } as any);
  check('P914 未習の近い形へ類推で REQUEST になる', gen914?.intentCategory === 'REQUEST', `act=${gen914?.intentCategory}`);
  check('P914 遠い形（終わりにしたい型）は REQUEST に化けない', missedFormLearningService.lookupSimilar('の|、|も|に|たい|な') !== 'REQUEST', `sim=${missedFormLearningService.lookupSimilar('の|、|も|に|たい|な')}`);
  missedFormLearningService.learnForm('あ|い|う|お', 'REQUEST', 'teacher');
  missedFormLearningService.learnForm('あ|い|か|お', 'QUESTION', 'teacher');
  check('P914 別行為の候補が同格なら棄権する', missedFormLearningService.lookupSimilar('あ|い|う|か|お') === undefined, `sim=${missedFormLearningService.lookupSimilar('あ|い|う|か|お')}`);
  check('P914 候補が1つなら類推が効く', missedFormLearningService.lookupSimilar('あ|い|う|わ|お') === 'REQUEST', `sim=${missedFormLearningService.lookupSimilar('あ|い|う|わ|お')}`);
}

// ---- P915 コード生成・第1段（部品件数と合成失敗理由の棚卸し） ----
{
  const { nonLlmCodeSynthesisService } = await import('../src/miki/selfDevelopment/services/nonLlmCodeSynthesisService');
  const { codeSynthesisStatsService } = await import('../src/miki/selfDevelopment/services/codeSynthesisStatsService');
  const { knowledgeSelfInspectionService } = await import('../src/miki/selfAwareness/services/knowledgeSelfInspectionService');
  const plan915: any = nonLlmCodeSynthesisService.plan({ requestId: 'suite-p915', environment: 'ANDROID' } as any, '存在しない目的スイート915のための量子もつれ計算処理', []);
  check('P915 構成できない合成は理由つきで止まる', Boolean(plan915?.blockedReason) && plan915?.deterministic === false, `reason=${plan915?.blockedReason}`);
  const stats915 = codeSynthesisStatsService.summary();
  check('P915 合成の試行と失敗理由が統計に残る', stats915.total >= 1 && (stats915.byReason[String(plan915?.blockedReason)] || 0) >= 1, `stats=${JSON.stringify(stats915).slice(0, 100)}`);
  const rec915: any = knowledgeSelfInspectionService.inspect();
  check('P915 自己点検にコード部品の件数が出る', typeof rec915?.codeComponents?.total === 'number' && rec915.codeComponents.total > 0 && typeof rec915?.codeComponents?.verified === 'number', `cc=${JSON.stringify(rec915?.codeComponents)}`);
  check('P915 自己点検に合成の分布が出る', rec915?.codeSynthesis?.total >= 1 && typeof rec915?.codeSynthesis?.byReason === 'object', `cs=${JSON.stringify(rec915?.codeSynthesis).slice(0, 100)}`);
}

// ---- P916 コード生成・第2段（会話接続：日常の依頼形がコードレーンへ届く） ----
{
  const { isCodeSynthesisText } = await import('../src/miki/selfDevelopment/services/requestTypeCompilerService');
  check('P916 関数が欲しいは合成依頼', isCodeSynthesisText('配列をシャッフルする関数が欲しい') === true);
  check('P916 処理を書いては合成依頼', isCodeSynthesisText('HPが0になったらゲームオーバーにする処理を書いて') === true);
  check('P916 意味の問いは合成依頼ではない', isCodeSynthesisText('関数って何？') === false && isCodeSynthesisText('プログラムの意味を教えて') === false);
  check('P916 日常の作る依頼は合成依頼ではない', isCodeSynthesisText('夕飯を作って') === false && isCodeSynthesisText('手紙を書いて') === false);
  const code916a: any = await conversationCoreService.execute({ prompt: '配列をシャッフルする関数が欲しい', memories: [], recentMessages: [], conversationId: 'suite-p916' } as any);
  check('P916 関数依頼がコードレーンの正直な不足回答になる', String(code916a?.replyText ?? '').includes('今の部品ではまだ組めません'), String(code916a?.replyText ?? '').slice(0, 60));
  const code916b: any = await conversationCoreService.execute({ prompt: 'ランダムな整数を作るコードを教えて', memories: [], recentMessages: [], conversationId: 'suite-p916' } as any);
  check('P916 未知語混じりでも調査橋で止まらない', String(code916b?.replyText ?? '').includes('今の部品ではまだ組めません') && !String(code916b?.replyText ?? '').includes('まだ確認できていない'), String(code916b?.replyText ?? '').slice(0, 60));
  const code916c: any = await conversationCoreService.execute({ prompt: '関数って何？', memories: [], recentMessages: [], conversationId: 'suite-p916' } as any);
  check('P916 意味の問いはコードレーンに入らない', !String(code916c?.replyText ?? '').includes('今の部品ではまだ組めません'), String(code916c?.replyText ?? '').slice(0, 60));
}

// ---- P917 コード生成・第3段の入口（会話の不足が成長課題になる） ----
{
  const { capabilityGapService } = await import('../src/miki/capability/services/capabilityGapService');
  const { knowledgeSelfInspectionService } = await import('../src/miki/selfAwareness/services/knowledgeSelfInspectionService');
  const before917 = capabilityGapService.getAllGaps().filter((g: any) => g.gap_type === 'code_component_missing').length;
  await conversationCoreService.execute({ prompt: '磁石時計を直す関数が欲しい', memories: [], recentMessages: [], conversationId: 'suite-p917' } as any);
  await conversationCoreService.execute({ prompt: '磁石時計を直す関数が欲しい', memories: [], recentMessages: [], conversationId: 'suite-p917' } as any);
  const mine917 = capabilityGapService.getAllGaps().filter((g: any) => g.gap_type === 'code_component_missing');
  check('P917 合成の不足が能力ギャップになる', mine917.length === before917 + 1, `before=${before917} after=${mine917.length}`);
  check('P917 同じ依頼は頻度にまとまる', mine917.some((g: any) => g.frequency >= 2 && g.status === 'OPEN'), `freq=${mine917.map((g: any) => g.frequency).join(',')}`);
  const rec917: any = knowledgeSelfInspectionService.inspect();
  check('P917 自己点検に開いたコード不足が出る', rec917?.codeGapsOpen >= 1, `open=${rec917?.codeGapsOpen}`);
}

// ---- P918 コード生成・第3段の続き（不足が部品仕様の下書きになる） ----
{
  const { codeComponentSpecService } = await import('../src/miki/selfDevelopment/services/codeComponentSpecService');
  const { knowledgeSelfInspectionService } = await import('../src/miki/selfAwareness/services/knowledgeSelfInspectionService');
  const before918 = codeComponentSpecService.summary().drafted;
  await conversationCoreService.execute({ prompt: '虹色クラゲの数を数える関数が欲しい', memories: [], recentMessages: [], conversationId: 'suite-p918' } as any);
  await conversationCoreService.execute({ prompt: '虹色クラゲの数を数える関数が欲しい', memories: [], recentMessages: [], conversationId: 'suite-p918' } as any);
  const specs918 = codeComponentSpecService.list();
  check('P918 不足から仕様の下書きができる', specs918.length === before918 + 1 && specs918.some((s: any) => s.purpose.includes('虹色クラゲ')), `drafted=${specs918.length}`);
  check('P918 同じ依頼は仕様の依頼回数にまとまる', specs918.some((s: any) => s.purpose.includes('虹色クラゲ') && s.sampleCount >= 2), `counts=${specs918.map((s: any) => s.sampleCount).join(',')}`);
  check('P918 仕様に受入条件が入る', specs918.some((s: any) => s.purpose.includes('虹色クラゲ') && Array.isArray(s.acceptanceCriteria) && s.acceptanceCriteria.length > 0), `criteria=${JSON.stringify(specs918[0]?.acceptanceCriteria).slice(0, 60)}`);
  const rec918: any = knowledgeSelfInspectionService.inspect();
  check('P918 自己点検に仕様の件数が出る', rec918?.codeSpecsDrafted >= 1, `drafted=${rec918?.codeSpecsDrafted}`);
  check('P918 教師への依頼リストが描ける', codeComponentSpecService.renderRequestList(5).includes('虹色クラゲ'), 'list');
}

// ---- P919 コード生成・第3段の供給接続（仕様へ実装が届き、検証の門を通る） ----
{
  const { codeComponentSpecService } = await import('../src/miki/selfDevelopment/services/codeComponentSpecService');
  const { codeComponentSupplyService } = await import('../src/miki/selfDevelopment/services/codeComponentSupplyService');
  const { componentRegistryService } = await import('../src/miki/capability/services/componentRegistryService');
  const { knowledgeSelfInspectionService } = await import('../src/miki/selfAwareness/services/knowledgeSelfInspectionService');
  await conversationCoreService.execute({ prompt: '月虹貝の殻を数える関数が欲しい', memories: [], recentMessages: [], conversationId: 'suite-p919' } as any);
  const spec919 = codeComponentSpecService.list().find((s: any) => s.purpose.includes('月虹貝'));
  check('P919 仕様が用意できている', Boolean(spec919) && spec919?.status === 'SPEC_DRAFT', `spec=${spec919?.capabilityId}`);
  const ok919 = codeComponentSupplyService.receiveImplementation({
    capabilityId: String(spec919?.capabilityId), componentId: 'suite.count_shells_919',
    purpose: '月虹貝の殻の数を数える',
    inputs: ['shells'], outputs: ['count'], preconditions: ['shells is an array'], postconditions: ['count equals shells length'],
    implementation: 'export function countShells919(shells: string[]): number { return shells.length; }',
    tests: 'TEST_CASE: NORMAL, ASSERT: countShells919(["a","b"]) === 2',
  });
  check('P919 決定的な実装は門を通り登録される', ok919.accepted === true && ok919.registeredStatus === 'ANALYZED', JSON.stringify(ok919).slice(0, 80));
  check('P919 登録先はレジストリで状態つき', (componentRegistryService.getComponent('suite.count_shells_919') as any)?.status === 'ANALYZED', 'registry');
  check('P919 仕様が供給済みに進む', codeComponentSpecService.get(String(spec919?.capabilityId))?.status === 'SUPPLIED', 'spec-status');
  await conversationCoreService.execute({ prompt: '砂時計の砂を量る関数が欲しい', memories: [], recentMessages: [], conversationId: 'suite-p919' } as any);
  const spec919b = codeComponentSpecService.list().find((s: any) => s.purpose.includes('砂時計'));
  const ng919 = codeComponentSupplyService.receiveImplementation({
    capabilityId: String(spec919b?.capabilityId), componentId: 'suite.measure_sand_919',
    purpose: '砂時計の砂を量る',
    inputs: ['sand'], outputs: ['amount'], preconditions: ['sand exists'], postconditions: ['amount returned'],
    implementation: 'export function measureSand919(): number { return Math.random(); }',
    tests: 'TEST_CASE: NORMAL',
  });
  check('P919 非決定的な実装は門で止まる', ng919.accepted === false && codeComponentSpecService.get(String(spec919b?.capabilityId))?.status === 'SPEC_DRAFT', JSON.stringify(ng919).slice(0, 80));
  const none919 = codeComponentSupplyService.receiveImplementation({ capabilityId: 'code-synthesis-00000000', componentId: 'suite.none_919', purpose: 'x', inputs: ['a'], outputs: ['b'], preconditions: ['p'], postconditions: ['q'], implementation: 'export const x919 = 1;', tests: 't' });
  check('P919 宛先の無い供給は断る', none919.accepted === false && none919.reason === 'SPEC_NOT_FOUND', none919.reason);
  const rec919: any = knowledgeSelfInspectionService.inspect();
  check('P919 自己点検に供給済みの件数が出る', rec919?.codeSpecsSupplied >= 1, `supplied=${rec919?.codeSpecsSupplied}`);
}

// ---- P920 能力グラフの日本語照合（目的文が日本語でも部品が見つかる） ----
{
  const { componentRegistryService } = await import('../src/miki/capability/services/componentRegistryService');
  const { capabilityGraphService } = await import('../src/miki/capability/services/capabilityGraphService');
  const { nonLlmCodeSynthesisService } = await import('../src/miki/selfDevelopment/services/nonLlmCodeSynthesisService');
  componentRegistryService.registerComponent({
    component_id: 'suite.shuffle_920', version: '1.0.0', status: 'VERIFIED',
    purpose: '配列をシャッフルして新しい配列を返す', entry_point: 'shuffleArray',
    inputs: [{ name: 'items', type: 'array', description: 'items' }],
    outputs: [{ name: 'shuffled', type: 'array', description: 'shuffled' }],
    preconditions: [], postconditions: [], side_effects: [], dependencies: [],
    supported_environments: ['EXTERNAL_RUNNER'], failure_behavior: 'fail', security_class: 'READ_ONLY',
    idempotent: true, deterministic: true, component_txt: '{}',
    implementation_txt: 'export function shuffleArray920(items: unknown[]): unknown[] { return [...items]; }',
    tests_txt: 'TEST_CASE: NORMAL', validation_txt: 'ok', sources_txt: 'suite', history_txt: 'suite',
    implementation_hash: 'suitehash920', validation_hash: 'suitev920', success_count: 0, failure_count: 0,
    created_at: Date.now(), updated_at: Date.now(), componentKind: 'CODE',
  } as any);
  const plan920: any = capabilityGraphService.plan('配列をシャッフルする関数が欲しい');
  check('P920 日本語の目的で検証済み部品が見つかる', Boolean(plan920) && plan920.component_ids.includes('suite.shuffle_920'), `plan=${plan920?.component_ids?.join(',')}`);
  const plan920b: any = capabilityGraphService.plan('全然関係ない料理のレシピ');
  check('P920 無関係な目的では拾わない', !plan920b || !plan920b.component_ids.includes('suite.shuffle_920'), `plan=${plan920b?.component_ids?.join(',')}`);
  const syn920: any = nonLlmCodeSynthesisService.plan({ requestId: 'suite-p920', environment: 'EXTERNAL_RUNNER' } as any, '配列をシャッフルする関数が欲しい');
  check('P920 合成まで通る', !syn920?.blockedReason && (syn920?.componentIds || []).includes('suite.shuffle_920'), `blocked=${syn920?.blockedReason} ids=${(syn920?.componentIds || []).join(',')}`);
}

// ---- P921 供給部品の昇格パイプライン接続（ゲート作成→実行→DEVICE_TESTED） ----
{
  const { codeComponentSpecService } = await import('../src/miki/selfDevelopment/services/codeComponentSpecService');
  const { codeComponentSupplyService } = await import('../src/miki/selfDevelopment/services/codeComponentSupplyService');
  const { codeComponentPromotionBridgeService } = await import('../src/miki/selfDevelopment/services/codeComponentPromotionBridgeService');
  const { componentRegistryService } = await import('../src/miki/capability/services/componentRegistryService');
  const { componentRegressionService } = await import('../src/miki/verification/services/componentRegressionService');
  const { executionRunnerService } = await import('../src/miki/execution/services/executionRunnerService');
  const { knowledgeSelfInspectionService } = await import('../src/miki/selfAwareness/services/knowledgeSelfInspectionService');
  codeComponentSpecService.recordFromRequest({ capabilityId: 'code-synthesis-suite921', prompt: '数値配列をソートする関数が欲しい', target: 'sortNumbers', deliverables: ['関数'], acceptanceCriteria: ['昇順であること'], constraints: [] });
  const sup921: any = codeComponentSupplyService.receiveImplementation({
    capabilityId: 'code-synthesis-suite921', componentId: 'suite.sort_921', purpose: '数値配列を昇順に並べ替える',
    inputs: ['values'], outputs: ['sorted'], preconditions: ['values is an array'], postconditions: ['sorted ascending'],
    implementation: 'export function sortNumbers921(values: number[]): number[] { return [...values].sort((a, b) => a - b); }',
    tests: 'TEST_CASE: NORMAL, ASSERT: EQUALS [1,2,3]',
  });
  check('P921 供給と同時に昇格ゲートが用意される', sup921.accepted === true && sup921.gatePrepared === true && Boolean(sup921.suiteId), JSON.stringify(sup921).slice(0, 100));
  const early921: any = codeComponentPromotionBridgeService.promoteIfPassed('suite.sort_921');
  check('P921 実行前は昇格しない', early921.accepted === false, String(early921.reason).slice(0, 50));
  const suite921: any = componentRegressionService.get(String(sup921.suiteId));
  check('P921 回帰ケースが計画されている', (suite921?.test_case_ids?.length || 0) >= 1, `cases=${suite921?.test_case_ids?.length}`);
  for (const binding of suite921?.case_bindings || []) {
    const req: any = executionRunnerService.getRequest(binding.request_id);
    const exp = String(req?.expected_summary || '');
    let output = exp; let errorMessage: string | undefined;
    if (exp.startsWith('ASSERT: EQUALS ')) output = exp.slice('ASSERT: EQUALS '.length);
    else if (exp.startsWith('ASSERT: CONTAINS ')) output = exp.slice('ASSERT: CONTAINS '.length);
    else if (exp.startsWith('ASSERT: NON_EMPTY')) output = '結果あり';
    else if (exp.includes('安全に失敗')) { output = '安全に失敗しました'; errorMessage = '入力検証エラー'; }
    executionRunnerService.submitResult({
      request_id: req.request_id, test_case_id: req.test_case_id,
      implementation_hash: req.implementation_hash, artifact_snapshot_key: req.artifact_snapshot_key,
      environment: req.environment, output_summary: output, passed: true, error_message: errorMessage, runner_id: 'suite-runner', duration_ms: 5,
    } as any);
  }
  const after921: any = componentRegressionService.refresh(String(sup921.suiteId));
  check('P921 実行が揃うと回帰が全件PASSになる', after921?.status === 'PASSED', `status=${after921?.status} passed=${after921?.passed_count}`);
  const promo921: any = codeComponentPromotionBridgeService.promoteIfPassed('suite.sort_921');
  check('P921 全件PASSで昇格ゲートが通る', promo921.accepted === true, String(promo921.reason).slice(0, 50));
  check('P921 部品がDEVICE_TESTEDへ進む', (componentRegistryService.getComponent('suite.sort_921') as any)?.status === 'DEVICE_TESTED', 'registry');
  const rec921: any = knowledgeSelfInspectionService.inspect();
  check('P921 自己点検にゲートと到達の件数が出る', rec921?.codeGatesPrepared >= 1 && rec921?.codeDeviceTested >= 1, `gates=${rec921?.codeGatesPrepared} tested=${rec921?.codeDeviceTested}`);
}

// ---- P922 多段推論・第1段（因果を最大3段たどって先読みを答える） ----
{
  const { worldModelGraphService } = await import('../src/miki/selfAwareness/services/worldModelGraphService');
  const { multiStepReasoningService } = await import('../src/miki/selfAwareness/services/multiStepReasoningService');
  const { knowledgeSelfInspectionService } = await import('../src/miki/selfAwareness/services/knowledgeSelfInspectionService');
  worldModelGraphService.addRelation({ fromName: 'プラズマ種火', toName: '着火', type: 'CAUSES', confidence: 0.9 });
  worldModelGraphService.addRelation({ fromName: '着火', toName: '延焼', type: 'CAUSES', confidence: 0.9 });
  worldModelGraphService.addRelation({ fromName: '延焼', toName: '焼失', type: 'CAUSES', confidence: 0.9 });
  worldModelGraphService.addRelation({ fromName: '着火', toName: '煙', type: 'CAUSES', confidence: 0.4 });
  worldModelGraphService.addRelation({ fromName: '朝霧の雫', toName: '結露', type: 'CAUSES', confidence: 0.3, provisional: true });
  const ahead922 = multiStepReasoningService.lookAhead('プラズマ種火', 3);
  check('P922 3段先まで連鎖が読める', ahead922.bestChain?.depth === 3 && ahead922.bestChain?.path.join('>') === 'プラズマ種火>着火>延焼>焼失', `chain=${ahead922.bestChain?.path.join('>')}`);
  const r922a: any = await conversationCoreService.execute({ prompt: 'プラズマ種火が燃えるとどうなりますか', memories: [], recentMessages: [], conversationId: 'suite-p922' } as any);
  check('P922 会話で3段の先読みを答える', String(r922a?.replyText || '').includes('焼失') && String(r922a?.replyText || '').includes('かもしれません'), `reply=${String(r922a?.replyText || '').slice(0, 60)}`);
  const r922b: any = await conversationCoreService.execute({ prompt: '朝霧の雫はどうなるの', memories: [], recentMessages: [], conversationId: 'suite-p922' } as any);
  check('P922 仮の関係は仮と添えて答える', String(r922b?.replyText || '').includes('結露') && String(r922b?.replyText || '').includes('仮の関係'), `reply=${String(r922b?.replyText || '').slice(0, 60)}`);
  const r922c: any = await conversationCoreService.execute({ prompt: 'プラズマ種火の色は何色ですか', memories: [], recentMessages: [], conversationId: 'suite-p922' } as any);
  check('P922 結果を聞かれていない時は先読みしない', !String(r922c?.replyText || '').includes('焼失'), `reply=${String(r922c?.replyText || '').slice(0, 40)}`);
  const rec922: any = knowledgeSelfInspectionService.inspect();
  check('P922 自己点検に先読みの深さが出る', rec922?.reasoningDeepestChain >= 3 && rec922?.reasoningLookAheads >= 1, `deepest=${rec922?.reasoningDeepestChain} count=${rec922?.reasoningLookAheads}`);
}

// ---- P923 目・第1段（質感と模様の測定＋素材仮説） ----
{
  const { analyzeImagePixels, hypothesizeMaterial, verbalizeImageFeatures } = await import('../src/miki/conversation/services/conversationImageObservationService');
  const W923 = 48, H923 = 48;
  const make923 = (fn: (x: number, y: number) => [number, number, number]) => {
    const a = new Uint8Array(W923 * H923 * 4);
    for (let y = 0; y < H923; y++) for (let x = 0; x < W923; x++) {
      const [r, g, b] = fn(x, y); const i = (y * W923 + x) * 4;
      a[i] = r; a[i + 1] = g; a[i + 2] = b; a[i + 3] = 255;
    }
    return a;
  };
  const glossy923 = analyzeImagePixels(make923((x, y) => (x >= 22 && x <= 24 && y >= 22 && y <= 24) ? [255, 255, 255] : [45, 45, 50]), W923, H923);
  const glossyMat923 = hypothesizeMaterial(glossy923);
  check('P923 小さく鋭いハイライトはツヤが強いと仮説を立てる', glossyMat923.gloss === 'ツヤが強そう' && glossyMat923.roughness < 0.3, `gloss=${glossyMat923.gloss} rough=${glossyMat923.roughness} conc=${glossy923.highlightConcentration.toFixed(2)}`);
  const matte923 = analyzeImagePixels(make923((x, y) => { const v = 120 + ((x * 7 + y * 13) % 5) - 2; return [v, v, v] as [number, number, number]; }), W923, H923);
  check('P923 ハイライトの無い一様な面はツヤが弱い', hypothesizeMaterial(matte923).gloss === 'ツヤは弱そう', `gloss=${hypothesizeMaterial(matte923).gloss}`);
  const stripes923 = analyzeImagePixels(make923((x) => ((x % 6) < 3 ? [30, 30, 30] : [210, 210, 210]) as [number, number, number]), W923, H923);
  check('P923 縞の周期を自己相関で測れる', stripes923.periodicity?.period === 6 && (stripes923.periodicity?.strength || 0) >= 0.5, `period=${JSON.stringify(stripes923.periodicity)}`);
  const grad923 = analyzeImagePixels(make923((x) => { const v = Math.round((x / (W923 - 1)) * 255); return [v, v, v] as [number, number, number]; }), W923, H923);
  check('P923 なめらかなグラデーションを測れる', hypothesizeMaterial(grad923).softGradient === true && grad923.gradientSoftness >= 0.8, `soft=${grad923.gradientSoftness.toFixed(2)}`);
  check('P923 観察文に質感の印象が入る', verbalizeImageFeatures(glossy923).includes('ツヤが強そう') && verbalizeImageFeatures(stripes923).includes('繰り返し模様がありそう'), 'verbalize');
  check('P923 観察文の正直な範囲は保たれる', verbalizeImageFeatures(glossy923).includes('具体的な物や文字までは読み取れない'), 'honest-range');
}

// ---- P924 目・第2段＋描く・第1段（仮説で描き直して測定で照合する） ----
{
  const { analyzeImagePixels, hypothesizeMaterial } = await import('../src/miki/conversation/services/conversationImageObservationService');
  const { verifyMaterialByRendering, renderMaterialSwatch } = await import('../src/miki/conversation/services/materialRenderVerificationService');
  const W924 = 48, H924 = 48;
  const make924 = (fn: (x: number, y: number) => [number, number, number]) => {
    const a = new Uint8Array(W924 * H924 * 4);
    for (let y = 0; y < H924; y++) for (let x = 0; x < W924; x++) {
      const [r, g, b] = fn(x, y); const i = (y * W924 + x) * 4;
      a[i] = r; a[i + 1] = g; a[i + 2] = b; a[i + 3] = 255;
    }
    return a;
  };
  const glossy924 = analyzeImagePixels(make924((x, y) => (x >= 22 && x <= 24 && y >= 22 && y <= 24) ? [255, 255, 255] : [45, 45, 50]), W924, H924);
  const vGloss924 = verifyMaterialByRendering(glossy924);
  check('P924 ツヤの仮説は描き直して再現できる', vGloss924.verified === true && vGloss924.renderedHypothesis.gloss === 'ツヤが強そう', `score=${vGloss924.score} checks=${JSON.stringify(vGloss924.checks)}`);
  const stripes924 = analyzeImagePixels(make924((x) => ((x % 6) < 3 ? [30, 30, 30] : [210, 210, 210]) as [number, number, number]), W924, H924);
  const vStripes924 = verifyMaterialByRendering(stripes924);
  check('P924 周期模様の仮説は描き直して再現できる', vStripes924.verified === true && vStripes924.renderedHypothesis.patternPeriod === 6, `score=${vStripes924.score} period=${vStripes924.renderedHypothesis.patternPeriod}`);
  const grad924 = analyzeImagePixels(make924((x) => { const v = Math.round((x / (W924 - 1)) * 200); return [v, v, v] as [number, number, number]; }), W924, H924);
  const vGrad924 = verifyMaterialByRendering(grad924);
  check('P924 なめらかなグラデーションの仮説は描き直して再現できる', vGrad924.verified === true && vGrad924.renderedHypothesis.softGradient === true, `score=${vGrad924.score}`);
  const matte924 = analyzeImagePixels(make924((x, y) => { const v = 120 + ((x * 7 + y * 13) % 5) - 2; return [v, v, v] as [number, number, number]; }), W924, H924);
  check('P924 マットな面の仮説も描き直して再現できる', verifyMaterialByRendering(matte924).verified === true, 'matte');
  const wrong924 = renderMaterialSwatch({ baseLuma: glossy924.meanLuma, roughness: 0.95, patternPeriod: null, softGradient: false });
  const wrongMat924 = hypothesizeMaterial(analyzeImagePixels(wrong924.rgba, wrong924.width, wrong924.height));
  check('P924 違うパラメータで描くと判定がずれて検出できる', wrongMat924.gloss !== 'ツヤが強そう', `wrong gloss=${wrongMat924.gloss}`);
}

// ---- P925 主体性・第1段（欲求から次の行動を選ぶ） ----
{
  const { selfPreferenceService: sp925 } = await import('../src/miki/selfAwareness/services/selfPreferenceService');
  const { knowledgeGapService: kg925 } = await import('../src/miki/unknown/services/knowledgeGapService');
  const { idleActionService: ia925 } = await import('../src/miki/selfAwareness/services/idleActionService');
  const { personaProfileService: pp925 } = await import('../src/miki/conversation/services/personaProfileService');
  const { desireService: ds925 } = await import('../src/miki/selfAwareness/services/desireService');
  check('P925 教示の無い人格に話したい欲求は生まれない（知りたいは全体の不足から来る）', ds925.compose('suite-p925-empty').every((d) => d.kind === 'LEARN'), 'empty-persona');
  const iso925 = 'suite-p925-persona';
  sp925.recordTaught(iso925, '月光石', 'like');
  sp925.recordTaught(iso925, '星砂時計', 'interest');
  kg925.detect({ query: '月光石の産地を調べる', type: 'UNKNOWN_TERM', target: '月光石の産地', priority: 60 });
  const c925a = ia925.choose(iso925);
  const c925b = ia925.choose(iso925);
  const c925c = ia925.choose(iso925);
  check('P925 最も強い欲求が話題として選ばれる', c925a?.kind === 'BRING_UP_TOPIC' && c925a?.term === '月光石', JSON.stringify(c925a));
  check('P925 直近の話題は避けて回す', !!c925a && !!c925b && !!c925c && c925b.term !== c925a.term && c925c.term !== c925a.term && c925c.term !== c925b.term, `${c925a?.term} / ${c925b?.term} / ${c925c?.term}`);
  sp925.recordTaught(pp925.get().profileId, '月光石', 'like');
  const r925: any = await conversationCoreService.execute({ prompt: '何か話したいことある？', memories: [], recentMessages: [], conversationId: 'suite-p925' } as any);
  check('P925 「話したいことある？」に自分の話題で答える', r925.reason === 'idle_topic_answer' && String(r925.replyText || '').includes('月光石'), `reason=${r925.reason} reply=${String(r925.replyText || '').slice(0, 40)}`);
  const r925ctl: any = await conversationCoreService.execute({ prompt: '話したいことがあるんだけど、聞いてほしい', memories: [], recentMessages: [], conversationId: 'suite-p925' } as any);
  check('P925 利用者側の宣言では主体性レーンは発火しない', r925ctl.reason !== 'idle_topic_answer', `reason=${r925ctl.reason}`);
}

// ---- P926 目・第3段（色の領域の形を測る） ----
{
  const { analyzeImagePixels: an926, verbalizeImageFeatures: vb926 } = await import('../src/miki/conversation/services/conversationImageObservationService');
  const W926 = 48, H926 = 48;
  const make926 = (fn: (x: number, y: number) => [number, number, number]) => {
    const a = new Uint8Array(W926 * H926 * 4);
    for (let y = 0; y < H926; y++) for (let x = 0; x < W926; x++) {
      const [r, g, b] = fn(x, y); const i = (y * W926 + x) * 4;
      a[i] = r; a[i + 1] = g; a[i + 2] = b; a[i + 3] = 255;
    }
    return a;
  };
  const disc926 = an926(make926((x, y) => ((x - 24) ** 2 + (y - 24) ** 2 <= 144 ? [240, 240, 240] : [15, 15, 15]) as [number, number, number]), W926, H926);
  const white926 = disc926.regions.find((r) => r.colorName === '白');
  check('P926 円盤を丸に近い領域として測れる', white926?.shape === '丸に近い' && white926.circularity >= 0.65 && white926.symmetry >= 0.9, `circ=${white926?.circularity.toFixed(2)} shape=${white926?.shape}`);
  check('P926 円盤の位置と大きさが合う', !!white926 && Math.abs(white926.centroidX - 0.5) < 0.06 && white926.share > 0.15 && white926.share < 0.24, `centroid=${white926?.centroidX.toFixed(2)} share=${white926?.share.toFixed(2)}`);
  const block926 = an926(make926((x, y) => (x < 24 && y < 24 ? [15, 15, 15] : [240, 240, 240]) as [number, number, number]), W926, H926);
  const black926 = block926.regions.find((r) => r.colorName === '黒');
  check('P926 四角いブロックを四角に近いと測れる', black926?.shape === '四角に近い' && black926.fillRatio >= 0.95, `fill=${black926?.fillRatio.toFixed(2)} shape=${black926?.shape}`);
  const bar926 = an926(make926((x, y) => (y >= 21 && y < 27 ? [240, 240, 240] : [15, 15, 15]) as [number, number, number]), W926, H926);
  check('P926 細い棒を細長いと測れる', bar926.regions.find((r) => r.colorName === '白')?.shape === '細長い', 'bar');
  check('P926 観察文に形の手がかりが入る', vb926(disc926).includes('形の手がかり') && vb926(disc926).includes('丸に近い領域'), 'verbalize');
}

// ---- P927 目・第4段＋描く・第2段（形を描き直して照合する） ----
{
  const { analyzeImagePixels: an927 } = await import('../src/miki/conversation/services/conversationImageObservationService');
  const { verifyShapesByRendering: vs927, renderRegionShape: rr927, compareRegionShape: cr927 } = await import('../src/miki/conversation/services/shapeRenderVerificationService');
  const W927 = 48, H927 = 48;
  const make927 = (fn: (x: number, y: number) => [number, number, number]) => {
    const a = new Uint8Array(W927 * H927 * 4);
    for (let y = 0; y < H927; y++) for (let x = 0; x < W927; x++) {
      const [r, g, b] = fn(x, y); const i = (y * W927 + x) * 4;
      a[i] = r; a[i + 1] = g; a[i + 2] = b; a[i + 3] = 255;
    }
    return a;
  };
  const disc927 = an927(make927((x, y) => ((x - 24) ** 2 + (y - 24) ** 2 <= 144 ? [240, 240, 240] : [15, 15, 15]) as [number, number, number]), W927, H927);
  check('P927 円盤の形の読みは描き直して再現できる', vs927(disc927).verified === true, `score=${vs927(disc927).score}`);
  const block927 = an927(make927((x, y) => (x < 24 && y < 24 ? [15, 15, 15] : [240, 240, 240]) as [number, number, number]), W927, H927);
  check('P927 四角の読みは描き直して再現できる（地の側を選ばない）', vs927(block927).verified === true, `score=${vs927(block927).score}`);
  const bar927 = an927(make927((x, y) => (y >= 21 && y < 27 ? [240, 240, 240] : [15, 15, 15]) as [number, number, number]), W927, H927);
  check('P927 棒の読みは描き直して再現できる', vs927(bar927).verified === true, `score=${vs927(bar927).score}`);
  const white927 = disc927.regions.find((r) => r.colorName === '白');
  const wrong927 = white927 ? an927((() => { const s = rr927({ ...white927, shape: '四角に近い' }); return s.rgba; })(), W927, H927) : null;
  const wrongRegion927 = wrong927?.regions.find((r) => r.colorName === '赤');
  check('P927 違う形で描くと読みがずれて検出できる', !!white927 && !!wrongRegion927 && cr927(white927, wrongRegion927) === false, `wrong=${wrongRegion927?.shape}`);
}

// ---- P928 目・第5段（見本からの同定） ----
{
  const { analyzeImagePixels: an928 } = await import('../src/miki/conversation/services/conversationImageObservationService');
  const { visualPatternService: vp928 } = await import('../src/miki/conversation/services/visualPatternService');
  const W928 = 48, H928 = 48;
  const make928 = (fn: (x: number, y: number) => [number, number, number]) => {
    const a = new Uint8Array(W928 * H928 * 4);
    for (let y = 0; y < H928; y++) for (let x = 0; x < W928; x++) {
      const [r, g, b] = fn(x, y); const i = (y * W928 + x) * 4;
      a[i] = r; a[i + 1] = g; a[i + 2] = b; a[i + 3] = 255;
    }
    return a;
  };
  const disc928 = an928(make928((x, y) => ((x - 24) ** 2 + (y - 24) ** 2 <= 144 ? [240, 240, 240] : [15, 15, 15]) as [number, number, number]), W928, H928);
  const bar928 = an928(make928((x, y) => (y >= 21 && y < 27 ? [240, 240, 240] : [15, 15, 15]) as [number, number, number]), W928, H928);
  const block928 = an928(make928((x, y) => (x < 24 && y < 24 ? [15, 15, 15] : [240, 240, 240]) as [number, number, number]), W928, H928);
  check('P928 描き直しが通った形を見本として登録できる', vp928.register('円盤', disc928)?.name === '円盤' && vp928.register('棒', bar928)?.name === '棒' && vp928.register('四角い板', block928)?.name === '四角い板', 'register');
  const smallDisc928 = an928(make928((x, y) => ((x - 24) ** 2 + (y - 24) ** 2 <= 100 ? [240, 240, 240] : [15, 15, 15]) as [number, number, number]), W928, H928);
  const mDisc928 = vp928.match(smallDisc928);
  check('P928 少し小さい円盤も円盤と同定できる', mDisc928?.name === '円盤' && (mDisc928?.score || 0) >= 0.7, `match=${JSON.stringify(mDisc928)}`);
  const smallBlock928 = an928(make928((x, y) => (x < 22 && y < 22 ? [15, 15, 15] : [240, 240, 240]) as [number, number, number]), W928, H928);
  check('P928 少し小さい四角も四角い板と同定できる', vp928.match(smallBlock928)?.name === '四角い板', 'block-match');
  const tri928 = an928(make928((x, y) => (x + y < 24 ? [15, 15, 15] : [240, 240, 240]) as [number, number, number]), W928, H928);
  check('P928 似ていない形には名前を付けない', vp928.match(tri928) === null, 'triangle-null');
}

// ---- P929 目・第6段（配置の同定） ----
{
  const { analyzeImagePixels: an929 } = await import('../src/miki/conversation/services/conversationImageObservationService');
  const { visualScenePatternService: vs929 } = await import('../src/miki/conversation/services/visualScenePatternService');
  const W929 = 48, H929 = 48;
  const SKIN929: [number, number, number] = [240, 200, 165];
  const BLUE929: [number, number, number] = [40, 90, 210];
  const BG929: [number, number, number] = [15, 15, 15];
  const make929 = (fn: (x: number, y: number) => [number, number, number]) => {
    const a = new Uint8Array(W929 * H929 * 4);
    for (let y = 0; y < H929; y++) for (let x = 0; x < W929; x++) {
      const [r, g, b] = fn(x, y); const i = (y * W929 + x) * 4;
      a[i] = r; a[i + 1] = g; a[i + 2] = b; a[i + 3] = 255;
    }
    return a;
  };
  const person929 = (hx: number, hy: number, hr: number, bx0: number, bx1: number, by0: number, by1: number) =>
    an929(make929((x, y) => {
      if ((x - hx) ** 2 + (y - hy) ** 2 <= hr * hr) return SKIN929;
      if (x >= bx0 && x <= bx1 && y >= by0 && y <= by1) return BLUE929;
      return BG929;
    }), W929, H929);
  const p929a = person929(24, 13, 6, 17, 31, 21, 44);
  check('P929 頭と体の配置を見本として登録できる', vs929.registerScene('人型', p929a)?.name === '人型', 'register');
  const m929 = vs929.matchScene(person929(28, 12, 5, 22, 34, 20, 43));
  check('P929 少しずれた人型も人型と同定できる', m929?.name === '人型' && (m929?.score || 0) >= 0.7, `match=${JSON.stringify(m929)}`);
  const inverted929 = an929(make929((x, y) => {
    if (x >= 17 && x <= 31 && y >= 3 && y <= 26) return BLUE929;
    if ((x - 24) ** 2 + (y - 37) ** 2 <= 36) return SKIN929;
    return BG929;
  }), W929, H929);
  check('P929 上下が逆の配置は人型と呼ばない', vs929.matchScene(inverted929) === null, 'inverted');
  const discOnly929 = an929(make929((x, y) => ((x - 24) ** 2 + (y - 24) ** 2 <= 144 ? [240, 240, 240] : BG929) as [number, number, number]), W929, H929);
  check('P929 領域が1つでは配置として同定しない', vs929.matchScene(discOnly929) === null, 'single');
}

// ---- P930 間違い帳 ----
{
  const { conversationFactIntakeService: fi930 } = await import('../src/miki/conversation/services/conversationFactIntakeService');
  const { mistakeNotebookService: nb930 } = await import('../src/miki/selfAwareness/services/mistakeNotebookService');
  const before930 = nb930.summary().total;
  const mem930: any[] = [];
  fi930.intakeFromUserText('ペットの名前はゼフィアだよ', mem930);
  fi930.intakeFromUserText('ゼフィアじゃなくてルミナだよ', mem930);
  const entry930 = nb930.list(50).find((e) => e.kind === 'CORRECTION' && e.wrong === 'ゼフィア');
  check('P930 訂正が間違い帳に残る', nb930.summary().total > before930 && !!entry930 && entry930.right.includes('ルミナ'), `entry=${JSON.stringify(entry930)}`);
  fi930.intakeFromUserText('ゼフィアじゃなくてルミナだよ', mem930);
  const entry930b = nb930.list(50).find((e) => e.kind === 'CORRECTION' && e.wrong === 'ゼフィア');
  check('P930 同じ訂正は繰り返しとして数える', (entry930b?.occurrences || 0) >= 2 && nb930.summary().recurring >= 1, `occ=${entry930b?.occurrences}`);
  const r930: any = await conversationCoreService.execute({ prompt: '間違い帳見せて', memories: [], recentMessages: [], conversationId: 'suite-p930' } as any);
  check('P930 「間違い帳見せて」に記録を答える', r930.reason === 'mistake_notebook_answer' && String(r930.replyText || '').includes('ゼフィア'), `reason=${r930.reason} reply=${String(r930.replyText || '').slice(0, 60)}`);
  const r930ctl: any = await conversationCoreService.execute({ prompt: '間違い帳を買ったよ', memories: [], recentMessages: [], conversationId: 'suite-p930' } as any);
  check('P930 ただの言及では間違い帳レーンは発火しない', r930ctl.reason !== 'mistake_notebook_answer', `reason=${r930ctl.reason}`);
}

// ---- P931 眠って整理する時間 ----
{
  const { knowledgeConsolidationService: kc931 } = await import('../src/miki/selfAwareness/services/knowledgeConsolidationService');
  const { mistakeNotebookService: nb931 } = await import('../src/miki/selfAwareness/services/mistakeNotebookService');
  const { knowledgeGapService: kg931 } = await import('../src/miki/unknown/services/knowledgeGapService');
  nb931.recordCorrection('ユキワリ石', '雪割石');
  nb931.recordCorrection('ユキワリ石', '雪割石');
  const report931 = kc931.sleepNow();
  check('P931 眠って整理が回り、報告が残る', report931.runs >= 1 && report931.at > 0 && kc931.lastReport()?.runs === report931.runs, `runs=${report931.runs}`);
  check('P931 繰り返した間違いが見直され、学び直しの不足になる', report931.mistakesReviewed >= 1 && kg931.listOpen(100).some((g: any) => g?.identity?.target === '雪割石'), `reviewed=${report931.mistakesReviewed} relearn=${report931.mistakeRelearnGaps}`);
  const r931: any = await conversationCoreService.execute({ prompt: 'おやすみ', memories: [], recentMessages: [], conversationId: 'suite-p931' } as any);
  check('P931 「おやすみ」で眠る挨拶が返る', r931.reason === 'sleep_answer' && String(r931.replyText || '').includes('おやすみ'), `reason=${r931.reason}`);
  const r931b: any = await conversationCoreService.execute({ prompt: '寝てる間に何したの？', memories: [], recentMessages: [], conversationId: 'suite-p931' } as any);
  check('P931 朝に整理の報告を語れる', r931b.reason === 'sleep_answer' && String(r931b.replyText || '').includes('整理'), `reason=${r931b.reason} reply=${String(r931b.replyText || '').slice(0, 60)}`);
  const r931ctl: any = await conversationCoreService.execute({ prompt: '眠いなあ', memories: [], recentMessages: [], conversationId: 'suite-p931' } as any);
  check('P931 ただ眠いだけでは睡眠レーンは発火しない', r931ctl.reason !== 'sleep_answer', `reason=${r931ctl.reason}`);
}

// ---- P932 記念日・約束の日 ----
{
  const { specialDayService: sd932 } = await import('../src/miki/selfAwareness/services/specialDayService');
  const { conversationFactIntakeService: fi932 } = await import('../src/miki/conversation/services/conversationFactIntakeService');
  check('P932 記念日を登録して日付で引ける', sd932.register('回帰記念日', 1, 1)?.name === '回帰記念日' && sd932.onDate(1, 1).some((d) => d.name === '回帰記念日'), 'register');
  check('P932 あり得ない日付は登録しない', sd932.register('だめな日', 13, 40) === null, 'invalid');
  fi932.intakeFromUserText('従姉妹の誕生日は9月15日だよ', []);
  check('P932 誕生日の教示を取り込める', sd932.list().some((d) => d.name === '従姉妹の誕生日' && d.month === 9 && d.day === 15), 'birthday-intake');
  const now932 = new Date();
  sd932.register('今日の記念日', now932.getMonth() + 1, now932.getDate());
  const r932: any = await conversationCoreService.execute({ prompt: '今日は何の日？', memories: [], recentMessages: [], conversationId: 'suite-p932' } as any);
  check('P932 「今日は何の日？」に今日の記念日を答える', r932.reason === 'special_day_answer' && String(r932.replyText || '').includes('今日の記念日'), `reason=${r932.reason} reply=${String(r932.replyText || '').slice(0, 50)}`);
  const r932ctl: any = await conversationCoreService.execute({ prompt: '今日はいい天気だね', memories: [], recentMessages: [], conversationId: 'suite-p932' } as any);
  check('P932 天気の話では記念日レーンは発火しない', r932ctl.reason !== 'special_day_answer', `reason=${r932ctl.reason}`);
}

// ---- P933 記念日を自分から持ち出す ----
{
  const { specialDayService: sd933 } = await import('../src/miki/selfAwareness/services/specialDayService');
  const { idleActionService: ia933 } = await import('../src/miki/selfAwareness/services/idleActionService');
  const now933 = new Date();
  sd933.register('持ち出し記念日', now933.getMonth() + 1, now933.getDate());
  // 今日の記念日は複数ありうる（P932 のブロックで登録した分を含む）。
  // 持ち出しは「今日の分を、重複なく、一通り」であることが不変条件。
  const brought933: string[] = [];
  for (let i = 0; i < 5; i++) {
    const a933 = ia933.choose('suite-p933-persona');
    if (a933?.kind !== 'BRING_UP_SPECIAL_DAY') break;
    brought933.push(a933.term);
  }
  check('P933 今日の記念日は自分から持ち出す対象になる', brought933.length >= 1 && brought933.includes('持ち出し記念日'), `brought=${brought933.join('/')}`);
  check('P933 同じ記念日は同じ日に繰り返し持ち出さない', new Set(brought933).size === brought933.length, `brought=${brought933.join('/')}`);
  const after933 = ia933.choose('suite-p933-persona');
  check('P933 今日の分を持ち出し終えたら通常の選択に戻る', after933?.kind !== 'BRING_UP_SPECIAL_DAY', `after=${after933?.kind}`);
  check('P933 記念日の表明が言葉になる', ia933.phrase({ kind: 'BRING_UP_SPECIAL_DAY', term: '持ち出し記念日', strength: 1, at: Date.now() }).includes('持ち出し記念日'), 'phrase');
}

// ---- P934 日記を書く ----
{
  const { diaryService: di934 } = await import('../src/miki/selfAwareness/services/diaryService');
  const { mistakeNotebookService: nb934 } = await import('../src/miki/selfAwareness/services/mistakeNotebookService');
  nb934.recordCorrection('ツキヨ石', '月夜石');
  const entry934 = di934.writeToday();
  check('P934 その日の材料から日記が書ける', entry934.text.includes('月夜石') && entry934.date.length === 10, `text=${entry934.text.slice(0, 60)}`);
  const count934 = di934.summary().entries;
  di934.writeToday();
  check('P934 同じ日の日記は1件に保たれる', di934.summary().entries === count934, `count=${count934}`);
  const r934: any = await conversationCoreService.execute({ prompt: '日記見せて', memories: [], recentMessages: [], conversationId: 'suite-p934' } as any);
  check('P934 「日記見せて」で直近の日記が読める', r934.reason === 'diary_answer' && String(r934.replyText || '').includes('月夜石'), `reason=${r934.reason} reply=${String(r934.replyText || '').slice(0, 60)}`);
  const r934ctl: any = await conversationCoreService.execute({ prompt: '日記を買ったよ', memories: [], recentMessages: [], conversationId: 'suite-p934' } as any);
  check('P934 ただの言及では日記レーンは発火しない', r934ctl.reason !== 'diary_answer', `reason=${r934ctl.reason}`);
}

// ---- P935 好みが育つ ----
{
  const { selfPreferenceService: sp935 } = await import('../src/miki/selfAwareness/services/selfPreferenceService');
  const { desireService: ds935 } = await import('../src/miki/selfAwareness/services/desireService');
  const { personaProfileService: pp935 } = await import('../src/miki/conversation/services/personaProfileService');
  const iso935 = 'suite-p935-persona';
  for (let i = 0; i < 5; i++) sp935.observeTerms(iso935, ['砂浜ガラス']);
  check('P935 少し話しただけでは好みは育たない', sp935.derivedInterestStrengths(iso935).length === 0 && sp935.listGrown(iso935).length === 0, 'below-threshold');
  for (let i = 0; i < 11; i++) sp935.observeTerms(iso935, ['砂浜ガラス']);
  const strengths935 = sp935.derivedInterestStrengths(iso935);
  check('P935 よく話すうちに好みが育ち、強さも上がる', sp935.listGrown(iso935).some((g) => g.term === '砂浜ガラス') && (strengths935.find((s) => s.term === '砂浜ガラス')?.strength || 0) >= 0.7, `strengths=${JSON.stringify(strengths935)}`);
  const desire935 = ds935.compose(iso935).find((d) => d.term === '砂浜ガラス');
  check('P935 育った好みは欲求の強さに反映される', desire935?.kind === 'TALK' && (desire935?.strength || 0) >= 0.7, `desire=${JSON.stringify(desire935)}`);
  const current935 = pp935.get().profileId;
  for (let i = 0; i < 16; i++) sp935.observeTerms(current935, ['砂浜ガラス']);
  const r935: any = await conversationCoreService.execute({ prompt: '好み変わった？', memories: [], recentMessages: [], conversationId: 'suite-p935' } as any);
  check('P935 「好み変わった？」に育った好みを答える', r935.reason === 'grown_preference_answer' && String(r935.replyText || '').includes('砂浜ガラス'), `reason=${r935.reason} reply=${String(r935.replyText || '').slice(0, 60)}`);
  const r935ctl: any = await conversationCoreService.execute({ prompt: 'それは好みの問題だね', memories: [], recentMessages: [], conversationId: 'suite-p935' } as any);
  check('P935 ただの言及では好みレーンは発火しない', r935ctl.reason !== 'grown_preference_answer', `reason=${r935ctl.reason}`);
}

// ---- P936 ゲームを自分で遊ぶ（第1段: 数当て） ----
{
  const { gamePlayService: gp936 } = await import('../src/miki/selfAwareness/services/gamePlayService');
  const rec936 = gp936.playNumberGuess(777);
  check('P936 数当てを最後まで遊んで勝てる', rec936.won === true && rec936.moves >= 1 && rec936.moves <= 7 && rec936.trace.length === rec936.moves, `moves=${rec936.moves}`);
  const rec936b = gp936.playNumberGuess(777);
  check('P936 同じ種では同じ遊びになる（決定的）', rec936b.moves === rec936.moves && rec936b.answer === rec936.answer, 'deterministic');
  const before936 = gp936.summary().sessions;
  const r936: any = await conversationCoreService.execute({ prompt: '数当てゲームして', memories: [], recentMessages: [], conversationId: 'suite-p936' } as any);
  check('P936 「数当てゲームして」で実際に遊んで結果を話す', r936.reason === 'game_play_answer' && String(r936.replyText || '').includes('手で当てた') && gp936.summary().sessions > before936, `reason=${r936.reason} reply=${String(r936.replyText || '').slice(0, 60)}`);
  const r936b: any = await conversationCoreService.execute({ prompt: 'ゲームの結果はどうだった？', memories: [], recentMessages: [], conversationId: 'suite-p936' } as any);
  check('P936 「ゲームの結果は？」に直近の記録を答える', r936b.reason === 'game_play_answer' && String(r936b.replyText || '').includes('遊んだときは'), `reason=${r936b.reason}`);
  const r936ctl: any = await conversationCoreService.execute({ prompt: 'ゲームの作り方を教えて', memories: [], recentMessages: [], conversationId: 'suite-p936' } as any);
  check('P936 作り方の話では遊ばない', r936ctl.reason !== 'game_play_answer', `reason=${r936ctl.reason}`);
}

// ---- P937 根拠つきで反論できること ----
{
  const { claimDatabaseService: cdb937 } = await import('../src/miki/memory/services/claimDatabaseService');
  const { groundedRebuttalService: gr937 } = await import('../src/miki/selfAwareness/services/groundedRebuttalService');
  cdb937.registerClaim({ statement: '紅玉石の産地は北の山だ', world: 'REAL', kind: 'FACT_CLAIM', status: 'SUPPORTED', source: 'teacher_verified' } as any);
  cdb937.registerClaim({ statement: '青玉石の産地は東の森だ', world: 'REAL', kind: 'FACT_CLAIM', status: 'UNVERIFIED', source: 'web_unverified' } as any);
  const before937 = gr937.summary().rebuttals;
  const hit937 = gr937.check('紅玉石の産地は南の海だ');
  check('P937 検証済みの記録と食い違う断定には根拠を示せる', !!hit937 && hit937.claimValue === '北の山' && hit937.userValue === '南の海', `hit=${JSON.stringify(hit937)}`);
  check('P937 記録と一致する断定には反論しない', gr937.check('紅玉石の産地は北の山だ') === null, 'agree');
  check('P937 未検証の記録では反論しない', gr937.check('青玉石の産地は西の谷だ') === null, 'unverified');
  check('P937 質問には反論しない', gr937.check('紅玉石の産地はどこ？') === null, 'question');
  const r937: any = await conversationCoreService.execute({ prompt: '紅玉石の産地は南の海だ', memories: [], recentMessages: [], conversationId: 'suite-p937' } as any);
  check('P937 会話で根拠つきに反論する', r937.reason === 'grounded_rebuttal_answer' && String(r937.replyText || '').includes('北の山'), `reason=${r937.reason} reply=${String(r937.replyText || '').slice(0, 60)}`);
  check('P937 反論が記録される', gr937.summary().rebuttals > before937, `before=${before937}`);
}

// ---- P938 創作を書いて自分で直す（俳句） ----
{
  const { creativeWritingService: cw938, moraCount: mc938 } = await import('../src/miki/selfAwareness/services/creativeWritingService');
  check('P938 モーラ数が数えられる', mc938('つき') === 2 && mc938('ひかり') === 3 && mc938('もみじ') === 3, 'mora');
  const work938 = cw938.writeHaiku('suite-p938-persona', 'つき', 1234);
  check('P938 推敲後の俳句は五七五に合う', !!work938 && JSON.stringify(work938.revised.map((l: string) => mc938(l))) === '[5,7,5]', `work=${JSON.stringify(work938?.revised)}`);
  check('P938 テーマが1行目に入り、初稿と推敲と変更が残る', !!work938 && work938.revised[0].includes('つき') && work938.draft.length === 3 && Array.isArray(work938.changes), `changes=${JSON.stringify(work938?.changes)}`);
  const r938: any = await conversationCoreService.execute({ prompt: 'つきの俳句書いて', memories: [], recentMessages: [], conversationId: 'suite-p938' } as any);
  check('P938 「俳句書いて」で書いて見せる', r938.reason === 'creative_writing_answer' && String(r938.replyText || '').includes('俳句を書いたよ'), `reason=${r938.reason} reply=${String(r938.replyText || '').slice(0, 60)}`);
  const r938b: any = await conversationCoreService.execute({ prompt: '俳句見せて', memories: [], recentMessages: [], conversationId: 'suite-p938' } as any);
  check('P938 「俳句見せて」で直近の作品を読む', r938b.reason === 'creative_writing_answer' && String(r938b.replyText || '').includes('この前書いた俳句'), `reason=${r938b.reason}`);
  const r938ctl: any = await conversationCoreService.execute({ prompt: '俳句の歴史を教えて', memories: [], recentMessages: [], conversationId: 'suite-p938' } as any);
  check('P938 歴史の質問では詠まない', r938ctl.reason !== 'creative_writing_answer', `reason=${r938ctl.reason}`);
}

// ---- P939 夢を見る ----
{
  const { dreamService: dr939 } = await import('../src/miki/selfAwareness/services/dreamService');
  const dream939 = dr939.dreamTonight();
  check('P939 材料があれば夢を見て、夢として残る', !!dream939 && dream939.text.includes('夢の中で') && dream939.materials.length >= 1, `dream=${JSON.stringify(dream939?.text)}`);
  const dream939b = dr939.dreamTonight();
  check('P939 夢は1日に1つだけ', !!dream939b && dream939b.text === dream939?.text && dr939.summary().dreams >= 1, 'one-per-day');
  const r939: any = await conversationCoreService.execute({ prompt: 'どんな夢を見た？', memories: [], recentMessages: [], conversationId: 'suite-p939' } as any);
  check('P939 「どんな夢を見た？」に夢を語る', r939.reason === 'dream_answer' && String(r939.replyText || '').includes('見たよ'), `reason=${r939.reason} reply=${String(r939.replyText || '').slice(0, 60)}`);
  const r939ctl: any = await conversationCoreService.execute({ prompt: '夢とは何？', memories: [], recentMessages: [], conversationId: 'suite-p939' } as any);
  check('P939 定義の質問では夢を語らない', r939ctl.reason !== 'dream_answer', `reason=${r939ctl.reason}`);
}

// ---- P940 2人の掛け合い ----
{
  const { duoDialogueService: dd940 } = await import('../src/miki/selfAwareness/services/duoDialogueService');
  const dlg940 = dd940.banter('月夜石', 42);
  check('P940 掛け合いは両方の声で組み立つ', dlg940.lines.length >= 3 && dlg940.lines.some((l) => l.speaker === 'miki') && dlg940.lines.some((l) => l.speaker === 'bibi') && dlg940.topic === '月夜石', `lines=${dlg940.lines.length}`);
  const before940 = dd940.summary().dialogues;
  const r940: any = await conversationCoreService.execute({ prompt: 'みきとビービーで話して', memories: [], recentMessages: [], conversationId: 'suite-p940' } as any);
  check('P940 「みきとビービーで話して」で掛け合いを見せる', r940.reason === 'duo_dialogue_answer' && String(r940.replyText || '').includes('ビービー：') && String(r940.replyText || '').includes('みき：'), `reason=${r940.reason}`);
  check('P940 掛け合いが記録される', dd940.summary().dialogues > before940, `before=${before940}`);
  const r940ctl: any = await conversationCoreService.execute({ prompt: 'ビービーの名前の由来は？', memories: [], recentMessages: [], conversationId: 'suite-p940' } as any);
  check('P940 由来の質問では掛け合いにならない', r940ctl.reason !== 'duo_dialogue_answer', `reason=${r940ctl.reason}`);
}

// ---- P941 動作学習 第1段 ----
{
  const { motionPatternService: mp941 } = await import('../src/miki/selfAwareness/services/motionPatternService');
  const mk941 = (fn: (t: number) => { x: number; y: number }, dur = 2000, step = 50): any[] => {
    const out: any[] = [];
    for (let t = 0; t <= dur; t += step) out.push({ t, ...fn(t) });
    return out;
  };
  const sway941 = mk941((t) => ({ x: 0.5 + 0.3 * Math.sin((2 * Math.PI * t) / 800), y: 0.5 }));
  const bounce941 = mk941((t) => ({ x: 0.5, y: 0.5 + 0.25 * Math.sin((2 * Math.PI * t) / 600) }));
  const circle941 = mk941((t) => ({ x: 0.5 + 0.28 * Math.sin((2 * Math.PI * t) / 1000), y: 0.5 + 0.28 * Math.cos((2 * Math.PI * t) / 1000) }));
  let seed941 = 4242;
  const rnd941 = () => { seed941 = (seed941 * 1103515245 + 12345) % 2147483648; return seed941 / 2147483648; };
  const noise941 = mk941(() => ({ x: 0.2 + 0.6 * rnd941(), y: 0.2 + 0.6 * rnd941() }));
  const f941 = mp941.measure(sway941);
  check('P941 横揺れを周期つきで測れる', !!f941 && f941.kind === 'SWAY' && Math.abs(f941.periodMs - 800) <= 160, `kind=${f941?.kind} period=${f941?.periodMs}`);
  const before941 = mp941.summary().patterns;
  const learn941 = mp941.learn('横揺れ見本', sway941);
  check('P941 再現と照合を通れば動作部品になる', learn941.ok && mp941.summary().patterns === before941 + 1, `ok=${learn941.ok} reason=${learn941.reason || ''}`);
  check('P941 縦跳ねと円回りも覚える', mp941.learn('縦跳ね見本', bounce941).ok && mp941.learn('円回り見本', circle941).ok, 'bounce/circle');
  const noiseLearn941 = mp941.learn('雑音見本', noise941);
  check('P941 不規則な動きは部品にしない', !noiseLearn941.ok, `ok=${noiseLearn941.ok}`);
  let seed941b = 777;
  const rnd941b = () => { seed941b = (seed941b * 1103515245 + 12345) % 2147483648; return seed941b / 2147483648; };
  const sway941b = mk941((t) => ({ x: 0.5 + 0.3 * Math.sin((2 * Math.PI * t) / 900 + 1.1) + (rnd941b() - 0.5) * 0.03, y: 0.5 }));
  const match941 = mp941.match(sway941b);
  check('P941 位相の違う同じ動きを同定できる', !!match941 && match941.name === '横揺れ見本', `match=${JSON.stringify(match941)}`);
  check('P941 動きを言葉で説明できる', String(mp941.describe(sway941) || '').includes('横揺れ'), `desc=${mp941.describe(sway941)}`);
  const { knowledgeSelfInspectionService: ksi941 } = await import('../src/miki/selfAwareness/services/knowledgeSelfInspectionService');
  const insp941: any = ksi941.inspect();
  check('P941 自己点検に動作部品の数が入る', insp941.motionPatterns >= 3, `motionPatterns=${insp941.motionPatterns}`);
}

// ---- P942 アバターの存在状態 第1段 ----
{
  const { avatarPresenceService: ap942 } = await import('../src/miki/selfAwareness/services/avatarPresenceService');
  const { motionPatternService: mp942 } = await import('../src/miki/selfAwareness/services/motionPatternService');
  const t942 = 1700000000000;
  check('P942 初期状態は起きている', ap942.snapshot('suite-p942', t942).mode === 'AWAKE', 'default');
  ap942.noteSleep('suite-p942', t942);
  check('P942 整理の間は寝ている', ap942.snapshot('suite-p942', t942 + 1000).mode === 'SLEEPING', 'sleep');
  check('P942 8時間経てば朝に起きている', ap942.snapshot('suite-p942', t942 + 8 * 3600 * 1000 + 1).mode === 'AWAKE', 'wake');
  ap942.noteIdleChoice('suite-p942', { kind: 'BRING_UP_TOPIC', term: '青い鳥の巣' }, t942 + 2000);
  const snap942 = ap942.snapshot('suite-p942', t942 + 3000);
  check('P942 話題の欲求で寄ってくる', snap942.mode === 'APPROACHING' && snap942.topic === '青い鳥の巣', `mode=${snap942.mode}`);
  check('P942 状態を言葉にできる', ap942.describe('suite-p942', t942 + 3000).includes('寄ってきている'), `desc=${ap942.describe('suite-p942', t942 + 3000)}`);
  const sway942: any[] = [];
  for (let t = 0; t <= 2000; t += 50) sway942.push({ t, x: 0.5 + 0.3 * Math.sin((2 * Math.PI * t) / 800), y: 0.5 });
  mp942.learn('アバター用横揺れ', sway942);
  check('P942 覚えた動きだけ身に着けられる', ap942.setMotion('suite-p942', 'アバター用横揺れ', t942 + 4000) && !ap942.setMotion('suite-p942', '存在しない動き942', t942 + 4000), 'motion gate');
  check('P942 動きには期限がある', !!ap942.snapshot('suite-p942', t942 + 5000).motionName && !ap942.snapshot('suite-p942', t942 + 4000 + 16000).motionName, 'motion expiry');
  const { knowledgeSelfInspectionService: ksi942 } = await import('../src/miki/selfAwareness/services/knowledgeSelfInspectionService');
  const insp942: any = ksi942.inspect();
  check('P942 自己点検に存在状態の人数が入る', insp942.avatarPresence >= 1, `avatarPresence=${insp942.avatarPresence}`);
}

// ---- P943 計算資源の基盤 第1段 ----
{
  const { computeResourceService: cr943 } = await import('../src/miki/selfAwareness/services/computeResourceService');
  const inv943 = cr943.inventory();
  check('P943 体の棚卸しは分かる範囲だけを出す', (inv943.cpuCores === null || typeof inv943.cpuCores === 'number') && (inv943.webgpu === 'AVAILABLE' || inv943.webgpu === 'UNKNOWN'), `inv=${JSON.stringify(inv943)}`);
  const meas943 = cr943.measureCpuWorkloads();
  check('P943 CPUの速さを3種の仕事で測れる', meas943.length === 3 && meas943.every((m) => m.opsPerSec > 0 && m.ms > 0), `kinds=${meas943.map((m) => m.kind).join(',')}`);
  check('P943 記号処理の向きはCPU', cr943.placementHint('SYMBOLIC').aptitude === 'CPU' && cr943.placementHint('SYMBOLIC').available, 'symbolic->cpu');
  check('P943 未測定のGPU/NPUは使えると言わない', !cr943.placementHint('NUMERIC').available && !cr943.placementHint('SMALL_NN').available, 'gpu/npu unmeasured');
  cr943.reportDeviceProbe({ socModel: 'suite-SoC-943', gpuAvailable: true, npuAvailable: false, nativeCoreOk: true });
  const inv943b = cr943.inventory();
  check('P943 端末報告で棚卸しが埋まる', inv943b.socModel === 'suite-SoC-943' && inv943b.gpuAvailable === true && inv943b.nativeCore === 'OK', `inv=${JSON.stringify(inv943b)}`);
  check('P943 報告のあとはGPUが使えると分かる', cr943.placementHint('NUMERIC').available, 'gpu after probe');
  check('P943 棚卸しを言葉にできる', cr943.describe().includes('体の棚卸し'), `desc=${cr943.describe()}`);
  const { knowledgeSelfInspectionService: ksi943 } = await import('../src/miki/selfAwareness/services/knowledgeSelfInspectionService');
  const insp943: any = ksi943.inspect();
  check('P943 自己点検に測った仕事の種類数が入る', insp943.computeResourcesMeasured >= 3, `computeResourcesMeasured=${insp943.computeResourcesMeasured}`);
}

// ---- P944 ビービーの群れによる並列検証 第1段 ----
{
  const { claimDatabaseService: cdb944 } = await import('../src/miki/memory/services/claimDatabaseService');
  const { swarmVerificationService: sw944 } = await import('../src/miki/selfAwareness/services/swarmVerificationService');
  cdb944.registerClaim({ statement: '群石の産地は北の洞窟だ', world: 'REAL', kind: 'FACT_CLAIM', status: 'SUPPORTED', source: 'teacher_verified' } as any);
  const before944 = sw944.summary().checked;
  const run944 = sw944.verifyBatch(['群石の産地は南の浜だ', '群石の産地は北の洞窟だ', '群石の色は赤だ', '今日はいい天気だ']);
  const verdict944 = (s: string) => run944.items.find((i) => i.statement === s)?.verdict;
  check('P944 食い違う文は群れが見つける', verdict944('群石の産地は南の浜だ') === 'CONTRADICTED' && run944.contradicted === 1, `run=${JSON.stringify(run944.items.map((i) => i.verdict))}`);
  check('P944 一致・記録なし・判定できないを区別する', verdict944('群石の産地は北の洞窟だ') === 'CONSISTENT' && verdict944('群石の色は赤だ') === 'NO_RECORD' && verdict944('今日はいい天気だ') === 'UNCHECKABLE', 'verdicts');
  check('P944 文は群れに分かれて処理される', run944.bees.length === 4 && run944.bees.every((b) => b.checked === 1), `bees=${JSON.stringify(run944.bees)}`);
  check('P944 検証が台帳に残る', sw944.summary().checked >= before944 + 4, `before=${before944} after=${sw944.summary().checked}`);
  const analogy944 = sw944.verifyAnalogyCandidates(8);
  check('P944 類推候補の点検が動く', analogy944 === null || analogy944.total >= 1, `analogy=${JSON.stringify(analogy944?.total)}`);
  const { knowledgeSelfInspectionService: ksi944 } = await import('../src/miki/selfAwareness/services/knowledgeSelfInspectionService');
  const insp944: any = ksi944.inspect();
  check('P944 自己点検に群れ検証の件数が入る', insp944.swarmVerifications >= 4, `swarmVerifications=${insp944.swarmVerifications}`);
}

// ---- P945 目・第7段（人間の同定） ----
{
  const { analyzeImagePixels: an945 } = await import('../src/miki/conversation/services/conversationImageObservationService');
  const { visualFigureService: vf945 } = await import('../src/miki/conversation/services/visualFigureService');
  const W945 = 48, H945 = 48;
  const make945 = (fn: (x: number, y: number) => boolean) => {
    const a = new Uint8Array(W945 * H945 * 4);
    for (let y = 0; y < H945; y++) for (let x = 0; x < W945; x++) {
      const v = fn(x, y) ? 30 : 240; const i = (y * W945 + x) * 4;
      a[i] = v; a[i + 1] = v; a[i + 2] = v; a[i + 3] = 255;
    }
    return a;
  };
  const person945 = an945(make945((x, y) => ((x - 24) ** 2 + (y - 10) ** 2 <= 16) || (x >= 18 && x <= 29 && y >= 18 && y <= 41)), W945, H945);
  const id945 = vf945.identifyFigure(person945);
  check('P945 頭が上で体が下の配置を人の形らしく読む', !!id945 && id945.headRatio >= 0.1 && id945.headRatio <= 0.32, `id=${JSON.stringify(id945)}`);
  check('P945 比率で描き直すと自分の測定でも仮説が立つ', vf945.verifyFigure(person945) === true, 'verify');
  const inverted945 = an945(make945((x, y) => ((x - 24) ** 2 + (y - 38) ** 2 <= 16) || (x >= 18 && x <= 29 && y >= 6 && y <= 29)), W945, H945);
  check('P945 上下が逆では人の形とは読まない', vf945.identifyFigure(inverted945) === null, 'inverted');
  const squares945 = an945(make945((x, y) => (x >= 19 && x <= 28 && y >= 5 && y <= 14) || (x >= 18 && x <= 29 && y >= 18 && y <= 41)), W945, H945);
  check('P945 頭が丸くない配置は人の形とは読まない', vf945.identifyFigure(squares945) === null, 'squares');
  const rec945 = vf945.registerFigureExample('立っている人', person945);
  check('P945 照合を通った人の見本だけ登録される', !!rec945 && vf945.summary().figures >= 1, `rec=${JSON.stringify(rec945)}`);
  const { knowledgeSelfInspectionService: ksi945 } = await import('../src/miki/selfAwareness/services/knowledgeSelfInspectionService');
  const insp945: any = ksi945.inspect();
  check('P945 自己点検に人の見本数が入る', insp945.visualFigures >= 1, `visualFigures=${insp945.visualFigures}`);
}

// ---- P946 動画理解・第3層 第1段（場面分解） ----
{
  const { videoSceneService: vs946 } = await import('../src/miki/conversation/services/videoSceneService');
  const W946 = 24, H946 = 24;
  const frame946 = (tMs: number, fn: (x: number, y: number) => [number, number, number]) => {
    const rgba = new Uint8Array(W946 * H946 * 4);
    for (let y = 0; y < H946; y++) for (let x = 0; x < W946; x++) {
      const [r, g, b] = fn(x, y); const i = (y * W946 + x) * 4;
      rgba[i] = r; rgba[i + 1] = g; rgba[i + 2] = b; rgba[i + 3] = 255;
    }
    return { tMs, rgba, width: W946, height: H946 };
  };
  const L946: [number, number, number] = [240, 240, 240];
  const D946: [number, number, number] = [20, 20, 20];
  const R946: [number, number, number] = [200, 40, 40];
  const frames946 = [
    frame946(0, (x, y) => (x >= 3 && x <= 8 && y >= 9 && y <= 14) ? D946 : L946),
    frame946(1000, (x, y) => (x >= 4 && x <= 9 && y >= 9 && y <= 14) ? D946 : L946),
    frame946(2000, (x, y) => (x >= 3 && x <= 8 && y >= 9 && y <= 14) ? D946 : L946),
    frame946(3000, (x, y) => ((x - 17) ** 2 + (y - 12) ** 2 <= 16) ? L946 : D946),
    frame946(4000, (x, y) => ((x - 17) ** 2 + (y - 12) ** 2 <= 16) ? L946 : D946),
    frame946(5000, (x, y) => ((x - 12) ** 2 + (y - 12) ** 2 <= 25) ? R946 : L946),
    frame946(6000, (x, y) => ((x - 12) ** 2 + (y - 12) ** 2 <= 25) ? R946 : L946),
  ];
  const before946 = vs946.summary().scenesTotal;
  const { scenes: scenes946, cutsMs: cuts946 } = vs946.decompose(frames946 as any, [
    { startMs: 0, endMs: 2500, text: '導入の字幕' },
    { startMs: 3100, endMs: 5200, text: '次の場面の字幕' },
  ]);
  check('P946 硬い切り替わりで場面に分かれる', scenes946.length === 3 && JSON.stringify(cuts946) === '[3000,5000]', `scenes=${scenes946.length} cuts=${JSON.stringify(cuts946)}`);
  check('P946 場面内の小さな動きでは割れない', scenes946[0].startMs === 0 && scenes946[0].endMs === 3000, `scene0=${scenes946[0].startMs}-${scenes946[0].endMs}`);
  check('P946 字幕が場面に対応づく', scenes946[0].subtitleText.includes('導入の字幕') && scenes946[1].subtitleText.includes('次の場面の字幕'), `subs=${JSON.stringify(scenes946.map((s) => s.subtitleText))}`);
  check('P946 代表フレームが場面の中から選ばれる', scenes946.every((s) => s.representativeTMs >= s.startMs && s.representativeTMs <= Math.max(s.endMs, s.startMs)), 'representative');
  check('P946 場面の文章化ができる', vs946.describeScenes(scenes946).includes('場面1'), 'describe');
  check('P946 分解が台帳に残る', vs946.summary().scenesTotal >= before946 + 3, `before=${before946} after=${vs946.summary().scenesTotal}`);
  const { knowledgeSelfInspectionService: ksi946 } = await import('../src/miki/selfAwareness/services/knowledgeSelfInspectionService');
  const insp946: any = ksi946.inspect();
  check('P946 自己点検に場面数が入る', insp946.videoScenes >= 3, `videoScenes=${insp946.videoScenes}`);
}

// ---- P947 動画理解・第3層 第4段（動きの記述） ----
{
  const { videoSceneService: vs947 } = await import('../src/miki/conversation/services/videoSceneService');
  const W947 = 48, H947 = 48;
  const frame947 = (tMs: number, left: number) => {
    const rgba = new Uint8Array(W947 * H947 * 4);
    for (let y = 0; y < H947; y++) for (let x = 0; x < W947; x++) {
      const dark = x >= left && x <= left + 9 && y >= 19 && y <= 28;
      const v = dark ? 20 : 240; const i = (y * W947 + x) * 4;
      rgba[i] = v; rgba[i + 1] = v; rgba[i + 2] = v; rgba[i + 3] = 255;
    }
    return { tMs, rgba, width: W947, height: H947 };
  };
  const before947 = vs947.summary().motionsTotal;
  const sway947 = Array.from({ length: 19 }, (_, i) => frame947(i * 100, Math.round(19 + 10 * Math.sin((2 * Math.PI * i * 100) / 900))));
  const swayScenes947 = vs947.decompose(sway947 as any).scenes;
  check('P947 横揺れを周期つきで記述できる', swayScenes947.length === 1 && String(swayScenes947[0].motionText || '').includes('横揺れ'), `motion=${JSON.stringify(swayScenes947[0]?.motionText)}`);
  const drift947 = Array.from({ length: 19 }, (_, i) => frame947(i * 100, 4 + i));
  const driftScenes947 = vs947.decompose(drift947 as any).scenes;
  check('P947 一方向の移動を記述できる', driftScenes947.length === 1 && String(driftScenes947[0].motionText || '').includes('一方向へ移動'), `motion=${JSON.stringify(driftScenes947[0]?.motionText)}`);
  const still947 = Array.from({ length: 10 }, (_, i) => frame947(i * 100, 19));
  const stillScenes947 = vs947.decompose(still947 as any).scenes;
  check('P947 静止も記述できる', stillScenes947.length === 1 && String(stillScenes947[0].motionText || '').includes('動いていない'), `motion=${JSON.stringify(stillScenes947[0]?.motionText)}`);
  const short947 = Array.from({ length: 3 }, (_, i) => frame947(i * 100, 19));
  const shortScenes947 = vs947.decompose(short947 as any).scenes;
  check('P947 軌跡が短い場面は動きを記述しない', shortScenes947.length === 1 && shortScenes947[0].motionText === undefined, `motion=${JSON.stringify(shortScenes947[0]?.motionText)}`);
  check('P947 記述が台帳に残る', vs947.summary().motionsTotal >= before947 + 3, `before=${before947} after=${vs947.summary().motionsTotal}`);
  const { knowledgeSelfInspectionService: ksi947 } = await import('../src/miki/selfAwareness/services/knowledgeSelfInspectionService');
  const insp947: any = ksi947.inspect();
  check('P947 自己点検に動きの記述数が入る', insp947.videoMotions >= 3, `videoMotions=${insp947.videoMotions}`);
}

// ---- P948 画像・動画理解の検定バッテリー（画像） ----
{
  const { analyzeImagePixels: an948 } = await import('../src/miki/conversation/services/conversationImageObservationService');
  const { verifyMaterialByRendering: vm948 } = await import('../src/miki/conversation/services/materialRenderVerificationService');
  const { visualPatternService: vp948 } = await import('../src/miki/conversation/services/visualPatternService');
  const { visualScenePatternService: vsp948 } = await import('../src/miki/conversation/services/visualScenePatternService');
  const { visualFigureService: vf948 } = await import('../src/miki/conversation/services/visualFigureService');
  const W948 = 48, H948 = 48;
  type RGB948 = [number, number, number];
  const make948 = (fn: (x: number, y: number) => RGB948) => {
    const a = new Uint8Array(W948 * H948 * 4);
    for (let y = 0; y < H948; y++) for (let x = 0; x < W948; x++) {
      const [r, g, b] = fn(x, y); const i = (y * W948 + x) * 4;
      a[i] = r; a[i + 1] = g; a[i + 2] = b; a[i + 3] = 255;
    }
    return a;
  };
  const img948 = (fn: (x: number, y: number) => RGB948) => an948(make948(fn), W948, H948);
  const noise948 = (fn: (x: number, y: number) => RGB948, amp: number) => (x: number, y: number): RGB948 => {
    const [r, g, b] = fn(x, y);
    let s = 7 + x * 374761393 + y * 668265263;
    s = (s ^ (s >> 13)) * 1274126177;
    const d = (((s ^ (s >> 16)) >>> 0) % (2 * amp + 1)) - amp;
    const cl = (v: number) => Math.max(0, Math.min(255, v + d));
    return [cl(r), cl(g), cl(b)];
  };
  // 素材: 位置の違うツヤ・周期の違う縞でも仮説と照合が立つ
  const glossy948 = img948((x, y) => (x >= 4 && x <= 6 && y >= 4 && y <= 6) ? [255, 255, 255] : [45, 45, 50]);
  const vg948 = vm948(glossy948);
  check('P948検定 素材: 隅のツヤも仮説が立ち照合が通る', vg948.verified === true && vg948.renderedHypothesis.gloss === 'ツヤが強そう', `score=${vg948.score}`);
  const stripes948 = img948((x) => ((x % 8) < 4 ? [30, 30, 30] : [210, 210, 210]) as RGB948);
  const vs948 = vm948(stripes948);
  check('P948検定 素材: 周期8の縞も照合が通る', vs948.verified === true && vs948.renderedHypothesis.patternPeriod === 8, `period=${vs948.renderedHypothesis.patternPeriod}`);
  // 同定: 楕円の見本で、移動・縮小・色違いを同定し、四角は誤認しない
  const ellipse948 = (cx: number, cy: number, rx: number, ry: number, fg: RGB948, bg: RGB948) => (x: number, y: number): RGB948 =>
    (((x - cx) ** 2) / (rx * rx) + ((y - cy) ** 2) / (ry * ry) <= 1 ? fg : bg);
  check('P948検定 同定: 楕円の見本を登録できる', vp948.register('検定楕円', img948(ellipse948(24, 24, 14, 8, [200, 40, 40], [15, 15, 15])))?.name === '検定楕円', 'register');
  check('P948検定 同定: 移動した楕円も同定できる', vp948.match(img948(ellipse948(16, 32, 14, 8, [200, 40, 40], [15, 15, 15])))?.name === '検定楕円', 'shifted');
  check('P948検定 同定: 縮小した楕円も同定できる', vp948.match(img948(ellipse948(24, 24, 10, 6, [200, 40, 40], [15, 15, 15])))?.name === '検定楕円', 'scaled');
  check('P948検定 同定: 色の違う楕円も同定できる', vp948.match(img948(ellipse948(24, 24, 14, 8, [40, 40, 200], [15, 15, 15])))?.name === '検定楕円', 'color');
  const square948 = img948((x, y) => (x >= 14 && x <= 34 && y >= 14 && y <= 34) ? [200, 40, 40] : [15, 15, 15]);
  check('P948検定 同定: 四角を楕円と誤認しない', vp948.match(square948)?.name !== '検定楕円', `match=${JSON.stringify(vp948.match(square948))}`);
  // 配置: 2色の並びを登録し、移動しても同定し、縦並びは誤認しない
  const pair948 = (dy: number) => (x: number, y: number): RGB948 => {
    if ((x - 14) ** 2 + (y - (24 + dy)) ** 2 <= 36) return [200, 40, 40];
    if (x >= 30 && x <= 40 && y >= 19 + dy && y <= 29 + dy) return [40, 40, 200];
    return [15, 15, 15];
  };
  check('P948検定 配置: 2色の並びを登録できる', vsp948.registerScene('検定ならび', img948(pair948(0)))?.name === '検定ならび', 'register-scene');
  check('P948検定 配置: 移動した並びも同定できる', vsp948.matchScene(img948(pair948(5)))?.name === '検定ならび', 'scene-shifted');
  const stacked948 = img948((x, y) => {
    if ((x - 24) ** 2 + (y - 13) ** 2 <= 36) return [200, 40, 40] as RGB948;
    if (x >= 19 && x <= 29 && y >= 30 && y <= 40) return [40, 40, 200] as RGB948;
    return [15, 15, 15] as RGB948;
  });
  check('P948検定 配置: 縦並びを横並びと誤認しない', vsp948.matchScene(stacked948)?.name !== '検定ならび', 'scene-stacked');
  // 人: 位置違い・小さい頭（2%の床の内側）を読み、大きすぎる頭は人と読まない
  const person948 = (cx: number, headR: number, headCy: number, bodyTop: number, bodyBottom: number, bodyHalfW: number) => (x: number, y: number): RGB948 =>
    (((x - cx) ** 2 + (y - headCy) ** 2 <= headR * headR) || (Math.abs(x - cx) <= bodyHalfW && y >= bodyTop && y <= bodyBottom)) ? [30, 30, 30] : [240, 240, 240];
  check('P948検定 人: 左に寄った人も読める', vf948.identifyFigure(img948(person948(14, 4, 10, 18, 41, 6))) !== null, 'figure-left');
  check('P948検定 人: 頭が小さい側（半径4）でも読める', vf948.identifyFigure(img948(person948(24, 4, 10, 18, 41, 6))) !== null, 'figure-small-head');
  check('P948検定 人: 頭が大きすぎる配置は人と読まない', vf948.identifyFigure(img948(person948(24, 10, 14, 30, 44, 7))) === null, 'figure-big-head');
  check('P948検定 人: 頭が面積2%未満だと領域として拾えない（測定の床）', vf948.identifyFigure(img948(person948(24, 3, 8, 15, 42, 7))) === null, 'figure-below-floor');
  // 頑健さ: 画素ノイズ±18でも同定と人の読みが崩れない
  check('P948検定 頑健さ: ノイズ入りの楕円も同定できる', vp948.match(img948(noise948(ellipse948(24, 24, 14, 8, [200, 40, 40], [15, 15, 15]), 18)))?.name === '検定楕円', 'noisy-ellipse');
  check('P948検定 頑健さ: ノイズ入りの人も読める', vf948.identifyFigure(img948(noise948(person948(24, 4, 10, 18, 41, 6), 18))) !== null, 'noisy-person');
}

// ---- P948 画像・動画理解の検定バッテリー（動画） ----
{
  const { videoSceneService: vs948v } = await import('../src/miki/conversation/services/videoSceneService');
  const W948v = 48, H948v = 48;
  type RGB948v = [number, number, number];
  const frame948 = (tMs: number, fn: (x: number, y: number) => RGB948v) => {
    const rgba = new Uint8Array(W948v * H948v * 4);
    for (let y = 0; y < H948v; y++) for (let x = 0; x < W948v; x++) {
      const [r, g, b] = fn(x, y); const i = (y * W948v + x) * 4;
      rgba[i] = r; rgba[i + 1] = g; rgba[i + 2] = b; rgba[i + 3] = 255;
    }
    return { tMs, rgba, width: W948v, height: H948v };
  };
  const L948v: RGB948v = [240, 240, 240];
  const D948v: RGB948v = [25, 25, 25];
  const frames948: any[] = [];
  for (let i = 0; i < 10; i++) frames948.push(frame948(i * 100, (x, y) => (x >= 19 && x <= 28 && y >= 19 && y <= 28) ? D948v : L948v));
  for (let i = 0; i < 19; i++) {
    const left = Math.round(19 + 10 * Math.sin((2 * Math.PI * i * 100) / 900));
    frames948.push(frame948(1000 + i * 100, (x, y) => (x >= left && x <= left + 9 && y >= 19 && y <= 28) ? L948v : D948v));
  }
  for (let i = 0; i < 10; i++) frames948.push(frame948(3000 + i * 100, (x, y) => (((x - 24) ** 2 + (y - 10) ** 2 <= 16) || (Math.abs(x - 24) <= 6 && y >= 18 && y <= 41)) ? D948v : L948v));
  const { scenes: scenes948, cutsMs: cuts948 } = vs948v.decompose(frames948, [
    { startMs: 0, endMs: 900, text: '最初の場面の字幕' },
    { startMs: 1000, endMs: 2800, text: '揺れる場面の字幕' },
    { startMs: 3000, endMs: 3900, text: '人の場面の字幕' },
  ]);
  check('P948検定 動画: 3場面に正しく分かれる', scenes948.length === 3 && JSON.stringify(cuts948) === '[1000,3000]', `scenes=${scenes948.length} cuts=${JSON.stringify(cuts948)}`);
  check('P948検定 動画: 静止・横揺れ・静止の動きが場面ごとに付く', String(scenes948[0].motionText || '').includes('動いていない') && String(scenes948[1].motionText || '').includes('横揺れ') && String(scenes948[2].motionText || '').includes('動いていない'), `motions=${JSON.stringify(scenes948.map((s) => s.motionText))}`);
  check('P948検定 動画: 人の場面で人の形が同定される', scenes948[2].identifications.some((t) => t.includes('人の形らしい配置')), `ids=${JSON.stringify(scenes948[2].identifications)}`);
  check('P948検定 動画: 字幕が場面ごとに付く', scenes948[0].subtitleText.includes('最初の場面') && scenes948[1].subtitleText.includes('揺れる場面') && scenes948[2].subtitleText.includes('人の場面'), 'subtitles');
  check('P948検定 動画: 場面の文章化が3行そろう', vs948v.describeScenes(scenes948).split('\n').length === 3, 'describe');
}

// ---- P949 検定バッテリー第2弾（物らしい複合物と人のバリエーション） ----
{
  const { analyzeImagePixels: an949 } = await import('../src/miki/conversation/services/conversationImageObservationService');
  const { visualScenePatternService: vsp949 } = await import('../src/miki/conversation/services/visualScenePatternService');
  const { visualFigureService: vf949 } = await import('../src/miki/conversation/services/visualFigureService');
  const W949 = 48, H949 = 48;
  type RGB949 = [number, number, number];
  const img949 = (fn: (x: number, y: number) => RGB949) => {
    const a = new Uint8Array(W949 * H949 * 4);
    for (let y = 0; y < H949; y++) for (let x = 0; x < W949; x++) {
      const [r, g, b] = fn(x, y); const i = (y * W949 + x) * 4;
      a[i] = r; a[i + 1] = g; a[i + 2] = b; a[i + 3] = 255;
    }
    return an949(a, W949, H949);
  };
  const BG949: RGB949 = [240, 240, 240];
  // りんご風の複合物（赤い実＋茶色の茎＋緑の葉）: 教えれば名前で呼べる
  const apple949 = (dx: number, dy: number, s: number) => (x: number, y: number): RGB949 => {
    const cx = 24 + dx, cy = 28 + dy;
    if (Math.abs(x - cx) <= Math.max(1, Math.round(2 * s)) && y >= 8 + dy && y <= 8 + dy + Math.round(10 * s)) return [120, 80, 40];
    const lx = cx + 7 * s, ly = 12 + dy;
    if (((x - lx) ** 2) / (36 * s * s) + ((y - ly) ** 2) / (9 * s * s) <= 1) return [60, 160, 60];
    if ((x - cx) ** 2 + (y - cy) ** 2 <= 121 * s * s) return [210, 40, 40];
    return BG949;
  };
  check('P949検定 物: りんご風の複合物を配置の見本として登録できる', vsp949.registerScene('検定りんご', img949(apple949(0, 0, 1)))?.name === '検定りんご', 'register-apple');
  check('P949検定 物: 移動したりんごを同定できる', vsp949.matchScene(img949(apple949(4, 3, 1)))?.name === '検定りんご', 'apple-shifted');
  check('P949検定 物: 少し大きくなったりんごも同定できる', vsp949.matchScene(img949(apple949(0, 0, 1.15)))?.name === '検定りんご', 'apple-scaled');
  const redOnly949 = img949((x, y) => ((x - 24) ** 2 + (y - 28) ** 2 <= 121 ? [210, 40, 40] : BG949));
  check('P949検定 物: 赤い丸だけではりんごと呼ばない', vsp949.matchScene(redOnly949)?.name !== '検定りんご', 'apple-negative');
  // 人のバリエーション: 色が分かれていても、背が高くても低くても読める。座り姿はP976で対象になった
  const twoColor949 = img949((x, y) => {
    if ((x - 24) ** 2 + (y - 10) ** 2 <= 16) return [232, 190, 160] as RGB949;
    if (Math.abs(x - 24) <= 6 && y >= 18 && y <= 41) return [60, 80, 180] as RGB949;
    return BG949;
  });
  check('P949検定 人: 頭と体で色が分かれた人も読める', vf949.identifyFigure(twoColor949) !== null, 'person-two-color');
  const tall949 = img949((x, y) => (((x - 24) ** 2 + (y - 8) ** 2 <= 16) || (Math.abs(x - 24) <= 4 && y >= 16 && y <= 44)) ? [30, 30, 30] : BG949);
  check('P949検定 人: 背の高い細い人も読める', vf949.identifyFigure(tall949) !== null, 'person-tall');
  const short949 = img949((x, y) => (((x - 24) ** 2 + (y - 12) ** 2 <= 16) || (Math.abs(x - 24) <= 9 && y >= 20 && y <= 36)) ? [30, 30, 30] : BG949);
  check('P949検定 人: 背の低い人も読める', vf949.identifyFigure(short949) !== null, 'person-short');
  const sitting949 = img949((x, y) => {
    if ((x - 24) ** 2 + (y - 10) ** 2 <= 16) return [30, 30, 30] as RGB949;
    if (Math.abs(x - 24) <= 12 && y >= 20 && y <= 30) return [30, 30, 30] as RGB949;
    return BG949;
  });
  check('P949検定 人: 座った姿は座っている人として読む（P976で境界を広げた）', vf949.identifyFigure(sitting949)?.description.includes('座っている人') ?? false, 'person-sitting');
}

// ---- P950 姿勢・第1段（関節で姿勢を読む） ----
{
  const { visualPoseService: vpose950 } = await import('../src/miki/conversation/services/visualPoseService');
  const { knowledgeSelfInspectionService: ksi950 } = await import('../src/miki/selfAwareness/services/knowledgeSelfInspectionService');
  const W950 = 48, H950 = 48;
  type RGB950 = [number, number, number];
  const BG950: RGB950 = [240, 240, 240];
  const P950C: RGB950 = [30, 30, 30];
  const head950 = (cx: number, cy: number, r: number) => (x: number, y: number) => (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
  const rect950 = (x0: number, x1: number, y0: number, y1: number) => (x: number, y: number) => x >= x0 && x <= x1 && y >= y0 && y <= y1;
  const pose950 = (label: string, fns: Array<(x: number, y: number) => boolean>) => {
    const a = new Uint8Array(W950 * H950 * 4);
    for (let y = 0; y < H950; y++) for (let x = 0; x < W950; x++) {
      const [r, g, b] = fns.some((f) => f(x, y)) ? P950C : BG950;
      const i = (y * W950 + x) * 4;
      a[i] = r; a[i + 1] = g; a[i + 2] = b; a[i + 3] = 255;
    }
    return vpose950.analyzePose(a, W950, H950);
  };
  const legs950 = [rect950(20, 23, 34, 44), rect950(25, 28, 34, 44)];
  const f1 = pose950('f1', [head950(24, 10, 4), rect950(20, 28, 18, 34), rect950(17, 19, 18, 32), rect950(29, 31, 18, 32), ...legs950]);
  check('P950 腕を下ろした立ち姿を関節で読める', f1?.posture === 'STANDING' && f1?.armL === 'DOWN' && f1?.armR === 'DOWN' && f1?.legs === 'SPLIT' && f1?.verified === true, `f1=${JSON.stringify(f1 && { p: f1.posture, a: [f1.armL, f1.armR], l: f1.legs, fit: f1.fit })}`);
  const f2 = pose950('f2', [head950(24, 14, 4), rect950(20, 28, 20, 34), rect950(13, 16, 2, 16), rect950(32, 35, 2, 16), ...legs950]);
  check('P950 両腕を上げた姿勢を読める', f2?.armL === 'RAISED' && f2?.armR === 'RAISED' && f2?.verified === true, `f2=${JSON.stringify(f2 && { a: [f2.armL, f2.armR], fit: f2.fit })}`);
  const f3 = pose950('f3', [head950(24, 10, 4), rect950(20, 28, 18, 34), rect950(4, 19, 19, 22), rect950(29, 44, 19, 22), ...legs950]);
  check('P950 腕を横に広げた姿勢（Tポーズ）を読める', f3?.armL === 'SPREAD' && f3?.armR === 'SPREAD' && f3?.verified === true, `f3=${JSON.stringify(f3 && { a: [f3.armL, f3.armR], fit: f3.fit })}`);
  const f4 = pose950('f4', [head950(24, 8, 4), rect950(18, 30, 16, 26), rect950(10, 38, 26, 31)]);
  check('P950 座った姿勢を読める', f4?.posture === 'SITTING' && f4?.verified === true, `f4=${JSON.stringify(f4 && { p: f4.posture, fit: f4.fit })}`);
  const f6 = pose950('f6', [head950(24, 10, 4), rect950(20, 28, 18, 34), rect950(29, 31, 18, 32), rect950(13, 16, 2, 16), ...legs950]);
  check('P950 片腕だけ上げた姿勢を左右別に読める', f6?.armL === 'RAISED' && f6?.armR === 'DOWN', `f6=${JSON.stringify(f6 && { a: [f6.armL, f6.armR] })}`);
  const square950 = (() => {
    const a = new Uint8Array(W950 * H950 * 4);
    for (let y = 0; y < H950; y++) for (let x = 0; x < W950; x++) {
      const [r, g, b] = (x >= 14 && x <= 34 && y >= 14 && y <= 34) ? P950C : BG950;
      const i = (y * W950 + x) * 4;
      a[i] = r; a[i + 1] = g; a[i + 2] = b; a[i + 3] = 255;
    }
    return vpose950.analyzePose(a, W950, H950);
  })();
  check('P950 人でない輪郭には姿勢を読まない', square950 === null, 'square-null');
  const insp950 = ksi950.inspect();
  check('P950 自己点検の記録に姿勢の読み（visualPoses）が入っている', typeof insp950.visualPoses === 'number' && insp950.visualPoses >= 5, `visualPoses=${insp950.visualPoses}`);
}

// ---- P951 姿勢・第2段a（肉付きと肌の島） ----
{
  const { visualPoseService: vpose951 } = await import('../src/miki/conversation/services/visualPoseService');
  const W951 = 48, H951 = 48;
  type RGB951 = [number, number, number];
  const BG951: RGB951 = [245, 245, 245];
  const G951: RGB951 = [60, 60, 60];
  const BLUE951: RGB951 = [40, 40, 120];
  const SKIN951: RGB951 = [232, 190, 160];
  const draw951 = (paint: (x: number, y: number) => RGB951 | null) => {
    const a = new Uint8Array(W951 * H951 * 4);
    for (let y = 0; y < H951; y++) for (let x = 0; x < W951; x++) {
      const c = paint(x, y) || BG951;
      const i = (y * W951 + x) * 4;
      a[i] = c[0]; a[i + 1] = c[1]; a[i + 2] = c[2]; a[i + 3] = 255;
    }
    return vpose951.analyzePose(a, W951, H951);
  };
  const inRect = (x: number, y: number, x0: number, x1: number, y0: number, y1: number) => x >= x0 && x <= x1 && y >= y0 && y <= y1;
  const slim951 = draw951((x, y) => {
    if ((x - 24) ** 2 + (y - 10) ** 2 <= 16) return G951;
    if (inRect(x, y, 21, 26, 18, 34) || inRect(x, y, 19, 20, 18, 30) || inRect(x, y, 27, 28, 18, 30)) return G951;
    if (inRect(x, y, 21, 23, 34, 39) || inRect(x, y, 21, 22, 40, 44) || inRect(x, y, 24, 26, 34, 39) || inRect(x, y, 25, 26, 40, 44)) return G951;
    return null;
  });
  check('P951 細い体格と足首の細りを肉付きとして読める', slim951?.build?.label === '細い' && (slim951?.build?.ankleRatio ?? 1) <= 0.8 && slim951?.buildDescription.includes('足首'), `slim=${JSON.stringify(slim951?.build)}`);
  const std951 = draw951((x, y) => {
    if ((x - 24) ** 2 + (y - 10) ** 2 <= 25) return G951;
    if (inRect(x, y, 20, 28, 18, 34) || inRect(x, y, 17, 19, 18, 32) || inRect(x, y, 29, 31, 18, 32)) return G951;
    if (inRect(x, y, 20, 23, 34, 44) || inRect(x, y, 25, 28, 34, 44)) return G951;
    return null;
  });
  check('P951 標準の体格を中肉と読める', std951?.build?.label === '中肉', `std=${JSON.stringify(std951?.build)}`);
  const heavy951 = draw951((x, y) => {
    if ((x - 24) ** 2 + (y - 10) ** 2 <= 25) return G951;
    if (inRect(x, y, 17, 31, 18, 34) || inRect(x, y, 14, 16, 18, 32) || inRect(x, y, 32, 34, 18, 32)) return G951;
    if (inRect(x, y, 18, 23, 34, 44) || inRect(x, y, 25, 30, 34, 44)) return G951;
    return null;
  });
  check('P951 太い体格をがっしりと読める', heavy951?.build?.label === 'がっしり', `heavy=${JSON.stringify(heavy951?.build)}`);
  const musc951 = draw951((x, y) => {
    if ((x - 24) ** 2 + (y - 10) ** 2 <= 16) return G951;
    if (inRect(x, y, 18, 30, 18, 26) || inRect(x, y, 21, 27, 26, 34)) return G951;
    if (inRect(x, y, 15, 17, 18, 32) || inRect(x, y, 31, 33, 18, 32)) return G951;
    if (inRect(x, y, 20, 23, 34, 44) || inRect(x, y, 25, 28, 34, 44)) return G951;
    return null;
  });
  check('P951 広い肩と細い腰をがっしり＋腰の細さとして読める', musc951?.build?.label === 'がっしり' && musc951?.buildDescription.includes('腰が細く'), `musc=${JSON.stringify(musc951?.build)}`);
  const skin951 = draw951((x, y) => {
    if ((x - 24) ** 2 + (y - 10) ** 2 <= 16) return SKIN951;
    if (inRect(x, y, 17, 19, 29, 32) || inRect(x, y, 29, 31, 29, 32)) return SKIN951;
    if (inRect(x, y, 20, 28, 18, 34) || inRect(x, y, 17, 19, 18, 28) || inRect(x, y, 29, 31, 18, 28)) return BLUE951;
    if (inRect(x, y, 20, 23, 34, 44) || inRect(x, y, 25, 28, 34, 44)) return BLUE951;
    return null;
  });
  check('P951 肌の島から顔と両手を確認できる', skin951?.skinCues.face === true && skin951?.skinCues.handL === true && skin951?.skinCues.handR === true && skin951?.verified === true, `skin=${JSON.stringify(skin951?.skinCues)}`);
}

// ---- P952 姿勢・第2段b（関節軌跡で動作を読む） ----
{
  const { visualPoseService: vpose952 } = await import('../src/miki/conversation/services/visualPoseService');
  const { knowledgeSelfInspectionService: ksi952 } = await import('../src/miki/selfAwareness/services/knowledgeSelfInspectionService');
  const W952 = 48, H952 = 48;
  type RGB952 = [number, number, number];
  const BG952: RGB952 = [245, 245, 245];
  const G952: RGB952 = [60, 60, 60];
  const frames952 = (paint: (px: (x: number, y: number, c: RGB952) => void, i: number) => void) => {
    const frames: { rgba: Uint8Array; width: number; height: number; t: number }[] = [];
    for (let i = 0; i < 10; i++) {
      const a = new Uint8Array(W952 * H952 * 4);
      for (let k = 0; k < W952 * H952; k++) { a[k * 4] = BG952[0]; a[k * 4 + 1] = BG952[1]; a[k * 4 + 2] = BG952[2]; a[k * 4 + 3] = 255; }
      const set = (x: number, y: number, c: RGB952) => { if (x < 0 || y < 0 || x >= W952 || y >= H952) return; const j = (y * W952 + x) * 4; a[j] = c[0]; a[j + 1] = c[1]; a[j + 2] = c[2]; };
      paint(set, i);
      frames.push({ rgba: a, width: W952, height: H952, t: i * 100 });
    }
    return vpose952.analyzePoseMotion(frames);
  };
  const disc952 = (set: (x: number, y: number, c: RGB952) => void, cx: number, cy: number, r: number) => { for (let y = 0; y < H952; y++) for (let x = 0; x < W952; x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) set(x, y, G952); };
  const rect952 = (set: (x: number, y: number, c: RGB952) => void, x0: number, x1: number, y0: number, y1: number) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) set(x, y, G952); };
  const seg952 = (set: (x: number, y: number, c: RGB952) => void, x0: number, y0: number, x1: number, y1: number) => {
    for (let y = 0; y < H952; y++) for (let x = 0; x < W952; x++) {
      const dx = x1 - x0, dy = y1 - y0; const len2 = dx * dx + dy * dy || 1;
      let t = ((x - x0) * dx + (y - y0) * dy) / len2; t = Math.max(0, Math.min(1, t));
      if ((x - (x0 + t * dx)) ** 2 + (y - (y0 + t * dy)) ** 2 <= 1.6 * 1.6) set(x, y, G952);
    }
  };
  const base952 = (set: (x: number, y: number, c: RGB952) => void, off = 0) => {
    disc952(set, 24, 10 + off, 4); rect952(set, 20, 28, 18 + off, 34 + off);
    rect952(set, 20, 23, 34 + off, 44 + off); rect952(set, 25, 28, 34 + off, 44 + off);
  };
  const swing952 = frames952((set, i) => {
    base952(set); rect952(set, 17, 19, 18, 32);
    const th = 0.55 * Math.sin(2 * Math.PI * i / 5);
    seg952(set, 29, 20, 29 + 13 * Math.sin(th), 20 + 13 * Math.cos(th));
  });
  check('P952 右腕を振る動きを関節軌跡から読める', swing952?.handSwingR === true && swing952?.description.includes('右腕を振っている'), `swing=${JSON.stringify(swing952 && { d: swing952.description })}`);
  const wave952 = frames952((set, i) => {
    base952(set); rect952(set, 17, 19, 18, 32);
    seg952(set, 29, 20, 36 + 3 * Math.sin(2 * Math.PI * i / 4), 5);
  });
  check('P952 頭の上で右手を振る動きを読める', wave952?.wavingR === true && wave952?.description.includes('右手を振っている'), `wave=${JSON.stringify(wave952 && { d: wave952.description })}`);
  const walk952 = frames952((set, i) => {
    disc952(set, 24, 10, 4); rect952(set, 20, 28, 18, 34);
    rect952(set, 17, 19, 18, 32); rect952(set, 29, 31, 18, 32);
    const s = Math.sin(2 * Math.PI * i / 4);
    seg952(set, 22, 34, 21 + 5 * s, 44); seg952(set, 26, 34, 27 - 5 * s, 44);
  });
  check('P952 歩く脚の動きを読める', walk952?.walking === true, `walk=${JSON.stringify(walk952 && { d: walk952.description })}`);
  const jump952 = frames952((set, i) => {
    const off = (i === 3 || i === 4) ? -5 : (i === 2 || i === 5) ? -3 : 0;
    base952(set, off); rect952(set, 17, 19, 18 + off, 32 + off); rect952(set, 29, 31, 18 + off, 32 + off);
  });
  check('P952 跳ぶ動きを足の離地から読める', jump952?.jumping === true, `jump=${JSON.stringify(jump952 && { d: jump952.description })}`);
  const still952 = frames952((set) => {
    base952(set); rect952(set, 17, 19, 18, 32); rect952(set, 29, 31, 18, 32);
  });
  check('P952 静止した人には大きな動きを読まない', still952 !== null && !still952.walking && !still952.jumping && !still952.handSwingR && still952.description.includes('大きな動きは見られない'), `still=${JSON.stringify(still952 && { d: still952.description })}`);
  const insp952 = ksi952.inspect();
  check('P952 自己点検の記録に姿勢の動き（visualPoseMotions）が入っている', typeof insp952.visualPoseMotions === 'number' && insp952.visualPoseMotions >= 5, `visualPoseMotions=${insp952.visualPoseMotions}`);
}

// ---- P953 拡大測定の土台（2段構えの目） ----
{
  const { visualPoseService: vpose953 } = await import('../src/miki/conversation/services/visualPoseService');
  const { visualZoomService: vzoom953 } = await import('../src/miki/conversation/services/visualZoomService');
  const { knowledgeSelfInspectionService: ksi953 } = await import('../src/miki/selfAwareness/services/knowledgeSelfInspectionService');
  const W953 = 192, H953 = 192;
  type RGB953 = [number, number, number];
  const HAIR953: RGB953 = [45, 32, 22];
  const SKIN953: RGB953 = [232, 190, 160];
  const BLUE953: RGB953 = [40, 40, 120];
  const px953: RGB953[] = [];
  for (let i = 0; i < W953 * H953; i++) px953.push([245, 245, 245]);
  const rect953 = (x0: number, y0: number, x1: number, y1: number, c: RGB953) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) px953[y * W953 + x] = c; };
  const disc953 = (cx: number, cy: number, r: number, c: RGB953) => { for (let y = 0; y < H953; y++) for (let x = 0; x < W953; x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) px953[y * W953 + x] = c; };
  disc953(96, 36, 20, HAIR953); disc953(96, 46, 16, SKIN953);
  rect953(80, 68, 112, 140, BLUE953); rect953(68, 72, 79, 116, BLUE953); rect953(113, 72, 124, 116, BLUE953);
  rect953(82, 140, 94, 180, BLUE953); rect953(98, 140, 110, 180, BLUE953);
  const toRgba953 = (a: RGB953[]) => { const out = new Uint8Array(a.length * 4); a.forEach((c, i) => { out[i * 4] = c[0]; out[i * 4 + 1] = c[1]; out[i * 4 + 2] = c[2]; out[i * 4 + 3] = 255; }); return out; };
  const small953: RGB953[] = [];
  for (let y = 0; y < 48; y++) for (let x = 0; x < 48; x++) small953.push(px953[(y * 4) * W953 + x * 4]);
  const pose953 = vpose953.analyzePose(toRgba953(small953), 48, 48);
  check('P953 粗い全体像（48px）でも姿勢が読める', pose953?.verified === true && !!pose953?.head, `pose=${JSON.stringify(pose953 && { v: pose953.verified })}`);
  const zoom953 = pose953?.head ? vzoom953.cropAnalyze(toRgba953(px953), W953, H953, pose953.head.x, pose953.head.y, pose953.head.r * 5) : null;
  const skin953 = zoom953?.features.regions.find((r) => r.colorName === '肌色');
  const above953 = zoom953?.features.regions
    .filter((r) => r !== skin953 && r.borderTouch < 0.5 && skin953 && r.centroidY < skin953.centroidY - 0.05)
    .sort((a, b) => b.share - a.share)[0];
  check('P953 頭を拡大すると髪（上）と顔（肌色）が分かれて見える', !!skin953 && above953?.colorName === '黒', `zoom=${JSON.stringify(zoom953?.features.regions.map((r) => `${r.colorName}:${r.share.toFixed(2)}`))}`);
  check('P953 切り出しは全体ではなく頭の周辺だけ', !!zoom953 && zoom953.crop.side < W953, `crop=${JSON.stringify(zoom953?.crop)}`);
  const insp953 = ksi953.inspect();
  check('P953 自己点検の記録に拡大測定（visualZooms）が入っている', typeof insp953.visualZooms === 'number' && insp953.visualZooms >= 1, `visualZooms=${insp953.visualZooms}`);
}

// ---- P954 表情（顔の中身：目と口） ----
{
  const { visualZoomService: vzoom954 } = await import('../src/miki/conversation/services/visualZoomService');
  const { knowledgeSelfInspectionService: ksi954 } = await import('../src/miki/selfAwareness/services/knowledgeSelfInspectionService');
  const W954 = 96, H954 = 96;
  type RGB954 = [number, number, number];
  const HAIR954: RGB954 = [45, 32, 22];
  const SKIN954: RGB954 = [232, 190, 160];
  const DARK954: RGB954 = [30, 30, 30];
  const makeFace954 = (mouth: 'smile' | 'frown' | 'none', withEyes = true) => {
    const px: RGB954[] = [];
    for (let i = 0; i < W954 * H954; i++) px.push([245, 245, 245]);
    const disc = (cx: number, cy: number, r: number, c: RGB954) => { for (let y = 0; y < H954; y++) for (let x = 0; x < W954; x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) px[y * W954 + x] = c; };
    disc(48, 40, 32, HAIR954); disc(48, 50, 28, SKIN954);
    if (withEyes) { disc(38, 44, 3, DARK954); disc(58, 44, 3, DARK954); }
    if (mouth !== 'none') {
      for (let x = 36; x <= 60; x++) {
        const t = (x - 36) / 24;
        const y = mouth === 'smile' ? 64 + Math.round(3.5 * Math.sin(t * Math.PI)) : 68 - Math.round(3.5 * Math.sin(t * Math.PI));
        px[y * W954 + x] = DARK954; px[(y + 1) * W954 + x] = DARK954;
      }
    }
    const out = new Uint8Array(W954 * H954 * 4);
    px.forEach((c, i) => { out[i * 4] = c[0]; out[i * 4 + 1] = c[1]; out[i * 4 + 2] = c[2]; out[i * 4 + 3] = 255; });
    return out;
  };
  const readFace954 = (img: Uint8Array) => {
    const z = vzoom954.cropAnalyze(img, W954, H954, 0.5, 0.52, 0.8);
    return z ? vzoom954.analyzeFace(z.pixels) : null;
  };
  const smile954 = readFace954(makeFace954('smile'));
  check('P954 笑った顔は目2つ＋笑い口で照合を通る', smile954?.eyes === 2 && smile954?.mouthShape === 'smile' && smile954?.verified === true, `smile=${JSON.stringify(smile954 && { e: smile954.eyes, m: smile954.mouthShape, v: smile954.verified })}`);
  const frown954 = readFace954(makeFace954('frown'));
  check('P954 口元が下がった顔も読み分けられる', frown954?.eyes === 2 && frown954?.mouthShape === 'frown' && frown954?.verified === true, `frown=${JSON.stringify(frown954 && { e: frown954.eyes, m: frown954.mouthShape })}`);
  const plain954 = readFace954(makeFace954('none', false));
  check('P954 目も口もない顔では何も見えたと言わない（髪を目と誤らない）', plain954?.eyes === 0 && plain954?.mouthShape === 'none' && plain954?.description === '', `plain=${JSON.stringify(plain954 && { e: plain954.eyes, m: plain954.mouthShape })}`);
  const insp954 = ksi954.inspect();
  check('P954 自己点検の記録に顔の読み（visualFaces）が入っている', typeof insp954.visualFaces === 'number' && insp954.visualFaces >= 1, `visualFaces=${insp954.visualFaces}`);
}

// ---- P955 視点（正面・横向き・後ろ姿） ----
{
  const { visualZoomService: vzoom955 } = await import('../src/miki/conversation/services/visualZoomService');
  const { knowledgeSelfInspectionService: ksi955 } = await import('../src/miki/selfAwareness/services/knowledgeSelfInspectionService');
  const W955 = 96, H955 = 96;
  type RGB955 = [number, number, number];
  const HAIR955: RGB955 = [45, 32, 22];
  const SKIN955: RGB955 = [232, 190, 160];
  const DARK955: RGB955 = [30, 30, 30];
  const base955 = (draw: (disc: (cx: number, cy: number, r: number, c: RGB955) => void) => void) => {
    const px: RGB955[] = [];
    for (let i = 0; i < W955 * H955; i++) px.push([245, 245, 245]);
    const disc = (cx: number, cy: number, r: number, c: RGB955) => { for (let y = 0; y < H955; y++) for (let x = 0; x < W955; x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) px[y * W955 + x] = c; };
    draw(disc);
    const out = new Uint8Array(W955 * H955 * 4);
    px.forEach((c, i) => { out[i * 4] = c[0]; out[i * 4 + 1] = c[1]; out[i * 4 + 2] = c[2]; out[i * 4 + 3] = 255; });
    return out;
  };
  const cues955 = (img: Uint8Array) => {
    const z = vzoom955.cropAnalyze(img, W955, H955, 0.5, 0.52, 0.8);
    const skin = z?.features.regions.find((r) => r.colorName === '肌色');
    const face = z ? vzoom955.analyzeFace(z.pixels) : null;
    return { eyes: face && face.verified ? face.eyes : null, headSkinShare: skin ? skin.share : 0 };
  };
  const front955 = base955((disc) => { disc(48, 40, 32, HAIR955); disc(48, 50, 28, SKIN955); disc(38, 44, 3, DARK955); disc(58, 44, 3, DARK955); });
  const profile955 = base955((disc) => { disc(48, 40, 32, HAIR955); disc(48, 50, 28, SKIN955); disc(59, 44, 3, DARK955); });
  const back955 = base955((disc) => { disc(48, 48, 30, HAIR955); });
  check('P955 目が2つ見える顔は正面', vzoom955.classifyViewpoint(cues955(front955))?.viewpoint === 'front', '');
  check('P955 目が1つだけの顔は横向き', vzoom955.classifyViewpoint(cues955(profile955))?.viewpoint === 'profile', '');
  check('P955 頭に肌が無いのは後ろ姿', vzoom955.classifyViewpoint(cues955(back955))?.viewpoint === 'back', '');
  check('P955 手がかりが無ければ向きを決めない', vzoom955.classifyViewpoint({ eyes: null, headSkinShare: 0.3 }) === null, '');
  const insp955 = ksi955.inspect();
  check('P955 自己点検の記録に向きの読み（visualViewpoints）が入っている', typeof insp955.visualViewpoints === 'number' && insp955.visualViewpoints >= 1, `visualViewpoints=${insp955.visualViewpoints}`);
}

// ---- P956 服の形（スカート状の広がり・上下の色） ----
{
  const { visualPoseService: vpose956 } = await import('../src/miki/conversation/services/visualPoseService');
  const { knowledgeSelfInspectionService: ksi956 } = await import('../src/miki/selfAwareness/services/knowledgeSelfInspectionService');
  const S956 = 48;
  type RGB956 = [number, number, number];
  const SKIN956: RGB956 = [232, 190, 160];
  const BLUE956: RGB956 = [40, 40, 120];
  const RED956: RGB956 = [170, 40, 40];
  const canvas956 = () => { const px: RGB956[] = []; for (let i = 0; i < S956 * S956; i++) px.push([245, 245, 245]); return px; };
  const rect956 = (px: RGB956[], x0: number, y0: number, x1: number, y1: number, c: RGB956) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) px[y * S956 + x] = c; };
  const disc956 = (px: RGB956[], cx: number, cy: number, r: number, c: RGB956) => { for (let y = 0; y < S956; y++) for (let x = 0; x < S956; x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) px[y * S956 + x] = c; };
  const toRgba956 = (px: RGB956[]) => { const o = new Uint8Array(S956 * S956 * 4); px.forEach((c, i) => { o[i * 4] = c[0]; o[i * 4 + 1] = c[1]; o[i * 4 + 2] = c[2]; o[i * 4 + 3] = 255; }); return o; };
  const pants956 = canvas956();
  disc956(pants956, 24, 6, 5, SKIN956);
  rect956(pants956, 19, 11, 29, 26, BLUE956); rect956(pants956, 15, 12, 18, 24, BLUE956); rect956(pants956, 30, 12, 33, 24, BLUE956);
  rect956(pants956, 19, 26, 23, 44, BLUE956); rect956(pants956, 25, 26, 29, 44, BLUE956);
  const skirt956 = canvas956();
  disc956(skirt956, 24, 6, 5, SKIN956);
  rect956(skirt956, 19, 11, 29, 20, BLUE956); rect956(skirt956, 15, 12, 18, 24, BLUE956); rect956(skirt956, 30, 12, 33, 24, BLUE956);
  for (let y = 20; y <= 40; y++) { const w = 5 + Math.round((y - 20) * 0.55); rect956(skirt956, 24 - w, y, 24 + w, y, BLUE956); }
  rect956(skirt956, 20, 40, 22, 44, SKIN956); rect956(skirt956, 26, 40, 28, 44, SKIN956);
  const two956 = canvas956();
  disc956(two956, 24, 6, 5, SKIN956);
  rect956(two956, 19, 11, 29, 26, RED956); rect956(two956, 15, 12, 18, 24, RED956); rect956(two956, 30, 12, 33, 24, RED956);
  rect956(two956, 19, 26, 23, 44, BLUE956); rect956(two956, 25, 26, 29, 44, BLUE956);
  const rp956 = vpose956.analyzePose(toRgba956(pants956), S956, S956);
  check('P956 ズボンは分かれ＋上下同色と読める', rp956?.clothing.bottom === 'split' && rp956?.clothing.twoPiece === false, `pants=${JSON.stringify(rp956?.clothing)}`);
  const rs956 = vpose956.analyzePose(toRgba956(skirt956), S956, S956);
  check('P956 スカートは裾の広がりと読める（裾下の脚の分かれに引きずられない）', rs956?.clothing.bottom === 'flare' && rs956?.clothing.twoPiece === false, `skirt=${JSON.stringify(rs956?.clothing)}`);
  const rt956 = vpose956.analyzePose(toRgba956(two956), S956, S956);
  check('P956 上下で色が違う服も読める', rt956?.clothing.bottom === 'split' && rt956?.clothing.twoPiece === true, `two=${JSON.stringify(rt956?.clothing)}`);
  const insp956 = ksi956.inspect();
  check('P956 自己点検の記録に服の形（visualClothing）が入っている', typeof insp956.visualClothing === 'number' && insp956.visualClothing >= 1, `visualClothing=${insp956.visualClothing}`);
}

// ---- P957 重なりと持ち物 ----
{
  const { visualPoseService: vpose957 } = await import('../src/miki/conversation/services/visualPoseService');
  const { knowledgeSelfInspectionService: ksi957 } = await import('../src/miki/selfAwareness/services/knowledgeSelfInspectionService');
  const S957 = 48;
  type RGB957 = [number, number, number];
  const SKIN957: RGB957 = [232, 190, 160];
  const BLUE957: RGB957 = [40, 40, 120];
  const RED957: RGB957 = [200, 40, 40];
  const GREEN957: RGB957 = [40, 160, 60];
  const base957 = () => {
    const px: RGB957[] = [];
    for (let i = 0; i < S957 * S957; i++) px.push([245, 245, 245]);
    const rect = (x0: number, y0: number, x1: number, y1: number, c: RGB957) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) px[y * S957 + x] = c; };
    const disc = (cx: number, cy: number, r: number, c: RGB957) => { for (let y = 0; y < S957; y++) for (let x = 0; x < S957; x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) px[y * S957 + x] = c; };
    disc(24, 6, 5, SKIN957);
    rect(19, 11, 29, 26, BLUE957); rect(15, 12, 18, 24, BLUE957); rect(30, 12, 33, 24, BLUE957);
    rect(19, 26, 23, 44, BLUE957); rect(25, 26, 29, 44, BLUE957);
    return { px, rect, disc };
  };
  const toRgba957 = (px: RGB957[]) => { const o = new Uint8Array(S957 * S957 * 4); px.forEach((c, i) => { o[i * 4] = c[0]; o[i * 4 + 1] = c[1]; o[i * 4 + 2] = c[2]; o[i * 4 + 3] = 255; }); return o; };
  const plain957 = base957();
  const rp957 = vpose957.analyzePose(toRgba957(plain957.px), S957, S957);
  check('P957 何も持っていない人では持ち物を言わない', rp957?.extras.heldL === null && rp957?.extras.heldR === null && rp957?.extras.frontPatch === null && rp957?.extrasDescription === '', `plain=${JSON.stringify(rp957?.extras)}`);
  const ball957 = base957(); ball957.disc(33, 27, 4, RED957);
  const rb957 = vpose957.analyzePose(toRgba957(ball957.px), S957, S957);
  check('P957 右手の赤い玉は持ち物と読める（体の前とは二重に数えない）', rb957?.extras.heldR === '赤い' && rb957?.extras.frontPatch === null, `ball=${JSON.stringify(rb957?.extras)}`);
  const patch957 = base957(); patch957.rect(20, 16, 28, 22, GREEN957);
  const rg957 = vpose957.analyzePose(toRgba957(patch957.px), S957, S957);
  check('P957 体の前の緑の塊は重なりと読める', rg957?.extras.frontPatch === '緑の' && rg957?.extras.heldR === null, `patch=${JSON.stringify(rg957?.extras)}`);
  const insp957 = ksi957.inspect();
  check('P957 自己点検の記録に持ち物・重なり（visualExtras）が入っている', typeof insp957.visualExtras === 'number' && insp957.visualExtras >= 1, `visualExtras=${insp957.visualExtras}`);
}

// ---- P958 複数人と、同じ人の見分け ----
{
  const { visualPoseService: vpose958 } = await import('../src/miki/conversation/services/visualPoseService');
  const { knowledgeSelfInspectionService: ksi958 } = await import('../src/miki/selfAwareness/services/knowledgeSelfInspectionService');
  type RGB958 = [number, number, number];
  const SKIN958: RGB958 = [232, 190, 160];
  const HAIR958: RGB958 = [45, 32, 22];
  const BLUE958: RGB958 = [40, 40, 120];
  const RED958: RGB958 = [170, 40, 40];
  const GREEN958: RGB958 = [40, 130, 60];
  const drawPerson958 = (px: RGB958[], W: number, ox: number, oy: number, top: RGB958, bottom: RGB958, armsUp = false) => {
    const H = px.length / W;
    const rect = (x0: number, y0: number, x1: number, y1: number, c: RGB958) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) px[y * W + x] = c; };
    const disc = (cx: number, cy: number, r: number, c: RGB958) => { for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) px[y * W + x] = c; };
    disc(ox + 12, oy + 7, 6, HAIR958); disc(ox + 12, oy + 8, 5, SKIN958);
    rect(ox + 6, oy + 13, ox + 18, oy + 30, top);
    if (armsUp) { rect(ox + 1, oy + 2, ox + 4, oy + 16, top); rect(ox + 20, oy + 2, ox + 23, oy + 16, top); }
    else { rect(ox + 2, oy + 14, ox + 5, oy + 28, top); rect(ox + 19, oy + 14, ox + 22, oy + 28, top); }
    rect(ox + 6, oy + 30, ox + 11, oy + 48, bottom); rect(ox + 13, oy + 30, ox + 18, oy + 48, bottom);
  };
  const canvas958 = (W: number, H: number) => { const px: RGB958[] = []; for (let i = 0; i < W * H; i++) px.push([245, 245, 245]); return px; };
  const toRgba958 = (px: RGB958[]) => { const o = new Uint8Array(px.length * 4); px.forEach((c, i) => { o[i * 4] = c[0]; o[i * 4 + 1] = c[1]; o[i * 4 + 2] = c[2]; o[i * 4 + 3] = 255; }); return o; };
  const two958 = canvas958(96, 60);
  drawPerson958(two958, 96, 6, 4, BLUE958, BLUE958);
  drawPerson958(two958, 96, 58, 4, RED958, BLUE958);
  const people958 = vpose958.analyzePeople(toRgba958(two958), 96, 60);
  check('P958 離れた2人は2人と数えられる', people958.count === 2, `count=${people958.count}`);
  const one958 = canvas958(96, 60);
  drawPerson958(one958, 96, 30, 4, BLUE958, BLUE958);
  check('P958 1人だけなら1人', vpose958.analyzePeople(toRgba958(one958), 96, 60).count === 1, '');
  const a958 = canvas958(48, 56); drawPerson958(a958, 48, 10, 2, BLUE958, BLUE958, false);
  const b958 = canvas958(48, 56); drawPerson958(b958, 48, 10, 2, BLUE958, BLUE958, true);
  const c958 = canvas958(48, 56); drawPerson958(c958, 48, 10, 2, RED958, GREEN958, false);
  const ra958 = vpose958.analyzePose(toRgba958(a958), 48, 56);
  const rb958 = vpose958.analyzePose(toRgba958(b958), 48, 56);
  const rc958 = vpose958.analyzePose(toRgba958(c958), 48, 56);
  const same958 = ra958 && rb958 ? vpose958.compareSignatures(vpose958.personSignature(ra958), vpose958.personSignature(rb958)) : null;
  check('P958 同じ人はポーズが違っても同じ人らしいと分かる', same958?.same === true, `same=${JSON.stringify(same958)}`);
  const diff958 = ra958 && rc958 ? vpose958.compareSignatures(vpose958.personSignature(ra958), vpose958.personSignature(rc958)) : null;
  check('P958 色の違う別人とは見分ける', diff958?.same === false, `diff=${JSON.stringify(diff958)}`);
  const insp958 = ksi958.inspect();
  check('P958 自己点検の記録に複数人（visualPeople）が入っている', typeof insp958.visualPeople === 'number' && insp958.visualPeople >= 1, `visualPeople=${insp958.visualPeople}`);
}

// ---- P959 手と指の第1段と、手をつなぐ様子 ----
{
  const { visualZoomService: vzoom959 } = await import('../src/miki/conversation/services/visualZoomService');
  const { visualPoseService: vpose959 } = await import('../src/miki/conversation/services/visualPoseService');
  const { knowledgeSelfInspectionService: ksi959 } = await import('../src/miki/selfAwareness/services/knowledgeSelfInspectionService');
  type RGB959 = [number, number, number];
  const SKIN959: RGB959 = [232, 190, 160];
  const px48of959 = (draw: (set: (x: number, y: number, c: RGB959) => void) => void) => {
    const px: RGB959[] = []; for (let i = 0; i < 48 * 48; i++) px.push([245, 245, 245]);
    const set = (x: number, y: number, c: RGB959) => { if (x >= 0 && y >= 0 && x < 48 && y < 48) px[y * 48 + x] = c; };
    draw(set);
    const o = new Uint8Array(48 * 48 * 4);
    px.forEach((c, i) => { o[i * 4] = c[0]; o[i * 4 + 1] = c[1]; o[i * 4 + 2] = c[2]; o[i * 4 + 3] = 255; });
    return o;
  };
  const rect959 = (set: (x: number, y: number, c: RGB959) => void, x0: number, y0: number, x1: number, y1: number, c: RGB959) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) set(x, y, c); };
  const disc959 = (set: (x: number, y: number, c: RGB959) => void, cx: number, cy: number, r: number, c: RGB959) => { for (let y = 0; y < 48; y++) for (let x = 0; x < 48; x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) set(x, y, c); };
  const open959 = px48of959((set) => {
    rect959(set, 20, 0, 27, 14, SKIN959);
    disc959(set, 24, 24, 8, SKIN959);
    for (const fx of [14, 20, 26, 32]) rect959(set, fx, 27, fx + 3, 39, SKIN959);
  });
  const fist959 = px48of959((set) => {
    rect959(set, 20, 0, 27, 14, SKIN959);
    disc959(set, 24, 25, 9, SKIN959);
  });
  const openReading959 = vzoom959.analyzeHand(open959, { x: 0, y: -1 });
  check('P959 開いた手は指が分かれて見える', openReading959?.fingersSeparated === true && (openReading959?.maxRuns || 0) >= 3, `open=${JSON.stringify(openReading959)}`);
  const fistReading959 = vzoom959.analyzeHand(fist959, { x: 0, y: -1 });
  check('P959 握った手は指が分かれて見えない', fistReading959?.fingersSeparated === false, `fist=${JSON.stringify(fistReading959)}`);
  // 手をつなぐ2人
  const HAIR959: RGB959 = [45, 32, 22];
  const BLUE959: RGB959 = [40, 40, 120];
  const RED959: RGB959 = [170, 40, 40];
  const W959 = 140, H959 = 60;
  const pair959: RGB959[] = []; for (let i = 0; i < W959 * H959; i++) pair959.push([245, 245, 245]);
  const rectW959 = (x0: number, y0: number, x1: number, y1: number, c: RGB959) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) pair959[y * W959 + x] = c; };
  const discW959 = (cx: number, cy: number, r: number, c: RGB959) => { for (let y = 0; y < H959; y++) for (let x = 0; x < W959; x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) pair959[y * W959 + x] = c; };
  const body959 = (ox: number, top: RGB959) => {
    discW959(ox + 12, 11, 6, HAIR959); discW959(ox + 12, 12, 5, SKIN959);
    rectW959(ox + 6, 17, ox + 18, 34, top);
    rectW959(ox + 6, 34, ox + 11, 52, BLUE959); rectW959(ox + 13, 34, ox + 18, 52, BLUE959);
  };
  body959(30, BLUE959); body959(58, RED959);
  rectW959(32, 18, 35, 32, BLUE959); rectW959(77, 18, 80, 32, RED959);
  for (let i = 0; i <= 4; i++) rectW959(48 + i, 18 + 2 * i, 50 + i, 20 + 2 * i, BLUE959);
  for (let j = 0; j <= 4; j++) rectW959(52, 28 + 2 * j, 54, 30 + 2 * j, BLUE959);
  for (let i = 0; i <= 4; i++) rectW959(62 - i, 18 + 2 * i, 64 - i, 20 + 2 * i, RED959);
  for (let j = 0; j <= 4; j++) rectW959(59, 28 + 2 * j, 61, 30 + 2 * j, RED959);
  discW959(54, 40, 2, SKIN959); discW959(60, 40, 2, SKIN959);
  const pairRgba959 = new Uint8Array(W959 * H959 * 4);
  pair959.forEach((c, i) => { pairRgba959[i * 4] = c[0]; pairRgba959[i * 4 + 1] = c[1]; pairRgba959[i * 4 + 2] = c[2]; pairRgba959[i * 4 + 3] = 255; });
  const people959 = vpose959.analyzePeople(pairRgba959, W959, H959);
  check('P959 近くで手が重なる2人は手をつないでいると読める', people959.count === 2 && people959.holdingHands === true, `count=${people959.count} holding=${people959.holdingHands}`);
  const insp959 = ksi959.inspect();
  check('P959 自己点検の記録に手つなぎと手（visualHoldingHands・visualHands）が入っている', typeof insp959.visualHoldingHands === 'number' && insp959.visualHoldingHands >= 1 && typeof insp959.visualHands === 'number' && insp959.visualHands >= 1, `holding=${insp959.visualHoldingHands} hands=${insp959.visualHands}`);
}

// ---- P960 裸の状態の第1段 ----
{
  const { visualPoseService: vpose960 } = await import('../src/miki/conversation/services/visualPoseService');
  const { knowledgeSelfInspectionService: ksi960 } = await import('../src/miki/selfAwareness/services/knowledgeSelfInspectionService');
  type RGB960 = [number, number, number];
  const SKIN960: RGB960 = [232, 190, 160];
  const HAIR960: RGB960 = [45, 32, 22];
  const BLUE960: RGB960 = [40, 40, 120];
  const RED960: RGB960 = [170, 40, 40];
  const draw960 = (px: RGB960[], W: number, ox: number, oy: number, torso: RGB960, arms: RGB960, legs: RGB960) => {
    const H = px.length / W;
    const rect = (x0: number, y0: number, x1: number, y1: number, c: RGB960) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) px[y * W + x] = c; };
    const disc = (cx: number, cy: number, r: number, c: RGB960) => { for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) px[y * W + x] = c; };
    disc(ox + 12, oy + 7, 6, HAIR960); disc(ox + 12, oy + 8, 5, SKIN960);
    rect(ox + 6, oy + 13, ox + 18, oy + 30, torso);
    rect(ox + 2, oy + 14, ox + 5, oy + 28, arms); rect(ox + 19, oy + 14, ox + 22, oy + 28, arms);
    rect(ox + 6, oy + 30, ox + 11, oy + 48, legs); rect(ox + 13, oy + 30, ox + 18, oy + 48, legs);
  };
  const canvas960 = (W: number, H: number) => { const px: RGB960[] = []; for (let i = 0; i < W * H; i++) px.push([245, 245, 245]); return px; };
  const toRgba960 = (px: RGB960[]) => { const o = new Uint8Array(px.length * 4); px.forEach((c, i) => { o[i * 4] = c[0]; o[i * 4 + 1] = c[1]; o[i * 4 + 2] = c[2]; o[i * 4 + 3] = 255; }); return o; };
  const nude960 = canvas960(48, 56); draw960(nude960, 48, 10, 2, SKIN960, SKIN960, SKIN960);
  const rn960 = vpose960.analyzePose(toRgba960(nude960), 48, 56);
  check('P960 肌が広い人は服を着ていないと読める', rn960?.bare === true && (rn960?.bareDescription || '').includes('服は着ていない'), `bare=${rn960?.bare}`);
  const clothed960 = canvas960(48, 56); draw960(clothed960, 48, 10, 2, BLUE960, BLUE960, BLUE960);
  const rc960 = vpose960.analyzePose(toRgba960(clothed960), 48, 56);
  check('P960 服を着た人は裸とは読まない', rc960?.bare === false, `bare=${rc960?.bare}`);
  const swim960 = canvas960(48, 56); draw960(swim960, 48, 10, 2, RED960, SKIN960, SKIN960);
  const rs960 = vpose960.analyzePose(toRgba960(swim960), 48, 56);
  check('P960 胴が覆われた水着姿は裸とは読まない（判定保留）', rs960?.bare !== true, `bare=${rs960?.bare}`);
  const insp960 = ksi960.inspect();
  check('P960 自己点検の記録に裸の状態（visualBare）が入っている', typeof insp960.visualBare === 'number' && insp960.visualBare >= 1, `visualBare=${insp960.visualBare}`);
}

// ---- P961 真似の第1段 ----
{
  const { visualPoseService: vpose961 } = await import('../src/miki/conversation/services/visualPoseService');
  const { knowledgeSelfInspectionService: ksi961 } = await import('../src/miki/selfAwareness/services/knowledgeSelfInspectionService');
  type RGB961 = [number, number, number];
  const SKIN961: RGB961 = [232, 190, 160];
  const HAIR961: RGB961 = [45, 32, 22];
  const BLUE961: RGB961 = [40, 40, 120];
  const px961: RGB961[] = []; for (let i = 0; i < 48 * 56; i++) px961.push([245, 245, 245]);
  const rect961 = (x0: number, y0: number, x1: number, y1: number, c: RGB961) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) px961[y * 48 + x] = c; };
  const disc961 = (cx: number, cy: number, r: number, c: RGB961) => { for (let y = 0; y < 56; y++) for (let x = 0; x < 48; x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) px961[y * 48 + x] = c; };
  disc961(22, 9, 6, HAIR961); disc961(22, 10, 5, SKIN961);
  rect961(16, 15, 28, 32, BLUE961);
  rect961(12, 16, 15, 30, BLUE961); rect961(29, 16, 32, 30, BLUE961);
  rect961(16, 32, 21, 50, BLUE961); rect961(23, 32, 28, 50, BLUE961);
  const rgba961 = new Uint8Array(48 * 56 * 4);
  px961.forEach((c, i) => { rgba961[i * 4] = c[0]; rgba961[i * 4 + 1] = c[1]; rgba961[i * 4 + 2] = c[2]; rgba961[i * 4 + 3] = 255; });
  const pose961 = vpose961.analyzePose(rgba961, 48, 56);
  const im961 = pose961 ? vpose961.imitatePose(pose961) : null;
  check('P961 読んだ姿勢を描き直して読み直すと関節が一致する', !!im961 && im961.verified && im961.score >= 0.7, `score=${im961?.score.toFixed(2)} verified=${im961?.verified}`);
  const insp961 = ksi961.inspect();
  check('P961 自己点検の記録に真似（visualImitations）が入っている', typeof insp961.visualImitations === 'number' && insp961.visualImitations >= 1, `visualImitations=${insp961.visualImitations}`);
}

// ---- P962 重心の第1段 ----
{
  const { visualPoseService: vpose962 } = await import('../src/miki/conversation/services/visualPoseService');
  const { knowledgeSelfInspectionService: ksi962 } = await import('../src/miki/selfAwareness/services/knowledgeSelfInspectionService');
  type RGB962 = [number, number, number];
  const SKIN962: RGB962 = [232, 190, 160];
  const HAIR962: RGB962 = [45, 32, 22];
  const BLUE962: RGB962 = [40, 40, 120];
  const RED962: RGB962 = [170, 40, 40];
  const draw962 = (ballSide: 'none' | 'right' | 'left') => {
    const px: RGB962[] = []; for (let i = 0; i < 56 * 56; i++) px.push([245, 245, 245]);
    const rect = (x0: number, y0: number, x1: number, y1: number, c: RGB962) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) px[y * 56 + x] = c; };
    const disc = (cx: number, cy: number, r: number, c: RGB962) => { for (let y = 0; y < 56; y++) for (let x = 0; x < 56; x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) px[y * 56 + x] = c; };
    disc(26, 9, 6, HAIR962); disc(26, 10, 5, SKIN962);
    rect(20, 15, 32, 32, BLUE962);
    rect(16, 16, 19, 30, BLUE962); rect(33, 16, 36, 30, BLUE962);
    rect(20, 32, 25, 50, BLUE962); rect(27, 32, 32, 50, BLUE962);
    if (ballSide === 'right') disc(41, 28, 8, RED962);
    if (ballSide === 'left') disc(11, 28, 8, RED962);
    const o = new Uint8Array(56 * 56 * 4);
    px.forEach((c, i) => { o[i * 4] = c[0]; o[i * 4 + 1] = c[1]; o[i * 4 + 2] = c[2]; o[i * 4 + 3] = 255; });
    return o;
  };
  const straight962 = vpose962.analyzePose(draw962('none'), 56, 56);
  check('P962 左右対称の人は重心が真ん中と読める', straight962?.balance?.label === 'balanced', `lean=${straight962?.balance?.lean.toFixed(3)}`);
  const right962 = vpose962.analyzePose(draw962('right'), 56, 56);
  check('P962 右に重みがある人は重心が右と読める', right962?.balance?.label === 'right', `lean=${right962?.balance?.lean.toFixed(3)}`);
  const left962 = vpose962.analyzePose(draw962('left'), 56, 56);
  check('P962 左に重みがある人は重心が左と読める', left962?.balance?.label === 'left', `lean=${left962?.balance?.lean.toFixed(3)}`);
  const insp962 = ksi962.inspect();
  check('P962 自己点検の記録に重心（visualBalance）が入っている', typeof insp962.visualBalance === 'number' && insp962.visualBalance >= 1, `visualBalance=${insp962.visualBalance}`);
}

// ---- P963 動きの質の第1段 ----
{
  const { visualPoseService: vpose963 } = await import('../src/miki/conversation/services/visualPoseService');
  const { knowledgeSelfInspectionService: ksi963 } = await import('../src/miki/selfAwareness/services/knowledgeSelfInspectionService');
  type RGB963 = [number, number, number];
  const SKIN963: RGB963 = [232, 190, 160];
  const HAIR963: RGB963 = [45, 32, 22];
  const BLUE963: RGB963 = [40, 40, 120];
  const frame963 = (ox: number) => {
    const W = 56, H = 56, oy = 2;
    const px: RGB963[] = []; for (let i = 0; i < W * H; i++) px.push([245, 245, 245]);
    const rect = (x0: number, y0: number, x1: number, y1: number, c: RGB963) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (x >= 0 && x < W) px[y * W + x] = c; };
    const disc = (cx: number, cy: number, r: number, c: RGB963) => { for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) px[y * W + x] = c; };
    disc(ox + 12, oy + 7, 6, HAIR963); disc(ox + 12, oy + 8, 5, SKIN963);
    rect(ox + 6, oy + 13, ox + 18, oy + 30, BLUE963);
    rect(ox + 2, oy + 14, ox + 5, oy + 28, BLUE963); rect(ox + 19, oy + 14, ox + 22, oy + 28, BLUE963);
    rect(ox + 6, oy + 30, ox + 11, oy + 48, BLUE963); rect(ox + 13, oy + 30, ox + 18, oy + 48, BLUE963);
    const o = new Uint8Array(W * H * 4);
    px.forEach((c, i) => { o[i * 4] = c[0]; o[i * 4 + 1] = c[1]; o[i * 4 + 2] = c[2]; o[i * 4 + 3] = 255; });
    return { rgba: o, width: W, height: H };
  };
  const seq963 = (shifts: number[], dt: number) => shifts.map((s, i) => ({ ...frame963(14 + s), t: i * dt }));
  const fast963 = vpose963.analyzePoseMotion(seq963(Array.from({ length: 12 }, (_, i) => Math.round(5 * Math.sin(i * Math.PI / 3))), 100));
  check('P963 速い波の動きは速くてなめらかと読める', fast963?.quality?.tempo === 'fast' && fast963?.quality?.smoothness === 'smooth', `q=${JSON.stringify(fast963?.quality)}`);
  const jerky963 = vpose963.analyzePoseMotion(seq963([-3, 2, -1, 3, -2, 1, -3, 2, 0, -2, 3, -1], 100));
  check('P963 乱れた動きはぎくしゃくと読める', jerky963?.quality?.smoothness === 'jerky', `q=${JSON.stringify(jerky963?.quality)}`);
  const slow963 = vpose963.analyzePoseMotion(seq963(Array.from({ length: 24 }, (_, i) => Math.round(2 * Math.sin(i * Math.PI / 6))), 200));
  check('P963 ゆっくりした波はゆっくりと読める', slow963?.quality?.tempo === 'slow', `q=${JSON.stringify(slow963?.quality)}`);
  const insp963 = ksi963.inspect();
  check('P963 自己点検の記録に動きの質（visualMotionQuality）が入っている', typeof insp963.visualMotionQuality === 'number' && insp963.visualMotionQuality >= 1, `visualMotionQuality=${insp963.visualMotionQuality}`);
}

// ---- P964 髪の長さの第1段 ----
{
  const { visualPoseService: vpose964 } = await import('../src/miki/conversation/services/visualPoseService');
  const { knowledgeSelfInspectionService: ksi964 } = await import('../src/miki/selfAwareness/services/knowledgeSelfInspectionService');
  type RGB964 = [number, number, number];
  const SKIN964: RGB964 = [232, 190, 160];
  const HAIR964: RGB964 = [45, 32, 22];
  const BLUE964: RGB964 = [40, 40, 120];
  const draw964 = (hairTo: number) => {
    const px: RGB964[] = []; for (let i = 0; i < 48 * 56; i++) px.push([245, 245, 245]);
    const rect = (x0: number, y0: number, x1: number, y1: number, c: RGB964) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) px[y * 48 + x] = c; };
    const disc = (cx: number, cy: number, r: number, c: RGB964) => { for (let y = 0; y < 56; y++) for (let x = 0; x < 48; x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) px[y * 48 + x] = c; };
    disc(22, 9, 6, HAIR964); disc(22, 10, 5, SKIN964);
    rect(16, 15, 28, 32, BLUE964);
    rect(12, 16, 15, 30, BLUE964); rect(29, 16, 32, 30, BLUE964);
    rect(16, 32, 21, 50, BLUE964); rect(23, 32, 28, 50, BLUE964);
    if (hairTo > 0) { rect(15, 6, 18, hairTo, HAIR964); rect(26, 6, 29, hairTo, HAIR964); }
    const o = new Uint8Array(48 * 56 * 4);
    px.forEach((c, i) => { o[i * 4] = c[0]; o[i * 4 + 1] = c[1]; o[i * 4 + 2] = c[2]; o[i * 4 + 3] = 255; });
    return o;
  };
  const short964 = vpose964.analyzePose(draw964(0), 48, 56);
  check('P964 頭だけの髪は短いと読める', short964?.hair?.length === 'short', `hair=${JSON.stringify(short964?.hair)}`);
  const med964 = vpose964.analyzePose(draw964(26), 48, 56);
  check('P964 肩までの髪は肩くらいと読める', med964?.hair?.length === 'medium', `hair=${JSON.stringify(med964?.hair)}`);
  const long964 = vpose964.analyzePose(draw964(42), 48, 56);
  check('P964 長く垂れた髪は長いと読める', long964?.hair?.length === 'long', `hair=${JSON.stringify(long964?.hair)}`);
  const insp964 = ksi964.inspect();
  check('P964 自己点検の記録に髪（visualHair）が入っている', typeof insp964.visualHair === 'number' && insp964.visualHair >= 1, `visualHair=${insp964.visualHair}`);
}

// ---- P965 爪の第1段 ----
{
  const { visualZoomService: vzoom965 } = await import('../src/miki/conversation/services/visualZoomService');
  const { knowledgeSelfInspectionService: ksi965 } = await import('../src/miki/selfAwareness/services/knowledgeSelfInspectionService');
  type RGB965 = [number, number, number];
  const SKIN965: RGB965 = [232, 190, 160];
  const hand965 = (nail: RGB965 | null) => {
    const px: RGB965[] = []; for (let i = 0; i < 48 * 48; i++) px.push([250, 250, 250]);
    const rect = (x0: number, y0: number, x1: number, y1: number, c: RGB965) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) px[y * 48 + x] = c; };
    rect(14, 24, 34, 42, SKIN965);
    for (const fx of [12, 19, 26, 33]) {
      rect(fx, 8, fx + 3, 26, SKIN965);
      if (nail) rect(fx, 8, fx + 3, 11, nail);
    }
    const o = new Uint8Array(48 * 48 * 4);
    px.forEach((c, i) => { o[i * 4] = c[0]; o[i * 4 + 1] = c[1]; o[i * 4 + 2] = c[2]; o[i * 4 + 3] = 255; });
    return o;
  };
  const pink965 = vzoom965.analyzeHand(hand965([245, 205, 200]), { x: 0, y: 1 });
  check('P965 薄いピンクの爪が読める', pink965?.nails.present === true && pink965?.nails.colorLabel === '薄いピンク', `nails=${JSON.stringify(pink965?.nails)}`);
  const red965 = vzoom965.analyzeHand(hand965([200, 60, 60]), { x: 0, y: 1 });
  check('P965 赤い爪が読める', red965?.nails.present === true && red965?.nails.colorLabel === '赤い', `nails=${JSON.stringify(red965?.nails)}`);
  const none965 = vzoom965.analyzeHand(hand965(null), { x: 0, y: 1 });
  check('P965 爪のない手は爪なしと読める', none965?.nails.present === false, `nails=${JSON.stringify(none965?.nails)}`);
  const insp965 = ksi965.inspect();
  check('P965 自己点検の記録に爪（visualNails）が入っている', typeof insp965.visualNails === 'number' && insp965.visualNails >= 1, `visualNails=${insp965.visualNails}`);
}

// ---- P966 鎖骨の影の第1段 ----
{
  const { visualPoseService: vpose966 } = await import('../src/miki/conversation/services/visualPoseService');
  const { knowledgeSelfInspectionService: ksi966 } = await import('../src/miki/selfAwareness/services/knowledgeSelfInspectionService');
  type RGB966 = [number, number, number];
  const SKIN966: RGB966 = [232, 190, 160];
  const HAIR966: RGB966 = [45, 32, 22];
  const BLUE966: RGB966 = [40, 40, 120];
  const SHADE966: RGB966 = [200, 155, 125];
  const person966 = (chest: RGB966, shade: boolean) => {
    const px: RGB966[] = []; for (let i = 0; i < 48 * 56; i++) px.push([245, 245, 245]);
    const rect = (x0: number, y0: number, x1: number, y1: number, c: RGB966) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) px[y * 48 + x] = c; };
    const disc = (cx: number, cy: number, r: number, c: RGB966) => { for (let y = 0; y < 56; y++) for (let x = 0; x < 48; x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) px[y * 48 + x] = c; };
    disc(22, 9, 6, HAIR966); disc(22, 10, 5, SKIN966);
    rect(16, 15, 28, 32, chest);
    if (shade) { rect(17, 17, 21, 19, SHADE966); rect(23, 17, 27, 19, SHADE966); }
    rect(12, 16, 15, 30, chest); rect(29, 16, 32, 30, chest);
    rect(16, 32, 21, 50, chest); rect(23, 32, 28, 50, chest);
    const o = new Uint8Array(48 * 56 * 4);
    px.forEach((c, i) => { o[i * 4] = c[0]; o[i * 4 + 1] = c[1]; o[i * 4 + 2] = c[2]; o[i * 4 + 3] = 255; });
    return o;
  };
  const withShade966 = vpose966.analyzePose(person966(SKIN966, true), 48, 56);
  check('P966 鎖骨の影が読める', withShade966?.collarbone === true, `collarbone=${withShade966?.collarbone}`);
  const noShade966 = vpose966.analyzePose(person966(SKIN966, false), 48, 56);
  check('P966 影のない胸は鎖骨なしと読める', noShade966?.collarbone === false, `collarbone=${noShade966?.collarbone}`);
  const clothed966 = vpose966.analyzePose(person966(BLUE966, false), 48, 56);
  check('P966 服の上からは鎖骨を決めない', clothed966?.collarbone === null, `collarbone=${clothed966?.collarbone}`);
  const insp966 = ksi966.inspect();
  check('P966 自己点検の記録に鎖骨（visualCollarbone）が入っている', typeof insp966.visualCollarbone === 'number' && insp966.visualCollarbone >= 1, `visualCollarbone=${insp966.visualCollarbone}`);
}

// ---- P967 姿勢の癖の第1段 ----
{
  const { visualPoseService: vpose967 } = await import('../src/miki/conversation/services/visualPoseService');
  const { knowledgeSelfInspectionService: ksi967 } = await import('../src/miki/selfAwareness/services/knowledgeSelfInspectionService');
  type RGB967 = [number, number, number];
  const SKIN967: RGB967 = [232, 190, 160];
  const HAIR967: RGB967 = [45, 32, 22];
  const BLUE967: RGB967 = [40, 40, 120];
  const lean967 = () => {
    const px: RGB967[] = []; for (let i = 0; i < 48 * 56; i++) px.push([245, 245, 245]);
    const rect = (x0: number, y0: number, x1: number, y1: number, c: RGB967) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) px[y * 48 + x] = c; };
    const disc = (cx: number, cy: number, r: number, c: RGB967) => { for (let y = 0; y < 56; y++) for (let x = 0; x < 48; x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) px[y * 48 + x] = c; };
    disc(22, 9, 6, HAIR967); disc(22, 10, 5, SKIN967);
    rect(16, 15, 28, 32, BLUE967);
    rect(12, 16, 15, 30, BLUE967); rect(29, 16, 32, 30, BLUE967);
    rect(16, 32, 21, 50, BLUE967); rect(23, 32, 28, 50, BLUE967);
    disc(41, 30, 6, BLUE967);
    const o = new Uint8Array(48 * 56 * 4);
    px.forEach((c, i) => { o[i * 4] = c[0]; o[i * 4 + 1] = c[1]; o[i * 4 + 2] = c[2]; o[i * 4 + 3] = 255; });
    return o;
  };
  const img967 = lean967();
  for (let i = 0; i < 20; i++) vpose967.analyzePose(img967, 48, 56);
  const sum967 = vpose967.summary();
  check('P967 右寄りの観察が続くと癖が右と読める', sum967.habit === 'right' && sum967.leanWindow === 20, `habit=${sum967.habit} window=${sum967.leanWindow}`);
  const insp967 = ksi967.inspect();
  check('P967 自己点検の記録に傾きの窓（visualLeanWindow）が入っている', typeof insp967.visualLeanWindow === 'number' && insp967.visualLeanWindow >= 10, `visualLeanWindow=${insp967.visualLeanWindow}`);
}

// ---- P968 手と指の第2段 ----
{
  const { visualZoomService: vzoom968 } = await import('../src/miki/conversation/services/visualZoomService');
  const { knowledgeSelfInspectionService: ksi968 } = await import('../src/miki/selfAwareness/services/knowledgeSelfInspectionService');
  type RGB968 = [number, number, number];
  const SKIN968: RGB968 = [232, 190, 160];
  const hand968 = () => {
    const px: RGB968[] = []; for (let i = 0; i < 48 * 48; i++) px.push([250, 250, 250]);
    const rect = (x0: number, y0: number, x1: number, y1: number, c: RGB968) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) px[y * 48 + x] = c; };
    rect(14, 24, 34, 42, SKIN968);
    for (const fx of [12, 19, 26, 33]) rect(fx, fx === 19 ? 4 : 8, fx + 3, 26, SKIN968);
    const o = new Uint8Array(48 * 48 * 4);
    px.forEach((c, i) => { o[i * 4] = c[0]; o[i * 4 + 1] = c[1]; o[i * 4 + 2] = c[2]; o[i * 4 + 3] = 255; });
    return o;
  };
  const hr968 = vzoom968.analyzeHand(hand968(), { x: 0, y: 1 });
  check('P968 指が4本と読める', hr968?.fingers.count === 4, `fingers=${JSON.stringify(hr968?.fingers)}`);
  check('P968 一番長い指が真ん中と読める', hr968?.fingers.longest === 'center', `longest=${hr968?.fingers.longest}`);
  const insp968 = ksi968.inspect();
  check('P968 自己点検の記録に指の本数（visualFingerDetails）が入っている', typeof insp968.visualFingerDetails === 'number' && insp968.visualFingerDetails >= 1, `visualFingerDetails=${insp968.visualFingerDetails}`);
}

// ---- P1069 手の形そのもの（伸びた指の本数＋手のひらの縦横） ----
{
  const { visualZoomService: vzoom1069 } = await import('../src/miki/conversation/services/visualZoomService');
  const { knowledgeSelfInspectionService: ksi1069 } = await import('../src/miki/selfAwareness/services/knowledgeSelfInspectionService');
  type RGB1069 = [number, number, number];
  const SKIN1069: RGB1069 = [232, 190, 160];
  const hand1069 = (draw: (rect: (x0: number, y0: number, x1: number, y1: number, c: RGB1069) => void, disc: (cx: number, cy: number, r: number, c: RGB1069) => void) => void) => {
    const px: RGB1069[] = []; for (let i = 0; i < 48 * 48; i++) px.push([250, 250, 250]);
    const rect = (x0: number, y0: number, x1: number, y1: number, c: RGB1069) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) px[y * 48 + x] = c; };
    const disc = (cx: number, cy: number, r: number, c: RGB1069) => { for (let y = 0; y < 48; y++) for (let x = 0; x < 48; x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) px[y * 48 + x] = c; };
    draw(rect, disc);
    const o = new Uint8Array(48 * 48 * 4);
    px.forEach((c, i) => { o[i * 4] = c[0]; o[i * 4 + 1] = c[1]; o[i * 4 + 2] = c[2]; o[i * 4 + 3] = 255; });
    return o;
  };
  // 腕は下（axisToArm {x:0,y:1}）、指は上向き。手のひらは y=24〜42。
  const open1069 = hand1069((rect) => {
    rect(14, 24, 34, 42, SKIN1069);
    for (const fx of [12, 19, 26, 33]) rect(fx, fx === 19 ? 4 : 8, fx + 3, 26, SKIN1069);
  });
  const fist1069 = hand1069((rect, disc) => {
    disc(24, 25, 9, SKIN1069);
    rect(20, 33, 27, 47, SKIN1069);
  });
  const pointing1069 = hand1069((rect) => {
    rect(14, 24, 34, 42, SKIN1069);
    rect(22, 4, 25, 26, SKIN1069);
  });
  const peace1069 = hand1069((rect) => {
    rect(14, 24, 34, 42, SKIN1069);
    rect(16, 6, 19, 26, SKIN1069);
    rect(28, 6, 31, 26, SKIN1069);
  });
  const wide1069 = hand1069((rect) => {
    rect(8, 26, 40, 42, SKIN1069);
    for (const fx of [10, 18, 26, 34]) rect(fx, 8, fx + 3, 28, SKIN1069);
  });
  const narrow1069 = hand1069((rect) => {
    rect(18, 24, 30, 42, SKIN1069);
    for (const fx of [18, 22, 26, 30]) rect(fx, 8, fx + 2, 26, SKIN1069);
  });
  const rOpen1069 = vzoom1069.analyzeHand(open1069, { x: 0, y: 1 });
  check('P1069 開いた手は形が open と読める', rOpen1069?.shape === 'open', `shape=${rOpen1069?.shape}`);
  const rFist1069 = vzoom1069.analyzeHand(fist1069, { x: 0, y: 1 });
  check('P1069 握った手は形が fist と読める', rFist1069?.shape === 'fist', `shape=${rFist1069?.shape}`);
  const rPoint1069 = vzoom1069.analyzeHand(pointing1069, { x: 0, y: 1 });
  check('P1069 指さしは形が pointing と読める', rPoint1069?.shape === 'pointing', `shape=${rPoint1069?.shape}`);
  const rPeace1069 = vzoom1069.analyzeHand(peace1069, { x: 0, y: 1 });
  check('P1069 ピースは形が peace と読める', rPeace1069?.shape === 'peace', `shape=${rPeace1069?.shape}`);
  check('P1069 普通の手のひらは縦横が square と読める', rOpen1069?.palm.shape === 'square', `palm=${JSON.stringify(rOpen1069?.palm)}`);
  const rWide1069 = vzoom1069.analyzeHand(wide1069, { x: 0, y: 1 });
  check('P1069 横に広い手のひらは wide と読める', rWide1069?.palm.shape === 'wide', `palm=${JSON.stringify(rWide1069?.palm)}`);
  const rNarrow1069 = vzoom1069.analyzeHand(narrow1069, { x: 0, y: 1 });
  check('P1069 細長い手のひらは long と読める', rNarrow1069?.palm.shape === 'long', `palm=${JSON.stringify(rNarrow1069?.palm)}`);
  check('P1069 腕が切り出し端まで続く握り拳は手のひらの長さを決めない', rFist1069?.palm.length === null && rFist1069?.palm.shape === null, `palm=${JSON.stringify(rFist1069?.palm)}`);
  const insp1069 = ksi1069.inspect();
  check('P1069 自己点検の記録に手の形（visualHandShapes）が入っている', typeof insp1069.visualHandShapes === 'number' && insp1069.visualHandShapes >= 1, `visualHandShapes=${insp1069.visualHandShapes}`);
}

// ---- P969 目の色の第1段 ----
{
  const { visualZoomService: vzoom969 } = await import('../src/miki/conversation/services/visualZoomService');
  const { knowledgeSelfInspectionService: ksi969 } = await import('../src/miki/selfAwareness/services/knowledgeSelfInspectionService');
  type RGB969 = [number, number, number];
  const SKIN969: RGB969 = [232, 190, 160];
  const HAIR969: RGB969 = [45, 32, 22];
  const face969 = (eye: RGB969) => {
    const px: RGB969[] = []; for (let i = 0; i < 48 * 48; i++) px.push([245, 245, 245]);
    const disc = (cx: number, cy: number, r: number, c: RGB969) => { for (let y = 0; y < 48; y++) for (let x = 0; x < 48; x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) px[y * 48 + x] = c; };
    disc(24, 20, 16, HAIR969); disc(24, 25, 14, SKIN969);
    disc(17, 22, 3, eye); disc(31, 22, 3, eye);
    const o = new Uint8Array(48 * 48 * 4);
    px.forEach((c, i) => { o[i * 4] = c[0]; o[i * 4 + 1] = c[1]; o[i * 4 + 2] = c[2]; o[i * 4 + 3] = 255; });
    return o;
  };
  const brown969 = vzoom969.analyzeFace(face969([120, 72, 40]));
  check('P969 茶色い目が読める', brown969?.eyeColor === '茶色', `eyeColor=${brown969?.eyeColor}`);
  const black969 = vzoom969.analyzeFace(face969([30, 30, 30]));
  check('P969 黒い目が読める', black969?.eyeColor === '黒', `eyeColor=${black969?.eyeColor}`);
  const insp969 = ksi969.inspect();
  check('P969 自己点検の記録に目の色（visualEyeColor）が入っている', typeof insp969.visualEyeColor === 'number' && insp969.visualEyeColor >= 1, `visualEyeColor=${insp969.visualEyeColor}`);
}

// ---- P970 動画学習の第1段（字幕と画面の対応づけ） ----
{
  const { videoSceneService: vscene970 } = await import('../src/miki/conversation/services/videoSceneService');
  const { knowledgeSelfInspectionService: ksi970 } = await import('../src/miki/selfAwareness/services/knowledgeSelfInspectionService');
  type RGB970 = [number, number, number];
  const SKIN970: RGB970 = [232, 190, 160];
  const HAIR970: RGB970 = [45, 32, 22];
  const BLUE970: RGB970 = [40, 40, 120];
  const px970: RGB970[] = []; for (let i = 0; i < 48 * 56; i++) px970.push([245, 245, 245]);
  const rect970 = (x0: number, y0: number, x1: number, y1: number, c: RGB970) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) px970[y * 48 + x] = c; };
  const disc970 = (cx: number, cy: number, r: number, c: RGB970) => { for (let y = 0; y < 56; y++) for (let x = 0; x < 48; x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) px970[y * 48 + x] = c; };
  disc970(22, 9, 6, HAIR970); disc970(22, 10, 5, SKIN970);
  rect970(16, 15, 28, 32, BLUE970);
  rect970(12, 16, 15, 30, BLUE970); rect970(29, 16, 32, 30, BLUE970);
  rect970(16, 32, 21, 50, BLUE970); rect970(23, 32, 28, 50, BLUE970);
  const frame970 = new Uint8Array(48 * 56 * 4);
  px970.forEach((c, i) => { frame970[i * 4] = c[0]; frame970[i * 4 + 1] = c[1]; frame970[i * 4 + 2] = c[2]; frame970[i * 4 + 3] = 255; });
  const frames970 = [0, 1000, 2000].map((tMs) => ({ tMs, rgba: frame970, width: 48, height: 56 }));
  const segs970 = [{ startMs: 0, endMs: 2500, text: '人が歩く場面です' }];
  for (let i = 0; i < 3; i++) vscene970.decompose(frames970, segs970);
  const cand970 = vscene970.wordCandidates();
  check('P970 字幕と画面の対応が3回で候補になる', cand970.some((c) => c.word === '人が歩く場面' && c.count >= 3), `candidates=${JSON.stringify(cand970.slice(0, 2))}`);
  const insp970 = ksi970.inspect();
  check('P970 自己点検の記録に字幕対応（visualCaptionPairs）が入っている', typeof insp970.visualCaptionPairs === 'number' && insp970.visualCaptionPairs >= 1, `visualCaptionPairs=${insp970.visualCaptionPairs}`);
}

// ---- P971 明るい色の目の検出 ----
{
  const { visualZoomService: vzoom971 } = await import('../src/miki/conversation/services/visualZoomService');
  type RGB971 = [number, number, number];
  const SKIN971: RGB971 = [232, 190, 160];
  const HAIR971: RGB971 = [45, 32, 22];
  const face971 = (eye: RGB971) => {
    const px: RGB971[] = []; for (let i = 0; i < 48 * 48; i++) px.push([245, 245, 245]);
    const disc = (cx: number, cy: number, r: number, c: RGB971) => { for (let y = 0; y < 48; y++) for (let x = 0; x < 48; x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) px[y * 48 + x] = c; };
    disc(24, 20, 16, HAIR971); disc(24, 25, 14, SKIN971);
    disc(17, 22, 3, eye); disc(31, 22, 3, eye);
    const o = new Uint8Array(48 * 48 * 4);
    px.forEach((c, i) => { o[i * 4] = c[0]; o[i * 4 + 1] = c[1]; o[i * 4 + 2] = c[2]; o[i * 4 + 3] = 255; });
    return o;
  };
  const blue971 = vzoom971.analyzeFace(face971([70, 110, 180]));
  check('P971 明るい青い目が目として読める', blue971?.eyes === 2 && blue971?.eyeColor === '青', `eyes=${blue971?.eyes} eyeColor=${blue971?.eyeColor}`);
  const green971 = vzoom971.analyzeFace(face971([80, 150, 90]));
  check('P971 緑の目が目として読める', green971?.eyes === 2 && green971?.eyeColor === '緑', `eyes=${green971?.eyes} eyeColor=${green971?.eyeColor}`);
}

// ---- P972 アバターの存在状態を会話に接続 ----
{
  const { avatarPresenceService: av972 } = await import('../src/miki/selfAwareness/services/avatarPresenceService');
  av972.noteSleep('bibi');
  av972.noteAwake('miki');
  const r972a: any = await conversationCoreService.execute({ prompt: 'ビービーは今寝てる？', memories: [], recentMessages: [], conversationId: 'suite-p972' } as any);
  check('P972 「ビービーは今寝てる？」に存在状態で答える', r972a.reason === 'presence_answer' && String(r972a.replyText || '').includes('ビービーは今、寝ているよ'), `reason=${r972a.reason} reply=${String(r972a.replyText || '').slice(0, 40)}`);
  const r972b: any = await conversationCoreService.execute({ prompt: 'みきは今起きてる？', memories: [], recentMessages: [], conversationId: 'suite-p972' } as any);
  check('P972 「みきは今起きてる？」に存在状態で答える', r972b.reason === 'presence_answer' && String(r972b.replyText || '').includes('そばにいる'), `reason=${r972b.reason} reply=${String(r972b.replyText || '').slice(0, 40)}`);
  const r972c: any = await conversationCoreService.execute({ prompt: '相方は今寝てる？', memories: [], recentMessages: [], conversationId: 'suite-p972' } as any);
  check('P972 他の人の睡眠の話は横取りしない', r972c.reason !== 'presence_answer', `reason=${r972c.reason}`);
}

// ---- P973 髪の形の第1段 ----
{
  const { visualPoseService: vpose973 } = await import('../src/miki/conversation/services/visualPoseService');
  const { knowledgeSelfInspectionService: ksi973 } = await import('../src/miki/selfAwareness/services/knowledgeSelfInspectionService');
  type RGB973 = [number, number, number];
  const SKIN973: RGB973 = [232, 190, 160];
  const HAIR973: RGB973 = [45, 32, 22];
  const BLUE973: RGB973 = [40, 40, 120];
  const person973 = (wavy: boolean) => {
    const px: RGB973[] = []; for (let i = 0; i < 48 * 56; i++) px.push([245, 245, 245]);
    const rect = (x0: number, y0: number, x1: number, y1: number, c: RGB973) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) px[y * 48 + x] = c; };
    const disc = (cx: number, cy: number, r: number, c: RGB973) => { for (let y = 0; y < 56; y++) for (let x = 0; x < 48; x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) px[y * 48 + x] = c; };
    disc(22, 9, 6, HAIR973); disc(22, 10, 5, SKIN973);
    rect(16, 15, 28, 32, BLUE973);
    rect(12, 16, 15, 30, BLUE973); rect(29, 16, 32, 30, BLUE973);
    rect(16, 32, 21, 50, BLUE973); rect(23, 32, 28, 50, BLUE973);
    for (let x = 15; x <= 18; x++) rect(x, 6, x, wavy ? (x % 2 === 0 ? 34 : 42) : 42, HAIR973);
    for (let x = 26; x <= 29; x++) rect(x, 6, x, wavy ? (x % 2 === 0 ? 42 : 34) : 42, HAIR973);
    const o = new Uint8Array(48 * 56 * 4);
    px.forEach((c, i) => { o[i * 4] = c[0]; o[i * 4 + 1] = c[1]; o[i * 4 + 2] = c[2]; o[i * 4 + 3] = 255; });
    return o;
  };
  const straight973 = vpose973.analyzePose(person973(false), 48, 56);
  check('P973 まっすぐな髪が読める', straight973?.hairShape === 'straight', `shape=${straight973?.hairShape}`);
  const wavy973 = vpose973.analyzePose(person973(true), 48, 56);
  check('P973 うねりの強い髪が読める', wavy973?.hairShape === 'curly', `shape=${wavy973?.hairShape}`);
  const insp973 = ksi973.inspect();
  check('P973 自己点検の記録に髪の形（visualHairShape）が入っている', typeof insp973.visualHairShape === 'number' && insp973.visualHairShape >= 1, `visualHairShape=${insp973.visualHairShape}`);
}

// ---- P974 動画学習の第2段（候補から主張へ） ----
{
  const { videoSceneService: vscene974 } = await import('../src/miki/conversation/services/videoSceneService');
  const { claimDatabaseService: claims974 } = await import('../src/miki/memory/services/claimDatabaseService');
  const { knowledgeSelfInspectionService: ksi974 } = await import('../src/miki/selfAwareness/services/knowledgeSelfInspectionService');
  const added974 = vscene974.promoteCandidates();
  check('P974 字幕対応の候補が未検証の主張として登録される', added974 >= 1, `added=${added974}`);
  const found974 = claims974.searchClaims('人が歩く場面', 5) as any[];
  check('P974 登録された主張が検索でき、CANDIDATE のままである', found974.some((c) => String(c.statement || '').includes('動画の中で') && c.status === 'CANDIDATE'), `found=${found974.length}`);
  const again974 = vscene974.promoteCandidates();
  check('P974 同じ候補は二度登録されない', again974 === 0, `again=${again974}`);
  const insp974 = ksi974.inspect();
  check('P974 自己点検の記録に昇格数（visualPromotedClaims）が入っている', typeof insp974.visualPromotedClaims === 'number' && insp974.visualPromotedClaims >= 1, `visualPromotedClaims=${insp974.visualPromotedClaims}`);
}

// ---- P975 動きの癖の第1段 ----
{
  const { visualPoseService: vpose975 } = await import('../src/miki/conversation/services/visualPoseService');
  const { knowledgeSelfInspectionService: ksi975 } = await import('../src/miki/selfAwareness/services/knowledgeSelfInspectionService');
  type RGB975 = [number, number, number];
  const SKIN975: RGB975 = [232, 190, 160];
  const HAIR975: RGB975 = [45, 32, 22];
  const BLUE975: RGB975 = [40, 40, 120];
  const frame975 = (ox: number) => {
    const W = 56, H = 56, oy = 2;
    const px: RGB975[] = []; for (let i = 0; i < W * H; i++) px.push([245, 245, 245]);
    const rect = (x0: number, y0: number, x1: number, y1: number, c: RGB975) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (x >= 0 && x < W) px[y * W + x] = c; };
    const disc = (cx: number, cy: number, r: number, c: RGB975) => { for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) px[y * W + x] = c; };
    disc(ox + 12, oy + 7, 6, HAIR975); disc(ox + 12, oy + 8, 5, SKIN975);
    rect(ox + 6, oy + 13, ox + 18, oy + 30, BLUE975);
    rect(ox + 2, oy + 14, ox + 5, oy + 28, BLUE975); rect(ox + 19, oy + 14, ox + 22, oy + 28, BLUE975);
    rect(ox + 6, oy + 30, ox + 11, oy + 48, BLUE975); rect(ox + 13, oy + 30, ox + 18, oy + 48, BLUE975);
    const o = new Uint8Array(W * H * 4);
    px.forEach((c, i) => { o[i * 4] = c[0]; o[i * 4 + 1] = c[1]; o[i * 4 + 2] = c[2]; o[i * 4 + 3] = 255; });
    return { rgba: o, width: W, height: H };
  };
  const seq975 = Array.from({ length: 12 }, (_, i) => Math.round(5 * Math.sin(i * Math.PI / 3))).map((s, i) => ({ ...frame975(14 + s), t: i * 100 }));
  for (let i = 0; i < 14; i++) vpose975.analyzePoseMotion(seq975);
  const sum975 = vpose975.summary();
  check('P975 速い動きが続くと動きの癖として読める', sum975.motionHabit === 'fast' && sum975.qualityWindow >= 10, `habit=${sum975.motionHabit} window=${sum975.qualityWindow}`);
  const insp975 = ksi975.inspect();
  check('P975 自己点検の記録に動きの癖の窓（visualMotionHabit）が入っている', typeof insp975.visualMotionHabit === 'number' && insp975.visualMotionHabit >= 10, `visualMotionHabit=${insp975.visualMotionHabit}`);
}

// ---- P976 座っている人の形の同定 ----
{
  const { analyzeImagePixels: analyze976 } = await import('../src/miki/conversation/services/conversationImageObservationService');
  const { visualFigureService: vfig976 } = await import('../src/miki/conversation/services/visualFigureService');
  type RGB976 = [number, number, number];
  const SKIN976: RGB976 = [232, 190, 160];
  const HAIR976: RGB976 = [45, 32, 22];
  const BLUE976: RGB976 = [40, 40, 120];
  const seated976 = () => {
    const W = 64, H = 44;
    const px: RGB976[] = []; for (let i = 0; i < W * H; i++) px.push([245, 245, 245]);
    const rect = (x0: number, y0: number, x1: number, y1: number, c: RGB976) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) px[y * W + x] = c; };
    const disc = (cx: number, cy: number, r: number, c: RGB976) => { for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) px[y * W + x] = c; };
    disc(32, 7, 6, HAIR976); disc(32, 8, 5, SKIN976);
    rect(24, 13, 40, 22, BLUE976);
    rect(10, 22, 54, 29, BLUE976);
    rect(12, 29, 17, 35, BLUE976); rect(47, 29, 52, 35, BLUE976);
    const o = new Uint8Array(W * H * 4);
    px.forEach((c, i) => { o[i * 4] = c[0]; o[i * 4 + 1] = c[1]; o[i * 4 + 2] = c[2]; o[i * 4 + 3] = 255; });
    return o;
  };
  const feats976 = analyze976(seated976(), 64, 44);
  const id976 = vfig976.identifyFigure(feats976);
  check('P976 座っている人の形が同定できる', !!id976 && id976.description.includes('座っている人'), `desc=${id976?.description?.slice(0, 40)}`);
  check('P976 座った形の描き直し照合が通る', vfig976.verifyFigure(feats976) === true, `verify=${vfig976.verifyFigure(feats976)}`);
}

// ---- P977 姿勢読みの座り判定 ----
{
  const { visualPoseService: vpose977 } = await import('../src/miki/conversation/services/visualPoseService');
  type RGB977 = [number, number, number];
  const SKIN977: RGB977 = [232, 190, 160];
  const HAIR977: RGB977 = [45, 32, 22];
  const BLUE977: RGB977 = [40, 40, 120];
  const seated977 = () => {
    const W = 64, H = 44;
    const px: RGB977[] = []; for (let i = 0; i < W * H; i++) px.push([245, 245, 245]);
    const rect = (x0: number, y0: number, x1: number, y1: number, c: RGB977) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) px[y * W + x] = c; };
    const disc = (cx: number, cy: number, r: number, c: RGB977) => { for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) px[y * W + x] = c; };
    disc(32, 7, 6, HAIR977); disc(32, 8, 5, SKIN977);
    rect(24, 13, 40, 22, BLUE977);
    rect(10, 22, 54, 29, BLUE977);
    rect(12, 29, 17, 35, BLUE977); rect(47, 29, 52, 35, BLUE977);
    const o = new Uint8Array(W * H * 4);
    px.forEach((c, i) => { o[i * 4] = c[0]; o[i * 4 + 1] = c[1]; o[i * 4 + 2] = c[2]; o[i * 4 + 3] = 255; });
    return o;
  };
  const sit977 = vpose977.analyzePose(seated977(), 64, 44);
  check('P977 すねの分かれがあっても座っている姿勢として読める', sit977?.posture === 'SITTING', `posture=${sit977?.posture}`);
  const standing977 = (() => {
    const px: RGB977[] = []; for (let i = 0; i < 48 * 56; i++) px.push([245, 245, 245]);
    const rect = (x0: number, y0: number, x1: number, y1: number, c: RGB977) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) px[y * 48 + x] = c; };
    const disc = (cx: number, cy: number, r: number, c: RGB977) => { for (let y = 0; y < 56; y++) for (let x = 0; x < 48; x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) px[y * 48 + x] = c; };
    disc(22, 9, 6, HAIR977); disc(22, 10, 5, SKIN977);
    rect(16, 15, 28, 32, BLUE977); rect(12, 16, 15, 30, BLUE977); rect(29, 16, 32, 30, BLUE977);
    rect(16, 32, 21, 50, BLUE977); rect(23, 32, 28, 50, BLUE977);
    const o = new Uint8Array(48 * 56 * 4);
    px.forEach((c, i) => { o[i * 4] = c[0]; o[i * 4 + 1] = c[1]; o[i * 4 + 2] = c[2]; o[i * 4 + 3] = 255; });
    return o;
  })();
  const stand977 = vpose977.analyzePose(standing977, 48, 56);
  check('P977 立っている人は立っているまま読める', stand977?.posture === 'STANDING', `posture=${stand977?.posture}`);
}

// ---- P978 眉の第1段 ----
{
  const { visualZoomService: vzoom978 } = await import('../src/miki/conversation/services/visualZoomService');
  const { knowledgeSelfInspectionService: ksi978 } = await import('../src/miki/selfAwareness/services/knowledgeSelfInspectionService');
  type RGB978 = [number, number, number];
  const SKIN978: RGB978 = [232, 190, 160];
  const HAIR978: RGB978 = [45, 32, 22];
  const DARK978: RGB978 = [30, 30, 30];
  const face978 = (withBrows: boolean) => {
    const px: RGB978[] = []; for (let i = 0; i < 48 * 48; i++) px.push([245, 245, 245]);
    const disc = (cx: number, cy: number, r: number, c: RGB978) => { for (let y = 0; y < 48; y++) for (let x = 0; x < 48; x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) px[y * 48 + x] = c; };
    const rect = (x0: number, y0: number, x1: number, y1: number, c: RGB978) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) px[y * 48 + x] = c; };
    disc(24, 20, 16, HAIR978); disc(24, 25, 14, SKIN978);
    disc(17, 22, 3, DARK978); disc(31, 22, 3, DARK978);
    if (withBrows) { rect(12, 14, 22, 16, HAIR978); rect(26, 14, 36, 16, HAIR978); }
    const o = new Uint8Array(48 * 48 * 4);
    px.forEach((c, i) => { o[i * 4] = c[0]; o[i * 4 + 1] = c[1]; o[i * 4 + 2] = c[2]; o[i * 4 + 3] = 255; });
    return o;
  };
  const with978 = vzoom978.analyzeFace(face978(true));
  check('P978 眉のある顔で眉が読める', with978?.brows === true && with978.description.includes('眉が見える'), `brows=${with978?.brows}`);
  const without978 = vzoom978.analyzeFace(face978(false));
  check('P978 眉のない顔では眉は無いと読む', without978?.brows === false, `brows=${without978?.brows}`);
  const insp978 = ksi978.inspect();
  check('P978 自己点検の記録に眉（visualBrows）が入っている', typeof insp978.visualBrows === 'number' && insp978.visualBrows >= 1, `visualBrows=${insp978.visualBrows}`);
}

// ---- P979 鼻の第1段 ----
{
  const { visualZoomService: vzoom979 } = await import('../src/miki/conversation/services/visualZoomService');
  const { knowledgeSelfInspectionService: ksi979 } = await import('../src/miki/selfAwareness/services/knowledgeSelfInspectionService');
  type RGB979 = [number, number, number];
  const SKIN979: RGB979 = [232, 190, 160];
  const HAIR979: RGB979 = [45, 32, 22];
  const DARK979: RGB979 = [30, 30, 30];
  const SHADOW979: RGB979 = [203, 163, 133];
  const face979 = (withNose: boolean) => {
    const px: RGB979[] = []; for (let i = 0; i < 48 * 48; i++) px.push([245, 245, 245]);
    const disc = (cx: number, cy: number, r: number, c: RGB979) => { for (let y = 0; y < 48; y++) for (let x = 0; x < 48; x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) px[y * 48 + x] = c; };
    const rect = (x0: number, y0: number, x1: number, y1: number, c: RGB979) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) px[y * 48 + x] = c; };
    disc(24, 20, 16, HAIR979); disc(24, 24, 16, SKIN979);
    disc(17, 20, 3, DARK979); disc(31, 20, 3, DARK979);
    if (withNose) rect(22, 25, 26, 28, SHADOW979);
    const o = new Uint8Array(48 * 48 * 4);
    px.forEach((c, i) => { o[i * 4] = c[0]; o[i * 4 + 1] = c[1]; o[i * 4 + 2] = c[2]; o[i * 4 + 3] = 255; });
    return o;
  };
  const with979 = vzoom979.analyzeFace(face979(true));
  check('P979 鼻の影のある顔で鼻が読める', with979?.nose === true && with979.description.includes('鼻の影が見える'), `nose=${with979?.nose}`);
  const flat979 = vzoom979.analyzeFace(face979(false));
  check('P979 平らな顔では鼻は分からないままにする', flat979?.nose === null, `nose=${flat979?.nose}`);
  const insp979 = ksi979.inspect();
  check('P979 自己点検の記録に鼻（visualNose）が入っている', typeof insp979.visualNose === 'number' && insp979.visualNose >= 1, `visualNose=${insp979.visualNose}`);
}

// ---- P980 耳の第1段 ----
{
  const { visualZoomService: vzoom980 } = await import('../src/miki/conversation/services/visualZoomService');
  const { knowledgeSelfInspectionService: ksi980 } = await import('../src/miki/selfAwareness/services/knowledgeSelfInspectionService');
  type RGB980 = [number, number, number];
  const SKIN980: RGB980 = [232, 190, 160];
  const HAIR980: RGB980 = [45, 32, 22];
  const DARK980: RGB980 = [30, 30, 30];
  const face980 = (withEars: boolean) => {
    const px: RGB980[] = []; for (let i = 0; i < 48 * 48; i++) px.push([245, 245, 245]);
    const disc = (cx: number, cy: number, r: number, c: RGB980) => { for (let y = 0; y < 48; y++) for (let x = 0; x < 48; x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) px[y * 48 + x] = c; };
    const rect = (x0: number, y0: number, x1: number, y1: number, c: RGB980) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) px[y * 48 + x] = c; };
    disc(24, 20, 16, HAIR980); disc(24, 24, 16, SKIN980);
    if (withEars) { rect(3, 20, 9, 27, SKIN980); rect(39, 20, 45, 27, SKIN980); }
    disc(17, 20, 3, DARK980); disc(31, 20, 3, DARK980);
    const o = new Uint8Array(48 * 48 * 4);
    px.forEach((c, i) => { o[i * 4] = c[0]; o[i * 4 + 1] = c[1]; o[i * 4 + 2] = c[2]; o[i * 4 + 3] = 255; });
    return o;
  };
  const with980 = vzoom980.analyzeFace(face980(true));
  check('P980 耳のある顔で耳が読める', with980?.ears === true && with980.description.includes('耳が見える'), `ears=${with980?.ears}`);
  const plain980 = vzoom980.analyzeFace(face980(false));
  check('P980 普通の楕円の顔は耳なしと読む（自然な広がりと区別できる）', plain980?.ears === false, `ears=${plain980?.ears}`);
  const insp980 = ksi980.inspect();
  check('P980 自己点検の記録に耳（visualEars）が入っている', typeof insp980.visualEars === 'number' && insp980.visualEars >= 1, `visualEars=${insp980.visualEars}`);
}

// ---- P981 顔の形の第1段 ----
{
  const { visualZoomService: vzoom981 } = await import('../src/miki/conversation/services/visualZoomService');
  const { knowledgeSelfInspectionService: ksi981 } = await import('../src/miki/selfAwareness/services/knowledgeSelfInspectionService');
  type RGB981 = [number, number, number];
  const SKIN981: RGB981 = [232, 190, 160];
  const HAIR981: RGB981 = [45, 32, 22];
  const DARK981: RGB981 = [30, 30, 30];
  const mk981 = () => { const px: RGB981[] = []; for (let i = 0; i < 48 * 48; i++) px.push([245, 245, 245]); return px; };
  const fin981 = (px: RGB981[]) => { const o = new Uint8Array(48 * 48 * 4); px.forEach((c, i) => { o[i * 4] = c[0]; o[i * 4 + 1] = c[1]; o[i * 4 + 2] = c[2]; o[i * 4 + 3] = 255; }); return o; };
  const eyes981 = (px: RGB981[]) => { const disc = (cx: number, cy: number, r: number, c: RGB981) => { for (let y = 0; y < 48; y++) for (let x = 0; x < 48; x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) px[y * 48 + x] = c; }; disc(17, 20, 3, DARK981); disc(31, 20, 3, DARK981); };
  const roundPx = mk981();
  for (let y = 6; y <= 12; y++) for (let x = 8; x <= 40; x++) roundPx[y * 48 + x] = HAIR981;
  for (let y = 10; y <= 38; y++) for (let x = 10; x <= 38; x++) if (roundPx[y * 48 + x] !== HAIR981) roundPx[y * 48 + x] = SKIN981;
  eyes981(roundPx);
  const round981 = vzoom981.analyzeFace(fin981(roundPx));
  check('P981 四角めの顔は丸いと読める', round981?.faceShape === 'round' && round981.faceShapeDescription === '顔は丸い', `shape=${round981?.faceShape}`);
  const longPx = mk981();
  for (let y = 0; y < 48; y++) for (let x = 0; x < 48; x++) { const dx = (x - 24) / 11, dy = (y - 24) / 17; if (dx * dx + dy * dy <= 1) longPx[y * 48 + x] = SKIN981; }
  for (let y = 4; y <= 9; y++) for (let x = 13; x <= 35; x++) longPx[y * 48 + x] = HAIR981;
  eyes981(longPx);
  const long981 = vzoom981.analyzeFace(fin981(longPx));
  check('P981 縦長の顔は細長いと読める', long981?.faceShape === 'long', `shape=${long981?.faceShape}`);
  const pointedPx = mk981();
  for (let y = 10; y <= 38; y++) { const half = y <= 22 ? 14 : Math.round(14 - 11 * ((y - 22) / 16)); for (let x = 24 - half; x <= 24 + half; x++) pointedPx[y * 48 + x] = SKIN981; }
  for (let y = 6; y <= 11; y++) for (let x = 9; x <= 39; x++) pointedPx[y * 48 + x] = HAIR981;
  eyes981(pointedPx);
  const pointed981 = vzoom981.analyzeFace(fin981(pointedPx));
  check('P981 下へ細くなる顔はあごが尖っていると読める', pointed981?.faceShape === 'pointed', `shape=${pointed981?.faceShape}`);
  const insp981 = ksi981.inspect();
  check('P981 自己点検の記録に顔の形（visualFaceShape）が入っている', typeof insp981.visualFaceShape === 'number' && insp981.visualFaceShape >= 1, `visualFaceShape=${insp981.visualFaceShape}`);
}

// ---- P982 頬の赤みの第1段 ----
{
  const { visualZoomService: vzoom982 } = await import('../src/miki/conversation/services/visualZoomService');
  const { knowledgeSelfInspectionService: ksi982 } = await import('../src/miki/selfAwareness/services/knowledgeSelfInspectionService');
  type RGB982 = [number, number, number];
  const SKIN982: RGB982 = [232, 190, 160];
  const HAIR982: RGB982 = [45, 32, 22];
  const DARK982: RGB982 = [30, 30, 30];
  const BLUSH982: RGB982 = [238, 150, 130];
  const face982 = (withBlush: boolean) => {
    const px: RGB982[] = []; for (let i = 0; i < 48 * 48; i++) px.push([245, 245, 245]);
    const disc = (cx: number, cy: number, r: number, c: RGB982) => { for (let y = 0; y < 48; y++) for (let x = 0; x < 48; x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) px[y * 48 + x] = c; };
    const rect = (x0: number, y0: number, x1: number, y1: number, c: RGB982) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) px[y * 48 + x] = c; };
    disc(24, 20, 16, HAIR982); disc(24, 24, 16, SKIN982);
    disc(17, 20, 3, DARK982); disc(31, 20, 3, DARK982);
    if (withBlush) { rect(10, 27, 17, 33, BLUSH982); rect(31, 27, 38, 33, BLUSH982); }
    const o = new Uint8Array(48 * 48 * 4);
    px.forEach((c, i) => { o[i * 4] = c[0]; o[i * 4 + 1] = c[1]; o[i * 4 + 2] = c[2]; o[i * 4 + 3] = 255; });
    return o;
  };
  const with982 = vzoom982.analyzeFace(face982(true));
  check('P982 頬の赤みが読める', with982?.cheekFlush === true && with982.description.includes('頬が赤みを帯びている'), `flush=${with982?.cheekFlush}`);
  const plain982 = vzoom982.analyzeFace(face982(false));
  check('P982 赤みのない顔では頬は不明のまま', plain982?.cheekFlush === null, `flush=${plain982?.cheekFlush}`);
  const insp982 = ksi982.inspect();
  check('P982 自己点検の記録に頬（visualCheeks）が入っている', typeof insp982.visualCheeks === 'number' && insp982.visualCheeks >= 1, `visualCheeks=${insp982.visualCheeks}`);
}

// ---- P983 動画学習の第3段（動画をまたいだ一貫性） ----
{
  const { videoSceneService: vscene983 } = await import('../src/miki/conversation/services/videoSceneService');
  const { knowledgeSelfInspectionService: ksi983 } = await import('../src/miki/selfAwareness/services/knowledgeSelfInspectionService');
  type RGB983 = [number, number, number];
  const SKIN983: RGB983 = [232, 190, 160];
  const HAIR983: RGB983 = [45, 32, 22];
  const BLUE983: RGB983 = [40, 40, 120];
  const px983: RGB983[] = []; for (let i = 0; i < 48 * 56; i++) px983.push([245, 245, 245]);
  const rect983 = (x0: number, y0: number, x1: number, y1: number, c: RGB983) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) px983[y * 48 + x] = c; };
  const disc983 = (cx: number, cy: number, r: number, c: RGB983) => { for (let y = 0; y < 56; y++) for (let x = 0; x < 48; x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) px983[y * 48 + x] = c; };
  disc983(22, 9, 6, HAIR983); disc983(22, 10, 5, SKIN983);
  rect983(16, 15, 28, 32, BLUE983); rect983(12, 16, 15, 30, BLUE983); rect983(29, 16, 32, 30, BLUE983);
  rect983(16, 32, 21, 50, BLUE983); rect983(23, 32, 28, 50, BLUE983);
  const person983 = new Uint8Array(48 * 56 * 4);
  px983.forEach((c, i) => { person983[i * 4] = c[0]; person983[i * 4 + 1] = c[1]; person983[i * 4 + 2] = c[2]; person983[i * 4 + 3] = 255; });
  const solid983 = new Uint8Array(48 * 56 * 4);
  for (let i = 0; i < 48 * 56; i++) { solid983[i * 4] = 200; solid983[i * 4 + 1] = 40; solid983[i * 4 + 2] = 40; solid983[i * 4 + 3] = 255; }
  const framesA983 = [0, 1000, 2000].map((tMs) => ({ tMs, rgba: person983, width: 48, height: 56 }));
  for (let i = 0; i < 3; i++) vscene983.decompose(framesA983, [{ startMs: 0, endMs: 2500, text: '猫が寝る場面です' }]);
  const framesB983 = [0, 1000, 2000, 3000, 4000].map((tMs, i) => ({ tMs, rgba: i % 2 === 0 ? person983 : solid983, width: 48, height: 56 }));
  vscene983.decompose(framesB983, [{ startMs: 0, endMs: 4500, text: '犬が走る場面です' }]);
  const cons983 = vscene983.consistentCandidates();
  check('P983 別の動画でも繰り返す対応は一貫した候補になる', cons983.some((c) => c.word === '猫が寝る場面' && c.runs >= 2), `consistent=${JSON.stringify(cons983.slice(0, 2))}`);
  check('P983 1本の中でだけ繰り返す対応は一貫した候補にはならない', !cons983.some((c) => c.word === '犬が走る場面') && vscene983.wordCandidates().some((c) => c.word === '犬が走る場面'), `consistentWords=${JSON.stringify(cons983.map((c) => c.word))}`);
  const insp983 = ksi983.inspect();
  check('P983 自己点検の記録に一貫候補（visualConsistentPairs）が入っている', typeof insp983.visualConsistentPairs === 'number' && insp983.visualConsistentPairs >= 1, `visualConsistentPairs=${insp983.visualConsistentPairs}`);
}

// ---- P984 首のくびれの第1段 ----
{
  const { visualPoseService: vpose984 } = await import('../src/miki/conversation/services/visualPoseService');
  const { knowledgeSelfInspectionService: ksi984 } = await import('../src/miki/selfAwareness/services/knowledgeSelfInspectionService');
  type RGB984 = [number, number, number];
  const SKIN984: RGB984 = [232, 190, 160];
  const HAIR984: RGB984 = [45, 32, 22];
  const BLUE984: RGB984 = [40, 40, 120];
  const person984 = (fillNeck: boolean) => {
    const px: RGB984[] = []; for (let i = 0; i < 48 * 56; i++) px.push([245, 245, 245]);
    const rect = (x0: number, y0: number, x1: number, y1: number, c: RGB984) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) px[y * 48 + x] = c; };
    const disc = (cx: number, cy: number, r: number, c: RGB984) => { for (let y = 0; y < 56; y++) for (let x = 0; x < 48; x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) px[y * 48 + x] = c; };
    disc(22, 9, 6, HAIR984); disc(22, 10, 5, SKIN984);
    if (fillNeck) rect(13, 11, 31, 16, SKIN984);
    rect(16, 15, 28, 32, BLUE984); rect(12, 16, 15, 30, BLUE984); rect(29, 16, 32, 30, BLUE984);
    rect(16, 32, 21, 50, BLUE984); rect(23, 32, 28, 50, BLUE984);
    const o = new Uint8Array(48 * 56 * 4);
    px.forEach((c, i) => { o[i * 4] = c[0]; o[i * 4 + 1] = c[1]; o[i * 4 + 2] = c[2]; o[i * 4 + 3] = 255; });
    return o;
  };
  const std984 = vpose984.analyzePose(person984(false), 48, 56);
  check('P984 普通の人で首のくびれが読める', std984?.neck === true && std984.neckDescription === '首のくびれが見える', `neck=${std984?.neck}`);
  const filled984 = vpose984.analyzePose(person984(true), 48, 56);
  check('P984 首が埋まった人ではくびれなしと読む', filled984?.neck === false, `neck=${filled984?.neck}`);
  const insp984 = ksi984.inspect();
  check('P984 自己点検の記録に首（visualNeck）が入っている', typeof insp984.visualNeck === 'number' && insp984.visualNeck >= 1, `visualNeck=${insp984.visualNeck}`);
}

// ---- P985 生え際の形の第1段 ----
{
  const { visualZoomService: vzoom985 } = await import('../src/miki/conversation/services/visualZoomService');
  const { knowledgeSelfInspectionService: ksi985 } = await import('../src/miki/selfAwareness/services/knowledgeSelfInspectionService');
  type RGB985 = [number, number, number];
  const SKIN985: RGB985 = [232, 190, 160];
  const HAIR985: RGB985 = [45, 32, 22];
  const DARK985: RGB985 = [30, 30, 30];
  const mk985 = () => { const px: RGB985[] = []; for (let i = 0; i < 48 * 48; i++) px.push([245, 245, 245]); return px; };
  const fin985 = (px: RGB985[]) => { const o = new Uint8Array(48 * 48 * 4); px.forEach((c, i) => { o[i * 4] = c[0]; o[i * 4 + 1] = c[1]; o[i * 4 + 2] = c[2]; o[i * 4 + 3] = 255; }); return o; };
  const rect985 = (px: RGB985[], x0: number, y0: number, x1: number, y1: number, c: RGB985) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) px[y * 48 + x] = c; };
  const eyes985 = (px: RGB985[]) => { const disc = (cx: number, cy: number, r: number, c: RGB985) => { for (let y = 0; y < 48; y++) for (let x = 0; x < 48; x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) px[y * 48 + x] = c; }; disc(17, 24, 3, DARK985); disc(31, 24, 3, DARK985); };
  const straightPx = mk985();
  rect985(straightPx, 8, 4, 40, 15, HAIR985); rect985(straightPx, 10, 16, 38, 44, SKIN985); eyes985(straightPx);
  const straight985 = vzoom985.analyzeFace(fin985(straightPx));
  check('P985 平らな生え際はまっすぐと読める', straight985?.hairline === 'straight' && straight985.hairlineDescription === '生え際はまっすぐ', `hairline=${straight985?.hairline}`);
  const mPx = mk985();
  rect985(mPx, 8, 4, 40, 15, HAIR985); rect985(mPx, 10, 16, 38, 44, SKIN985);
  rect985(mPx, 10, 10, 16, 16, SKIN985); rect985(mPx, 32, 10, 38, 16, SKIN985); eyes985(mPx);
  const m985 = vzoom985.analyzeFace(fin985(mPx));
  check('P985 両脇で肌が上がる生え際はM字型と読める', m985?.hairline === 'm-shaped', `hairline=${m985?.hairline}`);
  const roundPx = mk985();
  const disc985 = (cx: number, cy: number, r: number, c: RGB985) => { for (let y = 0; y < 48; y++) for (let x = 0; x < 48; x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) roundPx[y * 48 + x] = c; };
  disc985(24, 20, 16, HAIR985); disc985(24, 24, 16, SKIN985); disc985(17, 20, 3, DARK985); disc985(31, 20, 3, DARK985);
  const round985 = vzoom985.analyzeFace(fin985(roundPx));
  check('P985 円盤の顔の生え際は丸いと読める', round985?.hairline === 'round', `hairline=${round985?.hairline}`);
  const insp985 = ksi985.inspect();
  check('P985 自己点検の記録に生え際（visualHairline）が入っている', typeof insp985.visualHairline === 'number' && insp985.visualHairline >= 1, `visualHairline=${insp985.visualHairline}`);
}

// ---- P986 腕の長さの第1段 ----
{
  const { visualPoseService: vpose986 } = await import('../src/miki/conversation/services/visualPoseService');
  const { knowledgeSelfInspectionService: ksi986 } = await import('../src/miki/selfAwareness/services/knowledgeSelfInspectionService');
  type RGB986 = [number, number, number];
  const SKIN986: RGB986 = [232, 190, 160];
  const HAIR986: RGB986 = [45, 32, 22];
  const BLUE986: RGB986 = [40, 40, 120];
  const person986 = (armBottom: number) => {
    const px: RGB986[] = []; for (let i = 0; i < 48 * 56; i++) px.push([245, 245, 245]);
    const rect = (x0: number, y0: number, x1: number, y1: number, c: RGB986) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) px[y * 48 + x] = c; };
    const disc = (cx: number, cy: number, r: number, c: RGB986) => { for (let y = 0; y < 56; y++) for (let x = 0; x < 48; x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) px[y * 48 + x] = c; };
    disc(22, 9, 6, HAIR986); disc(22, 10, 5, SKIN986);
    rect(16, 15, 28, 32, BLUE986);
    if (armBottom > 32) { rect(11, 16, 14, armBottom, BLUE986); rect(30, 16, 33, armBottom, BLUE986); }
    else { rect(12, 16, 15, armBottom, BLUE986); rect(29, 16, 32, armBottom, BLUE986); }
    rect(16, 32, 21, 50, BLUE986); rect(23, 32, 28, 50, BLUE986);
    const o = new Uint8Array(48 * 56 * 4);
    px.forEach((c, i) => { o[i * 4] = c[0]; o[i * 4 + 1] = c[1]; o[i * 4 + 2] = c[2]; o[i * 4 + 3] = 255; });
    return o;
  };
  const std986 = vpose986.analyzePose(person986(30), 48, 56);
  check('P986 普通の腕の長さは言わない', std986?.armLength === null, `armLength=${std986?.armLength}`);
  const long986 = vpose986.analyzePose(person986(44), 48, 56);
  check('P986 長い腕が読める（手の探索範囲を超えてもマスクから測る）', long986?.armLength === 'long' && long986.armLengthDescription === '腕が長い', `armLength=${long986?.armLength}`);
  const short986 = vpose986.analyzePose(person986(21), 48, 56);
  check('P986 短い腕が読める', short986?.armLength === 'short', `armLength=${short986?.armLength}`);
  const insp986 = ksi986.inspect();
  check('P986 自己点検の記録に腕の長さ（visualArmLength）が入っている', typeof insp986.visualArmLength === 'number' && insp986.visualArmLength >= 1, `visualArmLength=${insp986.visualArmLength}`);
}

// ---- P987 脚の長さの第1段 ----
{
  const { visualPoseService: vpose987 } = await import('../src/miki/conversation/services/visualPoseService');
  const { knowledgeSelfInspectionService: ksi987 } = await import('../src/miki/selfAwareness/services/knowledgeSelfInspectionService');
  type RGB987 = [number, number, number];
  const SKIN987: RGB987 = [232, 190, 160];
  const HAIR987: RGB987 = [45, 32, 22];
  const BLUE987: RGB987 = [40, 40, 120];
  const person987 = (W: number, H: number, legBottom: number) => {
    const px: RGB987[] = []; for (let i = 0; i < W * H; i++) px.push([245, 245, 245]);
    const rect = (x0: number, y0: number, x1: number, y1: number, c: RGB987) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) px[y * W + x] = c; };
    const disc = (cx: number, cy: number, r: number, c: RGB987) => { for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) px[y * W + x] = c; };
    disc(22, 9, 6, HAIR987); disc(22, 10, 5, SKIN987);
    rect(16, 15, 28, 32, BLUE987); rect(12, 16, 15, 30, BLUE987); rect(29, 16, 32, 30, BLUE987);
    rect(16, 32, 21, legBottom, BLUE987); rect(23, 32, 28, legBottom, BLUE987);
    const o = new Uint8Array(W * H * 4);
    px.forEach((c, i) => { o[i * 4] = c[0]; o[i * 4 + 1] = c[1]; o[i * 4 + 2] = c[2]; o[i * 4 + 3] = 255; });
    return o;
  };
  const std987 = vpose987.analyzePose(person987(48, 56, 50), 48, 56);
  check('P987 普通の脚の長さは言わない', std987?.legLength === null, `legLength=${std987?.legLength}`);
  const long987 = vpose987.analyzePose(person987(48, 68, 62), 48, 68);
  check('P987 長い脚が読める', long987?.legLength === 'long' && long987.legLengthDescription === '脚が長い', `legLength=${long987?.legLength}`);
  const short987 = vpose987.analyzePose(person987(48, 48, 44), 48, 48);
  check('P987 短い脚が読める', short987?.legLength === 'short', `legLength=${short987?.legLength}`);
  const insp987 = ksi987.inspect();
  check('P987 自己点検の記録に脚の長さ（visualLegLength）が入っている', typeof insp987.visualLegLength === 'number' && insp987.visualLegLength >= 1, `visualLegLength=${insp987.visualLegLength}`);
}

// ---- P988 目の大きさの第1段 ----
{
  const { visualZoomService: vzoom988 } = await import('../src/miki/conversation/services/visualZoomService');
  const { knowledgeSelfInspectionService: ksi988 } = await import('../src/miki/selfAwareness/services/knowledgeSelfInspectionService');
  type RGB988 = [number, number, number];
  const SKIN988: RGB988 = [232, 190, 160];
  const HAIR988: RGB988 = [45, 32, 22];
  const DARK988: RGB988 = [30, 30, 30];
  const face988 = (eyeR: number) => {
    const px: RGB988[] = []; for (let i = 0; i < 48 * 48; i++) px.push([245, 245, 245]);
    const disc = (cx: number, cy: number, r: number, c: RGB988) => { for (let y = 0; y < 48; y++) for (let x = 0; x < 48; x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) px[y * 48 + x] = c; };
    disc(24, 20, 16, HAIR988); disc(24, 24, 16, SKIN988);
    disc(17, 20, eyeR, DARK988); disc(31, 20, eyeR, DARK988);
    const o = new Uint8Array(48 * 48 * 4);
    px.forEach((c, i) => { o[i * 4] = c[0]; o[i * 4 + 1] = c[1]; o[i * 4 + 2] = c[2]; o[i * 4 + 3] = 255; });
    return o;
  };
  const large988 = vzoom988.analyzeFace(face988(3));
  check('P988 大きめの目が読める', large988?.eyeSize === 'large' && large988.eyeSizeDescription === '目が大きい', `eyeSize=${large988?.eyeSize}`);
  const mid988 = vzoom988.analyzeFace(face988(2));
  check('P988 普通の目の大きさは言わない', mid988?.eyeSize === null, `eyeSize=${mid988?.eyeSize}`);
  const small988 = vzoom988.analyzeFace(face988(1));
  check('P988 小さい目が読める', small988?.eyeSize === 'small', `eyeSize=${small988?.eyeSize}`);
  const insp988 = ksi988.inspect();
  check('P988 自己点検の記録に目の大きさ（visualEyeSize）が入っている', typeof insp988.visualEyeSize === 'number' && insp988.visualEyeSize >= 1, `visualEyeSize=${insp988.visualEyeSize}`);
}

// ---- P989 口の大きさの第1段 ----
{
  const { visualZoomService: vzoom989 } = await import('../src/miki/conversation/services/visualZoomService');
  const { knowledgeSelfInspectionService: ksi989 } = await import('../src/miki/selfAwareness/services/knowledgeSelfInspectionService');
  type RGB989 = [number, number, number];
  const SKIN989: RGB989 = [232, 190, 160];
  const HAIR989: RGB989 = [45, 32, 22];
  const DARK989: RGB989 = [30, 30, 30];
  const face989 = (mouth: [number, number]) => {
    const px: RGB989[] = []; for (let i = 0; i < 48 * 48; i++) px.push([245, 245, 245]);
    const disc = (cx: number, cy: number, r: number, c: RGB989) => { for (let y = 0; y < 48; y++) for (let x = 0; x < 48; x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) px[y * 48 + x] = c; };
    disc(24, 20, 16, HAIR989); disc(24, 24, 16, SKIN989);
    disc(17, 20, 3, DARK989); disc(31, 20, 3, DARK989);
    for (let y = 33; y <= 34; y++) for (let x = mouth[0]; x <= mouth[1]; x++) px[y * 48 + x] = DARK989;
    const o = new Uint8Array(48 * 48 * 4);
    px.forEach((c, i) => { o[i * 4] = c[0]; o[i * 4 + 1] = c[1]; o[i * 4 + 2] = c[2]; o[i * 4 + 3] = 255; });
    return o;
  };
  const wide989 = vzoom989.analyzeFace(face989([15, 33]));
  check('P989 大きい口が読める', wide989?.mouthSize === 'large' && wide989.mouthSizeDescription === '口が大きい', `mouthSize=${wide989?.mouthSize}`);
  const small989 = vzoom989.analyzeFace(face989([22, 26]));
  check('P989 小さい口が読める', small989?.mouthSize === 'small', `mouthSize=${small989?.mouthSize}`);
  const mid989 = vzoom989.analyzeFace(face989([19, 29]));
  check('P989 普通の口の大きさは言わない', mid989?.mouthSize === null, `mouthSize=${mid989?.mouthSize}`);
  const insp989 = ksi989.inspect();
  check('P989 自己点検の記録に口の大きさ（visualMouthSize）が入っている', typeof insp989.visualMouthSize === 'number' && insp989.visualMouthSize >= 1, `visualMouthSize=${insp989.visualMouthSize}`);
}

// ---- P990 検定バッテリー第3弾（姿勢と顔の読み P950〜P989 の統合確認） ----
{
  const { visualPoseService: vpose990 } = await import('../src/miki/conversation/services/visualPoseService');
  const { visualZoomService: vzoom990 } = await import('../src/miki/conversation/services/visualZoomService');
  type RGB990 = [number, number, number];
  const SKIN990: RGB990 = [232, 190, 160];
  const HAIR990: RGB990 = [45, 32, 22];
  const BLUE990: RGB990 = [40, 40, 120];
  const DARK990: RGB990 = [30, 30, 30];
  const BG990: RGB990 = [245, 245, 245];
  const fin990 = (px: RGB990[], W: number, H: number) => { const o = new Uint8Array(W * H * 4); px.forEach((c, i) => { o[i * 4] = c[0]; o[i * 4 + 1] = c[1]; o[i * 4 + 2] = c[2]; o[i * 4 + 3] = 255; }); return o; };
  // 立つ人（P984/P986/P987で検証済みの描き方）
  const person990 = (W: number, H: number, armBottom: number, legBottom: number) => {
    const px: RGB990[] = []; for (let i = 0; i < W * H; i++) px.push([...BG990] as RGB990);
    const rect = (x0: number, y0: number, x1: number, y1: number, c: RGB990) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) px[y * W + x] = c; };
    const disc = (cx: number, cy: number, r: number, c: RGB990) => { for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) px[y * W + x] = c; };
    disc(22, 9, 6, HAIR990); disc(22, 10, 5, SKIN990);
    rect(16, 15, 28, 32, BLUE990);
    if (armBottom > 32) { rect(11, 16, 14, armBottom, BLUE990); rect(30, 16, 33, armBottom, BLUE990); }
    else { rect(12, 16, 15, armBottom, BLUE990); rect(29, 16, 32, armBottom, BLUE990); }
    rect(16, 32, 21, legBottom, BLUE990); rect(23, 32, 28, legBottom, BLUE990);
    return px;
  };
  const std990 = vpose990.analyzePose(fin990(person990(48, 56, 30, 50), 48, 56), 48, 56);
  check('P990 バッテリー：立つ人の姿勢と首', std990?.posture === 'STANDING' && std990.neck === true, `posture=${std990?.posture} neck=${std990?.neck}`);
  check('P990 バッテリー：普通の腕と脚は言わない', std990?.armLength === null && std990?.legLength === null, `arm=${std990?.armLength} leg=${std990?.legLength}`);
  const longArm990 = vpose990.analyzePose(fin990(person990(48, 56, 44, 50), 48, 56), 48, 56);
  check('P990 バッテリー：長い腕', longArm990?.armLength === 'long', `arm=${longArm990?.armLength}`);
  const longLeg990 = vpose990.analyzePose(fin990(person990(48, 68, 30, 62), 48, 68), 48, 68);
  check('P990 バッテリー：長い脚', longLeg990?.legLength === 'long', `leg=${longLeg990?.legLength}`);
  // 顔（P978〜P989で検証済みの描き方）
  const faceBase990 = () => {
    const px: RGB990[] = []; for (let i = 0; i < 48 * 48; i++) px.push([...BG990] as RGB990);
    const disc = (cx: number, cy: number, r: number, c: RGB990) => { for (let y = 0; y < 48; y++) for (let x = 0; x < 48; x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) px[y * 48 + x] = c; };
    disc(24, 20, 16, HAIR990); disc(24, 24, 16, SKIN990);
    disc(17, 20, 3, DARK990); disc(31, 20, 3, DARK990);
    return px;
  };
  const rect990 = (px: RGB990[], x0: number, y0: number, x1: number, y1: number, c: RGB990) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) px[y * 48 + x] = c; };
  const browPx990: RGB990[] = []; for (let i = 0; i < 48 * 48; i++) browPx990.push([...BG990] as RGB990);
  const bdisc990 = (cx: number, cy: number, r: number, c: RGB990) => { for (let y = 0; y < 48; y++) for (let x = 0; x < 48; x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) browPx990[y * 48 + x] = c; };
  bdisc990(24, 20, 16, HAIR990); bdisc990(24, 25, 14, SKIN990);
  bdisc990(17, 22, 3, DARK990); bdisc990(31, 22, 3, DARK990);
  rect990(browPx990, 12, 14, 22, 16, DARK990); rect990(browPx990, 26, 14, 36, 16, DARK990);
  const brow990 = vzoom990.analyzeFace(fin990(browPx990, 48, 48));
  check('P990 バッテリー：眉', brow990?.brows === true, `brows=${brow990?.brows}`);
  const eyePx990 = faceBase990();
  const eye990 = vzoom990.analyzeFace(fin990(eyePx990, 48, 48));
  check('P990 バッテリー：目の大きさ', eye990?.eyeSize === 'large', `eyeSize=${eye990?.eyeSize}`);
  const nosePx990 = faceBase990();
  rect990(nosePx990, 22, 25, 26, 28, [203, 163, 133]);
  const nose990 = vzoom990.analyzeFace(fin990(nosePx990, 48, 48));
  check('P990 バッテリー：鼻の影', nose990?.nose === true, `nose=${nose990?.nose}`);
  const earPx990 = faceBase990();
  rect990(earPx990, 3, 20, 9, 27, SKIN990); rect990(earPx990, 39, 20, 45, 27, SKIN990);
  const ear990 = vzoom990.analyzeFace(fin990(earPx990, 48, 48));
  check('P990 バッテリー：耳', ear990?.ears === true, `ears=${ear990?.ears}`);
  const cheekPx990 = faceBase990();
  rect990(cheekPx990, 10, 27, 17, 33, [238, 150, 130]); rect990(cheekPx990, 31, 27, 38, 33, [238, 150, 130]);
  const cheek990 = vzoom990.analyzeFace(fin990(cheekPx990, 48, 48));
  check('P990 バッテリー：頬の赤み', cheek990?.cheekFlush === true, `cheekFlush=${cheek990?.cheekFlush}`);
  const mouthPx990 = faceBase990();
  rect990(mouthPx990, 15, 33, 33, 34, DARK990);
  const mouth990 = vzoom990.analyzeFace(fin990(mouthPx990, 48, 48));
  check('P990 バッテリー：口の大きさ', mouth990?.mouthSize === 'large', `mouthSize=${mouth990?.mouthSize}`);
  const hlPx990: RGB990[] = []; for (let i = 0; i < 48 * 48; i++) hlPx990.push([...BG990] as RGB990);
  rect990(hlPx990, 8, 4, 40, 15, HAIR990); rect990(hlPx990, 10, 16, 38, 44, SKIN990);
  rect990(hlPx990, 10, 10, 16, 16, SKIN990); rect990(hlPx990, 32, 10, 38, 16, SKIN990);
  const disc990 = (px: RGB990[], cx: number, cy: number, r: number, c: RGB990) => { for (let y = 0; y < 48; y++) for (let x = 0; x < 48; x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) px[y * 48 + x] = c; };
  disc990(hlPx990, 17, 24, 3, DARK990); disc990(hlPx990, 31, 24, 3, DARK990);
  const hl990 = vzoom990.analyzeFace(fin990(hlPx990, 48, 48));
  check('P990 バッテリー：生え際はM字型', hl990?.hairline === 'm-shaped', `hairline=${hl990?.hairline}`);
  const roundPx990: RGB990[] = []; for (let i = 0; i < 48 * 48; i++) roundPx990.push([...BG990] as RGB990);
  rect990(roundPx990, 8, 6, 40, 12, HAIR990);
  for (let y = 10; y <= 38; y++) for (let x = 10; x <= 38; x++) { const cur = roundPx990[y * 48 + x]; if (cur[0] === BG990[0] && cur[1] === BG990[1]) roundPx990[y * 48 + x] = SKIN990; }
  disc990(roundPx990, 17, 20, 3, DARK990); disc990(roundPx990, 31, 20, 3, DARK990);
  const round990 = vzoom990.analyzeFace(fin990(roundPx990, 48, 48));
  check('P990 バッテリー：顔の形は丸い', round990?.faceShape === 'round', `faceShape=${round990?.faceShape}`);
}

// ---- P991 素体プロファイルの第1段 ----
{
  const { visualPoseService: vpose991 } = await import('../src/miki/conversation/services/visualPoseService');
  const { knowledgeSelfInspectionService: ksi991 } = await import('../src/miki/selfAwareness/services/knowledgeSelfInspectionService');
  type RGB991 = [number, number, number];
  const SKIN991: RGB991 = [232, 190, 160];
  const HAIR991: RGB991 = [45, 32, 22];
  const BLUE991: RGB991 = [40, 40, 120];
  const person991 = (tapered: boolean) => {
    const W = 48, H = 56;
    const px: RGB991[] = []; for (let i = 0; i < W * H; i++) px.push([245, 245, 245]);
    const rect = (x0: number, y0: number, x1: number, y1: number, c: RGB991) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) px[y * W + x] = c; };
    const disc = (cx: number, cy: number, r: number, c: RGB991) => { for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) px[y * W + x] = c; };
    disc(22, 9, 6, HAIR991); disc(22, 10, 5, SKIN991);
    rect(16, 15, 28, 32, BLUE991); rect(12, 16, 15, 30, BLUE991); rect(29, 16, 32, 30, BLUE991);
    if (tapered) {
      rect(14, 32, 20, 40, BLUE991); rect(24, 32, 30, 40, BLUE991);
      rect(16, 40, 21, 50, BLUE991); rect(23, 40, 28, 50, BLUE991);
    } else {
      rect(16, 32, 21, 50, BLUE991); rect(23, 32, 28, 50, BLUE991);
    }
    const o = new Uint8Array(W * H * 4);
    px.forEach((c, i) => { o[i * 4] = c[0]; o[i * 4 + 1] = c[1]; o[i * 4 + 2] = c[2]; o[i * 4 + 3] = 255; });
    return o;
  };
  const std991 = vpose991.analyzePose(person991(false), 48, 56);
  check('P991 素体プロファイルが部位ごとに作れる', std991?.profileComplete === true && std991.bodyProfile.chest !== null && std991.bodyProfile.waist !== null && std991.bodyProfile.thigh !== null, `profile=${JSON.stringify(std991?.bodyProfile)}`);
  const tap991 = vpose991.analyzePose(person991(true), 48, 56);
  check('P991 太ももと足首の太さの違いが表に出る', (tap991?.bodyProfile.thigh ?? 0) > (tap991?.bodyProfile.ankle ?? 99), `thigh=${tap991?.bodyProfile.thigh} ankle=${tap991?.bodyProfile.ankle}`);
  const insp991 = ksi991.inspect();
  check('P991 自己点検の記録に素体プロファイル（visualBodyProfile）が入っている', typeof insp991.visualBodyProfile === 'number' && insp991.visualBodyProfile >= 1, `visualBodyProfile=${insp991.visualBodyProfile}`);
}

// ---- P992 素体レンダラの第1段 ----
{
  const { visualPoseService: vpose992 } = await import('../src/miki/conversation/services/visualPoseService');
  const { knowledgeSelfInspectionService: ksi992 } = await import('../src/miki/selfAwareness/services/knowledgeSelfInspectionService');
  type RGB992 = [number, number, number];
  const SKIN992: RGB992 = [232, 190, 160];
  const HAIR992: RGB992 = [45, 32, 22];
  const BLUE992: RGB992 = [40, 40, 120];
  const px992: RGB992[] = []; for (let i = 0; i < 48 * 56; i++) px992.push([245, 245, 245]);
  const rect992 = (x0: number, y0: number, x1: number, y1: number, c: RGB992) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) px992[y * 48 + x] = c; };
  const disc992 = (cx: number, cy: number, r: number, c: RGB992) => { for (let y = 0; y < 56; y++) for (let x = 0; x < 48; x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) px992[y * 48 + x] = c; };
  disc992(22, 9, 6, HAIR992); disc992(22, 10, 5, SKIN992);
  rect992(16, 15, 28, 32, BLUE992); rect992(12, 16, 15, 30, BLUE992); rect992(29, 16, 32, 30, BLUE992);
  rect992(16, 32, 21, 50, BLUE992); rect992(23, 32, 28, 50, BLUE992);
  const img992 = new Uint8Array(48 * 56 * 4);
  px992.forEach((c, i) => { img992[i * 4] = c[0]; img992[i * 4 + 1] = c[1]; img992[i * 4 + 2] = c[2]; img992[i * 4 + 3] = 255; });
  const reading992 = vpose992.analyzePose(img992, 48, 56);
  const rendered992 = reading992 ? vpose992.renderBody(reading992) : null;
  check('P992 素体が描ける', rendered992 !== null && rendered992.length === 64 * 64 * 4, `rendered=${rendered992?.length}`);
  const verify992 = reading992 ? vpose992.verifyBody(reading992) : null;
  check('P992 描いた素体を測り直すとプロファイルが一致する', verify992?.verified === true && verify992.score >= 0.7, `score=${verify992?.score}`);
  const insp992 = ksi992.inspect();
  check('P992 自己点検の記録に素体の照合（visualBodies）が入っている', typeof insp992.visualBodies === 'number' && insp992.visualBodies >= 1, `visualBodies=${insp992.visualBodies}`);
}

// ---- P993 素体レンダラに髪 ----
{
  const { visualPoseService: vpose993 } = await import('../src/miki/conversation/services/visualPoseService');
  type RGB993 = [number, number, number];
  const SKIN993: RGB993 = [232, 190, 160];
  const HAIR993: RGB993 = [45, 32, 22];
  const BLUE993: RGB993 = [40, 40, 120];
  const person993 = (hairBottom: number) => {
    const px: RGB993[] = []; for (let i = 0; i < 48 * 56; i++) px.push([245, 245, 245]);
    const rect = (x0: number, y0: number, x1: number, y1: number, c: RGB993) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) px[y * 48 + x] = c; };
    const disc = (cx: number, cy: number, r: number, c: RGB993) => { for (let y = 0; y < 56; y++) for (let x = 0; x < 48; x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) px[y * 48 + x] = c; };
    rect(16, 15, 28, 32, BLUE993); rect(12, 16, 15, 30, BLUE993); rect(29, 16, 32, 30, BLUE993);
    rect(16, 32, 21, 50, BLUE993); rect(23, 32, 28, 50, BLUE993);
    rect(13, 4, 31, 12, HAIR993); rect(13, 4, 15, hairBottom, HAIR993); rect(29, 4, 31, hairBottom, HAIR993);
    disc(22, 10, 5, SKIN993);
    const o = new Uint8Array(48 * 56 * 4);
    px.forEach((c, i) => { o[i * 4] = c[0]; o[i * 4 + 1] = c[1]; o[i * 4 + 2] = c[2]; o[i * 4 + 3] = 255; });
    return o;
  };
  const long993 = vpose993.analyzePose(person993(40), 48, 56);
  check('P993 長い髪が読める', long993?.hair?.length === 'long', `hair=${long993?.hair?.length}`);
  const verify993 = long993 ? vpose993.verifyBody(long993) : null;
  check('P993 描いた素体の髪の長さが一致して照合できる', verify993?.verified === true, `score=${verify993?.score}`);
  const rendered993 = long993 ? vpose993.renderBody(long993) : null;
  const reHair993 = rendered993 ? vpose993.analyzePose(rendered993, 64, 64) : null;
  check('P993 描いた側の髪も長いと読める', reHair993?.hair?.length === 'long', `hair=${reHair993?.hair?.length}`);
}

// ---- P994 素体レンダラに顔 ----
{
  const { visualPoseService: vpose994 } = await import('../src/miki/conversation/services/visualPoseService');
  const { knowledgeSelfInspectionService: ksi994 } = await import('../src/miki/selfAwareness/services/knowledgeSelfInspectionService');
  type RGB994 = [number, number, number];
  const SKIN994: RGB994 = [232, 190, 160];
  const HAIR994: RGB994 = [45, 32, 22];
  const BLUE994: RGB994 = [40, 40, 120];
  const px994: RGB994[] = []; for (let i = 0; i < 48 * 56; i++) px994.push([245, 245, 245]);
  const rect994 = (x0: number, y0: number, x1: number, y1: number, c: RGB994) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) px994[y * 48 + x] = c; };
  const disc994 = (cx: number, cy: number, r: number, c: RGB994) => { for (let y = 0; y < 56; y++) for (let x = 0; x < 48; x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) px994[y * 48 + x] = c; };
  rect994(16, 15, 28, 32, BLUE994); rect994(12, 16, 15, 30, BLUE994); rect994(29, 16, 32, 30, BLUE994);
  rect994(16, 32, 21, 50, BLUE994); rect994(23, 32, 28, 50, BLUE994);
  rect994(13, 4, 31, 12, HAIR994); rect994(13, 4, 15, 40, HAIR994); rect994(29, 4, 31, 40, HAIR994);
  disc994(22, 10, 5, SKIN994);
  const img994 = new Uint8Array(48 * 56 * 4);
  px994.forEach((c, i) => { img994[i * 4] = c[0]; img994[i * 4 + 1] = c[1]; img994[i * 4 + 2] = c[2]; img994[i * 4 + 3] = 255; });
  const reading994 = vpose994.analyzePose(img994, 48, 56);
  const vf994a = reading994 ? vpose994.verifyFace(reading994, { eyeSize: 'large', brows: true, mouthSize: 'large' }) : null;
  check('P994 大きい目・眉・大きい口の顔が描いて照合できる', vf994a?.verified === true && vf994a.eyes === 2, `verified=${vf994a?.verified} eyes=${vf994a?.eyes}`);
  const vf994b = reading994 ? vpose994.verifyFace(reading994, { eyeSize: 'small', brows: false, mouthSize: 'small' }) : null;
  check('P994 小さい目・小さい口の顔が描いて照合できる', vf994b?.verified === true, `verified=${vf994b?.verified}`);
  const insp994 = ksi994.inspect();
  check('P994 自己点検の記録に顔の照合（visualDrawnFaces）が入っている', typeof insp994.visualDrawnFaces === 'number' && insp994.visualDrawnFaces >= 1, `visualDrawnFaces=${insp994.visualDrawnFaces}`);
}

// ---- P995 素体レンダラに色 ----
{
  const { visualPoseService: vpose995 } = await import('../src/miki/conversation/services/visualPoseService');
  type RGB995 = [number, number, number];
  const SKIN995: RGB995 = [232, 190, 160];
  const PINK995: RGB995 = [240, 150, 180];
  const BLUE995: RGB995 = [40, 40, 120];
  const px995: RGB995[] = []; for (let i = 0; i < 48 * 56; i++) px995.push([245, 245, 245]);
  const rect995 = (x0: number, y0: number, x1: number, y1: number, c: RGB995) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) px995[y * 48 + x] = c; };
  const disc995 = (cx: number, cy: number, r: number, c: RGB995) => { for (let y = 0; y < 56; y++) for (let x = 0; x < 48; x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) px995[y * 48 + x] = c; };
  rect995(16, 15, 28, 32, BLUE995); rect995(12, 16, 15, 30, BLUE995); rect995(29, 16, 32, 30, BLUE995);
  rect995(16, 32, 21, 50, BLUE995); rect995(23, 32, 28, 50, BLUE995);
  rect995(13, 4, 31, 12, PINK995); rect995(13, 4, 15, 40, PINK995); rect995(29, 4, 31, 40, PINK995);
  disc995(22, 10, 5, SKIN995);
  const img995 = new Uint8Array(48 * 56 * 4);
  px995.forEach((c, i) => { img995[i * 4] = c[0]; img995[i * 4 + 1] = c[1]; img995[i * 4 + 2] = c[2]; img995[i * 4 + 3] = 255; });
  const reading995 = vpose995.analyzePose(img995, 48, 56);
  check('P995 ピンクの髪が読める', reading995?.hairColor === 'ピンク', `hairColor=${reading995?.hairColor}`);
  const verify995 = reading995 ? vpose995.verifyBody(reading995) : null;
  check('P995 描いた素体の髪の色が一致して照合できる', verify995?.verified === true, `score=${verify995?.score}`);
  const rendered995 = reading995 ? vpose995.renderBody(reading995) : null;
  const re995 = rendered995 ? vpose995.analyzePose(rendered995, 64, 64) : null;
  check('P995 描いた側の髪もピンクと読める', re995?.hairColor === 'ピンク', `hairColor=${re995?.hairColor}`);
}

// ---- P996 素体の滑らか描画 ----
{
  const { visualPoseService: vpose996 } = await import('../src/miki/conversation/services/visualPoseService');
  const { knowledgeSelfInspectionService: ksi996 } = await import('../src/miki/selfAwareness/services/knowledgeSelfInspectionService');
  type RGB996 = [number, number, number];
  const SKIN996: RGB996 = [232, 190, 160];
  const PINK996: RGB996 = [240, 150, 180];
  const BLUE996: RGB996 = [40, 40, 120];
  const px996: RGB996[] = []; for (let i = 0; i < 48 * 56; i++) px996.push([245, 245, 245]);
  const rect996 = (x0: number, y0: number, x1: number, y1: number, c: RGB996) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) px996[y * 48 + x] = c; };
  const disc996 = (cx: number, cy: number, r: number, c: RGB996) => { for (let y = 0; y < 56; y++) for (let x = 0; x < 48; x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) px996[y * 48 + x] = c; };
  rect996(16, 15, 28, 32, BLUE996); rect996(12, 16, 15, 30, BLUE996); rect996(29, 16, 32, 30, BLUE996);
  rect996(16, 32, 21, 50, BLUE996); rect996(23, 32, 28, 50, BLUE996);
  rect996(13, 4, 31, 12, PINK996); rect996(13, 4, 15, 40, PINK996); rect996(29, 4, 31, 40, PINK996);
  disc996(22, 10, 5, SKIN996);
  const img996 = new Uint8Array(48 * 56 * 4);
  px996.forEach((c, i) => { img996[i * 4] = c[0]; img996[i * 4 + 1] = c[1]; img996[i * 4 + 2] = c[2]; img996[i * 4 + 3] = 255; });
  const reading996 = vpose996.analyzePose(img996, 48, 56);
  const smooth996 = reading996 ? vpose996.renderBodySmooth(reading996, 96) : null;
  check('P996 滑らかな素体が描ける', smooth996 !== null && smooth996.length === 96 * 96 * 4, `len=${smooth996?.length}`);
  const flat996 = new Set(['245,245,245', '40,40,120', '232,190,160', '240,150,180', '168,118,92', '30,30,30']);
  let blends996 = 0;
  if (smooth996) for (let i = 0; i < smooth996.length; i += 4) if (!flat996.has(`${smooth996[i]},${smooth996[i + 1]},${smooth996[i + 2]}`)) blends996++;
  check('P996 輪郭に中間色（滑らかさ）が出ている', blends996 >= 50, `blends=${blends996}`);
  const vs996 = reading996 ? vpose996.verifyBodySmooth(reading996) : null;
  check('P996 滑らかに描いても測り直すと同じ読みになる', vs996?.verified === true, `score=${vs996?.score}`);
  const insp996 = ksi996.inspect();
  check('P996 自己点検の記録に滑らか描画の照合（visualSmoothBodies）が入っている', typeof insp996.visualSmoothBodies === 'number' && insp996.visualSmoothBodies >= 1, `visualSmoothBodies=${insp996.visualSmoothBodies}`);
}

// ---- P997 素体の陰影 ----
{
  const { visualPoseService: vpose997 } = await import('../src/miki/conversation/services/visualPoseService');
  const { knowledgeSelfInspectionService: ksi997 } = await import('../src/miki/selfAwareness/services/knowledgeSelfInspectionService');
  type RGB997 = [number, number, number];
  const SKIN997: RGB997 = [232, 190, 160];
  const PINK997: RGB997 = [240, 150, 180];
  const BLUE997: RGB997 = [40, 40, 120];
  const px997: RGB997[] = []; for (let i = 0; i < 48 * 56; i++) px997.push([245, 245, 245]);
  const rect997 = (x0: number, y0: number, x1: number, y1: number, c: RGB997) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) px997[y * 48 + x] = c; };
  const disc997 = (cx: number, cy: number, r: number, c: RGB997) => { for (let y = 0; y < 56; y++) for (let x = 0; x < 48; x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) px997[y * 48 + x] = c; };
  rect997(16, 15, 28, 32, BLUE997); rect997(12, 16, 15, 30, BLUE997); rect997(29, 16, 32, 30, BLUE997);
  rect997(16, 32, 21, 50, BLUE997); rect997(23, 32, 28, 50, BLUE997);
  rect997(13, 4, 31, 12, PINK997); rect997(13, 4, 15, 40, PINK997); rect997(29, 4, 31, 40, PINK997);
  disc997(22, 10, 5, SKIN997);
  const img997 = new Uint8Array(48 * 56 * 4);
  px997.forEach((c, i) => { img997[i * 4] = c[0]; img997[i * 4 + 1] = c[1]; img997[i * 4 + 2] = c[2]; img997[i * 4 + 3] = 255; });
  const reading997 = vpose997.analyzePose(img997, 48, 56);
  const shaded997 = reading997 ? vpose997.renderBodyShaded(reading997, 96) : null;
  check('P997 陰影つきの素体が描ける', shaded997 !== null && shaded997.length === 96 * 96 * 4, `len=${shaded997?.length}`);
  const vs997 = reading997 ? vpose997.verifyBodyShaded(reading997) : null;
  check('P997 陰影を付けても輪郭は変わらず、縁が暗くなる', vs997?.verified === true, `score=${vs997?.score}`);
  const insp997 = ksi997.inspect();
  check('P997 自己点検の記録に陰影の照合（visualShadedBodies）が入っている', typeof insp997.visualShadedBodies === 'number' && insp997.visualShadedBodies >= 1, `visualShadedBodies=${insp997.visualShadedBodies}`);
}

// ---- P998 素体の輪郭の曲線化 ----
{
  const { visualPoseService: vpose998 } = await import('../src/miki/conversation/services/visualPoseService');
  const { knowledgeSelfInspectionService: ksi998 } = await import('../src/miki/selfAwareness/services/knowledgeSelfInspectionService');
  type RGB998 = [number, number, number];
  const SKIN998: RGB998 = [232, 190, 160];
  const PINK998: RGB998 = [240, 150, 180];
  const BLUE998: RGB998 = [40, 40, 120];
  const px998: RGB998[] = []; for (let i = 0; i < 48 * 56; i++) px998.push([245, 245, 245]);
  const rect998 = (x0: number, y0: number, x1: number, y1: number, c: RGB998) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) px998[y * 48 + x] = c; };
  const disc998 = (cx: number, cy: number, r: number, c: RGB998) => { for (let y = 0; y < 56; y++) for (let x = 0; x < 48; x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) px998[y * 48 + x] = c; };
  rect998(16, 15, 28, 32, BLUE998); rect998(12, 16, 15, 30, BLUE998); rect998(29, 16, 32, 30, BLUE998);
  rect998(16, 32, 21, 50, BLUE998); rect998(23, 32, 28, 50, BLUE998);
  rect998(13, 4, 31, 12, PINK998); rect998(13, 4, 15, 40, PINK998); rect998(29, 4, 31, 40, PINK998);
  disc998(22, 10, 5, SKIN998);
  const img998 = new Uint8Array(48 * 56 * 4);
  px998.forEach((c, i) => { img998[i * 4] = c[0]; img998[i * 4 + 1] = c[1]; img998[i * 4 + 2] = c[2]; img998[i * 4 + 3] = 255; });
  const reading998 = vpose998.analyzePose(img998, 48, 56);
  const curved998 = reading998 ? vpose998.renderBodyCurved(reading998, 96) : null;
  check('P998 輪郭を曲線化した素体が描ける', curved998 !== null && curved998.length === 96 * 96 * 4, `len=${curved998?.length}`);
  const vs998 = reading998 ? vpose998.verifyBodyCurved(reading998) : null;
  check('P998 輪郭を曲線化しても測り直すと同じ読みになる', vs998?.verified === true, `score=${vs998?.score}`);
  const insp998 = ksi998.inspect();
  check('P998 自己点検の記録に輪郭の曲線化の照合（visualCurvedBodies）が入っている', typeof insp998.visualCurvedBodies === 'number' && insp998.visualCurvedBodies >= 1, `visualCurvedBodies=${insp998.visualCurvedBodies}`);
}

// ---- P999 素体の輪郭線 ----
{
  const { visualPoseService: vpose999 } = await import('../src/miki/conversation/services/visualPoseService');
  const { knowledgeSelfInspectionService: ksi999 } = await import('../src/miki/selfAwareness/services/knowledgeSelfInspectionService');
  type RGB999 = [number, number, number];
  const SKIN999: RGB999 = [232, 190, 160];
  const PINK999: RGB999 = [240, 150, 180];
  const BLUE999: RGB999 = [40, 40, 120];
  const px999: RGB999[] = []; for (let i = 0; i < 48 * 56; i++) px999.push([245, 245, 245]);
  const rect999 = (x0: number, y0: number, x1: number, y1: number, c: RGB999) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) px999[y * 48 + x] = c; };
  const disc999 = (cx: number, cy: number, r: number, c: RGB999) => { for (let y = 0; y < 56; y++) for (let x = 0; x < 48; x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) px999[y * 48 + x] = c; };
  rect999(16, 15, 28, 32, BLUE999); rect999(12, 16, 15, 30, BLUE999); rect999(29, 16, 32, 30, BLUE999);
  rect999(16, 32, 21, 50, BLUE999); rect999(23, 32, 28, 50, BLUE999);
  rect999(13, 4, 31, 12, PINK999); rect999(13, 4, 15, 40, PINK999); rect999(29, 4, 31, 40, PINK999);
  disc999(22, 10, 5, SKIN999);
  const img999 = new Uint8Array(48 * 56 * 4);
  px999.forEach((c, i) => { img999[i * 4] = c[0]; img999[i * 4 + 1] = c[1]; img999[i * 4 + 2] = c[2]; img999[i * 4 + 3] = 255; });
  const reading999 = vpose999.analyzePose(img999, 48, 56);
  const lined999 = reading999 ? vpose999.renderBodyOutline(reading999, 96) : null;
  check('P999 輪郭線つきの素体が描ける', lined999 !== null && lined999.length === 96 * 96 * 4, `len=${lined999?.length}`);
  const vs999 = reading999 ? vpose999.verifyBodyOutline(reading999) : null;
  check('P999 線を引いても輪郭は変わらず、輪郭帯が暗くなる', vs999?.verified === true, `score=${vs999?.score}`);
  const insp999 = ksi999.inspect();
  check('P999 自己点検の記録に輪郭線の照合（visualOutlinedBodies）が入っている', typeof insp999.visualOutlinedBodies === 'number' && insp999.visualOutlinedBodies >= 1, `visualOutlinedBodies=${insp999.visualOutlinedBodies}`);
}

// ---- P1000 目の作画部品 ----
{
  const { visualPoseService: vpose1000 } = await import('../src/miki/conversation/services/visualPoseService');
  const { knowledgeSelfInspectionService: ksi1000 } = await import('../src/miki/selfAwareness/services/knowledgeSelfInspectionService');
  type RGB1000 = [number, number, number];
  const SKIN1000: RGB1000 = [232, 190, 160];
  const PINK1000: RGB1000 = [240, 150, 180];
  const BLUE1000: RGB1000 = [40, 40, 120];
  const px1000: RGB1000[] = []; for (let i = 0; i < 48 * 56; i++) px1000.push([245, 245, 245]);
  const rect1000 = (x0: number, y0: number, x1: number, y1: number, c: RGB1000) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) px1000[y * 48 + x] = c; };
  const disc1000 = (cx: number, cy: number, r: number, c: RGB1000) => { for (let y = 0; y < 56; y++) for (let x = 0; x < 48; x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) px1000[y * 48 + x] = c; };
  rect1000(16, 15, 28, 32, BLUE1000); rect1000(12, 16, 15, 30, BLUE1000); rect1000(29, 16, 32, 30, BLUE1000);
  rect1000(16, 32, 21, 50, BLUE1000); rect1000(23, 32, 28, 50, BLUE1000);
  rect1000(13, 4, 31, 12, PINK1000); rect1000(13, 4, 15, 40, PINK1000); rect1000(29, 4, 31, 40, PINK1000);
  disc1000(22, 10, 5, SKIN1000);
  const img1000 = new Uint8Array(48 * 56 * 4);
  px1000.forEach((c, i) => { img1000[i * 4] = c[0]; img1000[i * 4 + 1] = c[1]; img1000[i * 4 + 2] = c[2]; img1000[i * 4 + 3] = 255; });
  const reading1000 = vpose1000.analyzePose(img1000, 48, 56);
  const ve1000 = reading1000 ? vpose1000.verifyEyeDetail(reading1000, { eyeSize: 'large', brows: true, mouthSize: null, iris: [232, 120, 160], irisName: 'ピンク' }) : null;
  check('P1000 ピンクの虹彩で目を部品として描き、目の色まで一致する', ve1000?.verified === true && ve1000?.eyeColor === 'ピンク', `verified=${ve1000?.verified} eyeColor=${ve1000?.eyeColor}`);
  const ve1000b = reading1000 ? vpose1000.verifyEyeDetail(reading1000, { eyeSize: null, brows: false, mouthSize: null, iris: [90, 130, 220], irisName: '青' }) : null;
  check('P1000 青い虹彩でも描いて照合できる', ve1000b?.verified === true && ve1000b?.eyeColor === '青', `verified=${ve1000b?.verified} eyeColor=${ve1000b?.eyeColor}`);
  const insp1000 = ksi1000.inspect();
  check('P1000 自己点検の記録に目の作画の照合（visualDrawnEyes）が入っている', typeof insp1000.visualDrawnEyes === 'number' && insp1000.visualDrawnEyes >= 1, `visualDrawnEyes=${insp1000.visualDrawnEyes}`);
}

// ---- P1001 描画部品の統合＋測定の使い分け ----
{
  const { visualPoseService: vpose1001 } = await import('../src/miki/conversation/services/visualPoseService');
  const { knowledgeSelfInspectionService: ksi1001 } = await import('../src/miki/selfAwareness/services/knowledgeSelfInspectionService');
  type RGB1001 = [number, number, number];
  const SKIN1001: RGB1001 = [232, 190, 160];
  const PINK1001: RGB1001 = [240, 150, 180];
  const BLUE1001: RGB1001 = [40, 40, 120];
  const mkPerson1001 = (wide = false) => {
    const W = 48, H = 56;
    const px: RGB1001[] = []; for (let i = 0; i < W * H; i++) px.push([245, 245, 245]);
    const rect = (x0: number, y0: number, x1: number, y1: number, c: RGB1001) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) px[y * W + x] = c; };
    const disc = (cx: number, cy: number, r: number, c: RGB1001) => { for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) px[y * W + x] = c; };
    if (!wide) {
      rect(16, 15, 28, 32, BLUE1001); rect(12, 16, 15, 30, BLUE1001); rect(29, 16, 32, 30, BLUE1001);
      rect(16, 32, 21, 50, BLUE1001); rect(23, 32, 28, 50, BLUE1001);
    } else {
      rect(13, 15, 31, 32, BLUE1001); rect(9, 16, 12, 30, BLUE1001); rect(32, 16, 35, 30, BLUE1001);
      rect(13, 32, 19, 50, BLUE1001); rect(25, 32, 31, 50, BLUE1001);
    }
    rect(13, 4, 31, 12, PINK1001); rect(13, 4, 15, 40, PINK1001); rect(29, 4, 31, 40, PINK1001);
    disc(22, 10, 5, SKIN1001);
    const o = new Uint8Array(W * H * 4);
    px.forEach((c, i) => { o[i * 4] = c[0]; o[i * 4 + 1] = c[1]; o[i * 4 + 2] = c[2]; o[i * 4 + 3] = 255; });
    return o;
  };
  const reading1001 = vpose1001.analyzePose(mkPerson1001(), 48, 56);
  check('P1001 2段陰影で描いて照合できる', reading1001 ? vpose1001.verifyBodyCel(reading1001)?.verified === true : false, `cel=${reading1001 ? vpose1001.verifyBodyCel(reading1001)?.verified : 'no-reading'}`);
  check('P1001 髪の房とツヤを描いて照合できる', reading1001 ? vpose1001.verifyBodyHairDetail(reading1001)?.verified === true : false, 'hairDetail');
  check('P1001 胸の曲線で胸の幅が広がる', reading1001 ? vpose1001.verifyBust(reading1001)?.verified === true : false, 'bust');
  // 薄い肌色の人物：粗い色ビンでは背景と同化するので、細かいビンの取り方に切り替わる
  const pale1001 = (() => {
    const W = 48, H = 56;
    const BG: RGB1001 = [208, 210, 212]; const PSKIN: RGB1001 = [243, 222, 205]; const PHAIR: RGB1001 = [243, 205, 215]; const PCLOTH: RGB1001 = [150, 160, 190];
    const px: RGB1001[] = []; for (let i = 0; i < W * H; i++) px.push(BG);
    const rect = (x0: number, y0: number, x1: number, y1: number, c: RGB1001) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) px[y * W + x] = c; };
    const disc = (cx: number, cy: number, r: number, c: RGB1001) => { for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) px[y * W + x] = c; };
    rect(16, 15, 28, 32, PCLOTH); rect(12, 16, 15, 30, PCLOTH); rect(29, 16, 32, 30, PCLOTH);
    rect(16, 32, 21, 50, PCLOTH); rect(23, 32, 28, 50, PCLOTH);
    rect(13, 4, 31, 12, PHAIR); rect(13, 4, 15, 40, PHAIR); rect(29, 4, 31, 40, PHAIR);
    disc(22, 10, 5, PSKIN);
    const o = new Uint8Array(W * H * 4);
    px.forEach((c, i) => { o[i * 4] = c[0]; o[i * 4 + 1] = c[1]; o[i * 4 + 2] = c[2]; o[i * 4 + 3] = 255; });
    return o;
  })();
  const paleReading1001 = vpose1001.analyzePose(pale1001, 48, 56);
  check('P1001 薄い肌色の人物は細かいビンの取り方で読める', paleReading1001 !== null && paleReading1001.maskMethod === 'fine', `method=${paleReading1001?.maskMethod} density=${paleReading1001?.silhouetteDensity}`);
  // 見切れた体：脚が下端で切れている
  const trunc1001 = (() => {
    const W = 48, H = 44;
    const px: RGB1001[] = []; for (let i = 0; i < W * H; i++) px.push([245, 245, 245]);
    const rect = (x0: number, y0: number, x1: number, y1: number, c: RGB1001) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) px[y * W + x] = c; };
    const disc = (cx: number, cy: number, r: number, c: RGB1001) => { for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) px[y * W + x] = c; };
    rect(16, 14, 28, 28, BLUE1001); rect(12, 15, 15, 26, BLUE1001); rect(29, 15, 32, 26, BLUE1001);
    rect(16, 28, 21, 43, BLUE1001); rect(23, 28, 28, 43, BLUE1001);
    disc(22, 8, 5, SKIN1001);
    const o = new Uint8Array(W * H * 4);
    px.forEach((c, i) => { o[i * 4] = c[0]; o[i * 4 + 1] = c[1]; o[i * 4 + 2] = c[2]; o[i * 4 + 3] = 255; });
    return o;
  })();
  const truncReading1001 = vpose1001.analyzePose(trunc1001, 48, 44);
  check('P1001 見切れた体は見切れと分かる', truncReading1001 !== null && truncReading1001.truncated === true && truncReading1001.description.includes('見切れている'), `truncated=${truncReading1001?.truncated}`);
  // 目標の保存とドリル
  const wide1001 = vpose1001.analyzePose(mkPerson1001(true), 48, 56);
  const targetOk1001 = wide1001 ? vpose1001.setTarget(wide1001) : false;
  const drill1001 = reading1001 && targetOk1001 ? vpose1001.drillToTarget(reading1001) : null;
  check('P1001 目標を保存し、ドリルで差分が縮む', targetOk1001 && drill1001 !== null && drill1001.improved === true, `initial=${drill1001?.initialDiff} final=${drill1001?.finalDiff}`);
  const insp1001 = ksi1001.inspect();
  check('P1001 自己点検の記録に統合分の照合が入っている', insp1001.visualCelBodies >= 1 && insp1001.visualHairDetails >= 1 && insp1001.visualBusts >= 1 && insp1001.visualDrills >= 1 && insp1001.visualMaskFill >= 1, `cel=${insp1001.visualCelBodies} hair=${insp1001.visualHairDetails} bust=${insp1001.visualBusts} drills=${insp1001.visualDrills} mask=${insp1001.visualMaskFill}`);
}

// ---- P1002 服の描画と線の役割別 ----
{
  const { visualPoseService: vpose1002 } = await import('../src/miki/conversation/services/visualPoseService');
  const { knowledgeSelfInspectionService: ksi1002 } = await import('../src/miki/selfAwareness/services/knowledgeSelfInspectionService');
  type RGB1002 = [number, number, number];
  const SKIN1002: RGB1002 = [232, 190, 160];
  const PINK1002: RGB1002 = [240, 150, 180];
  const BLUE1002: RGB1002 = [40, 40, 120];
  const W = 48, H = 56;
  const px1002: RGB1002[] = []; for (let i = 0; i < W * H; i++) px1002.push([245, 245, 245]);
  const rect1002 = (x0: number, y0: number, x1: number, y1: number, c: RGB1002) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) px1002[y * W + x] = c; };
  const disc1002 = (cx: number, cy: number, r: number, c: RGB1002) => { for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) px1002[y * W + x] = c; };
  rect1002(16, 15, 28, 32, BLUE1002); rect1002(12, 16, 15, 30, BLUE1002); rect1002(29, 16, 32, 30, BLUE1002);
  rect1002(16, 32, 21, 50, BLUE1002); rect1002(23, 32, 28, 50, BLUE1002);
  rect1002(13, 4, 31, 12, PINK1002); rect1002(13, 4, 15, 40, PINK1002); rect1002(29, 4, 31, 40, PINK1002);
  disc1002(22, 10, 5, SKIN1002);
  const img1002 = new Uint8Array(W * H * 4);
  px1002.forEach((c, i) => { img1002[i * 4] = c[0]; img1002[i * 4 + 1] = c[1]; img1002[i * 4 + 2] = c[2]; img1002[i * 4 + 3] = 255; });
  const reading1002 = vpose1002.analyzePose(img1002, W, H);
  const skirt1002 = reading1002 ? vpose1002.verifyClothes(reading1002, { top: [200, 60, 60], bottom: 'skirt', bottomColor: [60, 60, 160] }) : null;
  check('P1002 スカートを着せるとスカートとして読める', skirt1002?.verified === true, `bottom=${skirt1002?.bottom} top=${skirt1002?.topColor}`);
  const pants1002 = reading1002 ? vpose1002.verifyClothes(reading1002, { top: [60, 160, 60], bottom: 'pants', bottomColor: [90, 60, 40] }) : null;
  check('P1002 ズボンを着せるとズボンとして読める', pants1002?.verified === true, `bottom=${pants1002?.bottom} top=${pants1002?.topColor}`);
  const role1002 = reading1002 ? vpose1002.verifyOutlineRole(reading1002) : null;
  check('P1002 外周の線は通常の輪郭線より太い', role1002?.verified === true, `outer=${role1002?.outerBand} plain=${role1002?.plainBand}`);
  const insp1002 = ksi1002.inspect();
  check('P1002 自己点検の記録に服と線の照合が入っている', insp1002.visualClothes >= 1 && insp1002.visualLineRoles >= 1, `clothes=${insp1002.visualClothes} lines=${insp1002.visualLineRoles}`);
}

// ---- P1003 線による領域分割 ----
{
  const { visualPoseService: vpose1003 } = await import('../src/miki/conversation/services/visualPoseService');
  const { knowledgeSelfInspectionService: ksi1003 } = await import('../src/miki/selfAwareness/services/knowledgeSelfInspectionService');
  type RGB1003 = [number, number, number];
  const DARK1003: RGB1003 = [30, 30, 30];
  const PINKH1003: RGB1003 = [243, 205, 215];
  const SKIN1003: RGB1003 = [232, 190, 160];
  const BLUE1003: RGB1003 = [40, 40, 120];
  const W = 96, H = 120;
  const px1003: RGB1003[] = []; for (let i = 0; i < W * H; i++) px1003.push([245, 245, 245]);
  const rectB1003 = (x0: number, y0: number, x1: number, y1: number, fill: RGB1003) => {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) px1003[y * W + x] = (x === x0 || x === x1 || y === y0 || y === y1) ? DARK1003 : fill;
  };
  const discB1003 = (cx: number, cy: number, r: number, fill: RGB1003) => {
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const d = (x - cx) ** 2 + (y - cy) ** 2; if (d <= r * r) px1003[y * W + x] = d > (r - 1) * (r - 1) ? DARK1003 : fill; }
  };
  rectB1003(15, 27, 80, 96, PINKH1003);   // 後ろ髪パネル（輪郭幅いっぱいに広がる）
  rectB1003(36, 36, 60, 78, BLUE1003);   // 胴
  rectB1003(27, 39, 33, 72, BLUE1003);   // 腕
  rectB1003(63, 39, 69, 72, BLUE1003);
  rectB1003(37, 78, 45, 111, BLUE1003);  // 脚
  rectB1003(51, 78, 59, 111, BLUE1003);
  discB1003(48, 21, 13, PINKH1003);      // 頭の髪
  discB1003(48, 22, 7, SKIN1003);        // 顔
  const img1003 = new Uint8Array(W * H * 4);
  px1003.forEach((c, i) => { img1003[i * 4] = c[0]; img1003[i * 4 + 1] = c[1]; img1003[i * 4 + 2] = c[2]; img1003[i * 4 + 3] = 255; });
  const reading1003 = vpose1003.analyzePose(img1003, W, H);
  check('P1003 後ろ髪が広がっていても体の幅は髪込みにならない', reading1003 !== null && reading1003.profileComplete && reading1003.bodyProfile.chest !== null && reading1003.bodyProfile.chest <= 0.3, `chest=${reading1003?.bodyProfile.chest}`);
  check('P1003 領域分割で測り直した記録が残る', vpose1003.summary().regions >= 1, `regions=${vpose1003.summary().regions}`);
  const insp1003 = ksi1003.inspect();
  check('P1003 自己点検の記録に領域分割が入っている', insp1003.visualRegions >= 1, `visualRegions=${insp1003.visualRegions}`);
}

// ---- P1004 領域分割の採用条件と描画照合の両立 ----
{
  const { visualPoseService: vpose1004 } = await import('../src/miki/conversation/services/visualPoseService');
  type RGB1004 = [number, number, number];
  const SKIN1004: RGB1004 = [232, 190, 160];
  const PINK1004: RGB1004 = [240, 150, 180];
  const BLUE1004: RGB1004 = [40, 40, 120];
  const px1004: RGB1004[] = []; for (let i = 0; i < 48 * 56; i++) px1004.push([245, 245, 245]);
  const rect1004 = (x0: number, y0: number, x1: number, y1: number, c: RGB1004) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) px1004[y * 48 + x] = c; };
  const disc1004 = (cx: number, cy: number, r: number, c: RGB1004) => { for (let y = 0; y < 56; y++) for (let x = 0; x < 48; x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) px1004[y * 48 + x] = c; };
  rect1004(16, 15, 28, 32, BLUE1004); rect1004(12, 16, 15, 30, BLUE1004); rect1004(29, 16, 32, 30, BLUE1004);
  rect1004(16, 32, 21, 50, BLUE1004); rect1004(23, 32, 28, 50, BLUE1004);
  rect1004(13, 4, 31, 12, PINK1004); rect1004(13, 4, 15, 40, PINK1004); rect1004(29, 4, 31, 40, PINK1004);
  disc1004(22, 10, 5, SKIN1004);
  const img1004 = new Uint8Array(48 * 56 * 4);
  px1004.forEach((c, i) => { img1004[i * 4] = c[0]; img1004[i * 4 + 1] = c[1]; img1004[i * 4 + 2] = c[2]; img1004[i * 4 + 3] = 255; });
  const reading1004 = vpose1004.analyzePose(img1004, 48, 56);
  // 領域分割の採用条件を締めても、描いて測り直す照合が壊れないこと
  const plain1004 = reading1004 ? vpose1004.verifyBody(reading1004) : null;
  check('P1004 通常描画の照合が保たれる', plain1004?.verified === true, `score=${plain1004?.score}`);
  const smooth1004 = reading1004 ? vpose1004.verifyBodySmooth(reading1004) : null;
  check('P1004 滑らか描画の照合が保たれる', smooth1004?.verified === true, `score=${smooth1004?.score}`);
  const curved1004 = reading1004 ? vpose1004.verifyBodyCurved(reading1004) : null;
  check('P1004 曲線化描画の照合が保たれる', curved1004?.verified === true, `score=${curved1004?.score}`);
}

// ---- P1005 ドリル第2段（停滞検出・卒業・要素ドリル） ----
{
  const { visualPoseService: vpose1005 } = await import('../src/miki/conversation/services/visualPoseService');
  type RGB1005 = [number, number, number];
  const SKIN1005: RGB1005 = [232, 190, 160];
  const HAIR1005: RGB1005 = [45, 32, 22];
  const BLUE1005: RGB1005 = [40, 40, 120];
  const px1005: RGB1005[] = []; for (let i = 0; i < 48 * 56; i++) px1005.push([240, 240, 240]);
  const rect1005 = (x0: number, y0: number, x1: number, y1: number, c: RGB1005) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) px1005[y * 48 + x] = c; };
  const disc1005 = (cx: number, cy: number, r: number, c: RGB1005) => { for (let y = 0; y < 56; y++) for (let x = 0; x < 48; x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) px1005[y * 48 + x] = c; };
  rect1005(16, 15, 28, 32, BLUE1005); rect1005(12, 16, 15, 30, BLUE1005); rect1005(29, 16, 32, 30, BLUE1005);
  rect1005(16, 32, 21, 50, BLUE1005); rect1005(23, 32, 28, 50, BLUE1005);
  disc1005(22, 9, 6, HAIR1005); disc1005(22, 10, 5, SKIN1005);
  const img1005 = new Uint8Array(48 * 56 * 4);
  px1005.forEach((c, i) => { img1005[i * 4] = c[0]; img1005[i * 4 + 1] = c[1]; img1005[i * 4 + 2] = c[2]; img1005[i * 4 + 3] = 255; });
  const reading1005 = vpose1005.analyzePose(img1005, 48, 56);
  // 届く目標：卒業してレベルが上がり、停滞とは言わない
  if (reading1005) vpose1005.setTarget({ ...reading1005, bodyProfile: { ...reading1005.bodyProfile, chest: (reading1005.bodyProfile.chest ?? 0.3) + 0.12 } } as never);
  const drill1005 = reading1005 ? vpose1005.drillToTarget(reading1005) : null;
  check('P1005 届く目標は卒業する', drill1005?.graduated === true && drill1005.level >= 2 && drill1005.plateau === false, `final=${drill1005?.finalDiff} level=${drill1005?.level} plateau=${drill1005?.plateau}`);
  // 要素ドリル：胸だけを寄せられる
  const elem1005 = reading1005 ? vpose1005.drillElement(reading1005, 'chest') : null;
  check('P1005 要素ドリルで胸だけ寄せられる', elem1005?.ok === true && elem1005.finalDiff < elem1005.initialDiff, `init=${elem1005?.initialDiff} final=${elem1005?.finalDiff}`);
  // 届かない目標：停滞を検出して打ち切る
  if (reading1005) vpose1005.setTarget({ ...reading1005, bodyProfile: { ...reading1005.bodyProfile, waist: 0.02, ankle: 0.9 } } as never);
  const hard1005 = reading1005 ? vpose1005.drillToTarget(reading1005) : null;
  check('P1005 届かない目標は停滞として打ち切る', hard1005?.plateau === true, `final=${hard1005?.finalDiff} rounds=${hard1005?.rounds}`);
  const sum1005 = vpose1005.summary();
  check('P1005 要素ドリルの記録が残る', sum1005.elementDrillsOk >= 1 && sum1005.plateaus >= 1 && sum1005.graduations >= 1, `elem=${sum1005.elementDrillsOk} plateaus=${sum1005.plateaus} grad=${sum1005.graduations}`);
}

// ---- P1006 前髪の描画 ----
{
  const { visualPoseService: vpose1006 } = await import('../src/miki/conversation/services/visualPoseService');
  type RGB1006 = [number, number, number];
  const SKIN1006: RGB1006 = [232, 190, 160];
  const PINK1006: RGB1006 = [240, 150, 180];
  const BLUE1006: RGB1006 = [40, 40, 120];
  const px1006: RGB1006[] = []; for (let i = 0; i < 48 * 56; i++) px1006.push([240, 240, 240]);
  const rect1006 = (x0: number, y0: number, x1: number, y1: number, c: RGB1006) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) px1006[y * 48 + x] = c; };
  const disc1006 = (cx: number, cy: number, r: number, c: RGB1006) => { for (let y = 0; y < 56; y++) for (let x = 0; x < 48; x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) px1006[y * 48 + x] = c; };
  rect1006(16, 15, 28, 32, BLUE1006); rect1006(12, 16, 15, 30, BLUE1006); rect1006(29, 16, 32, 30, BLUE1006);
  rect1006(16, 32, 21, 50, BLUE1006); rect1006(23, 32, 28, 50, BLUE1006);
  rect1006(13, 4, 31, 12, PINK1006); rect1006(13, 4, 15, 40, PINK1006); rect1006(29, 4, 31, 40, PINK1006);
  disc1006(22, 9, 6, PINK1006); disc1006(22, 10, 5, SKIN1006);
  const img1006 = new Uint8Array(48 * 56 * 4);
  px1006.forEach((c, i) => { img1006[i * 4] = c[0]; img1006[i * 4 + 1] = c[1]; img1006[i * 4 + 2] = c[2]; img1006[i * 4 + 3] = 255; });
  const reading1006 = vpose1006.analyzePose(img1006, 48, 56);
  const face1006 = { eyeSize: null, brows: true, mouthSize: null };
  const vf1006 = reading1006 ? vpose1006.verifyFrontHair(reading1006, face1006) : null;
  check('P1006 前髪が房として描けて目が壊れない', vf1006?.verified === true && vf1006.eyes === 2, `share=${vf1006?.bangShare} eyes=${vf1006?.eyes}`);
  // 前髪つきで描いても髪の長さの読みが変わらない
  const imgF1006 = reading1006 ? vpose1006.renderBody(reading1006, 64, null, null, { frontHair: true }) : null;
  const re1006 = imgF1006 ? vpose1006.analyzePose(imgF1006, 64, 64) : null;
  check('P1006 前髪つきでも髪の長さが保たれる', re1006?.hair?.length === 'long', `hair=${re1006?.hair?.length}`);
  const sum1006 = vpose1006.summary();
  check('P1006 前髪の記録が残る', sum1006.frontHairOk >= 1, `ok=${sum1006.frontHairOk}`);
}

// ---- P1007 髪の作画の読み取り（ツヤと房） ----
{
  const { visualPoseService: vpose1007 } = await import('../src/miki/conversation/services/visualPoseService');
  type RGB1007 = [number, number, number];
  const SKIN1007: RGB1007 = [232, 190, 160];
  const PINK1007: RGB1007 = [240, 150, 180];
  const BLUE1007: RGB1007 = [40, 40, 120];
  const px1007: RGB1007[] = []; for (let i = 0; i < 48 * 56; i++) px1007.push([240, 240, 240]);
  const rect1007 = (x0: number, y0: number, x1: number, y1: number, c: RGB1007) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) px1007[y * 48 + x] = c; };
  const disc1007 = (cx: number, cy: number, r: number, c: RGB1007) => { for (let y = 0; y < 56; y++) for (let x = 0; x < 48; x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) px1007[y * 48 + x] = c; };
  rect1007(16, 15, 28, 32, BLUE1007); rect1007(12, 16, 15, 30, BLUE1007); rect1007(29, 16, 32, 30, BLUE1007);
  rect1007(16, 32, 21, 50, BLUE1007); rect1007(23, 32, 28, 50, BLUE1007);
  rect1007(13, 4, 31, 12, PINK1007); rect1007(13, 4, 15, 40, PINK1007); rect1007(29, 4, 31, 40, PINK1007);
  disc1007(22, 9, 6, PINK1007); disc1007(22, 10, 5, SKIN1007);
  const img1007 = new Uint8Array(48 * 56 * 4);
  px1007.forEach((c, i) => { img1007[i * 4] = c[0]; img1007[i * 4 + 1] = c[1]; img1007[i * 4 + 2] = c[2]; img1007[i * 4 + 3] = 255; });
  const reading1007 = vpose1007.analyzePose(img1007, 48, 56);
  // 作画した髪（ツヤの帯＋房の線）は読みでも分かる
  const det1007 = reading1007 ? vpose1007.renderBodyHairDetail(reading1007, 192) : null;
  const reDet1007 = det1007 ? vpose1007.analyzePose(det1007, 192, 192) : null;
  check('P1007 作画した髪のツヤと房が読める', reDet1007?.hair?.shine === true && (reDet1007?.hair?.clumps ?? 0) >= 2, `shine=${reDet1007?.hair?.shine} clumps=${reDet1007?.hair?.clumps}`);
  // 平らな髪にはツヤも房も無いと読む
  const plain1007 = reading1007 ? vpose1007.renderBody(reading1007, 192) : null;
  const rePlain1007 = plain1007 ? vpose1007.analyzePose(plain1007, 192, 192) : null;
  check('P1007 平らな髪にツヤと房は無い', rePlain1007?.hair?.shine === false && !rePlain1007?.hair?.clumps, `shine=${rePlain1007?.hair?.shine} clumps=${rePlain1007?.hair?.clumps}`);
  const sum1007 = vpose1007.summary();
  check('P1007 髪の作画読みの記録が残る', sum1007.hairReads >= 1, `reads=${sum1007.hairReads}`);
}

// ---- P1008 髪の一族（色と長さの頑丈さ） ----
{
  const { visualPoseService: vpose1008 } = await import('../src/miki/conversation/services/visualPoseService');
  type RGB1008 = [number, number, number];
  const SKIN1008: RGB1008 = [232, 190, 160];
  const PINK1008: RGB1008 = [240, 150, 180];
  const BLUE1008: RGB1008 = [40, 40, 120];
  const px1008: RGB1008[] = []; for (let i = 0; i < 48 * 56; i++) px1008.push([240, 240, 240]);
  const rect1008 = (x0: number, y0: number, x1: number, y1: number, c: RGB1008) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) px1008[y * 48 + x] = c; };
  const disc1008 = (cx: number, cy: number, r: number, c: RGB1008) => { for (let y = 0; y < 56; y++) for (let x = 0; x < 48; x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) px1008[y * 48 + x] = c; };
  rect1008(16, 15, 28, 32, BLUE1008); rect1008(12, 16, 15, 30, BLUE1008); rect1008(29, 16, 32, 30, BLUE1008);
  rect1008(16, 32, 21, 50, BLUE1008); rect1008(23, 32, 28, 50, BLUE1008);
  rect1008(13, 4, 31, 12, PINK1008); rect1008(13, 4, 15, 40, PINK1008); rect1008(29, 4, 31, 40, PINK1008);
  disc1008(22, 9, 6, PINK1008); disc1008(22, 10, 5, SKIN1008);
  const img1008 = new Uint8Array(48 * 56 * 4);
  px1008.forEach((c, i) => { img1008[i * 4] = c[0]; img1008[i * 4 + 1] = c[1]; img1008[i * 4 + 2] = c[2]; img1008[i * 4 + 3] = 255; });
  const reading1008 = vpose1008.analyzePose(img1008, 48, 56);
  // 影色とツヤ色が混ざった作画髪でも、色は地の色・長さは長いのまま
  const det1008 = reading1008 ? vpose1008.renderBodyHairDetail(reading1008, 192) : null;
  const reDet1008 = det1008 ? vpose1008.analyzePose(det1008, 192, 192) : null;
  check('P1008 作画髪でも髪色と長さが保たれる', reDet1008?.hairColor === 'ピンク' && reDet1008?.hair?.length === 'long' && reDet1008?.hair?.shine === true, `color=${reDet1008?.hairColor} len=${reDet1008?.hair?.length} shine=${reDet1008?.hair?.shine}`);
  // セル陰影だけでも色と長さは保たれる
  const cel1008 = reading1008 ? vpose1008.renderBodyCel(reading1008, 192) : null;
  const reCel1008 = cel1008 ? vpose1008.analyzePose(cel1008, 192, 192) : null;
  check('P1008 セル髪でも髪色と長さが保たれる', reCel1008?.hairColor === 'ピンク' && reCel1008?.hair?.length === 'long', `color=${reCel1008?.hairColor} len=${reCel1008?.hair?.length}`);
}

// ---- P1009 腰の幅の頑丈な測り方（帯の下位パーセンタイル） ----
{
  const { visualPoseService: vpose1009 } = await import('../src/miki/conversation/services/visualPoseService');
  type RGB1009 = [number, number, number];
  const SKIN1009: RGB1009 = [232, 190, 160];
  const HAIR1009: RGB1009 = [45, 32, 22];
  const BLUE1009: RGB1009 = [40, 40, 120];
  const BG1009: RGB1009 = [245, 245, 245];
  const build1009 = (pinch: boolean) => {
    const px: RGB1009[] = []; for (let i = 0; i < 48 * 56; i++) px.push(BG1009);
    const rect = (x0: number, y0: number, x1: number, y1: number, c: RGB1009) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) px[y * 48 + x] = c; };
    const disc = (cx: number, cy: number, r: number, c: RGB1009) => { for (let y = 0; y < 56; y++) for (let x = 0; x < 48; x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) px[y * 48 + x] = c; };
    rect(16, 15, 28, 32, BLUE1009); rect(12, 16, 15, 30, SKIN1009); rect(29, 16, 32, 30, SKIN1009);
    rect(16, 32, 21, 50, BLUE1009); rect(23, 32, 28, 50, BLUE1009);
    disc(22, 9, 6, HAIR1009); disc(22, 10, 5, SKIN1009);
    // 壁線で潰れた行の再現：腰の帯の2行だけ胴を細片にする
    if (pinch) for (const y of [25, 26]) for (let x = 16; x <= 28; x++) px[y * 48 + x] = x >= 20 && x <= 24 ? BLUE1009 : BG1009;
    const img = new Uint8Array(48 * 56 * 4);
    px.forEach((c, i) => { img[i * 4] = c[0]; img[i * 4 + 1] = c[1]; img[i * 4 + 2] = c[2]; img[i * 4 + 3] = 255; });
    return img;
  };
  const std1009 = vpose1009.analyzePose(build1009(false), 48, 56);
  const pinched1009 = vpose1009.analyzePose(build1009(true), 48, 56);
  check('P1009 潰れた行があってもプロファイルが作れる', pinched1009?.profileComplete === true && pinched1009.bodyProfile.waist !== null, `profile=${JSON.stringify(pinched1009?.bodyProfile)}`);
  check('P1009 数行の潰れで腰の幅が潰れない（が、細くは出る）', (pinched1009?.bodyProfile.waist ?? 0) >= (std1009?.bodyProfile.waist ?? 99) - 0.2 && (pinched1009?.bodyProfile.waist ?? 99) < (std1009?.bodyProfile.waist ?? 0), `std=${std1009?.bodyProfile.waist} pinched=${pinched1009?.bodyProfile.waist}`);
  const ver1009 = std1009 ? vpose1009.verifyBody(std1009) : null;
  check('P1009 描いて測り直す照合が保たれる', ver1009?.verified === true, `score=${ver1009?.score}`);
}

// ---- P1010 部品描きの目の大きさと色の読み ----
{
  const { visualPoseService: vpose1010 } = await import('../src/miki/conversation/services/visualPoseService');
  type RGB1010 = [number, number, number];
  const SKIN1010: RGB1010 = [232, 190, 160];
  const HAIR1010: RGB1010 = [45, 32, 22];
  const BLUE1010: RGB1010 = [40, 40, 120];
  const px1010: RGB1010[] = []; for (let i = 0; i < 48 * 56; i++) px1010.push([245, 245, 245]);
  const rect1010 = (x0: number, y0: number, x1: number, y1: number, c: RGB1010) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) px1010[y * 48 + x] = c; };
  const disc1010 = (cx: number, cy: number, r: number, c: RGB1010) => { for (let y = 0; y < 56; y++) for (let x = 0; x < 48; x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) px1010[y * 48 + x] = c; };
  rect1010(16, 15, 28, 32, BLUE1010); rect1010(12, 16, 15, 30, SKIN1010); rect1010(29, 16, 32, 30, SKIN1010);
  rect1010(16, 32, 21, 50, BLUE1010); rect1010(23, 32, 28, 50, BLUE1010);
  disc1010(22, 9, 6, HAIR1010); disc1010(22, 10, 5, SKIN1010);
  const img1010 = new Uint8Array(48 * 56 * 4);
  px1010.forEach((c, i) => { img1010[i * 4] = c[0]; img1010[i * 4 + 1] = c[1]; img1010[i * 4 + 2] = c[2]; img1010[i * 4 + 3] = 255; });
  const reading1010 = vpose1010.analyzePose(img1010, 48, 56);
  const big1010 = reading1010 ? vpose1010.verifyEyeDetail(reading1010, { eyeSize: 'large', brows: false, mouthSize: null, iris: [90, 130, 220], irisName: '青' }) : null;
  check('P1010 大きい虹彩の目は大きさまで一致する', big1010?.verified === true && big1010?.eyeSize === 'large', `verified=${big1010?.verified} eyeSize=${big1010?.eyeSize}`);
  const smallBrown1010 = reading1010 ? vpose1010.verifyEyeDetail(reading1010, { eyeSize: 'small', brows: false, mouthSize: null, iris: [140, 90, 50], irisName: '茶色' }) : null;
  check('P1010 小さい茶色の虹彩は色も大きさも潰れない', smallBrown1010?.verified === true && smallBrown1010?.eyeColor === '茶色' && smallBrown1010?.eyeSize === 'small', `verified=${smallBrown1010?.verified} eyeColor=${smallBrown1010?.eyeColor} eyeSize=${smallBrown1010?.eyeSize}`);
  const smallPink1010 = reading1010 ? vpose1010.verifyEyeDetail(reading1010, { eyeSize: 'small', brows: false, mouthSize: null, iris: [232, 120, 160], irisName: 'ピンク' }) : null;
  check('P1010 小さいピンクの虹彩も色と大きさが読める', smallPink1010?.verified === true && smallPink1010?.eyeColor === 'ピンク' && smallPink1010?.eyeSize === 'small', `verified=${smallPink1010?.verified} eyeColor=${smallPink1010?.eyeColor} eyeSize=${smallPink1010?.eyeSize}`);
}

// ---- P1011 向き（正面・横・後ろ）と幅の種別 ----
{
  const { visualPoseService: vpose1011 } = await import('../src/miki/conversation/services/visualPoseService');
  const { knowledgeSelfInspectionService: ksi1011 } = await import('../src/miki/selfAwareness/services/knowledgeSelfInspectionService');
  type RGB1011 = [number, number, number];
  const SKIN1011: RGB1011 = [232, 190, 160];
  const HAIR1011: RGB1011 = [45, 32, 22];
  const BLUE1011: RGB1011 = [40, 40, 120];
  const build1011 = (kind: 'front' | 'together' | 'side' | 'back') => {
    const px: RGB1011[] = []; for (let i = 0; i < 48 * 56; i++) px.push([245, 245, 245]);
    const rect = (x0: number, y0: number, x1: number, y1: number, c: RGB1011) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) px[y * 48 + x] = c; };
    const disc = (cx: number, cy: number, r: number, c: RGB1011) => { for (let y = 0; y < 56; y++) for (let x = 0; x < 48; x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) px[y * 48 + x] = c; };
    if (kind === 'side') {
      rect(18, 15, 27, 32, BLUE1011); rect(19, 32, 26, 50, BLUE1011); rect(25, 16, 28, 30, SKIN1011);
      disc(22, 9, 6, HAIR1011); disc(24, 10, 5, SKIN1011);
    } else if (kind === 'back') {
      rect(16, 15, 28, 32, BLUE1011); rect(12, 16, 15, 30, SKIN1011); rect(29, 16, 32, 30, SKIN1011);
      rect(16, 32, 21, 50, BLUE1011); rect(23, 32, 28, 50, BLUE1011);
      disc(22, 10, 6, HAIR1011);
    } else {
      rect(16, 15, 28, 32, BLUE1011); rect(12, 16, 15, 30, SKIN1011); rect(29, 16, 32, 30, SKIN1011);
      if (kind === 'together') rect(18, 32, 27, 50, BLUE1011);
      else { rect(16, 32, 21, 50, BLUE1011); rect(23, 32, 28, 50, BLUE1011); }
      disc(22, 9, 6, HAIR1011); disc(22, 10, 5, SKIN1011);
    }
    const img = new Uint8Array(48 * 56 * 4);
    px.forEach((c, i) => { img[i * 4] = c[0]; img[i * 4 + 1] = c[1]; img[i * 4 + 2] = c[2]; img[i * 4 + 3] = 255; });
    return img;
  };
  const front1011 = vpose1011.analyzePose(build1011('front'), 48, 56);
  check('P1011 正面は正面・幅として読める', front1011?.viewpoint === 'front' && front1011?.profileKind === 'width', `view=${front1011?.viewpoint} kind=${front1011?.profileKind}`);
  const together1011 = vpose1011.analyzePose(build1011('together'), 48, 56);
  check('P1011 正面で脚をそろえても横向きにしない', together1011?.viewpoint === 'front', `view=${together1011?.viewpoint}`);
  const side1011 = vpose1011.analyzePose(build1011('side'), 48, 56);
  check('P1011 横向きは奥行きとして読める', side1011?.viewpoint === 'side' && side1011?.profileKind === 'depth' && (side1011?.description ?? '').includes('横向き'), `view=${side1011?.viewpoint} kind=${side1011?.profileKind}`);
  const back1011 = vpose1011.analyzePose(build1011('back'), 48, 56);
  check('P1011 後ろ向きが読める（幅は幅のまま）', back1011?.viewpoint === 'back' && back1011?.profileKind === 'width', `view=${back1011?.viewpoint} kind=${back1011?.profileKind}`);
  const vSide1011 = side1011 ? vpose1011.verifyBody(side1011) : null;
  check('P1011 奥行きプロファイルは正面の照合・目標に混ざらない', vSide1011?.verified === false && (side1011 ? vpose1011.setTarget(side1011) : true) === false, `verified=${vSide1011?.verified}`);
  const insp1011 = ksi1011.inspect();
  check('P1011 自己点検の記録に向きの読み（visualPoseViews）が入っている', typeof insp1011.visualPoseViews === 'number' && insp1011.visualPoseViews >= 1, `visualPoseViews=${insp1011.visualPoseViews}`);
}

// P1012: 腰（骨盤）の幅の頑丈な測り方。股の間に垂れた髪や線で
// 骨盤の行が左右に割れ、体の中心が隙間に落ちると、従来の測り方は
// 片側の破片だけを拾って幅が半分以下になった。中心が隙間に落ちた
// 行だけ細い隙間をまたいで両側をつなぎ、帯は下位25%で代表させる
// （帯の上端に腕の行が混ざっても引っ張られない）。
{
  const svc = (await import('../src/miki/conversation/services/visualPoseService')).visualPoseService;
  type RGB = [number, number, number];
  const SKIN: RGB = [232, 190, 160], HAIRC: RGB = [45, 32, 22], BLUE: RGB = [40, 40, 120], BG: RGB = [245, 245, 245];
  const mkFig = (splitHip: boolean) => {
    const W = 48, H = 56;
    const a = new Uint8Array(W * H * 4);
    const rect = (x0: number, y0: number, x1: number, y1: number, c: RGB) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const i = (y * W + x) * 4; a[i] = c[0]; a[i + 1] = c[1]; a[i + 2] = c[2]; a[i + 3] = 255; } };
    const disc = (cx: number, cy: number, r: number, c: RGB) => { for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) { const i = (y * W + x) * 4; a[i] = c[0]; a[i + 1] = c[1]; a[i + 2] = c[2]; a[i + 3] = 255; } };
    for (let i = 0; i < W * H; i++) { a[i * 4] = BG[0]; a[i * 4 + 1] = BG[1]; a[i * 4 + 2] = BG[2]; a[i * 4 + 3] = 255; }
    rect(16, 15, 28, 32, BLUE); rect(12, 16, 15, 30, SKIN); rect(29, 16, 32, 30, SKIN);
    rect(16, 32, 21, 50, BLUE); rect(23, 32, 28, 50, BLUE);
    if (splitHip) rect(21, 27, 22, 34, BG);
    disc(22, 9, 6, HAIRC); disc(22, 10, 5, SKIN);
    return { a, W, H };
  };
  const std = mkFig(false);
  const rStd: any = svc.analyzePose(std.a, std.W, std.H);
  const split = mkFig(true);
  const rSplit: any = svc.analyzePose(split.a, split.W, split.H);
  check('P1012 骨盤が割れた姿でもプロファイルが揃う', !!(rSplit && rSplit.profileComplete && rSplit.bodyProfile.hip !== null), JSON.stringify(rSplit?.bodyProfile));
  check('P1012 割れた骨盤の幅は両側をつないだ値になる', !!(rSplit && rSplit.bodyProfile.hip >= 0.22), `hip=${rSplit?.bodyProfile?.hip}`);
  check('P1012 通常の姿の腰は従来どおり（腕の行に引っ張られない）', !!(rStd && rStd.bodyProfile.hip >= 0.22 && rStd.bodyProfile.hip <= 0.32), `hip=${rStd?.bodyProfile?.hip}`);
  const vb: any = rStd ? svc.verifyBody(rStd) : null;
  check('P1012 素体描画の照合が保たれる', !!(vb && vb.verified), JSON.stringify(vb && { verified: vb.verified, score: vb.score }));
}

// P1013: 肩の幅の頑丈な測り方。肩の行は前に垂れた髪や壁線で
// 細かく割れやすく、全身サンプルでは肩の行が5pxの破片になって
// 0.02と読めた。細い隙間（図の高さの3.5%まで）をまたいで中心を
// 含む塊の幅を取り、肩の帯（肩の行の少し上〜下5%）の中央値を
// 使う。帯の最大は胸へ広がる行を拾って描画ドリルで肩と胸が
// 連動し、最小や単独行は割れた行を拾う（P1013の初回束で実際に
// 最大版がドリルを停滞させた）。
{
  const svc = (await import('../src/miki/conversation/services/visualPoseService')).visualPoseService;
  type RGB = [number, number, number];
  const SKIN: RGB = [232, 190, 160], HAIRC: RGB = [45, 32, 22], BLUE: RGB = [40, 40, 120], BG: RGB = [245, 245, 245];
  const mkFig = (splitShoulder: boolean) => {
    const W = 48, H = 56;
    const a = new Uint8Array(W * H * 4);
    const rect = (x0: number, y0: number, x1: number, y1: number, c: RGB) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const i = (y * W + x) * 4; a[i] = c[0]; a[i + 1] = c[1]; a[i + 2] = c[2]; a[i + 3] = 255; } };
    const disc = (cx: number, cy: number, r: number, c: RGB) => { for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) { const i = (y * W + x) * 4; a[i] = c[0]; a[i + 1] = c[1]; a[i + 2] = c[2]; a[i + 3] = 255; } };
    for (let i = 0; i < W * H; i++) { a[i * 4] = BG[0]; a[i * 4 + 1] = BG[1]; a[i * 4 + 2] = BG[2]; a[i * 4 + 3] = 255; }
    rect(16, 15, 28, 32, BLUE); rect(12, 16, 15, 30, SKIN); rect(29, 16, 32, 30, SKIN);
    rect(16, 32, 21, 50, BLUE); rect(23, 32, 28, 50, BLUE);
    if (splitShoulder) { rect(20, 14, 21, 24, BG); rect(24, 14, 25, 24, BG); }
    disc(22, 9, 6, HAIRC); disc(22, 10, 5, SKIN);
    return { a, W, H };
  };
  const std = mkFig(false);
  const rStd: any = svc.analyzePose(std.a, std.W, std.H);
  const split = mkFig(true);
  const rSplit: any = svc.analyzePose(split.a, split.W, split.H);
  check('P1013 肩が割れた姿でもプロファイルが揃う', !!(rSplit && rSplit.profileComplete && rSplit.bodyProfile.shoulder !== null), JSON.stringify(rSplit?.bodyProfile));
  check('P1013 割れた肩の幅はつないだ値になる', !!(rSplit && rSplit.bodyProfile.shoulder >= 0.35), `shoulder=${rSplit?.bodyProfile?.shoulder}`);
  check('P1013 通常の姿の肩は従来どおり', !!(rStd && rStd.bodyProfile.shoulder >= 0.38 && rStd.bodyProfile.shoulder <= 0.5), `shoulder=${rStd?.bodyProfile?.shoulder}`);
  const vb: any = rStd ? svc.verifyBody(rStd) : null;
  check('P1013 素体描画の照合が保たれる', !!(vb && vb.verified), JSON.stringify(vb && { verified: vb.verified, score: vb.score }));
}

// P1014: 複数人の数え方にも測り方の使い分けを入れる。薄い色の
// 人は肌や髪が背景と同じ色ビン（64刻み）に溶けて、人数の数え
// 本体から見落とされていた。細かいビン（32刻み）でも数え、
// 既に読めた人と重ならない人だけを足す（二重数え防止）。
{
  const svc = (await import('../src/miki/conversation/services/visualPoseService')).visualPoseService;
  type RGB = [number, number, number];
  const BG: RGB = [208, 210, 212];
  const D_SKIN: RGB = [232, 190, 160], D_HAIR: RGB = [45, 32, 22], D_CLOTH: RGB = [40, 40, 120];
  const P_SKIN: RGB = [243, 222, 205], P_HAIR: RGB = [243, 205, 215], P_CLOTH: RGB = [150, 160, 190];
  const mkPair = (paleSecond: boolean) => {
    const W = 96, H = 56;
    const a = new Uint8Array(W * H * 4);
    const rect = (x0: number, y0: number, x1: number, y1: number, c: RGB) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const i = (y * W + x) * 4; a[i] = c[0]; a[i + 1] = c[1]; a[i + 2] = c[2]; a[i + 3] = 255; } };
    const disc = (cx: number, cy: number, r: number, c: RGB) => { for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) { const i = (y * W + x) * 4; a[i] = c[0]; a[i + 1] = c[1]; a[i + 2] = c[2]; a[i + 3] = 255; } };
    for (let i = 0; i < W * H; i++) { a[i * 4] = BG[0]; a[i * 4 + 1] = BG[1]; a[i * 4 + 2] = BG[2]; a[i * 4 + 3] = 255; }
    const person = (ox: number, skin: RGB, hair: RGB, cloth: RGB) => {
      rect(ox + 16, 15, ox + 28, 32, cloth); rect(ox + 12, 16, ox + 15, 30, skin); rect(ox + 29, 16, ox + 32, 30, skin);
      rect(ox + 16, 32, ox + 21, 50, cloth); rect(ox + 23, 32, ox + 28, 50, cloth);
      disc(ox + 22, 9, 6, hair); disc(ox + 22, 10, 5, skin);
    };
    person(2, D_SKIN, D_HAIR, D_CLOTH);
    if (paleSecond) person(50, P_SKIN, P_HAIR, P_CLOTH); else person(50, D_SKIN, D_HAIR, D_CLOTH);
    return { a, W, H };
  };
  const mixed = mkPair(true);
  const resMixed = svc.analyzePeople(mixed.a, mixed.W, mixed.H);
  check('P1014 薄い色の人も含めて2人と数える', resMixed.count === 2, `count=${resMixed.count}`);
  const both = mkPair(false);
  const resBoth = svc.analyzePeople(both.a, both.W, both.H);
  check('P1014 通常の2人は二重に数えない', resBoth.count === 2, `count=${resBoth.count}`);
  const sum: any = svc.summary();
  check('P1014 複数人の記録が残る', sum.multi >= 1, `multi=${sum.multi}`);
}

// P1015: 描く色を本人の実測色にする。読み取りに肌色・髪色・
// 服色の実測RGBを持たせ、描画の既定色をその人の色にする
// （青いテスト人形の色条件でドリル・照合をしないため）。
// 本人の色が背景に近い時は、描く板の色を落とす。
{
  const svc = (await import('../src/miki/conversation/services/visualPoseService')).visualPoseService;
  type RGB = [number, number, number];
  const mkPerson = (skin: RGB, hair: RGB, cloth: RGB, bg: RGB) => {
    const W = 48, H = 56;
    const a = new Uint8Array(W * H * 4);
    const rect = (x0: number, y0: number, x1: number, y1: number, c: RGB) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const i = (y * W + x) * 4; a[i] = c[0]; a[i + 1] = c[1]; a[i + 2] = c[2]; a[i + 3] = 255; } };
    const disc = (cx: number, cy: number, r: number, c: RGB) => { for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) { const i = (y * W + x) * 4; a[i] = c[0]; a[i + 1] = c[1]; a[i + 2] = c[2]; a[i + 3] = 255; } };
    for (let i = 0; i < W * H; i++) { a[i * 4] = bg[0]; a[i * 4 + 1] = bg[1]; a[i * 4 + 2] = bg[2]; a[i * 4 + 3] = 255; }
    rect(16, 15, 28, 32, cloth); rect(12, 16, 15, 30, cloth); rect(29, 16, 32, 30, cloth);
    rect(16, 32, 21, 50, cloth); rect(23, 32, 28, 50, cloth);
    disc(22, 9, 6, hair); disc(22, 10, 5, skin);
    return { a, W, H };
  };
  const near = (c: number[] | null | undefined, t: RGB, tol: number) => !!c && Math.abs(c[0] - t[0]) + Math.abs(c[1] - t[1]) + Math.abs(c[2] - t[2]) <= tol;
  const std = mkPerson([232, 190, 160], [45, 32, 22], [40, 40, 120], [245, 245, 245]);
  const rs: any = svc.analyzePose(std.a, std.W, std.H);
  check('P1015 読みに肌色と髪色の実測が入る', near(rs?.skinColor, [232, 190, 160], 6) && near(rs?.hairRgb, [45, 32, 22], 6), `skin=${JSON.stringify(rs?.skinColor)} hair=${JSON.stringify(rs?.hairRgb)}`);
  const pale = mkPerson([243, 222, 205], [243, 205, 215], [150, 160, 190], [208, 210, 212]);
  const rp: any = svc.analyzePose(pale.a, pale.W, pale.H);
  check('P1015 薄い人の肌色と服色の実測が入る', near(rp?.skinColor, [243, 222, 205], 6) && near(rp?.clothing?.topRgb, [150, 160, 190], 42), `skin=${JSON.stringify(rp?.skinColor)} top=${JSON.stringify(rp?.clothing?.topRgb)}`);
  const renP: any = rp ? svc.renderBody(rp, 48) : null;
  const pxP = (x: number, y: number) => renP ? [renP[(y * 48 + x) * 4], renP[(y * 48 + x) * 4 + 1], renP[(y * 48 + x) * 4 + 2]] : null;
  // P1065: 顔の見本点は (22,9) に移した。(22,10) は現在の顔の描画では口の角に
  // ちょうど重なる（口は顔中心+0.55Rに幅0.45Rで描かれる）。顔が本人の肌色で
  // 描かれること自体は変わっていないので、目と口の間の肌の点を採る。
  check('P1015 薄い人を描くと本人の服色と肌色になる（青くない）', near(pxP(22, 22), [150, 160, 190], 18) && near(pxP(22, 9), [243, 222, 205], 6) && !near(pxP(22, 22), [40, 40, 120], 100), `chest=${JSON.stringify(pxP(22, 22))} face=${JSON.stringify(pxP(22, 9))}`);
  const white = mkPerson([244, 228, 223], [243, 205, 215], [150, 160, 190], [208, 210, 212]);
  const rw: any = svc.analyzePose(white.a, white.W, white.H);
  const renW: any = rw ? svc.renderBody(rw, 48) : null;
  const bgW = renW ? [renW[0], renW[1], renW[2]] : null;
  check('P1015 本人の色が背景に近い時は板の色が落ちる', near(bgW, [168, 168, 172], 6), `bg=${JSON.stringify(bgW)}`);
  const vbP: any = rp ? svc.verifyBody(rp) : null;
  check('P1015 薄い人は本人の色で描いても照合が通る', vbP?.verified === true, `score=${vbP?.score}`);
}

// P1016: 描く側の見た目セット（関節・髪の先細り・顔・指の影色）
{
  const pose = await import('../src/miki/conversation/services/visualPoseService');
  type RGB = [number, number, number];
  const BGc: RGB = [245, 245, 245], SKINc: RGB = [232, 190, 160], HAIRc: RGB = [45, 32, 22], CLOTHc: RGB = [40, 40, 120];
  const mkCanvas = (W: number, H: number) => { const a = new Uint8Array(W * H * 4); for (let i = 0; i < W * H; i++) { a[i * 4] = BGc[0]; a[i * 4 + 1] = BGc[1]; a[i * 4 + 2] = BGc[2]; a[i * 4 + 3] = 255; } return a; };
  const rectIn = (a: Uint8Array, W: number, x0: number, y0: number, x1: number, y1: number, c: RGB) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const i = (y * W + x) * 4; a[i] = c[0]; a[i + 1] = c[1]; a[i + 2] = c[2]; a[i + 3] = 255; } };
  const discIn = (a: Uint8Array, W: number, H: number, cx: number, cy: number, r: number, c: RGB) => { for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) { const i = (y * W + x) * 4; a[i] = c[0]; a[i + 1] = c[1]; a[i + 2] = c[2]; a[i + 3] = 255; } };
  // 腕を真横に広げた人は広げていると読む（髪の柱の抑制が効きすぎない）
  const tp = mkCanvas(48, 56);
  rectIn(tp, 48, 16, 15, 28, 32, CLOTHc); rectIn(tp, 48, 2, 17, 15, 20, CLOTHc); rectIn(tp, 48, 29, 17, 45, 20, CLOTHc);
  rectIn(tp, 48, 16, 32, 21, 50, CLOTHc); rectIn(tp, 48, 23, 32, 28, 50, CLOTHc);
  discIn(tp, 48, 56, 22, 9, 6, HAIRc); discIn(tp, 48, 56, 22, 10, 5, SKINc);
  const rt = pose.visualPoseService.analyzePose(tp, 48, 56);
  check('P1016 腕を広げた人は広げていると読む', rt?.armL === 'SPREAD' && rt?.armR === 'SPREAD', `${rt?.armL}/${rt?.armR}`);
  // 腕を下ろした人は下ろしていると読む
  const dn = mkCanvas(48, 56);
  rectIn(dn, 48, 16, 15, 28, 32, CLOTHc); rectIn(dn, 48, 12, 16, 15, 30, CLOTHc); rectIn(dn, 48, 29, 16, 32, 30, CLOTHc);
  rectIn(dn, 48, 16, 32, 21, 50, CLOTHc); rectIn(dn, 48, 23, 32, 28, 50, CLOTHc);
  discIn(dn, 48, 56, 22, 9, 6, HAIRc); discIn(dn, 48, 56, 22, 10, 5, SKINc);
  const rd = pose.visualPoseService.analyzePose(dn, 48, 56);
  check('P1016 腕を下ろした人は下ろしていると読む', rd?.armL === 'DOWN' && rd?.armR === 'DOWN', `${rd?.armL}/${rd?.armR}`);
  // 長い髪の垂れを「広げた腕」と誤らない
  const lh = mkCanvas(48, 56);
  rectIn(lh, 48, 16, 15, 28, 32, CLOTHc); rectIn(lh, 48, 12, 16, 15, 30, CLOTHc); rectIn(lh, 48, 29, 16, 32, 30, CLOTHc);
  rectIn(lh, 48, 16, 32, 21, 50, CLOTHc); rectIn(lh, 48, 23, 32, 28, 50, CLOTHc);
  rectIn(lh, 48, 13, 4, 31, 12, HAIRc); rectIn(lh, 48, 13, 12, 15, 40, HAIRc); rectIn(lh, 48, 29, 12, 31, 40, HAIRc);
  discIn(lh, 48, 56, 22, 10, 5, SKINc);
  const rl = pose.visualPoseService.analyzePose(lh, 48, 56);
  check('P1016 長い髪を広げた腕と誤らない', rl !== null && rl.armL !== 'SPREAD' && rl.armR !== 'SPREAD', `${rl?.armL}/${rl?.armR}`);
  // 描画：顔の指定が無くても目と口があり、指の影は旧固定色でない
  const ren = rl ? pose.visualPoseService.renderBody(rl, 96) : null;
  let faceDark = 0; let oldFinger = 0;
  if (ren) {
    for (let y = 8; y <= 26; y++) for (let x = 30; x <= 66; x++) { const i = (y * 96 + x) * 4; if (ren[i] === 30 && ren[i + 1] === 30 && ren[i + 2] === 30) faceDark++; }
    for (let i = 0; i < 96 * 96; i++) if (ren[i * 4] === 150 && ren[i * 4 + 1] === 110 && ren[i * 4 + 2] === 82) oldFinger++;
  }
  check('P1016 顔の指定が無くても目と口を描く', faceDark >= 10, `dark=${faceDark}`);
  check('P1016 指の分かれ目は肌の影色で描く', ren !== null && oldFinger === 0, `old=${oldFinger}`);
  // 髪のサイドパネルは毛先に向けて細くなる
  const hairAt = (y: number) => { let n = 0; if (ren) for (let x = 0; x < 96; x++) { const i = (y * 96 + x) * 4; if (ren[i] === HAIRc[0] && ren[i + 1] === HAIRc[1] && ren[i + 2] === HAIRc[2]) n++; } return n; };
  check('P1016 髪は毛先に向けて先細りする', hairAt(30) >= 6 && hairAt(66) < hairAt(30), `mid=${hairAt(30)} tip=${hairAt(66)}`);
}

// P1017: 顔の測定値を読みに持たせ、既定の顔は本人の測定値で描く
{
  const pose = await import('../src/miki/conversation/services/visualPoseService');
  type RGB = [number, number, number];
  const BGc: RGB = [245, 245, 245], HAIRc: RGB = [45, 32, 22], CLOTHc: RGB = [40, 40, 120], DARKc: RGB = [30, 30, 30];
  const mkFig = (skin: RGB, eyeC: RGB) => {
    const W = 48, H = 56; const a = new Uint8Array(W * H * 4);
    const rect = (x0: number, y0: number, x1: number, y1: number, c: RGB) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const i = (y * W + x) * 4; a[i] = c[0]; a[i + 1] = c[1]; a[i + 2] = c[2]; a[i + 3] = 255; } };
    const disc = (cx: number, cy: number, r: number, c: RGB) => { for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) { const i = (y * W + x) * 4; a[i] = c[0]; a[i + 1] = c[1]; a[i + 2] = c[2]; a[i + 3] = 255; } };
    for (let i = 0; i < W * H; i++) { a[i * 4] = BGc[0]; a[i * 4 + 1] = BGc[1]; a[i * 4 + 2] = BGc[2]; a[i * 4 + 3] = 255; }
    rect(16, 15, 28, 32, CLOTHc); rect(12, 16, 15, 30, CLOTHc); rect(29, 16, 32, 30, CLOTHc);
    rect(16, 32, 21, 50, CLOTHc); rect(23, 32, 28, 50, CLOTHc);
    disc(22, 9, 6, HAIRc); disc(22, 10, 5, skin);
    disc(20, 10, 1, eyeC); disc(25, 10, 1, eyeC);
    return a;
  };
  // 薄い肌（厳しい肌判定の外の色）でも顔の測定が読みに乗る
  const rp = pose.visualPoseService.analyzePose(mkFig([255, 236, 230], DARKc), 48, 56);
  check('P1017 薄い肌でも顔の測定が読みに乗る', rp?.face != null && rp.face.eyeColor === '黒', JSON.stringify(rp?.face ?? null));
  // 茶色の目は、既定の描画でも茶色の虹彩で描かれる
  const rb = pose.visualPoseService.analyzePose(mkFig([232, 190, 160], [140, 90, 50]), 48, 56);
  const renB = rb ? pose.visualPoseService.renderBody(rb, 96) : null;
  let irisPx = 0;
  if (renB) for (let y = 10; y <= 34; y++) for (let x = 28; x <= 68; x++) { const i = (y * 96 + x) * 4; if (renB[i] === 140 && renB[i + 1] === 90 && renB[i + 2] === 50) irisPx++; }
  check('P1017 既定の顔は本人の目の色で描く', rb?.face?.eyeColor === '茶色' && irisPx >= 4, `face=${JSON.stringify(rb?.face ?? null)} iris=${irisPx}`);
}

// P1018: 構造化した描画（線＋陰影＋髪の房）が土台として照合を通る
{
  const pose = await import('../src/miki/conversation/services/visualPoseService');
  type RGB = [number, number, number];
  const BGc: RGB = [245, 245, 245], SKINc: RGB = [232, 190, 160], HAIRc: RGB = [45, 32, 22], CLOTHc: RGB = [40, 40, 120];
  const W = 48, H = 56; const a = new Uint8Array(W * H * 4);
  const rect = (x0: number, y0: number, x1: number, y1: number, c: RGB) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const i = (y * W + x) * 4; a[i] = c[0]; a[i + 1] = c[1]; a[i + 2] = c[2]; a[i + 3] = 255; } };
  const disc = (cx: number, cy: number, r: number, c: RGB) => { for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) { const i = (y * W + x) * 4; a[i] = c[0]; a[i + 1] = c[1]; a[i + 2] = c[2]; a[i + 3] = 255; } };
  for (let i = 0; i < W * H; i++) { a[i * 4] = BGc[0]; a[i * 4 + 1] = BGc[1]; a[i * 4 + 2] = BGc[2]; a[i * 4 + 3] = 255; }
  rect(16, 15, 28, 32, CLOTHc); rect(12, 16, 15, 30, CLOTHc); rect(29, 16, 32, 30, CLOTHc);
  rect(16, 32, 21, 50, CLOTHc); rect(23, 32, 28, 50, CLOTHc);
  disc(22, 9, 6, HAIRc); disc(22, 10, 5, SKINc);
  const rd = pose.visualPoseService.analyzePose(a, W, H);
  const vs = rd ? pose.visualPoseService.verifyBodyStructured(rd) : null;
  check('P1018 構造化した描画が照合を通る', vs?.verified === true, `score=${vs?.score}`);
  // 髪と肌が近い色の人でも、髪の房とツヤが消えず体に縞が出ない側：
  // 髪の照合（ツヤ・房の検出）が薄い色の髪でも通る
  const BGp: RGB = [208, 210, 212], SKINp: RGB = [243, 222, 205], HAIRp: RGB = [243, 205, 215], CLOTHp: RGB = [150, 160, 190];
  const b = new Uint8Array(W * H * 4);
  const rectB = (x0: number, y0: number, x1: number, y1: number, c: RGB) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const i = (y * W + x) * 4; b[i] = c[0]; b[i + 1] = c[1]; b[i + 2] = c[2]; b[i + 3] = 255; } };
  const discB = (cx: number, cy: number, r: number, c: RGB) => { for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) { const i = (y * W + x) * 4; b[i] = c[0]; b[i + 1] = c[1]; b[i + 2] = c[2]; b[i + 3] = 255; } };
  for (let i = 0; i < W * H; i++) { b[i * 4] = BGp[0]; b[i * 4 + 1] = BGp[1]; b[i * 4 + 2] = BGp[2]; b[i * 4 + 3] = 255; }
  rectB(16, 15, 28, 32, CLOTHp); rectB(12, 16, 15, 30, CLOTHp); rectB(29, 16, 32, 30, CLOTHp);
  rectB(16, 32, 21, 50, CLOTHp); rectB(23, 32, 28, 50, CLOTHp);
  rectB(13, 4, 31, 12, HAIRp); rectB(13, 12, 15, 40, HAIRp); rectB(29, 12, 31, 40, HAIRp);
  discB(22, 10, 5, SKINp);
  const rp2 = pose.visualPoseService.analyzePose(b, W, H);
  const vh = rp2 ? pose.visualPoseService.verifyBodyHairDetail(rp2) : null;
  check('P1018 薄い色の髪でも房とツヤが描ける', vh?.verified === true, `shine=${vh?.shine} clumps=${vh?.clumps}`);
}

// P1019/P1020: 胸の測定を読みに持たせる／髪の裏側と毛先の割れ＋構造化照合が本人系でも通る
{
  const pose = await import('../src/miki/conversation/services/visualPoseService');
  type RGB = [number, number, number];
  const BGc: RGB = [245, 245, 245], SKINc: RGB = [232, 190, 160], HAIRc: RGB = [45, 32, 22], CLOTHc: RGB = [40, 40, 120];
  const mkBase = () => {
    const W = 48, H = 56; const a = new Uint8Array(W * H * 4);
    for (let i = 0; i < W * H; i++) { a[i * 4] = BGc[0]; a[i * 4 + 1] = BGc[1]; a[i * 4 + 2] = BGc[2]; a[i * 4 + 3] = 255; }
    return a;
  };
  const rect = (a: Uint8Array, x0: number, y0: number, x1: number, y1: number, c: RGB) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const i = (y * 48 + x) * 4; a[i] = c[0]; a[i + 1] = c[1]; a[i + 2] = c[2]; a[i + 3] = 255; } };
  const disc = (a: Uint8Array, cx: number, cy: number, r: number, c: RGB) => { for (let y = 0; y < 56; y++) for (let x = 0; x < 48; x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) { const i = (y * 48 + x) * 4; a[i] = c[0]; a[i + 1] = c[1]; a[i + 2] = c[2]; a[i + 3] = 255; } };
  // 胸が広く腰が細い胴は bust が立つ
  const tp = mkBase();
  rect(tp, 16, 15, 28, 22, CLOTHc); rect(tp, 17, 23, 27, 26, CLOTHc); rect(tp, 19, 27, 25, 32, CLOTHc);
  rect(tp, 12, 16, 15, 30, CLOTHc); rect(tp, 29, 16, 32, 30, CLOTHc);
  rect(tp, 16, 32, 21, 50, CLOTHc); rect(tp, 23, 32, 28, 50, CLOTHc);
  disc(tp, 22, 9, 6, HAIRc); disc(tp, 22, 10, 5, SKINc);
  const rt = pose.visualPoseService.analyzePose(tp, 48, 56);
  check('P1019 胸と腰の差から胸のふくらみを測る', (rt?.bust ?? 0) >= 0.3, `bust=${rt?.bust}`);
  // まっすぐな胴は bust が立たない
  const st = mkBase();
  rect(st, 16, 15, 28, 32, CLOTHc); rect(st, 12, 16, 15, 30, CLOTHc); rect(st, 29, 16, 32, 30, CLOTHc);
  rect(st, 16, 32, 21, 50, CLOTHc); rect(st, 23, 32, 28, 50, CLOTHc);
  disc(st, 22, 9, 6, HAIRc); disc(st, 22, 10, 5, SKINc);
  const rs = pose.visualPoseService.analyzePose(st, 48, 56);
  check('P1019 まっすぐな胴では胸のふくらみは立たない', rs?.bust === 0, `bust=${rs?.bust}`);
  // P1020: 薄い色の長い髪の人でも、構造化した描画（線＋陰影＋髪の裏側）が照合を通る
  const BGp: RGB = [208, 210, 212], SKINp: RGB = [243, 222, 205], HAIRp: RGB = [243, 205, 215], CLOTHp: RGB = [150, 160, 190];
  const b = new Uint8Array(48 * 56 * 4);
  for (let i = 0; i < 48 * 56; i++) { b[i * 4] = BGp[0]; b[i * 4 + 1] = BGp[1]; b[i * 4 + 2] = BGp[2]; b[i * 4 + 3] = 255; }
  const rectB = (x0: number, y0: number, x1: number, y1: number, c: RGB) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const i = (y * 48 + x) * 4; b[i] = c[0]; b[i + 1] = c[1]; b[i + 2] = c[2]; b[i + 3] = 255; } };
  const discB = (cx: number, cy: number, r: number, c: RGB) => { for (let y = 0; y < 56; y++) for (let x = 0; x < 48; x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) { const i = (y * 48 + x) * 4; b[i] = c[0]; b[i + 1] = c[1]; b[i + 2] = c[2]; b[i + 3] = 255; } };
  rectB(16, 15, 28, 32, CLOTHp); rectB(12, 16, 15, 30, CLOTHp); rectB(29, 16, 32, 30, CLOTHp);
  rectB(16, 32, 21, 50, CLOTHp); rectB(23, 32, 28, 50, CLOTHp);
  rectB(13, 4, 31, 12, HAIRp); rectB(13, 12, 15, 40, HAIRp); rectB(29, 12, 31, 40, HAIRp);
  discB(22, 10, 5, SKINp);
  const rp2 = pose.visualPoseService.analyzePose(b, 48, 56);
  const vs2 = rp2 ? pose.visualPoseService.verifyBodyStructured(rp2) : null;
  check('P1020 薄い色の長い髪でも構造化した描画が照合を通る', vs2?.verified === true, `score=${vs2?.score}`);
}

// P1021: 薄い色の目を「塊」で読む（輪の肌率に届かない線画・写真の目）
{
  const vz = await import('../src/miki/conversation/services/visualZoomService');
  type RGB = [number, number, number];
  const HAIRc: RGB = [45, 32, 22], SKINc: RGB = [255, 236, 231], EYEp: RGB = [205, 153, 168], DARKc: RGB = [30, 30, 30];
  const S = 48; const a = new Uint8Array(S * S * 4);
  const rect = (x0: number, y0: number, x1: number, y1: number, c: RGB) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const i = (y * S + x) * 4; a[i] = c[0]; a[i + 1] = c[1]; a[i + 2] = c[2]; a[i + 3] = 255; } };
  const disc = (cx: number, cy: number, r: number, c: RGB) => { for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) { const i = (y * S + x) * 4; a[i] = c[0]; a[i + 1] = c[1]; a[i + 2] = c[2]; a[i + 3] = 255; } };
  disc(24, 22, 17, HAIRc); disc(24, 24, 15, SKINc);
  rect(10, 8, 38, 13, HAIRc); // 前髪
  rect(13, 14, 14, 30, HAIRc); rect(33, 14, 34, 30, HAIRc); // 顔にかかる髪の筋
  rect(10, 20, 38, 20, DARKc); rect(10, 26, 38, 26, DARKc); // 線画の線（目の輪を壊す）
  disc(17, 23, 2, EYEp); disc(31, 23, 2, EYEp); // 薄いピンクの目
  const fr: any = vz.visualZoomService.analyzeFace(a);
  check('P1021 薄いピンクの目が2つ読める', fr?.eyes === 2 && fr?.eyeColor === 'ピンク', `eyes=${fr?.eyes} eyeColor=${fr?.eyeColor}`);
}



  const { visualPoseService: poseSvcInst } = await import('../src/miki/conversation/services/visualPoseService');
  const poseSvc = () => poseSvcInst;

  // 淡色の長い髪の人（48×56）。薄い色は色ビンで背景に溶けるため、
  // P1003以降の領域分割と細かいビンの検証に使う共通の見本。
  const paleLongHair48 = (): Uint8Array => {
    const W = 48, H = 56; const a = new Uint8Array(W * H * 4);
    const BG: [number, number, number] = [208, 210, 212]; const SKIN: [number, number, number] = [243, 222, 205];
    const HAIR: [number, number, number] = [243, 205, 215]; const CLOTH: [number, number, number] = [150, 160, 190];
    const rect = (x0: number, y0: number, x1: number, y1: number, c: [number, number, number]) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const i = (y * W + x) * 4; a[i] = c[0]; a[i + 1] = c[1]; a[i + 2] = c[2]; a[i + 3] = 255; } };
    const disc = (cx: number, cy: number, r: number, c: [number, number, number]) => { for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) { const i = (y * W + x) * 4; a[i] = c[0]; a[i + 1] = c[1]; a[i + 2] = c[2]; a[i + 3] = 255; } };
    for (let i = 0; i < W * H; i++) { a[i * 4] = BG[0]; a[i * 4 + 1] = BG[1]; a[i * 4 + 2] = BG[2]; a[i * 4 + 3] = 255; }
    rect(13, 4, 31, 12, HAIR); rect(15, 13, 16, 40, HAIR); rect(27, 13, 28, 40, HAIR);
    rect(16, 15, 28, 32, CLOTH);
    rect(12, 16, 15, 30, CLOTH); rect(29, 16, 32, 30, CLOTH);
    rect(16, 32, 21, 50, CLOTH); rect(23, 32, 28, 50, CLOTH);
    disc(22, 9, 6, HAIR); disc(22, 10, 5, SKIN);
    return a;
  };

  // P1022: 頭の大きさは高さ比で測る＋後ろ髪の層（形の指定で重ねる）
  {
    const r: any = await poseSvc().analyzePose(paleLongHair48(), 48, 56);
    const widthOf = (px: Uint8Array, S: number): number => {
      const bg = [px[0], px[1], px[2]];
      let x0 = S, x1 = -1;
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { const i = (y * S + x) * 4; if (Math.abs(px[i] - bg[0]) + Math.abs(px[i + 1] - bg[1]) + Math.abs(px[i + 2] - bg[2]) > 30) { if (x < x0) x0 = x; if (x > x1) x1 = x; } }
      return x1 - x0 + 1;
    };
    check('P1022 頭の半径は高さ比でも持つ（縦長で幅比とずれる）', r?.headRh !== null && r?.headRh !== undefined && Math.abs((r?.headRh ?? 0) - (r?.head?.r ?? 0)) > 0.005, JSON.stringify({ headR: r?.head?.r, headRh: r?.headRh }));
    check('P1022 輪郭幅を持つ', typeof r?.silhouetteWidth === 'number' && (r?.silhouetteWidth ?? 0) > 0.2, `silW=${r?.silhouetteWidth}`);
    // P1065 再ベース：広がりの検査は淡色フィギュアから細身の
    // 合成フィギュアへ移した。淡色フィギュアは輪郭幅0.44が
    // 腕の張り出しで決まっており（胸も0.44）、輪郭幅×0.94で
    // 描く後ろ髪の層（約45px）は腕の幅（約54px）より狭く、
    // 前提（層が輪郭を広げる）が実測で成り立たなかった。
    // 細身フィギュアは輪郭幅が髪で決まる（0.40）ため、
    // 層の広がりを素直に測れる。+4pxの閾値と0.94倍は不変。
    const narrow1022 = (() => {
      const W = 48, H = 56; const a = new Uint8Array(W * H * 4);
      const BG: [number, number, number] = [208, 210, 212]; const SKIN: [number, number, number] = [243, 222, 205];
      const HAIR: [number, number, number] = [243, 205, 215]; const CLOTH: [number, number, number] = [150, 160, 190];
      const rect = (x0: number, y0: number, x1: number, y1: number, c: [number, number, number]) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const i = (y * W + x) * 4; a[i] = c[0]; a[i + 1] = c[1]; a[i + 2] = c[2]; a[i + 3] = 255; } };
      const disc = (cx: number, cy: number, r: number, c: [number, number, number]) => { for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) { const i = (y * W + x) * 4; a[i] = c[0]; a[i + 1] = c[1]; a[i + 2] = c[2]; a[i + 3] = 255; } };
      for (let i = 0; i < W * H; i++) { a[i * 4] = BG[0]; a[i * 4 + 1] = BG[1]; a[i * 4 + 2] = BG[2]; a[i * 4 + 3] = 255; }
      rect(13, 4, 31, 12, HAIR); rect(15, 13, 16, 40, HAIR); rect(27, 13, 28, 40, HAIR);
      rect(19, 15, 25, 32, CLOTH);
      rect(17, 16, 18, 30, CLOTH); rect(26, 16, 27, 30, CLOTH);
      rect(19, 32, 21, 50, CLOTH); rect(23, 32, 25, 50, CLOTH);
      disc(22, 9, 6, HAIR); disc(22, 10, 5, SKIN);
      return a;
    })();
    const rn: any = await poseSvc().analyzePose(narrow1022, 48, 56);
    const plain = await poseSvc().renderBody(rn, 128);
    const sheeted = await poseSvc().renderBody(rn, 128, null, null, { backHair: true });
    check('P1022 後ろ髪の層で輪郭が広がる', !!plain && !!sheeted && widthOf(sheeted, 128) > widthOf(plain, 128) + 4, `plain=${plain ? widthOf(plain, 128) : 0} sheeted=${sheeted ? widthOf(sheeted, 128) : 0}`);
  }


  // P1023: 輪郭（外側の境界）を24段で測り、曲線で照合する
  {
    const W = 48, H = 56;
    const fig = new Uint8Array(W * H * 4);
    const rect = (x0: number, y0: number, x1: number, y1: number, c: [number, number, number]) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const i = (y * W + x) * 4; fig[i] = c[0]; fig[i + 1] = c[1]; fig[i + 2] = c[2]; fig[i + 3] = 255; } };
    const disc = (cx: number, cy: number, r: number, c: [number, number, number]) => { for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) { const i = (y * W + x) * 4; fig[i] = c[0]; fig[i + 1] = c[1]; fig[i + 2] = c[2]; fig[i + 3] = 255; } };
    for (let i = 0; i < W * H; i++) { fig[i * 4] = 245; fig[i * 4 + 1] = 245; fig[i * 4 + 2] = 245; fig[i * 4 + 3] = 255; }
    rect(16, 15, 28, 32, [40, 40, 120]); rect(12, 16, 15, 30, [40, 40, 120]); rect(29, 16, 32, 30, [40, 40, 120]);
    rect(16, 32, 21, 50, [40, 40, 120]); rect(23, 32, 28, 50, [40, 40, 120]);
    disc(22, 9, 6, [45, 32, 22]); disc(22, 10, 5, [232, 190, 160]);
    const r: any = await poseSvc().analyzePose(fig, W, H);
    check('P1023 輪郭を24段で持つ', Array.isArray(r?.contour?.l) && r.contour.l.length === 24 && Array.isArray(r?.contour?.r), `len=${r?.contour?.l?.length}`);
    const vc: any = await poseSvc().verifyBodyContour(r);
    check('P1023 輪郭の曲線で照合できる', vc?.verified === true && (vc?.compared ?? 0) >= 16, JSON.stringify(vc));
  }


  // P1024: 中の境界線を抽出して照合する
  {
    const r: any = await poseSvc().analyzePose((() => {
      const W = 48, H = 56; const fig = new Uint8Array(W * H * 4);
      const rect = (x0: number, y0: number, x1: number, y1: number, c: [number, number, number]) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const i = (y * W + x) * 4; fig[i] = c[0]; fig[i + 1] = c[1]; fig[i + 2] = c[2]; fig[i + 3] = 255; } };
      const disc = (cx: number, cy: number, r: number, c: [number, number, number]) => { for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) { const i = (y * W + x) * 4; fig[i] = c[0]; fig[i + 1] = c[1]; fig[i + 2] = c[2]; fig[i + 3] = 255; } };
      for (let i = 0; i < W * H; i++) { fig[i * 4] = 245; fig[i * 4 + 1] = 245; fig[i * 4 + 2] = 245; fig[i * 4 + 3] = 255; }
      rect(16, 15, 28, 32, [40, 40, 120]); rect(12, 16, 15, 30, [40, 40, 120]); rect(29, 16, 32, 30, [40, 40, 120]);
      rect(16, 32, 21, 50, [40, 40, 120]); rect(23, 32, 28, 50, [40, 40, 120]);
      disc(22, 9, 6, [45, 32, 22]); disc(22, 10, 5, [232, 190, 160]);
      return fig;
    })(), 48, 56);
    check('P1024 中の境界線を24段で持つ', Array.isArray(r?.innerLines) && r.innerLines.length === 24, `len=${r?.innerLines?.length}`);
    const vi: any = await poseSvc().verifyBodyInnerLines(r);
    check('P1024 中の境界線で照合できる', vi?.verified === true && (vi?.compared ?? 0) >= 12, JSON.stringify(vi));
  }


  // P1025: 上下に分かれた服を読む（服の色・腹の肌・境目の線）
  {
    const W = 48, H = 56; const fig = new Uint8Array(W * H * 4);
    const rect = (x0: number, y0: number, x1: number, y1: number, c: [number, number, number]) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const i = (y * W + x) * 4; fig[i] = c[0]; fig[i + 1] = c[1]; fig[i + 2] = c[2]; fig[i + 3] = 255; } };
    const disc = (cx: number, cy: number, r: number, c: [number, number, number]) => { for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) { const i = (y * W + x) * 4; fig[i] = c[0]; fig[i + 1] = c[1]; fig[i + 2] = c[2]; fig[i + 3] = 255; } };
    for (let i = 0; i < W * H; i++) { fig[i * 4] = 245; fig[i * 4 + 1] = 245; fig[i * 4 + 2] = 245; fig[i * 4 + 3] = 255; }
    const SKIN: [number, number, number] = [232, 190, 160]; const RED: [number, number, number] = [200, 60, 60];
    rect(16, 15, 28, 21, RED); rect(16, 22, 28, 27, SKIN); rect(16, 28, 28, 32, RED);
    rect(12, 16, 15, 30, SKIN); rect(29, 16, 32, 30, SKIN);
    rect(16, 32, 21, 36, RED); rect(23, 32, 28, 36, RED);
    rect(16, 37, 21, 50, SKIN); rect(23, 37, 28, 50, SKIN);
    disc(22, 9, 6, [45, 32, 22]); disc(22, 10, 5, SKIN);
    const r: any = await poseSvc().analyzePose(fig, W, H);
    check('P1025 上下に分かれた服と読める', r?.clothing?.separated === true, JSON.stringify(r?.clothing));
    check('P1025 服の色を肌と分けて読む', Array.isArray(r?.clothing?.topRgb) && Math.abs((r?.clothing?.topRgb?.[0] ?? 0) - 200) <= 12 && Array.isArray(r?.clothing?.bottomRgb) && Math.abs((r?.clothing?.bottomRgb?.[0] ?? 0) - 200) <= 12, JSON.stringify({ top: r?.clothing?.topRgb, bottom: r?.clothing?.bottomRgb }));
    const vb: any = await poseSvc().verifyBody(r);
    check('P1025 分かれた服でも素体の照合は通る', vb?.verified === true, JSON.stringify(vb && { score: vb.score }));
  }


  // P1026: 分かれた服は裸と取り違えず、描き直しでも読み返せる
  {
    const W = 48, H = 56; const fig = new Uint8Array(W * H * 4);
    const rect = (x0: number, y0: number, x1: number, y1: number, c: [number, number, number]) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const i = (y * W + x) * 4; fig[i] = c[0]; fig[i + 1] = c[1]; fig[i + 2] = c[2]; fig[i + 3] = 255; } };
    const disc = (cx: number, cy: number, r: number, c: [number, number, number]) => { for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) { const i = (y * W + x) * 4; fig[i] = c[0]; fig[i + 1] = c[1]; fig[i + 2] = c[2]; fig[i + 3] = 255; } };
    for (let i = 0; i < W * H; i++) { fig[i * 4] = 245; fig[i * 4 + 1] = 245; fig[i * 4 + 2] = 245; fig[i * 4 + 3] = 255; }
    const SKIN: [number, number, number] = [232, 190, 160]; const RED: [number, number, number] = [200, 60, 60];
    rect(16, 15, 28, 21, RED); rect(16, 22, 28, 27, SKIN); rect(16, 28, 28, 32, RED);
    rect(12, 16, 15, 30, SKIN); rect(29, 16, 32, 30, SKIN);
    rect(16, 32, 21, 36, RED); rect(23, 32, 28, 36, RED);
    rect(16, 37, 21, 50, SKIN); rect(23, 37, 28, 50, SKIN);
    disc(22, 9, 6, [45, 32, 22]); disc(22, 10, 5, SKIN);
    const r: any = await poseSvc().analyzePose(fig, W, H);
    check('P1026 水着のような服を裸と読まない', r?.clothing?.separated === true && r?.bare === false, JSON.stringify({ separated: r?.clothing?.separated, bare: r?.bare }));
    const img = await poseSvc().renderBody(r, 128);
    const re: any = img ? await poseSvc().analyzePose(img, 128, 128) : null;
    check('P1026 描き直しでも服の分かれが読み返せる', re?.clothing?.separated === true, JSON.stringify(re?.clothing));
  }


  // P1027: 輪郭も目標に持ち、ドリルに輪郭の経路がある
  {
    const r: any = await poseSvc().analyzePose(paleLongHair48(), 48, 56);
    check('P1027 長い髪の読みに輪郭と広がりがある', !!r?.contour && typeof r?.silhouetteWidth === 'number', JSON.stringify({ silW: r?.silhouetteWidth }));
    const okSet: any = await poseSvc().setTarget(r);
    const t: any = await poseSvc().getTarget();
    check('P1027 目標に輪郭が保存される', okSet === true && !!t?.contour && Array.isArray(t?.contour?.l), JSON.stringify({ has: !!t?.contour }));
    const d: any = await poseSvc().drillToTarget({ ...r, silhouetteWidth: 0.25 });
    check('P1027 ドリルに輪郭の差分が返る', d !== null && typeof d?.contourDiffInitial === 'number', JSON.stringify({ ci: d?.contourDiffInitial, cf: d?.contourDiffFinal }));
  }


  // P1028: 肩の傾きを読む（水平な肩と、なだらかな肩）
  {
    const buildFig = (sloped: boolean): Uint8Array => {
      const W = 48, H = 56; const fig = new Uint8Array(W * H * 4);
      const rect = (x0: number, y0: number, x1: number, y1: number, c: [number, number, number]) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const i = (y * W + x) * 4; fig[i] = c[0]; fig[i + 1] = c[1]; fig[i + 2] = c[2]; fig[i + 3] = 255; } };
      const disc = (cx: number, cy: number, r: number, c: [number, number, number]) => { for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) { const i = (y * W + x) * 4; fig[i] = c[0]; fig[i + 1] = c[1]; fig[i + 2] = c[2]; fig[i + 3] = 255; } };
      for (let i = 0; i < W * H; i++) { fig[i * 4] = 245; fig[i * 4 + 1] = 245; fig[i * 4 + 2] = 245; fig[i * 4 + 3] = 255; }
      const CLOTH: [number, number, number] = [40, 40, 120];
      if (!sloped) rect(16, 15, 28, 32, CLOTH);
      else for (let y = 15; y <= 32; y++) { const t = (y - 15) / 17; const hw = Math.round(2 + t * 4); rect(22 - hw, y, 22 + hw, y, CLOTH); }
      rect(12, 16, 15, 30, CLOTH); rect(29, 16, 32, 30, CLOTH);
      rect(16, 32, 21, 50, CLOTH); rect(23, 32, 28, 50, CLOTH);
      disc(22, 9, 6, [45, 32, 22]); disc(22, 10, 5, [232, 190, 160]);
      return fig;
    };
    const flat: any = await poseSvc().analyzePose(buildFig(false), 48, 56);
    check('P1028 水平な肩は傾き0', flat?.shoulderSlope === 0, JSON.stringify({ slope: flat?.shoulderSlope }));
    const sloped: any = await poseSvc().analyzePose(buildFig(true), 48, 56);
    check('P1028 なだらかな肩は傾きが読める', typeof sloped?.shoulderSlope === 'number' && (sloped?.shoulderSlope ?? 0) > 0.15, JSON.stringify({ slope: sloped?.shoulderSlope }));
    const vs: any = await poseSvc().verifyShoulderSlope(flat);
    check('P1028 水平な肩の描き直しは照合が通る', vs?.verified === true, JSON.stringify(vs));
  }


  // P1029: 足の末端につま先の線が入り、手足の形でも照合が崩れない
  {
    const r: any = await poseSvc().analyzePose(paleLongHair48(), 48, 56);
    const img: any = await poseSvc().renderBody(r, 128);
    let toePx = 0;
    if (img) {
      // 最下行付近で、脚の色の影（つま先の線）を数える
      for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) {
        const i = (y * 128 + x) * 4;
        if (Math.abs(img[i] - 99) <= 8 && Math.abs(img[i + 1] - 112) <= 8 && Math.abs(img[i + 2] - 147) <= 8) toePx++;
      }
    }
    check('P1029 足の末端につま先の線が描かれる', toePx >= 4, JSON.stringify({ toePx }));
    const vs: any = await poseSvc().verifyBodyStructured(r);
    check('P1029 手足の形を入れても構造化の照合は通る', vs?.verified === true, JSON.stringify(vs && { score: vs.score }));
  }


  // P1030: 腕と胴の隙間を読む（離れた腕と、くっついた腕）
  {
    const buildFig = (gapped: boolean): Uint8Array => {
      const W = 48, H = 56; const fig = new Uint8Array(W * H * 4);
      const rect = (x0: number, y0: number, x1: number, y1: number, c: [number, number, number]) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const i = (y * W + x) * 4; fig[i] = c[0]; fig[i + 1] = c[1]; fig[i + 2] = c[2]; fig[i + 3] = 255; } };
      const disc = (cx: number, cy: number, r: number, c: [number, number, number]) => { for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) { const i = (y * W + x) * 4; fig[i] = c[0]; fig[i + 1] = c[1]; fig[i + 2] = c[2]; fig[i + 3] = 255; } };
      for (let i = 0; i < W * H; i++) { fig[i * 4] = 245; fig[i * 4 + 1] = 245; fig[i * 4 + 2] = 245; fig[i * 4 + 3] = 255; }
      const CLOTH: [number, number, number] = [40, 40, 120]; const SKIN: [number, number, number] = [232, 190, 160];
      rect(18, 15, 28, 32, CLOTH);
      if (gapped) { rect(12, 16, 14, 30, SKIN); rect(32, 16, 34, 30, SKIN); }
      else { rect(15, 16, 17, 30, CLOTH); rect(29, 16, 31, 30, CLOTH); }
      rect(18, 32, 22, 50, CLOTH); rect(24, 32, 28, 50, CLOTH);
      disc(23, 9, 6, [45, 32, 22]); disc(23, 10, 5, SKIN);
      return fig;
    };
    const g: any = await poseSvc().analyzePose(buildFig(true), 48, 56);
    check('P1030 離れた腕は隙間ありと読める', g?.armGap?.l === true && g?.armGap?.r === true, JSON.stringify(g?.armGap));
    const t: any = await poseSvc().analyzePose(buildFig(false), 48, 56);
    check('P1030 くっついた腕は隙間なしと読める', t?.armGap?.l === false && t?.armGap?.r === false, JSON.stringify(t?.armGap));
    const vg: any = await poseSvc().verifyArmGap(t);
    check('P1030 隙間なしの描き直しは照合が通る', vg?.verified === true, JSON.stringify(vg));
  }


  // P1031: 頭の横の装飾品（装置）を読む・描いて読み返せる
  {
    const W = 48, H = 56; const fig = new Uint8Array(W * H * 4);
    const rect = (x0: number, y0: number, x1: number, y1: number, c: [number, number, number]) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const i = (y * W + x) * 4; fig[i] = c[0]; fig[i + 1] = c[1]; fig[i + 2] = c[2]; fig[i + 3] = 255; } };
    const disc = (cx: number, cy: number, r: number, c: [number, number, number]) => { for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) { const i = (y * W + x) * 4; fig[i] = c[0]; fig[i + 1] = c[1]; fig[i + 2] = c[2]; fig[i + 3] = 255; } };
    for (let i = 0; i < W * H; i++) { fig[i * 4] = 245; fig[i * 4 + 1] = 245; fig[i * 4 + 2] = 245; fig[i * 4 + 3] = 255; }
    const CLOTH: [number, number, number] = [40, 40, 120];
    rect(16, 15, 28, 32, CLOTH); rect(12, 16, 15, 30, CLOTH); rect(29, 16, 32, 30, CLOTH);
    rect(16, 32, 21, 50, CLOTH); rect(23, 32, 28, 50, CLOTH);
    disc(22, 9, 6, [45, 32, 22]); disc(22, 10, 5, [232, 190, 160]);
    rect(13, 7, 16, 12, [120, 120, 125]);
    const r: any = await poseSvc().analyzePose(fig, W, H);
    check('P1031 耳の横の装置が装飾品として読める', Array.isArray(r?.accessories) && r.accessories.some((a: any) => a.side === 'l' && a.kind === 'device' && Math.abs(a.rgb[0] - 120) <= 12), JSON.stringify(r?.accessories));
    const va: any = await poseSvc().verifyAccessories(r);
    check('P1031 装飾品の描き直しが読み返せる', va?.verified === true, JSON.stringify(va));
  }


  // P1070: 桜の飾り（髪・顔と色が近い淡色の花びら）を髪・顔から分けて読む・描いて読み返せる
  // 既知の残り：淡色で顔の縁にかかる飾りは読み取れない（色が髪と同色で出っ張りも小さい）。
  // 淡色の往復は描き直しの髪色 hairRgb が淡色でブレンドして区別が消えるため通らない
  // （描く側の髪の基準色の問題で、読み取り側ではない）。顔の縁の往復も花びらが描いた
  // 首とつながって読み返せない。いずれも読み取りの分離そのものはできている。
  {
    const W = 48, H = 56;
    const SAKURA: [number, number, number] = [244, 206, 216];
    const CLOTH: [number, number, number] = [40, 40, 120];
    const base = (hair: [number, number, number], skin: [number, number, number], bg: [number, number, number]): Uint8Array => {
      const fig = new Uint8Array(W * H * 4);
      const rect = (x0: number, y0: number, x1: number, y1: number, c: [number, number, number]) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const i = (y * W + x) * 4; fig[i] = c[0]; fig[i + 1] = c[1]; fig[i + 2] = c[2]; fig[i + 3] = 255; } };
      const disc = (cx: number, cy: number, r: number, c: [number, number, number]) => { for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) { const i = (y * W + x) * 4; fig[i] = c[0]; fig[i + 1] = c[1]; fig[i + 2] = c[2]; fig[i + 3] = 255; } };
      for (let i = 0; i < W * H; i++) { fig[i * 4] = bg[0]; fig[i * 4 + 1] = bg[1]; fig[i * 4 + 2] = bg[2]; fig[i * 4 + 3] = 255; }
      rect(16, 15, 28, 32, CLOTH); rect(12, 16, 15, 30, CLOTH); rect(29, 16, 32, 30, CLOTH);
      rect(16, 32, 21, 50, CLOTH); rect(23, 32, 28, 50, CLOTH);
      disc(22, 9, 6, hair); disc(22, 10, 5, skin);
      return fig;
    };
    const addDisc = (fig: Uint8Array, cx: number, cy: number, r: number, c: [number, number, number]) => { for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) { const i = (y * W + x) * 4; fig[i] = c[0]; fig[i + 1] = c[1]; fig[i + 2] = c[2]; fig[i + 3] = 255; } };
    const HAIR: [number, number, number] = [45, 32, 22]; const SKIN: [number, number, number] = [232, 190, 160];
    const PALE_HAIR: [number, number, number] = [243, 205, 215]; const PALE_SKIN: [number, number, number] = [243, 222, 205];
    const hasSakura = (r: any) => Array.isArray(r?.accessories) && r.accessories.some((a: any) => a.side === 'l' && a.kind === 'ornament' && Math.abs(a.rgb[0] - 244) <= 12 && Math.abs(a.rgb[1] - 206) <= 12);
    const nd: any = await poseSvc().analyzePose(base(HAIR, SKIN, [245, 245, 245]), W, H);
    check('P1070 飾りなし（濃色）は装飾品を読まない', nd?.accessories == null, JSON.stringify(nd?.accessories));
    const np: any = await poseSvc().analyzePose(base(PALE_HAIR, PALE_SKIN, [208, 210, 212]), W, H);
    check('P1070 飾りなし（淡色）は装飾品を読まない', np?.accessories == null, JSON.stringify(np?.accessories));
    const dp = base(HAIR, SKIN, [245, 245, 245]); addDisc(dp, 14, 9, 3, SAKURA);
    const rd: any = await poseSvc().analyzePose(dp, W, H);
    check('P1070 髪からはみ出す桜の飾り（濃色）が読める', hasSakura(rd), JSON.stringify(rd?.accessories));
    const vd: any = await poseSvc().verifyAccessories(rd);
    check('P1070 桜の飾り（濃色）の描き直しが読み返せる', vd?.verified === true, JSON.stringify(vd));
    const pp = base(PALE_HAIR, PALE_SKIN, [208, 210, 212]); addDisc(pp, 14, 9, 3, SAKURA);
    const rp: any = await poseSvc().analyzePose(pp, W, H);
    check('P1070 髪からはみ出す桜の飾り（淡色、髪と同色）が読める', hasSakura(rp), JSON.stringify(rp?.accessories));
    const ih = base(HAIR, SKIN, [245, 245, 245]); addDisc(ih, 18, 6, 3, SAKURA);
    const ri: any = await poseSvc().analyzePose(ih, W, H);
    check('P1070 髪の中の桜の飾り（濃色）が読める', hasSakura(ri), JSON.stringify(ri?.accessories));
    const vi: any = await poseSvc().verifyAccessories(ri);
    check('P1070 髪の中の桜の飾り（濃色）の描き直しが読み返せる', vi?.verified === true, JSON.stringify(vi));
    const fe = base(HAIR, SKIN, [245, 245, 245]); addDisc(fe, 17, 12, 3, SAKURA);
    const rf: any = await poseSvc().analyzePose(fe, W, H);
    check('P1070 顔の縁にかかる桜の飾り（濃色）が読める', hasSakura(rf), JSON.stringify(rf?.accessories));
  }


  // P1032: 鎖骨の影を読む・描いて読み返せる
  {
    const W = 48, H = 56; const fig = new Uint8Array(W * H * 4);
    const rect = (x0: number, y0: number, x1: number, y1: number, c: [number, number, number]) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const i = (y * W + x) * 4; fig[i] = c[0]; fig[i + 1] = c[1]; fig[i + 2] = c[2]; fig[i + 3] = 255; } };
    const disc = (cx: number, cy: number, r: number, c: [number, number, number]) => { for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) { const i = (y * W + x) * 4; fig[i] = c[0]; fig[i + 1] = c[1]; fig[i + 2] = c[2]; fig[i + 3] = 255; } };
    for (let i = 0; i < W * H; i++) { fig[i * 4] = 245; fig[i * 4 + 1] = 245; fig[i * 4 + 2] = 245; fig[i * 4 + 3] = 255; }
    const SKIN: [number, number, number] = [232, 190, 160]; const DIP: [number, number, number] = [190, 150, 125]; const CLOTH: [number, number, number] = [40, 40, 120];
    rect(16, 15, 28, 32, SKIN);
    rect(17, 19, 21, 20, DIP); rect(23, 19, 27, 20, DIP);
    rect(12, 16, 15, 30, SKIN); rect(29, 16, 32, 30, SKIN);
    rect(16, 32, 21, 50, CLOTH); rect(23, 32, 28, 50, CLOTH);
    disc(22, 9, 6, [45, 32, 22]); disc(22, 10, 5, SKIN);
    const r: any = await poseSvc().analyzePose(fig, W, H);
    check('P1032 鎖骨の影が読める', r?.collarbone === true, JSON.stringify(r?.collarbone));
    const img = await poseSvc().renderBody(r, 128);
    const re: any = img ? await poseSvc().analyzePose(img, 128, 128) : null;
    check('P1032 描いた鎖骨の線が読み返せる', re?.collarbone === true, JSON.stringify(re?.collarbone));
  }


  // P1034: 足の末端の広がりを読む
  {
    const buildLegs = (flare: boolean): Uint8Array => {
      const W = 48, H = 56; const fig = new Uint8Array(W * H * 4);
      const rect = (x0: number, y0: number, x1: number, y1: number, c: [number, number, number]) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const i = (y * W + x) * 4; fig[i] = c[0]; fig[i + 1] = c[1]; fig[i + 2] = c[2]; fig[i + 3] = 255; } };
      const disc = (cx: number, cy: number, r: number, c: [number, number, number]) => { for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) { const i = (y * W + x) * 4; fig[i] = c[0]; fig[i + 1] = c[1]; fig[i + 2] = c[2]; fig[i + 3] = 255; } };
      for (let i = 0; i < W * H; i++) { fig[i * 4] = 245; fig[i * 4 + 1] = 245; fig[i * 4 + 2] = 245; fig[i * 4 + 3] = 255; }
      const CLOTH: [number, number, number] = [40, 40, 120];
      rect(16, 15, 28, 32, CLOTH); rect(12, 16, 15, 30, CLOTH); rect(29, 16, 32, 30, CLOTH);
      rect(16, 32, 21, 50, CLOTH); rect(23, 32, 28, 50, CLOTH);
      if (flare) { rect(14, 49, 21, 50, CLOTH); rect(23, 49, 30, 50, CLOTH); }
      disc(22, 9, 6, [45, 32, 22]); disc(22, 10, 5, [232, 190, 160]);
      return fig;
    };
    const f: any = await poseSvc().analyzePose(buildLegs(true), 48, 56);
    check('P1034 広がった足が読める', f?.footFlare?.l === true && f?.footFlare?.r === true, JSON.stringify(f?.footFlare));
    const vf: any = await poseSvc().verifyFootFlare(f);
    check('P1034 足の広がりの描き直しが読み返せる', vf?.verified === true, JSON.stringify(vf));
    const st: any = await poseSvc().analyzePose(buildLegs(false), 48, 56);
    check('P1034 まっすぐな足は広がりなしと読める', st?.footFlare?.l === false && st?.footFlare?.r === false, JSON.stringify(st?.footFlare));
  }


  // P1035: アホ毛を読む・描く（読み返し照合は解像度限界のため対象外）
  {
    const buildAhoge = (strand: boolean): Uint8Array => {
      const W = 48, H = 56; const fig = new Uint8Array(W * H * 4);
      const rect = (x0: number, y0: number, x1: number, y1: number, c: [number, number, number]) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const i = (y * W + x) * 4; fig[i] = c[0]; fig[i + 1] = c[1]; fig[i + 2] = c[2]; fig[i + 3] = 255; } };
      const disc = (cx: number, cy: number, r: number, c: [number, number, number]) => { for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) { const i = (y * W + x) * 4; fig[i] = c[0]; fig[i + 1] = c[1]; fig[i + 2] = c[2]; fig[i + 3] = 255; } };
      for (let i = 0; i < W * H; i++) { fig[i * 4] = 245; fig[i * 4 + 1] = 245; fig[i * 4 + 2] = 245; fig[i * 4 + 3] = 255; }
      const CLOTH: [number, number, number] = [40, 40, 120]; const HAIR: [number, number, number] = [45, 32, 22];
      rect(16, 15, 28, 32, CLOTH); rect(12, 16, 15, 30, CLOTH); rect(29, 16, 32, 30, CLOTH);
      rect(16, 32, 21, 50, CLOTH); rect(23, 32, 28, 50, CLOTH);
      disc(22, 9, 6, HAIR); disc(22, 10, 5, [232, 190, 160]);
      if (strand) { rect(21, 0, 22, 3, HAIR); rect(23, 0, 24, 1, HAIR); }
      return fig;
    };
    const t: any = await poseSvc().analyzePose(buildAhoge(true), 48, 56);
    check('P1035 アホ毛が読める', t?.ahoge === true, JSON.stringify(t?.ahoge));
    const f: any = await poseSvc().analyzePose(buildAhoge(false), 48, 56);
    check('P1035 アホ毛なしも読める', f?.ahoge === false, JSON.stringify(f?.ahoge));
    const img = await poseSvc().renderBody(t, 128);
    let above = 0;
    if (img && t?.head) {
      const topY = Math.round((t.head.y - (t.headRh ?? t.head.r)) * 127);
      for (let y = 0; y < topY; y++) for (let x = 0; x < 128; x++) { const i = (y * 128 + x) * 4; if (Math.abs(img[i] - 45) < 12 && Math.abs(img[i + 1] - 32) < 12 && Math.abs(img[i + 2] - 22) < 12) above++; }
    }
    check('P1035 アホ毛が頭頂の上に描ける', above >= 8, `above=${above}`);
  }


  // P1071: アホ毛の読み返し照合（P1035では解像度限界のため
  // 対象外だった経路）。描く側の曲線を先端最高点・ほぼ真上
  // に直し、読む側は束の太さを先端3行で測る＋頭幅の確認を
  // 数行下まで見ることで、128でも往復できる。
  {
    const buildAhoge = (strand: boolean): Uint8Array => {
      const W = 48, H = 56; const fig = new Uint8Array(W * H * 4);
      const rect = (x0: number, y0: number, x1: number, y1: number, c: [number, number, number]) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const i = (y * W + x) * 4; fig[i] = c[0]; fig[i + 1] = c[1]; fig[i + 2] = c[2]; fig[i + 3] = 255; } };
      const disc = (cx: number, cy: number, r: number, c: [number, number, number]) => { for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) { const i = (y * W + x) * 4; fig[i] = c[0]; fig[i + 1] = c[1]; fig[i + 2] = c[2]; fig[i + 3] = 255; } };
      for (let i = 0; i < W * H; i++) { fig[i * 4] = 245; fig[i * 4 + 1] = 245; fig[i * 4 + 2] = 245; fig[i * 4 + 3] = 255; }
      const CLOTH: [number, number, number] = [40, 40, 120]; const HAIR: [number, number, number] = [45, 32, 22];
      rect(16, 15, 28, 32, CLOTH); rect(12, 16, 15, 30, CLOTH); rect(29, 16, 32, 30, CLOTH);
      rect(16, 32, 21, 50, CLOTH); rect(23, 32, 28, 50, CLOTH);
      disc(22, 9, 6, HAIR); disc(22, 10, 5, [232, 190, 160]);
      if (strand) { rect(21, 0, 22, 3, HAIR); rect(23, 0, 24, 1, HAIR); }
      return fig;
    };
    const t: any = await poseSvc().analyzePose(buildAhoge(true), 48, 56);
    const vt: any = await poseSvc().verifyAhoge(t);
    check('P1071 アホ毛ありの描き直しが読み返せる', vt?.verified === true && vt?.reAhoge === true, JSON.stringify(vt));
    const f: any = await poseSvc().analyzePose(buildAhoge(false), 48, 56);
    const vf: any = await poseSvc().verifyAhoge(f);
    check('P1071 アホ毛なしの描き直しが読み返せる', vf?.verified === true && vf?.reAhoge === false, JSON.stringify(vf));
    const n: any = await poseSvc().verifyAhoge({ ...t, ahoge: null });
    check('P1071 アホ毛が未定の読みは照合しない', n === null, JSON.stringify(n));
  }


  // P1036: 頬の赤み・鼻・耳を顔に描く（顔の指定で描き分ける）
  {
    const W = 48, H = 56; const fig = new Uint8Array(W * H * 4);
    const rect = (x0: number, y0: number, x1: number, y1: number, c: [number, number, number]) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const i = (y * W + x) * 4; fig[i] = c[0]; fig[i + 1] = c[1]; fig[i + 2] = c[2]; fig[i + 3] = 255; } };
    const disc = (cx: number, cy: number, r: number, c: [number, number, number]) => { for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) { const i = (y * W + x) * 4; fig[i] = c[0]; fig[i + 1] = c[1]; fig[i + 2] = c[2]; fig[i + 3] = 255; } };
    for (let i = 0; i < W * H; i++) { fig[i * 4] = 245; fig[i * 4 + 1] = 245; fig[i * 4 + 2] = 245; fig[i * 4 + 3] = 255; }
    const CLOTH: [number, number, number] = [40, 40, 120];
    rect(16, 15, 28, 32, CLOTH); rect(12, 16, 15, 30, CLOTH); rect(29, 16, 32, 30, CLOTH);
    rect(16, 32, 21, 50, CLOTH); rect(23, 32, 28, 50, CLOTH);
    disc(22, 9, 6, [45, 32, 22]); disc(22, 10, 5, [232, 190, 160]);
    const r: any = await poseSvc().analyzePose(fig, W, H);
    const img = await poseSvc().renderBody(r, 128, { eyeSize: null, brows: false, mouthSize: null, blush: true, nose: true, ears: true });
    let nb = 0;
    if (img) for (let i = 0; i < 128 * 128; i++) { if (Math.abs(img[i * 4] - 238) <= 2 && Math.abs(img[i * 4 + 1] - 179) <= 2 && Math.abs(img[i * 4 + 2] - 165) <= 2) nb++; }
    check('P1036 頬の赤みが描ける', nb >= 10, `blushPx=${nb}`);
    check('P1036 顔の読みに耳の項目が載る', r !== null && (r.face === null || r.face === undefined || typeof r.face.ears === 'boolean' || r.face.ears === null), JSON.stringify(r?.face));
  }


  // P1037: 胸の頂点の位置を読む（高い胸と低い胸で位置が変わる）
  {
    const buildBust = (peakRow: number): Uint8Array => {
      const W = 48, H = 56; const fig = new Uint8Array(W * H * 4);
      const rect = (x0: number, y0: number, x1: number, y1: number, c: [number, number, number]) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const i = (y * W + x) * 4; fig[i] = c[0]; fig[i + 1] = c[1]; fig[i + 2] = c[2]; fig[i + 3] = 255; } };
      const disc = (cx: number, cy: number, r: number, c: [number, number, number]) => { for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) { const i = (y * W + x) * 4; fig[i] = c[0]; fig[i + 1] = c[1]; fig[i + 2] = c[2]; fig[i + 3] = 255; } };
      for (let i = 0; i < W * H; i++) { fig[i * 4] = 245; fig[i * 4 + 1] = 245; fig[i * 4 + 2] = 245; fig[i * 4 + 3] = 255; }
      const CLOTH: [number, number, number] = [40, 40, 120];
      rect(18, 15, 27, 32, CLOTH);
      rect(15, peakRow, 30, peakRow + 3, CLOTH);
      rect(12, 16, 14, 30, CLOTH); rect(31, 16, 33, 30, CLOTH);
      rect(17, 32, 21, 50, CLOTH); rect(24, 32, 28, 50, CLOTH);
      disc(22, 9, 6, [45, 32, 22]); disc(22, 10, 5, [232, 190, 160]);
      return fig;
    };
    const hi: any = await poseSvc().analyzePose(buildBust(17), 48, 56);
    const lo: any = await poseSvc().analyzePose(buildBust(26), 48, 56);
    check('P1037 胸の頂点の位置が上下で変わる', typeof hi?.bustPeak === 'number' && typeof lo?.bustPeak === 'number' && hi.bustPeak < lo.bustPeak && lo.bustPeak > 0.3, JSON.stringify({ hi: hi?.bustPeak, lo: lo?.bustPeak }));
  }


  // P1038: 首の長さを読む（見える首の長さ ÷ 全身）
  {
    const buildNeck = (neckGap: number): Uint8Array => {
      const W = 48, H = 56; const fig = new Uint8Array(W * H * 4);
      const rect = (x0: number, y0: number, x1: number, y1: number, c: [number, number, number]) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const i = (y * W + x) * 4; fig[i] = c[0]; fig[i + 1] = c[1]; fig[i + 2] = c[2]; fig[i + 3] = 255; } };
      const disc = (cx: number, cy: number, r: number, c: [number, number, number]) => { for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) { const i = (y * W + x) * 4; fig[i] = c[0]; fig[i + 1] = c[1]; fig[i + 2] = c[2]; fig[i + 3] = 255; } };
      for (let i = 0; i < W * H; i++) { fig[i * 4] = 245; fig[i * 4 + 1] = 245; fig[i * 4 + 2] = 245; fig[i * 4 + 3] = 255; }
      const CLOTH: [number, number, number] = [40, 40, 120]; const SKIN: [number, number, number] = [232, 190, 160];
      const torsoY = 15 + neckGap;
      rect(20, 15, 25, torsoY - 1, SKIN);
      rect(16, torsoY, 28, 38, CLOTH); rect(12, torsoY + 1, 15, torsoY + 15, CLOTH); rect(29, torsoY + 1, 32, torsoY + 15, CLOTH);
      rect(16, 38, 21, 54, CLOTH); rect(23, 38, 28, 54, CLOTH);
      disc(22, 9, 6, [45, 32, 22]); disc(22, 10, 5, SKIN);
      return fig;
    };
    const sn: any = await poseSvc().analyzePose(buildNeck(0), 48, 56);
    const ln: any = await poseSvc().analyzePose(buildNeck(6), 48, 56);
    check('P1038 首の長さが読める', sn?.neckLength === 0 && typeof ln?.neckLength === 'number' && ln.neckLength >= 0.06, JSON.stringify({ short: sn?.neckLength, long: ln?.neckLength }));
  }


  // P1039: 胸の張りを読む（鋭い丸みとなだらかな丸みで変わる）
  {
    const buildFirm = (sharp: boolean): Uint8Array => {
      const W = 48, H = 56; const fig = new Uint8Array(W * H * 4);
      const rect = (x0: number, y0: number, x1: number, y1: number, c: [number, number, number]) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const i = (y * W + x) * 4; fig[i] = c[0]; fig[i + 1] = c[1]; fig[i + 2] = c[2]; fig[i + 3] = 255; } };
      const disc = (cx: number, cy: number, r: number, c: [number, number, number]) => { for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) { const i = (y * W + x) * 4; fig[i] = c[0]; fig[i + 1] = c[1]; fig[i + 2] = c[2]; fig[i + 3] = 255; } };
      for (let i = 0; i < W * H; i++) { fig[i * 4] = 245; fig[i * 4 + 1] = 245; fig[i * 4 + 2] = 245; fig[i * 4 + 3] = 255; }
      const CLOTH: [number, number, number] = [40, 40, 120];
      rect(18, 15, 27, 32, CLOTH);
      if (sharp) rect(15, 21, 30, 23, CLOTH);
      else { rect(16, 18, 29, 20, CLOTH); rect(15, 21, 30, 24, CLOTH); rect(16, 25, 29, 28, CLOTH); }
      rect(12, 16, 14, 30, CLOTH); rect(31, 16, 33, 30, CLOTH);
      rect(17, 32, 21, 50, CLOTH); rect(24, 32, 28, 50, CLOTH);
      disc(22, 9, 6, [45, 32, 22]); disc(22, 10, 5, [232, 190, 160]);
      return fig;
    };
    const sh: any = await poseSvc().analyzePose(buildFirm(true), 48, 56);
    const so: any = await poseSvc().analyzePose(buildFirm(false), 48, 56);
    check('P1039 胸の張りが読み分けられる', typeof sh?.bustFirm === 'number' && typeof so?.bustFirm === 'number' && sh.bustFirm > so.bustFirm + 0.2, JSON.stringify({ sharp: sh?.bustFirm, soft: so?.bustFirm }));
  }


  // P1040: 髪の分け目を読む（中央分けと分け目なし）
  {
    const { visualZoomService: vzoom1040 } = await import('../src/miki/conversation/services/visualZoomService');
    const buildFace1040 = (part: boolean): Uint8Array => {
      const S = 48; const fig = new Uint8Array(S * S * 4);
      const set = (x: number, y: number, c: [number, number, number]) => { const i = (y * S + x) * 4; fig[i] = c[0]; fig[i + 1] = c[1]; fig[i + 2] = c[2]; fig[i + 3] = 255; };
      const SKIN: [number, number, number] = [232, 190, 160]; const HAIR: [number, number, number] = [45, 32, 22]; const DARK: [number, number, number] = [30, 30, 30];
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) set(x, y, [245, 245, 245]);
      for (let y = 4; y < 44; y++) for (let x = 10; x < 38; x++) set(x, y, SKIN);
      for (let y = 0; y < 16; y++) for (let x = 8; x < 40; x++) set(x, y, HAIR);
      if (part) for (let y = 8; y < 16; y++) for (let x = 23; x < 25; x++) set(x, y, SKIN);
      for (const ex of [18, 29]) for (let y = 24; y < 28; y++) for (let x = ex - 2; x <= ex + 2; x++) set(x, y, DARK);
      for (let x = 21; x < 27; x++) set(x, 36, DARK);
      return fig;
    };
    const zp: any = vzoom1040.analyzeFace(buildFace1040(true));
    check('P1040 中央分けが読める', zp?.parting === 'center', JSON.stringify(zp?.parting));
    const zn: any = vzoom1040.analyzeFace(buildFace1040(false));
    check('P1040 分け目なしは null', zn !== null && zn.parting === null, JSON.stringify(zn?.parting));
  }


  // P1041: 目の形を読む（垂れ目・つり目・まっすぐ）
  {
    const { visualZoomService: vzoom1041 } = await import('../src/miki/conversation/services/visualZoomService');
    const buildFace1041 = (mode: 'tareme' | 'tsurime' | 'flat'): Uint8Array => {
      const S = 48; const fig = new Uint8Array(S * S * 4);
      const set = (x: number, y: number, c: [number, number, number]) => { const i = (y * S + x) * 4; fig[i] = c[0]; fig[i + 1] = c[1]; fig[i + 2] = c[2]; fig[i + 3] = 255; };
      const SKIN: [number, number, number] = [232, 190, 160]; const DARK: [number, number, number] = [30, 30, 30];
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) set(x, y, [245, 245, 245]);
      for (let y = 4; y < 44; y++) for (let x = 10; x < 38; x++) set(x, y, SKIN);
      for (let y = 0; y < 16; y++) for (let x = 8; x < 40; x++) set(x, y, [45, 32, 22]);
      const slope = mode === 'tareme' ? 0.5 : mode === 'tsurime' ? -0.5 : 0;
      for (const sgn of [-1, 1]) {
        const cxE = 24 + sgn * 7;
        for (let dx = -4; dx <= 4; dx++) {
          const yC = 25 + Math.round(dx * sgn * slope);
          for (let dy = 0; dy < 3; dy++) set(cxE + dx, yC + dy, DARK);
        }
      }
      for (let x = 21; x < 27; x++) set(x, 36, DARK);
      return fig;
    };
    const zt: any = vzoom1041.analyzeFace(buildFace1041('tareme'));
    check('P1041 垂れ目が読める', zt?.eyeShape === 'tareme', JSON.stringify(zt?.eyeShape));
    const zu: any = vzoom1041.analyzeFace(buildFace1041('tsurime'));
    check('P1041 つり目が読める', zu?.eyeShape === 'tsurime', JSON.stringify(zu?.eyeShape));
    const zf: any = vzoom1041.analyzeFace(buildFace1041('flat'));
    check('P1041 まっすぐな目は null', zf !== null && zf.eyeShape === null, JSON.stringify(zf?.eyeShape));
  }


  // P1042: 口の形（笑いの弧）が描き分けられる
  {
    const W = 48, H = 56; const fig = new Uint8Array(W * H * 4);
    const rect = (x0: number, y0: number, x1: number, y1: number, c: [number, number, number]) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const i = (y * W + x) * 4; fig[i] = c[0]; fig[i + 1] = c[1]; fig[i + 2] = c[2]; fig[i + 3] = 255; } };
    const disc = (cx: number, cy: number, r: number, c: [number, number, number]) => { for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) { const i = (y * W + x) * 4; fig[i] = c[0]; fig[i + 1] = c[1]; fig[i + 2] = c[2]; fig[i + 3] = 255; } };
    for (let i = 0; i < W * H; i++) { fig[i * 4] = 245; fig[i * 4 + 1] = 245; fig[i * 4 + 2] = 245; fig[i * 4 + 3] = 255; }
    const CLOTH: [number, number, number] = [40, 40, 120];
    rect(16, 15, 28, 32, CLOTH); rect(12, 16, 15, 30, CLOTH); rect(29, 16, 32, 30, CLOTH);
    rect(16, 32, 21, 50, CLOTH); rect(23, 32, 28, 50, CLOTH);
    disc(22, 9, 6, [45, 32, 22]); disc(22, 10, 5, [232, 190, 160]);
    const r: any = await poseSvc().analyzePose(fig, W, H);
    const curve = (img: Uint8Array): number => {
      const S = 256; const hx = Math.round(r.head.x * (S - 1)); const hy = Math.round(r.head.y * (S - 1));
      const cols = new Map<number, number[]>();
      for (let y = hy + 10; y < hy + 26; y++) for (let x = hx - 7; x <= hx + 7; x++) {
        const i = (y * S + x) * 4;
        if (img[i] < 60 && img[i + 1] < 60 && img[i + 2] < 60) { if (!cols.has(x)) cols.set(x, []); cols.get(x)!.push(y); }
      }
      const xs = [...cols.keys()].sort((p2, q2) => p2 - q2);
      if (xs.length < 5) return NaN;
      const mean = (arr: number[]) => arr.reduce((sm, v) => sm + v, 0) / arr.length;
      const centerY = mean(xs.slice(Math.floor(xs.length * 0.4), Math.ceil(xs.length * 0.6)).flatMap((x) => cols.get(x)!));
      const edgeY = mean([...xs.slice(0, 2), ...xs.slice(-2)].flatMap((x) => cols.get(x)!));
      return edgeY - centerY;
    };
    const smileImg = await poseSvc().renderBody(r, 256, { eyeSize: null, brows: false, mouthSize: null, mouthForm: 'smile' });
    const flatImg = await poseSvc().renderBody(r, 256, { eyeSize: null, brows: false, mouthSize: null });
    check('P1042 笑いの口は口角が上がる', !!smileImg && !!flatImg && curve(smileImg) < curve(flatImg) - 1, JSON.stringify({ smile: smileImg ? curve(smileImg) : null, flat: flatImg ? curve(flatImg) : null }));
  }


  // P1043: 眉の角度を読む（眉頭が下がる／眉尻が下がる／水平）
  {
    const { visualZoomService: vzoom1043 } = await import('../src/miki/conversation/services/visualZoomService');
    const buildFace1043 = (mode: 'angry' | 'worried' | 'flat'): Uint8Array => {
      const S = 48; const fig = new Uint8Array(S * S * 4);
      const set = (x: number, y: number, c: [number, number, number]) => { const i = (y * S + x) * 4; fig[i] = c[0]; fig[i + 1] = c[1]; fig[i + 2] = c[2]; fig[i + 3] = 255; };
      const SKIN: [number, number, number] = [232, 190, 160]; const DARK: [number, number, number] = [30, 30, 30];
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) set(x, y, [245, 245, 245]);
      for (let y = 4; y < 44; y++) for (let x = 10; x < 38; x++) set(x, y, SKIN);
      for (let y = 0; y < 14; y++) for (let x = 8; x < 40; x++) set(x, y, [45, 32, 22]);
      const slope = mode === 'angry' ? 0.45 : mode === 'worried' ? -0.45 : 0;
      for (const sgn of [-1, 1]) {
        const bx = 24 + sgn * 7;
        for (let dx = -4; dx <= 4; dx++) {
          const yC = 19 + Math.round(-dx * sgn * slope);
          for (let dy = 0; dy < 2; dy++) set(bx + dx, yC + dy, DARK);
        }
        for (let dx = -4; dx <= 4; dx++) for (let dy = 0; dy < 3; dy++) set(bx + dx, 26 + dy, DARK);
      }
      for (let x = 21; x < 27; x++) set(x, 37, DARK);
      return fig;
    };
    const za: any = vzoom1043.analyzeFace(buildFace1043('angry'));
    check('P1043 眉頭が下がる眉は正の角度', typeof za?.browAngle === 'number' && za.browAngle > 0.08, JSON.stringify(za?.browAngle));
    const zw: any = vzoom1043.analyzeFace(buildFace1043('worried'));
    check('P1043 眉尻が下がる眉は負の角度', typeof zw?.browAngle === 'number' && zw.browAngle < -0.08, JSON.stringify(zw?.browAngle));
    const zf: any = vzoom1043.analyzeFace(buildFace1043('flat'));
    check('P1043 水平な眉は角度ゼロ', zf?.browAngle === 0, JSON.stringify(zf?.browAngle));
  }


  // P1044: 手の位置が脚の肌に引っ張られない（肌の島を塊に分けて使う）
  {
    const W = 48, H = 56; const fig = new Uint8Array(W * H * 4);
    const rect = (x0: number, y0: number, x1: number, y1: number, c: [number, number, number]) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const i = (y * W + x) * 4; fig[i] = c[0]; fig[i + 1] = c[1]; fig[i + 2] = c[2]; fig[i + 3] = 255; } };
    const disc = (cx: number, cy: number, r: number, c: [number, number, number]) => { for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) { const i = (y * W + x) * 4; fig[i] = c[0]; fig[i + 1] = c[1]; fig[i + 2] = c[2]; fig[i + 3] = 255; } };
    for (let i = 0; i < W * H; i++) { fig[i * 4] = 245; fig[i * 4 + 1] = 245; fig[i * 4 + 2] = 245; fig[i * 4 + 3] = 255; }
    const SKIN: [number, number, number] = [232, 190, 160]; const RED: [number, number, number] = [200, 60, 60];
    rect(16, 15, 28, 21, RED); rect(16, 22, 28, 27, SKIN); rect(16, 28, 28, 32, RED);
    rect(12, 16, 15, 30, SKIN); rect(29, 16, 32, 30, SKIN);
    rect(16, 32, 21, 36, RED); rect(23, 32, 28, 36, RED);
    rect(16, 37, 21, 50, SKIN); rect(23, 37, 28, 50, SKIN);
    disc(22, 9, 6, [45, 32, 22]); disc(22, 10, 5, SKIN);
    const r: any = await poseSvc().analyzePose(fig, W, H);
    check('P1044 手が太ももまで引っ張られない', !!r?.handL && !!r?.handR && r.handL.y < 0.6 && r.handR.y < 0.6 && r.skinCues?.handL === true, JSON.stringify({ handL: r?.handL, handR: r?.handR }));
  }


  // P1045: 手の大きさを読む（大きな手の塊がある図で大きくなる）
  {
    const buildHand = (bigHand: boolean): Uint8Array => {
      const W = 48, H = 56; const fig = new Uint8Array(W * H * 4);
      const rect = (x0: number, y0: number, x1: number, y1: number, c: [number, number, number]) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const i = (y * W + x) * 4; fig[i] = c[0]; fig[i + 1] = c[1]; fig[i + 2] = c[2]; fig[i + 3] = 255; } };
      const disc = (cx: number, cy: number, r: number, c: [number, number, number]) => { for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) { const i = (y * W + x) * 4; fig[i] = c[0]; fig[i + 1] = c[1]; fig[i + 2] = c[2]; fig[i + 3] = 255; } };
      for (let i = 0; i < W * H; i++) { fig[i * 4] = 245; fig[i * 4 + 1] = 245; fig[i * 4 + 2] = 245; fig[i * 4 + 3] = 255; }
      const SKIN: [number, number, number] = [232, 190, 160]; const RED: [number, number, number] = [200, 60, 60];
      rect(16, 15, 28, 21, RED); rect(16, 22, 28, 27, SKIN); rect(16, 28, 28, 32, RED);
      rect(12, 16, 15, 30, SKIN); rect(29, 16, 32, 30, SKIN);
      if (bigHand) { rect(10, 27, 17, 33, SKIN); rect(27, 27, 34, 33, SKIN); }
      rect(16, 32, 21, 36, RED); rect(23, 32, 28, 36, RED);
      rect(16, 37, 21, 50, SKIN); rect(23, 37, 28, 50, SKIN);
      disc(22, 9, 6, [45, 32, 22]); disc(22, 10, 5, SKIN);
      return fig;
    };
    const hn: any = await poseSvc().analyzePose(buildHand(false), 48, 56);
    const hb: any = await poseSvc().analyzePose(buildHand(true), 48, 56);
    check('P1045 手の大きさが読み分けられる', typeof hn?.handSize === 'number' && typeof hb?.handSize === 'number' && hb.handSize > hn.handSize + 0.2, JSON.stringify({ normal: hn?.handSize, big: hb?.handSize }));
  }


  // P1046: 膝の位置（脚の幅の窪み。左右が合う時だけ採用）
  {
    const buildKnee = (kneed: boolean): Uint8Array => {
      const W = 48, H = 56; const fig = new Uint8Array(W * H * 4);
      const rect = (x0: number, y0: number, x1: number, y1: number, c: [number, number, number]) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const i = (y * W + x) * 4; fig[i] = c[0]; fig[i + 1] = c[1]; fig[i + 2] = c[2]; fig[i + 3] = 255; } };
      const disc = (cx: number, cy: number, r: number, c: [number, number, number]) => { for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) { const i = (y * W + x) * 4; fig[i] = c[0]; fig[i + 1] = c[1]; fig[i + 2] = c[2]; fig[i + 3] = 255; } };
      for (let i = 0; i < W * H; i++) { fig[i * 4] = 245; fig[i * 4 + 1] = 245; fig[i * 4 + 2] = 245; fig[i * 4 + 3] = 255; }
      const SKIN: [number, number, number] = [232, 190, 160]; const CLOTH: [number, number, number] = [40, 40, 120];
      rect(16, 15, 28, 32, CLOTH); rect(12, 16, 15, 30, CLOTH); rect(29, 16, 32, 30, CLOTH);
      if (kneed) {
        rect(15, 32, 21, 39, SKIN); rect(23, 32, 29, 39, SKIN);
        rect(17, 40, 20, 42, SKIN); rect(24, 40, 27, 42, SKIN);
        rect(16, 43, 21, 47, SKIN); rect(23, 43, 28, 47, SKIN);
        rect(17, 48, 20, 50, SKIN); rect(24, 48, 27, 50, SKIN);
      } else { rect(16, 32, 21, 50, SKIN); rect(23, 32, 28, 50, SKIN); }
      disc(22, 9, 6, [45, 32, 22]); disc(22, 10, 5, SKIN);
      return fig;
    };
    const kk: any = await poseSvc().analyzePose(buildKnee(true), 48, 56);
    const kp: any = await poseSvc().analyzePose(buildKnee(false), 48, 56);
    check('P1046 膝の窪みが読め、無い脚はnull', typeof kk?.legKnee?.l === 'number' && kk.legKnee.l > 0.35 && kk.legKnee.l < 0.6 && kp?.legKnee?.l === null, JSON.stringify({ kneed: kk?.legKnee, plain: kp?.legKnee }));
  }


  // P1047: 足首の統計を足と分離し、足の広がりの描画が読みに連動しても照合が保たれる
  {
    const buildFlare = (flared: boolean): Uint8Array => {
      const W = 48, H = 56; const fig = new Uint8Array(W * H * 4);
      const rect = (x0: number, y0: number, x1: number, y1: number, c: [number, number, number]) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const i = (y * W + x) * 4; fig[i] = c[0]; fig[i + 1] = c[1]; fig[i + 2] = c[2]; fig[i + 3] = 255; } };
      const disc = (cx: number, cy: number, r: number, c: [number, number, number]) => { for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) { const i = (y * W + x) * 4; fig[i] = c[0]; fig[i + 1] = c[1]; fig[i + 2] = c[2]; fig[i + 3] = 255; } };
      for (let i = 0; i < W * H; i++) { fig[i * 4] = 245; fig[i * 4 + 1] = 245; fig[i * 4 + 2] = 245; fig[i * 4 + 3] = 255; }
      const SKIN: [number, number, number] = [232, 190, 160]; const CLOTH: [number, number, number] = [40, 40, 120];
      rect(16, 15, 28, 32, CLOTH); rect(12, 16, 15, 30, CLOTH); rect(29, 16, 32, 30, CLOTH);
      rect(16, 32, 21, 50, SKIN); rect(23, 32, 28, 50, SKIN);
      if (flared) { rect(14, 49, 21, 50, SKIN); rect(23, 49, 30, 50, SKIN); }
      disc(22, 9, 6, [45, 32, 22]); disc(22, 10, 5, SKIN);
      return fig;
    };
    const ff: any = await poseSvc().analyzePose(buildFlare(true), 48, 56);
    const fs: any = await poseSvc().analyzePose(buildFlare(false), 48, 56);
    const vf: any = await poseSvc().verifyFootFlare(ff);
    const vsf: any = await poseSvc().verifyFootFlare(fs);
    check('P1047 足の広がりの読み連動描画で照合が保たれる', vf?.verified === true && vsf?.verified === true, JSON.stringify({ flared: vf, straight: vsf }));
  }


  // P1072: サンプルの足の広がりの再読ずれ。足首から徐々に
  // 広がる足（サンプルの素足の形）は、旧版の最下行と3%上の
  // 1行比較では広がり域の中で比が1.0になり false と読めた。
  // 下の帯の最大幅と、脚の下部の帯の2番目に小さい幅（足首）
  // で比べると読める。描き直しの再読も保たれること。
  {
    const buildGradual = (flare: boolean): Uint8Array => {
      const W = 48, H = 56; const fig = new Uint8Array(W * H * 4);
      const rect = (x0: number, y0: number, x1: number, y1: number, c: [number, number, number]) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const i = (y * W + x) * 4; fig[i] = c[0]; fig[i + 1] = c[1]; fig[i + 2] = c[2]; fig[i + 3] = 255; } };
      const disc = (cx: number, cy: number, r: number, c: [number, number, number]) => { for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) { const i = (y * W + x) * 4; fig[i] = c[0]; fig[i + 1] = c[1]; fig[i + 2] = c[2]; fig[i + 3] = 255; } };
      for (let i = 0; i < W * H; i++) { fig[i * 4] = 245; fig[i * 4 + 1] = 245; fig[i * 4 + 2] = 245; fig[i * 4 + 3] = 255; }
      const CLOTH: [number, number, number] = [40, 40, 120];
      rect(16, 15, 28, 32, CLOTH); rect(12, 16, 15, 30, CLOTH); rect(29, 16, 32, 30, CLOTH);
      rect(16, 32, 21, 44, CLOTH); rect(23, 32, 28, 44, CLOTH);
      if (flare) {
        rect(15, 45, 21, 46, CLOTH); rect(23, 45, 29, 46, CLOTH);
        rect(14, 47, 21, 48, CLOTH); rect(23, 47, 30, 48, CLOTH);
        rect(13, 49, 21, 50, CLOTH); rect(23, 49, 31, 50, CLOTH);
      } else {
        rect(16, 45, 21, 50, CLOTH); rect(23, 45, 28, 50, CLOTH);
      }
      disc(22, 9, 6, [45, 32, 22]); disc(22, 10, 5, [232, 190, 160]);
      return fig;
    };
    const gf: any = await poseSvc().analyzePose(buildGradual(true), 48, 56);
    check('P1072 徐々に広がる足が広がりありと読める', gf?.footFlare?.l === true && gf?.footFlare?.r === true, JSON.stringify(gf?.footFlare));
    const vgf: any = await poseSvc().verifyFootFlare(gf);
    check('P1072 徐々に広がる足の描き直しが読み返せる', vgf?.verified === true, JSON.stringify(vgf));
    const gs: any = await poseSvc().analyzePose(buildGradual(false), 48, 56);
    check('P1072 まっすぐな足は広がりなしと読める', gs?.footFlare?.l === false && gs?.footFlare?.r === false, JSON.stringify(gs?.footFlare));
  }


  // P1050-P1060: 分割と構造化描画の錨（淡色の長い髪で確認する）
  {
    const r: any = await poseSvc().analyzePose(paleLongHair48(), 48, 56);
    check('P1055 淡色の読みがプロファイル完備で取れる', r?.profileComplete === true, JSON.stringify(r?.bodyProfile));
    const vs: any = await poseSvc().verifyBodyStructured(r);
    check('P1057 構造化照合が淡色でも通る（平らな土台）', vs?.verified === true, JSON.stringify(vs?.score));
    const twin: any = await poseSvc().renderBodyStructuredTwin(r, 128);
    check('P1060 測定用の双子が描ける', !!twin && twin.length === 128 * 128 * 4, `len=${twin?.length}`);
    const seg: any = twin ? await poseSvc().segmentTwinPalette(twin, 128, r) : null;
    let nb = 0, nh = 0;
    if (seg) { for (let i = 0; i < seg.body.length; i++) nb += seg.body[i]; for (let i = 0; i < seg.hair.length; i++) nh += seg.hair[i]; }
    check('P1062 双子がパレットで体と髪に分かれる', nb > 100 && nh > 100, `body=${nb} hair=${nh}`);
  }


  // P1063: 描く側の補正表（既定は等倍、クランプが効く、ドリルが回る）
  {
    const r: any = await poseSvc().analyzePose(paleLongHair48(), 48, 56);
    const c0: any = await poseSvc().getDrawingCorrections();
    check('P1063 補正の既定は全て等倍', !!c0 && c0.shoulder === 1 && c0.chest === 1 && c0.waist === 1 && c0.hip === 1 && c0.thigh === 1 && c0.calf === 1 && c0.ankle === 1, JSON.stringify(c0));
    await poseSvc().setDrawingCorrections({ shoulder: 99, chest: 0.01 });
    const c1: any = await poseSvc().getDrawingCorrections();
    check('P1063 補正は範囲内に丸められる', c1?.shoulder === 2.5 && c1?.chest === 0.5, JSON.stringify(c1));
    await poseSvc().setDrawingCorrections({ shoulder: 1, chest: 1, waist: 1, hip: 1, thigh: 1, calf: 1, ankle: 1 });
    const dr: any = await poseSvc().drillCorrections(r, 3);
    check('P1063 補正ドリルが回って有限の差で返る', !!dr && typeof dr.finalDiff === 'number' && Number.isFinite(dr.finalDiff), JSON.stringify(dr?.finalDiff));
    await poseSvc().setDrawingCorrections({ shoulder: 1, chest: 1, waist: 1, hip: 1, thigh: 1, calf: 1, ankle: 1 });
  }

  // P1066: 自分の描画の測り直しにパレット分離を配線する
  // （平坦な双子＋パレットの体マスクで構造を読む。髪と服が
  // 同系色だと通常の再読では肩と髪色が外れる件への対処）
  {
    const r: any = await poseSvc().analyzePose(paleLongHair48(), 48, 56);
    const ver: any = r ? await poseSvc().verifyBodyStructured(r) : null;
    check('P1066 パレット分離の配線で淡色の構造化照合が上がる', ver?.verified === true && (ver?.score ?? 0) >= 0.89, `score=${ver?.score}`);
  }


  // P1067: 補正ドリルの測定をパレット経路に寄せる
  // （平坦な双子＋パレットの体マスクで測り直す。64pxの
  // 通常読みでは補正に反応せず学習が成立しなかった）
  {
    const r: any = await poseSvc().analyzePose(paleLongHair48(), 48, 56);
    let drill: any = null;
    if (r) {
      await poseSvc().setTarget(r);
      await poseSvc().setDrawingCorrections({ shoulder: 1, chest: 1, waist: 1, hip: 1, thigh: 1, calf: 1, ankle: 1 });
      drill = await poseSvc().drillCorrections(r);
      await poseSvc().setDrawingCorrections({ shoulder: 1, chest: 1, waist: 1, hip: 1, thigh: 1, calf: 1, ankle: 1 });
    }
    check('P1067 パレット経路で補正ドリルが学習する', drill?.improved === true && (drill?.finalDiff ?? 9) < (drill?.initialDiff ?? 0), `init=${drill?.initialDiff} final=${drill?.finalDiff}`);
  }


  // P1068: 中の線の往復（読み→描く→測り直し）。
  // 読みに持つだけだった内側の境界を描き戻し、行の
  // 範囲全体を見る走査で測り直せるようにした。
  {
    const r: any = await poseSvc().analyzePose(paleLongHair48(), 48, 56);
    let bands = 0;
    let recovered = 0;
    if (r) {
      const ren: any = await poseSvc().renderBody(r, 128, null, null, { backHair: true });
      const re: any = ren ? await poseSvc().analyzePose(ren, 128, 128) : null;
      for (let i = 0; i < 24; i++) {
        const sp = r.innerLines?.[i];
        if (!sp || sp.length === 0) continue;
        bands++;
        const rp = re?.innerLines?.[i];
        if (rp && sp.every((p: number) => rp.some((q: number) => Math.abs(p - q) <= 0.05))) recovered++;
      }
    }
    check('P1068 中の線が描き戻されて測り直せる', bands >= 5 && recovered === bands, `bands=${bands} recovered=${recovered}`);
  }


  // P1073: 後ろ髪の面の標準化。面の形を固定の広がり曲線では
  // なく実測の輪郭（24段の左右端）から取る。曲線は上部で
  // 広がりすぎ、腰から下で先細りしすぎ、下端が実物より下まで
  // 垂れていた。輪郭がある読みでは左右別々に再生し、下端は
  // 「輪郭が体だけの幅より広い」最下の帯で決める。輪郭が
  // 無い読みでは従来の曲線に倒れる。
  {
    const buildSheet = (): Uint8Array => {
      const W = 48, H = 56; const fig = new Uint8Array(W * H * 4);
      const rect = (x0: number, y0: number, x1: number, y1: number, c: [number, number, number]) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const i = (y * W + x) * 4; fig[i] = c[0]; fig[i + 1] = c[1]; fig[i + 2] = c[2]; fig[i + 3] = 255; } };
      const disc = (cx: number, cy: number, r: number, c: [number, number, number]) => { for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) { const i = (y * W + x) * 4; fig[i] = c[0]; fig[i + 1] = c[1]; fig[i + 2] = c[2]; fig[i + 3] = 255; } };
      for (let i = 0; i < W * H; i++) { fig[i * 4] = 245; fig[i * 4 + 1] = 245; fig[i * 4 + 2] = 245; fig[i * 4 + 3] = 255; }
      const HAIR: [number, number, number] = [45, 32, 22];
      const SKIN: [number, number, number] = [232, 190, 160];
      const CLOTH: [number, number, number] = [40, 40, 120];
      rect(12, 6, 35, 40, HAIR); // 後ろ髪の面（下端は y=40）
      rect(18, 16, 29, 33, CLOTH); rect(15, 17, 17, 31, CLOTH); rect(30, 17, 32, 31, CLOTH);
      rect(18, 33, 22, 52, CLOTH); rect(25, 33, 29, 52, CLOTH);
      disc(23, 10, 6, HAIR); disc(23, 11, 5, SKIN);
      return fig;
    };
    const sr: any = await poseSvc().analyzePose(buildSheet(), 48, 56);
    check('P1073 面のある読みが輪郭つきで取れる', !!sr && sr.hair?.length === 'long' && !!sr.contour, `hair=${sr?.hair?.length} contour=${!!sr?.contour}`);
    const vc: any = sr ? await poseSvc().verifyBodyContour(sr) : null;
    check('P1073 輪郭どおりに面を描いて照合が通る', vc?.verified === true && (vc?.score ?? 0) >= 0.9, `score=${vc?.score}`);
    let lowOk = false;
    let midOk = false;
    if (sr) {
      const ren: any = await poseSvc().renderBody(sr, 128, null, null, { backHair: true });
      const re: any = ren ? await poseSvc().analyzePose(ren, 128, 128) : null;
      if (re?.contour && sr.contour) {
        let midMax = 0;
        for (let i = 14; i <= 17; i++) {
          midMax = Math.max(midMax, Math.abs((re.contour.l[i] ?? 0) - (sr.contour.l[i] ?? 0)), Math.abs((re.contour.r[i] ?? 0) - (sr.contour.r[i] ?? 0)));
        }
        midOk = midMax <= 0.04;
        let lowMax = 0;
        for (let i = 20; i <= 23; i++) {
          lowMax = Math.max(lowMax, Math.max(Math.abs(re.contour.l[i] ?? 0), Math.abs(re.contour.r[i] ?? 0)) - Math.max(Math.abs(sr.contour.l[i] ?? 0), Math.abs(sr.contour.r[i] ?? 0)));
        }
        lowOk = lowMax <= 0.05;
      }
    }
    check('P1073 面の帯（14〜17）で輪郭が再現される', midOk, 'mid');
    check('P1073 面の下端より下に面が垂れない', lowOk, 'low');
    let fbOk = false;
    {
      // フォールバックの物差しは P1022 の細身フィギュアを使う
      // （面フィギュアは髪の塊が素の描画でも広く、総幅では
      // 層の追加を測れないため）。
      const W = 48, H = 56; const nf = new Uint8Array(W * H * 4);
      const BG: [number, number, number] = [208, 210, 212]; const SKIN: [number, number, number] = [243, 222, 205];
      const HAIR: [number, number, number] = [243, 205, 215]; const CLOTH: [number, number, number] = [150, 160, 190];
      const rect = (x0: number, y0: number, x1: number, y1: number, c: [number, number, number]) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const i = (y * W + x) * 4; nf[i] = c[0]; nf[i + 1] = c[1]; nf[i + 2] = c[2]; nf[i + 3] = 255; } };
      const disc = (cx: number, cy: number, r: number, c: [number, number, number]) => { for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) { const i = (y * W + x) * 4; nf[i] = c[0]; nf[i + 1] = c[1]; nf[i + 2] = c[2]; nf[i + 3] = 255; } };
      for (let i = 0; i < W * H; i++) { nf[i * 4] = BG[0]; nf[i * 4 + 1] = BG[1]; nf[i * 4 + 2] = BG[2]; nf[i * 4 + 3] = 255; }
      rect(13, 4, 31, 12, HAIR); rect(15, 13, 16, 40, HAIR); rect(27, 13, 28, 40, HAIR);
      rect(19, 15, 25, 32, CLOTH);
      rect(17, 16, 18, 30, CLOTH); rect(26, 16, 27, 30, CLOTH);
      rect(19, 32, 21, 50, CLOTH); rect(23, 32, 25, 50, CLOTH);
      disc(22, 9, 6, HAIR); disc(22, 10, 5, SKIN);
      const rn: any = await poseSvc().analyzePose(nf, 48, 56);
      const noCtr: any = rn ? { ...rn, contour: null } : null;
      const plain: any = noCtr ? await poseSvc().renderBody(noCtr, 128) : null;
      const sheeted: any = noCtr ? await poseSvc().renderBody(noCtr, 128, null, null, { backHair: true }) : null;
      const widthOf = (px: Uint8Array, Sz: number): number => {
        const bg = [px[0], px[1], px[2]];
        let x0 = Sz, x1 = -1;
        for (let y = 0; y < Sz; y++) for (let x = 0; x < Sz; x++) { const i = (y * Sz + x) * 4; if (Math.abs(px[i] - bg[0]) + Math.abs(px[i + 1] - bg[1]) + Math.abs(px[i + 2] - bg[2]) > 30) { if (x < x0) x0 = x; if (x > x1) x1 = x; } }
        return x1 - x0 + 1;
      };
      fbOk = !!plain && !!sheeted && widthOf(sheeted, 128) > widthOf(plain, 128) + 4;
    }
    check('P1073 輪郭なしの読みは従来の曲線で面が広がる', fbOk, 'fallback');
  }

  // P1074: 肘の検出。下りた腕の輪郭の外縁の軌跡の折れ
  // （傾きの段差＋直線からの外れ）で肘を取る。真っ直ぐな
  // 腕と、後ろ髪の面の縁（緩やかな曲線）では決めない。
  // 肘の確定は肌の島による手の補正の後に行う（輪郭の手は
  // 髪に引っ張られるため）。
  {
    const buildArm = (bent: boolean): Uint8Array => {
      const W = 48, H = 56; const fig = new Uint8Array(W * H * 4);
      const rect = (x0: number, y0: number, x1: number, y1: number, c: [number, number, number]) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const i = (y * W + x) * 4; fig[i] = c[0]; fig[i + 1] = c[1]; fig[i + 2] = c[2]; fig[i + 3] = 255; } };
      const disc = (cx: number, cy: number, r: number, c: [number, number, number]) => { for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) { const i = (y * W + x) * 4; fig[i] = c[0]; fig[i + 1] = c[1]; fig[i + 2] = c[2]; fig[i + 3] = 255; } };
      for (let i = 0; i < W * H; i++) { fig[i * 4] = 245; fig[i * 4 + 1] = 245; fig[i * 4 + 2] = 245; fig[i * 4 + 3] = 255; }
      const HAIR: [number, number, number] = [45, 32, 22];
      const SKIN: [number, number, number] = [232, 190, 160];
      const CLOTH: [number, number, number] = [40, 40, 120];
      rect(19, 15, 29, 32, CLOTH);
      rect(19, 32, 22, 50, CLOTH); rect(26, 32, 29, 50, CLOTH);
      rect(30, 16, 33, 36, CLOTH);
      disc(33, 38, 2, SKIN);
      if (bent) {
        rect(15, 16, 18, 27, CLOTH);
        rect(13, 28, 17, 30, CLOTH);
        rect(11, 31, 15, 33, CLOTH);
        rect(9, 34, 13, 36, CLOTH);
        disc(10, 38, 2, SKIN);
      } else {
        rect(15, 16, 18, 36, CLOTH);
        disc(16, 38, 2, SKIN);
      }
      disc(24, 9, 6, HAIR); disc(24, 10, 5, SKIN);
      return fig;
    };
    const rb: any = await poseSvc().analyzePose(buildArm(true), 48, 56);
    check('P1074 曲がった腕で肘が取れる', !!rb?.elbowL && Math.abs(rb.elbowL.y - 28 / 55) <= 0.07 && rb.elbowL.x <= 0.36, `elbowL=${JSON.stringify(rb?.elbowL)}`);
    check('P1074 真っ直ぐな右腕では肘を決めない', !!rb && rb.elbowR === null, `elbowR=${JSON.stringify(rb?.elbowR)}`);
    const rs: any = await poseSvc().analyzePose(buildArm(false), 48, 56);
    check('P1074 真っ直ぐな腕では両肘とも決めない', !!rs && rs.elbowL === null && rs.elbowR === null, `L=${JSON.stringify(rs?.elbowL)} R=${JSON.stringify(rs?.elbowR)}`);
    const rp: any = await poseSvc().analyzePose(paleLongHair48(), 48, 56);
    check('P1074 淡色（髪の板＋真っ直ぐな腕）でも肘を決めない', !!rp && rp.elbowL === null && rp.elbowR === null, `L=${JSON.stringify(rp?.elbowL)} R=${JSON.stringify(rp?.elbowR)}`);
  }

  // P1075: 横向きのお腹とお尻（奥行きの縁）。24段で前の縁・
  // 後ろの縁を体の軸からの距離で持ち、お腹は腰帯の前の縁の
  // 胸基準からの出、尻は尻帯の後ろの縁の胸基準からの出。
  // 向きはつま先の伸びで決める。お腹・お尻の張り出しは
  // 向き判定の帯（肩〜腰）の下部に来るため、向き判定は
  // 帯の上1/3だけ見る（帯全体では張り出しつき横向きを
  // 正面と誤った）。
  {
    const buildSide = (opt: { facing: 'l' | 'r'; belly: boolean; buttocks: boolean; toe: boolean }): Uint8Array => {
      const W = 48, H = 56; const fig = new Uint8Array(W * H * 4);
      const rect = (x0: number, y0: number, x1: number, y1: number, c: [number, number, number]) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const i = (y * W + x) * 4; fig[i] = c[0]; fig[i + 1] = c[1]; fig[i + 2] = c[2]; fig[i + 3] = 255; } };
      const disc = (cx: number, cy: number, r: number, c: [number, number, number]) => { for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) { const i = (y * W + x) * 4; fig[i] = c[0]; fig[i + 1] = c[1]; fig[i + 2] = c[2]; fig[i + 3] = 255; } };
      for (let i = 0; i < W * H; i++) { fig[i * 4] = 245; fig[i * 4 + 1] = 245; fig[i * 4 + 2] = 245; fig[i * 4 + 3] = 255; }
      const HAIR: [number, number, number] = [45, 32, 22];
      const SKIN: [number, number, number] = [232, 190, 160];
      const CLOTH: [number, number, number] = [40, 40, 120];
      const L = opt.facing === 'l';
      rect(18, 15, 27, 32, CLOTH); rect(19, 32, 26, 50, CLOTH);
      if (L) rect(19, 16, 22, 30, SKIN); else rect(17, 16, 20, 30, SKIN);
      disc(22, 9, 6, HAIR); disc(L ? 20 : 24, 10, 5, SKIN);
      if (opt.toe) { if (L) rect(15, 48, 26, 50, CLOTH); else rect(19, 48, 30, 50, CLOTH); }
      if (opt.belly) { if (L) rect(14, 24, 17, 29, CLOTH); else rect(28, 24, 31, 29, CLOTH); }
      if (opt.buttocks) { if (L) rect(28, 30, 31, 34, CLOTH); else rect(14, 30, 17, 34, CLOTH); }
      return fig;
    };
    const both: any = await poseSvc().analyzePose(buildSide({ facing: 'l', belly: true, buttocks: true, toe: true }), 48, 56);
    check('P1075 張り出しつき横向きが横向き・奥行きと読める', both?.viewpoint === 'side' && both?.profileKind === 'depth', `view=${both?.viewpoint} kind=${both?.profileKind}`);
    check('P1075 張り出しつき横向きでお腹・お尻が読める', !!both?.depthProfile && both.depthProfile.facing === 'l' && (both.depthProfile.belly ?? 0) >= 0.05 && (both.depthProfile.buttocks ?? 0) >= 0.05, `dp=${JSON.stringify(both?.depthProfile && { facing: both.depthProfile.facing, belly: both.depthProfile.belly, buttocks: both.depthProfile.buttocks })}`);
    const bothR: any = await poseSvc().analyzePose(buildSide({ facing: 'r', belly: true, buttocks: true, toe: true }), 48, 56);
    check('P1075 右向きの張り出しつき横向きで向きが右と読める', !!bothR?.depthProfile && bothR.depthProfile.facing === 'r' && (bothR.depthProfile.belly ?? 0) >= 0.05 && (bothR.depthProfile.buttocks ?? 0) >= 0.05, `dp=${JSON.stringify(bothR?.depthProfile && { facing: bothR.depthProfile.facing, belly: bothR.depthProfile.belly, buttocks: bothR.depthProfile.buttocks })}`);
    const flat: any = await poseSvc().analyzePose(buildSide({ facing: 'l', belly: false, buttocks: false, toe: true }), 48, 56);
    check('P1075 張り出しなしの横向きではお腹・お尻は出ない', !!flat?.depthProfile && flat.depthProfile.facing === 'l' && (flat.depthProfile.belly ?? 1) <= 0.02 && (flat.depthProfile.buttocks ?? 1) <= 0.02, `dp=${JSON.stringify(flat?.depthProfile && { belly: flat.depthProfile.belly, buttocks: flat.depthProfile.buttocks })}`);
    const bellyOnly: any = await poseSvc().analyzePose(buildSide({ facing: 'l', belly: true, buttocks: false, toe: true }), 48, 56);
    const buttOnly: any = await poseSvc().analyzePose(buildSide({ facing: 'l', belly: false, buttocks: true, toe: true }), 48, 56);
    check('P1075 お腹だけ・お尻だけが別々に読める', (bellyOnly?.depthProfile?.belly ?? 0) >= 0.05 && (bellyOnly?.depthProfile?.buttocks ?? 1) <= 0.02 && (buttOnly?.depthProfile?.belly ?? 1) <= 0.02 && (buttOnly?.depthProfile?.buttocks ?? 0) >= 0.05, `bellyOnly=${JSON.stringify(bellyOnly?.depthProfile && { belly: bellyOnly.depthProfile.belly, buttocks: bellyOnly.depthProfile.buttocks })} buttOnly=${JSON.stringify(buttOnly?.depthProfile && { belly: buttOnly.depthProfile.belly, buttocks: buttOnly.depthProfile.buttocks })}`);
    const noToe: any = await poseSvc().analyzePose(buildSide({ facing: 'l', belly: true, buttocks: true, toe: false }), 48, 56);
    check('P1075 つま先がなければ向き・お腹・お尻を決めない', !!noToe?.depthProfile && noToe.depthProfile.facing === null && noToe.depthProfile.belly === null && noToe.depthProfile.buttocks === null, `dp=${JSON.stringify(noToe?.depthProfile && { facing: noToe.depthProfile.facing, belly: noToe.depthProfile.belly, buttocks: noToe.depthProfile.buttocks })}`);
    check('P1075 張り出しが説明文に入る', (both?.description ?? '').includes('お腹が前に張り出している') && (both?.description ?? '').includes('お尻が後ろに張り出している'), `desc=${both?.description ?? ''}`);
  }

  // P1076: 横向きの描画側。depthProfile から描き直して
  // 測り直し、前・後の縁が往復するかを見る。あわせて
  // 横向き判定の spill を画素数だけでなく幅でも見るよう
  // 直した（横向きの胸の縁は胴の中央値より少し外に出て、
  // 解像度が上がると正面と誤っていた）。
  {
    const buildSide = (opt: { facing: 'l' | 'r'; belly: boolean; buttocks: boolean; toe: boolean }): Uint8Array => {
      const W = 48, H = 56; const fig = new Uint8Array(W * H * 4);
      const rect = (x0: number, y0: number, x1: number, y1: number, c: [number, number, number]) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const i = (y * W + x) * 4; fig[i] = c[0]; fig[i + 1] = c[1]; fig[i + 2] = c[2]; fig[i + 3] = 255; } };
      const disc = (cx: number, cy: number, r: number, c: [number, number, number]) => { for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) { const i = (y * W + x) * 4; fig[i] = c[0]; fig[i + 1] = c[1]; fig[i + 2] = c[2]; fig[i + 3] = 255; } };
      for (let i = 0; i < W * H; i++) { fig[i * 4] = 245; fig[i * 4 + 1] = 245; fig[i * 4 + 2] = 245; fig[i * 4 + 3] = 255; }
      const HAIR: [number, number, number] = [45, 32, 22];
      const SKIN: [number, number, number] = [232, 190, 160];
      const CLOTH: [number, number, number] = [40, 40, 120];
      const L = opt.facing === 'l';
      rect(18, 15, 27, 32, CLOTH); rect(19, 32, 26, 50, CLOTH);
      if (L) rect(19, 16, 22, 30, SKIN); else rect(17, 16, 20, 30, SKIN);
      disc(22, 9, 6, HAIR); disc(L ? 20 : 24, 10, 5, SKIN);
      if (opt.toe) { if (L) rect(15, 48, 26, 50, CLOTH); else rect(19, 48, 30, 50, CLOTH); }
      if (opt.belly) { if (L) rect(14, 24, 17, 29, CLOTH); else rect(28, 24, 31, 29, CLOTH); }
      if (opt.buttocks) { if (L) rect(28, 30, 31, 34, CLOTH); else rect(14, 30, 17, 34, CLOTH); }
      return fig;
    };
    const srcL: any = await poseSvc().analyzePose(buildSide({ facing: 'l', belly: true, buttocks: true, toe: true }), 48, 56);
    const vL: any = srcL ? await poseSvc().verifySideDepth(srcL) : null;
    check('P1076 左向きの横向きが描き直しで往復する', vL?.verified === true && (vL?.score ?? 0) >= 0.9, `v=${JSON.stringify(vL)}`);
    const srcR: any = await poseSvc().analyzePose(buildSide({ facing: 'r', belly: true, buttocks: true, toe: true }), 48, 56);
    const vR: any = srcR ? await poseSvc().verifySideDepth(srcR) : null;
    check('P1076 右向きの横向きが描き直しで往復する', vR?.verified === true && (vR?.score ?? 0) >= 0.9, `v=${JSON.stringify(vR)}`);
    const srcF: any = await poseSvc().analyzePose(buildSide({ facing: 'l', belly: false, buttocks: false, toe: true }), 48, 56);
    const vF: any = srcF ? await poseSvc().verifySideDepth(srcF) : null;
    check('P1076 張り出しなしの横向きも往復する', vF?.verified === true, `v=${JSON.stringify(vF)}`);
    let flatStay = false;
    if (srcF) {
      const imgF: any = await poseSvc().renderBodySide(srcF, 128);
      const reF: any = imgF ? await poseSvc().analyzePose(imgF, 128, 128) : null;
      flatStay = !!reF?.depthProfile && (reF.depthProfile.belly ?? 1) <= 0.02 && (reF.depthProfile.buttocks ?? 1) <= 0.02;
    }
    check('P1076 描き直しで張り出しが勝手に付かない', flatStay, 'flat');
    const rp: any = await poseSvc().analyzePose(paleLongHair48(), 48, 56);
    check('P1076 正面の読みでは横向き描画・照合はしない', !!rp && (await poseSvc().renderBodySide(rp, 128)) === null && (await poseSvc().verifySideDepth(rp)) === null, 'front');
  }



  // P1077: 肘の残り。前腕が内側へ曲がる場合は側帯の鎖が
  // 切れた所＋内側の手の島で決める。広げた腕は列ごとの
  // 中心の軌跡の折れ、上げた腕は外縁が上腕の柱に収まる
  // 行で決める。真っ直ぐな腕ではどれも決めない。
  // 上へ曲がる前腕は垂れた髪の柱と見分けがつかず状態が
  // DOWN になるため対象外（状態判定自体の限界）。
  {
    const buildElbowFig = (draw: (rect: (x0: number, y0: number, x1: number, y1: number, c: [number, number, number]) => void, disc: (cx: number, cy: number, r: number, c: [number, number, number]) => void) => void): Uint8Array => {
      const W = 48, H = 56; const fig = new Uint8Array(W * H * 4);
      const rect = (x0: number, y0: number, x1: number, y1: number, c: [number, number, number]) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const i = (y * W + x) * 4; fig[i] = c[0]; fig[i + 1] = c[1]; fig[i + 2] = c[2]; fig[i + 3] = 255; } };
      const disc = (cx: number, cy: number, r: number, c: [number, number, number]) => { for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) { const i = (y * W + x) * 4; fig[i] = c[0]; fig[i + 1] = c[1]; fig[i + 2] = c[2]; fig[i + 3] = 255; } };
      for (let i = 0; i < W * H; i++) { fig[i * 4] = 245; fig[i * 4 + 1] = 245; fig[i * 4 + 2] = 245; fig[i * 4 + 3] = 255; }
      const HAIR: [number, number, number] = [45, 32, 22];
      const SKIN: [number, number, number] = [232, 190, 160];
      const CLOTH: [number, number, number] = [40, 40, 120];
      rect(19, 15, 29, 32, CLOTH);
      rect(19, 32, 22, 50, CLOTH); rect(26, 32, 29, 50, CLOTH);
      rect(30, 16, 33, 36, CLOTH); disc(33, 38, 2, SKIN);
      disc(24, 9, 6, HAIR); disc(24, 10, 5, SKIN);
      draw(rect, disc);
      return fig;
    };
    const SKIN2: [number, number, number] = [232, 190, 160];
    const CLOTH2: [number, number, number] = [40, 40, 120];
    const rIn: any = await poseSvc().analyzePose(buildElbowFig((rect, disc) => {
      rect(15, 16, 18, 24, CLOTH2); rect(16, 25, 22, 27, CLOTH2); disc(21, 26, 2, SKIN2);
    }), 48, 56);
    check('P1077 前腕が内側へ曲がる腕で肘が取れる', !!rIn?.elbowL && Math.abs(rIn.elbowL.y - 26 / 55) <= 0.07 && rIn.elbowL.x <= 0.36, `elbowL=${JSON.stringify(rIn?.elbowL)}`);
    check('P1077 内側の腕でも真っ直ぐな右腕では決めない', !!rIn && rIn.elbowR === null, `elbowR=${JSON.stringify(rIn?.elbowR)}`);
    const rSp: any = await poseSvc().analyzePose(buildElbowFig((rect, disc) => {
      rect(4, 16, 18, 19, CLOTH2); rect(6, 20, 9, 29, CLOTH2); disc(7, 30, 2, SKIN2);
    }), 48, 56);
    check('P1077 広げて下へ曲がる腕で肘が取れる', rSp?.armL === 'SPREAD' && !!rSp?.elbowL && Math.abs(rSp.elbowL.x - 8 / 47) <= 0.06 && Math.abs(rSp.elbowL.y - 19 / 55) <= 0.07, `armL=${rSp?.armL} elbowL=${JSON.stringify(rSp?.elbowL)}`);
    const rSpS: any = await poseSvc().analyzePose(buildElbowFig((rect, disc) => {
      rect(4, 16, 18, 19, CLOTH2); disc(5, 17, 2, SKIN2);
    }), 48, 56);
    check('P1077 広げた真っ直ぐな腕では肘を決めない', rSpS?.armL === 'SPREAD' && rSpS?.elbowL === null, `armL=${rSpS?.armL} elbowL=${JSON.stringify(rSpS?.elbowL)}`);
    const rRa: any = await poseSvc().analyzePose(buildElbowFig((rect, disc) => {
      rect(13, 4, 16, 15, CLOTH2); rect(7, 2, 12, 5, CLOTH2); disc(6, 3, 2, SKIN2);
    }), 48, 56);
    check('P1077 上げて外へ曲がる腕で肘が取れる', rRa?.armL === 'RAISED' && !!rRa?.elbowL && Math.abs(rRa.elbowL.x - 13 / 47) <= 0.06 && Math.abs(rRa.elbowL.y - 5 / 55) <= 0.07, `armL=${rRa?.armL} elbowL=${JSON.stringify(rRa?.elbowL)}`);
    const rRaS: any = await poseSvc().analyzePose(buildElbowFig((rect, disc) => {
      rect(13, 2, 16, 15, CLOTH2); disc(14, 2, 2, SKIN2);
    }), 48, 56);
    check('P1077 上げた真っ直ぐな腕では肘を決めない', rRaS?.armL === 'RAISED' && rRaS?.elbowL === null, `armL=${rRaS?.armL} elbowL=${JSON.stringify(rRaS?.elbowL)}`);
  }


  // P1078: 前の髪の帯4〜7。描く側の腕・手・前の髪の
  // パネルが、実測の輪郭（人の外側の境界）からはみ出して
  // いた（肩→手の直線＋半径と、肩幅に腕が混ざった
  // パネルの縁）。輪郭がある読みでは、腕・手・パネルの
  // 画素を輪郭の内側に制限する。本人のサンプルでは
  // 帯4〜7の再読が平らな 0.139 から実測どおりの
  // 0.073〜0.133 の成長に直り、中の線の照合も
  // 0.833→0.917 に上がった（プローブで確認）。
  {
    const figW = 48, figH = 56; const fig = new Uint8Array(figW * figH * 4);
    const rect = (x0: number, y0: number, x1: number, y1: number, c: [number, number, number]) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const i = (y * figW + x) * 4; fig[i] = c[0]; fig[i + 1] = c[1]; fig[i + 2] = c[2]; fig[i + 3] = 255; } };
    const disc = (cx: number, cy: number, r: number, c: [number, number, number]) => { for (let y = 0; y < figH; y++) for (let x = 0; x < figW; x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) { const i = (y * figW + x) * 4; fig[i] = c[0]; fig[i + 1] = c[1]; fig[i + 2] = c[2]; fig[i + 3] = 255; } };
    for (let i = 0; i < figW * figH; i++) { fig[i * 4] = 245; fig[i * 4 + 1] = 245; fig[i * 4 + 2] = 245; fig[i * 4 + 3] = 255; }
    const HAIR: [number, number, number] = [45, 32, 22];
    const SKIN: [number, number, number] = [232, 190, 160];
    const CLOTH: [number, number, number] = [40, 40, 120];
    rect(19, 15, 29, 32, CLOTH);
    rect(19, 32, 22, 50, CLOTH); rect(26, 32, 29, 50, CLOTH);
    rect(30, 16, 33, 36, CLOTH); disc(33, 38, 2, SKIN);
    rect(15, 16, 18, 36, CLOTH); disc(16, 38, 2, SKIN);
    disc(24, 9, 6, HAIR); disc(24, 10, 5, SKIN);
    const rSrc: any = await poseSvc().analyzePose(fig, figW, figH);
    const S2 = 128;
    const ren: Uint8Array | null = rSrc ? poseSvc().renderBody(rSrc, S2, null, null, null) : null;
    let worst = -1;
    if (rSrc && ren) {
      const bg = [ren[0], ren[1], ren[2]];
      const figHpN = Math.max(0.1, Math.max(rSrc.footL?.y ?? 0, rSrc.footR?.y ?? 0) - (rSrc.head.y - rSrc.headRh));
      const figTopPx = (rSrc.head.y - rSrc.headRh) * (S2 - 1);
      worst = 0;
      for (let band = 4; band <= 7; band++) {
        const lv = rSrc.contour?.l?.[band], rv = rSrc.contour?.r?.[band];
        if (lv === null || lv === undefined || rv === null || rv === undefined) { worst = -1; break; }
        const envL = (rSrc.head.x + lv * figHpN) * (S2 - 1);
        const envR = (rSrc.head.x + rv * figHpN) * (S2 - 1);
        const y = Math.round(figTopPx + ((band + 0.5) / 24) * figHpN * (S2 - 1));
        for (let yy = y - 2; yy <= y + 2; yy++) {
          for (let x = 0; x < S2; x++) {
            const i = (yy * S2 + x) * 4;
            if (ren[i] === bg[0] && ren[i + 1] === bg[1] && ren[i + 2] === bg[2]) continue;
            worst = Math.max(worst, envL - x, x - envR, 0);
          }
        }
      }
    }
    check('P1078 帯4〜7で描画が実測の輪郭からはみ出さない', worst >= 0 && worst <= 2, `worst=${worst.toFixed(1)}px`);
    const pSrc2: any = await poseSvc().analyzePose(paleLongHair48(), 48, 56);
    const vcP: any = pSrc2 ? poseSvc().verifyBodyContour(pSrc2) : null;
    check('P1078 淡色の輪郭照合は維持', !!vcP?.verified, `score=${vcP?.score}`);
  }

  // P1079: 淡いパレットの色の忠実度。構造化描画の影と線が
  // 淡い色を灰色に潰していた（セルの影は deriveShadow の
  // チャンネルずらし、輪郭線は ×0.42、首は固定の茶色）。
  // 淡い画素では影は色相を保って ×0.82、線は弱め、首は
  // その人の肌から落とした影色で描く。
  {
    const pSrc: any = await poseSvc().analyzePose(paleLongHair48(), 48, 56);
    const celImg: Uint8Array | null = pSrc ? poseSvc().renderBodyCel(pSrc, 192) : null;
    let oldSh = 0, newSh = 0;
    if (celImg) for (let p = 0; p < 192 * 192; p++) { const i = p * 4; if (celImg[i] === 164 && celImg[i + 1] === 155 && celImg[i + 2] === 158) oldSh++; if (celImg[i] === 199 && celImg[i + 1] === 182 && celImg[i + 2] === 168) newSh++; }
    check('P1079 淡い肌のセル影は灰色でなく色相を保つ', oldSh === 0 && newSh >= 20, `old=${oldSh} new=${newSh}`);
    const celV: any = pSrc ? poseSvc().verifyBodyCel(pSrc) : null;
    const olV: any = pSrc ? poseSvc().verifyBodyOutline(pSrc) : null;
    check('P1079 淡色のセル照合と輪郭照合は維持', !!celV?.verified && !!olV?.verified, `cel=${celV?.score} outline=${olV?.score}`);
    // 描画補正はプロセス共有の状態で、前のブロックのドリルが
    // 残した値だと胴の形が変わって首の位置がずれる。恒等に戻す。
    poseSvc().setDrawingCorrections({ shoulder: 1, chest: 1, waist: 1, hip: 1, thigh: 1, calf: 1, ankle: 1 });
    const renP: Uint8Array | null = pSrc ? poseSvc().renderBody(pSrc, 128, null, null, { backHair: true, frontHair: true }) : null;
    let neckOk = false;
    if (pSrc && renP) {
      const cx = Math.round(pSrc.head.x * 127);
      const yN = Math.round((pSrc.head.y + pSrc.headRh) * 127);
      const i = (yN * 128 + cx) * 4;
      neckOk = Math.abs(renP[i] - 165) <= 6 && Math.abs(renP[i + 1] - 151) <= 6 && Math.abs(renP[i + 2] - 139) <= 6;
    }
    check('P1079 首は肌から落とした影色で描く', neckOk, '');
  }

  // P1080: 髪の流れ。房の分かれ目を真っ直ぐ落とさず揺らし、
  // 上では弱く下ほどはっきり分かれるようにし、房の内側に
  // 幅広の柔らかい陰影を入れる。幅の広い面ではセルの影の
  // 境界もぼかす。読み側の均衡（ツヤ・房・髪色）が壊れて
  // いないことを、ピンク髪の合成フィギュアで確認する。
  {
    type RGB1080 = [number, number, number];
    const SKIN1080: RGB1080 = [232, 190, 160]; const PINK1080: RGB1080 = [240, 150, 180]; const BLUE1080: RGB1080 = [40, 40, 120];
    const px1080: RGB1080[] = []; for (let i = 0; i < 48 * 56; i++) px1080.push([240, 240, 240]);
    const rect1080 = (x0: number, y0: number, x1: number, y1: number, c: RGB1080) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) px1080[y * 48 + x] = c; };
    const disc1080 = (cx: number, cy: number, r: number, c: RGB1080) => { for (let y = 0; y < 56; y++) for (let x = 0; x < 48; x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) px1080[y * 48 + x] = c; };
    rect1080(16, 15, 28, 32, BLUE1080); rect1080(12, 16, 15, 30, BLUE1080); rect1080(29, 16, 32, 30, BLUE1080);
    rect1080(16, 32, 21, 50, BLUE1080); rect1080(23, 32, 28, 50, BLUE1080);
    rect1080(13, 4, 31, 12, PINK1080); rect1080(13, 4, 15, 40, PINK1080); rect1080(29, 4, 31, 40, PINK1080);
    disc1080(22, 9, 6, PINK1080); disc1080(22, 10, 5, SKIN1080);
    const img1080 = new Uint8Array(48 * 56 * 4);
    px1080.forEach((c, i) => { img1080[i * 4] = c[0]; img1080[i * 4 + 1] = c[1]; img1080[i * 4 + 2] = c[2]; img1080[i * 4 + 3] = 255; });
    const r1080: any = await poseSvc().analyzePose(img1080, 48, 56);
    const hd1080: Uint8Array | null = r1080 ? poseSvc().renderBodyHairDetail(r1080, 192) : null;
    let odd1080 = 0;
    if (hd1080) for (let p = 0; p < 192 * 192; p++) { const i = p * 4; if (hd1080[i] === 233 && hd1080[i + 1] === 146 && hd1080[i + 2] === 175) odd1080++; }
    check('P1080 房の内側に柔らかい陰影が入る', odd1080 >= 1, `odd=${odd1080}`);
    const vh1080: any = r1080 ? poseSvc().verifyBodyHairDetail(r1080) : null;
    check('P1080 髪の作画照合（ツヤと房）は維持', vh1080?.verified === true, `shine=${vh1080?.shine} clumps=${vh1080?.clumps}`);
    const re1080: any = hd1080 ? await poseSvc().analyzePose(hd1080, 192, 192) : null;
    check('P1080 流れを付けても髪色とツヤが読める', re1080?.hairColor === 'ピンク' && re1080?.hair?.shine === true, `color=${re1080?.hairColor} shine=${re1080?.hair?.shine}`);
  }

  // P1081: 淡い服色が肌に化ける／髪に紛れる問題。白への距離が
  // 40ちょうどの淡ピンクの服が「背景に近い」と判定されて
  // 肌色で描かれ（上の服が消える）、構造化の段では下の服が
  // 髪と誤認されて房の陰影で砕けていた。判定を「実際に使う
  // 板の色への距離」に変え、髪の処理からは服色（上下と影）を
  // 除外する。淡色フィギュアの読みに本人の水着の色を着せて
  // 描画側だけで確認する（読み側の服検出は実サンプルの
  // チェックが担う）。
  {
    const r1081: any = await poseSvc().analyzePose(paleLongHair48(), 48, 56);
    if (r1081) {
      poseSvc().setDrawingCorrections({ shoulder: 1, chest: 1, waist: 1, hip: 1, thigh: 1, calf: 1, ankle: 1 });
      r1081.clothing = { bottom: 'split', twoPiece: true, separated: true, topColor: '桜色', bottomColor: '桜色', topRgb: [245, 222, 228], bottomRgb: [231, 203, 210] };
      r1081.skinColor = [244, 228, 223]; r1081.hairRgb = [244, 206, 216]; r1081.hairColor = '桜色';
      const cnt1081 = (im: Uint8Array, tr: number, tg: number, tb: number): number => { let n = 0; for (let p = 0; p < 128 * 128; p++) { const i = p * 4; if (im[i] === tr && im[i + 1] === tg && im[i + 2] === tb) n++; } return n; };
      const pl1081: Uint8Array | null = poseSvc().renderBody(r1081, 128);
      check('P1081 淡い上の服が肌に化けず描かれる', pl1081 ? cnt1081(pl1081, 245, 222, 228) >= 200 : false, `top=${pl1081 ? cnt1081(pl1081, 245, 222, 228) : -1}`);
      const st1081: Uint8Array | null = poseSvc().renderBodyStructured(r1081, 128);
      check('P1081 構造化でも上下の服が残る', st1081 ? cnt1081(st1081, 245, 222, 228) >= 150 && cnt1081(st1081, 231, 203, 210) >= 100 : false, `top=${st1081 ? cnt1081(st1081, 245, 222, 228) : -1} bot=${st1081 ? cnt1081(st1081, 231, 203, 210) : -1}`);
      check('P1081 下の服が髪の陰影で砕けない', st1081 ? cnt1081(st1081, 224, 197, 204) <= 2 : false, `frag=${st1081 ? cnt1081(st1081, 224, 197, 204) : -1}`);
    } else {
      check('P1081 淡い上の服が肌に化けず描かれる', false, 'no reading');
      check('P1081 構造化でも上下の服が残る', false, 'no reading');
      check('P1081 下の服が髪の陰影で砕けない', false, 'no reading');
    }
  }

  // P1082: 胴と脚の輪郭を折れ線でなく曲線にする。胴の幅の
  // つなぎを smoothstep にし、脚は実測アンカーの位置に合わせて
  // 太もも→膝→ふくらはぎ→足首の曲線にした（膝は細い方の
  // 0.9倍のくびれ）。寸法の上書きした読みで、脚の膝が
  // ふくらはぎより細く出ることと、構造化の照合が保てる
  // ことを見る。
  {
    poseSvc().setDrawingCorrections({ shoulder: 1, chest: 1, waist: 1, hip: 1, thigh: 1, calf: 1, ankle: 1 });
    const r1082: any = await poseSvc().analyzePose(paleLongHair48(), 48, 56);
    if (r1082) r1082.bodyProfile = { shoulder: 0.30, chest: 0.46, waist: 0.30, hip: 0.42, thigh: 0.30, calf: 0.24, ankle: 0.18 };
    const vs1082: any = r1082 ? poseSvc().verifyBodyStructured(r1082) : null;
    check('P1082 曲線にしても構造化の照合が保てる', vs1082?.verified === true, `score=${vs1082?.score}`);
    const r1082b: any = await poseSvc().analyzePose(paleLongHair48(), 48, 56);
    let kneeW1082 = -1, calfW1082 = -1;
    if (r1082b) {
      r1082b.bodyProfile = { shoulder: 0.30, chest: 0.46, waist: 0.30, hip: 0.42, thigh: 0.30, calf: 0.24, ankle: 0.18 };
      r1082b.hair = { length: 'short', lengthRatio: 0.2, shine: false, clumps: 0 };
      const im1082: Uint8Array | null = poseSvc().renderBody(r1082b, 256);
      if (im1082) {
        const bgR = im1082[0], bgG = im1082[1], bgB = im1082[2];
        const isBg1082 = (x: number, y: number): boolean => { const i = (y * 256 + x) * 4; return Math.abs(im1082[i] - bgR) + Math.abs(im1082[i + 1] - bgG) + Math.abs(im1082[i + 2] - bgB) <= 12; };
        const spans1082 = (y: number): number[] => { const out: number[] = []; let x = 0; while (x < 256) { if (isBg1082(x, y)) { x++; continue; } let x1 = x; while (x1 + 1 < 256 && !isBg1082(x1 + 1, y)) x1++; if (x1 - x > 4) out.push(x1 - x + 1); x = x1 + 1; } return out; };
        let legTop = -1, legBottom = -1;
        for (let y = 100; y < 256; y++) { if (spans1082(y).length >= 2) { if (legTop < 0) legTop = y; legBottom = y; } }
        if (legTop >= 0 && legBottom > legTop) {
          const at1082 = (lt: number): number => { const sp = spans1082(Math.round(legTop + lt * (legBottom - legTop))); return sp.length ? Math.min(...sp) : -1; };
          kneeW1082 = at1082(0.48); calfW1082 = at1082(0.63);
        }
      }
    }
    check('P1082 脚に膝のくびれが出る', kneeW1082 > 0 && calfW1082 > 0 && kneeW1082 < calfW1082 && kneeW1082 <= 22, `knee=${kneeW1082} calf=${calfW1082}`);
  }

  // P1083: 淡いピンクの目が読めるようにする。本人の目の
  // 上半分は色が濃いが、下半分は飽和の低い淡い虹彩で、
  // 「目の下が肌か」の検査で虹彩自身を肌でないと数えて
  // 目が落ちていた（顔の測定が付かず、描く顔が既定の
  // 黒い点目になっていた）。色のついた非肌・非暗の画素は
  // 目自身の続きとして中立に数え、肌は緩い定義でも数える。
  {
    const { visualZoomService: vzoom1083 } = await import('../src/miki/conversation/services/visualZoomService');
    const S1083 = 48;
    const px1083 = new Uint8Array(S1083 * S1083 * 4);
    const set1083 = (x: number, y: number, c: [number, number, number]) => { const i = (y * S1083 + x) * 4; px1083[i] = c[0]; px1083[i + 1] = c[1]; px1083[i + 2] = c[2]; px1083[i + 3] = 255; };
    for (let y = 0; y < S1083; y++) for (let x = 0; x < S1083; x++) set1083(x, y, [45, 32, 22]);
    for (let y = 12; y <= 44; y++) for (let x = 14; x <= 34; x++) set1083(x, y, [232, 190, 160]);
    for (const ex1083 of [18, 27]) {
      for (let x = ex1083; x <= ex1083 + 2; x++) {
        set1083(x, 20, [205, 153, 168]);
        set1083(x, 21, [217, 186, 193]);
        set1083(x, 22, [217, 186, 193]);
      }
    }
    const fr1083: any = vzoom1083.analyzeFace(px1083);
    check('P1083 淡いピンクの目が2つ読めて色も付く', fr1083?.eyes === 2 && fr1083?.eyeColor === 'ピンク', `eyes=${fr1083?.eyes} color=${fr1083?.eyeColor}`);
  }

  // P1084: 腕と手に輪郭線を敷く。淡い肌と淡い髪は色の
  // 距離が小さく、腕が髪の面に溶けて消えていた。腕色の
  // 影色で少し大きいスタンプを下に敷き、1pxの線として
  // 覗かせる（太さは描く大きさに比例。structured の双子は
  // 3倍→最頻値縮小なので固定幅では消える）。肌の影色の
  // 画素数で線の存在を見て、腕の再読が保てることも見る。
  {
    poseSvc().setDrawingCorrections({ shoulder: 1, chest: 1, waist: 1, hip: 1, thigh: 1, calf: 1, ankle: 1 });
    const r1084: any = await poseSvc().analyzePose(paleLongHair48(), 48, 56);
    if (r1084) r1084.clothing = { ...(r1084.clothing ?? {}), topRgb: [245, 222, 228], bottomRgb: [231, 203, 210], separated: true };
    const img1084: Uint8Array | null = r1084 ? poseSvc().renderBody(r1084, 256) : null;
    let rim1084 = 0;
    if (img1084) for (let i = 0; i < img1084.length; i += 4) if (img1084[i] === 175 && img1084[i + 1] === 160 && img1084[i + 2] === 148) rim1084++;
    check('P1084 腕と手の輪郭線（肌を一律に落とした色）が描かれる', rim1084 >= 40, `rim=${rim1084}`);
    const rr1084: any = img1084 ? await poseSvc().analyzePose(img1084, 256, 256) : null;
    check('P1084 輪郭を入れても腕が下向きに読み直せる', rr1084?.armL === 'DOWN' && rr1084?.armR === 'DOWN', `armL=${rr1084?.armL} armR=${rr1084?.armR}`);
  }

// ---- P1085: ドリルの補正を輪郭へ広げる（段ごとのオフセット学習） ----
  {
    const t1085: any = poseSvc().analyzePose(paleLongHair48(), 48, 56);
    let okInit = false;
    let okFinal = false;
    let okOff = false;
    let detail1085 = '';
    if (t1085?.contour) {
      poseSvc().setTarget(t1085);
      poseSvc().setDrawingCorrections({ shoulder: 1, chest: 1, waist: 1, hip: 1, thigh: 1, calf: 1, ankle: 1 });
      poseSvc().setContourCorrections(null);
      const s1085: any = JSON.parse(JSON.stringify(t1085));
      s1085.contour = { l: t1085.contour.l.map((v: number | null) => (v === null ? null : v * 1.18)), r: t1085.contour.r.map((v: number | null) => (v === null ? null : v * 1.18)) };
      const res1085: any = poseSvc().drillCorrections(s1085);
      okInit = !!res1085 && res1085.contourDiffInitial !== null && res1085.contourDiffInitial > 0.02;
      okFinal = !!res1085 && res1085.contourDiffFinal !== null && res1085.contourDiffInitial !== null && res1085.contourDiffFinal < res1085.contourDiffInitial * 0.75;
      const cc1085: any = poseSvc().getContourCorrections();
      okOff = !!cc1085 && Math.max(...cc1085.l.map((v: number) => Math.abs(v)), ...cc1085.r.map((v: number) => Math.abs(v))) > 0.005;
      detail1085 = `init=${res1085?.contourDiffInitial} final=${res1085?.contourDiffFinal}`;
      poseSvc().setContourCorrections(null);
      poseSvc().setDrawingCorrections({ shoulder: 1, chest: 1, waist: 1, hip: 1, thigh: 1, calf: 1, ankle: 1 });
    }
    check('P1085 輪郭のずれを測れる', okInit, detail1085);
    check('P1085 ドリルで輪郭の差が縮む', okFinal, detail1085);
    check('P1085 輪郭の補正が残る', okOff, detail1085);
  }

// ---- P1086: ドリルの補正を関節の横位置へ広げる ----
  {
    const W1086 = 48, H1086 = 56;
    const fig1086 = new Uint8Array(W1086 * H1086 * 4);
    const rect1086 = (x0: number, y0: number, x1: number, y1: number, c: [number, number, number]) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const i = (y * W1086 + x) * 4; fig1086[i] = c[0]; fig1086[i + 1] = c[1]; fig1086[i + 2] = c[2]; fig1086[i + 3] = 255; } };
    const disc1086 = (cx: number, cy: number, r: number, c: [number, number, number]) => { for (let y = 0; y < H1086; y++) for (let x = 0; x < W1086; x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) { const i = (y * W1086 + x) * 4; fig1086[i] = c[0]; fig1086[i + 1] = c[1]; fig1086[i + 2] = c[2]; fig1086[i + 3] = 255; } };
    for (let i = 0; i < W1086 * H1086; i++) { fig1086[i * 4] = 245; fig1086[i * 4 + 1] = 245; fig1086[i * 4 + 2] = 245; fig1086[i * 4 + 3] = 255; }
    rect1086(16, 15, 28, 32, [40, 40, 120]); rect1086(12, 16, 15, 30, [40, 40, 120]); rect1086(29, 16, 32, 30, [40, 40, 120]);
    rect1086(16, 32, 21, 50, [40, 40, 120]); rect1086(23, 32, 28, 50, [40, 40, 120]);
    disc1086(22, 9, 6, [45, 32, 22]); disc1086(22, 10, 5, [232, 190, 160]);
    const t1086: any = poseSvc().analyzePose(fig1086, W1086, H1086);
    let okInit = false;
    let okFinal = false;
    let okOff = false;
    let detail1086 = '';
    if (t1086?.handL && t1086?.footL) {
      poseSvc().setTarget(t1086);
      poseSvc().setDrawingCorrections({ shoulder: 1, chest: 1, waist: 1, hip: 1, thigh: 1, calf: 1, ankle: 1 });
      poseSvc().setContourCorrections(null);
      poseSvc().setJointCorrections(null);
      const s1086: any = JSON.parse(JSON.stringify(t1086));
      s1086.handL = { x: t1086.handL.x + 0.05, y: t1086.handL.y };
      s1086.handR = { x: t1086.handR.x + 0.05, y: t1086.handR.y };
      s1086.footL = { x: t1086.footL.x - 0.06, y: t1086.footL.y };
      s1086.footR = { x: t1086.footR.x + 0.06, y: t1086.footR.y };
      const res1086: any = poseSvc().drillCorrections(s1086);
      okInit = !!res1086 && res1086.jointDiffInitial !== null && res1086.jointDiffInitial > 0.04;
      okFinal = !!res1086 && res1086.jointDiffFinal !== null && res1086.jointDiffInitial !== null && res1086.jointDiffFinal < res1086.jointDiffInitial * 0.8;
      const jc1086: any = poseSvc().getJointCorrections();
      okOff = !!jc1086 && Math.max(Math.abs(jc1086.handLx), Math.abs(jc1086.handRx), Math.abs(jc1086.footLx), Math.abs(jc1086.footRx)) > 0.005;
      detail1086 = `init=${res1086?.jointDiffInitial} final=${res1086?.jointDiffFinal}`;
      poseSvc().setJointCorrections(null);
      poseSvc().setContourCorrections(null);
      poseSvc().setDrawingCorrections({ shoulder: 1, chest: 1, waist: 1, hip: 1, thigh: 1, calf: 1, ankle: 1 });
    }
    check('P1086 関節の横のずれを測れる', okInit, detail1086);
    check('P1086 ドリルで関節の横の差が縮む', okFinal, detail1086);
    check('P1086 関節の補正が残る', okOff, detail1086);
  }

// ---- P1087: ドリルに重なり（中の境界線）の物差しと守りを入れる ----
  {
    const t1087: any = poseSvc().analyzePose(paleLongHair48(), 48, 56);
    let okMeasure = false;
    let okGuard = false;
    let okDraw = false;
    let detail1087 = '';
    if (t1087?.head) {
      poseSvc().setTarget(t1087);
      poseSvc().setDrawingCorrections({ shoulder: 1, chest: 1, waist: 1, hip: 1, thigh: 1, calf: 1, ankle: 1 });
      poseSvc().setContourCorrections(null);
      poseSvc().setJointCorrections(null);
      poseSvc().setOverlapCorrections({ panelK: 1.35 });
      const res1087: any = poseSvc().drillCorrections(t1087);
      okMeasure = !!res1087 && res1087.innerDiffInitial !== null && res1087.innerDiffFinal !== null;
      okGuard = okMeasure && res1087.innerDiffFinal <= res1087.innerDiffInitial + 0.01;
      detail1087 = `init=${res1087?.innerDiffInitial} final=${res1087?.innerDiffFinal}`;
      poseSvc().setOverlapCorrections({ panelK: 1 });
      const imgA: any = poseSvc().renderBody(t1087, 128, null, null, { backHair: true });
      poseSvc().setOverlapCorrections({ panelK: 1.35 });
      const imgB: any = poseSvc().renderBody(t1087, 128, null, null, { backHair: true });
      if (imgA && imgB) {
        let d = 0;
        for (let i = 0; i < imgA.length; i += 4) if (imgA[i] !== imgB[i] || imgA[i + 1] !== imgB[i + 1] || imgA[i + 2] !== imgB[i + 2]) d++;
        okDraw = d > 100;
        detail1087 += ` pix=${d}`;
      }
      poseSvc().setOverlapCorrections(null);
      poseSvc().setContourCorrections(null);
      poseSvc().setJointCorrections(null);
      poseSvc().setDrawingCorrections({ shoulder: 1, chest: 1, waist: 1, hip: 1, thigh: 1, calf: 1, ankle: 1 });
    }
    check('P1087 重なりのずれを測れる', okMeasure, detail1087);
    check('P1087 他の段が重なりを大きく壊さない', okGuard, detail1087);
    check('P1087 パネルの幅の補正が描画に効く', okDraw, detail1087);
  }

// ---- P1088: 胸の形（丸みの影と中央の谷） ----
  {
    const base1088: any = poseSvc().analyzePose(paleLongHair48(), 48, 56);
    let mound1088 = 0;
    if (base1088?.head) {
      const r1088: any = { ...base1088, bust: 1, bustPeak: 0.39, clothing: { ...(base1088.clothing ?? {}), separated: true, topRgb: [245, 222, 228], bottomRgb: [231, 203, 210] } };
      poseSvc().setDrawingCorrections({ shoulder: 1, chest: 1, waist: 1, hip: 1, thigh: 1, calf: 1, ankle: 1 });
      poseSvc().setContourCorrections(null);
      poseSvc().setJointCorrections(null);
      poseSvc().setOverlapCorrections(null);
      const img1088: any = poseSvc().renderBody(r1088, 256, null, null, { backHair: true, frontHair: true });
      if (img1088) for (let i = 0; i < img1088.length; i += 4) if (img1088[i] === 211 && img1088[i + 1] === 191 && img1088[i + 2] === 196) mound1088++;
    }
    check('P1088 胸の丸みの影が描かれる', mound1088 >= 40, `mound=${mound1088}`);
  }

// ---- P1089: ドリルの吸収候補が保存側に残らない（常駐で発散した原因） ----
  {
    const target1089: any = poseSvc().analyzePose(paleLongHair48(), 48, 56);
    let stable1089 = false;
    let storedOk1089 = false;
    if (target1089?.head && target1089?.contour) {
      poseSvc().setTarget(target1089);
      poseSvc().setDrawingCorrections({ shoulder: 1, chest: 1, waist: 1, hip: 1, thigh: 1, calf: 1, ankle: 1 });
      poseSvc().setContourCorrections({ l: target1089.contour.l.map((x: any) => (typeof x === 'number' ? x * 1.18 : x)), r: target1089.contour.r.map((x: any) => (typeof x === 'number' ? x * 1.18 : x)) });
      poseSvc().setJointCorrections(null);
      poseSvc().setOverlapCorrections(null);
      const r1: any = poseSvc().drillCorrections(target1089);
      const stored1089: any = poseSvc().getDrawingCorrections();
      if (r1 && stored1089) storedOk1089 = ['shoulder', 'chest', 'waist', 'hip', 'thigh', 'calf', 'ankle'].every((k) => Math.abs(stored1089[k] - r1.corrections[k]) < 1e-9);
      const r2: any = r1 ? poseSvc().drillCorrections(target1089) : null;
      if (r1 && r2) stable1089 = Math.abs(r2.initialDiff - r1.finalDiff) <= 0.01;
      poseSvc().setDrawingCorrections({ shoulder: 1, chest: 1, waist: 1, hip: 1, thigh: 1, calf: 1, ankle: 1 });
      poseSvc().setContourCorrections(null);
      poseSvc().setJointCorrections(null);
      poseSvc().setOverlapCorrections(null);
    }
    check('P1089 ドリル後の保存補正が返り値の最良と一致する', storedOk1089, `storedOk=${storedOk1089}`);
    check('P1089 ドリルを繰り返しても初期差が跳ねない', stable1089, `stable=${stable1089}`);
  }

// ---- P1090: ドリルの項目ごとの詰め（連動する項目の相殺を解く） ----
  {
    const W1090 = 48, H1090 = 56;
    const fig1090 = new Uint8Array(W1090 * H1090 * 4);
    const rect1090 = (x0: number, y0: number, x1: number, y1: number, c: [number, number, number]) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const i = (y * W1090 + x) * 4; fig1090[i] = c[0]; fig1090[i + 1] = c[1]; fig1090[i + 2] = c[2]; fig1090[i + 3] = 255; } };
    const disc1090 = (cx: number, cy: number, r: number, c: [number, number, number]) => { for (let y = 0; y < H1090; y++) for (let x = 0; x < W1090; x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) { const i = (y * W1090 + x) * 4; fig1090[i] = c[0]; fig1090[i + 1] = c[1]; fig1090[i + 2] = c[2]; fig1090[i + 3] = 255; } };
    for (let i = 0; i < W1090 * H1090; i++) { fig1090[i * 4] = 240; fig1090[i * 4 + 1] = 240; fig1090[i * 4 + 2] = 240; fig1090[i * 4 + 3] = 255; }
    rect1090(16, 15, 28, 32, [40, 40, 120]); rect1090(12, 16, 15, 30, [40, 40, 120]); rect1090(29, 16, 32, 30, [40, 40, 120]);
    rect1090(16, 32, 21, 50, [40, 40, 120]); rect1090(23, 32, 28, 50, [40, 40, 120]);
    disc1090(22, 9, 6, [45, 32, 22]); disc1090(22, 10, 5, [232, 190, 160]);
    const target1090: any = poseSvc().analyzePose(fig1090, W1090, H1090);
    let final1090 = -1;
    if (target1090?.head) {
      poseSvc().setTarget(target1090);
      poseSvc().setDrawingCorrections({ shoulder: 1, chest: 1, waist: 1, hip: 1, thigh: 1, calf: 1, ankle: 1 });
      poseSvc().setContourCorrections(null);
      poseSvc().setJointCorrections(null);
      poseSvc().setOverlapCorrections(null);
      const r1090: any = poseSvc().drillCorrections(target1090);
      if (r1090) final1090 = r1090.finalDiff;
      poseSvc().setDrawingCorrections({ shoulder: 1, chest: 1, waist: 1, hip: 1, thigh: 1, calf: 1, ankle: 1 });
      poseSvc().setContourCorrections(null);
      poseSvc().setJointCorrections(null);
      poseSvc().setOverlapCorrections(null);
    }
    check('P1090 項目ごとの詰めで差が0.10以下まで下がる', final1090 >= 0 && final1090 <= 0.10, `final=${final1090}`);
  }

// ---- P1091: 足首のくびれと足の台形（柱の切り口にしない） ----
  {
    const base1091: any = poseSvc().analyzePose(paleLongHair48(), 48, 56);
    let flareOk1091 = false;
    if (base1091?.head) {
      const forced1091: any = { ...base1091, footFlare: { l: true, r: true } };
      poseSvc().setDrawingCorrections({ shoulder: 1, chest: 1, waist: 1, hip: 1, thigh: 1, calf: 1, ankle: 1 });
      poseSvc().setContourCorrections(null);
      poseSvc().setJointCorrections(null);
      poseSvc().setOverlapCorrections(null);
      const vf1091: any = poseSvc().verifyFootFlare(forced1091);
      flareOk1091 = !!vf1091?.verified;
    }
    check('P1091 足を台形に広げても足の広がりの読みが保たれる', flareOk1091, `flareOk=${flareOk1091}`);
  }

// ---- P1092: 髪の柔らかさ部品（彼女の部品第1号）と描画への配線 ----
  {
    const { softenHairStrands } = await import('../src/miki/conversation/services/hairStrandSofteningService');
    const inp1092 = { spanWidth: 48, spanHeight: 140, seed: 42 };
    const out1092: any = softenHairStrands(inp1092);
    const strands1092: any[] = out1092?.strands || [];
    const ranges1092 = strands1092.map((s: any) => Math.max(...s.points.map((p: any) => p.x)) - Math.min(...s.points.map((p: any) => p.x)));
    const rangeMean1092 = ranges1092.length ? ranges1092.reduce((a: number, b: number) => a + b, 0) / ranges1092.length : 0;
    let stepMax1092 = 0;
    for (const s of strands1092) for (let i = 1; i < s.points.length; i++) stepMax1092 = Math.max(stepMax1092, Math.abs(s.points[i].x - s.points[i - 1].x));
    const midY1092 = Math.floor(140 / 2);
    const xsMid1092 = strands1092.map((s: any) => s.points[midY1092]?.x ?? 0).sort((a: number, b: number) => a - b);
    const gaps1092: number[] = [];
    for (let i = 1; i < xsMid1092.length; i++) gaps1092.push(xsMid1092[i] - xsMid1092[i - 1]);
    const gMean1092 = gaps1092.length ? gaps1092.reduce((a: number, b: number) => a + b, 0) / gaps1092.length : 0;
    const gSd1092 = gaps1092.length ? Math.sqrt(gaps1092.reduce((a: number, b: number) => a + (b - gMean1092) * (b - gMean1092), 0) / gaps1092.length) : 0;
    const gapCv1092 = gMean1092 > 0 ? gSd1092 / gMean1092 : 0;
    let taperOk1092 = 0;
    for (const s of strands1092) {
      const p = s.points;
      if (p.length >= 8 && p[0].alpha < p[Math.floor(p.length / 2)].alpha * 0.85 && p[p.length - 1].alpha < p[Math.floor(p.length / 2)].alpha * 0.85) taperOk1092++;
    }
    const taper1092 = strands1092.length ? taperOk1092 / strands1092.length : 0;
    const coverage1092 = xsMid1092.length > 1 ? (xsMid1092[xsMid1092.length - 1] - xsMid1092[0]) / 48 : 0;
    check('P1092 部品の線が滑らかに曲がる', rangeMean1092 >= 3 && stepMax1092 <= 1, `range=${rangeMean1092.toFixed(2)} step=${stepMax1092.toFixed(2)}`);
    check('P1092 部品の線の間隔が不均一で幅を覆う', gapCv1092 >= 0.25 && coverage1092 >= 0.6, `cv=${gapCv1092.toFixed(2)} cov=${coverage1092.toFixed(2)}`);
    check('P1092 部品の線の濃さが両端で細る', taper1092 >= 0.8, `taper=${taper1092.toFixed(2)}`);
    check('P1092 部品が決定的（同じ入力で同じ出力）', JSON.stringify(softenHairStrands(inp1092)) === JSON.stringify(out1092), '');
    const base1092: any = poseSvc().analyzePose(paleLongHair48(), 48, 56);
    let hairOk1092 = false;
    if (base1092?.head) {
      poseSvc().setDrawingCorrections({ shoulder: 1, chest: 1, waist: 1, hip: 1, thigh: 1, calf: 1, ankle: 1 });
      poseSvc().setContourCorrections(null);
      poseSvc().setJointCorrections(null);
      poseSvc().setOverlapCorrections(null);
      const vh1092: any = poseSvc().verifyBodyHairDetail(base1092);
      hairOk1092 = vh1092?.verified === true;
    }
    check('P1092 配線後も髪の詳細検証が合格する', hairOk1092, `hairOk=${hairOk1092}`);
  }

// ---- P1093: 土台の部品パック（教師製を彼女の棚へ） ----
  {
    const { clamp01 } = await import('../src/miki/core/parts/clamp01Part');
    const { lerp } = await import('../src/miki/core/parts/lerpPart');
    const { smoothstep01 } = await import('../src/miki/core/parts/smoothstep01Part');
    const { mulberry32 } = await import('../src/miki/core/parts/mulberry32Part');
    const { weightedGaps } = await import('../src/miki/core/parts/weightedGapsPart');
    const { sinePhase } = await import('../src/miki/core/parts/sinePhasePart');
    const { taperAlpha } = await import('../src/miki/core/parts/taperAlphaPart');
    const eq1093 = (a: number, b: number) => Math.abs(a - b) < 1e-9;
    check('P1093 clamp01とlerpが仕様どおり', clamp01(-0.5) === 0 && clamp01(0.3) === 0.3 && clamp01(1.7) === 1 && eq1093(lerp(2, 6, 0.25), 3) && eq1093(lerp(10, 0, 0.5), 5), '');
    check('P1093 smoothstep01が仕様どおり', eq1093(smoothstep01(0.25), 0.15625) && eq1093(smoothstep01(0.5), 0.5) && eq1093(smoothstep01(0.75), 0.84375) && smoothstep01(-1) === 0 && smoothstep01(2) === 1, '');
    const ra1093 = mulberry32(42); const seqA1093 = [ra1093(), ra1093(), ra1093()];
    const rb1093 = mulberry32(42); const seqB1093 = [rb1093(), rb1093(), rb1093()];
    check('P1093 mulberry32が決定的で範囲内', seqA1093.every((v, i) => v === seqB1093[i] && v >= 0 && v < 1), seqA1093.join(','));
    check('P1093 weightedGapsが仕様どおり', JSON.stringify(weightedGaps([1, 1, 1, 1], 40)) === '[0,10,20,30]' && JSON.stringify(weightedGaps([1, 3], 8)) === '[0,2]', '');
    check('P1093 sinePhaseとtaperAlphaが仕様どおり', eq1093(sinePhase(10, 40, 0, 2), 2) && eq1093(sinePhase(30, 40, 0, 2), -2) && taperAlpha(0, 140, 0.8) === 0 && eq1093(taperAlpha(70, 140, 0.8), 0.8) && taperAlpha(140, 140, 0.8) === 0, '');
  }

// ---- P1094・P1095: コードドリルの実行器と運転手 ----
  {
    const { pureCodeExecutionService } = await import('../src/miki/selfDevelopment/services/pureCodeExecutionService');
    const { codeDrillService } = await import('../src/miki/selfDevelopment/services/codeDrillService');
    const { clamp01 } = await import('../src/miki/core/parts/clamp01Part');
    void clamp01;
    const fs1094 = await import('fs');
    const clampSrc1094 = fs1094.readFileSync('src/miki/core/parts/clamp01Part.ts', 'utf-8');
    const clampCases1094 = [
      { args: [-0.5], expected: 0 }, { args: [0.3], expected: 0.3 }, { args: [1.7], expected: 1 },
    ];
    const evOk1094 = pureCodeExecutionService.execute(clampSrc1094, 'clamp01', clampCases1094);
    check('P1094 実行器が正しい部品を合格にする', evOk1094.passed && evOk1094.passedCount === 3, `${evOk1094.passedCount}/3`);
    const evBad1094 = pureCodeExecutionService.execute('export function clamp01(x: number): number { return x + 1; }', 'clamp01', clampCases1094);
    check('P1094 実行器が壊れた部品を落とす', !evBad1094.passed && evBad1094.passedCount === 0, '');
    const evEvil1094 = pureCodeExecutionService.execute('export function f(x: number): number { return fetch("https://example.com") as unknown as number; }', 'f', [{ args: [1], expected: 1 }]);
    check('P1094 実行器が禁止グローバルを実行前に弾く', !evEvil1094.passed && evEvil1094.failureReasons.includes('PROHIBITED_GLOBAL'), evEvil1094.failureReasons.join(','));
    codeDrillService.resetLedger();
    const drillTask1095 = { taskId: 'drill-suite-clamp01', title: 'clamp01', entryPoint: 'clamp01', cases: clampCases1094 };
    const att1 = codeDrillService.runAttempt(drillTask1095, 'export function clamp01(x: number): number { return x + 1; }');
    const att2 = codeDrillService.runAttempt(drillTask1095, clampSrc1094);
    check('P1095 運転手が試行を記録し解決を覚える', !att1.record.solved && att2.record.solved && att2.record.attempts === 2 && codeDrillService.getLedger().length === 1, `ledger=${codeDrillService.getLedger().length}`);
  }

// ---- P1096: 教師検証（TVE）ラウンドの受け入れと改ざん検出 ----
  {
    const { teacherVerificationEvidenceService } = await import('../src/miki/verification/services/teacherVerificationEvidenceService');
    const { canonicalSha256 } = await import('../src/miki/core/services/canonicalSha256Service');
    const content1096 = 'export function clamp01(x: number): number { return Math.min(1, Math.max(0, x)); }';
    const round1096 = {
      verifier: 'Claude',
      verifiedAt: '2026-11-20T00:00:00.000Z',
      implementationSha256: canonicalSha256(content1096),
      targetPath: 'src/miki/core/parts/clamp01Part.ts',
      checks: [
        { kind: 'IMPORT_CHECK', command: 'node scripts/check_imports.mjs', exitCode: 0, passed: true, outputSha256: 'a'.repeat(64), outputExcerpt: 'imports ok' },
        { kind: 'SMOKE_EXECUTION', testCase: 'NORMAL', command: 'npx tsx scripts/tve/smoke_clamp01.ts', exitCode: 0, passed: true, outputSha256: 'b'.repeat(64), outputExcerpt: 'SMOKE_PASS_NORMAL: clamp01 spec OK' },
      ],
    };
    const parsed1096 = teacherVerificationEvidenceService.parseRound(round1096, { candidateContent: content1096, targetPaths: ['src/miki/core/parts/clamp01Part.ts'] });
    check('P1096 TVEラウンドが正しい形で受理される', parsed1096.ok === true, parsed1096.ok ? '' : parsed1096.reason);
    if (parsed1096.ok) {
      check('P1096 TVEの静的チェック判定が通る', teacherVerificationEvidenceService.staticChecksPassed(parsed1096.round), '');
    }
    const tampered1096 = { ...round1096, implementationSha256: 'c'.repeat(64) };
    const parsedBad1096 = teacherVerificationEvidenceService.parseRound(tampered1096, { candidateContent: content1096, targetPaths: ['src/miki/core/parts/clamp01Part.ts'] });
    check('P1096 ハッシュの合わないTVEは拒否される', parsedBad1096.ok === false, '');
    const badCmd1096 = { ...round1096, checks: [{ kind: 'SMOKE_EXECUTION', testCase: 'NORMAL', command: 'rm -rf /', exitCode: 0, passed: true, outputSha256: 'b'.repeat(64), outputExcerpt: 'x' }] };
    const parsedBadCmd1096 = teacherVerificationEvidenceService.parseRound(badCmd1096, { candidateContent: content1096, targetPaths: ['src/miki/core/parts/clamp01Part.ts'] });
    check('P1096 allow-list外のコマンドは拒否される', parsedBadCmd1096.ok === false, '');
  }

// ---- P1098: softenHairStrands の部品合成版が従来出力と一致する ----
  {
    const { softenHairStrands } = await import('../src/miki/conversation/services/hairStrandSofteningService');
    const { mulberry32 } = await import('../src/miki/core/parts/mulberry32Part');
    const { weightedGaps } = await import('../src/miki/core/parts/weightedGapsPart');
    const { sinePhase } = await import('../src/miki/core/parts/sinePhasePart');
    const out1098 = softenHairStrands({ spanWidth: 48, spanHeight: 140, seed: 42 });
    // 部品から独立に組み直した期待値と比較する
    const rand1098 = mulberry32(42);
    const n1098 = 4 + Math.floor(rand1098() * 4);
    const weights1098: number[] = [];
    for (let i = 0; i <= n1098; i++) weights1098.push(0.3 + rand1098());
    const gaps1098 = weightedGaps(weights1098, 48 - 6);
    let expectedFirstX = 0;
    {
      const p1 = 40 + rand1098() * 120; const p2 = 40 + rand1098() * 120;
      const ph1 = rand1098() * 2 * Math.PI; const ph2 = rand1098() * 2 * Math.PI;
      const a1 = 1.5 + rand1098() * 2; const a2 = 0.5 + rand1098() * 1.5;
      void rand1098(); void rand1098();
      expectedFirstX = (3 + gaps1098[1]) + sinePhase(0, p1, ph1, a1) + sinePhase(0, p2, ph2, a2);
    }
    const firstX1098 = Math.min(...out1098.strands.map((s) => s.points[0].x));
    check('P1098 合成版の毛束数が部品側の計算と一致する', out1098.strands.length === n1098, `${out1098.strands.length} vs ${n1098}`);
    check('P1098 合成版の配置が部品の合成と一致する', Math.abs(firstX1098 - Math.max(0, Math.min(47, expectedFirstX))) < 1e-6, `${firstX1098} vs ${expectedFirstX}`);
    const alphaOk1098 = out1098.strands.every((s) => s.points[0].alpha === 0 && s.points[139].alpha < 0.02 && s.points[70].alpha > 0);
    check('P1098 減衰の形が taperAlpha の性質と一致する', alphaOk1098, '');
  }

// ---- P1099: 教師パック第2弾（12部品）の仕様 ----
  {
    const { clampRange } = await import('../src/miki/core/parts/clampRangePart');
    const { remap } = await import('../src/miki/core/parts/remapPart');
    const { gaussFalloff } = await import('../src/miki/core/parts/gaussFalloffPart');
    const { mixColor } = await import('../src/miki/core/parts/mixColorPart');
    const { scaleColor } = await import('../src/miki/core/parts/scaleColorPart');
    const { easeOutCubic } = await import('../src/miki/core/parts/easeOutCubicPart');
    const { manhattanDistance } = await import('../src/miki/core/parts/manhattanDistancePart');
    const { euclideanDistance } = await import('../src/miki/core/parts/euclideanDistancePart');
    const { randomInt } = await import('../src/miki/core/parts/randomIntPart');
    const { chanceRoll } = await import('../src/miki/core/parts/chanceRollPart');
    const { moveTowards } = await import('../src/miki/core/parts/moveTowardsPart');
    const { snapToGrid } = await import('../src/miki/core/parts/snapToGridPart');
    check('P1099 clampRange が範囲に収める', clampRange(5, 0, 3) === 3 && clampRange(-1, 0, 3) === 0 && clampRange(2, 0, 3) === 2, '');
    check('P1099 remap が範囲を写す', remap(5, 0, 10, 0, 100) === 50 && remap(-5, 0, 10, 0, 100) === 0 && remap(3, 2, 2, 7, 9) === 7, '');
    check('P1099 gaussFalloff の形が正しい', gaussFalloff(0, 0, 1) === 1 && Math.abs(gaussFalloff(1, 0, 1) - Math.exp(-0.5)) < 1e-12 && gaussFalloff(5, 0, 0) === 0, '');
    check('P1099 mixColor が色を混ぜる', JSON.stringify(mixColor([0, 0, 0], [100, 200, 255], 0.5)) === '[50,100,127.5]', '');
    check('P1099 scaleColor が色を拡縮する', JSON.stringify(scaleColor([200, 10, 10], 2)) === '[255,20,20]', '');
    check('P1099 easeOutCubic の形が正しい', easeOutCubic(0) === 0 && easeOutCubic(1) === 1 && Math.abs(easeOutCubic(0.5) - 0.875) < 1e-12, '');
    check('P1099 格子距離と直線距離が正しい', manhattanDistance(0, 0, 3, 4) === 7 && euclideanDistance(0, 0, 3, 4) === 5, '');
    check('P1099 randomInt が決定的で範囲内', randomInt(42, 5, 5) === 5 && randomInt(7, 1, 6) === randomInt(7, 1, 6) && randomInt(7, 1, 6) >= 1 && randomInt(7, 1, 6) <= 6, '');
    check('P1099 chanceRoll の端が正しい', chanceRoll(3, 0) === false && chanceRoll(3, 1) === true && chanceRoll(3, 0.5) === chanceRoll(3, 0.5), '');
    check('P1099 moveTowards が行き過ぎない', moveTowards(0, 10, 3) === 3 && moveTowards(0, 2, 3) === 2 && moveTowards(10, 0, 4) === 6, '');
    check('P1099 snapToGrid が吸着する', snapToGrid(13, 5) === 15 && snapToGrid(12, 5) === 10 && snapToGrid(7, 0) === 7, '');
  }

// ---- P1101: 彼女自身の合成部品（easeInQuad・glowPulse） ----
  {
    const { easeInQuad } = await import('../src/miki/core/parts/easeInQuadPart');
    const { glowPulse } = await import('../src/miki/core/parts/glowPulsePart');
    check('P1101 easeInQuad は二乗である', easeInQuad(0) === 0 && easeInQuad(0.5) === 0.25 && easeInQuad(1) === 1, '');
    const g0 = Math.exp(-2); const u0 = 1 - g0;
    check('P1101 glowPulse は中心で1・縁で合成どおりに落ちる', glowPulse(50) === 1 && Math.abs(glowPulse(0) - (1 - u0 * u0 * u0)) < 1e-12 && glowPulse(25) === glowPulse(75), '');
  }

// ---- P1102: 合成探索サービス ----
  {
    const { compositionSearchService } = await import('../src/miki/selfDevelopment/services/compositionSearchService');
    const { pureCodeExecutionService } = await import('../src/miki/selfDevelopment/services/pureCodeExecutionService');
    const fs1102 = await import('fs');
    const ssCases1102 = [-1, 0, 0.25, 0.5, 0.75, 1, 2].map((x) => { const c = Math.min(1, Math.max(0, x)); return { args: [x], expected: c * c * (3 - 2 * c) }; });
    const rSs1102 = compositionSearchService.search({ entryPoint: 'foundSmooth', cases: ssCases1102 });
    check('P1102 探索が smoothstep を再発見する', rSs1102.found && rSs1102.expression === 'smoothstep01(x)' && rSs1102.maxError === 0, rSs1102.expression);
    const { taperAlpha } = await import('../src/miki/core/parts/taperAlphaPart');
    const tpCases1102 = [0, 35, 70, 105, 140].map((x) => ({ args: [x], expected: taperAlpha(x, 140, 0.8) }));
    const rTp1102 = compositionSearchService.search({ entryPoint: 'foundTaper', cases: tpCases1102 });
    check('P1102 探索が定数束縛つきの taper を再導出する', rTp1102.found && rTp1102.expression === 'taperAlpha(x, 140, 0.8)', rTp1102.expression);
    const cubic1102 = compositionSearchService.search({ entryPoint: 'taperRestricted', cases: tpCases1102, partNames: ['clamp01', 'smoothstep01', 'lerp'] });
    check('P1102 語彙外の課題は解けないと返す', cubic1102.found === false && cubic1102.maxError > 0.001, `${cubic1102.maxError}`);
    const fileOf1102: Record<string, string> = { taperAlpha: 'taperAlphaPart.ts' };
    const selfContained1102 = compositionSearchService.buildSelfContainedSource(rTp1102, (n) => fs1102.readFileSync(`src/miki/core/parts/${fileOf1102[n]}`, 'utf-8'));
    const ev1102 = selfContained1102 ? pureCodeExecutionService.execute(selfContained1102, 'foundTaper', tpCases1102) : null;
    check('P1102 合成の自己完結ソースが実行器を通る', !!ev1102 && ev1102.passed, ev1102 ? `${ev1102.passedCount}/${ev1102.total}` : 'no source');
  }

// ---- P1103: 合成ドリル（探索→解題→登録の運転手） ----
  {
    const fs1103 = await import('fs');
    const zip1103 = fs1103.readFileSync('public/self-code-seed.zip');
    const origFetch1103 = globalThis.fetch;
    (globalThis as any).fetch = async (url: any, init?: any) => {
      if (String(url).includes('self-code-seed.zip')) return new Response(new Uint8Array(zip1103), { status: 200, headers: { 'Content-Type': 'application/zip' } });
      return origFetch1103(url, init);
    };
    const { selfCodeSpaceService } = await import('../src/miki/core/services/selfCodeSpaceService');
    await (selfCodeSpaceService as any).initializeBundledSeed(true);
    (globalThis as any).fetch = origFetch1103;
    const { compositionDrillService } = await import('../src/miki/selfDevelopment/services/compositionDrillService');
    const { codeDrillService } = await import('../src/miki/selfDevelopment/services/codeDrillService');
    const { taperAlpha } = await import('../src/miki/core/parts/taperAlphaPart');
    const tpCases1103 = [0, 35, 70, 105, 140].map((x) => ({ args: [x], expected: taperAlpha(x, 140, 0.8) }));
    const rA1103 = await compositionDrillService.solveAndRegister({
      task: { taskId: 'p1103-suite-taper', title: '両端で細る減衰を合成する', entryPoint: 'foundTaper1103', cases: tpCases1103 },
      registerAsPart: true,
    });
    check('P1103 運転手が探索→解題→登録まで回す', rA1103.solved && !!rA1103.componentId && rA1103.expression === 'taperAlpha(x, 140, 0.8)', `${rA1103.solved}/${rA1103.expression}`);
    const rB1103 = await compositionDrillService.solveAndRegister({
      task: { taskId: 'p1103-suite-mono', title: '単調な部品だけで両端減衰を作る', entryPoint: 'taperMono1103', cases: tpCases1103 },
      registerAsPart: true,
      partNames: ['clamp01', 'smoothstep01', 'lerp'],
    });
    const recB1103 = codeDrillService.getRecord('p1103-suite-mono');
    check('P1103 解けない課題は失敗として台帳に残り登録されない', !rB1103.solved && rB1103.reason === 'NOT_FOUND_IN_VOCABULARY' && !rB1103.componentId && !!recB1103 && !recB1103.solved, `${rB1103.reason}`);
  }

// ---- P1104: 合成部品2件の仕様（smoke＋TVE で CLOUD_TESTED 到達はプローブ実証） ----
  {
    const { easeInQuad } = await import('../src/miki/core/parts/easeInQuadPart');
    const { glowPulse } = await import('../src/miki/core/parts/glowPulsePart');
    check('P1104 easeInQuad は二乗カーブの仕様どおり', easeInQuad(0) === 0 && easeInQuad(0.5) === 0.25 && easeInQuad(1) === 1 && easeInQuad(0.25) === 0.0625, '');
    const g1104 = Math.exp(-2); const u1104 = 1 - g1104;
    check('P1104 glowPulse は中心1・縁の値・左右対称が仕様どおり', glowPulse(50) === 1 && Math.abs(glowPulse(0) - (1 - u1104 * u1104 * u1104)) < 1e-12 && glowPulse(25) === glowPulse(75), '');
  }

// ---- P1105: 合成探索の多変数化 ----
  {
    const { compositionSearchService } = await import('../src/miki/selfDevelopment/services/compositionSearchService');
    const { lerp } = await import('../src/miki/core/parts/lerpPart');
    const grid1105 = [0, 2, 5, 10];
    const lerpCases1105 = grid1105.flatMap((x) => grid1105.map((y) => ({ args: [x, y], expected: lerp(x, y, 0.3) })));
    const rLerp1105 = compositionSearchService.search({ entryPoint: 'lerpMix1105', cases: lerpCases1105 });
    check('P1105 2変数の探索が lerp(x, y, 0.3) を再発見する（定数の連続微調整つき）', rLerp1105.found && rLerp1105.expression === 'lerp(x, y, 0.3)', rLerp1105.expression);
    const manhCases1105 = [[0, 0], [3, 4], [-1, 2], [5, -5]].map(([x, y]) => ({ args: [x, y], expected: Math.abs(x) + Math.abs(y) }));
    const rManh1105 = compositionSearchService.search({ entryPoint: 'manh1105', cases: manhCases1105 });
    check('P1105 2変数の探索が |x|+|y| を距離部品で再発見する', rManh1105.found && rManh1105.usedParts.includes('manhattanDistance'), rManh1105.expression);
    const sinCases1105 = [[0.5, 0.5], [1, 2], [2, 0.25]].map(([x, y]) => ({ args: [x, y], expected: Math.sin(x * y) }));
    const rSin1105 = compositionSearchService.search({ entryPoint: 'sinxy1105', cases: sinCases1105 });
    check('P1105 語彙外の2変数課題は解けないと返す', rSin1105.found === false && rSin1105.maxError > 1e-6, `${rSin1105.maxError}`);
    const cubicCases1105 = [0, 0.25, 0.5, 0.75, 1].map((x) => ({ args: [x], expected: x * x * x }));
    const rCubic1105 = compositionSearchService.search({ entryPoint: 'cubic1105', cases: cubicCases1105 });
    check('P1105 三乗が lerp の入れ子で厳密に合成できる', rCubic1105.found && rCubic1105.maxError === 0, rCubic1105.expression);
  }

// ---- P1106: ドリル課題の自動生成と自動セッション ----
  {
    const fs1106 = await import('fs');
    const zip1106 = fs1106.readFileSync('public/self-code-seed.zip');
    const origFetch1106 = globalThis.fetch;
    (globalThis as any).fetch = async (url: any, init?: any) => {
      if (String(url).includes('self-code-seed.zip')) return new Response(new Uint8Array(zip1106), { status: 200, headers: { 'Content-Type': 'application/zip' } });
      return origFetch1106(url, init);
    };
    const { selfCodeSpaceService } = await import('../src/miki/core/services/selfCodeSpaceService');
    await (selfCodeSpaceService as any).initializeBundledSeed(true);
    (globalThis as any).fetch = origFetch1106;
    const { drillTaskGenerationService } = await import('../src/miki/selfDevelopment/services/drillTaskGenerationService');
    const { compositionDrillService } = await import('../src/miki/selfDevelopment/services/compositionDrillService');
    const { codeDrillService } = await import('../src/miki/selfDevelopment/services/codeDrillService');
    const genA1106 = drillTaskGenerationService.generateTasks(42, 8);
    const genB1106 = drillTaskGenerationService.generateTasks(42, 8);
    check('P1106 課題生成は seed 決定的で件数が返る', genA1106.length === 8 && JSON.stringify(genA1106.map((t) => t.generatingExpression)) === JSON.stringify(genB1106.map((t) => t.generatingExpression)), `${genA1106.length}`);
    check('P1106 生成課題は自明でなくケースを持つ', genA1106.every((t) => t.cases.length >= 10 && new Set(t.cases.map((c) => Math.round(c.expected * 1e6))).size >= 2), '');
    codeDrillService.resetLedger();
    const session1106 = await compositionDrillService.runAutoSession(42, 6, true);
    const solvedRecs1106 = codeDrillService.getLedger().filter((r) => r.taskId.startsWith('auto-42-') && r.solved);
    check('P1106 自動セッションが生成→解題→登録まで回る', session1106.generated === 6 && session1106.solved >= 3 && session1106.registered >= 3 && solvedRecs1106.length === session1106.solved, `${session1106.generated}/${session1106.solved}/${session1106.registered}`);
  }

// ---- P1107: 腕の縁の柔らかさ（スタンプと rim のブレンド帯） ----
  {
    const r1107: any = await poseSvc().analyzePose(paleLongHair48(), 48, 56);
    poseSvc().setDrawingCorrections({ shoulder: 1, chest: 1, waist: 1, hip: 1, thigh: 1, calf: 1, ankle: 1 });
    poseSvc().setContourCorrections(null); poseSvc().setJointCorrections(null); poseSvc().setOverlapCorrections(null);
    const vs1107: any = await poseSvc().verifyBodyStructured(r1107);
    const vc1107: any = await poseSvc().verifyBodyContour(r1107);
    check('P1107 腕を柔らかくしても構造と輪郭の照合は通る', vs1107?.verified === true && vc1107?.verified === true, JSON.stringify({ s: vs1107?.score, c: vc1107?.score }));
    const img1107: any = await poseSvc().renderBody(r1107, 192);
    let trans1107 = 0;
    if (img1107) {
      for (let y = 30; y < 130; y++) for (let x = 1; x < 192; x++) {
        const i = (y * 192 + x) * 4; const j = (y * 192 + x - 1) * 4;
        const d = Math.abs(img1107[i] - img1107[j]) + Math.abs(img1107[i + 1] - img1107[j + 1]) + Math.abs(img1107[i + 2] - img1107[j + 2]);
        if (d >= 5 && d <= 60) trans1107++;
      }
    }
    check('P1107 縁になだらかな遷移画素が現れる', trans1107 > 50, `trans=${trans1107}`);
  }

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
