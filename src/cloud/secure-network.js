// No service-role key, ticket signing key or client HMAC belongs in this module.
export function createSecureNetwork({url,publicKey,getAccessToken,fetcher=fetch}){
 if(!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url)||!publicKey.startsWith('sb_publishable_'))throw Error('Invalid project');
 return Object.freeze({async post(path,body){
  if(!/^\/(functions\/v1\/(start|finish)-ranked-run-v2|rest\/v1\/rpc\/get_replay_leaderboard)$/.test(path))throw Error('Endpoint denied');
  const token=await getAccessToken();if(!token)throw Error('Sign in required');
  const response=await fetcher(url+path,{method:'POST',headers:{apikey:publicKey,Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(10000),cache:'no-store'});
  const data=await response.json().catch(()=>null);
  if(!response.ok){const error=new Error('Ranked request unavailable');error.status=response.status;throw error;}
  return data;
 }});
}
