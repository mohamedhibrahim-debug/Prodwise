-- Defence in depth: nothing outside the server role should be able to invoke public functions.
-- These were executable through Postgres's default PUBLIC grant. Trigger functions cannot be
-- called directly and still fire (EXECUTE is checked when a trigger is created, not when it
-- fires); the two plain helpers keep working for the server role that calls them.
begin;
revoke execute on function
 public.assert_initiative_not_archived(uuid,uuid),
 public.evidence_utf16_slice(text,integer,integer),
 public.attach_parent_workspace(),
 public.claims_guard_trust(),
 public.finding_states_guard_decision(),
 public.guard_claim_applicability(),
 public.guard_delivery_applicability(),
 public.guard_evidence_anchor(),
 public.guard_evidence_proposal(),
 public.membership_event_actor_snapshot(),
 public.membership_not_system(),
 public.set_updated_at(),
 public.workspace_admin_invariant()
from public, anon, authenticated;
grant execute on function public.assert_initiative_not_archived(uuid,uuid), public.evidence_utf16_slice(text,integer,integer) to service_role;
commit;
