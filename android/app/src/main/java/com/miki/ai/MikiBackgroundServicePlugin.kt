package com.miki.ai

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.util.Log
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

/**
 * MikiBackgroundServicePlugin (P450)
 *
 * JS 側 nativeBackgroundService.ts から、プロセス維持専用の
 * フォアグラウンドサービス MikiKeepAliveService を起動・停止する
 * Capacitor ブリッジプラグイン。これまで JS だけが存在し、
 * ネイティブ実装がなかったため start() は無言で失敗していた。
 *
 * 提供メソッド (JS 側の契約どおり):
 * - start(): キープアライブサービスを開始
 * - stop(): キープアライブサービスを停止
 * - isRunning(): サービスの実行状態
 * - checkNotificationPermission(): 通知権限 (POST_NOTIFICATIONS) の状態
 * - requestNotificationPermission(): 通知権限のリクエスト
 */
@CapacitorPlugin(name = "MikiBackgroundServicePlugin")
class MikiBackgroundServicePlugin : Plugin() {

    companion object {
        private const val TAG = "MikiBackgroundServicePlugin"
        private const val REQUEST_CODE_POST_NOTIFICATIONS = 45001
    }

    @PluginMethod
    fun start(call: PluginCall) {
        val ret = JSObject()
        try {
            val intent = Intent(context, MikiKeepAliveService::class.java)
            ContextCompat.startForegroundService(context, intent)
            ret.put("success", true)
            // onStartCommand は非同期に届くため、開始要求が受理された時点を
            // 「実行中」として返す (実状態はサービス側 isRunning が持つ)。
            ret.put("running", true)
            Log.i(TAG, "Keep-alive service start requested.")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to start keep-alive service: ${e.message}", e)
            ret.put("success", false)
            ret.put("running", MikiKeepAliveService.isRunning)
        }
        call.resolve(ret)
    }

    @PluginMethod
    fun stop(call: PluginCall) {
        val ret = JSObject()
        try {
            val intent = Intent(context, MikiKeepAliveService::class.java)
            context.stopService(intent)
            ret.put("success", true)
            ret.put("running", false)
            Log.i(TAG, "Keep-alive service stop requested.")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to stop keep-alive service: ${e.message}", e)
            ret.put("success", false)
            ret.put("running", MikiKeepAliveService.isRunning)
        }
        call.resolve(ret)
    }

    @PluginMethod
    fun isRunning(call: PluginCall) {
        val ret = JSObject()
        ret.put("running", MikiKeepAliveService.isRunning)
        call.resolve(ret)
    }

    @PluginMethod
    fun checkNotificationPermission(call: PluginCall) {
        val ret = JSObject()
        ret.put("granted", isNotificationPermissionGranted())
        call.resolve(ret)
    }

    @PluginMethod
    fun requestNotificationPermission(call: PluginCall) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            !isNotificationPermissionGranted()
        ) {
            val host = activity
            if (host != null) {
                try {
                    ActivityCompat.requestPermissions(
                        host,
                        arrayOf(Manifest.permission.POST_NOTIFICATIONS),
                        REQUEST_CODE_POST_NOTIFICATIONS
                    )
                } catch (e: Exception) {
                    Log.w(TAG, "Failed to request notification permission: ${e.message}")
                }
            }
        }
        // リクエストは非同期のため、この時点の状態を返す。
        // JS 側の主経路は LocalNotifications の権限フローで、こちらは予備。
        val ret = JSObject()
        ret.put("granted", isNotificationPermissionGranted())
        call.resolve(ret)
    }

    private fun isNotificationPermissionGranted(): Boolean {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) return true
        return ContextCompat.checkSelfPermission(
            context,
            Manifest.permission.POST_NOTIFICATIONS
        ) == PackageManager.PERMISSION_GRANTED
    }
}
