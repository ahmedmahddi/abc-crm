import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@abc/db";
import {
  auditExterneCreateSchema,
  auditExterneListQuerySchema,
  auditExterneUpdateSchema,
  MISSION_TYPE_LABELS,
  type AuditExterneReference,
  type AuditExterneType,
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
  q?: string | undefined;
  typeAudit?: AuditExterneType | undefined;
  reference?: AuditExterneReference | undefined;
  clientId?: string | undefined;
  responsableId?: string | undefined;
  from?: Date | undefined;
  to?: Date | undefined;
}): Prisma.AuditExterneWhereInput {
  return {
    mission: {
      archivedAt: null,
      ...(filters.from ? { startDateTime: { gte: filters.from } } : {}),
      ...(filters.to ? { startDateTime: { lte: filters.to } } : {}),
    },
    ...(filters.typeAudit ? { typeAudit: filters.typeAudit } : {}),
    ...(filters.reference ? { reference: filters.reference } : {}),
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
