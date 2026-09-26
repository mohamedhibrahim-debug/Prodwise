# Core UX candidate — final MVP

Scope: presentation changes on `prodwise/final-mvp`, built on the tested owner-authority candidate. Auth, authorization, migrations, repository behavior and deterministic decision rules remain owned by their existing implementation.

## Composition decisions

- The navy product rail has exactly four destinations: Home, Initiatives, Roadmap and Analysis. Weekly Review opens from Home and contextual links. Delivery opens from the initiative Brief. Brief, Decisions and Knowledge remain the three initiative tabs; Record and Sources are the two Knowledge views.
- A neutral blue-grey canvas replaces broad white backgrounds. White is reserved for the comparison or record being worked on; secondary information sits in grey-blue rails. Cyan identifies links and the active surface. Orange marks an actual attention request, with text describing its meaning.
- Home is an asymmetric attention cockpit: open decisions and recorded changes on the left, upcoming recorded dates and shared review access on the right. The portfolio pulse counts records rather than inventing health. Setup mechanics no longer lead Home.
- Initiatives is a real six-column register with search, business-line/stage/attention filters and name/date/latest-change sorting. Mobile keeps labeled rows rather than converting the portfolio into decorative cards.
- Brief is a dossier: current recorded scope and next step, open decisions, recorded changes, risks/dependencies; delivery and provenance sit in a secondary rail. Actual facts are visible without opening a separate page.
- Decisions keeps a queue, selected comparison and decision action pane on desktop. On mobile both compared values stay together before any long source inspector. Source details are subordinate to the comparison, and the decision form remains the existing guarded form.
- Knowledge is a compact ledger grouped by subject, with attribute/context, value, confirmation and provenance visible together. Details retain verification history and replacement lineage. Sources is a metadata register with reference, type, date and true linked-entry counts.
- The old Demo scenario trigger is replaced by one contextual, dismissible Guide surface. The signed-in actor remains supplied by Auth; the rail contains only a small environment label.

## Truth constraints retained

No inferred readiness, severity or ranking was added. A past Target Live with no recorded Actual Live asks for confirmation; it never proves that launch failed. Unknown dates remain unknown. Confirmed Knowledge can still contain differing values; the ledger links those comparisons to Decisions. Historical and excluded sources remain inspectable. UI reads the existing organization-scoped repository and Delivery interface.

## Validation in this stream

- TypeScript: passed after the main implementation pass.
- Targeted ESLint across all changed TSX routes and shell components: passed.
- Local browser: 24 rendered route/viewport checks passed (Home, Initiatives, Brief, Decisions, Knowledge and Sources at 390, 768, 1024 and 1440 pixels); zero document overflow and zero JavaScript page errors. Desktop and mobile screenshots were inspected. A global mobile anchor rule that overrode row/grid layouts was found visually and removed, then all 24 checks passed again.
- These presentation checks do not substitute for the final Demo organization isolation, write-flow, AI and production gates owned by the integrated mission. Diagnostic screenshots/results are private under `.data/coreux-visual/`; final reviewer screenshots should be regenerated from the isolated Demo organization.

No new dependencies were introduced. No production action was performed by this stream.
