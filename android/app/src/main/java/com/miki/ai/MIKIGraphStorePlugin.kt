package com.miki.ai
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.annotation.CapacitorPlugin
@CapacitorPlugin(name = "MIKIGraphStore")
class MIKIGraphStorePlugin : Plugin() {
    @com.getcapacitor.PluginMethod
    fun commit(call: PluginCall) {
        val payload = call.getString("payload") ?: return call.reject("GRAPH_PAYLOAD_REQUIRED")
        val root = java.io.File(context.filesDir, "miki-cognitive-graph").absolutePath
        try { val result = MIKINativeCore.graphStoreCommit(root, payload); call.resolve(JSObject(result)) }
        catch (error: Throwable) { call.reject("GRAPH_NATIVE_COMMIT_FAILED", error as? Exception ?: Exception(error)) }
    }
    @com.getcapacitor.PluginMethod
    fun status(call: PluginCall) { call.resolve(JSObject().put("available", MIKINativeCore.isAvailable()).put("store", "miki-cognitive-graph")) }
}
