-- Phase 3 connectors: Jira, Gmail, Google Drive / Docs, Figma.
--
-- A connector only ever produces Source / Evidence. External content enters as a
-- saved snapshot (evidence + evidence submission) that people read and confirm
-- through the existing proposal flow. Nothing here writes Knowledge, decisions,
-- delivery facts, commitments or any other product truth.
--
-- Connections are per person and per organization: each person connects their
-- own account, searches with their own permissions, and chooses what to import.
-- Tokens are sealed by the application (AES-256-GCM) before they reach this
-- table, and the table is reachable only by the server's service role.

alter table public.source_containers drop constraint if exists source_containers_provider_check;
alter table public.source_containers add constraint source_containers_provider_check
  check (provider in ('JIRA','DOCUMENT','EMAIL','MEETING_NOTES','PASTED_EVIDENCE','OTHER_URL','FIGMA'));

alter type public.evidence_source_type add value if not exists 'DESIGN';

create table public.connector_connections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  user_id uuid not null references public.users(id),
  provider text not null check (provider in ('JIRA','GMAIL','GOOGLE_DRIVE','FIGMA')),
  status text not null check (status in ('CONNECTED','NEEDS_RECONNECT','DISCONNECTED')),
  account_label text check (account_label is null or length(account_label) between 1 and 300),
  external_account_id text check (external_account_id is null or length(external_account_id) between 1 and 300),
  sites jsonb not null default '[]'::jsonb check (jsonb_typeof(sites)='array'),
  scopes text not null default '',
  sealed_tokens text,
  connected_at timestamptz,
  updated_at timestamptz not null default clock_timestamp(),
  disconnected_at timestamptz,
  last_error_code text check (last_error_code is null or last_error_code ~ '^[A-Z_]{1,60}$'),
  unique (organization_id, user_id, provider),
  -- A disconnected connection keeps no credential.
  check (status<>'DISCONNECTED' or sealed_tokens is null)
);
alter table public.connector_connections enable row level security;
revoke all on public.connector_connections from public, anon, authenticated;

-- Current sync state of one imported source item within one initiative.
-- History lives in activity_log and in the saved snapshots themselves.
create table public.source_item_syncs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id),
  initiative_id uuid not null references public.initiatives(id),
  item_id uuid not null references public.source_items(id),
  connector text not null check (connector in ('JIRA','GMAIL','GOOGLE_DRIVE','FIGMA')),
  external_updated_at text check (external_updated_at is null or length(external_updated_at)<=60),
  content_sha256 text not null check (content_sha256 ~ '^[0-9a-f]{64}$'),
  last_submission_id uuid not null references public.evidence_submissions(id),
  last_synced_at timestamptz not null,
  last_synced_by uuid not null references public.users(id),
  last_checked_at timestamptz not null,
  status text not null check (status in ('CURRENT','NOT_FOUND','NO_ACCESS','FAILED')),
  revision integer not null default 1 check (revision>0),
  unique (workspace_id, initiative_id, item_id)
);
alter table public.source_item_syncs enable row level security;
revoke all on public.source_item_syncs from public, anon, authenticated;

create function public.import_connector_snapshot(p_workspace_id uuid,p_member_id uuid,p_input jsonb) returns jsonb language plpgsql set search_path='' as $$
declare actor public.organization_memberships;i public.initiatives;prior public.evidence_submissions;c public.source_containers;item public.source_items;
 mapping public.source_mappings;sync public.source_item_syncs;sid uuid:=gen_random_uuid();eid uuid:=gen_random_uuid();at_time timestamptz:=clock_timestamp();
 text_value text:=p_input->>'text';title text:=btrim(p_input->>'title');sha text:=p_input->>'textSha256';mode text:=p_input->>'mode';actor_label text;payload jsonb;
