import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const context={module:{exports:{}},crypto:{randomUUID:(()=>{let i=0;return ()=>`poc-${++i}`;})()},setTimeout};
vm.runInNewContext(readFileSync(new URL('../src/cloud/ranked-protocol.js',import.meta.url),'utf8'),context);
const {createRankedProtocol}=context.module.exports;
const scenarios=[];
for(const latency of [50,200,500,1500]){
  let rounds=0, calls=0, retries=0, duplicate=0;
  const latencies=[];let run=null;
  const rpc=async(method,data)=>{
    const t=performance.now();calls++;
    await new Promise(resolve=>setTimeout(resolve,latency));
    latencies.push(performance.now()-t);
    if(method==='start_ranked_run_v2'){run='poc-run';return {status:'active',run_id:run,verified_rounds:rounds};}
    if(method==='checkpoint_ranked_round_v2'){
      if(data.sequence<=rounds){duplicate++;return {status:'duplicate',verified_rounds:rounds};}
      if(data.sequence!==rounds+1)return {status:'expected_sequence',expected_sequence:rounds+1};
      rounds++;return {status:'accepted',verified_rounds:rounds};
    }
    if(method==='finish_ranked_run_v2')return data.expected_rounds===rounds ? {status:'finished',score:rounds} : {status:'expected_sequence',expected_sequence:rounds+1};
  };
  const p=createRankedProtocol(rpc);
  p.start();for(let r=1;r<=5;r++)p.checkpoint(r);p.finish();
  while(!['finished','rejected'].includes(p.snapshot().state))await new Promise(resolve=>setTimeout(resolve,10));
  const sorted=latencies.toSorted((a,b)=>a-b);
  scenarios.push({injected_ms:latency,completed:p.snapshot().state==='finished',score:rounds,
    incorrect_score:Number(rounds!==5),rejected_legitimate:Number(p.snapshot().state==='rejected'),
    mutation_calls:calls,retries,duplicate,recoveries:p.snapshot().recoveries,
    p50_ms:+sorted[Math.floor(sorted.length*.5)].toFixed(1),p95_ms:+sorted[Math.ceil(sorted.length*.95)-1].toFixed(1)});
}
console.log(JSON.stringify({environment:'in-process simulated RPC; no database/network transport',scenarios},null,2));
