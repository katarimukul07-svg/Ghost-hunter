/* ---------- Loop ---------- */
let last = performance.now(), acc = 0;
// State before the latest fixed step, so frames that land between steps can be
// drawn part-way instead of jumping 0, 1 or 2 whole steps (visible judder).
const renderPrev = { x:0, y:0, phase:0, valid:false };
function renderInterpolated(){
  const alpha = acc / CFG.SIMULATION_STEP;
  const dx = player.x - renderPrev.x, dy = player.y - renderPrev.y;
  const dPhase = ghostPhase - renderPrev.phase;
  const smooth = renderPrev.valid && !paused && mode===STATE.PLAYING && alpha > 0 && alpha < 1 &&
    Math.hypot(dx,dy) <= playerSpeed*1.5 && dPhase >= 0 && dPhase <= 8;   // skip teleports/resets
  if (!smooth){ render(); return; }
  const sx = player.x, sy = player.y, sPhase = ghostPhase;
  player.x = renderPrev.x + dx*alpha; player.y = renderPrev.y + dy*alpha;
  ghostPhase = renderPrev.phase + dPhase*alpha;
  try { render(); } finally { player.x = sx; player.y = sy; ghostPhase = sPhase; }
}
function loop(now){
  let dt=(now-last)/1000; last=now; if (dt>0.1) dt=0.1; acc+=dt;
  while (acc>=CFG.SIMULATION_STEP){
    if (!paused){
      renderPrev.x = player.x; renderPrev.y = player.y; renderPrev.phase = ghostPhase; renderPrev.valid = true;
      update(CFG.SIMULATION_STEP);
    }
    updateEffects(CFG.SIMULATION_STEP);
    acc-=CFG.SIMULATION_STEP;
  }
  renderInterpolated();
  if (mode===STATE.PLAYING && !paused) updateHUD();
  if (!el.shop.classList.contains("hidden")) drawShopPreview();
  requestAnimationFrame(loop);
}

