create table public._s21_claim_baseline as
select id, to_jsonb(c)::text row_before, updated_at from public.claims c;
