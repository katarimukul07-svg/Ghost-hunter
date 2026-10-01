import {test,expect} from '@playwright/test';
import {RULESET,harness} from '../server/ranked/engine.mjs';
import {steerTo,exitTarget} from './automated-player.js';
import {completeTutorialForMostTests,collectPageErrors} from './helpers.js';
completeTutorialForMostTests(test);
test.use({serviceWorkers:'block'});
test('shipped canvas adapter records inputs that reproduce on the server',async({page},testInfo)=>{
  test.setTimeout(90000);
  const profile=testInfo.project.name==='mobile-chromium'?'phone':'desktop';
  await page.setViewportSize(profile==='phone'?{width:393,height:727}:{width:1280,height:646});
  await page.addInitScript(()=>{window.requestAnimationFrame=()=>0;});
  const errors=collectPageErrors(page);
  await page.goto('/?test=1');
  await page.evaluate(async({profile,ruleset})=>{
    const {createRankedCanvas}=await import('./src/cloud/ranked-canvas.js');
    const network={post:async(path,body)=>{
      if(path.includes('/start-'))return {ticket:'test-only-opaque-ticket',seed:41123,profile,ruleset,run_id:'fixture'};
      window.rankedWire=JSON.parse(JSON.stringify(body));return {run_id:'fixture',status:'processing'};
    }};
    window.rankedCanvas=createRankedCanvas({network,ports:window.EchoStepsRankedPorts,ruleset,isEnabled:()=>true});
    await window.rankedCanvas.begin(profile);
  },{profile,ruleset:RULESET});
  const initial=await page.evaluate(()=>window.__echoStepsTest.snapshot());
  const record={round:1,prize:initial.prize,moves:[]};
  const collected=await steerTo(page,initial.prize,record);expect(collected.hasPrize).toBe(true);
  await page.locator('#pauseBtn').click();await page.locator('#resumeBtn').click();
  const exited=await steerTo(page,exitTarget(collected.exit),record);expect(exited.round).toBe(2);
  const client=await page.evaluate(async()=>{
    await window.rankedCanvas.finish();
    return {wire:window.rankedWire,round,frame,player:{...player},rng:gameRandom.state()};
  });
  const server=harness({profile,ruleset:RULESET,seed:41123});server.replay(client.wire.inputs);const state=server.snapshot();
  expect(state.round).toBe(client.round);expect(state.frame).toBe(client.frame);expect(state.rng).toBe(client.rng);
  expect(state.player.x).toBeCloseTo(client.player.x,5);expect(state.player.y).toBeCloseTo(client.player.y,5);
  expect(client.wire.inputs.some(input=>input.action==='pause')).toBe(true);
  expect(Object.keys(client.wire).sort()).toEqual(['inputs','request_key','ticket']);
  expect(errors).toEqual([]);
});
