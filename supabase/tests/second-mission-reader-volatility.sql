\set ON_ERROR_STOP on
do $$begin if current_database() !~ '^prodwise_second_[0-9a-f]{32}$' then raise exception 'DISPOSABLE_LOCAL_DATABASE_REQUIRED';end if;end$$;
-- PostgREST runs STABLE/IMMUTABLE functions in a read-only transaction. A reader
-- that checks authority with require_workspace_member takes FOR SHARE locks, so it
-- must be VOLATILE or the hosted API refuses it (25006 → HTTP 405).
do $$declare bad text;begin
 select string_agg(p.oid::regprocedure::text,', ') into bad from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.provolatile<>'v' and position('require_workspace_member' in p.prosrc)>0;
 if bad is not null then raise exception 'NON_VOLATILE_AUTHORITY_READER %',bad;end if;end$$;
-- Every reader works when called the way PostgREST calls it.
begin;
set local role service_role;
do $$declare w uuid:='d2000000-0000-4000-8000-000000000002';m uuid:='d2000000-0000-4000-8000-000000000003';iid uuid;begin
 select id into iid from public.initiatives where workspace_id=w limit 1;
 perform public.read_initiative_management(w,m);
 perform public.read_open_questions(w,m);
 perform public.read_relationships(w,m);
 perform public.read_risk_tracking(w,m);
 if iid is not null then perform public.read_anchored_evidence(w,m,iid);end if;
end$$;
rollback;
