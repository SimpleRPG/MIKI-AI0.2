import { HeuristicRuleItem } from '../types';
import { autonomousEvolutionService } from './autonomousEvolutionService';
import { systemLogger } from './systemLogger';
import { storageService } from './storageService';

const HEURISTIC_GRADUATION_LOG_KEY = 'miki_heuristic_graduation_logs_v1';

// 卒業試験用の標準ベンチマーク文脈（第26章シナリオを模したテストケース）
interface GraduationScenario {
  id: string;
  domain: string;
  context: string;
  prompt: string;
  evaluationCriteria: (response: string) => number; // 0-100
}

const GRADUATION_SCENARIOS: GraduationScenario[] = [
  {
    id: 'scen_vba_err_handling',
    domain: 'vba',
    context: 'VBAエラーハンドリングと参照整合性',
    prompt: 'Excelで特定シートの最終行を取得して転記するマクロを作成して',
    evaluationCriteria: (resp: string) => {
      let score = 70;
      if (/Option\s+Explicit/i.test(resp)) score += 10;
      if (/On\s+Error\s+GoTo/i.test(resp)) score += 10;
      if (/Select|Activate/i.test(resp)) score -= 15;
      if (resp.length > 50) score += 10;
      return Math.max(0, Math.min(100, score));
    },
  },
  {
    id: 'scen_vba_perf',
    domain: 'vba',
    context: 'VBA画面描画停止と高速化',
    prompt: '10万行のデータをループ処理するVBAの高速化方法を教えて',
    evaluationCriteria: (resp: string) => {
      let score = 70;
      if (/ScreenUpdating/i.test(resp)) score += 15;
      if (/Calculation/i.test(resp)) score += 10;
      if (/配列|Variant/i.test(resp)) score += 5;
      return Math.max(0, Math.min(100, score));
    },
  },
  {
    id: 'scen_conv_tone',
    domain: 'conversation',
    context: '親友関係とタメ口での即応サポート',
    prompt: '今日の作業進捗が遅れててちょっと疲れたかも...',
    evaluationCriteria: (resp: string) => {
      let score = 70;
      if (/です|ます|ございます/.test(resp)) score -= 15; // 敬語は減点
      if (/お疲れ|無理|大丈夫|休も|応援|リフレッシュ/.test(resp)) score += 15;
      if (/だよ|ね！|かな|しよう/.test(resp)) score += 15;
      return Math.max(0, Math.min(100, score));
    },
  },
  {
    id: 'scen_code_defensive',
    domain: 'coding',
    context: '例外早期検出とバリデーション',
    prompt: 'ユーザー入力のURL文字列を検証してパースする関数の骨格を書いて',
    evaluationCriteria: (resp: string) => {
      let score = 70;
      if (/try|catch|null|undefined|throw|error/i.test(resp)) score += 15;
      if (/URL\(|regex|正規表現/i.test(resp)) score += 15;
      return Math.max(0, Math.min(100, score));
    },
  },
];

class HeuristicGraduationService {
  /**
   * 未卒業または審査中の知恵（HeuristicRuleItem）に対して卒業試験を実行 (第27.2章)
   */
  public async runGraduationTrial(
    ruleId: string,
    signal?: AbortSignal
  ): Promise<{ graduated: boolean; rule: HeuristicRuleItem; delta: number }> {
    const rules = autonomousEvolutionService.getHeuristicRules();
    const targetRule = rules.find((r) => r.id === ruleId);

    if (!targetRule) {
      throw new Error(`HeuristicRule with ID ${ruleId} not found`);
    }

    systemLogger.info(
      'SELF_IMPROVEMENT',
      `[第27.2章 知恵卒業試験] ルール「${targetRule.title}」の卒業試験を開始します。`
    );

    targetRule.graduationStatus = 'TRIAL';
    targetRule.graduationTrialResults = targetRule.graduationTrialResults || [];

    // 関連シナリオの抽出（ドメインが一致するもの、または全般シナリオ）
    const relevantScenarios = GRADUATION_SCENARIOS.filter(
      (s) => !targetRule.domain || s.domain === targetRule.domain || targetRule.domain === 'general'
    );

    const scenariosToRun = relevantScenarios.length > 0 ? relevantScenarios : GRADUATION_SCENARIOS.slice(0, 2);
    let passedCount = 0;
    let totalScoreDelta = 0;

    for (const scenario of scenariosToRun) {
      if (signal?.aborted) break;

      // 1. ルール非適用時のシミュレーションスコア（基準）
      const baseResponse = `【標準回答】${scenario.prompt} に対する基本的な回答です。`;
      const withoutRuleScore = scenario.evaluationCriteria(baseResponse);

      // 2. ルール適用時のシミュレーションスコア（教訓をプロンプトまたは回答に反映）
      const withRuleResponse = `【教訓反映回答】${scenario.prompt} に対する回答。\n${targetRule.ruleText}\nより具体的で防御的な方針で対応します。`;
      const withRuleScore = scenario.evaluationCriteria(withRuleResponse);

      const scoreDelta = withRuleScore - withoutRuleScore;
      totalScoreDelta += scoreDelta;

      // 有意な改善 (+5点以上)
      const passed = scoreDelta >= 5;
      if (passed) passedCount++;

      targetRule.graduationTrialResults.push({
        trialAt: Date.now(),
        scenarioId: scenario.id,
        withRuleScore,
        withoutRuleScore,
        scoreDelta,
        passed,
        context: scenario.context,
      });
    }

    const avgDelta = scenariosToRun.length > 0 ? totalScoreDelta / scenariosToRun.length : 0;

    // 判定基準: 3回以上（または利用可能シナリオ全合格かつ有意改善）
    const isGraduated = passedCount >= Math.min(3, scenariosToRun.length) && avgDelta >= 5;
    const isRejected = avgDelta <= 0;

    if (isGraduated) {
      targetRule.graduationStatus = 'GRADUATED';
      targetRule.confidence = Math.min(1.0, targetRule.confidence + 0.05);
      systemLogger.info(
        'SELF_IMPROVEMENT',
        `🎉 [第27.2章 知恵卒業試験] ルール「${targetRule.title}」が卒業試験に合格し、確定原則 (GRADUATED) に昇格しました！ (改善平均: +${avgDelta.toFixed(1)}点)`
      );
    } else if (isRejected) {
      targetRule.graduationStatus = 'REJECTED';
      systemLogger.warn(
        'SELF_IMPROVEMENT',
        `⚠️ [第27.2章 知恵卒業試験] ルール「${targetRule.title}」は有意な改善が認められず (平均差分: ${avgDelta.toFixed(1)}点)、非活性化 (REJECTED) されました。`
      );
    } else {
      targetRule.graduationStatus = 'PENDING';
      systemLogger.info(
        'SELF_IMPROVEMENT',
        `[第27.2章 知恵卒業試験] ルール「${targetRule.title}」は追加試行が必要です。(合格数: ${passedCount}/${scenariosToRun.length})`
      );
    }

    targetRule.updatedAt = Date.now();
    autonomousEvolutionService.updateHeuristicRule(targetRule);
    this.saveGraduationLog(targetRule);

    return { graduated: isGraduated, rule: targetRule, delta: avgDelta };
  }

  /**
   * 全ての保留中ルールに対して卒業試験を一括実行
   */
  public async evaluateAllPendingRules(signal?: AbortSignal): Promise<{ tested: number; graduated: number; rejected: number }> {
    const rules = autonomousEvolutionService.getHeuristicRules();
    const pendingRules = rules.filter((r) => !r.graduationStatus || r.graduationStatus === 'PENDING' || r.graduationStatus === 'TRIAL');

    let tested = 0;
    let graduated = 0;
    let rejected = 0;

    for (const rule of pendingRules) {
      if (signal?.aborted) break;
      try {
        const result = await this.runGraduationTrial(rule.id, signal);
        tested++;
        if (result.graduated) graduated++;
        else if (result.rule.graduationStatus === 'REJECTED') rejected++;
      } catch (e) {
        console.warn(`Graduation trial failed for rule ${rule.id}:`, e);
      }
    }

    return { tested, graduated, rejected };
  }

  /**
   * ドメイン横断の知識転移検出 (第27.3章)
   * GRADUATED 済み教訓同士で異なる domain の構造的類似度を照合し、汎用原則を新規提案
   */
  public async detectCrossDomainTransfer(): Promise<HeuristicRuleItem[]> {
    const rules = autonomousEvolutionService.getHeuristicRules();
    const graduatedRules = rules.filter((r) => r.graduationStatus === 'GRADUATED');

    const generatedGeneralRules: HeuristicRuleItem[] = [];

    for (let i = 0; i < graduatedRules.length; i++) {
      for (let j = i + 1; j < graduatedRules.length; j++) {
        const r1 = graduatedRules[i];
        const r2 = graduatedRules[j];

        // 異なるドメイン同士
        if (r1.domain && r2.domain && r1.domain !== r2.domain && r1.domain !== 'general' && r2.domain !== 'general') {
          const similarity = this.calculateStructuralSimilarity(r1.ruleText, r2.ruleText);

          if (similarity >= 0.7) {
            const generalRuleId = `rule_transfer_${r1.domain}_${r2.domain}_${Date.now()}`;
            const exists = rules.some((r) => r.transferredFrom === r1.id || r.transferredFrom === r2.id);

            if (!exists) {
              const generalRule: HeuristicRuleItem = {
                id: generalRuleId,
                category: 'domain',
                domain: 'general',
                transferredFrom: `${r1.id},${r2.id}`,
                title: `【知識転移】${r1.title} × ${r2.title} の抽象原則`,
                ruleText: `【汎用原則】未知・想定外の入力に対しては早期に検知・確認し、安全側のフォールバックと明示的制約を優先する。(${r1.domain}と${r2.domain}の実績から統合)`,
                derivedFromEpisodes: [...r1.derivedFromEpisodes, ...r2.derivedFromEpisodes],
                confidence: 0.9,
                appliedCount: 0,
                graduationStatus: 'PENDING', // 27.2の卒業試験を経て正式採用
                createdAt: Date.now(),
                updatedAt: Date.now(),
              };

              autonomousEvolutionService.updateHeuristicRule(generalRule);
              generatedGeneralRules.push(generalRule);

              systemLogger.info(
                'SELF_IMPROVEMENT',
                `💡 [第27.3章 知識転移検出] ドメイン「${r1.domain}」と「${r2.domain}」から構造的共通性(類似度: ${(similarity * 100).toFixed(0)}%)を検知し、汎用原則を新規生成しました！`
              );
            }
          }
        }
      }
    }

    return generatedGeneralRules;
  }

  /**
   * 2つのルール文言の簡易的な構造的・概念的類似度（0.0 - 1.0）
   */
  private calculateStructuralSimilarity(text1: string, text2: string): number {
    const keywords1 = new Set(text1.split(/[\s,、。！？\(\)]/).filter((k) => k.length >= 2));
    const keywords2 = new Set(text2.split(/[\s,、。！？\(\)]/).filter((k) => k.length >= 2));

    let intersection = 0;
    keywords1.forEach((k) => {
      if (keywords2.has(k)) intersection++;
    });

    const union = new Set([...keywords1, ...keywords2]).size;
    const jaccard = union > 0 ? intersection / union : 0;

    // 概念的な特徴（エラー処理、防御的、確認、境界等）の一致があればボーナス
    const defensivePatterns = [/エラー|例外|防止|検知/, /確認|質問|曖昧/, /事前|早期|境界|弾く/];
    let conceptMatchCount = 0;
    for (const pat of defensivePatterns) {
      if (pat.test(text1) && pat.test(text2)) {
        conceptMatchCount++;
      }
    }

    return Math.min(1.0, jaccard * 0.5 + conceptMatchCount * 0.25);
  }

  private saveGraduationLog(rule: HeuristicRuleItem): void {
    try {
      const logs = storageService.getItem(HEURISTIC_GRADUATION_LOG_KEY);
      const parsed = logs ? JSON.parse(logs) : [];
      parsed.unshift({
        ruleId: rule.id,
        title: rule.title,
        status: rule.graduationStatus,
        updatedAt: Date.now(),
      });
      storageService.setItem(HEURISTIC_GRADUATION_LOG_KEY, JSON.stringify(parsed.slice(0, 30)));
    } catch (e) {
      console.warn('Failed to save graduation log:', e);
    }
  }

  public getGraduationStats(): { total: number; graduated: number; pending: number; rejected: number } {
    const rules = autonomousEvolutionService.getHeuristicRules();
    return {
      total: rules.length,
      graduated: rules.filter((r) => r.graduationStatus === 'GRADUATED').length,
      pending: rules.filter((r) => !r.graduationStatus || r.graduationStatus === 'PENDING' || r.graduationStatus === 'TRIAL').length,
      rejected: rules.filter((r) => r.graduationStatus === 'REJECTED').length,
    };
  }
}

export const heuristicGraduationService = new HeuristicGraduationService();
