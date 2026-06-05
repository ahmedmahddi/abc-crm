# ABC CRM full app audit report

Date: 2026-06-04

## Executive summary

The application is usable for the current active slices, but it is not complete from A to Z against `AGENTS.md`, `blueprint.md`, and the original product scope.

Current state:

- Active rendered pages smoke-tested successfully: home, calendar, clients, consultants, missions, users, sync, more, and login.
- Ordres de mission and modeles are intentionally disabled at the web route level and return 404.
- Workspace typecheck passes and production build passes.
- Workspace lint passes.
- No project-owned automated tests exist yet.
- Core CRUD exists for clients, consultants, missions, and users, but most list pages do not yet meet the full table requirements from `AGENTS.md`.
- Offline/sync exists as an initial outbox and upload staging flow, not a complete offline-first system.

## Validation evidence

### Commands run

| Check | Result | Notes |
| --- | --- | --- |
| `corepack pnpm typecheck` | Pass | `@abc/api`, `@abc/db`, `@abc/shared`, `@abc/web` all passed. |
| `corepack pnpm lint` | Pass | Previous unused `UserCreateInput` import was removed. |
| `corepack pnpm build` | Pass | API and Next production build completed. |
| Project tests | Missing | No project `*.test.*`, `*.spec.*`, or e2e files found outside `node_modules`. |
| Playwright smoke, desktop authenticated | Partial pass | Active routes passed. Disabled ordres/modeles routes returned expected 404. |
| Playwright smoke, mobile login | Pass | `/login` renders publicly with password field and login title. |
| Playwright smoke, mobile calendar | Pass | No separate `Missions` tab and no mobile week button. |

Screenshots generated:

- `C:/tmp/abc-crm-calendar-mobile-smoke.png`
- `C:/tmp/abc-crm-clients-desktop-smoke.png`
- `C:/tmp/abc-crm-login-mobile-smoke.png`

## Route smoke-test matrix

| Route | Status | Finding |
| --- | --- | --- |
| `/` | Implemented | Operational home renders. Partial against full role-aware work-surface requirements. |
| `/login` | Implemented | Login renders when unauthenticated and links to password recovery. |
| `/forgot-password` | Implemented | Public password reset request page with local test token support while email delivery remains deferred. |
| `/reset-password` | Implemented | Public password reset confirmation page with strength feedback. |
| `/session-expired` | Implemented | Public session-expired recovery page. |
| `/logged-out` | Implemented | Public logged-out confirmation page. |
| `/calendar` | Implemented | Calendar renders. Desktop week/month and mobile day/month are active. |
| `/clients` | Implemented, improved | List, search, status filter, sortable desktop table, page-size selector, pagination, row actions, bulk archive/restore, CSV export, and mobile row actions. |
| `/clients/nouveau` | Implemented, partial | Create form supports core client fields, contacts, responsables, documents. Missing extraction review. |
| `/clients/:id` | Implemented, partial | Detail, documents, archive/restore, mission history. Missing extraction workflow and audit/conflict states. |
| `/clients/:id/modifier` | Implemented, partial | Edit form exists. Missing all advanced form behavior from AGENTS. |
| `/consultants` | Implemented, partial | List, search, status filter, archive/restore. Missing pagination/sort/export/bulk. |
| `/consultants/nouveau` | Implemented | Basic create form exists. Availability and linked-account creation are incomplete. |
| `/consultants/:id` | Implemented, partial | Detail shows clients, missions, linked account display. Linked-account management incomplete. |
| `/consultants/:id/modifier` | Implemented, partial | Basic edit form exists. Availability context is reduced to status. |
| `/missions` | Compatibility redirect | Redirects to `/calendar`; mission planning remains calendar-first. |
| `/missions/nouvelle` | Implemented, partial | Mission creation exists. Missing click-to-create from calendar date and richer conflict/cancellation flow. |
| `/missions/:id` | Implemented, partial | Detail and cancel/archive action exists. Missing ordre review behavior while ordres are disabled. |
| `/missions/:id/modifier` | Implemented, partial | Mission edit now exists. Needs browser QA with real backend conflict/version cases. |
| `/more` | Implemented | Mobile overflow page links to consultants, users, sync. |
| `/users` | Implemented, partial | User list, disable/enable, revoke sessions. Missing session browser and password reset flows. |
| `/users/nouveau` | Implemented, partial | Admin create user exists. Needs stronger password UX and audit trail display. |
| `/users/:id/modifier` | Implemented, partial | Edit user and consultant link exists. Missing full session management detail. |
| `/sync` | Implemented, partial | Sync center shows outbox/uploads/conflicts. Conflict UI is basic, not a full diff review. |
| `/ordres-mission` | Disabled | Route returns 404 by explicit `notFound()`. Backend and old components still exist. |
| `/ordres-mission/:id` | Disabled | Route returns 404 by explicit `notFound()`. |
| `/templates` | Disabled | Route returns 404 by explicit `notFound()`. Backend and old components still exist. |
| `/templates/nouveau` | Disabled | Route returns 404 by explicit `notFound()`. |
| `/templates/:id` | Disabled | Route returns 404 by explicit `notFound()`. |

