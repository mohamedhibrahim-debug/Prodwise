do $$ begin
 if (select count(*) from claims) <> (select count(*) from _s21_claim_baseline) then raise exception 'claim count changed'; end if;
 if exists(select 1 from claims where origin <> 'LEGACY' or verified_at is not null) then raise exception 'bad trust backfill'; end if;
 if exists(select 1 from claims c join _s21_claim_baseline b using(id) where c.updated_at <> b.updated_at) then raise exception 'updated_at changed'; end if;
 if exists(
   select 1 from claims c join _s21_claim_baseline b using(id)
   where (to_jsonb(c) - array['origin','verified_at','verified_actor_id','verified_actor_label','verification_basis','verification_note'])::text <> b.row_before
 ) then raise exception 'existing claim fields changed'; end if;
 if exists(select 1 from claim_evidence where locator is not null or excerpt is not null) then raise exception 'anchors not null'; end if;
end $$;
