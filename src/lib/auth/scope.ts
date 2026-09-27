import { AccessError, type WorkspaceAccess } from "./core";

/** A stale-form fence. The submitted scope never grants access. */
export function assertFormWorkspace(form: FormData, ctx: WorkspaceAccess) {
  assertWorkspaceScope(form.get("scopeWorkspaceId"),ctx);
}
export function assertWorkspaceScope(scope:unknown,ctx:WorkspaceAccess) {
  if (scope !== ctx.workspaceId) {
    throw new AccessError("SCOPE_CHANGED", "Your organization changed. Reload this page before saving.");
  }
}
