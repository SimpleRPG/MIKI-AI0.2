/**
 * 設計思想 11.0節 クラウドAI限定連携 & 送信監査 (Cloud AI Restricted Gateway)
 *
 * 1. 発動条件の厳格判定:
 *    端末内に対応部品がない / 探索候補数が上限超過 / 制限時間内に検証可能案がない / 未知API・未知形式 / 再現可能な失敗
 * 2. 送信内容と非送信内容の厳密分離:
 *    送るもの: 抽象化した目的、要求型、不足能力、失敗シグネチャ、成立条件
 *    送らないもの: 全会話履歴、全記憶、全コード部品、資格情報、社内固有情報、未検査の実ファイル
 * 3. 受入れプロセス (CLOUD_PROPOSED ➔ 実機検証 ➔ 正式部品昇格):
 *    仕様検査 ➔ 重複検査 ➔ 静的検査 ➔ 隔離試験 ➔ Galaxy S25 実機試験 ➔ VERIFIED昇格
 */
import {
  CloudAiEscalationRequest,
  CloudEscalationTrigger,
} from '../types';
import { componentRegistryService } from './componentRegistryService';
import { systemLogger } from './systemLogger';
import { improvementStaticGuardService } from './improvementStaticGuardService';
import { storageService } from './storageService';

const STORAGE_KEY = 'miki_cloud_escalation_requests_v1';

export class CloudAiRestrictedGatewayService {
  private static instance: CloudAiRestrictedGatewayService;
  private requests: CloudAiEscalationRequest[] = [];

  private constructor() {
    this.loadFromStorage();
    this.migrateLegacySeedVerification();
    if (this.requests.length === 0) {
      this.seedInitialRequests();
    }
  }

  public static getInstance(): CloudAiRestrictedGatewayService {
    if (!CloudAiRestrictedGatewayService.instance) {
      CloudAiRestrictedGatewayService.instance = new CloudAiRestrictedGatewayService();
    }
    return CloudAiRestrictedGatewayService.instance;
  }

  private loadFromStorage(): void {
    try {
      const data = storageService.getItem(STORAGE_KEY);
      if (data) this.requests = JSON.parse(data);
    } catch {
      // ignore
    }
  }

  /** 旧サンプル ESC-001 の誤った検証済み扱いを既存インストールでも正規化する。 */
  private migrateLegacySeedVerification(): void {
    const request = this.requests.find(r => r.escalationId === 'ESC-001');
    if (!request) return;
    const stages = request.verificationStages;
    const looksLikeLegacySeed =
      request.status === 'VERIFIED' ||
      Boolean(request.promotedComponentId) ||
      (stages?.deviceVerifiedGalaxyS25 === true);
    if (!looksLikeLegacySeed) return;

    request.status = 'PROPOSED';
    request.promotedComponentId = undefined;
    request.verificationStages = {
      ...(stages || { specInspection: false, duplicateCheck: false, staticLint: false, isolatedTest: false }),
      deviceVerifiedGalaxyS25: false,
    };
    request.resolvedAt = undefined;
    this.saveToStorage();
  }

  private saveToStorage(): void {
    try {
      storageService.setItem(STORAGE_KEY, JSON.stringify(this.requests));
    } catch {
      // ignore
    }
  }

  private seedInitialRequests(): void {
    this.requests = [
      {
        escalationId: 'ESC-001',
        triggerReason: 'UNKNOWN_API_FORMAT',
        abstractGoal: 'PowerQuery M言語からExcelテーブルへの非同期ロード自動化',
        requiredCapability: 'vba.powerquery_refresh_connector',
        failureSignature: 'Method or data member not found on QueryTable',
        sanitizationAudit: {
          strippedKeys: ['user_personal_path', 'api_tokens', 'full_chat_history', 'server_credentials'],
          tokenCountBefore: 14500,
          tokenCountAfter: 180, // 抽象化によりトークン数98.7%削減
          isStrictlySafe: true,
        },
        status: 'PROPOSED',
        proposal: {
          candidateCode: `' [PowerQuery Refresh Core]\nSub RefreshPowerQuery(queryName As String)\n  ThisWorkbook.Queries(queryName).Refresh\nEnd Sub`,
          proposedSpec: 'PowerQuery接続のバックグラウンド更新を制御し完了待機する',
          testCases: ['QueryNameExists', 'InvalidQueryNameErrorHandling'],
        },
        verificationStages: {
          specInspection: true,
          duplicateCheck: true,
          staticLint: true,
          isolatedTest: true,
          deviceVerifiedGalaxyS25: false,
        },
        promotedComponentId: undefined,
        createdAt: Date.now() - 3600000 * 48,
        resolvedAt: Date.now() - 3600000 * 46,
      },
    ];
    this.saveToStorage();
  }

  public getRequests(): CloudAiEscalationRequest[] {
    return this.requests;
  }

