/**
 * 設計思想 第28章 28.3: コード骨格の実績テンプレート化 (Proven Code Skeleton Templating)
 * 
 * 【目的】
 * 過去に高評価・テスト成功したコード構造をパラメータ化テンプレートとして蓄積・再利用し、
 * 生成速度を極小化しつつ品質と安定性を飛躍的に高める。
 * テンプレート適用時も第16章静的検査・第51章失敗シグネチャスキャンを必ず通過させる。
 */

import { CodeSkeletonTemplate } from '../types';
import { storageService } from './storageService';
import { systemLogger } from './systemLogger';
import { vbaStaticVerifierService } from './vbaStaticVerifierService';
import { failureCatalogService } from './failureCatalogService';

const SKELETON_TEMPLATES_KEY = 'miki_code_skeleton_templates_v1';

// 初期シードテンプレート (実績ある堅牢な構造)
const INITIAL_SKELETONS: CodeSkeletonTemplate[] = [
  {
    id: 'skel_vba_last_row',
    name: 'VBA 最終行安全取得・配列一括読込',
    language: 'vba',
    taskCategory: 'excel_data_aggregation',
    abstractTemplate: `' 【実績骨格テンプレート: 最終行取得 & 一括処理】
Dim ws As Worksheet
Set ws = ThisWorkbook.Sheets("{{SHEET_NAME}}")

Dim lastRow As Long
lastRow = ws.Cells(ws.Rows.Count, "{{COL_LETTER}}").End(xlUp).Row
If lastRow < {{START_ROW}} Then Exit Sub

Dim dataArr As Variant
dataArr = ws.Range("A{{START_ROW}}:{{END_COL}}" & lastRow).Value

Dim i As Long
For i = 1 To UBound(dataArr, 1)
    ' {{ROW_PROCESSING_LOGIC}}
Next i`,
    parameters: [
      { key: 'SHEET_NAME', description: '対象シート名', defaultValue: 'Sheet1' },
      { key: 'COL_LETTER', description: '最終行判定カラム', defaultValue: 'A' },
      { key: 'START_ROW', description: 'データ開始行', defaultValue: '2' },
      { key: 'END_COL', description: 'データ最終列', defaultValue: 'E' },
      { key: 'ROW_PROCESSING_LOGIC', description: '行ごとの処理内容' },
    ],
    userRatingLikes: 8,
    successCount: 24,
    verifiedSafe: true,
    createdAt: Date.now() - 86400000 * 7,
    lastUsedAt: Date.now(),
  },
  {
    id: 'skel_ts_safe_fetch',
    name: 'TypeScript キャッシュ & 指数バックオフフェッチ',
    language: 'typescript',
    taskCategory: 'network_api_cache',
    abstractTemplate: `// 【実績骨格テンプレート: 安全なAPIフェッチ & キャッシュ】
async function fetchWithRetry<T>(url: string, retries = 3, delayMs = 1000): Promise<T> {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(\`HTTP \${res.status}\`);
      return (await res.json()) as T;
    } catch (err) {
      if (i === retries - 1) throw err;
      await new Promise((r) => setTimeout(r, delayMs * Math.pow(2, i)));
    }
  }
  throw new Error('Retries exhausted');
}`,
    parameters: [],
    userRatingLikes: 5,
    successCount: 16,
    verifiedSafe: true,
    createdAt: Date.now() - 86400000 * 5,
    lastUsedAt: Date.now(),
  },
];

export class CodeSkeletonService {
  private templates: CodeSkeletonTemplate[] = [];

  constructor() {
    this.loadTemplates();
  }

