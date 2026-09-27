-- P1-8 Initiative relationships. Human-confirmed only; "blocks" and dependency
-- impact are derived at read time and never stored.
begin;
create table public.initiative_relationships(
 id uuid primary key,
 workspace_id uuid not null references public.workspaces(id),
 from_initiative_id uuid not null,
 to_initiative_id uuid not null,
 type text not null check(type in ('DEPENDS_ON','PART_OF','RELATED_TO')),
 status text not null check(status in ('ACTIVE','ENDED')),
 revision integer not null check(revision>0),
 data jsonb not null,
 foreign key(from_initiative_id,workspace_id) references public.initiatives(id,workspace_id),
 foreign key(to_initiative_id,workspace_id) references public.initiatives(id,workspace_id),
 check(from_initiative_id<>to_initiative_id),
 check(type<>'RELATED_TO' or from_initiative_id<to_initiative_id),
 check(data->>'id'=id::text and data->>'workspaceId'=workspace_id::text and data->>'fromInitiativeId'=from_initiative_id::text and data->>'toInitiativeId'=to_initiative_id::text and data->>'type'=type and data->>'status'=status and (data->>'revision')::integer=revision and length(btrim(data->>'rationale')) between 1 and 1000));
create unique index initiative_relationships_active on public.initiative_relationships(workspace_id,from_initiative_id,to_initiative_id,type) where status='ACTIVE';
create unique index initiative_relationships_one_parent on public.initiative_relationships(workspace_id,from_initiative_id) where status='ACTIVE' and type='PART_OF';
create index initiative_relationships_to on public.initiative_relationships(workspace_id,to_initiative_id);
create table public.relationship_events(
 id uuid primary key,
 workspace_id uuid not null references public.workspaces(id),
 relationship_id uuid not null references public.initiative_relationships(id),
 seq integer not null,
 data jsonb not null,
 request_id uuid not null,
 input jsonb not null,
 unique(relationship_id,seq),unique(workspace_id,request_id));
alter table public.initiative_relationships enable row level security;alter table public.relationship_events enable row level security;
revoke all on public.initiative_relationships,public.relationship_events from public,anon,authenticated;
grant select,insert,update on public.initiative_relationships to service_role;
grant select,insert on public.relationship_events to service_role;

-- A relationship recorded from an archived initiative cannot change.
create function public.guard_archived_relationship() returns trigger language plpgsql set search_path='' as $$
begin if exists(select 1 from public.initiatives where id=coalesce(new.from_initiative_id,old.from_initiative_id) and archived_at is not null) then raise exception 'INITIATIVE_ARCHIVED';end if;
 if tg_op='DELETE' then return old;end if;return new;end$$;
create trigger archived_relationship_guard before insert or update or delete on public.initiative_relationships for each row execute function public.guard_archived_relationship();

create function public.read_relationships(p_workspace_id uuid,p_member_id uuid) returns jsonb language plpgsql stable set search_path='' as $$
begin perform public.require_workspace_member(p_workspace_id,p_member_id,false,false);
 return jsonb_build_object('relationships',coalesce((select jsonb_agg(data order by data->>'confirmedAt',id) from public.initiative_relationships where workspace_id=p_workspace_id),'[]'::jsonb),
  'events',coalesce((select jsonb_agg(e.data order by e.relationship_id,e.seq) from public.relationship_events e where e.workspace_id=p_workspace_id),'[]'::jsonb));end$$;

-- Mirrors reviseRelationship in src/lib/workspace/relationships.ts.
create function public.save_relationship(p_workspace_id uuid,p_member_id uuid,p_input jsonb) returns uuid language plpgsql set search_path='' as $$
declare actor public.organization_memberships;actor_label text;op text:=p_input->>'operation';request uuid:=(p_input->>'requestId')::uuid;at_time timestamptz:=clock_timestamp();
 replay public.relationship_events;prior public.initiative_relationships;f public.initiatives;t public.initiatives;rtype text;from_id uuid;to_id uuid;swap uuid;rationale text;provider text;needed text;reason text:=btrim(coalesce(p_input->>'reason',''));
 next_data jsonb;event_type text;rid uuid;eid uuid:=gen_random_uuid();p public.evidence_proposals;s public.evidence_submissions;a public.evidence_anchors;receipt public.evidence_confirmations;owner_id uuid;
