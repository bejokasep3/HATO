# Technical Specification — SembakoDistro

> **Versi**: 1.2  
> **Tanggal**: 2026-09-10  
> **Status**: Approved  
> **Referensi**: PRD.md

---

## 1. Arsitektur Sistem

### 1.1 Arsitektur Overview

```
┌─────────────────────────────────────────────────┐
│                   VERCEL (Free Tier)             │
│                                                  │
│  ┌──────────────┐     ┌──────────────┐          │
│  │  Web Browser  │     │  HP Browser  │          │
│  │  (Desktop)    │     │  (Mobile)    │          │
│  └──────┬───────┘     └──────┬───────┘          │
│         │                     │                  │
│         └──────────┬──────────┘                  │
│                    │                             │
│           ┌────────▼─────────┐                   │
│           │   Next.js App    │                   │
│           │  (App Router)    │                   │
│           │                  │                   │
│           │  ┌────────────┐  │                   │
│           │  │ API Routes │  │                   │
│           │  └─────┬──────┘  │                   │
│           │        │         │                   │
│           │  ┌─────▼──────┐  │                   │
│           │  │   Prisma   │  │                   │
│           │  └─────┬──────┘  │                   │
│           └────────┼─────────┘                   │
│                    │                             │
└────────────────────┼─────────────────────────────┘
                     │
          ┌──────────▼──────────┐
          │   SUPABASE (Free)   │
          │  ┌───────────────┐  │
          │  │  PostgreSQL   │  │
          │  ├───────────────┤  │
          │  │  Auth         │  │
          │  ├───────────────┤  │
          │  │  Realtime     │  │
          │  └───────────────┘  │
          └─────────────────────┘

  Future (Fase 2):
  ┌──────────────┐
  │  WA Bot      │──→ Supabase DB
  │  (Baileys)   │
  └──────────────┘
```

### 1.2 Keputusan Arsitektur

| Keputusan | Pilihan | Alasan |
|-----------|---------|--------|
| Frontend Framework | **Next.js 14+ (App Router)** | SSR, API routes built-in, PWA support, ecosystem besar |
| UI Library | **shadcn/ui + Tailwind CSS** | Komponen siap pakai, customizable, modern |
| Backend/Database | **Supabase** (PostgreSQL) | Free tier generous, Auth built-in, Realtime, auto-backup |
| ORM | **Prisma** | Type-safe database access, migration support |
| State Management | **TanStack Query (React Query)** | Server state management, caching, auto-refetch |
| Mobile | **PWA** | Satu codebase, installable di HP, akses dari mana saja |
| WA Bot (Fase 2) | **whatsapp-web.js / Baileys** | Open source, gratis, bisa self-host |
| Hosting | **Vercel** (free tier) | Auto-deploy, CDN, serverless |
| Language | **TypeScript** | Type safety end-to-end |
| Auth | **Supabase Auth** | Built-in, session management, mudah extend |

### 1.3 Justifikasi Tech Stack

**Mengapa Supabase?**
- Free tier: 500MB database, 1GB storage, 50K monthly active users
- Built-in Auth (untuk multi-user di masa depan)
- Realtime subscriptions (untuk dashboard live-update)
- Row Level Security (untuk multi-tenant di Fase 4)
- Edge Functions (untuk WA bot webhook di Fase 2)
- Auto-backup data
- PostgreSQL = relational, cocok untuk data terstruktur

**Mengapa Next.js + Vercel?**
- Satu codebase untuk web + mobile (PWA)
- Akses dari mana saja, 24/7, laptop tidak perlu nyala
- API routes = no need for separate backend server
- Auto-deploy dari Git push
- Free tier sangat cukup untuk aplikasi ini

---

## 2. Data Model

### 2.1 Entity Relationship Diagram

