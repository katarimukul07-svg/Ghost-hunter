/* Native capabilities are discovered at runtime so this file remains safe on GitHub Pages. */
(() => {
  "use strict";

  const capacitor = window.Capacitor;
  const plugins = capacitor && capacitor.Plugins ? capacitor.Plugins : {};
  const native = Boolean(capacitor && typeof capacitor.isNativePlatform === "function" && capacitor.isNativePlatform());

  // App's own plugin (ios/App/App/EchoNativePlugin.swift): Game Center + coin packs.
  const echo = native ? (plugins.EchoNative ||
    (typeof capacitor.registerPlugin === "function" ? capacitor.registerPlugin("EchoNative") : null)) : null;
  const ios = native && typeof capacitor.getPlatform === "function" && capacitor.getPlatform() === "ios";
  const hasEcho = Boolean(ios && echo);

  const gameCenter = Object.freeze({
    available: hasEcho,
    async signIn() { return hasEcho ? echo.gameCenterSignIn() : { authenticated: false }; },
    async submitScore(leaderboardId, score) {
      return hasEcho ? echo.submitScore({ leaderboardId, score: Math.max(0, Math.floor(score)) }) : { submitted: false };
    },
    async show(leaderboardId) { if (hasEcho) await echo.showLeaderboard({ leaderboardId }); },
  });

  const store = Object.freeze({
    available: hasEcho,
    async products(productIds) { return hasEcho ? echo.getProducts({ productIds }) : { products: [], canPay: false }; },
    async purchase(productId) { return hasEcho ? echo.purchase({ productId }) : { status: "failed" }; },
    async pending() { return hasEcho ? echo.pendingTransactions() : { transactions: [] }; },
    async finish(transactionId) { if (hasEcho) await echo.finishTransaction({ transactionId }); },
    onTransaction(callback) { if (hasEcho) echo.addListener("transaction", callback); },
  });

  const bridge = Object.freeze({
    gameCenter, store,
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
