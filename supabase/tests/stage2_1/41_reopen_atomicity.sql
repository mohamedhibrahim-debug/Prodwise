do $$ begin
 if exists(select 1 from finding_states where fingerprint='s21-test' and (resolution is not null or resolved_at is not null)) then raise exception 'reopen not coherent'; end if;
end $$;
