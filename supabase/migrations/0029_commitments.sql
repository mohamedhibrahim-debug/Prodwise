begin;
create table public.actions(id uuid primary key,workspace_id uuid not null references public.workspaces(id),initiative_id uuid not null references public.initiatives(id),revision integer not null check(revision>0),data jsonb not null,unique(workspace_id,id),check(data->>'id'=id::text and data->>'workspaceId'=workspace_id::text and data->>'initiativeId'=initiative_id::text and (data->>'revision')::integer=revision));
create index actions_initiative on public.actions(workspace_id,initiative_id);
create unique index actions_conversion on public.actions(workspace_id,(data->>'origin'),(data->>'originRefId')) where data->>'origin' in ('WEEKLY_REVIEW','CONFIRMED_AI_PROPOSAL');
create table public.action_events(id uuid primary key,workspace_id uuid not null references public.workspaces(id),initiative_id uuid not null references public.initiatives(id),action_id uuid not null references public.actions(id),seq integer not null,data jsonb not null,request_id uuid not null,input jsonb not null,unique(action_id,seq),unique(workspace_id,request_id));
alter table public.actions enable row level security;alter table public.action_events enable row level security;
revoke all on public.actions,public.action_events from public,anon,authenticated;
grant select,insert,update on public.actions to service_role;grant select,insert on public.action_events to service_role;
create function public.read_commitments(p_workspace_id uuid,p_member_id uuid) returns jsonb language plpgsql set search_path='' as $$
begin perform public.require_workspace_member(p_workspace_id,p_member_id,false,false);return jsonb_build_object('actions',coalesce((select jsonb_agg(data order by id) from public.actions where workspace_id=p_workspace_id),'[]'::jsonb),'events',coalesce((select jsonb_agg(data order by action_id,seq) from public.action_events where workspace_id=p_workspace_id),'[]'::jsonb));end;$$;
create function public.save_commitment(p_workspace_id uuid,p_member_id uuid,p_initiative_id uuid,p_input jsonb) returns uuid language plpgsql set search_path='' as $$
declare actor public.organization_memberships;i public.initiatives;prior public.actions;replay public.action_events;target uuid:=nullif(p_input->>'assigneeMemberId','')::uuid;evidence_key uuid:=nullif(p_input->>'evidenceId','')::uuid;aid uuid:=coalesce(nullif(p_input->>'id','')::uuid,gen_random_uuid());request uuid:=(p_input->>'requestId')::uuid;owner_id uuid;is_admin boolean;details boolean;release boolean;title text:=btrim(p_input->>'title');status text:=p_input->>'status';note text:=coalesce(btrim(p_input->>'note'),'');blocked text:=nullif(btrim(p_input->>'blockedNote'),'');due date:=nullif(p_input->>'dueDate','')::date;at_time timestamptz:=clock_timestamp();after_data jsonb;event_data jsonb;eid uuid:=gen_random_uuid();actor_label text;review_data jsonb;review_section jsonb;origin text:='HUMAN_ENTRY';origin_ref text;origin_href text;
begin
 actor:=public.require_workspace_member(p_workspace_id,p_member_id,false,true);
 select * into i from public.initiatives where id=p_initiative_id and workspace_id=p_workspace_id for update;if not found then raise exception 'INITIATIVE_UNAVAILABLE';end if;if i.archived_at is not null then raise exception 'ARCHIVED';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_workspace_id::text||':commitment:'||request::text,0));
 select * into replay from public.action_events where workspace_id=p_workspace_id and request_id=request;if found then if replay.input<>p_input or replay.data#>>'{actor,id}'<>actor.user_id::text then raise exception 'REQUEST_REUSED';end if;return replay.action_id;end if;
 select * into prior from public.actions where id=aid and workspace_id=p_workspace_id and initiative_id=i.id for update;
 if p_input->>'id' is not null and not found then raise exception 'ACTION_UNAVAILABLE';end if;
 if coalesce(p_input->>'expectedRevision','') !~ '^[0-9]+$' then raise exception 'REVISION_REQUIRED';end if;
 if coalesce(prior.revision,0)<>(p_input->>'expectedRevision')::integer then raise exception 'STALE_ACTION';end if;
 if coalesce(length(title),0) not between 1 and 200 or length(note)>2000 or coalesce(length(blocked),0)>2000 or status is null or status not in ('OPEN','IN_PROGRESS','DONE','CANCELLED') then raise exception 'ACTION_FIELDS';end if;
 if blocked is not null and status not in ('OPEN','IN_PROGRESS') then raise exception 'CLOSED_BLOCKED';end if;
 if (status='CANCELLED' or prior.data->>'status' in ('DONE','CANCELLED') and status in ('OPEN','IN_PROGRESS')) and note='' then raise exception 'REASON_REQUIRED';end if;
 if due is not null and due::text<>p_input->>'dueDate' then raise exception 'DATE_FORMAT';end if;
 if target is not null and not exists(select 1 from public.organization_memberships m join public.users u on u.id=m.user_id where m.id=target and m.organization_id=actor.organization_id and m.active and u.active and m.role<>'VIEWER' and not u.is_system) then raise exception 'ASSIGNEE_INVALID';end if;
 if evidence_key is not null and not exists(select 1 from public.evidence where id=evidence_key and initiative_id=i.id and workspace_id=p_workspace_id) then raise exception 'EVIDENCE_INVALID';end if;
 select owner_member_id into owner_id from public.delivery_facts where workspace_id=p_workspace_id and initiative_id=i.id and kind='OWNER' and data->>'state'='SET';
 is_admin:=public.principal_is_admin(actor.user_id,actor.role) or actor.is_product_lead;
 if prior.id is not null then
  if not coalesce((is_admin or actor.id=owner_id or prior.data->>'createdBy'=actor.user_id::text or prior.data->>'assigneeMemberId'=actor.id::text),false) then raise exception 'ACTION_PERMISSION';end if;
  details:=prior.data->>'title' is distinct from title or prior.data->>'dueDate' is distinct from due::text or prior.data->>'evidenceId' is distinct from evidence_key::text or prior.data->>'assigneeMemberId' is distinct from target::text;
  release:=prior.data->>'assigneeMemberId'=actor.id::text and target is null and prior.data->>'title'=title and (prior.data->>'dueDate') is not distinct from due::text and (prior.data->>'evidenceId') is not distinct from evidence_key::text and note<>'';
  if details and not coalesce((is_admin or actor.id=owner_id or prior.data->>'createdBy'=actor.user_id::text or coalesce(release,false)),false) then raise exception 'ACTION_DETAIL_PERMISSION';end if;
 end if;
 if prior.id is null and p_input->'weekly' is not null and p_input->'weekly'<>'null'::jsonb then
  select data into review_data from public.weekly_reviews where id=(p_input#>>'{weekly,reviewId}')::uuid and workspace_id=p_workspace_id for share;
  select value into review_section from jsonb_array_elements(review_data->'sections') where value->>'initiativeId'=i.id::text;
  if review_data is null or review_data->>'status'<>'DRAFT' or (review_data->>'revision')::integer is distinct from (p_input#>>'{weekly,reviewRevision}')::integer or review_section is null or coalesce(btrim(p_input#>>'{weekly,line}'),'') in ('','Not recorded') or not exists(select 1 from unnest(regexp_split_to_array(review_section->>'nextStep',E'\r?\n')) saved_line where btrim(saved_line)=btrim(p_input#>>'{weekly,line}')) then raise exception 'STALE_WEEKLY_LINE';end if;
  if not coalesce(is_admin or actor.id=owner_id,false) then raise exception 'WEEKLY_CONVERSION_PERMISSION';end if;
  origin:='WEEKLY_REVIEW';origin_ref:=(review_data->>'id')||':'||i.id::text||':'||md5(btrim(p_input#>>'{weekly,line}'));origin_href:='/weekly-review?week='||(review_data->>'week')||'&initiative='||i.slug;
  select id into aid from public.actions where workspace_id=p_workspace_id and data->>'origin'=origin and data->>'originRefId'=origin_ref;if found then return aid;end if;aid:=gen_random_uuid();
 elsif prior.id is null and coalesce(p_input->>'origin','HUMAN_ENTRY')<>'HUMAN_ENTRY' then raise exception 'ORIGIN_CONFIRMATION_REQUIRED';end if;
 select display_name into actor_label from public.users where id=actor.user_id;
 after_data:=jsonb_build_object('id',aid,'workspaceId',p_workspace_id,'initiativeId',i.id,'title',title,'assigneeMemberId',target,'dueDate',due,'status',status,'blockedNote',blocked,'origin',coalesce(prior.data->>'origin',origin),'originRefId',coalesce(prior.data->>'originRefId',origin_ref),'originHref',coalesce(prior.data->>'originHref',origin_href),'evidenceId',evidence_key,'createdBy',coalesce(prior.data->>'createdBy',actor.user_id::text),'createdAt',coalesce(prior.data->>'createdAt',at_time::text),'updatedAt',at_time,'completedAt',case when status='DONE' then coalesce(prior.data->>'completedAt',at_time::text) else null end,'cancelledAt',case when status='CANCELLED' then coalesce(prior.data->>'cancelledAt',at_time::text) else null end,'revision',coalesce(prior.revision,0)+1);
 insert into public.actions(id,workspace_id,initiative_id,revision,data) values(aid,p_workspace_id,i.id,coalesce(prior.revision,0)+1,after_data) on conflict(id) do update set revision=excluded.revision,data=excluded.data;
 event_data:=jsonb_build_object('id',eid,'workspaceId',p_workspace_id,'initiativeId',i.id,'actionId',aid,'seq',coalesce(prior.revision,0)+1,'type',case when prior.id is null then 'CREATED' else 'UPDATED' end,'before',prior.data,'after',after_data,'note',note,'actor',jsonb_build_object('id',actor.user_id,'label',actor_label),'at',at_time,'requestId',request);
 insert into public.action_events(id,workspace_id,initiative_id,action_id,seq,data,request_id,input) values(eid,p_workspace_id,i.id,aid,coalesce(prior.revision,0)+1,event_data,request,p_input);
 insert into public.activity_log(id,workspace_id,initiative_id,actor_id,actor_label,event_type,summary,entity_type,entity_id,payload,occurred_at) values(eid,p_workspace_id,i.id,actor.user_id,actor_label,case when prior.id is null then 'COMMITMENT_CREATED' else 'COMMITMENT_UPDATED' end,'Commitment: '||title||' · '||status,'ACTION',aid,event_data,at_time);
 return aid;
end;$$;
revoke all on function public.read_commitments(uuid,uuid),public.save_commitment(uuid,uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.read_commitments(uuid,uuid),public.save_commitment(uuid,uuid,uuid,jsonb) to service_role;
create trigger archived_action_guard before insert or update or delete on public.actions for each row execute function public.guard_archived_product_write();
commit;
