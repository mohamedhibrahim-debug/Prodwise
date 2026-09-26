# Local Claude Weekly Review acceptance — 26 September 2026

**Current real Claude result: FAIL — provider workspace selection required.** The saved file now loads `ANTHROPIC_API_KEY` (present, length 108) and `ANTHROPIC_MODEL` (present, length 15). The localhost server was restarted from the integration root, and the actual signed-in Weekly Review sent a real Messages API request using `claude-sonnet-5`. Anthropic returned HTTP 400 `invalid_request_error`: the key is not scoped to a workspace and requires an `anthropic-workspace-id` header. No workspace ID is configured. Read-only workspace discovery returned HTTP 403 `permission_error`, so the ID could not be resolved automatically. The key was not changed or requested again.

`.env.local` is ignored by `.gitignore:27` and has no tracked Git entry. The localhost development server was restarted with that file. No key was printed, committed, embedded in a screenshot, or sent to another tool. No production operation was performed.

Seven checks passed using the existing fictional local portfolio and the actual signed-in Weekly Review action:

- W39 uses the existing W38 Final as its previous-final baseline.
- Drafting preserves frozen input, confirmed delivery facts, revision events and the complete immutable W38 Final. W39 remains a draft requiring human review.
- All eight persisted template lines match permitted same-initiative source statements exactly.
- The target comparison is 2026-10-01 → 2026-10-08: seven days later; current Target revision remains 2.
- Seven unknown Target/Actual fields remain unknown/not recorded. The known milestone has no invented date.
- The UI truthfully labels this result a factual template, not AI generation.
- Controlled missing-configuration, HTTP 503, transport-failure and invented-statement injection into the provider adapter all produce supported template wording. These injected failures are not live Anthropic failures.

[Structured results](results.json) · [Actual template screenshot](template-weekly-1440.png)

The real provider refusal exercised the actual UI fallback. No AI wording was generated, so grounding of a successful Claude output and compatibility of the attempted model remain unverified. A workspace ID authorized for this key must be selected and supplied in the request header before rerunning acceptance. The current adapter does not send that optional header. This requires workspace configuration and adapter support, not re-entry or replacement of the key. [Anthropic authentication documentation](https://platform.claude.com/docs/en/manage-claude/authentication) describes this requirement.

The earlier empty-file diagnosis in `ENV-DIAGNOSIS.md` is historical; the current saved file has non-empty values. No credential values are included in these reports or screenshots.

The acceptance test intentionally adds one drafting result to the existing W39 draft. It never finalizes, changes confirmed delivery truth, or rewrites the prior Final.
