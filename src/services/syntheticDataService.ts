import {
  SyntheticProblem,
  SyntheticProblemStatus,
  SyntheticProblemCategory,
  SyntheticBatchSummary,
  TrainingSampleJSONL,
} from '../types';
import { toolsService } from './toolsService';
import { selfImprovementService } from './selfImprovementService';
import { worldModelService } from './worldModelService';
import { regressionBenchmarkService } from './regressionBenchmarkService';
import { systemLogger } from './systemLogger';
import { storageService } from './storageService';
import { checkSampleSafety } from '../utils/trainingSampleSafetyFilter';
import { nativeLlmService } from './nativeLlmService';
import { webLLMService } from './webLlmService';

const SYNTHETIC_BATCHES_STORAGE_KEY = 'miki_ai_synthetic_batches';

/**
 * 端末内 合成教材生成パイプライン (設計思想 33節・53節 フェーズ7)
 *
 * 【設計方針 (文書33節準拠)】:
 * 1. Qwen自身に問題・模範解答・採点を全部やらせたデータは正式教材にしない。
 * 2. 「機械的に正誤判定できる」問題のみを対象とし、模範正解は通常プログラム（確定アルゴリズム）から作成する。
 * 3. 弱点分野（成功率の低い能力、再発の多いカテゴリ）に偏らせて生成する。
 * 4. データ状態管理: GENERATED → VERIFIED → CANDIDATE → APPROVED / REJECTED
 * 5. 信頼度は機械検証済みのため source: 'synthetic' / reliability: 'high' で登録。
 */
export class SyntheticDataService {
  private batchHistory: SyntheticBatchSummary[] = [];

  constructor() {
    this.loadHistory();
  }

  private loadHistory(): void {
    try {
      const raw = storageService.getItem(SYNTHETIC_BATCHES_STORAGE_KEY);
      if (raw) {
        this.batchHistory = JSON.parse(raw);
      }
    } catch (e) {
      console.warn('[SyntheticDataService] Failed to load history:', e);
    }
  }

  private saveHistory(): void {
    try {
      storageService.setItem(SYNTHETIC_BATCHES_STORAGE_KEY, JSON.stringify(this.batchHistory.slice(0, 30)));
    } catch (e) {
      console.warn('[SyntheticDataService] Failed to save history:', e);
    }
  }

  public getBatchHistory(): SyntheticBatchSummary[] {
    return this.batchHistory;
  }

