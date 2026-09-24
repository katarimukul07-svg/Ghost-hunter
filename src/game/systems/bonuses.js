/* Echo Steps timed bonus system. */
(() => {
  "use strict";

  /* Random, short-lived bonuses. They begin after the teaching round so round 1
     remains calm. A double signal deliberately places two different rewards far
     apart, creating a route choice instead of free loot. */
  const BONUS_LIFETIME = 4.5;
  const BONUS_TYPES = Object.freeze({
    shield:{ label:"1-HIT", color:"#8dff6a", shape:"hex" },
    slow:{ label:"SLOW", color:"#c66bff", shape:"triangle" },
    cache:{ label:"+3", color:"#eaf2ff", shape:"square" },
  });
  let bonuses = [];
  let bonusClock = 0;
  let nextBonusAt = 6 + Math.random() * 4;
  let shieldCharges = 0;
  let slowTime = 0;
  let shieldAbsorbedThisFrame = false;

  function resetBonuses() {
    bonuses = [];
    bonusClock = 0;
    nextBonusAt = 6 + Math.random() * 4;
    shieldCharges = 0;
    slowTime = 0;
  }

  function validBonusPoint(x, y, existing) {
    const pad = 30;
    if (pointInObstacles(x, y, pad) || inExitZone(x, y, pad)) return false;
    if (prize && dist2(x, y, prize.x, prize.y) < 100 * 100) return false;
    if (dist2(x, y, player.x, player.y) < 120 * 120) return false;
    return existing.every(b => dist2(x, y, b.x, b.y) > Math.pow(Math.min(room.w, room.h) * 0.42, 2));
  }

  function findBonusPoint(existing) {
    const pad = 42;
    for (let i = 0; i < 100; i++) {
      const x = room.x + pad + Math.random() * Math.max(1, room.w - pad * 2);
      const y = room.y + pad + Math.random() * Math.max(1, room.h - pad * 2);
      if (validBonusPoint(x, y, existing)) return {x, y};
    }
    return null;
  }

  function spawnBonusSignal(forceCount, forcedTypes) {
    if (mode !== STATE.PLAYING || round < 2) return;
    const count = forceCount || (Math.random() < 0.3 ? 2 : 1);
    const names = forcedTypes || Object.keys(BONUS_TYPES).sort(() => Math.random() - 0.5);
    const spawned = [];
    for (let i = 0; i < count; i++) {
      const point = findBonusPoint(spawned);
      if (!point) break;
      const type = names[i % names.length];
      spawned.push({ ...point, type, age:0, life:BONUS_LIFETIME });
    }
    bonuses.push(...spawned);
    if (spawned.length) {
      toast = { text:spawned.length > 1 ? "⚡ DOUBLE BONUS — CHOOSE FAST!" : "⚡ BONUS SIGNAL — MOVE!", t:0 };
      haptic("light");
    }
  }

  function collectBonus(bonus) {
    if (bonus.type === "shield") {
      shieldCharges = 1;
      toast = { text:"BUFFER READY — ONE HIT BLOCKED", t:0 };
    } else if (bonus.type === "slow") {
      slowTime = Math.max(slowTime, 4);
      toast = { text:"ECHO THROTTLE — 4 SECONDS", t:0 };
    } else {
      coins += 3; runCoins += 3; saveCoins();
      pop(bonus.x, bonus.y, "+3 COINS", BONUS_TYPES.cache.color);
      toast = { text:"CACHE COLLECTED — +3 COINS", t:0 };
    }
    burst(particles, bonus.x, bonus.y, BONUS_TYPES[bonus.type].color, 22);
    shockwaves.push({ x:bonus.x, y:bonus.y, t:0 });
    Sound.pickup();
    haptic("medium");
  }

  const startDeathBase = startDeath;
  startDeath = function absorbableDeath() {
    if (shieldAbsorbedThisFrame) return;
    if (shieldCharges > 0) {
      shieldCharges--;
      shieldAbsorbedThisFrame = true;
      grace = Math.max(grace, 75);
      burst(particles, player.x, player.y, BONUS_TYPES.shield.color, 30);
      shockwaves.push({ x:player.x, y:player.y, t:0 });
      toast = { text:"BUFFER SAVED YOU!", t:0 };
      haptic("heavy");
      return;
    }
    startDeathBase();
  };

  const resetGameBase = resetGame;
  resetGame = function resetGameWithBonuses() {
    resetBonuses();
    resetGameBase();
  };

  const updateWithGc = update;
  update = function updateBonuses(dt) {
    const phaseBefore = ghostPhase;
    const roundBefore = round;
    shieldAbsorbedThisFrame = false;
    updateWithGc(dt);
    if (mode !== STATE.PLAYING) return;

    if (slowTime > 0 && round === roundBefore) {
      ghostPhase = phaseBefore + (ghostPhase - phaseBefore) * 0.5;
      slowTime = Math.max(0, slowTime - dt);
    }

    if (round >= 2) {
      bonusClock += dt;
      if (bonusClock >= nextBonusAt && bonuses.length === 0) {
        spawnBonusSignal();
        bonusClock = 0;
        nextBonusAt = 9 + Math.random() * 7;
      }
    }

    for (let i = bonuses.length - 1; i >= 0; i--) {
      const b = bonuses[i];
      b.age += dt;
      b.x = clamp(b.x, room.x + 28, room.x + room.w - 28);
      b.y = clamp(b.y, room.y + 28, room.y + room.h - 28);
      if (b.age >= b.life) { bonuses.splice(i, 1); continue; }
      const rr = CFG.PLAYER_R + 16;
      if (dist2(player.x, player.y, b.x, b.y) < rr * rr) {
        bonuses.splice(i, 1);
        collectBonus(b);
      }
    }
  };

  function traceBonusShape(b, radius) {
    const shape = BONUS_TYPES[b.type].shape;
    const points = shape === "hex" ? 6 : shape === "triangle" ? 3 : 4;
    const rotation = shape === "square" ? Math.PI / 4 : -Math.PI / 2;
    ctx.beginPath();
    for (let i = 0; i < points; i++) {
      const a = rotation + i / points * Math.PI * 2;
      const x = b.x + Math.cos(a) * radius, y = b.y + Math.sin(a) * radius;
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.closePath();
  }

  function drawBonuses() {
    const now = performance.now();
    for (const b of bonuses) {
      const info = BONUS_TYPES[b.type];
      const remaining = Math.max(0, 1 - b.age / b.life);
      const pulse = 1 + Math.sin(now / 100 + b.x) * 0.12;
      ctx.save();
      ctx.strokeStyle = info.color; ctx.fillStyle = info.color;
      ctx.shadowColor = info.color; ctx.shadowBlur = 18; ctx.lineWidth = 2;
      ctx.globalAlpha = b.age > b.life - 1 ? (0.35 + 0.55 * Math.abs(Math.sin(now / 65))) : 0.95;
      traceBonusShape(b, 14 * pulse); ctx.stroke();
      ctx.globalAlpha *= 0.2; traceBonusShape(b, 10 * pulse); ctx.fill();
      ctx.globalAlpha = 0.9; ctx.shadowBlur = 0; ctx.font = "700 9px ui-monospace, monospace";
      ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(info.label, b.x, b.y);
      ctx.globalAlpha = 0.8; ctx.lineWidth = 3; ctx.beginPath();
      ctx.arc(b.x, b.y, 21, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * remaining); ctx.stroke();
      ctx.restore();
    }

    const active = [];
    if (shieldCharges) active.push({ text:"BUFFER READY", color:BONUS_TYPES.shield.color });
    if (slowTime > 0) active.push({ text:"ECHO SLOW " + slowTime.toFixed(1) + "s", color:BONUS_TYPES.slow.color });
    active.forEach((item, i) => {
      ctx.save(); ctx.fillStyle=item.color; ctx.globalAlpha=0.9;
      ctx.font="700 11px ui-monospace, monospace"; ctx.textAlign="right";
      ctx.fillText(item.text, room.x + room.w - 10, room.y + 28 + i * 18); ctx.restore();
    });
  }

  const renderBase = render;
  render = function renderWithBonuses() {
    renderBase();
    if (mode === STATE.PLAYING) drawBonuses();
  };

  if (new URLSearchParams(location.search).has("test")) {
    Object.defineProperty(window, "__echoStepsBonusTest", {
      value:Object.freeze({
        snapshot:()=>({
          bonuses:bonuses.map(b=>({...b})), shieldCharges, slowTime,
          nextBonusAt, bonusClock,
        }),
        spawn:(count=1, types=["shield","slow"])=>spawnBonusSignal(count, types),
        movePlayerToBonus:(index=0)=>{
          const b=bonuses[index]; if (!b) return;
          player.x=b.x; player.y=b.y; pointer.x=b.x; pointer.y=b.y;
        },
        expire:()=>bonuses.forEach(b=>{ b.age=b.life; }),
      }),
    });
  }

  console.info("Echo Steps timed bonuses loaded.");
})();
