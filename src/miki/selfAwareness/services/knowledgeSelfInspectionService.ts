import { storageService } from '../../../services/storageService';
import { systemLogger } from '../../../services/systemLogger';
import { japaneseDictionaryService } from '../../research/services/japaneseDictionaryService';
import { lexicalRelationService } from '../../memory/services/lexicalRelationService';
import { claimDatabaseService } from '../../memory/services/claimDatabaseService';
import { knowledgeConnectivityService } from '../../memory/services/knowledgeConnectivityService';
import { worldModelGraphService } from './worldModelGraphService';
import { knowledgeGapService } from '../../unknown/services/knowledgeGapService';
import { reusableComponentFactoryService } from '../../core/services/reusableComponentFactoryService';
import { dialogueExampleRecallService } from '../../memory/services/dialogueExampleRecallService';
import { teacherLessonRecallService } from '../../memory/services/teacherLessonRecallService';
import { analogyCandidateService } from './analogyCandidateService';
import { desireService } from './desireService';
import { productionConflictService } from './productionConflictService';
import { personaProfileService } from '../../conversation/services/personaProfileService';
import { procedureChunkingService } from '../../execution/services/procedureChunkingService';
import { episodeDistillationService } from '../../conversation/services/episodeDistillationService';
import { codeSynthesisStatsService } from '../../selfDevelopment/services/codeSynthesisStatsService';
import { capabilityGapService } from '../../capability/services/capabilityGapService';
import { codeComponentSpecService } from '../../selfDevelopment/services/codeComponentSpecService';
import { codeComponentPromotionBridgeService } from '../../selfDevelopment/services/codeComponentPromotionBridgeService';
import { multiStepReasoningService } from './multiStepReasoningService';
import { idleActionService } from './idleActionService';
import { visualPatternService } from '../../conversation/services/visualPatternService';
import { visualScenePatternService } from '../../conversation/services/visualScenePatternService';
import { mistakeNotebookService } from './mistakeNotebookService';
import { knowledgeConsolidationService } from './knowledgeConsolidationService';
import { specialDayService } from './specialDayService';
import { diaryService } from './diaryService';
import { selfPreferenceService } from './selfPreferenceService';
import { gamePlayService } from './gamePlayService';
import { groundedRebuttalService } from './groundedRebuttalService';
import { creativeWritingService } from './creativeWritingService';
import { dreamService } from './dreamService';
import { duoDialogueService } from './duoDialogueService';
import { motionPatternService } from './motionPatternService';
import { avatarPresenceService } from './avatarPresenceService';
import { computeResourceService } from './computeResourceService';
import { swarmVerificationService } from './swarmVerificationService';
import { visualFigureService } from '../../conversation/services/visualFigureService';
import { videoSceneService } from '../../conversation/services/videoSceneService';
import { visualPoseService } from '../../conversation/services/visualPoseService';

/**
 * P501: 知識と語彙の自己点検。
 *
 * これまでの自己点検は「問題が起きた所」中心だった（矛盾の
 * スキャン、ログの自己レビュー、検索の自己診断）。これは
 * 知識と語彙そのものの健康診断で、辞書の育ち・意味が付いて
 * いない語の残り・世界の関係の仮の割合・知識の接続・学習
 * 待ちの状態を定期的に数え、記録する。
 *
 * 見つけた「意味待ちの語」は、既存の意味学習ループ
 * （UNKNOWN_TERM gap）へ自動で流す。それ以外の所見は
 * 記録とログに残すだけにし、勝手な削除や変更はしない。
 */
