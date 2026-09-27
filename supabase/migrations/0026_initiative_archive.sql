begin;
create function public.set_initiative_archive(p_workspace_id uuid,p_member_id uuid,p_initiative_id uuid,p_expected_updated_at timestamptz,p_archive boolean,p_reason text,p_confirmed_name text) returns void language plpgsql set search_path='' as $$
declare actor public.organization_memberships;i public.initiatives;actor_label text;begin
 actor:=public.require_workspace_member(p_workspace_id,p_member_id,true,true);
 select * into i from public.initiatives where id=p_initiative_id and workspace_id=p_workspace_id for update;
 if not found then raise exception 'INITIATIVE_ACCESS';end if;
 if i.updated_at is distinct from p_expected_updated_at then raise exception 'STALE_INITIATIVE';end if;
 if p_archive is null or (i.archived_at is not null)=p_archive or coalesce(length(btrim(p_reason)),0) not between 1 and 2000 or (p_archive and btrim(p_confirmed_name) is distinct from i.name) then raise exception 'ARCHIVE_CONFIRMATION';end if;
 update public.initiatives set archived_at=case when p_archive then clock_timestamp() else null end,archived_by=case when p_archive then actor.user_id else null end,archive_reason=case when p_archive then btrim(p_reason) else null end,updated_at=clock_timestamp() where id=i.id;
 select display_name into actor_label from public.users where id=actor.user_id;
 insert into public.activity_log(workspace_id,initiative_id,actor_id,actor_label,event_type,summary,entity_type,entity_id,payload)
 values(p_workspace_id,i.id,actor.user_id,actor_label,case when p_archive then 'INITIATIVE_ARCHIVED' else 'INITIATIVE_RESTORED' end,case when p_archive then 'Initiative archived; records and history preserved' else 'Initiative restored to the active portfolio' end,'INITIATIVE',i.id,jsonb_build_object('before',jsonb_build_object('archivedAt',i.archived_at,'archiveReason',i.archive_reason),'after',jsonb_build_object('archived',p_archive),'reason',btrim(p_reason)));
end;$$;
create function public.guard_archived_product_write() returns trigger language plpgsql set search_path='' as $$
declare row_value jsonb;target_id uuid;archived timestamptz;begin
 if TG_OP='UPDATE' and to_jsonb(old)=to_jsonb(new) then return new;end if;
 row_value:=case when TG_OP='DELETE' then to_jsonb(old) else to_jsonb(new) end;
 if TG_TABLE_NAME='claim_evidence' then select initiative_id into target_id from public.claims where id=(row_value->>'claim_id')::uuid;else target_id:=(row_value->>'initiative_id')::uuid;end if;
 select archived_at into archived from public.initiatives where id=target_id for share;
 if archived is not null then raise exception 'INITIATIVE_ARCHIVED';end if;
 if TG_OP='DELETE' then return old;end if;return new;
end;$$;
do $$declare table_name text;begin
 foreach table_name in array array['evidence','claims','claim_evidence','finding_states','delivery_facts','initiative_sources','initiative_contexts','source_mappings'] loop
  execute format('create trigger reject_archived_write before insert or update or delete on public.%I for each row execute function public.guard_archived_product_write()',table_name);
 end loop;
end$$;
create function public.guard_archived_initiative_metadata() returns trigger language plpgsql set search_path='' as $$begin
 if old.archived_at is not null and (new.name,new.business_line,new.stage,new.description,new.current_context_id,new.known_references) is distinct from (old.name,old.business_line,old.stage,old.description,old.current_context_id,old.known_references) then raise exception 'INITIATIVE_ARCHIVED';end if;return new;
end;$$;
create trigger reject_archived_metadata before update on public.initiatives for each row execute function public.guard_archived_initiative_metadata();
revoke all on function public.set_initiative_archive(uuid,uuid,uuid,timestamptz,boolean,text,text),public.guard_archived_product_write(),public.guard_archived_initiative_metadata() from public,anon,authenticated;
grant execute on function public.set_initiative_archive(uuid,uuid,uuid,timestamptz,boolean,text,text) to service_role;
commit;
