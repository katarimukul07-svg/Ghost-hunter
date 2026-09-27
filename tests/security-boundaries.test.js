import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
test('service worker excludes authenticated cross-origin API and cloud configuration',()=>{
  const handlers={}; let intercepted=0;
  vm.runInNewContext(readFileSync(new URL('../service-worker.js',import.meta.url),'utf8'),{
    URL,self:{location:{origin:'https://game.example'},addEventListener:(name,fn)=>{handlers[name]=fn;}},
  });
  for(const [url,method] of [['https://demo.supabase.co/rest/v1/player_saves','GET'],['https://game.example/cloud-config.json','GET'],['https://game.example/private','POST']]) {
    handlers.fetch({request:{url,method},respondWith:()=>{intercepted++;}});
  }
  assert.equal(intercepted,0);
});
test('build refuses privileged key and invalid project origin without logging values',()=>{
  for(const [url,key] of [['https://demo.supabase.co','privileged-fixture'],['https://attacker.invalid','sb_publishable_fixture']]) {
    const r=spawnSync(process.execPath,['scripts/build.mjs'],{cwd:new URL('..',import.meta.url),encoding:'utf8',env:{...process.env,ECHO_CLOUD_ACTIVATE:'1',ECHO_SUPABASE_URL:url,ECHO_SUPABASE_PUBLISHABLE_KEY:key}});
    assert.equal(r.status,1); assert.ok(!r.stderr.includes(key));
  }
});
