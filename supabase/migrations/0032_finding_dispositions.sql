-- Append-only queue dispositions. Findings, real decisions and their digests stay unchanged.
begin;
create table public.finding_dispositions(
 id uuid primary key,workspace_id uuid not null,organization_id uuid not null references public.organizations(id),initiative_id uuid not null,finding_id text not null,
 kind text not null check(kind in ('DEFERRED','DISMISSED','WITHDRAWN')),underlying_digest text not null,
 defer_until date,defer_until_next_review boolean not null default false,reason text not null,actor jsonb not null,at timestamptz not null default clock_timestamp(),client_request_id uuid not null,
 data jsonb not null,input jsonb not null,
 unique(organization_id,client_request_id),foreign key(workspace_id,organization_id) references public.workspaces(id,organization_id),foreign key(initiative_id,workspace_id) references public.initiatives(id,workspace_id),
 check(length(reason)<=2000 and (kind='WITHDRAWN' or length(btrim(reason))>0)),
 check((kind='DEFERRED' and ((defer_until is not null)::integer+defer_until_next_review::integer)=1) or (kind<>'DEFERRED' and defer_until is null and not defer_until_next_review))
);
create index finding_disposition_latest on public.finding_dispositions(organization_id,finding_id,at desc,id desc);
alter table public.finding_dispositions enable row level security;
revoke all on public.finding_dispositions from public,anon,authenticated,service_role;
grant select on public.finding_dispositions to service_role;
create function public.disposition_immutable() returns trigger language plpgsql set search_path='' as $$begin raise exception 'DISPOSITION_APPEND_ONLY';end$$;
create trigger disposition_immutable before update or delete on public.finding_dispositions for each row execute function public.disposition_immutable();
create trigger archived_disposition_guard before insert on public.finding_dispositions for each row execute function public.guard_archived_product_write();
-- Root's Minimum Context migration extends this helper, without a competing hash implementation.
create function public.queue_current_finding(p_workspace_id uuid,p_initiative_id uuid,p_finding_id text) returns jsonb language plpgsql set search_path='' as $$
declare g record;c public.claims;e record;ids uuid[];vals text[];parts text[];digest_parts text[];fp text;first_claim public.claims;claim_revisions jsonb;evidence_ids jsonb;state public.finding_states;begin
 for g in select public.decision_normalise(subject) subject_key,public.decision_normalise(attribute) attribute_key,nullif(public.decision_normalise(phase),'') phase_key from public.claims where workspace_id=p_workspace_id and initiative_id=p_initiative_id and status='ACTIVE' and nullif(public.decision_normalise(subject),'') is not null and nullif(public.decision_normalise(attribute),'') is not null and nullif(public.decision_normalise(value),'') is not null group by 1,2,3 loop
  ids:=array(select id from public.claims where workspace_id=p_workspace_id and initiative_id=p_initiative_id and status='ACTIVE' and public.decision_normalise(subject)=g.subject_key and public.decision_normalise(attribute)=g.attribute_key and nullif(public.decision_normalise(phase),'') is not distinct from g.phase_key and nullif(public.decision_normalise(value),'') is not null order by id);
  vals:=array(select distinct public.decision_normalise(value) collate "C" from public.claims where id=any(ids) order by 1);
  if array_length(vals,1)<2 or exists(select 1 from public.claims where id=any(ids) and superseded_by_claim_id=any(ids)) then continue;end if;
  parts:=array['CONFLICT_SAME_ATTRIBUTE_V1',p_initiative_id::text,g.subject_key,g.attribute_key,g.phase_key]||vals;fp:=public.decision_hash(parts);if fp<>p_finding_id then continue;end if;
  digest_parts:=array[fp];claim_revisions:='[]'::jsonb;evidence_ids:='[]'::jsonb;
  for c in select * from public.claims where id=any(ids) order by id loop
   digest_parts:=digest_parts||array[c.id::text,c.value,c.status::text,c.phase];claim_revisions:=claim_revisions||jsonb_build_array(jsonb_build_object('id',c.id,'updatedAt',c.updated_at));
   for e in select ev.id,ev.boundary,ev.source_reference from public.claim_evidence ce join public.evidence ev on ev.id=ce.evidence_id where ce.claim_id=c.id and ce.workspace_id=p_workspace_id and ev.workspace_id=p_workspace_id order by ev.id loop digest_parts:=digest_parts||array[e.id::text,e.boundary::text,e.source_reference];evidence_ids:=evidence_ids||jsonb_build_array(e.id);end loop;
   digest_parts:=array_append(digest_parts,null);
  end loop;
  select * into state from public.finding_states where workspace_id=p_workspace_id and initiative_id=p_initiative_id and fingerprint=fp;
  return jsonb_build_object('fingerprint',fp,'digest',public.decision_hash(digest_parts),'claimIds',to_jsonb(ids),'claimRevisions',claim_revisions,'evidenceIds',evidence_ids,'resolved',state.status='RESOLVED' and state.outcome is null and (state.content_digest is null or state.content_digest=public.decision_hash(digest_parts)));
 end loop;return null;