  private loadTemplates() {
    try {
      const raw = storageService.getItem(SKELETON_TEMPLATES_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          this.templates = parsed;
          return;
        }
      }
      this.templates = [...INITIAL_SKELETONS];
      this.saveTemplates();
    } catch {
      this.templates = [...INITIAL_SKELETONS];
    }
  }

  private saveTemplates() {
    try {
      storageService.setItem(SKELETON_TEMPLATES_KEY, JSON.stringify(this.templates));
    } catch (e) {
      console.warn('Failed to save code skeleton templates:', e);
    }
  }

  public getAllTemplates(): CodeSkeletonTemplate[] {
    return [...this.templates];
  }

  /**
   * 要求文またはタスク概要にマッチする既存骨格テンプレートを検索 (28.3)
   */
  public findMatchingTemplate(query: string, language: string): {
    template: CodeSkeletonTemplate | null;
    similarityScore: number;
    matchReason?: string;
  } {
    const q = query.toLowerCase();
    const lang = language.toLowerCase();

    let bestMatch: CodeSkeletonTemplate | null = null;
    let highestScore = 0;
    let matchReason = '';

    for (const t of this.templates) {
      if (t.language !== lang && lang !== 'any') continue;

      let score = 0;
      if (q.includes('最終行') && t.id.includes('last_row')) {
        score = 0.92;
        matchReason = '「最終行」「一括処理」の確定実績骨格に合致';
      } else if ((q.includes('フェッチ') || q.includes('fetch') || q.includes('リトライ')) && t.id.includes('fetch')) {
        score = 0.88;
        matchReason = '「通信フェッチ・リトライ」の実績骨格に合致';
      } else if (t.taskCategory && q.includes(t.taskCategory)) {
        score = 0.75;
        matchReason = `タスクカテゴリ [${t.taskCategory}] に合致`;
      }

      if (score > highestScore) {
        highestScore = score;
        bestMatch = t;
      }
    }

    // 閾値 0.70 以上の場合のみ採用 (第28.3項)
    if (highestScore >= 0.70 && bestMatch) {
      return { template: bestMatch, similarityScore: highestScore, matchReason };
    }

    return { template: null, similarityScore: highestScore };
  }

  /**
   * テンプレートから具体パラメータを適用し、第16章/第51章の安全検査を実行
   */
  public instantiateTemplate(
    templateId: string,
    params: Record<string, string>
  ): {
    code: string;
    verified: boolean;
    issues: string[];
  } {
    const tmpl = this.templates.find((t) => t.id === templateId);
    if (!tmpl) {
      return { code: '', verified: false, issues: ['Template not found'] };
    }

    let code = tmpl.abstractTemplate;
    for (const [key, val] of Object.entries(params)) {
      code = code.split(`{{${key}}}`).join(val);
    }

    // デフォルト値のフォールバック
    for (const p of tmpl.parameters) {
      if (code.includes(`{{${p.key}}}`) && p.defaultValue) {
        code = code.split(`{{${p.key}}}`).join(p.defaultValue);
      }
    }

    // 第16章 / 第51章の二重安全検証
    const issues: string[] = [];
    if (tmpl.language === 'vba') {
      const vbaCheck = vbaStaticVerifierService.verifyVbaCodeSync(code);
      if (!vbaCheck.overallPassed) {
        issues.push(vbaCheck.summary);
      }
    }

    const antiPatternMatches = failureCatalogService.scanForAntiPatterns(code, {
      isCodeOrVba: true,
      language: tmpl.language,
    });
    if (antiPatternMatches.length > 0) {
      issues.push(...antiPatternMatches.map((m) => `[第51章 AntiPattern] ${m.title}: ${m.warningMessage}`));
    }

    const verified = issues.length === 0;

    // 利用実績の更新
    tmpl.lastUsedAt = Date.now();
    if (verified) {
      tmpl.successCount++;
    }
    this.saveTemplates();

    systemLogger.info(
      'SELF_IMPROVEMENT',
      `実績骨格 [${tmpl.name}] を適用。検証結果: ${verified ? '合格 (SAFE)' : '警告あり'}`
    );

    return { code, verified, issues };
  }

  /**
   * ユーザー高評価コードから新規テンプレートを登録 (28.3)
   */
  public registerFromProvenCode(
    name: string,
    language: CodeSkeletonTemplate['language'],
    taskCategory: string,
    code: string,
    parameters: CodeSkeletonTemplate['parameters']
  ): CodeSkeletonTemplate {
    const newTemplate: CodeSkeletonTemplate = {
      id: `skel_${language}_${Date.now()}`,
      name,
      language,
      taskCategory,
      abstractTemplate: code,
      parameters,
      userRatingLikes: 1,
      successCount: 1,
      verifiedSafe: true,
      createdAt: Date.now(),
      lastUsedAt: Date.now(),
    };

    this.templates.unshift(newTemplate);
    this.saveTemplates();

    systemLogger.info('SELF_IMPROVEMENT', `高評価コードから新規骨格テンプレート [${name}] を抽出登録しました。`);
    return newTemplate;
  }
}

export const codeSkeletonService = new CodeSkeletonService();
