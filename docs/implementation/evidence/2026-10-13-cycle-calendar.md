# Automatic cycle calendar, 13 October 2026

Local work on `codex/hato-v2-review`, building on the target-first manual week-start flow. No push, deployment, migration, or production data changes.

## Behavior

- Calendar status is calculated using Asia/Jakarta: **Akan datang** before the start, **Minggu ini** during the period, and **Berakhir** from 00:00 WIB on the day after its end. Weekly cycles run Monday through Sunday.
- During the current week, draft prices show **Minggu ini · Harga menyusul**, finalized/open weeks show **Minggu ini · Dibuka**, and a manually closed week remains **Ditutup**. Future and ended dates take precedence over the stored workflow label.
- API reads return `calendarStatus`, `effectiveStatus`, `acceptsNewOrders`, exact start/end timestamps, and `evaluatedAt`. Modern and legacy cycle/dashboard readers use the same calendar rules.
- The default dashboard only selects a current period. It no longer falls back to a past open week or a future week. A missing current week prompts **Mulai minggu ini**; explicit history selection remains available.
- Web and native cycle lists, dashboard, detail, and order entry derive their labels and order-entry availability from the calendar. Open screens tick every 15 seconds using elapsed monotonic time from the server observation. The default dashboard reloads at week rollover. Web focus/visibility and native foreground/focus refresh server time.
- Calendar date formatting defaults to WIB on web and mobile, preventing a non-Indonesian device timezone from displaying Monday as Sunday.
- Existing orders, deliveries, and outstanding bills remain available. Reading a date/status does not rewrite workflow state, mark a delivery completed, close out bills, or create a new week. Targets and price finalization stay manual. No cron activation is required for derived calendar status.

## Checks

| Check | Result |
|---|---|
| Domain/contracts | 25/25 PASS, including exact Monday midnight WIB, Sunday ending, year boundary, draft/manual closure/legacy status, and date formatting with a New York device timezone |
| PostgreSQL calendar integration | PASS: previous-to-current selection, missing-week gap, explicit history, future status, legacy Friday selection, and no cycle/audit writes |
| Web production build / TypeScript | PASS, Next.js 16.3.8 |
| Mobile TypeScript | PASS |
| Changed web/shared lint | 0 errors, 0 warnings |
| Touched mobile lint | 0 errors, 11 warnings in existing effect/type patterns |
| Expo exports | iOS/Android/web PASS, Expo 57.0.26 |
| Offline browser UI fixtures | PASS at 1440 and 390 px, browser timezone America/New_York: clock advanced through Monday midnight, status rollover without reload, ended-order button disabled, dashboard gap prompt, correct Monday date, no mutations, page errors, or horizontal overflow |

Integration used the marked loopback-only `hato_calendar` database on a local test cluster, port 55444. Browser checks loaded the built static frontend and intercepted all requests with synthetic fixtures; they do not prove real-account authentication or a browser-to-database session. Screenshots: `anti-slop/evidence/2026-10-13-cycle-calendar/`.

Visual inspection caught the pre-existing device-timezone date-formatting issue; web/mobile formatters were fixed and the browser/date checks repeated successfully. Physical-phone foreground/background behavior and live account acceptance remain untested. Previous production release prerequisites still apply.
