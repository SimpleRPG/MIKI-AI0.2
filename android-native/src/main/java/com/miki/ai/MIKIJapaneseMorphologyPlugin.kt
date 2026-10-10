package com.miki.ai

import android.content.Context
import android.os.SystemClock
import android.util.Log
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.worksap.nlp.sudachi.Config
import com.worksap.nlp.sudachi.DictionaryFactory
import com.worksap.nlp.sudachi.PathAnchor
import com.worksap.nlp.sudachi.Tokenizer
import java.io.File

@CapacitorPlugin(name = "MIKIJapaneseMorphology")
class MIKIJapaneseMorphologyPlugin : Plugin() {
    companion object {
        private const val TAG = "MIKIJapaneseMorph"
        private const val DICT_ASSET = "system_core.dic"
        private const val VERSION = "20260723-core"
    }
    @Volatile
    private var tokenizer: Tokenizer? = null
    @Volatile
    private var initializationState: String = "INITIALIZING"
    @Volatile
    private var initializationMessage: String = "Sudachi日本語解析エンジンを初期化中です"

    override fun load() {
        super.load()
        Thread {
            val startedAt = SystemClock.elapsedRealtime()
            Log.i(TAG, "SUDACHI_INIT_BEGIN version=$VERSION")
            try {
                initializationState = "INITIALIZING"
                initializationMessage = "Sudachi辞書を準備中です"
                tokenizer = createTokenizer(context)
                initializationState = "READY"
                initializationMessage = "Sudachi日本語解析エンジンの準備が完了しました"
                val dictionaryBytes = File(context.filesDir, DICT_ASSET).length()
                Log.i(
                    TAG,
                    "SUDACHI_INIT_READY version=$VERSION elapsedMs=${SystemClock.elapsedRealtime() - startedAt} dictionaryBytes=$dictionaryBytes"
                )
            } catch (error: Throwable) {
                tokenizer = null
                initializationState = "FAILED"
                initializationMessage = "Sudachi初期化に失敗しました: ${error.message ?: error.javaClass.simpleName}"
                Log.e(
                    TAG,
                    "SUDACHI_INIT_FAILED elapsedMs=${SystemClock.elapsedRealtime() - startedAt} errorType=${error.javaClass.simpleName}"
                )
            }
        }.apply {
            name = "MIKI-Sudachi-Init"
        }.start()
    }

    @PluginMethod
    fun status(call: PluginCall) {
        val available = tokenizer != null
        val result = JSObject()
        result.put("available", available)
        result.put("dictionaryVersion", VERSION)
        result.put("state", initializationState)
        result.put("message", initializationMessage)
        if (!available) result.put("reason", if (initializationState == "FAILED") "SUDACHI_INITIALIZATION_FAILED" else "SUDACHI_DICTIONARY_UNAVAILABLE")
        call.resolve(result)
    }

    @PluginMethod
    fun selfTest(call: PluginCall) {
        val samples = listOf("今日はいい天気ですね。", "MIKIがコードをAndroidで実行する。", "Sudachiで日本語を解析する。")
        val results = com.getcapacitor.JSArray()
        try {
            val tok = tokenizer ?: run { call.reject("Sudachi is unavailable"); return }
            samples.forEach { text ->
                val morphemes = tok.tokenize(Tokenizer.SplitMode.C, text)
                val item = JSObject()
                item.put("text", text)
                item.put("morphemeCount", morphemes.size)
                item.put("nonEmpty", morphemes.isNotEmpty())
                item.put("hasReading", morphemes.any { it.readingForm().isNotBlank() })
                results.put(item)
            }
            val result = JSObject()
            result.put("passed", results.length() == samples.size && (0 until results.length()).all { results.getJSONObject(it).optBoolean("nonEmpty", false) })
            result.put("dictionaryVersion", VERSION)
            result.put("runner", "MIKIJapaneseMorphology.selfTest")
            result.put("samples", results)
            call.resolve(result)
        } catch (e: Throwable) { call.reject("Sudachi selfTest failed", e as? Exception ?: Exception(e)) }
    }

    @PluginMethod
    fun tokenize(call: PluginCall) {
        val text = call.getString("text") ?: ""
        if (text.isBlank()) { call.reject("text is empty"); return }
        val tok = tokenizer ?: run { call.reject("Sudachi is unavailable"); return }
        val mode = when ((call.getString("mode") ?: "C").uppercase()) {
            "A" -> Tokenizer.SplitMode.A
            "B" -> Tokenizer.SplitMode.B
            else -> Tokenizer.SplitMode.C
        }
        try {
            val arr = com.getcapacitor.JSArray()
            tok.tokenize(mode, text).forEach { m ->
                val o = JSObject()
                o.put("surface", m.surface())
                o.put("normalizedForm", m.normalizedForm())
                o.put("dictionaryForm", m.dictionaryForm())
                o.put("readingForm", m.readingForm())
                o.put("begin", m.begin())
                o.put("end", m.end())
                o.put("isOov", m.isOOV())
                o.put("wordId", m.wordId)
                o.put("dictionaryId", m.dictionaryId)
                val pos = com.getcapacitor.JSArray()
                for (part in m.partOfSpeech()) {
                    pos.put(part)
                }
                o.put("partOfSpeech", pos)
                val syn = com.getcapacitor.JSArray(); m.synonymGroupIds.forEach { syn.put(it) }; o.put("synonymGroupIds", syn)
                arr.put(o)
            }
            val result = JSObject(); result.put("analyzer", "SUDACHI"); result.put("dictionaryVersion", VERSION); result.put("morphemes", arr); call.resolve(result)
        } catch (e: Throwable) { call.reject("Sudachi tokenize failed", e as? Exception ?: Exception(e)) }
    }

    private fun createTokenizer(context: Context): Tokenizer {
        val dictFile = File(context.filesDir, DICT_ASSET)
        if (!dictFile.isFile || dictFile.length() == 0L) {
            if (dictFile.exists() && !dictFile.delete()) {
                throw IllegalStateException("SUDACHI_STALE_DICTIONARY_FILE_CANNOT_DELETE")
            }
            context.assets.open(DICT_ASSET).use { input ->
                dictFile.outputStream().use { output -> input.copyTo(output) }
            }
        }
        if (!dictFile.isFile || dictFile.length() <= 0L) {
            throw IllegalStateException("SUDACHI_SYSTEM_DICTIONARY_MISSING_OR_EMPTY")
        }
        val settings = """{"systemDict":"$DICT_ASSET","oovProviderPlugin":[{"class":"com.worksap.nlp.sudachi.SimpleOovProviderPlugin","oovPOS":["補助記号","一般","*","*","*","*"],"leftId":5968,"rightId":5968,"cost":3857}]}"""
        return DictionaryFactory().create(
            Config.fromJsonString(settings, PathAnchor.filesystem(context.filesDir.absolutePath))
        ).create()
    }
}