export interface KnowledgeSelfInspectionRecord {
  inspectedAt: number;
  personalDictionary: number;
  learnedDictionaryEntries: number;
  lexicalRelations: number;
  paraphrasePairs: number;
  termComponents: number;
  glosslessCount: number;
  glosslessSample: string[];
  worldEntities: number;
  worldRelations: number;
  provisionalRelations: number;
  claims: number;
  connectivity: { total: number; connected: number; weak: number; orphaned: number };
  openGaps: number;
  parkedGaps: number;
  gapsRaised: number;
  materiallessCount: number;
  materiallessSample: string[];
  dialogueMaterialGapsRaised: number;
  analogyCandidatesCreated: number;
  procedureChunksCreated: number;
  episodeTopicsDistilled: number;
  gapPlanPhases: Record<string, number>;
  desireSummary: { talk: number; learn: number; topTalk: string[] };
  desireGapsRaised: number;
  productionConflicts: { total: number; byFamily: Record<string, number> };
  codeComponents: { total: number; verified: number };
  codeSynthesis: { total: number; succeeded: number; byReason: Record<string, number> };
  codeGapsOpen: number;
  codeSpecsDrafted: number;
  codeSpecsSupplied: number;
  // P921: 昇格ゲートを用意した部品／DEVICE_TESTED まで進んだ部品
  codeGatesPrepared: number;
  codeDeviceTested: number;
  // P922: 多段の先読みの利用回数と、最も深く読めた段数
  reasoningLookAheads: number;
  reasoningDeepestChain: number;
  idleActionsChosen: number;
  visualPatterns: number;
  visualScenePatterns: number;
  mistakesRecorded: number;
  mistakesRecurring: number;
  sleepRuns: number;
  specialDays: number;
  diaryEntries: number;
  grownPreferences: number;
  gameSessions: number;
  gameWins: number;
  rebuttalsMade: number;
  creativeWorks: number;
  dreamsRecorded: number;
  duoDialogues: number;
  motionPatterns: number;
  avatarPresence: number;
  computeResourcesMeasured: number;
  swarmVerifications: number;
  visualFigures: number;
  videoScenes: number;
  videoMotions: number;
  visualPoses: number;
  visualPoseMotions: number;
  findings: string[];
}

const STORAGE_KEY = 'miki_knowledge_self_inspection_v1';
const MAX_RECORDS = 10;
const GLOSSLESS_GAP_LIMIT = 5;
const DIALOGUE_MATERIAL_GAP_LIMIT = 3;
const DESIRE_GAP_LIMIT = 2;

