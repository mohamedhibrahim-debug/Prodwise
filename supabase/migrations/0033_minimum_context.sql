begin;
alter table public.claims add column context_id uuid,add column effective_date date;
alter table public.claims add constraint claims_context_scope foreign key(initiative_id,context_id) references public.initiative_contexts(initiative_id,id);
create function public.context_parts(p_context uuid,p_date date) returns text[] language sql immutable set search_path='' as $$select (case when p_context is null then array[]::text[] else array['ctx:'||p_context::text] end)||(case when p_date is null then array[]::text[] else array['date:'||to_char(p_date,'YYYY-MM-DD')] end)$$;
create function public.guard_claim_applicability() returns trigger language plpgsql set search_path='' as $$begin
 if tg_op='UPDATE' and (new.context_id,new.effective_date) is distinct from (old.context_id,old.effective_date) then raise exception 'APPLICABILITY_REQUIRES_REVISION';end if;
 if tg_op='INSERT' and new.context_id is not null and not exists(select 1 from public.initiative_contexts c where c.id=new.context_id and c.initiative_id=new.initiative_id and c.workspace_id=new.workspace_id and c.retired_at is null) then raise exception 'CONTEXT_ACCESS';end if;return new;end$$;
create trigger claim_applicability_guard before insert or update on public.claims for each row execute function public.guard_claim_applicability();
create function public.guard_delivery_applicability() returns trigger language plpgsql set search_path='' as $$declare cid uuid;ed text;begin
 cid:=nullif(new.data->>'contextId','')::uuid;ed:=nullif(new.data->>'effectiveDate','');
 if ed is not null and (ed !~ '^\d{4}-\d{2}-\d{2}$' or to_char(ed::date,'YYYY-MM-DD')<>ed) then raise exception 'EFFECTIVE_DATE';end if;
 if cid is not null and not exists(select 1 from public.initiative_contexts c where c.id=cid and c.initiative_id=new.initiative_id and c.workspace_id=new.workspace_id and (c.retired_at is null or (tg_op='UPDATE' and old.data->>'contextId'=cid::text))) then raise exception 'CONTEXT_ACCESS';end if;return new;end$$;
create trigger delivery_applicability_guard before insert or update on public.delivery_facts for each row execute function public.guard_delivery_applicability();
create function public.revise_claim_applicability(p_workspace_id uuid,p_member_id uuid,p_claim_id uuid,p_expected_updated_at timestamptz,p_input jsonb) returns uuid language plpgsql set search_path='' as $$
declare actor public.organization_memberships;old public.claims;next_id uuid:=gen_random_uuid();label text;eid uuid;begin
 actor:=public.require_workspace_member(p_workspace_id,p_member_id,false,true);select * into old from public.claims where id=p_claim_id and workspace_id=p_workspace_id for update;if not found then raise exception 'CLAIM_ACCESS';end if;perform public.assert_initiative_not_archived(p_workspace_id,old.initiative_id);
 if old.updated_at is distinct from p_expected_updated_at or old.status='SUPERSEDED' or old.superseded_by_claim_id is not null then raise exception 'CLAIM_STALE';end if;
 if (p_input->>'initiativeId')::uuid<>old.initiative_id or length(btrim(p_input->>'reason')) not between 1 and 2000 or coalesce(btrim(p_input->>'reason'),'')='' then raise exception 'REVISION_REASON';end if;
 if nullif(p_input->>'effectiveDate','') is not null and (p_input->>'effectiveDate') !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'EFFECTIVE_DATE';end if;
 if coalesce(btrim(p_input->>'subject'),'')='' or coalesce(btrim(p_input->>'attribute'),'')='' or coalesce(btrim(p_input->>'value'),'')='' then raise exception 'CLAIM_FIELDS';end if;
 insert into public.claims(id,workspace_id,initiative_id,type,status,subject,attribute,value,domain,phase,context_id,effective_date,created_by,origin) values(next_id,p_workspace_id,old.initiative_id,(p_input->>'type')::public.claim_type,'UNVERIFIED',p_input->>'subject',p_input->>'attribute',p_input->>'value',p_input->>'domain',nullif(p_input->>'phase',''),nullif(p_input->>'contextId','')::uuid,nullif(p_input->>'effectiveDate','')::date,actor.user_id,'HUMAN_ENTRY');
 for eid in select distinct value::uuid from jsonb_array_elements_text(coalesce(p_input->'evidenceIds','[]'::jsonb)) loop
 if not exists(select 1 from public.evidence e where e.id=eid and e.workspace_id=p_workspace_id and e.initiative_id=old.initiative_id and (e.boundary<>'EXCLUDED' or exists(select 1 from public.claim_evidence ce where ce.claim_id=old.id and ce.evidence_id=e.id))) then raise exception 'EVIDENCE_ACCESS';end if;
 insert into public.claim_evidence(claim_id,evidence_id) values(next_id,eid);end loop;
 update public.claims set status='SUPERSEDED',superseded_by_claim_id=next_id where id=old.id;
 select display_name into label from public.users where id=actor.user_id;
 insert into public.activity_log(workspace_id,initiative_id,actor_label,event_type,summary,entity_type,entity_id,payload) values(p_workspace_id,old.initiative_id,label,'KNOWLEDGE_APPLICABILITY_REVISED',old.subject||': applicability revised; new entry needs verification.','claim',next_id,jsonb_build_object('previousClaimId',old.id,'contextId',p_input->'contextId','effectiveDate',p_input->'effectiveDate','reason',p_input->>'reason','evidenceNeedsReverification',true));return next_id;end$$;
