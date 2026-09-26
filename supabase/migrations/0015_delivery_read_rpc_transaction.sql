-- The membership guard takes FOR SHARE row locks. PostgREST runs a STABLE
-- RPC POST in READ ONLY, which rejects those locks with SQLSTATE 25006.
-- VOLATILE selects a READ WRITE transaction for the existing POST RPC; the
-- read body, authorization, grants and all business records remain unchanged.
-- Reference: https://docs.postgrest.org/en/stable/references/transactions.html
begin;
alter function public.delivery_read_workspace(uuid,uuid) volatile;
-- Refresh the cached volatility metadata after this transaction commits.
notify pgrst, 'reload schema';
commit;