## Module completeness

### Auth

Status: partial.

Implemented:

- Custom login.
- Logout, refresh, `/auth/me`.
- JWT session cookie and refresh session model.
- CSRF token usage in frontend requests.
- Admin user management pages for create/edit/disable/enable/revoke sessions.

Missing or weak:

- Email delivery for password reset links remains deferred; local/non-production reset-token support exists for testing.
- Login throttling/rate-limit polish.
- Session expired screen exists.
- Dedicated session list/browser per user.
- Two-factor authentication and verification flows from the broader UI brief.
- Public register/sign-up is not a product requirement in `AGENTS.md`, but it was requested in the broad design prompt; currently absent.

### Clients

Status: partial but one of the strongest slices.

Implemented:

- Create, list, detail, edit.
- Archive and restore.
- Fiscal number, address/zone, sector/domain, accent color.
- Cadre/non-cadre counts.
- Cadre/personnel contacts.
- Responsible consultants.
- Private document upload foundation.
- Document removal and signed download route.
- CSV export from list.
- Client mission history on detail page.
- Offline outbox and staged upload integration.

Missing or weak:

- Baseline organigramme extraction with review before storing personnel rows.
- PDF export for clients.
- Column visibility is still not implemented; the active client table now has sort, page-size selector, bulk actions, row actions and CSV export.
- Delete is not implemented; archive is the current destructive policy.
- Conflict state is not implemented on the client screens themselves.
- Audit history is not exposed on the client detail.
- File validation exists, but malware scan remains absent.

### Consultants

Status: partial.

Implemented:

- Create, list, detail, edit.
- Archive and restore.
- Linked account display.
- Active clients and upcoming missions on detail.
- Offline outbox integration for create/update/archive/restore.

Missing or weak:

- No dedicated linked-account management workflow from consultant profile.
- Availability context is not modeled beyond status.
- No export.
- No full pagination controls.
- No sort, bulk actions, or column visibility.
- No audit history.
- No conflict state on screens.

### Calendar and missions

Status: partial, currently functional.

Implemented:

- Calendar as the only top-level mission planning workspace.
- Desktop month default and week view.
- Mobile day/month only.
- Monday to Saturday work week; Sunday hidden.
- Mission type labels: Audit, Formation, Assistance.
- Mission mode labels/colors: Presentielle and En ligne.
- Multi-day mission occurrence handling.
- Mission create, detail, edit, cancel/archive.
- Drag/drop update path exists.
- `/missions` top-level page redirects to calendar instead of duplicating mission register.

Missing or weak:

- `/missions` redirects to `/calendar`; mission planning remains calendar-first.
- Calendar date click does not open mission create with date/time prefilled.
- Drag/drop persistence needs real API/browser QA with conflict/version behavior.
- Mission cancellation review flow is simplified.
- Ordre propagation is currently not visible because ordres are disabled.
- No mission restore policy.
- No audit history in mission detail.

### Ordres de mission

Status: disabled in web, partial in backend/source.

Implemented but disabled:

- Backend endpoints and old frontend components exist.
- API has list/detail/create/update/archive/validate/mark-printed/cancel/export routes.
- Components for list/detail/export buttons still exist.

Current active behavior:

- `/ordres-mission` and `/ordres-mission/:id` return 404 via explicit `notFound()`.
- More/sidebar/mobile navigation no longer expose ordres.

Missing for reactivation:

- Manual historical ordre create/edit UI.
- Restore semantics.
- Review workflow for validated/printed ordres after mission changes.
- Print stylesheet verification.
- Full export QA.
- Role-specific validation workflow.

### Modeles/templates

Status: disabled in web, partial in backend/source.

Implemented but disabled:

- Backend endpoints and old TipTap editor/list components exist.
- Archive/restore/default-template logic exists in old components.

