package com.miki.ai

import android.content.Context
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.worksap.nlp.sudachi.Config
import com.worksap.nlp.sudachi.DictionaryFactory
import com.worksap.nlp.sudachi.PathAnchor
import com.worksap.nlp.sudachi.Tokenizer
import java.io.BufferedInputStream
import java.io.File
import java.io.FileInputStream
import java.security.MessageDigest
import java.util.zip.ZipFile
import org.json.JSONObject

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

    @PluginMethod
    fun health(call: PluginCall) {
        val nativeCore = MIKINativeCore.health()
        val result = JSObject()
        result.put("ready", true)
        result.put("runner_id", runnerId)
        result.put("rust_available", nativeCore.available)
        result.put("rust_compatible", nativeCore.compatible)
        result.put("rust_api_version", nativeCore.apiVersion)
        if (nativeCore.reason != null) result.put("rust_reason", nativeCore.reason)
        call.resolve(result)
    }

    @PluginMethod
    fun nativeCoreHealth(call: PluginCall) {
        val nativeCore = MIKINativeCore.health()
        val result = JSObject()
        result.put("available", nativeCore.available)
        result.put("compatible", nativeCore.compatible)
        result.put("api_version", nativeCore.apiVersion)
        if (nativeCore.reason != null) result.put("reason", nativeCore.reason)
        call.resolve(result)
    }

    @PluginMethod
    fun hashWorkspaceFile(call: PluginCall) {
        val relativePath = call.getString("relative_path")?.trim()
        if (relativePath.isNullOrEmpty()) {
            call.reject("RELATIVE_PATH_REQUIRED")
            return
        }
        val workspaceRoot = File(context.filesDir, "miki/workspaces").canonicalFile
        val target = File(workspaceRoot, relativePath).canonicalFile
        if (target != workspaceRoot && !target.path.startsWith(workspaceRoot.path + File.separator)) {
            call.reject("WORKSPACE_PATH_ESCAPE_REJECTED")
            return
        }
        try {
            val startedAt = System.nanoTime()
            val sha256 = MIKINativeCore.sha256File(target)
            val result = JSObject()
            result.put("relative_path", relativePath)
            result.put("sha256", sha256)
            result.put("byte_length", target.length())
            result.put("duration_ms", (System.nanoTime() - startedAt) / 1_000_000)
            result.put("engine", "RUST")
            result.put("api_version", MIKINativeCore.health().apiVersion)
            call.resolve(result)
        } catch (error: Throwable) {
            call.reject("RUST_HASH_FILE_FAILED", error)
        }
    }

    @PluginMethod
    fun searchWorkspaceText(call: PluginCall) {
        val query = call.getString("query")?.trim()
        val limit = call.getInt("limit") ?: 500
        if (query.isNullOrEmpty() || limit !in 1..5000) {
            call.reject("SEARCH_REQUEST_INVALID")
            return
        }
        val workspaceRoot = File(context.filesDir, "miki/workspaces").canonicalFile
        Thread {
            try {
                val result = JSObject()
                result.put("hits", JSArray(MIKINativeCore.searchWorkspaceText(workspaceRoot, query, limit)))
                result.put("engine", "RUST")
                result.put("api_version", MIKINativeCore.health().apiVersion)
                call.resolve(result)
            } catch (error: Throwable) {
                call.reject("RUST_SEARCH_TEXT_FAILED", error)
            }
        }.start()
    }

    @PluginMethod
    fun verifyPackageArtifact(call: PluginCall) {
        val name = call.getString("name")?.trim()
        val sha256 = call.getString("sha256")?.trim()
        val byteLength = call.getLong("byte_length")
        if (name.isNullOrEmpty() || sha256 == null || !sha256.matches(Regex("^[a-f0-9]{64}$")) || byteLength == null || byteLength < 0L || name.contains('/') || name.contains('\\')) {
            call.reject("ARTIFACT_EXPECTATION_INVALID")
            return
        }
        val packageRoot = File(context.filesDir, "miki/packages").canonicalFile
        val artifact = File(packageRoot, name).canonicalFile
        if (!artifact.path.startsWith(packageRoot.path + File.separator) || !artifact.isFile) {
            call.reject("ARTIFACT_PATH_INVALID")
            return
        }
        Thread {
            try {
                val verification = JSObject(MIKINativeCore.verifyArtifact(artifact, sha256, byteLength))
                verification.put("name", name)
                verification.put("engine", "RUST")
                verification.put("api_version", MIKINativeCore.health().apiVersion)
                call.resolve(verification)
            } catch (error: Throwable) {
                call.reject("RUST_VERIFY_ARTIFACT_FAILED", error)
            }
        }.start()
    }

    @PluginMethod
    fun compareRevisions(call: PluginCall) {
        val baseline = call.getArray("baseline")
        val candidate = call.getArray("candidate")
        if (baseline == null || candidate == null || baseline.length() > 100000 || candidate.length() > 100000) {
            call.reject("REVISION_COMPARE_REQUEST_INVALID")
            return
        }
        Thread {
            try {
                val request = JSONObject().put("baseline", baseline).put("candidate", candidate)
                val rust = JSONObject(MIKINativeCore.compareRevisions(request.toString()))
                fun toMap(rows: JSArray): java.util.SortedMap<String,String> {
                    val map = java.util.TreeMap<String,String>()
                    for(index in 0 until rows.length()) {
                        val row=rows.getJSONObject(index);val path=row.getString("path");val sha=row.getString("sha256")
                        if(map.put(path,sha)!=null)throw IllegalArgumentException("REVISION_PATH_DUPLICATE:$path")
                    }
                    return map
                }
                val before=toMap(baseline);val after=toMap(candidate);val added=ArrayList<String>();val changed=ArrayList<String>();val deleted=ArrayList<String>();var unchanged=0
                for((path,sha) in after){val previous=before[path];if(previous==null)added.add(path)else if(previous!=sha)changed.add(path)else unchanged++}
                for(path in before.keys)if(!after.containsKey(path))deleted.add(path)
                if(rust.getJSONArray("added").toString()!=JSArray(added).toString()||rust.getJSONArray("changed").toString()!=JSArray(changed).toString()||rust.getJSONArray("deleted").toString()!=JSArray(deleted).toString()||rust.getInt("unchanged_count")!=unchanged)throw IllegalStateException("RUST_REVISION_COMPARE_MISMATCH")
                val result=JSObject();result.put("added",JSArray(added));result.put("changed",JSArray(changed));result.put("deleted",JSArray(deleted));result.put("unchanged_count",unchanged);result.put("matched",true);result.put("api_version",MIKINativeCore.health().apiVersion);call.resolve(result)
            }catch(error:Throwable){call.reject("RUST_COMPARE_REVISIONS_FAILED",error)}
        }.start()
    }

    @PluginMethod
    fun buildWorkspaceZip(call: PluginCall) {
        val outputName = call.getString("output_name")?.trim()
        val entries = call.getArray("entries")
        if (outputName.isNullOrEmpty() || !outputName.endsWith(".zip") || outputName.contains('/') || entries == null || entries.length() == 0 || entries.length() > 5000) {
            call.reject("ZIP_BUILD_REQUEST_INVALID")
            return
        }
        val workspaceRoot = File(context.filesDir, "miki/workspaces").canonicalFile
        val packageRoot = File(context.filesDir, "miki/packages").canonicalFile
        if (!packageRoot.exists()) packageRoot.mkdirs()
        val output = File(packageRoot, outputName).canonicalFile
        if (!output.path.startsWith(packageRoot.path + File.separator)) {
            call.reject("ZIP_OUTPUT_PATH_ESCAPE_REJECTED")
            return
        }
        Thread {
            try {
                val request = JSONObject()
                request.put("entries", entries)
                val startedAt = System.nanoTime()
                val receipt = JSONObject(MIKINativeCore.buildZip(workspaceRoot, output, request.toString()))
                val expectedNames = ArrayList<String>()
                val expectedSizes = HashMap<String, Long>()
                for (index in 0 until entries.length()) {
                    val entry = entries.getJSONObject(index)
                    val sourceRelativePath = entry.getString("source_relative_path")
                    val zipEntryPath = entry.getString("zip_entry_path")
                    val source = File(workspaceRoot, sourceRelativePath).canonicalFile
                    if (!source.path.startsWith(workspaceRoot.path + File.separator) || !source.isFile) throw SecurityException("ZIP_SOURCE_INVALID:$sourceRelativePath")
                    expectedNames.add(zipEntryPath)
                    expectedSizes[zipEntryPath] = source.length()
                }
                expectedNames.sort()
                ZipFile(output).use { zipFile ->
                    val actualNames = zipFile.entries().asSequence().filter { !it.isDirectory }.map { it.name }.toList().sorted()
                    if (actualNames != expectedNames) throw IllegalStateException("RUST_ZIP_ENTRY_LIST_MISMATCH")
                    for (name in expectedNames) {
                        val row = zipFile.getEntry(name) ?: throw IllegalStateException("RUST_ZIP_ENTRY_MISSING:$name")
                        if (row.size != expectedSizes[name]) throw IllegalStateException("RUST_ZIP_ENTRY_SIZE_MISMATCH:$name")
                    }
                }
                if (receipt.getInt("file_count") != expectedNames.size || receipt.getLong("output_bytes") != output.length()) throw IllegalStateException("RUST_ZIP_RECEIPT_MISMATCH")
                val result = JSObject()
                result.put("output_name", outputName)
                result.put("file_count", expectedNames.size)
                result.put("output_bytes", output.length())
                result.put("sha256", sha256FileKotlin(output))
                result.put("duration_ms", (System.nanoTime() - startedAt) / 1_000_000)
                result.put("matched", true)
                result.put("api_version", MIKINativeCore.health().apiVersion)
                result.put("entries", JSArray(expectedNames))
                call.resolve(result)
            } catch (error: Throwable) {
                output.delete()
                call.reject("RUST_BUILD_ZIP_FAILED", error)
            }
        }.start()
    }

    @PluginMethod
    fun copyZipTxt(call: PluginCall) {
        val sourceName = call.getString("source_name")?.trim()
        val destinationName = call.getString("destination_name")?.trim()
        if (sourceName.isNullOrEmpty() || destinationName.isNullOrEmpty() || sourceName.contains('/') || destinationName.contains('/')) {
            call.reject("ARTIFACT_FILE_NAME_INVALID")
            return
        }
        if (!sourceName.endsWith(".zip") || !destinationName.endsWith(".zip.txt")) {
            call.reject("ZIPTXT_EXTENSION_CONTRACT_FAILED")
            return
        }
        val packageRoot = File(context.filesDir, "miki/packages").canonicalFile
        val source = File(packageRoot, sourceName).canonicalFile
        val destination = File(packageRoot, destinationName).canonicalFile
        if (!source.path.startsWith(packageRoot.path + File.separator) || !destination.path.startsWith(packageRoot.path + File.separator)) {
            call.reject("ARTIFACT_PATH_ESCAPE_REJECTED")
            return
        }
        Thread {
            try {
                val copiedBytes = MIKINativeCore.copyFile(source, destination)
                val sourceSha = sha256FileKotlin(source)
                val destinationSha = sha256FileKotlin(destination)
                if (sourceSha != destinationSha || copiedBytes != source.length() || copiedBytes != destination.length()) {
                    destination.delete()
                    throw IllegalStateException("RUST_ZIPTXT_MISMATCH")
                }
                val result = JSObject()
                result.put("source_name", sourceName)
                result.put("destination_name", destinationName)
                result.put("sha256", sourceSha)
                result.put("byte_length", copiedBytes)
                result.put("matched", true)
                result.put("api_version", MIKINativeCore.health().apiVersion)
                call.resolve(result)
            } catch (error: Throwable) {
                call.reject("RUST_COPY_ZIPTXT_FAILED", error)
            }
        }.start()
    }

    @PluginMethod
    fun gitBlobShaWorkspaceFile(call: PluginCall) {
        val relativePath = call.getString("relative_path")?.trim()?.replace('\\', '/')
        if (relativePath.isNullOrEmpty() || relativePath.startsWith('/') || relativePath.split('/').contains("..")) {
            call.reject("WORKSPACE_RELATIVE_PATH_INVALID")
            return
        }
        val workspaceRoot = File(context.filesDir, "miki/workspaces").canonicalFile
        val target = File(workspaceRoot, relativePath).canonicalFile
        if (!target.path.startsWith(workspaceRoot.path + File.separator) || !target.isFile) {
            call.reject("GIT_BLOB_TARGET_INVALID")
            return
        }
        Thread {
            try {
                val rustSha1 = MIKINativeCore.gitBlobSha1File(target)
                val reference = MessageDigest.getInstance("SHA-1")
                reference.update("blob ${target.length()}\u0000".toByteArray(Charsets.UTF_8))
                BufferedInputStream(FileInputStream(target), 1024 * 1024).use { input ->
                    val buffer = ByteArray(1024 * 1024)
                    while (true) {
                        val read = input.read(buffer)
                        if (read < 0) break
                        if (read > 0) reference.update(buffer, 0, read)
                    }
                }
                val referenceSha1 = reference.digest().toHex()
                if (rustSha1 != referenceSha1) throw IllegalStateException("RUST_GIT_BLOB_MISMATCH:$relativePath")
                val result = JSObject()
                result.put("relative_path", relativePath)
                result.put("rust_blob_sha", rustSha1)
                result.put("reference_blob_sha", referenceSha1)
                result.put("matched", true)
                result.put("byte_length", target.length())
                result.put("api_version", MIKINativeCore.health().apiVersion)
                call.resolve(result)
            } catch (error: Throwable) {
                call.reject("RUST_GIT_BLOB_FAILED", error)
            }
        }.start()
    }

    @PluginMethod
    fun scanWorkspace(call: PluginCall) {
        val workspaceRoot = File(context.filesDir, "miki/workspaces").canonicalFile
        if (!workspaceRoot.exists()) workspaceRoot.mkdirs()
        Thread {
            try {
                val startedAt = System.nanoTime()
                val rustReceipt = JSONObject(MIKINativeCore.scanWorkspace(workspaceRoot))
                val referenceFiles = workspaceRoot.walkTopDown().filter { it.isFile && !java.nio.file.Files.isSymbolicLink(it.toPath()) }.map {
                    val relative = it.relativeTo(workspaceRoot).path.replace('\\', '/')
                    relative to it.length()
                }.sortedBy { it.first }.toList()
                val rustFiles = rustReceipt.getJSONArray("files")
                if (rustFiles.length() != referenceFiles.size) throw IllegalStateException("RUST_SCAN_FILE_COUNT_MISMATCH")
                var totalBytes = 0L
                for (index in referenceFiles.indices) {
                    val rustFile = rustFiles.getJSONObject(index)
                    val reference = referenceFiles[index]
                    if (rustFile.getString("path") != reference.first || rustFile.getLong("byte_length") != reference.second) {
                        throw IllegalStateException("RUST_SCAN_ENTRY_MISMATCH:${reference.first}")
                    }
                    totalBytes += reference.second
                }
                if (rustReceipt.getLong("total_bytes") != totalBytes) throw IllegalStateException("RUST_SCAN_TOTAL_BYTES_MISMATCH")
                val response = JSObject()
                response.put("mode", "RUST_ONLY")
                response.put("engine", "RUST")
                response.put("api_version", MIKINativeCore.health().apiVersion)
                response.put("file_count", referenceFiles.size)
                response.put("total_bytes", totalBytes)
                response.put("duration_ms", (System.nanoTime() - startedAt) / 1_000_000)
                response.put("files", JSArray(rustFiles.toString()))
                call.resolve(response)
            } catch (error: Throwable) {
                call.reject("RUST_SCAN_WORKSPACE_FAILED", error)
            }
        }.start()
    }

    @PluginMethod
    fun hashWorkspaceFiles(call: PluginCall) {
        val relativePaths = call.getArray("relative_paths")
        if (relativePaths == null || relativePaths.length() == 0) {
            call.reject("RELATIVE_PATHS_REQUIRED")
            return
        }
        if (relativePaths.length() > 5000) {
            call.reject("HASH_FILE_COUNT_LIMIT_EXCEEDED")
            return
        }

        val workspaceRoot = File(context.filesDir, "miki/workspaces").canonicalFile
        val seen = HashSet<String>()
        val normalizedPaths = ArrayList<String>()
        for (index in 0 until relativePaths.length()) {
            val raw = relativePaths.optString(index, "").trim().replace('\\', '/')
            if (raw.isEmpty() || raw.startsWith('/') || raw.split('/').contains("..")) {
                call.reject("WORKSPACE_RELATIVE_PATH_INVALID:$index")
                return
            }
            if (seen.add(raw)) normalizedPaths.add(raw)
        }
        normalizedPaths.sort()

        Thread {
            try {
                val startedAt = System.nanoTime()
                val results = JSArray()
                val aggregateDigest = MessageDigest.getInstance("SHA-256")
                var totalBytes = 0L

                for (relativePath in normalizedPaths) {
                    val target = File(workspaceRoot, relativePath).canonicalFile
                    if (target != workspaceRoot && !target.path.startsWith(workspaceRoot.path + File.separator)) {
                        throw SecurityException("WORKSPACE_PATH_ESCAPE_REJECTED:$relativePath")
                    }
                    if (!target.isFile) throw IllegalArgumentException("HASH_TARGET_NOT_FILE:$relativePath")

                    val rustStartedAt = System.nanoTime()
                    val rustSha256 = MIKINativeCore.sha256File(target)
                    val rustDurationMs = (System.nanoTime() - rustStartedAt) / 1_000_000

                    val kotlinStartedAt = System.nanoTime()
                    val kotlinSha256 = sha256FileKotlin(target)
                    val kotlinDurationMs = (System.nanoTime() - kotlinStartedAt) / 1_000_000
                    val matched = rustSha256 == kotlinSha256
                    if (!matched) throw IllegalStateException("RUST_HASH_MISMATCH:$relativePath")

                    val byteLength = target.length()
                    totalBytes += byteLength
                    aggregateDigest.update(relativePath.toByteArray(Charsets.UTF_8))
                    aggregateDigest.update(0)
                    aggregateDigest.update(rustSha256.toByteArray(Charsets.US_ASCII))
                    aggregateDigest.update(0)

                    val item = JSObject()
                    item.put("relative_path", relativePath)
                    item.put("rust_sha256", rustSha256)
                    item.put("reference_sha256", kotlinSha256)
                    item.put("matched", true)
                    item.put("byte_length", byteLength)
                    item.put("rust_duration_ms", rustDurationMs)
                    item.put("reference_duration_ms", kotlinDurationMs)
                    results.put(item)
                }

                val response = JSObject()
                response.put("mode", "RUST_ONLY")
                response.put("engine", "RUST")
                response.put("api_version", MIKINativeCore.health().apiVersion)
                response.put("file_count", normalizedPaths.size)
                response.put("matched_count", normalizedPaths.size)
                response.put("total_bytes", totalBytes)
                response.put("aggregate_sha256", aggregateDigest.digest().toHex())
                response.put("duration_ms", (System.nanoTime() - startedAt) / 1_000_000)
                response.put("files", results)
                call.resolve(response)
            } catch (error: Throwable) {
                call.reject("RUST_HASH_FILES_FAILED", error)
            }
        }.start()
    }

    private fun sha256FileKotlin(file: File): String {
        val digest = MessageDigest.getInstance("SHA-256")
        BufferedInputStream(FileInputStream(file), 1024 * 1024).use { input ->
            val buffer = ByteArray(1024 * 1024)
            while (true) {
                val read = input.read(buffer)
                if (read < 0) break
                if (read > 0) digest.update(buffer, 0, read)
            }
        }
        return digest.digest().toHex()
    }

    private fun ByteArray.toHex(): String = joinToString(separator = "") { byte -> "%02x".format(byte) }

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
