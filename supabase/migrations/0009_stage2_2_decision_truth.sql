-- Stage 2.2A: additive decision and confirmer state.
create type public.finding_outcome as enum ('CHOSE_EXISTING', 'CORRECTED_VALUE');

alter table public.claims add constraint claims_human_decision_valid check (
  origin <> 'HUMAN_DECISION' or
  (type = 'DECISION' and verification_basis = 'DIRECT_KNOWLEDGE'
   and verified_at is not null)
);

alter table public.finding_states
  add column outcome public.finding_outcome,
  add column chosen_claim_id uuid references public.claims(id) on delete restrict,
  add column decision_claim_id uuid references public.claims(id) on delete restrict,
  add column decided_value text,
  add column confirmed_with text,
  add column actor_id text,
  add column actor_label text,
  add column confirmer_label text,
  add column confirmer_set_at timestamptz,
  add column confirmer_set_by_label text,
  add constraint finding_decision_resolved check (outcome is null or status = 'RESOLVED'),
  add constraint finding_decision_shape check (
    (outcome is null and chosen_claim_id is null and decision_claim_id is null and decided_value is null)
    or (outcome = 'CHOSE_EXISTING' and chosen_claim_id is not null and decision_claim_id is null
        and decided_value is not null and length(btrim(decided_value)) > 0
        and actor_label is not null and length(btrim(actor_label)) > 0)
    or (outcome = 'CORRECTED_VALUE' and decision_claim_id is not null and chosen_claim_id is null
        and decided_value is not null and length(btrim(decided_value)) > 0
        and actor_label is not null and length(btrim(actor_label)) > 0)
  ),
  add constraint finding_confirmer_label_valid check (
    confirmer_label is null or length(btrim(confirmer_label)) between 1 and 120
  );

create function public.finding_states_guard_decision() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if old.outcome is not null then
    if new.outcome is null then
      raise exception using errcode='P0001', message='DECISION_IMMUTABLE';
    end if;
    if (old.outcome,old.chosen_claim_id,old.decision_claim_id,old.decided_value,
        old.confirmed_with,old.resolution,old.actor_id,old.actor_label)
       is distinct from
       (new.outcome,new.chosen_claim_id,new.decision_claim_id,new.decided_value,
        new.confirmed_with,new.resolution,new.actor_id,new.actor_label)
       and new.resolved_at is not distinct from old.resolved_at then
      raise exception using errcode='P0001', message='DECISION_IMMUTABLE';
    end if;
  end if;
  return new;
end $$;

create trigger finding_states_guard_decision
  before update on public.finding_states for each row
  execute function public.finding_states_guard_decision();

create or replace function public.reopen_finding_state(
  p_initiative_id uuid, p_fingerprint text, p_actor_id text, p_actor_label text
) returns boolean language plpgsql security invoker set search_path = '' as $$
declare v_state public.finding_states%rowtype;
begin
  if p_actor_label is null or length(btrim(p_actor_label)) = 0 then
    raise exception using errcode='P0001', message='ACTOR_REQUIRED';
  end if;
  select * into v_state from public.finding_states
    where initiative_id=p_initiative_id and fingerprint=p_fingerprint for update;
  if not found then return false; end if;
  if v_state.outcome is not null then
    raise exception using errcode='P0001', message='DECISION_NOT_REOPENABLE';
  end if;
  if v_state.status='OPEN' then return false; end if;
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

revoke all on function public.reopen_finding_state(uuid,text,text,text)
  from public, anon, authenticated;
grant execute on function public.reopen_finding_state(uuid,text,text,text)
  to service_role;

-- Recreate the Review hash's UTF-16LE length framing inside the transaction.
-- PostgreSQL's text encoding is UTF-8; convert_to does not offer UTF-16LE.
create function public.decision_utf16le(p_text text) returns bytea
language plpgsql immutable strict security invoker set search_path = '' as $$
declare v_out bytea := ''::bytea; v_code integer; v_unit integer; v_char text;
begin
  for v_char in select unnest(string_to_array(p_text, null)) loop
    v_code := ascii(v_char);
    if v_code > 65535 then
      v_code := v_code - 65536;
      v_unit := 55296 + (v_code / 1024);
      v_out := v_out || decode(lpad(to_hex(v_unit % 256),2,'0') || lpad(to_hex(v_unit / 256),2,'0'),'hex');
      v_unit := 56320 + (v_code % 1024);
    else
      v_unit := v_code;
    end if;
    v_out := v_out || decode(lpad(to_hex(v_unit % 256),2,'0') || lpad(to_hex(v_unit / 256),2,'0'),'hex');
  end loop;
  return v_out;
