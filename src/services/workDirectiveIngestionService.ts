import { storageService } from './storageService';
import { systemLogger } from './systemLogger';
import {
  StructuredDirective,
  RequirementContract,
  ChangeSetID,
} from '../types/evidenceSelfImprovementTypes';

/**
 * 作業指示テキスト取り込みサービス (Work Directive Ingestion Service)
 * 作業指示・方針テキストをアプリ内で取り込み、
 * 目的/対象/要求内容/禁止事項/完了条件に構造化し、
 * selfImprovementControllerService のターゲット選定へ既存Audit由来の候補と同列・最優先で渡します。
 */
export class WorkDirectiveIngestionService {
  private static instance: WorkDirectiveIngestionService;
  private readonly storageKey = 'miki_work_directives_v1';
  private directives: StructuredDirective[] = [];

  private constructor() {
    this.loadDirectives();
  }

  public static getInstance(): WorkDirectiveIngestionService {
    if (!WorkDirectiveIngestionService.instance) {
      WorkDirectiveIngestionService.instance = new WorkDirectiveIngestionService();
    }
    return WorkDirectiveIngestionService.instance;
  }

  private loadDirectives(): void {
    try {
      const raw = storageService.getItem(this.storageKey);
      if (raw) {
        this.directives = JSON.parse(raw);
      }
    } catch (e) {
      this.directives = [];
    }
  }

  private saveDirectives(): void {
    try {
      storageService.setItem(this.storageKey, JSON.stringify(this.directives));
    } catch (e) {
      systemLogger.warn('SELF_IMPROVEMENT', '作業指示データの保存に失敗しました', e);
    }
  }

