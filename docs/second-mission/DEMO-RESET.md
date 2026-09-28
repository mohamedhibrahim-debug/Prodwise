# Demo reset — strategy and runbook

The Demo is **one shared, synthetic organization**. Visitors enter it through
"Explore Demo" and can make changes that other visitors will see. A reset returns
it to the canonical records. The reset is deterministic, and it never touches any
other organization.

## What visitors are told

Home and every initiative's History show this notice:

> Shared synthetic demo. Its records are dated up to the scenario date, 26 Sept 2026;
> changes made here carry today's real date and stay visible to other visitors until
> the Demo is reset (last reset …).

- **Scenario time vs real time.** Synthetic records are dated on or before the fixed
  scenario date, and "today" in the Demo is that date: overdue, due-soon and
  "what changed" are computed from it. A visitor's change is stamped with the real
  date and time, because backdating it would fabricate history.
- **Last reset** is read from the Demo's own registration: `demo_scenarios.registered_at`
  in hosted mode and `.data/demo-reset-audit.json` locally. It is never typed in by hand.

## How a reset works

A reset creates a **new Demo generation**: a new workspace holding the canonical V3
records. The previous generation is archived. Its data is kept, and no one can reach
it any more. The reset is deterministic: the same fixture version produces the same
records, and the self-test checks this. It changes nothing outside the Demo
organization.

| Mode | Command (operator only) |
|---|---|
| Local | `node --experimental-transform-types --conditions=react-server --import ./scripts/db-test/test-alias.mjs scripts/demo/provision-local.mjs --reset-demo` |
| Hosted, preview | `… scripts/demo/provision-hosted.mjs --dry-run --reset`. Prints the pinned SQL and makes no network or DB calls. |
| Hosted, apply | `… scripts/demo/provision-hosted.mjs --apply --reset` |

Hosted runs need `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `PRODWISE_DATABASE_URL`,
`PRODWISE_EXPECTED_SUPABASE_REF` and `PRODWISE_PLATFORM_ACTOR_ID` in the operator's
shell. The script refuses to run if the project ref does not match. None of these
values is ever committed or printed.

## When to reset

1. **Every production deploy.** This is part of the deploy step. The Demo then always
   matches the code that renders it.
2. **On demand**, whenever the Demo has drifted, for example before a presentation.
   Use the hosted apply command above.
3. **Scheduled (optional; not enabled).** A nightly reset would need the service-role
   key and database URL stored in a scheduler, such as a GitHub Actions secret. That is
   a new place holding production secrets, so it is the owner's decision. Until it is
   approved, resets are manual and happen on every deploy.
