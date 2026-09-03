import { SkillItem } from '../types';
import { systemLogger } from './systemLogger';
import { storageService } from './storageService';
import { selfImprovementService } from './selfImprovementService';

const SKILLS_STORAGE_KEY = 'miki_ai_skills_library';

/**
 * 50章: 文脈の多様性（別問題での再試験）判定ヘルパー
 * 単に同じ質問・トリガー文言が繰り返されただけでは昇格させず、
 * 異なる言い回しや目的（userGoal）が最低3パターン以上含まれているかを検証する。
 */
export function isDistinctSkillContext(newContext: string, existingContexts: string[] = []): boolean {
  if (!newContext || typeof newContext !== 'string') return false;
  const clean = newContext
    .trim()
    .toLowerCase()
    .replace(/[、。！？\s\-_.,!?()[\]{}「」]/g, ' ')
    .replace(/\s+/g, ' ');

  if (clean.length < 3) return false;

  // 既存コンテキストとのトークン・バイグラム重複率チェック
  const newTokens = new Set<string>();
  for (let i = 0; i < clean.length - 1; i++) {
    newTokens.add(clean.substring(i, i + 2));
  }

  for (const ex of existingContexts) {
    const exClean = ex
      .trim()
      .toLowerCase()
      .replace(/[、。！？\s\-_.,!?()[\]{}「」]/g, ' ')
      .replace(/\s+/g, ' ');

    if (clean === exClean) return false;

    const exTokens = new Set<string>();
    for (let i = 0; i < exClean.length - 1; i++) {
      exTokens.add(exClean.substring(i, i + 2));
    }

    let intersection = 0;
    for (const t of newTokens) {
      if (exTokens.has(t)) intersection++;
    }
    const union = new Set([...newTokens, ...exTokens]).size;
    const similarity = union > 0 ? intersection / union : 0;

    // 類似度が65%を超える場合は「同一パターンの繰り返し」と判定し、新文脈としてカウントしない
    if (similarity > 0.65) {
      return false;
    }
  }

  return true;
}

/**
 * 初期提供される組み込みスキル定義
 * 設計思想 13. スキルライブラリ & 50. 技能の卒業制度
 */
