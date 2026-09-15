/* Echo Steps gameplay fairness + GC + mobile patch.
   Loaded after the main inline script so it can safely wrap existing game functions. */
(() => {
  "use strict";

  const TOUCH_OFFSET_PX = 52;
  const EXIT_CORRIDOR_PAD = Math.max(30, CFG.PLAYER_R * 2.5);

  function rectCircleHit(px, py, r, o) {
    const nx = clamp(px, o.x, o.x + o.w);
    const ny = clamp(py, o.y, o.y + o.h);
    return dist2(px, py, nx, ny) <= r * r;
  }

  function pointInPolygon(px, py, verts) {
    let inside = false;
    for (let i = 0, j = verts.length - 1; i < verts.length; j = i++) {
      const xi = verts[i].x, yi = verts[i].y;
      const xj = verts[j].x, yj = verts[j].y;
      const crosses = ((yi > py) !== (yj > py)) &&
        (px < (xj - xi) * (py - yi) / ((yj - yi) || 1e-9) + xi);
      if (crosses) inside = !inside;
    }
    return inside;
  }

  function closestOnSegment(px, py, ax, ay, bx, by) {
    const vx = bx - ax, vy = by - ay;
    const len2 = vx * vx + vy * vy;
    const t = len2 ? clamp(((px - ax) * vx + (py - ay) * vy) / len2, 0, 1) : 0;
    return { x: ax + vx * t, y: ay + vy * t };
  }

  function polygonForObstacle(o) {
    const x = o.x, y = o.y, w = o.w, h = o.h, cx = x + w / 2, cy = y + h / 2;
    switch (o.shape) {
      case "diamond":
        return [{x:cx,y}, {x:x+w,y:cy}, {x:cx,y:y+h}, {x,y:cy}];
      case "triangle":
        return [{x:cx,y}, {x:x+w,y:y+h}, {x,y:y+h}];
      case "hex":
        return [
          {x:x+w*0.25,y}, {x:x+w*0.75,y}, {x:x+w,y:cy},
          {x:x+w*0.75,y:y+h}, {x:x+w*0.25,y:y+h}, {x,y:cy}
        ];
      default:
        return null;
    }
  }

  function circleHitsPolygon(px, py, r, verts) {
    if (pointInPolygon(px, py, verts)) return true;
    for (let i = 0; i < verts.length; i++) {
      const a = verts[i], b = verts[(i + 1) % verts.length];
      const q = closestOnSegment(px, py, a.x, a.y, b.x, b.y);
      if (dist2(px, py, q.x, q.y) <= r * r) return true;
    }
    return false;
  }

  function ellipseHit(px, py, r, o) {
    const cx = o.x + o.w / 2, cy = o.y + o.h / 2;
    const rx = Math.max(1, o.w / 2 + r), ry = Math.max(1, o.h / 2 + r);
    const dx = (px - cx) / rx, dy = (py - cy) / ry;
    return dx * dx + dy * dy <= 1;
  }

  function roundedRectHit(px, py, r, o) {
    const radius = Math.min(o.w, o.h) * 0.3;
    const ix = o.x + radius, iy = o.y + radius;
    const iw = Math.max(0, o.w - radius * 2), ih = Math.max(0, o.h - radius * 2);
    if (px >= ix - r && px <= ix + iw + r && py >= o.y - r && py <= o.y + o.h + r) return true;
    if (py >= iy - r && py <= iy + ih + r && px >= o.x - r && px <= o.x + o.w + r) return true;
    const corners = [
      [ix, iy], [ix + iw, iy], [ix + iw, iy + ih], [ix, iy + ih]
    ];
    const rr = radius + r;
    return corners.some(([cx, cy]) => dist2(px, py, cx, cy) <= rr * rr);
  }

  function circleHitsObstacle(px, py, r, o) {
    if (o.shape === "circle") return ellipseHit(px, py, r, o);
    if (o.shape === "rounded") return roundedRectHit(px, py, r, o);
    const poly = polygonForObstacle(o);
    if (poly) return circleHitsPolygon(px, py, r, poly);
    return rectCircleHit(px, py, r, o);
  }

  function resolvePolygonCircle(cx, cy, r, verts) {
    let best = null;
    for (let i = 0; i < verts.length; i++) {
      const a = verts[i], b = verts[(i + 1) % verts.length];
      const q = closestOnSegment(cx, cy, a.x, a.y, b.x, b.y);
      const dx = cx - q.x, dy = cy - q.y, d2 = dx * dx + dy * dy;
      if (!best || d2 < best.d2) best = { q, dx, dy, d2 };
    }
    const inside = pointInPolygon(cx, cy, verts);
    const d = Math.sqrt(best.d2);
    if (!inside && d >= r) return { x:cx, y:cy };

    if (inside) {
      if (d > 1e-6) {
        const ux = (best.q.x - cx) / d, uy = (best.q.y - cy) / d;
        return { x: best.q.x + ux * (r + 0.5), y: best.q.y + uy * (r + 0.5) };
      }
      return { x:cx, y:cy - r - 1 };
    }

    if (d > 1e-6) {
      const push = r - d + 0.5;
      return { x: cx + (best.dx / d) * push, y: cy + (best.dy / d) * push };
    }
    return { x:cx, y:cy - r - 1 };
  }

  function resolveEllipseCircle(cx, cy, r, o) {
    const ox = o.x + o.w / 2, oy = o.y + o.h / 2;
    const rx = Math.max(1, o.w / 2 + r), ry = Math.max(1, o.h / 2 + r);
    let dx = cx - ox, dy = cy - oy;
    let n = Math.sqrt((dx * dx) / (rx * rx) + (dy * dy) / (ry * ry));
    if (n >= 1) return { x:cx, y:cy };
    if (Math.abs(dx) + Math.abs(dy) < 1e-6) { dx = 0; dy = -1; n = 1 / ry; }
    const scale = 1 / Math.max(n, 1e-6);
    return { x: ox + dx * scale * 1.002, y: oy + dy * scale * 1.002 };
  }

  function resolveRoundedRectCircle(cx, cy, r, o) {
    if (!roundedRectHit(cx, cy, r, o)) return { x:cx, y:cy };
    const radius = Math.min(o.w, o.h) * 0.3;
    const ix = clamp(cx, o.x + radius, o.x + o.w - radius);
    const iy = clamp(cy, o.y + radius, o.y + o.h - radius);
    const dx = cx - ix, dy = cy - iy, d = Math.hypot(dx, dy);
    const target = radius + r;
    if (d > 1e-6 && d < target) {
      const push = target - d + 0.5;
      return { x: cx + dx / d * push, y: cy + dy / d * push };
    }
    return resolveCircleRectBase(cx, cy, r, o);
  }

  const resolveCircleRectBase = resolveCircleRect;
  resolveCircleRect = function shapeAwareResolve(cx, cy, r, o) {
    if (o.shape === "circle") return resolveEllipseCircle(cx, cy, r, o);
    if (o.shape === "rounded") return resolveRoundedRectCircle(cx, cy, r, o);
    const poly = polygonForObstacle(o);
    if (poly) return resolvePolygonCircle(cx, cy, r, poly);
    return resolveCircleRectBase(cx, cy, r, o);
  };

  pointInObstacles = function shapeAwarePointInObstacles(px, py, pad) {
    return obstacles.some(o => circleHitsObstacle(px, py, pad, o));
  };

  function reserveExitCorridor() {
    const x1 = exit.x - EXIT_CORRIDOR_PAD, y1 = exit.y - EXIT_CORRIDOR_PAD;
    const x2 = exit.x + exit.w + EXIT_CORRIDOR_PAD, y2 = exit.y + exit.h + EXIT_CORRIDOR_PAD;
    for (const o of obstacles) {
      if (!(o.x < x2 && o.x + o.w > x1 && o.y < y2 && o.y + o.h > y1)) continue;
      if (exit.wall === "top") {
        o.y = Math.max(o.y, y2);
      } else if (exit.wall === "bottom") {
        o.y = Math.min(o.y, y1 - o.h);
      } else if (exit.wall === "left") {
        o.x = Math.max(o.x, x2);
      } else if (exit.wall === "right") {
        o.x = Math.min(o.x, x1 - o.w);
      }
      o.x = clamp(o.x, room.x, room.x + room.w - o.w);
      o.y = clamp(o.y, room.y, room.y + room.h - o.h);
    }
  }

  const updateObstaclesBase = updateObstacles;
  updateObstacles = function guardedObstacleUpdate(dt) {
    updateObstaclesBase(dt);
    reserveExitCorridor();
  };

  function buildReachableMap(clearance) {
    const step = Math.max(24, Math.round(CFG.PLAYER_R * 2.25));
    const cols = Math.max(2, Math.floor(room.w / step));
    const rows = Math.max(2, Math.floor(room.h / step));
    const free = new Uint8Array(cols * rows);
    const seen = new Uint8Array(cols * rows);
    const idx = (c, r) => r * cols + c;
    const cellPoint = (c, r) => ({
      x: room.x + (c + 0.5) * room.w / cols,
      y: room.y + (r + 0.5) * room.h / rows,
    });

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const p = cellPoint(c, r);
        free[idx(c, r)] = pointInObstacles(p.x, p.y, clearance) ? 0 : 1;
      }
    }

    let sc = clamp(Math.floor((player.x - room.x) / room.w * cols), 0, cols - 1);
    let sr = clamp(Math.floor((player.y - room.y) / room.h * rows), 0, rows - 1);
    if (!free[idx(sc, sr)]) {
      let best = null;
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        if (!free[idx(c, r)]) continue;
        const p = cellPoint(c, r), d = dist2(p.x, p.y, player.x, player.y);
        if (!best || d < best.d) best = {c, r, d};
      }
      if (!best) return null;
      sc = best.c; sr = best.r;
    }

    const q = [[sc, sr]];
    seen[idx(sc, sr)] = 1;
    for (let head = 0; head < q.length; head++) {
      const [c, r] = q[head];
      const next = [[c+1,r],[c-1,r],[c,r+1],[c,r-1]];
      for (const [nc, nr] of next) {
        if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) continue;
        const k = idx(nc, nr);
        if (!seen[k] && free[k]) { seen[k] = 1; q.push([nc, nr]); }
      }
    }

    return {
      reachable(x, y) {
        const c = clamp(Math.floor((x - room.x) / room.w * cols), 0, cols - 1);
        const r = clamp(Math.floor((y - room.y) / room.h * rows), 0, rows - 1);
        return !!seen[idx(c, r)];
      },
      candidates() {
        const out = [];
        for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
          if (seen[idx(c, r)]) out.push(cellPoint(c, r));
        }
        return out;
      }
    };
  }

  spawnPrize = function safeSpawnPrize() {
    const pad = CFG.PRIZE_R + 24;
    const reach = buildReachableMap(CFG.PLAYER_R + 5);
    const valid = (px, py) => {
      const overExit = inExitZone(px, py, pad);
      const nearPlayer = dist2(px, py, player.x, player.y) < 90 * 90;
      return !overExit && !nearPlayer && !pointInObstacles(px, py, pad) && (!reach || reach.reachable(px, py));
    };

    for (let i = 0; i < 120; i++) {
      const px = room.x + pad + Math.random() * Math.max(1, room.w - pad * 2);
      const py = room.y + pad + Math.random() * Math.max(1, room.h - pad * 2);
      if (valid(px, py)) { prize = {x:px, y:py}; return; }
    }

    if (reach) {
      const options = reach.candidates().filter(p => valid(p.x, p.y));
      if (options.length) {
        options.sort((a, b) => dist2(b.x,b.y,player.x,player.y) - dist2(a.x,a.y,player.x,player.y));
        const top = options.slice(0, Math.min(8, options.length));
        prize = top[Math.floor(Math.random() * top.length)];
        return;
      }
    }

    // Last-resort fallback: find any truly collision-free point; never blindly drop at center.
    for (let rings = 1; rings <= 10; rings++) {
      const samples = rings * 12;
      const radius = Math.min(room.w, room.h) * 0.045 * rings;
      for (let i = 0; i < samples; i++) {
        const a = i / samples * Math.PI * 2;
        const px = clamp(player.x + Math.cos(a) * radius, room.x + pad, room.x + room.w - pad);
        const py = clamp(player.y + Math.sin(a) * radius, room.y + pad, room.y + room.h - pad);
        if (!inExitZone(px, py, pad) && !pointInObstacles(px, py, pad)) { prize = {x:px, y:py}; return; }
      }
    }
    prize = null;
    toast = { text:"⚠ GRID LOCKED — RESHUFFLING", t:0 };
    obstacleLayout = makeObstacleLayout(obstacleCountForRound(round));
    buildObstacles();
    reserveExitCorridor();
    setTimeout(() => { if (mode === STATE.PLAYING && !prize && !hasPrize) spawnPrize(); }, 0);
  };

  // The original sweep removes one ghost. Keep its animation/timing, then collect
  // every excess old ghost so the board actually returns to GC_KEEP survivors.
  const updateBase = update;
  update = function strongerGarbageCollector(dt) {
    const sweepWasActive = !!sweep;
    updateBase(dt);
    if (sweepWasActive && !sweep && ghosts.length > CFG.GC_KEEP) {
      ghosts.splice(0, ghosts.length - CFG.GC_KEEP);
      toast = { text:"♻ MEMORY CLEANED — " + CFG.GC_KEEP + " ECHOES KEPT", t:0 };
    }
  };

  const drawGhostsBase = drawGhosts;
  drawGhosts = function drawGcTargets() {
    if (!sweep) { drawGhostsBase(); return; }
    const collectCount = Math.max(0, ghosts.length - CFG.GC_KEEP);
    for (let i = 0; i < ghosts.length; i++) {
      const g = ghosts[i], pos = ghostPos(g); if (!pos) continue;
      ctx.strokeStyle = selectedGhostSkin; ctx.globalAlpha = 0.10; ctx.lineWidth = 2;
      const p = g.path; ctx.beginPath(); ctx.moveTo(p[0].x, p[0].y);
      for (let k = 1; k < p.length; k += 3) ctx.lineTo(p[k].x, p[k].y);
      ctx.stroke(); ctx.globalAlpha = 1;
      const targeted = i < collectCount;
      const flick = targeted ? (0.35 + 0.55 * Math.sin(performance.now() / 38 + i)) : 1;
      glow(ctx, pos.x, pos.y, CFG.GHOST_R, selectedGhostSkin, flick);
    }
  };

  const updateHUDBase = updateHUD;
  updateHUD = function clearerGcHud() {
    updateHUDBase();
    if (sweep) {
      el.gc.textContent = "SWEEP";
      el.gc.style.color = C.sweep;
    }
  };

  function applyTouchOffset(e) {
    if (e.pointerType !== "touch" || mode !== STATE.PLAYING || paused) return;
    const p = toLocal(e);
    pointer.x = clamp(p.x, room.x + CFG.PLAYER_R, room.x + room.w - CFG.PLAYER_R);
    pointer.y = clamp(p.y - TOUCH_OFFSET_PX, room.y + CFG.PLAYER_R, room.y + room.h - CFG.PLAYER_R);
  }
  canvas.addEventListener("pointerdown", applyTouchOffset);
  canvas.addEventListener("pointermove", applyTouchOffset);

  console.info("Echo Steps gameplay fixes loaded: shape collisions, stronger GC, safe spawns, and touch offset.");
})();
