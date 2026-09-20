# LaporPak Design System

> **Implementation baseline:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS 4, Lucide and Base UI. This document defines presentation only; API contracts and architecture retain precedence. Sections describing charts, statistics, citizen dashboards, manual mode, maps, AI confidence or new actions are future visual examples, not authorization to add features. The current landing page remains `/reports`. Use only existing fields and actions. Minimum interactive target: 44 px. Current implementation uses Plus Jakarta Sans, navy sidebar, yellow active navigation and primary actions. No Recharts or Framer Motion dependency is required.


> **Version:** 1.0 — DJKI-inspired UI polish  
> **Target:** LaporPak Frontend (React 19 + Next.js 16 App Router + TypeScript + Tailwind CSS v4)  
> **Primary product surface:** Government / Perangkat Desa Dashboard  
> **Reference:** visual language of the Direktorat Jenderal Kekayaan Intelektual (DJKI / dgip.go.id), adapted to LaporPak's public-service workflow.

---

## 0. Document Purpose

This file is the UI source of truth for LaporPak. Use it when creating, refactoring, or reviewing every page and component. The goal is not to copy DJKI branding or logos; the goal is to reproduce its **institutional visual language** as faithfully as possible for LaporPak:

- deep navy as the main authority/trust color,
- warm yellow as the primary action/highlight color,
- dominant white canvas,
- clear government-service hierarchy,
- large readable section headings,
- prominent search / service discovery surfaces,
- restrained borders and shadows,
- compact, functional components,
- minimal decoration,
- formal but approachable Indonesian copy.

The result should feel like a modern Indonesian public-service portal: official, clear, trustworthy, and easy to scan.

### Reference fidelity note

The tokens below are adapted from the DJKI screenshots supplied by the team. They are LaporPak visual guidelines, not an official DJKI design-token source.

---

# 1. Product Context

LaporPak is a smart-village public-service gateway for four core citizen intents:

- **ASK** — ask about village services and procedures.
- **REPORT** — report incidents, infrastructure issues, or public-service problems.
- **REQUEST** — submit or prepare administrative service requests.
- **TRACK** — track the status of an existing report or request.

The dashboard is used by village officers / public-service operators to validate, triage, process, and monitor citizen cases. AI assists by classifying, summarizing, suggesting routing, detecting duplicates, and highlighting low-confidence cases; final consequential decisions remain with authorized officers.

UI implication: the design must make **status, ownership, source-of-truth, confidence, and human approval** visually obvious.

---

# 2. Design Principles

## 2.1 Institutional clarity first

Every screen must communicate hierarchy immediately. A user should know within 2–3 seconds:

1. where they are,
2. what requires attention,
3. what action is available,
4. what status is official,
5. what information is AI-assisted.

## 2.2 Navy establishes authority

Deep navy is the visual anchor. Use it for:

- sidebar / institutional navigation,
- high-emphasis headings,
- strong information panels,
- selected navigation states,
- chart anchors,
- footer / utility strips.

Do not flood every component with navy backgrounds. White remains the dominant surface.

## 2.3 Yellow means action and attention

Yellow is a controlled accent, not a general background color.

Use it for:

- primary buttons,
- active navigation markers,
- key indicators,
- selected tabs,
- focus accents,
- small emphasis lines.

Avoid using yellow for destructive or warning semantics when the meaning could be confused. Semantic warning uses amber/orange with explicit icon + label.

## 2.4 Search is a first-class pattern

DJKI places service/data search prominently. LaporPak should do the same for operational search:

- find reports,
- find citizens,
- find service requests,
- find ticket numbers,
- filter by status/category/location.

Search modules may be larger than conventional admin search fields when they are the main page task.

## 2.5 Flat, structured, restrained

Prefer:

- white surfaces,
- 1px borders,
- 2–6px corner radius,
- subtle shadow only where layering is necessary,
- clear spacing,
- line icons,
- simple dividers.

Avoid:

- glassmorphism,
- blurry gradients,
- large floating shadows,
- excessive pill shapes,
- neumorphism,
- decorative blobs,
- unnecessary motion.

## 2.6 Human authority must remain visible

AI content must always be visually marked as recommendation/support, never as an official final decision.

Required patterns:

- `Saran AI`, `Ringkasan AI`, or `Confidence 84%` label.
- visible source or rationale when relevant.
- explicit officer action for approve / reject / change status.
- official status styled separately from AI recommendation.

