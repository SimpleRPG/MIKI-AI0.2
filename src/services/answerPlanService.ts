import {
  ResponseSkeleton,
  AnswerPlanApplicationResult,
  ConversationState,
  ConversationStage,
} from '../types';
import { storageService } from './storageService';
import { systemLogger } from './systemLogger';
import { isCasualGreetingOrShortSocial } from './conversationStateService';
import { surfaceVariationService } from './surfaceVariationService';
import { unknownTaskDecompositionService } from './unknownTaskDecompositionService';
import { capabilityGapService } from './capabilityGapService';

const SKELETONS_STORAGE_KEY = 'miki_response_skeletons_v32';

/**
 * 初期プリセット回答骨格 (設計思想 9章: 回答骨格と思考節約)
 */
export const INITIAL_SKELETONS: ResponseSkeleton[] = [
  {
    pattern_id: 'PATTERN-CORRECTION-01',
    situation: '以前の前提が明示的または遠回しに訂正された',
    triggerKeywords: [
      '訂正', '違っ', 'そうじゃなくて', '変わっ', 'ではなく',
      '前提が違う', '間違い', 'ミス', '取り消し', '勘違い',
      'さっきの話と違う', '前提が変わった', '実は条件が', '前提を変更',
      '条件修正', '前提が違ってて', '勘違いしてた', 'もしかして違う', '話が変わった'
    ],
    stage: 'CORRECTION',
    response_plan: [
      '1. 訂正を素直に認識する',
      '2. 古い前提を直ちに無効化し回答へ混入させない',
      '3. 影響する結論を洗い出し、新しい条件で再判断する',
      '4. 修正後の結論を先に答える',
    ],
    avoid: [
      '古い前提を残す',
      '謝罪だけで終わる（防衛的にならない）',
      '前と同じ説明を繰り返す',
    ],
    reuse_mode: 'PLAN_ONLY',
    samplePrompt: 'いや、そうじゃなくて、そもそもPC環境は利用できない前提なんだよね',
    exampleResponseTemplate: '了解だよ！PC環境は使えない前提で再検討したよ。スマホ単体で完結する手順はこちら...',
    usageCount: 18,
    successRate: 98,
    createdAt: Date.now() - 1000000,
    updatedAt: Date.now() - 10000,
  },
  {
    pattern_id: 'PATTERN-LOGICAL-PRIORITY-01',
    situation: '複数条件・三重例外・除外フラグ等の階層構造が重なる論理優先順位判定',
    triggerKeywords: [
      '例外', '除外', '優先', 'フラグ', '条件A', '条件B', 'ただし', 'さらに',
      '上書き', '判定', '入れ子', '三重', '優先順位', 'スキップ', 'どれが優先'
    ],
    stage: 'DECISION',
    response_plan: [
      '1. 条件・例外・フラグをフラットな決定表（Decision Table）形式に整理する',
      '2. 最上位の絶対除外フラグ（Override/Exclude Flag）を最優先で評価する',
      '3. 例外ルールと一般ルールの優先順位階層（①除外 > ②例外 > ③通常条件）を明示する',
      '4. 最終判定結果（実行/スキップ等）を結論先行で提示し、判定トレースを1行で添える',
    ],
    avoid: [
      'ネストされたif文の順序に惑わされて例外の上書きを無視する',
      '優先順位を曖昧にしたまま推測で判定を下す',
      '結論を後回しにして条件解説の長文で埋める',
    ],
    reuse_mode: 'PLAN_ONLY',
    samplePrompt: '条件Aかつ条件Bだが例外Cでさらに除外フラグDがある場合の最終更新判定はどうなる？',
    exampleResponseTemplate: '結論から言うと、最上位の除外フラグDが最優先されるため【非更新（スキップ）】になるよ！\n優先順位の階層は：\n① 除外フラグD（最優先・即時スキップ）\n② 例外C（特殊処理）\n③ 条件AかつB（通常実行条件）\nという判定順序になるよ。',
    usageCount: 16,
    successRate: 94,
    createdAt: Date.now() - 600000,
    updatedAt: Date.now() - 30000,
  },
  {
    pattern_id: 'PATTERN-CONTRADICTION-01',
    situation: '以前の説明や直前の発言との矛盾・食い違いを指摘された',
    triggerKeywords: [
      '矛盾', 'さっきと言ってること', '変わってる', '食い違い',
      'どっちなの', 'さっきは', '前言ってたことと違う'
    ],
    stage: 'CORRECTION',
    response_plan: [
      '1. 矛盾指摘を受け止め、防衛的・言い訳にならず修復する',
      '2. 条件の差異または説明不足を素直に整理する',
      '3. 整合した正確な確定結論を先に明示する',
    ],
    avoid: [
      '前の発言をごまかす',
      '言い訳に終始する',
      '論点をすり替える',
    ],
    reuse_mode: 'PLAN_ONLY',
    samplePrompt: 'さっきと言ってること変わってる気がするんだけど、結局どっちが正しいの？',
    exampleResponseTemplate: 'ごめんね、説明が混乱させちゃった！正しくは【〇〇】だよ。理由は...',
    usageCount: 8,
    successRate: 90,
    createdAt: Date.now() - 900000,
    updatedAt: Date.now() - 150000,
  },
  {
    pattern_id: 'PATTERN-DIRECT-SHORT-01',
    situation: '結論だけを求める短い質問、または即答が適した確認',
    triggerKeywords: [
      '結論だけ', '一言で', '手短に', '要するに', 'できる？', '合ってる？', '何？'
    ],
    stage: 'QUESTION',
    response_plan: [
      '1. 質問への直接回答（Yes/No、具体的な数値、要約）を1行目に明示',
      '2. 最低限の根拠または注意点を1〜2文で添える',
    ],
    avoid: [
      '「ご質問ありがとうございます」等の不必要な前置き',
      '結論を後回しにする長文解説',
    ],
    reuse_mode: 'PLAN_ONLY',
    samplePrompt: '結論だけ教えて、この方式でメモリは足りる？',
    exampleResponseTemplate: '足りるよ！この設定なら約1.8GBの消費で収まるから、S25のRAM制限内だよ。',
    usageCount: 25,
    successRate: 98,
    createdAt: Date.now() - 800000,
    updatedAt: Date.now() - 50000,
  },
  {
    pattern_id: 'PATTERN-CLARIFICATION-01',
    situation: '複数の解釈が可能で、結論を左右する重要前提が曖昧',
    triggerKeywords: [
      'どっちがいい？', 'どう思う？', 'おすすめ', '教えて', '迷ってる'
    ],
    stage: 'CLARIFICATION',
    response_plan: [
      '1. 最も可能性の高い標準ケースに基づく回答を先に提示',
      '2. 結論を大きく左右する前提分岐点のみを1点に絞って簡潔に確認',
    ],
    avoid: [
      '何でも確認質問で止めて回答を放棄する',
      '質問攻めにしてユーザーに負担をかける',
    ],
    reuse_mode: 'PLAN_ONLY',
    samplePrompt: 'どっちのライブラリを使えばいいかな？',
    exampleResponseTemplate: '基本的には〇〇がおすすめだよ！ただ、もし端末オフライン実行が必須なら△△になるよ。どちらの用途を想定してる？',
    usageCount: 15,
    successRate: 92,
    createdAt: Date.now() - 700000,
    updatedAt: Date.now() - 80000,
  },
  {
    pattern_id: 'PATTERN-COMPARISON-01',
    situation: '複数案の比較検討、トレードオフの整理',
    triggerKeywords: [
      '比較', 'メリット', 'デメリット', '違い', 'どっち', '優劣'
    ],
    stage: 'COMPARISON',
    response_plan: [
      '1. 各案の結論・推奨状況を先に提示',
      '2. 速度・メモリ・手間の主要観点でコンパクトに比較',
      '3. 現在の目的に対する推奨案を1つ選んで理由を述べる',
    ],
    avoid: [
      'どちらでも良いと曖昧に濁す',
      '網羅しすぎて論点をぼかす',
    ],
    reuse_mode: 'SKILL_COMPOSITION',
    samplePrompt: '方式Aと方式Bの長所と短所を比較して',
    exampleResponseTemplate: '結論として、目的に対して検証可能な方式を推奨するよ！比較すると...',
    usageCount: 14,
    successRate: 94,
    createdAt: Date.now() - 600000,
    updatedAt: Date.now() - 90000,
  },
  {
    pattern_id: 'PATTERN-TOPIC-RESUME-01',
    situation: '以前の話への復帰、または中断した話題の再開',
    triggerKeywords: [
      'さっきの話', '前の続き', '戻るけど', 'さっき言ってた', 'あの件'
    ],
    stage: 'FOLLOW_UP',
    response_plan: [
      '1. 前回の確定事項・文脈を直ちに想起し、話のつながりを確認',
      '2. 中断時点からの次の一歩を具体的に回答',
    ],
    avoid: [
      '文脈を忘れてゼロから聞き直す',
      '別の話題と混同する',
    ],
    reuse_mode: 'PLAN_ONLY',
    samplePrompt: 'さっきのVBAの件に戻るけど、エラー処理はどう書けばいい？',
    exampleResponseTemplate: 'うん！さっきの「対象行を判定して更新する」処理だね。On Error GoToを使った安全なエラー処理はこちらだよ...',
    usageCount: 9,
    successRate: 96,
    createdAt: Date.now() - 500000,
    updatedAt: Date.now() - 120000,
  },
];

