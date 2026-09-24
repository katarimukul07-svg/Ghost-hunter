// Conservative route planner for browser tests. It uses obstacle bounds rather
// than the game's shape-specific collision code, so a found path has clearance.
export function planRoute(state, target, clearance = 19) {
  const { room, obstacles } = state;
  const cell = 14;
  const cols = Math.max(2, Math.floor((room.w - 2 * clearance) / cell));
  const rows = Math.max(2, Math.floor((room.h - 2 * clearance) / cell));
  const point = (c, r) => ({
    x:room.x + clearance + c * (room.w - 2 * clearance) / (cols - 1),
    y:room.y + clearance + r * (room.h - 2 * clearance) / (rows - 1),
  });
  const free = (p) => obstacles.every(o =>
    p.x < o.x - clearance || p.x > o.x + o.w + clearance ||
    p.y < o.y - clearance || p.y > o.y + o.h + clearance);
  const grid = Array.from({length:rows}, (_, r) =>
    Array.from({length:cols}, (_, c) => free(point(c, r))));
  const nearest = (p) => {
    let best = null;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      if (!grid[r][c]) continue;
      const q = point(c, r);
      const distance = Math.hypot(q.x - p.x, q.y - p.y);
      if (!best || distance < best.distance) best = {c, r, distance};
    }
    return best;
  };
  const start = nearest(state.player), end = nearest(target);
  if (!start || !end || end.distance > 25) return null;
  const key = (c, r) => r * cols + c;
  const previous = new Map([[key(start.c, start.r), null]]);
  const queue = [[start.c, start.r]];
  for (let head = 0; head < queue.length; head++) {
    const [c, r] = queue[head];
    if (c === end.c && r === end.r) break;
    for (const [dc, dr] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const nc = c + dc, nr = r + dr;
      if (nc < 0 || nr < 0 || nc >= cols || nr >= rows || !grid[nr][nc]) continue;
      const next = key(nc, nr);
      if (!previous.has(next)) { previous.set(next, key(c, r)); queue.push([nc, nr]); }
    }
  }
  const goal = key(end.c, end.r);
  if (!previous.has(goal)) return null;
  const route = [];
  for (let at = goal; at !== null; at = previous.get(at)) {
    route.push(point(at % cols, Math.floor(at / cols)));
  }
  route.reverse();
  route.push(target);
  return route;
}

export function exitTarget(exit) {
  return {x:exit.x + exit.w / 2, y:exit.y + exit.h / 2};
}

export async function steerTo(page, target, log) {
  const snapshot = () => page.evaluate(() => window.__echoStepsTest.snapshot());
  let state = await snapshot();
  const route = planRoute(state, target);
  if (!route) throw new Error(`No clear route in round ${state.round} to ${JSON.stringify(target)}`);
  const box = await page.locator('#c').boundingBox();
  if (!box) throw new Error('Game canvas is unavailable');
  await page.mouse.move(box.x + state.player.x, box.y + state.player.y);
  await page.mouse.down();
  try {
    for (const waypoint of route) {
      await page.mouse.move(box.x + waypoint.x, box.y + waypoint.y);
      let arrived = false;
      for (let i = 0; i < 50; i++) {
        await page.evaluate(() => window.__echoStepsTest.step());
        state = await snapshot();
        arrived = Math.hypot(state.player.x - waypoint.x, state.player.y - waypoint.y) < 6;
        if (state.mode !== 1 || state.round !== log.round ||
            arrived || (state.hasPrize && target === log.prize)) break;
      }
      log.moves.push({target:waypoint, player:state.player, mode:state.mode});
      if (state.mode !== 1 || state.round !== log.round ||
          (state.hasPrize && target === log.prize)) break;
      if (!arrived) throw new Error(`Player could not reach waypoint ${JSON.stringify(waypoint)}`);
    }
  } finally {
    await page.mouse.up();
  }
  return state;
}
