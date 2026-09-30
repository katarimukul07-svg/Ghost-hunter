import {createTicketService,uuid,exactKeys} from './run-ticket.mjs';
import {validateInputs} from './replay-input.mjs';
// All provider calls have deadlines. No request bodies/tokens enter logs.
export async function handleRanked(request,operation,environment,fetcher=fetch){
 const {projectUrl,publicKey,serviceKey,allowedOrigins=[],keyring={},keyId,ruleset}=environment;
 const origin=request.headers.get('origin')||'';
 const cors=allowedOrigins.includes(origin)?{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'authorization,apikey,content-type','Access-Control-Allow-Methods':'POST,OPTIONS',Vary:'Origin'}:{};
 const reply=(status,data)=>new Response(JSON.stringify(data),{status,headers:{...cors,'Content-Type':'application/json','Cache-Control':'no-store'}});
 if(origin&&!allowedOrigins.includes(origin))return reply(403,{error:'Origin denied'});
 if(request.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
 if(request.method!=='POST')return reply(405,{error:'Method denied'});
 if(!/^https:\/\/[^/?#]+\.supabase\.co$/.test(projectUrl)||!publicKey||!serviceKey||!keyId||!/^[0-9a-f]{64}$/.test(ruleset))return reply(503,{error:'Ranked unavailable'});
 const auth=request.headers.get('authorization')||'';if(!/^Bearer \S+$/.test(auth))return reply(401,{error:'Sign in required'});
 if(!request.headers.get('content-type')?.toLowerCase().startsWith('application/json'))return reply(415,{error:'JSON required'});
 const limit=operation==='start'?4096:1500000;
 let body;
 try{
  const reader=request.body?.getReader();if(!reader)throw Error();
  const chunks=[];let length=0;
  // Bound the entire upload, including a slow or stalled request stream.
  let timer;
  const deadline=new Promise((_,reject)=>{timer=setTimeout(()=>{void reader.cancel().catch(()=>{});reject(new Error('Upload timed out'));},10000);});
  try{
   while(true){const {value,done}=await Promise.race([reader.read(),deadline]);if(done)break;length+=value.byteLength;if(length>limit){await reader.cancel();return reply(413,{error:'Payload too large'});}chunks.push(value);}
  }finally{clearTimeout(timer);}
  const bytes=new Uint8Array(length);let at=0;for(const c of chunks){bytes.set(c,at);at+=c.length;}
  body=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
 }catch{return reply(400,{error:'Invalid JSON'});}
 try{
  const identity=await fetcher(projectUrl+'/auth/v1/user',{headers:{apikey:publicKey,Authorization:auth},signal:AbortSignal.timeout(5000)});
  if(!identity.ok)return reply(401,{error:'Sign in required'});
  const user=await identity.json();if(!uuid(user?.id))return reply(401,{error:'Sign in required'});
  const rpc=async(name,args)=>{
   const response=await fetcher(projectUrl+'/rest/v1/rpc/'+name,{method:'POST',headers:{apikey:serviceKey,Authorization:'Bearer '+serviceKey,'Content-Type':'application/json'},body:JSON.stringify(args),signal:AbortSignal.timeout(5000)});
   const result=await response.json().catch(()=>null);
   if(!response.ok){const e=new Error('Database denied');e.code=result?.code;throw e;}return result;
  };
  const tickets=createTicketService(keyring);
  if(operation==='start'){
   if(!exactKeys(body,['request_key','profile'])||!uuid(body.request_key)||!['phone','desktop'].includes(body.profile))return reply(400,{error:'Invalid start'});
   const row=await rpc('issue_replay_run',{actor:user.id,request_key:body.request_key,engine:ruleset,viewport:body.profile,signing_key_id:keyId});
   if(row.status!=='started'||Date.parse(row.expires_at)<=Date.now())return reply(409,{error:'Run already closed'});
   return reply(200,{ticket:await tickets.sign(row),run_id:row.id,seed:Number(row.seed),profile:row.profile,ruleset:row.ruleset,started_at:row.started_at,expires_at:row.expires_at});
  }
  if(operation!=='finish')return reply(404,{error:'Unknown operation'});
  if(!exactKeys(body,['ticket','request_key','inputs'])||!uuid(body.request_key))return reply(400,{error:'Invalid finish'});
  let claims;try{claims=await tickets.verify(body.ticket);validateInputs(body.inputs,claims.profile);}catch{return reply(400,{error:'Invalid proof'});}
  if(claims.uid!==user.id)return reply(403,{error:'Ticket owner mismatch'});
  const row=await rpc('read_replay_run',{actor:user.id,run:claims.run_id});
  if(!row||!tickets.matches(claims,row))return reply(403,{error:'Ticket binding mismatch'});
  const receipt=await rpc('submit_replay_run',{actor:user.id,run:row.id,request_key:body.request_key,input_log:body.inputs});
  // Queue acknowledgement is never presented as an accepted score.
  return reply(202,receipt);
 }catch(e){
  if(e?.code==='40001')return reply(409,{error:'Idempotency conflict'});
  if(e?.code==='22023')return reply(400,{error:'Invalid run duration or payload'});
  if(e?.code==='54000')return reply(429,{error:'Run quota exceeded'});
  return reply(503,{error:'Ranked unavailable'});
 }
}
