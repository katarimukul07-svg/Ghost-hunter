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
