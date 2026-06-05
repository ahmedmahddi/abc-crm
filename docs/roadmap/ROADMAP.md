# ABC CRM Production Roadmap

## Product rule

ABC CRM is a bureau d'étude operations tool. Build complete vertical slices and keep the calendar as the only top-level mission-planning workspace. Do not ship generic dashboard filler.

## Phase 0 - Original brief recovery gate

Complete `docs/product/ORIGINAL_SCOPE_RECOVERY.md` before prioritizing broader offline and production-hardening work.

- Client capture parity: accent, responsables, cadre contacts and uploads during creation
- Type-specific private uploads, document removal and archive restore
- Reviewed personnel extraction from organigramme image or PDF
- Client CSV/PDF exports and rendered mission timeline
- Consultant account linking, availability and restore workflows
- Mission edit, explicit responsable consultants and calendar click-to-create prefill
- Manual historical ordre creation, ordre editing and template management
- Password reset, login throttling, user administration and session revocation
- Mobile-first browser QA at 320px, 375px, 390px, tablet and desktop widths

## Phase 1 - Foundation

- Monorepo, pinned dependencies and lockfile
- Environment validation, Supabase PostgreSQL and Storage
- Prisma migrations and RLS
- Protected Next.js shell and NestJS `/api/v1`
- Design tokens, mobile navigation and desktop sidebar

## Phase 2 - Auth and administration

- Login, logout, refresh rotation, CSRF and `/auth/me`
- Role checks and account disable
- User management, linked consultant accounts and session revocation
- Login throttling, audit logging and ADMIN seed command

## Phase 3 - Clients and consultants

- Client CRUD, contacts, effectifs, legal documents and archive restore
- Consultant CRUD, availability context, linked accounts and assignments
- Search, filters, sorting, pagination and exports
- Mobile rows and desktop table enhancement

## Phase 4 - Calendar and missions

- FullCalendar week and month planning workspace
- Mobile day and week agenda parity
- Client, consultant and mode filters
- Mission create, edit, drag-and-drop reschedule and cancel
- Automatic transactional ordre creation as `ODM-YYYY-NNNN`
- Validated and printed ordre review propagation

## Phase 5 - Ordres and templates

- Ordre workspace, preview, validation and print states
- Manual ordre creation for historical cases
- TipTap templates with approved placeholders and sanitized HTML
- Default template management
- Server PDF, XLSX and streamed CSV exports

## Phase 6 - Offline and sync

- Dexie entity cache, outbox, metadata, encrypted blobs and conflicts
- Serwist PWA caching
- `/api/v1/sync/batch` idempotent mutation processing
- Retry on reconnect and app resume
- Manual conflict diff and resolution center
- Same-user reauthentication before queued sync

## Phase 7 - Production gate

- Pino JSON logs, request IDs, Sentry and uptime checks
- Unit, API integration, offline, accessibility and Playwright tests
- CI, staging and production deployment
- Migration, rollback, database restore and Storage restore rehearsal
