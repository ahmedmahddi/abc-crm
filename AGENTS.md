# ABC CRM — Codex Agent Instructions

## Product intent

Build a clean, elegant, maintainable PWA CRM for a bureau d'étude / consulting company.
The first modules are custom auth, clients, consultants, missions/calendar, and ordres de mission.

---

## Source of truth

- This file defines the product, design and implementation rules.
- `blueprint.md` records the production architecture and must stay aligned with this file.
- `docs/product/ORIGINAL_SCOPE_RECOVERY.md` tracks the original-brief completion gate.
- When an older document conflicts with this file, update the older document before implementing more code.
- The only permitted runtime color outside the static design tokens is a persisted client accent used to identify that client's calendar events.
- Close the original-brief recovery gate before prioritizing broader offline and production-hardening work.

---

## Brand palette

Use these tokens exclusively. No ad-hoc hex values anywhere in the codebase.

```
Primary:        #125885
Primary-dark:   #0E476C
Primary-light:  #EAF2F7
Neutral:        #BDC3C7
Neutral-dark:   #7A868F
Neutral-light:  #E7EBEE
Background:     #F7F9FB
Surface:        #FFFFFF
Text:           #0F1720
Border:         #D9E0E4
Success:        #1F7A5A
Warning:        #C48A1A
Danger:         #C44545
```

---

## Design principles

The interface must feel like professional business software. Not a startup dashboard. Not a generic SaaS template. A calm, structured tool that people use at a desk to do serious work.

**What this means in practice:**

- Structure, spacing, and typography carry the visual weight — not decoration.
- Contrast is calm. No neon, no heavy shadows, no gradients.
- Every pixel of color is intentional. Use the palette token; justify any deviation.
- Information density is appropriate — not sparse and airy, not overloaded.
- Actions are always visible and reachable. No hidden menus for primary operations.

**What to actively reject:**

- Random gradients, glassmorphism, blurred backgrounds, drop shadows used decoratively.
- Huge icons, icon-forward hero sections, decorative illustrations.
- KPI grids and chart dashboards on every screen regardless of whether the data warrants it.
- Fake or placeholder business data in shipped UI shells.
- Copied SaaS layouts (Notion, Linear, Vercel) that don't match the bureau d'étude workflow.

---

## UI/UX rules

### Layout and responsiveness

- **Mobile-first, always.** Start every screen at 375px width. Enhance for tablet (768px) and desktop (1280px).
- Mobile must provide full functional parity with desktop — no features hidden behind "desktop only."
- On mobile, use compact list rows or stacked cards. Introduce tables only at tablet width and above.
- Phone actions must be reachable with one thumb. Place primary CTAs at the bottom of the screen.
- Long forms use a sticky action bar (Save / Cancel) fixed to the bottom on mobile.
- Desktop layouts use a persistent left sidebar (240px, collapsible to icon rail). Content area is never wider than 960px for forms and detail pages; full-width for tables.

### Navigation

- Sidebar items: icon + label. Active state uses `Primary-light` background with `Primary` text and a 3px left border accent.
- Mobile navigation: bottom tab bar (max 5 items). Overflow items go into a "More" sheet.
- The bottom navigation must not expose a separate `Missions` tab. Mission planning lives under `Calendrier`; mission creation and detail pages are secondary routes.
- Breadcrumbs appear on all detail and sub-pages. Format: `Clients / Giovani Confection / Contrats`.
- Never use modal navigation (opening a page inside a modal). Use modals only for focused tasks: confirm delete, quick-edit a single field, preview a document.

### Typography

- Use a single sans-serif typeface throughout. Size scale: 12 / 14 / 16 / 20 / 24px.
- Page titles: 20px, weight 600, `Text` color.
- Section headings within a page: 14px, weight 600, `Neutral-dark` color, uppercase tracking.
- Body / table cells: 14px, weight 400, `Text` color.
- Secondary / metadata: 12px, weight 400, `Neutral-dark` color.
- Never mix more than two weights on a single screen.

### Color usage