---

# 3. Visual Personality

LaporPak should feel:

- **Official** — credible enough for a village government service.
- **Clear** — no visual ambiguity around actions and status.
- **Efficient** — optimized for daily operational work.
- **Accessible** — understandable by non-technical staff.
- **Civic** — friendly, not corporate-luxury or startup-gimmicky.
- **Calm** — public-service issues may be stressful; UI must not amplify urgency unnecessarily.

Keywords for design review:

`institutional · trustworthy · structured · public-service · searchable · sober · accessible · Indonesian civic-tech`

---

# 4. Color System

## 4.1 Core brand colors

| Token | Hex | Usage |
|---|---:|---|
| `brand.navy.950` | `#17233F` | deepest navigation/footer, highest contrast |
| `brand.navy.900` | `#213458` | primary brand navy, sidebar, strong headings |
| `brand.navy.800` | `#2B416A` | hover / elevated navy |
| `brand.navy.700` | `#39527E` | secondary navy text/icon |
| `brand.yellow.500` | `#F4C430` | primary CTA, active marker |
| `brand.yellow.600` | `#DDAF1E` | yellow hover |
| `brand.yellow.100` | `#FFF7D6` | soft selected/attention background |
| `brand.yellow.50` | `#FFFBEF` | subtle highlighted surface |

### Usage ratio

Target visual balance per desktop dashboard:

- **70–78%** white / near-white,
- **14–20%** navy / dark text,
- **3–6%** yellow,
- **remaining** semantic colors.

Yellow should never visually dominate the screen.

## 4.2 Neutral palette

| Token | Hex | Usage |
|---|---:|---|
| `neutral.white` | `#FFFFFF` | main surface |
| `neutral.25` | `#FCFCFD` | very subtle section separation |
| `neutral.50` | `#F7F8FA` | page canvas / input disabled |
| `neutral.100` | `#F1F3F6` | muted surface |
| `neutral.200` | `#E3E7ED` | default border |
| `neutral.300` | `#D2D8E1` | stronger divider |
| `neutral.500` | `#7A8496` | muted text |
| `neutral.600` | `#606B7D` | secondary text |
| `neutral.700` | `#445065` | body strong |
| `neutral.900` | `#172033` | primary body text |

## 4.3 Semantic colors

Semantic colors must communicate state, never brand identity.

| State | Text/Icon | Soft BG | Border |
|---|---:|---:|---:|
| Success / Selesai | `#18794E` | `#ECFDF3` | `#B7E4CD` |
| Info / Terverifikasi | `#2563A8` | `#EFF6FF` | `#BFDBFE` |
| Processing | `#3758A6` | `#EEF2FF` | `#C7D2FE` |
| Warning / Klarifikasi | `#A05A00` | `#FFF7E6` | `#F6D59A` |
| Pending | `#806100` | `#FFF9DB` | `#EEDB87` |
| Danger / Ditolak | `#B42318` | `#FFF1F0` | `#F4C7C3` |
| AI / Recommendation | `#5B4AA8` | `#F5F2FF` | `#D8D0F6` |

### Never rely on color alone

Every status requires at least two of:

- color,
- text label,
- icon,
- shape / border,
- contextual description.

---

# 5. Typography

## 5.1 Recommended family

Use a single highly readable sans-serif stack for consistency:

```css
font-family: "Plus Jakarta Sans", "Inter", system-ui, sans-serif;
```

The current repository already includes Plus Jakarta Sans, so keep it to reduce implementation overhead. Remove the visual dependency on Urbanist for headings unless needed temporarily during migration.

## 5.2 Weight system

- 400 — body / helper text.
- 500 — labels / metadata / secondary navigation.
- 600 — buttons / table headers / active navigation.
- 700 — card titles / section headings.
- 800 — primary page heading or hero number only.

Avoid 900/black weights across dashboard UI. It makes the interface feel promotional rather than governmental.

## 5.3 Type scale

