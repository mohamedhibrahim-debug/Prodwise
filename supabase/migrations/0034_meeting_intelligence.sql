-- P1-7 Meeting Intelligence and the canonical Open Question store it confirms into.
-- A meeting is saved evidence (kind MEETING_NOTES) plus one metadata row. There is
-- no meeting-summary store: confirmed items land in existing canonical domains.
begin;

create table public.meeting_notes(
 submission_id uuid primary key references public.evidence_submissions(id),
 workspace_id uuid not null references public.workspaces(id),
 initiative_id uuid not null,
 revision integer not null check(revision>0),
 data jsonb not null,
 foreign key(initiative_id,workspace_id) references public.initiatives(id,workspace_id),
 check(data->>'submissionId'=submission_id::text and data->>'initiativeId'=initiative_id::text and (data->>'revision')::integer=revision and length(data->>'title') between 1 and 160 and (data->>'meetingDate') ~ '^\d{4}-\d{2}-\d{2}$'));

-- Open questions: unresolved tracked items, never Product Truth.
create table public.open_questions(
 id uuid primary key,
 workspace_id uuid not null references public.workspaces(id),
 initiative_id uuid not null,
 revision integer not null check(revision>0),
 data jsonb not null,
 foreign key(initiative_id,workspace_id) references public.initiatives(id,workspace_id),
 check(data->>'id'=id::text and data->>'workspaceId'=workspace_id::text and data->>'initiativeId'=initiative_id::text and (data->>'revision')::integer=revision and data->>'status' in ('OPEN','ANSWERED','WITHDRAWN') and length(data->>'question') between 1 and 300));
create index open_questions_initiative on public.open_questions(workspace_id,initiative_id);
create unique index open_questions_origin on public.open_questions(workspace_id,(data->>'origin'),(data->>'originRefId')) where data->>'origin'<>'HUMAN_ENTRY';
create table public.question_events(
 id uuid primary key,
 workspace_id uuid not null references public.workspaces(id),
 initiative_id uuid not null,
 question_id uuid not null references public.open_questions(id),
 seq integer not null,
 data jsonb not null,
 request_id uuid not null,
 input jsonb not null,
 unique(question_id,seq),unique(workspace_id,request_id),
 foreign key(initiative_id,workspace_id) references public.initiatives(id,workspace_id));

alter table public.meeting_notes enable row level security;alter table public.open_questions enable row level security;alter table public.question_events enable row level security;
revoke all on public.meeting_notes,public.open_questions,public.question_events from public,anon,authenticated;
grant select,insert,update on public.meeting_notes,public.open_questions to service_role;
-- History is append-only at the role level.
grant select,insert on public.question_events to service_role;
create trigger archived_meeting_guard before insert or update or delete on public.meeting_notes for each row execute function public.guard_archived_product_write();
create trigger archived_question_guard before insert or update or delete on public.open_questions for each row execute function public.guard_archived_product_write();
create trigger archived_question_event_guard before insert or update or delete on public.question_events for each row execute function public.guard_archived_product_write();

