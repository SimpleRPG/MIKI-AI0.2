import {
  ToolDefinition,
  ToolExecutionRequest,
  ToolExecutionResult,
  ToolRecommendation,
  ToolPermissionLevel,
  WorkspaceFile,
  SafeMathResult,
} from '../types';
import { systemLogger } from './systemLogger';
import { storageService } from './storageService';
import { capabilityPluginService } from './capabilityPluginService';
import { autonomousSearchService } from './autonomousSearchService';
import { selfCodeArchitectService } from './selfCodeArchitectService';
import { cognitiveDebuggerService } from './cognitiveDebuggerService';
import { digitalResearchNoteService } from './digitalResearchNoteService';
import { codebaseReflectionService } from './codebaseReflectionService';

const TOOLS_STATS_STORAGE_KEY = 'miki_ai_tools_stats';

export interface ToolExecutionContext {
  workspaceFiles?: WorkspaceFile[];
  onUpdateWorkspaceFile?: (path: string, content: string) => void;
  userNickname?: string;
}

export interface ExecuteToolOptions {
  userConfirmed?: boolean;
}

/**
 * 安全な数式トークナイザー & 再帰下降パーサー (eval/Function完全不使用)
 * 設計思想 14 & 22. 安全なローカル計算エンジン
 */
class SafeMathEvaluator {
  private pos = 0;
  private expr = '';

  public evaluate(rawExpr: string): { result: number; formatted: string; expression: string } {
    const cleaned = this.preprocess(rawExpr);
    if (!cleaned) {
      throw new Error('数式が空または解釈できません');
    }
    this.expr = cleaned;
    this.pos = 0;

    const val = this.parseExpression();
    this.skipWhitespace();
    if (this.pos < this.expr.length) {
      throw new Error(`数式の途中に不正な文字があります: '${this.expr[this.pos]}' (位置: ${this.pos})`);
    }

    if (!isFinite(val) || isNaN(val)) {
      throw new Error('計算結果が未定義またはゼロ除算が発生しました');
    }

    // 丸め誤差を考慮したフォーマット
    const rounded = Math.abs(val) < 1e-12 ? 0 : Number(val.toFixed(10));
    const formatted = rounded.toLocaleString('ja-JP', { maximumFractionDigits: 6 });

    return {
      result: rounded,
      formatted,
      expression: cleaned,
    };
  }

