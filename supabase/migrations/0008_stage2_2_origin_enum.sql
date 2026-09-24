-- Stage 2.2: a person's corrected value has a distinct, immutable origin.
alter type public.claim_origin add value if not exists 'HUMAN_DECISION';
