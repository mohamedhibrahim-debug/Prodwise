insert into finding_states(initiative_id,fingerprint,rule_id,content_digest,subject,status,resolution,resolved_at)
values('11111111-1111-4111-8111-111111111111','s21-test','RULE','digest','Subject','RESOLVED','Resolved note',now());
do $$ begin
 if not reopen_finding_state('11111111-1111-4111-8111-111111111111','s21-test',null,'Demo') then raise exception 'not reopened'; end if;
 if (select status from finding_states where fingerprint='s21-test') <> 'OPEN' then raise exception 'row not retained open'; end if;
 if reopen_finding_state('11111111-1111-4111-8111-111111111111','s21-test',null,'Demo') then raise exception 'second reopen true'; end if;
 if (select count(*) from activity_log where event_type='FINDING_REOPENED' and entity_id='s21-test') <> 1 then raise exception 'bad reopen audit'; end if;
end $$;
