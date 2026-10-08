import { storageService } from './storageService';

interface RuntimeLogFilePlugin {
  ensureRuntimeLogFile(options?: { filename?: string }): Promise<void>;
  appendRuntimeLog(options: { filename?: string; line: string }): Promise<void>;
}

const RUNTIME_LOG_FILE_NAME = 'MIKI_RUNTIME_LOG.txt';
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
    | 'VIRTUAL_TRAINING'
    | 'TASK_PLAN'
    | 'STATE_EXTRACTION'
    | 'RESOURCE_GOVERNANCE'
    | 'PERCEPTION'
    | 'PRIVACY'
    | 'SYSTEM';
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

export interface RuntimeMemorySample {
  timestamp: number;
  visibility: string;
  usedJSHeapMB?: number;
  totalJSHeapMB?: number;
  jsHeapLimitMB?: number;
  jsHeapUsageRatio?: number;
  deviceMemoryGB?: number;
  hardwareConcurrency?: number;
  pressure: 'NORMAL' | 'ELEVATED' | 'NEAR_LIMIT' | 'UNAVAILABLE';
}

interface RuntimeMemoryDiagnosticsState {
  version: 1;
  sessionId: string;
  state: 'RUNNING' | 'SHUTTING_DOWN';
  startedAt: number;
  lastHeartbeatAt: number;
  lastSample?: RuntimeMemorySample;
  previousSessionGap?: {
    detectedAt: number;
    previousSessionId: string;
    previousLastHeartbeatAt: number;
    gapMs: number;
    reason: 'PROCESS_GAP_WITHOUT_CLEAN_SHUTDOWN';
  };
  samples: RuntimeMemorySample[];
}

class SystemLogger {
  private logs: SystemLogEntry[] = [];
  private maxLogs = 1000;
  private storageKey = 'miki_system_diagnostics_logs';
  private sessionStartTime: number = 0;
  private lastStepTimestamp: number = 0;
  private currentSessionSteps: StepExecutionSnapshot[] = [];
  private logListeners: Set<(entry: SystemLogEntry) => void> = new Set();
  private stepListeners: Set<(step: StepExecutionSnapshot, allSteps: StepExecutionSnapshot[]) => void> = new Set();
  private runtimeMemoryTimer: ReturnType<typeof setInterval> | null = null;
  private runtimeMemoryInitialized = false;
  private runtimeMemoryVisibilityHandler: (() => void) | null = null;
  private readonly runtimeMemoryStorageKey = 'miki_runtime_memory_diagnostics_v1';
  private runtimeLogFileInitialized = false;
  private runtimeLogFileInitPromise: Promise<boolean> | null = null;
  private runtimeLogFilePlugin: RuntimeLogFilePlugin | null = null;
  private runtimeLogFileQueue = Promise.resolve();

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

  /**
   * Android の Downloads に固定名のランタイムログを確保する。
   * ログ本体はこの SystemLogger のまま維持し、Downloads は永続的な搬送先に限定する。
   * ネイティブ側が利用できない場合も起動をブロックしない。
   */
  public initializeRuntimeLogFile(): Promise<boolean> {
    if (typeof window === 'undefined') {
      return Promise.resolve(false);
    }
    if (this.runtimeLogFileInitPromise) {
      return this.runtimeLogFileInitPromise;
    }

    this.runtimeLogFileInitPromise = (async () => {
      const { Capacitor, registerPlugin } = await import('@capacitor/core');
      if (!Capacitor.isNativePlatform()) {
        return false;
      }
      this.runtimeLogFilePlugin ??= registerPlugin<RuntimeLogFilePlugin>('MIKINativeRunner');
      await this.runtimeLogFilePlugin.ensureRuntimeLogFile({ filename: RUNTIME_LOG_FILE_NAME });
      return true;
    })()
      .then((ready) => {
        this.runtimeLogFileInitialized = ready;
        return ready;
      })
      .catch((error) => {
        this.runtimeLogFileInitialized = false;
        this.runtimeLogFileInitPromise = null;
        console.warn('[SystemLogger] runtime log file unavailable', error);
        return false;
      });

    return this.runtimeLogFileInitPromise;
  }

