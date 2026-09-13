-- ============================================================================
-- PRODWISE — Phase 4, Slice 1 follow-up: content digest on finding state
--
-- Records WHAT a finding contained when a person resolved it, so a resolution
-- cannot silently stand over content it never described.
--
-- Neither of the signals already available can detect that:
--
--   * the fingerprint deliberately ignores membership, so it survives a claim
--     joining or leaving a conflict group whose set of distinct values is
--     unchanged;
--   * `detected_on` is a maximum over the SURVIVING claims, and a maximum does
--     not move when a member is removed;
--   * evidence links never touch `claims.updated_at`, so re-linking or
--     excluding provenance rewrites what a finding cites while every timestamp
--     stays put.
--
-- Additive and nullable: rows written before this column existed keep their
-- resolution rather than being reopened en masse.
-- ============================================================================

alter table public.finding_states
  add column content_digest text;

comment on column public.finding_states.content_digest is
  'Hash of the finding''s member claims, values and provenance at the moment it was resolved. A mismatch reopens the finding and keeps the earlier note as history. Null means the row predates this column.';
