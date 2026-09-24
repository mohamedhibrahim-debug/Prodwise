do $$
declare v_signature text; v_oid oid; v_proc pg_catalog.pg_proc%rowtype;
begin
  foreach v_signature in array array[
    'public.resolve_conflict(jsonb)',
    'public.assign_finding_confirmer(jsonb)',
    'public.reopen_finding_state(uuid,text,text,text)',
    'public.set_finding_note(uuid,text,jsonb)'
  ] loop
    v_oid := v_signature::regprocedure::oid;
    select * into v_proc from pg_catalog.pg_proc where oid=v_oid;
    if v_proc.prosecdef or not ('search_path=""' = any(v_proc.proconfig)) then
      raise exception 'RPC security contract failed: %',v_signature;
    end if;
    if pg_catalog.has_function_privilege('anon',v_oid,'EXECUTE')
      or pg_catalog.has_function_privilege('authenticated',v_oid,'EXECUTE')
      or not pg_catalog.has_function_privilege('service_role',v_oid,'EXECUTE') then
      raise exception 'RPC execute privilege failed: %',v_signature;
    end if;
  end loop;
end $$;
