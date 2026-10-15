import { test, expect } from "@playwright/test";
import { collectPageErrors, completeTutorialForMostTests } from "./helpers.js";

completeTutorialForMostTests(test);

test("player skins stay out of the ghost colours, and old Comet/Blaze saves migrate", async ({ page }) => {
  await page.addInitScript(() => {
    if (sessionStorage.getItem("seeded")) return;
    sessionStorage.setItem("seeded", "1");
    localStorage.setItem("echoSteps.unlocked", "#29e0ff,#eaf2ff,#ff5ca8,#ff8a2b");
    localStorage.setItem("echoSteps.color", "#ff8a2b");
  });
  await page.goto("/?test=1");
  const state = await page.evaluate(() => ({
    skins: SKINS.map(s => s.id), ghosts: GHOST_SKINS.map(s => s.id), labels: SKINS.map(s => s.label),
    playerColor, playerStyle, unlocked: localStorage.getItem("echoSteps.unlocked"),
  }));
  expect(state.skins.filter(id => state.ghosts.includes(id))).toEqual([]);
  expect(state.labels).not.toContain("Ghost");
  expect(state.playerColor).toBe("#9fd8ff");
  expect(state.playerStyle).toBe("square");
  expect(state.unlocked).toBe("#29e0ff,#eaf2ff,#d9b8ff,#9fd8ff");
});

test("menu has one primary PLAY and game over leads with a free new run", async ({ page }) => {
  const errors = collectPageErrors(page);
  await page.setViewportSize({ width:375, height:667 });
  await page.goto("/?test=1");
  const play = await page.locator("#startBtn").boundingBox();
  const store = await page.locator("#shopBtn").boundingBox();
  expect(play.width).toBeGreaterThanOrEqual(store.width);
  expect(play.height).toBeGreaterThan(store.height);
  await page.locator("#startBtn").click();
  await page.evaluate(() => { window.__echoStepsTest.putGhostOnPlayer(); window.__echoStepsTest.step(60); });
  await expect(page.locator("#restartBtn")).toHaveText("NEW RUN · FREE");
  await expect(page.locator("#retryBtn")).toContainText("REVIVE · ◆50");
  await expect(page.locator("#retryBtn")).toContainText("extra rounds don't rank");
  for (const id of ["restartBtn", "retryBtn", "menuBtn", "shareBtn"]) {
    const box = await page.locator("#" + id).boundingBox();
    expect(box.height, id).toBeGreaterThanOrEqual(44);
    expect(box.x + box.width, id).toBeLessThanOrEqual(375);
  }
  expect(errors).toEqual([]);
});

test("first-run teaching text wraps inside a narrow arena", async ({ page }) => {
  await page.setViewportSize({ width:320, height:568 });
  await page.goto("/?test=1");
  await page.locator("#startBtn").click();
  const widest = await page.evaluate(() => {
    ctx.font = "600 17px ui-monospace, monospace";
    const lines = wrapCanvasText(ctx, CAPTIONS.teach, room.w - 48);
    return { room: room.w, widest: Math.max(...lines.map(l => ctx.measureText(l).width)) };
  });
  expect(widest.widest).toBeLessThanOrEqual(widest.room - 40);
});
