import "server-only";

import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";

import type {
  ActivityEntry,
  ClaimTrust,
  ClaimRecord,
  EvidenceRecord,
  FindingState,
  Initiative,
  InitiativeSource,
} from "@/lib/domain/types";
import { SEED_ACTIVITY, SEED_INITIATIVES } from "./fixtures/initiatives";
import { SEED_EVIDENCE, SEED_SOURCES } from "./fixtures/evidence";
import { SEED_CLAIMS, SEED_CLAIM_EVIDENCE } from "./fixtures/claims";
import { upgradeStoreShape } from "./store-upgrade";
import { repositoryContext } from "../auth/repository-context";
import {commitLocalCommand,recoverLocalCommand} from './local-command-journal';
import {readinessTransition} from '../workspace/readiness-history';
import {LocalAuthStore} from '../auth/core';
import {localDeliveryPath} from '../delivery/local-path';
import type {DeliveryState} from '../delivery/types';
import type {InitiativeContext} from '../workspace/readiness';
import type {SourceContainer,SourceItem,SourceMapping} from '../workspace/source-mapping';

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
  locator: string | null;
  excerpt: string | null;
}

export type StoredClaim = ClaimRecord & ClaimTrust;

export interface StoreShape {
  findingDispositions?: import('../review/dispositions').FindingDisposition[];
  evidenceSubmissions?: import('../evidence/types').Submission[];
  evidenceAttempts?: import('../evidence/types').ReadingAttempt[];
  evidenceAnchors?: import('../evidence/types').Anchor[];
  evidenceProposals?: import('../evidence/types').Proposal[];
  evidenceConfirmations?: import('../evidence/types').Confirmation[];
  meetingNotes?: import('../evidence/types').MeetingNote[];
  riskTracking?: import('../workspace/risks').RiskTracking[];
  riskEvents?: import('../workspace/risks').RiskEvent[];
  relationships?: import('../workspace/relationships').InitiativeRelationship[];
  relationshipEvents?: import('../workspace/relationships').RelationshipEvent[];
  openQuestions?: import('../workspace/questions').OpenQuestion[];
  questionEvents?: import('../workspace/questions').QuestionEvent[];
  commitments?: import('../workspace/commitments').Commitment[];
  commitmentEvents?: import('../workspace/commitments').CommitmentEvent[];
  creationCommands?: {workspaceId:string;requestId:string;initiativeId:string;actorId:string;inputDigest:string}[];
  contexts?: InitiativeContext[];
  sourceContainers?: SourceContainer[];
  sourceItems?: SourceItem[];
  sourceMappings?: SourceMapping[];
  sourceItemSyncs?: import('../connectors/types').SourceItemSync[];
  initiatives: Initiative[];
  activity: ActivityEntry[];
  evidence: EvidenceRecord[];
  sources: InitiativeSource[];
  claims: StoredClaim[];
  claimEvidence: ClaimEvidenceLink[];
  /** Human decisions about derived findings. The findings are not stored. */
  findingStates: FindingState[];
}

const DATA_FILE = join(process.cwd(), ".data", "prodwise.json");

function seed(): StoreShape {
  return {
    initiatives: SEED_INITIATIVES.map((i) => ({ ...i })),
    activity: SEED_ACTIVITY.map((a) => ({
      ...a,
      entityType: null,
      entityId: null,
      payload: null,
      actorLabel: null,
    })),
    evidence: SEED_EVIDENCE.map((e) => ({ ...e })),
    sources: SEED_SOURCES.map((s) => ({ ...s })),
    claims: SEED_CLAIMS.map((c) => ({
      ...c,
      origin: "LEGACY" as const,
      verifiedAt: null,
      verifiedActorId: null,
      verifiedActorLabel: null,
      verificationBasis: null,
      verificationNote: null,
    })),
    claimEvidence: SEED_CLAIM_EVIDENCE.map((l) => ({
      ...l,
      createdAt: "2026-09-06T00:00:00.000Z",
      locator: null,
      excerpt: null,
    })),
    // Deliberately empty. The seeded conflict must appear because the engine
    // ran over the seeded claims, not because a finding was inserted.
    findingStates: [],
  };
}

