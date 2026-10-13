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
function applyColorUI(){ if (el.hintDot) el.hintDot.style.color = playerColor; }
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
    if (swatch) b.append(skinThumb(item.id, previewCat)); else b.textContent = item.label;
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
/* Store thumbnails draw the real thing (the skin's shape, or a ghost with its
   eyes and rim) instead of a plain colour circle. */
function skinThumb(id, cat){
  const size = 44, dpr = Math.min(3, window.devicePixelRatio || 1);
  const c = document.createElement("canvas");
  c.width = size*dpr; c.height = size*dpr; c.className = "swatch-art"; c.setAttribute("aria-hidden", "true");
  const t = c.getContext("2d"); t.setTransform(dpr,0,0,dpr,0,0);
  if (cat === "ghost") drawGhostBody(t, size/2, size/2, 10, id, 1);
  else drawSkin(t, size/2, size/2, 10, id, getSkinStyle(id), 1, 0.4);
  return c;
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
  const map = { colors:el.shopColors, trail:el.shopTrail, ghost:el.shopGhost, death:el.shopDeath,
    coins:document.getElementById("shopCoins") };
  Object.keys(map).forEach(k => map[k].classList.toggle("hidden", k!==cat));
  el.shopTabs.querySelectorAll(".tab").forEach(t => t.classList.toggle("active", t.dataset.cat===cat));
  const coinTab = cat==="coins";
  el.shopPreview.classList.toggle("hidden", coinTab);
  document.getElementById("shopPreviewLabel").classList.toggle("hidden", coinTab);
  if (coinTab){ renderCoinPacks(); el.shopHint.textContent = "Coins unlock cosmetics and revives. Purchases are charged to your Apple Account."; return; }
  previewTab = cat;
  if (cat==="colors") previewColor = playerColor;
  else if (cat==="trail") previewTrail = selectedTrail;
  else if (cat==="ghost") previewGhostColor = selectedGhostSkin;
  else if (cat==="death") setPreviewItem("death", selectedDeathFX);
  const hints = {
    colors:"Tap a skin to preview it. Buy with coins to equip it.",
    trail:"Preview the trail that follows your movement.",
    ghost:"Change how your ghosts appear.",
    death:"Preview the effect shown when an echo catches you.",
  };
  el.shopHint.textContent = hints[cat] || "Tap an item to preview it.";
}
/* ---------- Coin packs (App Store, iOS only) ----------
   Coins are added only for transactions StoreKit has verified. The native side
   keeps each transaction unfinished until it is credited here, and credited IDs
   are remembered so a transaction replayed after a crash is never paid twice. */
const coinStore = { products: [], busy: false };
const CREDITED_KEY = "echoSteps.creditedTransactions";
function creditedTransactions(){ try { return JSON.parse(ls(CREDITED_KEY) || "[]"); } catch(e){ return []; } }
async function creditTransaction(t){
  if (!t || !t.transactionId) return;
  const pack = COIN_PRODUCTS.find(p => p.id === t.productId);
  const done = creditedTransactions();
  if (pack && !t.revoked && !done.includes(t.transactionId)){
    const added = pack.coins * Math.max(1, t.quantity || 1);
    coins += added; saveCoins();
    done.push(t.transactionId); ss(CREDITED_KEY, JSON.stringify(done.slice(-500)));
    refreshShopCoinLine(); refreshCoinLine(); refreshRetryBtn(); refreshSavingFor(); refreshShopBuy();
    el.totalCoinsOver.textContent = coins;
    coinStatus("+" + added.toLocaleString() + " coins added. Thank you!");
    reviveOfferAfterCredit();
    haptic("medium"); Sound.bonus();
  }
  try { await EchoStepsNative.store.finish(t.transactionId); } catch(e) { console.warn("finish failed", e); }
}
function renderCoinPacks(){
  for (const id of ["shopCoins", "reviveOfferPacks"]) renderCoinPacksInto(document.getElementById(id));
}
// Purchase feedback goes to the Store hint and, when it's open, the revive offer.
function coinStatus(text){
  el.shopHint.textContent = text;
  const offer = document.getElementById("reviveOfferStatus"); if (offer) offer.textContent = text;
}
function renderCoinPacksInto(box){
  if (!box) return;
  box.replaceChildren();
  for (const pack of COIN_PRODUCTS){
    const product = coinStore.products.find(p => p.id === pack.id);
    if (!product) continue;
    const b = document.createElement("button"); b.type = "button"; b.className = "coin-pack";
    b.disabled = coinStore.busy;
    b.innerHTML = '<span class="coin-amount"></span><span class="coin-price"></span>';
    b.querySelector(".coin-amount").textContent = "\u25C6 " + pack.label;
    b.querySelector(".coin-price").textContent = product.displayPrice;
    if (pack.tag){ const tag=document.createElement("span"); tag.className="coin-tag"; tag.textContent=pack.tag; b.prepend(tag); }
    b.addEventListener("click", () => buyCoinPack(pack));
    box.append(b);
  }
}
async function buyCoinPack(pack){
  if (coinStore.busy) return;
  coinStore.busy = true; renderCoinPacks();
  coinStatus("Opening the App Store…");
  try {
    const result = await EchoStepsNative.store.purchase(pack.id);
    if (result.status === "purchased") await creditTransaction(result.transaction);
    else if (result.status === "pending") coinStatus("Purchase is waiting for approval. Coins arrive once it's approved.");
    else if (result.status === "cancelled") coinStatus("Purchase cancelled.");
    else coinStatus("Purchase didn't go through. You weren't charged.");
  } catch(e){
    coinStatus("The App Store isn't available right now. Try again later.");
  } finally { coinStore.busy = false; renderCoinPacks(); }
}
async function initCoinStore(){
  const store = window.EchoStepsNative && EchoStepsNative.store;
  if (!store || !store.available) return;
  store.onTransaction(t => creditTransaction(t));
  try {
    const { products, canPay } = await store.products(COIN_PRODUCTS.map(p => p.id));
    coinStore.products = products || [];
    const missing = COIN_PRODUCTS.filter(p => !coinStore.products.some(x => x.id === p.id)).map(p => p.id);
    if (missing.length) console.warn("Coin packs not returned by the App Store:", missing.join(", "));
    document.getElementById("shopCoinsTab").classList.toggle("hidden", !canPay || !coinStore.products.length);
    const { transactions } = await store.pending();
    for (const t of transactions || []) await creditTransaction(t);
  } catch(e){ console.warn("Coin store unavailable", e); }
}

