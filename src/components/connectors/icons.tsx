import type { ReactNode } from "react";
import type { Connector } from "@/lib/connectors/types";
import type { TypeTone } from "@/lib/connectors/import-view";

/**
 * Generic, monochrome glyphs (currentColor). They identify a kind of source; they are
 * deliberately not the providers' trademarked logos.
 */
const svg = (size: number, children: ReactNode, label?: string) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden={label ? undefined : true} role={label ? "img" : undefined} aria-label={label} focusable="false">{children}</svg>
);

export function ProviderIcon({ connector, size = 18 }: { connector: Connector | "MANUAL" | "PASTE" | "MEETING"; size?: number }) {
  switch (connector) {
    // Work-tracking: stacked tickets.
    case "JIRA": return svg(size, <><rect x="2.5" y="4.5" width="9" height="9" rx="1.5" /><path d="M5 2.5h7a1.5 1.5 0 0 1 1.5 1.5v7" /><path d="M5 9l1.6 1.6L9.5 7.5" /></>);
    // Mail: envelope.
    case "GMAIL": return svg(size, <><rect x="1.75" y="3.25" width="12.5" height="9.5" rx="1.5" /><path d="M2.25 4l5.75 4.5L13.75 4" /></>);
    // Documents: page with folded corner.
    case "GOOGLE_DRIVE": return svg(size, <><path d="M4 1.75h5.5L12.5 4.75V14.25H4z" /><path d="M9.5 1.75v3h3" /><path d="M6 8.5h4.5M6 11h4.5" /></>);
    // Design: frame with corner marks.
    case "FIGMA": return svg(size, <><path d="M4.5 1.5v13M11.5 1.5v13M1.5 4.5h13M1.5 11.5h13" /></>);
    case "PASTE": return svg(size, <><rect x="3.5" y="2.75" width="9" height="11.5" rx="1.5" /><path d="M6 2.75V2a.75.75 0 0 1 .75-.75h2.5A.75.75 0 0 1 10 2v.75" /><path d="M6 7h4M6 9.5h4M6 12h2.5" /></>);
    case "MEETING": return svg(size, <><circle cx="5.5" cy="5.5" r="2" /><circle cx="11" cy="6" r="1.6" /><path d="M1.75 13c.4-2.2 1.9-3.5 3.75-3.5S8.85 10.8 9.25 13M9.5 10.2c.4-.4 1-.7 1.5-.7 1.5 0 2.7 1.1 3 3" /></>);
    default: return svg(size, <><path d="M6.5 9.5l3-3" /><path d="M7.5 4.5l1.3-1.3a2.5 2.5 0 0 1 3.5 3.5L11 8" /><path d="M8.5 11.5l-1.3 1.3a2.5 2.5 0 0 1-3.5-3.5L5 8" /></>);
  }
}

export function TypeGlyph({ tone, size = 12 }: { tone: TypeTone; size?: number }) {
  switch (tone) {
    case "epic": return svg(size, <path d="M9 1.5L3.5 9h4l-1 5.5L12.5 7h-4z" fill="currentColor" stroke="none" />);
    case "story": return svg(size, <path d="M4 1.75h8v12.5l-4-3-4 3z" fill="currentColor" stroke="none" />);
    case "task": return svg(size, <><rect x="2" y="2" width="12" height="12" rx="2.5" fill="currentColor" stroke="none" /><path d="M5 8.2l2 2L11 6" stroke="var(--panel)" strokeWidth="1.8" /></>);
    case "bug": return svg(size, <><circle cx="8" cy="8" r="6" fill="currentColor" stroke="none" /><circle cx="8" cy="8" r="2" fill="var(--panel)" stroke="none" /></>);
    case "subtask": return svg(size, <><rect x="1.75" y="1.75" width="7" height="7" rx="1.5" /><rect x="7.25" y="7.25" width="7" height="7" rx="1.5" fill="currentColor" stroke="none" /></>);
    case "initiative": return svg(size, <path d="M3 14.5V2M3 2.5h8.5l-2 3 2 3H3" fill="currentColor" strokeWidth="1.5" />);
    default: return svg(size, <circle cx="8" cy="8" r="4.5" />);
  }
}

export function Glyph({ name, size = 14 }: { name: "check" | "cross" | "clock" | "dot" | "warning" | "external" | "refresh" | "search" | "spinner" | "minus"; size?: number }) {
  switch (name) {
    case "check": return svg(size, <path d="M3 8.5l3 3 7-7" strokeWidth="2" />);
    case "cross": return svg(size, <path d="M4 4l8 8M12 4l-8 8" strokeWidth="2" />);
    case "clock": return svg(size, <><circle cx="8" cy="8" r="6" /><path d="M8 4.5V8l2.5 1.5" /></>);
    case "dot": return svg(size, <circle cx="8" cy="8" r="3" fill="currentColor" stroke="none" />);
    case "warning": return svg(size, <><path d="M8 1.75l6.5 12H1.5z" /><path d="M8 6.5v3.25M8 11.75v.01" strokeWidth="1.8" /></>);
    case "external": return svg(size, <><path d="M9 2.5h4.5V7M13.5 2.5L7.5 8.5" /><path d="M11.5 9.5v3a1 1 0 0 1-1 1h-7a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1h3" /></>);
    case "refresh": return svg(size, <><path d="M13.5 5.5A5.75 5.75 0 0 0 3 5M2.5 10.5A5.75 5.75 0 0 0 13 11" /><path d="M13.5 2v3.5H10M2.5 14v-3.5H6" /></>);
    case "search": return svg(size, <><circle cx="7" cy="7" r="4.75" /><path d="M10.5 10.5L14 14" /></>);
    case "spinner": return svg(size, <path d="M8 1.75A6.25 6.25 0 1 1 1.75 8" strokeWidth="2" />);
    case "minus": return svg(size, <path d="M4 8h8" strokeWidth="2" />);
  }
}
