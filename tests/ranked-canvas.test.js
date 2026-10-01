import test from 'node:test';
import assert from 'node:assert/strict';
import {createRankedCanvas} from '../src/cloud/ranked-canvas.js';
const ruleset='a'.repeat(64);
function fixture({enabled=true,delay=false}={}) {
  let controller,valid=true,resolveTicket,failFinish=false,failStart=false;
  const events=[],requests=[];
  const ports={connect:c=>{controller=c;},canBegin:()=>true,selectViewport(){},matchesViewport:()=>valid,
    hold:()=>events.push('hold'),release:()=>events.push('release'),initialize:seed=>events.push(['seed',seed]),
    input:()=>({x:100,y:100}),advance:dt=>events.push(['advance',dt]),terminal:()=>false};
  const issued={ticket:'opaque',seed:7,profile:'phone',ruleset,run_id:'fixture'};
  const network={post:async(path,body)=>{
    requests.push({path,wire:JSON.stringify(body)});
    if(path.includes('/start-') && failStart){failStart=false;throw Error('Start response lost');}
    if(path.includes('/start-'))return delay?await new Promise(resolve=>{resolveTicket=()=>resolve(issued);}):issued;
    if(failFinish){failFinish=false,failStart=false;throw Error('Response lost');}
    return {run_id:'fixture',status:'processing'};
  }};
  const canvas=createRankedCanvas({ports,network,ruleset,isEnabled:()=>enabled});
  return {canvas,requests,events,controller:()=>controller,resolve:()=>resolveTicket(),resize:()=>{valid=false;},failFinish:()=>{failFinish=true;},failStart:()=>{failStart=true;}};
}
test('disabled gate never requests a ticket; waiting cannot advance physics',async()=>{
  const disabled=fixture({enabled:false});await assert.rejects(disabled.canvas.begin('phone'));assert.equal(disabled.requests.length,0);
  const f=fixture({delay:true});const first=f.canvas.begin('phone');assert.equal(f.canvas.begin('phone'),first);
  f.controller().tick(1/60);assert.ok(!f.events.some(e=>Array.isArray(e)&&e[0]==='advance'));
  f.resolve();await first;assert.deepEqual(f.events.at(-1),['seed',7]);
  f.controller().tick(1/60);assert.equal(f.canvas.snapshot().ticks,1);assert.deepEqual(f.events.at(-1),['advance',1/60]);
});
test('late ticket cannot resurrect a forfeited run',async()=>{
  const f=fixture({delay:true});const start=f.canvas.begin('phone');f.canvas.forfeit('menu');f.resolve();
  await assert.rejects(start);assert.equal(f.canvas.snapshot().phase,'forfeited');assert.ok(!f.events.some(e=>Array.isArray(e)&&e[0]==='seed'));
});
test('pause/resume are chronological inputs, and resize forfeits before another tick',async()=>{
  const f=fixture();await f.canvas.begin('phone');f.canvas.tick(1/60);f.canvas.lifecycle(true);f.canvas.lifecycle(false);f.canvas.tick(1/60);
  await f.canvas.finish();const body=JSON.parse(f.requests.at(-1).wire);
  assert.deepEqual(body.inputs.map(i=>i.action),['step','pause','resume','step']);assert.deepEqual(body.inputs.map(i=>i.tick),[1,2,3,4]);
  const g=fixture();await g.canvas.begin('phone');g.resize();g.canvas.tick(1/60);assert.equal(g.canvas.snapshot().phase,'forfeited');assert.equal(g.canvas.snapshot().ticks,0);
});
test('submission retry reuses exact telemetry and never submits a client score',async()=>{
  const f=fixture();await f.canvas.begin('phone');f.canvas.tick(1/60);f.failFinish();await assert.rejects(f.canvas.finish());
  assert.equal(f.canvas.snapshot().phase,'retryable');await f.canvas.retry();
  const finishes=f.requests.filter(r=>r.path.includes('/finish-'));assert.equal(finishes[0].wire,finishes[1].wire);
  assert.deepEqual(Object.keys(JSON.parse(finishes[0].wire)).sort(),['inputs','request_key','ticket']);assert.equal(f.canvas.snapshot().phase,'submitted');
});
test('invalid timestep and stepping a paused run cannot produce a submission',async()=>{
  for(const paused of [true,false]){
    const f=fixture();await f.canvas.begin('phone');if(paused)f.canvas.lifecycle(true);f.canvas.tick(paused?1/60:1/30);
    assert.equal(f.canvas.snapshot().phase,'forfeited');assert.ok(!f.requests.some(r=>r.path.includes('/finish-')));
  }
});

test('lost start response retries the original start key and profile',async()=>{
  const f=fixture();f.failStart();await assert.rejects(f.canvas.begin('phone'));
  assert.equal(f.canvas.snapshot().phase,'start_retryable');await assert.rejects(f.canvas.begin('desktop'));
  await f.canvas.begin('phone');assert.equal(f.requests[0].wire,f.requests[1].wire);
  assert.equal(f.canvas.snapshot().phase,'recording');
});
