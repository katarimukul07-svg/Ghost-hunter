import test from 'node:test';
import assert from 'node:assert/strict';
import {createRankedSession} from '../src/cloud/ranked-session.js';
import {createSecureNetwork} from '../src/cloud/secure-network.js';
test('client returns exact ticket and retries unchanged frozen telemetry',async()=>{
 let ids=0,fail=true;const receipts=[];
 const network={post:async(path,data)=>{
  if(path.includes('/start-'))return {ticket:'opaque-server-ticket',seed:7,profile:'phone',run_id:'run-fixture'};
  receipts.push(JSON.stringify(data));if(fail){fail=false;throw Error('Response lost');}return {status:'processing'};
 }};
 const session=createRankedSession(network,{newId:()=>String(++ids)});await session.start('phone');session.record(100,100);
 await assert.rejects(session.finish());assert.throws(()=>session.record(200,200));assert.equal((await session.finish()).status,'processing');
 assert.equal(receipts[0],receipts[1]);assert.equal(JSON.parse(receipts[0]).ticket,'opaque-server-ticket');assert.equal(ids,2);
});
test('network refuses another project and arbitrary data endpoints',async()=>{
 assert.throws(()=>createSecureNetwork({url:'https://attacker.invalid',publicKey:'sb_publishable_fixture'}));
 let calls=0;const network=createSecureNetwork({url:'https://demo.supabase.co',publicKey:'sb_publishable_fixture',getAccessToken:async()=>null,fetcher:async()=>{calls++;}});
 await assert.rejects(network.post('/rest/v1/ranked_replay_runs',{}));await assert.rejects(network.post('/functions/v1/start-ranked-run-v2',{}));assert.equal(calls,0);
});
