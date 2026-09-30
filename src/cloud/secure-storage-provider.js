// Browser path never imports the plugin, whose own web fallback is plaintext.
// Storage protects persisted tokens at rest, not an XSS-controlled live runtime.
export function createSessionStore({native=false,loadNative}={}){
 let memory=null,backend=null,queue=Promise.resolve();
 const getBackend=async()=>backend||(backend=await loadNative());
 // Serial writes ensure a pending refresh cannot persist after sign-out removes it.
 const serialize=fn=>{const result=queue.then(fn);queue=result.catch(()=>{});return result;};
 const copy=value=>value===null?null:JSON.parse(JSON.stringify(value));
 const validate=value=>{
  if(value===null)return null;
  if(!value||typeof value.access_token!=='string'||!value.access_token||typeof value.refresh_token!=='string'||!value.refresh_token||!Number.isFinite(value.expiresAt)||typeof value.user?.id!=='string')throw Error('Invalid session');
  return copy(value);
 };
 return Object.freeze({
  get:()=>serialize(async()=>{
   if(!native)return copy(memory);
   const value=await(await getBackend()).get('active',false,false);
   return validate(value);
  }),
  set:value=>serialize(async()=>{
   const saved=validate(value);
   if(native){await(await getBackend()).set('active',saved,false,false);}else memory=saved;
  }),
  remove:()=>serialize(async()=>{memory=null;if(native)await(await getBackend()).remove('active',false);}),
 });
}