/* ---------- Input ---------- */
function toLocal(e){ const r=canvas.getBoundingClientRect(); return {x:e.clientX-r.left, y:e.clientY-r.top}; }
function onMove(e){ const p=toLocal(e); pointer.x=p.x; pointer.y=p.y; }
let steeringPointerId = null;
function clearSteering(){
  const id = steeringPointerId;
  steeringPointerId = null;
  pointer.active = false;
  if (id !== null && canvas.hasPointerCapture(id)) canvas.releasePointerCapture(id);
}
canvas.addEventListener("pointerdown", e => {
  if (mode !== STATE.PLAYING || paused || steeringPointerId !== null || e.button !== 0) return;
  steeringPointerId = e.pointerId;
  pointer.active = true;
  onMove(e);
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener("pointermove", e => {
  if (pointer.active && e.pointerId === steeringPointerId) onMove(e);
});
for (const event of ["pointerup", "pointercancel", "lostpointercapture"])
  canvas.addEventListener(event, e => { if (e.pointerId === steeringPointerId) clearSteering(); });

/* ---------- Menu / buttons ---------- */
function refreshCoinLine(){
  el.coinLine.textContent = "\u25C6 " + coins + " coins \u00B7 best " + bestRounds + " rounds";
}
function applyColorUI(){ el.hintDot.style.color = playerColor; }
function applyGhostUI(){ if (el.hintGhost) el.hintGhost.style.color = selectedGhostSkin; }
let shopPurchase = null;
function refreshShopBuy(){
  const choice = shopPurchase;
  const owned = !choice || choice.ownedArr.includes(choice.item.id);
  el.shopBuy.classList.toggle("hidden", owned);
  el.shopBuy.disabled = owned || coins < choice.item.cost;
  if (!owned) el.shopBuy.textContent = coins >= choice.item.cost
    ? "BUY " + choice.item.label + " · " + choice.item.cost + " COINS"
    : "NEED " + (choice.item.cost - coins) + " MORE COINS";
}
const shopConfirm = document.getElementById("shopConfirm");
let pendingShopPurchase = null;
shopConfirm.addEventListener("cancel", () => { pendingShopPurchase = null; });
document.getElementById("shopConfirmCancel").addEventListener("click", () => { pendingShopPurchase = null; shopConfirm.close(); });
el.shopBuy.addEventListener("click", () => {
  const choice = shopPurchase;
  if (!choice || choice.ownedArr.includes(choice.item.id) || coins < choice.item.cost) return;
  pendingShopPurchase = choice;
  document.getElementById("shopConfirmItem").textContent = "Buy " + choice.item.label + "?";
  document.getElementById("shopConfirmCost").textContent = choice.item.cost + " coins";
  shopConfirm.showModal();
});
document.getElementById("shopConfirmBuy").addEventListener("click", () => {
  const choice = pendingShopPurchase;
  pendingShopPurchase = null;
  shopConfirm.close();
  if (!choice || choice !== shopPurchase || choice.ownedArr.includes(choice.item.id) || coins < choice.item.cost) return;
  coins -= choice.item.cost; saveCoins();
  choice.ownedArr.push(choice.item.id); saveOwnedList(choice.ownedKey, choice.ownedArr);
  choice.setSel(choice.item.id);
  haptic("medium"); refreshShopCoinLine(); buildShopAll(); refreshShopBuy();
  el.shopHint.textContent = choice.item.label + " purchased and equipped.";
});
function renderShopCategory(container, items, ownedArr, ownedKey, getSel, setSel, swatch, previewCat){
  container.innerHTML = "";
  items.forEach(item => {
    const owned = ownedArr.includes(item.id);
    const wrap = document.createElement("div"); wrap.className = "skin";
    const b = document.createElement("button");
    b.className = (swatch?"swatch":"chip") + (item.id===getSel()?" sel":"") + (owned?"":" locked");
    b.setAttribute("aria-label", item.label);
    b.setAttribute("aria-pressed", String(item.id===getSel()));
    if (swatch) b.style.background = item.id; else b.textContent = item.label;
    const price = document.createElement("div"); price.className = "price";
    price.textContent = owned ? (item.id===getSel() ? "EQUIPPED" : "OWNED") : ("\u25C6" + item.cost);
    b.addEventListener("click", () => {
      setPreviewItem(previewCat, item.id);                       // always preview what's tapped
      if (ownedArr.includes(item.id)) {                          // already owned -> select
        setSel(item.id);
        renderShopCategory(container, items, ownedArr, ownedKey, getSel, setSel, swatch, previewCat);
      }
      shopPurchase = { item, ownedArr, ownedKey, setSel };
      refreshShopBuy();
      el.shopHint.textContent = ownedArr.includes(item.id)
        ? item.label + " equipped."
        : "Previewing " + item.label + ". Buy it for " + item.cost + " coins to equip it.";
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
  shopConfirm.close(); pendingShopPurchase = null;
  shopPurchase = null; refreshShopBuy();
  const map = { colors:el.shopColors, trail:el.shopTrail, ghost:el.shopGhost, death:el.shopDeath };
  Object.keys(map).forEach(k => map[k].classList.toggle("hidden", k!==cat));
  el.shopTabs.querySelectorAll(".tab").forEach(t => t.classList.toggle("active", t.dataset.cat===cat));
  previewTab = cat;
  if (cat==="colors") previewColor = playerColor;
  else if (cat==="trail") previewTrail = selectedTrail;
  else if (cat==="ghost") previewGhostColor = selectedGhostSkin;
  else if (cat==="death") setPreviewItem("death", selectedDeathFX);
  const hints = {
    colors:"Tap a color to preview it. Buy with coins to equip it.",
    trail:"Preview the trail that follows your movement.",
    ghost:"Change how your ghosts appear.",
    death:"Preview the effect shown when an echo catches you.",
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
  shopConfirm.close(); pendingShopPurchase = null;
  shopPurchase = null; refreshShopBuy();
  el.shop.classList.add("hidden");
  if (shopReturnTo === "pause") el.pause.classList.remove("hidden");
  else { el.start.classList.remove("hidden"); refreshCoinLine(); }
}
function showStart(){
  clearSteering();
  mode = STATE.START;
  el.over.classList.add("hidden"); el.pause.classList.add("hidden"); el.hud.classList.add("hidden");
  el.shop.classList.add("hidden");
  document.getElementById("settingsScreen").classList.add("hidden");
  Sound.startMenuMusic();
  refreshCoinLine(); applyColorUI(); applyGhostUI();
  el.start.classList.remove("hidden");
}
function updateMuteBtn(){
  const m=Sound.isMuted();
  el.mute.innerHTML = m ? "&#9834; OFF" : "&#9834; ON";
  el.mute.style.color = m ? C.dim : C.ink;
  el.mute.setAttribute("aria-pressed", m ? "true" : "false");
  const settingsMute=document.getElementById("settingsMuteBtn");
  settingsMute.textContent=m?"SOUND OFF":"SOUND ON";settingsMute.setAttribute("aria-pressed",String(m));
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
  Sound.setRound(round); Sound.unlock(); Sound.startAmbient();
}

for (const id of ["startBtn", "restartBtn", "retryBtn", "pauseRestartBtn"])
  document.getElementById(id).addEventListener("click", clearSteering, true);
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
  clearSteering(); paused=false; grace=CFG.GRACE_TICKS; el.pause.classList.add("hidden"); Sound.startAmbient();
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
document.getElementById("pauseSettingsBtn").addEventListener("click", ()=>openSettings("pause"));
document.getElementById("pauseBtn").addEventListener("click", ()=>{
  if (mode!==STATE.PLAYING || paused) return;
  clearSteering(); paused = true; Sound.stopAmbient(); el.pause.classList.remove("hidden");
});
el.mute.addEventListener("click", ()=>{
  Sound.setMuted(!Sound.isMuted()); ss("echoSteps.mute", Sound.isMuted()?"1":"0"); updateMuteBtn();
});
document.getElementById("shareBtn").addEventListener("click", async ()=>{
  const url=location.href;
  // The active HUD round is not completed yet; share the same score as results.
  const completedRounds=round-1;
  const text=playerName+" completed "+completedRounds+" "+(completedRounds===1?"round":"rounds")+" in Echo Steps! Can you beat it?";
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
    clearSteering(); paused=true; Sound.stopAmbient(); el.pause.classList.remove("hidden");
  }
}
window.addEventListener("blur", pauseForInterruption);
document.addEventListener("visibilitychange", ()=>{ if (document.hidden) pauseForInterruption(); });
window.addEventListener("echosteps:app-state", event => { if (!event.detail.isActive) pauseForInterruption(); });
window.addEventListener("echosteps:back", ()=>{
  if (window.EchoStepsCloud && window.EchoStepsCloud.close()) return;
  if (shopConfirm.open) { pendingShopPurchase = null; shopConfirm.close(); return; }
  if (!document.getElementById("settingsScreen").classList.contains("hidden")) { closeSettings(); return; }
  if (!el.shop.classList.contains("hidden")) { closeShop(); return; }
  if (!el.pause.classList.contains("hidden") || mode===STATE.OVER) { showStart(); return; }
  if (mode===STATE.PLAYING) { pauseForInterruption(); return; }
  if (window.EchoStepsNative) window.EchoStepsNative.exitApp();
});
"use strict";

/* Audio preferences are free settings, independent of cosmetic purchases. */
const audioLevels=document.getElementById("audioLevels");
const musicSlider=document.getElementById("musicLevel");
const effectsSlider=document.getElementById("effectsLevel");
musicSlider.value=Math.round(Sound.levels().music*100);
effectsSlider.value=Math.round(Sound.levels().effects*100);
for(const slider of [musicSlider,effectsSlider]) slider.addEventListener("input",()=>{
  Sound.setLevels(Number(musicSlider.value)/100,Number(effectsSlider.value)/100);
});

window.addEventListener("blur",()=>Sound.stopAmbient());
document.addEventListener("visibilitychange",()=>{if(document.hidden) Sound.stopAmbient();});
window.addEventListener("echosteps:app-state",e=>{if(!e.detail.isActive) Sound.stopAmbient();});

let settingsReturnTo="start";
const settingsScreen=document.getElementById("settingsScreen");
function refreshSettings(){
  const choices=document.getElementById("musicChoices"); choices.replaceChildren();
  for(const track of MUSIC_TRACKS){
    const button=document.createElement("button");button.className="chip music-choice";
    button.textContent=track.label;button.setAttribute("aria-pressed",String(Sound.musicTrack()===track.id));
    button.addEventListener("click",()=>{Sound.setMusic(track.id);Sound.startAmbient();refreshSettings();});choices.append(button);
  }
  const packs=document.getElementById("effectsPack");packs.replaceChildren();
  for(const pack of SOUND_PACKS){const option=document.createElement("option");option.value=pack.id;option.textContent=pack.label;packs.append(option);}
  packs.value=selectedSound;
  // With a single effects style there is nothing to choose; keep only PREVIEW SOUNDS.
  const single=SOUND_PACKS.length<2;
  packs.hidden=single; document.querySelector('label[for="effectsPack"]').hidden=single;
  musicSlider.value=Math.round(Sound.levels().music*100);effectsSlider.value=Math.round(Sound.levels().effects*100);
}
function openSettings(from="start"){
  settingsReturnTo=from;Sound.stopAmbient();clearSteering();
  el.start.classList.add("hidden");el.pause.classList.add("hidden");settingsScreen.classList.remove("hidden");refreshSettings();
}
function closeSettings(){
  Sound.stopAmbient();settingsScreen.classList.add("hidden");
  if(settingsReturnTo==="pause")el.pause.classList.remove("hidden");
  else { el.start.classList.remove("hidden"); Sound.startMenuMusic(); }
}
document.getElementById("settingsBtn").addEventListener("click",()=>openSettings());
document.getElementById("settingsBackBtn").addEventListener("click",closeSettings);
document.getElementById("stopMusicPreview").addEventListener("click",()=>Sound.stopAmbient());
document.getElementById("effectsPack").addEventListener("change",e=>selectSoundPack(e.target.value));
document.getElementById("previewEffects").addEventListener("click",()=>{Sound.unlock();Sound.previewPack();});
// Browsers only start audio after a tap, so the menu track begins on the first
// touch of the start screen and again when the app returns to the foreground.
const onMenu=()=>mode===STATE.START && !el.start.classList.contains("hidden");
document.addEventListener("pointerdown",()=>{ Sound.unlock(); if(onMenu()) Sound.startMenuMusic(); },true);
document.addEventListener("visibilitychange",()=>{ if(!document.hidden && onMenu()) Sound.startMenuMusic(); });
window.addEventListener("ghost:music-status",e=>{document.getElementById("musicStatus").textContent=e.detail;});

document.getElementById("settingsMuteBtn").addEventListener("click",()=>{
  Sound.unlock();Sound.setMuted(!Sound.isMuted());ss("echoSteps.mute",Sound.isMuted()?"1":"0");updateMuteBtn();
});
