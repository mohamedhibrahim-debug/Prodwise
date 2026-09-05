-- ============================================================================
-- PRODWISE — Phase 1 seed data
--
-- SYNTHETIC DEMO DATA. None of this was produced by a reasoning engine;
-- Phase 1 has none. Every initiative here is flagged is_demo = true and is
-- labelled as demo data in the UI. See CLAUDE.md §20.
--
-- Idempotent: safe to re-run.
-- ============================================================================

-- ── Demo user ───────────────────────────────────────────────────────────────
insert into public.users (id, email, display_name)
values (
  '00000000-0000-4000-8000-000000000001',
  'demo.pm@prodwise.local',
  'Demo Product Manager'
)
on conflict (email) do nothing;

-- ── Initiatives ─────────────────────────────────────────────────────────────
-- Four are seeded rather than one so the Initiatives list can demonstrate its
-- default priority across all four assessment states.
insert into public.initiatives (
  id, slug, name, description, known_references,
  stage, overall_state, state_summary, is_demo, created_by, created_at, updated_at
) values
(
  '11111111-1111-4111-8111-111111111111',
  'merchant-flex-finance',
  'Merchant Flex Finance',
  'A merchant working-capital financing initiative allowing eligible merchants to request financing and repay installments from settlement activity.',
  E'MFF-104, MFF-118, MFF-133\nProduct Requirements v2.3',
  'DELIVERY',
  'AT_RISK',
  'Core implementation is progressing, but release readiness is at risk due to unresolved financial-rule validation.',
  true,
  '00000000-0000-4000-8000-000000000001',
  '2026-04-14T09:20:00Z',
  '2026-09-03T14:05:00Z'
),
(
  '22222222-2222-4222-8222-222222222222',
  'instant-settlement-payout',
  'Instant Settlement Payout',
  'Same-day settlement payouts to merchant accounts, replacing the T+2 batch cycle for eligible segments.',
  'ISP-42, ISP-77',
  'RELEASE_PREPARATION',
  'BLOCKED',
  'Implementation is complete, but release is blocked pending an unresolved partner-bank cut-off dependency.',
  true,
  '00000000-0000-4000-8000-000000000001',
  '2026-02-02T10:00:00Z',
  '2026-09-04T08:41:00Z'
),
(
  '33333333-3333-4333-8333-333333333333',
  'merchant-kyc-refresh',
  'Merchant KYC Refresh',
  'Periodic re-verification of merchant identity and beneficial ownership records across the active merchant base.',
  'KYC-11',
  'ALIGNMENT',
  'UNKNOWN',
  'Too little evidence has been connected to determine where this initiative currently stands.',
  true,
  '00000000-0000-4000-8000-000000000001',
  '2026-07-22T13:30:00Z',
  '2026-08-28T16:12:00Z'
),
(
  '44444444-4444-4444-8444-444444444444',
  'collections-reporting-rebuild',
  'Collections Reporting Rebuild',
  'Rebuild of the daily collections and arrears reporting pack on the current data platform.',
  'CRR-9, CRR-15',
  'DEFINITION',
  'READY',
  'Definition is complete and agreed; no material issues were detected in the connected evidence.',
  true,
  '00000000-0000-4000-8000-000000000001',
  '2026-08-11T11:15:00Z',
  '2026-09-01T09:02:00Z'
)
on conflict (id) do nothing;

-- ── Activity ────────────────────────────────────────────────────────────────
insert into public.activity_log (
  id, initiative_id, actor_id, event_type, summary, occurred_at
) values
('a1111111-1111-4111-8111-111111111101', '11111111-1111-4111-8111-111111111111', '00000000-0000-4000-8000-000000000001', 'FINDING_DETECTED',   'Finance calculation conflict detected',           '2026-09-03T14:05:00Z'),
('a1111111-1111-4111-8111-111111111102', '11111111-1111-4111-8111-111111111111', '00000000-0000-4000-8000-000000000001', 'DELIVERY_UPDATE',    'One implementation story completed',              '2026-08-29T11:40:00Z'),
('a1111111-1111-4111-8111-111111111103', '11111111-1111-4111-8111-111111111111', '00000000-0000-4000-8000-000000000001', 'DECISION_RECORDED',  'Islamic-only financing decision added',           '2026-08-18T10:05:00Z'),
('a2222222-2222-4222-8222-222222222201', '22222222-2222-4222-8222-222222222222', '00000000-0000-4000-8000-000000000001', 'DEPENDENCY_FLAGGED', 'Partner-bank cut-off dependency raised as blocking', '2026-09-04T08:41:00Z'),
('a2222222-2222-4222-8222-222222222202', '22222222-2222-4222-8222-222222222222', '00000000-0000-4000-8000-000000000001', 'DELIVERY_UPDATE',    'Final implementation story closed',               '2026-08-26T15:20:00Z'),
('a3333333-3333-4333-8333-333333333301', '33333333-3333-4333-8333-333333333333', '00000000-0000-4000-8000-000000000001', 'EVIDENCE_ADDED',     'Initial scoping note connected',                  '2026-08-28T16:12:00Z'),
('a4444444-4444-4444-8444-444444444401', '44444444-4444-4444-8444-444444444444', '00000000-0000-4000-8000-000000000001', 'DEFINITION_AGREED',  'Reporting scope agreed with Finance',             '2026-09-01T09:02:00Z')
on conflict (id) do nothing;
