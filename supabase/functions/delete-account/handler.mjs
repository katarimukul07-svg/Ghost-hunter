export async function handleDeleteAccount(request, { projectUrl, publicKey, serviceKey, allowedOrigins }, fetcher=fetch) {
  const origin = request.headers.get("origin") || "";
  const cors = allowedOrigins.includes(origin) ? {
    "Access-Control-Allow-Origin":origin,
    "Access-Control-Allow-Headers":"authorization, apikey, content-type",
    "Access-Control-Allow-Methods":"POST, OPTIONS",
    Vary:"Origin",
  } : {};
  const reply = (status, message) => new Response(JSON.stringify({ message }), {
    status, headers:{ ...cors, "Content-Type":"application/json", "Cache-Control":"no-store" },
  });
  if (request.method === "OPTIONS") {
    return origin && !allowedOrigins.includes(origin)
      ? reply(403, "Origin not allowed")
      : new Response(null, { status:204, headers:cors });
  }
  if (request.method !== "POST") return reply(405, "Method not allowed");
  if (origin && !allowedOrigins.includes(origin)) return reply(403, "Origin not allowed");
  if (!projectUrl || !publicKey || !serviceKey) return reply(503, "Deletion service unavailable");
  const authorization = request.headers.get("authorization") || "";
  if (!/^Bearer \S+$/.test(authorization)) return reply(401, "Sign in required");
  const body = await request.json().catch(() => null);
  if (body?.confirm !== "DELETE") return reply(400, "Confirmation required");

  // Resolve the caller from Auth, not from a client-supplied ID.
  const identity = await fetcher(`${projectUrl}/auth/v1/user`, {
    headers:{ apikey:publicKey, Authorization:authorization },
  });
  if (!identity.ok) return reply(401, "Sign in again before deleting your account");
  const user = await identity.json().catch(() => null);
  if (typeof user?.id !== "string" || !/^[0-9a-f-]{36}$/i.test(user.id)) return reply(401, "Sign in required");

  const deletion = await fetcher(`${projectUrl}/auth/v1/admin/users/${encodeURIComponent(user.id)}`, {
    method:"DELETE",
    headers:{ apikey:serviceKey, Authorization:`Bearer ${serviceKey}` },
  });
  if (!deletion.ok) return reply(503, "Could not delete account; please retry");
  // player_saves.user_id references auth.users with ON DELETE CASCADE.
  return new Response(null, { status:204, headers:{ ...cors, "Cache-Control":"no-store" } });
}
