package com.miki.ai

import android.content.Context
import android.os.BatteryManager
import android.os.Build
import android.os.PowerManager
import android.util.Log
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
import java.util.concurrent.TimeUnit

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
    }

    override fun load() {
        super.load()
        activeInstance = this
        Log.i(TAG, "MikiWorkManagerPlugin loaded and activeInstance bound.")
    }

    override fun handleOnDestroy() {
        if (activeInstance == this) {
            activeInstance = null
        }
        super.handleOnDestroy()
    }

    /**
     * MikiBackgroundWorker から呼ばれるトリガーメソッド
     */
    fun triggerAutonomousCycle(onComplete: (Boolean) -> Unit) {
        val ret = JSObject()
        ret.put("triggerSource", "android_intent")
        ret.put("timestamp", System.currentTimeMillis())

        // 1. Capacitor イベントリスナーへの通知
        notifyListeners("autonomousCycleTriggered", ret)

        // 2. WebView の JavaScript インスタンスへ直接呼び出し
        activity?.runOnUiThread {
            val script = """
                (function() {
                    if (window.mikiRunBackgroundCycle) {
                        window.mikiRunBackgroundCycle('android_intent')
                            .then(function() { return true; })
                            .catch(function(e) { console.error(e); return false; });
                        return 'OK';
                    }
                    return 'NOT_FOUND';
                })();
            """.trimIndent()

            bridge?.webView?.evaluateJavascript(script) { evalRes ->
                Log.i(TAG, "Bridge evaluateJavascript trigger: $evalRes")
                val triggered = evalRes?.contains("OK") == true
                onComplete(triggered)
            } ?: run {
                onComplete(false)
            }
        } ?: run {
            onComplete(false)
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
}
