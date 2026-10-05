-- CreateEnum
CREATE TYPE "TargetGroup" AS ENUM ('AYAM', 'TAHU', 'NONE');

-- CreateEnum
CREATE TYPE "PaymentSource" AS ENUM ('manual', 'legacy_opening_balance');

-- AlterTable
ALTER TABLE "cycles" ADD COLUMN     "period_end" DATE,
ADD COLUMN     "period_state" TEXT,
ADD COLUMN     "rules_version" INTEGER,
ADD COLUMN     "supplier_deadline" DATE,
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "week_key" DATE;

-- AlterTable
ALTER TABLE "goods_receipts" ADD COLUMN     "confirmed_at" TIMESTAMP(3),
ADD COLUMN     "confirmed_by" UUID,
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "cancellation_reason" TEXT,
ADD COLUMN     "cancelled_at" TIMESTAMP(3),
ADD COLUMN     "created_by" UUID,
ADD COLUMN     "ledger_reconciled_at" TIMESTAMP(3),
ADD COLUMN     "ledger_reconciled_by" UUID,
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "quantity_scale" INTEGER,
ADD COLUMN     "target_group" "TargetGroup";

-- AlterTable
ALTER TABLE "weekly_prices" ADD COLUMN     "quantity_scale_snapshot" INTEGER,
ADD COLUMN     "target_group_snapshot" "TargetGroup",
ADD COLUMN     "unit_snapshot" TEXT;

