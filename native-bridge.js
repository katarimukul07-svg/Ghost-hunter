/* Native capabilities are discovered at runtime so this file remains safe on GitHub Pages. */
(() => {
  "use strict";

  const capacitor = window.Capacitor;
  const plugins = capacitor && capacitor.Plugins ? capacitor.Plugins : {};
  const native = Boolean(capacitor && typeof capacitor.isNativePlatform === "function" && capacitor.isNativePlatform());

  const bridge = Object.freeze({
    isNative: native,
    platform: native && typeof capacitor.getPlatform === "function" ? capacitor.getPlatform() : "web",
    async haptic(kind = "light") {
      if (native && plugins.Haptics) {
        try {
          const style = kind === "heavy" ? "HEAVY" : kind === "medium" ? "MEDIUM" : "LIGHT";
          await plugins.Haptics.impact({ style });
          return;
        } catch (error) {
          console.warn("Native haptic unavailable", error);
        }
      }
      if (navigator.vibrate) navigator.vibrate(kind === "heavy" ? 45 : kind === "medium" ? 25 : 15);
    },
    async exitApp() {
      if (native && plugins.App && typeof plugins.App.exitApp === "function") {
        await plugins.App.exitApp();
      }
    },
  });

  window.EchoStepsNative = bridge;

  if (!native) return;

  if (plugins.StatusBar) {
    Promise.resolve(plugins.StatusBar.hide()).catch(error => console.warn("Could not hide status bar", error));
  }

  if (plugins.App) {
    plugins.App.addListener("appStateChange", ({ isActive }) => {
      window.dispatchEvent(new CustomEvent("echosteps:app-state", { detail: { isActive } }));
    });
    plugins.App.addListener("backButton", () => {
      window.dispatchEvent(new CustomEvent("echosteps:back"));
    });
  }
})();
