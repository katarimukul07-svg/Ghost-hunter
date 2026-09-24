/* ---------- Boot ---------- */
function initColors(){
  const cs=getComputedStyle(document.documentElement);
  const v=n=>cs.getPropertyValue(n).trim();
  C={ ghost:v("--ghost"), prize:v("--prize"), exit:v("--exit"), sweep:v("--sweep"),
      wall:v("--wall"), grid:v("--grid"), border:v("--player"), ink:v("--ink"), dim:v("--dim"), bg:v("--bg") };
}
initColors();
coins = parseInt(ls("echoSteps.coins"), 10) || 0;
bestRounds = loadBestRounds();
unlocked = loadUnlocked();
unlockedTrail = loadOwnedList("echoSteps.trailOwned", TRAILS.filter(t=>t.cost===0).map(t=>t.id));
unlockedGhostSkin = loadOwnedList("echoSteps.ghostOwned", GHOST_SKINS.filter(t=>t.cost===0).map(t=>t.id));
unlockedDeathFX = loadOwnedList("echoSteps.deathOwned", DEATH_FX.filter(t=>t.cost===0).map(t=>t.id));
unlockedSound = loadOwnedList("echoSteps.soundOwned", SOUND_PACKS.map(s=>s.id));   // all packs are free
playerName = ls("echoSteps.name") || "";
el.nameInput.value = playerName;
const savedColor = ls("echoSteps.color");
playerColor = (savedColor && unlocked.includes(savedColor)) ? savedColor : SKINS[0].id;
playerStyle = getSkinStyle(playerColor);
const savedTrail = ls("echoSteps.trail");
selectedTrail = (savedTrail && unlockedTrail.includes(savedTrail)) ? savedTrail : TRAILS[0].id;
const savedGhostSkin = ls("echoSteps.ghostSkin");
selectedGhostSkin = (savedGhostSkin && unlockedGhostSkin.includes(savedGhostSkin)) ? savedGhostSkin : GHOST_SKINS[0].id;
const savedDeathFX = ls("echoSteps.deathfx");
selectedDeathFX = (savedDeathFX && unlockedDeathFX.includes(savedDeathFX)) ? savedDeathFX : DEATH_FX[0].id;
const savedSound = ls("echoSteps.sound");
selectedSound = (savedSound && SOUND_PACKS.some(p=>p.id===savedSound)) ? savedSound : SOUND_PACKS[0].id;
Sound.setPack(selectedSound);
hintSeen = ls("echoSteps.hint") === "1";
Sound.setMuted(ls("echoSteps.mute")==="1");
refreshCoinLine();
applyColorUI(); applyGhostUI();
updateMuteBtn();
resize();
if (new URLSearchParams(location.search).has("test")) {
  Object.defineProperty(window, "__echoStepsTest", {
    value:Object.freeze({
      snapshot:()=>({
        mode, paused, round,
        player:{...player}, pointer:{...pointer}, room:{...room}, exit:{...exit},
        playerSpeed,
        departureZone:departureZone ? {...departureZone} : null,
        prize:prize ? {...prize} : null,
        ghostCount:ghosts.length,
        sweep:sweep ? {...sweep} : null,
      }),
      gcPolicy:(completedRounds)=>gcPolicyForCompletedRounds(completedRounds),
      completeRound:()=>{
        if (!currentPath.length) currentPath=[{x:player.x,y:player.y}];
        completeRound();
      },
      prepareExitHandoff:()=>{
        round=CFG.EXIT_MOVE_EVERY-1;
        player.x=exit.x+exit.w/2; player.y=exit.y+exit.h/2;
        pointer.x=player.x; pointer.y=player.y; pointer.active=false;
        currentPath=[{x:player.x,y:player.y}]; hasPrize=true;
        completeRound();
      },
      putGhostOnPlayer:()=>{
        ghosts=[{path:[{x:player.x,y:player.y}]}];
        grace=0;
      },
      movePlayerTo:(x,y)=>{
        player.x=x; player.y=y; pointer.x=x; pointer.y=y; pointer.active=false;
      },
      visualRoles:()=>({
        objective:{shape:"diamond",color:C.prize,motion:"slow-pulse-ring"},
        ghost:{shape:"circle",color:C.ghost,motion:"flicker"},
      }),
      step:(count=1)=>{ for(let i=0;i<count;i++) update(CFG.SIMULATION_STEP); },
    }),
  });
}
requestAnimationFrame(loop);
if ("serviceWorker" in navigator && !(window.EchoStepsNative && window.EchoStepsNative.isNative)) {
  window.addEventListener("load", () => navigator.serviceWorker.register("service-worker.js").catch(error => {
    console.warn("Offline cache registration failed", error);
  }));
}
"use strict";