/* ---------- Game Center leaderboard (iOS only) ---------- */
const gameCenterState = { signedIn: false };
function showLeaderboardButtons(){
  const available = Boolean(window.EchoStepsNative && EchoStepsNative.gameCenter && EchoStepsNative.gameCenter.available);
  for (const id of ["gameCenterBtn", "overLeaderboardBtn"])
    document.getElementById(id).classList.toggle("hidden", !available);
}
function menuNotice(text){
  const box = document.getElementById("menuNotice"); if (!box) return;
  box.textContent = text; box.classList.remove("hidden");
  clearTimeout(menuNotice.timer); menuNotice.timer = setTimeout(() => box.classList.add("hidden"), 4000);
}
async function initGameCenter(){
  const gc = window.EchoStepsNative && EchoStepsNative.gameCenter;
  if (!gc || !gc.available) return;
  showLeaderboardButtons();
  try {
    const result = await gc.signIn();
    gameCenterState.signedIn = Boolean(result && result.authenticated);
    if (gameCenterState.signedIn && bestRounds > 0) await gc.submitScore(LEADERBOARD_ID, bestRounds);
  } catch(e){ console.warn("Game Center unavailable", e); }
}
function submitLeaderboardScore(reached){
  if (!gameCenterState.signedIn || reached <= 0) return;
  EchoStepsNative.gameCenter.submitScore(LEADERBOARD_ID, reached).catch(e => console.warn("Score not submitted", e));
}
async function openLeaderboard(){
  const gc = window.EchoStepsNative && EchoStepsNative.gameCenter;
  if (!gc || !gc.available) return;
  if (!gameCenterState.signedIn){
    try {
      const result = await gc.signIn();
      gameCenterState.signedIn = Boolean(result && result.authenticated);
      if (gameCenterState.signedIn && bestRounds > 0) await gc.submitScore(LEADERBOARD_ID, bestRounds);
    } catch(e){ gameCenterState.signedIn = false; }
  }
  if (gameCenterState.signedIn) gc.show(LEADERBOARD_ID).catch(()=>{});
  else menuNotice("Sign in to Game Center in your iPhone Settings to join the leaderboard.");
}
document.getElementById("gameCenterBtn").addEventListener("click", openLeaderboard);
document.getElementById("overLeaderboardBtn").addEventListener("click", openLeaderboard);
// bootstrap.js loads the saved coin bank and best score after this file runs,
// so native services start only once every script has executed.
function initNativeServices(){ initGameCenter(); initCoinStore(); }
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initNativeServices, { once:true });
else setTimeout(initNativeServices, 0);

/* ---------- Revive without enough coins ----------
   Tell the player what they're missing and, on iOS, offer the coin packs right
   there. After a purchase covers the cost, the dialog closes and REVIVE is ready. */