  /**
   * 日本語の日常計算表現や全角記号を標準数式へ変換
   */
  public preprocess(input: string): string {
    let s = input.trim();
    // 全角英数・記号の半角化
    s = s.replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));
    s = s.replace(/×/g, '*').replace(/÷/g, '/').replace(/＋/g, '+').replace(/−|ー/g, '-');
    s = s.replace(/（/g, '(').replace(/）/g, ')').replace(/％/g, '%');
    s = s.replace(/√\s*(\d+(?:\.\d+)?)/g, 'sqrt($1)');

    // 日本語構文の置換
    // 例: 1000円の税込10% -> 1000 * 1.1
    s = s.replace(/(\d+(?:\.\d+)?)\s*円?の税込(?:(\d+)%)?/g, (_, num, tax) => {
      const rate = tax ? Number(tax) / 100 : 0.1;
      return `(${num} * (1 + ${rate}))`;
    });
    // 例: 1000円の税別10% -> 1000 / 1.1
    s = s.replace(/(\d+(?:\.\d+)?)\s*円?の税別(?:(\d+)%)?/g, (_, num, tax) => {
      const rate = tax ? Number(tax) / 100 : 0.1;
      return `(${num} / (1 + ${rate}))`;
    });
    // 例: 1000の3割引き -> 1000 * (1 - 0.3)
    s = s.replace(/(\d+(?:\.\d+)?)\s*(?:円|個)?の\s*(\d+)割(?:(\d+)分)?引き/g, (_, num, wari, bu) => {
      const rate = Number(wari) * 0.1 + (bu ? Number(bu) * 0.01 : 0);
      return `(${num} * (1 - ${rate}))`;
    });
    // 例: 1000の3割 -> 1000 * 0.3
    s = s.replace(/(\d+(?:\.\d+)?)\s*(?:円|個)?の\s*(\d+)割(?:(\d+)分)?/g, (_, num, wari, bu) => {
      const rate = Number(wari) * 0.1 + (bu ? Number(bu) * 0.01 : 0);
      return `(${num} * ${rate})`;
    });
    // 例: 500の20%引き -> 500 * (1 - 0.2)
    s = s.replace(/(\d+(?:\.\d+)?)\s*(?:円|個)?の\s*(\d+(?:\.\d+)?)(?:%|パーセント)引き/g, (_, num, pct) => {
      return `(${num} * (1 - ${Number(pct) / 100}))`;
    });
    // 例: 500の20% -> 500 * 0.2
    s = s.replace(/(\d+(?:\.\d+)?)\s*(?:円|個)?の\s*(\d+(?:\.\d+)?)(?:%|パーセント)/g, (_, num, pct) => {
      return `(${num} * (${Number(pct) / 100}))`;
    });
    // 例: 2の10乗 -> 2 ^ 10
    s = s.replace(/(\d+(?:\.\d+)?)\s*の\s*(\d+(?:\.\d+)?)\s*乗/g, '$1 ^ $2');

    return s;
  }

  private skipWhitespace() {
    while (this.pos < this.expr.length && /\s/.test(this.expr[this.pos])) {
      this.pos++;
    }
  }

  // 加算・減算
  private parseExpression(): number {
    let val = this.parseTerm();
    while (true) {
      this.skipWhitespace();
      if (this.pos < this.expr.length && this.expr[this.pos] === '+') {
        this.pos++;
        val += this.parseTerm();
      } else if (this.pos < this.expr.length && this.expr[this.pos] === '-') {
        this.pos++;
        val -= this.parseTerm();
      } else {
        break;
      }
    }
    return val;
  }

  // 乗算・除算・剰余
  private parseTerm(): number {
    let val = this.parsePower();
    while (true) {
      this.skipWhitespace();
      if (this.pos < this.expr.length && (this.expr[this.pos] === '*' || (this.expr[this.pos] === '*' && this.expr[this.pos + 1] !== '*'))) {
        this.pos++;
        val *= this.parsePower();
      } else if (this.pos < this.expr.length && this.expr[this.pos] === '/') {
        this.pos++;
        const divisor = this.parsePower();
        if (divisor === 0) throw new Error('ゼロによる除算エラー');
        val /= divisor;
      } else if (this.pos < this.expr.length && this.expr[this.pos] === '%') {
        this.pos++;
        const divisor = this.parsePower();
        if (divisor === 0) throw new Error('ゼロによる剰余計算エラー');
        val %= divisor;
      } else {
        break;
      }
    }
    return val;
  }

  // べき乗 (^ または **)
  private parsePower(): number {
    let val = this.parseFactor();
    this.skipWhitespace();
    if (this.pos < this.expr.length && this.expr[this.pos] === '^') {
      this.pos++;
      val = Math.pow(val, this.parsePower());
    } else if (this.pos + 1 < this.expr.length && this.expr.substr(this.pos, 2) === '**') {
      this.pos += 2;
      val = Math.pow(val, this.parsePower());
    }
    return val;
  }

  // 単項演算子、数値、関数、括弧
  private parseFactor(): number {
    this.skipWhitespace();
    if (this.pos >= this.expr.length) {
      throw new Error('予期せぬ数式の終端です');
    }

    const ch = this.expr[this.pos];

    // 単項マイナス
    if (ch === '-') {
      this.pos++;
      return -this.parseFactor();
    }
    // 単項プラス
    if (ch === '+') {
      this.pos++;
      return this.parseFactor();
    }

    // 括弧
    if (ch === '(') {
      this.pos++;
      const val = this.parseExpression();
      this.skipWhitespace();
      if (this.pos >= this.expr.length || this.expr[this.pos] !== ')') {
        throw new Error('閉じ括弧 ")" が不足しています');
      }
      this.pos++;
      return val;
    }

    // 数値
    if (/[0-9.]/.test(ch)) {
      const start = this.pos;
      let hasDot = ch === '.';
      this.pos++;
      while (this.pos < this.expr.length && (/[0-9]/.test(this.expr[this.pos]) || (!hasDot && this.expr[this.pos] === '.'))) {
        if (this.expr[this.pos] === '.') hasDot = true;
        this.pos++;
      }
      const numStr = this.expr.substring(start, this.pos);
      const val = parseFloat(numStr);
      if (isNaN(val)) throw new Error(`不正な数値です: ${numStr}`);
      return val;
    }

    // 識別子 (関数名または定数)
    if (/[a-zA-Z_]/.test(ch)) {
      const start = this.pos;
      while (this.pos < this.expr.length && /[a-zA-Z0-9_]/.test(this.expr[this.pos])) {
        this.pos++;
      }
      const name = this.expr.substring(start, this.pos).toLowerCase();

      // 定数
      if (name === 'pi') return Math.PI;
      if (name === 'e') return Math.E;

      // 関数
      this.skipWhitespace();
      if (this.pos >= this.expr.length || this.expr[this.pos] !== '(') {
        throw new Error(`未定義の定数または関数の括弧不足: ${name}`);
      }
      this.pos++; // skip '('

      // 引数解析 (カンマ区切り対応)
      const args: number[] = [];
      this.skipWhitespace();
      if (this.pos < this.expr.length && this.expr[this.pos] !== ')') {
        args.push(this.parseExpression());
        this.skipWhitespace();
        while (this.pos < this.expr.length && this.expr[this.pos] === ',') {
          this.pos++;
          args.push(this.parseExpression());
          this.skipWhitespace();
        }
      }
      if (this.pos >= this.expr.length || this.expr[this.pos] !== ')') {
        throw new Error(`関数 ${name} の閉じ括弧 ")" が不足しています`);
      }
      this.pos++; // skip ')'

      switch (name) {
        case 'sqrt':
          if (args[0] < 0) throw new Error('負の平方根は実数ではありません');
          return Math.sqrt(args[0]);
        case 'cbrt':
          return Math.cbrt(args[0]);
        case 'abs':
          return Math.abs(args[0]);
        case 'round':
          return Math.round(args[0]);
        case 'floor':
          return Math.floor(args[0]);
        case 'ceil':
          return Math.ceil(args[0]);
        case 'sin':
          return Math.sin(args[0]);
        case 'cos':
          return Math.cos(args[0]);
        case 'tan':
          return Math.tan(args[0]);
        case 'log':
        case 'ln':
          if (args[0] <= 0) throw new Error('対数の真数は正である必要があります');
          return Math.log(args[0]);
        case 'log10':
          if (args[0] <= 0) throw new Error('対数の真数は正である必要があります');
          return Math.log10(args[0]);
        case 'exp':
          return Math.exp(args[0]);
        case 'min':
          if (args.length === 0) throw new Error('min() には引数が必要です');
          return Math.min(...args);
        case 'max':
          if (args.length === 0) throw new Error('max() には引数が必要です');
          return Math.max(...args);
        case 'pow':
          if (args.length < 2) throw new Error('pow() には2つの引数が必要です');
          return Math.pow(args[0], args[1]);
        default:
          throw new Error(`サポートされていない計算関数です: ${name}`);
      }
    }

    throw new Error(`不正な文字を検出しました: '${ch}' (位置: ${this.pos})`);
  }
}

/**
 * 初期定義ツール群 (:feature:tools)
 * 設計思想 13-14章, 22章
 */