```mermaid
erDiagram
    groups ||--o{ members : "has many"
    groups ||--o{ groups : "has sub-groups"
    members ||--o{ orders : "places"
    members ||--o{ rotation_schedules : "is scheduled"
    cycles ||--o{ orders : "contains"
    cycles ||--o{ rotation_schedules : "has schedule"
    cycles ||--o{ weekly_prices : "has prices"
    products ||--o{ weekly_prices : "priced per cycle"
    products ||--o{ order_items : "ordered as"
    orders ||--o{ order_items : "contains"

    groups {
        uuid id PK
        string name
        int level
        uuid parent_group_id FK "nullable, self-ref"
        uuid pj_member_id FK "nullable, PJ for this group"
        boolean is_active
        timestamp created_at
        timestamp updated_at
    }

    members {
        uuid id PK
        string name
        string phone
        int level
        uuid group_id FK "belongs to which L2 group"
        string role "anggota | pj | pengurus"
        boolean is_active
        timestamp created_at
        timestamp updated_at
    }

    products {
        uuid id PK
        string name
        string unit "kg | bungkus | liter | pcs"
        boolean is_target
        decimal target_quantity "nullable, for target products"
        string category "nullable"
        int sort_order
        boolean is_active
        timestamp created_at
        timestamp updated_at
    }

    cycles {
        uuid id PK
        string label "auto: Minggu 1 - Sep 2026"
        date period_start
        date order_deadline
        date delivery_date
        string status "draft | open | closed | delivered | completed"
        text notes "nullable"
        timestamp created_at
        timestamp updated_at
    }

    weekly_prices {
        uuid id PK
        uuid cycle_id FK
        uuid product_id FK
        decimal price
        timestamp created_at
    }

    rotation_schedules {
        uuid id PK
        uuid cycle_id FK
        uuid member_id FK
        string status "scheduled | ordered | skipped"
        timestamp created_at
        timestamp updated_at
    }

    orders {
        uuid id PK
        uuid cycle_id FK
        uuid member_id FK
        decimal total_amount "auto-calculated"
        string payment_status "unpaid | paid"
        string order_status "pending | confirmed | shipped | delivered"
        text notes "nullable"
        timestamp paid_at "nullable"
        timestamp created_at
        timestamp updated_at
    }

    order_items {
        uuid id PK
        uuid order_id FK
        uuid product_id FK
        decimal quantity
        decimal unit_price "snapshot from weekly_prices"
        decimal subtotal "auto: quantity * unit_price"
        timestamp created_at
    }
```

### 2.2 Tabel Detail

#### `groups`
Menyimpan hierarki grup. Self-referencing untuk parent-child relationship.

```sql
CREATE TABLE groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  level INT NOT NULL CHECK (level BETWEEN 1 AND 4),
  parent_group_id UUID REFERENCES groups(id) ON DELETE SET NULL,
  pj_member_id UUID, -- will be FK to members after members table created
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index
CREATE INDEX idx_groups_level ON groups(level);
CREATE INDEX idx_groups_parent ON groups(parent_group_id);
```

#### `members`
```sql
CREATE TABLE members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  level INT NOT NULL CHECK (level BETWEEN 1 AND 3),
  group_id UUID NOT NULL REFERENCES groups(id),
  role TEXT NOT NULL DEFAULT 'anggota' CHECK (role IN ('anggota', 'pj', 'pengurus')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add FK for groups.pj_member_id
ALTER TABLE groups ADD CONSTRAINT fk_groups_pj
  FOREIGN KEY (pj_member_id) REFERENCES members(id) ON DELETE SET NULL;

-- Index
CREATE INDEX idx_members_group ON members(group_id);
CREATE INDEX idx_members_active ON members(is_active) WHERE is_active = true;
CREATE UNIQUE INDEX idx_members_phone ON members(phone) WHERE is_active = true;
```

#### `products`
```sql
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  unit TEXT NOT NULL,
  is_target BOOLEAN NOT NULL DEFAULT false,
  target_quantity DECIMAL(10,2),
  category TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT chk_target CHECK (
    (is_target = false) OR (is_target = true AND target_quantity IS NOT NULL)
  )
);
```

#### `cycles`
```sql
CREATE TABLE cycles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label TEXT NOT NULL,
  period_start DATE NOT NULL,
  order_deadline DATE NOT NULL,
  delivery_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'open', 'closed', 'delivered', 'completed')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT chk_dates CHECK (period_start <= order_deadline AND order_deadline <= delivery_date)
);

CREATE INDEX idx_cycles_status ON cycles(status);
CREATE INDEX idx_cycles_dates ON cycles(period_start, delivery_date);
```

