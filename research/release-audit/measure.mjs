import { chromium, webkit } from '@playwright/test';
const results={scope:'Mac browser emulation, synthetic simulation and rendering; NOT physical iPhone FPS, battery, survival or retention evidence',createdAt:new Date().toISOString(),engines:[]};
for(const [name,engine] of [['chromium',chromium],['webkit',webkit]]) {
 const browser=await engine.launch({headless:true});
 const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1});
 await page.addInitScript(()=>{window.requestAnimationFrame=()=>0;localStorage.setItem('echoSteps.tutorial.v1','complete');localStorage.setItem('echoSteps.mute','1');});
 await page.goto('http://127.0.0.1:4174/?test=1'); await page.locator('#startBtn').click();
 const data=await page.evaluate(()=>{
  const api=window.__echoStepsTest;
  const c=document.querySelector('#c');c.setPointerCapture=()=>{};
  const send=(type,x)=>c.dispatchEvent(new PointerEvent(type,{pointerId:1,pointerType:'touch',clientX:x,clientY:300}));
  send('pointerdown',180);send('pointermove',188);const before=api.snapshot().pointer;
  send('pointermove',189);const after=api.snapshot().pointer;
  send('pointerup',189);
  api.movePlayerTo(200,400);grace=1e9;
  const idleBefore=currentPath.length;api.step(36000);const idleAdded=currentPath.length-idleBefore;
  const rows=[];
  resetGame();
  for(let r=1;r<=100;r++) {
   grace=1e9;api.step(1200);
   if([1,30,100].includes(r)) {
    const elapsed=[];
    for(let i=0;i<200;i++){const t=performance.now();render();elapsed.push(performance.now()-t);}
    elapsed.sort((a,b)=>a-b);
    rows.push({round:r,ghosts:ghosts.length,currentSamples:currentPath.length,retainedGhostSamples:ghosts.reduce((n,g)=>n+g.path.length,0),renderMedianMs:elapsed[100],renderP95Ms:elapsed[190]});
   }
   api.completeRound();
  }
  return {onePixelDragTransitionPx:Math.hypot(after.x-before.x,after.y-before.y),idleTenSimulatedMinutesAddedSamples:idleAdded,rows};
 });
 results.engines.push({name,...data}); await browser.close();
}
process.stdout.write(JSON.stringify(results,null,2)+'\n');
