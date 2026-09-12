package com.miki.ai

import android.app.Activity
import android.content.Intent
import android.speech.RecognizerIntent
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.annotation.ActivityCallback
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.annotation.PluginMethod
import java.util.Locale

/**
 * MIKI voice-input boundary.
 * Uses Android's system SpeechRecognizer UI/service; no continuous microphone
 * capture is performed by this plugin. This keeps the first voice milestone
 * explicit and user-triggered, while leaving wake-word/always-on listening for
 * a later separately permissioned component.
 */
@CapacitorPlugin(name = "MIKISpeechRecognition")
class MIKISpeechRecognitionPlugin : Plugin() {
    companion object { private const val DEFAULT_LANGUAGE = "ja-JP" }

    @PluginMethod
    fun status(call: PluginCall) {
        val result = JSObject()
        result.put("available", context.packageManager.hasSystemFeature("android.hardware.microphone"))
        result.put("mode", "USER_TRIGGERED")
        result.put("continuousListening", false)
        result.put("language", DEFAULT_LANGUAGE)
        call.resolve(result)
    }

    @PluginMethod
    fun start(call: PluginCall) {
        val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
            putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
            putExtra(RecognizerIntent.EXTRA_LANGUAGE, call.getString("language") ?: DEFAULT_LANGUAGE)
            putExtra(RecognizerIntent.EXTRA_LANGUAGE_PREFERENCE, call.getString("language") ?: DEFAULT_LANGUAGE)
            putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, call.getInt("maxResults") ?: 3)
            putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, false)
            putExtra(RecognizerIntent.EXTRA_PROMPT, call.getString("prompt") ?: "MIKIに話しかけてください")
        }
        try {
            startActivityForResult(call, intent, "speechResult")
        } catch (e: Throwable) {
            call.reject("SPEECH_RECOGNITION_UNAVAILABLE", e)
        }
    }

    @ActivityCallback
    private fun speechResult(call: PluginCall, resultCode: Int, data: Intent?) {
        if (resultCode != Activity.RESULT_OK) {
            call.reject("SPEECH_RECOGNITION_CANCELLED")
            return
        }
        val matches = data?.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS) ?: arrayListOf()
        val result = JSObject()
        result.put("recognized", matches.isNotEmpty())
        result.put("text", matches.firstOrNull() ?: "")
        val alternatives = com.getcapacitor.JSArray()
        matches.forEach { alternatives.put(it) }
        result.put("alternatives", alternatives)
        result.put("language", data?.getStringExtra(RecognizerIntent.EXTRA_LANGUAGE) ?: DEFAULT_LANGUAGE)
        result.put("source", "ANDROID_SYSTEM_SPEECH")
        result.put("verified", false)
        call.resolve(result)
    }
}
