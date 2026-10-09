begin;
-- Read-time projection: canonical transactions remain the only source of truth.
create function public.project_executive_months(p_data jsonb,p_product text)
returns jsonb language sql immutable set search_path='' as $$
with rows as materialized (
  select left(r.date,7) as month,r.*
  from jsonb_to_recordset(p_data->'rows') as r(product text,date text,kind text,amount bigint,source text,"businessUnit" text,runner text,supplier text,terminal text)
  where r.product=p_product
), months as (
  select month,
    coalesce(sum(amount) filter(where kind<>'REFUND'),0) as gross,
    count(*) filter(where kind<>'REFUND') as count,
    coalesce(sum(amount) filter(where kind='REFUND'),0) as refunds,
    count(*) filter(where kind='REFUND') as "refundCount",
    coalesce(sum(amount) filter(where kind='CASH_IN'),0) as "cashIn",
    count(*) filter(where kind='CASH_IN') as "cashInCount",
    coalesce(sum(amount) filter(where kind='PAYMENT'),0) as payments,
    count(*) filter(where kind='PAYMENT') as "paymentCount",
    count(distinct nullif(runner,'')) filter(where kind<>'REFUND') as runners,
    count(distinct nullif(supplier,'')) filter(where kind<>'REFUND') as suppliers,
    count(distinct nullif(terminal,'')) filter(where kind<>'REFUND') as terminals,
    count(distinct date) filter(where kind<>'REFUND') as days,
    min(date) as "firstDate",max(date) as "lastDate",
    jsonb_agg(distinct source order by source) as sources,
    jsonb_build_array(
      jsonb_build_object('unit','BP','amount',coalesce(sum(amount) filter(where kind<>'REFUND' and "businessUnit"='BP'),0),'count',count(*) filter(where kind<>'REFUND' and "businessUnit"='BP')),
      jsonb_build_object('unit','FS','amount',coalesce(sum(amount) filter(where kind<>'REFUND' and "businessUnit"='FS'),0),'count',count(*) filter(where kind<>'REFUND' and "businessUnit"='FS')),
      jsonb_build_object('unit','UNASSIGNED','amount',coalesce(sum(amount) filter(where kind<>'REFUND' and "businessUnit"='UNASSIGNED'),0),'count',count(*) filter(where kind<>'REFUND' and "businessUnit"='UNASSIGNED'))
    ) as "byUnit"
  from rows group by month
), projected as (
  select m.*,not exists (
    select 1 from jsonb_array_elements_text(m.sources) s(source)
    where not exists (
      select 1 from jsonb_array_elements(p_data->'imports') i
      where i->>'product'=p_product and i->>'source'=s.source and i->>'coverage'='COMPLETE'
        and i->>'periodStart'<=m.month||'-01'
        and i->>'periodEnd'>=to_char((m.month||'-01')::date+interval '1 month - 1 day','YYYY-MM-DD')
    )
  ) as complete from months m
)
select coalesce(jsonb_agg(to_jsonb(p) order by month),'[]'::jsonb) from projected p
$$;
revoke all on function public.project_executive_months(jsonb,text) from public,anon,authenticated;
grant execute on function public.project_executive_months(jsonb,text) to service_role;

create function public.read_executive_view(p_workspace_id uuid,p_organization_id uuid,p_member_id uuid,p_product text)
returns jsonb language plpgsql security definer set search_path='' set statement_timeout='30s' as $$
declare snapshot jsonb;
begin
  perform public.require_workspace_member(p_workspace_id,p_member_id,false,false);
  if p_product is not null and p_product not in ('PGW','WALLET','SALEFNY','CASH_COLLECTION') then raise exception 'INVALID_REPORTING_PRODUCT';end if;
  select data into snapshot from public.executive_workspaces where workspace_id=p_workspace_id and organization_id=p_organization_id;
  if not found then return null;end if;
  return jsonb_build_object('state',(snapshot-'rows')||'{"rows":[]}'::jsonb,
    'series',case when p_product is null then '[]'::jsonb else public.project_executive_months(snapshot,p_product) end);
end $$;
revoke all on function public.read_executive_view(uuid,uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.read_executive_view(uuid,uuid,uuid,text) to service_role;
notify pgrst,'reload schema';
commit;
