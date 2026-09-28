import Link from "next/link";
import styles from "@/components/shell/WorkspaceHeader.module.css";

/**
 * The one way to bring material into an initiative. Evidence is the saved material;
 * a source is where it came from. Used in the initiative header and on the Sources tab.
 */
export function AddEvidenceMenu({ slug, connectors }: { slug: string; connectors: boolean }) {
  const base = `/initiatives/${slug}`;
  return <details className={styles.addMenu}><summary>Add evidence</summary><div role="group" aria-label="Add evidence">
    <Link prefetch={false} href={`${base}/evidence/new?kind=meeting`}>Meeting notes<small>Decisions, commitments, risks and questions from a meeting</small></Link>
    <Link prefetch={false} href={`${base}/evidence/new`}>Paste text<small>A document excerpt, email or other text, kept exactly as pasted</small></Link>
    {connectors && <Link prefetch={false} href={`${base}/sources/import`}>Import from Jira, Gmail, Drive or Figma<small>From accounts you have connected; saved as a snapshot</small></Link>}
    <Link prefetch={false} href={`${base}/knowledge/sources/new`}>Reference only<small>Record a link or ID without its content</small></Link>
    <Link prefetch={false} href={`${base}/evidence`}>Saved notes and pasted text<small>Resume reviewing proposals</small></Link>
  </div></details>;
}
