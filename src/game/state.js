/* ---------- State ---------- */
const STATE = { START:0, PLAYING:1, OVER:2, DYING:3 };
let mode = STATE.START;

const player = { x:0, y:0 };
const pointer = { x:0, y:0, active:false };
const exit = { x:0, y:0, w:CFG.EXIT_W, h:CFG.EXIT_H, wall:"top" };
let departureZone = null;
/* left/right labels are rotated 90deg in drawExit(), so their pre-rotation glyph
   is swapped (down->becomes left, up->becomes right) so the arrow reads correctly */
const EXIT_ARROW = { top:"▲", bottom:"▼", left:"▼", right:"▲" };
let prize = null, hasPrize = false;

let currentPath = [], ghosts = [];
let frame = 0, round = 1, grace = 0;
let coins = 0, runCoins = 0, bestRounds = 0;   // coins = spendable bank; bestRounds = leaderboard record
let ghostPhase = 0, ghostSpeed = 1, wallTime = 0;
let toast = null, particles = [], pops = [], shake = 0, deathTimer = 0;
let sweep = null, paused = false;
let shockwaves = [];

let playerColor = SKINS[0].id, playerStyle = SKINS[0].style, playerName = "";
let unlocked = [];
let selectedTrail = TRAILS[0].id, selectedGhostSkin = GHOST_SKINS[0].id, selectedDeathFX = DEATH_FX[0].id;
let unlockedTrail = [], unlockedGhostSkin = [], unlockedDeathFX = [];
let selectedSound = SOUND_PACKS[0].id, unlockedSound = [];
let hintSeen = false;
let C = {};

/* ---------- Shop preview panel state ---------- */
let previewTab = "colors";
let previewColor = SKINS[0].id, previewTrail = TRAILS[0].id, previewGhostColor = GHOST_SKINS[0].id, previewDeath = DEATH_FX[0].id;
let previewPhase = 0, previewDeathT = 0, previewTrailPath = [];
let previewParticles = [], previewShockwaves = [];

/* ---------- DOM ---------- */
const el = {
  hud:document.getElementById("hud"),
  round:document.getElementById("hudRound"), coins:document.getElementById("hudCoins"),
  gc:document.getElementById("hudGc"), mute:document.getElementById("muteBtn"),
  start:document.getElementById("startScreen"),
  pause:document.getElementById("pauseScreen"),
  over:document.getElementById("overScreen"),
  finalRounds:document.getElementById("finalRounds"),
  bestScore:document.getElementById("bestScore"),
  finalCoins:document.getElementById("finalCoins"),
  totalCoinsOver:document.getElementById("totalCoinsOver"),
  newBest:document.getElementById("newBest"), overSub:document.getElementById("overSub"),
  overTitle:document.getElementById("overTitle"),
  nameInput:document.getElementById("nameInput"),
  hintDot:document.getElementById("hintDot"), hintGhost:document.getElementById("hintGhost"),
  coinLine:document.getElementById("coinLine"),
  shop:document.getElementById("shopScreen"), shopBtn:document.getElementById("shopBtn"),
  shopBack:document.getElementById("shopBackBtn"), shopCoinLine:document.getElementById("shopCoinLine"),
  shopTabs:document.getElementById("shopTabs"), shopPreview:document.getElementById("shopPreview"),
  shopColors:document.getElementById("shopColors"), shopTrail:document.getElementById("shopTrail"),
  shopGhost:document.getElementById("shopGhost"), shopDeath:document.getElementById("shopDeath"),
  shopSound:document.getElementById("shopSound"), shopHint:document.getElementById("shopHint"),
};

/* ---------- Helpers ---------- */
const clamp = (v,lo,hi) => Math.max(lo, Math.min(hi,v));
const dist2 = (ax,ay,bx,by) => { const dx=ax-bx, dy=ay-by; return dx*dx+dy*dy; };
function haptic(kind="light"){
  if (window.EchoStepsNative) window.EchoStepsNative.haptic(kind);
  else if (navigator.vibrate) navigator.vibrate(kind==="heavy" ? 45 : kind==="medium" ? 25 : 15);
}
function pointInObstacles(px,py,pad){
  for (const o of obstacles)
    if (px>o.x-pad && px<o.x+o.w+pad && py>o.y-pad && py<o.y+o.h+pad) return true;
  return false;
}
/* The active exit is ghost-free. When it relocates, the previous exit becomes
   a short one-way departure zone so the player cannot die during the handoff. */