end $$;

create function public.decision_hash(p_parts text[]) returns text
language plpgsql immutable security invoker set search_path = '' as $$
declare v_part text; v_payload bytea := ''::bytea; v_encoded bytea;
begin
  foreach v_part in array p_parts loop
    if v_part is null then
      v_payload := v_payload || public.decision_utf16le('-1:');
    else
      v_encoded := public.decision_utf16le(v_part);
      v_payload := v_payload || public.decision_utf16le((octet_length(v_encoded)/2)::text || ':') || v_encoded;
    end if;
  end loop;
  return encode(sha256(v_payload), 'hex');
end $$;

create function public.decision_normalise(p_value text) returns text
language sql immutable security invoker set search_path = '' as $$
  select btrim(regexp_replace(lower(btrim(regexp_replace(normalize(coalesce(p_value,''), NFKC),
    '[[:space:]]+', ' ', 'g'))), '\.$', ''));
$$;

create function public.resolve_conflict(p_plan jsonb) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  v_initiative uuid := (p_plan->>'initiativeId')::uuid;
  v_fingerprint text := p_plan->>'fingerprint';
  v_members jsonb := p_plan->'members';
  v_claim public.claims%rowtype;
  v_state public.finding_states%rowtype;
  v_member jsonb;
  v_evidence record;
  v_ids uuid[] := array[]::uuid[];
  v_parts text[];
  v_digest_parts text[];
  v_values text[];
  v_first public.claims%rowtype;
  v_normal_value text;
  v_chosen public.claims%rowtype;
  v_new_id uuid;
  v_replacement uuid;
  v_decided_value text;
  v_domain text;
  v_now timestamptz := clock_timestamp();
  v_snapshots jsonb := '[]'::jsonb;
  v_superseded jsonb := '[]'::jsonb;
  v_keep boolean;
  v_confirmed text;
