import { storageService } from './storageService';
export interface SystemLogEntry {
  id: string;
  timestamp: string;
  epoch: number;
  level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
  category:
    | 'WEBGPU'
    | 'NATIVE_GPU'
    | 'EXTERNAL_GPU'
    | 'INFERENCE'
    | 'NETWORK'
    | 'CACHE'
    | 'PERSISTENCE'
    | 'SERVER'
    | 'CHAT'
    | 'STEP'
    | 'SELF_IMPROVEMENT'
    | 'TOOLS'
    | 'ANSWER_PLAN'
    | 'CAPABILITY_GAP'
    | 'CODE_UNDERSTANDING'
    | 'FEATURE_FLAGS'
    | 'VBA_DESIGN_ASSISTANT'
    | 'VIRTUAL_TRAINING';
  message: string;
  details?: any;
  elapsedMs?: number;
  relativeDeltaMs?: number;
}

export interface StepExecutionSnapshot {
  stepNumber: number;
  totalSteps: number;
  title: string;
  category: string;
  timestamp: string;
  elapsedMs: number;
  relativeDeltaMs: number;
  status: 'pending' | 'active' | 'success' | 'warn' | 'error';
  details?: any;
}

class SystemLogger {
  private logs: SystemLogEntry[] = [];
  private maxLogs = 1000;
  private storageKey = 'miki_system_diagnostics_logs';
  private sessionStartTime: number = 0;
  private lastStepTimestamp: number = 0;
  private currentSessionSteps: StepExecutionSnapshot[] = [];

  constructor() {
    if (typeof window !== 'undefined') {
      try {
        const saved = storageService.getItem(this.storageKey);
        if (saved) {
          this.logs = JSON.parse(saved);
        }
      } catch {
        this.logs = [];
      }
    }
  }

  public startSession(): number {
    this.sessionStartTime = performance.now();
    this.lastStepTimestamp = this.sessionStartTime;
    this.currentSessionSteps = [];
    return this.sessionStartTime;
  }

  public getCurrentSessionSteps(): StepExecutionSnapshot[] {
    return [...this.currentSessionSteps];
  }

  public log(
    level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR',
    category: SystemLogEntry['category'],
    message: string,
    details?: any
  ) {
    const nowEpoch = Date.now();
    const nowPerf = performance.now();
    const elapsedMs = this.sessionStartTime > 0 ? Math.round(nowPerf - this.sessionStartTime) : undefined;
    const relativeDeltaMs = this.lastStepTimestamp > 0 ? Math.round(nowPerf - this.lastStepTimestamp) : undefined;
    this.lastStepTimestamp = nowPerf;

    const entry: SystemLogEntry = {
      id: 'log_' + nowEpoch + '_' + Math.random().toString(36).substring(2, 7),
      timestamp: new Date().toISOString(),
      epoch: nowEpoch,
      level,
      category,
      message,
      elapsedMs,
      relativeDeltaMs,
      details: details ? (typeof details === 'object' ? JSON.parse(JSON.stringify(details, this.getCircularReplacer())) : details) : undefined,
    };

    this.logs.push(entry);
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    if (typeof window !== 'undefined') {
      try {
        storageService.setItem(this.storageKey, JSON.stringify(this.logs.slice(-300)));
      } catch {}

      // Fire and forget server sync to persist in workspace log file
      this.syncToServer(entry).catch(() => {});
    }

    // Console output with elapsed time indicators
    const timingPrefix = elapsedMs !== undefined ? `[+${elapsedMs}ms]` : '';
    const formatted = `[${entry.timestamp}] ${timingPrefix} [${entry.level.padEnd(5)}] [${entry.category.padEnd(9)}] ${entry.message}`;
    if (level === 'ERROR') {
      console.error(formatted, details || '');
    } else if (level === 'WARN') {
      console.warn(formatted, details || '');
    } else {
      console.log(formatted, details || '');
    }
  }

