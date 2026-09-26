# Real Claude Weekly Review gate — PASS

On 26 September 2026 the integration server was restarted from its own root using the user's new workspace-scoped key. The key/model fields are present with lengths 108 and 15. The actual signed-in W39 Weekly Review called `claude-sonnet-5` and persisted an accepted **CLAUDE** draft: HTTP **200**, provider model `claude-sonnet-5`, `end_turn`, 8,514 ms, six grounded original statements, prompt `WEEKLY_EXTRACTIVE_V2`. The previous workspace-header blocker is resolved by the user's replacement key.

`.env.local` is ignored by `.gitignore:27` and has no tracked Git entry. The localhost development server was restarted with that file. No key was printed, committed, embedded in a screenshot, or sent to another tool. No production operation was performed.

Eight checks passed using the existing fictional local portfolio and the actual signed-in Weekly Review action:

- W39 uses the existing W38 Final as its previous-final baseline.
- Drafting preserves frozen input, confirmed delivery facts, revision events and the complete immutable W38 Final. W39 remains a draft requiring human review.
- All six persisted Claude statements match permitted same-initiative source statements exactly; generation metadata and original wording are retained.
- The target comparison is 2026-10-01 → 2026-10-08: seven days later; current Target revision remains 2.
- Seven unknown Target/Actual fields remain unknown/not recorded. The known milestone has no invented date.
- The UI labels this accepted result as Claude; generated sections require human review.
- Controlled missing-configuration, HTTP 503, transport-failure and invented-statement injection into the provider adapter all produce supported template wording. These injected failures are not live Anthropic failures.
- The actual Claude wording explicitly includes the supported seven-day Target Live movement and remains within the requested section limit.

[Structured results](results.json) · [Actual accepted Claude screenshot](claude-weekly-1440.png) · [Earlier actual fallback screenshot](template-weekly-1440.png)

The first response with the new key was HTTP 200 but contained 20 fully grounded lines in one section. The existing validator correctly rejected it because its maximum is 12; the prompt had not communicated that bound. Prompt V2 now asks for at most eight prioritized statements per initiative, with Target changes first. The existing validator, exact-text/same-initiative rules and human finalization requirements remain unchanged. A regression test retains refusal of oversized provider sections even when every statement is grounded. **23 relevant AI/domain tests**, typecheck and targeted lint passed after the fix. The actual oversized-response fallback and controlled fault injection are separately identified.

**No blocker remains for this local Claude gate.** This proves one successful configured provider execution against the existing fictional portfolio, not unattended operation or production acceptance. Earlier empty-file and workspace-header diagnoses are historical and resolved by the user's saved key changes. No credential values are included in these reports or screenshots.

The acceptance test intentionally adds one drafting result to the existing W39 draft. It never finalizes, changes confirmed delivery truth, or rewrites the prior Final.
