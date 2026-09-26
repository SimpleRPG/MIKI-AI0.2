package com.miki.ai

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Canvas
import android.util.Base64
import android.webkit.ConsoleMessage
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import org.json.JSONArray
import java.io.ByteArrayOutputStream
import android.os.BatteryManager
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.PowerManager
import android.util.Log
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
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
import org.json.JSONObject
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean

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

        // 指示1: ヘッドレスWebView排他制御用フラグ (複数タブ/多重起動の禁止・順次処理)
        private val isFetchingPage = AtomicBoolean(false)
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

    /**
     * 指示1: ヘッドレスWebViewによる外部ページの動的レンダリングとテキスト抽出
     * - URLを開いてレンダリング完了(onPageFinished + SPA猶予待機)を待つ
     * - document.body.innerText 相当のプレーンテキストを抽出して返す
     * - タイムアウト(既定10秒)制御
     * - 同時実行を排他制御(1件ずつ順次処理)し、終了後は必ずWebViewを即時破棄してメモリ/バッテリー解放
     */
    @PluginMethod
    fun runCandidateBrowserE2E(call: PluginCall) {
        val url = call.getString("url") ?: run { call.reject("url is required"); return }
        val scenarios = call.getArray("scenarios") ?: JSONArray()
        val timeoutMs = (call.getInt("timeoutMs") ?: 120000).coerceIn(5000, 180000)
        if (!url.startsWith("http://127.0.0.1:") && !url.startsWith("http://localhost:")) { call.reject("Candidate preview URL must be loopback"); return }
        val handler = Handler(Looper.getMainLooper())
        handler.post {
            val wv = WebView(context)
            val consoleErrors = JSONArray()
            val network = JSONArray()
            wv.settings.javaScriptEnabled = true
            wv.settings.domStorageEnabled = true
            wv.settings.allowFileAccess = false
            wv.settings.allowContentAccess = false
            wv.webChromeClient = object : WebChromeClient() {
                override fun onConsoleMessage(message: ConsoleMessage): Boolean {
                    if (message.messageLevel() == ConsoleMessage.MessageLevel.ERROR) consoleErrors.put(message.message())
                    return true
                }
            }
            wv.webViewClient = object : WebViewClient() {
                override fun shouldInterceptRequest(view: WebView?, request: WebResourceRequest?): android.webkit.WebResourceResponse? {
                    request?.let { network.put(JSONObject().put("url", it.url.toString()).put("method", it.method).put("at", System.currentTimeMillis())) }
                    return super.shouldInterceptRequest(view, request)
                }
                override fun onPageFinished(view: WebView?, loadedUrl: String?) {
                    val scenarioJson = JSONObject.quote(scenarios.toString())
                    val script = """
                    (function(){const scenarios=JSON.parse($scenarioJson);window.__MIKI_E2E_DONE__=false;window.__MIKI_E2E_RESULT__=null;
                    const sleep=ms=>new Promise(r=>setTimeout(r,ms));const one=async(sc)=>{const steps=[];let passed=true;history.replaceState({},'',sc.path||'/');for(let i=0;i<(sc.steps||[]).length;i++){const a=sc.steps[i],t=Date.now();try{if(a.type==='WAIT'){await sleep(Number(a.value||250));}else if(a.type==='ASSERT_URL'){if(!location.href.includes(a.expected||''))throw Error('ASSERT_URL_FAILED');}else if(a.type==='ASSERT_NO_CONSOLE_ERRORS'){}else{let el=null,limit=Date.now()+Number(a.timeoutMs||5000);while(Date.now()<limit&&!el){el=document.querySelector(a.selector||'');if(!el)await sleep(50);}if(!el)throw Error('ELEMENT_TIMEOUT:'+a.selector);if(a.type==='CLICK')el.click();else if(a.type==='FILL'){el.focus();el.value=a.value||'';el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));}else if(a.type==='CHECK'){if(!el.checked)el.click();}else if(a.type==='SELECT'){el.value=a.value||'';el.dispatchEvent(new Event('change',{bubbles:true}));}else if(a.type==='ASSERT_VISIBLE'){const r=el.getBoundingClientRect();if(r.width<=0||r.height<=0)throw Error('ASSERT_VISIBLE_FAILED');}else if(a.type==='ASSERT_TEXT'){if(!(el.textContent||'').includes(a.expected||''))throw Error('ASSERT_TEXT_FAILED');}else if(a.type==='ASSERT_VALUE'){if(el.value!==(a.expected||''))throw Error('ASSERT_VALUE_FAILED');}}steps.push({index:i,type:a.type,passed:true,durationMs:Date.now()-t});}catch(e){passed=false;steps.push({index:i,type:a.type,passed:false,durationMs:Date.now()-t,error:String(e&&e.message||e)});break;}}return {scenarioId:sc.scenarioId,passed,steps,finalUrl:location.href,dom:document.documentElement.outerHTML};};(async()=>{const results=[];for(const sc of scenarios)results.push(await one(sc));window.__MIKI_E2E_RESULT__=results;window.__MIKI_E2E_DONE__=true;})();return true;})()
                    """.trimIndent()
                    view?.evaluateJavascript(script, null)
                    pollE2EResult(view!!, call, scenarios, consoleErrors, network, System.currentTimeMillis(), timeoutMs, handler)
                }
            }
            wv.layout(0,0,1080,1920)
            wv.loadUrl(url)
        }
    }

    private fun pollE2EResult(wv: WebView, call: PluginCall, scenarios: JSONArray, consoleErrors: JSONArray, network: JSONArray, startedAt: Long, timeoutMs: Int, handler: Handler) {
        if (System.currentTimeMillis() - startedAt > timeoutMs) { wv.destroy(); call.reject("BROWSER_E2E_TIMEOUT"); return }
        wv.evaluateJavascript("JSON.stringify({done:window.__MIKI_E2E_DONE__===true,result:window.__MIKI_E2E_RESULT__})") { raw ->
            try {
                val decoded = if (raw != null && raw.startsWith("\"")) JSONObject("{\"v\":$raw}").getString("v") else raw
                val state = JSONObject(decoded ?: "{}")
                if (!state.optBoolean("done")) { handler.postDelayed({ pollE2EResult(wv,call,scenarios,consoleErrors,network,startedAt,timeoutMs,handler) },250); return@evaluateJavascript }
                val results = state.optJSONArray("result") ?: JSONArray()
                val bitmap = Bitmap.createBitmap(1080,1920,Bitmap.Config.ARGB_8888); wv.draw(Canvas(bitmap)); val out=ByteArrayOutputStream(); bitmap.compress(Bitmap.CompressFormat.PNG,100,out); val shot=Base64.encodeToString(out.toByteArray(),Base64.NO_WRAP)
                val screenshots=JSONArray(); val domSnapshots=JSONArray(); var passed=true
                for(i in 0 until results.length()){val r=results.getJSONObject(i);if(!r.optBoolean("passed"))passed=false;val id=r.optString("scenarioId");screenshots.put(JSONObject().put("scenarioId",id).put("base64",shot).put("differenceRatio",compareBaseline(scenarios,id,bitmap)));domSnapshots.put(JSONObject().put("scenarioId",id).put("html",r.optString("dom")));r.remove("dom")}
                val reasons=JSONArray();if(consoleErrors.length()>0){passed=false;reasons.put("BROWSER_CONSOLE_ERRORS")}
                wv.destroy();call.resolve(JSObject().put("success",passed).put("results",results).put("consoleErrors",consoleErrors).put("network",network).put("screenshots",screenshots).put("domSnapshots",domSnapshots).put("reasons",reasons))
            } catch(e:Exception){wv.destroy();call.reject("BROWSER_E2E_RESULT_PARSE_FAILED:${e.message}")}
        }
    }

    private fun compareBaseline(scenarios: JSONArray, scenarioId: String, actual: Bitmap): Double {
        for(i in 0 until scenarios.length()){val sc=scenarios.optJSONObject(i)?:continue;if(sc.optString("scenarioId")!=scenarioId)continue;val encoded=sc.optString("baselineScreenshotBase64");if(encoded.isBlank())return 0.0;return try{val bytes=Base64.decode(encoded,Base64.DEFAULT);val baseline=android.graphics.BitmapFactory.decodeByteArray(bytes,0,bytes.size)?:return 1.0;val width=minOf(actual.width,baseline.width);val height=minOf(actual.height,baseline.height);var different=0L;var total=0L;var y=0;while(y<height){var x=0;while(x<width){val a=actual.getPixel(x,y);val b=baseline.getPixel(x,y);val delta=kotlin.math.abs(android.graphics.Color.red(a)-android.graphics.Color.red(b))+kotlin.math.abs(android.graphics.Color.green(a)-android.graphics.Color.green(b))+kotlin.math.abs(android.graphics.Color.blue(a)-android.graphics.Color.blue(b));if(delta>30)different++;total++;x+=4};y+=4};baseline.recycle();if(total==0L)1.0 else different.toDouble()/total.toDouble()}catch(e:Exception){1.0}}
        return 0.0
    }

    @PluginMethod
    fun fetchRenderedPage(call: PluginCall) {
        val url = call.getString("url")
        if (url.isNullOrBlank()) {
            call.reject("URL is required")
            return
        }

        val timeoutMs = call.getLong("timeoutMs") ?: 10000L
        val renderWaitMs = call.getLong("renderWaitMs") ?: 1500L

        // 排他制御: 複数タブ/WebViewの同時起動を防止し、1件ずつ順次処理
        if (!isFetchingPage.compareAndSet(false, true)) {
            call.reject("Another headless webview fetch is already in progress. Please retry sequentially.")
            return
        }

        val mainHandler = Handler(Looper.getMainLooper())
        var webView: WebView? = null
        var isCompleted = false
        val timeoutRunnable = Runnable {
            if (!isCompleted) {
                isCompleted = true
                Log.w(TAG, "fetchRenderedPage: Timeout reached ($timeoutMs ms) for $url")
                mainHandler.post {
                    try {
                        webView?.stopLoading()
                        webView?.destroy()
                    } catch (e: Exception) {
                        Log.w(TAG, "Error destroying webview on timeout: ${e.message}")
                    } finally {
                        webView = null
                        isFetchingPage.set(false)
                    }
                }
                call.reject("Timeout fetching rendered page ($timeoutMs ms): $url")
            }
        }

        // タイムアウト監視をスケジュール (10秒)
        mainHandler.postDelayed(timeoutRunnable, timeoutMs)

        mainHandler.post {
            try {
                Log.i(TAG, "fetchRenderedPage: Creating headless WebView for $url")
                val ctx = context ?: run {
                    mainHandler.removeCallbacks(timeoutRunnable)
                    isFetchingPage.set(false)
                    call.reject("Context is null")
                    return@post
                }

                val wv = WebView(ctx)
                webView = wv
                val settings = wv.settings
                settings.javaScriptEnabled = true
                settings.domStorageEnabled = true
                settings.databaseEnabled = false
                settings.allowFileAccess = false
                // 一般的なモバイルブラウザのUser-Agentを設定 (ボット判定回避)
                settings.userAgentString = "Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36 MikiBrowser/1.0"

                var pageFinishedFired = false

                wv.webViewClient = object : WebViewClient() {
                    override fun onPageFinished(view: WebView?, loadedUrl: String?) {
                        super.onPageFinished(view, loadedUrl)
                        if (pageFinishedFired || isCompleted) return
                        pageFinishedFired = true

                        Log.i(TAG, "fetchRenderedPage: onPageFinished fired for $loadedUrl. Waiting ${renderWaitMs}ms for SPA DOM render...")

                        // SPA/JS描画のための猶予待機 (1〜2秒)
                        mainHandler.postDelayed({
                            if (isCompleted) return@postDelayed

                            val extractScript = """
                                (function() {
                                    try {
                                        var body = document.body;
                                        if (!body) return document.documentElement ? document.documentElement.innerText : '';
                                        return body.innerText || body.textContent || '';
                                    } catch(e) {
                                        return '';
                                    }
                                })();
                            """.trimIndent()

                            wv.evaluateJavascript(extractScript) { rawResult ->
                                if (isCompleted) return@evaluateJavascript
                                isCompleted = true
                                mainHandler.removeCallbacks(timeoutRunnable)

                                try {
                                    val text = if (rawResult != null && rawResult != "null") {
                                        try {
                                            JSONObject("{\"text\":$rawResult}").getString("text")
                                        } catch (je: Exception) {
                                            if (rawResult.startsWith("\"") && rawResult.endsWith("\"") && rawResult.length >= 2) {
                                                rawResult.substring(1, rawResult.length - 1)
                                                    .replace("\\n", "\n")
                                                    .replace("\\t", "\t")
                                                    .replace("\\\"", "\"")
                                                    .replace("\\\\", "\\")
                                            } else {
                                                rawResult
                                            }
                                        }
                                    } else {
                                        ""
                                    }

                                    Log.i(TAG, "fetchRenderedPage: Extracted text (${text.length} chars) from $loadedUrl")
                                    val ret = JSObject()
                                    ret.put("success", true)
                                    ret.put("text", text.trim())
                                    ret.put("url", loadedUrl ?: url)
                                    ret.put("length", text.trim().length)
                                    call.resolve(ret)
                                } catch (e: Exception) {
                                    Log.e(TAG, "fetchRenderedPage: Error parsing evaluateJavascript result: ${e.message}", e)
                                    call.reject("Error parsing DOM text: ${e.message}")
                                } finally {
                                    // 処理後は必ずWebViewを破棄してメモリ・バッテリーを即時解放
                                    try {
                                        wv.stopLoading()
                                        wv.destroy()
                                    } catch (e: Exception) {
                                        Log.w(TAG, "Error destroying webview: ${e.message}")
                                    }
                                    webView = null
                                    isFetchingPage.set(false)
                                }
                            }
                        }, renderWaitMs)
                    }

                    override fun onReceivedError(view: WebView?, errorCode: Int, description: String?, failingUrl: String?) {
                        super.onReceivedError(view, errorCode, description, failingUrl)
                        Log.w(TAG, "fetchRenderedPage: onReceivedError: $errorCode, $description for $failingUrl")
                    }
                }

                wv.loadUrl(url)
            } catch (e: Exception) {
                Log.e(TAG, "fetchRenderedPage: Failed to initialize WebView: ${e.message}", e)
                mainHandler.removeCallbacks(timeoutRunnable)
                isCompleted = true
                try {
                    webView?.destroy()
                } catch (de: Exception) {}
                webView = null
                isFetchingPage.set(false)
                call.reject("Failed to initialize WebView: ${e.message}", e)
            }
        }
    }
}
