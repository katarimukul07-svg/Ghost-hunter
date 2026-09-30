// Read-only hosted evidence via the supported Supabase Management API. Uses an
// account token from the process environment, never a browser JWT/service key.
// Output contains catalog metadata only, never player records or credentials.
const project=process.env.ECHO_SUPABASE_PROJECT_REF;
const token=process.env.SUPABASE_ACCESS_TOKEN;
if(!/^[a-z]{20}$/.test(project||'')||!token)throw Error('Project ref and authorized account token required');
const query=`select jsonb_build_object(
 'tables',(select jsonb_agg(c.relname order by c.relname) from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r'),
 'retired_functions',(select jsonb_agg(jsonb_build_object('signature',p.oid::regprocedure::text,'anon',pg_catalog.has_function_privilege('anon',p.oid,'EXECUTE'),'authenticated',pg_catalog.has_function_privilege('authenticated',p.oid,'EXECUTE'),'service_role',pg_catalog.has_function_privilege('service_role',p.oid,'EXECUTE'))) from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('start_ranked_run','checkpoint_ranked_round','finish_ranked_run','start_ranked_run_v2','checkpoint_ranked_round_v2','finish_ranked_run_v2','get_leaderboard')),
 'migration_ledger',pg_catalog.to_regclass('supabase_migrations.schema_migrations') is not null
) as evidence;`;
try{
 const response=await fetch('https://api.supabase.com/v1/projects/'+project+'/database/query/read-only',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({query}),signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw Error('Hosted inspection denied (HTTP '+response.status+')');
 const rows=await response.json();console.log(JSON.stringify({project,checkedAt:new Date().toISOString(),evidence:rows},null,2));
}catch(e){console.error(e.message.startsWith('Hosted inspection denied')?e.message:'Hosted inspection unavailable');process.exitCode=1;}
