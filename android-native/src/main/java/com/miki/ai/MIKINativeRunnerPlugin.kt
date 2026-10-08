package com.miki.ai

import android.content.ContentUris
import android.content.ContentValues
import android.content.Context
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
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

/**
 * Safe native execution boundary for MIKI.
 *
 * This plugin deliberately does NOT execute arbitrary Java/Kotlin/JS code,
 * shell commands, scripts, URLs, or component implementation text.
 * A production component must be explicitly registered as a native adapter.
 */
@CapacitorPlugin(name = "MIKINativeRunner")
class MIKINativeRunnerPlugin : Plugin() {

    private val runnerId = "android-native"
    private val runtimeLogFileName = "MIKI_RUNTIME_LOG.txt"

    @PluginMethod
    fun ensureRuntimeLogFile(call: PluginCall) {
        try {
            validateRuntimeLogFilename(call.getString("filename"))
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
                call.reject("RUNTIME_LOG_DOWNLOADS_API_UNSUPPORTED")
                return
            }
            val (uri, created) = getOrCreateRuntimeLogUri()
            if (created) {
                context.contentResolver.openOutputStream(uri, "w")?.use { output ->
                    output.write("# MIKI runtime log v1\n".toByteArray(Charsets.UTF_8))
                    output.flush()
                } ?: throw IllegalStateException("RUNTIME_LOG_OUTPUT_STREAM_UNAVAILABLE")
                context.contentResolver.update(
                    uri,
                    ContentValues().apply { put(MediaStore.Downloads.IS_PENDING, 0) },
                    null,
                    null
                )
            }
            call.resolve(JSObject().apply {
                put("success", true)
                put("filename", runtimeLogFileName)
                put("location", Environment.DIRECTORY_DOWNLOADS)
                put("uri", uri.toString())
                put("created", created)
            })
        } catch (error: Throwable) {
            call.reject("RUNTIME_LOG_FILE_INIT_FAILED", error.message ?: error.toString())
        }
    }

    @PluginMethod
    fun appendRuntimeLog(call: PluginCall) {
        val line = call.getString("line")
        if (line.isNullOrEmpty() || line.length > 500_000) {
            call.reject("RUNTIME_LOG_LINE_INVALID")
            return
        }
        try {
            validateRuntimeLogFilename(call.getString("filename"))
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
                call.reject("RUNTIME_LOG_DOWNLOADS_API_UNSUPPORTED")
                return
            }
            val (uri, created) = getOrCreateRuntimeLogUri()
            if (created) {
                context.contentResolver.openOutputStream(uri, "w")?.use { output ->
                    output.write("# MIKI runtime log v1\n".toByteArray(Charsets.UTF_8))
                    output.flush()
                } ?: throw IllegalStateException("RUNTIME_LOG_OUTPUT_STREAM_UNAVAILABLE")
            }
            context.contentResolver.openOutputStream(uri, "wa")?.use { output ->
                output.write(line.toByteArray(Charsets.UTF_8))
                output.flush()
            } ?: throw IllegalStateException("RUNTIME_LOG_APPEND_STREAM_UNAVAILABLE")
            if (created) {
                context.contentResolver.update(
                    uri,
                    ContentValues().apply { put(MediaStore.Downloads.IS_PENDING, 0) },
                    null,
                    null
                )
            }
            call.resolve(JSObject().apply {
                put("success", true)
                put("byte_length", line.toByteArray(Charsets.UTF_8).size)
                put("filename", runtimeLogFileName)
            })
        } catch (error: Throwable) {
            call.reject("RUNTIME_LOG_APPEND_FAILED", error.message ?: error.toString())
        }
    }

    private fun validateRuntimeLogFilename(requested: String?) {
        if (requested != null && requested != runtimeLogFileName) {
            throw IllegalArgumentException("RUNTIME_LOG_FILENAME_FORBIDDEN")
        }
    }

    private fun getOrCreateRuntimeLogUri(): Pair<Uri, Boolean> {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
            throw IllegalStateException("RUNTIME_LOG_DOWNLOADS_API_UNSUPPORTED")
        }

        val resolver = context.contentResolver
        val relativePath = "${Environment.DIRECTORY_DOWNLOADS}/"
        resolver.query(
            MediaStore.Downloads.EXTERNAL_CONTENT_URI,
            arrayOf(MediaStore.Downloads._ID),
            "${MediaStore.Downloads.DISPLAY_NAME} = ? AND ${MediaStore.Downloads.RELATIVE_PATH} = ?",
            arrayOf(runtimeLogFileName, relativePath),
            null
        )?.use { cursor ->
            if (cursor.moveToFirst()) {
                return ContentUris.withAppendedId(
                    MediaStore.Downloads.EXTERNAL_CONTENT_URI,
                    cursor.getLong(0)
                ) to false
            }
        }

        val values = ContentValues().apply {
            put(MediaStore.Downloads.DISPLAY_NAME, runtimeLogFileName)
            put(MediaStore.Downloads.MIME_TYPE, "text/plain")
            put(MediaStore.Downloads.RELATIVE_PATH, relativePath)
            put(MediaStore.Downloads.IS_PENDING, 1)
        }
        val uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values)
            ?: throw IllegalStateException("RUNTIME_LOG_MEDIASTORE_INSERT_FAILED")
        return uri to true
    }

    @PluginMethod
    fun health(call: PluginCall) {
        val result = JSObject()
        result.put("ready", true)
        result.put("runner_id", runnerId)
        call.resolve(result)
    }

    @PluginMethod
    fun execute(call: PluginCall) {
        val requestId = call.getString("request_id")
        val componentId = call.getString("component_id")
        val implementationHash = call.getString("implementation_hash")
        val artifactSnapshotKey = call.getString("artifact_snapshot_key")
        val environment = call.getString("environment")
        val testCategory = call.getString("test_category")
        val testCaseId = call.getString("test_case_id")
        val inputSummary = call.getString("input_summary") ?: ""

        if (requestId.isNullOrBlank() || componentId.isNullOrBlank() || implementationHash.isNullOrBlank() || artifactSnapshotKey.isNullOrBlank() || testCaseId.isNullOrBlank()) {
            call.reject("必須フィールドが不足しています")
            return
        }
        if (environment != "ANDROID") {
            call.reject("ANDROID環境以外はNative Runnerで実行できません")
            return
        }

        // Never interpret implementation_hash, input_summary, or componentId
        // as executable code. Only an explicitly registered adapter may run.
        val adapter = NativeTestAdapterRegistry.find(componentId)
        if (adapter == null) {
            val result = JSObject()
            result.put("request_id", requestId)
            result.put("passed", false)
            result.put("output_summary", "登録済みNative Test Adapterがありません")
            result.put("error_message", "UNREGISTERED_NATIVE_ADAPTER:$componentId")
            result.put("environment", "ANDROID")
            result.put("runner_id", runnerId)
            result.put("implementation_hash", implementationHash)
            result.put("artifact_snapshot_key", artifactSnapshotKey)
            result.put("test_case_id", testCaseId)
            call.resolve(result)
            return
        }

        try {
            val started = System.nanoTime()
            val outcome = adapter.run(
                NativeTestContext(
                    requestId = requestId,
                    componentId = componentId,
                    implementationHash = implementationHash,
                    artifactSnapshotKey = artifactSnapshotKey,
                    testCaseId = testCaseId,
                    testCategory = testCategory ?: "NORMAL",
                    inputSummary = inputSummary,
                    androidContext = bridge.context,
                )
            )
            val durationMs = (System.nanoTime() - started) / 1_000_000L
            val result = JSObject()
            result.put("request_id", requestId)
            result.put("passed", outcome.passed)
            result.put("output_summary", outcome.outputSummary)
            result.put("error_message", outcome.errorMessage ?: "")
            result.put("duration_ms", durationMs)
            result.put("environment", "ANDROID")
            result.put("runner_id", runnerId)
            result.put("implementation_hash", implementationHash)
            result.put("artifact_snapshot_key", artifactSnapshotKey)
            result.put("test_case_id", testCaseId)
            call.resolve(result)
        } catch (t: Throwable) {
            val result = JSObject()
            result.put("request_id", requestId)
            result.put("passed", false)
            result.put("output_summary", "Native Test Adapter例外")
            result.put("error_message", "NATIVE_ADAPTER_EXCEPTION:${t.javaClass.simpleName}")
            result.put("environment", "ANDROID")
            result.put("runner_id", runnerId)
            result.put("implementation_hash", implementationHash)
            result.put("artifact_snapshot_key", artifactSnapshotKey)
            result.put("test_case_id", testCaseId)
            call.resolve(result)
        }
    }
}

