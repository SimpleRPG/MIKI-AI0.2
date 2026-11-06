package com.miki.ai

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import android.util.Log
import androidx.core.app.NotificationCompat

/**
 * MikiKeepAliveService (P450)
 *
 * JS 側 nativeBackgroundService.ts が前提としてきた、プロセス維持専用の
 * 最小フォアグラウンドサービス。自律改善のロジック自体は持たず、
 * アプリのプロセス (WebView / JS エンジン) をバックグラウンドでも
 * 生かし続けることだけが仕事。これにより backgroundWorkerService.ts の
 * setInterval スケジューラと自律改善ループが、アプリを離れた後も回る。
 *
 * - 開始はアプリがフォアグラウンドの間に JS から行われる
 *   (Android 14+ のフォアグラウンドサービス開始制限に抵触しない)。
 * - Android 15+ の dataSync タイプのタイムアウト (onTimeout) では
 *   システムに強制終了される前に自分から停止する。
 */
class MikiKeepAliveService : Service() {

    companion object {
        const val TAG = "MikiKeepAliveService"
        private const val CHANNEL_ID = "miki_keep_alive"
        private const val NOTIFICATION_ID = 4201

        @Volatile
        var isRunning: Boolean = false
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        try {
            val notification = buildNotification()
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
                startForeground(
                    NOTIFICATION_ID,
                    notification,
                    ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC
                )
            } else {
                startForeground(NOTIFICATION_ID, notification)
            }
            isRunning = true
            Log.i(TAG, "Keep-alive foreground service started.")
        } catch (e: Exception) {
            Log.e(TAG, "startForeground failed: ${e.message}", e)
            isRunning = false
            stopSelf()
            return START_NOT_STICKY
        }
        return START_STICKY
    }

    // Android 15+ (API 35): dataSync フォアグラウンドサービスの
    // 累計実行時間上限に達したときに呼ばれる。期限内に停止しないと
    // アプリごと例外で落とされるため、ここで確実に停止する。
    override fun onTimeout(startId: Int, fgsType: Int) {
        Log.w(TAG, "Foreground service timed out by the system (startId=$startId); stopping.")
        isRunning = false
        stopSelf()
        super.onTimeout(startId, fgsType)
    }

    override fun onDestroy() {
        isRunning = false
        try {
            @Suppress("DEPRECATION")
            stopForeground(true)
        } catch (e: Exception) {
            Log.w(TAG, "stopForeground failed: ${e.message}")
        }
        Log.i(TAG, "Keep-alive foreground service destroyed.")
        super.onDestroy()
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val manager = getSystemService(NotificationManager::class.java) ?: return
        if (manager.getNotificationChannel(CHANNEL_ID) != null) return
        val channel = NotificationChannel(
            CHANNEL_ID,
            "MIKI バックグラウンド実行",
            NotificationManager.IMPORTANCE_LOW
        )
        channel.description = "自律改善ループをバックグラウンドで回し続けるための常駐通知"
        channel.setShowBadge(false)
        manager.createNotificationChannel(channel)
    }

    private fun buildNotification(): Notification {
        val launchIntent = packageManager.getLaunchIntentForPackage(packageName)?.apply {
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        val pendingIntent = launchIntent?.let {
            val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            } else {
                PendingIntent.FLAG_UPDATE_CURRENT
            }
            PendingIntent.getActivity(this, 0, it, flags)
        }
        val iconRes = applicationInfo.icon.takeIf { it != 0 }
            ?: android.R.drawable.ic_dialog_info
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(iconRes)
            .setContentTitle("MIKI バックグラウンド実行中")
            .setContentText("自律改善ループをバックグラウンドで実行しています")
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .build()
    }
}
