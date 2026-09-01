# Jungle Sketchbook Android TV wrapper

This is a deliberately thin, sideloaded Android TV shell around the web display.
The web server remains the product and source of truth.

## Toolchain

- Android Studio Quail 3 or another version compatible with AGP 9.3.2
- JDK 17
- Android SDK 37 and Build Tools 36.0.0
- Gradle 9.5 when building outside Android Studio

The versions follow the official Android Gradle Plugin 9.3 compatibility table:
<https://developer.android.com/build/releases/agp-9-3-0-release-notes>.

## Build and sideload

1. Open this `android-tv` directory in Android Studio and let it sync.
2. Run `app` on an Android TV emulator once.
3. Build a debug APK from **Build → Build APK(s)**.
4. Enable developer options and USB/network debugging on the Bravia.
5. Install with `adb install -r app/build/outputs/apk/debug/app-debug.apk`.
6. Launch **Jungle Sketchbook** from the TV home screen.
7. Give the MacBook the local hostname `sketchbook`, then enter
   `http://sketchbook.local:8000`. Alternatively, configure local HTTPS and use
   its private address.

Press **Back twice** to exit. Press the remote's **Menu** button, or long-press
the center D-pad button, to change the server URL.

## Security boundary

The wrapper accepts private IPv4/IPv6, link-local, localhost, or `.local` HTTPS
origins. Unencrypted HTTP is accepted only for the exact hostname
`sketchbook.local`. Every WebView navigation and subresource request is
restricted to the configured origin; `data:` and `blob:` resources are the only
exceptions.
File and content access are disabled, mixed content is rejected, and external
links never open inside the WebView.

Android disables cleartext traffic by default for modern targets. The network
configuration keeps that default and adds one narrow household exception for
`sketchbook.local`; `UrlPolicy` independently enforces the same restriction. Do
not expose the Node server to the public internet. Android documents the tradeoff
here:
<https://developer.android.com/privacy-and-security/security-config#CleartextTrafficPermitted>.

## Behavior

- Hardware-accelerated fullscreen WebView with the screen kept awake
- JavaScript and DOM storage enabled for the existing display
- Same-origin URL allowlist
- Five-second retry after main-frame network failure
- System bars hidden again when window focus returns
- First-run server URL dialog and remote-accessible settings gesture

The implementation follows Android's WebView and immersive-mode guidance:

- <https://developer.android.com/develop/ui/views/layout/webapps/webview>
- <https://developer.android.com/develop/ui/views/layout/immersive>

## Validation

`UrlPolicyTest` covers private-host normalization, public-host rejection, and
same-origin navigation/resource decisions. Run it from Android Studio or with a
configured Gradle 9.5 installation:

```bash
gradle :app:testDebugUnitTest
```

The repository's generic CI environment does not include the Android SDK, so an
APK build and Sony Bravia soak test remain explicit manual merge gates.