function inZone(zone,px,py,pad=0){
  return !!zone && px>zone.x-pad && px<zone.x+zone.w+pad && py>zone.y-pad && py<zone.y+zone.h+pad;
}
function inExitZone(px,py,pad){
  return inZone(exit,px,py,pad);
}
function inDepartureZone(px,py,pad){
  return inZone(departureZone,px,py,pad);
}
function reserveZoneCorridor(zone, pad=CFG.EXIT_SAFE_PAD){
  if (!zone) return;
  const x1=zone.x-pad, y1=zone.y-pad, x2=zone.x+zone.w+pad, y2=zone.y+zone.h+pad;
  for (const o of obstacles){
    if (!(o.x<x2 && o.x+o.w>x1 && o.y<y2 && o.y+o.h>y1)) continue;
    if (zone.wall==="top") o.y=Math.max(o.y,y2);
    else if (zone.wall==="bottom") o.y=Math.min(o.y,y1-o.h);
    else if (zone.wall==="left") o.x=Math.max(o.x,x2);
    else if (zone.wall==="right") o.x=Math.min(o.x,x1-o.w);
    o.x=clamp(o.x,room.x,room.x+room.w-o.w);
    o.y=clamp(o.y,room.y,room.y+room.h-o.h);
  }
}
function reserveSafeCorridors(){
  reserveZoneCorridor(exit);
  reserveZoneCorridor(departureZone);
}
function resolveCircleRect(cx,cy,r,o){
  const nx=clamp(cx,o.x,o.x+o.w), ny=clamp(cy,o.y,o.y+o.h);
  const dx=cx-nx, dy=cy-ny, d=Math.hypot(dx,dy);
  if (d>0 && d<r){ const push=r-d; return {x:cx+(dx/d)*push, y:cy+(dy/d)*push}; }
  if (d===0){
    const left=cx-o.x, right=o.x+o.w-cx, top=cy-o.y, bottom=o.y+o.h-cy;
    const m=Math.min(left,right,top,bottom);
    if (m===left) return {x:o.x-r, y:cy};
    if (m===right) return {x:o.x+o.w+r, y:cy};
    if (m===top) return {x:cx, y:o.y-r};
    return {x:cx, y:o.y+o.h+r};
  }
  return {x:cx, y:cy};
}
function spawnPrize(){
  const pad = CFG.PRIZE_R + 24;
  for (let i=0;i<60;i++){
    const px = room.x+pad+Math.random()*(room.w-pad*2);
    const py = room.y+pad+Math.random()*(room.h-pad*2);
    const overExit = px>exit.x-pad && px<exit.x+exit.w+pad && py>exit.y-pad && py<exit.y+exit.h+pad;
    const nearPlayer = dist2(px,py,player.x,player.y) < 90*90;
    if (!overExit && !nearPlayer && !pointInObstacles(px,py,pad)){ prize={x:px,y:py}; return; }
  }
  prize = { x:room.x+room.w/2, y:room.y+room.h*0.5 };
}
function repositionExit(){
  const walls = ["top","bottom","left","right"];
  const pad = 16;
  for (let tries=0; tries<40; tries++){
    const wall = walls[Math.floor(Math.random()*walls.length)];
    let w, h, x, y;
    if (wall==="top" || wall==="bottom"){
      w = CFG.EXIT_W; h = CFG.EXIT_H;
      x = room.x + Math.random()*(room.w-w);
      y = wall==="top" ? room.y : room.y+room.h-h;
    } else {
      w = CFG.EXIT_H; h = CFG.EXIT_W;
      x = wall==="left" ? room.x : room.x+room.w-w;
      y = room.y + Math.random()*(room.h-h);
    }
    const overlapsObstacle = obstacles.some(o => x<o.x+o.w+pad && x+w+pad>o.x && y<o.y+o.h+pad && y+h+pad>o.y);
    const nearPlayer = dist2(x+w/2, y+h/2, player.x, player.y) < 130*130;
    if (!overlapsObstacle && !nearPlayer){
      exit.x=x; exit.y=y; exit.w=w; exit.h=h; exit.wall=wall;
      return;
    }
  }
}

/* ---------- Persistence (guarded) ---------- */
function ls(k){ try{ return localStorage.getItem(k); }catch(e){ return null; } }
function ss(k,v){
  try {
    localStorage.setItem(k,v);
    window.dispatchEvent(new CustomEvent("echosteps:save-changed", { detail:{ key:k } }));
  } catch(e){}
}
function loadBestRounds(){ return parseInt(ls("echoSteps.bestRounds"),10) || 0; }
function saveBestRounds(v){ ss("echoSteps.bestRounds", String(v)); }
function saveCoins(){ ss("echoSteps.coins", String(coins)); }
function loadUnlocked(){
  const base = SKINS.filter(k=>k.cost===0).map(k=>k.id);
  const saved = (ls("echoSteps.unlocked")||"").split(",").filter(Boolean);
  return Array.from(new Set(base.concat(saved)));
}
function saveUnlocked(){ ss("echoSteps.unlocked", unlocked.join(",")); }
function loadOwnedList(key, freeIds){
  const saved = (ls(key)||"").split(",").filter(Boolean);
  return Array.from(new Set(freeIds.concat(saved)));
}
function saveOwnedList(key, list){ ss(key, list.join(",")); }

/* Collect a coin: +1 to the run haul and the permanent bank. */
function collectCoin(x, y){ coins++; runCoins++; saveCoins(); pop(x, y, "+1", C.prize); }
function pop(x, y, text, color){ pops.push({ x, y, text, color, life:1 }); }
"use strict";
