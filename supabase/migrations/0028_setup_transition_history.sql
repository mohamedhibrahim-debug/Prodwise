-- Setup remains derived. Only transitions are retained as immutable history.
begin;
create function public.record_setup_transition(p_initiative_id uuid) returns void language plpgsql set search_path='' as $$
declare i public.initiatives; ready boolean; prior text; actor_id uuid;actor_label text;missing text[]:='{}';target jsonb;milestone jsonb;w_org uuid;
begin
 select * into i from public.initiatives where id=p_initiative_id for update;if not found or i.archived_at is not null then return;end if;
 select organization_id into w_org from public.workspaces where id=i.workspace_id;
 if coalesce(length(btrim(i.name)),0)=0 then missing:=array_append(missing,'Initiative name');end if;
 if i.business_line is null then missing:=array_append(missing,'Business line');end if;
 if i.stage is null then missing:=array_append(missing,'Lifecycle stage');end if;
 if coalesce(length(btrim(i.description)),0)=0 then missing:=array_append(missing,'Objective / problem');end if;
 if not exists(select 1 from public.delivery_facts f join public.organization_memberships m on m.id=f.owner_member_id join public.users u on u.id=m.user_id where f.initiative_id=i.id and f.workspace_id=i.workspace_id and f.kind='OWNER' and f.data->>'state'='SET' and m.organization_id=w_org and m.active and u.active and m.role<>'VIEWER') then missing:=array_append(missing,'Primary owner');end if;
 if not exists(select 1 from public.initiative_contexts c where c.id=i.current_context_id and c.initiative_id=i.id and c.workspace_id=i.workspace_id and c.retired_at is null) then missing:=array_append(missing,'Current scope / phase');end if;
 if not exists(select 1 from public.source_mappings m where m.initiative_id=i.id and m.workspace_id=i.workspace_id and m.unlinked_at is null) then missing:=array_append(missing,'Linked source');end if;
 if not exists(select 1 from public.claims c where c.initiative_id=i.id and c.workspace_id=i.workspace_id and c.status='ACTIVE' and c.verified_at is not null) then missing:=array_append(missing,'Confirmed product fact');end if;
 select data->'value' into target from public.delivery_facts where initiative_id=i.id and kind='TARGET_LIVE' and data->>'state'='SET';
 if not coalesce(target->>'date' is not null or target->>'unknown'='true',false) then missing:=array_append(missing,'Target Live');end if;
 select data->'value' into milestone from public.delivery_facts where initiative_id=i.id and kind='NEXT_MILESTONE' and data->>'state'='SET';
 if not coalesce(milestone->>'unknown'='true' or (length(btrim(milestone->>'text'))>0 and (milestone->>'date' is not null or milestone->>'dateUnknown'='true')),false) then missing:=array_append(missing,'Next milestone');end if;
 ready:=cardinality(missing)=0;
 select event_type into prior from public.activity_log where initiative_id=i.id and event_type in ('READINESS_REACHED','READINESS_LOST') order by occurred_at desc,id desc limit 1;
 if ready=coalesce(prior='READINESS_REACHED',false) then return;end if;
 select a.actor_id,a.actor_label into actor_id,actor_label from public.activity_log a where a.initiative_id=i.id order by a.occurred_at desc,a.id desc limit 1;
 insert into public.activity_log(workspace_id,initiative_id,actor_id,actor_label,event_type,summary,entity_type,entity_id,payload,occurred_at) values(i.workspace_id,i.id,actor_id,coalesce(actor_label,'Recorded change'),case when ready then 'READINESS_REACHED' else 'READINESS_LOST' end,case when ready then 'Setup complete — ready for intelligence; attention remains separate' else 'Setup needs review: '||array_to_string(missing,', ') end,'INITIATIVE',i.id,jsonb_build_object('ready',ready,'missing',missing),clock_timestamp());
end;$$;
create function public.capture_setup_transition() returns trigger language plpgsql set search_path='' as $$
begin
 if tg_table_name='initiatives' then perform public.record_setup_transition(new.id);else perform public.record_setup_transition(new.initiative_id);end if;return null;
end;$$;
create constraint trigger initiative_setup_history after insert or update on public.initiatives deferrable initially deferred for each row execute function public.capture_setup_transition();
create constraint trigger claim_setup_history after insert or update on public.claims deferrable initially deferred for each row execute function public.capture_setup_transition();
create constraint trigger context_setup_history after insert or update on public.initiative_contexts deferrable initially deferred for each row execute function public.capture_setup_transition();
create constraint trigger source_setup_history after insert or update on public.source_mappings deferrable initially deferred for each row execute function public.capture_setup_transition();
create constraint trigger delivery_setup_history after insert or update on public.delivery_facts deferrable initially deferred for each row execute function public.capture_setup_transition();
revoke all on function public.record_setup_transition(uuid),public.capture_setup_transition() from public,anon,authenticated;
grant execute on function public.record_setup_transition(uuid),public.capture_setup_transition() to service_role;
commit;
