-- A Platform Owner acting in an organization where they hold no membership keeps platform
-- authority (0012), but every product record they create names that authority, so history never
-- presents it as a member's action. Only the recorded label changes; no permission changes.
begin;
do $$declare r record;def text;patched integer:=0;
 old_actor text:='select display_name into actor_label from public.users where id=actor.user_id';
 new_actor text:='select display_name||case when actor.id is null and platform_role=''PLATFORM_OWNER'' then '' (Platform Owner, not a member)'' else '''' end into actor_label from public.users where id=actor.user_id';
 old_label text:='select display_name into label from public.users where id=actor.user_id';
 new_label text:='select display_name||case when actor.id is null and platform_role=''PLATFORM_OWNER'' then '' (Platform Owner, not a member)'' else '''' end into label from public.users where id=actor.user_id';
begin
 for r in select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and (p.prosrc like '%'||old_actor||'%' or p.prosrc like '%'||old_label||'%') loop
  def:=pg_get_functiondef(r.oid);def:=replace(replace(def,old_actor,new_actor),old_label,new_label);execute def;patched:=patched+1;
 end loop;
 if patched<10 then raise exception 'PATCH_TARGET_MISSING platform actor attribution (%)',patched;end if;
 raise notice 'platform actor attribution applied to % functions',patched;
end$$;
commit;
