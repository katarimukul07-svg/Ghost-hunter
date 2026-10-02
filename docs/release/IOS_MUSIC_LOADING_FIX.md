# iOS bundled music response fix

The previous release built and passed browser tests but its native music previews
failed. Capacitor's iOS WebViewAssetHandler sends bundled media using URLResponse
rather than HTTPURLResponse. WKWebView can expose successful local media as
status 0 / ok false; the loader incorrectly rejected it before decoding.

The loader now accepts status 0 only for the capacitor: bundled source, while
retaining normal HTTP failure rejection and audio decoding validation.
Browser offline-cache handling and saved music preferences are unchanged.

Local validation: 125 browser tests passed (one existing skip), plus static and
backend checks. New contract checks cover native status 0, web status 0 rejection,
404/500 rejection and successful HTTP responses. The signed physical-device build
succeeded and was installed. Physical media diagnostics await an unlocked device.

The debug-only --ghost-audio-probe launch argument runs inside the app's WKWebView
and logs each track's response status, encoded byte count, decoded duration,
peak and RMS. It never plays music or changes saved preferences, and is absent
from release builds. A normal launch does not run the probe.

Run on an unlocked attached development iPhone:
xcrun devicectl device process launch --terminate-existing --console --device DEVICE_ID com.mukulkatari.echosteps --ghost-audio-probe

Decoded audio data is a technical check. Actual listening and interruption tests
on the physical device remain necessary before claiming native playback acceptance.
