import {spawn} from 'node:child_process';
import {pathToFileURL,fileURLToPath} from 'node:url';
export function isolatedReplay(job,{timeoutMs=5000}={}){
 return new Promise(resolve=>{
  // Empty environment: service-role keys never reach replay code. Deploy this
  // child under a read-only, non-root, network-disabled OS/container boundary.
  const child=spawn(process.execPath,['--max-old-space-size=128',fileURLToPath(new URL('./child.mjs',import.meta.url))],{env:{},stdio:['pipe','pipe','ignore']});
  let output='',settled=false;
  const finish=result=>{if(settled)return;settled=true;clearTimeout(timer);resolve(result);};
  const timer=setTimeout(()=>{child.kill('SIGKILL');finish({rejected:'resource_limit'});},timeoutMs);
  child.on('error',()=>finish({rejected:'simulation_failed'}));
  child.stdin.on('error',()=>{});
  child.stdout.on('data',chunk=>{output+=chunk.toString();if(output.length>4096){child.kill('SIGKILL');finish({rejected:'resource_limit'});}});
  child.on('close',code=>{if(code!==0)return finish({rejected:'resource_limit'});try{const result=JSON.parse(output);if(result.rejected||Number.isSafeInteger(result.score))finish(result);else finish({rejected:'simulation_failed'});}catch{finish({rejected:'simulation_failed'});}});
  child.stdin.end(JSON.stringify(job));
 });
}
export async function runWorker({url,key,signal,fetcher=fetch,idleMs=1000}){
 if(!/^https:\/\/[^/?#]+\.supabase\.co$/.test(url)||!key)throw Error('Worker configuration required');
 const rpc=async(name,args)=>{
  const response=await fetcher(url+'/rest/v1/rpc/'+name,{method:'POST',headers:{apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify(args),signal:AbortSignal.timeout(5000)});
  if(!response.ok)throw Error('Worker database unavailable');return response.json();
 };
 while(!signal.aborted){
  try{
   const job=await rpc('claim_replay_run',{});
   if(job){
    const result=await isolatedReplay(job);
    await rpc('complete_replay_run',{run:job.id,lease:job.lease_nonce,version:job.lease_version,computed_score:result.rejected?null:result.score,rejection:result.rejected||null});
    continue;
   }
  }catch{/* Do not acknowledge on transport failure. The durable lease retries. */}
  await new Promise(resolve=>{const timer=setTimeout(done,idleMs);function done(){clearTimeout(timer);signal.removeEventListener('abort',done);resolve();}signal.addEventListener('abort',done,{once:true});});
 }
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const control=new AbortController();process.once('SIGTERM',()=>control.abort());process.once('SIGINT',()=>control.abort());
 await runWorker({url:process.env.ECHO_SUPABASE_URL,key:process.env.ECHO_WORKER_SERVICE_KEY,signal:control.signal});
}
