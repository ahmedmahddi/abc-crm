# Audit Externe — Design Spec

Date: 2026-07-15
Status: Approved, ready for implementation planning

## 1. Purpose

Add a dedicated "Audit Externe" record type for external certification audits (Certification, Suivi 1, Suivi 2), with full CRUD, a dedicated list page, calendar integration, and an automatic reminder to the responsible person 3 months before the audit date.

## 2. Data model

Satellite table linked 1:1 to the existing `Mission` model — the same pattern already used for `OrdreMission` ↔ `Mission`. `Mission` already has `AUDIT_EXTERNE` wired end-to-end (enum value, calendar badge styling, labels in `packages/shared/src/domain.ts`); nothing about `Mission` itself changes.

```prisma
enum AuditExterneType {
  CERTIFICATION
  SUIVI_1
  SUIVI_2
}

enum AuditExterneReference {
  NORME_9001
  QSE
  NORME_22000
  FSSC
  BRC
  BRC_IFS
}

model AuditExterne {
  id             String                 @id @default(uuid())
  missionId      String                 @unique
  clientId       String
  typeAudit      AuditExterneType
  reference      AuditExterneReference
  organisme      String
  auditeur       String
  responsableId  String
  reminderSentAt DateTime?
  createdAt      DateTime               @default(now())
  updatedAt      DateTime               @updatedAt
  version        Int                    @default(1)

  mission        Mission @relation(fields: [missionId], references: [id], onDelete: Cascade)
  client         Client  @relation(fields: [clientId], references: [id])
  responsable    User    @relation(fields: [responsableId], references: [id])

  @@index([clientId])
  @@index([responsableId])
}
```

Notes:
- No separate `auditDate` field — "date d'audit" is `mission.startDateTime`. Single source of truth, no duplication/sync risk.
- Status, client-facing dates, mode, location all come from the linked `Mission`.
- A plain `AUDIT_EXTERNE`-typed `Mission` created directly from the calendar (not through either Audit Externe entry point) remains valid with no `AuditExterne` row — the satellite fields are only required when going through the dedicated flow.
- No independent `archivedAt` on `AuditExterne` — archiving acts on the linked `Mission` (`mission.archivedAt`) only, so there is one single archived/active state per audit, not two that can drift apart. The `/audit-externe/:id/archive` route archives the underlying Mission.
- `responsableId` references `User` directly (not `Consultant`) per requirements — any user account, any role, can be the Responsable.
- `auditeur` and `organisme` are free text (external parties, not linked to internal Consultant/User records).

## 3. API surface

New module `apps/api/src/audit-externe/` (`audit-externe.controller.ts`, `audit-externe.service.ts`, `audit-externe.module.ts`), mirroring the existing `missions` module conventions exactly:

- Validation via Zod schema in `packages/shared/src/schemas/audit-externe.schema.ts` (no class-validator DTOs in this codebase — `parseInput(schema, body)` throwing `BadRequestException` on failure, same as `missions.service.ts`).
- `JwtAuthGuard` at class level; mutating routes add `@Roles("ADMIN","RESPONSABLE")` + `CsrfGuard`/`RolesGuard`, matching `missions.controller.ts`.
- Every mutation wrapped in `prisma.$transaction`, with an `ActivityLog` entry, matching the existing service pattern.
- Optimistic concurrency via `version`, checked and incremented on update, same convention as `Mission`/`Client`/`Consultant`.

Routes:
```
GET   /api/v1/audit-externe                 list — search/filter/sort/paginate (client, type, référence, date range, responsable)
GET   /api/v1/audit-externe/:id
POST  /api/v1/audit-externe                 creates Mission(type=AUDIT_EXTERNE) + AuditExterne together in one transaction
PATCH /api/v1/audit-externe/:id             version-checked; changing start/end datetime resets reminderSentAt to null
POST  /api/v1/audit-externe/:id/archive
GET   /api/v1/audit-externe/:id/export.csv
```

Create/update payload: `clientId, startDateTime, endDateTime, missionMode, location?, typeAudit, reference, organisme, auditeur, responsableId`. The service builds the underlying `Mission` row (title auto-derived, e.g. `"Audit externe — {typeAudit label} — {client.companyName}"`) and the `AuditExterne` row in the same transaction.

`AppModule` registers `AuditExterneModule` alongside the other domain modules.

## 4. Notification & reminder mechanism

Nothing here exists yet in the codebase (confirmed: no `@nestjs/schedule`/cron dependency anywhere, no in-app notification model) — all net new.

### 4.1 Trigger points (one shared code path, two triggers)

