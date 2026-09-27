import assert from "node:assert/strict";
import test from "node:test";
import { handleDeleteAccount } from "../supabase/functions/delete-account/handler.mjs";

const environment = {
  projectUrl:"https://demo.supabase.co", publicKey:"public-test", serviceKey:"server-only-test",
  allowedOrigins:["https://game.example"],
};
const makeRequest = (body, token="user-token", origin="https://game.example") => new Request(
  "https://demo.supabase.co/functions/v1/delete-account", {
    method:"POST", headers:{ origin, ...(token ? { Authorization:`Bearer ${token}` } : {}) },
    body:JSON.stringify(body),
  },
);

test("rejects missing auth, wrong origin, and missing confirmation before calling provider", async () => {
  const noNetwork = () => { throw new Error("Provider must not be called"); };
  assert.equal((await handleDeleteAccount(makeRequest({ confirm:"DELETE" }, ""), environment, noNetwork)).status, 401);
  assert.equal((await handleDeleteAccount(makeRequest({ confirm:"DELETE" }, "valid", "https://bad.example"), environment, noNetwork)).status, 403);
  assert.equal((await handleDeleteAccount(makeRequest({ confirm:"wrong" }), environment, noNetwork)).status, 400);
});

test("deletes only the account identified by Auth and keeps admin credentials server-side", async () => {
  const calls = [];
  const fetcher = async (url, options) => {
    calls.push({ url, options });
    if (url.endsWith("/auth/v1/user")) return Response.json({ id:"10000000-0000-4000-8000-000000000001" });
    return new Response(null, { status:204 });
  };
  const result = await handleDeleteAccount(makeRequest({
    confirm:"DELETE", user_id:"10000000-0000-4000-8000-000000000002",
  }), environment, fetcher);
  assert.equal(result.status, 204);
  assert.equal(calls.length, 2);
  assert.equal(calls[0].options.headers.Authorization, "Bearer user-token");
  assert.match(calls[1].url, /000000000001$/);
  assert.equal(calls[1].options.headers.Authorization, "Bearer server-only-test");
  assert.ok(!JSON.stringify([...result.headers]).includes("server-only-test"));
});

test("does not issue an admin deletion when Auth rejects the token", async () => {
  const calls = [];
  const result = await handleDeleteAccount(makeRequest({ confirm:"DELETE" }), environment, async url => {
    calls.push(url);
    return new Response(null, { status:401 });
  });
  assert.equal(result.status, 401);
  assert.equal(calls.length, 1);
});

for (const label of ['random', 'expired', 'forged', 'revoked', 'missing claims']) {
  test(`provider rejects ${label} bearer: no admin call or provider detail leaked`, async () => {
    let calls=0;
    const result=await handleDeleteAccount(makeRequest({confirm:'DELETE'},label.replaceAll(' ','-')),environment,async()=>{
      calls++; return Response.json({message:'internal SQL /private/path credential-detail'},{status:401});
    });
    assert.equal(result.status,401); assert.equal(calls,1);
    assert.doesNotMatch(await result.text(),/SQL|private|credential-detail/);
  });
}
test('malformed bearer, invalid JSON, null body and dangerous methods fail before provider',async()=>{
  const noNetwork=()=>{throw Error('must not call');};
  for (const authorization of ['Basic fixture','Bearer','Bearer a b']) {
    const r=new Request('https://demo.supabase.co',{method:'POST',headers:{authorization},body:'{"confirm":"DELETE"}'});
    assert.equal((await handleDeleteAccount(r,environment,noNetwork)).status,401);
  }
  for (const body of ['{','null','[]','{"confirm":1}']) {
    const r=new Request('https://demo.supabase.co',{method:'POST',headers:{authorization:'Bearer fixture'},body});
    assert.equal((await handleDeleteAccount(r,environment,noNetwork)).status,400);
  }
  for (const method of ['GET','PUT','DELETE','PATCH']) {
    assert.equal((await handleDeleteAccount(new Request('https://demo.supabase.co',{method}),environment,noNetwork)).status,405);
  }
});
test('provider transport failures return generic no-store errors',async()=>{
  const result=await handleDeleteAccount(makeRequest({confirm:'DELETE'}),environment,async()=>{throw Error('internal secret /filesystem/path');});
  assert.equal(result.status,503);
  assert.equal(result.headers.get('cache-control'),'no-store');
  assert.doesNotMatch(await result.text(),/secret|filesystem|stack/);
});
test('invalid provider user identifier cannot reach admin path',async()=>{
  let calls=0;
  const result=await handleDeleteAccount(makeRequest({confirm:'DELETE'}),environment,async()=>{calls++;return Response.json({id:'-'.repeat(36)});});
  assert.equal(result.status,401); assert.equal(calls,1);
});