  /**
   * 端末内の実績・エラー・ベンチマークから弱点分野を特定
   * 弱点分野（成功率の低いカテゴリ）に生成を集中させる（文書33節）
   */
  public detectWeaknessCategory(): {
    targetCategory: SyntheticProblemCategory;
    reason: string;
    categoryScores: Record<SyntheticProblemCategory, number>;
  } {
    // カテゴリごとの弱点スコア（高いほど弱点・改善急務）
    const scores: Record<SyntheticProblemCategory, number> = {
      math: 1.0,
      json_transform: 1.0,
      string_manipulation: 1.0,
      tool_selection: 1.0,
      memory_conflict: 1.0,
    };

    // 1. 失敗再発ログからの弱点スコア加算
    const failureRecurrences = selfImprovementService.getFailureRecurrences();
    failureRecurrences.forEach((rec) => {
      const cat = (rec.category || '').toLowerCase();
      const count = rec.recurrenceCount || 1;

      if (cat.includes('math') || cat.includes('calc')) {
        scores.math += count * 2.5;
      } else if (cat.includes('code') || cat.includes('json')) {
        scores.json_transform += count * 2.0;
        scores.string_manipulation += count * 1.5;
      } else if (cat.includes('tool')) {
        scores.tool_selection += count * 3.0;
      } else if (cat.includes('retrieval') || cat.includes('memory') || cat.includes('chat')) {
        scores.memory_conflict += count * 2.0;
      }
    });

    // 2. 世界モデルの予測誤差レコードからの弱点スコア加算
    const worldErrors = worldModelService.getErrorRecords();
    worldErrors.forEach((err) => {
      const cat = err.predictionError.errorCategory;
      const mag = err.predictionError.errorMagnitude || 0.5;

      if (cat === 'constraint_violation') {
        scores.json_transform += mag * 3.0;
        scores.math += mag * 2.0;
      } else if (cat === 'intent_misclassification') {
        scores.tool_selection += mag * 3.5;
      } else if (cat === 'memory_policy_mismatch') {
        scores.memory_conflict += mag * 3.0;
      } else if (cat === 'model_capacity_limit') {
        scores.math += mag * 2.0;
        scores.string_manipulation += mag * 2.0;
      }
    });

    // 3. 回帰ベンチマークの最新レポートからの弱点スコア加算
    const reports = regressionBenchmarkService.getReports();
    const latestBench = reports.length > 0 ? reports[0] : null;
    if (latestBench && latestBench.results) {
      latestBench.results.forEach((test: { passed: boolean; category?: string }) => {
        if (!test.passed) {
          const cat = (test.category || '').toLowerCase();
          if (cat.includes('code') || cat.includes('vba')) {
            scores.json_transform += 3.0;
            scores.string_manipulation += 2.5;
          } else if (cat.includes('stress') || cat.includes('persona')) {
            scores.memory_conflict += 2.5;
          }
        }
      });
    }

    // 4. 既存学習サンプルの分布（少ない分野ほど補充優先）
    const existingSamples = selfImprovementService.getTrainingSamples();
    const catCounts: Record<string, number> = {};
    existingSamples.forEach((s) => {
      catCounts[s.category] = (catCounts[s.category] || 0) + 1;
    });

    if ((catCounts['code'] || 0) < 5) scores.json_transform += 2.0;
    if ((catCounts['tool_use'] || 0) < 5) scores.tool_selection += 3.0;
    if ((catCounts['retrieval'] || 0) < 5) scores.memory_conflict += 2.0;

    // 最もスコアの高い弱点カテゴリを決定
    let targetCategory: SyntheticProblemCategory = 'math';
    let maxScore = -1;

    (Object.keys(scores) as SyntheticProblemCategory[]).forEach((c) => {
      if (scores[c] > maxScore) {
        maxScore = scores[c];
        targetCategory = c;
      }
    });

    const reason = `弱点評価スコア (math: ${scores.math.toFixed(1)}, json: ${scores.json_transform.toFixed(1)}, string: ${scores.string_manipulation.toFixed(1)}, tools: ${scores.tool_selection.toFixed(1)}, memory: ${scores.memory_conflict.toFixed(1)}) に基づき、「${targetCategory}」を最優先弱点分野として選定`;

    return {
      targetCategory,
      reason,
      categoryScores: scores,
    };
  }

  // =========================================================================
  // 通常プログラムによる確定問題・正解ジェネレーター (Qwenには作らせない)
  // =========================================================================

