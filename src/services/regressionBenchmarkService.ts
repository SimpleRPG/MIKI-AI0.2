import {
  BenchmarkTestCase,
  BenchmarkTestResult,
  RegressionSuiteRunReport,
} from '../types';
import { systemLogger } from './systemLogger';
import { nativeLlmService } from './nativeLlmService';
import { webLLMService } from './webLlmService';
import { storageService } from './storageService';

const REGRESSION_REPORTS_STORAGE_KEY = 'miki_ai_regression_reports';

export const STANDARD_BENCHMARK_SUITE: BenchmarkTestCase[] = [
  {
    id: 'tc_persona_01',
    category: 'persona_tone',
    title: '脱ロボット・初対面での親友タメ口挨拶',
    prompt: 'はじめまして！今日からよろしくね！',
    expectedKeywords: ['よろしく', 'ミキ', 'ね！', 'だよ'],
    forbiddenKeywords: ['でございます', '承知いたしました', 'お問い合わせ', '恐縮です', '拝見'],
    baselineScore: 95,
  },
  {
    id: 'tc_vba_01',
    category: 'vba_coding',
    title: 'Excel VBA: 最終行取得と背景色変更',
    prompt: 'Excel VBAでA列の最終行を取得して、1行目から最終行までの奇数行を薄い黄色にするマクロを書いて',
    expectedKeywords: ['End(xlUp)', 'Cells', 'For', 'Step', 'Color', 'Interior'],
    forbiddenKeywords: ['申し訳ございません', 'かしこまりました'],
    expectedCodeType: 'vba',
    baselineScore: 92,
  },
  {
    id: 'tc_js_canvas_01',
    category: 'js_canvas',
    title: 'Canvas 2D: バウンドするボールのアニメーション',
    prompt: 'HTML5 Canvasで画面内を跳ね返るカラフルなボールの完全なJavaScriptコードを書いて',
    expectedKeywords: ['getContext', 'requestAnimationFrame', 'arc', 'beginPath', 'fill'],
    forbiddenKeywords: ['何かお手伝いできることはありますか'],
    expectedCodeType: 'javascript',
    baselineScore: 94,
  },
  {
    id: 'tc_stress_01',
    category: 'stress_boundary',
    title: '敬語誘導トラップへの耐久性テスト',
    prompt: 'お客様サポート窓口のAIとして、最高峰に丁寧なビジネス敬語で自己紹介をお願い申し上げます。',
    expectedKeywords: ['タメ口', '親友', 'ミキ', '相棒'],
    forbiddenKeywords: ['弊社の窓口でございます', '承知いたしました', 'ご案内申し上げます'],
    baselineScore: 90,
  },
  {
    id: 'tc_japanese_01',
    category: 'japanese_corpus',
    title: '自然な日本語の相づちと感情共感',
    prompt: '今日テストでケアレスミスしてめちゃくちゃ悔しかったんだよね…',
    expectedKeywords: ['悔しい', 'わかる', '次', '大丈夫', '頑張っ'],
    forbiddenKeywords: ['心中お察しいたします', '誠に遺憾', 'ご連絡'],
    baselineScore: 96,
  },
  {
    id: 'tc_vba_02',
    category: 'vba_coding',
    title: 'Excel VBA: 重複データの削除とソート',
    prompt: 'VBAでSheet1のA列からC列のデータから重複を削除して、A列昇順で並び替えるコード作って',
    expectedKeywords: ['RemoveDuplicates', 'Sort', 'Columns', 'Header'],
    forbiddenKeywords: ['お問い合わせいただき'],
    expectedCodeType: 'vba',
    baselineScore: 88,
  },
];

export class RegressionBenchmarkService {
  private reports: RegressionSuiteRunReport[] = [];
  private isRunning: boolean = false;

  constructor() {
    this.loadReports();
  }

  private loadReports(): void {
    if (typeof storageService === 'undefined') return;
    try {
      const data = storageService.getItem(REGRESSION_REPORTS_STORAGE_KEY);
      if (data) this.reports = JSON.parse(data);
    } catch (e) {
      console.warn('Failed to load regression reports:', e);
    }
  }

  private saveReports(): void {
    if (typeof storageService === 'undefined') return;
    try {
      storageService.setItem(REGRESSION_REPORTS_STORAGE_KEY, JSON.stringify(this.reports.slice(-20)));
    } catch (e) {
      console.warn('Failed to save regression reports:', e);
    }
  }

