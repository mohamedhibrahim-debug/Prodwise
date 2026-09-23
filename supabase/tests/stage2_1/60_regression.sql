do $$ begin
 if (select count(*) from claims where id::text like 'cccc0001-%') <> 14 then raise exception 'MFF seed claims changed'; end if;
 if (select count(*) from claims where status='SUPERSEDED' and id::text like 'cccc0001-%') <> 1 then raise exception 'supersession changed'; end if;
end $$;