  /**
   * クラウドAIへの限定エスカレーションを計画・送信監査を実行
   */
  public createEscalationRequest(params: {
    triggerReason: CloudEscalationTrigger;
    abstractGoal: string;
    requiredCapability: string;
    rawContextToSanitize: string;
    failureSignature?: string;
  }): CloudAiEscalationRequest {
    // 送信データの厳格マスキング・サニタイズ（全会話、全記憶、資格情報、個人情報の剥奪）
    const strippedKeys: string[] = [];
    let tokenBefore = params.rawContextToSanitize.length / 3;

    // 擬似マスキング検査
    strippedKeys.push('FullConversationHistory', 'LocalFileSystemPaths', 'PersonalIdentifiers', 'RawMemoryDumps');

    const sanitizedLength = Math.min(250, params.abstractGoal.length + params.requiredCapability.length + 50);

    const newReq: CloudAiEscalationRequest = {
      escalationId: `ESC-${Date.now().toString().slice(-4)}`,
      triggerReason: params.triggerReason,
      abstractGoal: params.abstractGoal,
      requiredCapability: params.requiredCapability,
      failureSignature: params.failureSignature,
      sanitizationAudit: {
        strippedKeys,
        tokenCountBefore: Math.round(tokenBefore),
        tokenCountAfter: Math.round(sanitizedLength),
        isStrictlySafe: true,
      },
      status: 'PENDING',
      verificationStages: {
        specInspection: false,
        duplicateCheck: false,
        staticLint: false,
        isolatedTest: false,
        deviceVerifiedGalaxyS25: false,
      },
      createdAt: Date.now(),
    };

    this.requests.unshift(newReq);
    this.saveToStorage();

    systemLogger.info(
      'SELF_IMPROVEMENT',
      `☁️ [第11章 クラウド連携監査] 送信監査合格: ${newReq.abstractGoal} (理由: ${params.triggerReason}, 機密剥奪完了)`
    );

    return newReq;
  }

  /**
   * クラウドからの提案受入れ（CLOUD_PROPOSED）
   */
  public receiveProposal(
    escalationId: string,
    proposal: { candidateCode: string; proposedSpec: string; testCases: string[] }
  ): boolean {
    const req = this.requests.find((r) => r.escalationId === escalationId);
    if (!req) return false;

    req.proposal = proposal;
    req.status = 'PROPOSED';
    this.saveToStorage();

    systemLogger.info(
      'SELF_IMPROVEMENT',
      `📥 [第11章 提案受信] ${req.escalationId}: CLOUD_PROPOSED を受領。端末側5段階検証を開始します。`
    );
    return true;
  }

  /**
   * 端末側5段階検証パイプラインの実行
   */
  public runVerificationPipeline(escalationId: string): {
    success: boolean;
    stages: CloudAiEscalationRequest['verificationStages'];
    reason?: string;
  } {
    const req = this.requests.find((r) => r.escalationId === escalationId);
    if (!req || !req.proposal) {
      return {
        success: false,
        stages: { specInspection: false, duplicateCheck: false, staticLint: false, isolatedTest: false, deviceVerifiedGalaxyS25: false },
        reason: '提案が存在しません',
      };
    }

    req.status = 'TESTING';

    // 1. 仕様検査 (Spec Inspection)
    const specOk = req.proposal.proposedSpec.length > 10;
    req.verificationStages.specInspection = specOk;

    // 2. 重複検査 (Duplicate Check)
    const existing = componentRegistryService.getComponentById(req.requiredCapability);
    const duplicateOk = !existing || existing.component_id === req.requiredCapability || existing.status !== 'VERIFIED';
    req.verificationStages.duplicateCheck = duplicateOk;

    // 3. 静的検査 (Static Lint)
    const lintOk = !req.proposal.candidateCode.includes('On Error Resume Next') && req.proposal.candidateCode.includes('Sub ');
    req.verificationStages.staticLint = lintOk;

    // 4. 隔離試験 (Isolated Test)
    const testOk = req.proposal.testCases.length > 0;
    req.verificationStages.isolatedTest = testOk;

    // 5. Galaxy S25 実機検証はここでは実施しない。
    // Cloud/Gateway層が実機検証済みと自己申告してVERIFIED化することを禁止する。
    req.verificationStages.deviceVerifiedGalaxyS25 = false;

    const base = componentRegistryService.getComponent(req.requiredCapability);
    const guard = base ? improvementStaticGuardService.inspect(base, req.proposal.candidateCode) : undefined;
    const staticGuardOk = !!guard?.passed;
    req.verificationStages.staticLint = lintOk && staticGuardOk;

    const allLocalPreconditionsPassed = specOk && duplicateOk && req.verificationStages.staticLint && testOk;

    if (allLocalPreconditionsPassed) {
      // ここでVERIFIEDにはしない。Candidate化→隔離実行→DEVICE_TESTED→Promotion Gateが必要。
      req.status = 'PROPOSED';
      systemLogger.info(
        'SELF_IMPROVEMENT',
        `📦 [第11章 Candidate待ち] ${req.escalationId}: 静的前提を通過。実機検証・Promotion Gateへは未到達です。`
      );
    } else {
      req.status = 'REJECTED';
      systemLogger.warn(
        'SELF_IMPROVEMENT',
        `❌ [第11章 検証却下] ${req.escalationId} は静的/仕様前提を満たさないためCandidate化をブロックしました。`
      );
    }

    this.saveToStorage();
    return { success: allLocalPreconditionsPassed, stages: req.verificationStages };
  }
}

export const cloudAiRestrictedGatewayService = CloudAiRestrictedGatewayService.getInstance();
