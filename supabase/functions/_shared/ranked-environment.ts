export function rankedEnvironment(){
 let keyring={};try{keyring=JSON.parse(Deno.env.get('ECHO_TICKET_KEYS')||'{}');}catch{/* Invalid configuration remains closed. */}
 return {projectUrl:Deno.env.get('SUPABASE_URL')||'',publicKey:Deno.env.get('SUPABASE_ANON_KEY')||'',serviceKey:Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'',
 allowedOrigins:(Deno.env.get('ECHO_ALLOWED_ORIGINS')||'').split(',').map(v=>v.trim()).filter(Boolean),keyring,keyId:Deno.env.get('ECHO_TICKET_KEY_ID')||'',ruleset:Deno.env.get('ECHO_RULESET')||''};
}
