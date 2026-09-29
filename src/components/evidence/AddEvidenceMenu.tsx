import { Menu, MenuLink } from "@/components/primitives/Popover";
import { InstrumentIcon } from "@/components/shell/InstrumentIcon";

/**
 * The one way to bring material into an initiative. Evidence is the saved material;
 * a source is where it came from. Used in the initiative header and on the Sources tab.
 * Open/close behaviour comes from the shared Menu primitive (outside click, Escape,
 * navigation and selection all close it; focus returns to the trigger).
 */
export function AddEvidenceMenu({ slug, connectors }: { slug: string; connectors: boolean }) {
  const base = `/initiatives/${slug}`;
  return <Menu label="Add evidence" placement="bottom-end" width={320}
    trigger={<><InstrumentIcon name="plus" />Add evidence<InstrumentIcon name="chevron-down" /></>}
    triggerClassName="pw-btn" triggerAttributes={{ "data-variant": "primary", "data-size": "md" }}>
    <MenuLink href={`${base}/evidence/new?kind=meeting`} description="Decisions, commitments, risks and questions from a meeting">Meeting notes</MenuLink>
    <MenuLink href={`${base}/evidence/new`} description="A document excerpt, email or other text, kept exactly as pasted">Paste text</MenuLink>
    {connectors && <MenuLink href={`${base}/sources/import`} description="From accounts you have connected; saved as a snapshot">Import from Jira, Gmail, Drive or Figma</MenuLink>}
    <MenuLink href={`${base}/knowledge/sources/new`} description="Record a link or ID without its content">Reference only</MenuLink>
    <MenuLink href={`${base}/evidence`} description="Resume reviewing proposals">Saved notes and pasted text</MenuLink>
  </Menu>;
}
