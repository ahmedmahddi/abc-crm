import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@abc/db";
import { consultantColorPalette, consultantCreateSchema, consultantListQuerySchema, consultantUpdateSchema } from "@abc/shared";
import { z } from "zod";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class ConsultantsService {
  constructor(private readonly prisma: PrismaService) {}

  async findMany(query: unknown) {
    const { page, perPage, q, status } = parseInput(consultantListQuerySchema, query);
    const where: Prisma.ConsultantWhereInput = {
      ...(status === "ALL" ? {} : { status }),
      ...(q ? { OR: [{ fullName: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }] } : {}),
    };
    const [consultants, total] = await this.prisma.$transaction([
      this.prisma.consultant.findMany({
        where,
        include: { _count: { select: { clients: true, missions: true } } },
        orderBy: { fullName: "asc" },
        skip: (page - 1) * perPage,
        take: perPage,
      }),
      this.prisma.consultant.count({ where }),
    ]);
    return { data: consultants.map(toSummary), meta: { page, perPage, total, totalPages: Math.ceil(total / perPage) } };
  }

  async findOne(id: string) {
    const consultant = await this.prisma.consultant.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, name: true, email: true, role: true, status: true } },
        clients: { include: { client: { select: { id: true, companyName: true, status: true } } } },
        missions: { include: { mission: { select: { id: true, title: true, startDateTime: true, endDateTime: true, status: true, client: { select: { companyName: true } } } } } },
      },
    });
    if (!consultant) throw new NotFoundException("Consultant introuvable");
    return { data: consultant };
  }

  async create(body: unknown, userId: string) {
    const input = parseInput(consultantCreateSchema, body);
    try {
      const consultant = await this.prisma.$transaction(async (transaction) => {
        const created = await transaction.consultant.create({
          data: {
            ...input,
            color: input.color ?? getDefaultConsultantColor(input.email),
            phone: input.phone || null,
          },
        });
        await transaction.activityLog.create({ data: { userId, action: "CONSULTANT_CREATED", entityType: "CONSULTANT", entityId: created.id } });
        return created;
      });
      return { data: consultant };
    } catch (error) {
      handleKnownDatabaseError(error);
    }
  }

  async update(id: string, body: unknown, userId: string) {
    const input = parseInput(consultantUpdateSchema, body);
    try {
      const consultant = await this.prisma.$transaction(async (transaction) => {
        const current = await transaction.consultant.findUnique({ where: { id } });
        if (!current) throw new NotFoundException("Consultant introuvable");
        if (current.version !== input.version) throw new ConflictException("Le consultant a été modifié depuis votre dernière consultation");
        const { version, ...fields } = input;
        void version;
        const updated = await transaction.consultant.update({
          where: { id },
          data: {
            ...(fields.fullName !== undefined ? { fullName: fields.fullName } : {}),
            ...(fields.email !== undefined ? { email: fields.email } : {}),
            ...(fields.color !== undefined ? { color: fields.color } : {}),
            ...(fields.phone !== undefined ? { phone: fields.phone || null } : {}),
            ...(fields.status !== undefined ? { status: fields.status } : {}),
            version: { increment: 1 },
          },
        });
        await transaction.activityLog.create({ data: { userId, action: "CONSULTANT_UPDATED", entityType: "CONSULTANT", entityId: id } });
        return updated;
      });
      return { data: consultant };
    } catch (error) {
      handleKnownDatabaseError(error);
    }
  }

  async archive(id: string, userId: string) {
    const consultant = await this.prisma.$transaction(async (transaction) => {
      const current = await transaction.consultant.findUnique({ where: { id } });
      if (!current) throw new NotFoundException("Consultant introuvable");
      if (current.status === "ARCHIVED") return current;
      const updated = await transaction.consultant.update({
        where: { id },
        data: { status: "ARCHIVED", archivedAt: new Date(), version: { increment: 1 } },
      });
      await transaction.activityLog.create({ data: { userId, action: "CONSULTANT_ARCHIVED", entityType: "CONSULTANT", entityId: id } });
      return updated;
    });
    return { data: consultant };
  }

  async restore(id: string, userId: string) {
    const consultant = await this.prisma.$transaction(async (transaction) => {
      const current = await transaction.consultant.findUnique({ where: { id } });
      if (!current) throw new NotFoundException("Consultant introuvable");
      if (current.status !== "ARCHIVED") return current;
      const updated = await transaction.consultant.update({
        where: { id },
        data: { status: "ACTIVE", archivedAt: null, version: { increment: 1 } },
      });
      await transaction.activityLog.create({ data: { userId, action: "CONSULTANT_RESTORED", entityType: "CONSULTANT", entityId: id } });
      return updated;
    });
    return { data: consultant };
  }
}

function getDefaultConsultantColor(seed: string) {
  let hash = 0;
  for (const character of seed) {
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  }
  return consultantColorPalette[hash % consultantColorPalette.length] ?? consultantColorPalette[0];
}

function toSummary(consultant: { _count: { clients: number; missions: number }; [key: string]: unknown }) {
  const { _count, ...fields } = consultant;
  return { ...fields, activeClientCount: _count.clients, missionCount: _count.missions };
}

function parseInput<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (result.success) return result.data;
  throw new BadRequestException({ error: { code: "validation_error", message: "La requête contient des champs invalides", details: z.flattenError(result.error).fieldErrors } });
}

function handleKnownDatabaseError(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new ConflictException("Un consultant utilise déjà cet email");
  throw error;
}
