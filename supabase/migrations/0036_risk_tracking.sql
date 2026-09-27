-- P1-10 Canonical risks: tracking extends a Knowledge RISK claim. The statement
-- stays the claim; tracking never edits it and never moves silently on supersession.
begin;
create table public.risk_tracking(
 id uuid primary key,
 workspace_id uuid not null references public.workspaces(id),
 initiative_id uuid not null,
 claim_id uuid not null unique references public.claims(id),
 status text not null check(status in ('OPEN','MITIGATING','ACCEPTED','CLOSED')),
 revision integer not null check(revision>0),
 data jsonb not null,
 foreign key(initiative_id,workspace_id) references public.initiatives(id,workspace_id),
 check(data->>'id'=id::text and data->>'claimId'=claim_id::text and data->>'initiativeId'=initiative_id::text and data->>'status'=status and (data->>'revision')::integer=revision and coalesce(length(data->>'mitigationText'),0)<=500));
create index risk_tracking_initiative on public.risk_tracking(workspace_id,initiative_id);
create table public.risk_tracking_events(
 id uuid primary key,
 workspace_id uuid not null references public.workspaces(id),
 initiative_id uuid not null,
 tracking_id uuid not null references public.risk_tracking(id),
 seq integer not null,
 data jsonb not null,
 request_id uuid not null,
 input jsonb not null,
 unique(tracking_id,seq),unique(workspace_id,request_id),
 foreign key(initiative_id,workspace_id) references public.initiatives(id,workspace_id));
alter table public.risk_tracking enable row level security;alter table public.risk_tracking_events enable row level security;
revoke all on public.risk_tracking,public.risk_tracking_events from public,anon,authenticated;
grant select,insert,update on public.risk_tracking to service_role;
grant select,insert on public.risk_tracking_events to service_role;
create trigger archived_risk_guard before insert or update or delete on public.risk_tracking for each row execute function public.guard_archived_product_write();
create trigger archived_risk_event_guard before insert or update or delete on public.risk_tracking_events for each row execute function public.guard_archived_product_write();

create function public.read_risk_tracking(p_workspace_id uuid,p_member_id uuid) returns jsonb language plpgsql stable set search_path='' as $$
begin perform public.require_workspace_member(p_workspace_id,p_member_id,false,false);
 return jsonb_build_object('tracking',coalesce((select jsonb_agg(data order by data->>'createdAt',id) from public.risk_tracking where workspace_id=p_workspace_id),'[]'::jsonb),
  'events',coalesce((select jsonb_agg(data order by tracking_id,seq) from public.risk_tracking_events where workspace_id=p_workspace_id),'[]'::jsonb));end$$;

-- Mirrors reviseRisk in src/lib/workspace/risks.ts.
create function public.save_risk_tracking(p_workspace_id uuid,p_member_id uuid,p_initiative_id uuid,p_input jsonb) returns uuid language plpgsql set search_path='' as $$
declare actor public.organization_memberships;actor_label text;i public.initiatives;op text:=p_input->>'operation';request uuid:=(p_input->>'requestId')::uuid;at_time timestamptz:=clock_timestamp();
 replay public.risk_tracking_events;prior public.risk_tracking;source_row public.risk_tracking;c public.claims;old_claim public.claims;owner_id uuid;elevated boolean;next_data jsonb;event_type text;tid uuid;eid uuid:=gen_random_uuid();
 reason text:=btrim(coalesce(p_input->>'reason',''));target uuid;mitigation text;action_id uuid;new_status text;