  public step(
    stepNumber: number,
    totalSteps: number,
    title: string,
    details?: any,
    status: StepExecutionSnapshot['status'] = 'success'
  ): StepExecutionSnapshot {
    const nowPerf = performance.now();
    const elapsedMs = this.sessionStartTime > 0 ? Math.round(nowPerf - this.sessionStartTime) : 0;
    const relativeDeltaMs = this.lastStepTimestamp > 0 ? Math.round(nowPerf - this.lastStepTimestamp) : 0;
    
    const deltaStr = relativeDeltaMs > 0 ? ` (+${relativeDeltaMs}ms / 累計: ${elapsedMs}ms)` : ` (累計: ${elapsedMs}ms)`;
    const header = `▶ [工程 ${stepNumber}/${totalSteps}] ${title}${deltaStr}`;
    
    this.log('INFO', 'STEP', header, details);

    const stepSnapshot: StepExecutionSnapshot = {
      stepNumber,
      totalSteps,
      title,
      category: 'STEP',
      timestamp: new Date().toISOString(),
      elapsedMs,
      relativeDeltaMs,
      status,
      details,
    };

    this.currentSessionSteps.push(stepSnapshot);
    return stepSnapshot;
  }

  private getCircularReplacer() {
    const seen = new WeakSet();
    return (key: string, value: any) => {
      if (typeof value === 'object' && value !== null) {
        if (seen.has(value)) {
          return '[Circular]';
        }
        seen.add(value);
      }
      return value;
    };
  }

