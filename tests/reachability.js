// Explore the player's collision-free grid independently of prize placement.
// The test hook supplies the game's shape-aware collision footprint.
export async function checkReachability(page) {
  return page.evaluate(() => {
    const game = window.__echoStepsTest;
    const {room, player, prize, exit} = game.snapshot();
    const radius = 12.5;
    const cols = Math.max(2, Math.floor((room.w - radius * 2) / 7) + 1);
    const rows = Math.max(2, Math.floor((room.h - radius * 2) / 7) + 1);
    const point = (c, r) => ({
      x:room.x + radius + c * (room.w - radius * 2) / (cols - 1),
      y:room.y + radius + r * (room.h - radius * 2) / (rows - 1),
    });
    const index = (c, r) => r * cols + c;
    const free = new Uint8Array(cols * rows);
    let start = -1, nearest = Infinity;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const p = point(c, r), cell = index(c, r);
      if (!game.canStandAt(p.x, p.y)) continue;
      free[cell] = 1;
      const distance = Math.hypot(p.x - player.x, p.y - player.y);
      if (distance < nearest) { nearest = distance; start = cell; }
    }
    if (start < 0 || nearest > 25) return {prize:false, exit:false};
    const seen = new Uint8Array(free.length);
    const queue = [start];
    seen[start] = 1;
    let prizeReached = false, exitReached = false;
    for (let head = 0; head < queue.length; head++) {
      const cell = queue[head], c = cell % cols, r = Math.floor(cell / cols);
      const p = point(c, r);
      if (prize && Math.hypot(p.x - prize.x, p.y - prize.y) < 23) prizeReached = true;
      if (p.x > exit.x && p.x < exit.x + exit.w &&
          p.y > exit.y && p.y < exit.y + exit.h) exitReached = true;
      if (prizeReached && exitReached) break;
      for (const [dc, dr] of [[1,0],[-1,0],[0,1],[0,-1]]) {
        const nc = c + dc, nr = r + dr;
        if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) continue;
        const next = index(nc, nr);
        if (free[next] && !seen[next]) { seen[next] = 1; queue.push(next); }
      }
    }
    return {prize:prizeReached, exit:exitReached};
  });
}
