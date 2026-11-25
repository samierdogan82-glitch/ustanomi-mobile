<!-- sovereign-v16-ui-ux-pro-max -->
# ustanomi-mobile — UI/UX Pro Max Master Design System (`MASTER.md`)

- **Selected Style Profile:** `trust-escrow-marketplace` — **Trust-First Escrow Marketplace (Home Services / Master Verification / Pool)**
- **Source Engine:** `nextlevelbuilder/ui-ux-pro-max-skill` x Sovereign Core v16.0 (`0 Cloud Tokens`)
- **Layout Architecture:** Step-by-step escrow progress tracker (PENDING -> POOL_LOCKED -> IN_PROGRESS -> RELEASED), verified master badge cards, instant quote calculator

## 1. Semantic Color Palette & Surface Hierarchy
| Token | Hex | Role |
| :--- | :--- | :--- |
| `--bg-primary` | `#0A0F1D` | Main application canvas |
| `--bg-surface` | `#111A2E` | Cards, panels, and table containers |
| `--bg-elevated` | `#1A2642` | Modals, drawers, and hover states |
| `--text-primary` | `#F8FAFC` | Primary headings and body copy (WCAG AAA) |
| `--text-muted` | `#94A3B8` | Metadata, captions, and secondary labels (WCAG AA) |
| `--accent-primary` | `#2563EB` | Primary CTA buttons, active states, and focus rings |
| `--accent-secondary` | `#10B981` | Secondary links, info badges, and chart series |
| `--border-subtle` | `#1E2D4A` | 1px structural hairlines and card dividers |

## 2. Typography & Tabular Hierarchy
- **Heading Font:** `'Plus Jakarta Sans', system-ui, sans-serif`
- **Body Font:** `'Inter', system-ui, sans-serif`
- **Monospace / Financial Font:** `'JetBrains Mono', monospace (tabular-nums)`
- **Typographic Scale:** Title 1.5rem/700 | Step Label 0.875rem/600 | Escrow Amount 1.5rem/800 tabular-nums

## 3. Tailwind v4 / CSS Variables Ready Snippet
```css
:root {
  --bg-primary: #0A0F1D;
  --bg-surface: #111A2E;
  --bg-elevated: #1A2642;
  --text-primary: #F8FAFC;
  --text-muted: #94A3B8;
  --accent-primary: #2563EB;
  --accent-secondary: #10B981;
  --border-subtle: #1E2D4A;
}
.tabular-nums { font-variant-numeric: tabular-nums; }
```

## 4. Mandatory Anti-Pattern Shield & WCAG 2.1 AA Rules
- **FORBIDDEN:** Never allow state-mutating payment actions without disabled inflight state & Idempotency-Key
- **FORBIDDEN:** Never expose unmasked customer phone or TCKN in public tracking views
- 1. Semantic Tokens: Use CSS variables / Tailwind @theme tokens (--bg-primary, --bg-surface, --accent-primary) with >= 4.5:1 WCAG AA contrast.
- 2. Tabular Numerals: Enforce font-variant-numeric: tabular-nums on all TRY (₺) currency, KDV, TCKN, date, and KPI counters.
- 3. 4-State Completeness: Every data view must implement Loading (skeleton), Empty (clear CTA), Error (retry button), and Populated states.
- 4. Mobile & iOS Safe-Area: Enforce viewport-fit=cover, env(safe-area-inset-bottom), min-height 44px tap targets, and >=16px input font size.
- 5. Portal & A11y Discipline: Render modals via createPortal(..., document.body), use <button type='button'> for interactive cards, and pair <label htmlFor> with input id.
