package com.miki.ai

import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.BatteryManager
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.PowerManager
import android.util.Log
import android.webkit.ConsoleMessage
import android.webkit.WebChromeClient
import android.webkit.JavascriptInterface
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.NonCancellable
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeoutOrNull
import java.util.UUID
import java.util.concurrent.atomic.AtomicBoolean

/**
 * MikiBackgroundWorker (Android WorkManager CoroutineWorker)
 *
 * MikiAIの自律改善サイクル (backgroundWorkerService.runAutonomousBackgroundCycle) を
 * アプリが閉じている・バックグラウンドにいる状態でも定期実行するネイティブWorker。
 *
 * 実行方式:
 * 1. メインプロセス (Activity/Capacitor Bridge) が生存している場合:
 *    MikiWorkManagerPlugin 経由で既存の WebView に対し直接実行を要求
 * 2. Active Runtime がない場合:
 *    ヘッドレス WebView をメインスレッドで生成し、アプリを読み込んで実行
 *
 * 完了条件:
 * JavaScript処理の明示的な完了Receiptが返るまで成功としない。開始応答や固定時間経過を
 * 完了扱いにせず、Active Runtimeを起動した後は重複Executorへフォールバックしない。
 *
 * 制約条件判定:
 * backgroundWorkerService.getExecutionConditions() のロジック (充電状態・電池残量・サーマル状態)
 * と完全に整合するネイティブハードウェア判定を実装。
 */
/** JavaScript-to-Worker completion receipt. A trigger acknowledgment is not a completion receipt. */
class MikiAutonomousCycleCallback(
    private val expectedCycleId: String,
    private val callback: (Boolean, String) -> Unit
) {
    @JavascriptInterface
    fun onComplete(cycleId: String?, status: String?, detail: String?) {
        if (cycleId != expectedCycleId) {
            Log.w(MikiBackgroundWorker.TAG, "Ignored stale/mismatched cycle receipt: expected=$expectedCycleId received=$cycleId")
            return
        }
        callback(status == "completed", detail.orEmpty().take(2000))
    }
}

