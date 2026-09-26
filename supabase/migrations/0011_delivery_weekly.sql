-- LOCAL CANDIDATE ONLY. Requires 0010 Auth/workspace membership. No hosted apply.
begin;
create table public.delivery_facts (
  id uuid primary key, workspace_id uuid not null references public.workspaces(id),
  initiative_id uuid not null references public.initiatives(id), kind text not null,
  revision integer not null check(revision > 0), value_date date, value_text text,
  owner_member_id uuid references public.memberships(id), data jsonb not null,
  unique(workspace_id,initiative_id,kind),
  check(kind in ('SCOPE','OWNER','SOLUTION_DEFINED','DEV_STARTED','TARGET_LIVE','ACTUAL_LIVE','NEXT_MILESTONE','BLOCKER','NEXT_STEP')),
  check(data->>'workspaceId'=workspace_id::text and data->>'initiativeId'=initiative_id::text and data->>'id'=id::text and data->>'kind'=kind),
  check((data->>'revision')::integer=revision),
  check(data->>'state' in ('SET','RETRACTED')),
  check(data->>'basis' in ('EVIDENCE','DIRECT_KNOWLEDGE')),
  check(length(btrim(data->>'note'))>0),
  check(data->>'confirmedByMemberId' is not null and data->>'updatedAt' is not null),
  check(value_date is not distinct from (data#>>'{value,date}')::date),
  check(value_text is not distinct from (data#>>'{value,text}')),
  check(owner_member_id is not distinct from (data#>>'{value,memberId}')::uuid),
  check(data->>'state'='RETRACTED' or kind not in ('SOLUTION_DEFINED','DEV_STARTED','TARGET_LIVE','ACTUAL_LIVE') or value_date is not null)
);
create table public.weekly_reviews (
  id uuid primary key, workspace_id uuid not null references public.workspaces(id),
  iso_week text not null check(iso_week ~ '^\d{4}-W\d{2}$'), status text not null check(status in ('DRAFT','FINAL')),
  revision integer not null check(revision > 0), data jsonb not null,
  unique(workspace_id,iso_week),
  check(data->>'id'=id::text and data->>'workspaceId'=workspace_id::text and data->>'week'=iso_week and data->>'status'=status),
  check((data->>'revision')::integer=revision),
  check(status <> 'FINAL' or (data->>'finalizedByMemberId' is not null and data->>'finalizedAt' is not null))
);
alter table public.delivery_facts enable row level security;
alter table public.weekly_reviews enable row level security;
revoke all on public.delivery_facts, public.weekly_reviews from public, anon, authenticated;
grant select,insert,update on public.delivery_facts, public.weekly_reviews to service_role;
-- Existing tenant/source table privileges are the explicit 0010 prerequisite.

create function public.delivery_final_immutable() returns trigger language plpgsql set search_path='' as $$
begin if old.status='FINAL' then raise exception 'FINAL_IMMUTABLE'; end if; return new; end; $$;
create trigger weekly_reviews_final_immutable before update or delete on public.weekly_reviews for each row execute function public.delivery_final_immutable();

-- One statement produces a consistent source snapshot. Exclude irrelevant
-- source timestamps while retaining actual evidence content, trust and anchors.
create function public.delivery_source(p_workspace_id uuid) returns jsonb language sql stable set search_path='' as $$
select jsonb_build_object(
 'snapshots',coalesce((select jsonb_agg(jsonb_build_object(
  'initiative',to_jsonb(i),
  'evidence',coalesce((select jsonb_agg(to_jsonb(e) order by e.id) from public.evidence e where e.initiative_id=i.id),'[]'::jsonb),
  'claims',coalesce((select jsonb_agg(to_jsonb(c) || jsonb_build_object(
    'evidence',coalesce((select jsonb_agg(to_jsonb(e) order by e.id) from public.claim_evidence ce join public.evidence e on e.id=ce.evidence_id where ce.claim_id=c.id),'[]'::jsonb),
    'anchors',coalesce((select jsonb_agg(jsonb_build_object('evidence_id',ce.evidence_id,'locator',ce.locator,'excerpt',ce.excerpt) order by ce.evidence_id) from public.claim_evidence ce where ce.claim_id=c.id),'[]'::jsonb)
   ) order by c.id) from public.claims c where c.initiative_id=i.id),'[]'::jsonb),
  'findingStates',coalesce((select jsonb_agg(to_jsonb(f) order by f.fingerprint) from public.finding_states f where f.initiative_id=i.id),'[]'::jsonb)
 ) order by i.id) from public.initiatives i where i.workspace_id=p_workspace_id),'[]'::jsonb),
 'members',coalesce((select jsonb_agg(jsonb_build_object('id',m.id,'workspaceId',m.workspace_id,'displayName',u.display_name,'role',m.role,'active',m.active,'isProductLead',m.is_product_lead) order by m.id) from public.memberships m join public.users u on u.id=m.user_id where m.workspace_id=p_workspace_id),'[]'::jsonb)
);
$$;
create function public.delivery_state(p_workspace_id uuid) returns jsonb language sql stable set search_path='' as $$
select jsonb_build_object('schema',1,
 'facts',coalesce((select jsonb_agg(f.data order by f.id) from public.delivery_facts f where f.workspace_id=p_workspace_id),'[]'::jsonb),
 'events',coalesce((select jsonb_agg(a.payload->'deliveryEvent' order by a.occurred_at,a.id) from public.activity_log a join public.initiatives i on i.id=a.initiative_id where i.workspace_id=p_workspace_id and a.event_type='DELIVERY_FACT_RECORDED' and a.payload ? 'deliveryEvent'),'[]'::jsonb),
 'reviews',coalesce((select jsonb_agg(r.data order by r.id) from public.weekly_reviews r where r.workspace_id=p_workspace_id),'[]'::jsonb)
);
$$;
create function public.delivery_read_workspace(p_workspace_id uuid,p_member_id uuid) returns jsonb language plpgsql stable set search_path='' as $$
begin
 perform public.require_workspace_member(p_workspace_id,p_member_id,false,false);
 if not exists(select 1 from public.memberships m where m.id=p_member_id and m.workspace_id=p_workspace_id and m.active) then raise exception 'MEMBERSHIP_ACCESS'; end if;
 return jsonb_build_object('source',public.delivery_source(p_workspace_id),'state',public.delivery_state(p_workspace_id));
end; $$;

create function public.delivery_meaningful(p_value jsonb) returns jsonb language plpgsql immutable set search_path='' as $$
declare v_result jsonb; v_key text; v_item jsonb;
begin
 if jsonb_typeof(p_value)='array' then
  select coalesce(jsonb_agg(public.delivery_meaningful(value)),'[]'::jsonb) into v_result from jsonb_array_elements(p_value); return v_result;
 elsif jsonb_typeof(p_value)='object' then
  v_result='{}'::jsonb;
  for v_key,v_item in select key,value from jsonb_each(p_value) loop
   if v_key not in ('created_at','updated_at','captured_at','occurred_at','last_verified_at','detectedOn','createdAt','updatedAt','capturedAt','occurredAt','lastVerifiedAt') then v_result=v_result||jsonb_build_object(v_key,public.delivery_meaningful(v_item)); end if;
  end loop; return v_result;
 end if; return p_value;
end; $$;

-- Match the server's source projection without trusting a caller-supplied hash.
create function public.delivery_camel(p_value jsonb) returns jsonb language plpgsql immutable set search_path='' as $$
declare v_result jsonb; v_key text; v_item jsonb; v_match text[];
begin
 if jsonb_typeof(p_value)='array' then
  select coalesce(jsonb_agg(public.delivery_camel(value)),'[]'::jsonb) into v_result from jsonb_array_elements(p_value); return v_result;
 elsif jsonb_typeof(p_value)='object' then
  v_result='{}'::jsonb;
  for v_key,v_item in select key,value from jsonb_each(p_value) loop
   loop v_match=regexp_match(v_key,'(_[a-z])'); exit when v_match is null; v_key=replace(v_key,v_match[1],upper(substr(v_match[1],2))); end loop;
   v_result=v_result||jsonb_build_object(v_key,public.delivery_camel(v_item));
  end loop; return v_result;
 end if; return p_value;
end; $$;
create function public.delivery_section_input(p_input jsonb,p_initiative_id text) returns jsonb language sql immutable set search_path='' as $$
 select jsonb_build_object(
  'source',public.delivery_meaningful((select value from jsonb_array_elements(p_input->'snapshots') where value#>>'{initiative,id}'=p_initiative_id)),
  'facts',coalesce((select jsonb_agg(value order by value->>'id') from jsonb_array_elements(p_input->'facts') where value->>'initiativeId'=p_initiative_id),'[]'::jsonb),
  'members',coalesce((select jsonb_agg(jsonb_build_object('id',value->>'id','active',value->'active','role',value->>'role') order by value->>'id') from jsonb_array_elements(p_input->'members')),'[]'::jsonb)
 );
$$;

-- Service-role-only transaction. The server computes and validates transitions;
-- this RPC additionally enforces membership, row ownership, scope, immutable
-- finals, expected snapshot/state equality and real initiative audit references.
create function public.delivery_commit_workspace(p_workspace_id uuid,p_member_id uuid,p_expected_source jsonb,p_expected_state jsonb,p_next_state jsonb) returns void language plpgsql set search_path='' as $$
declare
 v_member public.memberships%rowtype; v_item jsonb; v_before jsonb; v_event jsonb; v_review_before jsonb;
 v_owner uuid; v_user uuid; v_label text; v_source jsonb; v_live_input jsonb; v_old_section jsonb; v_section jsonb;
 v_baseline text; v_latest_week text; v_refresh boolean; v_ai boolean; v_is_coordinator boolean; v_section_changed boolean;
begin
 perform 1 from public.workspaces where id=p_workspace_id for update;
 perform public.require_workspace_member(p_workspace_id,p_member_id,false,true);
 select * into v_member from public.memberships where id=p_member_id and workspace_id=p_workspace_id and active for update;
 if not found or v_member.role='Viewer' then raise exception 'WRITE_ACCESS'; end if;
 select u.id,u.display_name into v_user,v_label from public.users u where u.id=v_member.user_id;
 v_is_coordinator=v_member.role='Admin' or (v_member.role='Member' and v_member.is_product_lead);
 -- Source rows are locked while final checks run so evidence, claims, boundary,
 -- owner membership and scope mutations cannot race with review finalization.
 perform 1 from public.memberships where workspace_id=p_workspace_id for share;
 perform 1 from public.users u join public.memberships m on m.user_id=u.id where m.workspace_id=p_workspace_id for share of u;
 select u.id,u.display_name into v_user,v_label from public.users u where u.id=v_member.user_id;
 perform 1 from public.initiatives where workspace_id=p_workspace_id for update;
 perform 1 from public.evidence e join public.initiatives i on i.id=e.initiative_id where i.workspace_id=p_workspace_id for update of e;
 perform 1 from public.claims c join public.initiatives i on i.id=c.initiative_id where i.workspace_id=p_workspace_id for update of c;
 perform 1 from public.claim_evidence ce join public.claims c on c.id=ce.claim_id join public.initiatives i on i.id=c.initiative_id where i.workspace_id=p_workspace_id for update of ce;
 perform 1 from public.finding_states f join public.initiatives i on i.id=f.initiative_id where i.workspace_id=p_workspace_id for update of f;
 v_source=public.delivery_source(p_workspace_id);
 if public.delivery_meaningful(v_source) is distinct from public.delivery_meaningful(p_expected_source) then raise exception 'STALE_SOURCE'; end if;
 if public.delivery_state(p_workspace_id) is distinct from p_expected_state then raise exception 'STALE_STATE'; end if;
 if p_next_state->>'schema' is distinct from '1' or jsonb_typeof(p_next_state->'facts') is distinct from 'array' or jsonb_typeof(p_next_state->'reviews') is distinct from 'array' or jsonb_typeof(p_next_state->'events') is distinct from 'array' then raise exception 'INVALID_STATE'; end if;
 if exists(select 1 from jsonb_array_elements(p_expected_state->'facts') x where not exists(select 1 from jsonb_array_elements(p_next_state->'facts') n where n->>'id'=x->>'id')) or exists(select 1 from jsonb_array_elements(p_expected_state->'reviews') x where not exists(select 1 from jsonb_array_elements(p_next_state->'reviews') n where n->>'id'=x->>'id')) or exists(select 1 from jsonb_array_elements(p_expected_state->'events') x where not exists(select 1 from jsonb_array_elements(p_next_state->'events') n where n->>'id'=x->>'id')) then raise exception 'NO_HARD_DELETE'; end if;
 for v_item in select value from jsonb_array_elements(p_next_state->'facts') loop
  if v_item->>'workspaceId'<>p_workspace_id::text or not exists(select 1 from public.initiatives i where i.id=(v_item->>'initiativeId')::uuid and i.workspace_id=p_workspace_id) then raise exception 'FACT_SCOPE'; end if;
  select f.data into v_before from public.delivery_facts f where f.id=(v_item->>'id')::uuid;
  if v_before is not null and (v_before->>'workspaceId' is distinct from p_workspace_id::text or v_before->>'initiativeId' is distinct from v_item->>'initiativeId' or v_before->>'kind' is distinct from v_item->>'kind') then raise exception 'FACT_IDENTITY'; end if;
  if v_before is not distinct from v_item then continue; end if;
  if (v_item->>'revision')::integer<>coalesce((v_before->>'revision')::integer,0)+1 or v_item->>'confirmedByMemberId' is distinct from p_member_id::text then raise exception 'FACT_REVISION'; end if;
  if v_item->>'confirmedByLabel' is distinct from v_label then raise exception 'FACT_ACTOR'; end if;
  if v_item->>'kind'='OWNER' then
   if v_member.role<>'Admin' and not(v_member.role='Member' and v_member.is_product_lead) then raise exception 'OWNER_ACCESS'; end if;
   if v_item->>'state'='SET' and not exists(select 1 from public.memberships m where m.id=(v_item#>>'{value,memberId}')::uuid and m.workspace_id=p_workspace_id and m.active and m.role<>'Viewer') then raise exception 'OWNER_MEMBER'; end if;
  elsif v_member.role<>'Admin' then
   select (f.data#>>'{value,memberId}')::uuid into v_owner from public.delivery_facts f where f.workspace_id=p_workspace_id and f.initiative_id=(v_item->>'initiativeId')::uuid and f.kind='OWNER' and f.data->>'state'='SET';
   if v_owner is distinct from p_member_id then raise exception 'FACT_OWNER'; end if;
  end if;
  if v_item->>'basis'='EVIDENCE' and not exists(select 1 from public.evidence e where e.id=(v_item->>'evidenceId')::uuid and e.initiative_id=(v_item->>'initiativeId')::uuid and e.boundary='CURRENT_SCOPE') then raise exception 'EVIDENCE_BOUNDARY'; end if;
  if not exists(select 1 from jsonb_array_elements(p_next_state->'events') ev where ev->'after'=v_item and ev->'before' is not distinct from coalesce(v_before,'null'::jsonb)) then raise exception 'AUDIT_REQUIRED'; end if;
  insert into public.delivery_facts(id,workspace_id,initiative_id,kind,revision,value_date,value_text,owner_member_id,data) values((v_item->>'id')::uuid,p_workspace_id,(v_item->>'initiativeId')::uuid,v_item->>'kind',(v_item->>'revision')::integer,(v_item#>>'{value,date}')::date,v_item#>>'{value,text}',(v_item#>>'{value,memberId}')::uuid,v_item)
   on conflict(id) do update set revision=excluded.revision,value_date=excluded.value_date,value_text=excluded.value_text,owner_member_id=excluded.owner_member_id,data=excluded.data;
 end loop;
 for v_event in select value from jsonb_array_elements(p_next_state->'events') loop
  select value into v_before from jsonb_array_elements(p_expected_state->'events') e where e->>'id'=v_event->>'id';
  if found then if v_before is distinct from v_event then raise exception 'EVENT_IMMUTABLE'; end if; continue; end if;
  if v_event#>>'{actor,id}' is distinct from v_user::text or v_event#>>'{actor,label}' is distinct from v_label then raise exception 'EVENT_ACTOR'; end if;
  select value into v_before from jsonb_array_elements(p_expected_state->'facts') f where f->>'id'=v_event#>>'{after,id}';
  if v_event->'before' is distinct from coalesce(v_before,'null'::jsonb) then raise exception 'EVENT_BEFORE'; end if;
  if v_event->'after' is not distinct from v_before then raise exception 'EVENT_REVISION'; end if;
  if v_event->>'workspaceId'<>p_workspace_id::text or not exists(select 1 from public.delivery_facts f where f.id=(v_event#>>'{after,id}')::uuid and f.data=v_event->'after' and f.initiative_id=(v_event->>'initiativeId')::uuid and f.workspace_id=p_workspace_id) then raise exception 'EVENT_SCOPE'; end if;
  insert into public.activity_log(id,initiative_id,actor_id,event_type,summary,occurred_at,entity_type,entity_id,payload,actor_label) values((v_event->>'id')::uuid,(v_event->>'initiativeId')::uuid,v_user,'DELIVERY_FACT_RECORDED','Confirmed delivery '||(v_event#>>'{after,kind}'),(v_event->>'occurredAt')::timestamptz,'delivery_fact',(v_event#>>'{after,id}'),jsonb_build_object('schema',1,'deliveryEvent',v_event),v_label);
 end loop;
 v_live_input=public.delivery_camel(v_source)||jsonb_build_object('facts',p_next_state->'facts');
 for v_item in select value from jsonb_array_elements(p_next_state->'reviews') loop
  if v_item->>'workspaceId' is distinct from p_workspace_id::text then raise exception 'REVIEW_SCOPE'; end if;
  select r.data into v_review_before from public.weekly_reviews r where r.id=(v_item->>'id')::uuid;
  if v_review_before is not null and (v_review_before->>'workspaceId' is distinct from p_workspace_id::text or v_review_before->>'week' is distinct from v_item->>'week') then raise exception 'REVIEW_IDENTITY'; end if;
  if v_review_before is not distinct from v_item then continue; end if;
  if v_review_before->>'status'='FINAL' then raise exception 'FINAL_IMMUTABLE'; end if;
  if (v_item->>'revision')::integer is distinct from coalesce((v_review_before->>'revision')::integer,0)+1 then raise exception 'REVIEW_REVISION'; end if;
  if v_item->>'week' !~ '^\d{4}-W\d{2}$' or to_char(to_date((v_item->>'week')||'-1','IYYY-"W"IW-ID'),'IYYY-"W"IW') is distinct from v_item->>'week' or v_item->>'week'>to_char(clock_timestamp() at time zone 'Africa/Cairo','IYYY-"W"IW') then raise exception 'REVIEW_WEEK'; end if;
  if jsonb_typeof(v_item->'sections') is distinct from 'array' or jsonb_typeof(v_item->'aiDrafts') is distinct from 'array' or v_item#>>'{input,workspaceId}' is distinct from p_workspace_id::text then raise exception 'REVIEW_SHAPE'; end if;
  if nullif(v_item#>>'{input,asOf}','') is null or (v_item#>>'{input,asOf}')::timestamptz>clock_timestamp()+interval '1 minute' then raise exception 'REVIEW_CUTOFF'; end if;
  select r.id::text into v_baseline from public.weekly_reviews r where r.workspace_id=p_workspace_id and r.status='FINAL' and r.iso_week<v_item->>'week' order by r.iso_week desc limit 1;
  select max(r.iso_week) into v_latest_week from public.weekly_reviews r where r.workspace_id=p_workspace_id and r.status='FINAL';
  if v_review_before is null then
   if v_item->>'status' is distinct from 'DRAFT' or v_item->>'createdByMemberId' is distinct from p_member_id::text then raise exception 'DRAFT_CREATOR'; end if;
   if v_latest_week>=v_item->>'week' then raise exception 'OUT_OF_ORDER_WEEK'; end if;
  elsif (v_item - array['revision','input','baselineReviewId','sections','aiDrafts','status','finalizedAt','finalizedByMemberId','finalizedByLabel']) is distinct from (v_review_before - array['revision','input','baselineReviewId','sections','aiDrafts','status','finalizedAt','finalizedByMemberId','finalizedByLabel']) then raise exception 'REVIEW_METADATA'; end if;
  v_refresh=v_review_before is null or v_item->'input' is distinct from v_review_before->'input' or v_item->'baselineReviewId' is distinct from v_review_before->'baselineReviewId';
  v_ai=v_review_before is not null and v_item->'aiDrafts' is distinct from v_review_before->'aiDrafts';
  if v_refresh or v_item->>'status'='FINAL' then
   if public.delivery_meaningful(v_item#>'{input,snapshots}') is distinct from public.delivery_meaningful(v_live_input->'snapshots') or public.delivery_meaningful(v_item#>'{input,members}') is distinct from public.delivery_meaningful(v_live_input->'members') or v_item#>'{input,facts}' is distinct from v_live_input->'facts' or v_item#>'{input,events}' is distinct from (public.delivery_state(p_workspace_id)->'events') then raise exception 'STALE_REVIEW_INPUT'; end if;
   if v_item->>'baselineReviewId' is distinct from v_baseline then raise exception 'STALE_BASELINE'; end if;
  end if;
  if v_ai and (v_refresh or jsonb_array_length(v_item->'aiDrafts')<>jsonb_array_length(v_review_before->'aiDrafts')+1 or ((v_item->'aiDrafts') - (jsonb_array_length(v_item->'aiDrafts')-1)) is distinct from v_review_before->'aiDrafts' or ((v_item->'aiDrafts')->-1)->>'inputDigest' is distinct from v_item#>>'{input,digest}') then raise exception 'AI_HISTORY'; end if;
  -- Every frozen initiative has exactly one section. No caller can manufacture
  -- an empty reviewed portfolio, foreign section or hidden duplicate.
  if jsonb_array_length(v_item->'sections')<>jsonb_array_length(v_item#>'{input,snapshots}') or exists(select 1 from jsonb_array_elements(v_item->'sections') s where not exists(select 1 from jsonb_array_elements(v_item#>'{input,snapshots}') snap where snap#>>'{initiative,id}'=s->>'initiativeId')) or exists(select 1 from jsonb_array_elements(v_item->'sections') s group by s->>'initiativeId' having count(*)<>1) then raise exception 'SECTION_INVENTORY'; end if;
  if v_item->>'status'='FINAL' then
   if not v_is_coordinator then raise exception 'FINALIZE_ACCESS'; end if;
   if v_review_before is null or v_review_before->>'status' is distinct from 'DRAFT' then raise exception 'FINAL_TRANSITION'; end if;
   if v_latest_week>v_item->>'week' then raise exception 'OUT_OF_ORDER_FINAL'; end if;
   if v_item->>'finalizedByMemberId' is distinct from p_member_id::text or v_item->>'finalizedByLabel' is distinct from v_label or nullif(v_item->>'finalizedAt','') is null then raise exception 'FINAL_ACTOR'; end if;
   if (v_item->>'finalizedAt')::timestamptz<(v_item#>>'{input,asOf}')::timestamptz or (v_item->>'finalizedAt')::timestamptz>clock_timestamp()+interval '1 minute' then raise exception 'FINAL_CUTOFF'; end if;
   if (v_item - array['status','revision','finalizedAt','finalizedByMemberId','finalizedByLabel']) is distinct from (v_review_before - array['status','revision','finalizedAt','finalizedByMemberId','finalizedByLabel']) then raise exception 'FINAL_CONTENT'; end if;
   if exists(select 1 from jsonb_array_elements(v_item->'sections') s where s->'needsRecheck' is distinct from 'false'::jsonb or nullif(s->>'editedAt','') is null or not exists(select 1 from public.memberships m where m.id=(s->>'editedByMemberId')::uuid and m.workspace_id=p_workspace_id and m.active and m.role<>'Viewer')) then raise exception 'SECTION_REVIEW_REQUIRED'; end if;
  elsif v_item->>'status' is distinct from 'DRAFT' or v_item->>'finalizedByMemberId' is not null or v_item->>'finalizedAt' is not null or v_item->>'finalizedByLabel' is not null then raise exception 'DRAFT_FINAL_METADATA';
  end if;
  for v_section in select value from jsonb_array_elements(v_item->'sections') loop
   select value into v_old_section from jsonb_array_elements(coalesce(v_review_before->'sections','[]'::jsonb)) where value->>'initiativeId'=v_section->>'initiativeId';
   if v_section is not distinct from v_old_section then continue; end if;
   if (v_section->>'revision')::integer is distinct from coalesce((v_old_section->>'revision')::integer,0)+1 then raise exception 'SECTION_REVISION'; end if;
   select (f.data#>>'{value,memberId}')::uuid into v_owner from public.delivery_facts f where f.workspace_id=p_workspace_id and f.initiative_id=(v_section->>'initiativeId')::uuid and f.kind='OWNER' and f.data->>'state'='SET';
   if v_refresh then
    if v_section->>'ownerMemberId' is distinct from v_owner::text then raise exception 'SECTION_OWNER_SNAPSHOT'; end if;
    if v_old_section is null then
     if v_section->>'editedByMemberId' is not null or v_section->>'editedAt' is not null or v_section->'aiOriginal'<>'null'::jsonb or v_section->'needsRecheck' is distinct from 'false'::jsonb then raise exception 'SECTION_CREATE_REVIEW'; end if;
    else
     if (v_section-array['ownerMemberId','sourceDigest','revision','needsRecheck']) is distinct from (v_old_section-array['ownerMemberId','sourceDigest','revision','needsRecheck']) then raise exception 'REFRESH_PRESERVES_TEXT'; end if;
     v_section_changed=public.delivery_section_input(v_item->'input',v_section->>'initiativeId') is distinct from public.delivery_section_input(v_review_before->'input',v_section->>'initiativeId') or v_item->'baselineReviewId' is distinct from v_review_before->'baselineReviewId';
     if (v_section_changed or v_old_section->'needsRecheck'='true'::jsonb) and v_section->'needsRecheck' is distinct from 'true'::jsonb then raise exception 'REFRESH_RECHECK_REQUIRED'; end if;
    end if;
   else
    -- Includes structural markers, not only the six visible narrative fields.
    if not v_is_coordinator and (v_owner is distinct from p_member_id or v_old_section->>'ownerMemberId' is distinct from p_member_id::text) then raise exception 'SECTION_OWNER'; end if;
    if v_old_section is null or v_section->>'ownerMemberId' is distinct from v_old_section->>'ownerMemberId' or v_section->>'sourceDigest' is distinct from v_old_section->>'sourceDigest' or public.delivery_section_input(v_item->'input',v_section->>'initiativeId') is distinct from public.delivery_section_input(v_live_input,v_section->>'initiativeId') then raise exception 'STALE_SECTION_INPUT'; end if;
    if v_ai then
     if v_section->'needsRecheck' is distinct from 'true'::jsonb or (v_section-array['updates','revision','needsRecheck','aiOriginal']) is distinct from (v_old_section-array['updates','revision','needsRecheck','aiOriginal']) then raise exception 'AI_REVIEW_REQUIRED'; end if;
    elsif v_section->>'editedByMemberId' is distinct from p_member_id::text or nullif(v_section->>'editedAt','') is null or v_section->'needsRecheck' is distinct from 'false'::jsonb or v_section->'aiOriginal' is distinct from v_old_section->'aiOriginal' then raise exception 'SECTION_REVIEW_ACTOR'; end if;
   end if;
  end loop;
  insert into public.weekly_reviews(id,workspace_id,iso_week,status,revision,data) values((v_item->>'id')::uuid,p_workspace_id,v_item->>'week',v_item->>'status',(v_item->>'revision')::integer,v_item)
   on conflict(id) do update set status=excluded.status,revision=excluded.revision,data=excluded.data;
 end loop;
end; $$;
revoke all on function public.delivery_final_immutable(),public.delivery_source(uuid),public.delivery_state(uuid),public.delivery_meaningful(jsonb),public.delivery_camel(jsonb),public.delivery_section_input(jsonb,text),public.delivery_read_workspace(uuid,uuid),public.delivery_commit_workspace(uuid,uuid,jsonb,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.delivery_source(uuid),public.delivery_state(uuid),public.delivery_meaningful(jsonb),public.delivery_camel(jsonb),public.delivery_section_input(jsonb,text),public.delivery_read_workspace(uuid,uuid),public.delivery_commit_workspace(uuid,uuid,jsonb,jsonb,jsonb) to service_role;
commit;
