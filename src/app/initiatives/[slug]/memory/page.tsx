import Link from "next/link";
import type { Metadata } from "next";

import { EmptyState, EMPTY } from "@/components/primitives/EmptyState";
import { ClaimRow } from "@/components/initiative/ClaimRow";
import { getIntelligence } from "@/lib/data/fixtures";
import type { ClaimType, MemoryClaim } from "@/lib/domain/types";
import styles from "../workspace.module.css";

export const metadata: Metadata = { title: "Product Memory" };

type View = "decisions" | "requirements" | "risks" | "dependencies" | "claims";

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

function select(claims: MemoryClaim[], types: ClaimType[] | null) {
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

  const claims = getIntelligence(slug)?.claims ?? [];
  const active = VIEWS.find((v) => v.key === view)!;
  const visible = select(claims, active.types);

  return (
    <div className={styles.page}>
      <div className={styles.tabIntro}>
        <p className={styles.tabIntroText}>
          Structured knowledge extracted from evidence. Nothing here is deleted
          when it changes — a requirement that has been replaced is marked
          superseded and stays available as history.
        </p>

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
          message={claims.length === 0 ? EMPTY.memory : `No ${active.label.toLowerCase()} have been extracted yet.`}
          hint={
            claims.length === 0
              ? "No related evidence has been confirmed yet."
              : undefined
          }
        />
      ) : (
        <>
          {/* Keeps the heading outline unbroken: claim rows are h3. */}
          <h2 className="visually-hidden">{active.label}</h2>
          <ul>
            {visible.map((claim) => (
              <ClaimRow key={claim.id} claim={claim} />
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
