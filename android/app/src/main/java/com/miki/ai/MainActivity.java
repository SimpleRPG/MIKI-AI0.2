package com.miki.ai;

import android.graphics.Color;
import android.os.Bundle;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.ViewTreeObserver;
import android.webkit.WebView;
import android.widget.FrameLayout;
import android.widget.TextView;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private View nativeStartupStatusView;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(MikiWorkManagerPlugin.class);
        registerPlugin(MIKIJapaneseMorphologyPlugin.class);
        registerPlugin(MIKINativeRunnerPlugin.class);
        registerPlugin(MIKIGraphStorePlugin.class);
        super.onCreate(savedInstanceState);
        mountNativeStartupStatus();
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