| Role | Desktop | Mobile | Weight | Line height |
|---|---:|---:|---:|---:|
| Display | 40px | 32px | 700 | 1.15 |
| H1 | 30px | 26px | 700 | 1.2 |
| H2 | 24px | 22px | 700 | 1.25 |
| H3 | 18px | 18px | 700 | 1.35 |
| Title | 16px | 16px | 600–700 | 1.4 |
| Body | 14px | 14px | 400 | 1.6 |
| Body strong | 14px | 14px | 600 | 1.5 |
| Small | 12px | 12px | 400–500 | 1.5 |
| Caption | 11px | 11px | 500 | 1.4 |

## 5.4 Heading treatment

Primary sections can use a short yellow rule above or beside the title:

```text
────  PELAYANAN WARGA
Dashboard Pelayanan Desa
```

Do not use the yellow rule on every card. Reserve it for page/major section hierarchy.

---

# 6. Layout System

## 6.1 Desktop shell

Recommended admin shell:

- Sidebar: `256px` expanded.
- Topbar: `64px`.
- Content max width: `1600px`.
- Content horizontal padding: `32px` at >= 1280px.
- Content vertical padding: `28–32px`.

## 6.2 Grid

Use a 12-column content grid.

Typical dashboard composition:

- main analytics / table: `8 columns`,
- actions / activity rail: `4 columns`.

At 1024–1279px:

- 8-column conceptual grid,
- main modules can be 5/3 or 8/8.

Below 1024px:

- sidebar becomes drawer,
- all primary modules stack.

## 6.3 Section width

Keep reading widths controlled. Long text panels should not stretch to the full viewport.

- form content: 720–880px max,
- article/help content: 720px max,
- table/analytics: may use full available width.

---

# 7. Spacing Scale

Use a 4px base unit.

```text
0  = 0
1  = 4px
2  = 8px
3  = 12px
4  = 16px
5  = 20px
6  = 24px
8  = 32px
10 = 40px
12 = 48px
16 = 64px
20 = 80px
```

Rules:

- icon → label: 8px,
- label → field: 6–8px,
- compact row gap: 8–12px,
- card internal padding: 20–24px,
- section gap: 24–32px,
- major page section: 40–48px.

---

# 8. Radius

The reference language is relatively squared and institutional.

| Token | Value | Usage |
|---|---:|---|
| `radius.xs` | 2px | active line / tiny chips |
| `radius.sm` | 4px | buttons, fields, compact cards |
| `radius.md` | 6px | standard cards / dropdowns |
| `radius.lg` | 8px | modals only |
| `radius.full` | 999px | avatar, status dot only |

Avoid 16–24px dashboard cards.

---

# 9. Borders and Shadows

## 9.1 Border

Default:

```css
border: 1px solid #E3E7ED;
```

Strong separators:

```css
border-color: #D2D8E1;
```

Selected emphasis may use navy or yellow, but only one edge/indicator is preferred over a full bright border.

## 9.2 Shadow

Default cards should be border-led, not shadow-led.

```css
box-shadow: 0 1px 2px rgba(23, 32, 51, 0.04);
```

Dropdown / popover:

```css
box-shadow: 0 8px 24px rgba(23, 32, 51, 0.10);
```

Modal:

```css
box-shadow: 0 20px 50px rgba(23, 32, 51, 0.18);
```

No glow shadows.

---

# 10. Iconography

Use Lucide React, already present in the repository.

Guidelines:

- line icons,
- 1.75–2px stroke,
- default 18px in navigation,
- 16px in buttons/table rows,
- 20–24px in service cards,
- 32px max for empty state illustration-like icons.

Do not mix filled icon packs with Lucide.

Use icons as support, not decoration.

---

# 11. Navigation

## 11.1 Sidebar

Desktop sidebar uses brand navy.

```text
[ LaporPak ]

MENU UTAMA
▌ Dashboard
  Laporan
  Permintaan
  Knowledge Base

OPERASIONAL
  Warga
  Kategori
  Wilayah
  Audit & AI

[ profile ]
```

### Sidebar tokens

- bg: `brand.navy.900`
- text default: `rgba(255,255,255,.72)`
- text strong: `#FFFFFF`
- hover bg: `rgba(255,255,255,.06)`
- active bg: `rgba(255,255,255,.09)`
- active marker: 3px yellow line on left
- active icon: yellow
- group label: `rgba(255,255,255,.42)`, uppercase, 10–11px, tracking 0.08em

### Sidebar item

- height: 44px,
- horizontal padding: 14px,
- radius: 4px,
- icon width: 20px,
- no nested card around icon.

## 11.2 Topbar

