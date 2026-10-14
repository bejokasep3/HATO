import { Prisma, type PrismaClient } from '@prisma/client'
import { businessDate } from '../domain/calendar'
import { formatScaled, parseScaled } from '../domain/money'

export async function getCumulativeStock(prisma: PrismaClient, now = new Date()) {
  const asOfDate = businessDate(now)
  const rows = await prisma.$queryRaw<{
    group_code: 'AYAM' | 'TAHU'; incoming: Prisma.Decimal; ordered: Prisma.Decimal;
    missing_weeks: bigint; unmapped_items: bigint; week_count: bigint
  }[]>`
    WITH eligible AS (
      SELECT id, rules_version FROM cycles WHERE period_start <= ${asOfDate}::date
    ), incoming AS (
      SELECT t.group_code, SUM(t.quantity) AS quantity, COUNT(*) AS recorded_weeks
      FROM cycle_targets t JOIN eligible c ON c.id = t.cycle_id
      GROUP BY t.group_code
    ), order_lines AS (
      SELECT oi.quantity,
        CASE WHEN c.rules_version = 2 THEN wp.target_group_snapshot ELSE p.target_group END AS group_code
      FROM order_items oi JOIN orders o ON o.id = oi.order_id
      JOIN eligible c ON c.id = o.cycle_id JOIN products p ON p.id = oi.product_id
      LEFT JOIN weekly_prices wp ON wp.cycle_id = c.id AND wp.product_id = oi.product_id
      WHERE o.cancelled_at IS NULL
    ), ordered AS (
      SELECT group_code, SUM(quantity) AS quantity FROM order_lines GROUP BY group_code
    ), totals AS (
      SELECT (SELECT COUNT(*) FROM eligible) AS week_count,
        (SELECT COUNT(*) FROM order_lines WHERE group_code IS NULL) AS unmapped_items
    )
    SELECT groups.group_code, COALESCE(i.quantity, 0) AS incoming,
      COALESCE(o.quantity, 0) AS ordered,
      totals.week_count - COALESCE(i.recorded_weeks, 0) AS missing_weeks,
      totals.unmapped_items, totals.week_count
    FROM (VALUES ('AYAM'), ('TAHU')) AS groups(group_code)
    LEFT JOIN incoming i ON i.group_code::text = groups.group_code
    LEFT JOIN ordered o ON o.group_code::text = groups.group_code
    CROSS JOIN totals
    ORDER BY groups.group_code
  `
  return {
    asOfDate,
    includedWeekCount: Number(rows[0]?.week_count ?? 0n),
    groups: rows.map((row) => {
      const incomingQuantity = row.incoming.toFixed(2)
      const orderedQuantity = row.ordered.toFixed(2)
      const complete = row.missing_weeks === 0n && row.unmapped_items === 0n
      return {
        groupCode: row.group_code, unit: row.group_code === 'AYAM' ? 'kg' : 'bungkus',
        incomingQuantity, orderedQuantity,
        remainingQuantity: complete ? formatScaled(parseScaled(incomingQuantity, 2, 18) - parseScaled(orderedQuantity, 2, 18)) : null,
        missingWeekCount: Number(row.missing_weeks), unmappedItemCount: Number(row.unmapped_items),
      }
    }),
  }
}
