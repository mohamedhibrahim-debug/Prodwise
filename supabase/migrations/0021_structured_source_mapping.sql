-- Structured manual sources. No connectors or network operations.
begin;
create table public.source_containers(
 id uuid primary key default gen_random_uuid(),workspace_id uuid not null references public.workspaces(id),
 provider text not null check(provider in ('JIRA','DOCUMENT','EMAIL','MEETING_NOTES','PASTED_EVIDENCE','OTHER_URL')),
 provider_workspace text not null,reference text not null,name text not null,
 created_by uuid not null references public.users(id),created_at timestamptz not null default now(),
 unique(workspace_id,id),check(length(btrim(reference)) between 1 and 300),check(length(btrim(provider_workspace)) between 1 and 300),check(length(btrim(name)) between 1 and 200)
);
create unique index source_container_identity on public.source_containers(workspace_id,provider,lower(normalize(btrim(provider_workspace),NFKC)),lower(normalize(btrim(reference),NFKC)));
create table public.source_items(
 id uuid primary key default gen_random_uuid(),workspace_id uuid not null references public.workspaces(id),container_id uuid not null,
 reference text not null,name text not null,kind text not null,url text,created_by uuid not null references public.users(id),created_at timestamptz not null default now(),
 foreign key(workspace_id,container_id) references public.source_containers(workspace_id,id),unique(workspace_id,id),
 check(length(btrim(reference)) between 1 and 500),check(length(btrim(name)) between 1 and 200),check(length(btrim(kind)) between 1 and 50)
);
create unique index source_item_identity on public.source_items(workspace_id,container_id,lower(normalize(btrim(reference),NFKC)));
create table public.source_mappings(
 id uuid primary key default gen_random_uuid(),workspace_id uuid not null references public.workspaces(id),initiative_id uuid not null references public.initiatives(id),item_id uuid not null,
 role text not null check(role in ('REQUIREMENTS','DELIVERY','DECISIONS','GENERAL')),revision integer not null default 1 check(revision>0),
 linked_by uuid not null references public.users(id),linked_at timestamptz not null default now(),unlinked_by uuid references public.users(id),unlinked_at timestamptz,unlink_reason text,
 foreign key(workspace_id,item_id) references public.source_items(workspace_id,id),unique(workspace_id,initiative_id,item_id),
 check((unlinked_at is null and unlinked_by is null and unlink_reason is null) or (unlinked_at is not null and unlinked_by is not null and length(btrim(unlink_reason))>0))
);
alter table public.source_containers enable row level security;
alter table public.source_items enable row level security;
alter table public.source_mappings enable row level security;
revoke all on public.source_containers,public.source_items,public.source_mappings from public,anon,authenticated;
grant select,insert,update on public.source_containers,public.source_items,public.source_mappings to service_role;
create index source_mapping_initiative on public.source_mappings(workspace_id,initiative_id);

create function public.read_initiative_management(p_workspace_id uuid,p_member_id uuid) returns jsonb language plpgsql stable set search_path='' as $$
begin
 perform public.require_workspace_member(p_workspace_id,p_member_id,false,false);
 return jsonb_build_object('contexts',coalesce((select jsonb_agg(to_jsonb(c) order by c.created_at) from public.initiative_contexts c where workspace_id=p_workspace_id),'[]'::jsonb),
 'containers',coalesce((select jsonb_agg(to_jsonb(c) order by c.created_at) from public.source_containers c where workspace_id=p_workspace_id),'[]'::jsonb),
 'items',coalesce((select jsonb_agg(to_jsonb(c) order by c.created_at) from public.source_items c where workspace_id=p_workspace_id),'[]'::jsonb),
 'mappings',coalesce((select jsonb_agg(to_jsonb(c) order by c.linked_at) from public.source_mappings c where workspace_id=p_workspace_id),'[]'::jsonb));
end;$$;

