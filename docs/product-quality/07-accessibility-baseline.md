# Accessibility baseline

Automated axe checks ran on 14 authenticated local views (Home, register, Knowledge, Weekly Review, platform administration, organization Users, My account; 390 and 1440 px). The repeated 17 rule occurrences concern:

- organization identity rendered outside a landmark;
- duplicate unnamed complementary landmarks on desktop Home;
- small/proximate source and administration controls failing target-size checks.

Detailed selectors and axe version are in `.data/product-quality/a11y-before.json`. These are baseline findings to fix, not a conformance verdict. The UX specialist separately tested 22 route/viewport states and keyboard open/Escape/focus return for the existing Guide and mobile navigation. No overflow, unnamed visible controls or page errors occurred in those probes. The focus token contrast issue is a separate manually calculated finding and is not dismissed merely because axe did not report it.

The integrated gate will repeat axe and keyboard checks after design changes, add organization-control/admin-detail/weekly actions, and record desktop/mobile screenshots. A DOM/accessibility-tree review must not be described as an actual screen-reader user test.
