import type { Actor, Domain } from "../domain/types.ts";
import type { Repository } from "../data/repository.ts";
import { decideConflict, assignConfirmer } from "./decide.ts";
import { decisionError, type DecisionFormState } from "./ui.ts";

/** Server action boundary, with injectable dependencies for mutation/guard tests. */
export async function submitDecisionForm(
  form: FormData,
  deps: { repo: Repository; actor: Actor; assertWrite: () => void; refresh: (slug: string) => void },
  kind: "decision" | "confirmer",
): Promise<DecisionFormState> {
  const text = (name: string) => String(form.get(name) ?? "").trim();
  try {
    deps.assertWrite();
    const initiative = await deps.repo.getInitiativeBySlug(text("slug"));
    if (!initiative) throw new Error("FINDING_STALE");
    const common = { initiativeId: initiative.id, fingerprint: text("fingerprint"), actor: deps.actor };
    if (kind === "confirmer") {
      await assignConfirmer(deps.repo, { ...common,
        label: text("clear") === "true" ? null : text("label") });
    } else {
      const outcome = text("choice");
      if (outcome !== "existing" && outcome !== "corrected") throw new Error("INVALID_DECISION_SHAPE");
      await decideConflict(deps.repo, { ...common, contentDigest: text("contentDigest"),
        outcome: outcome === "existing" ? "CHOSE_EXISTING" : "CORRECTED_VALUE",
        chosenClaimId: outcome === "existing" ? text("chosenClaimId") : null,
        correctedValue: outcome === "corrected" ? text("correctedValue") : null,
        decisionDomain: outcome === "corrected" ? (text("decisionDomain") || null) as Domain | null : null,
        rationale: text("rationale") });
    }
    deps.refresh(initiative.slug);
    return { error: null, saved: true };
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "WRITE_DISABLED")
      return { error: decisionError(new Error("WRITE_DISABLED")) };
    return { error: decisionError(error) };
  }
}