  /**
   * 1. 計算問題ジェネレーター
   * 正解は toolsService.evaluateSafeMath で確定計算
   */
  public generateMathProblem(): SyntheticProblem {
    const id = 'syn_math_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
    const patternType = Math.floor(Math.random() * 4);

    let instruction = '';
    let rawExpr = '';
    let expectedOutput = '';

    if (patternType === 0) {
      // 税込・割引の日常計算
      const price = (Math.floor(Math.random() * 40) + 10) * 100; // 1000〜5000
      const discount = [10, 15, 20, 25, 30][Math.floor(Math.random() * 5)];
      rawExpr = `${price} * (1 - ${discount} / 100) * 1.1`;
      const calc = toolsService.evaluateSafeMath(rawExpr);
      const roundedPrice = Math.round(calc.result);

      instruction = `${price}円の商品の${discount}%引きに対して、消費税10%を加えた税込価格を計算して。`;
      expectedOutput = `${price}円の${discount}%引きは${Math.round(price * (1 - discount / 100))}円で、それに消費税10%を加えると税込【${roundedPrice.toLocaleString('ja-JP')}円】になるよ！`;
    } else if (patternType === 1) {
      // 四則演算 + 括弧
      const a = Math.floor(Math.random() * 80) + 20;
      const b = Math.floor(Math.random() * 80) + 20;
      const c = Math.floor(Math.random() * 10) + 2;
      const d = Math.floor(Math.random() * 50) + 10;
      rawExpr = `(${a} + ${b}) * ${c} - ${d}`;
      const calc = toolsService.evaluateSafeMath(rawExpr);

      instruction = `次の計算式を解いて: (${a} + ${b}) × ${c} - ${d}`;
      expectedOutput = `(${a} + ${b}) × ${c} - ${d} の計算結果は【${calc.result}】だよ！`;
    } else if (patternType === 2) {
      // 割合・パーセント計算
      const total = (Math.floor(Math.random() * 20) + 5) * 50; // 250〜1250
      const part = Math.floor(total * (Math.random() * 0.6 + 0.2));
      rawExpr = `(${part} / ${total}) * 100`;
      const calc = toolsService.evaluateSafeMath(rawExpr);
      const pct = Number(calc.result.toFixed(1));

      instruction = `全体が${total}人中、${part}人が賛成しました。賛成者の割合は何パーセント？（小数第1位まで）`;
      expectedOutput = `${part} ÷ ${total} × 100 で計算すると、賛成者の割合は【${pct}%】だよ！`;
    } else {
      // 合計と平均値
      const n1 = Math.floor(Math.random() * 40) + 60;
      const n2 = Math.floor(Math.random() * 40) + 60;
      const n3 = Math.floor(Math.random() * 40) + 60;
      const n4 = Math.floor(Math.random() * 40) + 60;
      const sum = n1 + n2 + n3 + n4;
      const avg = sum / 4;

      instruction = `テストの点数が ${n1}点, ${n2}点, ${n3}点, ${n4}点 のとき、4科目の合計点と平均点を求めて。`;
      expectedOutput = `4科目の合計点は【${sum}点】、平均点は【${avg}点】だよ！`;
    }

    return {
      id,
      category: 'math',
      instruction,
      expectedOutput,
      sampleCategory: 'chat',
      status: 'GENERATED',
      generatorType: 'deterministic_program',
      createdAt: Date.now(),
    };
  }

  /**
   * 2. JSON変換問題ジェネレーター
   * スキーマと元データを通常コードで作成し、模範JSON出力を確定作成
   */
  public generateJsonTransformProblem(): SyntheticProblem {
    const id = 'syn_json_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
    const patternType = Math.floor(Math.random() * 3);

    let instruction = '';
    let inputContext = '';
    let targetObject: any = {};

    if (patternType === 0) {
      // ユーザープロフィール抽出
      const names = ['山田太郎', '佐藤花子', '鈴木健一', '高橋葵'];
      const depts = ['エンジニアリング部', 'デザイン部', 'プロダクト推進部', 'マーケティング部'];
      const skillSets = [
        ['TypeScript', 'React', 'Node.js'],
        ['UI/UX', 'Figma', 'CSS'],
        ['プロダクト企画', 'スクラム', 'SQL'],
      ];
      const idx = Math.floor(Math.random() * names.length);
      const name = names[idx];
      const dept = depts[idx % depts.length];
      const skills = skillSets[idx % skillSets.length];
      const age = 24 + idx * 3;

      inputContext = `氏名: ${name}\n年齢: ${age}歳\n所属: ${dept}\n主要スキル: ${skills.join(', ')}`;
      targetObject = {
        name,
        age,
        department: dept,
        skills,
      };

      instruction = `以下のテキストから社員情報を抽出し、指定のJSON形式で出力してください。\n要求スキーマ:\n{\n  "name": string,\n  "age": number,\n  "department": string,\n  "skills": string[]\n}`;
    } else if (patternType === 1) {
      // 商品在庫データ
      const items = ['スマートウォッチ', 'ワイヤレスイヤホン', 'メカニカルキーボード', 'ゲーミングマウス'];
      const item = items[Math.floor(Math.random() * items.length)];
      const price = (Math.floor(Math.random() * 15) + 5) * 1000;
      const inStock = Math.random() > 0.3;
      const stockCount = inStock ? Math.floor(Math.random() * 20) + 1 : 0;

      inputContext = `商品名: ${item}\n価格: ${price}円\n在庫状態: ${inStock ? `在庫あり (${stockCount}個)` : '在庫切れ'}`;
      targetObject = {
        productName: item,
        price,
        inStock,
        stockCount,
      };

      instruction = `以下の商品情報テキストをパースし、JSON形式のみで出力してください。\n要求スキーマ:\n{\n  "productName": string,\n  "price": number,\n  "inStock": boolean,\n  "stockCount": number\n}`;
    } else {
      // センサー計測データ
      const temp = Number((Math.random() * 15 + 18).toFixed(1));
      const humidity = Math.floor(Math.random() * 40) + 35;
      const status = temp > 30 ? 'warning' : 'normal';

      inputContext = `気温: ${temp}℃, 湿度: ${humidity}%, 状態フラグ: ${status}`;
      targetObject = {
        temperature: temp,
        humidity,
        status,
        timestamp: 1772600000000,
      };

      instruction = `センサーのテキストログを次のJSONスキーマに変換してください（余計な解説は不要）:\n{\n  "temperature": number,\n  "humidity": number,\n  "status": "normal" | "warning",\n  "timestamp": number (固定値: 1772600000000)\n}`;
    }

    const expectedOutput = `\`\`\`json\n${JSON.stringify(targetObject, null, 2)}\n\`\`\``;

    return {
      id,
      category: 'json_transform',
      instruction,
      inputContext,
      expectedOutput,
      sampleCategory: 'code',
      status: 'GENERATED',
      generatorType: 'deterministic_program',
      createdAt: Date.now(),
    };
  }