begin
 actor:=public.require_workspace_member(p_workspace_id,p_member_id,false,true);select display_name into actor_label from public.users where id=actor.user_id;
 perform pg_advisory_xact_lock(hashtextextended(p_workspace_id::text||':relationships',0));
 select * into replay from public.relationship_events where workspace_id=p_workspace_id and request_id=request;
 if found then if replay.data#>>'{actor,id}'<>actor.user_id::text then raise exception 'REQUEST_REUSED';end if;return replay.relationship_id;end if;
 if op is null or op not in ('CREATE','UPDATE','END') or coalesce(p_input->>'expectedRevision','') !~ '^[0-9]+$' then raise exception 'RELATIONSHIP_FIELDS';end if;
 provider:=nullif(p_input->>'providerFactKind','');needed:=nullif(p_input->>'neededByFactKind','');
 if coalesce(provider,'TARGET_LIVE') not in ('TARGET_LIVE','NEXT_MILESTONE') or coalesce(needed,'TARGET_LIVE') not in ('TARGET_LIVE','NEXT_MILESTONE') or (provider is null)<>(needed is null) then raise exception 'RELATIONSHIP_FIELDS';end if;
 if op='CREATE' then
  if (p_input->>'expectedRevision')::integer<>0 then raise exception 'STALE_RELATIONSHIP';end if;
  if p_input->>'proposalId' is not null then
   select * into p from public.evidence_proposals where id=(p_input->>'proposalId')::uuid and workspace_id=p_workspace_id for update;
   if not found or p.data->>'type'<>'RELATIONSHIP' then raise exception 'PROPOSAL_ACCESS';end if;
   select * into receipt from public.evidence_confirmations where proposal_id=p.id;if found then if receipt.data->>'requestId'<>p_input->>'requestId' then raise exception 'PROPOSAL_HANDLED';end if;return (receipt.data->>'resultId')::uuid;end if;
   if p.data->>'status'<>'PENDING' or (p.data->>'version')::integer is distinct from (p_input->>'proposalVersion')::integer then raise exception 'STALE_PROPOSAL';end if;
   select * into s from public.evidence_submissions where id=p.submission_id;select * into a from public.evidence_anchors where id=p.anchor_id;
   if public.evidence_utf16_slice(s.data->>'text',(a.data->>'start')::integer,(a.data->>'end')::integer) is distinct from a.data->>'quote' then raise exception 'ANCHOR_INVALID';end if;
   from_id:=p.initiative_id;to_id:=(p.data#>>'{payload,targetInitiativeId}')::uuid;
  else from_id:=(p_input->>'fromInitiativeId')::uuid;to_id:=(p_input->>'toInitiativeId')::uuid;end if;
  rtype:=p_input->>'type';if rtype is null or rtype not in ('DEPENDS_ON','PART_OF','RELATED_TO') then raise exception 'RELATIONSHIP_FIELDS';end if;
  if rtype<>'DEPENDS_ON' and provider is not null then raise exception 'RELATIONSHIP_FIELDS';end if;
  select * into f from public.initiatives where id=from_id and workspace_id=p_workspace_id;if not found then raise exception 'INITIATIVE_ACCESS';end if;
  select * into t from public.initiatives where id=to_id and workspace_id=p_workspace_id;if not found then raise exception 'INITIATIVE_ACCESS';end if;
  if f.id=t.id then raise exception 'RELATIONSHIP_SELF';end if;if f.archived_at is not null then raise exception 'INITIATIVE_ARCHIVED';end if;if t.archived_at is not null then raise exception 'RELATIONSHIP_TARGET_ARCHIVED';end if;
  owner_id:=public.initiative_owner_member(p_workspace_id,f.id);
  if not coalesce(public.principal_is_admin(actor.user_id,actor.role) or actor.is_product_lead or owner_id=actor.id,false) then raise exception 'RELATIONSHIP_PERMISSION';end if;
  rationale:=btrim(p_input->>'rationale');if coalesce(length(rationale),0) not between 1 and 1000 then raise exception 'RELATIONSHIP_FIELDS';end if;
  if rtype='RELATED_TO' and from_id>to_id then swap:=from_id;from_id:=to_id;to_id:=swap;end if;
  if exists(select 1 from public.initiative_relationships where workspace_id=p_workspace_id and status='ACTIVE' and type=rtype and from_initiative_id=from_id and to_initiative_id=to_id) then raise exception 'RELATIONSHIP_DUPLICATE';end if;
  if rtype='PART_OF' and exists(select 1 from public.initiative_relationships where workspace_id=p_workspace_id and status='ACTIVE' and type='PART_OF' and from_initiative_id=from_id) then raise exception 'RELATIONSHIP_PARENT';end if;
  if rtype in ('PART_OF','DEPENDS_ON') and exists(with recursive walk(node) as (select to_id union select r.to_initiative_id from public.initiative_relationships r join walk on r.from_initiative_id=walk.node where r.workspace_id=p_workspace_id and r.status='ACTIVE' and r.type=rtype) select 1 from walk where node=from_id) then raise exception 'RELATIONSHIP_CYCLE';end if;
  rid:=gen_random_uuid();event_type:='CONFIRMED';
  next_data:=jsonb_build_object('id',rid,'workspaceId',p_workspace_id,'fromInitiativeId',from_id,'toInitiativeId',to_id,'type',rtype,'rationale',rationale,'providerFactKind',provider,'neededByFactKind',needed,
   'evidenceId',case when p.id is null then null else s.data->>'evidenceId' end,'evidenceAnchorId',case when p.id is null then null else a.id::text end,'originProposalId',p.id,'originHref',case when p.id is null then null else '/initiatives/'||f.slug||'/evidence/'||s.id::text||'#proposal-'||p.id::text end,
   'status','ACTIVE','createdBy',actor.user_id,'confirmedBy',actor.user_id,'confirmedByLabel',actor_label,'confirmedAt',at_time,'endedBy',null,'endedByLabel',null,'endedAt',null,'endReason',null,'updatedAt',at_time,'revision',1);
  insert into public.initiative_relationships(id,workspace_id,from_initiative_id,to_initiative_id,type,status,revision,data) values(rid,p_workspace_id,from_id,to_id,rtype,'ACTIVE',1,next_data);
  if p.id is not null then
   update public.evidence_proposals set data=data||jsonb_build_object('status','CONFIRMED','version',(data->>'version')::integer+1,'decidedBy',actor.user_id,'decidedAt',at_time,'reason',rationale,'resultType','RELATIONSHIP','resultId',rid) where id=p.id;
   insert into public.evidence_confirmations values(p.id,p_workspace_id,p.initiative_id,jsonb_build_object('proposalId',p.id,'workspaceId',p_workspace_id,'initiativeId',p.initiative_id,'proposalVersion',(p.data->>'version')::integer,'actorId',actor.user_id,'actorLabel',actor_label,'at',at_time,'resultType','RELATIONSHIP','resultId',rid,'requestId',p_input->>'requestId'));
  end if;
 else
  select * into prior from public.initiative_relationships where id=(p_input->>'id')::uuid and workspace_id=p_workspace_id for update;if not found then raise exception 'RELATIONSHIP_ACCESS';end if;
  if prior.revision<>(p_input->>'expectedRevision')::integer then raise exception 'STALE_RELATIONSHIP';end if;if prior.status<>'ACTIVE' then raise exception 'RELATIONSHIP_ENDED';end if;
  select * into f from public.initiatives where id=prior.from_initiative_id;if f.archived_at is not null then raise exception 'INITIATIVE_ARCHIVED';end if;
  owner_id:=public.initiative_owner_member(p_workspace_id,f.id);
  if not coalesce(public.principal_is_admin(actor.user_id,actor.role) or actor.is_product_lead or owner_id=actor.id,false) then raise exception 'RELATIONSHIP_PERMISSION';end if;
  rid:=prior.id;
  if op='END' then if reason='' or length(reason)>1000 then raise exception 'REASON_REQUIRED';end if;
   next_data:=prior.data||jsonb_build_object('status','ENDED','endedBy',actor.user_id,'endedByLabel',actor_label,'endedAt',at_time,'endReason',reason);event_type:='ENDED';
  else
   rationale:=btrim(coalesce(p_input->>'rationale',prior.data->>'rationale'));if coalesce(length(rationale),0) not between 1 and 1000 then raise exception 'RELATIONSHIP_FIELDS';end if;
   if not (p_input ? 'providerFactKind') then provider:=prior.data->>'providerFactKind';needed:=prior.data->>'neededByFactKind';end if;
   if prior.type<>'DEPENDS_ON' and provider is not null then raise exception 'RELATIONSHIP_FIELDS';end if;
   next_data:=prior.data||jsonb_build_object('rationale',rationale,'providerFactKind',provider,'neededByFactKind',needed);if next_data=prior.data then raise exception 'NOTHING_CHANGED';end if;event_type:='UPDATED';
  end if;
  next_data:=next_data||jsonb_build_object('updatedAt',at_time,'revision',prior.revision+1);
  update public.initiative_relationships set status=next_data->>'status',revision=prior.revision+1,data=next_data where id=prior.id;
  from_id:=prior.from_initiative_id;to_id:=prior.to_initiative_id;rtype:=prior.type;
 end if;
 insert into public.relationship_events(id,workspace_id,relationship_id,seq,data,request_id,input) values(eid,p_workspace_id,rid,(next_data->>'revision')::integer,
  jsonb_build_object('id',eid,'workspaceId',p_workspace_id,'relationshipId',rid,'fromInitiativeId',from_id,'toInitiativeId',to_id,'seq',(next_data->>'revision')::integer,'type',event_type,'before',prior.data,'after',next_data,'note',reason,'actor',jsonb_build_object('id',actor.user_id,'label',actor_label),'at',at_time,'requestId',request),request,p_input);
 insert into public.activity_log(workspace_id,initiative_id,event_type,summary,entity_type,entity_id,actor_label,payload)
  select p_workspace_id,x,'RELATIONSHIP_'||event_type,(select name from public.initiatives where id=from_id)||' '||case rtype when 'DEPENDS_ON' then 'depends on' when 'PART_OF' then 'is part of' else 'is related to' end||' '||(select name from public.initiatives where id=to_id)||' · '||lower(event_type),'RELATIONSHIP',rid,actor_label,jsonb_build_object('relationshipId',rid,'note',reason)
  from unnest(array[from_id,to_id]) x;
 return rid;
end$$;
revoke all on function public.read_relationships(uuid,uuid),public.save_relationship(uuid,uuid,jsonb),public.guard_archived_relationship() from public,anon,authenticated;
grant execute on function public.read_relationships(uuid,uuid),public.save_relationship(uuid,uuid,jsonb) to service_role;
commit;
