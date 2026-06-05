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
| Navigation & routes | Partial | Main routes are present. Ordres/templates UI routes are disabled. Role-aware navigation is not complete. |
| Auth flow | Partial | Custom auth, cookies, refresh rotation and reset tokens exist. Silent frontend refresh, login throttling and email reset delivery are missing. |
| Roles & permissions | Partial | API guards enforce write/admin permissions. Frontend still shows write/admin buttons without user-role context. |
| CRUD complet | Partial | Clients are strongest. Consultants/users/missions are functional but missing some advanced checks and UI affordances. |
| Calendar & missions | Partial | Calendar-first architecture is implemented. Consultant role selection in mission forms is missing. |
| PWA & hors-ligne | Partial | Dexie outbox/sync center exists. Serwist/service worker is not wired yet. |
| Parite back/front | Partial | Ordres/templates backend exists but UI is intentionally disabled. Health endpoint is too shallow for production dependency status. |

## Navigation & Routes

| Check | Status | Evidence / Gap |
|---|---|---|
| `/clients` has "Nouveau client" -> `/clients/nouveau` | Pass | `apps/web/src/app/clients/page.tsx` action links to `/clients/nouveau`. |
| `/clients/[id]` has "Modifier" -> edit route with prefill | Pass | `ClientDetail` links to `/clients/${id}/modifier`; edit form fetches detail. |
| `/consultants` has "Nouveau consultant" -> `/consultants/nouveau` | Pass | `apps/web/src/app/consultants/page.tsx`. |
| `/consultants/[id]` has "Modifier" -> edit route | Pass | `ConsultantDetail` links to `/consultants/${id}/modifier`. |
| Calendar "Nouvelle mission" -> `/missions/nouvelle` | Pass | `CalendarWorkspace` header action. |
| `/missions/[id]` has "Modifier" -> edit route | Pass | `MissionDetail` links to `/missions/${id}/modifier`. |
| `/users` has "Nouvel utilisateur" for ADMIN only | Partial | Button exists in `UserList`, but frontend does not have user-role context to hide it for non-admins. API is ADMIN-only. |
| `/login` has forgot-password link | Pass | `login/page.tsx` links to `/forgot-password`. |
| `/missions` redirects to `/calendar` | Pass | `apps/web/src/app/missions/page.tsx`. |
| Desktop sidebar exact items and no Missions tab | Pass | Sidebar has Accueil, Calendrier, Clients, Consultants, Utilisateurs, Synchronisation. |
| Mobile bottom nav exact items | Pass | Mobile nav has Accueil, Calendrier, Clients, Plus. |
| `/more` lists overflow items | Partial | Lists Consultants, Utilisateurs, Synchronisation. Utilisateurs is not role-aware. |
| Session expired redirects to `/session-expired` without loop | Fail | Page exists, but API client/proxy do not redirect 401/session-expired states there. |
| Logout redirects to `/logged-out` | Partial | Page exists. No complete global logout UI/flow evidence in app shell. |
| Detail pages expose parent return path | Pass | Client, consultant and mission detail pages have breadcrumbs to parent context. |

## Auth Flow

| Check | Status | Evidence / Gap |
|---|---|---|
| Valid login sets `access_token` and `refresh_token` HttpOnly cookies | Pass | `AuthController.setAuthCookies()` sets both with `httpOnly: true`. |
| Disabled account shows explicit non-generic error | Fail | `AuthService.login()` returns "Identifiants invalides" for disabled users. |
| Expired access token triggers silent refresh | Fail | `apiFetch()` does not call `/auth/refresh` on 401. |
| Refresh token rotation rejects old refresh | Pass | `AuthService.refresh()` overwrites stored token hash; replay old token no longer matches. |
| Forgot password response avoids email enumeration | Pass | Unknown/disabled user still returns `{ ok: true }`. |
| Expired reset token rejected with clear message | Pass | `confirmPasswordReset()` returns invalid/expired message. |
| Used reset token rejected with clear message | Pass | `usedAt: null` required; same invalid/expired message. |
| Logout revokes server session | Pass | `logout()` sets `revokedAt`; refresh/verify require `revokedAt: null`. |
| CSRF cookie/header checked on mutations | Partial | API mutations use `CsrfGuard` in main controllers. Need systematic integration test coverage. |
| Login throttling after repeated failures | Fail | Known gap; no throttle store/middleware exists. |
| Password reset email delivery | Fail | Known gap; non-production dev token exists, no email provider. |

## Roles & Permissions

| Check | Status | Evidence / Gap |
|---|---|---|
| VIEWER sees no create/edit/archive buttons | Fail | Frontend does not load `/auth/me` user role and does not hide buttons by role. |
| CONSULTANT blocked from create routes/API | Partial | API blocks writes via `RolesGuard`; frontend routes still render forms if visited directly. |
| CONSULTANT write requests return 403 | Pass | Write controllers require `ADMIN` or `RESPONSABLE`. |
| RESPONSABLE can write clients/consultants/missions | Pass | Controllers allow `ADMIN`, `RESPONSABLE`. |
| `/users` and `/users/nouveau` ADMIN-only | Partial | API is ADMIN-only. Frontend route shell is not role-gated. |
| Archive/restore buttons hidden for CONSULTANT/VIEWER | Fail | Buttons are not role-aware. API blocks writes. |
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
| Mission edit saves type/mode/dates/location/consultants | Partial | Fields exist; consultant role selection is missing. |
| Mission optimistic locking conflict | Pass | Service version checks raise conflict. |
| Mission consultant role choice in form | Fail | Forms use `consultantIds` checkboxes only, no RESPONSABLE/PARTICIPANT choice. |
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
| Manifest valid with 192/512 icons | Partial | Manifest exists but only lists a 512 icon. |
| Service worker active | Fail | `@serwist/next` dependency exists, but no Serwist/worker wiring found. |
| App shell reloads offline | Fail | No service worker means no reliable offline app shell reload. |
| Install prompt/app installable | Partial | Manifest exists; missing 192 icon and service worker weakens installability. |
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
| `/health` returns service status | Partial | Returns `{ status: "ok", service: "abc-crm-api" }`; does not check DB/Redis/Storage. |
| Audit log writes recorded | Partial | Many write services create `ActivityLog`; coverage is not universal and needs SQL verification. |

## Highest Priority Fixes Before Real Production

1. Add frontend auth/session provider using `/auth/me`.
2. Hide create/edit/archive/admin controls by role.
3. Add client-side 401 handling: refresh once, retry request, then redirect `/session-expired`.
4. Add login throttling server-side.
5. Add real password reset email delivery or disable public reset in production until ready.
6. Wire Serwist service worker and add 192/512 manifest icons.
7. Add role-gated frontend route guards for `/users`, create/edit pages.
8. Add consultant role selection in mission create/edit forms.
9. Expand `/health` to check DB and Supabase Storage.
10. Run manual browser/API/Supabase acceptance tests for all **Manual** rows.

