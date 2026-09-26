import { test, expect } from "@playwright/test";
import { completeTutorialForMostTests } from "./helpers.js";

completeTutorialForMostTests(test);

const project = "https://demo.supabase.co";
const enabled = { enabled:true, url:project, publishableKey:"sb_publishable_test" };

async function mockCloud(page, { remote=null, conflict=false }={}) {
  const requests = [];
  await page.route("**/cloud-config.json", route => route.fulfill({ json:enabled }));
  await page.route(`${project}/**`, async route => {
    const req = route.request();
    const url = new URL(req.url());
    const headers = { "access-control-allow-origin":"*", "access-control-allow-headers":"*" };
    if (req.method() === "OPTIONS") return route.fulfill({ status:204, headers });
    requests.push({ path:url.pathname, method:req.method(), body:req.postDataJSON() });
    if (url.pathname === "/auth/v1/otp") return route.fulfill({ json:{}, headers });
    if (url.pathname === "/auth/v1/verify") return route.fulfill({ json:{
      access_token:"test-access", refresh_token:"test-refresh", expires_in:3600,
      user:{ id:"10000000-0000-4000-8000-000000000001" },
    }, headers });
    if (url.pathname === "/rest/v1/player_saves") return route.fulfill({ json:remote ? [remote] : [], headers });
    if (url.pathname === "/rest/v1/rpc/put_player_save") {
      if (conflict) {
        conflict = false;
        remote = { revision:3, settings:{ name:"Other phone" }, best_rounds:10 };
        return route.fulfill({ status:409, json:{ code:"40001", message:"Save revision conflict" }, headers });
      }
      return route.fulfill({ json:(remote?.revision || 0)+1, headers });
    }
    return route.fulfill({ status:404, json:{ message:"Unexpected cloud request" }, headers });
  });
  return requests;
}

async function signIn(page) {
  await page.getByRole("button", { name:"ACCOUNT" }).click();
  await page.locator("#accountEmail").fill("player@example.com");
  await page.getByRole("button", { name:"SEND CODE" }).click();
  await page.locator("#accountCode").fill("123456");
  await page.getByRole("button", { name:"SIGN IN" }).click();
}

test("guest play has no account controls or cloud requests in the default build", async ({ page }) => {
  const external = [];
  page.on("request", request => {
    if (new URL(request.url()).origin !== "http://127.0.0.1:4173") external.push(request.url());
  });
  await page.goto("/");
  await expect(page.locator("#accountBtn")).toBeHidden();
  await expect(page.getByRole("button", { name:"PLAY", exact:true })).toBeVisible();
  expect(external).toEqual([]);
});

test("sign-in asks before replacing the device save and never sends coins", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("echoSteps.name", "Device pilot");
    localStorage.setItem("echoSteps.bestRounds", "7");
    localStorage.setItem("echoSteps.coins", "42");
  });
  const requests = await mockCloud(page, { remote:{ revision:2, settings:{ name:"Cloud pilot" }, best_rounds:12 } });
  await page.goto("/");
  await signIn(page);
  await expect(page.getByRole("button", { name:"RESTORE CLOUD SAVE" })).toBeVisible();
  await expect(page.locator("#nameInput")).toHaveValue("Device pilot");
  expect(requests.filter(request => request.path.endsWith("put_player_save"))).toHaveLength(0);
  await page.getByRole("button", { name:"RESTORE CLOUD SAVE" }).click();
  await expect(page.locator("#nameInput")).toHaveValue("Cloud pilot");
  await expect(page.locator("#accountStatus")).toContainText("restored");
  expect(await page.evaluate(() => localStorage.getItem("echoSteps.bestRounds"))).toBe("12");
  expect(await page.evaluate(() => localStorage.getItem("echoSteps.coins"))).toBe("42");
  expect(await page.evaluate(() => localStorage.getItem("echoSteps.cloudToken"))).toBeNull();
});

test("a stale revision requires another explicit choice before overwrite", async ({ page }) => {
  const requests = await mockCloud(page, {
    remote:{ revision:2, settings:{ name:"First cloud" }, best_rounds:5 }, conflict:true,
  });
  await page.goto("/");
  await signIn(page);
  await page.getByRole("button", { name:"USE THIS DEVICE" }).click();
  await expect(page.locator("#accountStatus")).toContainText("Another device changed");
  await expect(page.getByRole("button", { name:"RESTORE CLOUD SAVE" })).toBeVisible();
  expect(requests.filter(request => request.path.endsWith("put_player_save"))).toHaveLength(1);
  await page.getByRole("button", { name:"USE THIS DEVICE" }).click();
  await expect(page.locator("#accountStatus")).toContainText("Synced");
  const writes = requests.filter(request => request.path.endsWith("put_player_save"));
  expect(writes.map(write => write.body.expected_revision)).toEqual([2,3]);
  expect(writes[1].body.new_settings).not.toHaveProperty("coins");
});
