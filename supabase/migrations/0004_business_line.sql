-- ============================================================================
-- PRODWISE — Business Line
--
-- Portfolio/product context on an initiative: which part of the business it
-- belongs to. It is NOT a lifecycle stage, an assessment state, a status, an
-- evidence boundary or a tag, and it carries no permissions, ownership or
-- reasoning. It exists to group and filter.
--
-- A controlled enum of exactly five values, so an out-of-list value cannot be
-- written through any path.
-- ============================================================================

create type public.business_line as enum (
  'ACCEPTANCE',
  'BP',
  'FS',
  'MF',
  'DIGITAL_TRANSFORMATION'
);

-- Added nullable first so the existing rows are not rejected mid-migration.
alter table public.initiatives
  add column business_line public.business_line;

-- Backfill the seeded demo initiatives. These are synthetic demo records; the
-- assignments are for demonstration only and carry no business meaning beyond
-- showing the filter working across more than one line.
update public.initiatives set business_line = 'MF'
  where slug = 'merchant-flex-finance';
update public.initiatives set business_line = 'FS'
  where slug = 'instant-settlement-payout';
update public.initiatives set business_line = 'ACCEPTANCE'
  where slug = 'merchant-kyc-refresh';
update public.initiatives set business_line = 'BP'
  where slug = 'collections-reporting-rebuild';

-- Anything else that already exists (a user-created initiative from before this
-- change) gets a defined value rather than being left null or dropped. BP is a
-- neutral landing place; it can be corrected in the product afterwards.
update public.initiatives set business_line = 'BP' where business_line is null;

-- Only once every row has a value can the column become required.
alter table public.initiatives
  alter column business_line set not null;

comment on column public.initiatives.business_line is
  'Portfolio context only. Not a stage, state, status, boundary or tag; grants no permissions and drives no reasoning.';

create index initiatives_business_line_idx
  on public.initiatives (business_line);
