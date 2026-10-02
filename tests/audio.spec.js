import { test, expect } from "@playwright/test";
import { completeTutorialForMostTests } from "./helpers.js";
completeTutorialForMostTests(test);

test("score advances, changes intensity, and cancels voices on interruption",async({page})=>{
  await page.goto("/?test=1");
  await page.locator("#startBtn").click();
  await expect.poll(()=>page.evaluate(()=>window.__ghostAudioTest.snapshot().musicActive)).toBe(true);
  await page.evaluate(()=>Sound.setRound(10));
  expect(await page.evaluate(()=>window.__ghostAudioTest.snapshot().intensity)).toBe(2);
  await page.evaluate(()=>{
    Sound.complete(); Sound.bonus(); Sound.sweep();
    window.dispatchEvent(new CustomEvent("echosteps:app-state",{detail:{isActive:false}}));
  });
  await expect.poll(()=>page.evaluate(()=>window.__ghostAudioTest.snapshot().voices)).toBe(0);
  expect(await page.evaluate(()=>window.__ghostAudioTest.snapshot().running)).toBe(false);
  await page.locator("#resumeBtn").click();
  expect(await page.evaluate(()=>window.__ghostAudioTest.snapshot().running)).toBe(true);
  await page.evaluate(()=>Sound.death());
  expect(await page.evaluate(()=>window.__ghostAudioTest.snapshot().running)).toBe(false);
  await expect.poll(()=>page.evaluate(()=>window.__ghostAudioTest.snapshot().voices)).toBe(0);
});

test("independent levels persist and mute clears queued voices",async({page})=>{
  await page.goto("/?test=1");
  await page.evaluate(()=>{
    Sound.unlock(); Sound.setLevels(0.2,0.7); Sound.startAmbient();
    Sound.complete(); Sound.setMuted(true);
  });
  await expect.poll(()=>page.evaluate(()=>window.__ghostAudioTest.snapshot().voices)).toBe(0);
  await page.reload();
  expect(await page.evaluate(()=>Sound.levels())).toEqual({music:0.2,effects:0.7});
  await page.locator("#settingsBtn").click();
  await expect(page.locator("#audioLevels")).toBeVisible();
  await expect(page.locator("#musicLevel")).toHaveValue("20");
  await page.locator("#settingsBackBtn").click();
  await expect(page.locator("#audioLevels")).toBeHidden();
});

test("overlapping effects render audible output with sample headroom",async({page})=>{
  await page.addInitScript(()=>{
    window.AudioContext=class extends OfflineAudioContext{
      constructor(){super(1,96000,48000); window.__audioRenderContext=this;}
      resume(){return Promise.resolve();}
    };
  });
  await page.goto("/?test=1");
  const metrics=await page.evaluate(async()=>{
    Sound.unlock(); Sound.setLevels(1,1); Sound.death();
    Sound.sweep(); Sound.complete(); Sound.bonus(); Sound.pickup();
    const rendered=await window.__audioRenderContext.startRendering();
    const samples=rendered.getChannelData(0);
    let peak=0, energy=0;
    for(const value of samples){peak=Math.max(peak,Math.abs(value)); energy+=value*value;}
    return {peak,rms:Math.sqrt(energy/samples.length)};
  });
  expect(metrics.peak).toBeGreaterThan(0.01);
  expect(metrics.peak).toBeLessThan(0.98);
  expect(metrics.rms).toBeGreaterThan(0.001);
  console.log("Audio overlap render",metrics);
});

 test("three tracks preview, persist and stay separate from shop purchases",async({page})=>{
  await page.goto('/?test=1');await page.locator('#settingsBtn').click();
  await expect(page.locator('#musicChoices button')).toHaveCount(3);
  await page.evaluate(async()=>{await navigator.serviceWorker.ready;});
  await expect.poll(()=>page.evaluate(async()=>{const found=await Promise.all(MUSIC_TRACKS.map(t=>caches.match(t.src)));return found.every(Boolean);})).toBe(true);
  await page.context().setOffline(true);
  for(const title of ['Echo Run','Ghost Circuit','Last Exit']){
    await page.locator('#musicChoices button').filter({hasText:title}).click();
    await expect.poll(()=>page.evaluate(()=>window.__ghostAudioTest.snapshot().musicActive)).toBe(true);
  }
  await page.locator('#settingsMuteBtn').click();
  await expect.poll(()=>page.evaluate(()=>window.__ghostAudioTest.snapshot().musicActive)).toBe(false);
  await page.locator('#settingsMuteBtn').click();
  await expect.poll(()=>page.evaluate(()=>window.__ghostAudioTest.snapshot().musicActive)).toBe(true);
  const coins=await page.evaluate(()=>localStorage.getItem('echoSteps.coins'));
  await page.locator('#settingsBackBtn').click();
  expect(await page.evaluate(()=>window.__ghostAudioTest.snapshot().musicActive)).toBe(false);
  await page.context().setOffline(false);
  await page.reload();expect(await page.evaluate(()=>Sound.musicTrack())).toBe('acid-chase');
  expect(await page.evaluate(()=>localStorage.getItem('echoSteps.coins'))).toBe(coins);
  await page.locator('#shopBtn').click();await expect(page.locator('[data-cat="sound"]')).toHaveCount(0);
  await page.locator('#shopBackBtn').click();await page.locator('#startBtn').click();await page.locator('#pauseBtn').click();
  await page.locator('#pauseSettingsBtn').click();await expect(page.locator('#settingsScreen')).toBeVisible();
  await page.locator('#settingsBackBtn').click();await expect(page.locator('#pauseScreen')).toBeVisible();
 });

for(const width of [320,390])test(`settings remain usable at ${width}px`,async({page})=>{
  await page.setViewportSize({width,height:568});await page.goto('/?test=1');
  await page.locator('#settingsBtn').scrollIntoViewIfNeeded();await page.locator('#settingsBtn').click();
  await page.locator('#settingsBackBtn').scrollIntoViewIfNeeded();const b=await page.locator('#settingsBackBtn').boundingBox();
  expect(b.x).toBeGreaterThanOrEqual(0);expect(b.x+b.width).toBeLessThanOrEqual(width);expect(b.y+b.height).toBeLessThanOrEqual(568);
  await page.locator('#settingsBackBtn').click();await expect(page.locator('#startScreen')).toBeVisible();
});