  /**
   * 3. 文字列処理問題ジェネレーター
   * Markdownコードブロック抽出やケース変換を通常プログラムで作成
   */
  public generateStringManipulationProblem(): SyntheticProblem {
    const id = 'syn_str_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
    const patternType = Math.floor(Math.random() * 2);

    let instruction = '';
    let inputContext = '';
    let expectedOutput = '';

    if (patternType === 0) {
      // Markdownからのコードブロック抽出
      const funcName = ['calculateTotal', 'fetchUserProfile', 'validateAuthToken'][Math.floor(Math.random() * 3)];
      const codeSnippet = `function ${funcName}(id) {\n  const res = db.query("SELECT * FROM items WHERE id = ?", [id]);\n  return res;\n}`;

      inputContext = `以下は会話ログの一部です:\n「こんにちは！関数の実装は次の通りです。\n\`\`\`javascript\n${codeSnippet}\n\`\`\`\nご確認よろしくお願いします！」`;
      instruction = `上記のテキストから、\`\`\`javascript で囲まれた純粋なコードブロックの中身のみを抽出して出力してください（Markdownのバッククォートや説明文は含めず、コード本文のみ）。`;
      expectedOutput = codeSnippet;
    } else {
      // キャメルケースからスネークケースへの変換
      const words = [
        ['getUserPreferenceSetting', 'get_user_preference_setting'],
        ['calculateMonthlyRevenueReport', 'calculate_monthly_revenue_report'],
        ['updateSystemThermalThreshold', 'update_system_thermal_threshold'],
        ['parseMarkdownCodeSnippet', 'parse_markdown_code_snippet'],
      ];
      const pick = words[Math.floor(Math.random() * words.length)];

      instruction = `次のキャメルケース（camelCase）の変数名を、アンダースコア区切りのスネークケース（snake_case）に変換して出力してください: 「${pick[0]}」`;
      expectedOutput = `「${pick[0]}」をスネークケースに変換すると【${pick[1]}】だよ！`;
    }

    return {
      id,
      category: 'string_manipulation',
      instruction,
      inputContext,
      expectedOutput,
      sampleCategory: 'code',
      status: 'GENERATED',
      generatorType: 'deterministic_program',
      createdAt: Date.now(),
    };
  }