let cache: StoreShape | null = null;
function scopeRows(store: StoreShape, workspaceId = process.env.PRODWISE_WORKSPACE_ID ?? "unconfigured-local-test"): StoreShape {
  for (const collection of Object.values(store)) for (const row of collection) {
    if (!("workspaceId" in row)) Object.assign(row, { workspaceId });
  }
  return store;
}

function load(): StoreShape {
  recoverLocalCommand(dirname(DATA_FILE));
  // Server actions and rendered pages can load this module in distinct bundles.
  // Reread the small local fixture file so a successful action is visible to the
  // next render; an indefinitely cached module copy can show stale Decisions.
  if (existsSync(DATA_FILE)) {
    try {
      const parsed = JSON.parse(readFileSync(DATA_FILE, "utf8")) as Partial<StoreShape>;
      // Tolerate a file written by an older shape rather than crashing the app:
      // any missing collection falls back to its seed.
      const base = seed();
      cache = scopeRows(upgradeStoreShape({
        initiatives: parsed.initiatives ?? base.initiatives,
        activity: parsed.activity ?? base.activity,
        evidence: parsed.evidence ?? base.evidence,
        sources: parsed.sources ?? base.sources,
        claims: parsed.claims ?? base.claims,
        claimEvidence: parsed.claimEvidence ?? base.claimEvidence,
        findingStates: parsed.findingStates ?? base.findingStates,
        findingDispositions: parsed.findingDispositions ?? [],
        evidenceSubmissions: parsed.evidenceSubmissions??[],
        evidenceAttempts: parsed.evidenceAttempts??[],
        evidenceAnchors: parsed.evidenceAnchors??[],
        evidenceProposals: parsed.evidenceProposals??[],
        evidenceConfirmations: parsed.evidenceConfirmations??[],
        contexts: parsed.contexts ?? [],
        meetingNotes: parsed.meetingNotes ?? [],
        riskTracking: parsed.riskTracking ?? [],
        riskEvents: parsed.riskEvents ?? [],
        relationships: parsed.relationships ?? [],
        relationshipEvents: parsed.relationshipEvents ?? [],
        openQuestions: parsed.openQuestions ?? [],
        questionEvents: parsed.questionEvents ?? [],
        commitments: parsed.commitments ?? [],
        commitmentEvents: parsed.commitmentEvents ?? [],
        creationCommands: parsed.creationCommands ?? [],
        sourceContainers: parsed.sourceContainers ?? [],
        sourceItems: parsed.sourceItems ?? [],
        sourceMappings: parsed.sourceMappings ?? [],
        sourceItemSyncs: parsed.sourceItemSyncs ?? [],
      }));
      return cache;
    } catch {
      // A corrupt demo store should not take the application down. Fall back to
      // the seed and let the next write replace the bad file.
      console.warn(`[prodwise] could not read ${DATA_FILE}; using seed data`);
    }
  }

  cache = scopeRows(seed());
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
  const state = load();
  const ctx = repositoryContext();
  if (!ctx) return state; // Internal fixture test harness only; production uses guardedRepository.
  return Object.fromEntries(Object.entries(state).map(([key, rows]) => [key,
    rows.filter((row: object) => "workspaceId" in row && row.workspaceId === ctx.workspaceId)])) as unknown as StoreShape;
}

/** Apply a mutation and flush it to disk. */
export function writeStore(mutate: (store: StoreShape) => void): void {
  // A mutation may perform a nested read (for example projecting verified
  // evidence). That read reloads the module cache, so persist the explicit
  // transaction value, never whichever object a nested read left in cache.
  writeStoreAtomic(mutate);
}

/** Commit all decision effects as one local-store replacement. */
export function writeStoreAtomic<T>(mutate: (store: StoreShape) => T): T {
  const previous=load();const next = structuredClone(previous);
  const result = mutate(next);
  assertArchivedRecordsUnchanged(previous,next);assertDispositionHistoryUnchanged(previous,next);
  scopeRows(next, repositoryContext()?.workspaceId);
  appendReadinessHistory(next);
  const temporary = `${DATA_FILE}.${crypto.randomUUID()}.tmp`;
  mkdirSync(dirname(DATA_FILE), { recursive: true });
  try {
    writeFileSync(temporary, JSON.stringify(next, null, 2), "utf8");
    renameSync(temporary, DATA_FILE);
    cache = next;
    return result;
  } catch (error) {
    rmSync(temporary, { force: true });
    throw error;
  }
}