Topbar is white and functional.

Contains:

- menu trigger on small screens,
- breadcrumb / page title,
- compact global search,
- notification button,
- profile menu.

Height: 64px. Border-bottom 1px neutral-200.

Do not put a gradient or large brand area in the topbar.

---

# 12. Page Header

Standard pattern:

```text
PELAYANAN DESA
Dashboard
Pantau laporan warga, permintaan layanan, dan tindak lanjut hari ini.

[ Periode ] [ Ekspor ]
```

- eyebrow: 11px, 700, uppercase, navy-700, tracking 0.08em.
- H1: 28–30px navy-950.
- description: 14px neutral-600.
- actions aligned right desktop; stacked below on mobile.

Optional yellow rule: 32–40px width, 3px height.

---

# 13. Buttons

## 13.1 Primary — Yellow CTA

Use for one primary action per local region.

```css
background: #F4C430;
color: #17233F;
border: 1px solid #F4C430;
```

Hover: `#DDAF1E`.

Examples:

- `Cari`
- `Buat Laporan`
- `Simpan Perubahan`
- `Proses Laporan`

## 13.2 Secondary — Navy

```css
background: #213458;
color: white;
```

Use for strong operational actions where yellow is already used elsewhere.

## 13.3 Outline

```css
background: white;
color: #213458;
border: 1px solid #D2D8E1;
```

Hover: neutral-50 + navy border.

## 13.4 Ghost

Transparent; used for table row actions or toolbar icons.

## 13.5 Destructive

Never use brand yellow. Use danger semantic.

### Button sizing

- sm: 44px height, 12px horizontal padding,
- md: 44px height, 16px horizontal padding,
- lg: 46px height, 20px horizontal padding.

Button radius: 4px.

---

# 14. Forms and Search

## 14.1 Inputs

- height: 40–44px,
- bg: white,
- border: neutral-300,
- radius: 4px,
- text: neutral-900,
- placeholder: neutral-500.

Focus:

```css
border-color: #39527E;
box-shadow: 0 0 0 3px rgba(244,196,48,.24);
```

## 14.2 Labels

- 12px,
- 600,
- neutral-700,
- 6–8px gap below.

Required marker: danger red, not yellow.

## 14.3 Large search module

Use on report / service index pages.

Structure:

```text
Cari data pelayanan
[ Nomor tiket / nama / kata kunci........ ][ Status v ][ Kategori v ][ Cari ]
```

Visual treatment:

- white or very light gray module,
- subtle border,
- 24–28px padding,
- optional navy title,
- yellow CTA.

This is the closest operational translation of the DJKI search pattern.

---

# 15. Cards

## 15.1 Standard Card

- white background,
- 1px neutral-200 border,
- radius 6px,
- padding 20–24px,
- tiny shadow or none.

## 15.2 KPI Card

Do **not** use six brightly colored KPI cards.

Preferred layout:

```text
Laporan Baru                 [icon]
24
+8 sejak kemarin
──────────── yellow mini rule
```

Use 3–4 high-value KPI cards maximum above the fold.

Recommended metrics:

- `Laporan Baru`
- `Butuh Verifikasi`
- `Sedang Diproses`
- `Selesai Minggu Ini`

Keep card backgrounds white. Semantic color appears in icon/label only.

## 15.3 Attention Card

Use yellow-left border or yellow top rule for a small number of actionable cards.

Do not use full yellow background for dense content.

---

# 16. Tables

Tables are a primary operational component.

## 16.1 Structure

- header bg: neutral-50,
- header text: 11–12px, 700, uppercase or sentence-case,
- row height: 56–64px,
- horizontal padding: 16px,
- dividers: neutral-200,
- hover: `#FAFBFC`.

## 16.2 Recommended report columns

```text
ID
Laporan
Warga
Kategori
Lokasi
Status
Prioritas
Masuk
Petugas
Aksi
```

On tablet/mobile hide lower-priority columns first:

1. petugas,
2. exact time,
3. category,
4. location.

Never hide ID/title/status/action.

## 16.3 Row action

Use a compact kebab menu or `Lihat Detail` text button. Avoid 3–4 visible icon buttons in every row.

---

# 17. Status Badges

Badge shape should be compact—not oversized pills.

```css
padding: 3px 8px;
border-radius: 999px;
font-size: 11px;
font-weight: 600;
```

