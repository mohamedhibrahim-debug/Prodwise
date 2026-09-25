# Future Reporting contract

Status: approved visual direction and future product contract; not implemented analytics. This design milestone restyles only existing Reporting and does not declare Reporting complete.

The future scope includes **Portfolio Overview, Delivery Timeline, and Project Analysis**. Project Analysis remains required for project and executive audiences. No placeholder tabs, synthetic analytics, ingestion, schemas or metric formulas are introduced by this milestone.

## Delivery Timeline

The timeline must show portfolio-wide initiative rows, with business-line and squad grouping when supported. Show Solution/Definition, Development Start, Target Live and Actual Live distinctly. Targets and actuals are different facts. Today and the report cut-off are separate reference points; historical reports must not silently adopt today's milestone state.

Missing dates remain unknown. Early, late and overdue labels require actual date calculations and appropriate recorded dates. Rows must link to the relevant initiative. Relationships and dependencies become available only when implemented. A per-project milestone panel does not replace this portfolio timeline.

## Project Analysis

Provide a reusable framework with project-appropriate metrics. PGW and Salefny are examples, not customer-specific modules or a restriction on supported customers.

Support project, reporting period and comparison selection; target, actual and gap; trends and breakdowns; source coverage and freshness. Distinguish metric-definition approval from target approval, and unapproved or unavailable targets from missed targets. Definitions must be auditable and source ownership explicit.

Separate facts, calculations, interpretations and suggested actions. Pre-launch is distinct from unavailable data. Release timing alone cannot establish causation. Flows, rates and point-in-time balances require their appropriate period treatment; this contract intentionally defines no formulas.

Provide charts and accessible table views. Summaries, comparisons, source coverage and milestone status must use the selected period consistently, including historical report cut-offs.

## Dependencies and boundaries

Later work requires performance-data ingestion, metric definitions and approved targets, the Delivery Model, and initiative relationships where applicable. These dependencies are not authorized for implementation in the design milestone.

The approved reference is `prodwise-elevated-design.html`, SHA-256 `dfd4e32952b9dbd4402be3a80bde2552a711eddfe78c137dc2547accfce75c96`. It stays outside the public application. Its example analytics and demonstration JavaScript are not production truth. Internal/neutral report-name switches belong to reference review, not live navigation.
