import "server-only";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { cache } from "react";
import { requireWorkspaceAccess } from "@/lib/auth/access";
import { adminClient, isLocalAuth } from "@/lib/auth/service";
import { hasOrganizationAdminAuthority } from "@/lib/auth/roles";
import { readDelivery } from "@/lib/delivery/repository";
import { getRepository } from "@/lib/data";
import { readManagement } from "@/lib/data/management-read";
import { readRelationships } from "@/lib/data/relationships";
import { readCommitments } from "@/lib/data/commitments";
import { readQuestions } from "@/lib/data/questions";
import { readRisks } from "@/lib/data/risks";
import { buildPortfolioProjection } from "@/lib/workspace/portfolio";
import { connectorOverview } from "@/lib/connectors/service";
import { CONNECTOR_LABEL } from "@/lib/connectors/types";
import { deriveNotifications, type Notification } from "./model";

const FINGERPRINT = /^[0-9a-f]{32}$/;
const localPath = () => join(process.cwd(), ".data", "notification-reads.json");
type LocalReads = { reads: { organizationId: string; userId: string; fingerprint: string; readAt: string }[] };
const readLocal = (): LocalReads => existsSync(localPath()) ? JSON.parse(readFileSync(localPath(), "utf8")) as LocalReads : { reads: [] };
function writeLocal(v: LocalReads) { mkdirSync(join(process.cwd(), ".data"), { recursive: true }); const tmp = `${localPath()}.${randomUUID()}.tmp`; writeFileSync(tmp, JSON.stringify(v), { mode: 0o600 }); renameSync(tmp, localPath()); }

async function readMarks(organizationId: string, userId: string, fingerprints: string[]): Promise<Set<string>> {
  if (!fingerprints.length) return new Set();
  if (isLocalAuth()) return new Set(readLocal().reads.filter(r => r.organizationId === organizationId && r.userId === userId).map(r => r.fingerprint));
  const { data, error } = await adminClient().from("notification_reads").select("fingerprint").eq("organization_id", organizationId).eq("user_id", userId).in("fingerprint", fingerprints);
  if (error) return new Set(); // Unread is the safe default: nothing is hidden.
  return new Set((data as { fingerprint: string }[]).map(r => r.fingerprint));
}

/** Everything the current person can see in their organization, with their read marks. */
export const readNotifications = cache(async (): Promise<{ items: Notification[]; read: Set<string>; asOf: string }> => {
  const ctx = await requireWorkspaceAccess();
  const [d, management, rel, commitments, questions, risks, activity, connectors] = await Promise.all([
    readDelivery(), readManagement(), readRelationships(), readCommitments(), readQuestions(), readRisks(), getRepository().listRecentActivity(500), connectorOverview().catch(() => ({ overview: [], isDemo: true })),
  ]);
  const asOf = d.presentation.scenarioAt ?? new Date().toISOString();
  const p = buildPortfolioProjection({ source: d.source, state: d.state, workspaceId: ctx.workspaceId, asOf, activity, management, relationships: rel.relationships });
  const items = deriveNotifications({ asOf, me: { userId: ctx.actor.id, memberId: ctx.memberId ?? null, canFinalizeReviews: hasOrganizationAdminAuthority(ctx) || ctx.isProductLead },
    rows: p.rows, commitments: commitments.actions, questions: questions.questions, riskEvents: risks.events, activity, deliveryEvents: d.state.events.filter(e => e.workspaceId === ctx.workspaceId), reviews: d.state.reviews.filter(r => r.workspaceId === ctx.workspaceId),
    connectors: connectors.overview.map(o => ({ label: CONNECTOR_LABEL[o.connector], status: o.status })) });
  return { items, read: await readMarks(ctx.organizationId, ctx.actor.id, items.map(n => n.fingerprint)), asOf };
});

/** Marks are only ever added for fingerprints the person can currently see. */
export async function markRead(fingerprints: string[]): Promise<number> {
  const ctx = await requireWorkspaceAccess();
  const { items } = await readNotifications();
  const visible = new Set(items.map(n => n.fingerprint));
  const marks = [...new Set(fingerprints)].filter(f => FINGERPRINT.test(f) && visible.has(f));
  if (!marks.length) return 0;
  if (isLocalAuth()) {
    const all = readLocal(), have = new Set(all.reads.filter(r => r.organizationId === ctx.organizationId && r.userId === ctx.actor.id).map(r => r.fingerprint)), at = new Date().toISOString();
    all.reads.push(...marks.filter(f => !have.has(f)).map(fingerprint => ({ organizationId: ctx.organizationId, userId: ctx.actor.id, fingerprint, readAt: at })));
    writeLocal(all); return marks.length;
  }
  const { error } = await adminClient().from("notification_reads").upsert(marks.map(fingerprint => ({ organization_id: ctx.organizationId, user_id: ctx.actor.id, fingerprint })), { onConflict: "organization_id,user_id,fingerprint", ignoreDuplicates: true });
  if (error) throw new Error("Read marks could not be saved. Try again.");
  return marks.length;
}
