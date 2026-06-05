# Production Acceptance Checklist - 2026-06-05

This report maps the attached production checklist to the current codebase state.

Legend:
- **Pass**: implemented in code and directly evidenced.
- **Partial**: implemented in part, but missing role/UI/state/test coverage.
- **Fail**: not implemented or contradicts the expected behavior.
- **Manual**: requires live browser/API/Supabase verification.

## Executive Summary

| Area | Status | Notes |
|---|---|---|
| Navigation & routes | Pass | Main routes are present. Ordres/templates UI routes are disabled. Sidebar and mobile overflow are role-aware for admin-only items. |
| Auth flow | Pass | Custom auth, cookies, refresh rotation, frontend `/auth/me`, silent refresh retry, login throttling and production reset email delivery hook exist. |
| Roles & permissions | Pass | API guards enforce write/admin permissions and frontend guards hide write/admin controls by role. |
| CRUD complet | Partial | Clients are strongest. Consultants/users/missions are functional but missing some advanced checks and UI affordances. |
| Calendar & missions | Pass | Calendar-first architecture is implemented and mission forms now capture consultant RESPONSABLE/PARTICIPANT roles. |
| PWA & hors-ligne | Partial | Dexie outbox/sync center exists. Serwist worker is wired; live install/offline reload still needs browser verification. |
| Parite back/front | Partial | Ordres/templates backend exists but UI is intentionally disabled. Health now checks DB and Supabase Storage; live health still needs deployed env verification. |

## Navigation & Routes

| Check | Status | Evidence / Gap |
|---|---|---|
| `/clients` has "Nouveau client" -> `/clients/nouveau` | Pass | `apps/web/src/app/clients/page.tsx` action links to `/clients/nouveau`. |
| `/clients/[id]` has "Modifier" -> edit route with prefill | Pass | `ClientDetail` links to `/clients/${id}/modifier`; edit form fetches detail. |
| `/consultants` has "Nouveau consultant" -> `/consultants/nouveau` | Pass | `apps/web/src/app/consultants/page.tsx`. |
| `/consultants/[id]` has "Modifier" -> edit route | Pass | `ConsultantDetail` links to `/consultants/${id}/modifier`. |
| Calendar "Nouvelle mission" -> `/missions/nouvelle` | Pass | `CalendarWorkspace` header action. |
| `/missions/[id]` has "Modifier" -> edit route | Pass | `MissionDetail` links to `/missions/${id}/modifier`. |
| `/users` has "Nouvel utilisateur" for ADMIN only | Pass | `/users` routes are frontend role-gated and API is ADMIN-only. |
| `/login` has forgot-password link | Pass | `login/page.tsx` links to `/forgot-password`. |
| `/missions` redirects to `/calendar` | Pass | `apps/web/src/app/missions/page.tsx`. |
| Desktop sidebar exact items and no Missions tab | Pass | Sidebar has Accueil, Calendrier, Clients, Consultants, Utilisateurs, Synchronisation. |
| Mobile bottom nav exact items | Pass | Mobile nav has Accueil, Calendrier, Clients, Plus. |
| `/more` lists overflow items | Pass | Lists Consultants and Synchronisation for all authenticated users; Utilisateurs appears for ADMIN only. |
| Session expired redirects to `/session-expired` without loop | Pass | `apiFetch()` refreshes once, retries, then redirects to `/session-expired` on persistent 401. |
| Logout redirects to `/logged-out` | Pass | App shell exposes logout and redirects to `/logged-out` after server session revocation. |
| Detail pages expose parent return path | Pass | Client, consultant and mission detail pages have breadcrumbs to parent context. |

## Auth Flow

