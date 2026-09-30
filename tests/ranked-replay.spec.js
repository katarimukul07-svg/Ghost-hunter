import {test,expect} from '@playwright/test';
import {installReplayProbe} from '../research/ranked-replay/probe.mjs';
import {challenge,payload,verify} from '../research/ranked-replay/verifier.mjs';
import {steerTo,exitTarget} from './automated-player.js';
import {completeTutorialForMostTests,collectPageErrors} from './helpers.js';
completeTutorialForMostTests(test);
test.use({serviceWorkers:'block'});
test('real canvas controls replay on server; fabricated and speed-altered runs fail',async({page},testInfo)=>{
  test.setTimeout(90000);
  const phone=testInfo.project.name==='mobile-chromium';
  await page.setViewportSize(phone?{width:393,height:727}:{width:1280,height:646});
  await page.addInitScript(()=>{window.requestAnimationFrame=()=>0;});
  const errors=collectPageErrors(page);
  await page.goto('/?test=1');
  const c=challenge({seed:41123,profile:phone?'phone':'desktop'});
  // Only tests inject this research adapter. It never ships in dist.
  await page.evaluate(`window.originalReplayUpdate = update;
    window.replayProbe = (${installReplayProbe.toString()})(${c.seed});
    let replayTick = 0;
    update = function() { replayProbe.step({tick:++replayTick,x:pointer.x,y:pointer.y,action:'step'}); };`);
  const before=await page.evaluate(()=>window.__echoStepsTest.snapshot());
  const record={round:1,prize:before.prize,moves:[]};
  const collected=await steerTo(page,before.prize,record);
  expect(collected.hasPrize).toBe(true);
  const exited=await steerTo(page,exitTarget(collected.exit),record);
  expect(exited.round).toBe(2);
  // Force cosmetic draws to consume Math.random without consuming gameplay RNG.
  await page.evaluate(()=>{selectedTrail='sparkle';for(let i=0;i<20;i++)render();});
  const t=await page.evaluate(()=>replayProbe.transcript());
  const p=payload(c,t), result=verify(c,c.owner,JSON.stringify(p));
  expect(result.status).toBe('replay_consistent');expect(result.score).toBe(1);
  await testInfo.attach('browser-server-replay',{body:JSON.stringify({profile:c.profile,seed:c.seed,
    result,transcript:p},null,2),contentType:'application/json'});
  // The existing test hook simulates a client that calls completeRound without playing.
  await page.evaluate(()=>window.__echoStepsTest.completeRound());
  const forged=await page.evaluate(()=>replayProbe.transcript());
  expect(verify(c,c.owner,JSON.stringify(payload(c,forged))).reason).toBe('score_mismatch');
  // A fresh client with modified movement produces a different state/score.
  await page.evaluate(`update=window.originalReplayUpdate;
    window.replayProbe=(${installReplayProbe.toString()})(${c.seed}); playerSpeed*=4;
    for(let i=0;i<12;i++) replayProbe.step({tick:i+1,x:room.x+room.w-20,y:room.y+100,action:'step'});`);
  const altered=await page.evaluate(()=>replayProbe.transcript());
  expect(verify(c,c.owner,JSON.stringify(payload(c,altered))).status).toBe('rejected');
  expect(errors).toEqual([]);
});
