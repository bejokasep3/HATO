# Release preparation, 14 October 2026

Status: local review changes verified; no production migration or deployment performed. This checkpoint supersedes the compatibility blockers in the 13 October pre-push report. The restored Ranking and Reports layouts are retained, with data handling, missing-value text and inaccurate fixed-target/payment wording corrected.

## Changes

- Operational Ranking now supplies the fields expected by the restored screen, retaining its existing score formula. Canceled and unpriced draft orders do not earn points; payment bonuses use the effective verified ledger, excluding reversed entries.
- All five operational Reports responses now match the restored web/native callers. Receivables list every verified outstanding order, including beyond the previous 30-row limit. Installments reduce displayed and reminder amounts; unverified orders are excluded from reminders and explicitly counted.
- Missing purchase costs, receipt quantities and stock are displayed as unknown. Unpriced commodity revenue remains unknown. No stock carryover is fabricated. Target totals use cycle targets and product snapshots, with unknown legacy targets excluded from success-rate denominators.
- CSV quotes cells, preserves multiline names, labels unknown values, and neutralizes formula strings.
- The Prisma configuration imported `dotenv/config` without declaring a direct dependency. Added cached `dotenv@16.6.1` as a development dependency; the upgrade CLI now loads correctly.
- User-approved catalog mapping: AYAM = Recah/Karkas/Gebrus (kg, scale 2); TAHU = Kuning/Putih (bungkus, scale 0); NONE = Ceker/Kepala/Ati Ampela (kg, scale 2). The guarded SQL script was applied only on the local clone, updating eight products. It refuses an unexpected catalog or unit.

## Verification

- Domain/contracts: 28 passed. PostgreSQL integration: 15 passed across 11 files, reset from an isolated synthetic baseline per file. Total: 43 passed. The report compatibility case was rerun after its final commodity assertions changed and passed.
- Next.js production build, web TypeScript, native TypeScript, and Expo iOS/Android/web exports passed using installed dependencies.
- New service/API/helper/test lint: zero errors or warnings. Restored report/ranking web surfaces retain 39 existing warnings; native Reports retains two warnings. No layout redesign was introduced.
- A clean candidate dependency refresh could not complete: Windows denied a modules-directory replacement; the subsequent offline install lacked package metadata in the pnpm cache and could not finish its supply-chain metadata check. That incomplete candidate is not a current verified clean-build artifact. No policy checks were disabled. Main-checkout build/export results above are separate from the earlier successful clean-candidate evidence.
- Current native exports and test logs are under the local temporary pre-push directory, outside Git. Physical-device and authenticated operational browser acceptance remain pending.

## Production-data rehearsal

A read-only custom PostgreSQL dump of the application's `public` schema was saved outside Git and restored into a new loopback-only database `hato_release_clone_20261013` on port 55445. Auth and Storage are excluded; this is not a complete platform disaster-recovery backup.

The restored legacy schema exactly matched the baseline migration according to Prisma diff. The baseline was then adopted on the clone, and both operational migrations were applied using Prisma migrate deploy. The final clone schema matched the current Prisma schema with no differences.

All original fields and row counts in all ten application tables matched their pre-migration fingerprints: 4 cycles, 20 orders, 30 order items, 25 members, 6 groups, 8 products, 16 rotation entries, 31 prices, and no receipts/receipt items. The approved product mapping was applied after that preservation comparison. No historical order, price, payment or cycle workflow was backfilled or guessed. All report sections and Ranking read successfully on the migrated real-data clone without printing personal records.

The four original cycles start on 5 September, 12 September, 21 September and 28 September. They retain legacy rules; the first two are not Monday cycles and were not silently converted. Neither 5 October nor 12 October exists in this snapshot. The manager can create those operational weeks after production upgrade/mapping and enter their missing activity. Existing September orders still require balance verification.

## Remaining release actions

1. Set and test the admin password through Supabase Auth administrative access. The admin account exists; a single test of the requested credentials was rejected with `invalid_credentials`. No password was changed or written into source.
2. Complete full platform backup/restore acceptance, approve historical opening balances for the 20 existing orders, and verify real admin/nonadmin/Data API authorization.
3. Perform physical-device and authenticated web acceptance. The local dump's roles and policies are not proof of hosted Auth/RLS behavior.
4. Explicitly approve the production upgrade/deployment using this tested baseline-adoption and mapping sequence. No production writes have been performed by this preparation.

Sensitive backup and clone fingerprints remain in the user's local temporary backup folder and are excluded from Git. Rejected redesign notes/screenshots are also excluded from the commit selection.
