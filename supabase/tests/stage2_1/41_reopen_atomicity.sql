do $$ begin
 if exists(select 1 from finding_states where fingerprint='s21-test' and (resolution is not null or resolved_at is not null)) then raise exception 'reopen not coherent'; end if;
end $$;

insert into finding_states(initiative_id,fingerprint,rule_id,content_digest,subject,status,resolution,resolved_at)
values('11111111-1111-4111-8111-111111111111','s21-atomic','RULE','digest','Atomic subject','RESOLVED','Keep this resolution',now());
alter table activity_log add constraint _s21_reject_finding_reopened
  check (event_type <> 'FINDING_REOPENED') not valid;
do $$ declare before_row finding_states%rowtype; after_row finding_states%rowtype; begin
 select * into before_row from finding_states where initiative_id='11111111-1111-4111-8111-111111111111' and fingerprint='s21-atomic';
 begin
   perform reopen_finding_state(before_row.initiative_id,before_row.fingerprint,null,'Demo');
   raise exception 'late reopen failure did not occur';
 exception when check_violation then null;
 end;
 select * into after_row from finding_states where initiative_id=before_row.initiative_id and fingerprint=before_row.fingerprint;
 if after_row.status <> 'RESOLVED'
    or after_row.resolution is distinct from before_row.resolution
    or after_row.resolved_at is distinct from before_row.resolved_at then
   raise exception 'late reopen failure did not roll back finding';
 end if;
 if exists(select 1 from activity_log where event_type='FINDING_REOPENED' and entity_id=before_row.fingerprint) then
   raise exception 'late reopen failure retained activity';
 end if;
end $$;
alter table activity_log drop constraint _s21_reject_finding_reopened;
