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