class KnowledgeSelfInspectionService {
  public inspect(): KnowledgeSelfInspectionRecord {
    const findings: string[] = [];

    // 辞書の育ち。
    const personal = japaneseDictionaryService.listPersonal();
    const learned = personal.filter((e) => (e.semanticIds || []).includes('learned:definition')).length;

    // 意味が付いていない用語部品。
    const termComponents = (reusableComponentFactoryService.list() as unknown as Array<Record<string, unknown>>).filter(
      (item) => item.componentKind === 'KNOWLEDGE' && item.componentType === 'TERM_KNOWLEDGE',
    );
    const glosslessTerms = [
      ...new Set(
        termComponents
          .filter((item) => item.needsGloss === true && typeof item.term === 'string' && item.term)
          .map((item) => String(item.term)),
      ),
    ];

    // 意味待ちの語を意味学習へ流す。既に開いている gap（休止中
    // を含む）がある語は再検出しない（休止を勝手に解除しない）。
    const openGaps = knowledgeGapService.listOpen(500);
    const openTargets = new Set(
      openGaps.filter((g) => g.type === 'UNKNOWN_TERM').map((g) => g.identity?.target).filter(Boolean),
    );
    let gapsRaised = 0;
    for (const term of glosslessTerms) {
      if (gapsRaised >= GLOSSLESS_GAP_LIMIT) break;
      if (openTargets.has(term)) continue;
      try {
        knowledgeGapService.detect({
          query: `用語の意味を学ぶ: ${term}`,
          reason: '自己点検で、意味が付いていない用語が残っていることが分かったため。',
          type: 'UNKNOWN_TERM',
          target: term,
          priority: 40,
        });
        gapsRaised++;
      } catch { /* 1語の失敗で点検全体は止めない */ }
    }
    if (glosslessTerms.length > 0) {
      findings.push(`意味が付いていない用語が${glosslessTerms.length}件残っている${gapsRaised > 0 ? `（${gapsRaised}件を意味学習へ流した）` : ''}`);
    }

    // 言い換えの対（自分の言葉で言い直して意味を確かめる力の在庫）。
    const paraphrasePairs = lexicalRelationService.paraphrasePairs().length;
    if (paraphrasePairs === 0) {
      findings.push('言い換えの対が1件も無く、自分の言葉で言い直す検証ができない');
    }

    // 世界の関係。
    const relations = worldModelGraphService.relations();
    const provisional = relations.filter((r) => r.provisional).length;
    if (relations.length >= 20 && provisional / relations.length > 0.6) {
      findings.push(`世界の関係の${Math.round((provisional / relations.length) * 100)}%が仮のままになっている`);
    }

    // 知識と接続。
    const claims = claimDatabaseService.listClaims().length;
    const connectivity = knowledgeConnectivityService.summarize();
    if (connectivity.orphaned > 0) {
      findings.push(`孤立した知識が${connectivity.orphaned}件ある`);
    }

    // 学習待ち。
    const parked = openGaps.filter((g) => knowledgeGapService.isRetryParked(g)).length;
    if (parked > 0) {
      findings.push(`試行上限で休止中の学習待ちが${parked}件ある`);
    }

    // P899: 事実はあるのに話し方の材料が無い話題。知っているのに
    // 上手く話せない状態を、彼女自身の点検で学習の穴に変える。
    const materiallessTopics = this.findTopicsWithoutDialogueMaterial(10);
    const openQueries = new Set(openGaps.map((g) => g.query));
    let dialogueMaterialGapsRaised = 0;
    for (const topic of materiallessTopics) {
      if (dialogueMaterialGapsRaised >= DIALOGUE_MATERIAL_GAP_LIMIT) break;
      const query = `話し方の材料を学ぶ: ${topic}`;
      if (openQueries.has(query)) continue;
      try {
        knowledgeGapService.detect({
          query,
          reason: '自己点検で、事実は知っているのに話し方の材料（会話例・型）が無い話題が分かったため。',
          type: 'INSUFFICIENT_EVIDENCE',
          target: topic,
          missingContent: '会話例や言い回しの型',
          priority: 35,
        });
        dialogueMaterialGapsRaised++;
      } catch { /* 1件の失敗で点検全体は止めない */ }
    }
    if (materiallessTopics.length > 0) {
      findings.push(`事実はあるのに話し方の材料が無い話題が${materiallessTopics.length}件ある${dialogueMaterialGapsRaised > 0 ? `（${dialogueMaterialGapsRaised}件を学習へ流した）` : ''}`);
    }

    // P902: 類推による候補関係の自己生成。点検のついでに、兄弟が
    // 持つ関係を持たない兄弟への候補を作り、予測で検証に回す。
    let analogyCreated = 0;
    try { analogyCreated = analogyCandidateService.generateCandidates(3).length; } catch { /* 補助経路 */ }
    if (analogyCreated > 0) {
      findings.push(`類推で候補関係を${analogyCreated}件作った（予測で検証する）`);
    }

    // P903: 手続きの塊化。観測が溜まっていれば、繰り返し手順を
    // ワークフロー候補として登録する（点検1回につき最大1件）。
    let chunksCreated = 0;
    try { chunksCreated = procedureChunkingService.detectAndChunk(1).length; } catch { /* 補助経路 */ }
    if (chunksCreated > 0) {
      findings.push(`繰り返し手順を${chunksCreated}件、塊として登録した`);
    }

    // P905: 蒸留。繰り返し現れる話題をエピソードから知識候補へ。
    let distilledCount = 0;
    try { distilledCount = episodeDistillationService.distill(3).length; } catch { /* 補助経路 */ }
    if (distilledCount > 0) {
      findings.push(`繰り返し話題を${distilledCount}件、知識として蒸留した`);
    }

    // P907: 開いているギャップのサブ目標（解決プラン）の進み具合を
    // 段ごとに数える。プラン無しは P907 以前の名残として NO_PLAN。
    const gapPlanPhases: Record<string, number> = {};
    for (const g of openGaps) {
      const phase = g.resolutionPlan?.phase || 'NO_PLAN';
      gapPlanPhases[phase] = (gapPlanPhases[phase] || 0) + 1;
    }

    // P909: 欲求の層（対応表#14）。欲求を合成して点検に残す。
    // 教示された好き・興味のうち、世界の関係がまだ1件も無い話題
    // （好きなのに知らない）は、欲求から学習の意図へ変える。
    // 頻度由来の弱い興味からは起こさない（教示だけを確実とする）。
    let desireSummary = { talk: 0, learn: 0, topTalk: [] as string[] };
    let desireGapsRaised = 0;
    try {
      const desires = desireService.compose(personaProfileService.get().profileId);
      const talkDesires = desires.filter((d) => d.kind === 'TALK');
      desireSummary = {
        talk: talkDesires.length,
        learn: desires.length - talkDesires.length,
        topTalk: talkDesires.slice(0, 5).map((d) => d.term),
      };
      const knownTerms = new Set<string>();
      for (const r of relations) {
        if (r.provisional) continue;
        knownTerms.add(r.from);
        knownTerms.add(r.to);
      }
      for (const d of talkDesires) {
        if (desireGapsRaised >= DESIRE_GAP_LIMIT) break;
        if (d.source !== 'taught') continue;
        if (knownTerms.has(d.term) || openTargets.has(d.term)) continue;
        try {
          knowledgeGapService.detect({
            query: `用語の意味を学ぶ: ${d.term}`,
            reason: '自己点検で、好き・興味があるのにまだ知らない話題が分かったため。',
            type: 'UNKNOWN_TERM',
            target: d.term,
            priority: 45,
          });
          desireGapsRaised++;
        } catch { /* 1件の失敗で点検全体は止めない */ }
      }
      if (desireGapsRaised > 0) {
        findings.push(`好き・興味があるのにまだ知らない話題を${desireGapsRaised}件、学習へ流した`);
      }
    } catch { /* 欲求の合成は補助経路 */ }

    // P910: プロダクション競合の観測（対応表#2・第1段）。
    // 事実と説明の両方の受け口が同時に合った回数を点検に残す。
    // 解決（第2段）は競合が実在するファミリーから入れる。
    let productionConflicts = { total: 0, byFamily: {} as Record<string, number> };
    try {
      productionConflicts = productionConflictService.summary();
      if (productionConflicts.total > 0) {
        findings.push(`答えの受け口が同時に合った競合を${productionConflicts.total}件観測`);
      }
    } catch { /* 競合の観測は補助経路 */ }

    // P915: コード生成の棚卸し（能力リスト第3項・第1段）。
    // 検証済みコード部品の件数と、合成が止まった理由の分布を
    // 点検に残す。分布がそのまま部品の不足リストになる。
    let codeComponents = { total: 0, verified: 0 };
    let codeSynthesis = { total: 0, succeeded: 0, byReason: {} as Record<string, number> };
    let codeGapsOpen = 0;
    let codeSpecsDrafted = 0;
    let codeSpecsSupplied = 0;
    let codeGatesPrepared = 0;
    let codeDeviceTested = 0;
    let reasoningLookAheads = 0;
    let idleActionsChosen = 0;
    let visualPatterns = 0;
    let visualScenePatterns = 0;
    let mistakesRecorded = 0;
    let mistakesRecurring = 0;
    let sleepRuns = 0;
    let specialDays = 0;
    let diaryEntries = 0;
    let grownPreferences = 0;
    let gameSessions = 0;
    let gameWins = 0;
    let rebuttalsMade = 0;
    let creativeWorks = 0;
    let dreamsRecorded = 0;
    let duoDialogues = 0;
    let motionPatterns = 0;
    let avatarPresence = 0;
    let computeResourcesMeasured = 0;
    let swarmVerifications = 0;
    let visualFigures = 0;
    let videoScenes = 0;
    let videoMotions = 0;
    let visualPoses = 0;
    let visualPoseMotions = 0;
    let reasoningDeepestChain = 0;
    try {
      const codeItems = (reusableComponentFactoryService.list() as unknown as Array<Record<string, unknown>>).filter(
        (item) => item.componentKind === 'CODE',
      );
      const verifiedStatuses = new Set(['VERIFIED', 'USER_APPROVED', 'MIKI_APPROVED', 'ACTIVE']);
      codeComponents = {
        total: codeItems.length,
        verified: codeItems.filter((item) => verifiedStatuses.has(String(item.lifecycleStatus))).length,
      };
      codeSynthesis = codeSynthesisStatsService.summary();
      if (codeComponents.verified === 0) {
        findings.push('検証済みのコード部品が0件で、コード合成の材料が無い');
      }
      const failedCount = codeSynthesis.total - codeSynthesis.succeeded;
      if (failedCount > 0) {
        const topReason = Object.entries(codeSynthesis.byReason).sort((a, b) => b[1] - a[1])[0];
        findings.push(`コード合成が${codeSynthesis.total}回中${failedCount}回止まった（最多理由 ${topReason ? `${topReason[0]} ${topReason[1]}件` : '不明'}）`);
      }
      // P917: 会話で実際に止まった不足が、成長課題として開いている件数。
      codeGapsOpen = capabilityGapService.getAllGaps()
        .filter((g) => g.gap_type === 'code_component_missing' && g.status === 'OPEN').length;
      if (codeGapsOpen > 0) {
        findings.push(`コード部品の不足が${codeGapsOpen}件、成長課題として開いている`);
      }
      // P918: 不足から作られた部品仕様の下書きの件数。
      // P919: そのうち実装が到着し静的検証を通った件数も数える。
      const specSummary = codeComponentSpecService.summary();
      codeSpecsDrafted = specSummary.drafted;
      codeSpecsSupplied = specSummary.supplied;
      if (codeSpecsDrafted > 0) {
        findings.push(`不足から部品仕様の下書きが${codeSpecsDrafted}件できている（うち${codeSpecsSupplied}件は実装が到着し解析済み）`);
      }
      // P921: 供給部品の昇格ゲートの用意と DEVICE_TESTED 到達の件数。
      const gateSummary = codeComponentPromotionBridgeService.summary();
      codeGatesPrepared = gateSummary.prepared;
      codeDeviceTested = gateSummary.deviceTested;
      if (codeGatesPrepared > 0) {
        findings.push(`供給部品の昇格ゲートが${codeGatesPrepared}件用意できている（うち${codeDeviceTested}件が実機検証済み候補まで到達）`);
      }
      // P922: 多段の先読み（世界モデルの因果を最大3段たどる）の利用状況。
      const reasoningSummary = multiStepReasoningService.summary();
      reasoningLookAheads = reasoningSummary.lookAheads;
      reasoningDeepestChain = reasoningSummary.deepestChain;
      if (reasoningLookAheads > 0) {
        findings.push(`因果の先読みを${reasoningLookAheads}回使った（最も深くて${reasoningDeepestChain}段先まで）`);
      }
      // P925: 主体性（欲求から選んだ行動）の件数。
      idleActionsChosen = idleActionService.summary().choices;
      if (idleActionsChosen > 0) {
        findings.push(`欲求から次の行動を${idleActionsChosen}回選んだ`);
      }
      // P928: 見本から同定できる形の数。
      visualPatterns = visualPatternService.summary().patterns;
      if (visualPatterns > 0) {
        findings.push(`見本として覚えた形が${visualPatterns}件ある`);
      }
      // P929: 配置の見本の数。
      visualScenePatterns = visualScenePatternService.summary().scenes;
      if (visualScenePatterns > 0) {
        findings.push(`配置の見本が${visualScenePatterns}件ある`);
      }
      // P930: 間違い帳の件数と繰り返し。
      const mistakeSummary = mistakeNotebookService.summary();
      mistakesRecorded = mistakeSummary.total;
      mistakesRecurring = mistakeSummary.recurring;
      if (mistakesRecorded > 0) {
        findings.push(`間違い帳に${mistakesRecorded}件の記録がある`);
      }
      if (mistakesRecurring > 0) {
        findings.push(`同じ間違いを繰り返したものが${mistakesRecurring}件ある`);
      }
      // P931: 眠って整理した回数。
      sleepRuns = knowledgeConsolidationService.lastReport()?.runs || 0;
      if (sleepRuns > 0) {
        findings.push(`眠って整理を${sleepRuns}回した`);
      }
      // P932: 覚えている記念日・誕生日の数。
      specialDays = specialDayService.summary().days;
      if (specialDays > 0) {
        findings.push(`記念日や誕生日を${specialDays}件覚えている`);
      }
      // P934: 書いた日記の数。
      diaryEntries = diaryService.summary().entries;
      if (diaryEntries > 0) {
        findings.push(`日記を${diaryEntries}日分書いた`);
      }
      // P935: 育った好みの数。
      grownPreferences = selfPreferenceService.grownCount();
      if (grownPreferences > 0) {
        findings.push(`会話の中で育った好みが${grownPreferences}件ある`);
      }
      // P936: 自分で遊んだゲームの記録。
      const gameSummary = gamePlayService.summary();
      gameSessions = gameSummary.sessions;
      gameWins = gameSummary.wins;
      if (gameSessions > 0) {
        findings.push(`ゲームを${gameSessions}回遊んで${gameWins}回勝った`);
      }
      // P937: 根拠を示して反論した回数。
      rebuttalsMade = groundedRebuttalService.summary().rebuttals;
      if (rebuttalsMade > 0) {
        findings.push(`記録と違う断定に根拠を示して反論したことが${rebuttalsMade}回ある`);
      }
      // P938: 自分で書いた作品の数。
      creativeWorks = creativeWritingService.summary().works;
      if (creativeWorks > 0) {
        findings.push(`自分で書いた作品が${creativeWorks}首ある`);
      }
      // P939: 見た夢の数。
      dreamsRecorded = dreamService.summary().dreams;
      if (dreamsRecorded > 0) {
        findings.push(`夢を${dreamsRecorded}回見た`);
      }
      // P940: ビービーとの掛け合いの回数。
      duoDialogues = duoDialogueService.summary().dialogues;
      if (duoDialogues > 0) {
        findings.push(`ビービーと${duoDialogues}回掛け合いをした`);
      }
      // P941: 動作部品として覚えた動きの数。
      motionPatterns = motionPatternService.summary().patterns;
      if (motionPatterns > 0) {
        findings.push(`動きを${motionPatterns}件、動作部品として覚えた`);
      }
      // P942: アバターの存在状態を持つ人数。
      avatarPresence = avatarPresenceService.summary().personas;
      if (avatarPresence > 0) {
        findings.push(`アバターの存在状態を${avatarPresence}人分持っている`);
      }
      // P943: 速さを測った計算仕事の種類数。
      computeResourcesMeasured = computeResourceService.summary().measuredKinds;
      if (computeResourcesMeasured > 0) {
        findings.push(`計算の速さを${computeResourcesMeasured}種の仕事で測った`);
      }
      // P944: 群れで検証した文の数。
      swarmVerifications = swarmVerificationService.summary().checked;
      if (swarmVerifications > 0) {
        findings.push(`ビービーの群れで${swarmVerifications}件の文を検証した`);
      }
      // P945: 登録した人の形の見本数。
      visualFigures = visualFigureService.summary().figures;
      if (visualFigures > 0) {
        findings.push(`人の形の見本を${visualFigures}件覚えた`);
      }
      // P946: 切り分けた動画の場面の総数。
      videoScenes = videoSceneService.summary().scenesTotal;
      if (videoScenes > 0) {
        findings.push(`動画を${videoScenes}場面に切り分けた`);
      }
      // P947: 動きを記述できた場面の総数。
      videoMotions = videoSceneService.summary().motionsTotal;
      if (videoMotions > 0) {
        findings.push(`動画の${videoMotions}場面で動きを記述した`);
      }
      // P950: 関節から姿勢を読んだ回数。
      visualPoses = visualPoseService.summary().analyzed;
      if (visualPoses > 0) {
        findings.push(`姿勢を${visualPoses}件読んだ`);
      }
      // P952: 関節軌跡から動作を読んだ回数。
      visualPoseMotions = visualPoseService.summary().motions;
      if (visualPoseMotions > 0) {
        findings.push(`姿勢の動きを${visualPoseMotions}件読んだ`);
      }
    } catch { /* コードの棚卸しは補助経路 */ }

    const record: KnowledgeSelfInspectionRecord = {
      inspectedAt: Date.now(),
      personalDictionary: personal.length,
      learnedDictionaryEntries: learned,
      lexicalRelations: lexicalRelationService.counts().total,
      paraphrasePairs,
      termComponents: termComponents.length,
      glosslessCount: glosslessTerms.length,
      glosslessSample: glosslessTerms.slice(0, 10),
      worldEntities: worldModelGraphService.entities().length,
      worldRelations: relations.length,
      provisionalRelations: provisional,
      claims,
      connectivity: {
        total: connectivity.total,
        connected: connectivity.connected,
        weak: connectivity.weak,
        orphaned: connectivity.orphaned,
      },
      openGaps: openGaps.length,
      parkedGaps: parked,
      gapsRaised,
      materiallessCount: materiallessTopics.length,
      materiallessSample: materiallessTopics.slice(0, 10),
      dialogueMaterialGapsRaised,
      analogyCandidatesCreated: analogyCreated,
      procedureChunksCreated: chunksCreated,
      episodeTopicsDistilled: distilledCount,
      gapPlanPhases,
      desireSummary,
      desireGapsRaised,
      productionConflicts,
      codeComponents,
      codeSynthesis,
      codeGapsOpen,
      codeSpecsDrafted,
      codeSpecsSupplied,
      codeGatesPrepared,
      codeDeviceTested,
      reasoningLookAheads,
      reasoningDeepestChain,
      idleActionsChosen,
      visualPatterns,
      visualScenePatterns,
      mistakesRecorded,
      mistakesRecurring,
      sleepRuns,
      specialDays,
      diaryEntries,
      grownPreferences,
      gameSessions,
      gameWins,
      rebuttalsMade,
      creativeWorks,
      dreamsRecorded,
      duoDialogues,
      motionPatterns,
      avatarPresence,
      computeResourcesMeasured,
      swarmVerifications,
      visualFigures,
      videoScenes,
      videoMotions,
      visualPoses,
      visualPoseMotions,
      findings,
    };

    this.saveRecord(record);
    systemLogger.info(
      'SELF_IMPROVEMENT',
      `🩺 [自己点検] 辞書${record.personalDictionary}件（学習${learned}）／言い換え対${record.paraphrasePairs}件／意味待ち${record.glosslessCount}件／関係${record.worldRelations}件（仮${provisional}）／知識${claims}件（孤立${connectivity.orphaned}）／学習待ち${record.openGaps}件（休止${parked}）／材料なし話題${record.materiallessCount}件`,
    );
    for (const finding of findings) {
      systemLogger.info('SELF_IMPROVEMENT', `🩺 [自己点検] 所見: ${finding}`);
    }
    return record;
  }

