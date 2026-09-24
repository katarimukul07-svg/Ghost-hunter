/* ---------- Loop ---------- */
let last = performance.now(), acc = 0;
function loop(now){
  let dt=(now-last)/1000; last=now; if (dt>0.1) dt=0.1; acc+=dt;
  while (acc>=CFG.SIMULATION_STEP){
    if (!paused) update(CFG.SIMULATION_STEP);
    updateEffects(CFG.SIMULATION_STEP);
    acc-=CFG.SIMULATION_STEP;
  }
  render();
  if (mode===STATE.PLAYING && !paused) updateHUD();
  if (!el.shop.classList.contains("hidden")) drawShopPreview();
  requestAnimationFrame(loop);
}

/* ---------- Input ---------- */
function toLocal(e){ const r=canvas.getBoundingClientRect(); return {x:e.clientX-r.left, y:e.clientY-r.top}; }
function onMove(e){ const p=toLocal(e); pointer.x=p.x; pointer.y=p.y; }
canvas.addEventListener("pointerdown",(e)=>{ pointer.active=true; onMove(e); canvas.setPointerCapture(e.pointerId); });
canvas.addEventListener("pointermove", (e)=>{ if (pointer.active) onMove(e); });
canvas.addEventListener("pointerup", ()=>{ pointer.active=false; });
canvas.addEventListener("pointercancel", ()=>{ pointer.active=false; });