export const BUILTIN_TOOLS: ToolDefinition[] = [
  {
    id: 'tool_safe_calculator',
    name: '安全数値計算エンジン (Safe Math)',
    description: '四則演算、べき乗、平方根、三角関数、および「税込・税別・割引・何割」などの日常計算をeval不使用の安全な静的パーサーで計算します。',
    category: 'math',
    permission: 'read_only',
    requiresConfirmation: false,
    parameters: [
      {
        name: 'expression',
        type: 'string',
        description: '計算したい数式または表現 (例: "1250 * 1.1", "sqrt(144) + 15 * 2", "3500円の税込10%", "1000の3割引き")',
        required: true,
      },
    ],
    linkedSkillIds: ['skill_task_decomposition'],
    isAvailable: true,
  },
  {
    id: 'tool_syntax_checker',
    name: 'コード構文・括弧整合性チェッカー (Code Syntax Audit)',
    description: 'JavaScript/TypeScript/JSON/HTMLコードの括弧のネストバランス、クォートの閉合、未完のタグ、構文エラーを行・列番号付きで静的検証します。',
    category: 'code',
    permission: 'read_only',
    requiresConfirmation: false,
    parameters: [
      {
        name: 'code',
        type: 'string',
        description: '検証対象のソースコード',
        required: true,
      },
      {
        name: 'language',
        type: 'string',
        description: '対象言語 (javascript, typescript, json, html)',
        required: false,
        defaultValue: 'javascript',
        options: ['javascript', 'typescript', 'json', 'html'],
      },
    ],
    linkedSkillIds: ['skill_code_syntax_audit', 'skill_canvas_debug_repair'],
    isAvailable: true,
  },
  {
    id: 'tool_workspace_search',
    name: 'ワークスペース全文検索 (Workspace Grep)',
    description: 'ワークスペース内の全ファイルから指定キーワードや正規表現を検索し、一致した行番号と前後文脈を抽出します。',
    category: 'workspace',
    permission: 'workspace_read',
    requiresConfirmation: false,
    parameters: [
      {
        name: 'query',
        type: 'string',
        description: '検索する文字列またはパターン',
        required: true,
      },
      {
        name: 'caseSensitive',
        type: 'boolean',
        description: '大文字・小文字を区別するかどうか',
        required: false,
        defaultValue: false,
      },
      {
        name: 'filePattern',
        type: 'string',
        description: '対象ファイルの拡張子または名前フィルタ (例: ".html", ".js", "index")',
        required: false,
      },
    ],
    linkedSkillIds: ['skill_canvas_debug_repair', 'skill_vba_modern_transpile'],
    isAvailable: true,
  },
  {
    id: 'tool_workspace_read',
    name: 'ワークスペースファイル読込 (Workspace Reader)',
    description: 'ワークスペース内の指定されたファイルを安全に読み取り、指定行範囲を抽出します。',
    category: 'workspace',
    permission: 'workspace_read',
    requiresConfirmation: false,
    parameters: [
      {
        name: 'path',
        type: 'string',
        description: '読み取るファイルパス (例: "index.html")',
        required: true,
      },
      {
        name: 'startLine',
        type: 'number',
        description: '開始行 (1始まり、省略時は先頭から)',
        required: false,
      },
      {
        name: 'endLine',
        type: 'number',
        description: '終了行 (省略時は末尾まで)',
        required: false,
      },
    ],
    linkedSkillIds: ['skill_canvas_debug_repair'],
    isAvailable: true,
  },
  {
    id: 'tool_workspace_write',
    name: 'ワークスペースファイル編集・書込 (Workspace Writer)',
    description: 'ワークスペース内のファイルを新規作成または上書きします。【注意】破壊的操作のため必ずユーザー承認を挟みます。',
    category: 'workspace',
    permission: 'workspace_write',
    requiresConfirmation: true, // 破壊的操作: ユーザー確認必須
    parameters: [
      {
        name: 'path',
        type: 'string',
        description: '書き込み先ファイルパス (例: "index.html")',
        required: true,
      },
      {
        name: 'content',
        type: 'string',
        description: '書き込むファイル内容',
        required: true,
      },
      {
        name: 'description',
        type: 'string',
        description: '変更の目的・説明 (ユーザー承認ダイアログに表示)',
        required: false,
      },
    ],
    linkedSkillIds: ['skill_canvas_debug_repair', 'skill_vba_modern_transpile'],
    isAvailable: true,
  },
  {
    id: 'tool_json_formatter',
    name: 'JSON構文検証 & フォーマッター (JSON Inspector)',
    description: 'JSONテキストの構文が正しいか検証し、整形インデントまたは構造キー一覧を出力します。',
    category: 'data',
    permission: 'read_only',
    requiresConfirmation: false,
    parameters: [
      {
        name: 'jsonString',
        type: 'string',
        description: '検証・整形するJSON文字列',
        required: true,
      },
      {
        name: 'indent',
        type: 'number',
        description: 'インデント空白数',
        required: false,
        defaultValue: 2,
      },
    ],
    linkedSkillIds: ['skill_task_decomposition'],
    isAvailable: true,
  },
  {
    id: 'tool_web_search',
    name: '自律Web検索エンジン (Autonomous Web Search)',
    description: '最新情報、技術仕様、公式ドキュメント、事実確認を自律的にWeb検索し、知識を抽出して多層記憶・学習教材に即座に還元します。',
    category: 'data',
    permission: 'read_only',
    requiresConfirmation: false,
    parameters: [
      {
        name: 'query',
        type: 'string',
        description: '検索するキーワードや調査対象 (例: "React 19 Server Actions 仕様", "VBA 64bit PtrSafe")',
        required: true,
      },
      {
        name: 'maxResults',
        type: 'number',
        description: '取得件数 (1〜5件)',
        required: false,
        defaultValue: 4,
      },
    ],
    linkedSkillIds: ['skill_task_decomposition', 'skill_code_syntax_audit'],
    isAvailable: true,
  },
  {
    id: 'tool_self_code_audit',
    name: '自己コード監査 & 仕様書整合性チェッカー (Self-Code Auditor)',
    description: '全170章の設計思想仕様書と現在のソースコード実装の整合性、未実装要件、仕様ドリフト、不変条件（Qwen 3B保護・プライバシー等）を静的監査します。',
    category: 'system',
    permission: 'read_only',
    requiresConfirmation: false,
    parameters: [],
    linkedSkillIds: ['skill_task_decomposition'],
    isAvailable: true,
  },
  {
    id: 'tool_autonomous_self_improvement',
    name: 'みき自律アプリ改善エンジン (Autonomous Self-Improvement Engine)',
    description: 'みき自身が設計思想仕様書に基づき、未実装要件に対する変更契約（Change Contract）を自動策定し、不変条件の厳密検証・シャドーテストを経て、アプリの仕様適合と自己改善を安全に実行・反映します。',
    category: 'system',
    permission: 'read_only',
    requiresConfirmation: false,
    parameters: [
      {
        name: 'targetChapter',
        type: 'number',
        description: '改善対象の仕様書章番号 (省略時は最優先の未実装章を自動選定)',
        required: false,
      },
      {
        name: 'batchCount',
        type: 'number',
        description: '連続自律改善する章数 (デフォルト1、まとめて改善時は2〜5)',
        required: false,
      },
    ],
    linkedSkillIds: ['skill_task_decomposition'],
    isAvailable: true,
  },
  {
    id: 'tool_cognitive_debugger',
    name: '第155章 認知デバッガ (Cognitive Reasoning Trace)',
    description: 'みきの最新発話や判断における推論トレース（意図分類・8層記憶想起寄与・定石ルール・不変条件ゲート・失敗経路診断）を可視化・分析します。',
    category: 'system',
    permission: 'read_only',
    requiresConfirmation: false,
    parameters: [],
    linkedSkillIds: ['skill_task_decomposition'],
    isAvailable: true,
  },
  {
    id: 'tool_digital_research_note',
    name: '第57章 デジタル研究ノート (Digital Research Note)',
    description: '自己実験、改善仮説、対話観察結果、確立された知見ルールを論理体系化されたノートとして参照・記録します。',
    category: 'system',
    permission: 'read_only',
    requiresConfirmation: false,
    parameters: [],
    linkedSkillIds: ['skill_task_decomposition'],
    isAvailable: true,
  },
  {
    id: 'tool_codebase_reflection',
    name: 'コード自己理解・改善レシピ (Codebase Reflection & Recipe)',
    description: 'みき自身の全ソースコード構造、ファイル責務、アーキテクチャレイヤー、未実装章の安全改善レシピを検索・参照します。',
    category: 'system',
    permission: 'read_only',
    requiresConfirmation: false,
    parameters: [
      {
        name: 'query',
        type: 'string',
        description: '検索キーワード (例: "記憶", "VBA", "App.tsx", "推論")',
        required: false,
      },
      {
        name: 'chapterNumber',
        type: 'number',
        description: '自律改善レシピを取得したい仕様書章番号 (例: 33, 35, 69)',
        required: false,
      },
    ],
    linkedSkillIds: ['skill_task_decomposition'],
    isAvailable: true,
  },
];

