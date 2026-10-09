begin;
-- Bounded reporting pages can exceed the shared gateway's 8s default under load.
alter function public.read_executive_part(uuid,uuid,uuid,integer,integer)
  set statement_timeout='30s';
notify pgrst,'reload schema';
commit;
