-- Bulk reporting commits exceed the default API timeout with real monthly exports.
-- PostgREST hoists this function-specific limit; all other RPCs keep their limits.
alter function public.commit_executive_workspace(uuid, uuid, integer, jsonb)
  set statement_timeout = '60s';
notify pgrst, 'reload schema';
