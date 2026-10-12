package com.miki.ai;

import android.app.ActivityManager;
import android.app.ApplicationExitInfo;
import android.content.Context;
import android.content.SharedPreferences;
import android.os.Build;
import android.os.Process;
import android.os.SystemClock;
import android.util.Log;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.Date;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.TimeZone;

/**
 * Small, content-free native journal for WebView/Activity failures.
 * It is replayed into MIKI_RUNTIME_LOG.txt by MIKINativeRunnerPlugin at next startup.
 */
public final class NativeWebViewDiagnosticJournal {
    private static final String FILE_NAME = "miki_native_webview_diagnostics_v1.log";
    private static final int MAX_PENDING_BYTES = 64 * 1024;
    private static final Set<String> ALLOWED_EVENTS = new HashSet<>(Arrays.asList(
        "ACTIVITY_CREATE", "ACTIVITY_RESUME", "ACTIVITY_PAUSE", "ACTIVITY_STOP", "ACTIVITY_DESTROY",
        "WEBVIEW_LISTENER_UNAVAILABLE", "WEBVIEW_PAGE_STARTED", "WEBVIEW_PAGE_COMMIT_VISIBLE", "WEBVIEW_PAGE_LOADED",
        "WEBVIEW_RENDER_PROCESS_GONE", "WEBVIEW_PROVIDER_INFO",
        "PROCESS_EXIT_HISTORY", "PROCESS_EXIT_HISTORY_SCAN"
    ));

    private NativeWebViewDiagnosticJournal() {}

    private static final long PROCESS_START_ELAPSED_REALTIME_MS = SystemClock.elapsedRealtime();
    private static final String EXIT_HISTORY_PREFERENCES = "miki_native_process_exit_history_v1";
    private static final String LAST_EXIT_TIMESTAMP_KEY = "last_reported_exit_timestamp_ms";

