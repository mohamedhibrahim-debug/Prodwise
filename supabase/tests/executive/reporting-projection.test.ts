import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { projectPerformance } from '../../../src/lib/executive/projection.ts';
import { emptyExecutiveState, PRODUCTS, type PerformanceImport } from '../../../src/lib/executive/types.ts';

const pg = process.env.PRODWISE_TEST_PG_BIN;
function sql(query: string) {
  if (!pg) throw Error('Isolated test PostgreSQL is required.');
  return execFileSync(join(pg, 'psql.exe'), ['-h','127.0.0.1','-p','55439','-U','postgres','-d','postgres','-X','-A','-t','-v','ON_ERROR_STOP=1'], { input: query, encoding: 'utf8' }).trim();
}
test('database display projection matches canonical TypeScript across products and coverage', { skip: !pg }, () => {
  const state = emptyExecutiveState();
  for (let n=0;n<480;n++) {
    state.rows.push({ key: String(n), product: PRODUCTS[n%4]!, source: n%3 ? 'Primary' : "Secondary's report",
      date: `2026-${String(1+Math.floor(n/80)).padStart(2,'0')}-${String(1+n%27).padStart(2,'0')}`,
      kind: (['PAYMENT','CASH_IN','REFUND'] as const)[n%3]!, amount: n*100+37, currency:'EGP',
      businessUnit: (['BP','FS','UNASSIGNED'] as const)[n%3]!, runner: n%5 ? 'runner-'+n%7 : null,
      supplier: n%7 ? 'supplier-'+n%3 : '', terminal: n%2 ? 'terminal-'+n%9 : null });
  }
  state.rows.push({ ...state.rows[0]!, key:'refund-only',date:'2026-07-31',kind:'REFUND',amount:987 });
  for (const product of PRODUCTS) {
    state.imports.push({ product,source:'Primary',coverage:'COMPLETE',periodStart:'2026-01-01',periodEnd:'2026-03-31' } as PerformanceImport);
    state.imports.push({ product,source:"Secondary's report",coverage:'COMPLETE',periodStart:'2026-02-01',periodEnd:'2026-02-28' } as PerformanceImport);
    state.imports.push({ product,source:"Secondary's report",coverage:'PARTIAL',periodStart:'2026-01-01',periodEnd:'2026-12-31' } as PerformanceImport);
    state.imports.push({ product,source:'Primary',coverage:'COMPLETE',periodStart:'2026-04-02',periodEnd:'2026-05-30' } as PerformanceImport);
  }
  const literal = JSON.stringify(state).replaceAll("'", "''");
  for (const product of PRODUCTS) {
    const actual = JSON.parse(sql(`select public.project_executive_months('${literal}'::jsonb,'${product}');`));
    const expected = projectPerformance(state, product).map(month => ({ ...month, sources: [...month.sources].sort() }));
    assert.deepEqual(actual, expected);
  }
  assert.deepEqual(JSON.parse(sql(`select public.project_executive_months('${JSON.stringify(emptyExecutiveState())}'::jsonb,'PGW');`)), []);
});

test('compact display read preserves permissions, metadata and canonical revision', { skip: !pg }, () => {
  sql(`do $$ declare w uuid:='00000000-0000-0000-0000-000000000002';o uuid:='00000000-0000-0000-0000-000000000001';a uuid:='00000000-0000-0000-0000-000000000003';v jsonb;begin
    if has_function_privilege('anon','public.read_executive_view(uuid,uuid,uuid,text)','EXECUTE') or has_function_privilege('authenticated','public.project_executive_months(jsonb,text)','EXECUTE') then raise exception 'Browser exposure';end if;
    v:=public.read_executive_view(w,o,a,'PGW');
    if v#>'{state,rows}'<>'[]'::jsonb or v#>>'{series,0,count}'<>'150000' or v#>>'{state,revision}'<>'2' then raise exception 'Bad display projection';end if;
    v:=public.read_executive_view(w,o,a,null);
    if v->'series'<>'[]'::jsonb or v#>'{state,plans}'<>'[]'::jsonb then raise exception 'Bad roadmap metadata';end if;
    if public.read_executive_view(w,gen_random_uuid(),a,'PGW') is not null then raise exception 'Organization leak';end if;
    begin perform public.read_executive_view(w,o,gen_random_uuid(),'PGW');raise exception 'Unauthorized';exception when others then if sqlerrm<>'ACCESS_DENIED' then raise;end if;end;
    begin perform public.read_executive_view(w,o,a,'OTHER');raise exception 'Invalid accepted';exception when others then if sqlerrm<>'INVALID_REPORTING_PRODUCT' then raise;end if;end;
    if (select revision from public.executive_workspaces where workspace_id=w)<>2 then raise exception 'Read changed state';end if;
  end $$;`);
});
