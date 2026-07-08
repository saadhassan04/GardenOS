# GardenOS — UI Guidelines & Design System

**Document status:** Living document · 2026-07-09
**Rule:** Every visual value in code comes from a design token defined here (implemented as CSS custom properties in `styles/tokens.css`). No raw hex/px values in component CSS.

---

## 1. Design Language

**"Calm greenhouse."** GardenOS is used in the garden — bright sun, wet hands, one thumb — and in the evening on the couch reviewing photos. The interface must be:

- **Quiet:** content (plants, photos) is the hero; chrome recedes. Generous whitespace, minimal borders, muted surfaces.
- **Fast to act on:** the most common actions (log watering, snap photo, check tasks) are always ≤ 2 taps from anywhere.
- **Honest:** real data, real states. Empty states teach; loading states are skeletons, never spinners > 300 ms; destructive actions always confirm.
- **Organic but precise:** botanical warmth (greens, soft radii, photography) on a disciplined grid.

## 2. Color Palette

Dark theme is the **default** (outdoor OLED, evening use). Light theme is fully supported; auto follows the OS.

### Dark theme (default)
| Token | Value | Use |
|---|---|---|
| `--color-bg` | `#0F1511` | App background (near-black green) |
| `--color-surface` | `#171F19` | Cards, sheets |
| `--color-surface-2` | `#1F2922` | Raised elements, inputs |
| `--color-border` | `#2C3A30` | Hairlines, dividers |
| `--color-text` | `#E8EFE9` | Primary text |
| `--color-text-muted` | `#9DB0A2` | Secondary text, labels |
| `--color-primary` | `#4CAF6D` | Actions, links, active nav |
| `--color-primary-strong`| `#66C285` | Hover/pressed, emphasis |
| `--color-accent` | `#D9A441` | Highlights, harvest, sun |
| `--color-info` | `#4E9DD3` | Water, info states |
| `--color-warning` | `#E0A83A` | Due soon, quota warnings |
| `--color-danger` | `#E06052` | Overdue, destructive, pests |
| `--color-success` | `#5DBB7F` | Confirmations, healthy |

### Light theme
Same token names remapped: bg `#F6F8F4`, surface `#FFFFFF`, surface-2 `#EDF2EC`, border `#D8E2D8`, text `#1C2620`, text-muted `#5B6B5E`, primary `#2E7D4F`, accent `#B8860B`, info `#2678B0`, warning `#B07E1E`, danger `#C0392B`, success `#2F9E5F`.

### Semantic care colors (both themes, used on chips/icons/charts)
watering = info-blue · fertilizing = accent-gold · pruning/deadheading = neutral · pests/treatment = danger-red · harvest = accent · growth/health = primary-green.

**Contrast:** every text/background pair ≥ 4.5:1 (AA); large text & icons ≥ 3:1. Verified per release.

## 3. Typography

System font stack (free, instant, native feel):
`--font-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Noto Sans", sans-serif` · `--font-mono` for data/diagnostics.

| Token | Size / line | Weight | Use |
|---|---|---|---|
| `--text-display` | 28 / 34 | 700 | Page titles |
| `--text-title` | 22 / 28 | 600 | Section headers, dialog titles |
| `--text-heading` | 17 / 24 | 600 | Card titles, plant names |
| `--text-body` | 15 / 22 | 400 | Default |
| `--text-small` | 13 / 18 | 400 | Metadata, timestamps |
| `--text-caption` | 11 / 14 | 500 CAPS | Labels, chips |

Rules: user-adjustable base size (Settings) scales the whole ramp via `rem` · line length ≤ 70ch · numbers in analytics use `font-variant-numeric: tabular-nums`.

## 4. Spacing, Layout & Grid

- **4 px base unit.** Scale: `--space-1..8` = 4, 8, 12, 16, 24, 32, 48, 64.
- Screen padding: 16 px mobile, 24 px desktop. Card padding: 16 px. Gap between cards: 12 px.
- **Radii:** `--radius-s: 8px` (inputs, chips) · `--radius-m: 12px` (cards) · `--radius-l: 20px` (sheets, dialogs) · full (FAB, avatars).
- **Elevation:** dark theme uses surface-color steps (not heavy shadows); light theme uses soft shadows `--shadow-1/2`.
- **Breakpoints:** `sm ≥ 480`, `md ≥ 768` (2-col grids, sidebar appears), `lg ≥ 1080` (3-col, persistent detail panes), `xl ≥ 1440`.

## 5. Mobile First / Desktop

**Mobile (primary):**
- Bottom navigation bar, 5 slots: Dashboard · Plants · **＋ Quick Log** (center FAB) · Kitchen Garden · More.
- Quick Log opens a bottom sheet: Water / Fertilize / Photo / Note / Harvest — the 2-tap promise.
- Thumb zone: primary actions in the bottom 60% of screen; destructive actions never adjacent to primary ones.
- Touch targets ≥ 44×44 px; list rows ≥ 56 px; swipe actions on rows (right-swipe = quick water) with visible button equivalents.
- Outdoor legibility: body text ≥ 15 px, strong contrast, no thin weights below 15 px.

