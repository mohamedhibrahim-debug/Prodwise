-- Ask Prodwise, Wave 2 (decision D8): personal assistant preferences per user, across devices.
--
-- One jsonb column on users, namespaced by feature (preferences->'assistant'), so a later
-- personal setting does not need another column. Written only through an RPC that accepts
-- the four known assistant keys with their allowed values; unknown keys and wrong types are
-- refused, so a client cannot store arbitrary data. Server-only (service role); RLS on users
-- is unchanged. Product records are untouched: these settings change nothing anyone else sees.
--
-- NOT APPLIED to hosted Supabase in Wave 2. Apply with the Wave 3 panel.
begin;

alter table public.users add column preferences jsonb not null default '{}'::jsonb;
alter table public.users add constraint users_preferences_is_object check (jsonb_typeof(preferences) = 'object');

create function public.set_assistant_preferences(p_user_id uuid, p_patch jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare current_assistant jsonb; next_assistant jsonb; k text; v jsonb;
begin
  if p_patch is null or jsonb_typeof(p_patch) <> 'object' or p_patch = '{}'::jsonb then raise exception 'INVALID_PREFERENCES'; end if;
  select coalesce(preferences -> 'assistant', '{}'::jsonb) into current_assistant from public.users where id = p_user_id and active for update;
  if not found then raise exception 'USER_UNAVAILABLE'; end if;
  next_assistant := current_assistant;
  for k, v in select * from jsonb_each(p_patch) loop
    if k in ('show', 'proactive') and jsonb_typeof(v) = 'boolean' then next_assistant := next_assistant || jsonb_build_object(k, v);
    elsif k = 'language' and v in ('"auto"'::jsonb, '"en"'::jsonb, '"ar"'::jsonb) then next_assistant := next_assistant || jsonb_build_object(k, v);
    elsif k = 'openBehaviour' and v in ('"remember"'::jsonb, '"collapsed"'::jsonb) then next_assistant := next_assistant || jsonb_build_object(k, v);
    else raise exception 'INVALID_PREFERENCES';
    end if;
  end loop;
  update public.users set preferences = preferences || jsonb_build_object('assistant', next_assistant) where id = p_user_id;
  return next_assistant;
end $$;

revoke all on function public.set_assistant_preferences(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.set_assistant_preferences(uuid, jsonb) to service_role;

commit;
