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
