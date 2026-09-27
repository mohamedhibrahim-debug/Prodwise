-- Second Mission P0-1. Additive schema; apply only to disposable local DB until final approval.
begin;
alter table public.initiatives add column archived_at timestamptz;
alter table public.initiatives add column archived_by uuid references public.users(id);
alter table public.initiatives add column archive_reason text;
alter table public.initiatives add column current_context_id uuid;

create table public.initiative_contexts (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id),
 initiative_id uuid not null references public.initiatives(id), label text not null check(length(btrim(label)) between 1 and 160),
 note text, revision integer not null default 1 check(revision>0),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), retired_at timestamptz,
 created_by uuid not null references public.users(id), unique(initiative_id,id)
);
alter table public.initiatives add constraint initiative_current_context_scope foreign key(id,current_context_id) references public.initiative_contexts(initiative_id,id) deferrable initially deferred;
alter table public.initiative_contexts enable row level security;
revoke all on public.initiative_contexts from public,anon,authenticated;
grant select,insert,update on public.initiative_contexts to service_role;
create index initiative_contexts_scope on public.initiative_contexts(workspace_id,initiative_id);

create function public.update_initiative_basics(p_workspace_id uuid,p_member_id uuid,p_initiative_id uuid,p_expected_updated_at timestamptz,p_name text,p_business_line text,p_description text)
returns void language plpgsql set search_path='' as $$
declare actor public.organization_memberships; previous public.initiatives; actor_label text; owner_id uuid;
begin
 actor:=public.require_workspace_member(p_workspace_id,p_member_id,false,true);
 select * into previous from public.initiatives where id=p_initiative_id and workspace_id=p_workspace_id for update;
 if not found then raise exception 'INITIATIVE_ACCESS';end if;
 if previous.archived_at is not null then raise exception 'INITIATIVE_ARCHIVED';end if;
 select owner_member_id into owner_id from public.delivery_facts where workspace_id=p_workspace_id and initiative_id=p_initiative_id and kind='OWNER' and data->>'state'='SET' for share;
 if not public.principal_is_admin(actor.user_id,actor.role) and (actor.id is null or owner_id is distinct from actor.id) then raise exception 'INITIATIVE_ACCESS';end if;
 if previous.updated_at is distinct from p_expected_updated_at then raise exception 'STALE_INITIATIVE';end if;
 if p_name is null or length(btrim(p_name)) not between 1 and 160 or p_business_line is null or p_business_line not in ('MF','BP','FS','ACCEPTANCE','DIGITAL_TRANSFORMATION') or coalesce(length(p_description),0)>4000 then raise exception 'BASICS_INVALID';end if;
 select display_name into actor_label from public.users where id=actor.user_id;
 update public.initiatives set name=btrim(p_name),business_line=p_business_line::public.business_line,description=nullif(btrim(p_description),'') where id=p_initiative_id;
 insert into public.activity_log(workspace_id,initiative_id,actor_id,actor_label,event_type,summary,entity_type,entity_id,payload)
 values(p_workspace_id,p_initiative_id,actor.user_id,actor_label,'INITIATIVE_BASICS_CHANGED',case when previous.name<>btrim(p_name) then 'Renamed from '||previous.name else 'Initiative purpose and business context updated' end,'INITIATIVE',p_initiative_id,
 jsonb_build_object('before',jsonb_build_object('name',previous.name,'businessLine',previous.business_line,'description',previous.description),'after',jsonb_build_object('name',btrim(p_name),'businessLine',p_business_line,'description',nullif(btrim(p_description),''))));
end;$$;
revoke all on function public.update_initiative_basics(uuid,uuid,uuid,timestamptz,text,text,text) from public,anon,authenticated;
grant execute on function public.update_initiative_basics(uuid,uuid,uuid,timestamptz,text,text,text) to service_role;
commit;
