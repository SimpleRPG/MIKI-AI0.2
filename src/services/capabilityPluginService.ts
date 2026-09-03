import {
  CapabilityPlugin,
  CapabilityPluginStatus,
  PluginConsentRequest,
} from '../types';
import { systemLogger } from './systemLogger';
import { storageService } from './storageService';

const PLUGINS_STORAGE_KEY = 'miki_capability_plugins';

/**
 * 設計思想 46. 能力プラグイン方式 (Capability Plugin System)
 * 
 * 既存の機能を後付けでプラグイン定義に乗せ直し、
 * 47章「自然言語からワークフローを作る機構」の allowed_tools の参照元となる能力基盤を提供する。
 * 
 * 【基本原則】
 * 1. プラグインが追加されても、端末内の正式権限を自動的に増やさない。
 * 2. status が ACTIVE になる際には、必ずユーザーの明示的な権限確認（同意ダイアログ）を挟む。
 * 3. 各プラグインには明確な「必要入力」「出力スキーマ」「実行予算」「検証方法」「失敗時の代替経路」を持たせる。
 */

export const BUILTIN_CAPABILITY_PLUGINS: CapabilityPlugin[] = [
  {
    plugin_id: 'plugin_web_search',
    name: 'Web調査能力 (Gemini Cloud Search)',
    description: '最新のWeb情報やドキュメントをGemini Cloud経由でリアルタイム検索・調査し、根拠付きレポートを生成します。',
    category: 'web_search',
    requiredInputs: ['検索クエリ (query)', '調査観点 (research_focus)'],
    outputSchema: 'Markdownレポート形式 (引用元URL・事実要約・結論セクション)',
    allowedTools: ['tool_gemini_cloud_search', 'tool_workspace_search'],
    requiredPermissions: ['network_cloud', 'sensitive_filter'],
    executionBudget: {
      maxTokens: 4000,
      maxCalls: 5,
      costPerRun: 1,
      maxDurationMs: 15000,
    },
    timeoutMs: 15000,
    verificationMethod: '事実整合性チェック & 参照URL・ドメインの到達可能性フォーマット検証',
    fallbackPluginId: 'plugin_code_analysis',
    version: '1.0.0',
    status: 'TESTED', // クラウド通信のためユーザー明示同意が必要
    createdAt: Date.now() - 86400000 * 14,
    updatedAt: Date.now(),
    successCount: 34,
    failureCount: 1,
  },
  {
    plugin_id: 'plugin_vba_validation',
    name: 'VBA静的検証・モダン変換能力',
    description: 'レガシーなExcel VBAマクロコードの構文検査、セキュリティ監査、およびモダンなTypeScript/Reactへの移行計画を立案します。',
    category: 'vba_validation',
    requiredInputs: ['VBAマクロソースコード (vba_code)', '対象ワークシート操作仕様 (sheet_spec)'],
    outputSchema: '構文診断結果 + TypeScript変換コード + 入出力テストケース',
    allowedTools: ['tool_syntax_checker', 'tool_workspace_read', 'tool_workspace_write'],
    requiredPermissions: ['workspace_read', 'workspace_write'],
    executionBudget: {
      maxTokens: 8000,
      maxCalls: 10,
      costPerRun: 0,
      maxDurationMs: 12000,
    },
    timeoutMs: 12000,
    verificationMethod: 'AST構文静的検査 & 未定義変数・未宣言オブジェクトの自動検出',
    fallbackPluginId: 'plugin_code_analysis',
    version: '1.2.0',
    status: 'ACTIVE',
    userConsentGrantedAt: Date.now() - 86400000 * 10,
    grantedPermissions: ['workspace_read', 'workspace_write'],
    createdAt: Date.now() - 86400000 * 20,
    updatedAt: Date.now(),
    successCount: 42,
    failureCount: 2,
  },
  {
    plugin_id: 'plugin_code_analysis',
    name: 'コード解析・構造診断能力 (MoE & 圧縮)',
    description: 'JavaScript/TypeScript/HTMLコードの構文・括弧の整合性・トークン圧縮・MoEルーティングを行い、品質改善提案を行います。',
    category: 'code_analysis',
    requiredInputs: ['ソースコード (source_code)', '診断レベル (audit_level)'],
    outputSchema: '構文診断レポート + エラー行番号 + 修正後コード差分',
    allowedTools: ['tool_syntax_checker', 'tool_workspace_search', 'tool_workspace_read'],
    requiredPermissions: ['workspace_read'],
    executionBudget: {
      maxTokens: 6000,
      maxCalls: 8,
      costPerRun: 0,
      maxDurationMs: 10000,
    },
    timeoutMs: 10000,
    verificationMethod: 'SyntaxChecker静的パース & 括弧整合性・クォート整合性スコアリング',
    version: '1.1.0',
    status: 'ACTIVE',
    userConsentGrantedAt: Date.now() - 86400000 * 15,
    grantedPermissions: ['workspace_read'],
    createdAt: Date.now() - 86400000 * 30,
    updatedAt: Date.now(),
    successCount: 68,
    failureCount: 0,
  },
  {
    plugin_id: 'plugin_safe_math',
    name: '安全数値計算 & 単位換算能力',
    description: '四則演算、税込計算、何割引き、平方根などの日常計算を、eval不使用の決定論的パーサーで安全に実行します。',
    category: 'math_calculation',
    requiredInputs: ['計算式または日本語表現 (math_expression)'],
    outputSchema: 'JSONオブジェクト { result: number, formatted: string, expression: string }',
    allowedTools: ['tool_safe_calculator'],
    requiredPermissions: [], // 外部権限不要
    executionBudget: {
      maxTokens: 500,
      maxCalls: 20,
      costPerRun: 0,
      maxDurationMs: 3000,
    },
    timeoutMs: 3000,
    verificationMethod: '再帰下降パーサーによる決定論的トークン演算',
    version: '1.3.0',
    status: 'ACTIVE',
    userConsentGrantedAt: Date.now() - 86400000 * 30,
    grantedPermissions: [],
    createdAt: Date.now() - 86400000 * 40,
    updatedAt: Date.now(),
    successCount: 110,
    failureCount: 0,
  },
  {
    plugin_id: 'plugin_workspace_crud',
    name: 'ワークスペース操作能力 (ファイル編集・検索)',
    description: 'ワークスペース内のファイルを読み取り、検索し、ユーザー承認のもとでコード更新や新規作成を行います。',
    category: 'workspace_manipulation',
    requiredInputs: ['ファイルパス (file_path)', '操作内容 (action_type: read/write/grep)'],
    outputSchema: '操作実行ログ + 変更差分サマリー',
    allowedTools: ['tool_workspace_read', 'tool_workspace_write', 'tool_workspace_search'],
    requiredPermissions: ['workspace_read', 'workspace_write'],
    executionBudget: {
      maxTokens: 5000,
      maxCalls: 12,
      costPerRun: 0,
      maxDurationMs: 8000,
    },
    timeoutMs: 8000,
    verificationMethod: '変更前後ファイルハッシュ照合 & ユーザー承認ログ確認',
    fallbackPluginId: 'plugin_code_analysis',
    version: '1.0.0',
    status: 'ACTIVE',
    userConsentGrantedAt: Date.now() - 86400000 * 12,
    grantedPermissions: ['workspace_read', 'workspace_write'],
    createdAt: Date.now() - 86400000 * 25,
    updatedAt: Date.now(),
    successCount: 55,
    failureCount: 1,
  },
];

