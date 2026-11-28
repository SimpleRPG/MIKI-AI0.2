/**
 * 設計思想 第28章 28.3: コード骨格の実績テンプレート化 (Proven Code Skeleton Templating)
 * 
 * 【目的】
 * 過去に高評価・テスト成功したコード構造をパラメータ化テンプレートとして蓄積・再利用し、
 * 生成速度を極小化しつつ品質と安定性を飛躍的に高める。
 * テンプレート適用時も第16章静的検査・第51章失敗シグネチャスキャンを必ず通過させる。
 */

import { CodeSkeletonTemplate } from '../../../types';
import { storageService } from '../../../services/storageService';
import {
  isStorageAuthoritativeNow,
  runWhenStorageAuthoritative,
} from '../../../services/deferredStoreLoad';
import { systemLogger } from '../../../services/systemLogger';
import { vbaStaticVerifierService } from '../../verification/services/vbaStaticVerifierService';
import { failureCatalogService } from '../../memory/services/failureCatalogService';

const SKELETON_TEMPLATES_KEY = 'miki_code_skeleton_templates_v1';
// P3021: テンプレートの存在マーカー。本体の保存が成功するたびに
// 件数と ID 一覧だけを小さな別キーへ書く。読み込み時に本体が空で
// 読めても、マーカーが残っていれば「新規」ではなく「読めなかった」
// 側と切り分けられる（P3020 の主張 high-water と同じ役割）。
const SKELETON_MARKER_KEY = 'miki_code_skeleton_templates_marker_v1';

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
  // P3021: 読み込み時に「ストアは存在したが読めなかった」と判定
  // したセッションでは true。この間の全体保存は本物のテンプレー
  // ト（登録済み骨格・累積した成功回数）を部分像で上書きする危険
  // があるため拒否する（メモリ像は保持）。
  private storeUnreadable = false;
  // P3022: 権威ある初回読み込みが済むまでは true。この間は全体
  // 保存を行わない。
  private loadPending = false;

  constructor() {
    if (isStorageAuthoritativeNow()) {
      this.loadTemplates();
    } else {
      // P3022: ストレージ初期化より先に構築された。P3021 のマー
      // カーガードはマーカー自体が未ハイドレーションの起動では
      // 盲目になるため、読み込み自体を権威ある状態まで遅らせる。
      // 保留中は P3021 の保護状態と同じく、コード定数のシードを
      // メモリにだけ置いて最低限の機能を保つ。
      this.templates = [...INITIAL_SKELETONS];
      this.loadPending = true;
      runWhenStorageAuthoritative(() => {
        this.loadPending = false;
        this.reloadAuthoritative();
      });
    }
  }

  /**
   * P3022: 権威ある状態になってから実テンプレートを読み直す。保
   * 留中に実行時登録されたテンプレート（コード定数でないもの）は
   * 退避し、読み込めた側に無いものだけ合体させる。定数シードへの
   * 成功回数の加算は保留中の分は失われる（定数は読み込めた側の
   * 累積値を正とする）。
   */
  private reloadAuthoritative(): void {
    const initialIds = new Set(INITIAL_SKELETONS.map((t) => t.id));
    const provisional = this.templates.filter((t) => !initialIds.has(t.id));
    this.loadTemplates();
    let mergedProvisional = false;
    for (const t of provisional) {
      if (!this.templates.some((x) => x.id === t.id)) {
        this.templates.unshift(t);
        mergedProvisional = true;
      }
    }
    if (mergedProvisional && !this.storeUnreadable) {
      this.saveTemplates();
      systemLogger.info(
        'SELF_IMPROVEMENT',
        '🔐 [P3022 骨格テンプレート] 保留中に登録されたテンプレートを、権威ある読み込みへ合体しました'
      );
    }
  }

  // P3021: 存在マーカーの件数を読む。読めない・壊れている場合
  // は「存在の証拠なし」として 0 を返す（新規側に倒す）。
  private readSkeletonMarkerCount(): number {
    try {
      const raw = storageService.getItem(SKELETON_MARKER_KEY);
      if (!raw) return 0;
      const parsed = JSON.parse(raw) as { count?: unknown };
      return typeof parsed.count === 'number' && parsed.count > 0 ? parsed.count : 0;
    } catch {
      return 0;
    }
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
      // P3021: 空読みの切り分け。存在マーカーに件数が残っている
      // ということは、このインストールにはテンプレートのストア
      // が存在したはず。それなのに本体が空で読めたのは「新規イ
      // ンストール」ではなく「未ハイドレーション等で読めなかっ
      // た」側である。ここでシード＋全体保存を走らせると、実行
      // 時に登録された骨格や累積カウントをシード2件で上書きし
      // てしまう（P3020 で主張に 3 回発火した喪失と同型）。
      // シードはコード定数なのでメモリ上にだけ置いて最低限の
      // 機能は保ち、保存はこのセッション中は拒否する。
      const markerCount = this.readSkeletonMarkerCount();
      if (markerCount > 0) {
        this.storeUnreadable = true;
        this.templates = [...INITIAL_SKELETONS];
        systemLogger.warn(
          'SELF_IMPROVEMENT',
          `🔐 [P3021 骨格テンプレート保護] テンプレート本体が空で読み込まれましたが、存在マーカーには ${markerCount} 件の記録があります。既存ストアが未ハイドレーション等で読めなかった可能性が高いため、シードの保存を見送り、このセッションの全体保存を拒否します`
        );
        return;
      }
      this.templates = [...INITIAL_SKELETONS];
      this.saveTemplates();
    } catch {
      this.templates = [...INITIAL_SKELETONS];
    }
  }

  private saveTemplates() {
    // P3022: 権威ある読み込みが済むまでの保存は、provisional な
    // 部分像で実ストアを上書きするため拒否する。
    if (this.loadPending) return;
    // P3021: 「読めなかった」セッションでは全体保存を拒否する。
    if (this.storeUnreadable) return;
    try {
      // P3021: P3011/P3020 と同型の書込拒否ガード。永続側に既存
      // 値があるのに配列として読めない場合、その値をメモリ像で
      // 上書きしない（読み込み時の catch 経路でメモリシードだけ
      // が載った場合の後続保存もここで止まる）。
      const persistedRaw = storageService.getItem(SKELETON_TEMPLATES_KEY);
      if (persistedRaw) {
        let persistedIsArray = false;
        try {
          persistedIsArray = Array.isArray(JSON.parse(persistedRaw));
        } catch {
          persistedIsArray = false;
        }
        if (!persistedIsArray) {
          systemLogger.warn(
            'SELF_IMPROVEMENT',
            '🔐 [P3021 骨格テンプレート保護] 永続側のテンプレートデータが配列として読めないため、上書き保存を見送りました（メモリ上のテンプレートは保持されます）'
          );
          return;
        }
      }
      storageService.setItem(SKELETON_TEMPLATES_KEY, JSON.stringify(this.templates));
      // P3021: 本体の保存が成功したら存在マーカーも更新する。
      try {
        storageService.setItem(
          SKELETON_MARKER_KEY,
          JSON.stringify({
            count: this.templates.length,
            ids: this.templates.map((t) => t.id),
            updatedAt: Date.now(),
          })
        );
      } catch {
        // マーカーの失敗は本体保存の成否に影響させない
      }
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