  /**
   * 自然言語の作業指示書テキストを構文解析し、構造化されたディレクティブを生成して登録
   */
  public ingestDirective(rawText: string, customTitle?: string): StructuredDirective {
    const lines = rawText.split('\n').map((l) => l.trim());

    // 1. タイトルの抽出
    let title = customTitle || '';
    if (!title) {
      const headingLine = lines.find((l) => l.startsWith('# '));
      if (headingLine) {
        title = headingLine.replace(/^#\s*/, '').trim();
      } else {
        title = `作業指示 (${new Date().toLocaleDateString('ja-JP')} 受領)`;
      }
    }

    // 2. 目的 (Goal) の抽出
    let goal = '';
    const goalSectionIndex = lines.findIndex((l) =>
      /(目的|概要|前提|要求|今回の要求|スコープ)/i.test(l) && (l.startsWith('#') || l.startsWith('**'))
    );
    if (goalSectionIndex !== -1) {
      const collected: string[] = [];
      for (let i = goalSectionIndex + 1; i < lines.length; i++) {
        const line = lines[i];
        if (line.startsWith('#') || line.startsWith('## ')) break;
        if (line) collected.push(line.replace(/^[-*•]\s*/, ''));
        if (collected.length >= 4) break;
      }
      goal = collected.join(' / ');
    }
    if (!goal) {
      goal = lines.find((l) => l.length > 10 && !l.startsWith('#')) || title;
    }

    // 3. 対象 (Targets: ファイル、章番号、システム名) の抽出
    const targets = new Set<string>();
    const fileMatches = rawText.matchAll(/([a-zA-Z0-9_\-./]+\.(?:ts|tsx|js|json|txt|md))/g);
    for (const m of fileMatches) {
      if (!m[1].startsWith('http')) {
        targets.add(m[1]);
      }
    }
    const chapterMatches = rawText.matchAll(/(?:第\s*(\d+)\s*章|chapter\s*(\d+))/gi);
    for (const m of chapterMatches) {
      targets.add(`第${m[1] || m[2]}章`);
    }
    if (targets.size === 0) {
      targets.add('全システム基盤 (自己改善パイプライン)');
    }

    // 4. 要求内容 (Requirements) の抽出
    const requirements: string[] = [];
    let inReqSection = false;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (/##.*(要求|項目|仕様|タスク|実装内容)/i.test(line)) {
        inReqSection = true;
        continue;
      }
      if (inReqSection && /##.*(禁止|完了|確認|前提)/i.test(line)) {
        inReqSection = false;
      }
      if (inReqSection && line) {
        // 番号付きリストまたは箇条書き
        const m = line.match(/^(\d+[\.\)]\s*|[-*•]\s*)(.+)$/);
        if (m && m[2].length > 4) {
          requirements.push(m[2].trim());
        }
      }
    }
    // セクションで見つからない場合は番号付き行を全体から収集
    if (requirements.length === 0) {
      for (const line of lines) {
        const m = line.match(/^(\d{1,2}[\.\)]\s*|\*\*\d{1,2}\.?\s*)(.+)$/);
        if (m && m[2].length > 5) {
          requirements.push(m[2].replace(/\*\*/g, '').trim());
        }
      }
    }

    // 5. 禁止事項 (Forbidden Behaviors) の抽出
    const forbiddenBehaviors: string[] = [];
    let inForbiddenSection = false;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (/##.*(禁止|やってはいけない|DON'T|FORBIDDEN)/i.test(line)) {
        inForbiddenSection = true;
        continue;
      }
      if (inForbiddenSection && line.startsWith('##')) {
        inForbiddenSection = false;
      }
      if (inForbiddenSection && line) {
        const cleaned = line.replace(/^[-*•\d\.\)]\s*/, '').replace(/\*\*/g, '').trim();
        if (cleaned.length > 5) {
          forbiddenBehaviors.push(cleaned);
        }
      }
    }
    // 「〜しないこと」「〜を禁止」等のキーワード抽出
    if (forbiddenBehaviors.length === 0) {
      for (const line of lines) {
        if (/(禁止|してはならない|しないこと|混同しないこと|未着手のまま放置)/.test(line)) {
          forbiddenBehaviors.push(line.replace(/^[-*•]\s*/, '').replace(/\*\*/g, '').trim());
        }
      }
    }

    // 6. 完了条件 (Completion Criteria) の抽出
    const completionCriteria: string[] = [];
    let inCompletionSection = false;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (/##.*(完了条件|必須のもの|報告|提出|ACCEPTANCE)/i.test(line)) {
        inCompletionSection = true;
        continue;
      }
      if (inCompletionSection && line.startsWith('##')) {
        inCompletionSection = false;
      }
      if (inCompletionSection && line) {
        const cleaned = line.replace(/^[-*•\d\.\)]\s*/, '').replace(/\*\*/g, '').trim();
        if (cleaned.length > 5) {
          completionCriteria.push(cleaned);
        }
      }
    }
    if (completionCriteria.length === 0) {
      for (const line of lines) {
        if (/(必須|提出すること|明記すること|提示すること|添付すること)/.test(line)) {
          completionCriteria.push(line.replace(/^[-*•]\s*/, '').replace(/\*\*/g, '').trim());
        }
      }
    }

    const directiveId = `DIR-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    const structured: StructuredDirective = {
      directiveId,
      title,
      rawText,
      goal: goal || '自己改善指示の確実な履行と検証',
      targets: Array.from(targets),
      requirements: requirements.length > 0 ? requirements : ['要求仕様の全項目実装と検証'],
      forbiddenBehaviors: forbiddenBehaviors.length > 0 ? forbiddenBehaviors : ['仕様に反する実装の禁止'],
      completionCriteria: completionCriteria.length > 0 ? completionCriteria : ['全テスト合格とエビデンス記録'],
      parsedAt: Date.now(),
      priority: 'CRITICAL',
      status: 'PENDING',
    };

    this.directives.unshift(structured);
    this.saveDirectives();

    systemLogger.info(
      'SELF_IMPROVEMENT',
      `📋 [Directive Ingested] ${structured.title} (要件: ${structured.requirements.length}件, 禁止事項: ${structured.forbiddenBehaviors.length}件, 完了条件: ${structured.completionCriteria.length}件)`
    );

    return structured;
  }

  /**
   * 取り込まれた指示書から、RequirementContract (要求契約) を自動合成
   */
  public generateRequirementContracts(directiveId: string): RequirementContract[] {
    const directive = this.directives.find((d) => d.directiveId === directiveId);
    if (!directive) return [];

    return directive.requirements.map((req, idx) => {
      const reqId = `REQ-${directive.directiveId.slice(-4)}-${String(idx + 1).padStart(2, '0')}`;
      return {
        contractId: `CTR-${reqId}`,
        requirementId: reqId,
        title: req.slice(0, 50),
        sourceDirectiveId: directive.directiveId,
        acceptanceCriteria: [
          `要件内容「${req}」がコード上で実装され検証されていること`,
          ...directive.completionCriteria.slice(0, 2),
        ],
        requiredBehaviors: [
          `要件仕様を満たす実行結果を返すこと`,
          `実行証拠 (ImplementationEvidence) が記録されること`,
        ],
        forbiddenBehaviors: directive.forbiddenBehaviors.slice(0, 3),
        observableMetrics: [
          '構文解析エラー 0',
          '単体テスト合格率 100%',
          '反例ゲート合格',
          '回帰検出なし',
        ],
        verdict: 'UNTESTED',
      };
    });
  }

  public listDirectives(): StructuredDirective[] {
    return [...this.directives];
  }

  public getAllDirectives(): StructuredDirective[] {
    return this.listDirectives();
  }

  public ingestDirectiveText(rawText: string, customTitle?: string): StructuredDirective {
    return this.ingestDirective(rawText, customTitle);
  }

  public ingestV23Directive(): StructuredDirective {
    const v23Text = `# MIKI-AI 非LLM化 作業指示書 v23
