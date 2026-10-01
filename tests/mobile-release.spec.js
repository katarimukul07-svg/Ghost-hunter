import { test, expect } from "@playwright/test";
import { collectPageErrors, completeTutorialForMostTests } from "./helpers.js";

completeTutorialForMostTests(test);

test("a second finger cannot steal or end the steering drag", async ({ page }) => {
  await page.goto("/?test=1");
  await page.locator("#startBtn").click();
  const result = await page.evaluate(() => {
    const canvas = document.querySelector("#c");
    // Synthetic events isolate pointer ownership; existing tests exercise real drag.
    canvas.setPointerCapture = () => {};
    const send = (type, id, x) => canvas.dispatchEvent(new PointerEvent(type, {
      pointerId:id, pointerType:"touch", clientX:x, clientY:300, bubbles:true,
    }));
    send("pointerdown", 11, 120);
    send("pointerdown", 22, 220);
    send("pointermove", 22, 250);
    send("pointerup", 22, 250);
    const held = window.__echoStepsTest.snapshot().pointer;
    send("pointermove", 11, 140);
    const moved = window.__echoStepsTest.snapshot().pointer;
    send("pointercancel", 11, 140);
    return { held, moved, ended:window.__echoStepsTest.snapshot().pointer };
  });
  expect(result.held).toMatchObject({ active:true, x:120 });
  expect(result.moved).toMatchObject({ active:true, x:140 });
  expect(result.ended.active).toBe(false);
});

for (const interruption of ["lostpointercapture", "blur", "pause", "native-background", "restart"]) {
  test(`steering stops after ${interruption} and requires a fresh drag`, async ({ page }) => {
    await page.goto("/?test=1");
    await page.locator("#startBtn").click();
    await page.evaluate((kind) => {
      const canvas = document.querySelector("#c");
      canvas.setPointerCapture = () => {};
      canvas.dispatchEvent(new PointerEvent("pointerdown", {
        pointerId:11, pointerType:"touch", clientX:150, clientY:300,
      }));
      if (kind === "restart") document.querySelector("#restartBtn").click();
      else if (kind === "pause") document.querySelector("#pauseBtn").click();
      else if (kind === "native-background") window.dispatchEvent(
        new CustomEvent("echosteps:app-state", { detail:{ isActive:false } }));
      else if (kind === "blur") window.dispatchEvent(new Event("blur"));
      else canvas.dispatchEvent(new PointerEvent(kind, { pointerId:11 }));
    }, interruption);
    expect((await page.evaluate(() => window.__echoStepsTest.snapshot())).pointer.active).toBe(false);
    if (!["lostpointercapture", "restart"].includes(interruption)) {
      await expect(page.locator("#pauseScreen")).toBeVisible();
      await page.locator("#resumeBtn").click();
    }
    await page.evaluate(() => document.querySelector("#c").dispatchEvent(
      new PointerEvent("pointermove", { pointerId:11, clientX:250, clientY:300 })));
    expect((await page.evaluate(() => window.__echoStepsTest.snapshot())).pointer.active).toBe(false);
    await page.evaluate(() => document.querySelector("#c").dispatchEvent(
      new PointerEvent("pointerdown", { pointerId:33, clientX:180, clientY:300 })));
    expect((await page.evaluate(() => window.__echoStepsTest.snapshot())).pointer.active).toBe(true);
  });
}

for (const size of [{ width:320, height:568 }, { width:390, height:844 }]) {
  test(`menu and arena respect safe areas at ${size.width}x${size.height}`, async ({ page }) => {
    const errors = collectPageErrors(page);
    await page.setViewportSize(size);
    await page.goto("/?test=1");
    await page.evaluate(() => {
      const style = document.documentElement.style;
      for (const [key, value] of Object.entries({ top:47, bottom:34, left:0, right:0 }))
        style.setProperty("--safe-" + key, value + "px");
      window.dispatchEvent(new Event("resize"));
    });
    await page.locator("#startBtn").scrollIntoViewIfNeeded();
    await page.locator("#startBtn").click();
    const state = await page.evaluate(() => window.__echoStepsTest.snapshot());
    expect(state.room.y).toBeGreaterThan(47);
    expect(state.room.y + state.room.h).toBeLessThanOrEqual(size.height - 34);
    const hud = await page.locator("#hud").boundingBox();
    expect(hud.y + hud.height).toBeLessThanOrEqual(state.room.y);
    for (const id of ["#pauseBtn", "#muteBtn"]) {
      const box = await page.locator(id).boundingBox();
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(size.width);
    }
    await page.locator("#pauseBtn").click();
    await expect(page.locator("#pauseScreen")).toBeVisible();
    await page.locator("#resumeBtn").click();
    expect(errors).toEqual([]);
  });
}