  private queueRuntimeLogFile(entry: SystemLogEntry): void {
    if (typeof window === 'undefined') {
      return;
    }

    const timingStr =
      entry.elapsedMs !== undefined
        ? `[+${String(entry.elapsedMs).padStart(5, ' ')}ms | Δ${String(entry.relativeDeltaMs ?? 0).padStart(4, ' ')}ms] `
        : '';
    const details =
      entry.details !== undefined
        ? `\n  詳細データ: ${typeof entry.details === 'string' ? entry.details : JSON.stringify(entry.details, null, 2)}`
        : '';
    const line = `[${entry.timestamp}] ${timingStr}[${entry.level.padEnd(5)}] [${entry.category.padEnd(18)}] ${entry.message}${details}\n`;

    this.runtimeLogFileQueue = this.runtimeLogFileQueue
      .catch(() => undefined)
      .then(async () => {
        const ready = await this.initializeRuntimeLogFile();
        if (!ready || !this.runtimeLogFileInitialized) {
          return;
        }
        try {
          if (!this.runtimeLogFilePlugin) {
            return;
          }
          await this.runtimeLogFilePlugin.appendRuntimeLog({
            filename: RUNTIME_LOG_FILE_NAME,
            line,
          });
        } catch (error) {
          console.warn('[SystemLogger] runtime log append failed', error);
        }
      });
  }

  /**
   * Android/WebView resource diagnostics.
   *
   * This deliberately records evidence rather than declaring that an Android
   * process was killed by OOM. JS heap metrics are available only on runtimes
   * that expose performance.memory. A missing metric is reported as
   * UNAVAILABLE, never guessed.
   */
  public initializeRuntimeMemoryDiagnostics(): void {
    if (this.runtimeMemoryInitialized || typeof window === 'undefined') return;
    this.runtimeMemoryInitialized = true;

    const now = Date.now();
    const sessionId = `RMS-${now}-${Math.random().toString(36).slice(2, 8)}`;
    const previousRaw = storageService.getItem(this.runtimeMemoryStorageKey);

    let previous: RuntimeMemoryDiagnosticsState | undefined;
    try {
      if (previousRaw) {
        const parsed = JSON.parse(previousRaw);
        if (parsed && parsed.version === 1) previous = parsed;
      }
    } catch {}

    const state: RuntimeMemoryDiagnosticsState = {
      version: 1,
      sessionId,
      state: 'RUNNING',
      startedAt: now,
      lastHeartbeatAt: now,
      samples: [],
    };

    if (
      previous &&
      previous.state === 'RUNNING' &&
      previous.lastHeartbeatAt > 0 &&
      now >= previous.lastHeartbeatAt
    ) {
      state.previousSessionGap = {
        detectedAt: now,
        previousSessionId: previous.sessionId,
        previousLastHeartbeatAt: previous.lastHeartbeatAt,
        gapMs: now - previous.lastHeartbeatAt,
        reason: 'PROCESS_GAP_WITHOUT_CLEAN_SHUTDOWN',
      };
    }

    const persist = async () => {
      state.lastHeartbeatAt = Date.now();
      state.lastSample = this.collectRuntimeMemorySample();
      state.samples = [...state.samples, state.lastSample].slice(-120);
      try {
        storageService.setItem(this.runtimeMemoryStorageKey, JSON.stringify(state));
        await storageService.flushNow();
      } catch {}
    };

    void persist();

    this.runtimeMemoryTimer = setInterval(() => {
      void persist();
    }, 10000);

    this.runtimeMemoryVisibilityHandler = () => {
      void persist();
    };
    document.addEventListener('visibilitychange', this.runtimeMemoryVisibilityHandler);

    window.addEventListener('pagehide', () => {
      state.state = 'SHUTTING_DOWN';
      state.lastHeartbeatAt = Date.now();
      state.lastSample = this.collectRuntimeMemorySample();
      state.samples = [...state.samples, state.lastSample].slice(-120);
      try {
        storageService.setItem(this.runtimeMemoryStorageKey, JSON.stringify(state));
        void storageService.flushNow();
      } catch {}
    }, { once: true });

    this.info('SYSTEM', '[Runtime Memory Diagnostics] started', {
      sessionId,
      previousProcessGapDetected: Boolean(state.previousSessionGap),
      previousProcessGapMs: state.previousSessionGap?.gapMs ?? null,
      initialMemory: state.lastSample ?? null,
    });
  }

