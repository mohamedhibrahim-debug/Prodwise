import type { WorkspacePresentation } from "@/lib/workspace/context";
import { formatDate } from "@/lib/domain/labels";
import styles from "./SharedDemoNotice.module.css";

/**
 * The Demo is one shared, synthetic organization. Its records are dated up to a
 * fixed scenario date; anything a visitor changes carries the real date and is
 * seen by other visitors until the next reset. Say so rather than blur the two.
 */
export function SharedDemoNotice({ presentation }: { presentation: WorkspacePresentation }) {
  if (!presentation.isDemo || !presentation.scenarioAt) return null;
  return <p className={styles.notice}>
    Shared synthetic demo. Its records are dated up to the scenario date, {formatDate(presentation.scenarioAt)}; changes made here carry today’s real date and stay visible to other visitors until the Demo is reset{presentation.resetAt ? ` (last reset ${formatDate(presentation.resetAt)})` : ""}.
  </p>;
}
