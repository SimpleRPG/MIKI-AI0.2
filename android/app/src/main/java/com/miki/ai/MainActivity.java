package com.miki.ai;

import android.content.pm.PackageInfo;
import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.ViewTreeObserver;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.WebView;
import android.widget.FrameLayout;
import android.widget.TextView;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.WebViewListener;

public class MainActivity extends BridgeActivity {
    private View nativeStartupStatusView;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(MikiWorkManagerPlugin.class);
        registerPlugin(MIKIJapaneseMorphologyPlugin.class);
        registerPlugin(MIKINativeRunnerPlugin.class);
        registerPlugin(MIKIGraphStorePlugin.class);
        recordWebViewProviderInfo();
        super.onCreate(savedInstanceState);
        NativeWebViewDiagnosticJournal.record(this, "ACTIVITY_CREATE", "savedStatePresent=" + (savedInstanceState != null), false);
        registerWebViewDiagnostics();
        mountNativeStartupStatus();
    }

    @Override
    public void onResume() {
        super.onResume();
        NativeWebViewDiagnosticJournal.record(this, "ACTIVITY_RESUME", "", false);
    }

    @Override
    public void onPause() {
        NativeWebViewDiagnosticJournal.record(this, "ACTIVITY_PAUSE", "", false);
        super.onPause();
    }

    @Override
    public void onStop() {
        NativeWebViewDiagnosticJournal.record(this, "ACTIVITY_STOP", "", false);
        super.onStop();
    }

    @Override
    public void onDestroy() {
        NativeWebViewDiagnosticJournal.record(this, "ACTIVITY_DESTROY", "", false);
        super.onDestroy();
    }

    private void recordWebViewProviderInfo() {
        final int sdk = Build.VERSION.SDK_INT;
        if (sdk < Build.VERSION_CODES.O) {
            NativeWebViewDiagnosticJournal.record(
                this, "WEBVIEW_PROVIDER_INFO", "status=UNSUPPORTED,sdk=" + sdk, true
            );
            return;
        }
        try {
            PackageInfo provider = WebView.getCurrentWebViewPackage();
            if (provider == null) {
                NativeWebViewDiagnosticJournal.record(
                    this, "WEBVIEW_PROVIDER_INFO", "status=UNAVAILABLE,sdk=" + sdk, true
                );
                return;
            }
            String version = provider.versionName != null ? provider.versionName : "UNKNOWN";
            NativeWebViewDiagnosticJournal.record(
                this, "WEBVIEW_PROVIDER_INFO",
                "status=AVAILABLE,provider=" + provider.packageName + ",version=" + version + ",sdk=" + sdk,
                true
            );
        } catch (RuntimeException error) {
            NativeWebViewDiagnosticJournal.record(
                this, "WEBVIEW_PROVIDER_INFO",
                "status=ERROR,errorType=" + error.getClass().getSimpleName() + ",sdk=" + sdk,
                true
            );
        }
    }

    private void registerWebViewDiagnostics() {
        if (getBridge() == null) {
            NativeWebViewDiagnosticJournal.record(this, "WEBVIEW_LISTENER_UNAVAILABLE", "bridgeAvailable=false", true);
            return;
        }
        getBridge().addWebViewListener(new WebViewListener() {
            private int resourceErrorCount = 0;

            @Override
            public void onPageStarted(WebView webView) {
                resourceErrorCount = 0;
                NativeWebViewDiagnosticJournal.record(
                    MainActivity.this, "WEBVIEW_PAGE_STARTED", "progress=" + webView.getProgress(), false
                );
            }

            @Override
            public void onPageCommitVisible(WebView webView, String url) {
                NativeWebViewDiagnosticJournal.record(
                    MainActivity.this, "WEBVIEW_PAGE_COMMIT_VISIBLE", "progress=" + webView.getProgress(), false
                );
            }

            @Override
            public void onReceivedError(WebView webView) {
                resourceErrorCount = Math.min(resourceErrorCount + 1, 9999);
            }

            @Override
            public void onReceivedHttpError(WebView webView) {
                resourceErrorCount = Math.min(resourceErrorCount + 1, 9999);
            }

            @Override
            public void onPageLoaded(WebView webView) {
                NativeWebViewDiagnosticJournal.record(
                    MainActivity.this, "WEBVIEW_PAGE_LOADED",
                    "progress=" + webView.getProgress() + ",resourceErrors=" + resourceErrorCount, false
                );
            }

            @Override
            public boolean onRenderProcessGone(WebView webView, RenderProcessGoneDetail detail) {
                boolean didCrash = detail != null && detail.didCrash();
                int priorityAtExit = detail != null ? detail.rendererPriorityAtExit() : -1;
                NativeWebViewDiagnosticJournal.record(
                    MainActivity.this, "WEBVIEW_RENDER_PROCESS_GONE",
                    "didCrash=" + didCrash + ",priorityAtExit=" + priorityAtExit + ",resourceErrors=" + resourceErrorCount,
                    true
                );
                // Diagnostic-only: return false because this listener does not destroy/replace the failed WebView.
                return false;
            }
        });
    }

    /**
     * P218/P219:
     * WebView/JSへ制御が渡るまでのNative側だけを可視化する。
     * 起動状態そのものはstartupRecoveryServiceが唯一のJS側Authorityとして保持する。
     * WebViewが最初に描画された時点で、この引き渡し用表示を消す。
     */
    private void mountNativeStartupStatus() {
        final View content = findViewById(android.R.id.content);
        if (!(content instanceof ViewGroup)) {
            return;
        }

        final ViewGroup root = (ViewGroup) content;

        final FrameLayout overlay = new FrameLayout(this);
        overlay.setBackgroundColor(Color.rgb(2, 6, 23));
        overlay.setClickable(false);
        overlay.setFocusable(false);

        final TextView status = new TextView(this);
        status.setText("MIKI 起動中\nAndroid Nativeを起動しています");
        status.setTextColor(Color.rgb(226, 232, 240));
        status.setTextSize(18);
        status.setGravity(Gravity.CENTER);
        status.setPadding(48, 48, 48, 48);

        overlay.addView(
            status,
            new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
        );

        root.addView(
            overlay,
            new ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
        );

        nativeStartupStatusView = overlay;

        final WebView webView = findViewById(R.id.webview);
        if (webView == null) {
            return;
        }

        webView.getViewTreeObserver().addOnPreDrawListener(new ViewTreeObserver.OnPreDrawListener() {
            private boolean handedOff = false;

            @Override
            public boolean onPreDraw() {
                if (!handedOff) {
                    handedOff = true;
                    webView.getViewTreeObserver().removeOnPreDrawListener(this);
                    root.removeView(overlay);
                    if (nativeStartupStatusView == overlay) {
                        nativeStartupStatusView = null;
                    }
                }
                return true;
            }
        });
    }
}
