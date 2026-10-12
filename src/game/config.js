"use strict";

/* =========================================================================
 * Echo Steps: Garbage Collector
 * Fixed gameplay settings and selectable content. Live run state belongs in state.js.
 * ========================================================================= */

const CFG = {
  WALL_MARGIN:16, HUD_CLEARANCE:46, PLAYER_R:12,
  SPEED_FRAC:0.031,          // ~20% faster than 0.026; still eases toward the pointer
  GHOST_R:9, PRIZE_R:11, EXIT_W:150, EXIT_H:44,
  GC_MOVES:10, GC_REMOVE_START:4, GC_REMOVE_MIN:1, SWEEP_TIME:0.7, GRACE_TICKS:36,
  RAMP_START:7, GHOST_RAMP:0.01, WALL_DRIFT:0.9,
  OBSTACLES_START:2, OBSTACLES_ADD_EVERY:5, OBSTACLES_MAX:6,
  SIZE_EVERY:5, SIZE_GROW:0.10, SIZE_MAX:2.0, EXIT_MOVE_EVERY:5,
  // Big moments are staggered so no round stacks them: obstacles arrive on
  // rounds 5,10,15…, the exit moves on 3,8,13…, obstacles grow on 7,12,17…
  EXIT_MOVE_OFFSET:3, SIZE_OFFSET:2,
  EXIT_HANDOFF_TICKS:120, EXIT_SAFE_PAD:32,
  RETRY_COST:50,             // first revive in a run; each later revive doubles
  RETRY_COST_MAX:400,
  SIMULATION_STEP:1/60,
  TOUCH_OFFSET_PX:52,
  BONUS_LIFETIME:4.5,
  BONUS_FIRST_DELAY:6,
  BONUS_FIRST_JITTER:4,
  BONUS_REPEAT_DELAY:9,
  BONUS_REPEAT_JITTER:7,
  BONUS_DOUBLE_CHANCE:0.3,
  BONUS_SLOW_TIME:4,
  BONUS_CACHE_COINS:3,
  RUN_BONUS_EVERY:5,         // +1 coin at game over for every 5 rounds completed this run
};

// Game Center leaderboard (best rounds reached) and App Store coin packs.
// IDs must match App Store Connect exactly.
const LEADERBOARD_ID = "echosteps.rounds.alltime";
const COIN_PRODUCTS = Object.freeze([
  { id:"com.mukulkatari.echosteps.coins200",  coins:200,  label:"200 COINS" },
  { id:"com.mukulkatari.echosteps.coins1200", coins:1200, label:"1,200 COINS", tag:"POPULAR" },
  { id:"com.mukulkatari.echosteps.coins3000", coins:3000, label:"3,000 COINS", tag:"BEST VALUE" },
]);

const BONUS_TYPES = Object.freeze({
  shield:{ label:"1-HIT", color:"#8dff6a", shape:"hex" },
  slow:{ label:"SLOW", color:"#c66bff", shape:"triangle" },
  cache:{ label:"+3", color:"#eaf2ff", shape:"square" },
});

const BACKGROUNDS = Object.freeze([
  { id:"classic", label:"CLASSIC GRID", cost:0 },
  { id:"circuit", label:"CIRCUIT FOUNDRY", cost:400 },
  { id:"abyss", label:"ABYSSAL NETWORK", cost:900 },
  { id:"orbit", label:"ORBITAL STATION", cost:1500 },
]);

const OBSTACLE_SHAPES = ["rect","rounded","circle","diamond","triangle","hex"];
const CONFETTI_COLORS = ["#ffd23f","#ff5ca8","#3d7bff","#39ff9e","#b06bff","#ff8a2b"];

// HUD coin label while playing: 999, 4.8K, 12.3K, 1.2M, 3.4B… (rounded down,
// so the HUD never shows more coins than the bank holds). Menus show the full number.
function formatCoinsCompact(n) {
  n = Math.max(0, Math.floor(Number(n) || 0));
  const units = [[1e12, "T"], [1e9, "B"], [1e6, "M"], [1e3, "K"]];
  for (const [size, suffix] of units) {
    if (n >= size) {
      const value = Math.floor(n / size * 10) / 10;
      return (value >= 100 ? Math.floor(value) : value).toString() + suffix;
    }
  }
  return String(n);
}
// Coins for collecting a round's coin: deeper rounds pay more.
function coinsForRound(r) { return r >= 20 ? 3 : r >= 10 ? 2 : 1; }
function exitMovesOnRound(r) {
  return r >= CFG.EXIT_MOVE_OFFSET && (r - CFG.EXIT_MOVE_OFFSET) % CFG.EXIT_MOVE_EVERY === 0;
}
// 50, 100, 200, then 400 for every further revive in the same run.
function reviveCost(revivesUsed) {
  return Math.min(CFG.RETRY_COST_MAX, CFG.RETRY_COST * Math.pow(2, revivesUsed));
}
function gcRemoveForCompletedRounds(completed) {
  const sweepNumber = Math.max(1, Math.floor(completed / CFG.GC_MOVES));
  return Math.max(CFG.GC_REMOVE_MIN, CFG.GC_REMOVE_START - (sweepNumber - 1));
}
function gcPolicyForCompletedRounds(completed) {
  return {
    shouldSweep: completed > 0 && completed % CFG.GC_MOVES === 0,
    remove: gcRemoveForCompletedRounds(completed),
  };
}

