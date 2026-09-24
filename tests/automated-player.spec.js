import { test, expect } from '@playwright/test';
import { completeTutorialForMostTests, collectPageErrors } from './helpers.js';
import { exitTarget, steerTo } from './automated-player.js';
import { checkReachability } from './reachability.js';

completeTutorialForMostTests(test);
test.use({serviceWorkers:'block'});

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
    const before = await page.evaluate(() => window.__echoStepsTest.snapshot());
    expect(before.round).toBe(1);
    expect(before.prize).not.toBeNull();
    const record = {round:1, prize:before.prize, exit:before.exit, moves:[]};
    replay.rounds.push(record);
    const collected = await steerTo(page, before.prize, record);
    expect(collected.mode).toBe(1);
    expect(collected.hasPrize).toBe(true);
    expect(collected.coins).toBe(before.coins + 1);
    const exited = await steerTo(page, exitTarget(collected.exit), record);
    expect(exited.mode).toBe(1);
    expect(exited.round).toBe(2);
    expect(exited.ghostCount).toBe(1);
    expect(exited.ghostPlayback[0].pathLength).toBeGreaterThan(5);
    const positions = await page.evaluate(() => {
      const samples = [];
      for (let i = 0; i < 12; i++) {
        window.__echoStepsTest.step(20);
        samples.push(window.__echoStepsTest.snapshot().ghostPlayback[0].position);
      }
      return samples;
    });
    expect(positions.some(p => Math.hypot(p.x - positions[0].x, p.y - positions[0].y) > 15))
      .toBe(true);
    expect((await page.evaluate(() => window.__echoStepsTest.snapshot())).mode).toBe(1);
    expect(errors).toEqual([]);
  } catch (error) {
    await testInfo.attach('automated-player-replay', {
      body:JSON.stringify({...replay, error:String(error)}, null, 2),
      contentType:'application/json',
    });
    throw error;
  }
});

test('generated prize and exit remain reachable into round 30', async ({context}) => {
  test.setTimeout(90_000);
  for (const seed of [104, 309, 907]) {
    const page = await context.newPage();
    const errors = collectPageErrors(page);
    await page.addInitScript(() => localStorage.setItem('echoSteps.tutorial.v1', 'complete'));
    await seedGame(page, seed);
    await page.goto('/?test=1');
    await page.getByRole('button', {name:'PLAY'}).click();
    for (const round of [1, 5, 10, 20, 30]) {
      while ((await page.evaluate(() => window.__echoStepsTest.snapshot())).round < round) {
        await page.evaluate(() => window.__echoStepsTest.completeRound());
      }
      const state = await page.evaluate(() => window.__echoStepsTest.snapshot());
      expect.soft(state.prize, `seed ${seed}, round ${round}`).not.toBeNull();
      if (!state.prize) continue;
      const reached = await checkReachability(page);
      expect.soft(reached.prize, `prize, seed ${seed}, round ${round}`).toBe(true);
      expect.soft(reached.exit, `exit, seed ${seed}, round ${round}`).toBe(true);
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

test('a finger drag moves the player on mobile', async ({page}, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-chromium', 'Requires touch emulation');
  const errors = collectPageErrors(page);
  await seedGame(page, 511);
  await page.goto('/?test=1');
  await page.getByRole('button', {name:'PLAY'}).click();
  const before = await page.evaluate(() => window.__echoStepsTest.snapshot());
  const box = await page.locator('#c').boundingBox();
  const session = await page.context().newCDPSession(page);
  const x = box.x + before.player.x, y = box.y + before.player.y;
  try {
    await session.send('Input.dispatchTouchEvent', {type:'touchStart', touchPoints:[{x,y}]});
    await session.send('Input.dispatchTouchEvent', {
      type:'touchMove', touchPoints:[{x:x + 24,y}],
    });
    await page.evaluate(() => window.__echoStepsTest.step(4));
    const during = await page.evaluate(() => window.__echoStepsTest.snapshot());
    expect(during.pointer.active).toBe(true);
    expect(during.player.x).toBeGreaterThan(before.player.x);
    expect(during.mode).toBe(1);
  } finally {
    await session.send('Input.dispatchTouchEvent', {type:'touchEnd', touchPoints:[]});
    await session.detach();
  }
  expect((await page.evaluate(() => window.__echoStepsTest.snapshot())).pointer.active).toBe(false);
  expect(errors).toEqual([]);
});