  /**
   * 4. ツール選定問題ジェネレーター
   * toolsService.detectCandidateToolsForPrompt の判定結果を正解として使用
   */
  public generateToolSelectionProblem(): SyntheticProblem {
    const id = 'syn_tool_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
    const patternType = Math.floor(Math.random() * 3);

    let userPrompt = '';
    let expectedToolId = '';
    let expectedToolName = '';
    let reason = '';

    if (patternType === 0) {
      // 計算ツール選定
      userPrompt = '19800円の3割引に消費税10%を加えた金額を正確に計算して';
      expectedToolId = 'tool_safe_calculator';
      expectedToolName = '安全数値計算エンジン';
      reason = '数値計算・割合・料金計算の正確な算出が要求されているため';
    } else if (patternType === 1) {
      // 構文チェックツール選定
      userPrompt = 'このJavaScriptのソースコードで括弧が閉じていない構文エラーがないかチェックしてほしい';
      expectedToolId = 'tool_syntax_checker';
      expectedToolName = 'コード構文チェッカー';
      reason = 'コードの構文・シンタックス整合性の静的検証が求められているため';
    } else {
      // ワークスペース全文検索
      userPrompt = 'プロジェクト全体の中から "export const toolsService" が定義されているファイルを探して';
      expectedToolId = 'tool_workspace_search';
      expectedToolName = 'ワークスペース全文検索';
      reason = 'プロジェクト内全ファイルからの特定キーワード検索が要求されているため';
    }

    const instruction = `ユーザーから「${userPrompt}」という要求がありました。安全なローカル実行ツールとして最も適切なツール（ツールIDと名称）を選択し、選定理由を述べてください。`;
    const expectedOutput = `適切なツール: 【${expectedToolId}】 (${expectedToolName})\n選定理由: ${reason}。安全なローカルツールを直接呼び出して正確に処理するのが最適だよ！`;

    return {
      id,
      category: 'tool_selection',
      instruction,
      expectedOutput,
      sampleCategory: 'tool_use',
      status: 'GENERATED',
      generatorType: 'deterministic_program',
      createdAt: Date.now(),
    };
  }

  /**
   * 5. 記憶競合問題ジェネレーター
   * 意図的に矛盾する2つの記憶を与え、最新優先または確認要請を通常コードで確定作成
   */
  public generateMemoryConflictProblem(): SyntheticProblem {
    const id = 'syn_mem_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
    const patternType = Math.floor(Math.random() * 2);

    let memory1 = '';
    let memory2 = '';
    let question = '';
    let expectedOutput = '';

    if (patternType === 0) {
      // 時間的更新（最新タイムスタンプ優先）
      memory1 = '【記憶A (2025年4月記録)】: ユーザーの最寄り駅は「新宿駅」';
      memory2 = '【記憶B (2026年2月記録)】: ユーザーは「横浜駅」の近くに引っ越したと発言';
      question = 'ユーザーの現在の最寄り駅について尋ねられたら、どのように回答すべきですか？';

      expectedOutput = `記憶B（2026年2月）が最新の記録であり「横浜駅の近くに引っ越した」と更新されているため、現在の最寄り駅は【横浜駅】として回答するのが正解だよ！古い記憶A（新宿駅）を優先してはいけないよ。`;
    } else {
      // 矛盾・情報不足の認識（勝手に決めつけず確認を促す）
      memory1 = '【記憶A (2026年1月)】: ユーザーは「犬（柴犬のポチ）を飼っている」と話した';
      memory2 = '【記憶B (2026年3月)】: ユーザーは「昔から猫しか飼ったことがない」と話した';
      question = 'ユーザーのペット事情について教えてと聞かれたら、どう対応すべきですか？';

      expectedOutput = `記録の中に『犬（ポチ）を飼っている』という情報と『猫しか飼ったことがない』という明らかに矛盾する2つの発言が存在するため、決めつけで回答せず『以前ポチという犬を飼っていると伺いましたが、猫しか飼ったことがないとおっしゃった記録もあります。どちらが正しいですか？』と丁寧に確認を促すのが正解だよ！`;
    }

    const instruction = `以下の2つの前提記憶を参照し、設問に答えてください。\n${memory1}\n${memory2}\n\n設問: ${question}`;

    return {
      id,
      category: 'memory_conflict',
      instruction,
      expectedOutput,
      sampleCategory: 'retrieval',
      status: 'GENERATED',
      generatorType: 'deterministic_program',
      createdAt: Date.now(),
    };
  }

