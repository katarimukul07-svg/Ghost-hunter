import { test, expect } from "@playwright/test";
import { collectPageErrors, completeTutorialForMostTests } from "./helpers.js";

completeTutorialForMostTests(test);

test("first launch tutorial is automatic, skippable, remembered, and replayable", async ({ page }) => {
  const errors = collectPageErrors(page);

  await page.goto("/");
  await expect(page.locator("#tutorialScreen")).toBeVisible();
  await expect(page.getByRole("heading", { name:"YOU ARE THE BLUE NODE" })).toBeVisible();
  await expect(page.locator("#tutorialKicker")).toHaveText("STEP 1 OF 7");
  await expect(page.getByRole("button", { name:"SKIP" })).toBeVisible();

  await page.getByRole("button", { name:"NEXT" }).click();
  await expect(page.getByRole("heading", { name:"COLLECT THE YELLOW TARGET" })).toBeVisible();

  await page.getByRole("button", { name:"SKIP" }).click();
  await expect(page.getByRole("heading", { name:"ECHO STEPS" })).toBeVisible();
  await expect.poll(() => page.evaluate(() => localStorage.getItem("echoSteps.tutorial.v1"))).toBe("complete");

  await page.reload();
  await expect(page.locator("#tutorialScreen")).toBeHidden();
  await page.getByRole("button", { name:"Open tutorial" }).click();
  await expect(page.locator("#tutorialScreen")).toBeVisible();
  await expect(page.getByRole("heading", { name:"YOU ARE THE BLUE NODE" })).toBeVisible();
  await expect(page.getByRole("button", { name:"CLOSE" })).toBeVisible();

  expect(errors).toEqual([]);
});

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

test("opens the shop without purchase or advertising controls", async ({ page }) => {
  const errors = collectPageErrors(page);

  await page.goto("/");
  await page.getByRole("button", { name: "SHOP" }).click();
  await expect(page.getByRole("heading", { name: "SHOP" })).toBeVisible();
  await expect(page.locator("#shopHint")).toHaveText("Choose the shape and color of your NODE.");

  await expect(page.getByRole("button", { name: /BUY COINS|GET COINS|WATCH REWARDED AD/ })).toHaveCount(0);
  await expect(page.locator("body")).not.toContainText("Demo build");

  expect(errors).toEqual([]);
});

test("pauses for native lifecycle interruption and handles native Back", async ({ page }) => {
  const errors = collectPageErrors(page);

  await page.goto("/");
  await page.getByRole("button", { name: "PLAY" }).click();
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("echosteps:app-state", {
    detail: { isActive:false },
  })));
  await expect(page.getByRole("heading", { name: "PAUSED" })).toBeVisible();

  await page.evaluate(() => window.dispatchEvent(new CustomEvent("echosteps:back")));
  await expect(page.getByRole("heading", { name: "ECHO STEPS" })).toBeVisible();
  expect(errors).toEqual([]);
});

test("reloads offline after the install cache is ready", async ({ page, context }) => {
  const errors = collectPageErrors(page);

  await page.goto("/");
  await page.evaluate(() => navigator.serviceWorker.ready);
  await context.setOffline(true);
  try {
    await page.reload();
    await expect(page.getByRole("heading", { name: "ECHO STEPS" })).toBeVisible();
  } finally {
    await context.setOffline(false);
  }
  expect(errors).toEqual([]);
});
