package com.miki.ai

import java.io.File

/**
 * Minimal, fail-closed JNI boundary for the Rust native core.
 *
 * The shared library is optional during the migration. Android remains usable
 * when it is absent; callers receive an explicit unavailable status and use
 * the existing verified TypeScript/Kotlin path.
 */
object MIKINativeCore {
    private const val EXPECTED_API_VERSION = 8
    private const val EXPECTED_ABI_MAGIC = 0x4D494B49

    private val loadFailure: Throwable?

    init {
        loadFailure = try {
            System.loadLibrary("miki_native_core")
            null
        } catch (error: Throwable) {
            error
        }
    }

    private external fun nativeApiVersion(): Int
    private external fun nativeAbiMagic(): Int
    private external fun nativeSha256File(path: String): String
    private external fun nativeScanWorkspace(root: String): String
    private external fun nativeGitBlobSha1File(path: String): String
    private external fun nativeCopyFile(source: String, destination: String): String
    private external fun nativeBuildZip(workspaceRoot: String, outputPath: String, requestJson: String): String
    private external fun nativeCompareRevisions(requestJson: String): String
    private external fun nativeSearchWorkspaceText(root: String, query: String, limit: Int): String
    private external fun nativeVerifyArtifact(path: String, expectedSha256: String, expectedBytes: Long): String

    fun searchWorkspaceText(root: File, query: String, limit: Int): String = nativeSearchWorkspaceText(root.canonicalPath, query, limit)

    fun verifyArtifact(path: File, expectedSha256: String, expectedBytes: Long): String = nativeVerifyArtifact(path.canonicalPath, expectedSha256, expectedBytes)

    fun compareRevisions(requestJson: String): String {
        val health = health()
        if (!health.available || !health.compatible) throw IllegalStateException(health.reason ?: "RUST_NATIVE_CORE_UNAVAILABLE")
        return nativeCompareRevisions(requestJson)
    }

    fun buildZip(workspaceRoot: File, output: File, requestJson: String): String {
        val health = health()
        if (!health.available || !health.compatible) throw IllegalStateException(health.reason ?: "RUST_NATIVE_CORE_UNAVAILABLE")
        if (!workspaceRoot.isDirectory) throw IllegalArgumentException("WORKSPACE_ROOT_NOT_DIRECTORY")
        return nativeBuildZip(workspaceRoot.canonicalPath, output.canonicalPath, requestJson)
    }

    fun copyFile(source: File, destination: File): Long {
        val health = health()
        if (!health.available || !health.compatible) throw IllegalStateException(health.reason ?: "RUST_NATIVE_CORE_UNAVAILABLE")
        if (!source.isFile) throw IllegalArgumentException("COPY_SOURCE_NOT_FILE")
        return nativeCopyFile(source.canonicalPath, destination.canonicalPath).toLong()
    }

    fun gitBlobSha1File(path: File): String {
        val health = health()
        if (!health.available || !health.compatible) throw IllegalStateException(health.reason ?: "RUST_NATIVE_CORE_UNAVAILABLE")
        if (!path.isFile) throw IllegalArgumentException("GIT_BLOB_TARGET_NOT_FILE")
        return nativeGitBlobSha1File(path.canonicalPath)
    }

    fun scanWorkspace(root: File): String {
        val health = health()
        if (!health.available || !health.compatible) throw IllegalStateException(health.reason ?: "RUST_NATIVE_CORE_UNAVAILABLE")
        if (!root.isDirectory) throw IllegalArgumentException("WORKSPACE_ROOT_NOT_DIRECTORY")
        return nativeScanWorkspace(root.canonicalPath)
    }

    fun sha256File(path: File): String {
        val health = health()
        if (!health.available || !health.compatible) {
            throw IllegalStateException(health.reason ?: "RUST_NATIVE_CORE_UNAVAILABLE")
        }
        if (!path.isFile) throw IllegalArgumentException("HASH_TARGET_NOT_FILE")
        return nativeSha256File(path.canonicalPath)
    }

    fun health(): NativeCoreHealth {
        val failure = loadFailure
        if (failure != null) {
            return NativeCoreHealth(
                available = false,
                compatible = false,
                apiVersion = 0,
                reason = "RUST_LIBRARY_NOT_LOADED:${failure.javaClass.simpleName}"
            )
        }
        return try {
            val apiVersion = nativeApiVersion()
            val compatible = apiVersion == EXPECTED_API_VERSION && nativeAbiMagic() == EXPECTED_ABI_MAGIC
            NativeCoreHealth(
                available = true,
                compatible = compatible,
                apiVersion = apiVersion,
                reason = if (compatible) null else "RUST_ABI_CONTRACT_MISMATCH"
            )
        } catch (error: Throwable) {
            NativeCoreHealth(
                available = false,
                compatible = false,
                apiVersion = 0,
                reason = "RUST_HEALTH_FAILED:${error.javaClass.simpleName}"
            )
        }
    }
}

data class NativeCoreHealth(
    val available: Boolean,
    val compatible: Boolean,
    val apiVersion: Int,
    val reason: String?
)
