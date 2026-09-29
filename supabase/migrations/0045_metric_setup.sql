-- Metric setup (polish pass, decision D2): people define metrics and record observations in the
-- product instead of sending them to an operator. Two functions mirror src/lib/analysis/metric-actions.ts:
--   record_metric_definition  — origin HUMAN_ENTRY, revision 1, a target only with all four approval
--                                fields, an activity_log entry; the caller confirms explicitly first.
--   record_metric_observation — a value or a note (never zero for missing), one row per period, only on
--                                HUMAN_ENTRY metrics; synthetic demo metrics stay read-only.
-- Authorization inside the function, not only in the UI: the initiative's owner, an Org Owner, an Admin or a
-- Product Lead; Viewers are refused by require_workspace_member(..., p_write => true). RLS stays deny-all;
-- the server role gains insert (and the updated_at touch) on the two 0017 tables, exactly as later P1 tables.
-- Written for the hosted path; NOT applied to hosted Supabase by this change (the owner decides).
begin;
grant insert on public.metric_definitions, public.metric_observations to service_role;
grant update (updated_at) on public.metric_definitions to service_role;
create trigger reject_archived_write before insert or update or delete on public.metric_definitions for each row execute function public.guard_archived_product_write();

create function public.record_metric_definition(p_workspace_id uuid, p_member_id uuid, p_initiative_id uuid, p_input jsonb) returns uuid language plpgsql set search_path='' as $$
declare actor public.organization_memberships; actor_label text; i public.initiatives; owner_id uuid; elevated boolean; mid uuid := gen_random_uuid();
 v_name text := btrim(coalesce(p_input->>'name','')); v_definition text := btrim(coalesce(p_input->>'definition','')); v_unit text := btrim(coalesce(p_input->>'unit',''));
 v_formula text := btrim(coalesce(p_input->>'formula','')); v_source text := btrim(coalesce(p_input->>'sourceLabel','')); v_grain text := btrim(coalesce(p_input->>'periodGrain',''));
 v_zone text := btrim(coalesce(p_input->>'timezone','')); v_evidence uuid := nullif(p_input->>'sourceEvidenceId','')::uuid; t jsonb := p_input->'target';
 t_value numeric; t_comparator text; t_owner text; t_approved timestamptz; t_note text;
begin
 actor := public.require_workspace_member(p_workspace_id, p_member_id, false, true);
 select display_name into actor_label from public.users where id = actor.user_id;
 select * into i from public.initiatives where id = p_initiative_id and workspace_id = p_workspace_id for share;
 if not found then raise exception 'INITIATIVE_ACCESS'; end if;
 if i.archived_at is not null then raise exception 'INITIATIVE_ARCHIVED'; end if;
 owner_id := public.initiative_owner_member(p_workspace_id, i.id);
 elevated := public.principal_is_admin(actor.user_id, actor.role) or actor.is_product_lead or owner_id = actor.id;
 if not coalesce(elevated, false) then raise exception 'METRIC_PERMISSION'; end if;
 -- A definition exists only after an explicit confirm step.
 if coalesce(p_input->>'confirmed','') <> 'yes' then raise exception 'METRIC_CONFIRMATION_REQUIRED'; end if;
 if length(v_name) not between 1 and 160 or length(v_definition) not between 1 and 2000 or length(v_unit) not between 1 and 40 or length(v_formula) not between 1 and 2000
    or length(v_source) not between 1 and 160 or length(v_grain) not between 1 and 80 or length(v_zone) not between 1 and 64 then raise exception 'METRIC_FIELDS'; end if;
 if v_evidence is not null and not exists (select 1 from public.evidence e where e.id = v_evidence and e.workspace_id = p_workspace_id and e.initiative_id = i.id and e.boundary <> 'EXCLUDED') then raise exception 'METRIC_SOURCE_SCOPE'; end if;
 if t is not null and jsonb_typeof(t) = 'object' then
  t_value := (t->>'value')::numeric; t_comparator := t->>'comparator'; t_owner := btrim(coalesce(t->>'ownerLabel','')); t_approved := (t->>'approvedAt')::timestamptz; t_note := nullif(btrim(coalesce(t->>'note','')),'');
  -- All four or nothing; the table constraint enforces the same rule again.
  if t_value is null or t_comparator not in ('AT_MOST','AT_LEAST','EQUAL') or length(t_owner) not between 1 and 160 or t_approved is null or t_approved > clock_timestamp() or coalesce(length(t_note),0) > 1000 then raise exception 'METRIC_TARGET_FIELDS'; end if;
 end if;
 insert into public.metric_definitions(id, organization_id, workspace_id, initiative_id, name, definition, unit, formula, source_label, source_evidence_id, period_grain, timezone, target_value, target_comparator, target_owner_label, target_approved_at, target_note, origin, revision)
 values (mid, actor.organization_id, p_workspace_id, i.id, v_name, v_definition, v_unit, v_formula, v_source, v_evidence, v_grain, v_zone, t_value, t_comparator, t_owner, t_approved, t_note, 'HUMAN_ENTRY', 1);
 insert into public.activity_log(workspace_id, initiative_id, actor_id, actor_label, event_type, summary, entity_type, entity_id, payload)
 values (p_workspace_id, i.id, actor.user_id, actor_label, 'METRIC_DEFINED', 'Metric defined: ' || v_name, 'METRIC', mid,
  jsonb_build_object('metricId', mid, 'name', v_name, 'unit', v_unit, 'periodGrain', v_grain, 'sourceLabel', v_source, 'sourceEvidenceId', v_evidence,
   'target', case when t_value is null then null else jsonb_build_object('value', t_value, 'comparator', t_comparator, 'ownerLabel', t_owner, 'approvedAt', t_approved) end,
   'actor', jsonb_build_object('id', actor.user_id, 'label', actor_label)));
 return mid;