#### `weekly_prices`
```sql
CREATE TABLE weekly_prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id UUID NOT NULL REFERENCES cycles(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),
  price DECIMAL(12,2) NOT NULL CHECK (price >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(cycle_id, product_id)
);
```

#### `rotation_schedules`
```sql
CREATE TABLE rotation_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id UUID NOT NULL REFERENCES cycles(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES members(id),
  status TEXT NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled', 'ordered', 'skipped')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(cycle_id, member_id)
);

CREATE INDEX idx_rotation_cycle ON rotation_schedules(cycle_id);
CREATE INDEX idx_rotation_member ON rotation_schedules(member_id);
```

#### `orders`
```sql
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id UUID NOT NULL REFERENCES cycles(id),
  member_id UUID NOT NULL REFERENCES members(id),
  total_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  payment_status TEXT NOT NULL DEFAULT 'unpaid'
    CHECK (payment_status IN ('unpaid', 'paid')),
  order_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (order_status IN ('pending', 'confirmed', 'shipped', 'delivered')),
  notes TEXT,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(cycle_id, member_id)
);

CREATE INDEX idx_orders_cycle ON orders(cycle_id);
CREATE INDEX idx_orders_member ON orders(member_id);
CREATE INDEX idx_orders_payment ON orders(payment_status);
CREATE INDEX idx_orders_status ON orders(order_status);
```

#### `order_items`
```sql
CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),
  quantity DECIMAL(10,2) NOT NULL CHECK (quantity > 0),
  unit_price DECIMAL(12,2) NOT NULL CHECK (unit_price >= 0),
  subtotal DECIMAL(12,2) NOT NULL GENERATED ALWAYS AS (quantity * unit_price) STORED,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(order_id, product_id)
);

CREATE INDEX idx_order_items_order ON order_items(order_id);
```

### 2.3 Database Functions & Triggers

```sql
-- Auto-update orders.total_amount when order_items change
CREATE OR REPLACE FUNCTION update_order_total()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE orders
  SET total_amount = (
    SELECT COALESCE(SUM(subtotal), 0)
    FROM order_items
    WHERE order_id = COALESCE(NEW.order_id, OLD.order_id)
  ),
  updated_at = now()
  WHERE id = COALESCE(NEW.order_id, OLD.order_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_order_total
AFTER INSERT OR UPDATE OR DELETE ON order_items
FOR EACH ROW EXECUTE FUNCTION update_order_total();

-- Auto-update rotation_schedules.status when order is placed
CREATE OR REPLACE FUNCTION update_rotation_on_order()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE rotation_schedules
  SET status = 'ordered', updated_at = now()
  WHERE cycle_id = NEW.cycle_id
    AND member_id = NEW.member_id
    AND status = 'scheduled';
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_rotation_on_order
AFTER INSERT ON orders
FOR EACH ROW EXECUTE FUNCTION update_rotation_on_order();

-- Auto-set paid_at when payment_status changes to 'paid'
CREATE OR REPLACE FUNCTION update_paid_at()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.payment_status = 'paid' AND OLD.payment_status = 'unpaid' THEN
    NEW.paid_at = now();
  ELSIF NEW.payment_status = 'unpaid' THEN
    NEW.paid_at = NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_paid_at
BEFORE UPDATE ON orders
FOR EACH ROW EXECUTE FUNCTION update_paid_at();

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables with updated_at
CREATE TRIGGER trg_groups_updated BEFORE UPDATE ON groups FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_members_updated BEFORE UPDATE ON members FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_products_updated BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_cycles_updated BEFORE UPDATE ON cycles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_rotation_updated BEFORE UPDATE ON rotation_schedules FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_orders_updated BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

### 2.4 Views (Untuk Dashboard & Reporting)

```sql
-- View: Rekap pesanan per siklus per produk
CREATE VIEW v_cycle_recap AS
SELECT
  c.id AS cycle_id,
  c.label AS cycle_label,
  c.status AS cycle_status,
  p.id AS product_id,
  p.name AS product_name,
  p.unit,
  p.is_target,
  p.target_quantity,
  COALESCE(SUM(oi.quantity), 0) AS total_quantity,
  COALESCE(SUM(oi.subtotal), 0) AS total_value,
  COUNT(DISTINCT o.member_id) AS total_orders,
  CASE
    WHEN p.is_target AND COALESCE(SUM(oi.quantity), 0) >= p.target_quantity THEN true
    ELSE false
  END AS target_met
