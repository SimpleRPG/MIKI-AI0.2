package com.miki.ai

import android.content.Context
import android.os.BatteryManager
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.PowerManager
import android.util.Log
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.work.Constraints
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.NetworkType
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkInfo
import androidx.work.WorkManager
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import org.json.JSONObject
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean

/**
 * MikiWorkManagerPlugin
 *
 * Capacitorブリッジプラグイン:
 * JavaScript (backgroundWorkerService.ts) から WorkManager の定期登録・解除・状態取得を行う。
 *
 * 提供メソッド:
 * - schedule(intervalMinutes, constraints): 定期自律成長サイクルの予約
 * - cancel(): 登録中のWorkManagerジョブのキャンセル
 * - getStatus(): 現在の登録状況・ジョブステータス・ハードウェア条件の取得
 */
@CapacitorPlugin(name = "MikiWorkManagerPlugin")
class MikiWorkManagerPlugin : Plugin() {

    companion object {
        private const val TAG = "MikiWorkManagerPlugin"

        @Volatile
        var activeInstance: MikiWorkManagerPlugin? = null

        // 指示1: ヘッドレスWebView排他制御用フラグ (複数タブ/多重起動の禁止・順次処理)
        private val isFetchingPage = AtomicBoolean(false)
    }

    @Volatile
    private var activeAutonomousCycleId: String? = null

    override fun load() {
        super.load()
        activeInstance = this
        Log.i(TAG, "MikiWorkManagerPlugin loaded and activeInstance bound.")
    }

    override fun handleOnDestroy() {
        if (activeInstance == this) {
            activeInstance = null
        }
        // The Activity/WebView is going away, so its in-process JS executor cannot remain active.
        activeAutonomousCycleId = null
        super.handleOnDestroy()
    }

    /** True only while the canonical Capacitor WebView runtime is attached. */
    fun hasActiveWebRuntime(): Boolean = activity != null && bridge?.webView != null

    /** Worker trigger with a stable ID; only a matching completed JS Receipt counts as success. */
    fun triggerAutonomousCycle(cycleId: String, onComplete: (Boolean, String) -> Unit) {
        val target = bridge?.webView
        val host = activity
        if (target == null || host == null) {
            onComplete(false, "ACTIVE_WEB_RUNTIME_DETACHED")
            return
        }
        if (activeAutonomousCycleId != null) {
            onComplete(false, "AUTONOMOUS_CYCLE_ALREADY_ACTIVE:${activeAutonomousCycleId}")
            return
        }
        activeAutonomousCycleId = cycleId
        val delivered = AtomicBoolean(false)
        fun finish(success: Boolean, detail: String) {
            if (!delivered.compareAndSet(false, true)) return
            if (activeAutonomousCycleId == cycleId) activeAutonomousCycleId = null
            Log.i(TAG, "Autonomous cycle Receipt [$cycleId]: success=$success detail=${detail.take(500)}")
            host.runOnUiThread {
                try { target.removeJavascriptInterface("MikiNativeCallback") } catch (_: Exception) {}
            }
            onComplete(success, detail)
        }
        host.runOnUiThread {
            try {
                target.addJavascriptInterface(
                    MikiAutonomousCycleCallback(cycleId) { success, detail -> finish(success, detail) },
                    "MikiNativeCallback"
                )
                val script = """
                    (function() {
                        if (typeof window.mikiRunBackgroundCycle !== 'function') return 'NOT_FOUND';
                        var cycleId = '${cycleId}';
                        Promise.resolve().then(function() {
                            return window.mikiRunBackgroundCycle('android_intent', cycleId);
                        }).then(function(log) {
                            var correlated = !!log && log.nativeCycleId === cycleId;
                            var success = correlated && log.status === 'completed';
                            var status = success ? 'completed' : 'failed';
                            var detail = JSON.stringify({status: log && log.status, id: log && log.id, cycleId: cycleId, reason: log && log.reason});
                            if (window.MikiNativeCallback) window.MikiNativeCallback.onComplete(cycleId, status, detail);
                        }).catch(function(err) {
                            if (window.MikiNativeCallback) window.MikiNativeCallback.onComplete(cycleId, 'failed', String(err && (err.stack || err.message) || err));
                        });
                        return 'STARTED';
                    })();
                """.trimIndent()
                target.evaluateJavascript(script) { evalResult ->
                    Log.i(TAG, "Bridge cycle trigger evaluation [$cycleId]: $evalResult")
                    if (evalResult?.contains("NOT_FOUND") == true) finish(false, "BACKGROUND_CYCLE_ENTRY_NOT_FOUND")
                }
            } catch (e: Exception) {
                Log.e(TAG, "Failed to invoke autonomous cycle: ${e.message}", e)
                finish(false, e.message ?: "NATIVE_TRIGGER_FAILED")
            }
        }
    }