begin
  if p_plan->>'ruleId' is distinct from 'CONFLICT_SAME_ATTRIBUTE_V1'
    or jsonb_typeof(v_members) is distinct from 'array'
    or jsonb_array_length(v_members) < 2 then
    raise exception using errcode='P0001',message='FINDING_STALE';
  end if;
  if nullif(btrim(p_plan->'actor'->>'label'),'') is null then
    raise exception using errcode='P0001',message='ACTOR_REQUIRED';
  end if;
  if nullif(btrim(p_plan->>'rationale'),'') is null then
    raise exception using errcode='P0001',message='RATIONALE_REQUIRED';
  end if;

  -- A row lock serializes a second decision on the same fingerprint.
  select * into v_state from public.finding_states
    where initiative_id=v_initiative and fingerprint=v_fingerprint for update;
  if found and v_state.outcome is not null then
    -- Re-emergence is determined below from live claims, not stored digest.
    null;
  end if;

  for v_member in select value from jsonb_array_elements(v_members) order by value->>'id' loop
    if (v_member->>'id')::uuid = any(v_ids) then
      raise exception using errcode='P0001',message='CLAIM_STALE';
    end if;
    select * into v_claim from public.claims where id=(v_member->>'id')::uuid for update;
    if not found or v_claim.initiative_id <> v_initiative or v_claim.status <> 'ACTIVE'
      or v_claim.updated_at is distinct from (v_member->>'expectedUpdatedAt')::timestamptz then
      raise exception using errcode='P0001',message='CLAIM_STALE';
    end if;
    v_ids := array_append(v_ids,v_claim.id);
    if array_length(v_ids,1) = 1 then
      v_first := v_claim;
    elsif public.decision_normalise(v_claim.subject) is distinct from public.decision_normalise(v_first.subject)
       or public.decision_normalise(v_claim.attribute) is distinct from public.decision_normalise(v_first.attribute)
       or nullif(public.decision_normalise(v_claim.phase),'') is distinct from
          nullif(public.decision_normalise(v_first.phase),'') then
      raise exception using errcode='P0001',message='FINDING_STALE';
    end if;
  end loop;

  -- The selected group must still be the complete active comparison group.
  if exists (
    select 1 from public.claims c where c.initiative_id=v_initiative
      and c.status='ACTIVE' and c.id <> all(v_ids)
      and public.decision_normalise(c.subject)=public.decision_normalise(v_first.subject)
      and public.decision_normalise(c.attribute)=public.decision_normalise(v_first.attribute)
      and public.decision_normalise(c.phase) is not distinct from public.decision_normalise(v_first.phase)
      and nullif(public.decision_normalise(c.value),'') is not null
  ) then raise exception using errcode='P0001',message='FINDING_STALE'; end if;

  v_values := array(select distinct public.decision_normalise(c.value) collate "C"
    from public.claims c where c.id=any(v_ids) order by 1);
  if array_length(v_values,1) < 2 then
    raise exception using errcode='P0001',message='FINDING_STALE';
  end if;
  v_parts := array['CONFLICT_SAME_ATTRIBUTE_V1',v_initiative::text,
    public.decision_normalise(v_first.subject),public.decision_normalise(v_first.attribute),
    nullif(public.decision_normalise(v_first.phase),'')] || v_values;
  if public.decision_hash(v_parts) is distinct from v_fingerprint then
    raise exception using errcode='P0001',message='FINDING_STALE';
  end if;
  if p_plan->>'subject' is distinct from v_first.subject
     or p_plan->>'attribute' is distinct from v_first.attribute
     or p_plan->>'phase' is distinct from v_first.phase then
    raise exception using errcode='P0001',message='FINDING_STALE';
  end if;
  if p_plan->>'valuesRecorded' is distinct from
    (select string_agg(value,' | ' order by id) from public.claims where id=any(v_ids)) then
    raise exception using errcode='P0001',message='FINDING_STALE';
  end if;

  v_digest_parts := array[v_fingerprint];
  for v_claim in select * from public.claims where id=any(v_ids) order by id loop
    v_digest_parts := v_digest_parts || array[v_claim.id::text,v_claim.value,v_claim.status::text,v_claim.phase];
    for v_evidence in
      select e.id,e.boundary,e.source_reference from public.claim_evidence ce
      join public.evidence e on e.id=ce.evidence_id where ce.claim_id=v_claim.id
      order by e.id for share of ce,e
    loop
      v_digest_parts := v_digest_parts || array[v_evidence.id::text,
        v_evidence.boundary::text,v_evidence.source_reference];
    end loop;
    v_digest_parts := array_append(v_digest_parts,null);
  end loop;
  if public.decision_hash(v_digest_parts) is distinct from p_plan->>'contentDigest' then
    raise exception using errcode='P0001',message='FINDING_STALE';
  end if;

  if p_plan->>'outcome' = 'CHOSE_EXISTING' then
    if p_plan->>'correctedValue' is not null or p_plan->>'decisionDomain' is not null then
      raise exception using errcode='P0001',message='INVALID_DECISION_SHAPE';
    end if;
    select * into v_chosen from public.claims where id=(p_plan->>'chosenClaimId')::uuid and id=any(v_ids);
    if not found then raise exception using errcode='P0001',message='CHOSEN_CLAIM_NOT_MEMBER'; end if;
    v_decided_value := v_chosen.value;
    v_replacement := v_chosen.id;
  elsif p_plan->>'outcome' = 'CORRECTED_VALUE' then
    if p_plan->>'chosenClaimId' is not null or nullif(btrim(p_plan->>'correctedValue'),'') is null then
      raise exception using errcode='P0001',message='INVALID_DECISION_SHAPE';
    end if;
    v_decided_value := btrim(p_plan->>'correctedValue');
    if public.decision_normalise(v_decided_value)=any(v_values) then
      raise exception using errcode='P0001',message='CHOOSE_EXISTING_VALUE';
    end if;
    v_domain := p_plan->>'decisionDomain';
    if v_domain is null then
      select case when count(distinct domain)=1 then min(domain) end into v_domain
        from public.claims where id=any(v_ids);
    end if;
    if v_domain is null or not exists(select 1 from public.claims where id=any(v_ids) and domain=v_domain) then
      raise exception using errcode='P0001',message='DECISION_DOMAIN_REQUIRED';
    end if;
    insert into public.claims(initiative_id,type,status,subject,attribute,phase,value,domain,
      origin,verified_at,verified_actor_id,verified_actor_label,verification_basis,verification_note)
    values(v_initiative,'DECISION','ACTIVE',v_first.subject,v_first.attribute,v_first.phase,
      v_decided_value,v_domain,'HUMAN_DECISION',v_now,p_plan->'actor'->>'id',
      btrim(p_plan->'actor'->>'label'),'DIRECT_KNOWLEDGE',btrim(p_plan->>'rationale'))
    returning id into v_new_id;
    v_replacement := v_new_id;
  else
    raise exception using errcode='P0001',message='INVALID_DECISION_SHAPE';
  end if;

  for v_claim in select * from public.claims where id=any(v_ids) order by id loop
    v_keep := p_plan->>'outcome' = 'CHOSE_EXISTING'
      and public.decision_normalise(v_claim.value)=public.decision_normalise(v_chosen.value);
    if (select (value->>'keep')::boolean from jsonb_array_elements(v_members)
        where value->>'id'=v_claim.id::text) is distinct from v_keep then
      raise exception using errcode='P0001',message='FINDING_STALE';
    end if;
    if not v_keep then
      update public.claims set status='SUPERSEDED',superseded_by_claim_id=v_replacement
        where id=v_claim.id;
      v_superseded := v_superseded || jsonb_build_array(v_claim.id);
    end if;
    v_snapshots := v_snapshots || jsonb_build_array(jsonb_build_object(
      'id',v_claim.id,'value',v_claim.value,'statusBefore','ACTIVE',
      'statusAfter',case when v_keep then 'ACTIVE' else 'SUPERSEDED' end,
      'supersededBy',case when v_keep then null else v_replacement end));
  end loop;

  v_confirmed := v_state.confirmer_label;
  insert into public.finding_states(initiative_id,fingerprint,rule_id,content_digest,
    subject,attribute,phase,values_recorded,status,resolution,resolved_at,outcome,
    chosen_claim_id,decision_claim_id,decided_value,confirmed_with,actor_id,actor_label,
    confirmer_label,confirmer_set_at,confirmer_set_by_label)
  values(v_initiative,v_fingerprint,'CONFLICT_SAME_ATTRIBUTE_V1',p_plan->>'contentDigest',
    v_first.subject,v_first.attribute,v_first.phase,p_plan->>'valuesRecorded',
    'RESOLVED',btrim(p_plan->>'rationale'),v_now,(p_plan->>'outcome')::public.finding_outcome,
    case when p_plan->>'outcome'='CHOSE_EXISTING' then v_replacement else null end,
    v_new_id,v_decided_value,v_confirmed,p_plan->'actor'->>'id',btrim(p_plan->'actor'->>'label'),
    null,null,null)
  on conflict (initiative_id,fingerprint) do update set
    rule_id=excluded.rule_id,content_digest=excluded.content_digest,
    subject=excluded.subject,attribute=excluded.attribute,phase=excluded.phase,
    values_recorded=excluded.values_recorded,status=excluded.status,
    resolution=excluded.resolution,resolved_at=excluded.resolved_at,outcome=excluded.outcome,
    chosen_claim_id=excluded.chosen_claim_id,decision_claim_id=excluded.decision_claim_id,
    decided_value=excluded.decided_value,confirmed_with=excluded.confirmed_with,
    actor_id=excluded.actor_id,actor_label=excluded.actor_label,
    confirmer_label=null,confirmer_set_at=null,confirmer_set_by_label=null;

  insert into public.activity_log(initiative_id,event_type,summary,entity_type,entity_id,payload,actor_label)
  values(v_initiative,'FINDING_DECIDED',v_first.subject || ' — ' || v_first.attribute ||
    ' decided: ' || v_decided_value,'finding',v_fingerprint,
    jsonb_build_object('schema',1,'fingerprint',v_fingerprint,
      'ruleId','CONFLICT_SAME_ATTRIBUTE_V1','contentDigest',p_plan->>'contentDigest',
      'outcome',p_plan->>'outcome','subject',v_first.subject,'attribute',v_first.attribute,
      'phase',v_first.phase,'decidedValue',v_decided_value,
      'chosenClaimId',case when p_plan->>'outcome'='CHOSE_EXISTING' then v_replacement else null end,
      'decisionClaimId',v_new_id,'members',v_snapshots,'rationale',btrim(p_plan->>'rationale'),
      'confirmedWith',v_confirmed,
      'actor',jsonb_build_object('id',p_plan->'actor'->>'id','label',btrim(p_plan->'actor'->>'label'))),
    btrim(p_plan->'actor'->>'label'));
  return jsonb_build_object('outcome',p_plan->>'outcome',
    'chosenClaimId',case when p_plan->>'outcome'='CHOSE_EXISTING' then v_replacement else null end,
    'decisionClaimId',v_new_id,'supersededIds',v_superseded);
