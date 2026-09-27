-- Canonical stage changes are guarded and audited in one transaction.
begin;
create function public.update_initiative_stage(p_workspace_id uuid,p_member_id uuid,p_initiative_id uuid,p_stage public.initiative_stage,p_expected_updated_at timestamptz,p_reason text)
returns void language plpgsql set search_path='' as $$
declare actor public.organization_memberships; previous public.initiatives; label text; begin
 actor:=public.require_workspace_member(p_workspace_id,p_member_id,false,true);
 select * into previous from public.initiatives where id=p_initiative_id and workspace_id=p_workspace_id for update;
 if not found then raise exception 'INITIATIVE_ACCESS';end if;
 if not public.principal_is_admin(actor.user_id,actor.role) and not exists(
   select 1 from public.delivery_facts where workspace_id=p_workspace_id and initiative_id=p_initiative_id
   and kind='OWNER' and data->>'state'='SET' and owner_member_id=actor.id
 ) then raise exception 'STAGE_ACCESS';end if;
 if p_stage is null or length(btrim(p_reason)) not between 1 and 2000 or p_reason is null then raise exception 'STAGE_INPUT_INVALID';end if;
 if previous.updated_at is distinct from p_expected_updated_at then raise exception 'STALE_INITIATIVE';end if;
 if previous.stage=p_stage then return;end if;
 select display_name into label from public.users where id=actor.user_id;
 update public.initiatives set stage=p_stage where id=p_initiative_id and workspace_id=p_workspace_id;
 insert into public.activity_log(workspace_id,initiative_id,actor_id,actor_label,event_type,summary,entity_type,entity_id,payload)
 values(p_workspace_id,p_initiative_id,actor.user_id,label,'STAGE_CHANGED','Lifecycle stage changed','INITIATIVE',p_initiative_id,
 jsonb_build_object('before',previous.stage,'after',p_stage,'reason',btrim(p_reason),'actor',jsonb_build_object('id',actor.user_id,'label',label)));
 end;$$;
revoke all on function public.update_initiative_stage(uuid,uuid,uuid,public.initiative_stage,timestamptz,text) from public,anon,authenticated;
grant execute on function public.update_initiative_stage(uuid,uuid,uuid,public.initiative_stage,timestamptz,text) to service_role;
commit;
