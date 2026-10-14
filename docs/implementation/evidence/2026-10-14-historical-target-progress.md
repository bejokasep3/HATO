# Restore historical target progress

Historical demand was disabled along with stock reconciliation. These are separate facts: recorded order quantities can be summed without verifying receipt quantities or payment balances. Imported cycles now calculate demand from active order items and the approved product target groups. Only Recah, Karkas and Gebrus count toward AYAM; TAHU uses the mapped tofu products. Operational cycles continue using their frozen weekly price group snapshots.

The existing dashboard and cycle target panels receive known demand/progress again, restoring the progress bar, percent and shortfall/excess. Missing targets remain unknown and zero targets retain the existing no-percentage behavior. Cancelled orders remain excluded. No historical dates, records, stock or payment balances are changed.

Reader integration verifies historical 10/20 demand, 50 percent progress, 10 remaining, zero-demand tofu with 20 remaining, exclusion of cancelled orders, unknown stock and unchanged stored records. Domain/contract/reader checks (32) passed. Cycle integration, changed-file lint and production build are also checked before release. This supersedes the previous evidence note that historical demand must always remain unknown.
