import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { WorkspaceAccess } from '../auth/core';
/** Mandatory explicit query scopes on a server-only service-role client. */
export function workspaceClient(base: SupabaseClient, ctx: WorkspaceAccess): SupabaseClient {
  return new Proxy(base, { get(target, property) {
    if (property === 'from') return (table: string) => {
      const builder = base.from(table);
      return new Proxy(builder, { get(query, operation) {
        const original = Reflect.get(query, operation);
        if (['select','update','delete','insert','upsert'].includes(String(operation))) return (...values: unknown[]) => {
          if (operation === 'insert' || operation === 'upsert') {
            const scoped = (value: unknown) => ({ ...(value as object), workspace_id: ctx.workspaceId,
              ...(['initiatives','evidence','claims'].includes(table) ? { created_by: ctx.actor.id } : {}),
              ...(table === 'activity_log' ? { actor_id: ctx.actor.id, actor_label: ctx.actor.label } : {}) });
            values[0] = Array.isArray(values[0]) ? values[0].map(scoped) : scoped(values[0]);
          }
          const result = Reflect.apply(original, query, values) as { eq: (key: string, value: string) => unknown };
          return operation === 'insert' || operation === 'upsert' ? result : result.eq('workspace_id', ctx.workspaceId);
        };
        return typeof original === 'function' ? original.bind(query) : original;
      } });
    };
    if (property === 'rpc') return (operation: string, args: object) => base.rpc('auth_business_rpc', {
      p_workspace_id: ctx.workspaceId, p_member_id: ctx.memberId, p_operation: operation, p_args: args,
    });
    const value = Reflect.get(target, property);
    return typeof value === 'function' ? value.bind(target) : value;
  } });
}
