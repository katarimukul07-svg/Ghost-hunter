import {planRoute, exitTarget} from '../../tests/automated-player.js';
// Input-only bot. Never writes coordinates, round, ghosts, grace or game configuration.
export function play(game, {maxTicks=2400, maxRounds=3}={}) {
  let tick=0;
  while (tick < maxTicks) {
    let state=game.snapshot();
    if (state.mode !== 1 || state.round > maxRounds) break;
    const target=state.hasPrize ? exitTarget(state.exit) : state.prize;
    if (!target) break;
    const route=planRoute(state, target);
    if (!route) break;
    const beforeRound=state.round, beforePrize=state.hasPrize;
    for (const point of route) {
      for (let j=0; j<50 && tick<maxTicks; j++) {
        game.step({tick:++tick, x:point.x, y:point.y, action:'step'});
        state=game.snapshot();
        if (state.mode !== 1 || state.round !== beforeRound || state.hasPrize !== beforePrize ||
            Math.hypot(state.player.x-point.x,state.player.y-point.y)<6) break;
      }
      if (state.mode !== 1 || state.round !== beforeRound || state.hasPrize !== beforePrize || tick>=maxTicks) break;
    }
  }
  return game.transcript();
}