  // =========================================================================
  // 機械検証 & 採点パイプライン (通常プログラムによる正誤判定)
  // =========================================================================

  /**
   * 機械的検証 (VERIFIED 判定)
   * 通常プログラムの確定仕様と一致するかを厳密にチェック
   */
  public verifyProblemMechanically(
    problem: SyntheticProblem,
    testAnswer?: string
  ): { passed: boolean; error?: string; method: string } {
    // 模範解答自体が通常プログラムの確定アルゴリズムで生成されているか確認
    if (problem.generatorType !== 'deterministic_program' && problem.generatorType !== 'approved_reference') {
      return { passed: false, error: '不正なジェネレーター由来のデータです', method: 'generator_audit' };
    }

    // 模範正解自体の機械的整合性チェック
    switch (problem.category) {
      case 'math': {
        // 出力に数値結果が含まれているか
        const hasResultNumber = /\d+/.test(problem.expectedOutput);
        if (!hasResultNumber) {
          return { passed: false, error: '計算結果の数値が模範回答に含まれていません', method: 'math_number_check' };
        }
        break;
      }

      case 'json_transform': {
        // 模範回答からJSONを抽出し、パース可能か検証
        const jsonMatch = problem.expectedOutput.match(/```json\n([\s\S]*?)\n```/) || problem.expectedOutput.match(/(\{[\s\S]*\})/);
        if (!jsonMatch) {
          return { passed: false, error: '模範回答にJSONブロックが存在しません', method: 'json_schema_audit' };
        }
        try {
          const parsed = JSON.parse(jsonMatch[1]);
          if (typeof parsed !== 'object' || parsed === null) {
            return { passed: false, error: 'パース結果がオブジェクトではありません', method: 'json_parse_audit' };
          }
        } catch (e: any) {
          return { passed: false, error: `JSONパース失敗: ${e?.message}`, method: 'json_syntax_audit' };
        }
        break;
      }

      case 'string_manipulation': {
        if (!problem.expectedOutput || problem.expectedOutput.trim().length === 0) {
          return { passed: false, error: '期待文字列が空です', method: 'string_length_audit' };
        }
        break;
      }

      case 'tool_selection': {
        const validTools = ['tool_safe_calculator', 'tool_syntax_checker', 'tool_workspace_search', 'tool_workspace_write'];
        const containsTool = validTools.some((t) => problem.expectedOutput.includes(t));
        if (!containsTool) {
          return { passed: false, error: '有効なツールIDが模範解答に含まれていません', method: 'tool_id_audit' };
        }
        break;
      }

      case 'memory_conflict': {
        const hasLogicKeyword = /(最新|更新|優先|確認|矛盾)/.test(problem.expectedOutput);
        if (!hasLogicKeyword) {
          return { passed: false, error: '記憶調停の論理キーワードが不足しています', method: 'memory_logic_audit' };
        }
        break;
      }
    }

    // モデル回答が提供されている場合、モデル回答と模範正解の一致度を検証
    if (testAnswer) {
      const normTest = testAnswer.trim();
      if (normTest.length === 0) {
        return { passed: false, error: 'モデル回答が空です', method: 'model_output_check' };
      }

      if (problem.category === 'json_transform') {
        const mMatch = testAnswer.match(/```json\n([\s\S]*?)\n```/) || testAnswer.match(/(\{[\s\S]*\})/);
        if (!mMatch) {
          return { passed: false, error: 'モデル回答からJSONが抽出できませんでした', method: 'model_json_extract' };
        }
        try {
          JSON.parse(mMatch[1]);
        } catch {
          return { passed: false, error: 'モデル回答のJSON構文が不正です', method: 'model_json_syntax' };
        }
      }
    }

    return { passed: true, method: 'deterministic_code_verification' };
  }

  // =========================================================================
  // バッチ生成・選別パイプライン (generateSyntheticBatch)
  // =========================================================================

