# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

ABC CRM: French-language, mobile-first, offline-capable PWA CRM for a bureau d'étude / consulting company (ABC Consulting). Not a generic SaaS dashboard — calm, structured, corporate UI is a hard requirement, not a preference.

`AGENTS.md` is the governing product/design/architecture spec — read it before frontend or architecture work. `blueprint.md` is the approved production technical architecture and must stay aligned with `AGENTS.md` (if they drift, fix the older doc before adding features). `docs/product/ORIGINAL_SCOPE_RECOVERY.md` tracks the original-brief completion gate and should be closed before broader offline/production-hardening work.

## Commands

Monorepo: pnpm workspaces + Turborepo. Node 22.x, pnpm 9.15.0 (see `packageManager`/`engines` in package.json).

```bash
pnpm install
cp .env.example .env
pnpm db:generate      # prisma generate (packages/db)
pnpm dev              # turbo dev — runs all apps (web:3000, api:4000)
pnpm build            # turbo build
pnpm lint             # turbo lint
pnpm typecheck        # turbo typecheck
pnpm format           # prettier --write .
pnpm db:migrate       # prisma migrate dev
pnpm db:deploy        # prisma migrate deploy
pnpm db:studio        # prisma studio
pnpm seed:admin       # seed admin user (apps/api)
```

Per-package (via `pnpm --filter <name> <script>`, e.g. `pnpm --filter @abc/web lint`):
- `@abc/web` (apps/web): `dev`, `build`, `lint`, `typecheck` — no test script defined yet.
- `@abc/api` (apps/api): `dev`, `build`, `lint`, `typecheck`, `seed:admin`, `push:generate-keys` — no test script defined yet.
- `@abc/db` (packages/db): `prisma:generate`, `prisma:migrate`, `prisma:deploy`, `prisma:studio`.
- `@abc/shared` (packages/shared): `build`, `lint`, `typecheck`.

There is no test runner configured in this repo yet — don't assume Jest/Vitest exist; check `AGENTS.md`'s production scope (unit/integration/accessibility/offline/Playwright tests are listed as in-scope but not yet wired up).

`apps/web` build/dev depends on `@abc/shared` being built first (see its `dev`/`build` scripts) — after changing `packages/shared`, rebuild it before expecting web/api to pick up changes.

## Architecture

### Monorepo layout
```
apps/web       Next.js App Router PWA frontend (port 3000)
apps/api       NestJS REST API under /api/v1 (port 4000)
packages/db    Prisma schema/client (packages/db/prisma/schema.prisma is the authoritative data model)
packages/shared  shared constants, domain types, Zod schemas — the only place domain types may live
docs           product/architecture/design/execution notes (docs/product/ has scope + audit docs)
```

Hard boundary (enforced, not just convention): `apps/web` has no business logic and no direct Supabase access — everything goes through the NestJS API. `apps/api` owns all business logic, auth, Supabase service-role access, and file validation. The Supabase service-role key must never reach `apps/web`. Shared domain types/enums/Zod schemas live only in `packages/shared`; never duplicate domain types between frontend and backend, and prefer reusing the same Zod schema for both backend validation and frontend form validation (React Hook Form + zod resolver).

### Stack per layer
- Web: Next.js App Router, React 19, Tailwind (semantic tokens only, no ad-hoc hex), shadcn/Radix, Lucide icons, TanStack Query for server state, React Hook Form + Zod, FullCalendar for the calendar.
- Offline: Dexie over IndexedDB (`apps/web/src/lib/offline`) + Serwist PWA caching; queued mutations sync via `/sync/batch`.
- API: NestJS, one module per domain under `apps/api/src/` (`auth`, `clients`, `consultants`, `missions`, `ordre-mission`, `templates`, `users`, `files`, `notifications`, `sync`, `health`), each with controller/service/module.
- Auth: Argon2 password hashes, short-lived JWT access cookies (HTTP-only), rotating opaque refresh sessions, CSRF protection.
- Database: Supabase PostgreSQL via Prisma, accessed only from `apps/api`.
- Files: private Supabase Storage, accessed only through NestJS (protected routes / server-side signed URLs); validation (type, size) is backend-only, never frontend-only.
- Exports: Playwright-driven Chromium for PDF, ExcelJS for XLSX, streamed CSV.

