import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { DemoWriteLink } from "@/components/primitives/DemoWriteLink";
import { isDemoWriteEnabled, WRITE_DISABLED_MESSAGE } from "@/lib/env";
import { EmptyState, EMPTY } from "@/components/primitives/EmptyState";
import { ClaimRow } from "@/components/initiative/ClaimRow";
import { getRepository } from "@/lib/data";
import type { ClaimType, ClaimWithEvidence } from "@/lib/domain/types";
import styles from "../workspace.module.css";
import memoryStyles from "./memory.module.css";

export const metadata: Metadata = { title: "Product Memory" };
export const dynamic = "force-dynamic";

type View = "decisions" | "requirements" | "risks" | "dependencies" | "claims";

/** Section semantics are unchanged from Phase 1. ASSUMPTION lives under Claims. */
const VIEWS: { key: View; label: string; types: ClaimType[] | null }[] = [
  { key: "decisions", label: "Decisions", types: ["DECISION"] },
  {
    key: "requirements",
    label: "Requirements",
    types: ["REQUIREMENT", "BUSINESS_RULE"],
  },
  { key: "risks", label: "Risks", types: ["RISK"] },
  { key: "dependencies", label: "Dependencies", types: ["DEPENDENCY"] },
  { key: "claims", label: "Claims", types: null },
];

function select(claims: ClaimWithEvidence[], types: ClaimType[] | null) {
  if (!types) return claims;
  return claims.filter((c) => types.includes(c.type));
}

export default async function MemoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ view?: string }>;
}) {
  const { slug } = await params;
  const { view: rawView } = await searchParams;

  const view: View =
    (VIEWS.find((v) => v.key === rawView)?.key as View | undefined) ??
    "decisions";

  const repo = getRepository();
  const initiative = await repo.getInitiativeBySlug(slug);
  if (!initiative) notFound();

  const claims = await repo.listClaims(initiative.id);
  const byId = new Map(claims.map((c) => [c.id, c]));

  const active = VIEWS.find((v) => v.key === view)!;
  const visible = select(claims, active.types);

  return (
    <div className={styles.page}>
      <div className={styles.tabIntro}>
        <div className={memoryStyles.introRow}>
          <p className={styles.tabIntroText}>
            Structured product knowledge backed by initiative evidence. History
            is preserved when requirements or decisions change.
          </p>
          <DemoWriteLink href={`/initiatives/${slug}/memory/new`} variant="primary">
            Add Claim
          </DemoWriteLink>
        </div>

        <nav className={styles.filters} aria-label="Product memory sections">
          {VIEWS.map(({ key, label, types }) => (
            <Link
              key={key}
              href={`/initiatives/${slug}/memory${key === "decisions" ? "" : `?view=${key}`}`}
              className={`${styles.filter} ${view === key ? styles.filterActive : ""}`}
              aria-current={view === key ? "page" : undefined}
            >
              {label}
              <span className={styles.filterCount}>
                {select(claims, types).length}
              </span>
            </Link>
          ))}
        </nav>
      </div>

      {visible.length === 0 ? (
        <EmptyState
          message={
            claims.length === 0
              ? EMPTY.memory
              : `No ${active.label.toLowerCase()} have been recorded yet.`
          }
          hint={
            claims.length === 0
              ? (isDemoWriteEnabled ? "Add a claim to start recording what is known about this initiative." : WRITE_DISABLED_MESSAGE)
              : undefined
          }
        />
      ) : (
        <>
          {/* Keeps the heading outline unbroken: claim rows are inside details. */}
          <h2 className="visually-hidden">{active.label}</h2>
          <ul>
            {visible.map((claim) => (
              <ClaimRow
                key={claim.id}
                claim={claim}
                slug={slug}
                supersededBy={
                  claim.supersededByClaimId
                    ? byId.get(claim.supersededByClaimId)
                    : undefined
                }
                // Reverse relation, derived rather than stored twice.
                supersedes={claims.filter(
                  (c) => c.supersededByClaimId === claim.id,
                )}
              />
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