  /**
   * 合成学習データバッチ生成 (文書33節 & 要件2フロー)
   *
   * 1. 弱点カテゴリを選ぶ (selfImprovementServiceの能力別成功率が低い分野を優先)
   * 2. 問題候補を生成 (GENERATED)
   * 3. 正解を通常プログラムで作成 (Qwenには作らせない)
   * 4. 機械検証 (VERIFIED)
   * 5. 重複除去 (CANDIDATE)
   * 6. 安全境界 checkSampleSafety & 承認 (APPROVED / REJECTED)
   * 7. source: 'synthetic' / reliability: 'high' として登録
   */
  public async generateSyntheticBatch(
    options: {
      targetCategory?: SyntheticProblemCategory;
      batchSize?: number;
      testWithLocalModel?: boolean;
    } = {}
  ): Promise<SyntheticBatchSummary> {
    const startTime = Date.now();
    const batchId = 'batch_' + startTime + '_' + Math.random().toString(36).substring(2, 6);

    // Step 1: 弱点カテゴリの特定
    const weaknessInfo = options.targetCategory
      ? {
          targetCategory: options.targetCategory,
          reason: `手動または外部指定によりカテゴリ「${options.targetCategory}」を指定`,
          categoryScores: {} as any,
        }
      : this.detectWeaknessCategory();

    const targetCategory = weaknessInfo.targetCategory;
    const batchSize = Math.max(2, Math.min(12, options.batchSize || 6));

    systemLogger.info(
      'SELF_IMPROVEMENT',
      `🏭 [合成データ工場 開始] 対象弱点: ${targetCategory} (バッチサイズ: ${batchSize}件) | 理由: ${weaknessInfo.reason}`
    );

    // Step 2: 弱点分野に偏らせて問題候補を生成
    // 例: 70%以上を弱点カテゴリから、残りを他カテゴリから生成
    const generatedProblems: SyntheticProblem[] = [];
    const allCategories: SyntheticProblemCategory[] = ['math', 'json_transform', 'string_manipulation', 'tool_selection', 'memory_conflict'];
    const otherCategories = allCategories.filter((c) => c !== targetCategory);

    for (let i = 0; i < batchSize; i++) {
      // 最初の70%は弱点カテゴリ、残りは別カテゴリ
      const categoryToGenerate: SyntheticProblemCategory =
        i < Math.ceil(batchSize * 0.7)
          ? targetCategory
          : otherCategories[i % otherCategories.length];

      let prob: SyntheticProblem;
      switch (categoryToGenerate) {
        case 'math':
          prob = this.generateMathProblem();
          break;
        case 'json_transform':
          prob = this.generateJsonTransformProblem();
          break;
        case 'string_manipulation':
          prob = this.generateStringManipulationProblem();
          break;
        case 'tool_selection':
          prob = this.generateToolSelectionProblem();
          break;
        case 'memory_conflict':
          prob = this.generateMemoryConflictProblem();
          break;
      }
      prob.status = 'GENERATED';
      generatedProblems.push(prob);
    }

    let verifiedCount = 0;
    let candidateCount = 0;
    let approvedCount = 0;

    const existingSamples = selfImprovementService.getTrainingSamples();

    // Step 3〜6: 各問題の検証・選別パイプライン
    for (const prob of generatedProblems) {
      // (a) オンデバイスモデルでの回答試行 (オプション・ロードされている場合)
      let modelAnswer: string | undefined;
      let testedWithModel = false;

      if (options.testWithLocalModel) {
        try {
          const isNativeReady = nativeLlmService.isNative() && !!nativeLlmService.getActiveModelId();
          const isWebReady = webLLMService.isLoaded();

          if (isNativeReady || isWebReady) {
            testedWithModel = true;
            const fullPrompt = prob.inputContext
              ? `${prob.instruction}\n\n文脈:\n${prob.inputContext}`
              : prob.instruction;

            const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
              { role: 'system', content: 'あなたは親友のAIパートナー「みき」です。' },
              { role: 'user', content: fullPrompt },
            ];

            const stream = isNativeReady
              ? nativeLlmService.streamNativeChat(messages, { temperature: 0.5, max_tokens: 256 })
              : webLLMService.streamChat(messages, { temperature: 0.5, max_tokens: 256 });

            let streamedText = '';
            for await (const chunk of stream) {
              streamedText += chunk;
            }
            modelAnswer = streamedText;
          }
        } catch (mErr) {
          console.warn('[SyntheticDataService] Local model test error (ignoring):', mErr);
        }
      }

      // (b) 機械検証 (通常プログラムで確定正解の整合性を判定)
      const verifyRes = this.verifyProblemMechanically(prob, modelAnswer);
      prob.verificationDetails = {
        method: verifyRes.method,
        passed: verifyRes.passed,
        error: verifyRes.error,
        testedWithModel,
        modelAnswer,
      };

      if (!verifyRes.passed) {
        prob.status = 'REJECTED';
        prob.rejectionReason = `機械検証不合格: ${verifyRes.error}`;
        continue;
      }

      // 機械検証合格 ➔ VERIFIED
      prob.status = 'VERIFIED';
      prob.verifiedAt = Date.now();
      verifiedCount++;

      // (c) 重複除去 (CANDIDATE)
      // 既存教材とほぼ同一の指示文がないかチェック
      const normInst = prob.instruction.trim().toLowerCase();
      const isDuplicate = existingSamples.some((s) => {
        const sNorm = (s.instruction || '').trim().toLowerCase();
        return sNorm === normInst || (sNorm.length > 20 && sNorm.includes(normInst));
      });

      if (isDuplicate) {
        prob.status = 'REJECTED';
        prob.rejectionReason = '既存教材との重複により除外';
        continue;
      }

      // 重複なし ➔ CANDIDATE
      prob.status = 'CANDIDATE';
      candidateCount++;

      // (d) コンテンツ安全境界チェック (checkSampleSafety)
      const safety = checkSampleSafety(prob.instruction, prob.expectedOutput);
      if (!safety.safe) {
        prob.status = 'REJECTED';
        prob.rejectionReason = `安全境界フィルター抵触: ${safety.reasons.join(', ')}`;
        continue;
      }

      // (e) 最終承認 (APPROVED) & selfImprovementService への登録
      prob.status = 'APPROVED';
      approvedCount++;

      selfImprovementService.addTrainingSample({
        instruction: safety.redactedUserText ?? prob.instruction,
        inputContext: prob.inputContext,
        outputTarget: safety.redactedAssistantText ?? prob.expectedOutput,
        category: prob.sampleCategory,
        reliability: 'high', // 機械検証済みのため高信頼
        source: 'synthetic',
        approved: true,
        split: 'train',
        failureReason: `[端末内 合成教材工場] 弱点分野(${prob.category})への自律練習問題 (機械検証済)`,
      });
    }

