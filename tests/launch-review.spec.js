import { test, expect } from "@playwright/test";
import { completeTutorialForMostTests } from "./helpers.js";
completeTutorialForMostTests(test);

test("main menu is short and ordered PLAY, STORE, SETTINGS, TUTORIAL on web", async ({ page }) => {
  await page.goto("/?test=1");
  await expect(page.locator("#startScreen")).not.toContainText("Grab the yellow coin");
  const labels = await page.locator("#startScreen button:visible").allTextContents();
  expect(labels.map(t => t.trim())).toEqual(["PLAY", "STORE", "SETTINGS", "TUTORIAL"]);
});

test("revive costs 50, then 100, and puts the node in the safe exit", async ({ page }) => {
  await page.addInitScript(() => {
    if (sessionStorage.getItem("seeded")) return;
    sessionStorage.setItem("seeded", "1");
    localStorage.setItem("echoSteps.coins", "500");
  });
  await page.goto("/?test=1");
  await page.getByRole("button", { name: "PLAY" }).click();
  const die = () => page.evaluate(() => { window.__echoStepsTest.putGhostOnPlayer(); window.__echoStepsTest.step(50); });
  await die();
  await expect(page.locator("#retryBtn")).toContainText("50");
  await page.locator("#retryBtn").click();
  const revived = await page.evaluate(() => window.__echoStepsTest.snapshot());
  expect(revived.mode).toBe(1);
  expect(revived.player.x).toBeCloseTo(revived.exit.x + revived.exit.w / 2, 0);
  expect(revived.player.y).toBeCloseTo(revived.exit.y + revived.exit.h / 2, 0);
  expect(revived.departureZone).not.toBeNull();
  expect(await page.evaluate(() => localStorage.getItem("echoSteps.coins"))).toBe("450");
  // The exit is a safe zone, so step out of it before the next death.
  await page.evaluate(() => { const { room } = window.__echoStepsTest.snapshot(); window.__echoStepsTest.movePlayerTo(room.x + room.w / 2, room.y + room.h / 2); window.__echoStepsTest.step(200); });
  await die();
  await expect(page.locator("#retryBtn")).toContainText("100");
  // A new run resets the price.
  await page.getByRole("button", { name: "PLAY AGAIN" }).click();
  await die();
  await expect(page.locator("#retryBtn")).toContainText("50");
});

test("big moments are staggered across rounds", async ({ page }) => {
  await page.goto("/?test=1");
  const schedule = await page.evaluate(() => {
    const rows = [];
    for (let r = 1; r <= 20; r++) rows.push({ r, exit: exitMovesOnRound(r), obstacles: obstacleCountForRound(r), scale: obstacleScaleForRound(r) });
    return rows;
  });
  const by = r => schedule[r - 1];
  expect(schedule.filter(x => x.exit).map(x => x.r)).toEqual([3, 8, 13, 18]);
  expect(by(4).obstacles).toBe(2); expect(by(5).obstacles).toBe(3); expect(by(10).obstacles).toBe(4);
  expect(by(6).scale).toBe(1); expect(by(7).scale).toBeCloseTo(1.1); expect(by(12).scale).toBeCloseTo(1.21);
  for (const row of schedule) {
    const changes = [row.exit, row.r % 5 === 0, row.r >= 7 && (row.r - 2) % 5 === 0].filter(Boolean).length;
    expect(changes, `round ${row.r}`).toBeLessThanOrEqual(1);
  }
});

test("HUD shows compact coins so the bar never wraps; menus keep the full number", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.addInitScript(() => {
    if (sessionStorage.getItem("seeded")) return;
    sessionStorage.setItem("seeded", "1");
    localStorage.setItem("echoSteps.coins", "4881");
  });
  await page.goto("/?test=1");
  await expect(page.locator("#coinLine")).toContainText("4881");
  await page.getByRole("button", { name: "PLAY" }).click();
  await expect(page.locator("#hudCoins")).toHaveText("4.8K");
  const oneLine = await page.locator("#hud").boundingBox();
  await page.evaluate(() => { localStorage.setItem("echoSteps.coins", "987654321"); coins = 987654321; });
  await expect(page.locator("#hudCoins")).toHaveText("987M");
  await page.evaluate(() => { const s = window.__echoStepsTest; for (let i = 0; i < 9; i++) s.completeRound(); });
  const after = await page.locator("#hud").boundingBox();
  expect(after.height).toBeLessThanOrEqual(oneLine.height + 1);
  expect(await page.evaluate(() => [formatCoinsCompact(999), formatCoinsCompact(1000), formatCoinsCompact(1250000), formatCoinsCompact(1e9)]))
    .toEqual(["999", "1K", "1.2M", "1B"]);
});

for (const width of [375, 393, 430]) test(`HUD stays on one line at ${width}px with 4-digit coins`, async ({ page }) => {
  await page.setViewportSize({ width, height: 852 });
  await page.addInitScript(() => localStorage.setItem("echoSteps.coins", "4881"));
  await page.goto("/?test=1");
  await page.getByRole("button", { name: "PLAY" }).click();
  const boxes = await page.evaluate(() => ["hudRound", "hudCoins", "hudGc", "pauseBtn", "muteBtn"].map(id => {
    const el = document.getElementById(id).closest(".hud-stat") || document.getElementById(id);
    const r = el.getBoundingClientRect(); return { id, top: Math.round(r.top), bottom: Math.round(r.bottom), right: Math.round(r.right) };
  }));
  const tops = boxes.map(b => b.top);
  expect(Math.max(...tops) - Math.min(...tops), JSON.stringify(boxes)).toBeLessThanOrEqual(4);
  for (const b of boxes) expect(b.right, b.id).toBeLessThanOrEqual(width);
  const mute = boxes.find(b => b.id === "muteBtn");
  expect(mute.bottom - mute.top).toBeLessThanOrEqual(34);   // the "♪ ON" label must not wrap
});
