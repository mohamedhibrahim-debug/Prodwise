delete from claims where id::text like 'cccc0001-%';
\ir ../../seed.sql
do $$ begin
 if (select count(*) from claims where id::text like 'cccc0001-%') <> 14 then raise exception 'fresh seed count'; end if;
 if exists(select 1 from claims where id::text like 'cccc0001-%' and origin <> 'LEGACY') then raise exception 'fresh seed origin'; end if;
end $$;
