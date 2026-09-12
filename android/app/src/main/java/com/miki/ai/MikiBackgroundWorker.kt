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
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeoutOrNull
import java.net.HttpURLConnection
import java.net.URL

/**
 * MikiBackgroundWorker (Android WorkManager CoroutineWorker)
 *
 * MikiAIの自律改善サイクル (backgroundWorkerService.runAutonomousBackgroundCycle) を
 * アプリが閉じている・バックグラウンドにいる状態でも定期実行するネイティブWorker。
 *
 * 実行方式:
 * 1. メインプロセス (Activity/Capacitor Bridge) が生存している場合:
 *    MikiWorkManagerPlugin 経由で既存の WebView に対し直接実行を要求
 * 2. プロセス生存だがActivity非表示 / ヘッドレス時:
 *    ヘッドレス WebView をメインスレッドで生成し、assets 内のアプリを読み込んで実行
 * 3. 補助方式 (ローカルHTTP):
 *    127.0.0.1:3000 のローカルサーバーが存在する場合は HTTP POST でもトリガー試行
 *
 * 制約条件判定:
 * backgroundWorkerService.getExecutionConditions() のロジック (充電状態・電池残量・サーマル状態)
 * と完全に整合するネイティブハードウェア判定を実装。
 */
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
    }

    override suspend fun doWork(): Result = withContext(Dispatchers.IO) {
        Log.i(TAG, "MikiBackgroundWorker: doWork started [Trigger: android_intent]")

        // 1. 排他制御: 二重実行の完全防止
        if (isWorkerExecuting) {
            Log.w(TAG, "MikiBackgroundWorker: Previous cycle still executing, skipping.")
            return@withContext Result.success()
        }

        // 2. ハードウェア条件の動的再検証 (backgroundWorkerService.getExecutionConditions と整合)
        val conditionCheck = validateHardwareConditions()
        if (!conditionCheck.passed) {
            Log.w(TAG, "MikiBackgroundWorker: Hardware condition check rejected: ${conditionCheck.reason}")
            return@withContext Result.retry()
        }

        isWorkerExecuting = true
        try {
            val executed = executeAutonomousCycle()
            if (executed) {
                Log.i(TAG, "MikiBackgroundWorker: Autonomous self-improvement cycle completed successfully.")
                Result.success()
            } else {
                Log.w(TAG, "MikiBackgroundWorker: Execution could not be confirmed or timed out.")
                Result.retry()
            }
        } catch (e: Exception) {
            Log.e(TAG, "MikiBackgroundWorker: Error executing autonomous cycle: ${e.message}", e)
            Result.retry()
        } finally {
            isWorkerExecuting = false
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
        // 方式1: アクティブな Capacitor Bridge / Activity が生存している場合 (優先)
        val plugin = MikiWorkManagerPlugin.activeInstance
        if (plugin != null) {
            Log.i(TAG, "MikiBackgroundWorker: Found active MikiWorkManagerPlugin instance. Triggering directly via Bridge.")
            val completionDeferred = CompletableDeferred<Boolean>()
            Handler(Looper.getMainLooper()).post {
                try {
                    plugin.triggerAutonomousCycle { success ->
                        completionDeferred.complete(success)
                    }
                } catch (e: Exception) {
                    Log.e(TAG, "Failed to trigger via plugin: ${e.message}", e)
                    completionDeferred.complete(false)
                }
            }
            val result = withTimeoutOrNull(60000L) { completionDeferred.await() }
            if (result == true) {
                return true
            }
            Log.w(TAG, "Plugin direct trigger did not complete within timeout. Trying headless webview / local HTTP.")
        }

        // 方式2: ローカル Node.js サーバー (server.ts) への HTTP トリガー試行
        val httpTriggered = tryHttpLocalTrigger()
        if (httpTriggered) {
            return true
        }

        // 方式3: ヘッドレス WebView による実行 (アプリプロセス非アクティブ時)
        return executeViaHeadlessWebView()
    }

    /**
     * ローカルHTTPサーバー (127.0.0.1:3000) へのトリガー試行
     */
    private fun tryHttpLocalTrigger(): Boolean {
        return try {
            val url = URL("http://127.0.0.1:3000/api/background-worker/trigger")
            val conn = url.openConnection() as HttpURLConnection
            conn.connectTimeout = 3000
            conn.readTimeout = 10000
            conn.requestMethod = "POST"
            conn.setRequestProperty("Content-Type", "application/json")
            conn.doOutput = true
            val jsonBody = "{\"triggerSource\":\"android_intent\",\"timestamp\":${System.currentTimeMillis()}}"
            conn.outputStream.use { os ->
                os.write(jsonBody.toByteArray(Charsets.UTF_8))
            }
            val responseCode = conn.responseCode
            conn.disconnect()
            if (responseCode in 200..299) {
                Log.i(TAG, "Triggered autonomous cycle via local HTTP server (code $responseCode)")
                true
            } else {
                false
            }
        } catch (e: Exception) {
            // ローカルサーバー非起動時は想定内
            false
        }
    }

    /**
     * ヘッドレス WebView をバックグラウンドで起動し、JS側の runAutonomousBackgroundCycle を実行する
     */
    private suspend fun executeViaHeadlessWebView(): Boolean {
        val completionDeferred = CompletableDeferred<Boolean>()

        Handler(Looper.getMainLooper()).post {
            try {
                Log.i(TAG, "MikiBackgroundWorker: Spawning headless WebView to run autonomous cycle...")
                val webView = WebView(appContext)
                val settings = webView.settings
                settings.javaScriptEnabled = true
                settings.domStorageEnabled = true
                settings.databaseEnabled = true
                settings.allowFileAccess = true
                settings.mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW

                var hasTriggered = false

                webView.webChromeClient = object : WebChromeClient() {
                    override fun onConsoleMessage(message: ConsoleMessage?): Boolean {
                        val text = message?.message() ?: ""
                        if (text.contains("WorkManager") || text.contains("SELF_IMPROVEMENT")) {
                            Log.d(TAG, "HeadlessWebView Console: $text")
                        }
                        return true
                    }
                }

                webView.webViewClient = object : WebViewClient() {
                    override fun onPageFinished(view: WebView?, url: String?) {
                        super.onPageFinished(view, url)
                        if (hasTriggered) return
                        hasTriggered = true

                        Log.i(TAG, "Headless WebView loaded $url. Executing autonomous cycle...")
                        // window.mikiRunBackgroundCycle が定義されているか待って実行
                        val script = """
                            (function() {
                                if (window.mikiRunBackgroundCycle) {
                                    window.mikiRunBackgroundCycle('android_intent')
                                        .then(function(log) {
                                            console.log('[WorkManager] Headless cycle completed: ' + JSON.stringify(log?.id));
                                            if (window.MikiNativeCallback) {
                                                window.MikiNativeCallback.onComplete(true);
                                            }
                                        })
                                        .catch(function(err) {
                                            console.error('[WorkManager] Headless cycle error: ' + err);
                                            if (window.MikiNativeCallback) {
                                                window.MikiNativeCallback.onComplete(false);
                                            }
                                        });
                                    return 'TRIGGERED';
                                } else {
                                    return 'NOT_FOUND';
                                }
                            })();
                        """.trimIndent()

                        view?.evaluateJavascript(script) { result ->
                            Log.i(TAG, "evaluateJavascript trigger result: $result")
                            if (result?.contains("TRIGGERED") == true) {
                                // 実行開始が確認できた場合、後続の完了コールバックまたはタイマーで成功を確定
                                Handler(Looper.getMainLooper()).postDelayed({
                                    try {
                                        webView.destroy()
                                    } catch (e: Exception) {}
                                    if (!completionDeferred.isCompleted) {
                                        completionDeferred.complete(true)
                                    }
                                }, 30000L) // 30秒後に安全に破棄
                            } else {
                                // アプリ初期化待ちでリトライ (5秒後)
                                Handler(Looper.getMainLooper()).postDelayed({
                                    view.evaluateJavascript(script) { retryResult ->
                                        Log.i(TAG, "Retry evaluateJavascript result: $retryResult")
                                        val ok = retryResult?.contains("TRIGGERED") == true
                                        Handler(Looper.getMainLooper()).postDelayed({
                                            try { webView.destroy() } catch (e: Exception) {}
                                            if (!completionDeferred.isCompleted) {
                                                completionDeferred.complete(ok)
                                            }
                                        }, 25000L)
                                    }
                                }, 5000L)
                            }
                        }
                    }
                }

                // Capacitorの標準ローカルURL (https://localhost/) をロード
                webView.loadUrl("https://localhost/")

            } catch (e: Exception) {
                Log.e(TAG, "Failed to instantiate headless WebView: ${e.message}", e)
                completionDeferred.complete(false)
            }
        }

        val result = withTimeoutOrNull(90000L) { completionDeferred.await() }
        return result ?: false
    }

    private data class ConditionCheckResult(val passed: Boolean, val reason: String)
}
