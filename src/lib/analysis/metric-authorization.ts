import { canBusinessWrite, hasOrganizationAdminAuthority, type PlatformRole, type Role } from "../auth/roles.ts";

/* Who may define a metric or record an observation (decision D2): the initiative's
   owner, an Org Owner, an Admin or a Product Lead. Viewers read only. Every write
   also follows the environment write gate, which is what a Demo guest follows too.
   This is pure so the server action and the form explain the same refusal; the
   server action is the control, the form only reflects it. */

export type MetricSetupDenial = "ARCHIVED" | "VIEW_ONLY" | "NOT_OWNER" | "WRITE_DISABLED";
export type MetricSetupDecision = { allowed: true } | { allowed: false; reason: MetricSetupDenial; message: string };
export interface MetricSetupActor { role: Role | null; platformRole: PlatformRole; isProductLead: boolean; memberId: string | null }
export interface MetricSetupTarget { ownerMemberId: string | null; archived: boolean }
export interface MetricSetupEnvironment { writesEnabled: boolean; demoGuest: boolean }

export const METRIC_SETUP_MESSAGE: Record<MetricSetupDenial, string> = {
  ARCHIVED: "This initiative is archived; its records are kept for reference and no metric can be added.",
  VIEW_ONLY: "Viewers can read metrics but cannot define them.",
  NOT_OWNER: "Only this initiative's owner, an Org Owner, an Admin or a Product Lead can define its metrics.",
  WRITE_DISABLED: "Changes are disabled in this environment.",
};

export function metricSetupDecision(actor: MetricSetupActor, target: MetricSetupTarget, env: MetricSetupEnvironment): MetricSetupDecision {
  const deny = (reason: MetricSetupDenial): MetricSetupDecision => ({ allowed: false, reason, message: METRIC_SETUP_MESSAGE[reason] });
  if (target.archived) return deny("ARCHIVED");
  if (!canBusinessWrite(actor)) return deny("VIEW_ONLY");
  const elevated = hasOrganizationAdminAuthority(actor) || actor.isProductLead || (actor.memberId !== null && target.ownerMemberId === actor.memberId);
  if (!elevated) return deny("NOT_OWNER");
  // A Demo guest holds the reviewer's membership; the environment gate is what limits it.
  if (!env.writesEnabled || (env.demoGuest && !env.writesEnabled)) return deny("WRITE_DISABLED");
  return { allowed: true };
}
