do $$ begin
 if not exists(select 1 from pg_type where typname='claim_origin') then raise exception 'migration missing after reapply'; end if;
end $$;
