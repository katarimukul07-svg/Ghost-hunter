// Server-only ticket authentication. This module and keyring never enter dist.
import {exactKeys} from './replay-input.mjs';
export {exactKeys};
const encoder=new TextEncoder();
const fields=['v','kid','run_id','uid','nonce','seed','profile','ruleset','started_at','expires_at'];
export const uuid=value=>typeof value==='string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const encode=bytes=>btoa(String.fromCharCode(...bytes)).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');
const decode=text=>{
 if(typeof text!=='string'|| !/^[a-zA-Z0-9_-]+$/.test(text))throw Error('Invalid encoding');
 const raw=atob(text.replaceAll('-','+').replaceAll('_','/')+'='.repeat((4-text.length%4)%4));
 return Uint8Array.from(raw,c=>c.charCodeAt(0));
};
export function claimsFor(row){return {v:1,kid:row.key_id,run_id:row.id,uid:row.user_id,nonce:row.nonce,seed:Number(row.seed),profile:row.profile,ruleset:row.ruleset,started_at:row.started_at,expires_at:row.expires_at};}
export function createTicketService(keyring){
 const keys=new Map();
 async function key(id){
  if(!/^[a-zA-Z0-9_-]{1,40}$/.test(id)||!Object.hasOwn(keyring,id))throw Error('Signing key unavailable');
  if(!keys.has(id)){
   const bytes=decode(keyring[id]);if(bytes.length<32)throw Error('Signing key too short');
   keys.set(id,crypto.subtle.importKey('raw',bytes,{name:'HMAC',hash:'SHA-256'},false,['sign','verify']));
  }
  return keys.get(id);
 }
 return Object.freeze({
  async sign(row){const c=claimsFor(row),body=encode(encoder.encode(JSON.stringify(c)));return body+'.'+encode(new Uint8Array(await crypto.subtle.sign('HMAC',await key(c.kid),encoder.encode(body))));},
  async verify(ticket){
   if(typeof ticket!=='string'||ticket.length>2048)throw Error('Invalid ticket');
   const parts=ticket.split('.');if(parts.length!==2)throw Error('Invalid ticket');
   const c=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(decode(parts[0])));
   if(!exactKeys(c,fields)||c.v!==1||!uuid(c.run_id)||!uuid(c.uid)|| !/^[0-9a-f]{64}$/.test(c.nonce)||!Number.isSafeInteger(c.seed)||c.seed<0||c.seed>0xffffffff||!['phone','desktop'].includes(c.profile)||!/^[0-9a-f]{64}$/.test(c.ruleset)||!Number.isFinite(Date.parse(c.started_at))||!(Date.parse(c.expires_at)>Date.parse(c.started_at)))throw Error('Invalid ticket');
   if(!await crypto.subtle.verify('HMAC',await key(c.kid),decode(parts[1]),encoder.encode(parts[0])))throw Error('Invalid ticket');
   return c;
  },
  matches:(claims,row)=>JSON.stringify(claims)===JSON.stringify(claimsFor(row)),
 });
}
