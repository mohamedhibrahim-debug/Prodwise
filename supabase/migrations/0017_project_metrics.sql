-- Additive, read-only project metric records; no business data backfill.
begin;
create table public.metric_definitions (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id),
 workspace_id uuid not null, initiative_id uuid not null,
 name text not null check(length(btrim(name)) between 1 and 160),
 definition text not null check(length(btrim(definition)) between 1 and 2000),
 unit text not null check(length(btrim(unit)) between 1 and 40),
 formula text not null check(length(btrim(formula)) between 1 and 2000),
 source_label text not null, source_evidence_id uuid,
 period_grain text not null, timezone text not null,
 target_value numeric, target_comparator text check(target_comparator in ('AT_MOST','AT_LEAST','EQUAL')),
 target_owner_label text, target_approved_at timestamptz, target_note text,
 origin text not null check(origin in ('SYNTHETIC_DEMO','HUMAN_ENTRY')),
 revision integer not null default 1 check(revision>0),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(id,workspace_id),
 foreign key(workspace_id,organization_id) references public.workspaces(id,organization_id),
 foreign key(initiative_id,workspace_id) references public.initiatives(id,workspace_id),
 foreign key(source_evidence_id,workspace_id) references public.evidence(id,workspace_id),
 check((target_value is null and target_comparator is null and target_approved_at is null)
   or (target_value is not null and target_comparator is not null and target_approved_at is not null and target_owner_label is not null and length(btrim(target_owner_label))>0))
);
create table public.metric_observations (
 id uuid primary key default gen_random_uuid(), metric_id uuid not null, workspace_id uuid not null,
 period_start date not null, period_end date not null, value numeric,
 captured_at timestamptz not null, source_evidence_id uuid, note text not null default '',
 origin text not null check(origin in ('SYNTHETIC_DEMO','HUMAN_ENTRY')),
 unique(metric_id,period_start,period_end),
 foreign key(metric_id,workspace_id) references public.metric_definitions(id,workspace_id),
 foreign key(source_evidence_id,workspace_id) references public.evidence(id,workspace_id),
 check(period_end>=period_start), check(value is not null or length(btrim(note))>0)
);
create function public.metric_scope_guard() returns trigger language plpgsql set search_path='' as $$
declare initiative uuid; scope_origin text; begin
 if TG_TABLE_NAME='metric_definitions' then initiative:=new.initiative_id;scope_origin:=new.origin;
 else select initiative_id,origin into initiative,scope_origin from public.metric_definitions where id=new.metric_id and workspace_id=new.workspace_id;
 if new.origin is distinct from scope_origin then raise exception 'METRIC_ORIGIN_MISMATCH';end if;end if;
 if new.source_evidence_id is not null and not exists(select 1 from public.evidence e where e.id=new.source_evidence_id and e.workspace_id=new.workspace_id and e.initiative_id=initiative) then raise exception 'METRIC_SOURCE_SCOPE';end if;
 if new.origin='SYNTHETIC_DEMO' and not exists(select 1 from public.demo_scenarios where workspace_id=new.workspace_id) then raise exception 'SYNTHETIC_METRIC_SCOPE';end if;
 return new;end;$$;
create trigger metric_definition_scope before insert or update on public.metric_definitions for each row execute function public.metric_scope_guard();
create trigger metric_observation_scope before insert or update on public.metric_observations for each row execute function public.metric_scope_guard();
alter table public.metric_definitions enable row level security;
alter table public.metric_observations enable row level security;
revoke all on public.metric_definitions,public.metric_observations from public,anon,authenticated,service_role;
grant select on public.metric_definitions,public.metric_observations to service_role;
revoke all on function public.metric_scope_guard() from public,anon,authenticated,service_role;
comment on table public.metric_definitions is 'Operator-recorded definitions. Runtime has read-only access through the organization-scoped repository. Synthetic data requires explicit Demo registration.';
comment on column public.metric_observations.value is 'NULL means not observed, never zero or failed.';
commit;
