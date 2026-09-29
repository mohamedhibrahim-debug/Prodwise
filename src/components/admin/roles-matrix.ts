import { ROLES, canBusinessWrite, hasOrganizationAdminAuthority, type Role } from "@/lib/auth/roles";
import { authorizeFinalize, authorizeInvitationRole, authorizeManagement, authorizeMembershipChange, authorizeOwner, authorizePlatform, type Member, type WorkspaceAccess } from "@/lib/auth/core";

/**
 * The Roles & permissions explainer is derived by exercising the real
 * authorization guards with a synthetic context per role — never by hand.
 * If a guard changes, this table changes with it (and the test pins the
 * expectations the product documents).
 */
export type Grant = "yes" | "no" | "lead" | "operator" | "none";
export const MATRIX_COLUMNS = [...ROLES, "PLATFORM_OWNER"] as const;
export type MatrixColumn = (typeof MATRIX_COLUMNS)[number];

export interface CapabilityRow {
  key: string;
  label: string;
  /** One line of context: where the rule is applied or what it excludes. */
  note: string;
  grants: Record<MatrixColumn, Grant>;
}

function contextFor(column: MatrixColumn, isProductLead = false): WorkspaceAccess {
  const platform = column === "PLATFORM_OWNER";
  return {
    workspaceId: "w", organizationId: "o", memberId: platform ? null : "m",
    actor: { id: "u", label: "Synthetic" },
    platformRole: platform ? "PLATFORM_OWNER" : null,
    role: platform ? null : column,
    isProductLead: platform ? false : isProductLead,
  };
}
const target = (role: Role): Member => ({ id: "t", workspaceId: "w", organizationId: "o", userId: "tu", email: "t@example.invalid", displayName: "Target", platformRole: null, role, isProductLead: false, active: true, policyOverride: false, policyOverrideReason: null });
const allowed = (fn: () => unknown) => { try { fn(); return true; } catch { return false; } };
const yesNo = (ok: boolean): Grant => ok ? "yes" : "no";

interface Capability { key: string; label: string; note: string; grant: (ctx: WorkspaceAccess, column: MatrixColumn) => Grant }

const CAPABILITIES: Capability[] = [
  { key: "read", label: "Read initiatives, evidence, reviews and analysis", note: "Any active membership. A Platform Owner reads every organization.", grant: () => "yes" },
  { key: "write", label: "Record product truth: evidence, Knowledge, decisions, commitments", note: "Nothing becomes truth without a person confirming it; Viewer is read-only. Metric definitions additionally need the initiative owner, an Org Owner, Admin or Product Lead.", grant: ctx => yesNo(canBusinessWrite(ctx)) },
  {
    key: "finalize", label: "Finalize a Weekly Review", note: "Owners and Admins by role; a Member with the Product Lead flag; a Viewer cannot be made Product Lead.",
    grant: (ctx, column) => {
      if (allowed(() => authorizeFinalize(ctx, true))) return "yes";
      // A Member gains it through the Product Lead flag; the guard refuses the flag on a Viewer.
      const asLead = contextFor(column, true);
      const leadAllowed = column !== "PLATFORM_OWNER" && allowed(() => authorizeMembershipChange(contextFor("ORG_OWNER"), target(column as Role), column as Role, true, true)) && allowed(() => authorizeFinalize(asLead, true));
      return leadAllowed ? "lead" : "no";
    },
  },
  { key: "members", label: "Invite Members and Viewers; change their role; deactivate or restore them", note: "Owners and platform identities are protected from this path.", grant: ctx => yesNo(allowed(() => authorizeManagement(ctx, true)) && allowed(() => authorizeInvitationRole(ctx, "MEMBER")) && allowed(() => authorizeMembershipChange(ctx, target("MEMBER"), "VIEWER", false, false))) },
  { key: "admins", label: "Invite Admins or change an Admin’s access", note: "An Admin cannot change another Admin.", grant: ctx => yesNo(allowed(() => authorizeInvitationRole(ctx, "ADMIN")) && allowed(() => authorizeMembershipChange(ctx, target("ADMIN"), "MEMBER", true, false))) },
  { key: "rename", label: "Rename the workspace", note: "Preferences → Workspace name.", grant: ctx => yesNo(allowed(() => authorizeOwner(ctx, true))) },
  { key: "owners", label: "Assign or replace Org Owners", note: "Reserved for the operator; recorded with a reason.", grant: (ctx, column) => allowed(() => authorizeInvitationRole(ctx, "ORG_OWNER")) ? "yes" : column === "PLATFORM_OWNER" && allowed(() => authorizePlatform(ctx)) ? "operator" : "no" },
  { key: "policy", label: "Change who may join: allowed email domains, exact exceptions, self sign-up", note: "Operator only; every change is recorded in platform history.", grant: ctx => allowed(() => authorizePlatform(ctx)) ? "operator" : "no" },
  { key: "delete", label: "Delete or transfer the organization", note: "No such action exists in Prodwise. Ownership moves by replacing Org Owners; nothing deletes an organization or its records.", grant: () => "none" },
];

export function roleMatrix(): CapabilityRow[] {
  return CAPABILITIES.map(c => ({
    key: c.key, label: c.label, note: c.note,
    grants: Object.fromEntries(MATRIX_COLUMNS.map(column => [column, c.grant(contextFor(column), column)])) as Record<MatrixColumn, Grant>,
  }));
}

/** Sanity: administrators by guard are exactly Owner, Admin and the operator. */
export function administratorColumns(): MatrixColumn[] {
  return MATRIX_COLUMNS.filter(column => hasOrganizationAdminAuthority(contextFor(column)));
}

export const GRANT_TEXT: Record<Grant, string> = { yes: "Yes", no: "No", lead: "With Product Lead flag", operator: "Operator only", none: "Not available to anyone" };
