package com.miki.ai

import android.content.Context
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.annotation.CapacitorPlugin
import com.worksap.nlp.sudachi.Config
import com.worksap.nlp.sudachi.DictionaryFactory
import com.worksap.nlp.sudachi.Tokenizer
import java.io.File

@CapacitorPlugin(name = "MIKIJapaneseMorphology")
class MIKIJapaneseMorphologyPlugin : Plugin() {
    companion object { private const val DICT_ASSET = "system_core.dic"; private const val VERSION = "20260723-core" }
    private var tokenizer: Tokenizer? = null

    override fun load() {
        super.load()
        try { tokenizer = createTokenizer(context) } catch (_: Throwable) { tokenizer = null }
    }

    @PluginMethod
    fun status(call: PluginCall) {
        val available = tokenizer != null
        val result = JSObject()
        result.put("available", available)
        result.put("dictionaryVersion", VERSION)
        if (!available) result.put("reason", "SUDACHI_DICTIONARY_UNAVAILABLE")
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
            result.put("passed", results.length() == samples.size && (0 until results.length()).all { results.getJSObject(it).getBoolean("nonEmpty") })
            result.put("dictionaryVersion", VERSION)
            result.put("runner", "MIKIJapaneseMorphology.selfTest")
            result.put("samples", results)
            call.resolve(result)
        } catch (e: Throwable) { call.reject("Sudachi selfTest failed", e) }
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
                val pos = com.getcapacitor.JSArray(); m.partOfSpeech().forEach { pos.put(it) }; o.put("partOfSpeech", pos)
                val syn = com.getcapacitor.JSArray(); m.synonymGroupIds().forEach { syn.put(it) }; o.put("synonymGroupIds", syn)
                arr.put(o)
            }
            val result = JSObject(); result.put("analyzer", "SUDACHI"); result.put("dictionaryVersion", VERSION); result.put("morphemes", arr); call.resolve(result)
        } catch (e: Throwable) { call.reject("Sudachi tokenize failed", e) }
    }

    private fun createTokenizer(context: Context): Tokenizer {
        val dictFile = File(context.filesDir, DICT_ASSET)
        if (!dictFile.exists()) context.assets.open(DICT_ASSET).use { input -> dictFile.outputStream().use { input.copyTo(it) } }
        val settings = "{\"systemDict\":\"${dictFile.absolutePath.replace("\\", "\\\\")}\"}"
        return DictionaryFactory().create(Config.fromJsonString(settings)).create()
    }
}
