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

for (const balance of [0, 50]) {
  test(`shop previews without spending and buys explicitly with ${balance} coins`, async ({ page }) => {
    await page.addInitScript((value) => { if (localStorage.getItem("echoSteps.coins") === null) localStorage.setItem("echoSteps.coins", String(value)); }, balance);
    await page.goto("/");
    await page.locator("#shopBtn").click();
    await page.locator("#shopColors").getByRole("button", { name:"Pulse", exact:true }).click();
    await expect(page.locator("#shopHint")).toContainText("Previewing Pulse");
    await expect(page.locator("#shopCoinLine")).toContainText(`${balance} coins`);
    expect(await page.evaluate(() => localStorage.getItem("echoSteps.color"))).not.toBe("#3d7bff");
    if (balance === 0) {
      await expect(page.locator("#shopBuyBtn")).toBeDisabled();
      await expect(page.locator("#shopBuyBtn")).toHaveText("NEED 15 MORE COINS");
    } else {
      await page.locator("#shopBuyBtn").click();
      await expect(page.locator("#shopConfirm")).toBeVisible();
      await expect(page.locator("#shopConfirmItem")).toHaveText("Buy Pulse?");
      await expect(page.locator("#shopConfirmCost")).toHaveText("15 coins");
      const bounds = await page.locator("#shopConfirm").boundingBox();
      const viewport = page.viewportSize();
      expect(Math.abs(bounds.y + bounds.height/2 - viewport.height/2)).toBeLessThan(2);
      expect(Math.abs(bounds.x + bounds.width/2 - viewport.width/2)).toBeLessThan(2);
      expect(bounds.y).toBeGreaterThan(47);
      await expect(page.locator("#shopCoinLine")).toContainText("50 coins");
      await page.locator("#shopConfirmCancel").click();
      await expect(page.locator("#shopCoinLine")).toContainText("50 coins");
      await page.locator("#shopBuyBtn").click();
      await page.locator("#shopConfirmBuy").click();
      await expect(page.locator("#shopConfirm")).not.toBeVisible();
      await expect(page.locator("#shopCoinLine")).toContainText("35 coins");
      await expect(page.locator("#shopBuyBtn")).toBeHidden();
      expect(await page.evaluate(() => localStorage.getItem("echoSteps.color"))).toBe("#3d7bff");
      await page.locator("#shopColors").getByRole("button", { name:"Pulse", exact:true }).click();
      await expect(page.locator("#shopCoinLine")).toContainText("35 coins");
      await page.reload();
      await page.locator("#shopBtn").click();
      await expect(page.locator("#shopColors").getByRole("button", { name:"Pulse", exact:true })).toHaveAttribute("aria-pressed", "true");
    }
    await page.locator('#shopTabs [data-cat="trail"]').click();
    await expect(page.locator("#shopBuyBtn")).toBeHidden();
  });
}

test("touch taps target the exact spot while drags retain the visibility offset", async ({ page }) => {
  await page.goto("/?test=1");
  await page.locator("#startBtn").click();
  const result = await page.evaluate(() => {
    const canvas = document.querySelector("#c");
    canvas.setPointerCapture = () => {};
    const send = (type,x,y) => canvas.dispatchEvent(new PointerEvent(type, {
      pointerId:11, pointerType:"touch", clientX:x, clientY:y,
    }));
    send("pointerdown",180,300);
    const tap = window.__echoStepsTest.snapshot().pointer;
    send("pointerup",180,300);
    const released = window.__echoStepsTest.snapshot().pointer;
    send("pointerdown",180,300);
    send("pointermove",210,340);
    const drag = window.__echoStepsTest.snapshot().pointer;
    return {tap,released,drag};
  });
  expect(result.tap).toMatchObject({x:180,y:300});
  expect(result.released).toMatchObject({x:180,y:300,active:false});
  expect(result.drag.x).toBe(210);
  expect(result.drag.y).toBeLessThan(340);
});

test("tapping the prize collects it and tapping inside the exit clears the round", async ({ page }) => {
  await page.goto("/?test=1");
  await page.locator("#startBtn").click();
  await page.evaluate(() => {
    const api=window.__echoStepsTest, {prize}=api.snapshot();
    // Start within the prize's guaranteed clear area; use real touch input for pickup.
    api.movePlayerTo(prize.x,prize.y+30);
  });
  const prize = (await page.evaluate(() => window.__echoStepsTest.snapshot())).prize;
  await page.evaluate(({x,y}) => {
    const c=document.querySelector("#c"); c.setPointerCapture=()=>{};
    for (const type of ["pointerdown","pointerup"]) c.dispatchEvent(new PointerEvent(type,{
      pointerId:22,pointerType:"touch",clientX:x,clientY:y,
    }));
  },prize);
  await expect.poll(async () => (await page.evaluate(() => window.__echoStepsTest.snapshot())).hasPrize).toBe(true);
  const gate = await page.evaluate(() => {
    const api=window.__echoStepsTest, {exit}=api.snapshot();
    const x=exit.x+exit.w/2,y=exit.y+exit.h/2;
    const dx=exit.wall==="left"?30:exit.wall==="right"?-30:0;
    const dy=exit.wall==="top"?30:exit.wall==="bottom"?-30:0;
    api.movePlayerTo(x+dx,y+dy);
    return {x,y};
  });
  await page.evaluate(({x,y}) => {
    const c=document.querySelector("#c");
    for (const type of ["pointerdown","pointerup"]) c.dispatchEvent(new PointerEvent(type,{
      pointerId:33,pointerType:"touch",clientX:x,clientY:y,
    }));
  },gate);
  await expect.poll(async () => (await page.evaluate(() => window.__echoStepsTest.snapshot())).round).toBe(2);
});

test("crossing the drag threshold does not jump the destination", async ({page}) => {
 await page.goto('/?test=1'); await page.locator('#startBtn').click();
 const shift=await page.evaluate(()=>{
  const c=document.querySelector('#c');c.setPointerCapture=()=>{};
  const send=(type,x)=>c.dispatchEvent(new PointerEvent(type,{pointerId:71,pointerType:'touch',clientX:x,clientY:300}));
  send('pointerdown',180);send('pointermove',188);const a=window.__echoStepsTest.snapshot().pointer;
  send('pointermove',189);const b=window.__echoStepsTest.snapshot().pointer;
  return Math.hypot(a.x-b.x,a.y-b.y);
 });
 expect(shift).toBeLessThanOrEqual(2);
});