Badge includes a 6px status dot when useful.

Mapping:

- `Menunggu` → pending
- `Terverifikasi` → info
- `Diproses` → processing
- `Butuh Klarifikasi` → warning
- `Selesai` → success
- `Ditolak` → danger

AI confidence is never styled as official status. Use purple/neutral AI treatment.

---

# 18. Tabs and Filters

## 18.1 Tabs

Reference-inspired tab behavior:

- white background,
- navy text,
- selected tab has 3px yellow bottom border,
- no floating rounded tab pills.

Example:

```text
Semua   Menunggu   Diproses   Klarifikasi   Selesai
─────
```

## 18.2 Filter chips

Use only for temporary filters. Neutral outline with small `×` removal icon.

---

# 19. AI Assistance Pattern

## 19.1 AI Recommendation Card

Required format:

```text
[Sparkles] SARAN AI
Kemungkinan kategori: Infrastruktur Jalan
Confidence 86%
Alasan: laporan menyebut jalan berlubang dan lokasi RT 04.

[Terima Saran] [Ubah Manual]
```

Design:

- surface: `#F5F2FF`,
- border: `#D8D0F6`,
- small purple icon/label,
- normal body text,
- officer controls remain brand/neutral.

## 19.2 AI safety alert

Low confidence / uncertain answer:

```text
AI membutuhkan verifikasi manusia
Confidence 48% — jangan ubah status secara otomatis.
```

Use warning semantics + AI label.

## 19.3 Manual mode

Manual-mode banner must be prominent but not alarming:

- navy background,
- white text,
- yellow icon/label,
- clear explanation that automation is paused and manual processing remains available.

---

# 20. Alerts

Alert anatomy:

- icon,
- strong 13–14px title,
- optional 12–13px description,
- optional action.

Use 4px radius, 1px border.

No large rounded colored boxes unless representing system-level state.

---

# 21. Charts and Data Visualization

Charts must feel administrative, not marketing-oriented.

## 21.1 Palette

Primary series:

- navy: `#213458`
- navy-light: `#5C7298`
- yellow: `#F4C430`
- success: `#18794E`
- muted: `#C7CED8`

Semantic colors may be used for status distribution.

## 21.2 Rules

- white chart background,
- no gradients,
- thin neutral grid lines,
- minimum decoration,
- direct labels where practical,
- tooltip with white background + border,
- accessible textual summary below complex visualizations.

## 21.3 Recommended dashboard chart

Use a combined weekly service chart:

- bars = reports received,
- line = reports resolved,
- one selected period control.

This is more actionable than a decorative donut chart as the primary chart.

---

# 22. Empty, Loading, Error States

## Loading

Use skeleton blocks with neutral-100/200. Avoid full-page spinners for standard dashboard fetches.

## Empty

```text
Belum ada laporan
Laporan warga yang masuk akan muncul di sini.
[Segarkan]
```

Use one simple line icon; no elaborate illustration required.

## Error

```text
Data belum dapat dimuat
Coba lagi beberapa saat atau gunakan mode manual.
[Coba Lagi]
```

Do not show raw API errors to ordinary operators.

---

# 23. Modal and Drawer

## Modal

- max width: 520 / 640 / 800px depending on task,
- radius: 8px,
- strong title,
- visible close button,
- footer actions right-aligned desktop,
- no decorative header gradient.

## Drawer

Use for:

- report quick detail,
- filters on mobile,
- activity history,
- supporting AI context.

Desktop width: 420–520px.

---

# 24. Notifications and Activity

Activity feed row:

```text
● Laporan LP-240912 diverifikasi
  oleh Siti Rahma · 12 menit lalu
```

- dot/icon uses semantic or brand color,
- main message 13px medium,
- metadata 11–12px muted,
- divider between items.

Use exact timestamps in detail screens, relative timestamps on dashboard.

---

# 25. Content / Microcopy

Use concise Bahasa Indonesia.

Good:

- `Butuh Verifikasi`
- `Sedang Diproses`
- `Cari laporan atau nomor tiket`
- `Lihat semua laporan`
- `Saran AI`
- `Terakhir diperbarui 8 menit lalu`
- `Verifikasi manual diperlukan`

Avoid:

- corporate jargon,
- long bureaucratic sentences,
- mixing English and Indonesian unnecessarily,
- vague buttons like `Submit`, `OK`, `Continue`.

