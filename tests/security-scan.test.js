import test from 'node:test';
import assert from 'node:assert/strict';
import { inspect } from '../scripts/security-scan.mjs';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
test('scanner detects private/provider credentials and redacts values',()=>{
  const jwt=['eyJhbGciOiJIUzI1NiJ9',Buffer.from(JSON.stringify({role:'service_role'})).toString('base64url'),'syntheticSignature'].join('.');
  const fixtures=['-----BEGIN '+'PRIVATE KEY-----','gh'+'p_'+'a'.repeat(36),'sb_'+'secret_'+'a'.repeat(30),'database_'+'password = "'+'a'.repeat(24)+'"',jwt];
  for(const value of fixtures) {
    const findings=inspect(value,'fixture'); assert.ok(findings.length);
    assert.ok(!JSON.stringify(findings).includes(value));
    assert.match(findings[0].fingerprint,/^[0-9a-f]{12}$/);
  }
});
test('publishable keys and environment references are not credentials',()=>{
  assert.deepEqual(inspect('sb_publishable_fixture process.env.SUPABASE_SERVICE_ROLE_KEY','fixture'),[]);
});
test('scanner fails closed outside a repository',()=>{
  const cwd=mkdtempSync(join(tmpdir(),'ghost-scan-'));
  try {
    const r=spawnSync(process.execPath,[new URL('../scripts/security-scan.mjs',import.meta.url).pathname,'--history'],{cwd,encoding:'utf8'});
    assert.equal(r.status,1); assert.match(r.stderr,/incomplete/);
  } finally {rmSync(cwd,{recursive:true,force:true});}
});