create function public.initiative_owner_member(p_workspace_id uuid,p_initiative_id uuid) returns uuid language sql stable set search_path='' as $$
 select nullif(data#>>'{value,memberId}','')::uuid from public.delivery_facts where workspace_id=p_workspace_id and initiative_id=p_initiative_id and kind='OWNER' and data->>'state'='SET' limit 1$$;

create function public.read_open_questions(p_workspace_id uuid,p_member_id uuid) returns jsonb language plpgsql stable set search_path='' as $$
begin perform public.require_workspace_member(p_workspace_id,p_member_id,false,false);
 return jsonb_build_object('questions',coalesce((select jsonb_agg(data order by data->>'createdAt',id) from public.open_questions where workspace_id=p_workspace_id),'[]'::jsonb),
  'events',coalesce((select jsonb_agg(data order by question_id,seq) from public.question_events where workspace_id=p_workspace_id),'[]'::jsonb));end$$;

-- Mirrors reviseQuestion in src/lib/workspace/questions.ts. Non-human origins are
-- only accepted inside a proposal/weekly confirmation transaction.
create function public.save_open_question(p_workspace_id uuid,p_member_id uuid,p_initiative_id uuid,p_input jsonb) returns uuid language plpgsql set search_path='' as $$
declare actor public.organization_memberships;i public.initiatives;prior public.open_questions;replay public.question_events;
 op text:=p_input->>'operation';request uuid:=(p_input->>'requestId')::uuid;at_time timestamptz:=clock_timestamp();actor_label text;owner_id uuid;elevated boolean;
 next_data jsonb;event_type text;qid uuid;question text;due date;target uuid;reason text:=coalesce(btrim(p_input->>'reason'),'');note text;claim uuid;confirmer text;origin text:=coalesce(p_input->>'origin','HUMAN_ENTRY');event_id uuid:=gen_random_uuid();
begin
 actor:=public.require_workspace_member(p_workspace_id,p_member_id,false,true);
 select * into i from public.initiatives where id=p_initiative_id and workspace_id=p_workspace_id for update;if not found then raise exception 'INITIATIVE_ACCESS';end if;if i.archived_at is not null then raise exception 'INITIATIVE_ARCHIVED';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_workspace_id::text||':question:'||request::text,0));
 select * into replay from public.question_events where workspace_id=p_workspace_id and request_id=request;
 if found then if replay.data#>>'{actor,id}'<>actor.user_id::text or (p_input->>'id' is not null and replay.question_id::text<>p_input->>'id') then raise exception 'REQUEST_REUSED';end if;return replay.question_id;end if;
 if coalesce(p_input->>'expectedRevision','') !~ '^[0-9]+$' or op is null or op not in ('CREATE','EDIT','ANSWER','WITHDRAW','REOPEN') then raise exception 'QUESTION_COMMAND';end if;
 if length(reason)>2000 then raise exception 'QUESTION_FIELDS';end if;
 select display_name into actor_label from public.users where id=actor.user_id;
 owner_id:=public.initiative_owner_member(p_workspace_id,i.id);elevated:=public.principal_is_admin(actor.user_id,actor.role) or actor.is_product_lead or owner_id=actor.id;
 if op='CREATE' then
  if (p_input->>'expectedRevision')::integer<>0 then raise exception 'STALE_QUESTION';end if;
  question:=btrim(p_input->>'question');if coalesce(length(question),0) not between 1 and 300 then raise exception 'QUESTION_FIELDS';end if;
  due:=nullif(p_input->>'dueDate','')::date;if due is not null and due::text<>p_input->>'dueDate' then raise exception 'DATE_FORMAT';end if;
  confirmer:=nullif(btrim(p_input->>'expectedConfirmerText'),'');if coalesce(length(confirmer),0)>200 then raise exception 'QUESTION_FIELDS';end if;
  if origin not in ('HUMAN_ENTRY','CONFIRMED_AI_PROPOSAL','MEETING','WEEKLY_REVIEW') then raise exception 'QUESTION_ORIGIN';end if;
  if origin<>'HUMAN_ENTRY' then
   if coalesce(current_setting('prodwise.confirming_proposal',true),'')<>coalesce(p_input->>'originRefId','-') then raise exception 'ORIGIN_CONFIRMATION_REQUIRED';end if;
   select id into qid from public.open_questions where workspace_id=p_workspace_id and data->>'origin'=origin and data->>'originRefId'=p_input->>'originRefId';if found then return qid;end if;
  end if;
  target:=nullif(p_input->>'ownerMemberId','')::uuid;
  if target is not null and not exists(select 1 from public.organization_memberships m join public.users u on u.id=m.user_id where m.id=target and m.organization_id=actor.organization_id and m.active and u.active and m.role<>'VIEWER' and not u.is_system) then raise exception 'OWNER_INVALID';end if;
  if nullif(p_input->>'evidenceId','') is not null and not exists(select 1 from public.evidence where id=(p_input->>'evidenceId')::uuid and initiative_id=i.id and workspace_id=p_workspace_id) then raise exception 'EVIDENCE_INVALID';end if;
  qid:=gen_random_uuid();event_type:='OPENED';
  next_data:=jsonb_build_object('id',qid,'workspaceId',p_workspace_id,'initiativeId',i.id,'question',question,'ownerMemberId',target,'expectedConfirmerText',confirmer,'dueDate',due,'status','OPEN','origin',origin,
   'originRefId',case when origin='HUMAN_ENTRY' then null else p_input->>'originRefId' end,'originHref',case when origin='HUMAN_ENTRY' then null else p_input->>'originHref' end,'originLabel',case when origin='HUMAN_ENTRY' then null else left(nullif(btrim(p_input->>'originLabel'),''),200) end,
   'evidenceId',nullif(p_input->>'evidenceId',''),'evidenceAnchorId',nullif(p_input->>'evidenceAnchorId',''),'answerClaimId',null,'answerNote',null,'resolutionReason',null,
   'createdBy',actor.user_id,'createdByLabel',actor_label,'createdAt',at_time,'updatedAt',at_time,'resolvedBy',null,'resolvedByLabel',null,'resolvedAt',null,'revision',1);
  insert into public.open_questions(id,workspace_id,initiative_id,revision,data) values(qid,p_workspace_id,i.id,1,next_data);
 else
  select * into prior from public.open_questions where id=(p_input->>'id')::uuid and workspace_id=p_workspace_id and initiative_id=i.id for update;if not found then raise exception 'QUESTION_ACCESS';end if;
  if prior.revision<>(p_input->>'expectedRevision')::integer then raise exception 'STALE_QUESTION';end if;qid:=prior.id;next_data:=prior.data;
  if op='EDIT' then
   if prior.data->>'status'<>'OPEN' then raise exception 'QUESTION_NOT_OPEN';end if;
   if not coalesce(elevated or prior.data->>'createdBy'=actor.user_id::text,false) then raise exception 'QUESTION_PERMISSION';end if;
   question:=btrim(coalesce(p_input->>'question',prior.data->>'question'));if coalesce(length(question),0) not between 1 and 300 then raise exception 'QUESTION_FIELDS';end if;
   if p_input ? 'dueDate' then due:=nullif(p_input->>'dueDate','')::date;if due is not null and due::text<>p_input->>'dueDate' then raise exception 'DATE_FORMAT';end if;next_data:=next_data||jsonb_build_object('dueDate',due);end if;
   if p_input ? 'ownerMemberId' then target:=nullif(p_input->>'ownerMemberId','')::uuid;
    if target is not null and not exists(select 1 from public.organization_memberships m join public.users u on u.id=m.user_id where m.id=target and m.organization_id=actor.organization_id and m.active and u.active and m.role<>'VIEWER' and not u.is_system) then raise exception 'OWNER_INVALID';end if;next_data:=next_data||jsonb_build_object('ownerMemberId',target);end if;
   if p_input ? 'expectedConfirmerText' then confirmer:=nullif(btrim(p_input->>'expectedConfirmerText'),'');if coalesce(length(confirmer),0)>200 then raise exception 'QUESTION_FIELDS';end if;next_data:=next_data||jsonb_build_object('expectedConfirmerText',confirmer);end if;
   next_data:=next_data||jsonb_build_object('question',question);if next_data=prior.data then raise exception 'NOTHING_CHANGED';end if;event_type:='UPDATED';
  else
   if not coalesce(elevated or prior.data->>'ownerMemberId'=actor.id::text,false) then raise exception 'QUESTION_PERMISSION';end if;
   if op='ANSWER' then
    if prior.data->>'status'<>'OPEN' then raise exception 'QUESTION_NOT_OPEN';end if;
    note:=nullif(btrim(p_input->>'answerNote'),'');claim:=nullif(p_input->>'answerClaimId','')::uuid;
    if note is null and claim is null then raise exception 'ANSWER_REQUIRED';end if;if coalesce(length(note),0)>2000 then raise exception 'QUESTION_FIELDS';end if;
    -- An unverified claim can never answer a question.
    if claim is not null and not exists(select 1 from public.claims where id=claim and workspace_id=p_workspace_id and initiative_id=i.id and status='ACTIVE') then raise exception 'ANSWER_CLAIM_NOT_CONFIRMED';end if;
    next_data:=next_data||jsonb_build_object('status','ANSWERED','answerNote',note,'answerClaimId',claim,'resolutionReason',null,'resolvedBy',actor.user_id,'resolvedByLabel',actor_label,'resolvedAt',at_time);event_type:='ANSWERED';
   elsif op='WITHDRAW' then
    if prior.data->>'status'<>'OPEN' then raise exception 'QUESTION_NOT_OPEN';end if;if reason='' then raise exception 'REASON_REQUIRED';end if;
    next_data:=next_data||jsonb_build_object('status','WITHDRAWN','resolutionReason',reason,'resolvedBy',actor.user_id,'resolvedByLabel',actor_label,'resolvedAt',at_time);event_type:='WITHDRAWN';
   else
    if prior.data->>'status'='OPEN' then raise exception 'QUESTION_ALREADY_OPEN';end if;if reason='' then raise exception 'REASON_REQUIRED';end if;
    next_data:=next_data||jsonb_build_object('status','OPEN','answerNote',null,'answerClaimId',null,'resolutionReason',null,'resolvedBy',null,'resolvedByLabel',null,'resolvedAt',null);event_type:='REOPENED';
   end if;
  end if;
  next_data:=next_data||jsonb_build_object('updatedAt',at_time,'revision',prior.revision+1);
  update public.open_questions set revision=prior.revision+1,data=next_data where id=prior.id;
 end if;
 insert into public.question_events(id,workspace_id,initiative_id,question_id,seq,data,request_id,input) values(event_id,p_workspace_id,i.id,qid,(next_data->>'revision')::integer,
  jsonb_build_object('id',event_id,'workspaceId',p_workspace_id,'initiativeId',i.id,'questionId',qid,'seq',(next_data->>'revision')::integer,'type',event_type,'before',prior.data,'after',next_data,'note',reason,'actor',jsonb_build_object('id',actor.user_id,'label',actor_label),'at',at_time,'requestId',request),request,p_input);
 insert into public.activity_log(id,workspace_id,initiative_id,actor_id,actor_label,event_type,summary,entity_type,entity_id,payload,occurred_at) values(event_id,p_workspace_id,i.id,actor.user_id,actor_label,'QUESTION_'||event_type,'Open question '||lower(event_type)||': '||(next_data->>'question'),'QUESTION',qid,jsonb_build_object('questionId',qid,'type',event_type),at_time);
 return qid;
