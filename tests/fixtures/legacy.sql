-- Synthetic records. Apply only after the baseline migration in the isolated test cluster.
INSERT INTO groups (id, name, level, is_active, created_at, updated_at)
VALUES ('00000000-0000-4000-8000-000000000001', 'Kelompok Uji', 1, true, now(), now());

INSERT INTO members (id, name, phone, level, group_id, role, is_active, created_at, updated_at)
VALUES ('00000000-0000-4000-8000-000000000002', 'Anggota Uji', '0000000000', 1, '00000000-0000-4000-8000-000000000001', 'anggota', true, now(), now());

INSERT INTO products (id, name, unit, is_target, target_quantity, sort_order, is_active, created_at, updated_at)
VALUES ('00000000-0000-4000-8000-000000000003', 'Ayam Uji', 'kg', true, 20, 0, true, now(), now());

-- Two legacy cycles deliberately share the same week; week_key must stay NULL.
INSERT INTO cycles (id, label, period_start, order_deadline, delivery_date, status, created_at, updated_at)
VALUES
  ('00000000-0000-4000-8000-000000000004', 'Siklus Lama A', '2026-09-21', '2026-09-22', '2026-09-24', 'closed', now(), now()),
  ('00000000-0000-4000-8000-000000000005', 'Siklus Lama B', '2026-09-21', '2026-09-22', '2026-09-24', 'draft', now(), now());

INSERT INTO orders (id, cycle_id, member_id, total_amount, payment_status, order_status, paid_at, created_at, updated_at)
VALUES ('00000000-0000-4000-8000-000000000006', '00000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000002', 100000, 'paid', 'confirmed', now(), now(), now());

INSERT INTO order_items (id, order_id, product_id, price_type, quantity, unit_price, subtotal, created_at)
VALUES ('00000000-0000-4000-8000-000000000007', '00000000-0000-4000-8000-000000000006', '00000000-0000-4000-8000-000000000003', 'consumer', 2, 50000, 100000, now());

INSERT INTO goods_receipts (id, cycle_id, received_at, status, created_at, updated_at)
VALUES ('00000000-0000-4000-8000-000000000008', '00000000-0000-4000-8000-000000000004', now(), 'draft', now(), now());
