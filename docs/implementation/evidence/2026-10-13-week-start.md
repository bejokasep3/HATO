# Manual week start, 13 October 2026

Scope: local changes on `codex/hato-v2-review`. No push, deployment, or production database changes.

## User workflow

- Use **Mulai minggu ini** from Dashboard, Orders, or Cycles on web, or Dashboard/Orders on mobile.
- The week begins on the current Monday in Asia/Jakarta. Starting on Tuesday still selects that Monday. An existing week is reused.
- Enter minimum chicken and tofu targets. New prices start blank instead of silently using last week's prices.
- Record quantities while the week is a draft. These orders show **Menunggu harga**, contribute to demand/target progress, and have no payable balance yet.
- On the week detail screen, enter consumer and trader prices, save them, then choose **Kunci harga & buka minggu**.
- Opening validates prices and calculates all draft order lines and totals atomically, with audit records. Prices remain fixed afterward. Existing order cancellation is preserved; cancelled orders stay out of active demand and receivables.
- Payment and fulfillment actions are rejected before prices are locked. Previous orders, payments, and outstanding balances are retained. Old weeks are not automatically marked completed.
- Cron remains disabled. This implements the user's chosen manual workflow, not unattended weekly opening.

## Implementation boundary

No new database columns or migration. Modern draft-cycle orders use the existing unreconciled ledger state until final pricing; API responses provide `pricingPending` to distinguish them from legacy records awaiting reconciliation. Bills use the existing exact decimal calculation, cycle lock, serializable transaction, idempotency keys, and version checks. Bulk updates avoid one database round trip per order line. Historic create requests keep their prior idempotency payload when the new price-copy option is absent.

## Verification

| Check | Result |
|---|---|
| Domain and contract tests | 22/22 PASS, including Monday midnight WIB/year boundary and mobile pending-price response |
| New real PostgreSQL workflow integration | PASS: quantity-first orders, consumer/trader totals, demand, draft edits/cancel/restore, rejected payments/fulfillment, invalid order windows, missing prices, replay, final pricing, post-lock payment, unchanged historical bill |
| Existing cycle integration on separate fresh fixture | 2/2 PASS, including concurrent creation of the same week |
| Web production build and TypeScript | PASS, Next.js 16.3.8 |
| Mobile TypeScript | PASS |
| Lint on changed areas | Web: 0 errors/warnings. Mobile: 0 errors, 15 warnings in existing effect/type patterns; warning cleanup deferred |
| Expo export | PASS, iOS/Android/web with Expo 57.0.26 |
| Browser UI with synthetic API fixtures | PASS at 1440 and 390 px: create target-only week, input/save without price, existing-week reuse, Escape dismissal, no page errors or horizontal overflow |

Database tests used fresh, marked PostgreSQL clusters bound to loopback ports 55443 and 55444, never application database credentials. An initial existing-cycle test was contaminated by extra synthetic members from the new workflow test; it was rerun in its own fresh cluster and passed. The first workflow test also exposed a zero-price subtotal validation error, which was fixed before the passing runs.

The local preview server command was rejected by automatic approval policy (`blocked by policy`). Browser checks instead loaded built static Orders HTML and JavaScript in Edge with all network requests intercepted for synthetic fixtures, without starting a server or weakening application authentication. This verifies frontend interaction, not real-account authorization or a browser-to-database flow. Screenshot evidence: `anti-slop/evidence/2026-10-13-week-start/`.

Existing real catalog mapping, backup/reconciliation, authorization/Data API, and physical iPhone/Android release prerequisites remain. Live account, native device interaction, and the full browser price-entry/finalization flow have not been verified. Local code readiness does not authorize production deployment.
