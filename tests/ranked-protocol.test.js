import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../src/cloud/ranked-protocol.js',import.meta.url),'utf8');
const context={module:{exports:{}},crypto:{randomUUID:(()=>{let n=0;return ()=>`id-${++n}`;})()},setTimeout};
vm.runInNewContext(source,context);
const {createRankedProtocol}=context.module.exports;
const tick=()=>new Promise(resolve=>setImmediate(resolve));
async function settle(protocol,expected){
  const deadline=performance.now()+1000;
  while(performance.now()<deadline){if(protocol.snapshot().state===expected)return;await new Promise(resolve=>setTimeout(resolve,1));}
  assert.equal(protocol.snapshot().state,expected);
}
function server({fault=()=>null}={}){
  let run=null, rounds=0, status='active', calls=0, starts=0, duplicate=0, retries=0;
  const events=new Map(), seen=new Set(), latencies=[];
  async function rpc(method,data){
    calls++;
    const started=performance.now();
    const action=fault(method,data,calls);
    if(action==='request_drop') throw Error('offline');
    if(action==='latency') await new Promise(resolve=>setTimeout(resolve,2));
    let result;
    if(method==='start_ranked_run_v2'){
      starts++; run ||= 'server-run';
      result={status:'active',run_id:run,verified_rounds:rounds};
    }else if(method==='checkpoint_ranked_round_v2'){
      if(status!=='active')result={status};
      else if(events.get(data.sequence)===data.event_id){duplicate++;result={status:'duplicate',verified_rounds:rounds};}
      else if(data.sequence!==rounds+1)result={status:'expected_sequence',expected_sequence:rounds+1,verified_rounds:rounds};
      else {rounds++;events.set(data.sequence,data.event_id);result={status:'accepted',verified_rounds:rounds};}
    }else if(method==='finish_ranked_run_v2'){
      if(data.expected_rounds!==rounds)result={status:'expected_sequence',expected_sequence:rounds+1};
      else {status='finished';result={status,score:rounds};}
    }
    latencies.push(performance.now()-started);
    if(action==='response_drop' && !seen.has(method+JSON.stringify(data))){seen.add(method+JSON.stringify(data));retries++;throw Error('lost response');}
    return result;
  }
  return {rpc,stats:()=>({rounds,status,calls,starts,duplicate,retries,latencies})};
}
for(const latency of [50,200,500,1500]){
  test(`ordered nonblocking run at simulated ${latency} ms latency`,async()=>{
    const s=server(); let delays=0;
    const p=createRankedProtocol(s.rpc,{delay:async()=>{delays++;await tick();}});
    p.start();
    for(let round=1;round<=30;round++) assert.equal(p.checkpoint(round),true);
    p.finish(); await settle(p,'finished');
    assert.equal(s.stats().rounds,30);assert.equal(delays,0);
  });
}
for(const failure of ['request_drop','response_drop','latency']){
  test(`network ${failure} retries without score corruption`,async()=>{
    let fired=false;
    const s=server({fault:(method)=>{if(!fired && method==='checkpoint_ranked_round_v2'){fired=true;return failure;}return null;}});
    const p=createRankedProtocol(s.rpc,{delay:async()=>tick()});
    p.start();p.checkpoint(1);p.checkpoint(2);p.finish();await settle(p,'finished');
    assert.equal(s.stats().rounds,2);
    if(failure!=='latency') assert.ok(p.snapshot().retries>=1);
  });
}
test('finish waits for a pending checkpoint and background retry',async()=>{
  let release;const blocked=new Promise(resolve=>{release=resolve;});
  const s=server();const rpc=async(method,data)=>{if(method==='checkpoint_ranked_round_v2' && data.sequence===2)await blocked;return s.rpc(method,data);};
  const p=createRankedProtocol(rpc);p.start();p.checkpoint(1);p.checkpoint(2);p.finish();
  await tick();assert.notEqual(s.stats().status,'finished');release();await settle(p,'finished');
  assert.equal(s.stats().rounds,2);
});
test('terminal rejection stops queued progression',async()=>{
  const s=server();const rpc=async(method,data)=>method==='checkpoint_ranked_round_v2' ? {status:'rejected'} : s.rpc(method,data);
  const p=createRankedProtocol(rpc);p.start();p.checkpoint(1);p.checkpoint(2);p.finish();await settle(p,'rejected');
  assert.equal(s.stats().rounds,0);
});
test('reload cancels memory queue; run is forfeited until expiry',async()=>{
  const s=server();const p=createRankedProtocol(s.rpc);p.start();p.checkpoint(1);await settle(p,'active');p.cancel();
  assert.equal(p.snapshot().state,'local');assert.equal(s.stats().rounds,1);
});
test('lost start acknowledgement retries the same start key',async()=>{
  let lost=false;const keys=[];const s=server();
  const rpc=async(method,data)=>{
    if(method==='start_ranked_run_v2') keys.push(data.new_start_key);
    const result=await s.rpc(method,data);
    if(method==='start_ranked_run_v2' && !lost){lost=true;throw Error('lost start response');}
    return result;
  };
  const p=createRankedProtocol(rpc,{delay:async()=>tick()});p.start();p.checkpoint(1);p.finish();
  await settle(p,'finished');assert.deepEqual(keys,[keys[0],keys[0]]);
  assert.equal(s.stats().rounds,1);
});
test('lost finish acknowledgement retries safely',async()=>{
  let lost=false;const s=server();
  const rpc=async(method,data)=>{
    const result=await s.rpc(method,data);
    if(method==='finish_ranked_run_v2' && !lost){lost=true;throw Error('lost finish response');}
    return result;
  };
  const p=createRankedProtocol(rpc,{delay:async()=>tick()});p.start();p.checkpoint(1);p.finish();
  await settle(p,'finished');assert.equal(s.stats().rounds,1);assert.ok(p.snapshot().retries>=1);
});
