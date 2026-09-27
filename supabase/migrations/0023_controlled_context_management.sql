begin;
create unique index active_context_label on public.initiative_contexts(workspace_id,initiative_id,lower(normalize(btrim(label),NFKC))) where retired_at is null;
create function public.change_initiative_context(p_workspace_id uuid,p_member_id uuid,p_input jsonb) returns void language plpgsql set search_path='' as $$
declare actor public.organization_memberships;i public.initiatives;previous public.initiative_contexts;revised public.initiative_contexts;owner_id uuid;actor_label text;
 operation text:=p_input->>'operation';reason text:=btrim(p_input->>'reason');context_label text:=btrim(p_input->>'label');context_note text:=nullif(btrim(p_input->>'note'),'');current_id uuid;
begin
 actor:=public.require_workspace_member(p_workspace_id,p_member_id,false,true);
 select * into i from public.initiatives where workspace_id=p_workspace_id and id=(p_input->>'initiativeId')::uuid for update;
 if not found then raise exception 'INITIATIVE_ACCESS';end if;
 if i.archived_at is not null then raise exception 'INITIATIVE_ARCHIVED';end if;
 select owner_member_id into owner_id from public.delivery_facts where workspace_id=p_workspace_id and initiative_id=i.id and kind='OWNER' and data->>'state'='SET' for share;
 if not public.principal_is_admin(actor.user_id,actor.role) and (actor.id is null or actor.id is distinct from owner_id) then raise exception 'INITIATIVE_ACCESS';end if;
 if i.updated_at is distinct from (p_input->>'expectedUpdatedAt')::timestamptz then raise exception 'STALE_INITIATIVE';end if;
 if operation is null or operation not in ('CREATE','SELECT','RENAME','RETIRE') or reason is null or length(reason) not between 1 and 2000 then raise exception 'CONTEXT_CHANGE_INVALID';end if;
 if operation<>'CREATE' then
  select * into previous from public.initiative_contexts where workspace_id=p_workspace_id and initiative_id=i.id and id=(p_input->>'contextId')::uuid for update;
  if not found then raise exception 'CONTEXT_ACCESS';end if;
  if previous.revision is distinct from (p_input->>'expectedRevision')::integer then raise exception 'STALE_CONTEXT';end if;
  if previous.retired_at is not null then raise exception 'CONTEXT_RETIRED';end if;
 end if;
 if operation in ('CREATE','RENAME') and (context_label is null or length(context_label) not between 1 and 160 or coalesce(length(context_note),0)>4000) then raise exception 'CONTEXT_LABEL_INVALID';end if;
 if operation='CREATE' then
  insert into public.initiative_contexts(workspace_id,initiative_id,label,note,created_by) values(p_workspace_id,i.id,context_label,context_note,actor.user_id) returning * into revised;
 elsif operation='RENAME' then
  update public.initiative_contexts set label=context_label,note=context_note,revision=revision+1,updated_at=clock_timestamp() where id=previous.id returning * into revised;
 elsif operation='RETIRE' then
  update public.initiative_contexts set retired_at=clock_timestamp(),updated_at=clock_timestamp(),revision=revision+1 where id=previous.id returning * into revised;
 else revised:=previous;end if;
 current_id:=case when operation in ('CREATE','SELECT') then revised.id when operation='RETIRE' and i.current_context_id=revised.id then null else i.current_context_id end;
 update public.initiatives set current_context_id=current_id,updated_at=clock_timestamp() where id=i.id;
 select display_name into actor_label from public.users where id=actor.user_id;
 insert into public.activity_log(workspace_id,initiative_id,actor_id,actor_label,event_type,summary,entity_type,entity_id,payload)
 values(p_workspace_id,i.id,actor.user_id,actor_label,'CONTEXT_'||operation,case operation when 'RETIRE' then 'Retired scope: ' when 'RENAME' then 'Renamed scope to ' else 'Current scope: ' end||revised.label,'INITIATIVE_CONTEXT',revised.id,jsonb_build_object('before',to_jsonb(previous),'after',to_jsonb(revised),'previousCurrentContextId',i.current_context_id,'currentContextId',current_id,'reason',reason));
end;$$;
revoke all on function public.change_initiative_context(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.change_initiative_context(uuid,uuid,jsonb) to service_role;
commit;
