begin;
-- Tenant consistency holds even for internal service-role writes.
alter table public.initiatives add constraint initiatives_workspace_identity unique(workspace_id,id);
alter table public.initiative_contexts add constraint context_workspace_initiative foreign key(workspace_id,initiative_id) references public.initiatives(workspace_id,id);
alter table public.source_mappings add constraint mapping_workspace_initiative foreign key(workspace_id,initiative_id) references public.initiatives(workspace_id,id);

create function public.revise_initiative_source(p_workspace_id uuid,p_member_id uuid,p_input jsonb) returns void language plpgsql set search_path='' as $$
declare actor public.organization_memberships; i public.initiatives; previous public.source_mappings; revised public.source_mappings; owner_id uuid; operation text:=p_input->>'action'; reason text:=btrim(p_input->>'reason'); actor_label text;
begin
 actor:=public.require_workspace_member(p_workspace_id,p_member_id,false,true);
 if operation is null or operation not in ('UNLINK','RELINK','ROLE') or reason is null or length(reason) not between 1 and 2000 then raise exception 'SOURCE_CHANGE_INVALID';end if;
 select * into i from public.initiatives where workspace_id=p_workspace_id and id=(p_input->>'initiativeId')::uuid for share;
 if not found then raise exception 'INITIATIVE_ACCESS';end if;
 if i.archived_at is not null then raise exception 'INITIATIVE_ARCHIVED';end if;
 select owner_member_id into owner_id from public.delivery_facts where workspace_id=p_workspace_id and initiative_id=i.id and kind='OWNER' and data->>'state'='SET' for share;
 select * into previous from public.source_mappings where id=(p_input->>'mappingId')::uuid and workspace_id=p_workspace_id and initiative_id=i.id for update;
 if not found then raise exception 'SOURCE_MAPPING_ACCESS';end if;
 if operation='UNLINK' and not public.principal_is_admin(actor.user_id,actor.role) and (actor.id is null or actor.id is distinct from owner_id) and actor.user_id is distinct from previous.linked_by then raise exception 'SOURCE_MAPPING_ACCESS';end if;
 if previous.revision is distinct from (p_input->>'expectedRevision')::integer then raise exception 'STALE_SOURCE_MAPPING';end if;
 if operation='RELINK' and previous.unlinked_at is null then raise exception 'SOURCE_ALREADY_LINKED';end if;
 if operation<>'RELINK' and previous.unlinked_at is not null then raise exception 'SOURCE_ALREADY_UNLINKED';end if;
 if operation='ROLE' and (p_input->>'role' is null or p_input->>'role' not in ('REQUIREMENTS','DELIVERY','DECISIONS','GENERAL')) then raise exception 'SOURCE_ROLE_INVALID';end if;
 update public.source_mappings set revision=revision+1,
 role=case when operation='ROLE' then p_input->>'role' else role end,
 linked_at=case when operation='RELINK' then clock_timestamp() else linked_at end,
 linked_by=case when operation='RELINK' then actor.user_id else linked_by end,
 unlinked_at=case when operation='UNLINK' then clock_timestamp() when operation='RELINK' then null else unlinked_at end,
 unlinked_by=case when operation='UNLINK' then actor.user_id when operation='RELINK' then null else unlinked_by end,
 unlink_reason=case when operation='UNLINK' then reason when operation='RELINK' then null else unlink_reason end
 where id=previous.id returning * into revised;
 select display_name into actor_label from public.users where id=actor.user_id;
 insert into public.activity_log(workspace_id,initiative_id,actor_id,actor_label,event_type,summary,entity_type,entity_id,payload)
 values(p_workspace_id,i.id,actor.user_id,actor_label,'SOURCE_'||operation,case operation when 'UNLINK' then 'Source unlinked; evidence retained' when 'RELINK' then 'Source explicitly relinked' else 'Source role changed' end,'SOURCE_MAPPING',previous.id,jsonb_build_object('before',to_jsonb(previous),'after',to_jsonb(revised),'reason',reason));
end;$$;
revoke all on function public.revise_initiative_source(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.revise_initiative_source(uuid,uuid,jsonb) to service_role;
commit;
