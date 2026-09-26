# Local owner login regression

Tested 2026-09-26T17:08:28.339Z against http://127.0.0.1:3200. Checkout HEAD: `6f10787117d4ef2f66f66e9b3377bb6b01a5f821`; includes uncommitted final MVP integration changes.

**Result: PASS — 10/10 checks passed, 0 failed phases.**

| Account | Checks passed | Result |
| --- | --- | --- |
| mohamed.hibrahim@aman.eg | 5/5 | PASS |
| mohamedhassanpe@outlook.com | 5/5 | PASS |

Each account used a separate, fresh browser context with existing private credentials. The credential file was verified ignored and untracked; no credential values were printed.

The five checks per account were:

1. Successful sign-in and visible AMAN organization context.
2. Account menu displays organization role ORG_OWNER and independent platform role PLATFORM_OWNER, with Users and Platform links.
3. Users page is accessible, the account has active ORG_OWNER membership, and normal role selectors do not offer ORG_OWNER or PLATFORM_OWNER.
4. Platform administration loads with Create organization, AMAN access policy, and AMAN access granting controls. These forms were not submitted.
5. Sign-out returns to login and a subsequent Users visit remains denied. A request guard blocks business or administration mutations during inspection.

No screenshots, traces, page-body dumps, business edits, resets, production requests, or user-browser interactions were performed. Only normal local sign-in/sign-out session writes occurred. These checks establish current UI access and authentication; they do not claim fresh mutation-path authorization coverage.

Blockers: none.

Re-run from the integration root: `node scripts/ui-test/final-owner-login.mjs`.
