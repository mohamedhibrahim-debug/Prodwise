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

-- ============================================================================
-- PHASE 2 — initiative sources and evidence
--
-- Synthetic demo data. Every source is MANUAL: Phase 2 has no connectors, and a
-- fabricated CONNECTED state would misrepresent the system.
--
-- These records are the source layer UNDERNEATH the Phase 1 narrative. They did
-- not produce the Review findings, and nothing derives anything from them.
-- ============================================================================

insert into public.initiative_sources (id, initiative_id, name, source_type, connection_state, created_at, updated_at) values
('aaaa0001-0000-4000-8000-000000000001','11111111-1111-4111-8111-111111111111','Merchant Flex Finance BRD','DOCUMENT','MANUAL','2026-04-14T09:20:00Z','2026-04-14T09:20:00Z'),
('aaaa0001-0000-4000-8000-000000000002','11111111-1111-4111-8111-111111111111','Lending Weekly Meeting','MEETING','MANUAL','2026-04-20T09:00:00Z','2026-04-20T09:00:00Z'),
('aaaa0001-0000-4000-8000-000000000003','11111111-1111-4111-8111-111111111111','Finance Decision Notes','DECISION_NOTE','MANUAL','2026-05-11T09:00:00Z','2026-05-11T09:00:00Z'),
('aaaa0001-0000-4000-8000-000000000004','11111111-1111-4111-8111-111111111111','Jira - Merchant Flex Finance','JIRA','MANUAL','2026-04-14T09:20:00Z','2026-04-14T09:20:00Z')
on conflict (id) do nothing;