-- Patch deployed decision RPC bodies without changing their authority or baseline encoder.
do $$declare f text;def text;begin
 foreach f in array array['public.resolve_conflict(jsonb)'] loop
 if to_regprocedure(f) is null then continue;end if;select pg_get_functiondef(to_regprocedure(f)) into def;
 def:=replace(def,'subject,attribute,phase,value,domain,','subject,attribute,phase,context_id,effective_date,value,domain,');
 def:=replace(def,'values(v_initiative,''DECISION'',''ACTIVE'',v_first.subject,v_first.attribute,v_first.phase,','values(v_initiative,''DECISION'',''ACTIVE'',v_first.subject,v_first.attribute,v_first.phase,v_first.context_id,v_first.effective_date,');
 def:=replace(def,'v_claim.phase];','v_claim.phase] || public.context_parts(v_claim.context_id,v_claim.effective_date);');
 def:=replace(def,$literal$|| v_values;$literal$,$literal$|| v_values || public.context_parts(v_first.context_id,v_first.effective_date);$literal$);
 def:=replace(def,'or nullif(public.decision_normalise(v_claim.phase)','or (v_claim.context_id,v_claim.effective_date) is distinct from (v_first.context_id,v_first.effective_date) or nullif(public.decision_normalise(v_claim.phase)');
 def:=replace(def,'and c.status=''ACTIVE'' and c.id <> all(v_ids)','and c.context_id is not distinct from v_first.context_id and c.effective_date is not distinct from v_first.effective_date and c.status=''ACTIVE'' and c.id <> all(v_ids)');execute def;
 end loop;
 -- The existing confirmer plan identifies the group by fingerprint; derive its controlled context server-side.
 select pg_get_functiondef('public.assign_finding_confirmer(jsonb)'::regprocedure) into def;
 def:=replace(def,'  v_parts text[];','  v_parts text[]; current_finding jsonb;');
 def:=regexp_replace(def,'v_values := array\(select distinct[\s\S]*?if array_length\(v_values,1\) < 2 or public.decision_hash\(v_parts\) is distinct from v_fingerprint then', 'current_finding:=public.queue_current_finding((select workspace_id from public.initiatives where id=v_initiative),v_initiative,v_fingerprint); if current_finding is null then');execute def;
 -- proposal confirmation applies human-selected context only to the newly created Knowledge.
 select pg_get_functiondef('public.decide_evidence_proposal(uuid,uuid,jsonb)'::regprocedure) into def;
 def:=replace(def,'phase,created_by,origin,evidence_submission_id','phase,context_id,effective_date,created_by,origin,evidence_submission_id');
 def:=replace(def,$literal$nullif(payload->>'phase',''),actor.user_id$literal$, $literal$nullif(payload->>'phase',''),nullif(p_input->>'contextId','')::uuid,nullif(p_input->>'effectiveDate','')::date,actor.user_id$literal$);execute def;
end$$;
do $$declare def text;begin select pg_get_functiondef('public.queue_current_finding(uuid,uuid,text)'::regprocedure) into def;
def:=replace(def,$literal$phase_key from public.claims$literal$,$literal$phase_key,context_id,effective_date from public.claims$literal$);
def:=replace(def,'group by 1,2,3 loop','group by 1,2,3,4,5 loop');
def:=replace(def,$literal$is not distinct from g.phase_key and nullif$literal$, $literal$is not distinct from g.phase_key and context_id is not distinct from g.context_id and effective_date is not distinct from g.effective_date and nullif$literal$);
def:=replace(def,'g.phase_key]||vals;', 'g.phase_key]||vals||public.context_parts(g.context_id,g.effective_date);');
def:=replace(def,'c.phase];claim_revisions', 'c.phase]||public.context_parts(c.context_id,c.effective_date);claim_revisions');execute def;end$$;
-- Nullable applicability is omitted from source digest normalization, preserving historic null baselines.
do $$declare def text;begin select pg_get_functiondef('public.delivery_meaningful(jsonb)'::regprocedure) into def;
if position($literal$if v_key not in ($literal$ in def)=0 then raise exception 'PATCH_TARGET_MISSING delivery_meaningful';end if;
def:=replace(def,$literal$if v_key not in ($literal$, $literal$if not (v_item='null'::jsonb and v_key in ('context_id','effective_date','contextId','effectiveDate','contextName','evidence_submission_id','evidence_anchor_id','evidenceSubmissionId','evidenceAnchorId')) and v_key not in ($literal$);execute def;end$$;
revoke all on function public.context_parts(uuid,date),public.revise_claim_applicability(uuid,uuid,uuid,timestamptz,jsonb) from public,anon,authenticated;
grant execute on function public.context_parts(uuid,date),public.revise_claim_applicability(uuid,uuid,uuid,timestamptz,jsonb) to service_role;
commit;

