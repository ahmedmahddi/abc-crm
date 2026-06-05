import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { Prisma } from "@abc/db";
import {
  clientCreateSchema,
  clientListQuerySchema,
  clientUpdateSchema,
  type ClientCreateInput,
} from "@abc/shared";
import { z } from "zod";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class ClientsService {
  constructor(private readonly prisma: PrismaService) {}

  async findMany(query: unknown) {
    const { page, perPage, q, sortBy, sortDir, status } = parseInput(clientListQuerySchema, query);
    const where: Prisma.ClientWhereInput = {
      ...(status === "ALL" ? {} : { status }),
      ...(q
        ? {
            OR: [
              { companyName: { contains: q, mode: "insensitive" } },
              { fiscalNumber: { contains: q, mode: "insensitive" } },
              { activitySector: { contains: q, mode: "insensitive" } },
              { reference: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    };
    const [clients, total] = await this.prisma.$transaction([
      this.prisma.client.findMany({
        where,
        include: {
          consultants: {
            include: { consultant: { select: { id: true, fullName: true } } },
          },
        },
        orderBy: toClientOrderBy(sortBy, sortDir),
        skip: (page - 1) * perPage,
        take: perPage,
      }),
      this.prisma.client.count({ where }),
    ]);

    return {
      data: clients.map(toClientSummary),
      meta: { page, perPage, total, totalPages: Math.ceil(total / perPage) },
    };
  }

  async findOne(id: string) {
    return { data: await this.getClientDetail(id) };
  }

  async exportCsv(query: unknown) {
    const { q, sortBy, sortDir, status } = parseInput(clientListQuerySchema, query);
    const where: Prisma.ClientWhereInput = {
      ...(status === "ALL" ? {} : { status }),
      ...(q
        ? {
            OR: [
              { companyName: { contains: q, mode: "insensitive" } },
              { fiscalNumber: { contains: q, mode: "insensitive" } },
              { activitySector: { contains: q, mode: "insensitive" } },
              { reference: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    };
    const clients = await this.prisma.client.findMany({
      where,
      include: {
        consultants: { include: { consultant: { select: { fullName: true } } } },
      },
      orderBy: toClientOrderBy(sortBy, sortDir),
    });
    const rows = [
      ["Entreprise", "Matricule fiscal", "Zone", "Adresse", "Secteur", "Domaine", "Reference", "Cadres", "Non-cadres", "Effectif total", "Responsables", "Statut"],
      ...clients.map((client) => [
        client.companyName,
        client.fiscalNumber,
        client.zone ?? "",
        client.address,
        client.activitySector,
        client.applicationDomain ?? "",
        client.reference ?? "",
        String(client.cadreCount),
        String(client.nonCadreCount),
        String(client.cadreCount + client.nonCadreCount),
        client.consultants.map(({ consultant }) => consultant.fullName).join("; "),
        client.status,
      ]),
    ];
    return {
      content: `\uFEFF${rows.map((row) => row.map(escapeCsvCell).join(",")).join("\r\n")}`,
      filename: `clients-${new Date().toISOString().slice(0, 10)}.csv`,
    };
  }

  async create(body: unknown, userId: string) {
    const input = parseInput(clientCreateSchema, body);
    try {
      const client = await this.prisma.$transaction(async (transaction) => {
        const created = await transaction.client.create({ data: toCreateData(input) });
        await transaction.activityLog.create({
          data: {
            userId,
            action: "CLIENT_CREATED",
            entityType: "CLIENT",
            entityId: created.id,
            description: `Client créé: ${created.companyName}`,
          },
        });
        return created;
      });
      return { data: await this.getClientDetail(client.id) };
    } catch (error) {
      handleKnownDatabaseError(error);
    }
  }

  async update(id: string, body: unknown, userId: string) {
    const input = parseInput(clientUpdateSchema, body);
    try {
      await this.prisma.$transaction(async (transaction) => {
        const current = await transaction.client.findUnique({ where: { id } });
        if (!current) throw new NotFoundException("Client introuvable");
        if (current.version !== input.version) {
          throw new ConflictException("Le client a été modifié depuis votre dernière consultation");
        }

        const { contacts, responsibleConsultantIds, version, ...fields } = input;
        await transaction.client.update({
          where: { id },
          data: {
            ...toUpdateFields(fields),
            version: { increment: 1 },
            ...(contacts
              ? {
                  personnel: {
                    deleteMany: {},
                    create: contacts.map(toPersonnelInput),
                  },
                }
              : {}),
            ...(responsibleConsultantIds
              ? {
                  consultants: {
                    deleteMany: {},
                    create: responsibleConsultantIds.map((consultantId) => ({ consultantId })),
                  },
                }
              : {}),
          },
        });
        void version;
        await transaction.activityLog.create({
          data: {
            userId,
            action: "CLIENT_UPDATED",
            entityType: "CLIENT",
            entityId: id,
          },
        });
      });
      return { data: await this.getClientDetail(id) };
    } catch (error) {
      handleKnownDatabaseError(error);
    }
  }

  async archive(id: string, userId: string) {
    await this.prisma.$transaction(async (transaction) => {
      const current = await transaction.client.findUnique({ where: { id } });
      if (!current) throw new NotFoundException("Client introuvable");
      if (current.status === "ARCHIVED") return;
      await transaction.client.update({
        where: { id },
        data: { status: "ARCHIVED", archivedAt: new Date(), version: { increment: 1 } },
      });
      await transaction.activityLog.create({
        data: { userId, action: "CLIENT_ARCHIVED", entityType: "CLIENT", entityId: id },
      });
    });
    return { data: await this.getClientDetail(id) };
  }

  async restore(id: string, userId: string) {
    await this.prisma.$transaction(async (transaction) => {
      const current = await transaction.client.findUnique({ where: { id } });
      if (!current) throw new NotFoundException("Client introuvable");
      if (current.status === "ACTIVE") return;
      await transaction.client.update({
        where: { id },
        data: { status: "ACTIVE", archivedAt: null, version: { increment: 1 } },
      });
      await transaction.activityLog.create({
        data: { userId, action: "CLIENT_RESTORED", entityType: "CLIENT", entityId: id },
      });
    });
    return { data: await this.getClientDetail(id) };
  }

  private async getClientDetail(id: string) {
    const client = await this.prisma.client.findUnique({
      where: { id },
      include: {
        consultants: {
          include: { consultant: { select: { id: true, fullName: true, email: true } } },
        },
        personnel: { orderBy: { fullName: "asc" } },
        documents: {
          include: {
            file: { select: { id: true, originalName: true, mimeType: true, size: true, createdAt: true } },
          },
          orderBy: { createdAt: "desc" },
        },
        missions: {
          select: { id: true, title: true, startDateTime: true, endDateTime: true, status: true },
          orderBy: { startDateTime: "desc" },
        },
      },
    });
    if (!client) throw new NotFoundException("Client introuvable");
    return toClientDetail(client);
  }
}

function toCreateData(input: ClientCreateInput): Prisma.ClientCreateInput {
  const { contacts, responsibleConsultantIds } = input;
  const normalizedContacts = contacts.filter(hasContactData);
  return {
    companyName: normalizeRequiredText(input.companyName, "Client sans nom"),
    fiscalNumber: normalizeRequiredText(input.fiscalNumber, createTemporaryFiscalNumber()),
    address: normalizeOptionalText(input.address),
    zone: input.zone || null,
    activitySector: normalizeOptionalText(input.activitySector),
    applicationDomain: input.applicationDomain || null,
    reference: input.reference || null,
    color: input.color || "#125885",
    cadreCount: input.cadreCount ?? 0,
    nonCadreCount: input.nonCadreCount ?? 0,
    personnel: { create: normalizedContacts.map(toPersonnelInput) },
    consultants: {
      create: responsibleConsultantIds.map((consultantId) => ({ consultantId })),
    },
  };
}

function toUpdateFields(fields: Omit<ReturnType<typeof clientUpdateSchema.parse>, "contacts" | "responsibleConsultantIds" | "version">): Prisma.ClientUpdateInput {
  return {
    ...(fields.companyName !== undefined ? { companyName: fields.companyName } : {}),
    ...(fields.fiscalNumber !== undefined ? { fiscalNumber: fields.fiscalNumber } : {}),
    ...(fields.address !== undefined ? { address: fields.address } : {}),
    ...(fields.zone !== undefined ? { zone: fields.zone } : {}),
    ...(fields.activitySector !== undefined ? { activitySector: fields.activitySector } : {}),
    ...(fields.applicationDomain !== undefined ? { applicationDomain: fields.applicationDomain } : {}),
    ...(fields.reference !== undefined ? { reference: fields.reference || null } : {}),
    ...(fields.color !== undefined ? { color: fields.color } : {}),
    ...(fields.cadreCount !== undefined ? { cadreCount: fields.cadreCount } : {}),
    ...(fields.nonCadreCount !== undefined ? { nonCadreCount: fields.nonCadreCount } : {}),
  };
}

function toPersonnelInput(contact: ClientCreateInput["contacts"][number]) {
  return {
    fullName: normalizeRequiredText(contact.fullName, "Contact sans nom"),
    type: contact.type ?? "CADRE",
    position: normalizeNullableText(contact.position),
    phone: normalizeNullableText(contact.phone),
    email: normalizeNullableText(contact.email),
  };
}

function hasContactData(contact: ClientCreateInput["contacts"][number]) {
  return [contact.fullName, contact.position, contact.phone, contact.email].some(
    (value) => Boolean(value?.trim()),
  );
}

function normalizeRequiredText(value: string | undefined, fallback: string) {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : fallback;
}

function normalizeOptionalText(value: string | undefined) {
  return value?.trim() ?? "";
}

function normalizeNullableText(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
}

function createTemporaryFiscalNumber() {
  return `TEMP-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${randomUUID().slice(0, 8)}`;
}

function toClientSummary<T extends ClientWithConsultants>(client: T) {
  const { consultants, ...fields } = client;
  return {
    ...fields,
    totalEmployees: client.cadreCount + client.nonCadreCount,
    responsibleConsultants: consultants.map(({ consultant }) => consultant),
  };
}

function toClientDetail<T extends ClientWithConsultants>(client: T) {
  return toClientSummary(client);
}

function escapeCsvCell(value: string) {
  return /[",\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

function toClientOrderBy(
  sortBy: "activitySector" | "companyName" | "createdAt" | "fiscalNumber" | "status",
  sortDir: "asc" | "desc",
): Prisma.ClientOrderByWithRelationInput {
  return { [sortBy]: sortDir };
}

type ClientWithConsultants = {
  cadreCount: number;
  nonCadreCount: number;
  consultants: Array<{ consultant: unknown }>;
};

function parseInput<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (result.success) return result.data;
  throw new BadRequestException({
    error: {
      code: "validation_error",
      message: "La requête contient des champs invalides",
      details: z.flattenError(result.error).fieldErrors,
    },
  });
}

function handleKnownDatabaseError(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    throw new ConflictException("Un client utilise déjà ce matricule fiscal");
  }
  throw error;
}
