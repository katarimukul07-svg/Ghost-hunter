import { test, expect } from "@playwright/test";
import { completeTutorialForMostTests } from "./helpers.js";
completeTutorialForMostTests(test);

// A stand-in for ios/App/App/EchoNativePlugin.swift, so the web layer can be
// tested without StoreKit or Game Center.
function mockNative({ pending = [] } = {}) {
  return ({ pending }) => {
    const calls = { scores: [], finished: [], shown: 0 };
    let listener = null, next = 1;
    window.__nativeCalls = calls;
    window.__emitTransaction = t => listener && listener(t);
    window.Capacitor = {
      isNativePlatform: () => true,
      getPlatform: () => "ios",
      Plugins: {
        EchoNative: {
          gameCenterSignIn: async () => ({ authenticated: true, displayName: "Tester" }),
          submitScore: async ({ leaderboardId, score }) => { calls.scores.push([leaderboardId, score]); return { submitted: true }; },
          showLeaderboard: async () => { calls.shown++; },
          getProducts: async ({ productIds }) => ({
            canPay: true,
            products: productIds.map((id, i) => ({ id, displayName: id, displayPrice: ["$0.99", "$4.99", "$9.99"][i] })),
          }),
          purchase: async ({ productId }) => ({
            status: "purchased",
            transaction: { transactionId: "t" + next++, productId, quantity: 1, revoked: false },
          }),
          pendingTransactions: async () => ({ transactions: pending }),
          finishTransaction: async ({ transactionId }) => { calls.finished.push(transactionId); },
          addListener: (_name, callback) => { listener = callback; },
        },
      },
    };
  };
}

test("coin packs credit verified purchases once and finish them", async ({ page }) => {
  await page.addInitScript(mockNative(), { pending: [] });
  await page.goto("/?test=1");
  await page.evaluate(() => localStorage.setItem("echoSteps.coins", "0"));
  await page.reload();
  await page.locator("#shopBtn").click();
  const tab = page.locator("#shopCoinsTab");
  await expect(tab).toBeVisible();
  await tab.click();
  await expect(page.locator("#shopPreview")).toBeHidden();
  const packs = page.locator("#shopCoins .coin-pack");
  await expect(packs).toHaveCount(3);
  await expect(packs.nth(1)).toContainText("$4.99");
  await packs.nth(1).click();
  await expect(page.locator("#shopCoinLine")).toContainText("1200");
  expect(await page.evaluate(() => window.__nativeCalls.finished)).toEqual(["t1"]);
  // The same transaction replayed (e.g. from Transaction.updates) is finished but not paid twice.
  await page.evaluate(() => window.__emitTransaction({ transactionId: "t1", productId: "com.mukulkatari.echosteps.coins1200", quantity: 1 }));
  await expect.poll(() => page.evaluate(() => window.__nativeCalls.finished.length)).toBe(2);
  expect(await page.evaluate(() => localStorage.getItem("echoSteps.coins"))).toBe("1200");
  // Leaving the coins tab brings the cosmetic preview back.
  await page.locator('#shopTabs [data-cat="colors"]').click();
  await expect(page.locator("#shopPreview")).toBeVisible();
});

test("unfinished purchases from a previous launch are credited at startup", async ({ page }) => {
  await page.addInitScript(mockNative(), {
    pending: [{ transactionId: "old-1", productId: "com.mukulkatari.echosteps.coins200", quantity: 1, revoked: false }],
  });
  // Seed the bank once, before the game boots, so the startup credit can't race the seed.
  await page.addInitScript(() => {
    if (sessionStorage.getItem("seeded")) return;
    sessionStorage.setItem("seeded", "1");
    localStorage.setItem("echoSteps.coins", "5"); localStorage.removeItem("echoSteps.creditedTransactions");
  });
  await page.goto("/?test=1");
  await expect.poll(() => page.evaluate(() => localStorage.getItem("echoSteps.coins"))).toBe("205");
  await page.reload();
  await expect.poll(() => page.evaluate(() => window.__nativeCalls.finished.includes("old-1"))).toBe(true);
  expect(await page.evaluate(() => localStorage.getItem("echoSteps.coins"))).toBe("205");
});

test("Game Center leaderboard button opens the board and scores are submitted", async ({ page }) => {
  await page.addInitScript(mockNative(), { pending: [] });
  await page.goto("/?test=1");
  await expect(page.locator("#gameCenterBtn")).toBeVisible();
  await page.locator("#gameCenterBtn").click();
  await expect.poll(() => page.evaluate(() => window.__nativeCalls.shown)).toBe(1);
  await page.evaluate(() => { submitLeaderboardScore(7); });
  await expect.poll(() => page.evaluate(() => window.__nativeCalls.scores)).toContainEqual(["echosteps.rounds.alltime", 7]);
});

test("web build shows neither coin packs nor the Game Center button", async ({ page }) => {
  await page.goto("/?test=1");
  await expect(page.locator("#gameCenterBtn")).toBeHidden();
  await page.locator("#shopBtn").click();
  await expect(page.locator("#shopCoinsTab")).toBeHidden();
});
