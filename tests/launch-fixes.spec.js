import { test, expect } from "@playwright/test";
import { collectPageErrors, completeTutorialForMostTests } from "./helpers.js";

completeTutorialForMostTests(test);

// Complete `count` rounds, step away from the exit's safe zone and die to a ghost.
async function clearRoundsThenDie(page, count) {
  await page.evaluate((n) => {
    for (let i=0; i<n; i++) window.__echoStepsTest.completeRound();
    const { room } = window.__echoStepsTest.snapshot();
    window.__echoStepsTest.movePlayerTo(room.x+room.w/2, room.y+room.h/2);
    window.__echoStepsTest.step();
    window.__echoStepsTest.putGhostOnPlayer();
    window.__echoStepsTest.step(50);
  }, count);
  await expect(page.locator("#overScreen")).toBeVisible();
}

test("revived rounds pay coins but never raise the ranked best or Game Center score", async ({ page }) => {
  const errors = collectPageErrors(page);
  await page.addInitScript(() => { if (localStorage.getItem("echoSteps.coins") === null) localStorage.setItem("echoSteps.coins", "500"); });
  await page.goto("/?test=1");
  await page.evaluate(() => {
    window.__submitted = [];
    gameCenterState.signedIn = true;
    window.EchoStepsNative = { haptic:()=>{}, ...(window.EchoStepsNative||{}), gameCenter:{ submitScore:async (_id, v) => { window.__submitted.push(v); } } };
  });
  await page.getByRole("button", { name:"PLAY" }).click();
  await clearRoundsThenDie(page, 3);
  await expect(page.locator("#bestScore")).toHaveText("3");
  await expect(page.locator("#rankedNote")).toBeHidden();

  await page.locator("#retryBtn").click();
  await clearRoundsThenDie(page, 4);
  await expect(page.locator("#finalRounds")).toHaveText("7");
  await expect(page.locator("#bestScore")).toHaveText("3");
  await expect(page.locator("#newBest")).toBeHidden();
  await expect(page.locator("#rankedNote")).toContainText("Ranked score: 3");
  expect(await page.evaluate(() => localStorage.getItem("echoSteps.bestRounds"))).toBe("3");
  expect(await page.evaluate(() => window.__submitted)).toEqual([3, 3]);
  expect(errors).toEqual([]);
});

test("coins per round grow with depth and a run bonus is paid once per 5 rounds", async ({ page }) => {
  const errors = collectPageErrors(page);
  await page.addInitScript(() => { if (localStorage.getItem("echoSteps.coins") === null) localStorage.setItem("echoSteps.coins", "0"); });
  await page.goto("/?test=1");
  expect(await page.evaluate(() => [1, 9, 10, 19, 20, 40].map(coinsForRound))).toEqual([1, 1, 2, 2, 3, 3]);
  await page.getByRole("button", { name:"PLAY" }).click();
  await clearRoundsThenDie(page, 10);
  await expect(page.locator("#rankedNote")).toContainText("+2 run bonus");
  expect(await page.evaluate(() => localStorage.getItem("echoSteps.coins"))).toBe("2");

  // A revived run that ends again only pays the bonus for new 5-round steps.
  await page.evaluate(() => { coins = 100; saveCoins(); refreshRetryBtn(); });
  await page.locator("#retryBtn").click();
  await clearRoundsThenDie(page, 2);
  expect(await page.evaluate(() => localStorage.getItem("echoSteps.coins"))).toBe("50");
  await page.evaluate(() => { coins = 100; saveCoins(); refreshRetryBtn(); });
  await page.locator("#retryBtn").click();
  await clearRoundsThenDie(page, 3);
  expect(await page.evaluate(() => localStorage.getItem("echoSteps.coins"))).toBe("1");   // 100 - 100 revive + 1 bonus for reaching 15
  expect(errors).toEqual([]);
});

test("owned ghost skins move to their new danger colours", async ({ page }) => {
  const errors = collectPageErrors(page);
  await page.addInitScript(() => {
    if (localStorage.getItem("echoSteps.ghostSkin") !== null) return;
    localStorage.setItem("echoSteps.ghostOwned", "#ff3554,#39ff9e,#eaf2ff");
    localStorage.setItem("echoSteps.ghostSkin", "#39ff9e");
  });
  await page.goto("/?test=1");
  expect(await page.evaluate(() => selectedGhostSkin)).toBe("#ff7a1a");
  expect(await page.evaluate(() => localStorage.getItem("echoSteps.ghostOwned"))).toBe("#ff3554,#ff7a1a,#b3002d");
  const colours = await page.evaluate(() => GHOST_SKINS.map(s => s.id));
  for (const safe of ["#39ff9e", "#c66bff", "#eaf2ff", "#fff15c"]) expect(colours).not.toContain(safe);
  expect(errors).toEqual([]);
});

test("pause button has at least a 44 point tap area", async ({ page }) => {
  await page.setViewportSize({ width:375, height:812 });
  await page.goto("/?test=1");
  await page.getByRole("button", { name:"PLAY" }).click();
  const box = await page.locator("#pauseBtn").boundingBox();
  // Tap a corner of the 44pt area that lies outside the visible button.
  await page.mouse.click(box.x + box.width/2 + 20, box.y + box.height/2 + 20);
  await expect(page.locator("#pauseScreen")).toBeVisible();
});

test("game over RETRY and LEADERBOARD use different colours", async ({ page }) => {
  await page.goto("/?test=1");
  await page.evaluate(() => document.getElementById("overLeaderboardBtn").classList.remove("hidden"));
  const [retry, board] = await page.evaluate(() => ["retryBtn", "overLeaderboardBtn"].map(id => getComputedStyle(document.getElementById(id)).backgroundColor));
  expect(retry).not.toBe(board);
});