begin
 actor:=public.require_workspace_member(p_workspace_id,p_member_id,false,true);
 select * into i from public.initiatives where id=(p_input->>'initiativeId')::uuid and workspace_id=p_workspace_id for update;
 if not found then raise exception 'INITIATIVE_ACCESS';end if;
 if i.archived_at is not null then raise exception 'ARCHIVED';end if;
 if mode not in ('IMPORT','REFRESH') or p_input->>'connector' not in ('JIRA','GMAIL','GOOGLE_DRIVE','FIGMA')
  or p_input->>'evidenceSourceType' not in ('JIRA','EMAIL','DOCUMENT','DESIGN') then raise exception 'INVALID_IMPORT';end if;
 if length(btrim(text_value))=0 or length(text_value)>20000 or coalesce((p_input->>'charLength')::integer,0) not between 1 and 20000
  or length(title) not between 1 and 200 or sha is distinct from encode(sha256(convert_to(text_value,'UTF8')),'hex') then raise exception 'INVALID_EVIDENCE';end if;
 select * into prior from public.evidence_submissions where workspace_id=p_workspace_id and request_id=(p_input->>'requestId')::uuid;
 if found then
  if prior.data->>'createdBy'<>actor.user_id::text or prior.data->>'textSha256' is distinct from sha or prior.initiative_id<>i.id then raise exception 'REQUEST_REUSED';end if;
  return jsonb_build_object('submissionId',prior.id,'changed',true,'replay',true);
 end if;
 if mode='IMPORT' then perform public.map_initiative_sources(p_workspace_id,p_member_id,jsonb_build_object('initiativeId',i.id,'provider',p_input->>'provider',
   'providerWorkspace',p_input->>'providerWorkspace','containerReference',p_input->>'containerReference','containerName',p_input->>'containerName','role',p_input->>'role',
   'items',jsonb_build_array(p_input->'item')));end if;
 select * into c from public.source_containers where workspace_id=p_workspace_id and provider=p_input->>'provider'
  and lower(normalize(btrim(provider_workspace),NFKC))=lower(normalize(btrim(p_input->>'providerWorkspace'),NFKC))
  and lower(normalize(btrim(reference),NFKC))=lower(normalize(btrim(p_input->>'containerReference'),NFKC));
 if not found then raise exception 'SOURCE_ACCESS';end if;
 select * into item from public.source_items where workspace_id=p_workspace_id and container_id=c.id
  and lower(normalize(btrim(reference),NFKC))=lower(normalize(btrim(p_input#>>'{item,reference}'),NFKC));
 if not found then raise exception 'SOURCE_ACCESS';end if;
 select * into mapping from public.source_mappings where workspace_id=p_workspace_id and initiative_id=i.id and item_id=item.id and unlinked_at is null;
 if not found then raise exception 'SOURCE_ACCESS';end if;
 select * into sync from public.source_item_syncs where workspace_id=p_workspace_id and initiative_id=i.id and item_id=item.id for update;
 -- Unchanged content saves no new snapshot: only the check time moves.
 if found and sync.content_sha256=sha then
  update public.source_item_syncs set last_checked_at=at_time,status='CURRENT',external_updated_at=p_input->>'externalUpdatedAt',revision=revision+1 where id=sync.id;
  return jsonb_build_object('submissionId',sync.last_submission_id,'changed',false,'replay',false);
 end if;
 select display_name into actor_label from public.users where id=actor.user_id;
 insert into public.evidence(id,workspace_id,initiative_id,title,source_type,source_reference,source_url,content_summary,boundary,occurred_at,captured_at,created_by)
  values(eid,p_workspace_id,i.id,title,(p_input->>'evidenceSourceType')::public.evidence_source_type,item.reference,item.url,text_value,'CURRENT_SCOPE',nullif(p_input->>'occurredAt','')::timestamptz,at_time,actor.user_id);
 payload:=jsonb_build_object('id',sid,'workspaceId',p_workspace_id,'organizationId',actor.organization_id,'initiativeId',i.id,'sourceItemId',item.id,'evidenceId',eid,'kind','PASTED',
  'title',title,'text',text_value,'textSha256',sha,'charLength',(p_input->>'charLength')::integer,'createdBy',actor.user_id,'createdAt',at_time,'requestId',p_input->>'requestId',
  'origin',jsonb_build_object('connector',p_input->>'connector','reference',item.reference,'url',item.url,'externalUpdatedAt',p_input->>'externalUpdatedAt'));
 insert into public.evidence_submissions values(sid,p_workspace_id,i.id,(p_input->>'requestId')::uuid,payload);
 if sync.id is null then
  insert into public.source_item_syncs(workspace_id,initiative_id,item_id,connector,external_updated_at,content_sha256,last_submission_id,last_synced_at,last_synced_by,last_checked_at,status)
   values(p_workspace_id,i.id,item.id,p_input->>'connector',p_input->>'externalUpdatedAt',sha,sid,at_time,actor.user_id,at_time,'CURRENT');
 else
  update public.source_item_syncs set external_updated_at=p_input->>'externalUpdatedAt',content_sha256=sha,last_submission_id=sid,last_synced_at=at_time,last_synced_by=actor.user_id,
   last_checked_at=at_time,status='CURRENT',revision=revision+1 where id=sync.id;
 end if;
 insert into public.activity_log(workspace_id,initiative_id,actor_id,event_type,summary,entity_type,entity_id,actor_label,payload)
  values(p_workspace_id,i.id,actor.user_id,case when sync.id is null then 'SOURCE_IMPORTED' else 'SOURCE_CHANGED' end,
   case when sync.id is null then 'Imported: '||item.name||'. No product facts confirmed.' else 'Source changed since the last snapshot: '||item.name||'. New snapshot saved; nothing confirmed.' end,
   'EVIDENCE',eid::text,actor_label,jsonb_build_object('submissionId',sid,'sourceItemId',item.id,'connector',p_input->>'connector','reference',item.reference,'previousSubmissionId',sync.last_submission_id));
 return jsonb_build_object('submissionId',sid,'changed',true,'replay',false);
end$$;

-- A check that could not read the item (deleted, access removed, provider failure). The last snapshot stays.
create function public.record_source_check(p_workspace_id uuid,p_member_id uuid,p_input jsonb) returns void language plpgsql set search_path='' as $$
declare actor public.organization_memberships;sync public.source_item_syncs;item public.source_items;actor_label text;status_value text:=p_input->>'status';begin
 actor:=public.require_workspace_member(p_workspace_id,p_member_id,false,true);
 if status_value not in ('NOT_FOUND','NO_ACCESS','FAILED') then raise exception 'INVALID_CHECK';end if;
 select * into sync from public.source_item_syncs where workspace_id=p_workspace_id and initiative_id=(p_input->>'initiativeId')::uuid and item_id=(p_input->>'itemId')::uuid for update;
 if not found then raise exception 'SOURCE_ACCESS';end if;
 perform public.assert_initiative_not_archived(p_workspace_id,sync.initiative_id);
 update public.source_item_syncs set last_checked_at=clock_timestamp(),status=status_value,revision=revision+1 where id=sync.id;
 if sync.status<>status_value and status_value<>'FAILED' then
  select * into item from public.source_items where id=sync.item_id;select display_name into actor_label from public.users where id=actor.user_id;
  insert into public.activity_log(workspace_id,initiative_id,actor_id,event_type,summary,entity_type,entity_id,actor_label,payload)
   values(p_workspace_id,sync.initiative_id,actor.user_id,'SOURCE_UNAVAILABLE',case status_value when 'NOT_FOUND' then 'Source not found in '||initcap(replace(lower(sync.connector),'_',' '))||' (deleted, moved or no longer shared): ' else 'No access to this source for the person who refreshed it: ' end||item.name||'. The last snapshot is kept.',
    'SOURCE_ITEM',item.id::text,actor_label,jsonb_build_object('connector',sync.connector,'reference',item.reference,'status',status_value));
 end if;
end$$;

revoke all on function public.import_connector_snapshot(uuid,uuid,jsonb),public.record_source_check(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.import_connector_snapshot(uuid,uuid,jsonb),public.record_source_check(uuid,uuid,jsonb) to service_role;
grant select,insert,update on public.connector_connections,public.source_item_syncs to service_role;