Current active behavior:

- `/templates`, `/templates/nouveau`, and `/templates/:id` return 404 via explicit `notFound()`.
- More/sidebar/mobile navigation no longer expose templates.

Missing for reactivation:

- Preview UI.
- Placeholder validation display.
- Audit trail.
- Full default-template management QA.
- Full accessibility/browser QA of TipTap editor.

### Users/admin

Status: partial.

Implemented:

- User list.
- Create/edit user.
- Role assignment.
- Optional consultant link.
- Disable/enable user.
- Revoke active sessions.

Missing or weak:

- No dedicated user detail page.
- No session browser/history.
- No audit log browser.
- No settings page.
- No archive browser.
- No backup/restore/uptime operations UI.
- No role-specific navigation filtering observed in the frontend.

### Offline and sync

Status: partial.

Implemented:

- Dexie database shell.
- Outbox mutations.
- Staged encrypted uploads for client documents.
- Sync center with pending items, uploads, conflicts, retry, discard, keep local/server.
- `/sync/batch` supports clients, consultants, and missions.
- Users, ordres, and templates are blocked from sync intentionally.

Missing or weak:

- Cached entity repositories are not complete.
- Serwist/PWA caching requires deeper verification.
- Conflict resolution is not a full diff UI.
- Sync retry on reconnect/app resume needs full browser QA.
- Same-user-after-session-expiry behavior needs test coverage.
- Encrypted upload purge policy needs verification.

### Files/documents

Status: partial.

Implemented:

- Client document upload endpoint.
- Document-specific accepted file types and sizes.
- Signed URL endpoint.
- Document delete endpoint.
- Frontend upload and removal UI on client detail.
- Offline staging for client uploads.

Missing or weak:

- Malware scan.
- Full private Supabase Storage policy verification.
- Upload progress is not fully implemented as a progress bar.
- Organigramme extraction jobs are missing.
- Document review workflow is missing.

### Design system and layout

Status: partial but improved.

Implemented:

- Unified shell, sidebar, mobile bottom nav.
- ABC blue/grey palette mostly respected.
- Mobile-first route structure.
- Shared UI primitives for buttons, cards, fields, dialogs, skeletons.

Missing or weak:

- Several components still use ad-hoc Tailwind values and one-off layouts.
- Some text encoding appears broken in source/output (`PrÃ©sentielle`, `ModÃ¨le`, etc.).
- Some forms are compressed into long inline JSX, which makes them hard to maintain.
- Full state checklist is not present on every screen: forbidden, conflict, offline, error, loading, empty.
- List pages are not all table-complete by `AGENTS.md`.

## AGENTS.md compliance gaps

High-priority gaps:

1. Every list/table must include search, filters, sort, pagination with page-size selector, loading skeleton, empty state, row actions, bulk actions, export, and optional column visibility. Current pages implement only parts.
2. Every screen must account for loading, empty, error, offline, conflict, and forbidden states. Current screens only cover some states.
3. Mobile full parity is mostly respected for active routes, but forms/actions still need complete 320/375/390/tablet/desktop QA.
4. Ordres and templates were requested to be turned off; they are off in web routes, but backend/components remain. That is acceptable if intentional, but the report should track them as disabled, not complete.
5. No project tests exist, so production readiness is not close.

## Immediate fix list

### Must fix before more feature work

1. Add project-owned test scaffolding: API integration tests, web component/unit tests, and Playwright e2e smoke tests.
2. Fix text encoding issues across French UI strings.
3. Continue keeping docs aligned when ordres/templates are reactivated.

### Next feature completion order

1. Finish client scope: organigramme extraction job, review UI, PDF export, document upload progress, audit history.
2. Complete list/table requirements for consultants, users, and later ordres/templates. Clients now have the main controls, except optional column visibility.
3. Complete consultant account linking and availability context.
4. Complete calendar creation shortcuts and real drag/drop conflict QA.
5. Complete auth hardening: email delivery for reset links, throttling, 2FA, and session browser.
6. Deepen sync center: full conflict diff, reconnect/app-resume retry QA, cached entity repositories.
7. Add audit log browser, settings, archives, and operational admin pages.
8. Reactivate ordres/templates only when their workflows are intentionally scheduled again.

## Overall status

The app is beyond a static MVP shell and has meaningful working slices, especially clients, consultants, missions/calendar, users, and sync. It is not yet a complete production PWA. The next work should focus less on adding new pages and more on closing the feature/state/test gaps in the already exposed modules.