| Check | Status | Evidence / Gap |
|---|---|---|
| Valid login sets `access_token` and `refresh_token` HttpOnly cookies | Pass | `AuthController.setAuthCookies()` sets both with `httpOnly: true`. |
| Disabled account shows explicit non-generic error | Pass | `AuthService.login()` returns an explicit disabled-account error. |
| Expired access token triggers silent refresh | Pass | `apiFetch()` calls `/auth/refresh`, retries once, then redirects to `/session-expired`. |
| Refresh token rotation rejects old refresh | Pass | `AuthService.refresh()` overwrites stored token hash; replay old token no longer matches. |
| Forgot password response avoids email enumeration | Pass | Unknown/disabled user still returns `{ ok: true }`. |
| Expired reset token rejected with clear message | Pass | `confirmPasswordReset()` returns invalid/expired message. |
| Used reset token rejected with clear message | Pass | `usedAt: null` required; same invalid/expired message. |
| Logout revokes server session | Pass | `logout()` sets `revokedAt`; refresh/verify require `revokedAt: null`. |
| CSRF cookie/header checked on mutations | Partial | API mutations use `CsrfGuard` in main controllers. Need systematic integration test coverage. |
| Login throttling after repeated failures | Pass | `AuthService.login()` applies in-memory email-based throttling with HTTP 429 after repeated failures. |
| Password reset email delivery | Pass | Production reset requests send through Resend when `RESEND_API_KEY` and `PASSWORD_RESET_FROM_EMAIL` are configured; non-production keeps dev token behavior. |

## Roles & Permissions

| Check | Status | Evidence / Gap |
|---|---|---|
| VIEWER sees no create/edit/archive buttons | Pass | Auth provider loads `/auth/me`; list/detail/create controls are hidden by frontend role gates. |
| CONSULTANT blocked from create routes/API | Pass | API blocks writes via `RolesGuard`; frontend create/edit routes render forbidden state for unauthorized roles. |
| CONSULTANT write requests return 403 | Pass | Write controllers require `ADMIN` or `RESPONSABLE`. |
| RESPONSABLE can write clients/consultants/missions | Pass | Controllers allow `ADMIN`, `RESPONSABLE`. |
| `/users` and `/users/nouveau` ADMIN-only | Pass | API is ADMIN-only and frontend `/users`, `/users/nouveau`, `/users/:id/modifier` are role-gated. |
| Archive/restore buttons hidden for CONSULTANT/VIEWER | Pass | Client, consultant, mission and document write controls are role-aware. |
| Client CSV export role decision documented | Partial | Endpoint requires authentication only; no role restriction documented in code. |
| Disabling user rejects active sessions | Pass | `verifyAccessToken()` and `refresh()` reject disabled users. Existing cookies fail on next guarded request. |

## CRUD Complet

| Check | Status | Evidence / Gap |
|---|---|---|
| Clients search/sort/filter/pagination | Pass | Implemented in `ClientList` and `ClientsService`. |
| Create client with empty fields accepted | Pass | Shared schema optional; API normalizes blank values and generates temporary fiscal number. |
| Duplicate fiscal number returns 409 and displays | Pass | Prisma P2002 -> `ConflictException`; forms display `ApiError.message`. |
| Client detail shows counts and cadre contacts | Pass | `ClientDetail` shows effectif and personnel contacts. |
| Client edit assigns responsible consultants | Pass | `ClientEditForm` includes `responsibleConsultantIds`. |
| Client archive visible in archived filter | Pass | Status filter supports `ARCHIVED`; archive updates status/timestamp. |
| Client restore clears archive timestamp | Pass | `ClientsService.restore()`. |
| Client CSV export downloadable | Pass | `/clients/export.csv`; frontend export button. |
| Client private document upload | Manual | API and UI exist; requires live Supabase Storage verification. |
| Signed URL download works | Manual | API exists; requires live Supabase Storage verification. |
| Consultants search/filter/pagination | Partial | Search/status/page exist; sorting is not as complete as clients. |
| Consultant duplicate email error displayed | Pass | P2002 handler exists; form displays API error. |
| Consultant create/edit/archive/restore | Pass | API/UI paths exist. |
| Consultant edit links user account | Fail | Detail displays linked account, but edit form currently does not expose `userId`. |
| Mission create visible in calendar | Pass | Create form posts mission; calendar queries mission range. |
| Mission edit saves type/mode/dates/location/consultants | Pass | Fields exist and consultant assignments include explicit RESPONSABLE/PARTICIPANT role values. |
| Mission optimistic locking conflict | Pass | Service version checks raise conflict. |
| Mission consultant role choice in form | Pass | Create/edit forms use `consultantAssignments` with per-consultant role selection. |
| Mission archive removed from active calendar | Pass | Calendar service excludes cancelled/archived status in active query path. |
| User create with role | Pass | User form has role select. |
| User disable/enable | Pass | User list actions and API exist. |
| User revoke sessions | Pass | User list action and API exist. |
| User edit links consultant profile | Pass | User form includes consultant select. |