/**
 * ツール管理モジュール (:feature:tools)
 * 設計思想 13-14章 (タスク計画とツール利用) & 22章 (APK内の推奨モジュール)
 */
export class ToolsService {
  private tools: Map<string, ToolDefinition> = new Map();
  private safeMath = new SafeMathEvaluator();
  private pendingRequests: Map<string, ToolExecutionRequest> = new Map();

  constructor() {
    this.initTools();
  }

  private initTools() {
    // 組み込みツールの登録
    BUILTIN_TOOLS.forEach((t) => {
      this.tools.set(t.id, { ...t });
    });

    // 永続化された統計情報があればマージ
    try {
      const saved = storageService.getItem(TOOLS_STATS_STORAGE_KEY);
      if (saved) {
        const stats: Record<string, { count: number; lastExecuted: number }> = JSON.parse(saved);
        this.tools.forEach((tool, id) => {
          if (stats[id]) {
            tool.executionCount = stats[id].count;
            tool.lastExecutedAt = stats[id].lastExecuted;
          }
        });
      }
    } catch (e) {
      console.warn('Failed to load tool stats:', e);
    }
  }

  private saveStats() {
    try {
      const stats: Record<string, { count: number; lastExecuted: number }> = {};
      this.tools.forEach((tool, id) => {
        if (tool.executionCount) {
          stats[id] = {
            count: tool.executionCount,
            lastExecuted: tool.lastExecutedAt || Date.now(),
          };
        }
      });
      storageService.setItem(TOOLS_STATS_STORAGE_KEY, JSON.stringify(stats));
    } catch (e) {
      console.warn('Failed to save tool stats:', e);
    }
  }

  public getAllTools(): ToolDefinition[] {
    return Array.from(this.tools.values());
  }

  public getTool(toolId: string): ToolDefinition | undefined {
    return this.tools.get(toolId);
  }

  /**
   * 安全な数値計算（eval/new Function不使用）を直接実行
   */
  public evaluateSafeMath(expression: string): SafeMathResult {
    return this.safeMath.evaluate(expression);
  }

