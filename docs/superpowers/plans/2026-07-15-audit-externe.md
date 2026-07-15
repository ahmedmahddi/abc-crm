# Audit Externe Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a full-CRUD "Audit Externe" feature (certification/suivi audits) with a dedicated list page, calendar integration via the existing `Mission` model, and an automatic 3-month-advance reminder (push + in-app) to the responsible user.

**Architecture:** `AuditExterne` is a satellite table linked 1:1 to `Mission` (same pattern as the existing `OrdreMission` ↔ `Mission` relation) — `Mission` already supports `missionType: AUDIT_EXTERNE` end-to-end (enum, calendar badge, labels), so no calendar code changes are needed. A new `AppNotification` model backs an in-app notification bell (nothing like it exists yet). A new `@nestjs/schedule` cron job plus a synchronous post-create/update check share one `notifyAndMarkSent` code path to fire reminders.

**Tech Stack:** NestJS (Zod validation via `parseInput`, Prisma transactions, `@Roles`/`CsrfGuard`/`RolesGuard`), Next.js App Router + React Hook Form + Zod + TanStack Query, `@nestjs/schedule` (new dependency), existing `web-push`/VAPID push infra.

## Global Constraints

- Full CRUD for Audit Externe: create, read (list + detail), update, archive (soft-delete via the underlying Mission's `archivedAt`) — no hard delete, matching every other entity in this codebase.
- Reminder timing: exactly 3 months before `mission.startDateTime`, for **all three** audit types (Certification, Suivi 1, Suivi 2) — not just Suivi 1/2.
- Reminder delivery: web push **and** in-app notification, both from one shared trigger function.
- Reminder triggers: synchronous check right after create/update (catches "already under 3 months") **and** a nightly cron sweep (catches audits crossing the threshold over time).
- Editing an audit's start/end date-time resets `reminderSentAt` to null so it re-enters the eligibility pool.
- `responsableId` references `User` directly (any role) — not `Consultant`.
- `organisme` and `auditeur` are free text (external parties).
- `reference` is a fixed 6-value set: 9001, QSE, 22000, FSSC, BRC, BRC+IFS.
- `typeAudit` is a fixed 3-value set: Certification, Suivi 1, Suivi 2.
- No separate "date d'audit" field — it's `mission.startDateTime`/`endDateTime` (full date-time picker, same as regular mission creation).
- Creatable from both `/audit-externe/nouveau` and inline from the calendar's mission-create form when `missionType = AUDIT_EXTERNE` is selected — one shared field-group component, not two parallel forms.
- No automated test runner exists in this repo — verification is `pnpm typecheck`/`pnpm --filter X build` plus manual dev-server/curl checks, matching how the rest of this codebase is currently verified.
- Full spec: `docs/superpowers/specs/2026-07-15-audit-externe-design.md`.

---

## File Structure Overview

**Backend (new):**
- `apps/api/src/audit-externe/audit-externe.controller.ts` — routes
- `apps/api/src/audit-externe/audit-externe.service.ts` — CRUD + CSV export + responsables lookup
- `apps/api/src/audit-externe/audit-externe-reminder.service.ts` — eligibility check, notify-and-mark, cron
- `apps/api/src/audit-externe/audit-externe.module.ts` — module wiring

**Backend (modified):**
- `packages/db/prisma/schema.prisma` — new enums/models
- `apps/api/src/notifications/notifications.service.ts` — add `AppNotification` methods
- `apps/api/src/notifications/notifications.controller.ts` — add list/mark-read routes
- `apps/api/src/app.module.ts` — register `AuditExterneModule` + `ScheduleModule.forRoot()`
- `apps/api/package.json` — add `@nestjs/schedule`

**Shared (new):**
- `packages/shared/src/schemas/audit-externe.schema.ts`

**Shared (modified):**
- `packages/shared/src/domain.ts` — audit type/reference enums + labels
- `packages/shared/src/index.ts` — export new schema file

**Frontend (new):**
- `apps/web/src/components/audit-externe/audit-externe-fields.tsx` — shared field-group (client, dates, mode, location, audit-specific fields)
- `apps/web/src/components/audit-externe/audit-externe-list.tsx`
- `apps/web/src/components/audit-externe/audit-externe-create-form.tsx`
- `apps/web/src/components/audit-externe/audit-externe-edit-form.tsx`
- `apps/web/src/components/audit-externe/audit-externe-detail.tsx`
- `apps/web/src/app/audit-externe/page.tsx`
- `apps/web/src/app/audit-externe/nouveau/page.tsx`
- `apps/web/src/app/audit-externe/[id]/page.tsx`
- `apps/web/src/app/audit-externe/[id]/modifier/page.tsx`
- `apps/web/src/components/notifications/notification-bell.tsx`

**Frontend (modified):**
- `apps/web/src/components/missions/mission-create-form.tsx` — inline audit fields + conditional submit target
- `apps/web/src/components/layout/sidebar.tsx` — new nav item
- `apps/web/src/app/more/page.tsx` — new mobile section entry
- `apps/web/src/components/layout/app-header.tsx` — mount notification bell

---

### Task 1: Prisma schema — enums, models, relations

**Files:**
- Modify: `packages/db/prisma/schema.prisma`

**Interfaces:**
- Produces: `AuditExterneType`, `AuditExterneReference` enums; `AuditExterne` model (`id, missionId, clientId, typeAudit, reference, organisme, auditeur, responsableId, reminderSentAt, createdAt, updatedAt, version`); `AppNotification` model (`id, userId, type, title, body, entityType, entityId, readAt, createdAt`).

- [ ] **Step 1: Add the two new enums**

In `packages/db/prisma/schema.prisma`, immediately after the existing `enum SyncMutationStatus { ... }` block (around line 113), insert:

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
```

- [ ] **Step 2: Add the `AuditExterne` and `AppNotification` models**

At the end of the file, after the existing `model PushSubscription { ... }` block, append:

```prisma

model AuditExterne {
  id             String                @id @default(uuid())
  missionId      String                @unique
  clientId       String
  typeAudit      AuditExterneType
  reference      AuditExterneReference
  organisme      String
  auditeur       String
  responsableId  String
  reminderSentAt DateTime?
  createdAt      DateTime              @default(now())
  updatedAt      DateTime              @updatedAt
  version        Int                   @default(1)

  mission        Mission @relation(fields: [missionId], references: [id], onDelete: Cascade)
  client         Client  @relation(fields: [clientId], references: [id])
  responsable    User    @relation(fields: [responsableId], references: [id])

  @@index([clientId])
  @@index([responsableId])
}

model AppNotification {
  id         String    @id @default(uuid())
  userId     String
  type       String
  title      String
  body       String
  entityType String
  entityId   String
  readAt     DateTime?
  createdAt  DateTime  @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, readAt])
}
```

- [ ] **Step 3: Add back-relation fields**

In `model User` (around line 115-135), add two fields to the relations block just above the closing `}`:

```prisma
  auditExternesResponsable AuditExterne[]
  appNotifications         AppNotification[]
```
(insert right after the existing `consultant      Consultant?` line)

In `model Client` (around line 184-211), add one field to the relations block:

```prisma
  auditExternes         AuditExterne[]
```
(insert right after the existing `ordresMission         OrdreMission[]` line)

In `model Mission` (around line 274-303), add one field:

```prisma
  auditExterne   AuditExterne?
```
(insert right after the existing `ordreMission   OrdreMission?` line)

- [ ] **Step 4: Generate and apply the migration**

Run: `pnpm --filter @abc/db prisma:migrate` (this is `prisma migrate dev` under the hood — it will prompt for a migration name; use `add_audit_externe`)

Expected: a new folder `packages/db/prisma/migrations/<timestamp>_add_audit_externe/migration.sql` is created and applied; output ends with "Your database is now in sync with your schema."

If the interactive prompt can't be answered non-interactively, run instead: `npx dotenv -e ../../.env -- npx prisma migrate dev --name add_audit_externe --schema prisma/schema.prisma` from `packages/db`.

- [ ] **Step 5: Regenerate the Prisma client and rebuild `@abc/db`**

Run: `pnpm db:generate && pnpm --filter @abc/db build`
Expected: "Generated Prisma Client" then a clean `tsc` build with no errors.

- [ ] **Step 6: Commit**

```bash
git add packages/db/prisma/schema.prisma packages/db/prisma/migrations
git commit -m "feat(db): add AuditExterne and AppNotification models"
```

---

### Task 2: Shared domain constants and Zod schema

**Files:**
- Modify: `packages/shared/src/domain.ts`
- Create: `packages/shared/src/schemas/audit-externe.schema.ts`
- Modify: `packages/shared/src/index.ts`

**Interfaces:**
- Consumes: none (pure domain layer).
- Produces: `AUDIT_EXTERNE_TYPES`, `AUDIT_EXTERNE_TYPE_LABELS`, `AUDIT_EXTERNE_REFERENCES`, `AUDIT_EXTERNE_REFERENCE_LABELS`, `AUDIT_EXTERNE_REMINDER_MONTHS_BEFORE` (from `domain.ts`); `auditExterneCreateSchema`, `auditExterneUpdateSchema`, `auditExterneListQuerySchema`, `AuditExterneCreateInput`, `AuditExterneUpdateInput`, `AuditExterneListQuery` (from the new schema file) — consumed by Task 4 (backend service) and Tasks 7-11 (frontend forms).

- [ ] **Step 1: Add domain constants**

In `packages/shared/src/domain.ts`, append at the end of the file:

```typescript
export const AUDIT_EXTERNE_TYPES = ["CERTIFICATION", "SUIVI_1", "SUIVI_2"] as const;
export type AuditExterneType = (typeof AUDIT_EXTERNE_TYPES)[number];
export const AUDIT_EXTERNE_TYPE_LABELS: Record<AuditExterneType, string> = {
  CERTIFICATION: "Certification",
  SUIVI_1: "Suivi 1",
  SUIVI_2: "Suivi 2",
};

export const AUDIT_EXTERNE_REFERENCES = ["NORME_9001", "QSE", "NORME_22000", "FSSC", "BRC", "BRC_IFS"] as const;
export type AuditExterneReference = (typeof AUDIT_EXTERNE_REFERENCES)[number];
export const AUDIT_EXTERNE_REFERENCE_LABELS: Record<AuditExterneReference, string> = {
  NORME_9001: "9001",
  QSE: "QSE",
  NORME_22000: "22000",
  FSSC: "FSSC",
  BRC: "BRC",
  BRC_IFS: "BRC+IFS",
};

export const AUDIT_EXTERNE_REMINDER_MONTHS_BEFORE = 3;
```

- [ ] **Step 2: Write the Zod schema file**

Create `packages/shared/src/schemas/audit-externe.schema.ts`:

```typescript
import { z } from "zod";
import { AUDIT_EXTERNE_REFERENCES, AUDIT_EXTERNE_TYPES } from "../domain";

const auditExterneChronologyRule = (value: { startDateTime?: Date | undefined; endDateTime?: Date | undefined }) =>
  !value.startDateTime || !value.endDateTime || value.endDateTime > value.startDateTime;

