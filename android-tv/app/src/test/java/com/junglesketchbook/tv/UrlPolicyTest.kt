package com.junglesketchbook.tv

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class UrlPolicyTest {
    @Test
    fun normalizesPrivateLanServersToTheDisplay() {
        assertEquals(
            "http://sketchbook.local:8000/display.html",
            UrlPolicy.normalizeServerUrl("http://sketchbook.local:8000"),
        )
        assertEquals(
            "https://sketchbook.local/display.html",
            UrlPolicy.normalizeServerUrl("https://sketchbook.local/"),
        )
        assertEquals(
            "https://[fd00::5]:8000/display.html",
            UrlPolicy.normalizeServerUrl("https://[fd00::5]:8000"),
        )
    }

    @Test
    fun rejectsPublicOrCredentialedServers() {
        assertNull(UrlPolicy.normalizeServerUrl("https://example.com"))
        assertNull(UrlPolicy.normalizeServerUrl("http://192.168.1.50:8000"))
        assertNull(UrlPolicy.normalizeServerUrl("http://other.local:8000"))
        assertNull(UrlPolicy.normalizeServerUrl("http://user@192.168.1.50:8000"))
        assertNull(UrlPolicy.normalizeServerUrl("http://192.168.1.50:8000/admin.html"))
        assertNull(UrlPolicy.normalizeServerUrl("javascript:alert(1)"))
    }

    @Test
    fun navigationAndResourcesStayOnTheConfiguredOrigin() {
        val server = "http://sketchbook.local:8000/display.html"
        assertTrue(
            UrlPolicy.allowsNavigation(server, "http://sketchbook.local:8000/api/events"),
        )
        assertFalse(
            UrlPolicy.allowsNavigation(server, "http://other.local:8000/display.html"),
        )
        assertFalse(
            UrlPolicy.allowsNavigation(server, "https://sketchbook.local:8000/display.html"),
        )
        assertTrue(UrlPolicy.allowsResource(server, "data:image/png;base64,AAAA"))
        assertFalse(UrlPolicy.allowsResource(server, "https://tracker.example/pixel"))
    }
}
