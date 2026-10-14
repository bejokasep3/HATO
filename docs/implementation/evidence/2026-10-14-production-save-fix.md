# Production save and legacy target fix, 14 October 2026

The screenshot's `Asal permintaan tidak diizinkan` error came from production `NEXT_PUBLIC_APP_URL` incorrectly set to `http://localhost:3000`. Earlier Bearer API checks bypassed the cookie-origin branch and therefore did not catch this browser-specific problem.

Production configuration now uses `https://hato-zeta.vercel.app`. The prior localhost value remains scoped to preview/development. A server-only explicit origin allowlist includes the two other verified production aliases. Cookie mutations still reject missing origins, wrong protocols, unrelated Vercel hosts, and lookalike domains; arbitrary request Host headers are not trusted.

The imported September target editor also exposed an action which its service rejected. Managers can now save targets for imported cycles with a reason, version locking, idempotency and an audit event. Missing target rows are created explicitly. A manually closed operational cycle still rejects target edits.

Imported cycle rules, period dates, historical price rows, orders and payments are unchanged by target edits. A saved target is displayed even when historical demand remains unknown. Financial/fulfillment mutations still require their original operational and reconciliation checks. This does not silently convert legacy cycles into new operational weeks.

Fresh local verification: 30 domain/contract tests and 3 cycle integration cases passed, including the new origin allowlist cases and legacy target preservation/replay/stale-version tests. Changed-file lint, Next.js production build and native TypeScript passed. Database integration used only the reset synthetic `hato_test` database on the isolated loopback cluster; production records were not edited to test this change.

Production verification must exercise cookie-authenticated mutations after the new deployment, in addition to Bearer access. Empty payload requests can verify authentication/origin/validation without saving actual targets. A business-service verification may be wrapped in an outer transaction and deliberately rolled back; do not save guessed targets from the screenshot.
