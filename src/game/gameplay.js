/* ---------- Lifecycle ---------- */
function resetGame() {
  resize();
  positionExit("top", 0.5);
  round = 1;
  obstacleLayout = makeObstacleLayout(CFG.OBSTACLES_START);
  buildObstacles();
  player.x = room.x+room.w/2; player.y = room.y+room.h/2;
  pointer.x = player.x; pointer.y = player.y; pointer.active = false;
  ghosts = []; currentPath = []; particles = []; pops = []; shockwaves = [];
  departureZone = null;
  frame = 0; grace = CFG.GRACE_TICKS; runCoins = 0;
  ghostPhase = 0; ghostSpeed = 1; wallTime = 0;
  toast = null; shake = 0; deathTimer = 0; sweep = null;
  hasPrize = false; paused = false;
  playerName = (el.nameInput.value || "").trim().slice(0,12) || "Player";
  ss("echoSteps.name", playerName);
  spawnPrize();
  mode = STATE.PLAYING;
  if (window.EchoStepsCloud) window.EchoStepsCloud.startRankedRun();
  el.start.classList.add("hidden");
  el.over.classList.add("hidden");
  el.pause.classList.add("hidden");
  el.hud.classList.remove("hidden");
  Sound.unlock(); Sound.startAmbient();
}
function trimPathAtExit(path){
  const pad = CFG.GHOST_R + 6;
  let end = path.length;
  while (end>1 && path[end-1].x>exit.x-pad && path[end-1].x<exit.x+exit.w+pad &&
         path[end-1].y>exit.y-pad && path[end-1].y<exit.y+exit.h+pad) end--;
  return path.slice(0, end);
}
function completeRound() {
  const clearedRound = round;
  if (window.EchoStepsCloud) window.EchoStepsCloud.checkpointRankedRound(clearedRound);
  burst(particles, exit.x+exit.w/2, exit.y+exit.h/2, C.exit, 24);
  shockwaves.push({ x:exit.x+exit.w/2, y:exit.y+exit.h/2, t:0 });
  pop(exit.x+exit.w/2, exit.y+exit.h/2, "ROUND " + clearedRound + " CLEAR", C.exit);
  haptic("medium");
  if (!hintSeen && clearedRound===1){ hintSeen=true; ss("echoSteps.hint","1"); }
  ghosts.push({ path: trimPathAtExit(currentPath) });
  round++; currentPath = []; frame = 0; ghostPhase = 0;
  const completedRounds = round - 1;
  const gcPolicy = gcPolicyForCompletedRounds(completedRounds);
  grace = CFG.GRACE_TICKS; hasPrize = false;
  if (round>CFG.RAMP_START) ghostSpeed *= (1+CFG.GHOST_RAMP);
  if (round===CFG.RAMP_START+1) toast = { text:"\u26A0 THINGS GET WILD!", t:0 };
  if (gcPolicy.shouldSweep && ghosts.length && !sweep) {
    sweep={t:0, remove:Math.min(gcPolicy.remove, ghosts.length), completedRounds};
    Sound.sweep();
  }
  if (round % CFG.EXIT_MOVE_EVERY === 0){
    const oldExit={...exit};
    repositionExit();
    departureZone={...oldExit, ticks:CFG.EXIT_HANDOFF_TICKS};
    toast = { text:"\u21C4 EXIT MOVED \u2014 DEPARTURE SAFE!", t:0 };
  }
  const wantObstacles = obstacleCountForRound(round);
  const atMaxObstacles = wantObstacles >= CFG.OBSTACLES_MAX;
  // once capped, reshuffle shape+size every OBSTACLES_ADD_EVERY rounds instead of adding more
  const dueForMaxShuffle = atMaxObstacles && round % CFG.OBSTACLES_ADD_EVERY === 0;
  if (wantObstacles !== obstacleLayout.length || dueForMaxShuffle){
    obstacleLayout = makeObstacleLayout(wantObstacles);
    buildObstacles();
    toast = atMaxObstacles
      ? { text:"\u26A0 OBSTACLES SHIFT SHAPE & SIZE!", t:0 }
      : { text:"\u26A0 NEW OBSTACLE!", t:0 };
  }
  reserveSafeCorridors();
  spawnPrize(); Sound.complete();
}
function startDeath() {
  mode = STATE.DYING; deathTimer = 0; shake = 16;
  playDeathFX(player.x, player.y);
  haptic("heavy");
  Sound.death(); Sound.stopAmbient();
}
function finalizeDeath() {
  mode = STATE.OVER;
  const reached = round - 1;
  if (window.EchoStepsCloud) window.EchoStepsCloud.finishRankedRun();
  const isBest = reached > bestRounds;
  if (isBest){ bestRounds = reached; saveBestRounds(bestRounds); }
  el.finalRounds.textContent = reached;
  el.bestScore.textContent = bestRounds;
  el.finalCoins.textContent = runCoins;
  el.totalCoinsOver.textContent = coins;
  el.newBest.style.display = (isBest && reached>0) ? "" : "none";
  el.overTitle.textContent = DEATH_TITLES[Math.floor(Math.random()*DEATH_TITLES.length)];
  el.overSub.textContent = playerName + ", " + DEATH_LINES[Math.floor(Math.random()*DEATH_LINES.length)];
  refreshRetryBtn();
  el.over.classList.remove("hidden");
  el.hud.classList.add("hidden");
}