    /** Ask the existing JS run to abort; never start a fallback executor while it may still be running. */
    fun cancelAutonomousCycle(cycleId: String) {
        if (activeAutonomousCycleId != cycleId) return
        val target = bridge?.webView
        val host = activity
        if (target == null || host == null) return
        host.runOnUiThread {
            try {
                target.evaluateJavascript(
                    "window.mikiCancelBackgroundCycle && window.mikiCancelBackgroundCycle('${cycleId}');",
                    null
                )
            } catch (e: Exception) {
                Log.w(TAG, "Failed to deliver cancellation request for $cycleId: ${e.message}")
            }
        }
    }

    /**
     * WorkManager への定期ジョブ登録
     */
    @PluginMethod
    fun schedule(call: PluginCall) {
        val intervalMinutes = call.getInt("intervalMinutes", 360)?.toLong() ?: 360L
        val requiresCharging = call.getBoolean("requiresCharging", true) ?: true
        val requiresDeviceIdle = call.getBoolean("requiresDeviceIdle", false) ?: false
        val requiresUnmeteredWifi = call.getBoolean("requiresUnmeteredWifi", false) ?: false
        val batteryNotLow = call.getBoolean("batteryNotLow", true) ?: true

        try {
            val constraintsBuilder = Constraints.Builder()
                .setRequiresCharging(requiresCharging)
                .setRequiresDeviceIdle(requiresDeviceIdle)
                .setRequiresBatteryNotLow(batteryNotLow)

            if (requiresUnmeteredWifi) {
                constraintsBuilder.setRequiredNetworkType(NetworkType.UNMETERED)
            } else {
                constraintsBuilder.setRequiredNetworkType(NetworkType.CONNECTED)
            }

            // Android WorkManager の PeriodicWorkRequest 最小間隔は 15 分
            val effectiveInterval = intervalMinutes.coerceAtLeast(15L)
            val flexInterval = (effectiveInterval / 4).coerceAtLeast(5L)

            val workRequest = PeriodicWorkRequestBuilder<MikiBackgroundWorker>(
                effectiveInterval, TimeUnit.MINUTES,
                flexInterval, TimeUnit.MINUTES
            )
                .setConstraints(constraintsBuilder.build())
                .addTag(MikiBackgroundWorker.WORK_TAG)
                .build()

            WorkManager.getInstance(context).enqueueUniquePeriodicWork(
                MikiBackgroundWorker.UNIQUE_WORK_NAME,
                ExistingPeriodicWorkPolicy.UPDATE,
                workRequest
            )

            Log.i(
                TAG,
                "Enqueued unique periodic work: ${MikiBackgroundWorker.UNIQUE_WORK_NAME}, interval: ${effectiveInterval}m, charging: $requiresCharging, unmeteredWifi: $requiresUnmeteredWifi"
            )

            val ret = JSObject()
            ret.put("success", true)
            ret.put("intervalMinutes", effectiveInterval)
            call.resolve(ret)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to schedule WorkManager task: ${e.message}", e)
            call.reject("Failed to schedule WorkManager task: ${e.message}", e)
        }
    }