end $$;

revoke all on function public.decision_utf16le(text) from public, anon, authenticated;
revoke all on function public.decision_hash(text[]) from public, anon, authenticated;
revoke all on function public.decision_normalise(text) from public, anon, authenticated;
revoke all on function public.resolve_conflict(jsonb) from public, anon, authenticated;
grant execute on function public.decision_utf16le(text) to service_role;
grant execute on function public.decision_hash(text[]) to service_role;
grant execute on function public.decision_normalise(text) to service_role;
grant execute on function public.resolve_conflict(jsonb) to service_role;

create function public.assign_finding_confirmer(p_plan jsonb) returns void
language plpgsql security invoker set search_path = '' as $$
declare
  v_initiative uuid := (p_plan->>'initiativeId')::uuid;
  v_fingerprint text := p_plan->>'fingerprint';
  v_state public.finding_states%rowtype;
  v_parts text[];
  v_values text[];
  v_previous text;
  v_cycle text;
  v_now timestamptz := clock_timestamp();
  v_exists boolean;
begin
  if nullif(btrim(p_plan->'actor'->>'label'),'') is null then
    raise exception using errcode='P0001',message='ACTOR_REQUIRED';
  end if;
  if p_plan->>'label' is not null and length(btrim(p_plan->>'label')) not between 1 and 120 then
    raise exception using errcode='P0001',message='INVALID_CONFIRMER';
  end if;
  select * into v_state from public.finding_states
    where initiative_id=v_initiative and fingerprint=v_fingerprint for update;
  v_exists := found;
  v_cycle := case when v_state.outcome is null then 'FIRST' else 'REEMERGED' end;
  v_values := array(select distinct public.decision_normalise(value) collate "C"
    from public.claims where initiative_id=v_initiative and status='ACTIVE'
      and nullif(public.decision_normalise(value),'') is not null
      and public.decision_normalise(subject)=public.decision_normalise(p_plan->>'subject')
      and public.decision_normalise(attribute)=public.decision_normalise(p_plan->>'attribute')
      and nullif(public.decision_normalise(phase),'') is not distinct from
        nullif(public.decision_normalise(p_plan->>'phase'),'')
    order by 1);
  v_parts := array['CONFLICT_SAME_ATTRIBUTE_V1',v_initiative::text,
    public.decision_normalise(p_plan->>'subject'),public.decision_normalise(p_plan->>'attribute'),
    nullif(public.decision_normalise(p_plan->>'phase'),'')] || v_values;
  if array_length(v_values,1) < 2 or public.decision_hash(v_parts) is distinct from v_fingerprint then
    if v_state.outcome is not null then
      raise exception using errcode='P0001',message='DECISION_STANDING';
    end if;
    raise exception using errcode='P0001',message='FINDING_STALE';
  end if;
  if v_cycle is distinct from p_plan->>'cycle' then
    raise exception using errcode='P0001',message='FINDING_STALE';
  end if;
  v_previous := v_state.confirmer_label;
  if v_exists then
    update public.finding_states set
      confirmer_label=nullif(btrim(p_plan->>'label'),''),
      confirmer_set_at=case when p_plan->>'label' is null then null else v_now end,
      confirmer_set_by_label=case when p_plan->>'label' is null then null
        else btrim(p_plan->'actor'->>'label') end
      where initiative_id=v_initiative and fingerprint=v_fingerprint;
  else
    insert into public.finding_states(initiative_id,fingerprint,rule_id,content_digest,
      subject,attribute,phase,values_recorded,status,confirmer_label,confirmer_set_at,
      confirmer_set_by_label)
    values(v_initiative,v_fingerprint,'CONFLICT_SAME_ATTRIBUTE_V1',null,
      p_plan->>'subject',p_plan->>'attribute',p_plan->>'phase',null,'OPEN',
      nullif(btrim(p_plan->>'label'),''),
      case when p_plan->>'label' is null then null else v_now end,
      case when p_plan->>'label' is null then null else btrim(p_plan->'actor'->>'label') end);
  end if;
  insert into public.activity_log(initiative_id,event_type,summary,entity_type,entity_id,payload,actor_label)
  values(v_initiative,'FINDING_CONFIRMER_ASSIGNED','Finding confirmer assigned',
    'finding',v_fingerprint,
    jsonb_build_object('schema',1,'fingerprint',v_fingerprint,'previousLabel',v_previous,
      'label',nullif(btrim(p_plan->>'label'),''),'cycle',v_cycle,
      'previousDecision',case when v_state.outcome is null then null else
        jsonb_build_object('outcome',v_state.outcome::text,'decidedValue',v_state.decided_value,
          'confirmedWith',v_state.confirmed_with,'decidedAt',v_state.resolved_at) end,
      'actor',jsonb_build_object('id',p_plan->'actor'->>'id',
        'label',btrim(p_plan->'actor'->>'label'))),
    btrim(p_plan->'actor'->>'label'));
