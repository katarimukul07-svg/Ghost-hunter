/* Explicit ports around the measured classic core. No server secret or score
   assertion crosses this boundary. Loaded after bonus wrappers are installed. */
(() => {
  'use strict';
  const advance=update;
  let controller=null, viewport=null;
  const profiles={phone:{width:393,height:727},desktop:{width:1280,height:646}};
  function matchesViewport() {
    if (!viewport || canvas.clientWidth!==viewport.width || canvas.clientHeight!==viewport.height) return false;
    const style=getComputedStyle(document.documentElement);
    // The pinned replay ruleset has zero safe-area offsets. Native letterboxing
    // needs separate measurement before any wider profile is approved.
    return ['top','right','bottom','left'].every(side=>!(parseFloat(style.getPropertyValue('--safe-'+side))||0));
  }
  function deterministic(action) {
    const result=action();
    // The measured core's only asynchronous layout fallback leaves no prize.
    // Forfeit before a subsequent tick; cosmetic audio timers remain allowed.
    if(mode===STATE.PLAYING && !prize && !hasPrize) throw Error('Asynchronous layout unsupported');
    return result;
  }
  const ports=Object.freeze({
    connect(value) { if(controller) throw Error('Ranked adapter already connected'); controller=value; },
    canBegin:()=>mode===STATE.START || mode===STATE.OVER,
    selectViewport(profile) { if(!Object.hasOwn(profiles,profile)) throw Error('Unsupported profile'); viewport=profiles[profile]; },
    matchesViewport,
    hold() { paused=true; acc=0; last=performance.now(); },
    release() { paused=false; acc=0; last=performance.now(); },
    initialize(seed) {
      if(!matchesViewport()) throw Error('Unsupported viewport');
      gameRandom=createGameRandom(seed);
      deterministic(()=>resetGame());
      acc=0; last=performance.now();
    },
    input:()=>({x:pointer.x,y:pointer.y}),
    terminal:()=>mode===STATE.DYING || mode===STATE.OVER,
    advance(dt) {
      if(controller?.snapshot().phase==='recording') deterministic(()=>advance(dt));
      else advance(dt);
    },
  });
  update=function rankedTick(dt) { if(controller) controller.tick(dt); else advance(dt); };
  Object.defineProperty(window,'EchoStepsRankedPorts',{value:ports});
  for(const id of ['pauseBtn','resumeBtn']) document.getElementById(id).addEventListener('click',()=>controller?.lifecycle(paused));
  document.addEventListener('visibilitychange',()=>controller?.lifecycle(paused));
  window.addEventListener('echosteps:app-state',()=>controller?.lifecycle(paused));
  window.addEventListener('echosteps:back',()=>{
    if(mode===STATE.START) controller?.forfeit('menu'); else controller?.lifecycle(paused);
  });
  for(const id of ['startBtn','restartBtn','retryBtn','pauseRestartBtn','pauseMenuBtn','menuBtn']) {
    document.getElementById(id).addEventListener('click',()=>controller?.forfeit(id==='retryBtn'?'revive':'restart'),true);
  }
  const changed=()=>{ if(!matchesViewport()) controller?.forfeit('viewport_changed'); };
  window.addEventListener('resize',changed);
  window.visualViewport?.addEventListener('resize',changed);
})();
