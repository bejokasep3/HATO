# Production database upgrade, 14 October 2026

Completed with explicit user approval after the production application had deployed commit `f58104a`. Manager password reset and live administrator authentication were completed separately; credentials are not recorded here.

## Backup and ownership handling

A fresh custom-format public application-schema backup was saved outside Git before production writes. It covers the tables changed by this upgrade; Auth and Storage were not changed by the database upgrade.

The production legacy schema matched the baseline migration with no differences. Baseline adoption succeeded. The first operational migration attempt through the application account failed because `hato_app` does not own the older manager tables. Its schema changes rolled back; the failed Prisma history entry was subsequently marked rolled back.

The connected `postgres` role owns the older tables, while `hato_app` owns the receipt tables. Neither account can assume the other role. A proposed single-connection migration was rejected at the role switch and rolled back atomically. No role memberships, role switching permissions, or existing-table ownership were changed.

The successful sequence was rehearsed on a fresh local restore with matching receipt ownership and a restricted application test role:

1. Existing owner connection applied the eleven enum/legacy-table/index/constraint statements it owns.
2. Existing application connection applied its receipt alterations and created the six operational tables, indexes, foreign keys, checks and RLS protections in one transaction. This transaction also added payment notes and applied the approved eight-product mapping.
3. Prisma recorded both completed operational migrations as applied. Prisma migrate status reports up to date, and schema diff reports no differences.

The provider records the owner stage as `hato_operational_upgrade_owner_tables`. The exact owner/app SQL artifacts and before/after fingerprints are retained beside the private backup outside Git. Future migrations must account for this existing ownership split; do not attempt them blindly through the runtime account or grant it ownership of legacy tables to work around permissions.

## Preserved data

Before/after row counts and fingerprints over every original column match for all ten original application tables: 4 cycles, 20 orders, 30 order items, 25 members, 6 groups, 8 products, 16 rotation schedules and 31 weekly prices; receipts remain empty. Only the newly added product mapping/quantity-scale columns were populated. No historical prices, bills, payment status, or cycle rules were guessed or backfilled.

Mapping: three AYAM products at scale 2; two TAHU products at scale 0; three NONE products at scale 2. This matches the user's approved treatment of Recah/Karkas/Gebrus, Kuning/Putih, and Ceker/Kepala/Ati Ampela.

## Live verification

- Manager login succeeds and `/api/auth/me` returns HTTP 200 with `operationalSchema: true`.
- Dashboard, cycles, orders, Ranking and all five Reports endpoints return HTTP 200.
- Empty cycle POST reaches payload validation and returns `INVALID_PAYLOAD`, not `SCHEMA_UPGRADE_REQUIRED`.
- Real week creation and quantity-only order creation through the business services succeeded inside a serializable transaction, then were deliberately rolled back. Cycle/order counts remain 4/20; no verification audit, idempotency, rotation or price records remain.
- All six new operational tables are owned by the existing backend application role, have RLS enabled, and deny direct SELECT to both `anon` and `authenticated` Data API roles.
- No current-week record exists. The manager should create the 12 October week with their actual targets. The missing 5 October week can also be created for late entry. Imported September cycles retain legacy rules and still need separate historical verification before editing.

Users with the app already open must refresh because the application shell reads schema capability when it loads. No further code deployment is required for the schema flag to become true. The local PostgreSQL rehearsal cluster was stopped after verification; private backups and clone databases remain available.