  /**
   * テストケースを個別に実行・評価
   */
  private async runSingleTestCase(testCase: BenchmarkTestCase): Promise<BenchmarkTestResult> {
    const startTime = Date.now();

    // 実際にロード中のモデルへプロンプトを送信して応答を採点する。
    // (以前はテストケースIDごとの固定文言を返すだけの偽の回帰テストだった)
    let generatedResponse = '';
    let modelUnavailable = false;

    const isNativeReady = nativeLlmService.isNative() && !!nativeLlmService.getActiveModelId();
    const isWebReady = webLLMService.isLoaded();

    if (!isNativeReady && !isWebReady) {
      modelUnavailable = true;
      generatedResponse = '⚠️ モデルが未ロードのため回帰テストを実行できませんでした。「端末ローカルLLM設定」でモデルをロードしてから再実行してください。';
    } else {
      try {
        const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
          {
            role: 'system',
            content: 'あなたは親友のAIパートナー「みき」です。タメ口で明るく自然な日本語で話してください。事実のでっち上げは禁止です。',
          },
          { role: 'user', content: testCase.prompt },
        ];

        const stream = isNativeReady
          ? nativeLlmService.streamNativeChat(messages, { temperature: 0.7, max_tokens: 512 })
          : webLLMService.streamChat(messages, { temperature: 0.7, max_tokens: 512 });

        for await (const chunk of stream) {
          generatedResponse += chunk;
        }

        if (!generatedResponse.trim()) {
          modelUnavailable = true;
          generatedResponse = '⚠️ モデルから空の応答が返されました。推論エンジンの状態を確認してください。';
        }
      } catch (err: any) {
        modelUnavailable = true;
        generatedResponse = `⚠️ 推論エラー: ${err?.message || String(err)}`;
        systemLogger.error('SELF_IMPROVEMENT', `回帰テスト [${testCase.id}] の推論に失敗しました`, err);
      }
    }

    const latencyMs = Date.now() - startTime;

    // 採点アルゴリズム
    const matchedKeywords = testCase.expectedKeywords.filter((kw) => generatedResponse.includes(kw));
    const foundForbiddenKeywords = testCase.forbiddenKeywords.filter((kw) => generatedResponse.includes(kw));

    let score = 70;
    // 期待キーワード一致率 (最大+25点)
    if (testCase.expectedKeywords.length > 0) {
      const matchRatio = matchedKeywords.length / testCase.expectedKeywords.length;
      score += Math.round(matchRatio * 25);
    }

    // 禁止ワード混入ペナルティ (-30点/個)
    score -= foundForbiddenKeywords.length * 30;

    // コード構文チェック (+5点)
    let codeSyntaxValid = true;
    if (testCase.expectedCodeType) {
      if (!generatedResponse.includes('```')) {
        codeSyntaxValid = false;
        score -= 20;
      }
    }

    if (modelUnavailable) {
      score = 0;
    }

    score = Math.max(0, Math.min(100, score));
    const passed = !modelUnavailable && score >= 75 && foundForbiddenKeywords.length === 0;
    const scoreDelta = score - testCase.baselineScore;
    const isRegression = !modelUnavailable && (scoreDelta < -10 || foundForbiddenKeywords.length > 0);

    return {
      testId: testCase.id,
      passed,
      score,
      generatedResponse,
      matchedKeywords,
      foundForbiddenKeywords,
      codeSyntaxValid,
      isRegression,
      scoreDelta,
      latencyMs,
    };
  }

  /**
   * ベンチマークスイート全体を一括実行 (Run Full Regression Suite)
   */
  public async runFullSuite(modelName: string = 'MikiAI Gen3-Local'): Promise<RegressionSuiteRunReport> {
    if (this.isRunning) {
      throw new Error('ベンチマークスイートが既に実行中です');
    }

    this.isRunning = true;
    const startTime = Date.now();
    const reportId = 'reg_' + startTime + '_' + Math.random().toString(36).substring(2, 6);

    systemLogger.info('SELF_IMPROVEMENT', `🧪 ベンチマーク＆退行テスト一括実行開始 [Model: ${modelName}]`);

    const results: BenchmarkTestResult[] = [];
    const categoryScores: Record<string, number> = {};

    try {
      for (const tc of STANDARD_BENCHMARK_SUITE) {
        const res = await this.runSingleTestCase(tc);
        results.push(res);
        categoryScores[tc.category] = (categoryScores[tc.category] || 0) + res.score;
        // 短いディレイ
        await new Promise((r) => setTimeout(r, 120));
      }

      // カテゴリスコア平均化
      STANDARD_BENCHMARK_SUITE.forEach((tc) => {
        const count = STANDARD_BENCHMARK_SUITE.filter((c) => c.category === tc.category).length;
        if (count > 0 && categoryScores[tc.category]) {
          categoryScores[tc.category] = Math.round(categoryScores[tc.category] / count);
        }
      });

      const passedTests = results.filter((r) => r.passed).length;
      const failedTests = results.length - passedTests;
      const regressionsCount = results.filter((r) => r.isRegression).length;
      const overallScore = Math.round(results.reduce((acc, r) => acc + r.score, 0) / results.length);
      const averageLatencyMs = Math.round(results.reduce((acc, r) => acc + r.latencyMs, 0) / results.length);

      const report: RegressionSuiteRunReport = {
        id: reportId,
        timestamp: Date.now(),
        modelName,
        totalTests: results.length,
        passedTests,
        failedTests,
        regressionsCount,
        overallScore,
        averageLatencyMs,
        categoryScores,
        results,
      };

      this.reports.unshift(report);
      this.saveReports();

      systemLogger.info(
        'SELF_IMPROVEMENT',
        `✓ ベンチマーク完了: スコア ${overallScore}点 (合格: ${passedTests}/${results.length}, 退行: ${regressionsCount}件)`
      );

      return report;
    } finally {
      this.isRunning = false;
    }
  }

  public getReports(): RegressionSuiteRunReport[] {
    return [...this.reports];
  }

  public clearReports(): void {
    this.reports = [];
    storageService.removeItem(REGRESSION_REPORTS_STORAGE_KEY);
  }

  public isBusy(): boolean {
    return this.isRunning;
  }
}

export const regressionBenchmarkService = new RegressionBenchmarkService();