create function public.map_initiative_sources(p_workspace_id uuid,p_member_id uuid,p_input jsonb) returns void language plpgsql set search_path='' as $$
declare actor public.organization_memberships;i public.initiatives;c public.source_containers;item public.source_items;mapping public.source_mappings;entry jsonb;actor_label text;
begin
 actor:=public.require_workspace_member(p_workspace_id,p_member_id,false,true);
 -- Serializes reference reuse and mapping creation within this workspace.
 perform pg_advisory_xact_lock(hashtextextended(p_workspace_id::text||':source-mapping',0));
 select * into i from public.initiatives where id=(p_input->>'initiativeId')::uuid and workspace_id=p_workspace_id for share;
 if not found then raise exception 'INITIATIVE_ACCESS';end if;
 if i.archived_at is not null then raise exception 'INITIATIVE_ARCHIVED';end if;
 if jsonb_typeof(p_input->'items') is distinct from 'array' or jsonb_array_length(p_input->'items') not between 1 and 25 then raise exception 'SOURCE_ITEMS_INVALID';end if;
 if p_input->>'role' is null or p_input->>'role' not in ('REQUIREMENTS','DELIVERY','DECISIONS','GENERAL') then raise exception 'SOURCE_ROLE_INVALID';end if;
 select display_name into actor_label from public.users where id=actor.user_id;
 select * into c from public.source_containers where workspace_id=p_workspace_id and provider=p_input->>'provider'
 and lower(normalize(btrim(provider_workspace),NFKC))=lower(normalize(btrim(p_input->>'providerWorkspace'),NFKC))
 and lower(normalize(btrim(reference),NFKC))=lower(normalize(btrim(p_input->>'containerReference'),NFKC));
 if not found then
 insert into public.source_containers(workspace_id,provider,provider_workspace,reference,name,created_by) values(p_workspace_id,p_input->>'provider',btrim(p_input->>'providerWorkspace'),btrim(p_input->>'containerReference'),btrim(p_input->>'containerName'),actor.user_id) returning * into c;
 end if;
 for entry in select value from jsonb_array_elements(p_input->'items') loop
  if c.provider='JIRA' and (c.reference !~ '^[A-Za-z][A-Za-z0-9_]*$' or entry->>'reference' !~* ('^'||c.reference||'-[1-9][0-9]*$')) then raise exception 'JIRA_REFERENCE_FORMAT';end if;
  if nullif(entry->>'url','') is not null and (entry->>'url' !~ '^https?://' or entry->>'url' ~ '^https?://[^/]*@') then raise exception 'SOURCE_URL_INVALID';end if;
  select * into item from public.source_items where workspace_id=p_workspace_id and container_id=c.id and lower(normalize(btrim(reference),NFKC))=lower(normalize(btrim(entry->>'reference'),NFKC));
  if not found then
   insert into public.source_items(workspace_id,container_id,reference,name,kind,url,created_by) values(p_workspace_id,c.id,btrim(entry->>'reference'),btrim(entry->>'name'),btrim(entry->>'kind'),nullif(btrim(entry->>'url'),''),actor.user_id) returning * into item;
  end if;
  select * into mapping from public.source_mappings where workspace_id=p_workspace_id and initiative_id=i.id and item_id=item.id;
  if found then if mapping.unlinked_at is not null then raise exception 'EXPLICIT_RELINK_REQUIRED';end if;continue;end if;
  insert into public.source_mappings(workspace_id,initiative_id,item_id,role,linked_by) values(p_workspace_id,i.id,item.id,p_input->>'role',actor.user_id) returning * into mapping;
  insert into public.activity_log(workspace_id,initiative_id,actor_id,actor_label,event_type,summary,entity_type,entity_id,payload)
  values(p_workspace_id,i.id,actor.user_id,actor_label,'SOURCE_MAPPED','Source item mapped to initiative','SOURCE_MAPPING',mapping.id,jsonb_build_object('before',null,'after',to_jsonb(mapping)));
 end loop;
end;$$;
revoke all on function public.read_initiative_management(uuid,uuid),public.map_initiative_sources(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.read_initiative_management(uuid,uuid),public.map_initiative_sources(uuid,uuid,jsonb) to service_role;
commit;