## Calendar & Missions

| Check | Status | Evidence / Gap |
|---|---|---|
| Desktop month shows missions and client color | Pass | FullCalendar events use client color border and client name label. |
| Desktop week slots no abnormal overlap | Manual | `slotEventOverlap={false}` set; visual browser QA still needed. |
| Mobile month + day agenda | Pass | `MobileCalendar` has month/day views. |
| Sunday hidden in all calendar views | Pass | FullCalendar `hiddenDays={[0]}`; mobile grid skips Sunday. |
| Monday-Saturday working days | Pass | `businessHours.daysOfWeek` is `[1..6]`; mobile headers lun-sam. |
| Filters apply without reload | Pass | Local state filters `visibleMissions`. |
| Multi-day missions visible on correct dates | Pass | `missionOccursOnDate()` includes start through end day. |
| Drag-and-drop persists server-side | Manual | `eventDrop` PATCHes mission; needs browser/API verification. |
| Client name primary label | Pass | `CalendarEvent` and mobile row use `mission.client.companyName` as primary. |

## PWA & Hors-ligne

| Check | Status | Evidence / Gap |
|---|---|---|
| Manifest valid with 192/512 icons | Pass | Manifest lists 192 and 512 icon entries. |
| Service worker active | Manual | Serwist is wired through Next config and generates `/sw.js`; active registration needs browser verification. |
| App shell reloads offline | Manual | Serwist precache/runtime caching is configured; offline reload needs browser verification. |
| Install prompt/app installable | Manual | Manifest and service worker are present; installability needs browser verification. |
| Offline mutations queued in Dexie | Partial | Clients/consultants/missions queue some actions. User disable is online-only in sync service. |
| Sync center pending count | Pass | Sync center reads Dexie outbox/uploads/conflicts. |
| Reconnect triggers batch sync | Partial | Manual sync button exists; automatic reconnect retry is not clearly implemented globally. |
| Version conflict visible in sync center | Pass | Sync API stores conflicts; frontend stores conflict results locally. |
| Offline upload staging | Pass | Client document staging exists. |
| Manual conflict resolution | Partial | Sync center has local/server keep actions; needs browser QA and backend resolution audit. |

## Back / Front Parity

| Check | Status | Evidence / Gap |
|---|---|---|
| `/ordres-mission` returns 404 and no nav link | Pass | Page and detail route call `notFound()`; no sidebar/bottom nav link. |
| `/templates` returns 404 and no nav link | Pass | Page/new/detail routes call `notFound()`; no sidebar/bottom nav link. |
| No orphan UI links to ordres/templates | Partial | Unused components still contain links, but disabled pages do not import them. |
| API ordres responds correctly | Manual | Backend exists; needs dev/Postman verification. |
| API templates responds correctly | Manual | Backend exists; needs dev/Postman verification. |
| Ordre exports valid files | Manual | Export code exists; needs file validation in dev. |
| `/health` returns service status | Pass | Health service checks database and Supabase Storage and returns degraded status when a dependency fails. |
| Audit log writes recorded | Partial | Many write services create `ActivityLog`; coverage is not universal and needs SQL verification. |

## Highest Priority Fixes Before Real Production

1. Done - frontend auth/session provider uses `/auth/me`.
2. Done - create/edit/archive/admin controls are role-aware.
3. Done - client 401 handling refreshes once, retries, then redirects `/session-expired`.
4. Done - login throttling exists server-side.
5. Done - production password reset email delivery uses Resend configuration.
6. Done - Serwist worker is wired and manifest lists 192/512 icon entries.
7. Done - frontend route guards protect `/users`, create/edit pages.
8. Done - mission create/edit forms include consultant role selection.
9. Done - `/health` checks DB and Supabase Storage.
10. Remaining - run manual browser/API/Supabase acceptance tests for all **Manual** rows.
