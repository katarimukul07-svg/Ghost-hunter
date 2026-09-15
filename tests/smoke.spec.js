import { test, expect } from "@playwright/test";

function collectPageErrors(page) {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
}

test("loads the menu and starts a run without runtime errors", async ({ page }) => {
  const errors = collectPageErrors(page);

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "ECHO STEPS" })).toBeVisible();
  await expect(page.locator("#coinLine")).toContainText("coins");

  await page.getByRole("button", { name: "PLAY" }).click();
  await expect(page.locator("#hud")).toBeVisible();
  await expect(page.locator("#c")).toBeVisible();
  await expect(page.locator("#hudRound")).toHaveText("1");

  await page.waitForTimeout(250);
  expect(errors).toEqual([]);
});

test("opens the shop and exposes only the guarded reward path", async ({ page }) => {
  const errors = collectPageErrors(page);

  await page.goto("/");
  await page.getByRole("button", { name: "SHOP" }).click();
  await expect(page.getByRole("heading", { name: "SHOP" })).toBeVisible();

  await page.getByRole("button", { name: "GET COINS" }).click();
  await expect(page.getByRole("heading", { name: "GET COINS" })).toBeVisible();
  await expect(page.getByRole("button", { name: /WATCH REWARDED AD/ })).toBeVisible();
  await expect(page.locator("#coinPacks button")).toHaveCount(1);

  expect(errors).toEqual([]);
});

test("requires an active drag and preserves game position across resize", async ({ page }) => {
  const errors = collectPageErrors(page);

  await page.goto("/?test=1");
  await page.getByRole("button", { name: "PLAY" }).click();

  const canvas = page.locator("#c");
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();

  const beforeHover = await page.evaluate(() => window.__echoStepsTest.snapshot());
  await page.mouse.move(beforeHover.player.x + 80, beforeHover.player.y);
  await page.waitForTimeout(150);
  const afterHover = await page.evaluate(() => window.__echoStepsTest.snapshot());
  expect(afterHover.player.x).toBeCloseTo(beforeHover.player.x, 1);
  expect(afterHover.player.y).toBeCloseTo(beforeHover.player.y, 1);

  await page.mouse.move(beforeHover.player.x, beforeHover.player.y);
  await page.mouse.down();
  await page.mouse.move(beforeHover.player.x + 80, beforeHover.player.y);
  await page.waitForTimeout(150);
  await page.mouse.up();
  const afterDrag = await page.evaluate(() => window.__echoStepsTest.snapshot());
  expect(afterDrag.player.x).toBeGreaterThan(beforeHover.player.x + 10);
  expect(afterDrag.pointer.active).toBe(false);

  const oldNormalized = {
    x:(afterDrag.player.x - afterDrag.room.x) / afterDrag.room.w,
    y:(afterDrag.player.y - afterDrag.room.y) / afterDrag.room.h,
  };
  await page.setViewportSize({ width:720, height:960 });
  await page.waitForTimeout(100);
  const afterResize = await page.evaluate(() => window.__echoStepsTest.snapshot());
  const newNormalized = {
    x:(afterResize.player.x - afterResize.room.x) / afterResize.room.w,
    y:(afterResize.player.y - afterResize.room.y) / afterResize.room.h,
  };
  expect(newNormalized.x).toBeCloseTo(oldNormalized.x, 2);
  expect(newNormalized.y).toBeCloseTo(oldNormalized.y, 2);
  expect(errors).toEqual([]);
});