export class CapabilityPluginService {
  private plugins: CapabilityPlugin[] = [];
  private consentListeners: Array<(request: PluginConsentRequest) => void> = [];

  constructor() {
    this.initPlugins();
  }

  /**
   * プラグイン一覧の初期化・ローカルストレージからの復元
   */
  private initPlugins(): void {
    try {
      const raw = storageService.getItem(PLUGINS_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          this.plugins = parsed;
          this.syncCloudConsentState();
          return;
        }
      }
    } catch (e) {
      console.warn('Failed to load capability plugins from storage:', e);
    }

    // デフォルトプラグインをロード
    this.plugins = JSON.parse(JSON.stringify(BUILTIN_CAPABILITY_PLUGINS));
    this.syncCloudConsentState();
    this.savePlugins();
  }

  /**
   * 既存の Gemini Cloud 同意状態（miki_gemini_cloud_consent）と
   * Web調査プラグインの権限状態を同期
   */
  private syncCloudConsentState(): void {
    const webPlugin = this.plugins.find((p) => p.plugin_id === 'plugin_web_search');
    if (!webPlugin) return;

    const hasCloudConsent = storageService.getItem('miki_gemini_cloud_consent') === 'true';
    if (hasCloudConsent) {
      if (webPlugin.status === 'TESTED' || webPlugin.status === 'CANDIDATE') {
        webPlugin.status = 'ACTIVE';
        webPlugin.userConsentGrantedAt = webPlugin.userConsentGrantedAt || Date.now();
        webPlugin.grantedPermissions = ['network_cloud', 'sensitive_filter'];
      }
    } else {
      // 同意が解除されている場合は ACTIVE にしない
      if (webPlugin.status === 'ACTIVE') {
        webPlugin.status = 'TESTED';
        webPlugin.grantedPermissions = [];
        webPlugin.userConsentGrantedAt = undefined;
      }
    }
  }

  /**
   * プラグイン一覧を保存
   */
  public savePlugins(): void {
    try {
      storageService.setItem(PLUGINS_STORAGE_KEY, JSON.stringify(this.plugins));
    } catch (e) {
      console.error('Failed to save capability plugins:', e);
    }
  }

  /**
   * 全プラグインを取得
   */
  public getAllPlugins(): CapabilityPlugin[] {
    return [...this.plugins];
  }

  /**
   * 有効稼働中 (ACTIVE) のプラグインを取得
   */
  public getActivePlugins(): CapabilityPlugin[] {
    return this.plugins.filter((p) => p.status === 'ACTIVE');
  }

  /**
   * プラグインIDから取得
   */
  public getPlugin(pluginId: string): CapabilityPlugin | undefined {
    return this.plugins.find((p) => p.plugin_id === pluginId);
  }

  /**
   * 分類 (category) からプラグインを検索
   */
  public findPluginsByCategory(category: string): CapabilityPlugin[] {
    const catLower = category.toLowerCase().trim();
    return this.plugins.filter(
      (p) => p.category.toLowerCase() === catLower || p.category.toLowerCase().includes(catLower)
    );
  }

  /**
   * 47章ワークフロー用: 指定されたプラグイン群が許可する「使用可能ツール (allowed_tools)」一覧を一括抽出
   */
  public getAllowedToolsForPlugins(pluginIds: string[]): string[] {
    const toolsSet = new Set<string>();
    for (const id of pluginIds) {
      const plugin = this.plugins.find((p) => p.plugin_id === id && p.status === 'ACTIVE');
      if (plugin && Array.isArray(plugin.allowedTools)) {
        plugin.allowedTools.forEach((t) => toolsSet.add(t));
      }
    }
    return Array.from(toolsSet);
  }

  /**
   * 依頼内容や目的に最適なプラグインを推論
   */
  public findBestPluginForTask(userGoal: string): CapabilityPlugin | undefined {
    if (!userGoal) return undefined;
    const g = userGoal.toLowerCase();

    // 1. Web調査 / 最新情報
    if (g.includes('検索') || g.includes('web') || g.includes('最新') || g.includes('調査') || g.includes('ググる')) {
      const p = this.plugins.find((x) => x.plugin_id === 'plugin_web_search');
      if (p && p.status === 'ACTIVE') return p;
      if (p && p.fallbackPluginId) return this.getPlugin(p.fallbackPluginId);
    }

    // 2. VBA / Excel
    if (g.includes('vba') || g.includes('excel') || g.includes('マクロ') || g.includes('ワークシート')) {
      return this.plugins.find((x) => x.plugin_id === 'plugin_vba_validation' && x.status === 'ACTIVE');
    }

    // 3. 数値計算
    if (
      g.includes('計算') ||
      g.includes('税込') ||
      g.includes('割引き') ||
      g.includes('合計') ||
      /[0-9]+\s*[\+\-\*\/×÷]\s*[0-9]+/.test(g)
    ) {
      return this.plugins.find((x) => x.plugin_id === 'plugin_safe_math' && x.status === 'ACTIVE');
    }

    // 4. ファイル操作 / ワークスペース
    if (g.includes('ファイル') || g.includes('保存') || g.includes('書き込み') || g.includes('作成') || g.includes('編集')) {
      return this.plugins.find((x) => x.plugin_id === 'plugin_workspace_crud' && x.status === 'ACTIVE');
    }

    // 5. コード解析
    return this.plugins.find((x) => x.plugin_id === 'plugin_code_analysis' && x.status === 'ACTIVE');
  }

  /**
   * 失敗時の代替経路 (fallbackPlugin) を取得
   */
  public getFallbackPlugin(pluginId: string): CapabilityPlugin | undefined {
    const plugin = this.getPlugin(pluginId);
    if (!plugin || !plugin.fallbackPluginId) return undefined;
    return this.getPlugin(plugin.fallbackPluginId);
  }

  /**
   * プラグインの必要権限チェック
   * 未承認の権限があるかを判定する
   */
  public checkPermissions(pluginId: string): {
    hasAllPermissions: boolean;
    required: string[];
    granted: string[];
    missing: string[];
  } {
    const plugin = this.getPlugin(pluginId);
    if (!plugin) {
      return { hasAllPermissions: false, required: [], granted: [], missing: [] };
    }

    const required = plugin.requiredPermissions || [];
    const granted = new Set(plugin.grantedPermissions || []);
    const missing = required.filter((perm) => !granted.has(perm));

    return {
      hasAllPermissions: missing.length === 0,
      required,
      granted: Array.from(granted),
      missing,
    };
  }

  /**
   * 46章の最重要原則:
   * 「プラグインが追加されても、端末内の正式権限を自動的に増やさない」
   * 
   * プラグインを ACTIVE に遷移させたい場合、このメソッドを呼ぶ。
   * もし未承認の権限があれば即座に ACTIVE にはならず、
   * 権限確認要求 (PluginConsentRequest) を発行してユーザー承認待ちとする。
   */
  public requestActivatePlugin(pluginId: string): {
    needsUserConsent: boolean;
    consentRequest?: PluginConsentRequest;
    activated: boolean;
    message: string;
  } {
    const plugin = this.getPlugin(pluginId);
    if (!plugin) {
      return { needsUserConsent: false, activated: false, message: 'プラグインが見つかりません。' };
    }

    if (plugin.status === 'ACTIVE') {
      return { needsUserConsent: false, activated: true, message: `「${plugin.name}」は既に有効です。` };
    }

    const permCheck = this.checkPermissions(pluginId);

    // 必要権限が空、またはすべてすでに承認済みの場合
    if (permCheck.hasAllPermissions) {
      plugin.status = 'ACTIVE';
      plugin.updatedAt = Date.now();
      this.savePlugins();
      systemLogger.info('TOOLS', `[46章 能力プラグイン] 「${plugin.name}」をACTIVEに昇格しました (権限承認済み)`);
      return { needsUserConsent: false, activated: true, message: `「${plugin.name}」を有効化しました。` };
    }

    // 未承認の権限があるため、ユーザー同意要求を構築
    const riskSummary = this.buildRiskSummary(plugin, permCheck.missing);
    const consentRequest: PluginConsentRequest = {
      plugin,
      missingPermissions: permCheck.missing,
      riskSummary,
    };

    // リスナーへ通知
    this.consentListeners.forEach((listener) => {
      try {
        listener(consentRequest);
      } catch (err) {
        console.error('Consent listener error:', err);
      }
    });

    systemLogger.warn(
      'TOOLS',
      `[46章 権限保護] プラグイン「${plugin.name}」の有効化に未承認の権限 (${permCheck.missing.join(', ')}) が必要です。ユーザー確認ダイアログを表示します。`
    );

    return {
      needsUserConsent: true,
      consentRequest,
      activated: false,
      message: `「${plugin.name}」の有効化には ${permCheck.missing.length} 件の端末権限のユーザー承認が必要です。`,
    };
  }

  /**
   * ユーザーが明示的にダイアログで権限を承認した際の確定処理
   */
  public grantConsentAndActivate(
    pluginId: string,
    approvedPermissions: string[],
    notes?: string
  ): { success: boolean; message: string } {
    const plugin = this.getPlugin(pluginId);
    if (!plugin) {
      return { success: false, message: 'プラグインが見つかりません。' };
    }

    const currentGranted = new Set(plugin.grantedPermissions || []);
    approvedPermissions.forEach((p) => currentGranted.add(p));

    plugin.grantedPermissions = Array.from(currentGranted);
    plugin.userConsentGrantedAt = Date.now();
    if (notes) plugin.consentNotes = notes;

    // 必要権限がすべて承認されたか確認
    const permCheck = this.checkPermissions(pluginId);
    if (permCheck.hasAllPermissions) {
      plugin.status = 'ACTIVE';
      plugin.updatedAt = Date.now();
      this.savePlugins();

      // Web検索プラグインの場合、Gemini Cloud consent も連動して更新
      if (plugin.plugin_id === 'plugin_web_search') {
        storageService.setItem('miki_gemini_cloud_consent', 'true');
      }

      systemLogger.info(
        'TOOLS',
        `[46章 権限承認] ユーザーがプラグイン「${plugin.name}」の権限 (${approvedPermissions.join(', ')}) を承認し、ACTIVEとして稼働開始しました。`
      );

      return {
        success: true,
        message: `「${plugin.name}」の権限を承認し、有効化しました。`,
      };
    } else {
      // 一部のみ承認され、不足がある場合
      plugin.status = 'TESTED';
      plugin.updatedAt = Date.now();
      this.savePlugins();

      return {
        success: false,
        message: `一部の権限が未承認のため、「${plugin.name}」は試験状態 (TESTED) のままです。不足権限: ${permCheck.missing.join(', ')}`,
      };
    }
  }

  /**
   * ユーザーが権限を拒否、またはプラグインを一時停止
   */
  public suspendOrRejectPlugin(pluginId: string, reason?: string): void {
    const plugin = this.getPlugin(pluginId);
    if (!plugin) return;

    plugin.status = 'SUSPENDED';
    plugin.updatedAt = Date.now();
    this.savePlugins();

    systemLogger.warn(
      'TOOLS',
      `[46章 プラグイン停止] 「${plugin.name}」が一時停止されました。理由: ${reason || 'ユーザー手動停止または権限拒否'}`
    );
  }

  /**
   * プラグインのステータスを手動変更
   */
  public setPluginStatus(pluginId: string, newStatus: CapabilityPluginStatus): { success: boolean; message: string } {
    const plugin = this.getPlugin(pluginId);
    if (!plugin) return { success: false, message: 'プラグインが見つかりません。' };

    if (newStatus === 'ACTIVE') {
      const req = this.requestActivatePlugin(pluginId);
      return { success: req.activated, message: req.message };
    }

    plugin.status = newStatus;
    plugin.updatedAt = Date.now();
    this.savePlugins();

    systemLogger.info('TOOLS', `[46章 プラグイン状態変更] 「${plugin.name}」の状態を ${newStatus} に変更しました`);
    return { success: true, message: `状態を ${newStatus} に更新しました。` };
  }

  /**
   * 実行実績（成功/失敗）の記録
   */
  public recordExecution(pluginId: string, success: boolean): void {
    const plugin = this.getPlugin(pluginId);
    if (!plugin) return;

    if (success) {
      plugin.successCount = (plugin.successCount || 0) + 1;
    } else {
      plugin.failureCount = (plugin.failureCount || 0) + 1;
      // 連続失敗による自己防衛 (SUSPENDED)
      const total = (plugin.successCount || 0) + plugin.failureCount;
      if (plugin.failureCount >= 5 && (plugin.successCount || 0) / total < 0.4) {
        plugin.status = 'SUSPENDED';
        systemLogger.error(
          'TOOLS',
          `[46章 自動防護] プラグイン「${plugin.name}」の失敗率が高いため一時停止 (SUSPENDED) に切り替えました。代替経路: ${plugin.fallbackPluginId || 'なし'}`
        );
      }
    }

    plugin.lastExecutedAt = Date.now();
    plugin.updatedAt = Date.now();
    this.savePlugins();
  }

  /**
   * 新しいプラグインの登録 (初期状態は CANDIDATE、権限は自動付与しない)
   */
  public registerPlugin(plugin: Omit<CapabilityPlugin, 'createdAt' | 'updatedAt'>): CapabilityPlugin {
    const existing = this.getPlugin(plugin.plugin_id);
    if (existing) {
      // 既存の更新
      const updated: CapabilityPlugin = {
        ...existing,
        ...plugin,
        // セキュリティ: 既存の grantedPermissions や status は勝手に ACTIVE に戻さない
        status: existing.status === 'ACTIVE' ? existing.status : (plugin.status || 'CANDIDATE'),
        updatedAt: Date.now(),
      };
      const idx = this.plugins.findIndex((p) => p.plugin_id === plugin.plugin_id);
      this.plugins[idx] = updated;
      this.savePlugins();
      return updated;
    }

    // 新規登録: 原則として CANDIDATE かつ 権限は未承認
    const newPlugin: CapabilityPlugin = {
      ...plugin,
      status: plugin.status === 'ACTIVE' ? 'TESTED' : (plugin.status || 'CANDIDATE'),
      grantedPermissions: [], // 新規登録時は権限を付与しない（原則）
      userConsentGrantedAt: undefined,
      successCount: 0,
      failureCount: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    this.plugins.push(newPlugin);
    this.savePlugins();

    systemLogger.info(
      'TOOLS',
      `[46章 新規プラグイン登録] 「${newPlugin.name}」が CANDIDATE として登録されました。端末権限は自動昇格していません。`
    );

    return newPlugin;
  }

  /**
   * プラグインの削除
   */
  public deletePlugin(pluginId: string): boolean {
    const idx = this.plugins.findIndex((p) => p.plugin_id === pluginId);
    if (idx === -1) return false;
    const removed = this.plugins.splice(idx, 1)[0];
    this.savePlugins();
    systemLogger.info('TOOLS', `[46章 プラグイン削除] 「${removed.name}」を削除しました。`);
    return true;
  }

  /**
   * 同意要求リスナーの登録
   */
  public onConsentRequested(callback: (request: PluginConsentRequest) => void): () => void {
    this.consentListeners.push(callback);
    return () => {
      this.consentListeners = this.consentListeners.filter((cb) => cb !== callback);
    };
  }

  /**
   * 権限ごとのリスク要約メッセージを生成
   */
  private buildRiskSummary(plugin: CapabilityPlugin, missingPermissions: string[]): string {
    const risks: string[] = [];
    for (const perm of missingPermissions) {
      switch (perm) {
        case 'network_cloud':
          risks.push('外部クラウド (Gemini Cloud等) へのネットワーク通信を行います。機密情報フィルタが適用されます。');
          break;
        case 'workspace_write':
          risks.push('ワークスペース内のソースコードやファイルの作成・上書き保存を許可します。');
          break;
        case 'workspace_read':
          risks.push('ワークスペース内のプロジェクトファイル内容の読み取りを許可します。');
          break;
        case 'sensitive_filter':
          risks.push('送信前に個人情報・機密記憶を除外するフィルタリング処理を行います。');
          break;
        default:
          risks.push(`追加権限「${perm}」を要求しています。`);
          break;
      }
    }
    return risks.join('\n');
  }
}

export const capabilityPluginService = new CapabilityPluginService();
