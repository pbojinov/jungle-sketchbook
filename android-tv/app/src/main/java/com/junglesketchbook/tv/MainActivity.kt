package com.junglesketchbook.tv

import android.app.Activity
import android.app.AlertDialog
import android.graphics.Color
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.KeyEvent
import android.view.View
import android.view.WindowInsets
import android.view.WindowInsetsController
import android.view.WindowManager
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.EditText
import android.widget.TextView
import android.widget.Toast
import java.io.ByteArrayInputStream

class MainActivity : Activity() {
    private lateinit var webView: WebView
    private lateinit var nativeStatus: TextView
    private val handler = Handler(Looper.getMainLooper())
    private var configuredUrl: String? = null
    private var lastBackPress = 0L
    private val retry = Runnable { configuredUrl?.let(webView::loadUrl) }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        setContentView(R.layout.activity_main)
        webView = findViewById(R.id.web_view)
        nativeStatus = findViewById(R.id.native_status)
        configureFullscreen()
        configureWebView()

        val savedUrl = getPreferences(MODE_PRIVATE).getString(SERVER_URL, null)
        configuredUrl = savedUrl?.let(UrlPolicy::normalizeServerUrl)
        if (configuredUrl == null) showServerDialog(required = true) else loadDisplay()
    }

    private fun configureWebView() {
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG)
        webView.setBackgroundColor(Color.rgb(8, 21, 44))
        with(webView.settings) {
            javaScriptEnabled = true
            domStorageEnabled = true
            allowFileAccess = false
            allowContentAccess = false
            mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
            mediaPlaybackRequiresUserGesture = false
        }
        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(
                view: WebView,
                request: WebResourceRequest,
            ): Boolean = !UrlPolicy.allowsNavigation(configuredUrl, request.url.toString())

            override fun shouldInterceptRequest(
                view: WebView,
                request: WebResourceRequest,
            ): WebResourceResponse? {
                if (UrlPolicy.allowsResource(configuredUrl, request.url.toString())) return null
                return WebResourceResponse(
                    "text/plain",
                    "utf-8",
                    403,
                    "Blocked",
                    emptyMap(),
                    ByteArrayInputStream("Blocked external request".toByteArray()),
                )
            }

            override fun onPageFinished(view: WebView, url: String) {
                handler.removeCallbacks(retry)
                nativeStatus.visibility = View.GONE
            }

            override fun onReceivedError(
                view: WebView,
                request: WebResourceRequest,
                error: android.webkit.WebResourceError,
            ) {
                if (!request.isForMainFrame) return
                nativeStatus.setText(R.string.retrying)
                nativeStatus.visibility = View.VISIBLE
                handler.removeCallbacks(retry)
                handler.postDelayed(retry, RETRY_DELAY_MS)
            }
        }
    }

    private fun loadDisplay() {
        nativeStatus.setText(R.string.connecting)
        nativeStatus.visibility = View.VISIBLE
        configuredUrl?.let(webView::loadUrl)
    }

    private fun showServerDialog(required: Boolean) {
        val input = EditText(this).apply {
            hint = getString(R.string.server_url_hint)
            setSingleLine(true)
            setText(configuredUrl?.let(Uri::parse)?.let { "${it.scheme}://${it.authority}" } ?: "")
        }
        val builder = AlertDialog.Builder(this)
            .setTitle(R.string.server_url)
            .setView(input)
            .setPositiveButton(R.string.save, null)
            .setCancelable(!required)
        if (!required) builder.setNegativeButton(R.string.cancel, null)
        val dialog = builder.create()
        dialog.setOnShowListener {
            dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener {
                val normalized = UrlPolicy.normalizeServerUrl(input.text.toString())
                if (normalized == null) {
                    input.error = getString(R.string.invalid_server_url)
                    return@setOnClickListener
                }
                configuredUrl = normalized
                getPreferences(MODE_PRIVATE).edit().putString(SERVER_URL, normalized).apply()
                dialog.dismiss()
                loadDisplay()
            }
        }
        dialog.show()
    }

    private fun configureFullscreen() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            window.setDecorFitsSystemWindows(false)
            window.insetsController?.apply {
                hide(WindowInsets.Type.systemBars())
                systemBarsBehavior =
                    WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
            }
        } else {
            @Suppress("DEPRECATION")
            window.decorView.systemUiVisibility =
                View.SYSTEM_UI_FLAG_FULLSCREEN or
                View.SYSTEM_UI_FLAG_HIDE_NAVIGATION or
                View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY or
                View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN or
                View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION or
                View.SYSTEM_UI_FLAG_LAYOUT_STABLE
        }
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) configureFullscreen()
    }

    override fun onKeyDown(keyCode: Int, event: KeyEvent): Boolean {
        if (keyCode == KeyEvent.KEYCODE_DPAD_CENTER && event.repeatCount == 0) {
            event.startTracking()
            return true
        }
        if (keyCode == KeyEvent.KEYCODE_MENU) {
            showServerDialog(required = false)
            return true
        }
        return super.onKeyDown(keyCode, event)
    }

    override fun onKeyLongPress(keyCode: Int, event: KeyEvent): Boolean {
        if (keyCode == KeyEvent.KEYCODE_DPAD_CENTER) {
            showServerDialog(required = false)
            return true
        }
        return super.onKeyLongPress(keyCode, event)
    }

    @Suppress("DEPRECATION")
    override fun onBackPressed() {
        val now = System.currentTimeMillis()
        if (now - lastBackPress <= EXIT_CONFIRM_MS) {
            finish()
            return
        }
        lastBackPress = now
        Toast.makeText(this, R.string.exit_hint, Toast.LENGTH_SHORT).show()
    }

    override fun onDestroy() {
        handler.removeCallbacks(retry)
        webView.stopLoading()
        webView.destroy()
        super.onDestroy()
    }

    companion object {
        private const val SERVER_URL = "server_url"
        private const val RETRY_DELAY_MS = 5_000L
        private const val EXIT_CONFIRM_MS = 2_000L
    }
}