Prefer action-specific buttons:

- `Simpan Perubahan`
- `Verifikasi Laporan`
- `Minta Klarifikasi`
- `Tandai Selesai`

---

# 26. Motion

Motion exists to explain state change, not to impress.

- hover transition: 120–160ms,
- dropdown/popover: 120–180ms,
- drawer: 200–240ms,
- route transition: optional 160–220ms fade only,
- no staggered KPI entrance animation in routine admin pages,
- no bouncing icons,
- respect `prefers-reduced-motion`.

Use CSS transitions and respect reduced motion. No motion dependency is installed or required.

---

# 27. Accessibility

Minimum:

- WCAG AA text contrast,
- keyboard-visible focus,
- 44px minimum interactive height,
- status never color-only,
- icon-only button has `aria-label`,
- table uses semantic `<table>` markup,
- forms use `<label>` / descriptions / errors,
- modal traps focus and returns focus on close,
- charts have textual summaries,
- toast messages do not contain the only copy of critical information.

Focus ring:

```css
outline: none;
box-shadow: 0 0 0 3px rgba(244,196,48,.30);
```

---

# 28. Responsive Behavior

## >= 1280px

- full 256px sidebar,
- 12-column grid,
- 32px content padding,
- main dashboard 8/4 split.

## 1024–1279px

- sidebar remains or may collapse to 72px icon rail,
- content padding 24px,
- search controls can wrap.

## 768–1023px

- sidebar becomes drawer,
- 2-column KPI grid,
- charts full width,
- table horizontal scroll.

## < 768px

- single column,
- 16px content padding,
- topbar simplified,
- KPI cards 1–2 columns depending on width,
- filters move into drawer,
- sticky bottom primary action is allowed for citizen flows,
- admin tables prioritize ticket/title/status/action.

---

# 29. Page Archetypes

## 29.1 Government Dashboard

Above the fold:

1. page header,
2. service search module,
3. 4 KPI cards,
4. 8/4 grid:
   - weekly reports chart,
   - `Butuh Tindakan` queue.

Below:

5. latest reports table,
6. AI activity / audit summary.

## 29.2 Report List

- page header + count,
- large search/filter module,
- status tabs,
- table,
- pagination.

## 29.3 Report Detail

Main 8 columns:

- report title + official status,
- citizen description,
- attachments,
- location/map,
- timeline,
- operator notes.

Right 4 columns:

- assigned officer,
- priority,
- AI summary/recommendation,
- actions,
- audit metadata.

## 29.4 Request Queue

Same visual grammar as reports, but explicitly mark approval-gate actions.

## 29.5 Knowledge Base

DJKI-like search-first layout is especially appropriate:

- prominent query input,
- service/category selector,
- search button,
- result list with source/version/last-updated metadata.

## 29.6 Citizen Dashboard

Simplify significantly:

- status summary,
- `Buat Laporan` / `Ajukan Layanan`,
- my active tickets,
- track by ticket number,
- help/ASK entry.

Do not expose admin-style analytics to citizens.

---

# 30. Dashboard Composition — Canonical

Future reference composition only. Current implementation opens `/reports` and does not add KPI, charts, export, SLA or aggregate data.

```text
┌───────────────────────────────────────────────────────────────────┐
│ PELAYANAN DESA                                        [Export]    │
│ Dashboard                                                         │
│ Pantau laporan warga dan tindak lanjut hari ini.                  │
├───────────────────────────────────────────────────────────────────┤
│ CARI DATA PELAYANAN                                               │
│ [Nomor tiket / nama / kata kunci ] [Status] [Kategori] [ CARI ]   │
├──────────────┬──────────────┬──────────────┬──────────────────────┤
│ Laporan Baru │ Verifikasi   │ Diproses     │ Selesai Minggu Ini   │
│ 24           │ 8            │ 17           │ 46                   │
├───────────────────────────────────┬───────────────────────────────┤
│ Laporan & Penyelesaian            │ Butuh Tindakan                │
│ [weekly bar/line chart]            │ 8 verifikasi                  │
│                                   │ 3 klarifikasi                 │
│                                   │ 2 SLA mendekati batas         │
├───────────────────────────────────┴───────────────────────────────┤
│ Laporan Terbaru                                                   │
│ [table]                                                           │
└───────────────────────────────────────────────────────────────────┘
```

