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

// ---- 社交の定型も毎回同じにしない（P566） ----
const greet1 = await conversationCoreService.execute({ prompt: 'おはよう' } as any);
const greet2 = await conversationCoreService.execute({ prompt: 'おはよう' } as any);
check('P566 挨拶が毎回同じ文にならない', String((greet1 as any).replyText || '') !== String((greet2 as any).replyText || ''), `${String((greet1 as any).replyText || '').slice(0, 60)} / ${String((greet2 as any).replyText || '').slice(0, 60)}`);
const wakeup = await conversationCoreService.execute({ prompt: '今起きたよ' } as any);
check('P566 起きた、にも朝の挨拶で返す', String((wakeup as any).replyText || '').includes('おはよう'), String((wakeup as any).replyText || '').slice(0, 120));

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
