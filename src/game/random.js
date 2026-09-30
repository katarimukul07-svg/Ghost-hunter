"use strict";
// Gameplay has its own stream: cosmetic rendering must not advance layouts.
// This PRNG is reproducible, not cryptographic. Server challenges use Node crypto.
function createGameRandom(seed) {
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) throw new Error("Invalid game seed");
  let value = seed >>> 0;
  const next = () => {
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
    return value / 0x100000000;
  };
  next.state = () => value;
  return next;
}
let gameRandom = createGameRandom(Math.floor(Math.random() * 0x100000000));
function shuffledBonusTypes() {
  const names = Object.keys(BONUS_TYPES);
  for (let i = names.length - 1; i > 0; i--) {
    const j = Math.floor(gameRandom() * (i + 1));
    [names[i], names[j]] = [names[j], names[i]];
  }
  return names;
}
