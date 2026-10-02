import UIKit
import Capacitor

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }

        window = UIWindow(windowScene: windowScene)
        window?.rootViewController = CAPBridgeViewController()
        window?.makeKeyAndVisible()

        #if DEBUG
        // Explicit diagnostic launch only: validate bundled media in the real WKWebView.
        // Does not play sound or change saved preferences.
        if ProcessInfo.processInfo.arguments.contains("--ghost-audio-probe") {
            DispatchQueue.main.asyncAfter(deadline: .now() + 3) { [weak self] in
                guard let controller = self?.window?.rootViewController as? CAPBridgeViewController else { return }
                controller.webView?.evaluateJavaScript("""
                (async () => {
                  const ac = new (window.AudioContext || window.webkitAudioContext)();
                  try {
                    for (const track of MUSIC_TRACKS) {
                      const response = await fetch(track.src);
                      const data = await response.arrayBuffer();
                      const buffer = await ac.decodeAudioData(data.slice(0));
                      let peak = 0, energy = 0;
                      const samples = buffer.getChannelData(0);
                      for (const value of samples) { peak = Math.max(peak, Math.abs(value)); energy += value * value; }
                      console.log("GHOST_AUDIO_PROBE " + JSON.stringify({
                        track:track.label, protocol:location.protocol, status:response.status,
                        ok:response.ok, bytes:data.byteLength, duration:buffer.duration,
                        peak, rms:Math.sqrt(energy/samples.length)
                      }));
                    }
                  } catch (error) { console.error("GHOST_AUDIO_PROBE " + String(error)); }
                  finally { await ac.close(); console.log("GHOST_AUDIO_PROBE_DONE"); }
                })(); void 0;
                """, completionHandler: nil)
            }
        }
        #endif

        SceneDelegateProxy.shared.scene(scene, willConnectTo: session, options: connectionOptions)
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        SceneDelegateProxy.shared.scene(scene, openURLContexts: URLContexts)
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        SceneDelegateProxy.shared.scene(scene, continue: userActivity)
    }
}