function assertDispositionHistoryUnchanged(before:StoreShape,after:StoreShape):void{
 const prior=before.findingDispositions??[],next=after.findingDispositions??[];if(next.length<prior.length||JSON.stringify(next.slice(0,prior.length))!==JSON.stringify(prior))throw new Error('Queue dispositions are append-only.');
 const requests=new Set<string>();for(const row of next){const key=`${row.organizationId}:${row.clientRequestId}`;if(requests.has(key))throw new Error('Duplicate queue request.');requests.add(key);}
}

function assertArchivedRecordsUnchanged(before:StoreShape,after:StoreShape):void{
 const archived=new Set(before.initiatives.filter(i=>i.archivedAt).map(i=>i.id));if(!archived.size)return;
 for(const i of before.initiatives.filter(i=>archived.has(i.id))){const next=after.initiatives.find(n=>n.id===i.id);if(!next||['name','businessLine','stage','description','currentContextId','knownReferences'].some(key=>JSON.stringify(i[key as keyof Initiative])!==JSON.stringify(next[key as keyof Initiative])))throw new Error('Archived — restore to edit. Nothing was changed.');}
 const claimScope=new Map(before.claims.map(c=>[c.id,c.initiativeId]));
 for(const key of ['evidence','claims','claimEvidence','findingStates','findingDispositions','sources','contexts','sourceMappings','commitments','commitmentEvents','evidenceSubmissions','evidenceAttempts','evidenceAnchors','evidenceProposals','evidenceConfirmations','meetingNotes','openQuestions','questionEvents','riskTracking','riskEvents'] as const){
  const scoped=(rows:unknown[])=>rows.filter(value=>{const row=value as {initiativeId?:string;claimId?:string};return archived.has(row.initiativeId??claimScope.get(row.claimId??'')??'');});
  if(JSON.stringify(scoped(before[key]??[]))!==JSON.stringify(scoped(after[key]??[])))throw new Error('Archived — restore to edit. Nothing was changed.');
 }
}

/** Used only while holding the delivery file lock. The journal makes a new
 * initiative and its initial OWNER fact visible together after crash recovery. */
export function writeStoreWithDelivery<T>(deliveryPath:string,deliveryState:unknown,mutate:(store:StoreShape)=>T):T{
 const previous=load(),next=structuredClone(previous);const result=mutate(next);assertArchivedRecordsUnchanged(previous,next);assertDispositionHistoryUnchanged(previous,next);scopeRows(next,repositoryContext()?.workspaceId);appendReadinessHistory(next,deliveryState as DeliveryState);
 commitLocalCommand(dirname(DATA_FILE),[{path:deliveryPath,content:JSON.stringify(deliveryState)},{path:DATA_FILE,content:JSON.stringify(next)}]);cache=next;return result;
}

function appendReadinessHistory(store:StoreShape,delivery?:DeliveryState):void{
 const ctx=repositoryContext();if(!ctx||!existsSync(join(process.cwd(),'.data','auth.json')))return;
 const members=new LocalAuthStore(join(process.cwd(),'.data','auth.json'),ctx.workspaceId).read(true).members;
 const file=localDeliveryPath(process.cwd(),ctx.workspaceId,process.env.PRODWISE_WORKSPACE_ID??'');
 const facts=delivery?.facts??(existsSync(file)?(JSON.parse(readFileSync(file,'utf8')) as DeliveryState).facts:[]);
 for(const i of store.initiatives.filter(x=>x.workspaceId===ctx.workspaceId)){
  const event=readinessTransition({initiative:i,facts,members,claims:store.claims.filter(c=>c.initiativeId===i.id),contexts:store.contexts??[],activeSourceLinks:(store.sourceMappings??[]).filter(m=>m.initiativeId===i.id&&!m.unlinkedAt).length,activity:store.activity,at:new Date().toISOString(),actor:ctx.actor});
  if(event)store.activity.push(event);
 }
}
