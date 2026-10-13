# Ended-week manager entry, 13 October 2026

Local implementation verified; not pushed or deployed. This changes the ended-week entry behavior recorded in the earlier pre-push evidence.

- Calendar status still becomes `Berakhir` at Monday midnight WIB. Ordinary order-window metadata remains unchanged; manager entry has its own permission.
- Managers can enter missing orders, increase quantities, cancel and restore pending orders in an ended operational week whose stored state is draft or open. Future weeks and manually closed weeks still reject additions/restores.
- An ended draft accepts quantity-only orders. Entering prices and locking them calculates the historical bills through the existing transaction.
- Missing supplier recap does not prevent historical entry; current-week recap deadlines still apply. Where a recap exists, allocation limits still apply. Existing physical-stock, shipped-order, payment, reconciliation, idempotency and version checks remain active.
- Late-created orders have `recordedAfterEnd` in their creation audit event. Audit timestamps are not backdated.
- Web/native entry buttons use the same manager permission. Ranking and Reports remain identical to HEAD.

Verification: domain/contracts 26/26 passed; isolated PostgreSQL week-start/historical-entry 2/2 passed; existing order-mutation/payment/stock regression 1/1 passed. Next production build and native TypeScript passed. Changed web/server/test lint passed without warnings; changed native lint has zero errors and four existing hook warnings. Whitespace check passed. Database tests used only the synthetic loopback cluster on port 55445, which was stopped afterward. No production business data was changed. Physical-device and authenticated operational browser checks remain pending.

Login ID is already `admin` on web and native. Requested password change is NOT DONE: local configuration has only the publishable/anonymous Auth client and the admin UUID, with no Supabase Auth administrative credential; the available connector exposes no password-management action. No password was embedded in application code and no Auth tables were edited directly.
