do $$ begin
 if has_function_privilege('anon','verify_claim(uuid,text,verification_basis,text,text,text)','EXECUTE') then raise exception 'anon execute'; end if;
 if has_function_privilege('authenticated','reopen_finding_state(uuid,text,text,text)','EXECUTE') then raise exception 'authenticated execute'; end if;
 if not has_function_privilege('service_role','verify_claim(uuid,text,verification_basis,text,text,text)','EXECUTE') then raise exception 'service role missing'; end if;
end $$;