/* ---------- Menu / buttons ---------- */
function refreshCoinLine(){
  el.coinLine.textContent = "\u25C6 " + coins + " coins \u00B7 best " + bestRounds + " rounds";
}
function applyColorUI(){ el.hintDot.style.color = playerColor; }
function applyGhostUI(){ if (el.hintGhost) el.hintGhost.style.color = selectedGhostSkin; }
function renderShopCategory(container, items, ownedArr, ownedKey, getSel, setSel, swatch, previewCat){
  container.innerHTML = "";
  items.forEach(item => {
    const owned = ownedArr.includes(item.id);
    const wrap = document.createElement("div"); wrap.className = "skin";
    const b = document.createElement("button");
    b.className = (swatch?"swatch":"chip") + (item.id===getSel()?" sel":"") + (owned?"":" locked");
    if (swatch) b.style.background = item.id; else b.textContent = item.label;
    const price = document.createElement("div"); price.className = "price";
    price.textContent = owned ? (item.id===getSel() ? "\u2713" : "") : ("\u25C6" + item.cost);
    b.addEventListener("click", () => {
      setPreviewItem(previewCat, item.id);                       // always preview what's tapped
      if (ownedArr.includes(item.id)) {                          // already owned -> select
        setSel(item.id);
        renderShopCategory(container, items, ownedArr, ownedKey, getSel, setSel, swatch, previewCat);
      } else if (coins >= item.cost) {                           // buy it
        coins -= item.cost; saveCoins();
        ownedArr.push(item.id); saveOwnedList(ownedKey, ownedArr);
        setSel(item.id);
        haptic("medium");
        refreshShopCoinLine();
        renderShopCategory(container, items, ownedArr, ownedKey, getSel, setSel, swatch, previewCat);
      } else {                                                   // can't afford -> flash price red
        price.style.color = C.ghost; setTimeout(()=>{ price.style.color = ""; }, 450);
      }
    });
    wrap.appendChild(b);
    if (swatch && item.label){
      const label = document.createElement("div"); label.className = "slabel"; label.textContent = item.label;
      wrap.appendChild(label);
    }
    wrap.appendChild(price);
    container.appendChild(wrap);
  });
}
function buildShopAll(){
  renderShopCategory(el.shopColors, SKINS, unlocked, "echoSteps.unlocked",
    ()=>playerColor, (v)=>{ playerColor=v; playerStyle=getSkinStyle(v); ss("echoSteps.color",v); applyColorUI(); }, true, "colors");
  renderShopCategory(el.shopTrail, TRAILS, unlockedTrail, "echoSteps.trailOwned",
    ()=>selectedTrail, (v)=>{ selectedTrail=v; ss("echoSteps.trail",v); }, false, "trail");
  renderShopCategory(el.shopGhost, GHOST_SKINS, unlockedGhostSkin, "echoSteps.ghostOwned",
    ()=>selectedGhostSkin, (v)=>{ selectedGhostSkin=v; ss("echoSteps.ghostSkin",v); applyGhostUI(); }, true, "ghost");
  renderShopCategory(el.shopDeath, DEATH_FX, unlockedDeathFX, "echoSteps.deathOwned",
    ()=>selectedDeathFX, (v)=>{ selectedDeathFX=v; ss("echoSteps.deathfx",v); }, false, "death");
  renderShopCategory(el.shopSound, SOUND_PACKS, unlockedSound, "echoSteps.soundOwned",
    ()=>selectedSound, selectSoundPack, false, "sound");
}
function selectSoundPack(id){
  selectedSound = id; ss("echoSteps.sound", id);
  Sound.setPack(id);
  Sound.unlock();
  Sound.previewPack();   // let the player hear the pack immediately
}
function refreshShopCoinLine(){
  el.shopCoinLine.textContent = "\u25C6 " + coins + " coins";
}
function setShopTab(cat){
  const map = { colors:el.shopColors, trail:el.shopTrail, ghost:el.shopGhost, death:el.shopDeath, sound:el.shopSound };
  Object.keys(map).forEach(k => map[k].classList.toggle("hidden", k!==cat));
  el.shopTabs.querySelectorAll(".tab").forEach(t => t.classList.toggle("active", t.dataset.cat===cat));
  previewTab = cat;
  if (cat==="colors") previewColor = playerColor;
  else if (cat==="trail") previewTrail = selectedTrail;
  else if (cat==="ghost") previewGhostColor = selectedGhostSkin;
  else if (cat==="death") setPreviewItem("death", selectedDeathFX);
  const hints = {
    colors:"Choose the shape and color of your NODE.",
    trail:"Preview the trail that follows your movement.",
    ghost:"Change how your dangerous echoes appear.",
    death:"Preview the effect shown when an echo catches you.",
    sound:"Tap a sound pack to hear and equip it for free.",
  };
  el.shopHint.textContent = hints[cat] || "Tap an item to preview it.";
}
let shopReturnTo = "start";   // where BACK sends us: "start" or "pause"
function openShop(tab){
  refreshShopCoinLine(); buildShopAll(); setShopTab(tab || "colors");
  el.start.classList.add("hidden"); el.pause.classList.add("hidden");
  el.shop.classList.remove("hidden");
}
function closeShop(){
  el.shop.classList.add("hidden");
  if (shopReturnTo === "pause") el.pause.classList.remove("hidden");
  else { el.start.classList.remove("hidden"); refreshCoinLine(); }
}
function showStart(){
  mode = STATE.START;
  el.over.classList.add("hidden"); el.pause.classList.add("hidden"); el.hud.classList.add("hidden");
  el.shop.classList.add("hidden");
  Sound.stopAmbient();
  refreshCoinLine(); applyColorUI(); applyGhostUI();
  el.start.classList.remove("hidden");
}
function updateMuteBtn(){
  const m=Sound.isMuted();
  el.mute.innerHTML = m ? "&#9834; OFF" : "&#9834; ON";
  el.mute.style.color = m ? C.dim : C.ink;
  el.mute.setAttribute("aria-pressed", m ? "true" : "false");
}
/* ---------- Retry (revive at same round for coins) ---------- */
function refreshRetryBtn(){
  const btn = document.getElementById("retryBtn");
  if (!btn) return;
  btn.innerHTML = "RETRY \u25C6" + CFG.RETRY_COST;
  btn.style.opacity = (coins >= CFG.RETRY_COST) ? "1" : "0.5";
}
function retryRun(){
  if (coins < CFG.RETRY_COST){
    el.overSub.textContent = "Collect more coins in future runs to afford a revive.";
    haptic("medium");
    return;
  }
  coins -= CFG.RETRY_COST; saveCoins();
  player.x = room.x+room.w/2; player.y = room.y+room.h/2;
  pointer.x = player.x; pointer.y = player.y; pointer.active = false;
  currentPath = []; frame = 0; ghostPhase = 0;
  grace = CFG.GRACE_TICKS*2;                                  // extra grace on revive
  hasPrize = false; paused = false;
  particles = []; pops = []; shockwaves = []; sweep = null;
  departureZone = null;
  spawnPrize();
  toast = { text:"\u21BB REVIVED \u2014 GHOSTS STILL HUNT", t:0 };
  mode = STATE.PLAYING;
  el.over.classList.add("hidden");
  el.hud.classList.remove("hidden");
  haptic("medium");
  Sound.unlock(); Sound.startAmbient();
}