end$$;
create unique index queue_reopen_observation on public.activity_log(workspace_id,(payload->>'dispositionId'),(payload->>'reopenReason')) where event_type='FINDING_DISPOSITION_REOPENED';
create function public.read_finding_dispositions(p_workspace_id uuid,p_member_id uuid,p_initiative_id uuid,p_as_of timestamptz) returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.finding_dispositions;f jsonb;reopen_reason text;day_value date:=(p_as_of at time zone 'Africa/Cairo')::date;begin
 perform public.require_workspace_member(p_workspace_id,p_member_id,false,false);
 if not exists(select 1 from public.initiatives where id=p_initiative_id and workspace_id=p_workspace_id) then raise exception 'INITIATIVE_ACCESS';end if;
 for r in select distinct on(finding_id) * from public.finding_dispositions where workspace_id=p_workspace_id and initiative_id=p_initiative_id and at<=p_as_of order by finding_id,at desc,id desc loop
  if r.kind='WITHDRAWN' then continue;end if;f:=public.queue_current_finding(p_workspace_id,p_initiative_id,r.finding_id);if f is null or coalesce((f->>'resolved')::boolean,false) then continue;end if;reopen_reason:=null;
  if f->>'digest'<>r.underlying_digest then reopen_reason:=case when r.kind='DISMISSED' then 'evidence changed since dismissal on '||to_char(r.at at time zone 'Africa/Cairo','FMDD Mon') else 'evidence changed since deferral' end;
  elsif r.kind='DEFERRED' and r.defer_until is not null and day_value>=r.defer_until then reopen_reason:='deferral ended '||to_char(r.defer_until,'FMDD Mon');
  elsif r.kind='DEFERRED' and r.defer_until_next_review and exists(select 1 from public.weekly_reviews where workspace_id=p_workspace_id and status='FINAL' and (data->>'finalizedAt')::timestamptz>r.at and (data->>'finalizedAt')::timestamptz<=p_as_of) then reopen_reason:='the next Weekly Review was finalized';end if;
  if reopen_reason is not null and not exists(select 1 from public.initiatives where id=p_initiative_id and archived_at is not null) then insert into public.activity_log(workspace_id,initiative_id,event_type,summary,entity_type,entity_id,payload,occurred_at) values(p_workspace_id,p_initiative_id,'FINDING_DISPOSITION_REOPENED','Reopened: '||reopen_reason||'.','finding',r.finding_id,jsonb_build_object('dispositionId',r.id,'reopenReason',reopen_reason,'observedByEvaluator',true),p_as_of) on conflict do nothing;end if;
 end loop;
 return jsonb_build_object('dispositions',coalesce((select jsonb_agg(data order by at,id) from public.finding_dispositions where workspace_id=p_workspace_id and initiative_id=p_initiative_id),'[]'::jsonb),'finalizations',coalesce((select jsonb_agg(jsonb_build_object('id',id,'workspaceId',workspace_id,'finalizedAt',data->>'finalizedAt')) from public.weekly_reviews where workspace_id=p_workspace_id and status='FINAL'),'[]'::jsonb));