end$$;

create function public.submit_meeting_notes(p_workspace_id uuid,p_member_id uuid,p_input jsonb) returns uuid language plpgsql set search_path='' as $$
declare actor public.organization_memberships;i public.initiatives;prior public.evidence_submissions;sid uuid:=gen_random_uuid();eid uuid:=gen_random_uuid();item_id uuid:=nullif(p_input->>'sourceItemId','')::uuid;at_time timestamptz:=clock_timestamp();text_value text:=p_input->>'text';title text:=btrim(p_input->>'title');meeting_date text:=p_input#>>'{meeting,date}';attendees text:=nullif(btrim(p_input#>>'{meeting,attendees}'),'');v_reference text;payload jsonb;actor_label text;begin
 actor:=public.require_workspace_member(p_workspace_id,p_member_id,false,true);select * into i from public.initiatives where id=(p_input->>'initiativeId')::uuid and workspace_id=p_workspace_id for update;if not found then raise exception 'INITIATIVE_ACCESS';end if;if i.archived_at is not null then raise exception 'ARCHIVED';end if;
 if length(btrim(text_value))=0 or length(text_value)>20000 or coalesce((p_input->>'charLength')::integer,0) not between 1 and 20000 or coalesce(length(title),0) not between 1 and 160 or p_input->>'textSha256' is distinct from encode(sha256(convert_to(text_value,'UTF8')),'hex') then raise exception 'INVALID_EVIDENCE';end if;
 if meeting_date is null or meeting_date !~ '^\d{4}-\d{2}-\d{2}$' or to_char(meeting_date::date,'YYYY-MM-DD')<>meeting_date then raise exception 'MEETING_DATE_REQUIRED';end if;if coalesce(length(attendees),0)>500 then raise exception 'INVALID_EVIDENCE';end if;
 select * into prior from public.evidence_submissions where workspace_id=p_workspace_id and request_id=(p_input->>'requestId')::uuid;if found then if prior.data->>'createdBy'<>actor.user_id::text or prior.data->>'text' is distinct from text_value or prior.data->>'title' is distinct from title or prior.initiative_id<>i.id then raise exception 'REQUEST_REUSED';end if;return prior.id;end if;
 v_reference:='meeting:'||meeting_date||':'||coalesce(nullif(left(trim(both '-' from regexp_replace(lower(title),'[^a-z0-9]+','-','g')),60),''),'meeting')||':'||left(sid::text,8);
 if item_id is null then perform public.map_initiative_sources(p_workspace_id,p_member_id,jsonb_build_object('initiativeId',i.id,'provider','MEETING_NOTES','providerWorkspace',p_workspace_id,'containerReference','meeting-notes','containerName','Meeting notes','role','GENERAL','items',jsonb_build_array(jsonb_build_object('reference',v_reference,'name',title,'kind','MEETING_NOTES','url',null))));select id into item_id from public.source_items where workspace_id=p_workspace_id and source_items.reference=v_reference;
 elsif not exists(select 1 from public.source_mappings where workspace_id=p_workspace_id and initiative_id=i.id and source_mappings.item_id=submit_meeting_notes.item_id and unlinked_at is null) then raise exception 'SOURCE_ACCESS';end if;
 insert into public.evidence(id,workspace_id,initiative_id,title,source_type,source_reference,content_summary,boundary,captured_at,created_by) values(eid,p_workspace_id,i.id,title,'DOCUMENT',sid::text,text_value,'CURRENT_SCOPE',at_time,actor.user_id);
 payload:=jsonb_build_object('id',sid,'workspaceId',p_workspace_id,'organizationId',actor.organization_id,'initiativeId',i.id,'sourceItemId',item_id,'evidenceId',eid,'kind','MEETING_NOTES','title',title,'text',text_value,'textSha256',p_input->>'textSha256','charLength',(p_input->>'charLength')::integer,'createdBy',actor.user_id,'createdAt',at_time,'requestId',p_input->>'requestId');
 insert into public.evidence_submissions values(sid,p_workspace_id,i.id,(p_input->>'requestId')::uuid,payload);
 insert into public.meeting_notes(submission_id,workspace_id,initiative_id,revision,data) values(sid,p_workspace_id,i.id,1,jsonb_build_object('submissionId',sid,'workspaceId',p_workspace_id,'initiativeId',i.id,'title',title,'meetingDate',meeting_date,'attendeesText',attendees,'revision',1,'createdBy',actor.user_id,'createdAt',at_time,'updatedBy',actor.user_id,'updatedAt',at_time));
 select display_name into actor_label from public.users where id=actor.user_id;
 insert into public.activity_log(workspace_id,initiative_id,event_type,summary,entity_type,entity_id,actor_label,payload) values(p_workspace_id,i.id,'MEETING_NOTES_SAVED','Meeting notes added: '||title||' ('||meeting_date||'). No product facts confirmed.','EVIDENCE',eid,actor_label,jsonb_build_object('submissionId',sid,'sourceItemId',item_id,'meetingDate',meeting_date));return sid;end$$;

