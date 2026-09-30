// Staging integration surface. The release client remains independently gated.
import {validateInputs,PROFILES} from '../../supabase/functions/_shared/replay-input.mjs';
export function createRankedSession(network,{newId=()=>crypto.randomUUID()}={}){
 let startKey=null,ticket=null,run=null,inputs=[],finishKey=null,frozen=null,paused=false,pauses=0;
 return Object.freeze({
  async start(profile){
   if(run)throw Error('Run already active');startKey ||= newId();
   const issued=await network.post('/functions/v1/start-ranked-run-v2',{request_key:startKey,profile});
   if(typeof issued.ticket!=='string'||!Number.isSafeInteger(issued.seed)||issued.seed<0||issued.seed>0xffffffff||issued.profile!==profile)throw Error('Invalid run ticket response');
   ticket=issued.ticket;run=Object.freeze({...issued});return run;
  },
  record(x,y,action='step'){
   if(!run||frozen)throw Error('Run not recording');
   const input={tick:inputs.length+1,x,y,action};
   const size=PROFILES[run.profile];
   if(inputs.length>=18000||!Number.isFinite(x)||!Number.isFinite(y)||x<0||y<0||x>size.width||y>size.height||!['step','pause','resume'].includes(action))throw Error('Invalid input');
   if(action==='pause'){if(paused||pauses>=30)throw Error('Invalid lifecycle');paused=true;pauses++;}
   else if(action==='resume'){if(!paused)throw Error('Invalid lifecycle');paused=false;}
   else if(paused)throw Error('Input while paused');
   inputs.push(Object.freeze(input));
  },
  async finish(){
   if(!run)throw Error('Run not started');
   if(!frozen){validateInputs(inputs,run.profile);finishKey=newId();frozen=Object.freeze({ticket,request_key:finishKey,inputs:Object.freeze(inputs.map(input=>Object.freeze({...input})))});}
   // A response loss retries exactly the same receipt key and input log.
   return network.post('/functions/v1/finish-ranked-run-v2',frozen);
  },
  snapshot:()=>({run_id:run?.run_id||null,ticks:inputs.length,state:frozen?'submitted':run?'recording':'local'}),
 });
}
