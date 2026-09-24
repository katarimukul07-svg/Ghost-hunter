"use strict";

/* =========================================================================
 * Echo Steps: Garbage Collector
 * Vanilla HTML5 Canvas. No asset files. Player menu + Phase-1 juice.
 * ========================================================================= */

const CFG = {
  WALL_MARGIN:16, HUD_CLEARANCE:46, PLAYER_R:12,
  SPEED_FRAC:0.026,          // responsive without snapping instantly to the pointer
  GHOST_R:9, PRIZE_R:11, EXIT_W:150, EXIT_H:44,
  GC_MOVES:10, GC_REMOVE_START:4, GC_REMOVE_MIN:1, SWEEP_TIME:0.7, GRACE_TICKS:36,
  RAMP_START:7, GHOST_RAMP:0.01, WALL_DRIFT:0.9,
  OBSTACLES_START:2, OBSTACLES_ADD_EVERY:5, OBSTACLES_MAX:6,
  SIZE_EVERY:5, SIZE_GROW:0.10, SIZE_MAX:2.0, EXIT_MOVE_EVERY:5,
  EXIT_HANDOFF_TICKS:120, EXIT_SAFE_PAD:32,
  RETRY_COST:100,            // coins to revive at the same round after death
};

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
  { id:"#3d7bff", label:"Pulse", style:"pulse",  cost:15 },   // core + breathing ring
  { id:"#ff5ca8", label:"Comet", style:"comet",  cost:25 },   // spinning star spikes
  { id:"#ff8a2b", label:"Blaze", style:"square", cost:40 },   // rotated glowing square
  { id:"#b06bff", label:"Void",  style:"void",   cost:60 },   // bright ring, hollow core
];
function getSkinStyle(colorId){
  const s = SKINS.find(k=>k.id===colorId);
  return s ? s.style : "solid";
}

const TRAILS = [
  { id:"classic", label:"Classic", cost:0 },
  { id:"sparkle", label:"Sparkle", cost:20 },
  { id:"long", label:"Long Trail", cost:30 },
  { id:"rainbow", label:"Rainbow", cost:50 },
];
const GHOST_SKINS = [
  { id:"#ff3554", label:"Crimson", cost:0 },
  { id:"#c66bff", label:"Violet", cost:20 },
  { id:"#39ff9e", label:"Toxic", cost:35 },
  { id:"#eaf2ff", label:"Phantom", cost:50 },
];
const DEATH_FX = [
  { id:"classic", label:"Classic", cost:0 },
  { id:"shockwave", label:"Shockwave", cost:25 },
  { id:"confetti", label:"Confetti", cost:40 },
  { id:"implode", label:"Implode", cost:55 },
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

/* Selectable sound packs — free preference switcher (no coin cost). Each pack
   only re-flavors pickup/complete/sweep; the death stinger is always the
   dedicated scary effect below, regardless of pack. */
const SOUND_PACKS = [
  { id:"arcade",   label:"Arcade",   cost:0, pickup:{freq:880,  type:"square"},   complete:[{freq:660,type:"triangle"},{freq:988,type:"triangle"}], sweepFreq:220, sweepType:"sawtooth" },
  { id:"chiptune", label:"Chiptune", cost:0, pickup:{freq:1046, type:"square"},   complete:[{freq:784,type:"square"},{freq:1318,type:"square"}],   sweepFreq:330, sweepType:"square"   },
  { id:"synth",    label:"Synth",    cost:0, pickup:{freq:660,  type:"sine"},     complete:[{freq:494,type:"sine"},{freq:740,type:"sine"}],         sweepFreq:180, sweepType:"sawtooth" },
  { id:"retro",    label:"Retro",    cost:0, pickup:{freq:1200, type:"square", dur:0.05}, complete:[{freq:900,type:"square"},{freq:1500,type:"square"}], sweepFreq:400, sweepType:"square" },
  { id:"dark",     label:"Dark",     cost:0, pickup:{freq:440,  type:"triangle"}, complete:[{freq:330,type:"triangle"},{freq:494,type:"triangle"}], sweepFreq:110, sweepType:"sawtooth" },
  { id:"lofi",     label:"Lo-Fi",    cost:0, pickup:{freq:520,  type:"sine"},     complete:[{freq:392,type:"sine"},{freq:587,type:"sine"}],         sweepFreq:160, sweepType:"triangle" },
];
