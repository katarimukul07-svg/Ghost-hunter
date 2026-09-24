import { test, expect } from '@playwright/test';
import { completeTutorialForMostTests, collectPageErrors } from './helpers.js';
import { exitTarget, planRoute, steerTo } from './automated-player.js';

completeTutorialForMostTests(test);

const seedGame = async (page, seed) => page.addInitScript((initial) => {
  let value = initial >>> 0;
  Math.random = () => {
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
    return value / 0x100000000;
  };
}, seed);

test('automated player collects the prize and exits through real controls', async ({page}, testInfo) => {
  test.setTimeout(90_000);
  const seed = 41123;
  const replay = {seed, viewport:testInfo.project.name, rounds:[]};
  const errors = collectPageErrors(page);
  await seedGame(page, seed);
  await page.goto('/?test=1');
  await page.getByRole('button', {name:'PLAY'}).click();

  try {
    for (let round = 1; round <= 2; round++) {
      const before = await page.evaluate(() => window.__echoStepsTest.snapshot());
      expect(before.round).toBe(round);
      expect(before.prize).not.toBeNull();
      const record = {round, prize:before.prize, exit:before.exit, moves:[]};
      replay.rounds.push(record);
      const collected = await steerTo(page, before.prize, record);
      expect(collected.mode).toBe(1);
      expect(collected.hasPrize).toBe(true);
      expect(collected.coins).toBe(before.coins + 1);
      const exited = await steerTo(page, exitTarget(collected.exit), record);
      expect(exited.mode).toBe(1);
      expect(exited.round).toBe(round + 1);
      expect(exited.ghostCount).toBe(round);
    }
    expect(errors).toEqual([]);
  } catch (error) {
    await testInfo.attach('automated-player-replay', {
      body:JSON.stringify({...replay, error:String(error)}, null, 2),
      contentType:'application/json',
    });
    throw error;
  }
});

test('generated prize and exit remain reachable across layouts', async ({context}) => {
  test.setTimeout(60_000);
  for (const seed of [104, 309, 907]) {
    const page = await context.newPage();
    const errors = collectPageErrors(page);
    await page.addInitScript(() => localStorage.setItem('echoSteps.tutorial.v1', 'complete'));
    await seedGame(page, seed);
    await page.goto('/?test=1');
    await page.getByRole('button', {name:'PLAY'}).click();
    for (const round of [1, 5, 10]) {
      while ((await page.evaluate(() => window.__echoStepsTest.snapshot())).round < round) {
        await page.evaluate(() => window.__echoStepsTest.completeRound());
      }
      const state = await page.evaluate(() => window.__echoStepsTest.snapshot());
      expect.soft(state.prize, `seed ${seed}, round ${round}`).not.toBeNull();
      if (!state.prize) continue;
      expect.soft(planRoute(state, state.prize), `prize, seed ${seed}, round ${round}`).not.toBeNull();
      expect.soft(planRoute({...state, player:state.prize}, exitTarget(state.exit)),
        `exit, seed ${seed}, round ${round}`).not.toBeNull();
    }
    expect(errors, `seed ${seed}`).toEqual([]);
    await page.close();
  }
});

test('dragging straight into a rectangular obstacle cannot cross it', async ({page}) => {
  const errors = collectPageErrors(page);
  await seedGame(page, 2718);
  await page.goto('/?test=1');
  await page.getByRole('button', {name:'PLAY'}).click();
  const obstacle = await page.evaluate(() => window.__echoStepsTest.installCollisionFixture());
  const before = await page.evaluate(() => window.__echoStepsTest.snapshot());
  const box = await page.locator('#c').boundingBox();
  await page.mouse.move(box.x + before.player.x, box.y + before.player.y);
  await page.mouse.down();
  await page.mouse.move(box.x + obstacle.x + obstacle.w + 40, box.y + before.player.y);
  await page.evaluate(() => window.__echoStepsTest.step(18));
  await page.mouse.up();
  const after = await page.evaluate(() => window.__echoStepsTest.snapshot());
  expect(after.player.x).toBeGreaterThan(before.player.x);
  expect(after.player.x).toBeLessThanOrEqual(obstacle.x - obstacle.playerRadius + 1);
  expect(after.mode).toBe(1);
  expect(errors).toEqual([]);
});
