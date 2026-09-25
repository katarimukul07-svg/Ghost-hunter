import { handleDeleteAccount } from "./handler.mjs";

// Provided by the Supabase Edge Function runtime. Never bundle serviceKey in a client.
const environment = {
  projectUrl:Deno.env.get("SUPABASE_URL") || "",
  publicKey:Deno.env.get("SUPABASE_ANON_KEY") || "",
  serviceKey:Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "",
  allowedOrigins:(Deno.env.get("ECHO_ALLOWED_ORIGINS") || "")
    .split(",").map(origin => origin.trim()).filter(Boolean),
};
Deno.serve(request => handleDeleteAccount(request, environment));