end $$;

-- Legacy note-only review cannot replace a real decision, even via a stale UI.
create function public.set_finding_note(p_initiative_id uuid,p_fingerprint text,
  p_input jsonb) returns void language plpgsql security invoker set search_path = '' as $$
declare v_state public.finding_states%rowtype;
begin
  select * into v_state from public.finding_states
    where initiative_id=p_initiative_id and fingerprint=p_fingerprint for update;
  if found and v_state.outcome is not null then
    raise exception using errcode='P0001',message='DECISION_IMMUTABLE';
  end if;
  if nullif(btrim(p_input->>'resolution'),'') is null then
    raise exception using errcode='P0001',message='RATIONALE_REQUIRED';
  end if;
  insert into public.finding_states(initiative_id,fingerprint,rule_id,content_digest,
    subject,attribute,phase,values_recorded,status,resolution,resolved_at)
  values(p_initiative_id,p_fingerprint,p_input->>'ruleId',p_input->>'contentDigest',
    p_input->>'subject',p_input->>'attribute',p_input->>'phase',p_input->>'valuesRecorded',
    'RESOLVED',btrim(p_input->>'resolution'),clock_timestamp())
  on conflict(initiative_id,fingerprint) do update set
    rule_id=excluded.rule_id,content_digest=excluded.content_digest,
    subject=excluded.subject,attribute=excluded.attribute,phase=excluded.phase,
    values_recorded=excluded.values_recorded,status='RESOLVED',
    resolution=excluded.resolution,resolved_at=excluded.resolved_at
    where public.finding_states.outcome is null;
  -- The initial lookup can miss an uncommitted decision. Recheck on the
  -- conflicting row after waiting for its transaction, before writing audit.
  if not found then
    raise exception using errcode='P0001',message='DECISION_IMMUTABLE';
  end if;
  insert into public.activity_log(initiative_id,event_type,summary)
  values(p_initiative_id,'FINDING_RESOLVED',
    (p_input->>'subject') || ' finding marked resolved: ' || btrim(p_input->>'resolution'));
end $$;

revoke all on function public.assign_finding_confirmer(jsonb) from public, anon, authenticated;
revoke all on function public.set_finding_note(uuid,text,jsonb) from public, anon, authenticated;
grant execute on function public.assign_finding_confirmer(jsonb) to service_role;
grant execute on function public.set_finding_note(uuid,text,jsonb) to service_role;