document.getElementById("retryBtn").addEventListener("click", retryRun);
document.getElementById("startBtn").addEventListener("click", resetGame);
document.getElementById("restartBtn").addEventListener("click", resetGame);
document.getElementById("menuBtn").addEventListener("click", showStart);
el.shopBtn.addEventListener("click", ()=>{ shopReturnTo = "start"; openShop(); });
el.shopBack.addEventListener("click", closeShop);
el.shopTabs.addEventListener("click", (e) => {
  const b = e.target.closest(".tab"); if (!b) return;
  setShopTab(b.dataset.cat);
});
document.getElementById("resumeBtn").addEventListener("click", ()=>{
  paused=false; grace=CFG.GRACE_TICKS; el.pause.classList.add("hidden"); Sound.startAmbient();
});
document.getElementById("pauseRestartBtn").addEventListener("click", ()=>{
  el.pause.classList.add("hidden");
  resetGame();
});
document.getElementById("pauseMenuBtn").addEventListener("click", ()=>{
  paused = false;
  el.pause.classList.add("hidden");
  showStart();
});
document.getElementById("pauseSoundBtn").addEventListener("click", ()=>{
  shopReturnTo = "pause";
  openShop("sound");
});
document.getElementById("pauseBtn").addEventListener("click", ()=>{
  if (mode!==STATE.PLAYING || paused) return;
  paused = true; Sound.stopAmbient(); el.pause.classList.remove("hidden");
});
el.mute.addEventListener("click", ()=>{
  Sound.setMuted(!Sound.isMuted()); ss("echoSteps.mute", Sound.isMuted()?"1":"0"); updateMuteBtn();
});
document.getElementById("shareBtn").addEventListener("click", async ()=>{
  const url=location.href;
  const text=playerName+" reached round "+(round-1)+" in Echo Steps! Can you beat it?";
  const b=document.getElementById("shareBtn");
  try {
    if (navigator.share){ await navigator.share({ title:"Echo Steps", text, url }); return; }
    await navigator.clipboard.writeText(text+" "+url);
    const old=b.textContent; b.textContent="COPIED!"; setTimeout(()=>{ b.textContent=old; },1500);
  } catch(e){}
});

/* ---------- Web/native lifecycle ---------- */
function pauseForInterruption(){
  if (mode===STATE.PLAYING && !paused){
    pointer.active=false; paused=true; Sound.stopAmbient(); el.pause.classList.remove("hidden");
  }
}
document.addEventListener("visibilitychange", ()=>{ if (document.hidden) pauseForInterruption(); });
window.addEventListener("echosteps:app-state", event => { if (!event.detail.isActive) pauseForInterruption(); });
window.addEventListener("echosteps:back", ()=>{
  if (!el.shop.classList.contains("hidden")) { closeShop(); return; }
  if (!el.pause.classList.contains("hidden") || mode===STATE.OVER) { showStart(); return; }
  if (mode===STATE.PLAYING) { pauseForInterruption(); return; }
  if (window.EchoStepsNative) window.EchoStepsNative.exitApp();
});
"use strict";