FROM cycles c
CROSS JOIN products p
LEFT JOIN orders o ON o.cycle_id = c.id
LEFT JOIN order_items oi ON oi.order_id = o.id AND oi.product_id = p.id
WHERE p.is_active = true
GROUP BY c.id, c.label, c.status, p.id, p.name, p.unit, p.is_target, p.target_quantity;

-- View: Status rotasi per siklus
CREATE VIEW v_rotation_status AS
SELECT
  rs.cycle_id,
  c.label AS cycle_label,
  rs.member_id,
  m.name AS member_name,
  m.phone,
  g.name AS group_name,
  rs.status,
  CASE WHEN o.id IS NOT NULL THEN true ELSE false END AS has_order,
  o.total_amount,
  o.payment_status
FROM rotation_schedules rs
JOIN cycles c ON c.id = rs.cycle_id
JOIN members m ON m.id = rs.member_id
LEFT JOIN groups g ON g.id = m.group_id
LEFT JOIN orders o ON o.cycle_id = rs.cycle_id AND o.member_id = rs.member_id;

-- View: Anggota yang belum order bulan ini
CREATE VIEW v_members_not_ordered_this_month AS
SELECT
  m.id,
  m.name,
  m.phone,
  g.name AS group_name
FROM members m
LEFT JOIN groups g ON g.id = m.group_id
WHERE m.is_active = true
  AND m.id NOT IN (
    SELECT DISTINCT o.member_id
    FROM orders o
    JOIN cycles c ON c.id = o.cycle_id
    WHERE c.period_start >= date_trunc('month', CURRENT_DATE)
      AND c.period_start < date_trunc('month', CURRENT_DATE) + interval '1 month'
  );

-- View: Payment summary per siklus
CREATE VIEW v_payment_summary AS
SELECT
  c.id AS cycle_id,
  c.label,
  COUNT(o.id) AS total_orders,
  SUM(o.total_amount) AS total_amount,
  SUM(CASE WHEN o.payment_status = 'paid' THEN o.total_amount ELSE 0 END) AS paid_amount,
  SUM(CASE WHEN o.payment_status = 'unpaid' THEN o.total_amount ELSE 0 END) AS unpaid_amount,
  COUNT(CASE WHEN o.payment_status = 'paid' THEN 1 END) AS paid_count,
  COUNT(CASE WHEN o.payment_status = 'unpaid' THEN 1 END) AS unpaid_count
