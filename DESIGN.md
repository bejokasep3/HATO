---
name: HATO Manajer
description: Sistem Manajemen Distribusi Sembako Komunitas Berjenjang
colors:
  primary: "#059669"
  primary-hover: "#047857"
  primary-light: "#ecfdf5"
  primary-selection: "#d1fae5"
  primary-selection-text: "#065f46"
  secondary: "#0284c7"
  accent-warning: "#f59e0b"
  accent-danger: "#f43f5e"
  neutral-bg: "#f8fafc"
  neutral-card: "#ffffff"
  neutral-border: "#e2e8f0"
  neutral-scroll-track: "#cbd5e1"
  neutral-scroll-hover: "#94a3b8"
  neutral-text: "#0f172a"
  neutral-muted: "#64748b"
typography:
  display:
    fontFamily: "var(--font-sans), sans-serif"
    fontSize: "1.875rem"
    fontWeight: 700
    lineHeight: 1.25
  title:
    fontFamily: "var(--font-sans), sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: 1.35
  body:
    fontFamily: "var(--font-sans), sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "var(--font-sans), sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.4
  caption:
    fontFamily: "var(--font-sans), sans-serif"
    fontSize: "11px"
    fontWeight: 500
    lineHeight: 1.3
  micro:
    fontFamily: "var(--font-sans), sans-serif"
    fontSize: "10px"
    fontWeight: 500
    lineHeight: 1.2
rounded:
  sm: "6px"
  md: "8px"
  lg: "12px"
  xl: "16px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "#ffffff"
    rounded: "{rounded.md}"
    padding: "8px 16px"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
---

# Design System: HATO Manajer

## Overview

**Creative North Star: "The Cooperative Command Deck"**

HATO Manajer is an operational management interface built for community food staple distribution. The interface emphasizes functional clarity, trustworthy data presentation, and rapid workflow completion under weekly deadlines. Rather than relying on generic SaaS aesthetics, the design uses an earthy emerald primary palette that reinforces freshness and cooperative community values, supported by crisp slate surfaces and unambiguous status indicators.

**Key Characteristics:**
- High-density operational data tables with responsive cards on mobile viewports.
- Real-time visual progress trackers for mandatory supplier quota minimums (20 kg chicken / 20 packs tofu).
- Direct WhatsApp shareable action blocks with pre-formatted copy.
- Zero visual fluff: every badge, progress meter, and card communicates actionable cycle status.

## Colors
The palette balances fresh, reliable emerald greens with utilitarian slate neutrals and purpose-driven semantic indicators.

- Primary Brand: Emerald (#059669 / merald-600), representing freshness, community health, and verified actions.
- Surface / Canvas: Light slate background (#f8fafc / slate-50) with pure white card containers (#ffffff).
- Borders: Crisp sub-pixel dividers (#e2e8f0 / slate-200) ensuring structural hierarchy without heavy shadows.
- Semantic Accents:
  - Quota Met / Success: Emerald (#10b981 / merald-500)
  - Quota Warning / Pending: Amber (#f59e0b / mber-500)
  - Danger / Deficit / Cancellation: Rose (#f43f5e / ose-500)
  - Information / Deliveries: Sky / Indigo (#0284c7 / sky-600)

## Typography
Typography is powered by Geist Sans, optimized for high legibility in dense tabular and form interfaces.

- Scale & Roles:
  - Display / H1: 24–30px, Bold (700), for primary page headings.
  - Section Headings: 18–20px, Semi-Bold (600), for card headers and aggregate summaries.
  - Body Text: 14px, Regular (400), for order line items, descriptions, and community member lists.
  - Metadata / Badges: 12px, Medium (500), for status chips, order counts, and dates.

## Layout
- Sidebar Navigation: Persistent 64px width or 256px expanded navigation rail on desktop, collapsable off-canvas drawer on mobile.
- Content Canvas: Max-width 7xl with adaptive padding (px-4 sm:px-6 lg:px-8) ensuring fluid readability across screens.
- Grid Systems: 12-column responsive layout for dashboard metrics cards transitioning from 1 col on mobile to 2-4 cols on tablet/desktop.

## Elevation & Depth
- Layered tonal surfaces over heavy dropped shadows.
- Subdued elevations (shadow-sm, subtle border borders) avoid visual clutter and maintain contrast across bright office and mobile field environments.

## Shapes
- Buttons and form inputs use subtle ounded-lg (8px) corners.
- Interactive status badges and avatars use ounded-full or ounded-md (6px).
- Container cards use consistent ounded-xl (12px) with order border-slate-200.

## Components
- **Cycle Quota Bar:** Progress gauge depicting current aggregated orders against weekly quotas (e.g., 20 kg / 20 pk).
- **Status Badges:** Color-coded pill badges for cycle phases (DRAFT, OPEN, SUBMITTED, DELIVERED, COMPLETED).
- **Quick-Action WhatsApp Buttons:** Direct action buttons that copy or launch formatted summaries ready for messaging Penanggung Jawab (PJ) or members.
- **Order Line Item Editor:** Fast multi-item entry row with quantity, consumer vs trader price toggle, and instant subtotal recalculation.

## Do's and Don'ts
- **DO** use emerald and slate shades with proper contrast for text and backgrounds.
- **DO** preserve instant visual confirmation for all financial and quota calculations.
- **DON'T** use gray text directly on colored pastel backgrounds without sufficient contrast.
- **DON'T** bury high-frequency weekly actions (like WhatsApp recap generation or status update) inside nested sub-menus.
