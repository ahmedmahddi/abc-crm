# ABC CRM - Production Technical Blueprint

## Authority

`AGENTS.md` is the governing product and design specification. This blueprint describes the approved production architecture. If the two files drift, update this blueprint before adding features.

## Product Boundary

ABC CRM is a French-language, mobile-first, offline-capable operations tool for a bureau d'étude. The calendar is the only top-level mission-planning workspace. It is not a generic dashboard product.

## Stack

| Layer | Technology |
| --- | --- |
| Monorepo | pnpm workspaces and Turborepo |
| Language | Strict TypeScript |
| Web | Next.js App Router, React, Tailwind semantic tokens, shadcn/Radix, Lucide |
| Forms | React Hook Form and shared Zod schemas |
| Server state | TanStack Query |
| Calendar | FullCalendar |
| Offline | Dexie over IndexedDB and Serwist |
| API | NestJS REST under `/api/v1` |
| Database | Supabase PostgreSQL through Prisma |
| Files | Private Supabase Storage accessed through NestJS only |
| Auth | Argon2 password hashes, short-lived JWT access cookies, rotating opaque refresh sessions, CSRF protection |
| Templates | TipTap content sanitized server-side |
| Exports | Playwright Chromium PDFs, ExcelJS XLSX, streamed CSV |

## Roles

| Role | Purpose |
| --- | --- |
| `ADMIN` | Full administration, access management, templates, archives and audit |
| `RESPONSABLE` | Plan missions, assign consultants, validate ordres and resolve operational conflicts |
| `CONSULTANT` | Read assigned operational data and use field workflows |
| `VIEWER` | Restricted read-only access |

Consultant profiles are business records. A profile may exist without a linked login account.

## Core Data Model

The Prisma schema in `packages/db/prisma/schema.prisma` is authoritative. Core records:

- `User`, `Session`, `PasswordResetToken`
- `Client`, `ClientPersonnel`, `ClientDocument`, `ClientConsultant`
- `Consultant`, with optional `userId`
- `Mission`, `MissionConsultant`
- `OrdreMission`, `OrdreMissionConsultant`, `OrdreMissionTemplate`
- `OrdreMissionReferenceCounter`
- `File`, `ActivityLog`, `SyncMutation`, `SyncConflict`

Important invariants:

- Fiscal numbers are globally unique.
- Archived records remain available to history and restore flows.
- Mutable operational records carry optimistic-lock versions.
- Mission creation and its ordre creation happen in one transaction.
- Ordre references are generated transactionally as `ODM-YYYY-NNNN`.
- Editing a mission updates its linked draft ordre. Validated or printed ordres are flagged for review.
- Cancelling a mission cancels draft ordres and flags validated or printed ordres for confirmation.

## API Surface

All endpoints are prefixed with `/api/v1`.

### Auth

```txt
POST /auth/login
POST /auth/logout
POST /auth/refresh
POST /auth/password-reset/request
POST /auth/password-reset/confirm
GET  /auth/me
```

Password reset token creation/confirmation exists. Email delivery for reset links, login throttling and deeper administration remain production-scope work.

### Clients

```txt
GET   /clients
POST  /clients
GET   /clients/:id
PATCH /clients/:id
POST  /clients/:id/archive
POST  /clients/:clientId/documents
```

### Consultants

```txt
GET   /consultants
POST  /consultants
GET   /consultants/:id
PATCH /consultants/:id
POST  /consultants/:id/archive
```

### Missions and Calendar

```txt
GET   /missions
GET   /missions/calendar?from=...&to=...
POST  /missions
GET   /missions/:id
PATCH /missions/:id
POST  /missions/:id/archive
```

`/calendar` is the web planning workspace. `/missions` redirects to the calendar for compatibility only and must not appear as a duplicate mobile navigation tab. Mission detail and creation remain `/missions/:id` and `/missions/nouvelle`.

### Ordres de Mission

Ordres de mission are temporarily disabled in the web UI. The backend contract remains documented for later reactivation, but `/ordres-mission` web routes intentionally return 404 until this workflow returns to scope.

```txt
GET  /ordres-mission
POST /ordres-mission
GET  /ordres-mission/:id
PATCH /ordres-mission/:id
POST /ordres-mission/:id/validate
POST /ordres-mission/:id/mark-printed
POST /ordres-mission/:id/cancel
POST /ordres-mission/:id/archive
GET  /ordres-mission/:id/preview
GET  /ordres-mission/:id/export.pdf
GET  /ordres-mission/:id/export.xlsx
GET  /ordres-mission/:id/export.csv
```

### Templates and Sync

Template UI is temporarily disabled with the ordre workflow. The backend contract remains documented for later reactivation.

```txt
GET   /templates
POST  /templates
GET   /templates/:id
PATCH /templates/:id
POST  /templates/:id/archive
POST  /sync/batch
```

## Storage

Storage remains private. The API validates type and size and records file metadata before returning protected access or signed URLs.

Upload validation is document-specific:

| Document type | Accepted input | Maximum |
| --- | --- | --- |
| Logo | PNG, JPEG | 2 Mo |
| Patente / matricule fiscal | PDF, PNG, JPEG | 10 Mo |
| RNE | PDF | 10 Mo |
| Organigramme | PDF, PNG, JPEG | 20 Mo |
| Liste du personnel | XLSX, CSV | 10 Mo |

Organigramme extraction is a required reviewed workflow. Advanced unattended OCR automation remains deferred.

| Bucket | Contents |
| --- | --- |
| `client-documents` | Logos, RNE, patente, organigrammes and personnel files |
| `ordres-mission` | Generated ordre PDFs when persistent storage is enabled |

The Supabase service-role key never reaches `apps/web`.

## Calendar Contract

- Desktop: FullCalendar week and month views with drag-and-drop rescheduling.
- Mobile: compact day and month views with full action parity. Phone week view is intentionally not exposed.
- Working days are Monday through Saturday; Sunday is hidden from planning views.
- Events are fetched from `GET /missions/calendar?from=...&to=...`.
- Calendar rows show time, client accent, mode color and label, location and assigned consultants.
- A client accent is business data, not an ad-hoc UI color.
- Drag-and-drop updates use the record version and revert visually on conflict.

## Offline Contract

Dexie stores cached entities, outbox mutations, encrypted staged blobs, conflicts and metadata. `/sync/batch` processes idempotent mutations. Retry occurs on reconnect and app resume. Queued work survives session expiry but synchronizes only after the same user authenticates again.

Account creation, password reset and session revocation remain online-only.

## Delivery Order

1. Original-brief recovery gate in `docs/product/ORIGINAL_SCOPE_RECOVERY.md`.
2. Foundation, environment, migrations, design tokens and health checks.
3. Shared contracts, auth hardening and role administration.
4. Client and consultant vertical slices.
5. Calendar-first mission planning and ordre propagation.
6. Ordre lifecycle, templates, preview, PDF, XLSX, CSV and print.
7. Archives, users, sessions, audit history and settings.
8. Dexie outbox, encrypted uploads, Serwist, batch sync and conflict resolution.
9. Logging, Sentry, CI, staging, rollback, restore rehearsal and automated production gates.

## Deferred

- Advanced OCR automation beyond baseline reviewed organigramme personnel extraction
- Push notifications
- Google Calendar synchronization
- Email delivery
- Invoicing