export const INITIAL_SKILLS: SkillItem[] = [
  {
    id: 'skill_vba_modern_transpile',
    name: 'VBAマクロ読解 & TypeScript/JS移植支援',
    category: 'vba',
    description: 'Excel VBAマクロコードのロジックを解析し、モダンなTypeScript/JavaScript関数やデータ処理に変換します。',
    triggerCondition: 'vba, macro, excel, ワークシート, range, cells, マクロ',
    requiredInputs: ['VBAコード抜粋またはTXTファイル', '目的の出力形式'],
    steps: [
      '1. 変数定義(Dim)とスコープを解析',
      '2. For/Whileループと条件分岐(If/Select)の構造を抽出',
      '3. Excel固有のRange/Cells操作を二次元配列やJSONデータ操作へマッピング',
      '4. TypeScriptの型安全な純粋関数として実装',
      '5. 境界値やNULL値の例外処理を追加',
    ],
    usedTools: ['codeParser', 'astExtractor'],
    outputFormat: '解説付きTypeScript関数 + 入出力サンプル',
    verificationMethod: 'サンプルデータによるモック実行 & 型チェック',
    status: 'official',
    distinctContexts: [
      'VBAコード抜粋をTypeScriptに変換したい',
      'ExcelマクロのRange/Cells操作を二次元配列JSON化したい',
      '複雑なWorksheet_ChangeイベントをReact状態管理へリファクタリング',
    ],
    promotedToOfficialAt: Date.now() - 86400000 * 25,
    successCount: 12,
    failureCount: 0,
    version: '1.2.0',
    createdAt: Date.now() - 86400000 * 35,
    updatedAt: Date.now(),
  },
  {
    id: 'skill_canvas_debug_repair',
    name: 'HTML5 Canvas 描画ループ & 衝突判定デバッグ',
    category: 'debug',
    description: 'CanvasゲームにおけるrequestAnimationFrameループ停止、当たり判定ズレ、メモリリークを診断・修復します。',
    triggerCondition: 'canvas, 描画, 当たり判定, requestanimationframe, ループ, 止まる, 画面が消える',
    requiredInputs: ['ゲームのメインループコード', '発生している不具合の症状'],
    steps: [
      '1. canvas.getContext("2d") の初期化とリサイズ処理を確認',
      '2. ctx.clearRect() と requestAnimationFrame の再帰呼び出しチェーンを検証',
      '3. AABB(矩形)または円の衝突判定式の不等号・座標基準(中心vs左上)を精査',
      '4. 状態変数の不整合(isGameOverフラグなど)を修正',
    ],
    usedTools: ['codeParser', 'browserSandbox'],
    outputFormat: '差分修正コード + 原因と防止策の解説',
    verificationMethod: 'プレビュー実行でのフレームレートおよび衝突イベント発火確認',
    status: 'official',
    distinctContexts: [
      'requestAnimationFrameループが停止して画面が固まる',
      'AABB矩形の当たり判定座標が画面拡大時にズレる',
      'Canvas再描画時にメモリリークしてフレームレートが低下する',
    ],
    promotedToOfficialAt: Date.now() - 86400000 * 20,
    successCount: 28,
    failureCount: 1,
    version: '1.1.0',
    createdAt: Date.now() - 86400000 * 30,
    updatedAt: Date.now(),
  },
  {
    id: 'skill_task_decomposition',
    name: '要件定義 & タスク段階的分解 (司令塔モード)',
    category: 'planning',
    description: '大きな開発要望を、依存関係を考慮した小さな実行可能ステップ（JSON構造化）に分解します。',
    triggerCondition: '作りたい, 開発計画, 要件, 仕様, 全体像, どう作ればいい',
    requiredInputs: ['ユーザーの要望・アイデア'],
    steps: [
      '1. 最終ゴールと必須要件(MVP)を特定',
      '2. UI、データモデル、ロジック、永続化の4層に分離',
      '3. 依存関係の順序で1ステップずつ実装可能なサブタスクに分割',
      '4. 各ステップの完了判定基準(Done Definition)を設定',
    ],
    usedTools: ['taskPlanner'],
    outputFormat: 'ステップ順タスク一覧 (チェックリスト形式)',
    verificationMethod: 'ユーザーによる着手順の合意確認',
    status: 'official',
    distinctContexts: [
      'Webアプリ全体の段階的タスク分解',
      '複雑なバックエンドAPIのMVPスコープ整理',
      'Canvasゲーム機能要件のJSON構造化計画',
    ],
    promotedToOfficialAt: Date.now() - 86400000 * 18,
    successCount: 19,
    failureCount: 0,
    version: '1.0.0',
    createdAt: Date.now() - 86400000 * 25,
    updatedAt: Date.now(),
  },
  {
    id: 'skill_code_syntax_audit',
    name: 'コード文法・ブラケット整合性 自己検証',
    category: 'coding',
    description: '生成したJavaScript/TypeScriptコードに閉じタグ不足や構文エラーがないかを機械検証します。',
    triggerCondition: '構文エラー, syntaxerror, unexpected token, コードチェック',
    requiredInputs: ['対象のソースコード'],
    steps: [
      '1. 括弧 (), {}, [] のペアバランスをスタック走査',
      '2. テンプレートリテラル(バッククォート)の閉合を確認',
      '3. 未定義変数の参照やimport文の整合性を確認',
    ],
    usedTools: ['codeParser'],
    outputFormat: 'エラー箇所の行数 + 修正後コード',
    verificationMethod: '静的パースチェック',
    status: 'official',
    distinctContexts: [
      '閉じ括弧不足のSyntaxErrorを自己修復する',
      'テンプレートリテラルのバッククォート閉合不整合を検査',
      'TypeScriptのimportパス欠落および未定義変数を検出',
    ],
    promotedToOfficialAt: Date.now() - 86400000 * 35,
    successCount: 48,
    failureCount: 2,
    version: '1.3.0',
    createdAt: Date.now() - 86400000 * 45,
    updatedAt: Date.now(),
  },
];