/* Player skins — each is a color PLUS a distinct render style (see drawSkin()),
   not just a recolor. `id` stays the hex color so older saves keep matching. */
const SKINS = [
  { id:"#29e0ff", label:"Node",  style:"solid",  cost:0  },   // plain glowing dot
  { id:"#eaf2ff", label:"Ghost", style:"ring",   cost:0  },   // hollow outlined ring
  { id:"#3d7bff", label:"Pulse", style:"pulse",  cost:100 },   // core + breathing ring
  { id:"#ff5ca8", label:"Comet", style:"comet",  cost:250 },   // spinning star spikes
  { id:"#ff8a2b", label:"Blaze", style:"square", cost:400 },   // rotated glowing square
  { id:"#b06bff", label:"Void",  style:"void",   cost:1000 },   // bright ring, hollow core
];
function getSkinStyle(colorId){
  const s = SKINS.find(k=>k.id===colorId);
  return s ? s.style : "solid";
}

const TRAILS = [
  { id:"classic", label:"Classic", cost:0 },
  { id:"sparkle", label:"Sparkle", cost:150 },
  { id:"long", label:"Long Trail", cost:300 },
  { id:"rainbow", label:"Rainbow", cost:1250 },
];
const GHOST_SKINS = [
  { id:"#ff3554", label:"Crimson", cost:0 },
  { id:"#ff2bd6", label:"Violet", cost:150 },   // magenta
  { id:"#ff7a1a", label:"Toxic", cost:300 },    // acid orange
  { id:"#b3002d", label:"Phantom", cost:800 },  // blood red
];
/* Ghost skins stay in a danger family (reds, magentas, oranges). The old colours
   matched the sweep purple, the exit green and the +3 bonus white, so saves that
   own or wear them move to the same-named skin's new colour. */
const GHOST_SKIN_RENAMES = Object.freeze({ "#c66bff":"#ff2bd6", "#39ff9e":"#ff7a1a", "#eaf2ff":"#b3002d" });
function migrateGhostSkinId(id){ return GHOST_SKIN_RENAMES[id] || id; }
const DEATH_FX = [
  { id:"classic", label:"Classic", cost:0 },
  { id:"shockwave", label:"Shockwave", cost:250 },
  { id:"confetti", label:"Confetti", cost:500 },
  { id:"implode", label:"Implode", cost:1000 },
];

/* Game-over flavor — punchy titles + funny sublines, all about your own ghosts. */
const DEATH_TITLES = [
  "GHOSTED. LITERALLY.",
  "NODE TERMINATED",
  "HAUNTED BY YOURSELF",
  "ECHO OVERLOAD",
  "REST IN PIXELS",
  "PATH: FATAL",
  "SELF-SABOTAGE: 100%",
];
const DEATH_LINES = [
  "you got beaten by a recording of yourself.",
  "the call was coming from inside the grid.",
  "you played yourself \u2014 we all watched.",
  "past-you is still undefeated against present-you.",
  "somewhere, a ghost is doing a victory lap.",
  "that ghost had your exact moves. because it WAS your moves.",
  "your echoes send their regards.",
  "skill issue? no. YOU issue.",
];

/* One effects style: synthwave voices generated in src/game/audio.js.
   Kept as a list so saved preferences and cloud saves stay compatible. */
const SOUND_PACKS = [{ id:"neon", label:"Neon", cost:0 }];

// Gameplay music. CC0 from OpenGameArt (see assets/music/LICENSES.md).
const MUSIC_TRACKS = Object.freeze([
  {id:"synthwave-house",label:"Neon House",genre:"Synthwave house",src:"assets/music/synthwave-house.mp3"},
]);
// Main-menu music.
const MENU_TRACK = Object.freeze({id:"menu-synth-wave",label:"Synth Wave",genre:"Calm synthwave",src:"assets/music/menu-synth-wave.mp3"});