  /**
   * P899: 「事実はあるのに話し方の材料が無い話題」の棚卸し。
   * 確定した世界の関係を2件以上持つ実体（＝ある程度知っている
   * 話題）について、会話例と教師レッスンのどちらからも材料が
   * 引けないものを、関係の多い順に最大 limit 件返す。
   */
  public findTopicsWithoutDialogueMaterial(limit = 3): string[] {
    const relations = worldModelGraphService.relations().filter((r) => !r.provisional);
    const counts = new Map<string, number>();
    for (const r of relations) {
      counts.set(r.from, (counts.get(r.from) ?? 0) + 1);
      counts.set(r.to, (counts.get(r.to) ?? 0) + 1);
    }
    const candidates = [...counts.entries()]
      .filter(([name, n]) => name.length >= 2 && n >= 2)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 1000)
      .map(([name]) => name);
    const out: string[] = [];
    for (const name of candidates) {
      if (out.length >= limit) break;
      try {
        if (dialogueExampleRecallService.findFor(name)) continue;
        if (teacherLessonRecallService.findFor(name)) continue;
      } catch { continue; }
      out.push(name);
    }
    return out;
  }

  public latest(): KnowledgeSelfInspectionRecord | undefined {
    const records = this.loadRecords();
    return records[records.length - 1];
  }

  private loadRecords(): KnowledgeSelfInspectionRecord[] {
    try {
      const raw = storageService.getItem(STORAGE_KEY);
      const parsed: unknown = raw ? JSON.parse(raw) : null;
      return Array.isArray(parsed) ? (parsed as KnowledgeSelfInspectionRecord[]) : [];
    } catch {
      return [];
    }
  }

  private saveRecord(record: KnowledgeSelfInspectionRecord): void {
    try {
      const records = [...this.loadRecords(), record].slice(-MAX_RECORDS);
      storageService.setItem(STORAGE_KEY, JSON.stringify(records));
    } catch { /* 点検記録の保存失敗は点検自体を止めない */ }
  }
}

export const knowledgeSelfInspectionService = new KnowledgeSelfInspectionService();