---

# 31. Tailwind CSS v4 Tokens

Replace the current slate/sky primary theme with semantic variables.

Recommended `@theme` direction:

```css
@theme {
  --font-sans: "Plus Jakarta Sans", system-ui, sans-serif;
  --font-heading: "Plus Jakarta Sans", system-ui, sans-serif;

  --color-primary: #f4c430;
  --color-primary-foreground: #17233f;

  --color-brand-navy-950: #17233f;
  --color-brand-navy-900: #213458;
  --color-brand-navy-800: #2b416a;
  --color-brand-navy-700: #39527e;

  --color-brand-yellow-500: #f4c430;
  --color-brand-yellow-600: #ddaf1e;
  --color-brand-yellow-100: #fff7d6;
  --color-brand-yellow-50: #fffbef;

  --color-background: #f7f8fa;
  --color-foreground: #172033;
  --color-card: #ffffff;
  --color-border: #e3e7ed;
  --color-input: #d2d8e1;

  --radius-sm: 0.25rem;
  --radius-md: 0.375rem;
  --radius-lg: 0.5rem;
}
```

### Important implementation rule

Do not scatter hardcoded navy/yellow values throughout components. Components should consume semantic classes such as:

- `bg-primary`
- `text-primary`
- `bg-brand-yellow-500`
- `border-border`
- `bg-card`
- `text-muted-foreground`

Use status mappings separately from brand tokens.

---

# 32. Component Recipes

## Primary Search Button

```tsx
<button className="h-11 px-5 rounded-sm bg-brand-yellow-500 hover:bg-brand-yellow-600 text-brand-navy-950 font-semibold transition-colors">
  Cari
</button>
```

## Section Card

```tsx
<section className="bg-card border border-border rounded-md shadow-[0_1px_2px_rgba(23,32,51,.04)]">
  <header className="px-5 py-4 border-b border-border">...</header>
  <div className="p-5">...</div>
</section>
```

## Active Sidebar Item

```tsx
<Link className="relative flex h-11 items-center gap-3 px-3 rounded-sm bg-white/10 text-white">
  <span className="absolute left-0 inset-y-2 w-[3px] rounded-r bg-brand-yellow-500" />
  <LayoutDashboard className="size-[18px] text-brand-yellow-500" />
  <span className="font-semibold">Dashboard</span>
</Link>
```

## Status Badge

```tsx
<span className="inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-[11px] font-semibold">
  <span className="size-1.5 rounded-full" />
  Diproses
</span>
```

---

# 33. Current Repo → New System Migration

The current LaporPak frontend uses Next.js 16 App Router, React 19, TypeScript, Tailwind CSS 4, Lucide and Base UI/shadcn-style components with a dedicated reports layout. The polish should therefore be a **design-token and component refactor**, not a rewrite.

## Phase 1 — Foundation

1. Replace slate/sky primary tokens with navy/yellow system.
2. Consolidate typography to Plus Jakarta Sans.
3. Reduce global radius.
4. Remove gradients/glow/glass utilities from admin surfaces.
5. Create semantic status tokens.

## Phase 2 — Shell

1. Rework `app/reports/layout.tsx` sidebar to navy.
2. Add yellow active marker.
3. Keep topbar white.
4. Normalize navigation item height/padding.
5. Simplify user/profile card.

## Phase 3 — Dashboard

1. Replace six multicolor KPI cards with four white KPI cards.
2. Add large search-first service module.
3. Promote weekly received-vs-resolved chart.
4. Add `Butuh Tindakan` queue.
5. Move secondary summaries below fold.

## Phase 4 — Tables and forms

1. Normalize all table headers/row heights.
2. Standardize status badges.
3. Replace overly rounded controls.
4. Normalize forms to 40–44px height.
5. Add consistent focus ring.

## Phase 5 — AI surfaces

1. Add one reusable AI Recommendation Card.
2. Add low-confidence warning.
3. Add manual-mode banner.
4. Make AI label distinct from official status.

---

# 34. What to Remove From the Current Visual Language

Do not carry these patterns into polished admin pages:

- red/coral as brand primary,
- strong mesh gradients,
- glass / glass-dark / glass-card effects,
- glow-primary / glow-accent,
- large blurred decorative circles,
- rainbow KPI card accents,
- heavy staggered page-load animations,
- extra-bold / black display weights everywhere,
- 12–20px card radii,
- marketing-style dashboard styling.