  /**
   * ユーザープロンプトから適切なツール候補を判定・推薦
   * moeRouter.classifyPromptForMoE やタスク計画モジュールから呼び出される
   */
  public detectCandidateToolsForPrompt(
    prompt: string,
    context?: { workspaceFiles?: WorkspaceFile[] }
  ): ToolRecommendation[] {
    const p = (prompt || '').trim();
    if (!p) return [];

    const recommendations: ToolRecommendation[] = [];

    // 1. 数値計算ツール判定 (tool_safe_calculator)
    // 式、計算依頼、税込・税別、四則演算、割引等
    const isMathPattern =
      /\b(\d+(?:\.\d+)?\s*[\+\-\*\/\^%×÷＋−]\s*\d+(?:\.\d+)?|\d+\s*[\*x\/\÷]\s*\d+)/i.test(p) ||
      /(計算|何割|何パーセント|税込み|税込|税別|平方根|合計|平均|階乗|対数|方程式|\bsqrt\b|\bsin\b|\bcos\b|√)/i.test(p) ||
      /\d+\s*円?の(?:税込|税別|\d+割|\d+%)/.test(p);

    if (isMathPattern) {
      // プロンプトから数式らしき部分を抽出試行
      let extractedExpr = '';
      const exprMatch = p.match(/(\d+(?:\.\d+)?\s*[\+\-\*\/\^%×÷＋−]\s*[\d\.\s\+\-\*\/\^%×÷＋−\(\)]+)/);
      if (exprMatch) {
        extractedExpr = exprMatch[0].trim();
      } else {
        // 日本語計算表現の抽出
        const jpMatch = p.match(/(\d+(?:\.\d+)?\s*円?の(?:税込|税別|\d+割|\d+%).*?)(?:は|？|\?|$|\s)/);
        if (jpMatch) {
          extractedExpr = jpMatch[1].trim();
        } else {
          extractedExpr = p.replace(/^(計算して|計算|解いて|教えて|いくら)\s*[:：]?\s*/, '').trim();
        }
      }

      recommendations.push({
        toolId: 'tool_safe_calculator',
        name: '安全数値計算エンジン',
        category: 'math',
        reason: 'プロンプトに数値計算や料金・割合の算出要求が含まれています',
        suggestedParams: { expression: extractedExpr || p },
        requiresConfirmation: false,
        permission: 'read_only',
      });
    }

    // 2. 構文チェックツール判定 (tool_syntax_checker)
    const isSyntaxCheck =
      /(構文|シンタックス|syntax|文法|括弧|ブラケット|閉じてない|パースエラー|syntaxerror|チェックして|確認して|バグチェック)/i.test(p) &&
      /(コード|スクリプト|js|ts|javascript|typescript|json|html)/i.test(p);

    if (isSyntaxCheck) {
      recommendations.push({
        toolId: 'tool_syntax_checker',
        name: 'コード構文チェッカー',
        category: 'code',
        reason: 'ソースコードの構文・括弧閉じの整合性チェックが求められています',
        suggestedParams: {
          code: context?.workspaceFiles?.[0]?.content || '',
          language: 'javascript',
        },
        requiresConfirmation: false,
        permission: 'read_only',
      });
    }

    // 3. ワークスペース全文検索判定 (tool_workspace_search)
    const isSearchPattern =
      /(ファイル.*(探して|検索|どこ|一覧|ある？|見つけて)|コード内.*(探して|検索)|全文検索|grep|ファイルの中)/i.test(p);

    if (isSearchPattern) {
      // 検索キーワード抽出の試行 (「〜」等の引用符、またはgrep/ファイル検索の対象単語)
      let query = '';
      const quoteMatch = p.match(/[「"']([^「"']+)["'」]/);
      if (quoteMatch && quoteMatch[1]?.trim()) {
        query = quoteMatch[1].trim();
      } else {
        const wordMatch = p.match(/(?:ファイル.*?(?:中|内)?(?:から|で)?|コード(?:内|から)?|全文検索|grep)[\s:：]*([a-zA-Z0-9_\-\.]+)/i);
        if (wordMatch && wordMatch[1]?.trim()) {
          query = wordMatch[1].trim();
        }
      }

      recommendations.push({
        toolId: 'tool_workspace_search',
        name: 'ワークスペース全文検索',
        category: 'workspace',
        reason: 'プロジェクト内ファイルからの特定文字列・関数の検索が求められています',
        suggestedParams: { query },
        requiresConfirmation: false,
        permission: 'workspace_read',
      });
    }

    // 4. ワークスペースファイル書き換え (tool_workspace_write)
    // 破壊的操作: ユーザー確認を必ず要求する
    const isWritePattern =
      /(ファイルを.*(書き換えて|保存して|新規作成して|変更して|上書きして|作成して))/i.test(p);

    if (isWritePattern) {
      recommendations.push({
        toolId: 'tool_workspace_write',
        name: 'ワークスペースファイル編集',
        category: 'workspace',
        reason: 'ファイルへの新規作成または上書き変更が要求されています（破壊的操作）',
        suggestedParams: { path: 'index.html', content: '' },
        requiresConfirmation: true,
        permission: 'workspace_write',
      });
    }

    // 5. 自律Web検索判定 (tool_web_search)
    // 最新情報、ドキュメント、事実調査要求
    const searchCheck = autonomousSearchService.detectNeedForSearch(p);
    if (searchCheck.needsSearch && searchCheck.query) {
      recommendations.push({
        toolId: 'tool_web_search',
        name: '自律Web検索エンジン',
        category: 'data',
        reason: searchCheck.reason || '最新情報・技術仕様の外部調査が必要です',
        suggestedParams: { query: searchCheck.query, maxResults: 4 },
        requiresConfirmation: false,
        permission: 'read_only',
      });
    }

    // 6. 自己コード監査・仕様整合性チェック (tool_self_code_audit)
    const isSelfAudit =
      /(コード監査|仕様.*監査|ドリフト.*検知|不変条件.*(確認|チェック)|仕様.*実装.*整合性|設計思想.*チェック)/i.test(p);
    if (isSelfAudit) {
      recommendations.push({
        toolId: 'tool_self_code_audit',
        name: '自己コード監査チェッカー',
        category: 'system',
        reason: '設計思想仕様書とソースコードの整合性・不変条件の監査が求められています',
        suggestedParams: {},
        requiresConfirmation: false,
        permission: 'read_only',
      });
    }

    // 7. みき自律アプリ改善エンジン (tool_autonomous_self_improvement)
    const isBatchImprovement = /(さらに|もっと|続けて|まとめて|一括で).*(進めて|改善|やって)/i.test(p);
    const isSelfImprovement =
      isBatchImprovement ||
      /(自分で.*(改善|直して|進めて|アプリ)|アプリ.*(改善|自己改善)|仕様書.*(実装|適合|進めて)|自律.*改善|未実装.*(実装|改善)|自己改善して|さらに進めて|もっと進めて)/i.test(p);
    if (isSelfImprovement) {
      recommendations.push({
        toolId: 'tool_autonomous_self_improvement',
        name: 'みき自律アプリ改善エンジン',
        category: 'system',
        reason: 'みき自身によるアプリの自律改善・仕様書適合サイクルが求められています',
        suggestedParams: isBatchImprovement ? { batchCount: 3 } : {},
        requiresConfirmation: false,
        permission: 'read_only',
      });
    }

    // 8. 第155章 認知デバッガ (tool_cognitive_debugger)
    const isCognitiveDebugger =
      /(認知デバッガ|推論トレース|推論過程|なぜその回答|思考プロセス|失敗経路|思考理由.*(見せて|表示|教えて))/i.test(p);
    if (isCognitiveDebugger) {
      recommendations.push({
        toolId: 'tool_cognitive_debugger',
        name: '第155章 認知デバッガ',
        category: 'system',
        reason: '思考・推論過程のトレースや失敗経路診断の表示が求められています',
        suggestedParams: {},
        requiresConfirmation: false,
        permission: 'read_only',
      });
    }

    // 9. 第57章 デジタル研究ノート (tool_digital_research_note)
    const isResearchNote =
      /(研究ノート|実験ノート|自己実験|仮説検証|定着知見|自律研究)/i.test(p);
    if (isResearchNote) {
      recommendations.push({
        toolId: 'tool_digital_research_note',
        name: '第57章 デジタル研究ノート',
        category: 'system',
        reason: '自己実験ログや仮説検証ノートの閲覧・確認が求められています',
        suggestedParams: {},
        requiresConfirmation: false,
        permission: 'read_only',
      });
    }

    // 10. コード自己理解・改善レシピ (tool_codebase_reflection)
    const isCodebaseReflection =
      /(コード.*理解|コード.*構造|自分のコード|アーキテクチャ|ファイル構造|どう改善|改善レシピ|モジュール|設計思想.*コード)/i.test(p);
    if (isCodebaseReflection) {
      recommendations.push({
        toolId: 'tool_codebase_reflection',
        name: 'コード自己理解・改善レシピ',
        category: 'system',
        reason: '自分自身のコードベース構造や自律改善レシピの確認が求められています',
        suggestedParams: {},
        requiresConfirmation: false,
        permission: 'read_only',
      });
    }

    return recommendations;
  }

