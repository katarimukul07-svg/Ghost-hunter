import test from 'node:test';
import assert from 'node:assert/strict';
import {createTicketService,claimsFor} from '../supabase/functions/_shared/run-ticket.mjs';
import {handleRanked} from '../supabase/functions/_shared/ranked-handler.mjs';
import {validateInputs} from '../supabase/functions/_shared/replay-input.mjs';
import {RULESET,replayJob} from '../server/ranked/engine.mjs';
import {isolatedReplay} from '../server/ranked/worker.mjs';
import {challenge,harness,RULESET as POC_RULESET} from '../research/ranked-replay/verifier.mjs';
import {play} from '../research/ranked-replay/player.mjs';
const user='10000000-0000-4000-8000-000000000001',requestKey='20000000-0000-4000-8000-000000000001';
const now=Date.now();
const row={id:'30000000-0000-4000-8000-000000000001',user_id:user,key_id:'test',nonce:'a'.repeat(64),seed:41123,profile:'phone',ruleset:RULESET,started_at:new Date(now-10000).toISOString(),expires_at:new Date(now+1800000).toISOString(),status:'started'};
const env={projectUrl:'https://demo.supabase.co',publicKey:'fixture-public',serviceKey:'fixture-service',allowedOrigins:['https://game.example'],keyring:{test:btoa('a'.repeat(32)).replace(/=+$/,'')},keyId:'test',ruleset:RULESET};
const tickets=createTicketService(env.keyring);
const input=[{tick:1,x:100,y:100,action:'step'}];
const req=(body,token='fixture')=>new Request('https://edge.example',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://game.example',Authorization:'Bearer '+token},body:JSON.stringify(body)});
test('ticket signatures reject changes, another key and missing server key',async()=>{
 const ticket=await tickets.sign(row);assert.deepEqual(await tickets.verify(ticket),claimsFor(row));
 const [payload,signature]=ticket.split('.');const parsed=JSON.parse(atob(payload));parsed.seed++;
 await assert.rejects(tickets.verify(btoa(JSON.stringify(parsed)).replace(/=+$/,'')+'.'+signature));
 await assert.rejects(createTicketService({test:btoa('b'.repeat(32)).replace(/=+$/,'')}).verify(ticket));
 await assert.rejects(createTicketService({}).sign(row));
});
test('ingress binds Auth identity and unchanged persisted ticket before queueing',async()=>{
 const calls=[];const fetcher=async(url,options)=>{
  calls.push(url);if(url.endsWith('/user'))return Response.json({id:user});
  if(url.endsWith('/read_replay_run'))return Response.json(row);
  if(url.endsWith('/submit_replay_run')){const args=JSON.parse(options.body);assert.equal(args.actor,user);assert.deepEqual(args.input_log,input);return Response.json({run_id:row.id,status:'processing'});}
  throw Error('Unexpected call');
 };
 const r=await handleRanked(req({ticket:await tickets.sign(row),request_key:requestKey,inputs:input}),'finish',env,fetcher);
 assert.equal(r.status,202);assert.equal((await r.json()).status,'processing');assert.equal(calls.length,3);
});
test('spoofed caller and mismatched seed cannot reach submission',async()=>{
 for(const mode of ['user','seed']){
  const calls=[];const fetcher=async(url)=>{calls.push(url);return Response.json(url.endsWith('/user')?{id:mode==='user'?requestKey:user}:{...row,seed:1});};
  const r=await handleRanked(req({ticket:await tickets.sign(row),request_key:requestKey,inputs:input}),'finish',env,fetcher);
  assert.equal(r.status,403);assert.ok(!calls.some(x=>x.endsWith('/submit_replay_run')));
 }
});
test('bad telemetry, oversized bodies and invalid Auth fail closed',async()=>{
 for(const inputs of [[{...input[0],tick:2}],[{...input[0],score:999}],[{...input[0],x:NaN}],[{...input[0],action:'resume'}]])assert.throws(()=>validateInputs(inputs,'phone'));
 let calls=0;const fetcher=async()=>{calls++;return new Response(null,{status:401});};
 assert.equal((await handleRanked(req({request_key:requestKey,profile:'phone'}),'start',env,fetcher)).status,401);
 assert.equal((await handleRanked(req({junk:'x'.repeat(5000)}),'start',env,fetcher)).status,413);assert.equal(calls,1);
});
test('server-only start returns immutable database time, seed and ticket',async()=>{
 const fetcher=async(url,options)=>{if(url.endsWith('/user'))return Response.json({id:user});assert.equal(JSON.parse(options.body).actor,user);return Response.json(row);};
 const response=await handleRanked(req({request_key:requestKey,profile:'phone'}),'start',env,fetcher);
 assert.equal(response.status,200);const body=await response.json();assert.equal(body.seed,row.seed);assert.equal(body.started_at,row.started_at);assert.ok(tickets.matches(await tickets.verify(body.ticket),row));
});
test('production worker reproduces the measured ruleset and computes score without claims',async()=>{
 assert.equal(RULESET,POC_RULESET);
 const c=challenge({seed:41123});const t=play(harness(c),{maxRounds:2});
 const job={...row,inputs:t.inputs};const result=replayJob(job);assert.equal(result.score,t.score);
 const isolated=await isolatedReplay(job);assert.equal(isolated.score,t.score);assert.equal(isolated.stateDigest,result.stateDigest);
 assert.equal((await isolatedReplay({...job,ruleset:'0'.repeat(64)})).rejected,'ruleset_unavailable');
 assert.equal((await isolatedReplay(job,{timeoutMs:1})).rejected,'resource_limit');
});
