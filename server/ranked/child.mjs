// This process receives no provider keys and has no network requirement.
import {replayJob} from './engine.mjs';
let length=0;const chunks=[];
for await(const chunk of process.stdin){length+=chunk.length;if(length>1600000){process.exitCode=2;break;}chunks.push(chunk);}
if(!process.exitCode){
 try {process.stdout.write(JSON.stringify(replayJob(JSON.parse(Buffer.concat(chunks).toString('utf8')))));}
 catch(e){const reason=['ruleset_unavailable','simulation_failed'].includes(e.message)?e.message:'invalid_input';process.stdout.write(JSON.stringify({rejected:reason}));}
}
