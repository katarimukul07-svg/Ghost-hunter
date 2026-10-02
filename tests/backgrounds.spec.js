import { test, expect } from "@playwright/test";
import { collectPageErrors, completeTutorialForMostTests } from "./helpers.js";
completeTutorialForMostTests(test);

test("backgrounds preview freely but require a confirmed coin purchase to equip", async ({ page }) => {
  const errors = collectPageErrors(page);
  await page.addInitScript(() => {
    if (localStorage.getItem("echoSteps.coins") === null) localStorage.setItem("echoSteps.coins", "100");
  });
  await page.goto("/?test=1");
  await page.locator("#shopBtn").click();
  await page.getByRole("button", { name:"BACKGROUND", exact:true }).click();
  const state = () => page.evaluate(() => window.__echoStepsBackgroundTest.snapshot());
  expect((await state()).available).toEqual(["classic","circuit","abyss","orbit"]);
  for (const [label, price] of [["CIRCUIT FOUNDRY",40],["ABYSSAL NETWORK",60],["ORBITAL STATION",90]]) {
    await page.getByRole("button", { name:label, exact:true }).click();
    expect((await state()).selected).toBe("classic");
    await expect(page.locator("#shopBuyBtn")).toContainText(`${price} COINS`);
    await expect(page.locator("#shopCoinLine")).toContainText("100 coins");
  }
  expect((await state()).preview).toBe("orbit");
  await page.locator("#shopBuyBtn").click();
  await expect(page.locator("#shopConfirmRemaining")).toHaveText("Balance after purchase: 10 coins");
  await page.locator("#shopConfirmCancel").click();
  expect((await state()).selected).toBe("classic");
  await page.locator("#shopBuyBtn").click();
  await page.locator("#shopConfirmBuy").click();
  expect((await state()).selected).toBe("orbit");
  await expect(page.locator("#shopCoinLine")).toContainText("10 coins");
  await page.reload();
  expect((await state()).selected).toBe("orbit");
  expect(await page.evaluate(() => localStorage.getItem("echoSteps.coins"))).toBe("10");
  await page.evaluate(() => {
    localStorage.setItem("echoSteps.background", "abyss");
    window.dispatchEvent(new CustomEvent("echosteps:save-changed", { detail:{key:"echoSteps.background"} }));
  });
  expect((await state()).selected).toBe("classic");
  expect(errors).toEqual([]);
});
