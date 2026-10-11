import UIKit
import Capacitor

/// Registers the app's own native plugin (Game Center + coin packs).
class EchoBridgeViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(EchoNativePlugin())
    }
}