  private async syncToServer(entry: SystemLogEntry) {
    try {
      await fetch('/api/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entry),
      });
    } catch {}
  }

  public debug(category: SystemLogEntry['category'], message: string, details?: any) {
    this.log('DEBUG', category, message, details);
  }

  public info(category: SystemLogEntry['category'], message: string, details?: any) {
    this.log('INFO', category, message, details);
  }

  public warn(category: SystemLogEntry['category'], message: string, details?: any) {
    this.log('WARN', category, message, details);
  }

  public error(category: SystemLogEntry['category'], message: string, details?: any) {
    this.log('ERROR', category, message, details);
  }

  public getLogs(): SystemLogEntry[] {
    return [...this.logs];
  }

  public clearLogs() {
    this.logs = [];
    if (typeof window !== 'undefined') {
      storageService.removeItem(this.storageKey);
    }
  }

  public exportAsFormattedText(): string {
    return this.logs
      .map((l) => {
        const timingStr = l.elapsedMs !== undefined ? `[+${String(l.elapsedMs).padStart(5, ' ')}ms | Δ${String(l.relativeDeltaMs ?? 0).padStart(4, ' ')}ms] ` : '';
        return `[${l.timestamp}] ${timingStr}[${l.level.padEnd(5)}] [${l.category.padEnd(9)}] ${l.message}${
          l.details ? '\n  詳細データ: ' + (typeof l.details === 'string' ? l.details : JSON.stringify(l.details, null, 2)) : ''
        }`;
      })
      .join('\n');
  }

  public getFormattedLogs(): string {
    return this.exportAsFormattedText();
  }

  /**
   * Generates a comprehensive, human-readable diagnostic text report
   * including hardware, storage, WebGPU, and execution trace for sharing or debugging.
   */
  public async generateFullDiagnosticReport(additionalContext?: {
    engineMode?: string;
    targetModel?: string;
    lastError?: string;
  }): Promise<string> {
    const now = new Date().toISOString();
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown';
    const ram = typeof navigator !== 'undefined' && 'deviceMemory' in navigator ? `${(navigator as any).deviceMemory} GB` : '不明 (ブラウザ制限)';
    const cores = typeof navigator !== 'undefined' ? `${navigator.hardwareConcurrency || '不明'} コア` : '不明';

    // Network Information
    let networkStr = '不明';
    if (typeof navigator !== 'undefined') {
      const conn = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
      const isOnline = navigator.onLine !== undefined ? (navigator.onLine ? 'オンライン 🟢' : 'オフライン 🔴') : '不明';
      if (conn) {
        networkStr = `${isOnline} | 接続タイプ: ${conn.effectiveType || conn.type || '不明'} | 下り帯域目安: ${conn.downlink ? conn.downlink + ' Mbps' : '不明'} | RTT遅延: ${conn.rtt ? conn.rtt + ' ms' : '不明'}`;
      } else {
        networkStr = isOnline;
      }
    }

    // JS Heap Memory (Chromium/Android Chrome)
    let jsHeapStr = 'ブラウザ非開示';
    if (typeof performance !== 'undefined' && (performance as any).memory) {
      const mem = (performance as any).memory;
      const usedMB = Math.round(mem.usedJSHeapSize / (1024 * 1024));
      const totalMB = Math.round(mem.totalJSHeapSize / (1024 * 1024));
      const limitMB = Math.round(mem.jsHeapSizeLimit / (1024 * 1024));
      jsHeapStr = `JSヒープ使用: ${usedMB} MB / 割当: ${totalMB} MB (上限: ${limitMB} MB)`;
    }

    // Storage estimate
    let storageStr = '取得不可';
    if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.estimate) {
      try {
        const est = await navigator.storage.estimate();
        const usedMB = Math.round((est.usage || 0) / (1024 * 1024));
        const quotaMB = Math.round((est.quota || 0) / (1024 * 1024));
        const pct = quotaMB > 0 ? ((usedMB / quotaMB) * 100).toFixed(1) : '0';
        storageStr = `使用中: ${usedMB} MB / 上限: ${quotaMB} MB (${pct}%)`;
      } catch (e: any) {
        storageStr = `エラー: ${e.message}`;
      }
    }

    // WebGPU Hardware check
    let webgpuStr = '非対応または未検出';
    let adapterInfoStr = 'なし';
    let webgpuLimitsStr = 'なし';
    if (typeof navigator !== 'undefined' && (navigator as any).gpu) {
      try {
        const adapter = await (navigator as any).gpu.requestAdapter();
        if (adapter) {
          webgpuStr = '対応 (WebGPU有効)';
          adapterInfoStr = `Renderer/Description: ${adapter.info?.description || adapter.info?.device || 'Generic'} | Vendor: ${adapter.info?.vendor || 'Unknown'} | Architecture: ${adapter.info?.architecture || 'Unknown'}`;
          if (adapter.limits) {
            webgpuLimitsStr = `maxBufferSize: ${Math.round(adapter.limits.maxBufferSize / (1024 * 1024))}MB | maxStorageBufferBindingSize: ${Math.round(adapter.limits.maxStorageBufferBindingSize / (1024 * 1024))}MB | maxComputeWorkgroupStorageSize: ${Math.round(adapter.limits.maxComputeWorkgroupStorageSize / 1024)}KB | maxComputeInvocationsPerWorkgroup: ${adapter.limits.maxComputeInvocationsPerWorkgroup}`;
          }
        } else {
          webgpuStr = 'アダプタ取得失敗 (GPU初期化拒否または制限)';
        }
      } catch (e: any) {
        webgpuStr = `例外発生: ${e.message}`;
      }
    }

    // Cached model flags from localStorage
    const cachedFlags: string[] = [];
    const ggufFiles: string[] = [];
    let activeGgufModel = 'なし';
    if (typeof storageService !== 'undefined') {
      for (let i = 0; i < storageService.length; i++) {
        const k = storageService.key(i);
        if (k && k.startsWith('miki_cached_model_')) {
          cachedFlags.push(k.replace('miki_cached_model_', ''));
        }
      }
      try {
        const rawGguf = storageService.getItem('miki_downloaded_gguf_files');
        if (rawGguf) {
          const list = JSON.parse(rawGguf);
          if (Array.isArray(list)) {
            ggufFiles.push(...list.map((f: any) => `${f.fileName || f.id} (${f.sizeMB || '?'}MB)`));
          }
        }
        activeGgufModel = storageService.getItem('miki_active_gguf_model') || 'なし';
      } catch (e) {}
    }

    const reportHeader = `================================================================================
🌸 MIKI-AI Game Studio システム診断レポート & GPULLM工程ログ
出力日時: ${now}
================================================================================

【1. 端末 & 実行環境スペック】
- ユーザーエージェント : ${ua}
- 認識メモリ (RAM)    : ${ram}
- CPU コア数          : ${cores}
- 通信環境ステータス  : ${networkStr}
- JavaScriptヒープ    : ${jsHeapStr}
- ブラウザ保存容量    : ${storageStr}
- WebGPU 対応状況     : ${webgpuStr}
- GPU アダプタ情報    : ${adapterInfoStr}
- GPU 制限・バッファ  : ${webgpuLimitsStr}
- 現在の推論モード    : ${additionalContext?.engineMode || 'webgpu'}
- 対象ローカルモデル  : ${additionalContext?.targetModel || '未定'}
- WebGPUキャッシュ済み: ${cachedFlags.length > 0 ? cachedFlags.join(', ') : 'なし (未ダウンロード)'}
- GGUF端末保存済み    : ${ggufFiles.length > 0 ? ggufFiles.join(', ') : 'なし (未ダウンロード)'}
- GGUFアクティブモデル: ${activeGgufModel}

================================================================================
【2. GPULLM (WebGPUローカルLLM) から返事が返ってこない主な理由と対策】
--------------------------------------------------------------------------------
Q. なぜチャット送信後にGPUから返事が来ない、またはCPUルールベースに切り替わるのか？

①【モデルが端末にダウンロードされていない】
   - WebGPUで動かすには、モデル重み（例: Qwen 0.5B: 380MB, SmolLM2: 220MB）が端末に保存されている必要があります。
   - 対策: 「端末ローカルLLM設定」を開き、モデルの「ダウンロード」ボタンを押して100%完了させてください。

②【初回VRAMロードまたはダウンロード中のタイムアウト】
   - モデルをGPUのVRAM（ビデオメモリ）に展開するのに端末によっては10〜30秒かかります。
   - 対策: 「端末ローカルLLM設定」で一度「ロード」または「テスト推論」を実行しておくと即時応答します。

③【ブラウザのWebGPU制限 / スマホWebView制約】
   - 一部のスマホ内蔵ブラウザや古いWebViewではWebGPUが無効化されています。
   - 対策: 最新のChrome/Edgeブラウザで開くか、超軽量SmolLM2-360M（220MB）をご利用ください。

④【VRAM不足・GPUBuffer Device Lost エラー】
   - スマホのGPUメモリが上限に達すると、ブラウザがクラッシュ防止のためGPU処理を中断します。
   - 対策: 重い7Bモデルではなく、スマホ最適な「Qwen 2.5 Coder 0.5B (380MB)」をご使用ください。

⑤【ストレージ保存容量上限 (QuotaExceededError)】
   - ブラウザの一時保存容量上限に達していると重みファイルの保存に失敗します。
   - 対策: 「端末ローカルLLM設定」の「全キャッシュ消去」を行い、必要な1モデルのみダウンロードしてください。

⑥【別モデル切替時の並行ダウンロード競合 / Hugging Face通信エラー】
   - 別のモデルに切り替える際、前のモデルの通信が残ったまま新しいモデルを取得しようとすると、IndexedDBへの並行書き込み競合（ConstraintError）やFetchエラーが発生します。
   - 対策: 自動排他制御（Mutex）により前モデルを安全に解放してから新モデルのダウンロード・ロードを実行します。また、回線が途切れた場合は「再ダウンロード」で続きから再開できます。

================================================================================
【3. チャット送信・推論実行 ステップバイステップ工程ログ】
--------------------------------------------------------------------------------
${this.exportAsFormattedText()}

================================================================================
【4. 診断完了 & サポート共有用フッター】
このファイルをそのまま開発者やサポートに共有することで、正確な原因特定が可能です。
================================================================================
`;
    return reportHeader;
  }

  /**
   * Helper to trigger a direct .txt file download in the browser
   */
  public async downloadDiagnosticsTxtFile(additionalContext?: {
    engineMode?: string;
    targetModel?: string;
    lastError?: string;
  }) {
    const reportText = await this.generateFullDiagnosticReport(additionalContext);
    const blob = new Blob([reportText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    a.href = url;
    a.download = `miki_ai_gpu_diagnostics_${timestamp}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}

export const systemLogger = new SystemLogger();

