-- A confirmed (ACTIVE) entry's content is fixed: changing what it says in place would keep a
-- confirmation nobody gave to the new content. Corrections are a new entry that replaces it
-- (the old one becomes SUPERSEDED). Status and supersession may still change.
begin;
create or replace function public.claims_guard_confirmed_content() returns trigger
language plpgsql set search_path = '' as $$
begin
  if old.status = 'ACTIVE' and (new.type, new.subject, new.attribute, new.value, new.domain, new.phase)
     is distinct from (old.type, old.subject, old.attribute, old.value, old.domain, old.phase) then
    raise exception using errcode = 'P0001', message = 'CONFIRMED_CLAIM_CONTENT_IMMUTABLE';
  end if;
  return new;
end $$;
create trigger claims_guard_confirmed_content before update on public.claims
  for each row execute function public.claims_guard_confirmed_content();
revoke all on function public.claims_guard_confirmed_content() from public, anon, authenticated;
commit;
