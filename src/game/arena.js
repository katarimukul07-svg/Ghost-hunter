/* ---------- Canvas / room ---------- */
const canvas = document.getElementById("c");
const ctx = canvas.getContext("2d");
let W=0, H=0, DPR=1;
const room = { x:0, y:0, w:0, h:0 };
let obstacles = [];
let obstacleLayout = [];
let playerSpeed = 8;

function resize() {
  const previousRoom = { x:room.x, y:room.y, w:room.w, h:room.h };
  const canRemap = previousRoom.w > 0 && previousRoom.h > 0;
  const previousExit = canRemap ? {
    wall:exit.wall,
    ratio:(exit.wall === "top" || exit.wall === "bottom")
      ? (exit.x + exit.w/2 - previousRoom.x) / previousRoom.w
      : (exit.y + exit.h/2 - previousRoom.y) / previousRoom.h,
  } : null;
  const previousDeparture = canRemap && departureZone ? {
    wall:departureZone.wall,
    ratio:(departureZone.wall === "top" || departureZone.wall === "bottom")
      ? (departureZone.x + departureZone.w/2 - previousRoom.x) / previousRoom.w
      : (departureZone.y + departureZone.h/2 - previousRoom.y) / previousRoom.h,
  } : null;

  DPR = Math.min(window.devicePixelRatio || 1, 2);
  W = canvas.clientWidth; H = canvas.clientHeight;
  canvas.width = Math.round(W*DPR); canvas.height = Math.round(H*DPR);
  ctx.setTransform(DPR,0,0,DPR,0,0);
  const rootStyle = getComputedStyle(document.documentElement);
  const safe = name => parseFloat(rootStyle.getPropertyValue(name)) || 0;
  const safeTop = safe("--safe-top"), safeRight = safe("--safe-right");
  const safeBottom = safe("--safe-bottom"), safeLeft = safe("--safe-left");
  room.x = CFG.WALL_MARGIN + safeLeft;
  room.y = CFG.WALL_MARGIN + CFG.HUD_CLEARANCE + safeTop;
  room.w = W - CFG.WALL_MARGIN*2 - safeLeft - safeRight;
  room.h = H - room.y - CFG.WALL_MARGIN - safeBottom;

  if (canRemap) {
    const remapPoint = p => {
      if (!p) return;
      p.x = room.x + ((p.x - previousRoom.x) / previousRoom.w) * room.w;
      p.y = room.y + ((p.y - previousRoom.y) / previousRoom.h) * room.h;
    };
    remapPoint(player); remapPoint(pointer); remapPoint(prize);
    currentPath.forEach(remapPoint);
    ghosts.forEach(g => g.path.forEach(remapPoint));
    positionExit(previousExit.wall, previousExit.ratio);
    if (previousDeparture) positionZone(departureZone, previousDeparture.wall, previousDeparture.ratio);
  } else {
    positionExit("top", 0.5);
  }

  playerSpeed = Math.hypot(room.w, room.h) * CFG.SPEED_FRAC;
  buildObstacles();
}
window.addEventListener("resize", resize);
if (window.visualViewport) window.visualViewport.addEventListener("resize", resize);

function positionZone(zone, wall, ratio=0.5) {
  const t = clamp(ratio, 0, 1);
  zone.wall = wall;
  if (wall === "top" || wall === "bottom") {
    zone.w = Math.min(CFG.EXIT_W, room.w);
    zone.h = Math.min(CFG.EXIT_H, room.h);
    zone.x = clamp(room.x + room.w*t - zone.w/2, room.x, room.x + room.w - zone.w);
    zone.y = wall === "top" ? room.y : room.y + room.h - zone.h;
  } else {
    zone.w = Math.min(CFG.EXIT_H, room.w);
    zone.h = Math.min(CFG.EXIT_W, room.h);
    zone.x = wall === "left" ? room.x : room.x + room.w - zone.w;
    zone.y = clamp(room.y + room.h*t - zone.h/2, room.y, room.y + room.h - zone.h);
  }
}
function positionExit(wall, ratio=0.5) { positionZone(exit, wall, ratio); }

function obstacleCountForRound(r) {
  // round 1 -> START; round ADD_EVERY (5) -> START+1; round ADD_EVERY*2 (10) -> START+2; ...
  return Math.min(CFG.OBSTACLES_MAX, CFG.OBSTACLES_START + Math.floor(r/CFG.OBSTACLES_ADD_EVERY));
}
function buildObstacles() {
  obstacles = obstacleLayout.map(o => {
    const bw = o.w*room.w, bh = o.h*room.h;
    return {
      cx: room.x + (o.x + o.w/2)*room.w, cy: room.y + (o.y + o.h/2)*room.h,
      bw, bh, w:bw, h:bh,
      x: room.x + o.x*room.w, y: room.y + o.y*room.h,
      ampX: o.ampX*room.w, ampY: o.ampY*room.h, freq:o.freq, dir:o.dir,
      shape: o.shape,
    };
  });
}
function makeObstacleLayout(count) {
  const out = [];
  const exitHalf = (CFG.EXIT_W/room.w)/2 + 0.05;
  const exitBand = (CFG.EXIT_H/room.h) + 0.07;
  let tries = 0;
  while (out.length < count && tries < 500) {
    tries++;
    const w = 0.08 + Math.random()*0.05, h = 0.08 + Math.random()*0.06;
    const x = 0.06 + Math.random()*(1-0.12-w), y = 0.20 + Math.random()*(1-0.28-h);
    const overExit    = (x < 0.5+exitHalf && x+w > 0.5-exitHalf && y < exitBand);
    const coversStart = (x-0.04 < 0.5 && x+w+0.04 > 0.5 && y-0.04 < 0.5 && y+h+0.04 > 0.5);
    let overlap = false;
    for (const o of out)
      if (x < o.x+o.w+0.03 && x+w+0.03 > o.x && y < o.y+o.h+0.03 && y+h+0.03 > o.y) { overlap=true; break; }
    if (overExit || coversStart || overlap) continue;
    const horiz = Math.random() < 0.5;
    out.push({ x, y, w, h,
      ampX: horiz ? (0.05+Math.random()*0.04) : 0,
      ampY: horiz ? 0 : (0.05+Math.random()*0.05),
      freq: 0.4+Math.random()*0.5, dir: Math.random()<0.5?-1:1,
      shape: OBSTACLE_SHAPES[Math.floor(Math.random()*OBSTACLE_SHAPES.length)] });
  }
  return out;
}
"use strict";