  private collectRuntimeMemorySample(): RuntimeMemorySample {
    const now = Date.now();
    const perfMemory =
      typeof performance !== 'undefined'
        ? (performance as any).memory
        : undefined;

    const usedJSHeapMB =
      perfMemory && Number.isFinite(perfMemory.usedJSHeapSize)
        ? Number((perfMemory.usedJSHeapSize / (1024 * 1024)).toFixed(1))
        : undefined;

    const totalJSHeapMB =
      perfMemory && Number.isFinite(perfMemory.totalJSHeapSize)
        ? Number((perfMemory.totalJSHeapSize / (1024 * 1024)).toFixed(1))
        : undefined;

    const jsHeapLimitMB =
      perfMemory && Number.isFinite(perfMemory.jsHeapSizeLimit)
        ? Number((perfMemory.jsHeapSizeLimit / (1024 * 1024)).toFixed(1))
        : undefined;

    const jsHeapUsageRatio =
      usedJSHeapMB !== undefined &&
      jsHeapLimitMB !== undefined &&
      jsHeapLimitMB > 0
        ? Number((usedJSHeapMB / jsHeapLimitMB).toFixed(4))
        : undefined;

    let pressure: RuntimeMemorySample['pressure'] = 'UNAVAILABLE';
    if (jsHeapUsageRatio !== undefined) {
      pressure =
        jsHeapUsageRatio >= 0.85
          ? 'NEAR_LIMIT'
          : jsHeapUsageRatio >= 0.70
            ? 'ELEVATED'
            : 'NORMAL';
    }

    return {
      timestamp: now,
      visibility:
        typeof document !== 'undefined'
          ? document.visibilityState
          : 'unknown',
      usedJSHeapMB,
      totalJSHeapMB,
      jsHeapLimitMB,
      jsHeapUsageRatio,
      deviceMemoryGB:
        typeof navigator !== 'undefined' &&
        Number.isFinite((navigator as any).deviceMemory)
          ? Number((navigator as any).deviceMemory)
          : undefined,
      hardwareConcurrency:
        typeof navigator !== 'undefined'
          ? navigator.hardwareConcurrency || undefined
          : undefined,
      pressure,
    };
  }

  public getRuntimeMemoryDiagnostics(): {
    current: RuntimeMemorySample;
    previousProcessGapDetected: boolean;
    previousProcessGapMs?: number;
    previousSessionId?: string;
    recentSamples: RuntimeMemorySample[];
  } {
    const current = this.collectRuntimeMemorySample();
    let saved: RuntimeMemoryDiagnosticsState | undefined;

    try {
      const raw = storageService.getItem(this.runtimeMemoryStorageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.version === 1) saved = parsed;
      }
    } catch {}

    return {
      current,
      previousProcessGapDetected: Boolean(saved?.previousSessionGap),
      previousProcessGapMs: saved?.previousSessionGap?.gapMs,
      previousSessionId: saved?.previousSessionGap?.previousSessionId,
      recentSamples: Array.isArray(saved?.samples)
        ? saved!.samples.slice(-20)
        : [],
    };
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

    this.queueRuntimeLogFile(entry);

    if (typeof window !== 'undefined') {
      try {
        storageService.setItem(this.storageKey, JSON.stringify(this.logs.slice(-300)));
      } catch {}

      // Fire and forget server sync to persist in workspace log file
      this.syncToServer(entry).catch(() => {});
    }

