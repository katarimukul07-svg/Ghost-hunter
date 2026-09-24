import { test, expect } from "@playwright/test";
import { collectPageErrors, completeTutorialForMostTests } from "./helpers.js";

completeTutorialForMostTests(test);

test("spawns distinct short-lived double bonuses after the teaching round", async ({ page }) => {
  const errors = collectPageErrors(page);

  await page.goto("/?test=1");
  await page.getByRole("button", { name:"PLAY" }).click();
  await page.evaluate(() => window.__echoStepsTest.completeRound());
  await page.evaluate(() => window.__echoStepsBonusTest.spawn(2, ["shield", "slow"]));

  let bonusState = await page.evaluate(() => window.__echoStepsBonusTest.snapshot());
  expect(bonusState.bonuses).toHaveLength(2);
  expect(new Set(bonusState.bonuses.map((bonus) => bonus.type)).size).toBe(2);
  expect(Math.hypot(
    bonusState.bonuses[0].x - bonusState.bonuses[1].x,
    bonusState.bonuses[0].y - bonusState.bonuses[1].y,
  )).toBeGreaterThan(150);
  expect(bonusState.bonuses[0].life).toBe(4.5);

  await page.evaluate(() => {
    window.__echoStepsBonusTest.movePlayerToBonus(0);
    window.__echoStepsTest.step();
  });
  bonusState = await page.evaluate(() => window.__echoStepsBonusTest.snapshot());
  expect(bonusState.bonuses).toHaveLength(1);
  expect(bonusState.shieldCharges).toBe(1);

  await page.evaluate(() => {
    window.__echoStepsBonusTest.expire();
    window.__echoStepsTest.step();
  });
  expect((await page.evaluate(() => window.__echoStepsBonusTest.snapshot())).bonuses).toHaveLength(0);
  expect(errors).toEqual([]);
});
