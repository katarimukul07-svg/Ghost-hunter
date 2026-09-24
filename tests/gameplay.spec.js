import { test, expect } from "@playwright/test";
import { collectPageErrors, completeTutorialForMostTests } from "./helpers.js";

completeTutorialForMostTests(test);

test("a ghost death shows game over, refuses an unaffordable retry, and restarts", async ({ page }) => {
  const errors = collectPageErrors(page);
  await page.goto("/?test=1");
  await page.getByRole("button", { name:"PLAY" }).click();
  await page.evaluate(() => {
    window.__echoStepsTest.putGhostOnPlayer();
    window.__echoStepsTest.step(50);
  });
  expect((await page.evaluate(() => window.__echoStepsTest.snapshot())).mode).toBe(2);
  await expect(page.locator("#overTitle")).toBeVisible();
  await page.locator("#retryBtn").click();
  await expect(page.locator("#overSub")).toContainText("Collect more coins");
  expect((await page.evaluate(() => window.__echoStepsTest.snapshot())).mode).toBe(2);
  await page.getByRole("button", { name:"PLAY AGAIN" }).click();
  const restarted = await page.evaluate(() => window.__echoStepsTest.snapshot());
  expect(restarted.mode).toBe(1);
  expect(restarted.round).toBe(1);
  expect(restarted.ghostCount).toBe(0);
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
  const roomDiagonal = Math.hypot(beforeHover.room.w, beforeHover.room.h);
  expect(beforeHover.playerSpeed).toBeGreaterThan(roomDiagonal * 0.025);
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

  await page.getByRole("button", { name:"Pause game" }).click();
  await expect.poll(async () => (await page.evaluate(() => window.__echoStepsTest.snapshot())).paused).toBe(true);

  const oldNormalized = {
    x:(afterDrag.player.x - afterDrag.room.x) / afterDrag.room.w,
    y:(afterDrag.player.y - afterDrag.room.y) / afterDrag.room.h,
  };
  await page.setViewportSize({ width:720, height:960 });
  const afterResize = await page.evaluate(() => window.__echoStepsTest.snapshot());
  const newNormalized = {
    x:(afterResize.player.x - afterResize.room.x) / afterResize.room.w,
    y:(afterResize.player.y - afterResize.room.y) / afterResize.room.h,
  };
  expect(newNormalized.x).toBeCloseTo(oldNormalized.x, 2);
  expect(newNormalized.y).toBeCloseTo(oldNormalized.y, 2);
  expect(errors).toEqual([]);
});

test("keeps the old exit safe only for the relocation handoff", async ({ page }) => {
  const errors = collectPageErrors(page);

  await page.goto("/?test=1");
  await page.getByRole("button", { name: "PLAY" }).click();
  await page.evaluate(() => window.__echoStepsTest.prepareExitHandoff());

  const handoff = await page.evaluate(() => window.__echoStepsTest.snapshot());
  expect(handoff.round).toBe(5);
  expect(handoff.departureZone).not.toBeNull();
  expect(handoff.exit.x !== handoff.departureZone.x || handoff.exit.y !== handoff.departureZone.y).toBe(true);

  await page.evaluate(() => {
    window.__echoStepsTest.putGhostOnPlayer();
    window.__echoStepsTest.step();
  });
  expect((await page.evaluate(() => window.__echoStepsTest.snapshot())).mode).toBe(1);

  await page.evaluate(() => {
    const state=window.__echoStepsTest.snapshot();
    window.__echoStepsTest.movePlayerTo(state.room.x+state.room.w/2,state.room.y+state.room.h/2);
    window.__echoStepsTest.step();
  });
  expect((await page.evaluate(() => window.__echoStepsTest.snapshot())).departureZone).toBeNull();

  await page.evaluate(() => {
    window.__echoStepsTest.putGhostOnPlayer();
    window.__echoStepsTest.step();
  });
  expect((await page.evaluate(() => window.__echoStepsTest.snapshot())).mode).toBe(3);
  expect(errors).toEqual([]);
});

