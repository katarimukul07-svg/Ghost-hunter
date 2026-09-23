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
