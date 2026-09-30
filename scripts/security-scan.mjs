import { readFileSync, readdirSync, lstatSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { resolve, relative } from 'node:path';
import { pathToFileURL } from 'node:url';

// Deliberately bounded pattern scan, not a proof that arbitrary secrets are absent.
// Never emit matched values, source lines, git error output, or environment values.
export function inspect(content, location) {
  const rules=[
    ['private-key', /-----BEGIN (?:RSA |EC |OPENSSH |DSA |ENCRYPTED )?PRIVATE KEY-----/g],
    ['github-token', /\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,})\b/g],
    ['supabase-secret', /\bsb_secret_[A-Za-z0-9_-]{20,}\b/g],
    ['provider-key', /\b(?:AKIA[A-Z0-9]{16}|sk_live_[A-Za-z0-9]{20,}|xox[baprs]-[A-Za-z0-9-]{20,})\b/g],
    ['credential-assignment', /(?:service_role_key|client_secret|api_secret|database_password|db_password|signing_password)\s*[=:]\s*["']([^"'\s]{16,})["']/gi],
    ['database-password-url', /postgres(?:ql)?:\/\/[^:\s/]+:([^@\s]{8,})@/g],
  ];
  const findings=[];
  function add(type,value) { findings.push({location,type,fingerprint:createHash('sha256').update(value).digest('hex').slice(0,12)}); }
  for(const [type,pattern] of rules) for(const m of content.matchAll(pattern)) add(type,m[1]||m[0]);
  for(const m of content.matchAll(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g)) {
    try { if(JSON.parse(Buffer.from(m[0].split('.')[1],'base64url')).role==='service_role') add('service-role-jwt',m[0]); } catch { /* Not a JWT. */ }
  }
  return findings;
}
export function scan({history=false, artifacts=false}={}) {
  const git=(...args)=>execFileSync('git',args,{maxBuffer:128*1024*1024,stdio:['ignore','pipe','pipe']});
  const findings=[]; let files=0, blobs=0;
  const seen=new Set();
  function file(p) {
    const absolute=resolve(p); if(seen.has(absolute)) return; seen.add(absolute);
    const stat=lstatSync(p); if(stat.isSymbolicLink()) throw Error('Symlink in scan scope');
    if(stat.isDirectory()) { for(const name of readdirSync(p)) file(`${p}/${name}`); return; }
    files++; findings.push(...inspect(readFileSync(p).toString('utf8'),relative(process.cwd(),absolute)));
    if(artifacts && p.startsWith('dist/') && /(?:\.map$|(?:^|\/)\.env|(?:^|\/)(?:tests|test-results|supabase|node_modules)\/)/.test(p)) findings.push({location:p,type:'unexpected-build-artifact'});
  }
  for(const p of git('ls-files','-z').toString().split('\0').filter(Boolean)) file(p);
  // Include new source files during development and ignored environment files.
  for(const dir of ['src','scripts','tests','docs','supabase/functions','supabase/migrations','supabase/tests','.github']) file(dir);
  for(const name of readdirSync('.').filter(n=>n.startsWith('.env'))) file(name);
  if(artifacts) {
    if(!existsSync('dist/index.html')) throw Error('Build artifacts missing');
    file('dist');
    for(const p of ['android/app/src/main/assets/public','ios/App/App/public']) if(existsSync(p)) file(p);
    const config=JSON.parse(readFileSync('dist/cloud-config.json'));
    if(config.enabled!==false || config.url!=='' || config.publishableKey!=='') throw Error('Production cloud/ranked activation must remain off');
  }
  if(history) {
    if(git('rev-parse','--is-shallow-repository').toString().trim()!=='false') throw Error('History scan requires full checkout');
    const objects=git('rev-list','--objects','--all').toString().trim().split('\n');
    for(const line of objects) {
      const space=line.indexOf(' '); const id=space<0?line:line.slice(0,space); const path=space<0?'(no path)':line.slice(space+1);
      if(git('cat-file','-t',id).toString().trim()!=='blob') continue;
      blobs++; findings.push(...inspect(git('cat-file','blob',id).toString('utf8'),`history:${id.slice(0,12)}:${path}`));
    }
  }
  return {files,historyBlobs:blobs,findings};
}
if(process.argv[1] && import.meta.url===pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const result=scan({history:process.argv.includes('--history'),artifacts:process.argv.includes('--artifacts')});
    console.log(JSON.stringify(result,null,2));
    if(result.findings.length) process.exitCode=1;
  } catch { console.error('Security scan failed; results are incomplete. No source or credential values are logged.'); process.exitCode=1; }
}