end$$;

create function public.record_metric_observation(p_workspace_id uuid, p_member_id uuid, p_metric_id uuid, p_input jsonb) returns uuid language plpgsql set search_path='' as $$
declare actor public.organization_memberships; actor_label text; m public.metric_definitions; i public.initiatives; owner_id uuid; elevated boolean; oid uuid := gen_random_uuid();
 v_start date := (p_input->>'periodStart')::date; v_end date := (p_input->>'periodEnd')::date; v_value numeric := (p_input->>'value')::numeric;
 v_note text := btrim(coalesce(p_input->>'note','')); v_captured timestamptz := (p_input->>'capturedAt')::timestamptz; v_evidence uuid := nullif(p_input->>'sourceEvidenceId','')::uuid;
begin
 actor := public.require_workspace_member(p_workspace_id, p_member_id, false, true);
 select display_name into actor_label from public.users where id = actor.user_id;
 select * into m from public.metric_definitions where id = p_metric_id and workspace_id = p_workspace_id for update;
 if not found then raise exception 'METRIC_ACCESS'; end if;
 if m.origin <> 'HUMAN_ENTRY' then raise exception 'METRIC_READ_ONLY'; end if;
 select * into i from public.initiatives where id = m.initiative_id and workspace_id = p_workspace_id for share;
 if i.archived_at is not null then raise exception 'INITIATIVE_ARCHIVED'; end if;
 owner_id := public.initiative_owner_member(p_workspace_id, i.id);
 elevated := public.principal_is_admin(actor.user_id, actor.role) or actor.is_product_lead or owner_id = actor.id;
 if not coalesce(elevated, false) then raise exception 'METRIC_PERMISSION'; end if;
 if v_start is null or v_end is null or v_end < v_start or v_captured is null or v_captured < v_start::timestamptz or length(v_note) > 2000 then raise exception 'OBSERVATION_FIELDS'; end if;
 -- Missing is not zero: an unrecorded period must say why.
 if v_value is null and v_note = '' then raise exception 'OBSERVATION_NOTE_REQUIRED'; end if;
 if exists (select 1 from public.metric_observations where metric_id = m.id and period_start = v_start and period_end = v_end) then raise exception 'OBSERVATION_PERIOD_RECORDED'; end if;
 if v_evidence is not null and not exists (select 1 from public.evidence e where e.id = v_evidence and e.workspace_id = p_workspace_id and e.initiative_id = i.id and e.boundary <> 'EXCLUDED') then raise exception 'METRIC_SOURCE_SCOPE'; end if;
 insert into public.metric_observations(id, metric_id, workspace_id, period_start, period_end, value, captured_at, source_evidence_id, note, origin)
 values (oid, m.id, p_workspace_id, v_start, v_end, v_value, v_captured, v_evidence, v_note, 'HUMAN_ENTRY');
 update public.metric_definitions set updated_at = clock_timestamp() where id = m.id and workspace_id = p_workspace_id;
 insert into public.activity_log(workspace_id, initiative_id, actor_id, actor_label, event_type, summary, entity_type, entity_id, payload)
 values (p_workspace_id, i.id, actor.user_id, actor_label, 'METRIC_OBSERVED', 'Observation recorded: ' || m.name || ' · ' || v_start::text || ' to ' || v_end::text || case when v_value is null then ' · not recorded' else '' end, 'METRIC', m.id,
  jsonb_build_object('metricId', m.id, 'observationId', oid, 'periodStart', v_start, 'periodEnd', v_end, 'value', v_value, 'capturedAt', v_captured, 'sourceEvidenceId', v_evidence, 'actor', jsonb_build_object('id', actor.user_id, 'label', actor_label)));
 return oid;
end$$;

revoke all on function public.record_metric_definition(uuid,uuid,uuid,jsonb), public.record_metric_observation(uuid,uuid,uuid,jsonb) from public, anon, authenticated;
grant execute on function public.record_metric_definition(uuid,uuid,uuid,jsonb), public.record_metric_observation(uuid,uuid,uuid,jsonb) to service_role;
comment on function public.record_metric_definition(uuid,uuid,uuid,jsonb) is 'In-product metric definition (origin HUMAN_ENTRY, revision 1) after an explicit confirm step; initiative owner, Org Owner, Admin or Product Lead.';
comment on function public.record_metric_observation(uuid,uuid,uuid,jsonb) is 'One observation per period on a HUMAN_ENTRY metric; NULL value requires a note. Synthetic demo metrics are read-only.';
commit;