FROM cycles c
LEFT JOIN orders o ON o.cycle_id = c.id
GROUP BY c.id, c.label;
```

---

## 3. API Design

### 3.1 Endpoint Overview

Semua endpoint menggunakan prefix `/api/v1/`.

#### Members
| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| GET | `/members` | List semua anggota (filter: level, group, status, search) |
| GET | `/members/:id` | Detail anggota |
| POST | `/members` | Tambah anggota baru |
| PATCH | `/members/:id` | Edit anggota |
| DELETE | `/members/:id` | Soft-delete (deactivate) anggota |
| POST | `/members/import` | Import anggota dari CSV |

#### Products
| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| GET | `/products` | List produk (filter: is_target, is_active, category) |
| POST | `/products` | Tambah produk |
| PATCH | `/products/:id` | Edit produk |
| DELETE | `/products/:id` | Soft-delete produk |

#### Cycles
| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| GET | `/cycles` | List siklus (filter: status, date range) |
| GET | `/cycles/current` | Siklus aktif saat ini |
| GET | `/cycles/:id` | Detail siklus + recap |
| POST | `/cycles` | Buat siklus baru |
| PATCH | `/cycles/:id` | Update siklus (termasuk status change) |
| POST | `/cycles/:id/close` | Close siklus (shortcut) |
| POST | `/cycles/:id/deliver` | Mark as delivered (shortcut) |
| POST | `/cycles/:id/complete` | Mark as completed (shortcut) |

#### Weekly Prices
| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| GET | `/cycles/:cycleId/prices` | List harga untuk siklus ini |
| PUT | `/cycles/:cycleId/prices` | Batch set/update harga |

#### Rotation
| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| GET | `/cycles/:cycleId/rotation` | Jadwal rotasi siklus ini |
| POST | `/rotation/generate` | Auto-generate rotasi untuk bulan ini |
| PATCH | `/rotation/:id` | Update status rotasi manual |
| POST | `/rotation/swap` | Tukar jadwal 2 anggota |

#### Orders
| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| GET | `/cycles/:cycleId/orders` | List pesanan siklus ini |
| GET | `/orders/:id` | Detail pesanan + items |
| POST | `/orders` | Buat pesanan baru |
| PATCH | `/orders/:id` | Update pesanan (items, notes) |
| DELETE | `/orders/:id` | Hapus pesanan |
| PATCH | `/orders/:id/payment` | Toggle payment status |
| PATCH | `/orders/:id/status` | Update order status |
| POST | `/orders/batch-status` | Batch update order status |

#### Recap
| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| GET | `/cycles/:cycleId/recap` | Rekap agregat per produk |
| GET | `/cycles/:cycleId/recap/text` | Rekap format teks (copy-paste ke WA) |
| GET | `/cycles/:cycleId/recap/detail` | Rekap detail per anggota |

#### Dashboard
| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| GET | `/dashboard` | Semua data dashboard (current cycle, targets, payments) |
| GET | `/dashboard/not-ordered-this-month` | Anggota belum order bulan ini |

#### Groups
| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| GET | `/groups` | List grup (filter: level) |
| POST | `/groups` | Tambah grup |
| PATCH | `/groups/:id` | Edit grup |

### 3.2 Contoh Request/Response

#### POST `/api/v1/orders`
```json
// Request
{
  "cycle_id": "uuid-cycle-1",
  "member_id": "uuid-member-1",
  "notes": "Minta ayam paha",
  "items": [
    { "product_id": "uuid-ayam", "quantity": 2 },
    { "product_id": "uuid-tahu", "quantity": 3 }
  ]
}