test("expires exit handoff protection after two seconds", async ({ page }) => {
  const errors = collectPageErrors(page);

  await page.goto("/?test=1");
  await page.getByRole("button", { name: "PLAY" }).click();
  await page.evaluate(() => {
    window.__echoStepsTest.prepareExitHandoff();
    window.__echoStepsTest.putGhostOnPlayer();
    window.__echoStepsTest.step(120);
  });

  const expired = await page.evaluate(() => window.__echoStepsTest.snapshot());
  expect(expired.departureZone).toBeNull();
  expect(expired.mode).toBe(3);
  expect(errors).toEqual([]);
});

test("distinguishes the objective from red circular ghosts", async ({ page }) => {
  const errors = collectPageErrors(page);

  await page.goto("/?test=1");
  await expect(page.locator("#startScreen")).toContainText("yellow diamond");

  const roles = await page.evaluate(() => window.__echoStepsTest.visualRoles());
  expect(roles.objective).toEqual({
    shape:"diamond",
    color:"#fff15c",
    motion:"slow-pulse-ring",
  });
  expect(roles.ghost).toEqual({
    shape:"circle",
    color:"#ff3554",
    motion:"flicker",
  });
  expect(roles.objective.color).not.toBe(roles.ghost.color);
  expect(errors).toEqual([]);
});

test("uses a clear garbage collector countdown label", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name:"PLAY" }).click();
  await expect(page.locator("#hudGc")).toHaveText("10");
  await expect(page.locator("#hud")).toContainText("GC IN");
});

test("uses the scheduled garbage collection count after each tenth completed round", async ({ page }) => {
  const errors = collectPageErrors(page);

  await page.goto("/?test=1");
  await page.getByRole("button", { name: "PLAY" }).click();

  const policies = await page.evaluate(() => [9, 10, 20, 30, 40, 50]
    .map((completed) => ({ completed, ...window.__echoStepsTest.gcPolicy(completed) })));
  expect(policies).toEqual([
    { completed:9, shouldSweep:false, remove:4 },
    { completed:10, shouldSweep:true, remove:4 },
    { completed:20, shouldSweep:true, remove:3 },
    { completed:30, shouldSweep:true, remove:2 },
    { completed:40, shouldSweep:true, remove:1 },
    { completed:50, shouldSweep:true, remove:1 },
  ]);

  await page.evaluate(() => {
    for (let completed = 0; completed < 9; completed++) window.__echoStepsTest.completeRound();
  });
  let state = await page.evaluate(() => window.__echoStepsTest.snapshot());
  expect(state.round).toBe(10);
  expect(state.ghostCount).toBe(9);
  expect(state.sweep).toBeNull();

  await page.evaluate(() => window.__echoStepsTest.completeRound());
  state = await page.evaluate(() => window.__echoStepsTest.snapshot());
  expect(state.round).toBe(11);
  expect(state.ghostCount).toBe(10);
  expect(state.sweep).toMatchObject({ remove:4, completedRounds:10 });

  await page.evaluate(() => {
    const { exit } = window.__echoStepsTest.snapshot();
    window.__echoStepsTest.movePlayerTo(exit.x + exit.w / 2, exit.y + exit.h / 2);
    window.__echoStepsTest.step(43);
  });
  state = await page.evaluate(() => window.__echoStepsTest.snapshot());
  expect(state.sweep).toBeNull();
  expect(state.ghostCount).toBe(6);

  const expectedGhosts = [[20, 13], [30, 21], [40, 30]];
  for (const [completedRound, expectedCount] of expectedGhosts) {
    await page.evaluate(() => {
      for (let i = 0; i < 10; i++) window.__echoStepsTest.completeRound();
      const { exit } = window.__echoStepsTest.snapshot();
      window.__echoStepsTest.movePlayerTo(exit.x + exit.w / 2, exit.y + exit.h / 2);
      window.__echoStepsTest.step(43);
    });
    state = await page.evaluate(() => window.__echoStepsTest.snapshot());
    expect(state.round).toBe(completedRound + 1);
    expect(state.sweep).toBeNull();
    expect(state.ghostCount).toBe(expectedCount);
  }
  expect(errors).toEqual([]);
});