    /**
     * 登録中定期ジョブのキャンセル
     */
    @PluginMethod
    fun cancel(call: PluginCall) {
        try {
            WorkManager.getInstance(context).cancelUniqueWork(MikiBackgroundWorker.UNIQUE_WORK_NAME)
            Log.i(TAG, "Cancelled unique periodic work: ${MikiBackgroundWorker.UNIQUE_WORK_NAME}")
            val ret = JSObject()
            ret.put("success", true)
            call.resolve(ret)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to cancel WorkManager task: ${e.message}", e)
            call.reject("Failed to cancel WorkManager task: ${e.message}", e)
        }
    }

    /**
     * 現在のWorkManagerジョブ状況とハードウェア状態の取得
     */
    @PluginMethod
    fun getStatus(call: PluginCall) {
        try {
            val workInfos = WorkManager.getInstance(context)
                .getWorkInfosForUniqueWork(MikiBackgroundWorker.UNIQUE_WORK_NAME)
                .get()

            val ret = JSObject()
            if (workInfos.isNotEmpty()) {
                val info = workInfos[0]
                ret.put("registered", true)
                ret.put("state", info.state.name)
                ret.put("id", info.id.toString())
                ret.put("runAttemptCount", info.runAttemptCount)
            } else {
                ret.put("registered", false)
                ret.put("state", "NONE")
            }

            // ハードウェア情報
            val bm = context.getSystemService(Context.BATTERY_SERVICE) as? BatteryManager
            val batteryLevel = bm?.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY) ?: -1
            ret.put("batteryLevel", batteryLevel)
            ret.put("isWorkerExecuting", MikiBackgroundWorker.isWorkerExecuting)

            call.resolve(ret)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to get WorkManager status: ${e.message}", e)
            call.reject("Failed to get WorkManager status: ${e.message}", e)
        }
    }

    /**
     * 指示1: ヘッドレスWebViewによる外部ページの動的レンダリングとテキスト抽出
     * - URLを開いてレンダリング完了(onPageFinished + SPA猶予待機)を待つ
     * - document.body.innerText 相当のプレーンテキストを抽出して返す
     * - タイムアウト(既定10秒)制御
     * - 同時実行を排他制御(1件ずつ順次処理)し、終了後は必ずWebViewを即時破棄してメモリ/バッテリー解放
     */
    @PluginMethod
    fun fetchRenderedPage(call: PluginCall) {
        val url = call.getString("url")
        if (url.isNullOrBlank()) {
            call.reject("URL is required")
            return
        }

        val timeoutMs = call.getLong("timeoutMs") ?: 10000L
        val renderWaitMs = call.getLong("renderWaitMs") ?: 1500L

        // 排他制御: 複数タブ/WebViewの同時起動を防止し、1件ずつ順次処理
        if (!isFetchingPage.compareAndSet(false, true)) {
            call.reject("Another headless webview fetch is already in progress. Please retry sequentially.")
            return
        }

        val mainHandler = Handler(Looper.getMainLooper())
        var webView: WebView? = null
        var isCompleted = false
        val timeoutRunnable = Runnable {
            if (!isCompleted) {
                isCompleted = true
                Log.w(TAG, "fetchRenderedPage: Timeout reached ($timeoutMs ms) for $url")
                mainHandler.post {
                    try {
                        webView?.stopLoading()
                        webView?.destroy()
                    } catch (e: Exception) {
                        Log.w(TAG, "Error destroying webview on timeout: ${e.message}")
                    } finally {
                        webView = null
                        isFetchingPage.set(false)
                    }
                }
                call.reject("Timeout fetching rendered page ($timeoutMs ms): $url")
            }
        }

        // タイムアウト監視をスケジュール (10秒)
        mainHandler.postDelayed(timeoutRunnable, timeoutMs)

        mainHandler.post {
            try {
                Log.i(TAG, "fetchRenderedPage: Creating headless WebView for $url")
                val ctx = context ?: run {
                    mainHandler.removeCallbacks(timeoutRunnable)
                    isFetchingPage.set(false)
                    call.reject("Context is null")
                    return@post
                }

                val wv = WebView(ctx)
                webView = wv
                val settings = wv.settings
                settings.javaScriptEnabled = true
                settings.domStorageEnabled = true
                settings.databaseEnabled = false
                settings.allowFileAccess = false
                // 一般的なモバイルブラウザのUser-Agentを設定 (ボット判定回避)
                settings.userAgentString = "Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36 MikiBrowser/1.0"

                var pageFinishedFired = false

                wv.webViewClient = object : WebViewClient() {
                    override fun onPageFinished(view: WebView?, loadedUrl: String?) {
                        super.onPageFinished(view, loadedUrl)
                        if (pageFinishedFired || isCompleted) return
                        pageFinishedFired = true

                        Log.i(TAG, "fetchRenderedPage: onPageFinished fired for $loadedUrl. Waiting ${renderWaitMs}ms for SPA DOM render...")

                        // SPA/JS描画のための猶予待機 (1〜2秒)
                        mainHandler.postDelayed({
                            if (isCompleted) return@postDelayed

                            val extractScript = """
                                (function() {
                                    try {
                                        var body = document.body;
                                        if (!body) return document.documentElement ? document.documentElement.innerText : '';
                                        return body.innerText || body.textContent || '';
                                    } catch(e) {
                                        return '';
                                    }
                                })();
                            """.trimIndent()

                            wv.evaluateJavascript(extractScript) { rawResult ->
                                if (isCompleted) return@evaluateJavascript
                                isCompleted = true
                                mainHandler.removeCallbacks(timeoutRunnable)

                                try {
                                    val text = if (rawResult != null && rawResult != "null") {
                                        try {
                                            JSONObject("{\"text\":$rawResult}").getString("text")
                                        } catch (je: Exception) {
                                            if (rawResult.startsWith("\"") && rawResult.endsWith("\"") && rawResult.length >= 2) {
                                                rawResult.substring(1, rawResult.length - 1)
                                                    .replace("\\n", "\n")
                                                    .replace("\\t", "\t")
                                                    .replace("\\\"", "\"")
                                                    .replace("\\\\", "\\")
                                            } else {
                                                rawResult
                                            }
                                        }
                                    } else {
                                        ""
                                    }

                                    Log.i(TAG, "fetchRenderedPage: Extracted text (${text.length} chars) from $loadedUrl")
                                    val ret = JSObject()
                                    ret.put("success", true)
                                    ret.put("text", text.trim())
                                    ret.put("url", loadedUrl ?: url)
                                    ret.put("length", text.trim().length)
                                    call.resolve(ret)
                                } catch (e: Exception) {
                                    Log.e(TAG, "fetchRenderedPage: Error parsing evaluateJavascript result: ${e.message}", e)
                                    call.reject("Error parsing DOM text: ${e.message}")
                                } finally {
                                    // 処理後は必ずWebViewを破棄してメモリ・バッテリーを即時解放
                                    try {
                                        wv.stopLoading()
                                        wv.destroy()
                                    } catch (e: Exception) {
                                        Log.w(TAG, "Error destroying webview: ${e.message}")
                                    }
                                    webView = null
                                    isFetchingPage.set(false)
                                }
                            }
                        }, renderWaitMs)
                    }

                    override fun onReceivedError(view: WebView?, errorCode: Int, description: String?, failingUrl: String?) {
                        super.onReceivedError(view, errorCode, description, failingUrl)
                        Log.w(TAG, "fetchRenderedPage: onReceivedError: $errorCode, $description for $failingUrl")
                    }
                }

                wv.loadUrl(url)
            } catch (e: Exception) {
                Log.e(TAG, "fetchRenderedPage: Failed to initialize WebView: ${e.message}", e)
                mainHandler.removeCallbacks(timeoutRunnable)
                isCompleted = true
                try {
                    webView?.destroy()
                } catch (de: Exception) {}
                webView = null
                isFetchingPage.set(false)
                call.reject("Failed to initialize WebView: ${e.message}", e)
            }
        }
    }
}