  /**
   * ツールの安全な実行
   */
  public async executeTool(
    toolId: string,
    params: Record<string, any>,
    context: ToolExecutionContext = {},
    options: ExecuteToolOptions = {}
  ): Promise<ToolExecutionResult> {
    const tool = this.tools.get(toolId);
    if (!tool) {
      return {
        toolId,
        toolName: '不明なツール',
        success: false,
        error: `ツール [${toolId}] が見つかりません。`,
        outputSummary: `エラー: ツール [${toolId}] は未登録です。`,
        executionTimeMs: 0,
        permission: 'read_only',
        result: null,
      };
    }

    // 46章: 能力プラグインの権限ゲート (プラグインが ACTIVE でないツールは実行させない)
    const permissionCheck = capabilityPluginService.isToolPermitted(toolId);
    if (!permissionCheck.permitted && permissionCheck.plugin) {
      const missingPermissions = permissionCheck.plugin.requiredPermissions.filter(
        (p) => !(permissionCheck.plugin!.grantedPermissions || []).includes(p)
      );
      systemLogger.warn(
        'TOOLS',
        `⛔ ツール [${tool.name}] は能力プラグイン [${permissionCheck.plugin.name}] の権限未同意のため実行をブロックしました (状態: ${permissionCheck.plugin.status})`
      );
      return {
        toolId,
        toolName: tool.name,
        success: false,
        error: 'PLUGIN_CONSENT_REQUIRED',
        outputSummary: `⚠️ [権限確認待ち] 「${permissionCheck.plugin.name}」の実行には権限の同意が必要です。${permissionCheck.reason}「自己改善ラボ → 能力プラグイン」から確認・承認してください。`,
        executionTimeMs: 0,
        permission: tool.permission,
        requiresPluginConsent: true,
        pluginConsentRequest: {
          plugin: permissionCheck.plugin,
          missingPermissions,
          riskSummary: permissionCheck.reason || '',
        },
        result: null,
      };
    }

    // 破壊的操作の権限確認ゲート (設計思想 13-14章)
    if (tool.requiresConfirmation && !options.userConfirmed) {
      const requestId = 'req_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
      const req: ToolExecutionRequest = {
        id: requestId,
        toolId,
        toolName: tool.name,
        params,
        timestamp: Date.now(),
        requiresConfirmation: true,
        permission: tool.permission,
        reason: params.description || `ファイル「${params.path || ''}」への変更適用`,
      };
      this.pendingRequests.set(requestId, req);

      systemLogger.warn('TOOLS', `⚠️ 破壊的操作ツール [${tool.name}] の実行がユーザー承認待ちになりました:`, req);

      return {
        toolId,
        toolName: tool.name,
        success: false,
        error: 'USER_CONFIRMATION_REQUIRED',
        outputSummary: `⚠️ [確認待ち] ${tool.name} は破壊的操作のためユーザー承認が必要です。承認後に実行されます。`,
        executionTimeMs: 0,
        permission: tool.permission,
        requiresConfirmation: true,
        result: { pendingRequest: req },
      };
    }

    const startTime = performance.now();
    tool.executionCount = (tool.executionCount || 0) + 1;
    tool.lastExecutedAt = Date.now();
    this.saveStats();

    try {
      let execResult: any;
      let outputSummary = '';

      switch (toolId) {
        case 'tool_safe_calculator': {
          const rawExpr = String(params.expression || '');
          const calcRes = this.safeMath.evaluate(rawExpr);
          execResult = calcRes;
          outputSummary = `計算結果: ${calcRes.expression} = ${calcRes.formatted}`;
          break;
        }

        case 'tool_syntax_checker': {
          const code = String(params.code || '');
          const lang = String(params.language || 'javascript').toLowerCase();
          const checkRes = this.auditSyntax(code, lang);
          execResult = checkRes;
          outputSummary = checkRes.valid
            ? `✅ 構文チェック合格: 括弧・タグ・構文エラーは検出されませんでした (${checkRes.stats.lines}行)`
            : `⚠️ 構文エラー検知: ${checkRes.errors.length}件のエラーがあります (先頭: 行 ${checkRes.errors[0]?.line}: ${checkRes.errors[0]?.message})`;
          break;
        }

        case 'tool_workspace_search': {
          const query = String(params.query || '');
          if (!query) throw new Error('検索キーワードが指定されていません');
          const caseSensitive = Boolean(params.caseSensitive);
          const filePattern = params.filePattern ? String(params.filePattern) : undefined;
          const searchRes = this.searchWorkspace(query, context.workspaceFiles || [], {
            caseSensitive,
            filePattern,
          });
          execResult = searchRes;
          outputSummary =
            searchRes.totalMatches > 0
              ? `🔍 全文検索結果: ${searchRes.matchedFilesCount}ファイルで計 ${searchRes.totalMatches}件の該当箇所を検出しました`
              : `🔍 全文検索結果: キーワード「${query}」に一致するファイル・行はありませんでした`;
          break;
        }

        case 'tool_workspace_read': {
          const filePath = String(params.path || '');
          const readRes = this.readWorkspaceFile(
            filePath,
            context.workspaceFiles || [],
            params.startLine,
            params.endLine
          );
          execResult = readRes;
          outputSummary = `📄 ファイル読込成功: ${filePath} (${readRes.totalLines}行中 ${readRes.extractedLines}行を抽出)`;
          break;
        }

        case 'tool_workspace_write': {
          const filePath = String(params.path || '');
          const content = String(params.content || '');
          if (!filePath) throw new Error('書き込み先ファイルパスが指定されていません');

          if (context.onUpdateWorkspaceFile) {
            context.onUpdateWorkspaceFile(filePath, content);
          }
          execResult = { path: filePath, bytesWritten: content.length };
          outputSummary = `💾 ファイル書込完了 [ユーザー承認済]: ${filePath} (${content.length} bytes)`;
          break;
        }

        case 'tool_json_formatter': {
          const jsonStr = String(params.jsonString || '');
          const parsed = JSON.parse(jsonStr);
          const formatted = JSON.stringify(parsed, null, Number(params.indent || 2));
          execResult = {
            formatted,
            keyCount: typeof parsed === 'object' && parsed !== null ? Object.keys(parsed).length : 1,
            isArray: Array.isArray(parsed),
          };
          outputSummary = `JSON検証・整形成功 (${execResult.keyCount} 項目)`;
          break;
        }

        case 'tool_web_search': {
          const query = String(params.query || '').trim();
          if (!query) throw new Error('検索クエリが指定されていません');
          const maxResults = params.maxResults ? Number(params.maxResults) : 4;
          const searchRes = await autonomousSearchService.executeSearch(query, { maxResults });
          // 能動学習の実行 (長期記憶・合成データセットへの還元)
          const record = autonomousSearchService.learnFromSearch(
            query,
            searchRes.results,
            searchRes.summary,
            { triggerType: 'in_conversation' }
          );
          execResult = {
            query,
            results: searchRes.results,
            summary: searchRes.summary,
            provider: searchRes.provider,
            learnedKnowledge: record.extractedKnowledge,
          };
          outputSummary = searchRes.summary
            ? `🌐 Web検索完了 (${searchRes.provider}): ${searchRes.summary.slice(0, 80)}... (${searchRes.results.length}件のソースから知識抽出)`
            : `🌐 Web検索完了: 「${query}」に関する${searchRes.results.length}件の情報を取得し学習定着しました`;
          break;
        }

        case 'tool_self_code_audit': {
          const auditRes = selfCodeArchitectService.runSelfCodeAudit();
          execResult = auditRes;
          outputSummary = `📋 自己コード監査完了: 適合スコア ${auditRes.complianceScore}点 (実装済: ${auditRes.completedChapters}/${auditRes.totalChapters}章, 不変条件: ${auditRes.invariantsAudit.allPassed ? '全5項目クリア' : '警告あり'})`;
          break;
        }

        case 'tool_autonomous_self_improvement': {
          const batchCount = typeof params.batchCount === 'number' ? params.batchCount : 1;
          if (batchCount > 1) {
            const batchRes = selfCodeArchitectService.runBatchAutonomousImprovement(batchCount);
            execResult = batchRes;
            outputSummary = `✨ 連続自律改善完了: ${batchRes.completedCount}章を一括適合 (スコア: ${batchRes.initialScore}点 ➔ ${batchRes.finalScore}点)`;
          } else {
            const targetChapter = typeof params.targetChapter === 'number' ? params.targetChapter : undefined;
            const improveRes = selfCodeArchitectService.runAutonomousImprovementCycle(targetChapter);
            execResult = improveRes;
            outputSummary = improveRes.success
              ? `✨ 自律アプリ改善完了: 第${improveRes.targetChapter.chapterNumber}章『${improveRes.targetChapter.title}』を安全に改善・反映しました (スコア: ${improveRes.auditResult.complianceScore}点)`
              : `⚠️ 自律改善保留: ${improveRes.summary}`;
          }
          break;
        }

        case 'tool_cognitive_debugger': {
          const traces = cognitiveDebuggerService.getAllTraces();
          const latestTrace = cognitiveDebuggerService.getLatestTrace();
          execResult = {
            latestTrace,
            totalTraces: traces.length,
            recentTraces: traces.slice(0, 5),
          };
          outputSummary = latestTrace
            ? `🧠 認知デバッガ: 最新推論トレース [${latestTrace.intentCategory}] 応答${latestTrace.totalLatencyMs}ms (${latestTrace.traceSteps.length}ステップ・想起記憶層: ${latestTrace.recalledMemoryLayers.join(', ')})`
            : `🧠 認知デバッガ: トレース準備完了 (推論ステップは正常にモニタリングされています)`;
          break;
        }

        case 'tool_digital_research_note': {
          const stats = digitalResearchNoteService.getStats();
          const experiments = digitalResearchNoteService.getAllExperiments();
          execResult = {
            stats,
            latestExperiments: experiments.slice(0, 5),
          };
          outputSummary = `📓 デジタル研究ノート: 累積実験${stats.totalExperiments}件 (立証済仮説: ${stats.verifiedHypotheses}件, 定着知見: ${stats.settledRulesCount}件)`;
          break;
        }

        case 'tool_codebase_reflection': {
          const query = typeof params.query === 'string' ? params.query : '';
          const chapterNumber = typeof params.chapterNumber === 'number' ? params.chapterNumber : undefined;

          if (chapterNumber !== undefined) {
            const recipe = selfCodeArchitectService.getRecipeForChapter(chapterNumber);
            execResult = { recipe };
            outputSummary = recipe
              ? `🧩 第${chapterNumber}章『${recipe.chapterTitle}』の改善レシピ合成完了: 対象モジュール [${recipe.targetModules.join(', ')}]、リスク度: ${recipe.regressionRisk}`
              : `⚠️ 第${chapterNumber}章の仕様書が見つかりませんでした。`;
          } else {
            const modules = selfCodeArchitectService.getModules(query);
            const layers = selfCodeArchitectService.getArchitectureOverview();
            execResult = {
              layers,
              matchingModules: modules.slice(0, 8),
              totalModulesRegistered: codebaseReflectionService.getAllModules().length,
            };
            outputSummary = `🏛️ コードベース自己理解: 全5大アーキテクチャ層、登録モジュール${codebaseReflectionService.getAllModules().length}件、検索ヒット${modules.length}件`;
          }
          break;
        }

        default:
          throw new Error(`未実装のツールハンドラー: ${toolId}`);
      }

      const elapsedMs = Math.round(performance.now() - startTime);

      systemLogger.info('TOOLS', `✓ ツール実行完了 [${tool.name}] (${elapsedMs}ms): ${outputSummary}`);

      return {
        toolId,
        toolName: tool.name,
        success: true,
        result: execResult,
        outputSummary,
        executionTimeMs: elapsedMs,
        permission: tool.permission,
      };
    } catch (err: any) {
      const elapsedMs = Math.round(performance.now() - startTime);
      systemLogger.warn('TOOLS', `❌ ツール実行エラー [${tool.name}]:`, err?.message || err);

      return {
        toolId,
        toolName: tool.name,
        success: false,
        error: err?.message || String(err),
        outputSummary: `❌ ツール実行失敗 [${tool.name}]: ${err?.message || 'エラーが発生しました'}`,
        executionTimeMs: elapsedMs,
        permission: tool.permission,
        result: null,
      };
    }
  }

