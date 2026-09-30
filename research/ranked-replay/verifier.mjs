import {readFileSync} from 'node:fs';
import {createHash, randomUUID, randomInt} from 'node:crypto';
import vm from 'node:vm';
import {installReplayProbe} from './probe.mjs';

// Offline research only. No HTTP endpoint, database writes or production activation.
// vm loads trusted repository code; it is NOT a production security sandbox.
const sourcePaths = ['config.js', 'random.js', 'arena.js', 'state.js', 'gameplay.js',
  'systems/fairness.js', 'systems/bonuses.js'];
const sources = sourcePaths.map(file => readFileSync(new URL(`../../src/game/${file}`, import.meta.url), 'utf8'));
export const sha256 = text => createHash('sha256').update(text).digest('hex');
export const RULESET = sha256(sources.join('\n') + installReplayProbe.toString());
export const LIMITS = Object.freeze({maxTicks:18000, maxBytes:1500000, timeoutMs:3000});
const profiles = Object.freeze({phone:{width:393, height:727}, desktop:{width:1280, height:646}});
export function challenge({owner='fixture-a', profile='phone', seed=randomInt(0x100000000), now=Date.now()}={}) {
  if (!profiles[profile]) throw Error('Unknown profile');
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) throw Error('Invalid seed');
  return Object.freeze({runId:randomUUID(), owner, profile, seed, ruleset:RULESET,
    issuedAt:now, expiresAt:now + 30 * 60 * 1000});
}
const bootstrap = `
function drawGhosts() {} function updateHUD() {} function render() {}
function refreshRetryBtn() {}
`;
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
export function payload(c, transcript) {
  return {runId:c.runId, ruleset:c.ruleset, inputs:transcript.inputs,
    claimedScore:transcript.score, stateDigest:sha256(transcript.stateJson)};
}
const keysAre = (object, keys) => object && typeof object === 'object' && !Array.isArray(object) &&
  Object.keys(object).sort().join(',') === [...keys].sort().join(',');
const reject = reason => ({status:'rejected', reason});
// Takes wire JSON: cap the body BEFORE parsing or simulation, not afterward.
export function verify(c, owner, wire, now=Date.now()) {
  if (owner !== c.owner) return reject('owner');
  if (now < c.issuedAt || now > c.expiresAt) return reject('expiry');
  if (c.ruleset !== RULESET || !profiles[c.profile]) return reject('trusted_ruleset');
  if (typeof wire !== 'string' || Buffer.byteLength(wire) > LIMITS.maxBytes) return reject('body_limit');
  let p;
  try {p = JSON.parse(wire);} catch {return reject('json');}
  if (!keysAre(p, ['runId','ruleset','inputs','claimedScore','stateDigest'])) return reject('schema');
  if (p.runId !== c.runId || p.ruleset !== c.ruleset) return reject('binding');
  if (!Number.isSafeInteger(p.claimedScore) || p.claimedScore < 0 ||
      typeof p.stateDigest !== 'string' || !/^[a-f0-9]{64}$/.test(p.stateDigest)) return reject('claim');
  if (!Array.isArray(p.inputs) || !p.inputs.length || p.inputs.length > LIMITS.maxTicks) return reject('tick_limit');
  const size = profiles[c.profile];
  let paused=false;
  for (let i=0; i<p.inputs.length; i++) {
    const input=p.inputs[i];
    if (!keysAre(input, ['tick','x','y','action']) || input.tick !== i+1 ||
        !['step','pause','resume'].includes(input.action) || !Number.isFinite(input.x) || !Number.isFinite(input.y) ||
        input.x < 0 || input.y < 0 || input.x > size.width || input.y > size.height) return reject('input');
    if (input.action === 'pause') {if (paused) return reject('lifecycle'); paused=true;}
    if (input.action === 'resume') {if (!paused) return reject('lifecycle'); paused=false;}
  }
  let transcript;
  const started=performance.now();
  try {transcript=harness(c).replay(p.inputs);} catch {return reject('simulation');}
  // Digest is a consistency check, not an attestation or proof of a human player.
  if (transcript.score !== p.claimedScore) return reject('score_mismatch');
  if (sha256(transcript.stateJson) !== p.stateDigest) return reject('state_mismatch');
  return {status:'replay_consistent', score:transcript.score, ticks:p.inputs.length,
    elapsedMs:performance.now()-started, bytes:Buffer.byteLength(wire)};
}

// Models retry/binding behavior only; the map is ephemeral and NOT a durable ledger.
export function registry() {
  const runs=new Map();
  return {
    issue(options) {const c=challenge(options); runs.set(c.runId, {c}); return c;},
    submit(runId, owner, wire, now=Date.now()) {
      const entry=runs.get(runId);
      if (!entry) return reject('unknown_run');
      if (owner !== entry.c.owner) return reject('owner');
      if (now < entry.c.issuedAt || now > entry.c.expiresAt) return reject('expiry');
      if (typeof wire !== 'string' || Buffer.byteLength(wire) > LIMITS.maxBytes) return reject('body_limit');
      const digest=sha256(wire);
      if (entry.digest) return entry.digest === digest ? {...entry.result, duplicate:true} : reject('conflicting_retry');
      const result=verify(entry.c, owner, wire, now);
      if (result.status === 'replay_consistent') {entry.digest=digest; entry.result=result;}
      return result;
    },
  };
}