/* ---------- Ghost sampling ---------- */
function ghostPos(g){
  const p=g.path, n=p.length;
  if (!n) return null;
  if (n===1) return p[0];
  const period=(n-1)*2;
  let ph=ghostPhase%period;
  const idx=(ph<=n-1)?ph:period-ph;
  const i0=Math.floor(idx), i1=Math.min(i0+1,n-1), f=idx-i0;
  return { x:p[i0].x+(p[i1].x-p[i0].x)*f, y:p[i0].y+(p[i1].y-p[i0].y)*f };
}

/* ---------- Walls: grow + drift ---------- */
function updateObstacles(dt){
  if (round>CFG.RAMP_START) wallTime += dt*CFG.WALL_DRIFT;
  const scale = obstacleScaleForRound(round);
  for (const o of obstacles){
    o.w=o.bw*scale; o.h=o.bh*scale;
    const s=Math.sin(wallTime*o.freq)*o.dir;
    o.x=clamp(o.cx-o.w/2+s*o.ampX, room.x, room.x+room.w-o.w);
    o.y=clamp(o.cy-o.h/2+s*o.ampY, room.y, room.y+room.h-o.h);
  }
}

/* ---------- Particles / shake ---------- */
function burst(arr,x,y,color,n){
  for (let i=0;i<n;i++){
    const a=Math.random()*Math.PI*2, sp=1+Math.random()*4.5;
    arr.push({ x, y, vx:Math.cos(a)*sp, vy:Math.sin(a)*sp, life:1, color, r:1.5+Math.random()*2.5 });
  }
}
function burstMulti(arr,x,y,colors,n){
  for (let i=0;i<n;i++){
    const a=Math.random()*Math.PI*2, sp=1+Math.random()*4.5;
    const color = colors[Math.floor(Math.random()*colors.length)];
    arr.push({ x, y, vx:Math.cos(a)*sp, vy:Math.sin(a)*sp, life:1, color, r:1.5+Math.random()*2.5 });
  }
}
function burstImplode(arr,x,y,color,n){
  for (let i=0;i<n;i++){
    const a=Math.random()*Math.PI*2, r=30+Math.random()*40, sp=2+Math.random()*3;
    arr.push({ x:x+Math.cos(a)*r, y:y+Math.sin(a)*r, vx:-Math.cos(a)*sp, vy:-Math.sin(a)*sp, life:1, color, r:1.5+Math.random()*2.5 });
  }
}
function runDeathFX(fx, arr, shockArr, x, y, ghostColor){
  switch (fx){
    case "shockwave":
      burst(arr,x,y,playerColor,16);
      shockArr.push({ x, y, t:0 });
      break;
    case "confetti":
      burstMulti(arr,x,y,CONFETTI_COLORS,30);
      break;
    case "implode":
      burstImplode(arr,x,y,ghostColor,22);
      burst(arr,x,y,playerColor,10);
      break;
    default:
      burst(arr,x,y,playerColor,26);
      burst(arr,x,y,ghostColor,12);
  }
}
function playDeathFX(x,y){
  runDeathFX(selectedDeathFX, particles, shockwaves, x, y, selectedGhostSkin);
}
function updateEffects(dt){
  for (let i=particles.length-1;i>=0;i--){
    const p=particles[i];
    p.x+=p.vx; p.y+=p.vy; p.vx*=0.93; p.vy*=0.93; p.life-=dt*1.5;
    if (p.life<=0) particles.splice(i,1);
  }
  for (let i=pops.length-1;i>=0;i--){
    const q=pops[i]; q.y-=0.7; q.life-=dt*1.1;
    if (q.life<=0) pops.splice(i,1);
  }
  for (let i=shockwaves.length-1;i>=0;i--){
    const s=shockwaves[i]; s.t+=dt/0.6;
    if (s.t>=1) shockwaves.splice(i,1);
  }
  if (shake>0.3) shake*=0.86; else shake=0;
}

