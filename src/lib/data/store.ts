import "server-only";

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import type {
  ActivityEntry,
  ClaimRecord,
  EvidenceRecord,
  Initiative,
  InitiativeSource,
} from "@/lib/domain/types";
import { SEED_ACTIVITY, SEED_INITIATIVES } from "./fixtures/initiatives";
import { SEED_EVIDENCE, SEED_SOURCES } from "./fixtures/evidence";
import { SEED_CLAIMS, SEED_CLAIM_EVIDENCE } from "./fixtures/claims";

/**
 * LOCAL DEMO PERSISTENCE ONLY.
 *
 * A JSON file under `.data/`, used when no Supabase project is configured. It
 * exists so Phase 2's core promise — that a boundary classification you set
 * stays set — is genuinely demonstrable rather than simulated.
 *
 * It is NOT production persistence. Specifically it is not distributed, not
 * serverless-safe, not multi-instance safe and not concurrent-write safe: it
 * assumes a single Node process, and last write wins. It survives a local
 * server restart and nothing more.
 *
 * NOTHING OUTSIDE THE REPOSITORY LAYER MAY IMPORT THIS MODULE. UI code, server
 * actions and pages reach persistence only through the Repository interface, so
 * that swapping in Supabase changes nothing above the data layer.
 */

/** One link between a claim and a supporting evidence record. */
export interface ClaimEvidenceLink {
  claimId: string;
  evidenceId: string;
  createdAt: string;
}

export interface StoreShape {
  initiatives: Initiative[];
  activity: ActivityEntry[];
  evidence: EvidenceRecord[];
  sources: InitiativeSource[];
  claims: ClaimRecord[];
  claimEvidence: ClaimEvidenceLink[];
}

const DATA_FILE = join(process.cwd(), ".data", "prodwise.json");

function seed(): StoreShape {
  return {
    initiatives: SEED_INITIATIVES.map((i) => ({ ...i })),
    activity: SEED_ACTIVITY.map((a) => ({ ...a })),
    evidence: SEED_EVIDENCE.map((e) => ({ ...e })),
    sources: SEED_SOURCES.map((s) => ({ ...s })),
    claims: SEED_CLAIMS.map((c) => ({ ...c })),
    claimEvidence: SEED_CLAIM_EVIDENCE.map((l) => ({
      ...l,
      createdAt: "2026-09-06T00:00:00.000Z",
    })),
  };
}

let cache: StoreShape | null = null;

function load(): StoreShape {
  if (cache) return cache;

  if (existsSync(DATA_FILE)) {
    try {
      const parsed = JSON.parse(readFileSync(DATA_FILE, "utf8")) as Partial<StoreShape>;
      // Tolerate a file written by an older shape rather than crashing the app:
      // any missing collection falls back to its seed.
      const base = seed();
      cache = {
        initiatives: parsed.initiatives ?? base.initiatives,
        activity: parsed.activity ?? base.activity,
        evidence: parsed.evidence ?? base.evidence,
        sources: parsed.sources ?? base.sources,
        claims: parsed.claims ?? base.claims,
        claimEvidence: parsed.claimEvidence ?? base.claimEvidence,
      };
      return cache;
    } catch {
      // A corrupt demo store should not take the application down. Fall back to
      // the seed and let the next write replace the bad file.
      console.warn(`[prodwise] could not read ${DATA_FILE}; using seed data`);
    }
  }

  cache = seed();
  persist();
  return cache;
}

function persist(): void {
  if (!cache) return;
  try {
    mkdirSync(dirname(DATA_FILE), { recursive: true });
    writeFileSync(DATA_FILE, JSON.stringify(cache, null, 2), "utf8");
  } catch (error) {
    // Read-only filesystem, for example. The in-memory copy stays authoritative
    // for this process, so the app keeps working; durability is what is lost.
    console.warn(
      `[prodwise] could not write ${DATA_FILE}:`,
      error instanceof Error ? error.message : error,
    );
  }
}

/** Read the current state. Callers must not mutate the returned object. */
export function readStore(): StoreShape {
  return load();
}

/** Apply a mutation and flush it to disk. */
export function writeStore(mutate: (store: StoreShape) => void): void {
  const store = load();
  mutate(store);
  persist();
}