insert into public.evidence (id, initiative_id, source_id, title, source_type, source_reference, content_summary, boundary, occurred_at, captured_at, last_verified_at, created_by) values
('bbbb0001-0000-4000-8000-000000000001','11111111-1111-4111-8111-111111111111','aaaa0001-0000-4000-8000-000000000004','Merchant Flex Finance Core Epic','JIRA','MFF-104','Parent epic covering eligibility, offer, contract and repayment for the initial release.','CURRENT_SCOPE','2026-04-14T00:00:00Z','2026-04-14T09:25:00Z','2026-09-02T07:30:00Z','00000000-0000-4000-8000-000000000001'),
('bbbb0001-0000-4000-8000-000000000002','11111111-1111-4111-8111-111111111111','aaaa0001-0000-4000-8000-000000000001','Daily Repayment Requirement','DOCUMENT','MFF-118','Finance requirement defining the daily repayment calculation as the monthly installment divided by 27.','CURRENT_SCOPE','2026-06-02T00:00:00Z','2026-06-02T10:15:00Z','2026-09-02T07:30:00Z','00000000-0000-4000-8000-000000000001'),
('bbbb0001-0000-4000-8000-000000000003','11111111-1111-4111-8111-111111111111','aaaa0001-0000-4000-8000-000000000001','Product Requirements v2.3','DOCUMENT','PR v2.3','Current product requirement set covering eligibility, contract terms and settlement mapping.','CURRENT_SCOPE','2026-07-09T00:00:00Z','2026-07-09T12:00:00Z','2026-09-02T07:30:00Z','00000000-0000-4000-8000-000000000001'),
('bbbb0001-0000-4000-8000-000000000004','11111111-1111-4111-8111-111111111111','aaaa0001-0000-4000-8000-000000000004','Repayment Schedule Implementation','JIRA','MFF-133','Implementation story building the repayment schedule using a divisor of 30.','CURRENT_SCOPE','2026-08-21T00:00:00Z','2026-08-21T09:40:00Z','2026-09-03T13:55:00Z','00000000-0000-4000-8000-000000000001'),
('bbbb0001-0000-4000-8000-000000000005','11111111-1111-4111-8111-111111111111','aaaa0001-0000-4000-8000-000000000003','Islamic Financing Only','DECISION_NOTE','DR-07','Decision restricting the offering to Islamic financing products for this initiative.','CURRENT_SCOPE','2026-08-18T00:00:00Z','2026-08-18T10:05:00Z','2026-08-18T10:05:00Z','00000000-0000-4000-8000-000000000001'),
('bbbb0001-0000-4000-8000-000000000011','11111111-1111-4111-8111-111111111111','aaaa0001-0000-4000-8000-000000000003','Finance Operational Notes - Repayment Failure Handling','DECISION_NOTE','FIN-NOTE-14','Finance notes raising repayment failure and settlement shortfall handling: what happens when a daily settlement deduction is partial or does not occur, and who owns the resulting exception.','CURRENT_SCOPE','2026-08-25T00:00:00Z','2026-08-25T12:10:00Z',null,'00000000-0000-4000-8000-000000000001'),
('bbbb0001-0000-4000-8000-000000000006','11111111-1111-4111-8111-111111111111','aaaa0001-0000-4000-8000-000000000004','Automated Disbursement','JIRA','MFF-190','Automated disbursement of approved financing to merchant accounts.','FUTURE_PHASE','2026-08-05T00:00:00Z','2026-08-05T09:00:00Z','2026-08-05T09:00:00Z','00000000-0000-4000-8000-000000000001'),
('bbbb0001-0000-4000-8000-000000000007','11111111-1111-4111-8111-111111111111','aaaa0001-0000-4000-8000-000000000001','Original Financing Model','DOCUMENT','PR v1.0','Initial requirement describing both traditional and Islamic financing products.','HISTORICAL','2026-04-18T00:00:00Z','2026-04-18T11:00:00Z','2026-04-18T11:00:00Z','00000000-0000-4000-8000-000000000001'),
('bbbb0001-0000-4000-8000-000000000008','11111111-1111-4111-8111-111111111111','aaaa0001-0000-4000-8000-000000000004','Merchant Statement Redesign','JIRA','MFF-141','Statement changes that reference financing repayment lines but sit in a separate delivery stream.','RELATED','2026-08-27T00:00:00Z','2026-08-27T11:20:00Z',null,'00000000-0000-4000-8000-000000000001'),
('bbbb0001-0000-4000-8000-000000000009','11111111-1111-4111-8111-111111111111','aaaa0001-0000-4000-8000-000000000002','Lending Portfolio Review','MEETING','MN-2026-08-12','Portfolio review touching several lending initiatives, including this one.','RELATED','2026-08-12T00:00:00Z','2026-08-12T15:45:00Z',null,'00000000-0000-4000-8000-000000000001'),
('bbbb0001-0000-4000-8000-000000000010','11111111-1111-4111-8111-111111111111','aaaa0001-0000-4000-8000-000000000004','Consumer Flex Financing','JIRA','CFX-88','A separate consumer financing initiative with overlapping terminology.','EXCLUDED','2026-07-15T00:00:00Z','2026-07-15T10:00:00Z','2026-07-15T10:00:00Z','00000000-0000-4000-8000-000000000001'),
('bbbb0002-0000-4000-8000-000000000001','22222222-2222-4222-8222-222222222222',null,'Instant Settlement Payout Core Epic','JIRA','ISP-42','Parent epic for same-day payout across eligible merchant segments.','CURRENT_SCOPE','2026-02-10T00:00:00Z','2026-02-10T09:00:00Z','2026-09-04T07:00:00Z','00000000-0000-4000-8000-000000000001'),
('bbbb0002-0000-4000-8000-000000000002','22222222-2222-4222-8222-222222222222',null,'Payout Window Implementation','JIRA','ISP-77','Implements the intraday payout window and submission schedule.','CURRENT_SCOPE','2026-07-30T00:00:00Z','2026-07-30T10:00:00Z','2026-09-04T07:00:00Z','00000000-0000-4000-8000-000000000001'),
('bbbb0002-0000-4000-8000-000000000003','22222222-2222-4222-8222-222222222222',null,'Weekend Payout Coverage','JIRA','ISP-120','Extends same-day payout to weekends and public holidays.','FUTURE_PHASE','2026-08-14T00:00:00Z','2026-08-14T09:30:00Z',null,'00000000-0000-4000-8000-000000000001'),
('bbbb0003-0000-4000-8000-000000000001','33333333-3333-4333-8333-333333333333',null,'Merchant KYC Refresh Scoping Note','DOCUMENT','KYC-11','Early scoping note describing the intent to re-verify merchant identity records.','CURRENT_SCOPE','2026-07-22T00:00:00Z','2026-07-22T13:35:00Z','2026-08-28T16:12:00Z','00000000-0000-4000-8000-000000000001'),
('bbbb0004-0000-4000-8000-000000000001','44444444-4444-4444-8444-444444444444',null,'Collections Reporting Rebuild','JIRA','CRR-9','Parent item for the reporting rebuild and its agreed scope.','CURRENT_SCOPE','2026-09-01T00:00:00Z','2026-09-01T09:02:00Z','2026-09-01T09:02:00Z','00000000-0000-4000-8000-000000000001'),
('bbbb0004-0000-4000-8000-000000000002','44444444-4444-4444-8444-444444444444',null,'Source Table Mapping','DOCUMENT','CRR-15','Mapping of report fields to source tables and refresh cadence.','CURRENT_SCOPE','2026-08-25T00:00:00Z','2026-08-25T09:00:00Z','2026-09-01T09:02:00Z','00000000-0000-4000-8000-000000000001'),
('bbbb0004-0000-4000-8000-000000000003','44444444-4444-4444-8444-444444444444',null,'Legacy Collections Pack Specification','DOCUMENT','LEG-PACK','Specification for the pack being replaced.','HISTORICAL','2026-08-11T00:00:00Z','2026-08-11T11:15:00Z',null,'00000000-0000-4000-8000-000000000001')
on conflict (id) do nothing;
