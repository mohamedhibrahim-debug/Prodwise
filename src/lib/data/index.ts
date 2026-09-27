import "server-only";

import { isDemoWriteEnabled } from "@/lib/env";
import { requireWorkspaceAccess, requireFreshWorkspaceAccess } from "@/lib/auth/access";
import { isLocalAuth } from "@/lib/auth/service";
import { guardedRepository } from "./guarded-repository";
import { localRepository } from "./local-repository";
import { supabaseRepository } from "./supabase-repository";
import type { Repository } from "./repository";

/**
 * Selects the active repository.
 *
 * This is the only place in the codebase that knows which implementation is
 * serving. Everything above it — pages, components, actions — depends solely on
 * the Repository interface and the domain shapes it returns.
 */
export function getRepository(): Repository {
  return guardedRepository(requireWorkspaceAccess, () => isLocalAuth() ? localRepository : supabaseRepository,
    () => isDemoWriteEnabled, isLocalAuth, requireFreshWorkspaceAccess);
}

export type { Repository } from "./repository";