**Desktop (≥ md):**
- Left sidebar navigation (icons + labels), content max-width 1200 px centered.
- Master-detail: plant list + selected plant side by side at `lg`.
- Full keyboard support: `/` focus search, `n` new plant, `g d` go dashboard; visible focus rings always.

## 6. Navigation

- Hash routes; every screen deep-linkable; back button always behaves natively.
- Hierarchy: 5 top-level sections → detail screens push with header back-arrow + title.
- "More" hosts: Notes, Gallery, Analytics, Settings, Backup.
- Active section indicated by filled icon + primary color; never color alone (a11y).

## 7. Components

**Cards** — the core surface. PlantCard: cover photo (4:3 thumb), name, category chip, "last watered" freshness dot (green ≤ profile interval, amber approaching, red overdue), overflow menu. Stat cards: big tabular number + caption + trend arrow. All cards: `--radius-m`, surface color, no borders in dark theme.

**Buttons** — variants: `primary` (filled green), `secondary` (tonal surface-2), `ghost` (text only), `danger` (filled red, confirmations only), FAB (56 px, primary). Heights 44/36 px (default/compact). Loading state = inline spinner + disabled, label kept. Icon-only buttons require `aria-label`.

**Forms** — labels always visible above fields (no placeholder-as-label). Inputs on surface-2, 44 px min height, `--radius-s`. Inline validation on blur, error text + icon below field in danger color. Date fields default to *today*, one-tap "yesterday" chip (backdating is common). Steppers for quantities; segmented controls for ≤ 4 options; bottom-sheet pickers on mobile. Every logging form submits with ≤ 1 required field.

**Charts** (canvas, no libraries) — bar, line, heatmap-calendar. Semantic care colors; axis text `--text-small` muted; tabular numerals; empty state = friendly message + "log your first…" CTA; provide data table alternative (a11y). No 3D, no gradients-for-decoration.

**Icons** — single SVG sprite in `assets/icons/`, outline style, 1.5 px stroke, 24 px grid (20 px compact). Care-event icons: 💧 drop (water), leaf-plus (fertilize), pot (repot), scissors (prune), bug (pest), spray (treat), basket (harvest), camera, note. Decorative icons `aria-hidden`; functional icons labeled.

**Feedback** — toasts (bottom, above nav, auto-dismiss 4 s, action slot for **Undo** — bulk logs are undoable via batchId). ConfirmDialog for destructive acts, names the object ("Delete *Black Plumeria* and 214 events?"). Skeletons mirror final layout. Empty states: illustration + one-line explanation + primary CTA.

## 8. Animations

- Purposeful only: state change, spatial orientation, success confirmation. Never decorative loops.
- Durations: micro 120 ms · standard 200 ms · sheets/dialogs 240 ms. Easing `cubic-bezier(0.2, 0, 0, 1)`.
- Animate only `transform` and `opacity` (compositor-friendly; NFR-2 budgets).
- Page transitions: subtle 8 px slide+fade following navigation direction.
- Watering/success micro-moment: checkmark draw-in on log confirmation (150 ms) — the daily dopamine, kept subtle.
- **`prefers-reduced-motion: reduce` → all non-essential motion off** (instant transitions, no draw-ins).

## 9. Dark Theme Rules

- Dark is default; theme applied before first paint (inline script reads LocalStorage) — zero flash.
- Photos pop on dark: galleries use pure `--color-bg`; cards never place large saturated fills behind photos.
- Elevation = lighter surface, not shadow. Desaturate status colors ~10% vs. light theme to avoid glare.
- Test rule: every screen reviewed in both themes before a release ships.

## 10. Accessibility (WCAG 2.1 AA — non-negotiable)

1. Semantic HTML first: real `<button>`, `<nav>`, `<main>`, `<h1-h6>` hierarchy, landmarks; ARIA only where semantics fall short.
2. Full keyboard operability; logical tab order; visible focus ring (`--color-primary-strong`, 2 px, offset 2 px); focus trapped in dialogs and returned on close.
3. Screen readers: every image gets alt (user captions become alt; fallback "Photo of {plant}, {date}"); live regions announce toasts; charts have table equivalents.
4. Color never sole carrier of meaning (dot + label, icon + color).
5. Contrast per §2; touch targets per §5; motion per §8.
6. Forms: labels programmatically associated, errors announced, `autocomplete` where sensible.
7. Language: `lang="en"`; date/number formatting via `Intl` with user locale.

## 11. Content & Tone

Short, concrete, gardener's vocabulary ("Watered 6 plants" not "Operation completed"). Timestamps relative under 7 days ("2 days ago"), absolute after. Sentence case everywhere. Errors say what happened and what to do next. No blame, no jargon, no exclamation-mark spam.
