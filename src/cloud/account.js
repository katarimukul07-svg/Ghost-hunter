/* Optional cloud save. The production build leaves this disabled until account,
   privacy, deletion, and recovery services are configured and reviewed. */
(() => {
  "use strict";
  const ui = Object.fromEntries([
    "accountBtn", "accountScreen", "accountStatus", "accountEmailForm",
    "accountEmail", "accountCodeForm", "accountCode", "accountChoices",
    "accountUseDevice", "accountUseCloud", "accountSignedIn", "accountSync",
    "accountSignOut", "accountDelete", "accountBack",
  ].map(id => [id, document.getElementById(id)]));
  const keys = Object.freeze({
    name:"echoSteps.name", color:"echoSteps.color", trail:"echoSteps.trail",
    ghostSkin:"echoSteps.ghostSkin", deathfx:"echoSteps.deathfx",
    sound:"echoSteps.sound", mute:"echoSteps.mute",
    background:"echoSteps.background", hint:"echoSteps.hint",
  });
  const defaults = Object.freeze({
    name:"", color:SKINS[0].id, trail:TRAILS[0].id,
    ghostSkin:GHOST_SKINS[0].id, deathfx:DEATH_FX[0].id,
    sound:SOUND_PACKS[0].id, mute:"0", background:"classic", hint:"0",
  });
  let config = null;
  let session = null; // Access and refresh tokens deliberately remain in memory only.
  let remote = null;
  let ready = false;
  let busy = false;
  let applying = false;
  let timer = null;
  let refreshPromise = null;
  let changedDuringSync = false;
  let sessionEpoch = 0;
  let rankedRunId = null;

  const show = (element, visible) => element.classList.toggle("hidden", !visible);
  const status = message => { ui.accountStatus.textContent = message; };
  const isOpen = () => !ui.accountScreen.classList.contains("hidden");
  function close() {
    if (!isOpen()) return false;
    show(ui.accountScreen, false);
    show(el.start, true);
    return true;
  }
  async function startRankedRun() {
    if (!ready || !session || rankedRunId) return false;
    try {
      rankedRunId = await request("/rest/v1/rpc/start_ranked_run", {
        method:"POST", authorized:true, data:{ new_client_build:"echo-steps-1.0.0" },
      });
      return true;
    } catch (error) {
      rankedRunId = null;
      return false;
    }
  }
  async function checkpointRankedRound(completedRound) {
    if (!rankedRunId || !ready || !session) return false;
    try {
      await request("/rest/v1/rpc/checkpoint_ranked_round", {
        method:"POST", authorized:true, data:{ run_id:rankedRunId, completed_round:completedRound },
      });
      return true;
    } catch (error) {
      rankedRunId = null;
      return false;
    }
  }
  async function finishRankedRun() {
    if (!rankedRunId || !ready || !session) return null;
    const runId = rankedRunId;
    rankedRunId = null;
    try {
      return await request("/rest/v1/rpc/finish_ranked_run", {
        method:"POST", authorized:true, data:{ run_id:runId },
      });
    } catch (error) { return null; }
  }
  async function getLeaderboard(board="world", country=null, limit=20) {
    if (!ready || !session) return [];
    try {
      return await request("/rest/v1/rpc/get_leaderboard", {
        method:"POST", authorized:true,
        data:{ board, board_country:country, result_limit:Math.max(1,Math.min(100,limit)) },
      });
    } catch (error) { return []; }
  }
  window.EchoStepsCloud = Object.freeze({
    close, startRankedRun, checkpointRankedRound, finishRankedRun, getLeaderboard,
    isRanked:()=>Boolean(rankedRunId),
  });

  function localSave() {
    const settings = Object.fromEntries(Object.entries(keys).map(([name, key]) =>
      [name, ls(key) ?? defaults[name]]));
    return { new_settings:settings, new_best_rounds:Math.max(0, Math.min(1000000, loadBestRounds())) };
  }
  function redrawAfterRestore() {
    bestRounds = loadBestRounds();
    playerName = ls(keys.name) || "";
    el.nameInput.value = playerName;
    const color = ls(keys.color);
    playerColor = unlocked.includes(color) ? color : SKINS[0].id;
    playerStyle = getSkinStyle(playerColor);
    const trail = ls(keys.trail);
    selectedTrail = unlockedTrail.includes(trail) ? trail : TRAILS[0].id;
    const ghost = ls(keys.ghostSkin);
    selectedGhostSkin = unlockedGhostSkin.includes(ghost) ? ghost : GHOST_SKINS[0].id;
    const death = ls(keys.deathfx);
    selectedDeathFX = unlockedDeathFX.includes(death) ? death : DEATH_FX[0].id;
    const sound = ls(keys.sound);
    selectedSound = SOUND_PACKS.some(pack => pack.id === sound) ? sound : SOUND_PACKS[0].id;
    Sound.setPack(selectedSound);
    Sound.setMuted(ls(keys.mute) === "1");
    hintSeen = ls(keys.hint) === "1";
    refreshCoinLine(); applyColorUI(); applyGhostUI(); updateMuteBtn();
  }
  function restoreSave(save) {
    applying = true;
    try {
      for (const [name, key] of Object.entries(keys)) {
        const value = save.settings?.[name];
        ss(key, typeof value === "string" ? value : defaults[name]);
      }
      ss("echoSteps.bestRounds", String(save.best_rounds));
      redrawAfterRestore();
    } finally { applying = false; }
  }
  function showSignedIn(message) {
    ready = true;
    show(ui.accountEmailForm, false);
    show(ui.accountCodeForm, false);
    show(ui.accountChoices, false);
    show(ui.accountSignedIn, true);
    status(message);
  }
  function showChoices(message) {
    ready = false;
    show(ui.accountEmailForm, false);
    show(ui.accountCodeForm, false);
    show(ui.accountSignedIn, false);
    show(ui.accountChoices, true);
    status(message);
  }
  function clearSession() {
    sessionEpoch++;
    clearTimeout(timer); timer = null; refreshPromise = null;
    session = null; remote = null; ready = false; rankedRunId = null;
    show(ui.accountSignedIn, false);
    show(ui.accountChoices, false);
    show(ui.accountCodeForm, false);
    show(ui.accountEmailForm, true);
    ui.accountCode.value = "";
    status("Signed out. Local play and device progress are still available.");
  }
  async function request(path, { method="GET", data, authorized=false, retry=true }={}) {
    if (authorized) await refreshIfNeeded();
    const response = await fetch(config.url + path, {
      method,
      headers:{
        apikey:config.publishableKey,
        ...(authorized ? { Authorization:`Bearer ${session.access_token}` } : {}),
        ...(data === undefined ? {} : { "Content-Type":"application/json" }),
      },
      ...(data === undefined ? {} : { body:JSON.stringify(data) }),
    });
    if (response.status === 401 && authorized && retry && session?.refresh_token) {
      await refreshSession();
      return request(path, { method, data, authorized, retry:false });
    }
    const result = await response.json().catch(() => null);
    if (!response.ok) {
      const error = new Error(result?.message || result?.msg || result?.error_description || result?.error || "Cloud request failed");
      error.code = result?.code || result?.error_code || "";
      error.status = response.status;
      throw error;
    }
    return result;
  }
  async function refreshSession() {
    if (!session?.refresh_token) throw new Error("Sign in again to sync.");
    if (!refreshPromise) {
      refreshPromise = request("/auth/v1/token?grant_type=refresh_token", {
        method:"POST", data:{ refresh_token:session.refresh_token },
      }).then(result => {
        if (!result?.access_token || !result?.refresh_token) throw new Error("Sign in again to sync.");
        session = { ...result, expiresAt:Date.now() + (result.expires_in || 3600)*1000 };
      }).finally(() => { refreshPromise = null; });
    }
    return refreshPromise;
  }
  async function refreshIfNeeded() {
    if (!session) throw new Error("Sign in again to sync.");
    if (Date.now() >= session.expiresAt - 60000) await refreshSession();
  }
  async function readRemote() {
    const rows = await request("/rest/v1/player_saves?select=revision,settings,best_rounds&limit=1", { authorized:true });
    return Array.isArray(rows) ? rows[0] || null : null;
  }
  async function upload() {
    if (!session) return;
    if (busy) { changedDuringSync = true; return; }
    busy = true;
    const epoch = sessionEpoch;
    try {
      const save = localSave();
      const revision = await request("/rest/v1/rpc/put_player_save", {
        method:"POST", authorized:true,
        data:{ expected_revision:remote?.revision || 0, ...save },
      });
      if (epoch !== sessionEpoch) return;
      remote = { settings:save.new_settings, best_rounds:save.new_best_rounds, revision:Number(revision) };
      showSignedIn("Synced. Your personal best and settings are saved to your account.");
    } catch (error) {
      if (epoch !== sessionEpoch) return;
      if (error.code === "40001") {
        try {
          remote = await readRemote();
          if (epoch !== sessionEpoch) return;
          showChoices("Another device changed this save. Choose which copy to keep.");
        } catch (readError) {
          showSignedIn("Could not check the other device. Reconnect and tap SYNC NOW.");
        }
      } else {
        showSignedIn("Could not sync. Your device save is safe; reconnect and tap SYNC NOW.");
      }
    } finally {
      busy = false;
      if (changedDuringSync && ready) {
        changedDuringSync = false;
        scheduleSync();
      }
    }
  }
  function scheduleSync() {
    if (!ready || !session || applying) return;
    clearTimeout(timer);
    timer = setTimeout(() => { upload(); }, 1000);
  }
  window.addEventListener("echosteps:save-changed", event => {
    if (event.detail.key === "echoSteps.bestRounds" || Object.values(keys).includes(event.detail.key)) scheduleSync();
  });
  window.addEventListener("online", () => { if (ready) scheduleSync(); });
  ui.accountBtn.addEventListener("click", () => {
    if (mode !== STATE.START) return;
    show(el.start, false); show(ui.accountScreen, true);
    if (session && ready) status("Signed in. Your personal best and settings can sync.");
  });
  ui.accountBack.addEventListener("click", close);
  ui.accountEmailForm.addEventListener("submit", async event => {
    event.preventDefault();
    if (busy) return;
    busy = true;
    try {
      const email = ui.accountEmail.value.trim();
      await request("/auth/v1/otp", { method:"POST", data:{ email, create_user:true } });
      show(ui.accountEmailForm, false); show(ui.accountCodeForm, true);
      status("Check your email and enter the sign-in code.");
    } catch (error) { status("Could not send a code. Check the email and try again."); }
    finally { busy = false; }
  });
  ui.accountCodeForm.addEventListener("submit", async event => {
    event.preventDefault();
    if (busy) return;
    busy = true;
    try {
      const result = await request("/auth/v1/verify", {
        method:"POST", data:{ email:ui.accountEmail.value.trim(), token:ui.accountCode.value.trim(), type:"email" },
      });
      if (!result?.access_token || !result?.refresh_token || !result?.user?.id) {
        throw new Error("Invalid sign-in response");
      }
      session = { ...result, expiresAt:Date.now() + (result.expires_in || 3600)*1000 };
      sessionEpoch++;
      remote = await readRemote();
      if (remote) showChoices("Choose which personal best and settings to keep. This does not transfer coins or purchased cosmetics.");
      else {
        busy = false;
        await upload();
      }
    } catch (error) {
      clearSession();
      status("Could not sign in. Check the code and request a new one if needed.");
    } finally { busy = false; }
  });
  ui.accountUseDevice.addEventListener("click", () => { upload(); });
  ui.accountUseCloud.addEventListener("click", () => {
    if (!remote) return;
    restoreSave(remote);
    showSignedIn("Cloud save restored on this device. Coins and owned cosmetics remain local.");
  });
  ui.accountSync.addEventListener("click", () => { upload(); });
  ui.accountSignOut.addEventListener("click", async () => {
    const token = session?.access_token;
    clearSession();
    if (token) {
      try { await fetch(config.url + "/auth/v1/logout", {
        method:"POST", headers:{ apikey:config.publishableKey, Authorization:`Bearer ${token}` },
      }); } catch (error) { /* Local session is already cleared. */ }
    }
  });
  ui.accountDelete.addEventListener("click", async () => {
    if (!session || busy || !window.confirm("Permanently delete your cloud account and save? This cannot be undone.")) return;
    busy = true;
    try {
      await request("/functions/v1/delete-account", {
        method:"POST", authorized:true, data:{ confirm:"DELETE" },
      });
      clearSession();
      for (const key of Object.keys(localStorage)) {
        if (key.startsWith("echoSteps.")) localStorage.removeItem(key);
      }
      location.reload();
    } catch (error) {
      status("Could not delete your account. Your save remains; please retry or contact support.");
    } finally { busy = false; }
  });
  fetch("cloud-config.json", { cache:"no-store" }).then(response => response.json()).then(value => {
    if (value?.enabled && /^https:\/\/[^/?#]+\.supabase\.co$/.test(value.url)
      && typeof value.publishableKey === "string" && value.publishableKey.startsWith("sb_publishable_")) {
      config = value;
      show(ui.accountBtn, true);
    }
  }).catch(() => { /* Offline guest play needs no configuration request. */ });
})();
