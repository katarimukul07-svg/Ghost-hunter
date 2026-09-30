import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
import {installReplayProbe} from './adapter.mjs';
import {validateInputs,PROFILES} from '../../supabase/functions/_shared/replay-input.mjs';
// vm evaluates ONLY trusted pinned source. The OS child process, not vm, is the
// resource boundary. Submitted input is data and never evaluated as code.
const sourcePaths=['config.js','random.js','arena.js','state.js','gameplay.js','systems/fairness.js','systems/bonuses.js'];
const sources=sourcePaths.map(file=>readFileSync(new URL('../../src/game/'+file,import.meta.url),'utf8'));
export const RULESET=createHash('sha256').update(sources.join('\n')+installReplayProbe.toString()).digest('hex');
const profiles=PROFILES, LIMITS={timeoutMs:3000};
const bootstrap='function drawGhosts() {} function updateHUD() {} function render() {} function refreshRetryBtn() {}';
export function harness(c) {
  const size = profiles[c.profile];
  if (!size || c.ruleset !== RULESET) throw Error('Unsupported trusted challenge');
  const element = () => ({value:'', style:{}, classList:{add(){},remove(){}},
    addEventListener(){}, clientWidth:size.width, clientHeight:size.height,
    getContext:() => ({setTransform(){}})});
  const elements = new Map();
  const context = vm.createContext({
    window:{devicePixelRatio:1, dispatchEvent(){}, addEventListener(){}},
    document:{documentElement:{}, getElementById(id){
      if (!elements.has(id)) elements.set(id, element()); return elements.get(id);
    }}, getComputedStyle:() => ({getPropertyValue:() => '0'}),
    localStorage:{getItem:() => null, setItem(){}}, CustomEvent:class {},
    navigator:{}, console:{info(){}}, URLSearchParams, location:{search:'?test=1'},
    Sound:new Proxy({}, {get:() => () => {}}),
    // Async reshuffle has no deterministic ordering yet: fail closed, never guess.
    setTimeout:() => {throw Error('Unsupported asynchronous layout fallback');},
    seed:c.seed,
  }, {codeGeneration:{strings:false, wasm:false}});
  vm.runInContext(bootstrap + sources.join('\n') + '\nresize();\n' +
    `globalThis.probe = (${installReplayProbe.toString()})(seed);`, context, {timeout:LIMITS.timeoutMs});
  return {
    snapshot:() => context.probe.snapshot(),
    step:input => {context.input = input; vm.runInContext('probe.step(input)', context, {timeout:LIMITS.timeoutMs});},
    transcript:() => context.probe.transcript(),
    replay:inputs => {context.inputs = inputs; vm.runInContext('for (const input of inputs) probe.step(input)', context,
      {timeout:LIMITS.timeoutMs}); return context.probe.transcript();},
  };
}

export function replayJob(job){
 if(job.ruleset!==RULESET)throw Error('ruleset_unavailable');
 validateInputs(job.inputs,job.profile);
 const game=harness({profile:job.profile,ruleset:job.ruleset,seed:Number(job.seed)});
 const result=game.replay(job.inputs);
 const state=JSON.parse(result.stateJson);
 if(!Number.isSafeInteger(result.score)||result.score<0||result.score>1000000)throw Error('simulation_failed');
 return {score:result.score,stateDigest:createHash('sha256').update(result.stateJson).digest('hex'),terminalMode:state.mode};
}
