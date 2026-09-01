package com.junglesketchbook.tv

import java.net.URI

object UrlPolicy {
    fun normalizeServerUrl(value: String): String? {
        val parsed = parse(value.trim()) ?: return null
        if (!isHttp(parsed) || !isPrivateHost(parsed.host)) return null
        if (parsed.scheme.equals("http", ignoreCase = true) &&
            !parsed.host.equals(CLEAR_TEXT_HOST, ignoreCase = true)
        ) {
            return null
        }
        if (parsed.userInfo != null || parsed.query != null || parsed.fragment != null) return null
        if (parsed.path !in listOf("", "/", "/display.html")) return null
        return URI(
            parsed.scheme.lowercase(),
            null,
            parsed.host.lowercase(),
            parsed.port,
            "/display.html",
            null,
            null,
        ).toASCIIString()
    }

    fun allowsNavigation(serverUrl: String?, candidateUrl: String): Boolean {
        val server = serverUrl?.let(::parse) ?: return false
        val candidate = parse(candidateUrl) ?: return false
        return isHttp(candidate) && sameOrigin(server, candidate)
    }

    fun allowsResource(serverUrl: String?, candidateUrl: String): Boolean {
        val scheme = parse(candidateUrl)?.scheme?.lowercase()
        if (scheme == "data" || scheme == "blob") return true
        return allowsNavigation(serverUrl, candidateUrl)
    }

    private fun parse(value: String): URI? = try {
        URI(value)
    } catch (_: Exception) {
        null
    }

    private fun isHttp(uri: URI): Boolean {
        return uri.isAbsolute &&
            uri.host != null &&
            uri.scheme.lowercase() in setOf("http", "https")
    }

    private fun sameOrigin(first: URI, second: URI): Boolean {
        return first.scheme.equals(second.scheme, ignoreCase = true) &&
            first.host.equals(second.host, ignoreCase = true) &&
            effectivePort(first) == effectivePort(second)
    }

    private fun effectivePort(uri: URI): Int {
        if (uri.port >= 0) return uri.port
        return if (uri.scheme.equals("https", ignoreCase = true)) 443 else 80
    }

    private fun isPrivateHost(rawHost: String?): Boolean {
        val host = rawHost?.lowercase()?.trim('[', ']') ?: return false
        if (host == "localhost" || host.endsWith(".local")) return true
        if (host == "::1" || host.startsWith("fc") || host.startsWith("fd")) return true
        if (host.startsWith("fe80:")) return true

        val octets = host.split('.').map { it.toIntOrNull() }
        if (octets.size != 4 || octets.any { it == null || it !in 0..255 }) return false
        val values = octets.filterNotNull()
        return values[0] == 10 ||
            values[0] == 127 ||
            (values[0] == 169 && values[1] == 254) ||
            (values[0] == 172 && values[1] in 16..31) ||
            (values[0] == 192 && values[1] == 168)
    }

    private const val CLEAR_TEXT_HOST = "sketchbook.local"
}
