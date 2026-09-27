begin;
create table public.initiative_creation_commands(workspace_id uuid not null references public.workspaces(id),request_id uuid not null,actor_id uuid not null references public.users(id),initiative_id uuid not null references public.initiatives(id),input jsonb not null,created_at timestamptz not null default now(),primary key(workspace_id,request_id));
alter table public.initiative_creation_commands enable row level security;
revoke all on public.initiative_creation_commands from public,anon,authenticated;
grant select,insert on public.initiative_creation_commands to service_role;
create function public.create_managed_initiative(p_workspace_id uuid,p_member_id uuid,p_input jsonb) returns text language plpgsql set search_path='' as $$
declare actor public.organization_memberships;owner_row public.organization_memberships;prior public.initiative_creation_commands;iid uuid:=gen_random_uuid();fid uuid:=gen_random_uuid();cid uuid;eid uuid:=gen_random_uuid();at_time timestamptz:=clock_timestamp();new_slug text;actor_label text;fact jsonb;event jsonb;context_label text:=nullif(btrim(p_input->>'contextLabel'),'');
begin
 actor:=public.require_workspace_member(p_workspace_id,p_member_id,false,true);
 perform pg_advisory_xact_lock(hashtextextended(p_workspace_id::text||':initiative-create',0));
 select * into prior from public.initiative_creation_commands where workspace_id=p_workspace_id and request_id=(p_input->>'requestId')::uuid;
 if found then
  if prior.actor_id<>actor.user_id or prior.input<>p_input then raise exception 'CREATION_REQUEST_REUSED';end if;
  select slug into new_slug from public.initiatives where id=prior.initiative_id and workspace_id=p_workspace_id;return new_slug;
 end if;
 if coalesce(length(btrim(p_input->>'name')),0) not between 1 and 160 or coalesce(length(btrim(p_input->>'description')),0)>4000 or coalesce(length(context_label),0)>160 then raise exception 'CREATE_FIELDS_INVALID';end if;
 if p_input->>'businessLine' is null or p_input->>'businessLine' not in ('MF','BP','FS','ACCEPTANCE','DIGITAL_TRANSFORMATION') or p_input->>'stage' is null or p_input->>'stage' not in ('DISCOVERY','DEFINITION','ALIGNMENT','DELIVERY','VALIDATION','RELEASE_PREPARATION','LIVE_VALIDATION','MONITORING') then raise exception 'CREATE_FIELDS_INVALID';end if;
 select * into owner_row from public.organization_memberships m where m.id=(p_input->>'ownerMemberId')::uuid and m.organization_id=actor.organization_id and m.active and m.role<>'VIEWER' and exists(select 1 from public.users u where u.id=m.user_id and u.active and not u.is_system) for share;
 if not found then raise exception 'OWNER_MEMBER_INVALID';end if;
 if not public.principal_is_admin(actor.user_id,actor.role) and not actor.is_product_lead and actor.id is distinct from owner_row.id then raise exception 'OWNER_SELF_REQUIRED';end if;
 if exists(select 1 from public.initiatives where workspace_id=p_workspace_id and lower(normalize(btrim(name),NFKC))=lower(normalize(btrim(p_input->>'name'),NFKC))) then raise exception 'DUPLICATE_NAME';end if;
 new_slug:=coalesce(nullif(trim(both '-' from left(regexp_replace(lower(p_input->>'name'),'[^a-z0-9]+','-','g'),70)),''),'initiative')||'-'||left(iid::text,8);
 if context_label is not null then cid:=gen_random_uuid();end if;
 insert into public.initiatives(id,workspace_id,slug,name,business_line,stage,description,overall_state,is_demo,created_by,created_at,updated_at,current_context_id)
 values(iid,p_workspace_id,new_slug,btrim(p_input->>'name'),(p_input->>'businessLine')::public.business_line,(p_input->>'stage')::public.initiative_stage,nullif(btrim(p_input->>'description'),''),'UNKNOWN',false,actor.user_id,at_time,at_time,cid);
 if cid is not null then insert into public.initiative_contexts(id,workspace_id,initiative_id,label,created_by,created_at,updated_at) values(cid,p_workspace_id,iid,context_label,actor.user_id,at_time,at_time);end if;
 select display_name into actor_label from public.users where id=actor.user_id;
 fact:=jsonb_build_object('id',fid,'workspaceId',p_workspace_id,'initiativeId',iid,'kind','OWNER','revision',1,'value',jsonb_build_object('memberId',owner_row.id,'date',null,'text',null,'extent',null),'state','SET','basis','DIRECT_KNOWLEDGE','note','Initial owner selected during initiative creation','evidenceId',null,'locator',null,'supportDigest',null,'confirmedByMemberId',actor.id,'confirmedByUserId',actor.user_id,'confirmedByLabel',actor_label,'updatedAt',at_time);
 insert into public.delivery_facts(id,workspace_id,initiative_id,kind,revision,owner_member_id,data) values(fid,p_workspace_id,iid,'OWNER',1,owner_row.id,fact);
 event:=jsonb_build_object('id',eid,'workspaceId',p_workspace_id,'initiativeId',iid,'occurredAt',at_time,'actor',jsonb_build_object('id',actor.user_id,'label',actor_label),'before',null,'after',fact);
 insert into public.activity_log(id,workspace_id,initiative_id,actor_id,actor_label,event_type,summary,entity_type,entity_id,payload,occurred_at) values(eid,p_workspace_id,iid,actor.user_id,actor_label,'DELIVERY_FACT_RECORDED','Initial owner assigned','DELIVERY_FACT',fid,jsonb_build_object('deliveryEvent',event),at_time);
 insert into public.activity_log(workspace_id,initiative_id,actor_id,actor_label,event_type,summary,entity_type,entity_id,payload,occurred_at) values(p_workspace_id,iid,actor.user_id,actor_label,'INITIATIVE_CREATED','Initiative created with a primary owner; setup continues','INITIATIVE',iid,jsonb_build_object('ownerMemberId',owner_row.id,'stage',p_input->>'stage','currentContextId',cid),at_time);
 insert into public.initiative_creation_commands(workspace_id,request_id,actor_id,initiative_id,input) values(p_workspace_id,(p_input->>'requestId')::uuid,actor.user_id,iid,p_input);
 return new_slug;
end;$$;
revoke all on function public.create_managed_initiative(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.create_managed_initiative(uuid,uuid,jsonb) to service_role;
commit;
