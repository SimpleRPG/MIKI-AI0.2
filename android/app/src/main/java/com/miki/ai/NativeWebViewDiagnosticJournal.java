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
import java.io.InputStream;
import java.security.MessageDigest;
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
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Small, content-free native journal for WebView/Activity failures.
 * It is replayed into MIKI_RUNTIME_LOG.txt by MIKINativeRunnerPlugin at next startup.
 */
public final class NativeWebViewDiagnosticJournal {
    private static final String FILE_NAME = "miki_native_webview_diagnostics_v1.log";
    private static final int MAX_PENDING_BYTES = 64 * 1024;
    private static final int MAX_EXIT_TRACE_SAMPLE_BYTES = 128 * 1024;
    private static final int MAX_EXIT_TRACE_FRAMES = 8;
    private static final Pattern TRACE_FRAME_PATTERN =
        Pattern.compile("^\\s*at\\s+([A-Za-z0-9_.$]+)\\((?:[^)]*)\\)");
    private static final Set<String> ALLOWED_EVENTS = new HashSet<>(Arrays.asList(
        "ACTIVITY_CREATE", "ACTIVITY_RESUME", "ACTIVITY_PAUSE", "ACTIVITY_STOP", "ACTIVITY_DESTROY",
        "WEBVIEW_LISTENER_UNAVAILABLE", "WEBVIEW_PAGE_STARTED", "WEBVIEW_PAGE_COMMIT_VISIBLE", "WEBVIEW_PAGE_LOADED",
        "WEBVIEW_RENDER_PROCESS_GONE", "WEBVIEW_PROVIDER_INFO",
        "PROCESS_EXIT_HISTORY", "PROCESS_EXIT_HISTORY_SCAN", "UNCAUGHT_EXCEPTION",
        "PROCESS_EXIT_TRACE_SUMMARY", "PROCESS_EXIT_TRACE_FRAME"
    ));

    private NativeWebViewDiagnosticJournal() {}

    private static final long PROCESS_START_ELAPSED_REALTIME_MS = SystemClock.elapsedRealtime();
    private static final String EXIT_HISTORY_PREFERENCES = "miki_native_process_exit_history_v1";
    private static final String LAST_EXIT_TIMESTAMP_KEY = "last_reported_exit_timestamp_ms";
    private static boolean uncaughtExceptionHandlerInstalled = false;

    /**
     * Captures minimal exception evidence before delegating to Android's original handler.
     * Exception messages and full stack traces are intentionally not persisted.
     */
    public static synchronized void installUncaughtExceptionHandler(Context context) {
        if (context == null || uncaughtExceptionHandlerInstalled) return;
        final Context appContext = context.getApplicationContext() != null
            ? context.getApplicationContext() : context;
        final Thread.UncaughtExceptionHandler previousHandler = Thread.getDefaultUncaughtExceptionHandler();
        Thread.setDefaultUncaughtExceptionHandler(new Thread.UncaughtExceptionHandler() {
            @Override
            public void uncaughtException(Thread thread, Throwable error) {
                try {
                    StackTraceElement[] frames = error.getStackTrace();
                    StringBuilder details = new StringBuilder();
                    details.append("exceptionType=").append(safeToken(error.getClass().getName()))
                        .append(",threadIsMain=").append(thread != null && "main".equals(thread.getName()))
                        .append(",frameCount=").append(frames == null ? 0 : frames.length);
                    if (frames != null && frames.length > 0) {
                        StackTraceElement frame = frames[0];
                        details.append(",frame0=").append(safeToken(frame.getClassName()))
                            .append(".").append(safeToken(frame.getMethodName()))
                            .append(":").append(frame.getLineNumber());
                    }
                    Throwable cause = error.getCause();
                    if (cause != null) details.append(",causeType=").append(safeToken(cause.getClass().getName()));
                    record(appContext, "UNCAUGHT_EXCEPTION", details.toString(), true);
                } catch (Throwable loggingFailure) {
                    Log.e("MIKI_NATIVE_DIAGNOSTICS", "uncaught exception diagnostic write failed", loggingFailure);
                }
                if (previousHandler != null) {
                    previousHandler.uncaughtException(thread, error);
                } else {
                    android.os.Process.killProcess(android.os.Process.myPid());
                    System.exit(10);
                }
            }
        });
        uncaughtExceptionHandlerInstalled = true;
    }

