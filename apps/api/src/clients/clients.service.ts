import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { Prisma } from "@abc/db";
import {
  type ClientImportResult,
  clientCreateSchema,
  clientListQuerySchema,
  clientUpdateSchema,
  type ClientCreateInput,
} from "@abc/shared";
import ExcelJS from "exceljs";
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

  async importExcel(file: Express.Multer.File | undefined, userId: string) {
    assertExcelFile(file);

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(Uint8Array.from(file.buffer).buffer);
    const worksheet = workbook.worksheets[0];
    if (!worksheet) throw new BadRequestException("Le fichier Excel ne contient aucune feuille exploitable");

    const header = findClientHeader(worksheet);
    const parsedRows = parseClientRows(worksheet, header);
    if (parsedRows.length === 0) {
      throw new BadRequestException("Aucun client valide n'a ete trouve dans le fichier Excel");
    }

    const result: ClientImportResult = { created: 0, skipped: 0, failed: 0, rows: [] };

    for (const row of parsedRows) {
      try {
        const status = await this.prisma.$transaction(async (transaction) => {
          const existing = await transaction.client.findFirst({
            where: { companyName: { equals: row.companyName, mode: "insensitive" } },
            select: { id: true },
          });
          if (existing) return "SKIPPED" as const;

          const contacts = buildImportedContacts(row.contactNames, row.emails);
          const created = await transaction.client.create({
            data: toCreateData({
              companyName: row.companyName,
              fiscalNumber: "",
              address: row.address,
              zone: "",
              activitySector: row.activitySector,
              applicationDomain: row.applicationDomain,
              reference: row.reference,
              color: "#125885",
              cadreCount: contacts.length,
              nonCadreCount: 0,
              responsibleConsultantIds: [],
              contacts,
            }),
          });
          await transaction.activityLog.create({
            data: {
              userId,
              action: "CLIENT_IMPORTED",
              entityType: "CLIENT",
              entityId: created.id,
              description: `Client importe depuis Excel: ${created.companyName}`,
            },
          });
          return "CREATED" as const;
        });

        result[status === "CREATED" ? "created" : "skipped"] += 1;
        result.rows.push({
          rowNumber: row.rowNumber,
          companyName: row.companyName,
          status,
          ...(status === "SKIPPED" ? { reason: "Client deja present" } : {}),
        });
      } catch (error) {
        result.failed += 1;
        result.rows.push({
          rowNumber: row.rowNumber,
          companyName: row.companyName,
          status: "FAILED",
          reason: getImportErrorMessage(error),
        });
      }
    }

    return { data: result };
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

function assertExcelFile(file: Express.Multer.File | undefined): asserts file is Express.Multer.File {
  if (!file) throw new BadRequestException("Fichier Excel manquant");
  const lowerName = file.originalname.toLowerCase();
  const isExcel =
    lowerName.endsWith(".xlsx") ||
    lowerName.endsWith(".xls") ||
    file.mimetype === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    file.mimetype === "application/vnd.ms-excel";
  if (!isExcel) throw new BadRequestException("Format non supporte. Importez un fichier Excel .xlsx ou .xls");
}

type ClientImportHeader = {
  headerRow: number;
  companyName: number;
  activitySector: number;
  address: number;
  contact: number;
  email: number;
  reference: number;
  applicationDomain: number;
};

type ParsedClientImportRow = {
  rowNumber: number;
  companyName: string;
  activitySector: string;
  address: string;
  contactNames: string[];
  emails: string[];
  reference: string;
  applicationDomain: string;
};

function findClientHeader(worksheet: ExcelJS.Worksheet): ClientImportHeader {
  for (let rowNumber = 1; rowNumber <= Math.min(worksheet.rowCount, 15); rowNumber += 1) {
    const row = worksheet.getRow(rowNumber);
    const companyName = findHeaderColumn(row, ["clients", "client"]);
    const activitySector = findHeaderColumn(row, ["domaine d'activite", "domaine activite", "secteur"]);
    const address = findHeaderColumn(row, ["adresse", "address"]);
    const contact = findHeaderColumn(row, ["contact"]);
    const email = findHeaderColumn(row, ["e-mail", "email", "mail"]);
    const reference = findHeaderColumn(row, ["referentiels", "reference"]);
    const applicationDomain = findHeaderColumn(row, ["audit"]);
    if (companyName && activitySector && address) {
      return {
        headerRow: rowNumber,
        companyName,
        activitySector,
        address,
        contact: contact ?? 0,
        email: email ?? 0,
        reference: reference ?? 0,
        applicationDomain: applicationDomain ?? 0,
      };
    }
  }
  throw new BadRequestException("Colonnes clients introuvables. Verifiez que le fichier contient une ligne d'en-tete.");
}

function findHeaderColumn(row: ExcelJS.Row, labels: string[]) {
  for (let column = 1; column <= row.cellCount; column += 1) {
    const normalized = normalizeHeader(cellToText(row.getCell(column).value));
    if (labels.some((label) => normalized.includes(normalizeHeader(label)))) return column;
  }
  return undefined;
}

function parseClientRows(worksheet: ExcelJS.Worksheet, header: ClientImportHeader): ParsedClientImportRow[] {
  const rows: ParsedClientImportRow[] = [];
  for (let rowNumber = header.headerRow + 1; rowNumber <= worksheet.rowCount; rowNumber += 1) {
    const row = worksheet.getRow(rowNumber);
    const companyName = cellToText(row.getCell(header.companyName).value);
    if (!companyName) continue;

    rows.push({
      rowNumber,
      companyName,
      activitySector: cellToText(row.getCell(header.activitySector).value),
      address: cellToText(row.getCell(header.address).value),
      contactNames: splitList(cellToText(header.contact ? row.getCell(header.contact).value : "")),
      emails: splitEmails(cellToText(header.email ? row.getCell(header.email).value : "")),
      reference: cellToText(header.reference ? row.getCell(header.reference).value : ""),
      applicationDomain: cellToText(header.applicationDomain ? row.getCell(header.applicationDomain).value : ""),
    });
  }
  return rows;
}

function buildImportedContacts(contactNames: string[], emails: string[]): ClientCreateInput["contacts"] {
  if (contactNames.length === 0) {
    return emails.map((email) => ({
      fullName: email.split("@")[0] ?? email,
      email,
      type: "CADRE" as const,
    }));
  }

  return contactNames.map((fullName, index) => ({
    fullName,
    email: emails[index] ?? emails[0] ?? "",
    type: "CADRE" as const,
  }));
}

function splitList(value: string) {
  return value
    .split(/[,;\n\r]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function splitEmails(value: string) {
  return value
    .split(/[\s,;]+/)
    .map((item) => item.trim())
    .filter((item) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(item));
}

function cellToText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value).trim();
  }
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "object") {
    if ("text" in value && typeof value.text === "string") return value.text.trim();
    if ("result" in value) return cellToText(value.result);
    if ("richText" in value && Array.isArray(value.richText)) {
      return value.richText.map((part) => (typeof part?.text === "string" ? part.text : "")).join("").trim();
    }
  }
  return "";
}

function normalizeHeader(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function getImportErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) return error.message;
  return "Import impossible pour cette ligne";
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
