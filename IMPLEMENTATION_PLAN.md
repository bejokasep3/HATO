# Implementation Plan — SembakoDistro MVP

## Goal
Membangun admin dashboard untuk manajemen distribusi sembako di komunitas. Single-user (admin L3), web-based (Next.js + Supabase), deploy di Vercel.

## Confirmed Decisions

| Item | Keputusan |
|------|-----------|
| Tech stack | Next.js 14+ (App Router) + TypeScript |
| Database | Supabase (PostgreSQL cloud, free tier) |
| UI | shadcn/ui + Tailwind CSS |
| Auth | Supabase Auth (single admin, extensible) |
| Hosting | Vercel (free tier) — akses dari mana saja, 24/7 |
| Fitur MVP | 11 fitur inti + ranking dasar |
| Sub-grup L2 | 5 sub-grup |
| Produk target | Ayam (20kg/minggu) + Tahu (20bks/minggu) |
| Anggota | ~82 orang |

---

## Fase 1: Project Setup & Database

### [NEW] Project initialization
- Init Next.js 14 dengan App Router + TypeScript
- Setup Tailwind CSS + shadcn/ui
- Setup Prisma dengan PostgreSQL provider (Supabase)
- Setup Supabase client (server + client components)
- Konfigurasi path aliases, formatting, linting

### [NEW] `prisma/schema.prisma`
- Define semua model: Group, Member, Product, Cycle, WeeklyPrice, RotationSchedule, Order, OrderItem, MemberStats, GroupStats
- Relations, indexes, constraints
- Provider: `postgresql`

### [NEW] `prisma/seed.ts`
- Seed data: 5 sub-grup, 2 produk target (ayam & tahu), admin user
- Sample members untuk testing

### [NEW] Supabase setup
- Create Supabase project
- Configure Auth (email/password for admin)
- Push Prisma schema ke Supabase
- Set environment variables

---

## Fase 2: Core Data Management (CRUD)

### [NEW] Shared components & layout
- Layout: sidebar navigation, header, mobile nav
- Data table component (sortable, filterable, paginated) — via `@tanstack/react-table`
- Form components (select, input, textarea, etc.) — via shadcn/ui
- Toast notifications — via sonner
- Loading & empty states

### [NEW] Members module (`src/app/members/`)
- List page: tabel anggota dengan filter (level, sub-grup, status) & search
- Form: tambah/edit anggota (nama, HP, level, sub-grup, role)
- Soft delete (deactivate)
- API routes: GET, POST, PATCH, DELETE

### [NEW] Products module (`src/app/products/`)
- List page: tabel produk dengan info target
- Form: tambah/edit produk (nama, satuan, is_target, target_qty)
- Activate/deactivate toggle
- API routes: GET, POST, PATCH, DELETE

### [NEW] Groups module (`src/app/groups/`)
- List page: sub-grup dengan jumlah anggota & PJ
- Form: tambah/edit sub-grup
- API routes: GET, POST, PATCH

---

## Fase 3: Order Cycle Engine

### [NEW] Cycles module (`src/app/cycles/`)
- List page: semua siklus dengan status badge
- Create cycle: auto-suggest tanggal (Sabtu-Selasa-Kamis)
- Detail page: overview siklus + tabs (orders, rotation, prices, recap)
- Status transitions: draft → open → closed → delivered → completed
- API routes

### [NEW] Weekly Prices (`src/app/cycles/[id]/prices/`)
- Batch price form: semua produk aktif, default dari siklus sebelumnya
- API routes: GET, PUT (batch upsert)

### [NEW] Rotation module (`src/app/rotation/`)
- Generate rotation: bagi anggota ke 4 minggu merata
- Algorithm: prioritas anggota yang paling lama belum order
- View: jadwal per minggu dengan status (scheduled/ordered/skipped)
- Manual swap antar minggu
- API routes

### [NEW] Orders module (`src/app/orders/`)
- Input pesanan: pilih anggota → produk → kuantitas
- Auto-fill harga dari weekly prices
- Auto-calculate total
- Edit & delete pesanan
- Validasi: 1 anggota = 1 order per siklus
- API routes

---

## Fase 4: Recap & Tracking

### [NEW] Recap (`src/app/cycles/[id]/recap/`)
- Agregasi: total per produk, jumlah orang, total nilai
- Target comparison: aktual vs target (✅/❌)
- Copy-to-clipboard: format teks untuk WA
- Detail view: per anggota

### [NEW] Payment tracking
- Toggle button: unpaid ↔ paid (pada order list & detail)
- Auto-set paid_at timestamp
- Summary widget: total tagihan, dibayar, belum
- Filter by payment status

### [NEW] Delivery status
- Status update: pending → confirmed → shipped → delivered
- Batch update (select multiple → update status)
- Auto-transition saat siklus status berubah

---

## Fase 5: Dashboard & Ranking

### [NEW] Dashboard (`src/app/page.tsx`)
- Widget: Siklus aktif + countdown deadline
- Widget: Target vs Aktual (progress bar ayam & tahu)
- Widget: Rotasi progress (X/20 sudah order)
- Widget: Payment summary
- Widget: Anggota belum order bulan ini
- Quick action buttons

### [NEW] Ranking (`src/app/ranking/`)
- Member stats calculation (total orders, spend, streak, compliance)
- Leaderboard table: rank, nama, skor, badges
- Group stats: partisipasi per sub-grup
- Basic badges display (🔥 On Fire, 💰 Bayar Cepat, etc.)

---

## Fase 6: Polish & Launch

### Responsive design
- Mobile-first layout
- Sidebar → bottom nav di mobile
- Touch-friendly controls

### Data validation & error handling
- Form validation (Zod)
- API error handling
- Toast notifications
- Loading states

### Seed data & testing
- Full seed: 5 sub-grup, 82 anggota (dummy), produk
- Manual testing checklist
- Fix bugs

### Deploy
- Push ke Vercel
- Set environment variables di Vercel dashboard
- Test production build
- Share URL ke admin

---

## Verification Plan

### Manual Verification
1. Create cycle → set prices → generate rotation → input orders → view recap → copy to WA
2. Toggle payment status, verify summary updates
3. Update delivery status, verify tracking
4. Check dashboard widgets show correct data
5. Check ranking leaderboard
6. Test responsive design on mobile browser
7. Test deploy di Vercel — akses dari HP

### Automated Tests
- `npx prisma db push` — schema validation
- Rotation algorithm unit test
- API endpoint integration tests (nice-to-have)
