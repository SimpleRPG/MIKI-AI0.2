import { SkillItem } from '../types';
import { systemLogger } from './systemLogger';
import { storageService } from './storageService';

const SKILLS_STORAGE_KEY = 'miki_ai_skills_library';

/**
 * 初期提供される組み込みスキル定義
 * 設計思想 13. スキルライブラリ
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
    successCount: 12,
    failureCount: 0,
    version: '1.2.0',
    createdAt: Date.now() - 86400000 * 10,
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
    successCount: 28,
    failureCount: 1,
    version: '1.1.0',
    createdAt: Date.now() - 86400000 * 20,
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
    successCount: 19,
    failureCount: 0,
    version: '1.0.0',
    createdAt: Date.now() - 86400000 * 15,
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
    successCount: 45,
    failureCount: 2,
    version: '1.3.0',
    createdAt: Date.now() - 86400000 * 30,
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
            this.skills = parsed;
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
      if (skill.status === 'official') score += 2;

      if (score > 0) {
        matched.push({ skill, score });
      }
    }

    matched.sort((a, b) => b.score - a.score);
    return matched.slice(0, 2).map((m) => m.skill);
  }

  /**
   * スキルの実行結果（成功・失敗）を記録し、蓄積データに基づいて
   * 候補(candidate) → 試験済み(tested) → 正式(official) の自動昇格判定を行う。
   * 失敗が続いた場合は降格もする(反証による自己修正)。
   * 設計思想 13. スキルライブラリー & 16. 複数候補、反証、テスト
   */
  public recordExecutionResult(id: string, success: boolean): void {
    const skill = this.skills.find((s) => s.id === id);
    if (!skill) return;

    if (success) {
      skill.successCount = (skill.successCount || 0) + 1;
    } else {
      skill.failureCount = (skill.failureCount || 0) + 1;
    }
    skill.updatedAt = Date.now();

    this.evaluatePromotion(skill);
    this.saveSkills();
  }

  /**
   * 蓄積された成功/失敗件数に基づく昇格・降格しきい値判定 (副作用: skill.status を書き換える)
   */
  private evaluatePromotion(skill: SkillItem): void {
    const total = (skill.successCount || 0) + (skill.failureCount || 0);
    if (total === 0) return;
    const successRate = (skill.successCount || 0) / total;
    const prevStatus = skill.status;

    if (skill.status === 'candidate') {
      // candidate -> tested: 最低5回試され、成功率70%以上
      if (total >= 5 && successRate >= 0.7) {
        skill.status = 'tested';
      }
    } else if (skill.status === 'tested') {
      // tested -> official: 最低15回試され、成功率85%以上の安定実績
      if (total >= 15 && successRate >= 0.85) {
        skill.status = 'official';
      }
      // tested -> candidate に逆戻り: 十分な試行数があるのに成功率が悪化
      else if (total >= 8 && successRate < 0.5) {
        skill.status = 'candidate';
      }
    } else if (skill.status === 'official') {
      // official でも成績が悪化し続けたら降格 (反証による自己修正)
      if (total >= 10 && successRate < 0.6) {
        skill.status = 'tested';
      }
    }

    if (skill.status !== prevStatus) {
      systemLogger.info(
        'SELF_IMPROVEMENT',
        `スキル「${skill.name}」のステータスが ${prevStatus} → ${skill.status} に変化 (成功率 ${Math.round(successRate * 100)}%, 試行 ${total}回)`
      );
    }
  }

  /**
   * 全スキルの昇格・降格を一括再評価
   */
  public evaluateAllSkillsPromotion(): { promotedCount: number; changedCount: number } {
    let changedCount = 0;
    for (const skill of this.skills) {
      const prev = skill.status;
      this.evaluatePromotion(skill);
      if (skill.status !== prev) changedCount++;
    }
    if (changedCount > 0) this.saveSkills();
    return { promotedCount: changedCount, changedCount };
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
