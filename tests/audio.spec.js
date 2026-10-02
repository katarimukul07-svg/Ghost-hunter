import { test, expect } from "@playwright/test";
import { completeTutorialForMostTests } from "./helpers.js";
completeTutorialForMostTests(test);

test("score advances, changes intensity, and cancels voices on interruption",async({page})=>{
  await page.goto("/?test=1");
  await page.locator("#startBtn").click();
  await expect.poll(()=>page.evaluate(()=>window.__ghostAudioTest.snapshot().step)).toBeGreaterThan(2);
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
  await page.locator("#shopBtn").click();
  await page.locator('[data-cat="sound"]').click();
  await expect(page.locator("#audioLevels")).toBeVisible();
  await expect(page.locator("#musicLevel")).toHaveValue("20");
  await page.locator('[data-cat="colors"]').click();
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
