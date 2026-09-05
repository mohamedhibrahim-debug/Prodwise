import "server-only";

import { isSupabaseConfigured } from "@/lib/env";
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
  return isSupabaseConfigured ? supabaseRepository : localRepository;
}

export type { Repository } from "./repository";