// Response 201
{
  "id": "uuid-order-1",
  "cycle_id": "uuid-cycle-1",
  "member": {
    "id": "uuid-member-1",
    "name": "Pak Budi",
    "phone": "08123456789"
  },
  "items": [
    {
      "product": { "name": "Ayam", "unit": "kg" },
      "quantity": 2,
      "unit_price": 35000,
      "subtotal": 70000
    },
    {
      "product": { "name": "Tahu", "unit": "bungkus" },
      "quantity": 3,
      "unit_price": 5000,
      "subtotal": 15000
    }
  ],
  "total_amount": 85000,
  "payment_status": "unpaid",
  "order_status": "pending",
  "created_at": "2026-09-10T10:30:00Z"
}
```

#### GET `/api/v1/cycles/:id/recap/text`
```json
// Response 200
{
  "text": "REKAP PESANAN — Minggu 1 September 2026\nDeadline: Selasa, 8 Sep 2026\n========================================\nAyam (kg)     : 23 kg  ✅ Target: 20\nTahu (bungkus): 25 bks ✅ Target: 20\nTelur (kg)    : 10 kg\nMinyak (liter): 5 ltr\n========================================\nTotal Order: 28 orang\nTotal Nilai: Rp 2.450.000",
  "cycle": {
    "label": "Minggu 1 - Sep 2026",
    "order_deadline": "2026-09-08",
    "delivery_date": "2026-09-10"
  }
}
```

---

## 4. Folder Structure (Next.js App Router)

```
sembako-distro/
├── docs/                          # Documentation (PRD, tech spec, etc.)
│   ├── PRD.md
│   ├── TECHNICAL_SPEC.md
│   └── USER_STORIES.md
├── prisma/                        # Database schema & migrations
│   ├── schema.prisma
│   └── seed.ts                    # Seed data (produk default, admin user)
├── src/
│   ├── app/                       # Next.js App Router
│   │   ├── layout.tsx             # Root layout
│   │   ├── page.tsx               # Dashboard (home)
│   │   ├── login/
│   │   │   └── page.tsx
│   │   ├── members/
│   │   │   ├── page.tsx           # List anggota
│   │   │   ├── new/page.tsx       # Tambah anggota
│   │   │   └── [id]/page.tsx      # Detail/edit anggota
│   │   ├── products/
│   │   │   ├── page.tsx           # List produk
│   │   │   └── new/page.tsx
│   │   ├── cycles/
│   │   │   ├── page.tsx           # List siklus
│   │   │   ├── new/page.tsx       # Buat siklus baru
│   │   │   └── [id]/
│   │   │       ├── page.tsx       # Detail siklus
│   │   │       ├── orders/page.tsx
│   │   │       ├── rotation/page.tsx
│   │   │       ├── prices/page.tsx
│   │   │       └── recap/page.tsx
│   │   ├── orders/
│   │   │   ├── new/page.tsx       # Input pesanan
│   │   │   └── [id]/page.tsx      # Detail pesanan
│   │   ├── rotation/
│   │   │   └── page.tsx           # Jadwal rotasi bulanan
│   │   └── api/
│   │       └── v1/
│   │           ├── members/
│   │           ├── products/
│   │           ├── cycles/
│   │           ├── orders/
│   │           ├── rotation/
│   │           ├── dashboard/
│   │           └── recap/
│   ├── components/
│   │   ├── ui/                    # shadcn/ui components
│   │   ├── layout/
│   │   │   ├── sidebar.tsx
│   │   │   ├── header.tsx
│   │   │   └── mobile-nav.tsx
│   │   ├── dashboard/
│   │   │   ├── target-card.tsx
│   │   │   ├── rotation-progress.tsx
│   │   │   ├── payment-summary.tsx
│   │   │   └── quick-actions.tsx
│   │   ├── members/
│   │   │   ├── member-form.tsx
│   │   │   ├── member-table.tsx
│   │   │   └── member-select.tsx
│   │   ├── orders/
│   │   │   ├── order-form.tsx
│   │   │   ├── order-table.tsx
│   │   │   └── order-item-row.tsx
│   │   └── cycles/
│   │       ├── cycle-form.tsx
│   │       ├── cycle-card.tsx
│   │       └── recap-view.tsx
│   ├── lib/
│   │   ├── db.ts                  # Prisma client instance
│   │   ├── supabase.ts            # Supabase client
│   │   ├── utils.ts               # Utility functions
│   │   ├── format.ts              # Currency & date formatters (Rupiah, Indonesia locale)
│   │   └── rotation.ts            # Rotation algorithm
│   ├── hooks/
│   │   ├── use-members.ts
│   │   ├── use-orders.ts
│   │   ├── use-cycles.ts
│   │   └── use-dashboard.ts
│   └── types/
│       └── index.ts               # Shared TypeScript types
├── public/
│   ├── manifest.json              # PWA manifest
│   └── icons/
├── .env.local                     # Environment variables
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── package.json
└── README.md
```

---

## 5. Algoritma Rotasi

### 5.1 Logika Generate Rotasi Bulanan

```typescript
/**
 * Generate jadwal rotasi untuk satu bulan (4 siklus)
 *
 * Prinsip:
 * 1. Semua anggota aktif harus kebagian minimal 1x/bulan
 * 2. Pembagian merata per minggu (~N/4 per minggu)
 * 3. Prioritaskan anggota yang paling lama belum order
 * 4. Distribusi bisa per sub-grup supaya merata
 */