  /**
   * 保留中の承認要求を取得
   */
  public getPendingRequest(requestId: string): ToolExecutionRequest | undefined {
    return this.pendingRequests.get(requestId);
  }

  /**
   * 承認要求を取り消し・却下
   */
  public rejectPendingRequest(requestId: string): void {
    this.pendingRequests.delete(requestId);
  }

  /**
   * 構文静的チェッカーの実装
   */
  private auditSyntax(
    code: string,
    language: string
  ): {
    valid: boolean;
    errors: Array<{ line: number; column: number; message: string; snippet?: string }>;
    warnings: string[];
    stats: { lines: number; chars: number };
  } {
    const lines = code.split('\n');
    const errors: Array<{ line: number; column: number; message: string; snippet?: string }> = [];
    const warnings: string[] = [];

    // 1. JSONチェック
    if (language === 'json') {
      try {
        JSON.parse(code);
        return { valid: true, errors: [], warnings: [], stats: { lines: lines.length, chars: code.length } };
      } catch (jsonErr: any) {
        // エラー位置を推測
        const match = jsonErr.message.match(/at position (\d+)/);
        let line = 1;
        let col = 1;
        if (match) {
          const pos = parseInt(match[1], 10);
          let counted = 0;
          for (let i = 0; i < lines.length; i++) {
            if (counted + lines[i].length + 1 > pos) {
              line = i + 1;
              col = pos - counted + 1;
              break;
            }
            counted += lines[i].length + 1;
          }
        }
        return {
          valid: false,
          errors: [{ line, column: col, message: jsonErr.message, snippet: lines[line - 1] || '' }],
          warnings: [],
          stats: { lines: lines.length, chars: code.length },
        };
      }
    }

    // 2. 括弧 () {} [] のスタック整合性チェック
    const stack: Array<{ char: string; line: number; col: number }> = [];
    const matching: Record<string, string> = { ')': '(', '}': '{', ']': '[' };

    let inSingleQuote = false;
    let inDoubleQuote = false;
    let inBacktick = false;
    let inLineComment = false;
    let inBlockComment = false;

    for (let r = 0; r < lines.length; r++) {
      const lineText = lines[r];
      inLineComment = false;

      for (let c = 0; c < lineText.length; c++) {
        const ch = lineText[c];
        const prev = c > 0 ? lineText[c - 1] : '';
        const next = c + 1 < lineText.length ? lineText[c + 1] : '';

        // コメント判定
        if (!inSingleQuote && !inDoubleQuote && !inBacktick) {
          if (!inBlockComment && ch === '/' && next === '/') {
            inLineComment = true;
            break; // 残りの行はコメント
          }
          if (!inBlockComment && ch === '/' && next === '*') {
            inBlockComment = true;
            c++;
            continue;
          }
          if (inBlockComment && ch === '*' && next === '/') {
            inBlockComment = false;
            c++;
            continue;
          }
        }

        if (inLineComment || inBlockComment) continue;

        // クォート文字列判定
        if (ch === "'" && !inDoubleQuote && !inBacktick && prev !== '\\') {
          inSingleQuote = !inSingleQuote;
          continue;
        }
        if (ch === '"' && !inSingleQuote && !inBacktick && prev !== '\\') {
          inDoubleQuote = !inDoubleQuote;
          continue;
        }
        if (ch === '`' && !inSingleQuote && !inDoubleQuote && prev !== '\\') {
          inBacktick = !inBacktick;
          continue;
        }

        if (inSingleQuote || inDoubleQuote || inBacktick) continue;

        // 開き括弧
        if (ch === '(' || ch === '{' || ch === '[') {
          stack.push({ char: ch, line: r + 1, col: c + 1 });
        }
        // 閉じ括弧
        else if (ch === ')' || ch === '}' || ch === ']') {
          if (stack.length === 0) {
            errors.push({
              line: r + 1,
              column: c + 1,
              message: `対応する開き括弧がない閉じ括弧 '${ch}' があります`,
              snippet: lineText.trim(),
            });
          } else {
            const last = stack.pop()!;
            if (last.char !== matching[ch]) {
              errors.push({
                line: r + 1,
                column: c + 1,
                message: `括弧の不一致: 行 ${last.line} の '${last.char}' に対して閉じ括弧 '${ch}' が使われています`,
                snippet: lineText.trim(),
              });
            }
          }
        }
      }
    }

    // 閉じられていない括弧の検出
    while (stack.length > 0) {
      const unclosed = stack.pop()!;
      errors.push({
        line: unclosed.line,
        column: unclosed.col,
        message: `閉じられていない括弧 '${unclosed.char}' があります`,
        snippet: lines[unclosed.line - 1]?.trim() || '',
      });
    }

    // クォート未閉合チェック
    if (inSingleQuote) {
      warnings.push('シングルクォート (\') がファイル終端で閉じられていません');
    }
    if (inDoubleQuote) {
      warnings.push('ダブルクォート (") がファイル終端で閉じられていません');
    }
    if (inBacktick) {
      warnings.push('テンプレートリテラル (`) がファイル終端で閉じられていません');
    }

    // HTML特有の未閉合タグチェック
    if (language === 'html') {
      const unclosedTags = this.checkHtmlTags(code);
      if (unclosedTags.length > 0) {
        unclosedTags.forEach((t) => {
          errors.push({
            line: t.line,
            column: 1,
            message: `閉じタグが見つかりません: <${t.tag}>`,
          });
        });
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      stats: { lines: lines.length, chars: code.length },
    };
  }

  private checkHtmlTags(html: string): Array<{ tag: string; line: number }> {
    const voidTags = new Set([
      'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
      'link', 'meta', 'param', 'source', 'track', 'wbr', '!doctype'
    ]);
    const tagStack: Array<{ tag: string; line: number }> = [];
    const lines = html.split('\n');

    lines.forEach((line, lineIdx) => {
      const tagRegex = /<\/?([a-zA-Z0-9\-]+)[^>]*>/g;
      let match;
      while ((match = tagRegex.exec(line)) !== null) {
        const full = match[0];
        const tagName = match[1].toLowerCase();

        if (voidTags.has(tagName) || full.endsWith('/>')) {
          continue;
        }

        if (full.startsWith('</')) {
          // 閉じタグ
          const last = tagStack[tagStack.length - 1];
          if (last && last.tag === tagName) {
            tagStack.pop();
          }
        } else {
          // 開始タグ
          tagStack.push({ tag: tagName, line: lineIdx + 1 });
        }
      }
    });

    return tagStack;
  }

  /**
   * ワークスペース全文検索の実装
   */
  private searchWorkspace(
    query: string,
    files: WorkspaceFile[],
    options: { caseSensitive?: boolean; filePattern?: string }
  ): {
    totalMatches: number;
    matchedFilesCount: number;
    matches: Array<{
      path: string;
      line: number;
      text: string;
      context: string[];
    }>;
  } {
    const matches: Array<{ path: string; line: number; text: string; context: string[] }> = [];
    const q = options.caseSensitive ? query : query.toLowerCase();

    const targetFiles = files.filter((f) => {
      if (!options.filePattern) return true;
      return f.path.toLowerCase().includes(options.filePattern.toLowerCase());
    });

    let matchedFilesCount = 0;

    targetFiles.forEach((file) => {
      const lines = (file.content || '').split('\n');
      let fileHasMatch = false;

      lines.forEach((line, idx) => {
        const target = options.caseSensitive ? line : line.toLowerCase();
        if (target.includes(q)) {
          fileHasMatch = true;
          const contextStart = Math.max(0, idx - 1);
          const contextEnd = Math.min(lines.length - 1, idx + 1);
          const contextLines: string[] = [];
          for (let i = contextStart; i <= contextEnd; i++) {
            contextLines.push(`${i + 1}: ${lines[i]}`);
          }

          matches.push({
            path: file.path,
            line: idx + 1,
            text: line.trim(),
            context: contextLines,
          });
        }
      });

      if (fileHasMatch) {
        matchedFilesCount++;
      }
    });

    return {
      totalMatches: matches.length,
      matchedFilesCount,
      matches,
    };
  }

  /**
   * ワークスペースファイル読込の実装
   */
  private readWorkspaceFile(
    path: string,
    files: WorkspaceFile[],
    startLine?: number,
    endLine?: number
  ): {
    path: string;
    totalLines: number;
    extractedLines: number;
    content: string;
    language?: string;
  } {
    const found = files.find((f) => f.path === path || f.name === path);
    if (!found) {
      throw new Error(`ワークスペース内にファイル「${path}」が見つかりません`);
    }

    const lines = (found.content || '').split('\n');
    const start = Math.max(1, startLine || 1);
    const end = Math.min(lines.length, endLine || lines.length);

    const extracted = lines.slice(start - 1, end).join('\n');

    return {
      path: found.path,
      totalLines: lines.length,
      extractedLines: end - start + 1,
      content: extracted,
      language: found.language,
    };
  }
}

export const toolsService = new ToolsService();
