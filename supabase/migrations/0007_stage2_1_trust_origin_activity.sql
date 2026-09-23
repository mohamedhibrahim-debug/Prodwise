-- PRODWISE Stage 2.1 — trust provenance, evidence anchors and atomic audit RPCs.

create type public.claim_origin as enum ('LEGACY', 'HUMAN_ENTRY');
create type public.verification_basis as enum ('EVIDENCE', 'DIRECT_KNOWLEDGE');

alter table public.claims
  add column origin public.claim_origin not null default 'LEGACY',
  add column verified_at timestamptz,
  add column verified_actor_id text,
  add column verified_actor_label text,
  add column verification_basis public.verification_basis,
  add column verification_note text;

alter table public.claims alter column origin set default 'HUMAN_ENTRY';

alter table public.claims
  add constraint claims_verification_coherent check (
    (verified_at is null and verified_actor_id is null and verified_actor_label is null
      and verification_basis is null and verification_note is null)
    or
    (verified_at is not null and verified_actor_label is not null
      and length(btrim(verified_actor_label)) > 0 and verification_basis is not null)
  ),
  add constraint claims_direct_knowledge_note check (
    verification_basis is distinct from 'DIRECT_KNOWLEDGE'
    or (verification_note is not null and length(btrim(verification_note)) > 0)
  ),
  add constraint claims_active_is_trusted check (
    status <> 'ACTIVE' or verified_at is not null or origin = 'LEGACY'
  );

create function public.claims_guard_trust() returns trigger
language plpgsql set search_path = public as $$
begin
  if old.origin is distinct from new.origin then
    raise exception using errcode = 'P0001', message = 'CLAIM_ORIGIN_IMMUTABLE';
  end if;

  if old.status <> 'ACTIVE' and new.status = 'ACTIVE' then
    if new.verified_at is null
       or new.verified_at is not distinct from old.verified_at
       or new.verified_actor_label is null
       or length(btrim(new.verified_actor_label)) = 0
       or new.verification_basis is null then
      raise exception using errcode = 'P0001', message = 'CLAIM_ACTIVATION_REQUIRES_VERIFICATION';
    end if;
  elsif old.verified_at is distinct from new.verified_at
     or old.verified_actor_id is distinct from new.verified_actor_id
     or old.verified_actor_label is distinct from new.verified_actor_label
     or old.verification_basis is distinct from new.verification_basis
     or old.verification_note is distinct from new.verification_note then
    raise exception using errcode = 'P0001', message = 'CLAIM_VERIFICATION_IMMUTABLE';
  end if;
  return new;
end $$;

create trigger claims_guard_trust
  before update on public.claims
  for each row execute function public.claims_guard_trust();

alter table public.claim_evidence
  add column locator text,
  add column excerpt text,
  add constraint claim_evidence_locator_not_blank
    check (locator is null or length(btrim(locator)) > 0),
  add constraint claim_evidence_excerpt_not_blank
    check (excerpt is null or length(btrim(excerpt)) > 0),
  add constraint claim_evidence_excerpt_length
    check (excerpt is null or char_length(excerpt) <= 2000);

alter table public.activity_log
  add column entity_type text,
  add column entity_id text,
  add column payload jsonb,
  add column actor_label text,
  add constraint activity_entity_pair check (
    (entity_type is null and entity_id is null) or
    (entity_type is not null and length(btrim(entity_type)) > 0
      and entity_id is not null and length(btrim(entity_id)) > 0)
  ),
  add constraint activity_payload_object check (
    payload is null or jsonb_typeof(payload) = 'object'
  );

create index activity_log_entity_idx on public.activity_log (entity_type, entity_id);

create function public.verify_claim(
  p_claim_id uuid,
  p_expected_updated_at timestamptz,
  p_basis public.verification_basis,
  p_note text,
  p_actor_id text,
  p_actor_label text
) returns public.claims
language plpgsql security invoker set search_path = '' as $$
declare
  v_claim public.claims%rowtype;
  v_row record;
  v_has_current boolean := false;
  v_has_future boolean := false;
  v_evidence jsonb := '[]'::jsonb;
  v_now timestamptz := now();
  v_previous_status text;
begin
  select * into v_claim from public.claims where id = p_claim_id for update;
  if not found then raise exception using errcode='P0002', message='CLAIM_NOT_FOUND'; end if;
  if v_claim.status not in ('UNVERIFIED', 'DRAFT') then
    raise exception using errcode='P0001', message='CLAIM_NOT_VERIFIABLE';
  end if;
  if v_claim.updated_at is distinct from p_expected_updated_at then
    raise exception using errcode='P0001', message='CLAIM_STALE';
  end if;
  if p_actor_label is null or length(btrim(p_actor_label)) = 0 then
    raise exception using errcode='P0001', message='ACTOR_REQUIRED';
  end if;
  if p_basis = 'DIRECT_KNOWLEDGE' and (p_note is null or length(btrim(p_note)) = 0) then
    raise exception using errcode='P0001', message='DIRECT_KNOWLEDGE_NOTE_REQUIRED';
  end if;

  for v_row in
    select e.id, e.boundary
    from public.claim_evidence ce join public.evidence e on e.id = ce.evidence_id
    where ce.claim_id = p_claim_id
    order by e.id
    for share of ce, e
  loop
    v_has_current := v_has_current or v_row.boundary = 'CURRENT_SCOPE';
    v_has_future := v_has_future or v_row.boundary = 'FUTURE_PHASE';
    v_evidence := v_evidence || jsonb_build_array(
      jsonb_build_object('id', v_row.id, 'boundary', v_row.boundary)
    );
  end loop;

  if p_basis = 'EVIDENCE' and not v_has_current then
    if v_has_future and (v_claim.phase is null or length(btrim(v_claim.phase)) = 0) then
      raise exception using errcode='P0001', message='FUTURE_PHASE_REQUIRES_PHASE';
    elsif not v_has_future then
      raise exception using errcode='P0001', message='ELIGIBLE_EVIDENCE_REQUIRED';
    end if;
  end if;

  v_previous_status := v_claim.status::text;
  update public.claims set
    status='ACTIVE', verified_at=v_now, verified_actor_id=p_actor_id,
    verified_actor_label=btrim(p_actor_label), verification_basis=p_basis,
    verification_note=nullif(btrim(p_note), '')
  where id=p_claim_id returning * into v_claim;

  insert into public.activity_log
    (initiative_id,event_type,summary,entity_type,entity_id,payload,actor_label)
  values
    (v_claim.initiative_id,'CLAIM_VERIFIED',v_claim.subject || ' verified',
     'claim',v_claim.id::text,
     jsonb_build_object(
       'previousStatus',v_previous_status,
       'basis',p_basis::text,'note',nullif(btrim(p_note),''),
       'evidence',v_evidence,'origin',v_claim.origin::text,
       'actor',jsonb_build_object('id',p_actor_id,'label',btrim(p_actor_label))
     ),btrim(p_actor_label));
  return v_claim;
end $$;

create function public.reopen_finding_state(
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

revoke all on function public.verify_claim(uuid,timestamptz,public.verification_basis,text,text,text)
  from public, anon, authenticated;
revoke all on function public.reopen_finding_state(uuid,text,text,text)
  from public, anon, authenticated;
grant execute on function public.verify_claim(uuid,timestamptz,public.verification_basis,text,text,text)
  to service_role;
grant execute on function public.reopen_finding_state(uuid,text,text,text)
  to service_role;