create function public.correct_meeting_notes(p_workspace_id uuid,p_member_id uuid,p_input jsonb) returns void language plpgsql set search_path='' as $$
declare actor public.organization_memberships;m public.meeting_notes;title text:=btrim(p_input->>'title');meeting_date text:=p_input->>'meetingDate';attendees text:=nullif(btrim(p_input->>'attendeesText'),'');after_data jsonb;actor_label text;begin
 actor:=public.require_workspace_member(p_workspace_id,p_member_id,false,true);
 select * into m from public.meeting_notes where submission_id=(p_input->>'submissionId')::uuid and workspace_id=p_workspace_id for update;if not found then raise exception 'MEETING_ACCESS';end if;
 perform 1 from public.initiatives where id=m.initiative_id for update;perform public.assert_initiative_not_archived(p_workspace_id,m.initiative_id);
 if not coalesce(m.data->>'createdBy'=actor.user_id::text or public.principal_is_admin(actor.user_id,actor.role) or public.initiative_owner_member(p_workspace_id,m.initiative_id)=actor.id,false) then raise exception 'MEETING_PERMISSION';end if;
 if m.revision<>(p_input->>'expectedRevision')::integer then raise exception 'STALE_MEETING';end if;
 if coalesce(length(title),0) not between 1 and 160 or meeting_date is null or meeting_date !~ '^\d{4}-\d{2}-\d{2}$' or to_char(meeting_date::date,'YYYY-MM-DD')<>meeting_date or coalesce(length(attendees),0)>500 then raise exception 'MEETING_FIELDS';end if;
 after_data:=m.data||jsonb_build_object('title',title,'meetingDate',meeting_date,'attendeesText',attendees);if after_data=m.data then raise exception 'NOTHING_CHANGED';end if;
 after_data:=after_data||jsonb_build_object('revision',m.revision+1,'updatedBy',actor.user_id,'updatedAt',clock_timestamp());
 update public.meeting_notes set revision=m.revision+1,data=after_data where submission_id=m.submission_id;
 select display_name into actor_label from public.users where id=actor.user_id;
 insert into public.activity_log(workspace_id,initiative_id,event_type,summary,entity_type,entity_id,actor_label,payload) values(p_workspace_id,m.initiative_id,'MEETING_NOTES_CORRECTED','Meeting details corrected: '||(m.data->>'title')||' ('||(m.data->>'meetingDate')||') → '||title||' ('||meeting_date||')','EVIDENCE',(select (data->>'evidenceId')::uuid from public.evidence_submissions where id=m.submission_id),actor_label,jsonb_build_object('before',m.data,'after',after_data));end$$;