    public static synchronized boolean record(Context context, String event, String details, boolean durable) {
        if (context == null || !ALLOWED_EVENTS.contains(event)) return false;
        String safeDetails = details == null ? "" : details.replaceAll("[^A-Za-z0-9_.,:= -]", "_");
        if (safeDetails.length() > 220) safeDetails = safeDetails.substring(0, 220);
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
    private static String safeToken(String value) {
        if (value == null || value.isEmpty()) return "UNKNOWN";
        String safe = value.replaceAll("[^A-Za-z0-9_.-]", "_");
        return safe.length() <= 80 ? safe : safe.substring(0, 80);
    }

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
                    + ",status=" + info.getStatus()
                    + ",importance=" + info.getImportance()
                    + ",pssKb=" + info.getPss()
                    + ",rssKb=" + info.getRss();
                if (!record(context, "PROCESS_EXIT_HISTORY", details, true)) {
                    record(context, "PROCESS_EXIT_HISTORY_SCAN", "status=JOURNAL_WRITE_FAILED,exitTimeMs=" + exitTimestampMs, true);
                    return;
                }
                if (!recordExitTraceEvidence(context, info)) {
                    record(context, "PROCESS_EXIT_HISTORY_SCAN", "status=TRACE_JOURNAL_WRITE_FAILED,exitTimeMs=" + exitTimestampMs, true);
                    return;
                }
                // Advance the watermark only after exit metadata and trace evidence are durable.
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

    /**
     * Copies only bounded trace metadata and selected Java frame names into the journal.
     * The raw trace, descriptions, URLs, page content, and conversation data are never persisted.
     */
    private static boolean recordExitTraceEvidence(Context context, ApplicationExitInfo info) {
        final long exitTimestampMs = info.getTimestamp();
        final int pid = info.getPid();
        final int reason = info.getReason();
        InputStream traceStream = null;
        try {
            traceStream = info.getTraceInputStream();
            if (traceStream == null) {
                return record(context, "PROCESS_EXIT_TRACE_SUMMARY",
                    "status=UNAVAILABLE,exitTimeMs=" + exitTimestampMs + ",pid=" + pid + ",reasonCode=" + reason,
                    true);
            }

            ByteArrayOutputStream sample = new ByteArrayOutputStream();
            boolean sampleTruncated = false;
            try (InputStream input = traceStream) {
                byte[] buffer = new byte[4096];
                int count;
                while (sample.size() < MAX_EXIT_TRACE_SAMPLE_BYTES) {
                    int capacity = Math.min(buffer.length, MAX_EXIT_TRACE_SAMPLE_BYTES - sample.size());
                    count = input.read(buffer, 0, capacity);
                    if (count < 0) break;
                    sample.write(buffer, 0, count);
                }
                if (sample.size() == MAX_EXIT_TRACE_SAMPLE_BYTES) sampleTruncated = input.read() != -1;
                traceStream = null;
            }

            byte[] sampleBytes = sample.toByteArray();
            String sampleHash = sha256Hex(sampleBytes);
            List<String> frames = extractTraceFrames(sampleBytes);
            String summary = "status=AVAILABLE,exitTimeMs=" + exitTimestampMs
                + ",pid=" + pid + ",reasonCode=" + reason
                + ",sampledBytes=" + sampleBytes.length
                + ",sampleTruncated=" + sampleTruncated
                + ",sampleSha256=" + sampleHash
                + ",frameCount=" + frames.size();
            if (!record(context, "PROCESS_EXIT_TRACE_SUMMARY", summary, true)) return false;

            for (int i = 0; i < frames.size() && i < MAX_EXIT_TRACE_FRAMES; i++) {
                String frameDetails = "exitTimeMs=" + exitTimestampMs + ",pid=" + pid
                    + ",frameIndex=" + i + ",frame=" + frames.get(i);
                if (!record(context, "PROCESS_EXIT_TRACE_FRAME", frameDetails, true)) return false;
            }
            return true;
        } catch (Exception error) {
            return record(context, "PROCESS_EXIT_TRACE_SUMMARY",
                "status=ERROR,exitTimeMs=" + exitTimestampMs + ",pid=" + pid
                    + ",reasonCode=" + reason + ",errorType=" + error.getClass().getSimpleName(),
                true);
        } finally {
            if (traceStream != null) {
                try { traceStream.close(); } catch (IOException ignored) {}
            }
        }
    }

    private static String sha256Hex(byte[] value) throws Exception {
        byte[] digest = MessageDigest.getInstance("SHA-256").digest(value);
        StringBuilder result = new StringBuilder();
        for (byte item : digest) result.append(String.format(Locale.US, "%02x", item & 0xff));
        return result.toString();
    }

    private static boolean isLikelyTextTrace(byte[] traceBytes) {
        if (traceBytes.length == 0) return true;
        int printable = 0;
        for (byte item : traceBytes) {
            int value = item & 0xff;
            if (value == 9 || value == 10 || value == 13 || (value >= 32 && value <= 126)) printable++;
        }
        return printable * 100L / traceBytes.length >= 85L;
    }

    private static List<String> extractTraceFrames(byte[] traceBytes) {
        if (!isLikelyTextTrace(traceBytes)) return Collections.emptyList();
        String traceText = new String(traceBytes, StandardCharsets.UTF_8);
        List<String> frames = new ArrayList<>();
        for (String line : traceText.split("\\r?\\n")) {
            Matcher matcher = TRACE_FRAME_PATTERN.matcher(line);
            if (!matcher.find()) continue;
            String frame = matcher.group(1);
            if (frame == null || frame.isEmpty()) continue;
            frame = frame.replace('$', '_');
            if (frame.length() > 120) frame = frame.substring(0, 120);
            frames.add(frame);
            if (frames.size() >= MAX_EXIT_TRACE_FRAMES) break;
        }
        return frames;
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
            case 17: return "MEMORY_LIMITER";
            case 18: return "ANOMALY";
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
