do $$ begin
 if has_function_privilege('anon','verify_claim(uuid,timestamptz,verification_basis,text,text,text)','EXECUTE') then raise exception 'anon execute'; end if;
 if has_function_privilege('authenticated','reopen_finding_state(uuid,text,text,text)','EXECUTE') then raise exception 'authenticated execute'; end if;
 if not has_function_privilege('service_role','verify_claim(uuid,timestamptz,verification_basis,text,text,text)','EXECUTE') then raise exception 'service role missing'; end if;
 if (select prosecdef from pg_proc where oid='verify_claim(uuid,timestamptz,verification_basis,text,text,text)'::regprocedure) then raise exception 'verify must be invoker'; end if;
 if (select prosecdef from pg_proc where oid='reopen_finding_state(uuid,text,text,text)'::regprocedure) then raise exception 'reopen must be invoker'; end if;
 if (select proconfig from pg_proc where oid='verify_claim(uuid,timestamptz,verification_basis,text,text,text)'::regprocedure) <> array['search_path=""'] then raise exception 'verify search path'; end if;
 if (select proconfig from pg_proc where oid='reopen_finding_state(uuid,text,text,text)'::regprocedure) <> array['search_path=""'] then raise exception 'reopen search path'; end if;
end $$;
