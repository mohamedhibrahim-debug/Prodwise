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

-- Service-role-only transaction. The server computes and validates transitions;
-- this RPC additionally enforces membership, row ownership, scope, immutable
-- finals, expected snapshot/state equality and real initiative audit references.
create function public.delivery_commit_workspace(p_workspace_id uuid,p_member_id uuid,p_expected_source jsonb,p_expected_state jsonb,p_next_state jsonb) returns void language plpgsql set search_path='' as $$
declare
 v_member public.memberships%rowtype; v_item jsonb; v_before jsonb; v_event jsonb; v_review_before jsonb;
 v_owner uuid; v_user uuid; v_label text;
begin
 perform 1 from public.workspaces where id=p_workspace_id for update;
 perform public.require_workspace_member(p_workspace_id,p_member_id,false,true);
 select * into v_member from public.memberships where id=p_member_id and workspace_id=p_workspace_id and active for update;
 if not found or v_member.role='Viewer' then raise exception 'WRITE_ACCESS'; end if;
 select u.id,u.display_name into v_user,v_label from public.users u where u.id=v_member.user_id;
 -- Source rows are locked while final checks run so evidence, claims, boundary,
 -- owner membership and scope mutations cannot race with review finalization.
 perform 1 from public.memberships where workspace_id=p_workspace_id for share;
 perform 1 from public.initiatives where workspace_id=p_workspace_id for update;
 perform 1 from public.evidence e join public.initiatives i on i.id=e.initiative_id where i.workspace_id=p_workspace_id for update of e;
 perform 1 from public.claims c join public.initiatives i on i.id=c.initiative_id where i.workspace_id=p_workspace_id for update of c;
 perform 1 from public.claim_evidence ce join public.claims c on c.id=ce.claim_id join public.initiatives i on i.id=c.initiative_id where i.workspace_id=p_workspace_id for update of ce;
 perform 1 from public.finding_states f join public.initiatives i on i.id=f.initiative_id where i.workspace_id=p_workspace_id for update of f;
 if public.delivery_meaningful(public.delivery_source(p_workspace_id)) is distinct from public.delivery_meaningful(p_expected_source) then raise exception 'STALE_SOURCE'; end if;
 if public.delivery_state(p_workspace_id) is distinct from p_expected_state then raise exception 'STALE_STATE'; end if;
 if p_next_state->>'schema'<>'1' or jsonb_typeof(p_next_state->'facts')<>'array' or jsonb_typeof(p_next_state->'reviews')<>'array' or jsonb_typeof(p_next_state->'events')<>'array' then raise exception 'INVALID_STATE'; end if;
 if exists(select 1 from jsonb_array_elements(p_expected_state->'facts') x where not exists(select 1 from jsonb_array_elements(p_next_state->'facts') n where n->>'id'=x->>'id')) or exists(select 1 from jsonb_array_elements(p_expected_state->'reviews') x where not exists(select 1 from jsonb_array_elements(p_next_state->'reviews') n where n->>'id'=x->>'id')) then raise exception 'NO_HARD_DELETE'; end if;
 for v_item in select value from jsonb_array_elements(p_next_state->'facts') loop
  if v_item->>'workspaceId'<>p_workspace_id::text or not exists(select 1 from public.initiatives i where i.id=(v_item->>'initiativeId')::uuid and i.workspace_id=p_workspace_id) then raise exception 'FACT_SCOPE'; end if;
  select f.data into v_before from public.delivery_facts f where f.id=(v_item->>'id')::uuid;
  if v_before is not distinct from v_item then continue; end if;
  if (v_item->>'revision')::integer<>coalesce((v_before->>'revision')::integer,0)+1 or v_item->>'confirmedByMemberId'<>p_member_id::text then raise exception 'FACT_REVISION'; end if;
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
  if exists(select 1 from jsonb_array_elements(p_expected_state->'events') e where e->>'id'=v_event->>'id') then continue; end if;
  if v_event->>'workspaceId'<>p_workspace_id::text or not exists(select 1 from public.delivery_facts f where f.id=(v_event#>>'{after,id}')::uuid and f.data=v_event->'after' and f.initiative_id=(v_event->>'initiativeId')::uuid and f.workspace_id=p_workspace_id) then raise exception 'EVENT_SCOPE'; end if;
  insert into public.activity_log(id,initiative_id,actor_id,event_type,summary,occurred_at,entity_type,entity_id,payload,actor_label) values((v_event->>'id')::uuid,(v_event->>'initiativeId')::uuid,v_user,'DELIVERY_FACT_RECORDED','Confirmed delivery '||(v_event#>>'{after,kind}'),(v_event->>'occurredAt')::timestamptz,'delivery_fact',(v_event#>>'{after,id}'),jsonb_build_object('schema',1,'deliveryEvent',v_event),v_label);
 end loop;
 for v_item in select value from jsonb_array_elements(p_next_state->'reviews') loop
  if v_item->>'workspaceId'<>p_workspace_id::text then raise exception 'REVIEW_SCOPE'; end if;
  select r.data into v_review_before from public.weekly_reviews r where r.id=(v_item->>'id')::uuid;
  if v_review_before is not distinct from v_item then continue; end if;
  if v_review_before->>'status'='FINAL' then raise exception 'FINAL_IMMUTABLE'; end if;
  if (v_item->>'revision')::integer<>coalesce((v_review_before->>'revision')::integer,0)+1 then raise exception 'REVIEW_REVISION'; end if;
  if v_item->>'status'='FINAL' and not(v_member.role='Admin' or (v_member.role='Member' and v_member.is_product_lead)) then raise exception 'FINALIZE_ACCESS'; end if;
  if v_member.role<>'Admin' and not v_member.is_product_lead and v_review_before is not null then
   for v_before in select value from jsonb_array_elements(v_item->'sections') loop
    if exists(select 1 from jsonb_array_elements(v_review_before->'sections') oldsection where oldsection->>'initiativeId'=v_before->>'initiativeId' and (oldsection->>'headline' is distinct from v_before->>'headline' or oldsection->>'updates' is distinct from v_before->>'updates' or oldsection->>'attention' is distinct from v_before->>'attention' or oldsection->>'decisionNeeded' is distinct from v_before->>'decisionNeeded' or oldsection->>'nextMilestone' is distinct from v_before->>'nextMilestone' or oldsection->>'nextStep' is distinct from v_before->>'nextStep')) then
     select (f.data#>>'{value,memberId}')::uuid into v_owner from public.delivery_facts f where f.workspace_id=p_workspace_id and f.initiative_id=(v_before->>'initiativeId')::uuid and f.kind='OWNER' and f.data->>'state'='SET';
     if v_owner is distinct from p_member_id then raise exception 'SECTION_OWNER'; end if;
    end if;
   end loop;
  end if;
  insert into public.weekly_reviews(id,workspace_id,iso_week,status,revision,data) values((v_item->>'id')::uuid,p_workspace_id,v_item->>'week',v_item->>'status',(v_item->>'revision')::integer,v_item)
   on conflict(id) do update set status=excluded.status,revision=excluded.revision,data=excluded.data;
 end loop;
end; $$;
revoke all on function public.delivery_final_immutable(),public.delivery_source(uuid),public.delivery_state(uuid),public.delivery_meaningful(jsonb),public.delivery_read_workspace(uuid,uuid),public.delivery_commit_workspace(uuid,uuid,jsonb,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.delivery_source(uuid),public.delivery_state(uuid),public.delivery_meaningful(jsonb),public.delivery_read_workspace(uuid,uuid),public.delivery_commit_workspace(uuid,uuid,jsonb,jsonb,jsonb) to service_role;
commit;
