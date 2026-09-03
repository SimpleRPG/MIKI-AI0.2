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
}

export const skillsService = new SkillsService();