    public static synchronized boolean record(Context context, String event, String details, boolean durable) {
        if (context == null || !ALLOWED_EVENTS.contains(event)) return false;
        String safeDetails = details == null ? "" : details.replaceAll("[^A-Za-z0-9_.,:= -]", "_");
        if (safeDetails.length() > 140) safeDetails = safeDetails.substring(0, 140);
        String processIdentity = "processPid=" + Process.myPid() + ",processUptimeMs=" + Math.max(0L, SystemClock.elapsedRealtime() - PROCESS_START_ELAPSED_REALTIME_MS);
        safeDetails = safeDetails.isEmpty() ? processIdentity : safeDetails + "," + processIdentity;
        File file = new File(context.getFilesDir(), FILE_NAME);
        try {
            if (file.exists() && file.length() > MAX_PENDING_BYTES) {
                try (FileOutputStream reset = new FileOutputStream(file, false)) {
                    reset.write("[NATIVE_WEBVIEW] event=BUFFER_TRUNCATED details=limit_reached\n".getBytes(StandardCharsets.UTF_8));
                    reset.flush();
                }
            }
            SimpleDateFormat formatter = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US);
            formatter.setTimeZone(TimeZone.getTimeZone("UTC"));
            String line = formatter.format(new Date()) + " [NATIVE_WEBVIEW] event=" + event + " details=" + safeDetails + "\n";
            try (FileOutputStream output = new FileOutputStream(file, true)) {
                output.write(line.getBytes(StandardCharsets.UTF_8));
                output.flush();
                if (durable) output.getFD().sync();
            }
            return true;
        } catch (IOException error) {
            Log.e("MIKI_NATIVE_DIAGNOSTICS", "native diagnostic write failed for " + event, error);
            return false;
        }
    }

    /**
     * Copies Android's recent process-death metadata into the existing durable native journal.
     * Human-readable system descriptions, URLs, page content, and conversation data are never stored.
     */
    public static synchronized void recordPreviousProcessExitReasons(Context context) {
        if (context == null) return;
        final int sdk = Build.VERSION.SDK_INT;
        if (sdk < Build.VERSION_CODES.R) {
            record(context, "PROCESS_EXIT_HISTORY_SCAN", "status=UNSUPPORTED,sdk=" + sdk, true);
            return;
        }

        try {
            ActivityManager manager = (ActivityManager) context.getSystemService(Context.ACTIVITY_SERVICE);
            if (manager == null) {
                record(context, "PROCESS_EXIT_HISTORY_SCAN", "status=UNAVAILABLE,service=ACTIVITY_MANAGER", true);
                return;
            }

            SharedPreferences preferences = context.getSharedPreferences(EXIT_HISTORY_PREFERENCES, Context.MODE_PRIVATE);
            long lastReportedTimestampMs = preferences.getLong(LAST_EXIT_TIMESTAMP_KEY, 0L);
            List<ApplicationExitInfo> history = manager.getHistoricalProcessExitReasons(context.getPackageName(), 0, 5);
            if (history == null || history.isEmpty()) {
                record(context, "PROCESS_EXIT_HISTORY_SCAN", "status=NO_HISTORY,lastReportedExitMs=" + lastReportedTimestampMs, true);
                return;
            }

            List<ApplicationExitInfo> pending = new ArrayList<>();
            for (ApplicationExitInfo info : history) {
                if (info == null) continue;
                // Only report the app's main process; avoid attributing a service process to the UI process.
                if (!context.getPackageName().equals(info.getProcessName())) continue;
                if (info.getTimestamp() > lastReportedTimestampMs) pending.add(info);
            }
            Collections.sort(pending, (left, right) -> Long.compare(left.getTimestamp(), right.getTimestamp()));
            if (pending.isEmpty()) {
                record(context, "PROCESS_EXIT_HISTORY_SCAN",
                    "status=NO_NEW_RECORDS,historyCount=" + history.size() + ",lastReportedExitMs=" + lastReportedTimestampMs, false);
                return;
            }

            int reported = 0;
            for (ApplicationExitInfo info : pending) {
                int reason = info.getReason();
                long exitTimestampMs = info.getTimestamp();
                String details = "exitTimeMs=" + exitTimestampMs
                    + ",pid=" + info.getPid()
                    + ",reason=" + reasonName(reason)
                    + ",reasonCode=" + reason
                    + ",subReason=" + info.getSubReason()
                    + ",status=" + info.getStatus()
                    + ",importance=" + info.getImportance()
                    + ",pssKb=" + info.getPss()
                    + ",rssKb=" + info.getRss();
                if (!record(context, "PROCESS_EXIT_HISTORY", details, true)) {
                    record(context, "PROCESS_EXIT_HISTORY_SCAN", "status=JOURNAL_WRITE_FAILED,exitTimeMs=" + exitTimestampMs, true);
                    return;
                }
                // Advance the watermark only after the durable event append succeeds.
                if (!preferences.edit().putLong(LAST_EXIT_TIMESTAMP_KEY, exitTimestampMs).commit()) {
                    record(context, "PROCESS_EXIT_HISTORY_SCAN", "status=WATERMARK_COMMIT_FAILED,exitTimeMs=" + exitTimestampMs, true);
                    return;
                }
                lastReportedTimestampMs = exitTimestampMs;
                reported++;
            }
            record(context, "PROCESS_EXIT_HISTORY_SCAN",
                "status=COMPLETE,reported=" + reported + ",lastReportedExitMs=" + lastReportedTimestampMs, true);
        } catch (RuntimeException error) {
            record(context, "PROCESS_EXIT_HISTORY_SCAN",
                "status=ERROR,errorType=" + error.getClass().getSimpleName() + ",sdk=" + sdk, true);
        }
    }

    private static String reasonName(int reason) {
        switch (reason) {
            case 0: return "UNKNOWN";
            case 1: return "EXIT_SELF";
            case 2: return "SIGNALED";
            case 3: return "LOW_MEMORY";
            case 4: return "CRASH";
            case 5: return "CRASH_NATIVE";
            case 6: return "ANR";
            case 7: return "INITIALIZATION_FAILURE";
            case 8: return "PERMISSION_CHANGE";
            case 9: return "EXCESSIVE_RESOURCE_USAGE";
            case 10: return "USER_REQUESTED";
            case 11: return "USER_STOPPED";
            case 12: return "DEPENDENCY_DIED";
            case 13: return "OTHER";
            case 14: return "FREEZER";
            case 15: return "PACKAGE_STATE_CHANGE";
            case 16: return "PACKAGE_UPDATED";
            default: return "REASON_CODE_" + reason;
        }
    }

    public static synchronized String readPending(Context context) throws IOException {
        File file = new File(context.getFilesDir(), FILE_NAME);
        if (!file.isFile() || file.length() <= 0) return "";
        int limit = MAX_PENDING_BYTES + 1024;
        try (FileInputStream input = new FileInputStream(file);
             ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[4096];
            int total = 0;
            int count;
            while (total < limit && (count = input.read(buffer, 0, Math.min(buffer.length, limit - total))) != -1) {
                output.write(buffer, 0, count);
                total += count;
            }
            return new String(output.toByteArray(), StandardCharsets.UTF_8);
        }
    }

    public static synchronized void clearPending(Context context) throws IOException {
        File file = new File(context.getFilesDir(), FILE_NAME);
        try (FileOutputStream output = new FileOutputStream(file, false)) {
            output.flush();
            output.getFD().sync();
        }
    }
}