These can remain selectively on marketing/landing pages only if intentionally redesigned later, but they should not define the government operations UI.

---

# 35. Design QA Checklist

Before merging any UI change, verify:

- [ ] White is still the dominant canvas.
- [ ] Navy carries hierarchy and institutional identity.
- [ ] Yellow is used sparingly and meaningfully.
- [ ] Primary action is obvious.
- [ ] Status is understandable without color alone.
- [ ] AI content is visibly labeled as AI-assisted.
- [ ] Consequential decisions have a human action.
- [ ] Card radii are <= 8px.
- [ ] Shadows are subtle.
- [ ] No glass/blur decorative effect on operational UI.
- [ ] Search/filter interaction is prominent on list pages.
- [ ] Table density remains usable.
- [ ] Mobile preserves ticket/title/status/action.
- [ ] Keyboard focus is visible.
- [ ] Copy is concise Indonesian.
- [ ] No unnecessary English labels.

---

# 36. Codex Implementation Instruction

When this file is supplied as context to Codex, use the following directive:

> Refactor the existing LaporPak UI using `docs/design-system.md` as the visual source of truth. Preserve existing routing, API calls, auth behavior, data models, business logic, and accessibility semantics unless a UI requirement explicitly requires a change. Prefer refactoring shared tokens/components before page-specific styling. Do not introduce a second UI library. Reuse Tailwind CSS v4, Lucide React and Base UI/shadcn-style components, and existing hooks. Remove red/coral brand styling, gradients, glass effects, heavy shadows, excessive radius, and marketing-like motion from dashboard/admin surfaces. Implement navy + yellow institutional visual hierarchy, search-first data discovery, compact status components, and explicit AI-assistance patterns. Ensure responsive behavior and WCAG AA contrast.

---

# 37. Final Visual Rule

If a proposed component looks like a trendy SaaS dashboard, simplify it.

If it looks like a clear, modern Indonesian public-service interface that prioritizes search, service status, human authority, and trustworthy information, it is aligned with LaporPak.


## Latar halaman autentikasi

Halaman login, undangan, pengaturan kata sandi, dan akses ditolak memakai
latar navy dengan pola chevron tonal serta gelombang statis menuju latar
terang, mengikuti referensi SP4N LAPOR yang diberikan pengguna. Aksen kuning
tetap pada garis atas dan tombol utama. Form tetap pada panel putih solid.
Pola dibuat dengan SVG dekoratif lokal, `aria-hidden`, tanpa animasi, request
gambar, atau JavaScript client tambahan. Pengecualian dekoratif ini khusus
halaman auth; dashboard operasional tetap menggunakan permukaan sederhana.

## Feedback tindakan

Setiap tindakan memperlihatkan keadaan sedang diproses, berhasil, gagal, atau
perlu diperiksa kembali dengan langkah berikutnya yang jelas.

- Tombol mengubah label dan terkunci selama request yang sama berjalan.
- Setelah delapan detik tampilkan `Masih diproses…`; jangan membuat persentase
  jika backend tidak menyediakan progress.
- Toast sukses tampil lima detik, dapat ditutup, maksimal tiga, dan berhenti
  menghitung waktu saat mendapat hover atau fokus. Kesalahan penting tetap
  terlihat dekat tindakan.
- Gunakan `role="status"` untuk informasi biasa dan `role="alert"` untuk
  kesalahan yang perlu perhatian. Hindari pengumuman ganda.
- Timeout mutasi berarti hasil belum diketahui. Periksa resource terbaru dan
  jangan mengulang mutasi secara otomatis.
- Pertahankan data terakhir saat refresh gagal dan tandai bahwa tampilannya
  mungkin belum mutakhir.
- Keputusan administratif, pencabutan dokumen, penonaktifan knowledge, dan
  pemutusan WhatsApp memakai dialog yang menyebut objek dan konsekuensinya.

Tenggat standar adalah 15 detik untuk pembacaan, 30 detik untuk mutasi, 60
detik untuk upload/download, dan 90 detik untuk QR. Polling berjalan satu
request pada satu waktu, dijeda saat tab tersembunyi, lalu berhenti setelah dua
menit dan menyediakan pemeriksaan manual.