const auditExterneBaseObjectSchema = z.object({
  clientId: z.string().uuid(),
  typeAudit: z.enum(AUDIT_EXTERNE_TYPES),
  reference: z.enum(AUDIT_EXTERNE_REFERENCES),
  organisme: z.string().trim().min(2),
  auditeur: z.string().trim().min(2),
  responsableId: z.string().uuid(),
  missionMode: z.enum(["ONLINE", "PRESENTIELLE"]),
  startDateTime: z.coerce.date(),
  endDateTime: z.coerce.date(),
  location: z.string().optional().or(z.literal("")),
});

export const auditExterneCreateSchema = auditExterneBaseObjectSchema.refine(auditExterneChronologyRule, {
  message: "La date de fin doit etre posterieure a la date de debut",
  path: ["endDateTime"],
});

export const auditExterneUpdateSchema = auditExterneBaseObjectSchema
  .partial()
  .extend({
    version: z.coerce.number().int().positive(),
  })
  .refine(auditExterneChronologyRule, {
    message: "La date de fin doit etre posterieure a la date de debut",
    path: ["endDateTime"],
  });

export const auditExterneListQuerySchema = z.object({
  q: z.string().trim().optional(),
  page: z.coerce.number().int().positive().default(1),
  perPage: z.coerce.number().int().positive().max(100).default(20),
  typeAudit: z.enum(AUDIT_EXTERNE_TYPES).optional(),
  reference: z.enum(AUDIT_EXTERNE_REFERENCES).optional(),
  clientId: z.string().uuid().optional(),
  responsableId: z.string().uuid().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  sortBy: z.enum(["startDateTime", "companyName", "typeAudit"]).default("startDateTime"),
  sortDir: z.enum(["asc", "desc"]).default("asc"),
});

export type AuditExterneCreateInput = z.infer<typeof auditExterneCreateSchema>;
export type AuditExterneUpdateInput = z.infer<typeof auditExterneUpdateSchema>;
export type AuditExterneListQuery = z.infer<typeof auditExterneListQuerySchema>;
```

- [ ] **Step 3: Export the new schema file**

In `packages/shared/src/index.ts`, add a line (alphabetically, after `auth.schema`):

```typescript
export * from "./schemas/audit-externe.schema";
```

- [ ] **Step 4: Build and typecheck**

Run: `pnpm --filter @abc/shared build && pnpm --filter @abc/shared typecheck`
Expected: both succeed with no errors.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/domain.ts packages/shared/src/schemas/audit-externe.schema.ts packages/shared/src/index.ts
git commit -m "feat(shared): add audit externe domain constants and validation schema"
```

---

### Task 3: In-app notification center (backend)

**Files:**
- Modify: `apps/api/src/notifications/notifications.service.ts`
- Modify: `apps/api/src/notifications/notifications.controller.ts`

**Interfaces:**
- Consumes: `Prisma` client (`prisma.appNotification`), existing `sendToUsers` method (unchanged).
- Produces: `NotificationsService.notifyUser(userId, params)`, `NotificationsService.listForUser(userId)`, `NotificationsService.markRead(id, userId)` — consumed by Task 5 (reminder service) and Task 13 (frontend bell).

- [ ] **Step 1: Add `notifyUser`, `listForUser`, `markRead` to `NotificationsService`**

In `apps/api/src/notifications/notifications.service.ts`, add this type near the top (after the existing `PushPayload` type):

```typescript
type AppNotificationParams = {
  userId: string;
  type: string;
  title: string;
  body: string;
  entityType: string;
  entityId: string;
  url?: string;
};
```

Add these three methods inside the `NotificationsService` class, after the existing `sendToUsers` method:

```typescript
  async notifyUser(params: AppNotificationParams) {
    await this.prisma.appNotification.create({
      data: {
        userId: params.userId,
        type: params.type,
        title: params.title,
        body: params.body,
        entityType: params.entityType,
        entityId: params.entityId,
      },
    });
    return this.sendToUsers([params.userId], {
      title: params.title,
      body: params.body,
      url: params.url,
      tag: `${params.entityType.toLowerCase()}-${params.entityId}`,
    });
  }

  async listForUser(userId: string) {
    const [notifications, unreadCount] = await this.prisma.$transaction([
      this.prisma.appNotification.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 30,
      }),
      this.prisma.appNotification.count({ where: { userId, readAt: null } }),
    ]);
    return { data: notifications, meta: { unreadCount } };
  }

  async markRead(id: string, userId: string) {
    await this.prisma.appNotification.updateMany({
      where: { id, userId, readAt: null },
      data: { readAt: new Date() },
    });
    return { data: { ok: true } };
  }
```

- [ ] **Step 2: Add the two new routes to `NotificationsController`**

Read the current file first to match its exact imports/guard usage, then add:

```typescript
  @Get()
  list(@Req() request: AuthenticatedRequest) {
    return this.service.listForUser(request.user.id);
  }

  @Post(":id/read")
  markRead(@Param("id") id: string, @Req() request: AuthenticatedRequest) {
    return this.service.markRead(id, request.user.id);
  }
```

(add `Get, Param` to the existing `@nestjs/common` import if not already present; these two routes sit under the existing `@Controller("notifications")` class, guarded by the class-level `JwtAuthGuard` already in place — no `@Roles` restriction needed, every authenticated user reads their own notifications)

- [ ] **Step 3: Typecheck the API**

Run: `pnpm --filter @abc/api typecheck`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/notifications/notifications.service.ts apps/api/src/notifications/notifications.controller.ts
git commit -m "feat(api): add in-app notification list and mark-read endpoints"
```

---

### Task 4: Audit Externe backend module (CRUD)

**Files:**
- Create: `apps/api/src/audit-externe/audit-externe.controller.ts`
- Create: `apps/api/src/audit-externe/audit-externe.service.ts`
- Create: `apps/api/src/audit-externe/audit-externe.module.ts`

**Interfaces:**
- Consumes: `auditExterneCreateSchema`/`auditExterneUpdateSchema`/`auditExterneListQuerySchema` (Task 2), `PrismaService`, `NotificationsModule` (for the module import; the reminder service itself is added in Task 5 and injected here).
- Produces: `AuditExterneService` with `findMany`, `findOne`, `create`, `update`, `archive`, `exportCsv`, `listResponsables` — routes `GET/POST /audit-externe`, `GET /audit-externe/export.csv`, `GET/PATCH /audit-externe/:id`, `POST /audit-externe/:id/archive`, `GET /audit-externe/responsables`. Consumed by Task 6 (module registration) and Tasks 8-11 (frontend).

- [ ] **Step 1: Write `audit-externe.service.ts`**

```typescript
import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@abc/db";
import {
  AUDIT_EXTERNE_REMINDER_MONTHS_BEFORE,
  auditExterneCreateSchema,
  auditExterneListQuerySchema,
  auditExterneUpdateSchema,
  MISSION_TYPE_LABELS,
  type AuditExterneCreateInput,
  type AuditExterneUpdateInput,
} from "@abc/shared";
import { z } from "zod";
import { AuditExterneReminderService } from "./audit-externe-reminder.service";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class AuditExterneService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reminder: AuditExterneReminderService,
  ) {}

  async findMany(query: unknown) {
    const { page, perPage, q, typeAudit, reference, clientId, responsableId, from, to, sortBy, sortDir } = parseInput(
      auditExterneListQuerySchema,
      query,
    );
    const where = buildWhere({ q, typeAudit, reference, clientId, responsableId, from, to });

    const [records, total] = await this.prisma.$transaction([
      this.prisma.auditExterne.findMany({
        where,
        include: auditExterneInclude,
        orderBy: buildOrderBy(sortBy, sortDir),
        skip: (page - 1) * perPage,
        take: perPage,
      }),
      this.prisma.auditExterne.count({ where }),
    ]);

    return {
      data: records.map(toAuditExterneSummary),
      meta: { page, perPage, total, totalPages: Math.ceil(total / perPage) },
    };
  }

  async exportCsv(query: unknown) {
    const { q, typeAudit, reference, clientId, responsableId, from, to, sortBy, sortDir } = parseInput(
      auditExterneListQuerySchema,
      query,
    );
    const where = buildWhere({ q, typeAudit, reference, clientId, responsableId, from, to });
    const records = await this.prisma.auditExterne.findMany({
      where,
      include: auditExterneInclude,
      orderBy: buildOrderBy(sortBy, sortDir),
    });
    const rows = [
      ["Client", "Date d'audit", "Type d'audit", "Reference", "Organisme", "Auditeur", "Responsable", "Statut"],
      ...records.map((record) => [
        record.client.companyName,
        record.mission.startDateTime.toISOString().slice(0, 10),
        record.typeAudit,
        record.reference,
        record.organisme,
        record.auditeur,
        record.responsable.name,
        record.mission.status,
      ]),
    ];
    return {
      content: `﻿${rows.map((row) => row.map(escapeCsvCell).join(",")).join("\r\n")}`,
      filename: `audit-externe-${new Date().toISOString().slice(0, 10)}.csv`,
    };
  }

  async findOne(id: string) {
    const record = await this.prisma.auditExterne.findUnique({ where: { id }, include: auditExterneInclude });
    if (!record || record.mission.archivedAt) throw new NotFoundException("Audit externe introuvable");
    return { data: toAuditExterneSummary(record) };
  }

  async listResponsables() {
    const users = await this.prisma.user.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, name: true, email: true },
      orderBy: { name: "asc" },
    });
    return { data: users };
  }

  async create(body: unknown, userId: string) {
    const input = parseInput(auditExterneCreateSchema, body);
    try {
      const created = await this.prisma.$transaction(async (transaction) => {
        await assertClientExists(transaction, input.clientId);
        await assertResponsableExists(transaction, input.responsableId);

        const client = await transaction.client.findUniqueOrThrow({ where: { id: input.clientId } });
        const mission = await transaction.mission.create({
          data: {
            title: `Audit externe - ${MISSION_TYPE_LABELS.AUDIT_EXTERNE} - ${client.companyName}`,
            missionType: "AUDIT_EXTERNE",
            missionMode: input.missionMode,
            startDateTime: input.startDateTime,
            endDateTime: input.endDateTime,
            location: input.location || null,
            status: "PLANNED",
            client: { connect: { id: input.clientId } },
            createdBy: { connect: { id: userId } },
          },
        });

        const auditExterne = await transaction.auditExterne.create({
          data: {
            typeAudit: input.typeAudit,
            reference: input.reference,
            organisme: input.organisme,
            auditeur: input.auditeur,
            mission: { connect: { id: mission.id } },
            client: { connect: { id: input.clientId } },
            responsable: { connect: { id: input.responsableId } },
          },
          include: auditExterneInclude,
        });

        await transaction.activityLog.create({
          data: {
            userId,
            action: "AUDIT_EXTERNE_CREATED",
            entityType: "AUDIT_EXTERNE",
            entityId: auditExterne.id,
            description: `Audit externe cree: ${mission.title}`,
          },
        });

        return auditExterne;
      });
      await this.reminder.checkAndNotifyIfDue(created.id);
      return { data: toAuditExterneSummary(created) };
    } catch (error) {
      handleKnownDatabaseError(error);
    }
  }

  async update(id: string, body: unknown, userId: string) {
    const input = parseInput(auditExterneUpdateSchema, body);
    try {
      const updated = await this.prisma.$transaction(async (transaction) => {
        const current = await transaction.auditExterne.findUnique({ where: { id }, include: auditExterneInclude });
        if (!current || current.mission.archivedAt) throw new NotFoundException("Audit externe introuvable");
        if (current.version !== input.version) {
          throw new ConflictException("L'audit externe a ete modifie depuis votre derniere consultation");
        }
        if (input.clientId) await assertClientExists(transaction, input.clientId);
        if (input.responsableId) await assertResponsableExists(transaction, input.responsableId);

        const dateChanged =
          (input.startDateTime !== undefined && input.startDateTime.getTime() !== current.mission.startDateTime.getTime()) ||
          (input.endDateTime !== undefined && input.endDateTime.getTime() !== current.mission.endDateTime.getTime());

        await transaction.mission.update({
          where: { id: current.missionId },
          data: {
            ...(input.clientId !== undefined ? { client: { connect: { id: input.clientId } } } : {}),
            ...(input.missionMode !== undefined ? { missionMode: input.missionMode } : {}),
            ...(input.startDateTime !== undefined ? { startDateTime: input.startDateTime } : {}),
            ...(input.endDateTime !== undefined ? { endDateTime: input.endDateTime } : {}),
            ...(input.location !== undefined ? { location: input.location || null } : {}),
            version: { increment: 1 },
          },
        });

        const result = await transaction.auditExterne.update({
          where: { id },
          data: {
            ...(input.typeAudit !== undefined ? { typeAudit: input.typeAudit } : {}),
            ...(input.reference !== undefined ? { reference: input.reference } : {}),
            ...(input.organisme !== undefined ? { organisme: input.organisme } : {}),
            ...(input.auditeur !== undefined ? { auditeur: input.auditeur } : {}),
            ...(input.clientId !== undefined ? { client: { connect: { id: input.clientId } } } : {}),
            ...(input.responsableId !== undefined ? { responsable: { connect: { id: input.responsableId } } } : {}),
            ...(dateChanged ? { reminderSentAt: null } : {}),
            version: { increment: 1 },
          },
          include: auditExterneInclude,
        });

        await transaction.activityLog.create({
          data: { userId, action: "AUDIT_EXTERNE_UPDATED", entityType: "AUDIT_EXTERNE", entityId: id },
        });
        return result;
      });
      await this.reminder.checkAndNotifyIfDue(updated.id);
      return { data: toAuditExterneSummary(updated) };
    } catch (error) {
      handleKnownDatabaseError(error);
    }
  }

  async archive(id: string, userId: string) {
    const record = await this.prisma.$transaction(async (transaction) => {
      const current = await transaction.auditExterne.findUnique({ where: { id }, include: auditExterneInclude });
      if (!current || current.mission.archivedAt) throw new NotFoundException("Audit externe introuvable");
      await transaction.mission.update({
        where: { id: current.missionId },
        data: {
          archivedAt: new Date(),
          cancelledAt: new Date(),
          cancellationType: "INTERNAL",
          status: "CANCELLED",
          version: { increment: 1 },
        },
      });
      await transaction.activityLog.create({
        data: { userId, action: "AUDIT_EXTERNE_ARCHIVED", entityType: "AUDIT_EXTERNE", entityId: id },
      });
      return transaction.auditExterne.findUniqueOrThrow({ where: { id }, include: auditExterneInclude });
    });
    return { data: toAuditExterneSummary(record) };
  }
}

