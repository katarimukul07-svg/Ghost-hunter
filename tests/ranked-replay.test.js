import test from 'node:test';
import assert from 'node:assert/strict';
import {challenge, harness, payload, verify, registry, LIMITS} from '../research/ranked-replay/verifier.mjs';
import {play} from '../research/ranked-replay/player.mjs';
const c=challenge({seed:41123});
const transcript=play(harness(c));
const good=payload(c,transcript);
const check=p => verify(c,c.owner,JSON.stringify(p));
test('score is derived from actual input-only gameplay, including ghosts',()=>{
  assert.ok(transcript.score >= 2);
  assert.ok(JSON.parse(transcript.stateJson).ghosts.length >= 2);
  assert.equal(check(good).status,'replay_consistent');
});
for(const profile of ['phone','desktop']) test(`${profile}: same inputs, same physical state`,()=>{
  const c=challenge({seed:104,profile});const t=play(harness(c),{maxRounds:30});
  assert.ok(t.score>0);assert.equal(verify(c,c.owner,JSON.stringify(payload(c,t))).status,'replay_consistent');
});
test('fabricated score fails even with sequential tick numbers',()=>{
  assert.equal(check({...good,claimedScore:999}).reason,'score_mismatch');
});
test('empty checkpoint-only forgery fails',()=>{
  assert.equal(check({...good,inputs:[],claimedScore:999}).reason,'tick_limit');
});
test('client coordinate/speed/seed/delta injection is rejected by schema',()=>{
  for(const field of ['player','playerSpeed','seed','dt','round','coins','grace']) {
    assert.equal(check({...good,inputs:[{...good.inputs[0],[field]:999}]}).reason,'input');
  }
  assert.equal(check({...good,seed:c.seed+1}).reason,'schema');
});
test('changed physical-state digest fails',()=>{
  assert.equal(check({...good,stateDigest:'0'.repeat(64)}).reason,'state_mismatch');
});
test('dropped, duplicated and reordered inputs fail sequence validation',()=>{
  for(const inputs of [good.inputs.slice(1),[good.inputs[0],...good.inputs],
    [good.inputs[1],good.inputs[0],...good.inputs.slice(2)]]) {
    assert.equal(check({...good,inputs}).reason,'input');
  }
});
test('relabelled truncated inputs cannot retain the original score/state',()=>{
  assert.equal(check({...good,inputs:good.inputs.slice(0,2)}).reason,'score_mismatch');
});
test('other users, runs, rulesets and expired challenges fail',()=>{
  assert.equal(verify(c,'fixture-b',JSON.stringify(good)).reason,'owner');
  assert.equal(check({...good,runId:'another-run'}).reason,'binding');
  assert.equal(check({...good,ruleset:'old-build'}).reason,'binding');
  assert.equal(verify(c,c.owner,JSON.stringify(good),c.expiresAt+1).reason,'expiry');
  assert.equal(verify({...c,ruleset:'old-build'},c.owner,JSON.stringify(good)).reason,'trusted_ruleset');
});
test('malformed and excessive payloads fail before simulation',()=>{
  for(const wire of ['{','null','[]']) assert.equal(verify(c,c.owner,wire).status,'rejected');
  assert.equal(verify(c,c.owner,' '.repeat(LIMITS.maxBytes+1)).reason,'body_limit');
  assert.equal(check({...good,inputs:Array(LIMITS.maxTicks+1).fill(good.inputs[0])}).reason,'tick_limit');
  for(const x of [null,1e9,-1,'1']) assert.equal(check({...good,inputs:[{...good.inputs[0],x}]}).reason,'input');
});
test('matching retry is idempotent; conflicting retry is rejected',()=>{
  const r=registry(), c=r.issue({seed:41123});
  const p=payload(c,play(harness(c))),wire=JSON.stringify(p);
  assert.equal(r.submit(c.runId,c.owner,wire).status,'replay_consistent');
  assert.equal(r.submit(c.runId,c.owner,wire).duplicate,true);
  assert.equal(r.submit(c.runId,c.owner,JSON.stringify({...p,claimedScore:99})).reason,'conflicting_retry');
  assert.equal(r.submit(c.runId,'fixture-b',wire).reason,'owner');
});
test('pause/resume and bonus timers replay consistently',()=>{
  const c=challenge({seed:41123});const g=harness(c);const t=play(g,{maxRounds:2});
  let tick=t.inputs.length;const s=g.snapshot();const center={x:s.exit.x+s.exit.w/2,y:s.exit.y+s.exit.h/2};
  g.step({tick:++tick,...center,action:'pause'});
  for(let i=0;i<60;i++)g.step({tick:++tick,...center,action:'step'});
  const paused=g.snapshot();assert.equal(paused.frame,s.frame);assert.equal(paused.paused,true);
  g.step({tick:++tick,...center,action:'resume'});
  let observed=false;
  for(let i=0;i<650;i++) {g.step({tick:++tick,...center,action:'step'});observed ||= g.snapshot().bonus.bonuses.length>0;}
  assert.equal(observed,true);assert.equal(verify(c,c.owner,JSON.stringify(payload(c,g.transcript()))).status,'replay_consistent');
});
test('valid automated play remains accepted: replay does not prove human play',()=>{
  assert.equal(check(good).status,'replay_consistent');
});
test('resume without pause and repeated pause cannot inject grace',()=>{
  assert.equal(check({...good,inputs:[{...good.inputs[0],action:'resume'}]}).reason,'lifecycle');
  assert.equal(check({...good,inputs:[{...good.inputs[0],action:'pause'},
    {...good.inputs[1],action:'pause'}]}).reason,'lifecycle');
});
