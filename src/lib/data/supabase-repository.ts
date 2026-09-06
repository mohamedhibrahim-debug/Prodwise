import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { assertWriteAllowed, supabaseServiceRoleKey, supabaseUrl } from "@/lib/env";
import { EVIDENCE_RELATION_LABEL } from "@/lib/domain/labels";
import type {
  ActivityEntry,
  AssessmentState,
  ConnectionState,
  EvidencePatch,
  EvidenceRecord,
  EvidenceRelation,
  EvidenceSourceType,
  Initiative,
  InitiativeSource,
  NewEvidenceInput,
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

interface EvidenceRow {
  id: string;
  initiative_id: string;
  source_id: string | null;
  title: string;
  source_type: EvidenceSourceType;
  source_reference: string | null;
  source_url: string | null;
  content_summary: string | null;
  boundary: EvidenceRelation;
  occurred_at: string | null;
  captured_at: string;
  last_verified_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

interface SourceRow {
  id: string;
  initiative_id: string;
  name: string;
  source_type: EvidenceSourceType;
  connection_state: ConnectionState;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
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

function toEvidence(row: EvidenceRow): EvidenceRecord {
  return {
    id: row.id,
    initiativeId: row.initiative_id,
    sourceId: row.source_id,
    title: row.title,
    sourceType: row.source_type,
    sourceReference: row.source_reference,
    sourceUrl: row.source_url,
    contentSummary: row.content_summary,
    boundary: row.boundary,
    occurredAt: row.occurred_at,
    capturedAt: row.captured_at,
    lastVerifiedAt: row.last_verified_at,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toSource(row: SourceRow): InitiativeSource {
  return {
    id: row.id,
    initiativeId: row.initiative_id,
    name: row.name,
    sourceType: row.source_type,
    connectionState: row.connection_state,
    lastSyncedAt: row.last_synced_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Fire-and-log audit write: never lose the user's work to a failed audit row. */
async function writeActivity(
  initiativeId: string,
  eventType: string,
  summary: string,
): Promise<void> {
  const { error } = await getClient()
    .from("activity_log")
    .insert({ initiative_id: initiativeId, event_type: eventType, summary });
  if (error) {
    console.error("Failed to write activity_log entry:", error.message);
  }
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
    await writeActivity(created.id, "INITIATIVE_CREATED", "Initiative created");
    return created;
  },

  /* ── Evidence ──────────────────────────────────────────────────────────── */

  async listEvidence(initiativeId) {
    const { data, error } = await getClient()
      .from("evidence")
      .select("*")
      .eq("initiative_id", initiativeId)
      .order("captured_at", { ascending: false });

    if (error) throw new Error(`Failed to list evidence: ${error.message}`);
    return (data as EvidenceRow[]).map(toEvidence);
  },

  async getEvidence(id) {
    const { data, error } = await getClient()
      .from("evidence")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) throw new Error(`Failed to load evidence: ${error.message}`);
    return data ? toEvidence(data as EvidenceRow) : null;
  },

  async createEvidence(input: NewEvidenceInput) {
    assertWriteAllowed();

    const { data, error } = await getClient()
      .from("evidence")
      .insert({
        initiative_id: input.initiativeId,
        title: input.title.trim(),
        source_type: input.sourceType,
        boundary: input.boundary,
        source_reference: input.sourceReference?.trim() || null,
        source_url: input.sourceUrl?.trim() || null,
        content_summary: input.contentSummary?.trim() || null,
        occurred_at: input.occurredAt || null,
        // Never verified at the moment of capture. Null is unknown, not stale.
        last_verified_at: null,
      })
      .select("*")
      .single();

    if (error) throw new Error(`Failed to create evidence: ${error.message}`);

    const created = toEvidence(data as EvidenceRow);
    await writeActivity(
      created.initiativeId,
      "EVIDENCE_ADDED",
      `${created.title} added as ${EVIDENCE_RELATION_LABEL[created.boundary]}`,
    );
    return created;
  },

  async updateEvidence(id, patch: EvidencePatch) {
    assertWriteAllowed();

    const supabase = getClient();
    const existing = await this.getEvidence(id);
    if (!existing) throw new Error(`Evidence ${id} was not found.`);

    const boundaryChanged =
      patch.boundary !== undefined && patch.boundary !== existing.boundary;

    const row: Record<string, unknown> = {};
    if (patch.title !== undefined) row.title = patch.title.trim();
    if (patch.sourceType !== undefined) row.source_type = patch.sourceType;
    if (patch.boundary !== undefined) row.boundary = patch.boundary;
    if (patch.sourceReference !== undefined)
      row.source_reference = patch.sourceReference?.trim() || null;
    if (patch.sourceUrl !== undefined)
      row.source_url = patch.sourceUrl?.trim() || null;
    if (patch.contentSummary !== undefined)
      row.content_summary = patch.contentSummary?.trim() || null;
    if (patch.occurredAt !== undefined) row.occurred_at = patch.occurredAt || null;
    if (patch.lastVerifiedAt !== undefined)
      row.last_verified_at = patch.lastVerifiedAt || null;

    const { data, error } = await supabase
      .from("evidence")
      .update(row)
      .eq("id", id)
      .select("*")
      .single();

    if (error) throw new Error(`Failed to update evidence: ${error.message}`);

    const updated = toEvidence(data as EvidenceRow);
    if (boundaryChanged) {
      await writeActivity(
        updated.initiativeId,
        "EVIDENCE_RECLASSIFIED",
        `${updated.title} moved from ${EVIDENCE_RELATION_LABEL[existing.boundary]} to ${EVIDENCE_RELATION_LABEL[updated.boundary]}`,
      );
    }
    return updated;
  },

  async listSources(initiativeId) {
    const { data, error } = await getClient()
      .from("initiative_sources")
      .select("*")
      .eq("initiative_id", initiativeId)
      .order("name", { ascending: true });

    if (error) throw new Error(`Failed to list sources: ${error.message}`);
    return (data as SourceRow[]).map(toSource);
  },
};