data class NativeTestContext(
    val requestId: String,
    val componentId: String,
    val implementationHash: String,
    val artifactSnapshotKey: String,
    val testCaseId: String,
    val testCategory: String,
    val inputSummary: String,
    val androidContext: Context,
)

data class NativeTestOutcome(
    val passed: Boolean,
    val outputSummary: String,
    val errorMessage: String? = null,
)

fun interface NativeTestAdapter {
    fun run(context: NativeTestContext): NativeTestOutcome
}

/**
 * Explicit allow-list. Adding an adapter is a code-reviewed native change;
 * nothing received from JavaScript can create an adapter dynamically.
 */
object NativeTestAdapterRegistry {
    private val adapters = mutableMapOf<String, NativeTestAdapter>()

    init {
        // P0-5最小Smoke Adapter。入力をそのまま返すだけで、
        // shell/process/network/eval等は一切呼び出さない。
        register("android.native_echo") { context ->
            NativeTestOutcome(
                passed = true,
                outputSummary = context.inputSummary,
            )
        }
        // P0-5: 実機でSudachi本体＋system_core.dicを検証するallow-list adapter。
        register("android.japanese_morphology_selftest") { context ->
            runSudachiSelfTest(context)
        }
    }


    private fun runSudachiSelfTest(context: NativeTestContext): NativeTestOutcome {
        return try {
            val dictFile = File(context.androidContext.filesDir, "system_core.dic")
            if (!dictFile.exists()) {
                context.androidContext.assets.open("system_core.dic").use { input ->
                    dictFile.outputStream().use { output -> input.copyTo(output) }
                }
            }
            val settings = "{\"systemDict\":\"${dictFile.absolutePath.replace("\\", "\\\\")}\"}"
            val tokenizer: Tokenizer = DictionaryFactory().create(Config.fromJsonString(settings, PathAnchor.none())).create()
            val samples = listOf("今日はいい天気ですね。", "MIKIがコードをAndroidで実行する。", "Sudachiで日本語を解析する。")
            val checks = samples.map { text ->
                val morphemes = tokenizer.tokenize(Tokenizer.SplitMode.C, text)
                Triple(morphemes.isNotEmpty(), morphemes.any { it.readingForm().isNotBlank() }, morphemes.size)
            }
            val passed = checks.all { it.first && it.second }
            val counts = checks.map { it.third }.joinToString(",")
            if (passed) NativeTestOutcome(true, "SUDACHI_SELFTEST_PASS;dictionary=20260723-core;counts=$counts")
            else NativeTestOutcome(false, "SUDACHI_SELFTEST_FAIL;dictionary=20260723-core;counts=$counts", "SUDACHI_SELFTEST_ASSERTION_FAILED")
        } catch (t: Throwable) {
            NativeTestOutcome(false, "SUDACHI_SELFTEST_ERROR", "${t.javaClass.simpleName}:${t.message ?: "unknown"}")
        }
    }

    fun register(componentId: String, adapter: NativeTestAdapter) {
        require(componentId.isNotBlank()) { "componentId must not be blank" }
        adapters[componentId] = adapter
    }

    fun find(componentId: String): NativeTestAdapter? = adapters[componentId]
}
