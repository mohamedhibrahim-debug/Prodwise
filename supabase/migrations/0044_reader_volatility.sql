-- These readers were declared STABLE, so PostgREST runs them in a read-only
-- transaction. Each one calls require_workspace_member, which takes FOR SHARE
-- row locks on the organization, workspace and membership; a read-only
-- transaction refuses those (SQLSTATE 25006, surfaced by PostgREST as HTTP 405),
-- so every page that reads them failed to load in the hosted database.
-- Marking them VOLATILE keeps the authority check and its locks unchanged.
-- Bodies, grants and results are unchanged.
begin;
alter function public.read_initiative_management(uuid,uuid) volatile;
alter function public.read_anchored_evidence(uuid,uuid,uuid) volatile;
alter function public.read_open_questions(uuid,uuid) volatile;
alter function public.read_relationships(uuid,uuid) volatile;
alter function public.read_risk_tracking(uuid,uuid) volatile;
commit;
