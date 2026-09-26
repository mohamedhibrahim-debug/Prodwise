-- Additive local candidate. No business rows, IDs, review snapshots or history
-- are rewritten. Repeated demo generations retain their historical records.
begin;

-- Read-only diagnostics before adding constraints. No repair or deletion is
-- attempted; the operator must investigate any inconsistent existing rows.
do $$ declare bad_facts bigint; begin
 select count(*) into bad_facts from public.delivery_facts f
 left join public.initiatives i on i.id=f.initiative_id and i.workspace_id=f.workspace_id
 where i.id is null;
 raise notice '0013 read-only preflight: initiatives=%, delivery_facts=%, weekly_reviews=%, cross-workspace facts=%',
  (select count(*) from public.initiatives),(select count(*) from public.delivery_facts),
  (select count(*) from public.weekly_reviews),bad_facts;
 if bad_facts<>0 then raise exception 'DELIVERY_WORKSPACE_BOUNDARY_INVALID: % existing facts; no rows changed',bad_facts;end if;
end $$;

-- A route slug identifies an initiative within the server-selected workspace.
-- Separate organizations/demo generations may use the same synthetic story.
do $$
declare slug_column smallint; old_unique record;
begin
 select attnum into strict slug_column from pg_attribute
 where attrelid='public.initiatives'::regclass and attname='slug' and not attisdropped;
 for old_unique in select conname from pg_constraint
  where conrelid='public.initiatives'::regclass and contype='u' and conkey=array[slug_column]
 loop execute format('alter table public.initiatives drop constraint %I',old_unique.conname); end loop;
end $$;
alter table public.initiatives add constraint initiatives_workspace_slug_key unique(workspace_id,slug);
comment on column public.initiatives.slug is
 'Stable route identifier within the server-selected workspace. May repeat across isolated organizations or demo generations; UUID remains the global identity.';

-- Independent parent FKs alone permit a fact to name a foreign initiative.
-- Existing RPC scope checks remain mandatory; this constraint also protects
-- service-side inserts. Preexisting cross-workspace rows fail closed.
alter table public.delivery_facts add constraint delivery_facts_initiative_workspace
 foreign key(initiative_id,workspace_id) references public.initiatives(id,workspace_id);

-- Only trusted operator registration pins a synthetic scenario. Authorization
-- and scenario identity never depend on organization name or account email.
alter table public.workspaces add constraint workspaces_organization_key unique(id,organization_id);
create table public.demo_scenarios(
 workspace_id uuid primary key references public.workspaces(id),
 organization_id uuid not null references public.organizations(id),
 canonical_version text not null check(length(btrim(canonical_version)) between 1 and 120),
 scenario_at timestamptz not null,
 registered_at timestamptz not null default now(),
 constraint demo_scenarios_workspace_organization foreign key(workspace_id,organization_id)
  references public.workspaces(id,organization_id)
);
alter table public.demo_scenarios enable row level security;
revoke all on public.demo_scenarios from public,anon,authenticated,service_role;
grant select on public.demo_scenarios to service_role;
comment on table public.demo_scenarios is
 'Trusted operator pins an explicit synthetic scenario workspace generation and cutoff. Existing generation history remains immutable; reset registers a new workspace rather than deleting old records.';

commit;
