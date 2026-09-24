-- Explicit local rollback for a deployment with no Stage 2.2 data.
begin;
do $$ begin
  if exists(select 1 from public.finding_states where outcome is not null or confirmer_label is not null)
    or exists(select 1 from public.claims where origin='HUMAN_DECISION')
    or exists(select 1 from public.activity_log where event_type in ('FINDING_DECIDED','FINDING_CONFIRMER_ASSIGNED')) then
    raise exception 'STAGE22_ROLLBACK_REQUIRES_DATA_MIGRATION';
  end if;
end $$;
drop function public.set_finding_note(uuid,text,jsonb);
drop function public.assign_finding_confirmer(jsonb);
drop function public.resolve_conflict(jsonb);
drop function public.decision_hash(text[]);
drop function public.decision_utf16le(text);
drop function public.decision_normalise(text);
drop trigger finding_states_guard_decision on public.finding_states;
drop function public.finding_states_guard_decision();
alter table public.finding_states
  drop constraint finding_decision_resolved,
  drop constraint finding_decision_shape,
  drop constraint finding_confirmer_label_valid,
  drop column outcome, drop column chosen_claim_id, drop column decision_claim_id,
  drop column decided_value, drop column confirmed_with, drop column actor_id,
  drop column actor_label, drop column confirmer_label, drop column confirmer_set_at,
  drop column confirmer_set_by_label;
alter table public.claims drop constraint claims_human_decision_valid;
drop type public.finding_outcome;
create or replace function public.reopen_finding_state(
  p_initiative_id uuid,
  p_fingerprint text,
  p_actor_id text,
  p_actor_label text
) returns boolean
language plpgsql security invoker set search_path = '' as $$
declare v_state public.finding_states%rowtype;
begin
  if p_actor_label is null or length(btrim(p_actor_label)) = 0 then
    raise exception using errcode='P0001', message='ACTOR_REQUIRED';
  end if;
  select * into v_state from public.finding_states
    where initiative_id=p_initiative_id and fingerprint=p_fingerprint for update;
  if not found or v_state.status='OPEN' then return false; end if;
  update public.finding_states set status='OPEN',resolution=null,resolved_at=null
    where initiative_id=p_initiative_id and fingerprint=p_fingerprint;
  insert into public.activity_log
    (initiative_id,event_type,summary,entity_type,entity_id,payload,actor_label)
  values
    (p_initiative_id,'FINDING_REOPENED','Finding reopened','finding',p_fingerprint,
     jsonb_build_object('previousStatus',v_state.status::text,
       'previousResolution',v_state.resolution,'previousResolvedAt',v_state.resolved_at,
       'contentDigest',v_state.content_digest,'ruleId',v_state.rule_id,
       'subject',v_state.subject,
       'actor',jsonb_build_object('id',p_actor_id,'label',p_actor_label)),
     p_actor_label);
  return true;
end $$;
commit;
