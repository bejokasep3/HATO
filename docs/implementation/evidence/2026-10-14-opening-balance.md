# Historical opening balance confirmation

The web payment panel now offers **Konfirmasi saldo awal** for imported, unreconciled, uncancelled orders with no existing ledger entries. Managers enter the amount previously paid (including an explicit zero) and a required verification note. The panel previews the remaining balance and offers unpaid/full-paid shortcuts. It does not choose an amount on the manager's behalf.

A protected, schema-guarded POST endpoint validates the amount against the bill, locks the order, checks its version and records an audit event. Positive amounts create one uniquely linked historical opening ledger entry; zero creates no payment row. Opening entries have no invented receipt date and are displayed with their confirmation timestamp. Known historical paid dates are retained for fully paid orders. Replays are idempotent and competing confirmations cannot both succeed. Normal payments become available for a remaining debt after confirmation.

The action changes payment reconciliation only. Cycle dates, bill totals, item quantities and historical prices are preserved. New operational orders must use the existing price-locking workflow. Cancelled orders and orders already containing ledger entries are rejected. No migration or real financial confirmation is performed by this release. Native UI is unchanged.

Validation: changed-file lint and Next.js production build passed. All 33 domain, contract and payment integration checks passed with test-file concurrency set to one. The first parallel-file run encountered a serializable transaction conflict between suites sharing the synthetic database; serial execution resolved fixture interference. Integration coverage includes zero, partial and full balances, subsequent payments, receivables, normalized replay, concurrent confirmations, stale versions, overpayments, cancellation, existing ledger entries, operational-order rejection, audit attribution and historical paid-date preservation. Tests used only the isolated loopback hato_recap database.

Deployment checks should verify the new endpoint through production cookie authentication without submitting a valid real financial confirmation.
