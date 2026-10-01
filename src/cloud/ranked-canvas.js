import {createRankedSession} from './ranked-session.js';

// Only an approved caller supplies an enabled gate and authenticated network.
// The release build still refuses ECHO_RANKED_ACTIVATE=1. A hostile client can
// bypass this UI gate; the server ticket, replay and database remain authoritative.
export function createRankedCanvas({network, ports, ruleset, isEnabled=()=>false}) {
  let phase='idle', reason=null, session=null, pending=null, generation=0;
  let finishPromise=null, receipt=null, lifecyclePaused=false, selectedProfile=null;
  const notify=()=>ports.status?.({phase,reason,receipt});
  function forfeit(value='interrupted') {
    if (!['starting','start_retryable','recording'].includes(phase)) return;
    generation++; phase='forfeited'; reason=value;
    ports.release(); notify();
  }
  function geometry() {
    if (!ports.matchesViewport()) { forfeit('viewport_changed'); return false; }
    return true;
  }
  function finish() {
    if (finishPromise) return finishPromise;
    if (phase!=='recording') return Promise.reject(new Error('Run not recording'));
    // Freeze before the first await. Response loss retries the same ticket,
    // receipt key and telemetry; it must never restart a simulation or grant value.
    phase='submitting'; notify();
    const attempt=()=>session.finish().then(value=>{
      if (!value || value.run_id!==session.snapshot().run_id ||
          !['processing','accepted','rejected'].includes(value.status)) throw Error('Invalid receipt');
      receipt=value; phase='submitted'; reason=null; notify(); return value;
    }).catch(error=>{ phase='retryable'; reason='submission_failed'; notify(); throw error; });
    finishPromise=attempt();
    return finishPromise;
  }
  const controller=Object.freeze({
    begin(profile) {
      if (!isEnabled()) return Promise.reject(new Error('Ranked disabled'));
      if (phase==='starting') return pending;
      if (!['idle','submitted','forfeited','start_retryable'].includes(phase) || !ports.canBegin()) return Promise.reject(new Error('Run already active'));
      if (!/^[0-9a-f]{64}$/.test(ruleset)) return Promise.reject(new Error('Unapproved ruleset'));
      const retryStart=phase==='start_retryable';
      if(retryStart && profile!==selectedProfile) return Promise.reject(new Error('Start retry profile changed'));
      ports.selectViewport(profile);
      if (!ports.matchesViewport()) return Promise.reject(new Error('Unsupported viewport'));
      const epoch=++generation;
      if(!retryStart) session=createRankedSession(network);
      selectedProfile=profile; finishPromise=null; receipt=null; reason=null; phase='starting'; ports.hold(); notify();
      pending=(async()=>{
        try {
          const run=await session.start(profile);
          if (epoch!==generation) throw Error('Run interrupted');
          if (run.ruleset!==ruleset || !ports.matchesViewport()) throw Error('Challenge mismatch');
          // Gameplay cannot advance until the issued seed initializes the core.
          ports.initialize(run.seed); lifecyclePaused=false; phase='recording'; notify();
          return run;
        } catch(error) {
          if(epoch===generation) {
            if(!session.snapshot().run_id) { phase='start_retryable'; reason='start_failed'; ports.release(); notify(); }
            else forfeit('start_failed');
          }
          throw error;
        }
      })();
      return pending;
    },
    tick(dt) {
      if (phase==='starting') return; // Waiting for a ticket is never offline ranked play.
      if (phase!=='recording') { ports.advance(dt); return; }
      if (dt!==1/60 || !geometry()) { forfeit('invalid_timestep'); return; }
      try {
        if (lifecyclePaused) throw Error('Paused simulation advanced');
        const {x,y}=ports.input(); session.record(x,y);
        ports.advance(dt);
        if (ports.terminal()) void finish().catch(()=>{});
      } catch { forfeit('unsupported_simulation'); }
    },
    lifecycle(paused) {
      if (phase!=='recording' || paused===lifecyclePaused || !geometry()) return;
      try { const {x,y}=ports.input(); session.record(x,y,paused?'pause':'resume'); lifecyclePaused=paused; }
      catch { forfeit('invalid_lifecycle'); }
    },
    finish,
    retry() {
      if (phase!=='retryable') return Promise.reject(new Error('No pending receipt'));
      finishPromise=null; phase='recording'; return finish();
    },
    forfeit,
    snapshot:()=>({phase,reason,receipt,run_id:session?.snapshot().run_id||null,ticks:session?.snapshot().ticks||0}),
  });
  ports.connect(controller);
  return controller;
}