class AnswerPlanService {
  private skeletons: ResponseSkeleton[] = [];

  constructor() {
    this.loadSkeletons();
  }

  private loadSkeletons(): void {
    try {
      const raw = storageService.getItem(SKELETONS_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // 既存IDのSetでマージ
          const existingIds = new Set(parsed.map((s: ResponseSkeleton) => s.pattern_id));
          const missing = INITIAL_SKELETONS.filter((s) => !existingIds.has(s.pattern_id));
          this.skeletons = [...parsed, ...missing].map((s) => ({
            ...s,
            status: s.status || 'VERIFIED',
            sourceType: s.sourceType || 'PRESET',
            observedCount: s.observedCount ?? (s.status === 'CANDIDATE' ? 1 : 3),
          }));
          return;
        }
      }
    } catch (e) {
      console.warn('Failed to load response skeletons from storage:', e);
    }
    this.skeletons = INITIAL_SKELETONS.map((s) => ({
      ...s,
      status: 'VERIFIED',
      sourceType: 'PRESET',
      observedCount: 3,
    }));
    this.saveSkeletons();
  }

  public saveSkeletons(): void {
    try {
      storageService.setItem(SKELETONS_STORAGE_KEY, JSON.stringify(this.skeletons));
    } catch (e) {
      console.warn('Failed to save response skeletons:', e);
    }
  }

  public getAllSkeletons(): ResponseSkeleton[] {
    return this.skeletons;
  }

  public getSkeletonById(patternId: string): ResponseSkeleton | undefined {
    return this.skeletons.find((s) => s.pattern_id === patternId);
  }

  /**
   * 設計思想 19.2節: 回答骨格の言い回しバリエーション取得 (各30種以上から非重複選択)
   */
  public getSkeletonTemplateVariation(patternId: string): string {
    const variation = surfaceVariationService.getSkeletonResponseTemplate(patternId);
    if (variation) {
      return variation.text;
    }
    const skeleton = this.getSkeletonById(patternId);
    return skeleton?.exampleResponseTemplate || '';
  }

  public addSkeleton(skeleton: Omit<ResponseSkeleton, 'usageCount' | 'successRate' | 'createdAt' | 'updatedAt'>): ResponseSkeleton {
    const newSkeleton: ResponseSkeleton = {
      ...skeleton,
      usageCount: 0,
      successRate: 100,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    this.skeletons.unshift(newSkeleton);
    this.saveSkeletons();
    systemLogger.info('ANSWER_PLAN', `新回答骨格パターン登録: ${newSkeleton.pattern_id} (${newSkeleton.situation})`);
    return newSkeleton;
  }

  public saveSkeleton(skeleton: ResponseSkeleton): void {
    const existing = this.getSkeletonById(skeleton.pattern_id);
    if (existing) {
      this.updateSkeleton(skeleton.pattern_id, skeleton);
    } else {
      this.addSkeleton(skeleton);
    }
  }

  public updateSkeleton(patternId: string, updates: Partial<ResponseSkeleton>): boolean {
    const idx = this.skeletons.findIndex((s) => s.pattern_id === patternId);
    if (idx === -1) return false;
    this.skeletons[idx] = {
      ...this.skeletons[idx],
      ...updates,
      updatedAt: Date.now(),
    };
    this.saveSkeletons();
    return true;
  }

  public deleteSkeleton(patternId: string): boolean {
    const idx = this.skeletons.findIndex((s) => s.pattern_id === patternId);
    if (idx === -1) return false;
    this.skeletons.splice(idx, 1);
    this.saveSkeletons();
    return true;
  }

  /**
   * 縦(骨格)のシグネチャ正規化
   * キーワードとステージから同一構造を同定するためのハッシュ的シグネチャを生成
   */
  private normalizePatternSignature(triggerKeywords: string[], stage: ConversationStage): string {
    const sorted = [...triggerKeywords]
      .map((k) => k.toLowerCase().trim())
      .filter((k) => k.length >= 2)
      .sort()
      .slice(0, 4)
      .join('|');
    return `SIG:${stage}:${sorted}`;
  }

  /**
   * 設計思想 9章・16章・20章 縦(骨格)の自律成長パイプライン
   * 教師教材および実会話の未対応ログから骨格候補を登録し、3回以上観測された場合にVERIFIEDへ正式昇格する。
   */
  public registerSkeletonCandidate(params: {
    instruction: string;
    outputTarget?: string;
    reasoningExplanation?: string;
    category?: string;
    sourceType: 'TEACHER_MATERIAL' | 'UNRESOLVED_CONVERSATION';
  }): ResponseSkeleton {
    const rawCategory = (params.category || 'chat').toLowerCase();
    const isCorrection =
      rawCategory.includes('correction') ||
      params.instruction.includes('訂正') ||
      params.instruction.includes('間違い') ||
      params.instruction.includes('前提');
    const isContradiction =
      rawCategory.includes('contradiction') ||
      params.instruction.includes('矛盾') ||
      params.instruction.includes('食い違い');

    // トリガーキーワードの自動抽出（instruction中の名詞・語句）
    const extractedKeywords: string[] = [];
    const words = params.instruction.split(/[\s,、。！？!?：:「」()（）]+/);
    for (const w of words) {
      if (w.length >= 3 && !['これ', 'それ', 'あれ', 'について', 'ください', '教えて', 'どう', 'どうす'].includes(w)) {
        extractedKeywords.push(w);
      }
    }

    // 重複除外＆上限6語
    const triggerKeywords = Array.from(new Set(extractedKeywords)).slice(0, 6);
    if (triggerKeywords.length === 0) {
      triggerKeywords.push(params.instruction.slice(0, 15));
    }

    const stage: ConversationStage = isCorrection || isContradiction ? 'CORRECTION' : 'QUESTION';
    const patternSignature = this.normalizePatternSignature(triggerKeywords, stage);

    // 既存候補の中からシグネチャ一致、またはトリガーキーワードの重複率が高いものを検索
    const existing = this.skeletons.find((s) => {
      if (s.patternSignature && s.patternSignature === patternSignature) return true;
      const common = s.triggerKeywords.filter((k) => triggerKeywords.includes(k));
      return common.length >= 2 && s.stage === stage;
    });

    if (existing) {
      existing.observedCount = (existing.observedCount || 1) + 1;
      existing.updatedAt = Date.now();

      // 設計思想 16章「削減知能」強制ルール:
      // 同じ構造のログが複数回（3回以上）確認されて初めてVERIFIEDへ正式昇格
      if ((existing.observedCount || 0) >= 3 && existing.status === 'CANDIDATE') {
        existing.status = 'VERIFIED';
        systemLogger.info(
          'ANSWER_PLAN',
          `🏆 [骨格正式化 (VERIFIED)] 観測回数3回に達したため回答骨格 ${existing.pattern_id} を正式化しました (${existing.situation}, sourceType: ${existing.sourceType})`
        );
      } else {
        systemLogger.info(
          'ANSWER_PLAN',
          `📝 [骨格候補観測] 候補 ${existing.pattern_id} の出現回数を更新: ${existing.observedCount}/3回 (status: ${existing.status})`
        );
      }

      this.saveSkeletons();
      return existing;
    }

    // 回答手順(response_plan)の作成
    const plans: string[] = [];
    if (isCorrection) {
      plans.push('1. 訂正された前提を素直に更新し、古い前提を直ちに無効化する');
      plans.push('2. 新前提に基づく影響範囲を洗い出して再判断する');
      plans.push('3. 修正後の結論を直接先に回答する');
    } else if (isContradiction) {
      plans.push('1. 矛盾の指摘を受け止め、防衛的・言い訳にならず論点を修復する');
      plans.push('2. 状況の差異または説明不足を素直に補正する');
      plans.push('3. 整合した正確な確定結論を提示する');
    } else {
      plans.push('1. 質問に対する結論・直接回答を先に明示する');
      if (params.reasoningExplanation) {
        plans.push(`2. ${params.reasoningExplanation.replace(/\n+/g, ' ').slice(0, 40)}`);
      } else {
        plans.push('2. 理由・条件・注意点を簡潔に補足する');
      }
      plans.push('3. 不要な繰り返しや過剰な前置きを排除する');
    }

    const prefix = params.sourceType === 'TEACHER_MATERIAL' ? 'TEACHER' : 'UNRESOLVED';
    const pattern_id = `PATTERN-${prefix}-${Date.now().toString(36).toUpperCase()}`;
    const situation = params.sourceType === 'TEACHER_MATERIAL'
      ? `外部教師教材より生成: ${params.instruction.slice(0, 35)}`
      : `未対応対話ログより生成: ${params.instruction.slice(0, 35)}`;

    const newCandidate: ResponseSkeleton = {
      pattern_id,
      situation,
      triggerKeywords,
      stage,
      response_plan: plans,
      avoid: [
        '古い前提を残す',
        '不要な繰り返し・謝罪に終始する',
        '結論を後回しにする',
      ],
      reuse_mode: 'PLAN_ONLY',
      samplePrompt: params.instruction,
      exampleResponseTemplate: (params.outputTarget || '').slice(0, 120) || '了解だよ！要点を整理して回答するね。',
      usageCount: 0,
      successRate: 100,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      // 初回は必ず CANDIDATE 状態で保存 (3回観測強制ルール)
      status: 'CANDIDATE',
      sourceType: params.sourceType,
      observedCount: 1,
      patternSignature,
    };

    this.skeletons.unshift(newCandidate);
    this.saveSkeletons();

    systemLogger.info(
      'ANSWER_PLAN',
      `🌱 [骨格候補登録 (CANDIDATE)] 新規骨格候補 ${newCandidate.pattern_id} を保存しました (1/3回観測, ${newCandidate.situation})`
    );
    return newCandidate;
  }

  /**
   * 設計思想 20章 & 9章:
   * 教師の生成教材から「対策(回答骨格・修復パターン)」を抽出し、回答骨格候補として保存
   */
  public createSkeletonFromTeacherMaterial(params: {
    instruction: string;
    outputTarget: string;
    reasoningExplanation?: string;
    category?: string;
  }): ResponseSkeleton {
    return this.registerSkeletonCandidate({
      ...params,
      sourceType: 'TEACHER_MATERIAL',
    });
  }

  /**
   * 実会話の未対応ログ（unknownTaskDecompositionService & capabilityGapService）から
   * 新しい骨格候補を自動抽出し、観測・昇格パイプラインを回す
   */
  public processUnresolvedConversationsForSkeletonGrowth(limit: number = 2): {
    processedCount: number;
    promotedCount: number;
    items: Array<{ id: string; status: string; observedCount: number; signature: string }>;
  } {
    const gapRecords = capabilityGapService.getAllGaps().filter((g) => g.status === 'OPEN');
    const taskRecords = unknownTaskDecompositionService.list(50).filter(
      (r) => r.status === 'PROPOSED' || r.status === 'BLOCKED'
    );

    const candidateInputs: Array<{ text: string; category?: string }> = [];

    for (const g of gapRecords) {
      if (g.description && g.description.length >= 6) {
        candidateInputs.push({ text: g.description, category: g.gap_type });
      }
    }
    for (const t of taskRecords) {
      if (t.task && t.task.length >= 6) {
        candidateInputs.push({ text: t.task, category: 'unresolved_task' });
      }
    }

    // 重複除去
    const uniqueInputs: Array<{ text: string; category?: string }> = [];
    const seen = new Set<string>();
    for (const item of candidateInputs) {
      const norm = item.text.trim().toLowerCase();
      if (!seen.has(norm)) {
        seen.add(norm);
        uniqueInputs.push(item);
      }
    }

    const targets = uniqueInputs.slice(0, limit);
    let promotedCount = 0;
    const items: Array<{ id: string; status: string; observedCount: number; signature: string }> = [];

    for (const target of targets) {
      const res = this.registerSkeletonCandidate({
        instruction: target.text,
        sourceType: 'UNRESOLVED_CONVERSATION',
        category: target.category,
      });

      if (res.status === 'VERIFIED') {
        promotedCount++;
      }

      items.push({
        id: res.pattern_id,
        status: res.status || 'CANDIDATE',
        observedCount: res.observedCount || 1,
        signature: res.patternSignature || '',
      });
    }

    return {
      processedCount: targets.length,
      promotedCount,
      items,
    };
  }

  /**
   * Non-LLM能力パッチを実行時に使える回答骨格へ登録する。
   * 外部生成物をそのまま採用せず、検証済みパッチだけを受け付ける。
   */
  public installDeterministicCapabilityPatch(params: {
    patternId: string;
    capabilityId: string;
    triggerKeywords: string[];
    rule: string;
    samplePrompt: string;
    outputTarget: string;
    category: string;
  }): ResponseSkeleton | null {
    if (!params.patternId || !params.capabilityId || params.triggerKeywords.length === 0) return null;
    if (this.getSkeletonById(params.patternId)) return this.getSkeletonById(params.patternId) || null;

    const stage: ConversationStage =
      params.category === 'correction' ? 'CORRECTION' :
      params.category === 'tool_use' ? 'DECISION' : 'QUESTION';

    return this.addSkeleton({
      pattern_id: params.patternId,
      situation: `検証済みNon-LLM能力パッチ: ${params.capabilityId}`,
      triggerKeywords: params.triggerKeywords.slice(0, 12),
      stage,
      response_plan: [
        `1. 能力 ${params.capabilityId} の決定論的規則を適用する`,
        ...params.rule.split(/\n+/).filter(Boolean).slice(0, 4).map((line) => `2. ${line}`),
        '3. 検証済みの結果だけを採用し、不確実な推測を追加しない',
        '4. 受入条件を満たさない場合は未確定として停止する',
      ],
      avoid: [
        '未検証の推測による補完',
        '外部生成モデルへのフォールバック',
        '検証前の能力パッチの再利用',
      ],
      reuse_mode: 'SKILL_COMPOSITION',
      samplePrompt: params.samplePrompt,
      exampleResponseTemplate: params.outputTarget.slice(0, 240),
    });
  }

  public getCandidateSkeletons(): ResponseSkeleton[] {
    return this.skeletons.filter((s) => s.status === 'CANDIDATE');
  }

  public getVerifiedSkeletons(): ResponseSkeleton[] {
    return this.skeletons.filter((s) => s.status !== 'CANDIDATE');
  }

  /**
   * 9章 & 35章 第5段階: 状況を分類し、類似する回答骨格を検索して思考節約手順を生成
   */
  public matchSkeleton(
    prompt: string,
    state?: ConversationState
  ): AnswerPlanApplicationResult {
    const p = (prompt || '').trim();
    const pLower = p.toLowerCase();

    // 0. 日常の挨拶・短文・相槌の判定 (対策2: RAGスキップ・軽量即答モード)
    if (isCasualGreetingOrShortSocial(p)) {
      return {
        applied: false,
        reason: '日常の挨拶・相槌・短文のため回答骨格適用をスキップ (軽量即答モード)',
      };
    }

    // 1. 会話段階 (state.stage) および 未知の言い回し・キーワード照合
    let bestSkeleton: ResponseSkeleton | undefined;
    let highestScore = 0;

    for (const skeleton of this.skeletons) {
      // 設計思想 16章「削減知能」強制ルール:
      // CANDIDATE 状態の骨格は 3回以上確認されて VERIFIED に昇格するまで実会話適用から除外
      if (skeleton.status === 'CANDIDATE') continue;

      let score = 0;

      // 訂正イベントの存在
      if (
        skeleton.stage === 'CORRECTION' &&
        (state?.corrections?.length || state?.invalidatedAssumptions?.length)
      ) {
        score += 25;
      }

      // トリガーキーワード照合
      for (const kw of skeleton.triggerKeywords) {
        if (pLower.includes(kw.toLowerCase())) {
          score += 15;
        }
      }

      // 会話段階の一致
      // ※ QUESTION段階は全クエリのデフォルト値であるため、トリガーキーワード等の適合(score > 0)がある場合にのみ加算（無条件加算による誤爆防止）
      if (state && state.stage === skeleton.stage) {
        if (skeleton.stage === 'QUESTION') {
          if (score > 0) score += 15;
        } else {
          score += 25;
        }
      }

      // 未知の言い回し（16.1）対応の柔軟なパターン検知
      if (skeleton.pattern_id === 'PATTERN-CORRECTION-01') {
        // 婉曲的な訂正表現（GAP-0031解消: 汎化性能向上）
        if (/(そうじゃなくて|前提が|実は|違ってて|勘違い|じゃなく|さっきの話と|前提が変わっ|条件を変え|訂正させて|もしかして違う|話が変わった)/.test(p)) {
          score += 25;
        }
      } else if (skeleton.pattern_id === 'PATTERN-CONTRADICTION-01') {
        // 婉曲的な矛盾指摘（「さっきと言ってること」「変わってる気が」）
        if (/(さっきと言ってること|変わってる気|前と違う|食い違)/.test(p)) {
          score += 20;
        }
      } else if (skeleton.pattern_id === 'PATTERN-LOGICAL-PRIORITY-01') {
        // 三重例外・複合条件・除外フラグの判定（GAP-0012解消）
        if (/(例外|除外|フラグ|優先順位|条件A|条件B|三重|階層|上書き|スキップ|優先)/.test(p)) {
          score += 25;
        }
      }

      if (score > highestScore) {
        highestScore = score;
        bestSkeleton = skeleton;
      }
    }

    // スコア閾値チェック (25点以上で適用)
    if (bestSkeleton && highestScore >= 25) {
      // 思考節約効果の算出
      const diffChecks: string[] = [
        `状況適合: ${bestSkeleton.situation}`,
        `再利用モード: ${bestSkeleton.reuse_mode}`,
      ];

      if (state?.invalidatedAssumptions?.length) {
        diffChecks.push(`無効化前提: ${state.invalidatedAssumptions.join(', ')}`);
      }

      return {
        applied: true,
        matchedSkeleton: bestSkeleton,
        differenceCheck: diffChecks,
        savingsNote: `回答骨格「${bestSkeleton.pattern_id}」を適用。思考手順を定型化し推論計算量を節約します。`,
        stepsToExecute: bestSkeleton.response_plan,
      };
    }

    return {
      applied: false,
      savingsNote: '該当する定型回答骨格なし（通常推論モード）',
    };
  }

  /**
   * システムプロンプト注入用の骨格手順テキストを整形
   */
  public formatPlanForPrompt(result: AnswerPlanApplicationResult): string {
    if (!result.applied || !result.matchedSkeleton) return '';
    const sk = result.matchedSkeleton;
    const lines = [
      `【回答骨格の適用 (思考節約モード: ${sk.reuse_mode})】`,
      `パターンID: ${sk.pattern_id} (${sk.situation})`,
      `▼ 遵守すべき回答手順:`,
      ...sk.response_plan.map((s) => `  ${s}`),
      `▼ 回避・禁止事項:`,
      ...sk.avoid.map((a) => `  ・${a}`),
      `※余計な多段推論を行わず、上記手順の通りにダイレクトに結論を埋めて回答してください。`,
    ];
    return lines.join('\n');
  }

  public buildInstruction(skeleton: ResponseSkeleton): string {
    return this.formatPlanForPrompt({ applied: true, matchedSkeleton: skeleton });
  }

  /**
   * 使用実績と成功率の記録
   */
  public recordUsage(patternId: string, success: boolean): void {
    const sk = this.getSkeletonById(patternId);
    if (!sk) return;
    sk.usageCount = (sk.usageCount || 0) + 1;
    if (success) {
      sk.successRate = Math.min(100, Math.round((sk.successRate * 0.9) + 10));
    } else {
      sk.successRate = Math.max(0, Math.round((sk.successRate * 0.9)));
    }
    sk.updatedAt = Date.now();
    this.saveSkeletons();
  }
}

export const answerPlanService = new AnswerPlanService();