1. **Synchronous check on create/edit**: right after creating or updating an `AuditExterne` (when the relevant date changes), immediately evaluate whether `mission.startDateTime <= now() + 3 months` and `reminderSentAt IS NULL`. If true, send the reminder right away and stamp `reminderSentAt`. This covers "audit created/edited already under 3 months out" without waiting for the next cron tick.
2. **Nightly cron job** (new `@nestjs/schedule` dependency, `AuditExterneReminderService` with `@Cron(CronExpression.EVERY_DAY_AT_1AM)` or similar): runs the same eligibility query across all records, catching audits that cross the 3-month threshold naturally over time.

Eligibility query (used by both triggers):
```
AuditExterne where reminderSentAt IS NULL
  and mission.archivedAt IS NULL
  and mission.status = 'PLANNED'
  and mission.startDateTime <= now() + interval '3 months'
```

### 4.2 Reset on edit

Updating an `AuditExterne`'s underlying `startDateTime`/`endDateTime` sets `reminderSentAt = null`, so the audit re-enters the eligibility pool and gets re-evaluated (immediately via trigger 1, or on the next cron tick) against the new date.

### 4.3 Delivery — two channels, one send function

**a) In-app notification** — new model, since no notification-center exists yet:
```prisma
model AppNotification {
  id         String    @id @default(uuid())
  userId     String
  type       String    // "AUDIT_EXTERNE_REMINDER"
  title      String
  body       String
  entityType String    // "AUDIT_EXTERNE"
  entityId   String
  readAt     DateTime?
  createdAt  DateTime  @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, readAt])
}
```
New endpoints: `GET /api/v1/notifications` (list + unread count), `POST /api/v1/notifications/:id/read`. Frontend: bell icon in the layout header with unread badge, dropdown/list, linking to `/audit-externe/:id`.

**b) Web push** — reuses the existing `NotificationsService.sendToUsers([responsableId], payload)` as-is; it already handles missing/expired push subscriptions gracefully (auto-revokes on 404/410, returns a result object instead of throwing).

Both channels fire from the single reminder-trigger function so there is exactly one code path to get right, invoked by either trigger.

### 4.4 Failure handling

A failed push send logs a warning and does not throw (matches existing `notifyMissionUsers` behavior) — one failed notification must not block processing of the next audit in the cron loop.

## 5. Frontend

### 5.1 Navigation

"Audit Externe" gets its own top-level sidebar entry (desktop) and appears in the mobile "More" sheet (bottom tab bar is already at its 5-item cap).

### 5.2 Pages

- `/audit-externe` — list page, following the same table conventions as Clients/Consultants (search, filters, sort, pagination, CSV export, skeleton/empty/error states per AGENTS.md). Columns: Client, Date d'audit, Type d'audit, Référence, Organisme, Auditeur, Responsable, Statut (from linked Mission). Row actions: Edit, Archive.
- `/audit-externe/nouveau` — create page, audit fields visible from the start, full start/end date-time picker (same as regular mission creation, not just a bare date).
- `/audit-externe/:id` — detail page.
- `/audit-externe/:id/modifier` — edit page.

### 5.3 Creation from the calendar

The existing mission-create form (`mission-create-form.tsx`, used at `/missions/nouvelle`) is extended: when the user selects `AUDIT_EXTERNE` in the mission-type dropdown, the same audit-specific field group (type d'audit, référence, organisme, auditeur, responsable) appears inline, and submission posts to `/audit-externe` instead of `/missions`. This is one shared field-group component mounted in both entry points, not two parallel forms — avoids drift between the two creation paths.

Both entry points always produce a real `Mission` row under the hood, so the calendar shows every audit externe automatically with zero changes to the calendar API or `calendar-workspace.tsx`.

## 6. Validation & error handling

- New Zod schema `packages/shared/src/schemas/audit-externe.schema.ts`: `typeAudit`/`reference` enums, required `clientId`/`responsableId`/`organisme`/`auditeur`, chronological start/end check (mirrors `missionBaseObjectSchema`'s `.refine`), `.partial()` + required `version` for the update variant — same convention as `mission.schema.ts`.
- Same optimistic-lock `version` check as every other mutable entity in this codebase.

## 7. Testing

No automated test runner exists in this repo yet. This feature will be verified manually end-to-end after implementation:
- Create an audit ≤3 months out → confirm immediate push + in-app notification.
- Create an audit >3 months out → confirm no notification yet.
- Manually trigger the cron job's underlying logic → confirm it picks up audits that have since crossed the 3-month threshold.
- Edit an audit's date after its reminder fired → confirm `reminderSentAt` resets and re-evaluates.
- Create an audit externe both from `/audit-externe/nouveau` and from the calendar's mission form → confirm both appear correctly on `/calendar` and in the `/audit-externe` list.

## 8. Out of scope (explicitly deferred)

- Reminders at intervals other than 3 months (e.g. 1 month, 1 week) — not requested, easy to add later given the eligibility-query design.
- Email delivery — AGENTS.md lists email as deferred project-wide; this feature uses push + in-app only.
- Reassignment history — if the Responsable changes, only the current Responsable is considered for future reminders; no notification to a previous Responsable.