begin
 actor:=public.require_workspace_member(p_workspace_id,p_member_id,false,true);select display_name into actor_label from public.users where id=actor.user_id;
 select * into i from public.initiatives where id=p_initiative_id and workspace_id=p_workspace_id for update;if not found then raise exception 'INITIATIVE_ACCESS';end if;if i.archived_at is not null then raise exception 'INITIATIVE_ARCHIVED';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_workspace_id::text||':risk:'||request::text,0));
 select * into replay from public.risk_tracking_events where workspace_id=p_workspace_id and request_id=request;if found then if replay.data#>>'{actor,id}'<>actor.user_id::text then raise exception 'REQUEST_REUSED';end if;return replay.tracking_id;end if;
 if op is null or op not in ('START','CARRY','UPDATE','STATUS') or coalesce(p_input->>'expectedRevision','') !~ '^[0-9]+$' or length(reason)>2000 then raise exception 'RISK_FIELDS';end if;
 owner_id:=public.initiative_owner_member(p_workspace_id,i.id);elevated:=public.principal_is_admin(actor.user_id,actor.role) or actor.is_product_lead or owner_id=actor.id;
 if p_input ? 'ownerMemberId' then target:=nullif(p_input->>'ownerMemberId','')::uuid;
  if target is not null and not exists(select 1 from public.organization_memberships m join public.users u on u.id=m.user_id where m.id=target and m.organization_id=actor.organization_id and m.active and u.active and m.role<>'VIEWER' and not u.is_system) then raise exception 'OWNER_INVALID';end if;end if;
 if p_input ? 'mitigationText' then mitigation:=nullif(btrim(p_input->>'mitigationText'),'');if coalesce(length(mitigation),0)>500 then raise exception 'RISK_FIELDS';end if;end if;
 if p_input ? 'mitigationActionId' then action_id:=nullif(p_input->>'mitigationActionId','')::uuid;if action_id is not null and not exists(select 1 from public.actions where id=action_id and workspace_id=p_workspace_id and initiative_id=i.id) then raise exception 'RISK_FIELDS';end if;end if;
 if op in ('START','CARRY') then
  if not coalesce(elevated,false) then raise exception 'RISK_PERMISSION';end if;if (p_input->>'expectedRevision')::integer<>0 then raise exception 'STALE_RISK';end if;
  select * into c from public.claims where id=(p_input->>'claimId')::uuid and workspace_id=p_workspace_id and initiative_id=i.id for share;
  if not found or c.type::text<>'RISK' or c.status::text<>'ACTIVE' then raise exception 'RISK_CLAIM_INVALID';end if;
  select id into tid from public.risk_tracking where claim_id=c.id;if found then return tid;end if;
  if op='CARRY' then
   select * into source_row from public.risk_tracking where id=(p_input->>'id')::uuid and workspace_id=p_workspace_id and initiative_id=i.id;select * into old_claim from public.claims where id=source_row.claim_id;
   if source_row.id is null or old_claim.status::text<>'SUPERSEDED' or old_claim.superseded_by_claim_id is distinct from c.id then raise exception 'RISK_CLAIM_INVALID';end if;
  end if;
  tid:=gen_random_uuid();event_type:=case when op='CARRY' then 'CARRIED' else 'STARTED' end;
  next_data:=jsonb_build_object('id',tid,'workspaceId',p_workspace_id,'initiativeId',i.id,'claimId',c.id,'status',coalesce(source_row.status,'OPEN'),
   'ownerMemberId',case when source_row.id is not null then source_row.data->'ownerMemberId' else to_jsonb(target) end,
   'mitigationText',case when source_row.id is not null then source_row.data->'mitigationText' else to_jsonb(mitigation) end,
   'mitigationActionId',case when source_row.id is not null then source_row.data->'mitigationActionId' else to_jsonb(action_id) end,
   'carriedFromTrackingId',source_row.id,'createdBy',actor.user_id,'createdAt',at_time,'updatedAt',at_time,'resolvedAt',null,'revision',1);
  insert into public.risk_tracking(id,workspace_id,initiative_id,claim_id,status,revision,data) values(tid,p_workspace_id,i.id,c.id,next_data->>'status',1,next_data);
 else
  select * into prior from public.risk_tracking where id=(p_input->>'id')::uuid and workspace_id=p_workspace_id and initiative_id=i.id for update;if not found then raise exception 'RISK_ACCESS';end if;
  if prior.revision<>(p_input->>'expectedRevision')::integer then raise exception 'STALE_RISK';end if;select * into c from public.claims where id=prior.claim_id;tid:=prior.id;
  if op='STATUS' then
   new_status:=p_input->>'status';if new_status is null or new_status not in ('OPEN','MITIGATING','ACCEPTED','CLOSED') then raise exception 'RISK_FIELDS';end if;if new_status=prior.status then raise exception 'NOTHING_CHANGED';end if;
   if not coalesce(elevated or prior.data->>'ownerMemberId'=actor.id::text,false) then raise exception 'RISK_PERMISSION';end if;
   if new_status in ('ACCEPTED','CLOSED') and reason='' then raise exception 'REASON_REQUIRED';end if;
   next_data:=prior.data||jsonb_build_object('status',new_status,'resolvedAt',case when new_status in ('ACCEPTED','CLOSED') then to_jsonb(at_time) else 'null'::jsonb end);event_type:='STATUS';
  else
   if not coalesce(elevated,false) then raise exception 'RISK_PERMISSION';end if;next_data:=prior.data;
   if p_input ? 'ownerMemberId' then next_data:=next_data||jsonb_build_object('ownerMemberId',target);end if;
   if p_input ? 'mitigationText' then next_data:=next_data||jsonb_build_object('mitigationText',mitigation);end if;
   if p_input ? 'mitigationActionId' then next_data:=next_data||jsonb_build_object('mitigationActionId',action_id);end if;
   if next_data=prior.data then raise exception 'NOTHING_CHANGED';end if;event_type:='UPDATED';
  end if;
  next_data:=next_data||jsonb_build_object('updatedAt',at_time,'revision',prior.revision+1);
  update public.risk_tracking set status=next_data->>'status',revision=prior.revision+1,data=next_data where id=prior.id;
 end if;
 insert into public.risk_tracking_events(id,workspace_id,initiative_id,tracking_id,seq,data,request_id,input) values(eid,p_workspace_id,i.id,tid,(next_data->>'revision')::integer,
  jsonb_build_object('id',eid,'workspaceId',p_workspace_id,'initiativeId',i.id,'trackingId',tid,'claimId',next_data->>'claimId','seq',(next_data->>'revision')::integer,'type',event_type,'before',prior.data,'after',next_data,'statement',c.subject||': '||c.value,'note',reason,'actor',jsonb_build_object('id',actor.user_id,'label',actor_label),'at',at_time,'requestId',request),request,p_input);
 insert into public.activity_log(workspace_id,initiative_id,event_type,summary,entity_type,entity_id,actor_label,payload) values(p_workspace_id,i.id,'RISK_'||event_type,'Risk '||lower(event_type)||': '||c.subject||': '||c.value,'RISK',tid,actor_label,jsonb_build_object('trackingId',tid,'claimId',c.id));
 return tid;
end$$;
revoke all on function public.read_risk_tracking(uuid,uuid),public.save_risk_tracking(uuid,uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.read_risk_tracking(uuid,uuid),public.save_risk_tracking(uuid,uuid,uuid,jsonb) to service_role;
commit;
