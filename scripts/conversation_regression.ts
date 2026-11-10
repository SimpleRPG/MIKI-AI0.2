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
storageService.setItem('miki_pending_topic_question_v1', JSON.stringify({ terms: ['モコロン'], question: 'モコロンは、いつごろから知っていますか？', at: Date.now() }));
const topicAnswer = await conversationCoreService.execute({ prompt: '綿毛が取れるんだよ' } as any);
check('P574 質問への短い答えは答えとして受ける', String((topicAnswer as any).replyText || '').includes('そっか') || String((topicAnswer as any).replyText || '').includes('なるほど'), String((topicAnswer as any).replyText || '').slice(0, 160));
storageService.setItem('miki_pending_topic_question_v1', JSON.stringify({ terms: ['モコロン'], question: 'モコロンは、いつごろから知っていますか？', at: Date.now() }));
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
storageService.setItem('miki_unknown_pending_v1', JSON.stringify({ term: 'ホニャララ2', askedAt: Date.now() }));
conversationFactIntakeService.intakeFromUserText('ホニャララ2かわいいよね', []);
check('P579 感想は意味として取り込まない', !japaneseDictionaryService.has('ホニャララ2'));
storageService.setItem('miki_unknown_pending_v1', JSON.stringify({ term: 'ホニャララ3', askedAt: Date.now() }));
conversationFactIntakeService.intakeFromUserText('ホニャララ3は山に住む鳥だよ', []);
check('P579 聞き返しへの説明は取り込む', japaneseDictionaryService.has('ホニャララ3'));
const fragReply = await conversationCoreService.execute({ prompt: '猫に触りたいな' } as any);
check('P579 活用の断片を主題にしない', !fragReply.replyText.includes('触り、'), fragReply.replyText.slice(0, 120));

// ---- 時間帯・季節の感覚（P580） ----
const RealDate = Date;
class FakeNightDate extends RealDate {
  constructor(...args: any[]) { super(...(args.length ? args : ['2026-12-24T23:30:00+09:00'] as any)); }
  static now() { return new RealDate('2026-12-24T23:30:00+09:00').getTime(); }
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
storageService.setItem('miki_pending_topic_question_v1', JSON.stringify({ terms: ['モコロン'], question: 'モコロンは、いつごろから知っていますか？', at: Date.now() }));
const followAnswer = await conversationCoreService.execute({ prompt: 'モコロンは綿毛が取れる、羊みたいなパルだよ' } as any);
check('P586 答えには受け止め＋続きの質問が付く', (followAnswer.replyText.includes('そっか') || followAnswer.replyText.includes('なるほど')) && followAnswer.replyText.includes('？') && !followAnswer.replyText.includes('いつごろから知っていますか'), followAnswer.replyText.slice(0, 200));
const followPending = JSON.parse(storageService.getItem('miki_pending_topic_question_v1') || 'null');
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
storageService.setItem('miki_pending_topic_question_v1', JSON.stringify({ terms: ['モコロン'], question: 'モコロンは、いつごろから知っていますか？', at: Date.now() }));
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