const auditExterneInclude = {
  client: { select: { id: true, companyName: true, color: true } },
  responsable: { select: { id: true, name: true, email: true } },
  mission: {
    select: { id: true, startDateTime: true, endDateTime: true, missionMode: true, location: true, status: true, archivedAt: true, version: true },
  },
} satisfies Prisma.AuditExterneInclude;

type AuditExterneWithRelations = Prisma.AuditExterneGetPayload<{ include: typeof auditExterneInclude }>;

function buildWhere(filters: {
  q?: string;
  typeAudit?: string;
  reference?: string;
  clientId?: string;
  responsableId?: string;
  from?: Date;
  to?: Date;
}): Prisma.AuditExterneWhereInput {
  return {
    mission: {
      archivedAt: null,
      ...(filters.from ? { startDateTime: { gte: filters.from } } : {}),
      ...(filters.to ? { startDateTime: { lte: filters.to } } : {}),
    },
    ...(filters.typeAudit ? { typeAudit: filters.typeAudit as Prisma.EnumAuditExterneTypeFilter["equals"] } : {}),
    ...(filters.reference ? { reference: filters.reference as Prisma.EnumAuditExterneReferenceFilter["equals"] } : {}),
    ...(filters.clientId ? { clientId: filters.clientId } : {}),
    ...(filters.responsableId ? { responsableId: filters.responsableId } : {}),
    ...(filters.q
      ? {
          OR: [
            { organisme: { contains: filters.q, mode: "insensitive" } },
            { auditeur: { contains: filters.q, mode: "insensitive" } },
            { client: { companyName: { contains: filters.q, mode: "insensitive" } } },
          ],
        }
      : {}),
  };
}

function buildOrderBy(sortBy: string, sortDir: "asc" | "desc"): Prisma.AuditExterneOrderByWithRelationInput {
  if (sortBy === "companyName") return { client: { companyName: sortDir } };
  if (sortBy === "typeAudit") return { typeAudit: sortDir };
  return { mission: { startDateTime: sortDir } };
}

function toAuditExterneSummary(record: AuditExterneWithRelations) {
  return {
    id: record.id,
    version: record.version,
    typeAudit: record.typeAudit,
    reference: record.reference,
    organisme: record.organisme,
    auditeur: record.auditeur,
    reminderSentAt: record.reminderSentAt,
    client: record.client,
    responsable: record.responsable,
    startDateTime: record.mission.startDateTime,
    endDateTime: record.mission.endDateTime,
    missionMode: record.mission.missionMode,
    location: record.mission.location,
    status: record.mission.status,
    missionId: record.mission.id,
    missionVersion: record.mission.version,
  };
}

async function assertClientExists(transaction: Prisma.TransactionClient, clientId: string) {
  const client = await transaction.client.findUnique({ where: { id: clientId }, select: { id: true, status: true } });
  if (!client || client.status === "ARCHIVED") throw new BadRequestException("Client introuvable ou archive");
}

async function assertResponsableExists(transaction: Prisma.TransactionClient, responsableId: string) {
  const user = await transaction.user.findUnique({ where: { id: responsableId }, select: { id: true, status: true } });
  if (!user || user.status !== "ACTIVE") throw new BadRequestException("Responsable introuvable ou inactif");
}

function escapeCsvCell(value: string) {
  return /[",\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

function parseInput<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (result.success) return result.data;
  throw new BadRequestException({
    error: {
      code: "validation_error",
      message: "La requete contient des champs invalides",
      details: z.flattenError(result.error).fieldErrors,
    },
  });
}

function handleKnownDatabaseError(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    throw new ConflictException("Une contrainte d'unicite empeche cette operation");
  }
  throw error;
}
```

Note: `AuditExterneCreateInput`/`AuditExterneUpdateInput` types are imported but only used implicitly through `parseInput`'s inference — if `tsc` flags them as unused after Step 4's typecheck, remove the unused named imports (keep only the schemas and `AUDIT_EXTERNE_REMINDER_MONTHS_BEFORE`/`MISSION_TYPE_LABELS`).

- [ ] **Step 2: Write `audit-externe.controller.ts`**

```typescript
import { Body, Controller, Get, Param, Patch, Post, Query, Req, Res, UseGuards } from "@nestjs/common";
import type { Response } from "express";
import { Roles } from "../auth/decorators/roles.decorator";
import { CsrfGuard } from "../auth/guards/csrf.guard";
import { JwtAuthGuard, type AuthenticatedRequest } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { AuditExterneService } from "./audit-externe.service";

@Controller("audit-externe")
@UseGuards(JwtAuthGuard)
export class AuditExterneController {
  constructor(private readonly service: AuditExterneService) {}

  @Get()
  findMany(@Query() query: unknown) {
    return this.service.findMany(query);
  }

  @Get("export.csv")
  async exportCsv(@Query() query: unknown, @Res({ passthrough: true }) response: Response) {
    const exportFile = await this.service.exportCsv(query);
    response.setHeader("Content-Type", "text/csv; charset=utf-8");
    response.setHeader("Content-Disposition", `attachment; filename="${exportFile.filename}"`);
    return exportFile.content;
  }

