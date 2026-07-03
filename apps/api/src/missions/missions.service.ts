import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { Prisma } from "@abc/db";
import {
  missionCalendarQuerySchema,
  missionCancelSchema,
  missionCreateSchema,
  missionListQuerySchema,
  missionUpdateSchema,
  type MissionCancelInput,
  type MissionCreateInput,
  type MissionUpdateInput,
} from "@abc/shared";
import { z } from "zod";
import { NotificationsService } from "../notifications/notifications.service";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class MissionsService {
  private readonly logger = new Logger(MissionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async findMany(query: unknown) {
    const { page, perPage, q, status, clientId, consultantId, from, to } = parseInput(
      missionListQuerySchema,
      query,
    );
    const where: Prisma.MissionWhereInput = {
      archivedAt: null,
      ...(status === "ALL" ? {} : { status }),
      ...(clientId ? { clientId } : {}),
      ...(consultantId ? { consultants: { some: { consultantId } } } : {}),
      ...(from ? { startDateTime: { gte: from } } : {}),
      ...(to ? { endDateTime: { lte: to } } : {}),
      ...(q
        ? {
            OR: [
              { title: { contains: q, mode: "insensitive" } },
              { description: { contains: q, mode: "insensitive" } },
              { client: { companyName: { contains: q, mode: "insensitive" } } },
            ],
          }
        : {}),
    };

    const [missions, total] = await this.prisma.$transaction([
      this.prisma.mission.findMany({
        where,
        include: missionInclude,
        orderBy: { startDateTime: "asc" },
        skip: (page - 1) * perPage,
        take: perPage,
      }),
      this.prisma.mission.count({ where }),
    ]);

    return {
      data: missions.map(toMissionSummary),
      meta: { page, perPage, total, totalPages: Math.ceil(total / perPage) },
    };
  }

  async findCalendar(query: unknown) {
    const { from, to } = parseInput(missionCalendarQuerySchema, query);
    if (to <= from) throw new BadRequestException("La fin de la periode doit etre posterieure au debut");
    const missions = await this.prisma.mission.findMany({
      where: {
        archivedAt: null,
        OR: [
          { status: "PLANNED" },
          { status: "CANCELLED", cancellationType: "CLIENT" },
        ],
        startDateTime: { lt: to },
        endDateTime: { gt: from },
      },
      include: missionInclude,
      orderBy: { startDateTime: "asc" },
    });
    return { data: missions.map(toMissionSummary) };
  }

  async findOne(id: string) {
    const mission = await this.prisma.mission.findUnique({ where: { id }, include: missionInclude });
    if (!mission || mission.archivedAt) throw new NotFoundException("Mission introuvable");
    return { data: toMissionDetail(mission) };
  }

  async create(body: unknown, userId: string) {
    const input = parseInput(missionCreateSchema, body);
    try {
      const mission = await this.prisma.$transaction(async (transaction) => {
        await assertClientExists(transaction, input.clientId);
        const consultantAssignments = getConsultantAssignments(input);
        if (!consultantAssignments) throw new BadRequestException("Selectionnez au moins un consultant");
        await assertConsultantsExist(transaction, consultantAssignments.map(({ consultantId }) => consultantId));

        const created = await transaction.mission.create({
          data: toMissionCreateData(input, userId, consultantAssignments),
          include: missionInclude,
        });

        await transaction.activityLog.create({
          data: {
            userId,
            action: "MISSION_CREATED",
            entityType: "MISSION",
            entityId: created.id,
            description: `Mission creee: ${created.title}`,
          },
        });

        return created;
      });
      await this.notifyMissionUsers(mission, "Nouvelle mission", `${mission.client.companyName} - ${mission.title}`);
      return { data: toMissionDetail(mission) };
    } catch (error) {
      handleKnownDatabaseError(error);
    }
  }

  async update(id: string, body: unknown, userId: string) {
    const input = parseInput(missionUpdateSchema, body);
    try {
      const mission = await this.prisma.$transaction(async (transaction) => {
        const current = await transaction.mission.findUnique({ where: { id } });
        if (!current || current.archivedAt) throw new NotFoundException("Mission introuvable");
        if (current.version !== input.version) {
          throw new ConflictException("La mission a ete modifiee depuis votre derniere consultation");
        }
        if (input.clientId) await assertClientExists(transaction, input.clientId);
        const consultantAssignments = getConsultantAssignments(input);
        if (consultantAssignments) {
          await assertConsultantsExist(transaction, consultantAssignments.map(({ consultantId }) => consultantId));
        }

        const { consultantAssignments: _consultantAssignments, consultantIds: _consultantIds, version, ...fields } = input;
        void _consultantAssignments;
        void _consultantIds;
        void version;
        const updated = await transaction.mission.update({
          where: { id },
          data: {
            ...toMissionUpdateData(fields),
            version: { increment: 1 },
            ...(consultantAssignments
              ? {
                  consultants: {
                    deleteMany: {},
                    create: consultantAssignments,
                  },
                }
              : {}),
          },
          include: missionInclude,
        });

        await transaction.activityLog.create({
          data: { userId, action: "MISSION_UPDATED", entityType: "MISSION", entityId: id },
        });
        return updated;
      });
      await this.notifyMissionUsers(mission, "Mission modifiee", `${mission.client.companyName} - ${mission.title}`);
      return { data: toMissionDetail(mission) };
    } catch (error) {
      handleKnownDatabaseError(error);
    }
  }

  async cancel(id: string, body: unknown, userId: string) {
    const input = parseInput(missionCancelSchema, body);
    const mission = await this.prisma.$transaction(async (transaction) => {
      const current = await transaction.mission.findUnique({ where: { id } });
      if (!current || current.archivedAt) throw new NotFoundException("Mission introuvable");
      if (current.version !== input.version) {
        throw new ConflictException("La mission a ete modifiee depuis votre derniere consultation");
      }

      const updated = await transaction.mission.update({
        where: { id },
        data: toMissionCancelData(input),
        include: missionInclude,
      });
      await transaction.activityLog.create({
        data: {
          userId,
          action: input.cancellationType === "CLIENT" ? "MISSION_CANCELLED_CLIENT" : "MISSION_CANCELLED_INTERNAL",
          entityType: "MISSION",
          entityId: id,
          description: input.cancellationReason?.trim() || null,
        },
      });
      return updated;
    });
    await this.notifyMissionUsers(
      mission,
      input.cancellationType === "CLIENT" ? "Mission annulee cote client" : "Mission annulee en interne",
      `${mission.client.companyName} - ${mission.title}`,
    );
    return { data: toMissionDetail(mission) };
  }

  async archive(id: string, userId: string) {
    const mission = await this.prisma.$transaction(async (transaction) => {
      const current = await transaction.mission.findUnique({ where: { id } });
      if (!current || current.archivedAt) throw new NotFoundException("Mission introuvable");
      const updated = await transaction.mission.update({
        where: { id },
        data: {
          archivedAt: new Date(),
          cancelledAt: new Date(),
          cancellationType: "INTERNAL",
          status: "CANCELLED",
          version: { increment: 1 },
        },
        include: missionInclude,
      });
      await transaction.activityLog.create({
        data: { userId, action: "MISSION_ARCHIVED", entityType: "MISSION", entityId: id },
      });
      return updated;
    });
    return { data: toMissionDetail(mission) };
  }

  private async notifyMissionUsers(mission: MissionWithRelations, title: string, body: string) {
    const userIds = mission.consultants
      .map(({ consultant }) => consultant.userId)
      .filter((userId): userId is string => Boolean(userId));
    const result = await this.notifications.sendToUsers(userIds, {
      title,
      body,
      url: `/missions/${mission.id}`,
      tag: `mission-${mission.id}`,
    });
    if (result.data.sent === 0) {
      this.logger.warn(
        `No mission push notifications sent for mission ${mission.id}; recipients=${userIds.length}; skipped=${result.data.skipped}`,
      );
    }
  }
}

const missionInclude = {
  client: { select: { id: true, companyName: true, color: true, status: true } },
  consultants: {
    include: { consultant: { select: { id: true, fullName: true, email: true, color: true, status: true, userId: true } } },
  },
} satisfies Prisma.MissionInclude;

type MissionWithRelations = Prisma.MissionGetPayload<{ include: typeof missionInclude }>;
type MissionUpdateFields = Omit<MissionUpdateInput, "consultantAssignments" | "consultantIds" | "version">;
type MissionConsultantAssignment = { consultantId: string; role: "RESPONSABLE" | "PARTICIPANT" };

function toMissionCreateData(
  input: MissionCreateInput,
  userId: string,
  consultantAssignments: MissionConsultantAssignment[],
): Prisma.MissionCreateInput {
  return {
    title: input.title,
    missionType: input.missionType,
    missionTypeOtherLabel: getMissionTypeOtherLabel(input.missionType, input.missionTypeOtherLabel),
    missionMode: input.missionMode,
    startDateTime: input.startDateTime,
    endDateTime: input.endDateTime,
    location: input.location || null,
    description: input.description || null,
    status: input.status,
    client: { connect: { id: input.clientId } },
    createdBy: { connect: { id: userId } },
    consultants: {
      create: consultantAssignments,
    },
  };
}

function getConsultantAssignments(
  input: Pick<MissionCreateInput, "consultantAssignments" | "consultantIds"> | Pick<MissionUpdateInput, "consultantAssignments" | "consultantIds">,
): MissionConsultantAssignment[] | undefined {
  if (input.consultantAssignments?.length) return dedupeAssignments(input.consultantAssignments);
  if (input.consultantIds?.length) {
    return dedupeAssignments(
      input.consultantIds.map((consultantId, index) => ({
        consultantId,
        role: index === 0 ? "RESPONSABLE" : "PARTICIPANT",
      })),
    );
  }
  return undefined;
}

function dedupeAssignments(assignments: MissionConsultantAssignment[]) {
  const seen = new Set<string>();
  return assignments.filter((assignment) => {
    if (seen.has(assignment.consultantId)) return false;
    seen.add(assignment.consultantId);
    return true;
  });
}

function toMissionUpdateData(fields: MissionUpdateFields): Prisma.MissionUpdateInput {
  return {
    ...(fields.clientId !== undefined ? { client: { connect: { id: fields.clientId } } } : {}),
    ...(fields.title !== undefined ? { title: fields.title } : {}),
    ...(fields.missionType !== undefined ? { missionType: fields.missionType } : {}),
    ...(fields.missionType !== undefined
      ? { missionTypeOtherLabel: getMissionTypeOtherLabel(fields.missionType, fields.missionTypeOtherLabel) }
      : fields.missionTypeOtherLabel !== undefined
        ? { missionTypeOtherLabel: fields.missionTypeOtherLabel.trim() || null }
        : {}),
    ...(fields.missionMode !== undefined ? { missionMode: fields.missionMode } : {}),
    ...(fields.startDateTime !== undefined ? { startDateTime: fields.startDateTime } : {}),
    ...(fields.endDateTime !== undefined ? { endDateTime: fields.endDateTime } : {}),
    ...(fields.location !== undefined ? { location: fields.location || null } : {}),
    ...(fields.description !== undefined ? { description: fields.description || null } : {}),
    ...(fields.status !== undefined ? { status: fields.status } : {}),
  };
}

function getMissionTypeOtherLabel(missionType: MissionCreateInput["missionType"], otherLabel?: string) {
  return missionType === "AUTRE" ? otherLabel?.trim() || null : null;
}

function toMissionCancelData(input: MissionCancelInput): Prisma.MissionUpdateInput {
  const cancellationReason = input.cancellationReason?.trim();
  return {
    archivedAt: input.cancellationType === "INTERNAL" ? new Date() : null,
    cancelledAt: new Date(),
    cancellationReason: cancellationReason && cancellationReason.length > 0 ? cancellationReason : null,
    cancellationType: input.cancellationType,
    status: "CANCELLED",
    version: { increment: 1 },
  };
}

function toMissionSummary(mission: MissionWithRelations) {
  return {
    ...mission,
    consultants: mission.consultants.map(({ role, consultant }) => ({ ...consultant, role })),
  };
}

function toMissionDetail(mission: MissionWithRelations) {
  return toMissionSummary(mission);
}

async function assertClientExists(transaction: Prisma.TransactionClient, clientId: string) {
  const client = await transaction.client.findUnique({
    where: { id: clientId },
    select: { id: true, status: true },
  });
  if (!client || client.status === "ARCHIVED") throw new BadRequestException("Client introuvable ou archive");
}

async function assertConsultantsExist(transaction: Prisma.TransactionClient, consultantIds: string[]) {
  const uniqueIds = [...new Set(consultantIds)];
  const count = await transaction.consultant.count({
    where: { id: { in: uniqueIds }, status: { not: "ARCHIVED" } },
  });
  if (count !== uniqueIds.length) {
    throw new BadRequestException("Un ou plusieurs consultants sont introuvables ou archives");
  }
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
