-- Explicit session-bound context switching. No memberships or roles are granted.
begin;
create function public.list_authorized_contexts(p_actor_id uuid,p_current_workspace_id uuid)
returns jsonb language plpgsql set search_path='' as $$
declare w record; m public.organization_memberships; uid uuid; result jsonb:='[]'::jsonb; begin
 select user_id into uid from public.require_workspace_member(p_current_workspace_id,coalesce((select om.id from public.organization_memberships om join public.workspaces x on x.organization_id=om.organization_id where x.id=p_current_workspace_id and om.user_id=p_actor_id and om.active),p_actor_id),false,false);
 if uid is distinct from p_actor_id then raise exception 'ACCESS_DENIED';end if;
 for w in select ws.id,ws.organization_id,ws.name as workspace_name,o.name as organization_name
 from public.workspaces ws join public.organizations o on o.id=ws.organization_id
 where ws.status='ACTIVE' and o.status='ACTIVE' order by o.name,ws.id loop
   begin
     m:=public.require_workspace_member(w.id,coalesce((select om.id from public.organization_memberships om join public.workspaces x on x.organization_id=om.organization_id where x.id=w.id and om.user_id=p_actor_id and om.active),p_actor_id),false,false);
     result:=result||jsonb_build_array(jsonb_build_object('organizationId',w.organization_id,'workspaceId',w.id,
       'organizationName',w.organization_name,'workspaceName',w.workspace_name,'role',m.role,
       'platformRole',(select platform_role from public.users where id=p_actor_id),'current',w.id=p_current_workspace_id,
       'isDemo',exists(select 1 from public.demo_scenarios where workspace_id=w.id)));
   exception when raise_exception then
     if SQLERRM not in ('ACCESS_DENIED','EMAIL_NOT_ALLOWED','OWNER_BOOTSTRAP_REQUIRED') then raise;end if;
   end;
 end loop;
 return result;end;$$;
create function public.switch_workspace_session(p_token_hash text,p_next_token_hash text,p_expected_workspace_id uuid,p_target_workspace_id uuid,p_actor_id uuid)
returns integer language plpgsql set search_path='' as $$
declare s public.workspace_sessions; a public.organization_memberships; t public.organization_memberships; remaining integer; begin
 select * into s from public.workspace_sessions where token_hash=p_token_hash and expires_at>now() for update;
 if not found or s.user_id is distinct from p_actor_id or s.workspace_id is distinct from p_expected_workspace_id then raise exception 'SESSION_SCOPE_CHANGED';end if;
 if p_next_token_hash=p_token_hash or length(p_next_token_hash)<>64 then raise exception 'SESSION_ROTATION_REQUIRED';end if;
 a:=public.require_workspace_member(s.workspace_id,coalesce((select om.id from public.organization_memberships om join public.workspaces x on x.organization_id=om.organization_id where x.id=s.workspace_id and om.user_id=p_actor_id and om.active),p_actor_id),false,false);
 if a.user_id is distinct from s.user_id then raise exception 'ACCESS_DENIED';end if;
 if not exists(select 1 from public.workspaces w join public.organizations o on o.id=w.organization_id where w.id=p_target_workspace_id and w.status='ACTIVE' and o.status='ACTIVE') then raise exception 'ACCESS_DENIED';end if;
 t:=public.require_workspace_member(p_target_workspace_id,coalesce((select om.id from public.organization_memberships om join public.workspaces x on x.organization_id=om.organization_id where x.id=p_target_workspace_id and om.user_id=p_actor_id and om.active),p_actor_id),false,false);
 if t.user_id is distinct from s.user_id then raise exception 'ACCESS_DENIED';end if;
 insert into public.workspace_sessions(token_hash,workspace_id,organization_id,user_id,auth_user_id,access_token,refresh_token,expires_at)
 values(p_next_token_hash,p_target_workspace_id,t.organization_id,s.user_id,s.auth_user_id,s.access_token,s.refresh_token,s.expires_at);
 delete from public.workspace_sessions where token_hash=p_token_hash;
 insert into public.membership_events(workspace_id,organization_id,actor_id,target_id,action,before_state,after_state)
 values(p_target_workspace_id,t.organization_id,s.user_id,t.organization_id::text,'ORGANIZATION_CONTEXT_SWITCHED',
 jsonb_build_object('workspaceId',s.workspace_id,'organizationId',s.organization_id),
 jsonb_build_object('workspaceId',p_target_workspace_id,'organizationId',t.organization_id));
 remaining:=greatest(1,floor(extract(epoch from (s.expires_at-now())))::integer);
 return remaining;end;$$;
revoke all on function public.list_authorized_contexts(uuid,uuid),public.switch_workspace_session(text,text,uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.list_authorized_contexts(uuid,uuid),public.switch_workspace_session(text,text,uuid,uuid,uuid) to service_role;
commit;