  @Get("responsables")
  listResponsables() {
    return this.service.listResponsables();
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @Roles("ADMIN", "RESPONSABLE")
  @UseGuards(CsrfGuard, RolesGuard)
  create(@Body() body: unknown, @Req() request: AuthenticatedRequest) {
    return this.service.create(body, request.user.id);
  }

  @Patch(":id")
  @Roles("ADMIN", "RESPONSABLE")
  @UseGuards(CsrfGuard, RolesGuard)
  update(@Param("id") id: string, @Body() body: unknown, @Req() request: AuthenticatedRequest) {
    return this.service.update(id, body, request.user.id);
  }

  @Post(":id/archive")
  @Roles("ADMIN", "RESPONSABLE")
  @UseGuards(CsrfGuard, RolesGuard)
  archive(@Param("id") id: string, @Req() request: AuthenticatedRequest) {
    return this.service.archive(id, request.user.id);
  }
}
```

Important: `@Get("export.csv")` and `@Get("responsables")` must be declared **before** `@Get(":id")` in the class body (Nest matches routes in declaration order) — the code above already has them in the right order.

- [ ] **Step 3: Write `audit-externe.module.ts`**

```typescript
import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { AuditExterneController } from "./audit-externe.controller";
import { AuditExterneReminderService } from "./audit-externe-reminder.service";
import { AuditExterneService } from "./audit-externe.service";

@Module({
  imports: [AuthModule, NotificationsModule],
  controllers: [AuditExterneController],
  providers: [AuditExterneService, AuditExterneReminderService],
  exports: [AuditExterneService],
})
export class AuditExterneModule {}
```

(this references `AuditExterneReminderService`, written in Task 5 — that's fine, TypeScript project references resolve once both files exist; Task 4's typecheck step below will fail until Task 5 exists, so **do Task 5 immediately after this task before typechecking**, or write a placeholder file now — see Task 5 Step 1 which must land before this task's Step 4 can pass)

- [ ] **Step 4: Typecheck (after Task 5's reminder service file exists)**

Run: `pnpm --filter @abc/api typecheck`
Expected: no errors once Task 5 is also in place.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/audit-externe/audit-externe.controller.ts apps/api/src/audit-externe/audit-externe.service.ts apps/api/src/audit-externe/audit-externe.module.ts
git commit -m "feat(api): add audit externe CRUD module"
```

---

### Task 5: Reminder mechanism (cron + synchronous check)

**Files:**
- Create: `apps/api/src/audit-externe/audit-externe-reminder.service.ts`
- Modify: `apps/api/package.json` (new dependency)
- Modify: `apps/api/src/app.module.ts` (register `ScheduleModule.forRoot()`)

**Interfaces:**
- Consumes: `PrismaService`, `NotificationsService.notifyUser` (Task 3).
- Produces: `AuditExterneReminderService.checkAndNotifyIfDue(auditExterneId)` (consumed by Task 4's service), `AuditExterneReminderService.runNightlySweep()` (self-scheduled via `@Cron`).

- [ ] **Step 1: Add the `@nestjs/schedule` dependency**

Run: `pnpm add @nestjs/schedule --filter @abc/api`
Expected: `apps/api/package.json` gets a new `@nestjs/schedule` entry in `dependencies`.

- [ ] **Step 2: Write `audit-externe-reminder.service.ts`**

```typescript
import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { AUDIT_EXTERNE_REMINDER_MONTHS_BEFORE, AUDIT_EXTERNE_TYPE_LABELS } from "@abc/shared";
import { NotificationsService } from "../notifications/notifications.service";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class AuditExterneReminderService {
  private readonly logger = new Logger(AuditExterneReminderService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async runNightlySweep() {
    const dueRecords = await this.findDueRecords();
    for (const record of dueRecords) {
      await this.notifyAndMarkSent(record);
    }
    if (dueRecords.length > 0) {
      this.logger.log(`Sent ${dueRecords.length} audit externe reminder(s) via nightly sweep`);
    }
  }

  async checkAndNotifyIfDue(auditExterneId: string) {
    const record = await this.prisma.auditExterne.findUnique({
      where: { id: auditExterneId },
      include: reminderInclude,
    });
    if (!record) return;
    if (!this.isDue(record)) return;
    await this.notifyAndMarkSent(record);
  }

  private async findDueRecords() {
    const threshold = addMonths(new Date(), AUDIT_EXTERNE_REMINDER_MONTHS_BEFORE);
    return this.prisma.auditExterne.findMany({
      where: {
        reminderSentAt: null,
        mission: { archivedAt: null, status: "PLANNED", startDateTime: { lte: threshold } },
      },
      include: reminderInclude,
    });
  }

  private isDue(record: ReminderRecord) {
    if (record.reminderSentAt) return false;
    if (record.mission.archivedAt || record.mission.status !== "PLANNED") return false;
    const threshold = addMonths(new Date(), AUDIT_EXTERNE_REMINDER_MONTHS_BEFORE);
    return record.mission.startDateTime <= threshold;
  }

  private async notifyAndMarkSent(record: ReminderRecord) {
    const typeLabel = AUDIT_EXTERNE_TYPE_LABELS[record.typeAudit];
    const result = await this.notifications.notifyUser({
      userId: record.responsableId,
      type: "AUDIT_EXTERNE_REMINDER",
      title: "Audit externe a venir",
      body: `${record.client.companyName} - ${typeLabel} le ${record.mission.startDateTime.toLocaleDateString("fr-FR")}`,
      entityType: "AUDIT_EXTERNE",
      entityId: record.id,
      url: `/audit-externe/${record.id}`,
    });
    if (result.data.sent === 0) {
      this.logger.warn(`No push delivered for audit externe reminder ${record.id}; in-app notification still created`);
    }
    await this.prisma.auditExterne.update({ where: { id: record.id }, data: { reminderSentAt: new Date() } });
  }
}

const reminderInclude = {
  client: { select: { companyName: true } },
  mission: { select: { startDateTime: true, status: true, archivedAt: true } },
} as const;

type ReminderRecord = {
  id: string;
  responsableId: string;
  typeAudit: "CERTIFICATION" | "SUIVI_1" | "SUIVI_2";
  reminderSentAt: Date | null;
  client: { companyName: string };
  mission: { startDateTime: Date; status: string; archivedAt: Date | null };
};

function addMonths(date: Date, months: number) {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}
```

- [ ] **Step 3: Register `ScheduleModule` in `AppModule`**

In `apps/api/src/app.module.ts`, add the import:

```typescript
import { ScheduleModule } from "@nestjs/schedule";
```

And add `ScheduleModule.forRoot()` as the first entry in the `imports` array (before `ConfigModule.forRoot(...)`).

- [ ] **Step 4: Typecheck the API (this also validates Task 4)**

Run: `pnpm --filter @abc/api typecheck`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add apps/api/package.json apps/api/src/audit-externe/audit-externe-reminder.service.ts apps/api/src/app.module.ts pnpm-lock.yaml
git commit -m "feat(api): add audit externe reminder scheduler"
```

---

### Task 6: Register the Audit Externe module in AppModule

**Files:**
- Modify: `apps/api/src/app.module.ts`

**Interfaces:**
- Consumes: `AuditExterneModule` (Task 4).

- [ ] **Step 1: Add the import and registration**

In `apps/api/src/app.module.ts`, add:

```typescript
import { AuditExterneModule } from "./audit-externe/audit-externe.module";
```

And add `AuditExterneModule` to the `imports` array (alphabetically, after `AuthModule` and before `ClientsModule`).

- [ ] **Step 2: Start the API and verify routes are mapped**

Run: `pnpm --filter @abc/db build && pnpm --filter @abc/api typecheck` then start the dev server (`pnpm dev`, or just `pnpm --filter @abc/api dev` in the background) and check the startup log for `AuditExterneController` route mappings (e.g. `Mapped {/api/v1/audit-externe, GET} route`).
Expected: all `audit-externe` routes appear in the Nest startup log, and `curl http://localhost:4000/api/v1/health` still returns `{"status":"ok",...}`.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/app.module.ts
git commit -m "feat(api): register audit externe module"
```

---

### Task 7: Shared frontend field-group component

**Files:**
- Create: `apps/web/src/components/audit-externe/audit-externe-fields.tsx`

**Interfaces:**
- Consumes: `AUDIT_EXTERNE_TYPES`, `AUDIT_EXTERNE_TYPE_LABELS`, `AUDIT_EXTERNE_REFERENCES`, `AUDIT_EXTERNE_REFERENCE_LABELS` (Task 2), `Field`/`FieldLabel`/`FieldError` (`@/components/ui/field`), `apiFetch` (`@/lib/api`).
- Produces: `<AuditExterneFields form={form} errors={form.formState.errors} />` — a presentational component consumed by Tasks 9, 10, and 11. It expects the parent form's registered field names to be exactly: `clientId, responsableId, typeAudit, reference, organisme, auditeur`. It fetches its own `clients` and `responsables` option lists internally (self-contained, no props needed for those).

- [ ] **Step 1: Write the component**

```tsx
"use client";

import { useQuery } from "@tanstack/react-query";
import type { FieldErrors, UseFormRegister } from "react-hook-form";
import { AUDIT_EXTERNE_REFERENCES, AUDIT_EXTERNE_REFERENCE_LABELS, AUDIT_EXTERNE_TYPES, AUDIT_EXTERNE_TYPE_LABELS } from "@abc/shared";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/api";

type Client = { id: string; companyName: string };
type Responsable = { id: string; name: string; email: string };
type ListResponse<T> = { data: T[] };

export type AuditExterneFieldValues = {
  clientId: string;
  responsableId: string;
  typeAudit: string;
  reference: string;
  organisme: string;
  auditeur: string;
};

export function AuditExterneFields({
  register,
  errors,
}: Readonly<{
  register: UseFormRegister<AuditExterneFieldValues>;
  errors: FieldErrors<AuditExterneFieldValues>;
}>) {
  const clients = useQuery({
    queryKey: ["clients", "active-options"],
    queryFn: () => apiFetch<ListResponse<Client>>("/clients?status=ACTIVE&page=1&perPage=100"),
  });
  const responsables = useQuery({
    queryKey: ["audit-externe", "responsables"],
    queryFn: () => apiFetch<ListResponse<Responsable>>("/audit-externe/responsables"),
  });

  return (
    <>
      <Field data-invalid={Boolean(errors.clientId)}>
        <FieldLabel htmlFor="ae-clientId">Client</FieldLabel>
        <select className="h-11 rounded-md border bg-white px-3 text-sm" id="ae-clientId" {...register("clientId")}>
          <option value="">Selectionner un client</option>
          {clients.data?.data.map((client) => (
            <option key={client.id} value={client.id}>
              {client.companyName}
            </option>
          ))}
        </select>
        {errors.clientId ? <FieldError>Selectionnez un client actif.</FieldError> : null}
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field data-invalid={Boolean(errors.typeAudit)}>
          <FieldLabel htmlFor="ae-typeAudit">Type d&apos;audit</FieldLabel>
          <select className="h-11 rounded-md border bg-white px-3 text-sm" id="ae-typeAudit" {...register("typeAudit")}>
            {AUDIT_EXTERNE_TYPES.map((type) => (
              <option key={type} value={type}>
                {AUDIT_EXTERNE_TYPE_LABELS[type]}
              </option>
            ))}
          </select>
        </Field>
        <Field data-invalid={Boolean(errors.reference)}>
          <FieldLabel htmlFor="ae-reference">Reference</FieldLabel>
          <select className="h-11 rounded-md border bg-white px-3 text-sm" id="ae-reference" {...register("reference")}>
            {AUDIT_EXTERNE_REFERENCES.map((reference) => (
              <option key={reference} value={reference}>
                {AUDIT_EXTERNE_REFERENCE_LABELS[reference]}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Field data-invalid={Boolean(errors.organisme)}>
        <FieldLabel htmlFor="ae-organisme">Organisme de certification</FieldLabel>
        <Input id="ae-organisme" aria-invalid={Boolean(errors.organisme)} {...register("organisme")} />
        {errors.organisme ? <FieldError>Indiquez l&apos;organisme certificateur.</FieldError> : null}
      </Field>
      <Field data-invalid={Boolean(errors.auditeur)}>
        <FieldLabel htmlFor="ae-auditeur">Auditeur</FieldLabel>
        <Input id="ae-auditeur" aria-invalid={Boolean(errors.auditeur)} {...register("auditeur")} />
        {errors.auditeur ? <FieldError>Indiquez le nom de l&apos;auditeur.</FieldError> : null}
      </Field>
      <Field data-invalid={Boolean(errors.responsableId)}>
        <FieldLabel htmlFor="ae-responsableId">Responsable</FieldLabel>
        <select className="h-11 rounded-md border bg-white px-3 text-sm" id="ae-responsableId" {...register("responsableId")}>
          <option value="">Selectionner un responsable</option>
          {responsables.data?.data.map((user) => (
            <option key={user.id} value={user.id}>
              {user.name}
            </option>
          ))}
        </select>
        {errors.responsableId ? <FieldError>Selectionnez le responsable a notifier.</FieldError> : null}
      </Field>
    </>
  );
}
```

- [ ] **Step 2: Typecheck the web app**

Run: `pnpm --filter @abc/web typecheck`
Expected: no errors (this component isn't imported anywhere yet, so this mainly checks the file itself is syntactically/type valid — full wiring is verified in Tasks 9-11).

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/audit-externe/audit-externe-fields.tsx
git commit -m "feat(web): add shared audit externe field group component"
```

---

### Task 8: Audit Externe list page

**Files:**
- Create: `apps/web/src/components/audit-externe/audit-externe-list.tsx`
- Create: `apps/web/src/app/audit-externe/page.tsx`

**Interfaces:**
- Consumes: `GET /audit-externe` (Task 4), `AUDIT_EXTERNE_TYPE_LABELS`/`AUDIT_EXTERNE_REFERENCE_LABELS` (Task 2), `PagePanel`/`SectionHeader`/`FilterBar`/`FilterField`/`RecordList` (`@/components/layout/page-section`), `RoleGate` (`@/components/auth/role-gate`).
- Produces: the `/audit-externe` route, rendering `<AuditExterneList />`.

- [ ] **Step 1: Write `audit-externe-list.tsx`**

Follow the exact structure of `apps/web/src/components/clients/client-list.tsx` (search/filter/sort/pagination/CSV export/skeleton/empty/error states), adapted to this entity's fields:

```tsx
"use client";

import { useDeferredValue, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AUDIT_EXTERNE_REFERENCE_LABELS, AUDIT_EXTERNE_TYPE_LABELS, type AuditExterneReference, type AuditExterneType } from "@abc/shared";
import { Archive, ArrowDown, ArrowUp, Download, Edit, Eye, FileCheck2, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FilterBar, FilterField, PagePanel, RecordList, SectionHeader } from "@/components/layout/page-section";
import { RoleGate } from "@/components/auth/role-gate";
import { useAuth } from "@/components/providers/auth-provider";
import { Skeleton } from "@/components/ui/skeleton";
import { API_URL, apiFetch, ApiError } from "@/lib/api";

type SortBy = "startDateTime" | "companyName" | "typeAudit";
type SortDir = "asc" | "desc";
type PageSize = 20 | 50 | 100;

type AuditExterneSummary = {
  id: string;
  typeAudit: AuditExterneType;
  reference: AuditExterneReference;
  organisme: string;
  auditeur: string;
  startDateTime: string;
  status: "PLANNED" | "DONE" | "CANCELLED";
  client: { id: string; companyName: string };
  responsable: { id: string; name: string };
};

type AuditExterneListResponse = {
  data: AuditExterneSummary[];
  meta: { page: number; perPage: number; total: number; totalPages: number };
};

const pageSizes: PageSize[] = [20, 50, 100];
const sortableColumns: Array<{ label: string; value: SortBy }> = [
  { label: "Date d'audit", value: "startDateTime" },
  { label: "Client", value: "companyName" },
  { label: "Type", value: "typeAudit" },
];

export function AuditExterneList() {
  const queryClient = useQueryClient();
  const { canManageOperations } = useAuth();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState<PageSize>(20);
  const [sortBy, setSortBy] = useState<SortBy>("startDateTime");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const deferredSearch = useDeferredValue(search.trim());

  const query = useQuery({
    queryKey: ["audit-externe", deferredSearch, page, perPage, sortBy, sortDir],
    queryFn: () =>
      apiFetch<AuditExterneListResponse>(
        `/audit-externe?${new URLSearchParams({
          q: deferredSearch,
          page: String(page),
          perPage: String(perPage),
          sortBy,
          sortDir,
        })}`,
      ),
  });
  const archiveMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/audit-externe/${id}/archive`, { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["audit-externe"] }),
  });

  const records = query.data?.data ?? [];
  const meta = query.data?.meta;

  const updateSort = (nextSortBy: SortBy) => {
    setPage(1);
    if (sortBy === nextSortBy) {
      setSortDir((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSortBy(nextSortBy);
    setSortDir("asc");
  };

  return (
    <PagePanel as="section" className="flex flex-col gap-4" aria-labelledby="audit-externe-list-title">
      <SectionHeader
        actions={
          <Button
            disabled={isExporting}
            onClick={() => void exportAuditExterne({ q: deferredSearch, sortBy, sortDir }, setIsExporting, setExportError)}
            size="sm"
            type="button"
            variant="outline"
          >
            <Download data-icon="inline-start" />
            {isExporting ? "Export..." : "Exporter CSV"}
          </Button>
        }
        count={meta ? `${meta.total} audit${meta.total > 1 ? "s" : ""}` : undefined}
        description="Suivi des audits de certification et de suivi planifies ou realises."
        id="audit-externe-list-title"
        title="Audits externes"
      />

      <FilterBar className="lg:grid-cols-[minmax(0,1fr)_10rem_12rem]">
        <FilterField className="relative">
          <span>Recherche</span>
          <Search className="pointer-events-none absolute left-3 top-9 size-4 text-muted-foreground" aria-hidden="true" />
          <Input
            className="pl-10"
            onChange={(event) => {
              setPage(1);
              setSearch(event.target.value);
            }}
            placeholder="Client, organisme ou auditeur"
            type="search"
            value={search}
          />
        </FilterField>
        <FilterField>
          Par page
          <select
            className="h-11 rounded-md border bg-white px-3 text-sm font-medium normal-case tracking-normal text-foreground"
            onChange={(event) => {
              setPage(1);
              setPerPage(Number(event.target.value) as PageSize);
            }}
            value={String(perPage)}
          >
            {pageSizes.map((size) => (
              <option key={size} value={size}>
                {size} lignes
              </option>
            ))}
          </select>
        </FilterField>
        <FilterField>
          Tri mobile
          <select
            className="h-11 rounded-md border bg-white px-3 text-sm font-medium normal-case tracking-normal text-foreground"
            onChange={(event) => {
              setPage(1);
              setSortBy(event.target.value as SortBy);
            }}
            value={sortBy}
          >
            {sortableColumns.map((column) => (
              <option key={column.value} value={column.value}>
                {column.label}
              </option>
            ))}
          </select>
        </FilterField>
      </FilterBar>

      {exportError ? <p className="border-l-2 border-danger pl-3 text-sm text-danger" role="alert">{exportError}</p> : null}
      {archiveMutation.error ? (
        <p className="border-l-2 border-danger pl-3 text-sm text-danger" role="alert">
          {archiveMutation.error instanceof ApiError ? archiveMutation.error.message : "Impossible d'archiver cet audit."}
        </p>
      ) : null}
      {query.isPending ? (
        <div className="flex flex-col gap-2" aria-label="Chargement des audits" role="status">
          {[0, 1, 2].map((index) => (
            <Skeleton className="h-24 border" key={index} />
          ))}
        </div>
      ) : null}
      {query.isError ? (
        <div className="flex flex-col items-start gap-3 rounded-md border border-danger/30 bg-white px-4 py-3" role="alert">
          <p className="text-sm font-medium">Impossible de charger les audits externes</p>
          <Button onClick={() => void query.refetch()} size="sm" type="button" variant="outline">
            Reessayer
          </Button>
        </div>
      ) : null}
      {!query.isPending && !query.isError && records.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-md border border-dashed px-4 py-10 text-center">
          <FileCheck2 className="size-5 text-muted-foreground" aria-hidden="true" />
          <p className="text-sm font-medium">Aucun audit externe a afficher</p>
          <RoleGate allowedRoles={["ADMIN", "RESPONSABLE"]}>
            <Button asChild size="sm">
              <Link href="/audit-externe/nouveau">Planifier un audit</Link>
            </Button>
          </RoleGate>
        </div>
      ) : null}
      {records.length > 0 ? (
        <>
          <RecordList className="md:hidden">
            {records.map((record) => (
              <article className="flex flex-col gap-2 rounded-md border bg-white p-4 shadow-sm" key={record.id}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold">{record.client.companyName}</h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {new Date(record.startDateTime).toLocaleDateString("fr-FR")} - {AUDIT_EXTERNE_TYPE_LABELS[record.typeAudit]}
                    </p>
                  </div>
                  <Badge>{AUDIT_EXTERNE_REFERENCE_LABELS[record.reference]}</Badge>
                </div>
                <dl className="grid grid-cols-2 gap-2 text-xs">
                  <div><dt className="text-muted-foreground">Organisme</dt><dd className="font-medium">{record.organisme}</dd></div>
                  <div><dt className="text-muted-foreground">Responsable</dt><dd className="font-medium">{record.responsable.name}</dd></div>
                </dl>
                <div className="grid grid-cols-2 gap-2">
                  <Button asChild size="sm" variant="outline"><Link href={`/audit-externe/${record.id}`}><Eye aria-hidden="true" />Ouvrir</Link></Button>
                  {canManageOperations ? (
                    <Button asChild size="sm" variant="outline"><Link href={`/audit-externe/${record.id}/modifier`}><Edit aria-hidden="true" />Modifier</Link></Button>
                  ) : null}
                </div>
              </article>
            ))}
          </RecordList>
          <div className="hidden overflow-x-auto rounded-md border bg-white md:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b bg-muted/60 text-xs text-muted-foreground">
                <tr>
                  <SortableHeader activeSort={sortBy} label="Client" sortDir={sortDir} value="companyName" onSort={updateSort} />
                  <SortableHeader activeSort={sortBy} label="Date d'audit" sortDir={sortDir} value="startDateTime" onSort={updateSort} />
                  <SortableHeader activeSort={sortBy} label="Type" sortDir={sortDir} value="typeAudit" onSort={updateSort} />
                  <th className="px-4 py-3 font-semibold" scope="col">Reference</th>
                  <th className="px-4 py-3 font-semibold" scope="col">Organisme</th>
                  <th className="px-4 py-3 font-semibold" scope="col">Auditeur</th>
                  <th className="px-4 py-3 font-semibold" scope="col">Responsable</th>
                  <th className="px-4 py-3 text-right font-semibold" scope="col">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {records.map((record) => (
                  <tr className="bg-white transition-colors hover:bg-brand-50/50" key={record.id}>
                    <td className="px-4 py-3 font-medium">
                      <Link className="hover:text-brand-700 hover:underline" href={`/audit-externe/${record.id}`}>{record.client.companyName}</Link>
                    </td>
                    <td className="px-4 py-3">{new Date(record.startDateTime).toLocaleDateString("fr-FR")}</td>
                    <td className="px-4 py-3">{AUDIT_EXTERNE_TYPE_LABELS[record.typeAudit]}</td>
                    <td className="px-4 py-3"><Badge>{AUDIT_EXTERNE_REFERENCE_LABELS[record.reference]}</Badge></td>
                    <td className="px-4 py-3">{record.organisme}</td>
                    <td className="px-4 py-3">{record.auditeur}</td>
                    <td className="px-4 py-3">{record.responsable.name}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <Button asChild size="sm" variant="outline"><Link href={`/audit-externe/${record.id}`}>Ouvrir</Link></Button>
                        {canManageOperations ? (
                          <>
                            <Button asChild size="sm" variant="outline"><Link href={`/audit-externe/${record.id}/modifier`}>Modifier</Link></Button>
                            <Button disabled={archiveMutation.isPending} onClick={() => archiveMutation.mutate(record.id)} size="sm" type="button" variant="danger">
                              <Archive data-icon="inline-start" />Archiver
                            </Button>
                          </>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}

      {meta ? (
        <nav className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between" aria-label="Pagination des audits">
          <p className="text-xs text-muted-foreground">
            {meta.total === 0 ? 0 : (meta.page - 1) * meta.perPage + 1}-{Math.min(meta.page * meta.perPage, meta.total)} sur {meta.total} audits
          </p>
          <div className="flex gap-2">
            <Button disabled={page <= 1} onClick={() => setPage(page - 1)} type="button" variant="outline">Precedent</Button>
            <Button disabled={page >= meta.totalPages} onClick={() => setPage(page + 1)} type="button" variant="outline">Suivant</Button>
          </div>
        </nav>
      ) : null}
    </PagePanel>
  );
}

function SortableHeader({
  activeSort,
  label,
  sortDir,
  value,
  onSort,
}: Readonly<{ activeSort: SortBy; label: string; sortDir: SortDir; value: SortBy; onSort: (sortBy: SortBy) => void }>) {
  const active = activeSort === value;
  return (
    <th className="px-4 py-3 font-semibold" scope="col" aria-sort={active ? (sortDir === "asc" ? "ascending" : "descending") : "none"}>
      <button className="inline-flex min-h-10 items-center gap-1 rounded-sm text-left hover:text-brand-700" onClick={() => onSort(value)} type="button">
        {label}
        {active ? (sortDir === "asc" ? <ArrowUp className="size-3" aria-hidden="true" /> : <ArrowDown className="size-3" aria-hidden="true" />) : null}
      </button>
    </th>
  );
}

async function exportAuditExterne(
  filters: { q: string; sortBy: SortBy; sortDir: SortDir },
  setIsExporting: (value: boolean) => void,
  setExportError: (value: string | null) => void,
) {
  setIsExporting(true);
  setExportError(null);
  try {
    const params = new URLSearchParams({ q: filters.q, sortBy: filters.sortBy, sortDir: filters.sortDir, page: "1", perPage: "100" });
    const response = await fetch(`${API_URL}/audit-externe/export.csv?${params}`, { credentials: "include" });
    if (!response.ok) throw new Error("Export impossible");
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `audit-externe-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  } catch {
    setExportError("Impossible d'exporter les audits pour le moment.");
  } finally {
    setIsExporting(false);
  }
}
```

- [ ] **Step 2: Write the page route**

Create `apps/web/src/app/audit-externe/page.tsx`:

```tsx
import Link from "next/link";
import { RoleGate } from "@/components/auth/role-gate";
import { AuditExterneList } from "@/components/audit-externe/audit-externe-list";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader, PageStack } from "@/components/layout/page-section";
import { Button } from "@/components/ui/button";

export default function AuditExternePage() {
  return (
    <AppShell>
      <PageStack>
        <PageHeader
          actions={
            <RoleGate allowedRoles={["ADMIN", "RESPONSABLE"]}>
              <Button asChild>
                <Link href="/audit-externe/nouveau">Planifier un audit</Link>
              </Button>
            </RoleGate>
          }
          eyebrow="Certification"
          title="Audit Externe"
          description="Planifiez et suivez les audits de certification et de suivi realises par les organismes externes."
        />
        <AuditExterneList />
      </PageStack>
    </AppShell>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter @abc/web typecheck`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/audit-externe/audit-externe-list.tsx apps/web/src/app/audit-externe/page.tsx
git commit -m "feat(web): add audit externe list page"
```

---

### Task 9: Audit Externe create page

**Files:**
- Create: `apps/web/src/components/audit-externe/audit-externe-create-form.tsx`
- Create: `apps/web/src/app/audit-externe/nouveau/page.tsx`

**Interfaces:**
- Consumes: `AuditExterneFields` (Task 7), `auditExterneCreateSchema`/`AuditExterneCreateInput` (Task 2), `POST /audit-externe` (Task 4).
- Produces: the `/audit-externe/nouveau` route.

- [ ] **Step 1: Write the create form**

```tsx
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import { auditExterneCreateSchema, type AuditExterneCreateInput } from "@abc/shared";
import { AuditExterneFields } from "@/components/audit-externe/audit-externe-fields";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { apiFetch, ApiError } from "@/lib/api";

export function AuditExterneCreateForm() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const form = useForm<z.input<typeof auditExterneCreateSchema>, unknown, AuditExterneCreateInput>({
    defaultValues: {
      clientId: "",
      responsableId: "",
      typeAudit: "CERTIFICATION",
      reference: "NORME_9001",
      organisme: "",
      auditeur: "",
      missionMode: "PRESENTIELLE",
      startDateTime: "",
      endDateTime: "",
      location: "",
    },
    resolver: zodResolver(auditExterneCreateSchema),
  });
  const mutation = useMutation({
    mutationFn: (input: AuditExterneCreateInput) => apiFetch<{ data: { id: string } }>("/audit-externe", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ["audit-externe"] });
      await queryClient.invalidateQueries({ queryKey: ["missions"] });
      router.push(`/audit-externe/${result.data.id}`);
    },
  });
  const submit = form.handleSubmit((values) => mutation.mutate(values));

  return (
    <form className="flex flex-col gap-5" onSubmit={(event) => void submit(event)}>
      <Card>
        <CardHeader><CardTitle>Details de l&apos;audit</CardTitle></CardHeader>
        <CardContent>
          <FieldGroup>
            <AuditExterneFields register={form.register} errors={form.formState.errors} />
          </FieldGroup>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Planification</CardTitle></CardHeader>
        <CardContent>
          <FieldGroup>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field data-invalid={Boolean(form.formState.errors.startDateTime)}>
                <FieldLabel htmlFor="startDateTime">Debut</FieldLabel>
                <Input id="startDateTime" type="datetime-local" aria-invalid={Boolean(form.formState.errors.startDateTime)} {...form.register("startDateTime")} />
              </Field>
              <Field data-invalid={Boolean(form.formState.errors.endDateTime)}>
                <FieldLabel htmlFor="endDateTime">Fin</FieldLabel>
                <Input id="endDateTime" type="datetime-local" aria-invalid={Boolean(form.formState.errors.endDateTime)} {...form.register("endDateTime")} />
                {form.formState.errors.endDateTime ? <FieldError>La fin doit suivre le debut.</FieldError> : null}
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="missionMode">Mode</FieldLabel>
                <select className="h-11 rounded-md border bg-white px-3 text-sm" id="missionMode" {...form.register("missionMode")}>
                  <option value="PRESENTIELLE">Presentielle</option>
                  <option value="ONLINE">En ligne</option>
                </select>
              </Field>
              <Field>
                <FieldLabel htmlFor="location">Lieu</FieldLabel>
                <Input id="location" {...form.register("location")} />
              </Field>
            </div>
          </FieldGroup>
        </CardContent>
      </Card>
      {mutation.isError ? (
        <p className="border-l-2 border-danger pl-3 text-sm text-danger" role="alert">
          {mutation.error instanceof ApiError ? mutation.error.message : "Impossible de creer l'audit externe."}
        </p>
      ) : null}
      <div className="sticky bottom-16 z-20 flex justify-end gap-3 rounded-lg border bg-white/95 p-3 shadow-md backdrop-blur lg:bottom-0">
        <Button asChild variant="outline"><Link href="/audit-externe">Annuler</Link></Button>
        <Button disabled={mutation.isPending} type="submit">{mutation.isPending ? "Creation..." : "Creer l'audit"}</Button>
      </div>
    </form>
  );
}
```

- [ ] **Step 2: Write the page route**

Create `apps/web/src/app/audit-externe/nouveau/page.tsx`:

```tsx
import { AuditExterneCreateForm } from "@/components/audit-externe/audit-externe-create-form";
import { ProtectedRoute } from "@/components/auth/role-gate";
import { AppShell } from "@/components/layout/app-shell";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { PageHeader, PageStack } from "@/components/layout/page-section";

export default function NewAuditExternePage() {
  return (
    <AppShell>
      <PageStack className="max-w-5xl">
        <Breadcrumbs items={[{ href: "/audit-externe", label: "Audit Externe" }, { label: "Planifier" }]} />
        <PageHeader eyebrow="Nouvel audit" title="Planifier un audit externe" description="Renseignez le client, l'organisme certificateur et le responsable a notifier." />
        <ProtectedRoute allowedRoles={["ADMIN", "RESPONSABLE"]}>
          <AuditExterneCreateForm />
        </ProtectedRoute>
      </PageStack>
    </AppShell>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter @abc/web typecheck`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/audit-externe/audit-externe-create-form.tsx apps/web/src/app/audit-externe/nouveau/page.tsx
git commit -m "feat(web): add audit externe create page"
```

---

### Task 10: Audit Externe detail and edit pages

**Files:**
- Create: `apps/web/src/components/audit-externe/audit-externe-detail.tsx`
- Create: `apps/web/src/components/audit-externe/audit-externe-edit-form.tsx`
- Create: `apps/web/src/app/audit-externe/[id]/page.tsx`
- Create: `apps/web/src/app/audit-externe/[id]/modifier/page.tsx`

**Interfaces:**
- Consumes: `GET/PATCH /audit-externe/:id` (Task 4), `AuditExterneFields` (Task 7), `auditExterneUpdateSchema`/`AuditExterneUpdateInput` (Task 2).
- Produces: `/audit-externe/:id` and `/audit-externe/:id/modifier` routes.

- [ ] **Step 1: Write the detail component**

```tsx
"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AUDIT_EXTERNE_REFERENCE_LABELS, AUDIT_EXTERNE_TYPE_LABELS, type AuditExterneReference, type AuditExterneType } from "@abc/shared";
import { Archive, Edit } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RoleGate } from "@/components/auth/role-gate";
import { PageHeader, PagePanel, PageStack } from "@/components/layout/page-section";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch, ApiError } from "@/lib/api";

type AuditExterneDetail = {
  id: string;
  typeAudit: AuditExterneType;
  reference: AuditExterneReference;
  organisme: string;
  auditeur: string;
  startDateTime: string;
  endDateTime: string;
  missionMode: "ONLINE" | "PRESENTIELLE";
  location: string | null;
  status: "PLANNED" | "DONE" | "CANCELLED";
  reminderSentAt: string | null;
  client: { id: string; companyName: string };
  responsable: { id: string; name: string; email: string };
};

export function AuditExterneDetail({ id }: Readonly<{ id: string }>) {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["audit-externe", id], queryFn: () => apiFetch<{ data: AuditExterneDetail }>(`/audit-externe/${id}`) });
  const archiveMutation = useMutation({
    mutationFn: () => apiFetch(`/audit-externe/${id}/archive`, { method: "POST" }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["audit-externe"] });
      await queryClient.invalidateQueries({ queryKey: ["audit-externe", id] });
    },
  });

  if (query.isPending) return <Skeleton className="h-96 border" />;
  if (query.isError) return <p className="border-l-2 border-danger pl-3 text-sm text-danger" role="alert">Impossible de charger cet audit externe.</p>;

  const record = query.data.data;

  return (
    <PageStack>
      <Breadcrumbs items={[{ href: "/audit-externe", label: "Audit Externe" }, { label: record.client.companyName }]} />
      <PageHeader
        actions={
          <RoleGate allowedRoles={["ADMIN", "RESPONSABLE"]}>
            <div className="flex gap-2">
              <Button asChild size="sm" variant="outline"><Link href={`/audit-externe/${record.id}/modifier`}><Edit aria-hidden="true" />Modifier</Link></Button>
              {record.status !== "CANCELLED" ? (
                <Button disabled={archiveMutation.isPending} onClick={() => archiveMutation.mutate()} size="sm" type="button" variant="danger">
                  <Archive aria-hidden="true" />Archiver
                </Button>
              ) : null}
            </div>
          </RoleGate>
        }
        eyebrow={AUDIT_EXTERNE_TYPE_LABELS[record.typeAudit]}
        title={record.client.companyName}
        description={`${AUDIT_EXTERNE_REFERENCE_LABELS[record.reference]} - ${record.organisme}`}
      />
      {archiveMutation.error ? (
        <p className="border-l-2 border-danger pl-3 text-sm text-danger" role="alert">
          {archiveMutation.error instanceof ApiError ? archiveMutation.error.message : "Impossible d'archiver cet audit."}
        </p>
      ) : null}
      <PagePanel as="section">
        <dl className="grid gap-4 sm:grid-cols-2">
          <div><dt className="text-xs text-muted-foreground">Date d&apos;audit</dt><dd className="mt-1 font-medium">{new Date(record.startDateTime).toLocaleString("fr-FR")}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Fin</dt><dd className="mt-1 font-medium">{new Date(record.endDateTime).toLocaleString("fr-FR")}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Auditeur</dt><dd className="mt-1 font-medium">{record.auditeur}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Responsable</dt><dd className="mt-1 font-medium">{record.responsable.name}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Mode</dt><dd className="mt-1 font-medium">{record.missionMode === "ONLINE" ? "En ligne" : "Presentielle"}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Statut</dt><dd className="mt-1"><Badge>{record.status}</Badge></dd></div>
          {record.location ? <div><dt className="text-xs text-muted-foreground">Lieu</dt><dd className="mt-1 font-medium">{record.location}</dd></div> : null}
          <div>
            <dt className="text-xs text-muted-foreground">Rappel responsable</dt>
            <dd className="mt-1 font-medium">{record.reminderSentAt ? `Envoye le ${new Date(record.reminderSentAt).toLocaleDateString("fr-FR")}` : "Pas encore envoye"}</dd>
          </div>
        </dl>
      </PagePanel>
    </PageStack>
  );
}
```

- [ ] **Step 2: Write the edit form component**

```tsx
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import { auditExterneUpdateSchema, type AuditExterneUpdateInput } from "@abc/shared";
import { AuditExterneFields } from "@/components/audit-externe/audit-externe-fields";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch, ApiError } from "@/lib/api";

type AuditExterneResponse = {
  data: {
    id: string;
    version: number;
    typeAudit: string;
    reference: string;
    organisme: string;
    auditeur: string;
    startDateTime: string;
    endDateTime: string;
    missionMode: "ONLINE" | "PRESENTIELLE";
    location: string | null;
    client: { id: string };
    responsable: { id: string };
  };
};

export function AuditExterneEditForm({ id }: Readonly<{ id: string }>) {
  const query = useQuery({ queryKey: ["audit-externe", id], queryFn: () => apiFetch<AuditExterneResponse>(`/audit-externe/${id}`) });
  if (query.isPending) return <Skeleton className="h-96 border" />;
  if (query.isError) return <p className="border-l-2 border-danger pl-3 text-sm text-danger" role="alert">Impossible de charger cet audit externe.</p>;
  return <LoadedAuditExterneEditForm record={query.data.data} />;
}

function LoadedAuditExterneEditForm({ record }: Readonly<{ record: AuditExterneResponse["data"] }>) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const form = useForm<z.input<typeof auditExterneUpdateSchema>, unknown, AuditExterneUpdateInput>({
    defaultValues: {
      clientId: record.client.id,
      responsableId: record.responsable.id,
      typeAudit: record.typeAudit as AuditExterneUpdateInput["typeAudit"],
      reference: record.reference as AuditExterneUpdateInput["reference"],
      organisme: record.organisme,
      auditeur: record.auditeur,
      missionMode: record.missionMode,
      startDateTime: record.startDateTime.slice(0, 16),
      endDateTime: record.endDateTime.slice(0, 16),
      location: record.location ?? "",
      version: record.version,
    },
    resolver: zodResolver(auditExterneUpdateSchema),
  });
  const mutation = useMutation({
    mutationFn: (input: AuditExterneUpdateInput) => apiFetch<AuditExterneResponse>(`/audit-externe/${record.id}`, { method: "PATCH", body: JSON.stringify(input) }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["audit-externe"] });
      router.push(`/audit-externe/${record.id}`);
    },
  });
  const submit = form.handleSubmit((values) => mutation.mutate(values));

  return (
    <form className="flex flex-col gap-5" onSubmit={(event) => void submit(event)}>
      <Card>
        <CardHeader><CardTitle>Details de l&apos;audit</CardTitle></CardHeader>
        <CardContent>
          <FieldGroup>
            <AuditExterneFields register={form.register} errors={form.formState.errors} />
          </FieldGroup>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Planification</CardTitle></CardHeader>
        <CardContent>
          <FieldGroup>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field data-invalid={Boolean(form.formState.errors.startDateTime)}>
                <FieldLabel htmlFor="startDateTime">Debut</FieldLabel>
                <Input id="startDateTime" type="datetime-local" aria-invalid={Boolean(form.formState.errors.startDateTime)} {...form.register("startDateTime")} />
              </Field>
              <Field data-invalid={Boolean(form.formState.errors.endDateTime)}>
                <FieldLabel htmlFor="endDateTime">Fin</FieldLabel>
                <Input id="endDateTime" type="datetime-local" aria-invalid={Boolean(form.formState.errors.endDateTime)} {...form.register("endDateTime")} />
                {form.formState.errors.endDateTime ? <FieldError>La fin doit suivre le debut.</FieldError> : null}
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="missionMode">Mode</FieldLabel>
                <select className="h-11 rounded-md border bg-white px-3 text-sm" id="missionMode" {...form.register("missionMode")}>
                  <option value="PRESENTIELLE">Presentielle</option>
                  <option value="ONLINE">En ligne</option>
                </select>
              </Field>
              <Field>
                <FieldLabel htmlFor="location">Lieu</FieldLabel>
                <Input id="location" {...form.register("location")} />
              </Field>
            </div>
          </FieldGroup>
        </CardContent>
      </Card>
      {mutation.isError ? (
        <p className="border-l-2 border-danger pl-3 text-sm text-danger" role="alert">
          {mutation.error instanceof ApiError ? mutation.error.message : "Impossible d'enregistrer les modifications."}
        </p>
      ) : null}
      <div className="sticky bottom-16 z-20 flex justify-end gap-3 rounded-lg border bg-white/95 p-3 shadow-md backdrop-blur lg:bottom-0">
        <Button asChild type="button" variant="outline"><Link href={`/audit-externe/${record.id}`}>Annuler</Link></Button>
        <Button disabled={mutation.isPending} type="submit">{mutation.isPending ? "Enregistrement..." : "Enregistrer"}</Button>
      </div>
    </form>
  );
}
```

- [ ] **Step 3: Write the two page routes**

Create `apps/web/src/app/audit-externe/[id]/page.tsx`:

```tsx
import { AuditExterneDetail } from "@/components/audit-externe/audit-externe-detail";
import { AppShell } from "@/components/layout/app-shell";

export default async function AuditExterneDetailPage({ params }: Readonly<{ params: Promise<{ id: string }> }>) {
  const { id } = await params;
  return (
    <AppShell>
      <AuditExterneDetail id={id} />
    </AppShell>
  );
}
```

Create `apps/web/src/app/audit-externe/[id]/modifier/page.tsx`:

```tsx
import { AuditExterneEditForm } from "@/components/audit-externe/audit-externe-edit-form";
import { ProtectedRoute } from "@/components/auth/role-gate";
import { AppShell } from "@/components/layout/app-shell";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { PageHeader, PageStack } from "@/components/layout/page-section";

export default async function EditAuditExternePage({ params }: Readonly<{ params: Promise<{ id: string }> }>) {
  const { id } = await params;
  return (
    <AppShell>
      <PageStack className="max-w-5xl">
        <Breadcrumbs items={[{ href: "/audit-externe", label: "Audit Externe" }, { label: "Modifier" }]} />
        <PageHeader eyebrow="Mise a jour" title="Modifier l'audit externe" />
        <ProtectedRoute allowedRoles={["ADMIN", "RESPONSABLE"]}>
          <AuditExterneEditForm id={id} />
        </ProtectedRoute>
      </PageStack>
    </AppShell>
  );
}
```

- [ ] **Step 4: Typecheck**

Run: `pnpm --filter @abc/web typecheck`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/audit-externe/audit-externe-detail.tsx apps/web/src/components/audit-externe/audit-externe-edit-form.tsx apps/web/src/app/audit-externe/\[id\]
git commit -m "feat(web): add audit externe detail and edit pages"
```

---

### Task 11: Wire audit-externe creation into the calendar's mission form

**Files:**
- Modify: `apps/web/src/components/missions/mission-create-form.tsx`

**Interfaces:**
- Consumes: `AuditExterneFields` (Task 7), `auditExterneCreateSchema` (Task 2), `POST /audit-externe` (Task 4).

- [ ] **Step 1: Read the current file, then add conditional audit fields and dual submit target**

The mission type dropdown already exists (`missionType` field, watched as `const missionType = form.watch("missionType")`). Add this block after the existing `{missionType === "AUTRE" ? (...) : null}` block (inside the same `FieldGroup`, inside the first `Card`):

```tsx
            {missionType === "AUDIT_EXTERNE" ? (
              <div className="flex flex-col gap-4 rounded-md border border-dashed p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Details de l&apos;audit externe</p>
                <AuditExterneFields register={auditExterneForm.register} errors={auditExterneForm.formState.errors} />
              </div>
            ) : null}
```

This requires a second `useForm` instance scoped to just the audit-specific fields (`clientId, responsableId, typeAudit, reference, organisme, auditeur`), kept in sync with the main form's `clientId`. Add near the top of the `MissionCreateForm` function body, right after the existing `form` declaration:

```typescript
  const auditExterneForm = useForm<AuditExterneFieldValues>({
    defaultValues: { clientId: "", responsableId: "", typeAudit: "CERTIFICATION", reference: "NORME_9001", organisme: "", auditeur: "" },
  });
```

Add the import at the top of the file:

```typescript
import { AuditExterneFields, type AuditExterneFieldValues } from "@/components/audit-externe/audit-externe-fields";
```

Keep the two forms' `clientId` in sync — add this `useEffect` (import `useEffect` from `"react"` at the top of the file):

```typescript
  useEffect(() => {
    auditExterneForm.setValue("clientId", form.watch("clientId"));
  }, [auditExterneForm, form]);
```

- [ ] **Step 2: Branch the mutation to submit to the right endpoint**

Replace the existing `mutation` definition with one that branches on `missionType`:

```typescript
  const mutation = useMutation({
    mutationFn: async (input: MissionCreateInput): Promise<Record<string, unknown> | QueuedOfflineResult> => {
      if (input.missionType === "AUDIT_EXTERNE") {
        const auditExterneValues = auditExterneForm.getValues();
        const auditExternePayload = {
          clientId: input.clientId,
          responsableId: auditExterneValues.responsableId,
          typeAudit: auditExterneValues.typeAudit,
          reference: auditExterneValues.reference,
          organisme: auditExterneValues.organisme,
          auditeur: auditExterneValues.auditeur,
          missionMode: input.missionMode,
          startDateTime: input.startDateTime,
          endDateTime: input.endDateTime,
          location: input.location,
        };
        return apiFetch<Record<string, unknown>>("/audit-externe", { method: "POST", body: JSON.stringify(auditExternePayload) });
      }
      if (shouldQueueOffline()) {
        return enqueueOfflineMutation({ entityType: "MISSION", operation: "CREATE", payload: input });
      }
      return apiFetch<Record<string, unknown>>("/missions", { method: "POST", body: JSON.stringify(input) });
    },
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ["missions"] });
      await queryClient.invalidateQueries({ queryKey: ["audit-externe"] });
      router.push(isQueuedOfflineResult(result) ? "/sync?queued=mission" : "/calendar");
    },
  });
```

Note: when `missionType === "AUDIT_EXTERNE"`, the mission form's own consultant-assignment validation (`consultantAssignments` required) would still block submit since `missionCreateSchema` requires it. Handle this by skipping the consultant-assignment `Card` section's visual requirement note and, more importantly, relaxing that specific validation: wrap the submit handler so that for `AUDIT_EXTERNE` missions, consultant assignment errors are ignored. The simplest correct fix is to change `submit` to:

```typescript
  const submit = form.handleSubmit(
    (values) => mutation.mutate(values),
    (formErrors) => {
      if (missionType === "AUDIT_EXTERNE" && Object.keys(formErrors).every((key) => key === "consultantAssignments")) {
        mutation.mutate(form.getValues());
      }
    },
  );
```

This lets an `AUDIT_EXTERNE` submission through even without a consultant assignment (which the Audit Externe flow doesn't use — it has its own `responsableId` instead), while every other mission type keeps the existing validation untouched.

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @abc/web typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/missions/mission-create-form.tsx
git commit -m "feat(web): create audit externe records from the calendar mission form"
```

---

### Task 12: Navigation entries

**Files:**
- Modify: `apps/web/src/components/layout/sidebar.tsx`
- Modify: `apps/web/src/app/more/page.tsx`

**Interfaces:** none (pure UI wiring).

- [ ] **Step 1: Add the sidebar entry**

In `apps/web/src/components/layout/sidebar.tsx`, add `FileCheck2` to the `lucide-react` import, and add this entry to the `planningItems` array (after `/consultants`):

```typescript
  { href: "/audit-externe", label: "Audit Externe", icon: FileCheck2 },
```

- [ ] **Step 2: Add the mobile "More" section entry**

In `apps/web/src/app/more/page.tsx`, add `FileCheck2` to the `lucide-react` import, and add this entry to the `sections` array (first entry):

```typescript
  { href: "/audit-externe", label: "Audit Externe", description: "Audits de certification et de suivi", icon: FileCheck2 },
```

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter @abc/web typecheck`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/layout/sidebar.tsx apps/web/src/app/more/page.tsx
git commit -m "feat(web): add audit externe navigation entries"
```

---

### Task 13: Notification bell (in-app notification center UI)

**Files:**
- Create: `apps/web/src/components/notifications/notification-bell.tsx`
- Modify: `apps/web/src/components/layout/app-header.tsx`

**Interfaces:**
- Consumes: `GET /notifications`, `POST /notifications/:id/read` (Task 3).

- [ ] **Step 1: Write the bell component**

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api";

type AppNotification = {
  id: string;
  title: string;
  body: string;
  entityType: string;
  entityId: string;
  readAt: string | null;
  createdAt: string;
};

type NotificationListResponse = { data: AppNotification[]; meta: { unreadCount: number } };

export function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["notifications"],
    queryFn: () => apiFetch<NotificationListResponse>("/notifications"),
    refetchInterval: 60_000,
  });
  const markReadMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/notifications/${id}/read`, { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const unreadCount = query.data?.meta.unreadCount ?? 0;
  const notifications = query.data?.data ?? [];

  return (
    <div className="relative">
      <Button
        aria-expanded={isOpen}
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} non lues)` : ""}`}
        className="relative min-h-11"
        onClick={() => setIsOpen((current) => !current)}
        size="sm"
        type="button"
        variant="outline"
      >
        <Bell aria-hidden="true" className="size-4" />
        {unreadCount > 0 ? (
          <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-danger text-[0.6rem] font-semibold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        ) : null}
      </Button>
      {isOpen ? (
        <div className="absolute right-0 z-40 mt-2 w-80 rounded-md border bg-white shadow-lg" role="menu">
          <div className="border-b px-4 py-3">
            <p className="text-sm font-semibold">Notifications</p>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-muted-foreground">Aucune notification</p>
            ) : (
              notifications.map((notification) => (
                <Link
                  className="block border-b px-4 py-3 text-sm hover:bg-brand-50/50"
                  href={notification.entityType === "AUDIT_EXTERNE" ? `/audit-externe/${notification.entityId}` : "/"}
                  key={notification.id}
                  onClick={() => {
                    setIsOpen(false);
                    if (!notification.readAt) markReadMutation.mutate(notification.id);
                  }}
                >
                  <p className={notification.readAt ? "font-medium text-muted-foreground" : "font-semibold"}>{notification.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{notification.body}</p>
                </Link>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 2: Mount it in `AppHeader`**

In `apps/web/src/components/layout/app-header.tsx`, add the import:

```typescript
import { NotificationBell } from "@/components/notifications/notification-bell";
```

And add `{user ? <NotificationBell /> : null}` right before the existing logout `<Button>` inside the `<div className="ml-auto flex min-w-0 items-center gap-3">` block.

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter @abc/web typecheck`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/notifications/notification-bell.tsx apps/web/src/components/layout/app-header.tsx
git commit -m "feat(web): add in-app notification bell"
```

---

### Task 14: End-to-end manual verification

**Files:** none (verification only).

- [ ] **Step 1: Full build check**

Run: `pnpm typecheck && pnpm --filter @abc/db build && pnpm --filter @abc/shared build`
Expected: all succeed with no errors.

- [ ] **Step 2: Start the app**

Run: `pnpm dev` (check ports 3000/4000 are free first: `netstat -ano | grep -E ":3000 |:4000 "`)
Expected: both `@abc/web` and `@abc/api` start cleanly; `curl http://localhost:4000/api/v1/health` returns `{"status":"ok",...}`.

- [ ] **Step 3: Verify creation from the dedicated page**

Log in as `admin@example.com`, go to `/audit-externe/nouveau`, create an audit with `startDateTime` set to 1 month from today (so it's inside the 3-month reminder window), pick yourself (or another seeded user) as Responsable, submit.
Expected: redirect to `/audit-externe/:id` detail page; "Rappel responsable" shows "Envoye le ..." (not "Pas encore envoye") since the date is already under 3 months out — this confirms the synchronous immediate-check path fired.

- [ ] **Step 4: Verify the in-app notification arrived**

As the Responsable user, check the bell icon in the header.
Expected: unread badge shows 1, opening it shows the "Audit externe a venir" notification, clicking it navigates to the audit's detail page and clears the unread badge.

- [ ] **Step 5: Verify it shows on the calendar**

Go to `/calendar`, navigate to the month containing the audit's date.
Expected: the audit appears as a mission event with the "Ext." badge (existing `AUDIT_EXTERNE` styling), tinted by the client's color.

- [ ] **Step 6: Verify creation from the calendar's mission form does NOT trigger a reminder yet**

Create another audit with `startDateTime` set to 6 months from today (outside the window), this time via `/missions/nouvelle` by selecting `missionType = Audit externe` and filling in the inline audit fields.
Expected: it appears in `/audit-externe` list and on the calendar; its detail page shows "Pas encore envoye" (no reminder yet, correctly outside the 3-month window).

- [ ] **Step 7: Verify the edit-resets-reminder behavior**

Edit the audit from Step 3 (already reminded) via `/audit-externe/:id/modifier`, change its date to something still within 3 months but different from before, save.
Expected: detail page's "Rappel responsable" updates to a fresh "Envoye le [today]" timestamp (proves `reminderSentAt` was reset to null on date change, then immediately re-sent since the new date is still inside the window).

- [ ] **Step 8: Verify archiving**

From the `/audit-externe` list, archive the audit from Step 6.
Expected: it disappears from the default list view, and its underlying calendar event no longer appears on `/calendar` for that date.

- [ ] **Step 9: Stop the dev servers**

Run (adjust PIDs from `netstat -ano | grep -E ":3000 |:4000 "`):
```bash
netstat -ano | grep -E ":3000 |:4000 " | grep LISTENING
```
Then kill each PID found via `powershell -NoProfile -Command "Stop-Process -Id <pid> -Force"`.

---

## Self-Review Notes

- **Spec coverage**: data model (Task 1), API surface (Task 4), reminder mechanism with both triggers (Tasks 3, 5), frontend list/create/edit/detail (Tasks 8-10), calendar integration via shared field component (Task 11), navigation (Task 12), in-app notification channel (Tasks 3, 13), manual verification matching spec section 7 (Task 14) — all covered.
- **Type consistency checked**: `AuditExterneFieldValues` (Task 7) field names (`clientId, responsableId, typeAudit, reference, organisme, auditeur`) match what Tasks 9, 10, and 11 register against; `checkAndNotifyIfDue(id: string)` (Task 5) signature matches both call sites in Task 4's `create`/`update`.
- **Known rough edge flagged inline**: Task 11 Step 1's `submit` override (letting `AUDIT_EXTERNE` submissions through despite missing `consultantAssignments`) is a pragmatic patch on an existing form rather than a clean redesign — acceptable since the alternative (forking `mission-create-form.tsx` into two components) would violate the "one shared code path" requirement from the spec. Flagged here for the implementer's awareness, not left silent.