-- CreateTable
CREATE TABLE "cycle_targets" (
    "id" UUID NOT NULL,
    "cycle_id" UUID NOT NULL,
    "group_code" "TargetGroup" NOT NULL,
    "quantity" DECIMAL(10,2) NOT NULL,
    "unit" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cycle_targets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_recaps" (
    "id" UUID NOT NULL,
    "cycle_id" UUID NOT NULL,
    "confirmed_at" TIMESTAMP(3) NOT NULL,
    "actor_id" UUID NOT NULL,
    "cycle_version_at_confirm" INTEGER NOT NULL,
    "target_snapshot" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supplier_recaps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_recap_items" (
    "id" UUID NOT NULL,
    "recap_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "quantity" DECIMAL(10,2) NOT NULL,
    "product_name_snapshot" TEXT NOT NULL,
    "unit_snapshot" TEXT NOT NULL,
    "group_snapshot" "TargetGroup" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supplier_recap_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "method" TEXT NOT NULL,
    "occurred_at" TIMESTAMP(3),
    "source" "PaymentSource" NOT NULL DEFAULT 'manual',
    "actor_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reversed_at" TIMESTAMP(3),
    "reversed_by" UUID,
    "reversal_reason" TEXT,
    "legacy_source_order_id" UUID,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mutation_requests" (
    "id" UUID NOT NULL,
    "actor_id" UUID NOT NULL,
    "operation" TEXT NOT NULL,
    "key" UUID NOT NULL,
    "request_hash" VARCHAR(64) NOT NULL,
    "response_status" INTEGER NOT NULL,
    "response_json" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mutation_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_events" (
    "id" UUID NOT NULL,
    "actor_id" UUID,
    "entity_type" TEXT NOT NULL,
    "entity_id" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "reason" TEXT,
    "request_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cycle_targets_cycle_id_group_code_key" ON "cycle_targets"("cycle_id", "group_code");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_recaps_cycle_id_key" ON "supplier_recaps"("cycle_id");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_recap_items_recap_id_product_id_key" ON "supplier_recap_items"("recap_id", "product_id");

-- CreateIndex
CREATE UNIQUE INDEX "payments_legacy_source_order_id_key" ON "payments"("legacy_source_order_id");

-- CreateIndex
CREATE INDEX "payments_order_id_created_at_idx" ON "payments"("order_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "mutation_requests_actor_id_operation_key_key" ON "mutation_requests"("actor_id", "operation", "key");

-- CreateIndex
CREATE INDEX "audit_events_entity_type_entity_id_created_at_idx" ON "audit_events"("entity_type", "entity_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "cycles_week_key_key" ON "cycles"("week_key");

-- AddForeignKey
ALTER TABLE "cycle_targets" ADD CONSTRAINT "cycle_targets_cycle_id_fkey" FOREIGN KEY ("cycle_id") REFERENCES "cycles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_recaps" ADD CONSTRAINT "supplier_recaps_cycle_id_fkey" FOREIGN KEY ("cycle_id") REFERENCES "cycles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_recap_items" ADD CONSTRAINT "supplier_recap_items_recap_id_fkey" FOREIGN KEY ("recap_id") REFERENCES "supplier_recaps"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_recap_items" ADD CONSTRAINT "supplier_recap_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Legacy rows retain NULL for values that cannot be reconstructed safely.
ALTER TABLE "cycles"
  ADD CONSTRAINT "cycles_version_nonnegative" CHECK ("version" >= 0),
  ADD CONSTRAINT "cycles_period_end_valid" CHECK ("period_end" IS NULL OR "period_end" >= "period_start"),
  ADD CONSTRAINT "cycles_week_key_monday" CHECK ("week_key" IS NULL OR EXTRACT(ISODOW FROM "week_key") = 1);
ALTER TABLE "products"
  ADD CONSTRAINT "products_quantity_scale_valid" CHECK ("quantity_scale" IS NULL OR "quantity_scale" IN (0, 2));
ALTER TABLE "weekly_prices"
  ADD CONSTRAINT "weekly_prices_quantity_scale_valid" CHECK ("quantity_scale_snapshot" IS NULL OR "quantity_scale_snapshot" IN (0, 2));
ALTER TABLE "orders"
  ADD CONSTRAINT "orders_version_nonnegative" CHECK ("version" >= 0);
ALTER TABLE "goods_receipts"
  ADD CONSTRAINT "goods_receipts_version_nonnegative" CHECK ("version" >= 0);
ALTER TABLE "cycle_targets"
  ADD CONSTRAINT "cycle_targets_nonnegative_quantity" CHECK ("quantity" >= 0),
  ADD CONSTRAINT "cycle_targets_group_unit" CHECK (("group_code" = 'AYAM' AND "unit" = 'kg') OR ("group_code" = 'TAHU' AND "unit" = 'bungkus'));
ALTER TABLE "supplier_recaps"
  ADD CONSTRAINT "supplier_recaps_version_nonnegative" CHECK ("cycle_version_at_confirm" >= 0);
ALTER TABLE "supplier_recap_items"
  ADD CONSTRAINT "supplier_recap_items_positive_quantity" CHECK ("quantity" > 0),
  ADD CONSTRAINT "supplier_recap_items_target_group" CHECK ("group_snapshot" IN ('AYAM', 'TAHU'));
ALTER TABLE "payments"
  ADD CONSTRAINT "payments_positive_amount" CHECK ("amount" > 0),
  ADD CONSTRAINT "payments_reversal_reason_required" CHECK ("reversed_at" IS NULL OR ("reversed_by" IS NOT NULL AND NULLIF(BTRIM("reversal_reason"), '') IS NOT NULL)),
  ADD CONSTRAINT "payments_legacy_source_consistent" CHECK (("source" = 'legacy_opening_balance') = ("legacy_source_order_id" IS NOT NULL));

-- The new business tables are accessible through the server's database role,
-- never through Supabase's browser/mobile Data API roles.
ALTER TABLE "cycle_targets" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "supplier_recaps" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "supplier_recap_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "payments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "mutation_requests" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "audit_events" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "cycle_targets", "supplier_recaps", "supplier_recap_items", "payments", "mutation_requests", "audit_events" FROM PUBLIC;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON "cycle_targets", "supplier_recaps", "supplier_recap_items", "payments", "mutation_requests", "audit_events" FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON "cycle_targets", "supplier_recaps", "supplier_recap_items", "payments", "mutation_requests", "audit_events" FROM authenticated;
  END IF;
END $$;
