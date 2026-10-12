package com.miki.ai;

import android.content.Context;
import android.util.Log;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.text.SimpleDateFormat;
import java.util.Arrays;
import java.util.Date;
import java.util.HashSet;
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
        "WEBVIEW_RENDER_PROCESS_GONE", "WEBVIEW_PROVIDER_INFO"
    ));

    private NativeWebViewDiagnosticJournal() {}

    public static synchronized void record(Context context, String event, String details, boolean durable) {
        if (context == null || !ALLOWED_EVENTS.contains(event)) return;
        String safeDetails = details == null ? "" : details.replaceAll("[^A-Za-z0-9_.,:= -]", "_");
        if (safeDetails.length() > 180) safeDetails = safeDetails.substring(0, 180);
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
        } catch (IOException error) {
            Log.e("MIKI_NATIVE_DIAGNOSTICS", "native diagnostic write failed for " + event, error);
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