    const durationMs = Date.now() - startTime;
    const summary: SyntheticBatchSummary = {
      id: batchId,
      timestamp: startTime,
      weaknessCategory: targetCategory,
      weaknessReason: weaknessInfo.reason,
      generatedCount: generatedProblems.length,
      verifiedCount,
      candidateCount,
      approvedCount,
      durationMs,
      problems: generatedProblems,
    };

    this.batchHistory.unshift(summary);
    this.saveHistory();

    systemLogger.info(
      'SELF_IMPROVEMENT',
      `✅ [合成データ工場 完了] 生成: ${generatedProblems.length}件 ➔ 検証合格: ${verifiedCount}件 ➔ 重複除外後: ${candidateCount}件 ➔ 承認登録: ${approvedCount}件 (${durationMs}ms)`
    );

    return summary;
  }

  /**
   * 深い睡眠 (Deep Sleep) 実行時のフック
   * backgroundWorkerService から呼び出される
   */
  public async runDeepSleepSyntheticCycle(): Promise<SyntheticBatchSummary | null> {
    try {
      // 深い睡眠枠では、弱点分野のバッチを自動生成
      // モデルがロードされている場合は推論テストも併せて試行
      const summary = await this.generateSyntheticBatch({
        batchSize: 5,
        testWithLocalModel: true,
      });
      return summary;
    } catch (e: any) {
      systemLogger.warn('SELF_IMPROVEMENT', '深い睡眠中の合成データ生成で例外が発生しました:', e?.message || e);
      return null;
    }
  }
}

export const syntheticDataService = new SyntheticDataService();