function generateMonthlyRotation(
  activeMembers: Member[],
  cycles: Cycle[],           // 4 siklus dalam bulan ini
  orderHistory: OrderHistory[] // history order sebelumnya
): RotationSchedule[] {

  // 1. Sort members by last order date (oldest first)
  const sorted = activeMembers.sort((a, b) => {
    const aLast = getLastOrderDate(a.id, orderHistory) ?? new Date(0);
    const bLast = getLastOrderDate(b.id, orderHistory) ?? new Date(0);
    return aLast.getTime() - bLast.getTime();
  });

  // 2. Calculate per-week count
  const totalMembers = sorted.length;
  const weeksInMonth = cycles.length; // usually 4
  const perWeek = Math.ceil(totalMembers / weeksInMonth);

  // 3. Distribute members across weeks
  const schedule: RotationSchedule[] = [];
  for (let week = 0; week < weeksInMonth; week++) {
    const start = week * perWeek;
    const end = Math.min(start + perWeek, totalMembers);
    const weekMembers = sorted.slice(start, end);

    for (const member of weekMembers) {
      schedule.push({
        cycle_id: cycles[week].id,
        member_id: member.id,
        status: 'scheduled',
      });
    }
  }

  return schedule;
}
```

### 5.2 Catatan Rotasi
- Jika total anggota tidak habis dibagi 4, minggu terakhir mendapat sisa
- Admin bisa **swap** anggota antar minggu secara manual
- Anggota yang order di luar jadwal rotasinya tetap tercatat (order diterima, rotasi-nya yang di minggu lain tetap "scheduled")
- Anggota bisa punya entry di `rotation_schedules` DAN `orders` di minggu yang berbeda

---

## 6. Keamanan

### 6.1 MVP (Single Admin)
- Login sederhana: email + password via Supabase Auth
- Satu akun admin saja
- Tidak perlu role-based access di MVP

### 6.2 Future (Multi-User)
- Supabase Auth + Row Level Security (RLS)
- Role: admin (L3), pj (L2), anggota (L1)
- RLS policies per tabel berdasarkan role & grup

---

## 7. Deployment

### 7.1 Infrastructure

| Komponen | Platform | Tier |
|----------|----------|------|
| Frontend + API | Vercel | Free (Hobby) |
| Database + Auth | Supabase | Free |
| Domain (optional) | Custom | Beli sendiri |

### 7.2 Environment Variables
```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxx
SUPABASE_SERVICE_ROLE_KEY=xxx

# Database (Supabase Postgres via Prisma)
DATABASE_URL="postgresql://postgres:[password]@db.[project].supabase.co:5432/postgres"
DIRECT_URL="postgresql://postgres:[password]@db.[project].supabase.co:5432/postgres"

# App
NEXT_PUBLIC_APP_URL=https://sembako-distro.vercel.app
```

### 7.3 Setup & Deploy
```bash
# 1. Install dependencies
npm install

# 2. Setup database (push schema ke Supabase)
npx prisma db push

# 3. Seed data awal (produk, grup, admin)
npx prisma db seed

# 4. Development (lokal)
npm run dev   # → http://localhost:3000

# 5. Production (Vercel)
# Push ke main branch → auto-deploy ke Vercel
git push origin main
```

### 7.4 CI/CD
- Push ke `main` → auto-deploy ke Vercel
- Prisma migrations via `npx prisma migrate deploy`
- Environment variables di Vercel dashboard

---

## 8. Monitoring & Error Handling

### 8.1 MVP
- Vercel built-in analytics & logging
- Supabase dashboard for database monitoring
- Error boundaries di React untuk graceful error display
- Toast notifications untuk user feedback

### 8.2 Future
- Sentry untuk error tracking
- Uptime monitoring (UptimeRobot, free tier)

---

## 9. Performance Considerations

| Area | Strategi |
|------|----------|
| Database queries | Proper indexing (sudah defined di schema), database views untuk query kompleks |
| API responses | Pagination untuk list endpoints (default 20 items/page) |
| Frontend | React Query caching, optimistic updates |
| Bundle size | Next.js code splitting (automatic), lazy load heavy components |
| Images | Tidak banyak image di MVP, tidak perlu optimasi khusus |

---

## 10. Testing Strategy

| Level | Tool | Scope |
|-------|------|-------|
| Unit | Vitest | Utility functions, rotation algorithm, formatters |
| Integration | Vitest + Prisma | API endpoints with test database |
| E2E | Playwright (nice-to-have) | Critical user flows |
| Manual | Checklist | MVP launch checklist |