    // Notify real-time listeners asynchronously to prevent React cross-component update errors
    if (this.logListeners.size > 0) {
      setTimeout(() => {
        this.logListeners.forEach((listener) => {
          try {
            listener(entry);
          } catch (err) {
            console.warn('SystemLogger listener error:', err);
          }
        });
      }, 0);
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

    // Notify real-time step listeners asynchronously to prevent React cross-component update errors
    if (this.stepListeners.size > 0) {
      setTimeout(() => {
        this.stepListeners.forEach((listener) => {
          try {
            listener(stepSnapshot, [...this.currentSessionSteps]);
          } catch (err) {
            console.warn('SystemLogger stepListener error:', err);
          }
        });
      }, 0);
    }

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
      // api.ts の apiUrl() と同じロジック。ここで api.ts から import すると
      // api.ts -> systemLogger.ts -> api.ts の循環参照になるため、
      // 同じ 'miki_api_base_url' を直接参照する軽量版をここに持つ。
      // (APKなど server.ts が同一オリジンに存在しないビルドで、この
      //  POSTがSPAのindex.htmlフォールバックに吸い込まれるのを防ぐ)
      const base = (storageService.getItem('miki_api_base_url') || '').trim().replace(/\/+$/, '');
      const url = base ? `${base}/api/logs` : '/api/logs';
      await fetch(url, {
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

  /**
   * リアルタイムログ購読 (UIが今何をしているかをリアルタイム監視するためのPub/Sub)
   */
  public subscribeLog(listener: (entry: SystemLogEntry) => void): () => void {
    this.logListeners.add(listener);
    return () => {
      this.logListeners.delete(listener);
    };
  }

  /**
   * リアルタイム推論工程・自律改善ステップ購読
   */
  public subscribeStep(
    listener: (step: StepExecutionSnapshot, allSteps: StepExecutionSnapshot[]) => void
  ): () => void {
    this.stepListeners.add(listener);
    return () => {
      this.stepListeners.delete(listener);
    };
  }

  public clearLogs() {
    this.logs = [];
    if (typeof window !== 'undefined') {
      storageService.removeItem(this.storageKey);
    }
  }

  /**
   * 診断ログ、推論ステップ履歴、セッションタイマーを全初期化
   */
  public resetAllDiagnostics() {
    this.logs = [];
    this.currentSessionSteps = [];
    this.sessionStartTime = 0;
    this.lastStepTimestamp = 0;
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

    const runtimeMemoryDiagnostics = this.getRuntimeMemoryDiagnostics();
    const runtimeCurrent = runtimeMemoryDiagnostics.current;
    const runtimeMemoryStr =
      runtimeCurrent.usedJSHeapMB !== undefined &&
      runtimeCurrent.jsHeapLimitMB !== undefined
        ? `${runtimeCurrent.usedJSHeapMB} MB / ${runtimeCurrent.jsHeapLimitMB} MB (${Math.round((runtimeCurrent.jsHeapUsageRatio || 0) * 100)}%, ${runtimeCurrent.pressure})`
        : 'JS Heap計測API非公開 (判定不能)';

    const previousProcessGapStr =
      runtimeMemoryDiagnostics.previousProcessGapDetected
        ? `検出あり / 直前Heartbeatから ${Math.round((runtimeMemoryDiagnostics.previousProcessGapMs || 0) / 1000)} 秒`
        : '検出なし';

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
- 実行中メモリ監視    : ${runtimeMemoryStr}
- 前回プロセス断絶    : ${previousProcessGapStr}
- ブラウザ保存容量    : ${storageStr}
- WebGPU 対応状況     : ${webgpuStr}
- GPU アダプタ情報    : ${adapterInfoStr}
- GPU 制限・バッファ  : ${webgpuLimitsStr}
- 現在の推論モード    : ${additionalContext?.engineMode || 'autonomous_rule'}
- 対象ローカルモデル  : ${additionalContext?.targetModel || '未定'}
- WebGPUキャッシュ済み: ${cachedFlags.length > 0 ? cachedFlags.join(', ') : 'なし (未ダウンロード)'}
- GGUF端末保存済み    : ${ggufFiles.length > 0 ? ggufFiles.join(', ') : 'なし (未ダウンロード)'}
- GGUFアクティブモデル: ${activeGgufModel}

================================================================================
【2. メモリ・プロセス終了の診断】
--------------------------------------------------------------------------------
- JS Heap使用率は実行中に10秒間隔で保存されます。
- 70%以上はELEVATED、85%以上はNEAR_LIMITとして記録します。
- 前回セッションがRUNNINGのまま再起動された場合はPROCESS_GAP_WITHOUT_CLEAN_SHUTDOWNとして記録します。
- PROCESS_GAPはAndroid OOMの確定証拠ではありません。クラッシュ、強制終了、OSによるプロセス回収、その他の異常終了を含む「正常終了なし」の証拠です。
- performance.memoryがWebViewから公開されない場合、メモリ不足とは判定せず「判定不能」とします。
- Android OS全体のRAM使用量はWebView JavaScript APIだけでは直接取得できません。

================================================================================
【3. GPULLM (WebGPU旧ローカル生成ランタイム) から返事が返ってこない主な理由と対策】
--------------------------------------------------------------------------------
Q. なぜチャット送信後にGPUから返事が来ない、またはCPUルールベースに切り替わるのか？

①【モデルが端末にダウンロードされていない】
   - WebGPUで動かすには、モデル重み（例: 旧生成モデル）が端末に保存されている必要があります。
   - 対策: 「Non-LLM Core設定」を開き、モデルの「ダウンロード」ボタンを押して100%完了させてください。

②【初回VRAMロードまたはダウンロード中のタイムアウト】
   - モデルをGPUのVRAM（ビデオメモリ）に展開するのに端末によっては10〜30秒かかります。
   - 対策: 「Non-LLM Core設定」で一度「ロード」または「テスト推論」を実行しておくと即時応答します。

③【ブラウザのWebGPU制限 / スマホWebView制約】
   - 一部のスマホ内蔵ブラウザや古いWebViewではWebGPUが無効化されています。
   - 対策: 最新のChrome/Edgeブラウザで開くか、超軽量旧生成モデル-360M（220MB）をご利用ください。

④【VRAM不足・GPUBuffer Device Lost エラー】
   - スマホのGPUメモリが上限に達すると、ブラウザがクラッシュ防止のためGPU処理を中断します。
   - 対策: 重い7Bモデルではなく、スマホ最適な「旧生成モデル 0.5B (380MB)」をご使用ください。

⑤【ストレージ保存容量上限 (QuotaExceededError)】
   - ブラウザの一時保存容量上限に達していると重みファイルの保存に失敗します。
   - 対策: 「Non-LLM Core設定」の「全キャッシュ消去」を行い、必要な1モデルのみダウンロードしてください。

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

