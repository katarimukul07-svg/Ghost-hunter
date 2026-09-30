import {mkdirSync,writeFileSync} from 'node:fs';
import os from 'node:os';
import {challenge,harness,payload,verify,RULESET,LIMITS} from './verifier.mjs';
import {play} from './player.mjs';
const rows=[];
for(const profile of ['phone','desktop']) for(const seed of [104,309,907,41123,2718,511,17,42,101,202]) {
  const c=challenge({profile,seed});const t=play(harness(c),{maxRounds:30,maxTicks:3600});
  const wire=JSON.stringify(payload(c,t));const result=verify(c,c.owner,wire);
  rows.push({profile,seed,...result,terminalMode:JSON.parse(t.stateJson).mode,
    syntheticScoreForgery:verify(c,c.owner,JSON.stringify({...payload(c,t),claimedScore:t.score+100})).reason});
}
const sorted=rows.map(r=>r.elapsedMs).sort((a,b)=>a-b);
const c=challenge({seed:41123}),g=harness(c);let t=play(g,{maxRounds:2}),tick=t.inputs.length;
const s=g.snapshot(),x=s.exit.x+s.exit.w/2,y=s.exit.y+s.exit.h/2;
while(tick<LIMITS.maxTicks)g.step({tick:++tick,x,y,action:'step'});
const maxTickProbe=verify(c,c.owner,JSON.stringify(payload(c,g.transcript())));
const report={researchOnly:true,ruleset:RULESET,node:process.version,platform:os.platform(),arch:os.arch(),
  cpus:os.cpus().length,cases:rows.length,accepted:rows.filter(r=>r.status==='replay_consistent').length,
  falseRejections:rows.filter(r=>r.status!=='replay_consistent').length,
  scoreForgeriesRejected:rows.filter(r=>r.syntheticScoreForgery==='score_mismatch').length,
  p50Ms:sorted[Math.floor(sorted.length*0.5)],p95Ms:sorted[Math.min(sorted.length-1,Math.ceil(sorted.length*0.95)-1)],
  maxPayloadBytes:Math.max(...rows.map(r=>r.bytes || 0)),peakRssMiB:process.resourceUsage().maxRSS/1024,
  maxTickProbe,rows,decision:'MODIFY: deterministic replay feasible; human/bot distinction and production binding unproven'};
mkdirSync('reports',{recursive:true});writeFileSync('reports/ranked-replay-poc.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({...report,rows:undefined},null,2));
if(report.falseRejections || report.scoreForgeriesRejected!==report.cases ||
  maxTickProbe.status!=='replay_consistent') process.exitCode=1;
