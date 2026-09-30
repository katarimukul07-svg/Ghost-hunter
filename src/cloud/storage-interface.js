// Local progress is an explicitly untrusted cache. Encryption does not make a
// client balance or cosmetic ownership authoritative. Server spends/grants must
// resolve entitlements and wallet ledger again in their own transaction.
export class ProgressCache {
 constructor(storage){this.storage=storage;}
 async read(){
  const parse=(key,fallback)=>{try{return JSON.parse(this.storage.getItem(key))??fallback;}catch{return fallback;}};
  return {authoritative:false,coins:parse('echoSteps.coins',0),unlocked:parse('echoSteps.unlocked',[]),bestRounds:parse('echoSteps.bestRounds',0)};
 }
 async write({coins,unlocked,bestRounds}){
  if(!Number.isSafeInteger(coins)||coins<0||!Number.isSafeInteger(bestRounds)||bestRounds<0||!Array.isArray(unlocked)||!unlocked.every(x=>typeof x==='string'))throw Error('Invalid cache');
  for(const [key,value] of Object.entries({coins,unlocked,bestRounds}))this.storage.setItem('echoSteps.'+key,JSON.stringify(value));
 }
}
export class EntitlementResolver {
 constructor({cache,fetchEntitlements,isOnline}){this.cache=cache;this.fetchEntitlements=fetchEntitlements;this.isOnline=isOnline;}
 async resolve(){
  if(!this.isOnline())return {source:'offline-preview',authoritative:false,progress:await this.cache.read(),entitlements:[]};
  // Do not silently substitute offline ownership when validation fails online.
  const rows=await this.fetchEntitlements();
  if(!Array.isArray(rows)||!rows.every(x=>typeof x.entitlement_key==='string'&&(x.revoked_at===null||typeof x.revoked_at==='string')))throw Error('Invalid entitlements');
  return {source:'server',authoritative:true,entitlements:rows.filter(x=>x.revoked_at===null).map(x=>x.entitlement_key)};
 }
}