- `Primary` (#125885): primary buttons, active navigation, links, focus rings.
- `Primary-light` (#EAF2F7): active nav background, selected row highlight, info banners.
- `Background` (#F7F9FB): page background. `Surface` (#FFFFFF): cards, panels, modals, table rows.
- `Border` (#D9E0E4): all dividers, table row separators, input borders.
- `Success / Warning / Danger`: status badges and inline validation only. Never use as background fills for large areas.
- `Neutral-dark` (#7A868F): secondary labels, placeholders, disabled text.

### Spacing

Use an 8px base grid. Allowed values: 4 / 8 / 12 / 16 / 24 / 32 / 48px.
No arbitrary values (e.g. `margin: 13px` or `padding: 22px`). If a value is not in the scale, reconsider the layout.

### Tables

Every data table must include all of the following:

- **Search**: debounced text input filtering across relevant columns.
- **Filters**: dropdown or chip filters for categorical columns (status, type, date range).
- **Sort**: clickable column headers with visual sort direction indicator.
- **Pagination**: page size selector (20 / 50 / 100) and page navigation. Show total record count.
- **Loading state**: skeleton rows (same height as real rows) while data fetches. No spinner centered over the table.
- **Empty state**: illustration-free. Icon + short message + primary action. Example: "Aucun client trouvé — Ajouter un client".
- **Row actions**: appear on hover (desktop) or always visible (mobile). Include Edit and Archive at minimum.
- **Bulk actions**: appear in a contextual bar above the table when rows are selected. Never in a dropdown buried in a menu.
- **Export**: CSV and/or PDF. Button in the table toolbar, not a buried settings page.
- **Column visibility**: optional for tables with more than 6 columns.

### Forms

- Split long forms into named sections separated by a `<hr>` or section heading. Do not use wizard steps unless the form has more than 4 distinct sections and a clear sequential dependency.
- Field labels always above the input, never placeholder-only.
- Required fields marked with an asterisk (\*) and a legend at the top of the form.
- Inline validation: show errors on blur, not only on submit.
- On submit failure, scroll to the first error field and focus it.
- Never clear form data after a validation failure.
- File upload fields: show accepted types (`PDF, DOCX — max 10 Mo`) and a drag-and-drop target. On upload, show a progress indicator then a file chip with name, size, and a remove button.
- Read-only fields in edit mode: use a muted input (no border, `Background` fill) not a plain `<span>`.

### Status and feedback

- **Toast notifications**: bottom-right on desktop, top on mobile. Auto-dismiss after 4s. Types: success (green), warning (amber), error (red), info (blue). Always include a close button.
- **Inline errors** on form fields: red border + error message below the field. Never use alert dialogs for form errors.
- **Confirmation dialogs**: required for all destructive actions (delete, archive, revoke). Title states the action. Body explains the consequence. Confirm button uses `Danger` color. Cancel is the default focus target.
- **Progress**: use a top progress bar (not a spinner) for full-page loading transitions. Skeleton screens for data loading within a page.
- **Optimistic UI**: apply state changes immediately for low-risk actions (toggle active/inactive, reorder). Roll back with an error toast on failure.

### States (required on every screen)

Every screen must account for all of these. Shipping a screen without them is incomplete.

| State     | Requirement                                               |
| --------- | --------------------------------------------------------- |
| Loading   | Skeleton UI matching the real layout                      |
| Empty     | Icon + message + primary action                           |
| Error     | Error message + retry action                              |
| Offline   | Banner indicating no connection, disable write actions    |
| Conflict  | Show a diff and let the user choose which version to keep |
| Forbidden | Explain why access is denied, link to request access      |

### Accessibility

- All interactive elements must have a visible focus state (2px `Primary` outline, 2px offset).
- Color alone must never convey meaning. Always pair color with an icon or text label (e.g. status badges).
- Form inputs must have associated `<label>` elements (not just `aria-label`).
- Tables use proper `<th scope="col">` headers.
- Modals trap focus and return it to the trigger on close.
- Minimum touch target size: 44×44px.
- All icon-only buttons have an `aria-label`.

### Print and export

- Ordres de mission and other generated documents must have a print stylesheet. Hide sidebar, nav, and action buttons. Use black text on white. Preserve table borders.
- PDF export is generated server-side. Never use browser print-to-PDF as the primary export mechanism.

---

## Component patterns

### Cards

Used for: contact summaries, mission summaries, document previews.
Structure: white surface, 1px `Border` border, 8px radius. Header with title + badge + action menu. Body with key fields in a 2-column grid. Footer with metadata (created date, last modified).

### Badges / Status chips

Compact, inline. Text label + optional leading icon. Size: 12px text, 4px vertical padding, 8px horizontal padding. Use semantic tokens for color. Never use raw hex.

```
Active    → Success background / Success text
Archivé   → Neutral-light / Neutral-dark
En cours  → Primary-light / Primary
Brouillon → Warning-light / Warning
```

### Action menus (⋯ menus)

Use a popover, not a native `<select>`. Max 6 items. Destructive items at the bottom, separated by a divider, in `Danger` color. Close on outside click and Escape key.

### Empty states

No illustrations. Use a single Tabler outline icon at 32px, `Neutral` color. Short sentence in 14px `Neutral-dark`. One primary action button below. Center vertically in the available space.

### Skeleton loaders

Match the real component layout exactly: same height rows, same column proportions. Use a single `Background` to `Neutral-light` shimmer animation. Do not use generic centered spinners for content areas.

---

## Screen-by-screen UX requirements

For each new screen, the agent must define and implement:

1. **User role**: who uses this screen and in what context.
2. **Primary action**: the single most important thing a user does here.
3. **Mobile behavior**: how the layout changes at 375px.
4. **All five states**: loading, empty, error, offline, and any domain-specific states.

Do not ship a screen without this checklist complete.

---

## Code rules

- Strict TypeScript throughout.
- Shared types live in `packages/shared`. Never duplicate domain types across apps.
- Backend validation is mandatory (Zod schemas on all API inputs).
- Frontend validation mirrors backend schemas — use the same Zod schema when possible.
- No magic colors, no arbitrary spacing values, no one-off components without justification.
- Keep files focused. A file doing more than one thing is a smell.
- No duplicated domain logic between frontend and backend.

---

## Architecture rules

- `apps/web`: frontend only. No business logic. No direct Supabase access.
- `apps/api`: owns all business logic, auth, Supabase service role access, and file validation.
- `packages/db`: Prisma schema and generated client.
- `packages/shared`: shared constants, enums, and Zod schemas.
- Supabase service role key must never be exposed to the frontend under any circumstances.
- All private file access goes through protected backend routes or server-side signed URLs.
- File validation (type, size, malware scan) happens on the backend, not the frontend.

---

## Production scope

### In scope

- Custom auth (login, session management, role-based access)
- Clients: CRUD, persisted accent color, responsible consultants, cadre contacts, legal document uploads, CSV/PDF export
- Baseline personnel extraction from uploaded organigramme images or PDFs, with a review step before extracted personnel are stored
- Consultants: CRUD, linked accounts and availability context
- Calendar: mission planning with drag-and-drop scheduling
- Ordres de mission: auto-generated from missions, list / edit / export / print
- Reusable ordre de mission templates
- Mobile-first operational home
- Archives and restore flows
- User, role, session and account-disable administration
- Audit history
- Settings and default-template management
- Offline Dexie cache, queued mutations and encrypted upload staging
- Batch synchronization and manual conflict resolution
- Serwist PWA caching and reconnect/app-resume retry
- Pino logs, request IDs, Sentry, health checks and uptime monitoring
- CI, staging, deployment, rollback and backup documentation
- Unit, integration, accessibility, offline and Playwright browser tests

### Deferred until explicitly requested

- Advanced OCR automation beyond the required baseline organigramme personnel extraction and review workflow
- Push notifications
- Google Calendar synchronization
- Email delivery
- Invoicing / facturation

---

## Implementation order

Prefer complete vertical slices. Do not build disconnected UI shells.

For each feature, implement in this order:

1. Database model (Prisma migration)
2. Backend: DTO / service / controller / validation
3. Shared types and Zod schemas
4. Frontend: API client + React Query hooks
5. List page (with all table requirements)
6. Create / edit form (with all form requirements)
7. Detail page (if relevant)
8. All screen states (loading, empty, error, offline)
9. Tests or explicit validation paths

## Calendar architecture

- The calendar is the only top-level mission planning workspace.
- Do not create a competing top-level mission register page.
- Use `/calendar` for week, month and mobile agenda views.
- Company working days are Monday through Saturday. Calendar planning must hide Sunday unless a future requirement explicitly changes the work week.
- Mission mode has its own semantic treatment: `Présentielle` and `En ligne` must be visually distinct by token-based color and text label. Client accent remains a separate business identifier.
- Use `/missions/:id` for a mission detail sheet and `/missions/nouvelle` for creation.
- Desktop planning uses FullCalendar with drag-and-drop. Mobile uses a compact agenda with full action parity.

---

## Agent quality workflow

At the start of each task:

1. Inspect available skills. Select the smallest relevant set.
2. Announce selected skills and the reason each applies.
3. Read each selected `SKILL.md` before planning or writing any code.
4. Prefer specialized skills for: frontend building, accessibility, shadcn composition, React patterns, Supabase, API design, browser QA.
5. After meaningful frontend changes, run browser QA.
6. When skipping an obvious skill, state the reason explicitly.