-- Reading may now return open questions and explicit changes to existing Knowledge.
do $$declare def text;begin select pg_get_functiondef('public.finish_evidence_attempt(uuid,uuid,uuid,jsonb)'::regprocedure) into def;
 def:=replace(def,$l$('REQUIREMENT','DECISION','BUSINESS_RULE','RISK','DEPENDENCY','ASSUMPTION','DELIVERY','ACTION')$l$,$l$('REQUIREMENT','DECISION','BUSINESS_RULE','RISK','DEPENDENCY','ASSUMPTION','DELIVERY','ACTION','OPEN_QUESTION','CHANGED_REQUIREMENT','RELATIONSHIP')$l$);
 if position('CHANGED_REQUIREMENT' in def)=0 then raise exception 'PATCH_TARGET_MISSING finish_evidence_attempt';end if;execute def;end$$;

do $$declare def text;begin select pg_get_functiondef('public.read_anchored_evidence(uuid,uuid,uuid)'::regprocedure) into def;
 def:=replace(def,$l$return jsonb_build_object('submissions',$l$,$l$return jsonb_build_object('meetings',coalesce((select jsonb_agg(data order by data->>'meetingDate') from public.meeting_notes where workspace_id=p_workspace_id and initiative_id=p_initiative_id),'[]'::jsonb),'submissions',$l$);
 if position('meeting_notes' in def)=0 then raise exception 'PATCH_TARGET_MISSING read_anchored_evidence';end if;execute def;end$$;

-- Meeting-confirmed commitments keep a MEETING origin inside the confirmation transaction only.
do $$declare def text;begin select pg_get_functiondef('public.save_commitment(uuid,uuid,uuid,jsonb)'::regprocedure) into def;
 def:=replace(def,$l$elsif prior.id is null and p_input->>'origin'='CONFIRMED_AI_PROPOSAL' and current_setting('prodwise.confirming_proposal',true)=p_input->>'originRefId' then
 origin:='CONFIRMED_AI_PROPOSAL';$l$,$l$elsif prior.id is null and p_input->>'origin' in ('CONFIRMED_AI_PROPOSAL','MEETING') and current_setting('prodwise.confirming_proposal',true)=p_input->>'originRefId' then
 origin:=p_input->>'origin';$l$);
 if position($l$in ('CONFIRMED_AI_PROPOSAL','MEETING')$l$ in def)=0 then raise exception 'PATCH_TARGET_MISSING save_commitment';end if;execute def;end$$;
drop index public.actions_conversion;
create unique index actions_conversion on public.actions(workspace_id,(data->>'origin'),(data->>'originRefId')) where data->>'origin' in ('WEEKLY_REVIEW','CONFIRMED_AI_PROPOSAL','MEETING');

do $$declare def text;n integer:=0;
 procedure_text text;begin select pg_get_functiondef('public.decide_evidence_proposal(uuid,uuid,jsonb)'::regprocedure) into def;
 def:=replace(def,'owner_id uuid;begin','owner_id uuid;target public.claims;begin');
 -- Relationship proposals are confirmed through their own command (type and rationale required).
 def:=replace(def,$l$payload:=p.data->'payload';$l$,$l$payload:=p.data->'payload';if p.data->>'type'='RELATIONSHIP' and op in ('CONFIRM','HUMAN_ENTRY') then raise exception 'RELATIONSHIP_COMMAND_REQUIRED';end if;$l$);
 def:=replace(def,$l$ elsif p.data->>'type'='ACTION' then$l$,$l$ elsif p.data->>'type'='OPEN_QUESTION' then
  if op='CONFIRM' then perform set_config('prodwise.confirming_proposal',p.id::text,true);end if;
  result_id:=public.save_open_question(p_workspace_id,p_member_id,i.id,jsonb_build_object('operation','CREATE','requestId',p_input->>'requestId','expectedRevision',0,'question',payload->>'value','ownerMemberId',p_input->>'assigneeMemberId','dueDate',p_input->>'dueDate',
   'origin',case when op='CONFIRM' and s.data->>'kind'='MEETING_NOTES' then 'MEETING' when op='CONFIRM' then 'CONFIRMED_AI_PROPOSAL' else 'HUMAN_ENTRY' end,'originRefId',case when op='CONFIRM' then p.id::text else null end,
   'originHref',case when op='CONFIRM' then '/initiatives/'||i.slug||'/evidence/'||s.id::text||'#proposal-'||p.id::text else null end,'originLabel',case when op='CONFIRM' then s.data->>'title' else null end,
   'evidenceId',case when op='CONFIRM' then s.data->>'evidenceId' else null end,'evidenceAnchorId',case when op='CONFIRM' then a.id::text else null end));
  result_type:='QUESTION';perform set_config('prodwise.confirming_proposal','',true);
 elsif p.data->>'type'='ACTION' then$l$);
 def:=replace(def,$l$'origin',case when op='CONFIRM' then 'CONFIRMED_AI_PROPOSAL' else 'HUMAN_ENTRY' end$l$,$l$'origin',case when op='CONFIRM' and s.data->>'kind'='MEETING_NOTES' then 'MEETING' when op='CONFIRM' then 'CONFIRMED_AI_PROPOSAL' else 'HUMAN_ENTRY' end$l$);
 def:=replace(def,$l$'originHref',case when op='CONFIRM' then '/initiatives/'||i.slug||'/evidence/'||s.id::text else null end$l$,$l$'originHref',case when op='CONFIRM' then '/initiatives/'||i.slug||'/evidence/'||s.id::text||'#proposal-'||p.id::text else null end$l$);
 def:=replace(def,$l$if p.data->>'type' not in ('REQUIREMENT','DECISION','BUSINESS_RULE','RISK','DEPENDENCY','ASSUMPTION') then raise exception 'TARGET_UNAVAILABLE';end if;$l$,$l$if p.data->>'type' not in ('REQUIREMENT','DECISION','BUSINESS_RULE','RISK','DEPENDENCY','ASSUMPTION','CHANGED_REQUIREMENT') then raise exception 'TARGET_UNAVAILABLE';end if;
  if p.data->>'type'='CHANGED_REQUIREMENT' then
   select * into target from public.claims where id=(payload->>'targetClaimId')::uuid and workspace_id=p_workspace_id and initiative_id=i.id for update;
   -- The supersede is pinned to the revision that was read. A changed target makes the proposal Outdated and writes nothing canonical.
   if not found or target.updated_at is distinct from (payload->>'targetClaimUpdatedAt')::timestamptz or target.status::text not in ('ACTIVE','UNVERIFIED','DRAFT') then
    update public.evidence_proposals set data=data||jsonb_build_object('status','OUTDATED','version',(data->>'version')::integer+1) where id=p.id;
    return jsonb_build_object('outdated',true);
   end if;
  end if;$l$);
 def:=replace(def,$l$(p.data->>'type')::public.claim_type$l$,$l$(case when p.data->>'type'='CHANGED_REQUIREMENT' then target.type::text else p.data->>'type' end)::public.claim_type$l$);
 def:=replace(def,$l$if op='CONFIRM' then insert into public.claim_evidence(claim_id,evidence_id,locator,excerpt) values(result_id,(s.data->>'evidenceId')::uuid,'UTF16 '||(a.data->>'start')||'–'||(a.data->>'end'),a.data->>'quote');end if;$l$,$l$if op='CONFIRM' then insert into public.claim_evidence(claim_id,evidence_id,locator,excerpt) values(result_id,(s.data->>'evidenceId')::uuid,'UTF16 '||(a.data->>'start')||'–'||(a.data->>'end'),a.data->>'quote');end if;
  if target.id is not null then
   update public.claims set status='SUPERSEDED',superseded_by_claim_id=result_id where id=target.id;
   insert into public.activity_log(workspace_id,initiative_id,event_type,summary,entity_type,entity_id,actor_label,payload) values(p_workspace_id,i.id,'CLAIM_SUPERSEDED',target.subject||' · '||target.attribute||' changed: “'||target.value||'” → “'||(payload->>'value')||'” (from '||(s.data->>'title')||'). New entry needs verification.','CLAIM',result_id,actor_label,jsonb_build_object('previousClaimId',target.id,'submissionId',s.id,'proposalId',p.id));
  end if;$l$);
 foreach procedure_text in array array['target public.claims','RELATIONSHIP_COMMAND_REQUIRED','save_open_question','''MEETING'' when op','#proposal-''||p.id::text else null end','''CHANGED_REQUIREMENT'') then raise','target.type::text','superseded_by_claim_id=result_id'] loop
  if position(procedure_text in def)=0 then raise exception 'PATCH_TARGET_MISSING decide_evidence_proposal: %',procedure_text;end if;end loop;
 execute def;end$$;

revoke all on function public.initiative_owner_member(uuid,uuid),public.read_open_questions(uuid,uuid),public.save_open_question(uuid,uuid,uuid,jsonb),public.submit_meeting_notes(uuid,uuid,jsonb),public.correct_meeting_notes(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.initiative_owner_member(uuid,uuid),public.read_open_questions(uuid,uuid),public.save_open_question(uuid,uuid,uuid,jsonb),public.submit_meeting_notes(uuid,uuid,jsonb),public.correct_meeting_notes(uuid,uuid,jsonb) to service_role;
commit;