const reviveOffer = document.getElementById("reviveOffer");
function openReviveOffer(cost){
  const short = cost - coins;
  const canBuy = coinStore.products.length > 0;
  document.getElementById("reviveOfferText").textContent =
    "A revive costs \u25C6" + cost + ". You have \u25C6" + coins + " \u2014 you need " + short + " more." +
    (canBuy ? " Get coins to jump back in:" : " Earn more coins by playing, then try again.");
  document.getElementById("reviveOfferStatus").textContent = "";
  renderCoinPacks();
  el.overSub.textContent = "Not enough coins for a revive (\u25C6" + cost + ").";
  if (!reviveOffer.open) reviveOffer.showModal();
}
function reviveOfferAfterCredit(){
  if (!reviveOffer.open) return;
  const cost = reviveCost(revivesThisRun);
  if (coins >= cost){
    reviveOffer.close();
    el.overSub.textContent = "Coins added! Tap REVIVE to jump back in.";
  } else {
    document.getElementById("reviveOfferText").textContent =
      "Coins added. A revive costs \u25C6" + cost + "; you need " + (cost - coins) + " more.";
  }
}
document.getElementById("reviveOfferClose").addEventListener("click", () => reviveOffer.close());

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
  const settingsMute=document.getElementById("settingsMuteBtn");
  settingsMute.textContent=m?"SOUND OFF":"SOUND ON";settingsMute.setAttribute("aria-pressed",String(m));
}
/* ---------- Retry (revive at same round for coins) ---------- */
function refreshRetryBtn(){
  const btn = document.getElementById("retryBtn");
  if (!btn) return;
  const cost = reviveCost(revivesThisRun);
  // Say what the coins buy before they're spent: same round, but the ranked
  // score was fixed at the first death, so revived rounds never rank.
  btn.replaceChildren();
  const main = document.createElement("span"); main.textContent = "REVIVE \u00B7 \u25C6" + cost;
  const note = document.createElement("span"); note.className = "over-revive-note";
  note.textContent = "Continue round " + round + " \u00B7 extra rounds don't rank";
  btn.append(main, note);
  btn.setAttribute("aria-label", "Revive for " + cost + " coins. Continue round " + round + "; extra rounds don't count for rank.");
  btn.classList.toggle("short", coins < cost);
}
/* Game over: show progress toward the cheapest cosmetic not owned yet, so a
   short run still feels like it moved the player somewhere. */
function refreshSavingFor(){
  const box = document.getElementById("savingFor"); if (!box) return;
  const pools = [[SKINS, unlocked], [GHOST_SKINS, unlockedGhostSkin], [TRAILS, unlockedTrail], [DEATH_FX, unlockedDeathFX]];
  let goal = null;
  for (const [items, owned] of pools)
    for (const item of items)
      if (item.cost > 0 && !owned.includes(item.id) && (!goal || item.cost < goal.cost)) goal = item;
  box.classList.toggle("hidden", !goal);
  if (!goal) return;
  document.getElementById("savingForName").textContent = goal.label;
  document.getElementById("savingForCount").textContent = coins >= goal.cost ? " \u00B7 ready to buy!" : " \u00B7 " + coins + " / " + goal.cost;
  document.getElementById("savingForFill").style.width = Math.min(100, Math.round(coins/goal.cost*100)) + "%";
}
function retryRun(){
  const cost = reviveCost(revivesThisRun);
  if (coins < cost){ haptic("medium"); openReviveOffer(cost); return; }
  coins -= cost; saveCoins(); revivesThisRun++;
  // Revive inside the exit: it's the safe zone, while the arena centre is where
  // the first echo starts. The exit can't finish the round without the coin.
  player.x = exit.x+exit.w/2; player.y = exit.y+exit.h/2;
  pointer.x = player.x; pointer.y = player.y; pointer.active = false;
  currentPath = []; frame = 0; ghostPhase = 0;
  grace = CFG.GRACE_TICKS*2;                                  // extra grace on revive
  hasPrize = false; paused = false;
  particles = []; pops = []; shockwaves = []; sweep = null;
  departureZone = {...exit, ticks:CFG.EXIT_HANDOFF_TICKS};
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
// Sound on/off lives in Settings (main menu and pause), not on the in-game HUD.
document.getElementById("shareBtn").addEventListener("click", async ()=>{
  // In the iOS app location.href is capacitor://localhost, so share the App Store page.
  const url=(window.EchoStepsNative && EchoStepsNative.isNative)
    ? "https://apps.apple.com/app/id6820829497"
    : location.origin+location.pathname;
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