class MikiBackgroundWorker(
    private val appContext: Context,
    workerParams: WorkerParameters
) : CoroutineWorker(appContext, workerParams) {

    companion object {
        const val TAG = "MikiBackgroundWorker"
        const val UNIQUE_WORK_NAME = "MikiAutonomousSelfImprovement"
        const val WORK_TAG = "MikiAutonomousWork"

        @Volatile
        var isWorkerExecuting: Boolean = false
        private val workerExecutionLock = AtomicBoolean(false)
    }

    override suspend fun doWork(): Result = withContext(Dispatchers.IO) {
        Log.i(TAG, "MikiBackgroundWorker: doWork started [Trigger: android_intent]")

        // 1. 排他制御: 二重実行の完全防止
        if (!workerExecutionLock.compareAndSet(false, true)) {
            Log.w(TAG, "MikiBackgroundWorker: Another cycle still executing; this attempt is not complete.")
            return@withContext Result.retry()
        }

        isWorkerExecuting = true
        try {
            // Hardware validation is covered by finally so an unexpected API failure cannot retain the lock.
            val conditionCheck = validateHardwareConditions()
            if (!conditionCheck.passed) {
                Log.w(TAG, "MikiBackgroundWorker: Hardware condition check rejected: ${conditionCheck.reason}")
                return@withContext Result.retry()
            }
            val executed = executeAutonomousCycle()
            if (executed) {
                Log.i(TAG, "MikiBackgroundWorker: Autonomous self-improvement cycle completed successfully.")
                Result.success()
            } else {
                Log.w(TAG, "MikiBackgroundWorker: Execution could not be confirmed or timed out.")
                Result.retry()
            }
        } catch (cancelled: CancellationException) {
            Log.w(TAG, "MikiBackgroundWorker: Worker cancelled by OS or WorkManager")
            throw cancelled
        } catch (e: Exception) {
            Log.e(TAG, "MikiBackgroundWorker: Error executing autonomous cycle: ${e.message}", e)
            Result.retry()
        } finally {
            isWorkerExecuting = false
            workerExecutionLock.set(false)
        }
    }

    /**
     * ハードウェア条件の検証
     * backgroundWorkerService.ts の getExecutionConditions() と厳密に対応:
     * - batteryLevel > 0.2 (20%以上)
     * - thermalState が 'hot' (>=42℃) または 'critical' (>=46℃) でないこと
     */
    private fun validateHardwareConditions(): ConditionCheckResult {
        // バッテリー残量・充電状態の確認
        val batteryManager = appContext.getSystemService(Context.BATTERY_SERVICE) as? BatteryManager
        val batteryLevel = batteryManager?.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY) ?: -1
        val isCharging = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val status = batteryManager?.getIntProperty(BatteryManager.BATTERY_PROPERTY_STATUS) ?: -1
            status == BatteryManager.BATTERY_STATUS_CHARGING || status == BatteryManager.BATTERY_STATUS_FULL
        } else {
            val filter = IntentFilter(Intent.ACTION_BATTERY_CHANGED)
            val intent = appContext.registerReceiver(null, filter)
            val status = intent?.getIntExtra(BatteryManager.EXTRA_STATUS, -1) ?: -1
            status == BatteryManager.BATTERY_STATUS_CHARGING || status == BatteryManager.BATTERY_STATUS_FULL
        }

        if (batteryLevel in 0..19 && !isCharging) {
            return ConditionCheckResult(false, "Battery level too low (${batteryLevel}%) and not charging")
        }

        // サーマル状態 (温度) の確認
        var temperatureCelsius = -1.0
        try {
            val filter = IntentFilter(Intent.ACTION_BATTERY_CHANGED)
            val intent = appContext.registerReceiver(null, filter)
            val tempTenths = intent?.getIntExtra(BatteryManager.EXTRA_TEMPERATURE, -1) ?: -1
            if (tempTenths > 0) {
                temperatureCelsius = tempTenths / 10.0
            }
        } catch (e: Exception) {
            Log.w(TAG, "Failed to read battery temperature: ${e.message}")
        }

        // backgroundWorkerService.ts の基準: >= 42℃ で hot, >= 46℃ で critical
        if (temperatureCelsius >= 42.0) {
            return ConditionCheckResult(false, "Device temperature too high (${temperatureCelsius}°C >= 42°C)")
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            val powerManager = appContext.getSystemService(Context.POWER_SERVICE) as? PowerManager
            val thermalStatus = powerManager?.currentThermalStatus ?: PowerManager.THERMAL_STATUS_NONE
            if (thermalStatus >= PowerManager.THERMAL_STATUS_SEVERE) {
                return ConditionCheckResult(false, "PowerManager thermal status severe or critical ($thermalStatus)")
            }
        }

        return ConditionCheckResult(true, "Hardware conditions satisfied (battery: ${batteryLevel}%, temp: ${temperatureCelsius}°C)")
    }

    /**
     * 自律改善サイクルの実起動
     */
    private suspend fun executeAutonomousCycle(): Boolean {
        // One stable ID correlates the trigger, JS completion Receipt and cancellation request.
        val cycleId = UUID.randomUUID().toString()
        // An active WebView is the canonical runtime. Once invoked, do not launch a second executor
        // after timeout/failure: the original JavaScript may still be running.
        val plugin = MikiWorkManagerPlugin.activeInstance
        if (plugin != null && plugin.hasActiveWebRuntime()) {
            Log.i(TAG, "MikiBackgroundWorker: Awaiting cycle-correlated completion receipt [$cycleId].")
            val completionDeferred = CompletableDeferred<Boolean>()
            Handler(Looper.getMainLooper()).post {
                try {
                    plugin.triggerAutonomousCycle(cycleId) { success, detail ->
                        Log.i(TAG, "Active runtime Receipt [$cycleId]: success=$success detail=${detail.take(500)}")
                        completionDeferred.complete(success)
                    }
                } catch (e: Exception) {
                    Log.e(TAG, "Failed to trigger via plugin: ${e.message}", e)
                    completionDeferred.complete(false)
                }
            }
            var receiptReceived = false
            try {
                val result = withTimeoutOrNull(8 * 60 * 1000L) { completionDeferred.await() }
                receiptReceived = result != null
                if (!receiptReceived) Log.w(TAG, "Active runtime timed out without correlated Receipt; requesting cancellation and refusing fallback.")
                return result == true
            } finally {
                if (!receiptReceived) {
                    plugin.cancelAutonomousCycle(cycleId)
                    // Do not release the worker's single-flight lock while the same JS run may still
                    // be executing. A negative Receipt confirms termination; no Receipt means fail
                    // closed and no second executor is started from this Worker.
                    withContext(NonCancellable) {
                        val stopped = withTimeoutOrNull(10_000L) { completionDeferred.await() }
                        if (stopped == null) Log.e(TAG, "Cancellation was requested for $cycleId but no termination Receipt arrived; future attempts remain subject to plugin single-flight guard.")
                    }
                }
            }
        }

        // No active runtime exists: use exactly one headless WebView executor.
        return executeViaHeadlessWebView(cycleId)
    }

    /**
     * ヘッドレス WebView をバックグラウンドで起動し、JS側の runAutonomousBackgroundCycle を実行する
     */
    private suspend fun executeViaHeadlessWebView(cycleId: String): Boolean {
        val completionDeferred = CompletableDeferred<Boolean>()
        val completionClaimed = AtomicBoolean(false)
        val cleanupClaimed = AtomicBoolean(false)
        val cleanupFinished = CompletableDeferred<Unit>()
        var webViewRef: WebView? = null
        val handler = Handler(Looper.getMainLooper())
        fun cleanupWebView(afterCleanup: (() -> Unit)? = null) {
            if (!cleanupClaimed.compareAndSet(false, true)) {
                afterCleanup?.invoke()
                return
            }
            handler.post {
                try {
                    val escapedCycleId = "'${cycleId}'" // UUID is generated locally and contains only hex digits and hyphens.
                    webViewRef?.evaluateJavascript("window.mikiCancelBackgroundCycle && window.mikiCancelBackgroundCycle($escapedCycleId);", null)
                    webViewRef?.removeJavascriptInterface("MikiNativeCallback")
                    webViewRef?.stopLoading()
                    webViewRef?.destroy()
                } catch (e: Exception) {
                    Log.w(TAG, "Headless WebView cleanup failed: ${e.message}")
                } finally {
                    cleanupFinished.complete(Unit)
                    afterCleanup?.invoke()
                }
            }
        }

        handler.post {
            try {
                Log.i(TAG, "MikiBackgroundWorker: Spawning headless WebView to run autonomous cycle...")
                val webView = WebView(appContext)
                webViewRef = webView
                val settings = webView.settings
                settings.javaScriptEnabled = true
                settings.domStorageEnabled = true
                settings.databaseEnabled = true
                settings.allowFileAccess = true
                settings.mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW

                fun finish(success: Boolean, detail: String) {
                    if (!completionClaimed.compareAndSet(false, true)) return
                    Log.i(TAG, "Headless autonomous cycle receipt: success=$success detail=${detail.take(500)}")
                    cleanupWebView { completionDeferred.complete(success) }
                }

                webView.addJavascriptInterface(
                    MikiAutonomousCycleCallback(cycleId) { success, detail -> finish(success, detail) },
                    "MikiNativeCallback"
                )
                webView.webChromeClient = object : WebChromeClient() {
                    override fun onConsoleMessage(message: ConsoleMessage?): Boolean {
                        val text = message?.message() ?: ""
                        if (text.contains("WorkManager") || text.contains("SELF_IMPROVEMENT")) {
                            Log.d(TAG, "HeadlessWebView Console: $text")
                        }
                        return true
                    }
                }

                var hasStartedTrigger = false
                webView.webViewClient = object : WebViewClient() {
                    override fun onPageFinished(view: WebView?, url: String?) {
                        super.onPageFinished(view, url)
                        val target = view ?: return
                        if (hasStartedTrigger) return
                        hasStartedTrigger = true
                        var attempts = 0
                        fun triggerWhenReady() {
                            if (completionClaimed.get()) return
                            attempts += 1
                            val script = """
                                (function() {
                                    if (typeof window.mikiRunBackgroundCycle !== 'function') return 'NOT_FOUND';
                                    var cycleId = '$cycleId';
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
                            target.evaluateJavascript(script) { result ->
                                if (result?.contains("NOT_FOUND") == true && attempts < 3 && !completionClaimed.get()) {
                                    handler.postDelayed({ triggerWhenReady() }, 5000L)
                                } else if (result?.contains("NOT_FOUND") == true) {
                                    finish(false, "BACKGROUND_CYCLE_ENTRY_NOT_FOUND")
                                } else {
                                    Log.i(TAG, "Headless WebView trigger acknowledged; awaiting explicit completion receipt: $result")
                                }
                            }
                        }
                        triggerWhenReady()
                    }
                }
                webView.loadUrl("https://localhost/")
            } catch (e: Exception) {
                Log.e(TAG, "Failed to instantiate headless WebView: ${e.message}", e)
                val ownsFailure = completionClaimed.compareAndSet(false, true)
                cleanupWebView {
                    if (ownsFailure) completionDeferred.complete(false)
                }
            }
        }

        // WorkManager's execution window is bounded. Cancellation, timeout, and exceptions all
        // release the WebView resource; no missing receipt is converted to success.
        val result = try {
            withTimeoutOrNull(8 * 60 * 1000L) { completionDeferred.await() }
        } finally {
            completionClaimed.compareAndSet(false, true)
            cleanupWebView()
            withContext(NonCancellable) {
                withTimeoutOrNull(3000L) { cleanupFinished.await() }
            }
        }
        if (result == null) {
            Log.w(TAG, "Headless autonomous cycle timed out without a completion receipt")
        }
        return result == true
    }

    private data class ConditionCheckResult(val passed: Boolean, val reason: String)
}
