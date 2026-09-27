/* Ordered, nonblocking ranked progression. Events live in memory for this POC. */
(() => {
  "use strict";
  function createRankedProtocol(rpc, { delay=(ms)=>new Promise(resolve=>setTimeout(resolve,ms)), id=()=>crypto.randomUUID() }={}) {
    let state="local", runId=null, acknowledged=0, queued=0, finishing=false, worker=null, cancelled=false;
    const startKey=id(), events=[];
    let retries=0, recoveries=0;
    async function send(method, data) {
      for (;;) {
        if (cancelled) return null;
        try { return await rpc(method,data); }
        catch (error) {
          if (cancelled) return null;
          if (error.status && error.status < 500 && error.status !== 408 && error.status !== 429) {
            state="rejected"; return null;
          }
          state="recovering"; retries++;
          await delay(Math.min(1000 * 2 ** Math.min(retries,4),16000));
        }
      }
    }
    function pump() {
      if (worker) return worker;
      worker=(async () => {
        state="creating";
        const start=await send("start_ranked_run_v2", {new_client_build:"echo-steps-1.0.0",new_start_key:startKey});
        if (!start || start.status!=="active") { state="rejected"; return; }
        runId=start.run_id; acknowledged=start.verified_rounds;
        state="active";
        while (!cancelled && state!=="rejected") {
          const event=events[acknowledged];
          if (event) {
            state="checkpoint_pending";
            const result=await send("checkpoint_ranked_round_v2", {run_id:runId,...event});
            if (!result) break;
            if (result.status==="rejected" || result.status==="unavailable" || result.status==="finished") { state="rejected"; break; }
            if (result.status==="expected_sequence") {
              if (result.expected_sequence!==event.sequence) { state="rejected"; break; }
              recoveries++; continue;
            }
            if (!["accepted","duplicate"].includes(result.status) || result.verified_rounds!==event.completed_round) {
              state="rejected"; break;
            }
            acknowledged=event.completed_round; state="active"; continue;
          }
          if (finishing) {
            state="finish_pending";
            const result=await send("finish_ranked_run_v2", {run_id:runId,expected_rounds:queued});
            if (!result) break;
            state=result.status==="finished" && result.score===queued ? "finished" : "rejected";
          }
          break;
        }
      })().finally(()=>{ worker=null; if (!cancelled && (state==="active" && (events[acknowledged] || finishing))) pump(); });
      return worker;
    }
    return {
      start:()=>{ if (state!=="local") return worker; return pump(); },
      checkpoint:(round)=>{
        if (["rejected","finished"].includes(state) || finishing || round!==queued+1) return false;
        events.push({sequence:round,completed_round:round,event_id:id()}); queued=round;
        if (state==="active") pump(); return true;
      },
      finish:()=>{ finishing=true; if (state==="active") pump(); return worker; },
      cancel:()=>{ cancelled=true; state="local"; },
      snapshot:()=>({state,runId,acknowledged,queued,retries,recoveries}),
    };
  }
  if (typeof module!=="undefined" && module.exports) module.exports={createRankedProtocol};
  if (typeof window!=="undefined") window.createRankedProtocol=createRankedProtocol;
})();
