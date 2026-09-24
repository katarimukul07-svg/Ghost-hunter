import { test, expect } from "@playwright/test";
import { collectPageErrors, completeTutorialForMostTests } from "./helpers.js";

completeTutorialForMostTests(test);

test("offers the classic grid plus three free backgrounds and remembers the selected environment", async ({ page }) => {
  const errors = collectPageErrors(page);

  await page.goto("/?test=1");
  await page.getByRole("button", { name:"SHOP" }).click();
  await page.getByRole("button", { name:"BACKGROUND" }).click();

  await expect(page.getByRole("button", { name:"CLASSIC GRID" })).toBeVisible();
  await expect(page.getByRole("button", { name:"CIRCUIT FOUNDRY" })).toBeVisible();
  await expect(page.getByRole("button", { name:"ORBITAL STATION" })).toBeVisible();
  await expect(page.getByRole("button", { name:"ABYSSAL NETWORK" })).toBeVisible();
  await expect(page.locator("#shopHint")).toContainText("All launch backgrounds are free");

  let state=await page.evaluate(() => window.__echoStepsBackgroundTest.snapshot());
  expect(state.available).toEqual(["classic","circuit","orbit","abyss"]);
  expect(state.selected).toBe("classic");

  await page.getByRole("button", { name:"ORBITAL STATION" }).click();
  state=await page.evaluate(() => window.__echoStepsBackgroundTest.snapshot());
  expect(state.selected).toBe("orbit");
  expect(await page.evaluate(() => localStorage.getItem("echoSteps.background"))).toBe("orbit");

  await page.reload();
  state=await page.evaluate(() => window.__echoStepsBackgroundTest.snapshot());
  expect(state.selected).toBe("orbit");
  expect(errors).toEqual([]);
});