### Core domain model
Prisma models (see `packages/db/prisma/schema.prisma`): `User`, `Session`, `PasswordResetToken`, `Client`, `ClientPersonnel`, `ClientDocument`, `ClientConsultant`, `Consultant` (optional `userId` — a consultant profile can exist without a login account), `Mission`, `MissionConsultant`, `OrdreMission`, `OrdreMissionConsultant`, `OrdreMissionTemplate`, `OrdreMissionReferenceCounter`, `File`, `ActivityLog`, `SyncMutation`, `SyncConflict`.

Key invariants:
- Fiscal numbers are globally unique; archived records stay available for history/restore.
- Mutable operational records carry optimistic-lock versions.
- Mission creation and its ordre creation happen in one DB transaction; ordre references are generated transactionally as `ODM-YYYY-NNNN`.
- Editing a mission updates its linked draft ordre; validated/printed ordres are flagged for review instead of silently changed. Cancelling a mission cancels draft ordres and flags validated/printed ones for confirmation.

Roles: `ADMIN` (full admin), `RESPONSABLE` (plan missions, assign consultants, validate ordres, resolve conflicts), `CONSULTANT` (read assigned data, field workflows), `VIEWER` (read-only).

### Calendar is the single top-level mission-planning surface
`/calendar` (web) is the only top-level mission workspace — do not create a competing mission register page, and the bottom mobile nav must not expose a separate "Missions" tab. `/missions` redirects to calendar for compatibility only. Mission detail/create remain at `/missions/:id` and `/missions/nouvelle`. Working days are Monday–Saturday; Sunday is hidden from planning views. Desktop uses FullCalendar with drag-and-drop; mobile uses a compact agenda with full action parity (phone week view intentionally not exposed).

### Currently disabled surfaces
Ordres de mission and templates: backend contracts (`/ordres-mission/*`, `/templates/*`) remain implemented and documented in `blueprint.md`, but the web UI/routes for both are intentionally disabled (`/ordres-mission` web routes 404) pending scope reactivation — don't "fix" this by re-enabling the routes without checking `docs/product/ORIGINAL_SCOPE_RECOVERY.md` / `MVP_SCOPE.md` first.

### API surface
All endpoints prefixed `/api/v1`. Full route list (auth, clients, consultants, missions/calendar, ordres-mission, templates, sync) is documented in `blueprint.md` — read it before adding or changing endpoints rather than re-deriving routes from controllers alone, since the disabled/reactivation status of a route isn't obvious from code.

## Design system (non-negotiable, not just style preference)

Full detail is in `AGENTS.md`; the essentials that affect implementation decisions:

- Brand palette is a fixed token set (`Primary #125885`, `Primary-dark`, `Primary-light`, `Neutral` shades, `Background`, `Surface`, `Border`, `Success`/`Warning`/`Danger`) — no ad-hoc hex anywhere. The only runtime-computed color allowed is a persisted per-client accent used to identify that client's calendar events.
- Mobile-first always: design from 375px up, full functional parity on mobile (no desktop-only features), primary CTAs reachable one-thumb at the bottom, sticky Save/Cancel bar on long mobile forms. Desktop: persistent collapsible 240px sidebar, content max-width 960px for forms/detail (full-width for tables).
- 8px spacing grid only (4/8/12/16/24/32/48px) — no arbitrary spacing values.
- Every data table needs: search, filters, sort, pagination (20/50/100 + total count), skeleton loading rows, empty state (icon + message + primary action, no illustrations), row actions, contextual bulk-action bar, CSV/PDF export in the toolbar, and column visibility if >6 columns.
- Every screen must define and implement all five states: loading (skeleton matching real layout), empty, error (message + retry), offline (banner, disable writes), and any domain-specific states (e.g. conflict, forbidden) — don't ship a screen missing one of these.
- Never use a modal for navigation (opening a page inside a modal); modals only for focused tasks (confirm delete, quick single-field edit, document preview).
- PDF export is always server-side (Playwright/Chromium) — never rely on browser print-to-PDF as the primary export mechanism.

## Agent workflow expectations (from AGENTS.md)

At the start of a task: check available skills, prefer specialized skills for frontend building/accessibility/shadcn/React/Supabase/API design/browser QA, and run browser QA after meaningful frontend changes. For each new feature, implement in order: Prisma migration → backend DTO/service/controller/validation → shared Zod schema/types → frontend API client + React Query hooks → list page → create/edit form → detail page → all screen states → tests/validation. Prefer complete vertical slices over disconnected UI shells.