class SkillsService {
  private skills: SkillItem[] = [];

  constructor() {
    this.loadSkills();
  }

  public loadSkills(): SkillItem[] {
    if (typeof storageService !== 'undefined') {
      try {
        const raw = storageService.getItem(SKILLS_STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) {
            // 50章対応: 既存の保存済みスキルにdistinctContextsとpromotedToOfficialAtを補完
            this.skills = parsed.map((s: SkillItem) => ({
              ...s,
              distinctContexts: Array.isArray(s.distinctContexts) ? s.distinctContexts : [],
              promotedToOfficialAt:
                s.promotedToOfficialAt ||
                (s.status === 'official' || (s.status as any) === 'official_matured'
                  ? s.createdAt || Date.now() - 86400000 * 31
                  : undefined),
            }));
            return this.skills;
          }
        }
      } catch (e) {
        console.warn('Failed to parse skills from localStorage:', e);
      }
    }
    this.skills = [...INITIAL_SKILLS];
    this.saveSkills();
    return this.skills;
  }

  public saveSkills(): void {
    if (typeof storageService !== 'undefined') {
      try {
        storageService.setItem(SKILLS_STORAGE_KEY, JSON.stringify(this.skills));
      } catch (e) {
        console.warn('Failed to save skills to localStorage:', e);
      }
    }
  }

  public getAllSkills(): SkillItem[] {
    if (this.skills.length === 0) {
      this.loadSkills();
    }
    return this.skills;
  }

  public addSkill(skill: Omit<SkillItem, 'id' | 'createdAt' | 'updatedAt' | 'successCount' | 'failureCount'>): SkillItem {
    const newSkill: SkillItem = {
      ...skill,
      id: 'skill_' + Date.now(),
      distinctContexts: skill.distinctContexts || [],
      promotedToOfficialAt: skill.status === 'official' ? Date.now() : undefined,
      successCount: 0,
      failureCount: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    this.skills.unshift(newSkill);
    this.saveSkills();
    return newSkill;
  }

  public updateSkill(id: string, updates: Partial<SkillItem>): SkillItem | null {
    const index = this.skills.findIndex((s) => s.id === id);
    if (index === -1) return null;

    this.skills[index] = {
      ...this.skills[index],
      ...updates,
      updatedAt: Date.now(),
    };
    this.saveSkills();
    return this.skills[index];
  }

  public deleteSkill(id: string): boolean {
    const initialLen = this.skills.length;
    this.skills = this.skills.filter((s) => s.id !== id);
    if (this.skills.length !== initialLen) {
      this.saveSkills();
      return true;
    }
    return false;
  }

  /**
   * ユーザーの発言からマッチするスキルを検索
   */
  public matchSkillsForQuery(query: string): SkillItem[] {
    if (!query) return [];
    const qLower = query.toLowerCase();
    const activeSkills = this.skills.filter((s) => s.status !== 'disabled');

    const matched: Array<{ skill: SkillItem; score: number }> = [];

    for (const skill of activeSkills) {
      let score = 0;
      const triggers = skill.triggerCondition.toLowerCase().split(/[\s,、]+/);
      for (const t of triggers) {
        if (t && qLower.includes(t)) {
          score += 5;
        }
      }

      if (qLower.includes(skill.name.toLowerCase())) score += 10;
      if (skill.status === 'official_matured') score += 3;
      else if (skill.status === 'official') score += 2;

      if (score > 0) {
        matched.push({ skill, score });
      }
    }

    matched.sort((a, b) => b.score - a.score);
    return matched.slice(0, 2).map((m) => m.skill);
  }

  /**
   * スキルの実行結果（成功・失敗）と発火文脈を記録し、
   * 候補(candidate) → 試験済み(tested) → 正式(official) → 卒業(official_matured) の自動昇格判定を行う。
   * 50章: 文脈の多様性（別問題での再試験）およびLoRA教材化（卒業制度）を厳格に適用。
   */
  public recordExecutionResult(id: string, success: boolean, contextPrompt?: string): void {
    const skill = this.skills.find((s) => s.id === id);
    if (!skill) return;

    if (success) {
      skill.successCount = (skill.successCount || 0) + 1;
    } else {
      skill.failureCount = (skill.failureCount || 0) + 1;
    }

    // 50章: 実行時のトリガー文言・userGoalの文脈多様性を記録
    if (contextPrompt) {
      if (!Array.isArray(skill.distinctContexts)) {
        skill.distinctContexts = [];
      }
      if (isDistinctSkillContext(contextPrompt, skill.distinctContexts)) {
        skill.distinctContexts.push(contextPrompt.trim().slice(0, 120));
        if (skill.distinctContexts.length > 10) {
          skill.distinctContexts = skill.distinctContexts.slice(-10);
        }
      }
    }

    skill.updatedAt = Date.now();

    this.evaluatePromotion(skill);
    this.saveSkills();
  }

  /**
   * 蓄積された成功/失敗件数および文脈多様性に基づく昇格・降格しきい値判定 (副作用: skill.status を書き換える)
   * 設計思想 50. 技能の卒業制度
   */
  private evaluatePromotion(skill: SkillItem): void {
    const total = (skill.successCount || 0) + (skill.failureCount || 0);
    if (total === 0) return;
    const successRate = (skill.successCount || 0) / total;
    const prevStatus = skill.status;
    const distinctCount = skill.distinctContexts?.length || 0;

    if (skill.status === 'candidate') {
      // 50章: candidate -> tested の昇格条件
      // 1. 最低5回試行
      // 2. 成功率70%以上
      // 3. 【重要】異なる文脈が最低3パターン以上含まれること (別問題での再試験)
      if (total >= 5 && successRate >= 0.7) {
        if (distinctCount >= 3) {
          skill.status = 'tested';
          skill.diversityWarning = undefined;
          systemLogger.info(
            'SELF_IMPROVEMENT',
            `🎉 [50章 技能昇格] スキル「${skill.name}」が異なる3パターン以上の文脈(${distinctCount}種)での再試験をクリアし tested に昇格しました (成功率 ${Math.round(successRate * 100)}%)`
          );
        } else {
          // 文脈多様性が不足している場合: 単一文脈での連続成功に過ぎないため昇格保留
          skill.diversityWarning = `文脈多様性未達 (${distinctCount}/3パターン): 同一または類似の聞き方でのみ成功しているため、一般スキルへの昇格を保留しています。`;
          if (total >= 10 && distinctCount < 2) {
            skill.diversityWarning = `【案件固有エピソード推奨】試行${total}回に対し文脈が1パターンのみです。汎用スキルではなく特定プロジェクトのエピソード記憶への配置を推奨します。`;
          }
        }
      }
    } else if (skill.status === 'tested') {
      // tested -> official: 最低15回試され、成功率85%以上の安定実績
      if (total >= 15 && successRate >= 0.85) {
        skill.status = 'official';
        skill.promotedToOfficialAt = skill.promotedToOfficialAt || Date.now();
        skill.diversityWarning = undefined;
      }
      // tested -> candidate に逆戻り: 十分な試行数があるのに成功率が悪化
      else if (total >= 8 && successRate < 0.5) {
        skill.status = 'candidate';
      }
    } else if (skill.status === 'official') {
      // 50章: 技能の卒業制度 (Graduation to official_matured & LoRA training dataset)
      // 条件:
      // 1. 正式スキル(official)として運用開始から30日以上経過
      // 2. 50回以上の成功実績
      // 3. 成功率85%以上の高信頼性
      const officialTimestamp = skill.promotedToOfficialAt || skill.createdAt || (Date.now() - 86400000 * 31);
      const daysSinceOfficial = (Date.now() - officialTimestamp) / 86400000;
      const isMaturedDuration = daysSinceOfficial >= 30;
      const hasMaturedSuccessCount = (skill.successCount || 0) >= 50;

      if (isMaturedDuration && hasMaturedSuccessCount && successRate >= 0.85) {
        skill.status = 'official_matured';
        this.graduateSkillToTrainingDataset(skill);
      }
      // official でも成績が悪化し続けたら降格 (反証による自己修正)
      else if (total >= 10 && successRate < 0.6) {
        skill.status = 'tested';
      }
    } else if (skill.status === 'official_matured') {
      // official_matured のスキルでも、大幅な仕様変更等で失敗が連続した場合はofficialへ降格
      if (total >= 20 && successRate < 0.7) {
        skill.status = 'official';
      }
    }

    if (skill.status !== prevStatus) {
      systemLogger.info(
        'SELF_IMPROVEMENT',
        `スキル「${skill.name}」のステータスが ${prevStatus} → ${skill.status} に変化 (成功率 ${Math.round(successRate * 100)}%, 試行 ${total}回, 多様性文脈 ${distinctCount}パターン)`
      );
    }
  }

  /**
   * 50章: 技能の卒業 (official_matured → selfImprovementService.addTrainingSample への自動投入)
   * 49章の保存先ルーターでいう「LoRA教材」区分へ正式に橋渡しする
   */
  public graduateSkillToTrainingDataset(skill: SkillItem): void {
    if (skill.graduatedToTrainingAt) return; // すでに投入済みの場合は多重登録防止

    try {
      const representativeContexts =
        skill.distinctContexts && skill.distinctContexts.length > 0
          ? `\n【検証済み実行文脈】\n${skill.distinctContexts.slice(0, 3).map((c, idx) => `${idx + 1}. ${c}`).join('\n')}`
          : '';

      const instruction = `【自律獲得技能】${skill.name}\n${skill.description}${representativeContexts}`;
      const inputContext = `適用トリガー: ${skill.triggerCondition}\n必要入力: ${skill.requiredInputs.join('、 ')}\n使用ツール: ${skill.usedTools.join('、 ')}`;
      const outputTarget = `【実行手順】\n${skill.steps.map((st, i) => `${i + 1}. ${st.replace(/^\d+\.\s*/, '')}`).join('\n')}\n\n【出力形式】\n${skill.outputFormat}\n\n【検証方法】\n${skill.verificationMethod}`;

      let cat: 'chat' | 'vba' | 'code' | 'retrieval' | 'correction' | 'tool_use' = 'tool_use';
      if (skill.category === 'vba') cat = 'vba';
      else if (skill.category === 'coding' || skill.category === 'debug') cat = 'code';
      else if (skill.category === 'retrieval') cat = 'retrieval';

      const sample = selfImprovementService.addTrainingSample({
        instruction,
        inputContext,
        outputTarget,
        category: cat,
        reliability: 'high',
        source: 'synthetic',
        approved: true,
        split: 'train',
      });

      skill.graduatedToTrainingAt = Date.now();
      if (sample?.id) {
        skill.trainingSampleId = sample.id;
      }

      systemLogger.info(
        'SELF_IMPROVEMENT',
        `🎓 [50章 技能の卒業制度] 正式運用スキル「${skill.name}」が長期安定稼働(30日以上運用 & 成功${skill.successCount}回)を達成！ status: 'official_matured' へ卒業し、selfImprovementService (LoRA教材プール) へ自動投入しました (SampleID: ${sample?.id || 'registered'})`
      );
    } catch (err: any) {
      console.warn('Failed to graduate skill to training dataset:', err);
    }
  }

  /**
   * 全スキルの昇格・降格を一括再評価
   */
  public evaluateAllSkillsPromotion(): { promotedCount: number; changedCount: number; graduatedCount: number } {
    let changedCount = 0;
    let graduatedCount = 0;
    for (const skill of this.skills) {
      const prev = skill.status;
      this.evaluatePromotion(skill);
      if (skill.status !== prev) {
        changedCount++;
        if (skill.status === 'official_matured') {
          graduatedCount++;
        }
      }
    }
    if (changedCount > 0) this.saveSkills();
    return { promotedCount: changedCount, changedCount, graduatedCount };
  }

  /**
   * 会話履歴やコード修復履歴から再利用可能なスキルを自動抽出・構造化
   * 設計思想 13. スキルライブラリ (暗黙知の明示化・手続き化)
   */
  public autoExtractSkillsFromHistory(
    messages: Array<{ role: string; content: string; codeBlocks?: any[] }>,
    existingSamples?: Array<{ instruction: string; outputTarget: string; category?: string }>
  ): SkillItem[] {
    const extractedSkills: SkillItem[] = [];
    const allExistingTriggers = this.skills.map((s) => s.triggerCondition.toLowerCase());

    // 1. 会話ログから成功した専門タスクパターンを走査
    for (let i = 0; i < messages.length - 1; i++) {
      const userMsg = messages[i];
      const assistantMsg = messages[i + 1];

      if (userMsg.role !== 'user' || assistantMsg.role !== 'assistant') continue;
      const userText = userMsg.content.toLowerCase();
      const assistantText = assistantMsg.content;

      // パターンA: 正規表現やデータ変換の成功パターン
      if (
        (userText.includes('正規表現') || userText.includes('抽出') || userText.includes('パース') || userText.includes('regex')) &&
        (assistantText.includes('RegExp') || assistantText.includes('match') || assistantText.includes('/^')) &&
        assistantText.length > 80
      ) {
        const trigger = '正規表現, regex, パース, 抽出, regexp, 文字列抽出';
        if (!allExistingTriggers.some((t) => t.includes('正規表現') || t.includes('regex'))) {
          const newSkill: SkillItem = {
            id: 'skill_auto_regex_' + Date.now(),
            name: '正規表現パターン設計 & 文字列抽出パーサー',
            category: 'coding',
            description: '複雑な文字列仕様から安全でReDoS耐性のある正規表現を設計し、グループ抽出コードを生成します。',
            triggerCondition: trigger,
            requiredInputs: ['抽出対象のサンプルテキスト', 'マッチさせたい文字列の条件・境界規則'],
            steps: [
              '1. マッチ対象の前後の境界文字(Prefix/Suffix)を特定',
              '2. カタストロフィックバックトラッキングを起こさない非貪欲(*?)または文字クラス([a-zA-Z0-9_-])の設計',
              '3. キャプチャグループ()の割り当て',
              '4. TypeScript / JS の RegExp.exec() または matchAll() での実装コード出力',
            ],
            usedTools: ['regexTester', 'codeParser'],
            outputFormat: '正規表現リテラル + テストケース付きパース関数',
            verificationMethod: '境界値テストケースでの実行検証',
            status: 'candidate',
            distinctContexts: [userMsg.content.trim().slice(0, 100)],
            successCount: 1,
            failureCount: 0,
            version: '1.0.0',
            createdAt: Date.now(),
            updatedAt: Date.now(),
          };
          this.skills.push(newSkill);
          extractedSkills.push(newSkill);
          allExistingTriggers.push(trigger);
        }
      }

      // パターンB: IndexedDB / WebStorage 永続化データ同期
      if (
        (userText.includes('保存') || userText.includes('localstorage') || userText.includes('indexeddb') || userText.includes('キャッシュ')) &&
        (assistantText.includes('setItem') || assistantText.includes('getItem') || assistantText.includes('JSON.parse')) &&
        assistantText.length > 80
      ) {
        const trigger = 'localstorage, indexeddb, 永続化, キャッシュ, 保存, 同期, ストレージ';
        if (!allExistingTriggers.some((t) => t.includes('localstorage') || t.includes('indexeddb'))) {
          const newSkill: SkillItem = {
            id: 'skill_auto_storage_' + Date.now(),
            name: 'LocalStorage / 構造化データ型安全キャッシュ永続化',
            category: 'coding',
            description: 'ブラウザストレージの容量制約やJSONパースエラーを防御しつつ、型安全に状態を同期します。',
            triggerCondition: trigger,
            requiredInputs: ['永続化対象のデータ型定義', '保存・読み込みのキー名'],
            steps: [
              '1. JSON.stringify / parse の try-catch 例外防壁を配置',
              '2. クォータ超過(QuotaExceededError)発生時の古いLRUキャッシュ破棄処理',
              '3. スキーマバージョン変更時のマイグレーション関数を定義',
              '4. React useEffect / カスタムフックとの安全なバインド',
            ],
            usedTools: ['storageValidator', 'codeParser'],
            outputFormat: '型安全なストレージアクセス関数 + マイグレーションハンドラ',
            verificationMethod: 'モックストレージでのJSON破損・容量超過テスト',
            status: 'candidate',
            distinctContexts: [userMsg.content.trim().slice(0, 100)],
            successCount: 1,
            failureCount: 0,
            version: '1.0.0',
            createdAt: Date.now(),
            updatedAt: Date.now(),
          };
          this.skills.push(newSkill);
          extractedSkills.push(newSkill);
          allExistingTriggers.push(trigger);
        }
      }

      // パターンC: CSS flex/grid レスポンシブレイアウト崩れ修正
      if (
        (userText.includes('はみ出る') || userText.includes('レイアウト') || userText.includes('レスポンシブ') || userText.includes('スクロールできない')) &&
        (assistantText.includes('overflow') || assistantText.includes('flex-1') || assistantText.includes('min-h-0') || assistantText.includes('grid'))
      ) {
        const trigger = 'レイアウト崩れ, はみ出る, 横スクロール, flex, grid, overflow, レスポンシブ';
        if (!allExistingTriggers.some((t) => t.includes('レイアウト崩れ') || t.includes('overflow'))) {
          const newSkill: SkillItem = {
            id: 'skill_auto_css_layout_' + Date.now(),
            name: 'Flexbox / Grid コンテナ溢れ & 最小寸法デバッグ',
            category: 'debug',
            description: 'Flexbox/Gridにおけるmin-width:0/min-height:0の欠落によるテキストあふれやスクロール停止を解消します。',
            triggerCondition: trigger,
            requiredInputs: ['崩れているJSX/CSS構造', '画面サイズ別の意図する表示挙動'],
            steps: [
              '1. 親要素の flex-direction と flex-1 (flex-grow:1) を確認',
              '2. 子要素に min-w-0 / min-h-0 を付与して縮小を許可',
              '3. 内部テキストに truncate または break-words を適用',
              '4. スクロール領域に overflow-y-auto を明示し親の高さを制約',
            ],
            usedTools: ['cssAuditor', 'browserSandbox'],
            outputFormat: 'Tailwindクラス修正差分 + 挙動解説',
            verificationMethod: '極小幅(320px)〜ワイド幅(1920px)でのレンダリング確認',
            status: 'candidate',
            distinctContexts: [userMsg.content.trim().slice(0, 100)],
            successCount: 1,
            failureCount: 0,
            version: '1.0.0',
            createdAt: Date.now(),
            updatedAt: Date.now(),
          };
          this.skills.push(newSkill);
          extractedSkills.push(newSkill);
          allExistingTriggers.push(trigger);
        }
      }
    }

    if (extractedSkills.length > 0) {
      this.saveSkills();
      systemLogger.info(
        'SELF_IMPROVEMENT',
        `💡 [スキル自律抽出] 対話履歴から新たに${extractedSkills.length}件の再利用可能スキル候補を抽出・登録しました: ${extractedSkills.map((s) => s.name).join(', ')}`
      );
    }

    return extractedSkills;
  }
}

export const skillsService = new SkillsService();
