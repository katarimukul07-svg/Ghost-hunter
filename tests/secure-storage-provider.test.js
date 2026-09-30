import test from 'node:test';
import assert from 'node:assert/strict';
import {createSessionStore} from '../src/cloud/secure-storage-provider.js';
const session={access_token:'access-fixture',refresh_token:'refresh-fixture',expiresAt:100000,user:{id:'user-fixture'}};
test('browser stores copies only in memory and never loads native fallback',async()=>{
 const store=createSessionStore({loadNative:()=>{throw Error('Web fallback must not load');}});
 await store.set(session);const copy=await store.get();copy.access_token='changed';assert.equal((await store.get()).access_token,session.access_token);
 await store.remove();assert.equal(await store.get(),null);
 assert.equal(await createSessionStore().get(),null);
});
test('native remove fences an in-flight persistence write',async()=>{
 let value=null,release;const pending=new Promise(resolve=>release=resolve);
 const native={set:async(_key,data)=>{await pending;value=data;},get:async()=>value,remove:async()=>{value=null;}};
 const store=createSessionStore({native:true,loadNative:async()=>native});
 const write=store.set(session),remove=store.remove();release();await Promise.all([write,remove]);assert.equal(await store.get(),null);
});
test('native failure never persists in an unencrypted fallback',async()=>{
 const store=createSessionStore({native:true,loadNative:async()=>{throw Error('Keystore unavailable');}});
 await assert.rejects(store.set(session));await assert.rejects(store.get());
});