end$$;
create function public.record_disposition(p_workspace_id uuid,p_member_id uuid,p_input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor public.organization_memberships;i public.initiatives;org_id uuid;prior public.finding_dispositions;latest public.finding_dispositions;f jsonb;request uuid;at_time timestamptz:=clock_timestamp();kind_value text:=p_input->>'kind';until_date date:=nullif(p_input->>'deferUntil','')::date;next_review boolean:=coalesce((p_input->>'deferUntilNextReview')::boolean,false);reason_value text:=coalesce(p_input->>'reason','');row_id uuid:=gen_random_uuid();payload jsonb;actor_label text;active_value boolean;begin
 begin actor:=public.require_workspace_member(p_workspace_id,p_member_id,false,true);exception when others then return jsonb_build_object('code',case when sqlerrm like '%ARCHIVED%' then 'archived' else 'forbidden' end,'message','Your current access does not allow this change.');end;
 if p_input->>'workspaceId' is distinct from p_workspace_id::text then return jsonb_build_object('code','forbidden','message','Organization changed.');end if;
 select organization_id into org_id from public.workspaces where id=p_workspace_id;
 select * into i from public.initiatives where id=(p_input->>'initiativeId')::uuid and workspace_id=p_workspace_id for update;if not found then return jsonb_build_object('code','forbidden','message','Initiative unavailable.');end if;if i.archived_at is not null then return jsonb_build_object('code','archived','message','Archived — restore to edit. Nothing changed.');end if;
 request:=(p_input->>'clientRequestId')::uuid;perform pg_advisory_xact_lock(hashtextextended(org_id::text||':disposition:'||request::text,0));
 select * into prior from public.finding_dispositions where organization_id=org_id and client_request_id=request;
 if found then if prior.input<>p_input or prior.actor->>'id'<>actor.user_id::text then return jsonb_build_object('code','invalid','message','This request was already used.');end if;return jsonb_build_object('code','ok','row',prior.data,'replay',true);end if;
 -- Lock the whole derived comparison and its support; the finding itself is not a stored row.
 perform 1 from public.claims where initiative_id=i.id and workspace_id=p_workspace_id order by id for update;
 perform 1 from public.claim_evidence ce join public.evidence e on e.id=ce.evidence_id where ce.claim_id in(select id from public.claims where initiative_id=i.id and workspace_id=p_workspace_id) order by ce.claim_id,e.id for share of ce,e;
 f:=public.queue_current_finding(p_workspace_id,i.id,p_input->>'findingId');
 if f is null or f->>'digest' is distinct from p_input->>'expectedDigest' then return jsonb_build_object('code','digest_conflict','message','The compared claims changed. Your reason is retained; review the current comparison.');end if;
 select * into latest from public.finding_dispositions where workspace_id=p_workspace_id and initiative_id=i.id and finding_id=p_input->>'findingId' order by at desc,id desc limit 1;
 if latest.id::text is distinct from p_input->>'expectedLatestDispositionId' then return jsonb_build_object('code','disposition_conflict','message','Another person changed this queue item. Your reason is retained.','latest',latest.data);end if;
 if kind_value is null or kind_value not in ('DEFERRED','DISMISSED','WITHDRAWN') or length(reason_value)>2000 or (kind_value<>'WITHDRAWN' and length(btrim(reason_value))=0) or coalesce((f->>'resolved')::boolean,false) then return jsonb_build_object('code','invalid','message','Enter a reason for an unresolved comparison.');end if;
 if kind_value='DEFERRED' then if ((until_date is not null)::integer+next_review::integer)<>1 or (until_date is not null and (until_date<=(at_time at time zone 'Africa/Cairo')::date or until_date::text<>p_input->>'deferUntil')) then return jsonb_build_object('code','invalid','message','Choose a future date or the next Weekly Review.');end if;
 elsif until_date is not null or next_review then return jsonb_build_object('code','invalid','message','Only a deferral has an end condition.');end if;
 if kind_value='WITHDRAWN' then active_value:=latest.kind in ('DEFERRED','DISMISSED') and latest.underlying_digest=f->>'digest' and (latest.kind='DISMISSED' or latest.defer_until>(at_time at time zone 'Africa/Cairo')::date or latest.defer_until_next_review and not exists(select 1 from public.weekly_reviews where workspace_id=p_workspace_id and status='FINAL' and (data->>'finalizedAt')::timestamptz>latest.at and (data->>'finalizedAt')::timestamptz<=at_time));if not coalesce(active_value,false) then return jsonb_build_object('code','invalid','message','Already open.');end if;end if;
 select display_name into actor_label from public.users where id=actor.user_id;
 payload:=p_input||jsonb_build_object('id',row_id,'organizationId',org_id,'underlyingDigest',f->>'digest','actor',jsonb_build_object('id',actor.user_id,'label',actor_label),'at',at_time,'claimIds',f->'claimIds','evidenceIds',f->'evidenceIds','claimRevisions',f->'claimRevisions');
 insert into public.finding_dispositions values(row_id,p_workspace_id,org_id,i.id,p_input->>'findingId',kind_value,f->>'digest',until_date,next_review,reason_value,jsonb_build_object('id',actor.user_id,'label',actor_label),at_time,request,payload,p_input);
 insert into public.activity_log(workspace_id,initiative_id,actor_id,actor_label,event_type,summary,entity_type,entity_id,payload,occurred_at) values(p_workspace_id,i.id,actor.user_id,actor_label,'FINDING_'||kind_value,case when kind_value='WITHDRAWN' then 'Returned to Open.' else initcap(kind_value)||': '||reason_value end,'finding',p_input->>'findingId',jsonb_build_object('dispositionId',row_id,'findingId',p_input->>'findingId','digest',f->>'digest','clientRequestId',request),at_time);
 return jsonb_build_object('code','ok','row',payload,'replay',false);
exception when invalid_text_representation or datetime_field_overflow then return jsonb_build_object('code','invalid','message','Invalid request fields. Nothing changed.');
end$$;
revoke all on function public.disposition_immutable(),public.queue_current_finding(uuid,uuid,text),public.read_finding_dispositions(uuid,uuid,uuid,timestamptz),public.record_disposition(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.queue_current_finding(uuid,uuid,text),public.read_finding_dispositions(uuid,uuid,uuid,timestamptz),public.record_disposition(uuid,uuid,jsonb) to service_role;
-- Only future snapshots carry queue history. Never rewrite existing FINAL data.
alter function public.delivery_source(uuid) rename to delivery_source_before_queue;
create function public.delivery_source(p_workspace_id uuid) returns jsonb language sql stable set search_path='' as $$select public.delivery_source_before_queue(p_workspace_id)||case when exists(select 1 from public.finding_dispositions where workspace_id=p_workspace_id) then jsonb_build_object('findingDispositions',coalesce((select jsonb_agg(data order by id) from public.finding_dispositions where workspace_id=p_workspace_id),'[]'::jsonb),'queueFinalizations',coalesce((select jsonb_agg(jsonb_build_object('id',id,'workspaceId',workspace_id,'finalizedAt',data->>'finalizedAt') order by id) from public.weekly_reviews where workspace_id=p_workspace_id and status='FINAL'),'[]'::jsonb)) else '{}'::jsonb end$$;
revoke all on function public.delivery_source(uuid),public.delivery_source_before_queue(uuid) from public,anon,authenticated;
grant execute on function public.delivery_source(uuid),public.delivery_source_before_queue(uuid) to service_role;
do $$declare definition text;needle text:='if public.delivery_meaningful(v_item#>''{input,snapshots}'')';begin
 select pg_get_functiondef('public.delivery_commit_workspace(uuid,uuid,jsonb,jsonb,jsonb)'::regprocedure) into definition;
 if position(needle in definition)=0 then raise exception 'QUEUE_SNAPSHOT_PATCH_TARGET_MISSING';end if;
 definition:=replace(definition,needle,'if coalesce(v_item#>''{input,findingDispositions}'',''[]''::jsonb) is distinct from coalesce(v_live_input->''findingDispositions'',''[]''::jsonb) or coalesce(v_item#>''{input,queueFinalizations}'',''[]''::jsonb) is distinct from coalesce(v_live_input->''queueFinalizations'',''[]''::jsonb) then raise exception ''STALE_QUEUE'';end if; '||needle);execute definition;
end$$;
commit;