/* ---------- Update ---------- */
function update(dt) {
  if (mode===STATE.DYING){ deathTimer+=dt; if (deathTimer>0.6) finalizeDeath(); return; }
  if (mode!==STATE.PLAYING) return;

  updateObstacles(dt);

  const dx=pointer.x-player.x, dy=pointer.y-player.y, d=Math.hypot(dx,dy);
  if (d>0.5){ const step=Math.min(d,playerSpeed); player.x+=(dx/d)*step; player.y+=(dy/d)*step; }
  player.x = clamp(player.x, room.x+CFG.PLAYER_R, room.x+room.w-CFG.PLAYER_R);
  player.y = clamp(player.y, room.y+CFG.PLAYER_R, room.y+room.h-CFG.PLAYER_R);
  for (let pass=0;pass<2;pass++)
    for (const o of obstacles){ const r=resolveCircleRect(player.x,player.y,CFG.PLAYER_R,o); player.x=r.x; player.y=r.y; }

  currentPath.push({ x:player.x, y:player.y });

  if (prize && !hasPrize){
    const rr=CFG.PLAYER_R+CFG.PRIZE_R;
    if (dist2(player.x,player.y,prize.x,prize.y) < rr*rr){
      burst(particles, prize.x, prize.y, C.prize, 26);
      shockwaves.push({ x:prize.x, y:prize.y, t:0 });
      collectCoin(prize.x, prize.y);            // +1 coin (currency)
      haptic("medium");
      hasPrize=true; prize=null; Sound.pickup();
      toast = { text:"TARGET SECURED — REACH THE EXIT", t:0 };
    }
  }
  if (hasPrize && player.x>exit.x && player.x<exit.x+exit.w && player.y>exit.y && player.y<exit.y+exit.h)
    completeRound();

  if (departureZone){
    departureZone.ticks--;
    if (departureZone.ticks<=0 || !inDepartureZone(player.x,player.y,CFG.PLAYER_R)) departureZone=null;
  }

  if (sweep){ sweep.t += dt/CFG.SWEEP_TIME; if (sweep.t>=1){ if (ghosts.length) ghosts.shift(); sweep=null; } }

  if (grace>0) grace--;
  else if (!inExitZone(player.x, player.y, CFG.GHOST_R) &&
           !inDepartureZone(player.x, player.y, CFG.GHOST_R)) {
    const rr=CFG.PLAYER_R+CFG.GHOST_R;
    for (const g of ghosts){
      const pos=ghostPos(g);
      if (pos && dist2(player.x,player.y,pos.x,pos.y) < rr*rr){ startDeath(); break; }
    }
  }

  if (toast){ toast.t+=dt; if (toast.t>2.6) toast=null; }
  ghostPhase += ghostSpeed; frame++;
}
"use strict";