## 目的
証拠付き自己改善ループ (Evidence-Based Self-Improvement Loop) の徹底実装。テスト通過のみで改善と判定せず、反例探索・汎化・因果性・停止ポリシー・実利用フィードバックの14要件を完全遵守する。

## 実装要求項目
1. ChangeSetIDの一意追跡 (Experiment, Snapshot, Patch, Test, Canary, Rollback, Git Commit)
2. Requirement Contract (要求契約) の事前定義と受入基準検証
3. ImplementationEvidence への証拠集約 (ハッシュ, テスト, 変更行, 影響)
4. 失敗10分類 (Requirement Misread, Missing Knowledge, Wrong Architecture, Wrong Algorithm, Dependency, Test Gap, Environment, Regression, Performance, Safety Rejection)
5. Self-Improvement Strategy Memory (どう直すか戦略記憶) の保持と選択
6. Causal Improvement Experiment (同一条件複数試行による因果性検証)
7. Mandatory Counterexample Gate (境界値・異常入力・外部ダウン・環境差・競合の5反例注入)
8. Generalization Gate (過学習排除・複数環境での汎化スコア検証)
9. Learning Usage Evidence (学習教訓の実適用・利用率トラッキング)
10. No-Change Decision (改善幅微小またはリスク超過時の無変更採択)
11. Stop Policy (回帰・反例不合格・反復失敗時の即時安全停止)
12. Canonical Pipeline & Lock (単一正規パイプラインと二重実行防止排他ロック)
13. Git State (COMMITTED) と Adoption State (VERIFIED/ADOPTED) の明確分離
14. Closed Loop (実利用フィードバックの戦略記憶への還元)

## 禁止事項
- テスト通過のみで「要求充足」とみなすことの禁止
- 改善理由や証拠のない無根拠なコード書き換えの禁止
- 二重実行やロック未解除によるデッドロックの禁止
- 失敗原因の未分類放置の禁止

## 完了条件
- 全14項目の自己改善パイプラインが正常に稼働し、ImplementationEvidenceが記録されること
- 指示書取り込みUIから指示書を読み込み、RequirementContractとして自動反映できること`;

    return this.ingestDirective(v23Text, 'MIKI-AI 非LLM化 作業指示書 v23 (公式14要件)');
  }

  public getPendingDirective(): StructuredDirective | undefined {
    return this.directives.find((d) => d.status === 'PENDING' || d.status === 'IN_PROGRESS');
  }

  public markStatus(
    directiveId: string,
    status: StructuredDirective['status'],
    changeSetId?: ChangeSetID,
    summary?: string
  ): void {
    const dir = this.directives.find((d) => d.directiveId === directiveId);
    if (dir) {
      dir.status = status;
      if (changeSetId) dir.executionChangeSetId = changeSetId;
      if (summary) dir.resultSummary = summary;
      this.saveDirectives();
    }
  }

  public deleteDirective(directiveId: string): void {
    this.directives = this.directives.filter((d) => d.directiveId !== directiveId);
    this.saveDirectives();
  }
}

export const workDirectiveIngestionService = WorkDirectiveIngestionService.getInstance();
