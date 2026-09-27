import { test, expect } from '@playwright/test';
import { completeTutorialForMostTests } from './helpers.js';
completeTutorialForMostTests(test);
const project = 'https://demo.supabase.co';
const payload = '<img src=x onerror="window.xssExecuted=true">';
async function setup(page, expires=3600) {
  const calls=[];
  await page.route('**/cloud-config.json', r=>r.fulfill({json:{enabled:true,url:project,publishableKey:'sb_publishable_test'}}));
  await page.route(`${project}/**`, async r=>{
    const path=new URL(r.request().url()).pathname;
    calls.push(path);
    const json=path.endsWith('/verify') ? {access_token:'access-fixture',refresh_token:'refresh-fixture',expires_in:expires,user:{id:'10000000-0000-4000-8000-000000000001'}}
      : path.endsWith('/player_saves') ? [{revision:1,settings:{name:payload},best_rounds:1}]
      : path.endsWith('/get_leaderboard') ? [{rank:1,display_name:payload,country_code:'US',score:1}]: {};
    await r.fulfill({json});
  });
  await page.goto('/');
  await page.locator('#accountBtn').click();
  await page.locator('#accountEmail').fill('test@example.invalid');
  await page.locator('#accountEmailForm button').click();
  await page.locator('#accountCode').fill('123456');
  await page.locator('#accountCodeForm button').click();
  await page.locator('#accountUseCloud').click();
  return calls;
}
test('profile and leaderboard markup stays text; tokens never persist',async({page,context})=>{
  await setup(page);
  await expect(page.locator('#nameInput')).toHaveValue(payload);
  await page.locator('#accountBack').click();
  await page.locator('#leaderboardBtn').click();
  await expect(page.locator('#leaderboardRows')).toContainText(payload);
  expect(await page.locator('#leaderboardRows img').count()).toBe(0);
  expect(await page.evaluate(()=>window.xssExecuted)).toBeUndefined();
  const storage=await page.evaluate(()=>JSON.stringify({local:{...localStorage},session:{...sessionStorage}}));
  expect(storage).not.toMatch(/access-fixture|refresh-fixture|123456|test@example.invalid/);
  expect(await context.cookies()).toEqual([]);
  await page.reload();
  await page.locator('#accountBtn').click();
  await expect(page.locator('#accountEmailForm')).toBeVisible();
});
test('refresh completing after sign-out cannot resurrect session or send a save',async({page})=>{
  const calls=await setup(page);
  let release; let started;
  const pending=new Promise(resolve=>{started=resolve;});
  let saveCalls=0;
  await page.route(`${project}/rest/v1/rpc/put_player_save`,r=>{saveCalls++; return r.fulfill({status:401,json:{}});});
  await page.route(`${project}/auth/v1/token*`,async r=>{
    started(); await new Promise(resolve=>{release=resolve;});
    await r.fulfill({json:{access_token:'resurrected',refresh_token:'resurrected-refresh',expires_in:3600}});
  });
  await page.locator('#accountSync').click();
  await pending;
  await page.locator('#accountSignOut').click();
  release();
  await page.waitForTimeout(200);
  await page.locator('#accountBack').click();
  const before=calls.filter(p=>p.endsWith('get_leaderboard')).length;
  await page.locator('#leaderboardBtn').click();
  await expect(page.locator('#accountEmailForm')).toBeVisible();
  expect(calls.filter(p=>p.endsWith('get_leaderboard')).length).toBe(before);
  expect(saveCalls).toBe(1);
  // Direct public API reveals whether the stale refresh restored a usable session.
  expect(await page.evaluate(()=>window.EchoStepsCloud.getLeaderboard())).toEqual([]);
});
