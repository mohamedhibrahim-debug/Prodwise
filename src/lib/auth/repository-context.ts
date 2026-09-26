import { AsyncLocalStorage } from 'node:async_hooks';
import type { WorkspaceAccess } from './core';
const requests = new AsyncLocalStorage<WorkspaceAccess>();
export function repositoryContext() { return requests.getStore(); }
export function withRepositoryContext<T>(ctx: WorkspaceAccess, operation: () => T): T { return requests.run(ctx, operation); }
