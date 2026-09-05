import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { assertWriteAllowed, supabaseServiceRoleKey, supabaseUrl } from "@/lib/env";
import type {
  ActivityEntry,
  AssessmentState,
  Initiative,
  NewInitiativeInput,
  Stage,
} from "@/lib/domain/types";
import { uniqueSlug, type Repository } from "./repository";

/**
 * Supabase-backed repository.
 *
 * Server-side only. RLS is enabled on every table with no policies, so the
 * anon and authenticated roles can read and write nothing; all access here goes
 * through the service-role key, which never leaves the server. Mutations are
 * additionally gated by DEMO_WRITE_ENABLED. See CLAUDE.md §18.
 */

interface InitiativeRow {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  known_references: string | null;
  stage: Stage;
  overall_state: AssessmentState;
  state_summary: string | null;
  is_demo: boolean;
  created_at: string;
  updated_at: string;
}

interface ActivityRow {
  id: string;
  initiative_id: string;
  event_type: string;
  summary: string;
  occurred_at: string;
}

let client: SupabaseClient | null = null;

function getClient(): SupabaseClient {
  if (!client) {
    client = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}

/** Row → domain. The only place snake_case is allowed to exist. */
function toInitiative(row: InitiativeRow): Initiative {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    knownReferences: row.known_references,
    stage: row.stage,
    overallState: row.overall_state,
    stateSummary: row.state_summary,
    isDemo: row.is_demo,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toActivity(row: ActivityRow): ActivityEntry {
  return {
    id: row.id,
    initiativeId: row.initiative_id,
    eventType: row.event_type,
    summary: row.summary,
    occurredAt: row.occurred_at,
  };
}

export const supabaseRepository: Repository = {
  async listInitiatives() {
    const { data, error } = await getClient()
      .from("initiatives")
      .select("*")
      .order("updated_at", { ascending: false });

    if (error) throw new Error(`Failed to list initiatives: ${error.message}`);
    return (data as InitiativeRow[]).map(toInitiative);
  },

  async getInitiativeBySlug(slug) {
    const { data, error } = await getClient()
      .from("initiatives")
      .select("*")
      .eq("slug", slug)
      .maybeSingle();

    if (error) throw new Error(`Failed to load initiative: ${error.message}`);
    return data ? toInitiative(data as InitiativeRow) : null;
  },

  async listActivity(initiativeId, limit = 10) {
    const { data, error } = await getClient()
      .from("activity_log")
      .select("*")
      .eq("initiative_id", initiativeId)
      .order("occurred_at", { ascending: false })
      .limit(limit);

    if (error) throw new Error(`Failed to load activity: ${error.message}`);
    return (data as ActivityRow[]).map(toActivity);
  },

  async createInitiative(input: NewInitiativeInput) {
    // Phase 1 write safety — enforced here, in the data layer, not in the UI.
    assertWriteAllowed();

    const supabase = getClient();

    const { data: existing, error: slugError } = await supabase
      .from("initiatives")
      .select("slug");
    if (slugError) throw new Error(`Failed to read slugs: ${slugError.message}`);

    const slug = uniqueSlug(
      input.name,
      (existing as { slug: string }[]).map((r) => r.slug),
    );

    const { data, error } = await supabase
      .from("initiatives")
      .insert({
        slug,
        name: input.name.trim(),
        description: input.description?.trim() || null,
        known_references: input.knownReferences?.trim() || null,
        // No connected evidence yet, so the state is genuinely unknown.
        stage: "DISCOVERY",
        overall_state: "UNKNOWN",
        state_summary: null,
        is_demo: false,
      })
      .select("*")
      .single();

    if (error) throw new Error(`Failed to create initiative: ${error.message}`);

    const created = toInitiative(data as InitiativeRow);

    const { error: activityError } = await supabase.from("activity_log").insert({
      initiative_id: created.id,
      event_type: "INITIATIVE_CREATED",
      summary: "Initiative created",
    });
    // The initiative exists; a failed audit row should not lose the user's work.
    if (activityError) {
      console.error("Failed to write activity_log entry:", activityError.message);
    }

    return created;
  },
};
