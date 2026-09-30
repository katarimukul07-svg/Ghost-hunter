// Trusted replay adapter. Executed only inside a bounded worker child process.
// Uses the actual game's lexical bindings in both Chromium and the Node harness.
export function installReplayProbe(seed) {
  gameRandom = createGameRandom(seed);
  resetGame();
  const advance = update;
  const inputs = [];
  function snapshot() {
    return JSON.parse(JSON.stringify({mode, paused, round, player, room, exit,
      playerSpeed, departureZone, prize, hasPrize, obstacles, ghosts, currentPath,
      grace, frame, ghostPhase, ghostSpeed, wallTime, sweep,
      rng:gameRandom.state(), bonus:window.__echoStepsBonusTest.snapshot()},
    (_key, value) => typeof value === 'number' ? Math.round(value * 1e6) / 1e6 : value));
  }
  return {
    snapshot,
    step(input) {
      // Targets are inputs, never authoritative player coordinates or scores.
      pointer.x = input.x; pointer.y = input.y;
      if (input.action === 'pause') paused = true;
      else if (input.action === 'resume') { paused = false; grace = CFG.GRACE_TICKS; }
      else if (!paused) advance(CFG.SIMULATION_STEP);
      inputs.push({...input});
    },
    transcript:() => ({inputs:inputs.map(i => ({...i})), score:round - 1,
      stateJson:JSON.stringify(snapshot())}),
  };
}
