import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@abc/db";
import {
  getMissionTypeLabel,
  ordreMissionCreateSchema,
  ordreMissionListQuerySchema,
  ordreMissionUpdateSchema,
  type OrdreMissionCreateInput,
  type OrdreMissionUpdateInput,
} from "@abc/shared";
import { Workbook } from "exceljs";
import { chromium } from "playwright";
import { z } from "zod";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class OrdreMissionService {
  constructor(private readonly prisma: PrismaService) {}

  async findMany(query: unknown) {
    const { page, perPage, q, status, clientId, from, to } = parseInput(ordreMissionListQuerySchema, query);
    const where: Prisma.OrdreMissionWhereInput = {
      ...(status === "ALL" ? {} : status === "ARCHIVED" ? { archivedAt: { not: null } } : { archivedAt: null, status }),
      ...(clientId ? { clientId } : {}),
      ...(from ? { startDateTime: { gte: from } } : {}),
      ...(to ? { endDateTime: { lte: to } } : {}),
      ...(q
        ? {
            OR: [
              { reference: { contains: q, mode: "insensitive" } },
              { object: { contains: q, mode: "insensitive" } },
              { description: { contains: q, mode: "insensitive" } },
              { client: { companyName: { contains: q, mode: "insensitive" } } },
            ],
          }
        : {}),
    };

    const [ordres, total] = await this.prisma.$transaction([
      this.prisma.ordreMission.findMany({
        where,
        include: ordreMissionInclude,
        orderBy: [{ startDateTime: "desc" }, { reference: "desc" }],
        skip: (page - 1) * perPage,
        take: perPage,
      }),
      this.prisma.ordreMission.count({ where }),
    ]);

    return { data: ordres.map(toOrdreMissionSummary), meta: { page, perPage, total, totalPages: Math.ceil(total / perPage) } };
  }

  async findOne(id: string) {
    const ordre = await this.prisma.ordreMission.findUnique({ where: { id }, include: ordreMissionInclude });
    if (!ordre) throw new NotFoundException("Ordre de mission introuvable");
    return { data: toOrdreMissionDetail(ordre) };
  }

  async create(body: unknown, userId: string) {
    const input = parseInput(ordreMissionCreateSchema, body);
    try {
      const ordre = await this.prisma.$transaction(async (transaction) => {
        await assertClientExists(transaction, input.clientId);
        await assertConsultantsExist(transaction, input.consultantIds);
        if (input.missionId) await assertMissionExists(transaction, input.missionId);
        if (input.templateId) await assertTemplateExists(transaction, input.templateId);

        const reference = await nextOrdreMissionReference(transaction, input.startDateTime);
        const created = await transaction.ordreMission.create({
          data: toOrdreMissionCreateData(input, userId, reference),
          include: ordreMissionInclude,
        });
        await transaction.activityLog.create({
          data: { userId, action: "ORDRE_MISSION_CREATED", entityType: "ORDRE_MISSION", entityId: created.id, description: `Ordre créé: ${reference}` },
        });
        return created;
      });
      return { data: toOrdreMissionDetail(ordre) };
    } catch (error) {
      handleKnownDatabaseError(error);
    }
  }

  async update(id: string, body: unknown, userId: string) {
    const input = parseInput(ordreMissionUpdateSchema, body);
    try {
      const ordre = await this.prisma.$transaction(async (transaction) => {
        const current = await transaction.ordreMission.findUnique({ where: { id } });
        if (!current || current.archivedAt) throw new NotFoundException("Ordre de mission introuvable");
        if (current.version !== input.version) throw new ConflictException("L'ordre de mission a été modifié depuis votre dernière consultation");
        if (input.clientId) await assertClientExists(transaction, input.clientId);
        if (input.consultantIds) await assertConsultantsExist(transaction, input.consultantIds);
        if (input.missionId) await assertMissionExists(transaction, input.missionId);
        if (input.templateId) await assertTemplateExists(transaction, input.templateId);

        const { consultantIds, version, ...fields } = input;
        void version;
        const updated = await transaction.ordreMission.update({
          where: { id },
          data: {
            ...toOrdreMissionUpdateData(fields),
            requiresReview: fields.requiresReview ?? false,
            version: { increment: 1 },
            ...(consultantIds
              ? {
                  consultants: {
                    deleteMany: {},
                    create: consultantIds.map((consultantId) => ({ consultantId })),
                  },
                }
              : {}),
          },
          include: ordreMissionInclude,
        });
        await transaction.activityLog.create({ data: { userId, action: "ORDRE_MISSION_UPDATED", entityType: "ORDRE_MISSION", entityId: id } });
        return updated;
      });
      return { data: toOrdreMissionDetail(ordre) };
    } catch (error) {
      handleKnownDatabaseError(error);
    }
  }

  async archive(id: string, userId: string) {
    const ordre = await this.prisma.$transaction(async (transaction) => {
      const current = await transaction.ordreMission.findUnique({ where: { id } });
      if (!current || current.archivedAt) throw new NotFoundException("Ordre de mission introuvable");
      const updated = await transaction.ordreMission.update({
        where: { id },
        data: { status: "ARCHIVED", archivedAt: new Date(), version: { increment: 1 } },
        include: ordreMissionInclude,
      });
      await transaction.activityLog.create({ data: { userId, action: "ORDRE_MISSION_ARCHIVED", entityType: "ORDRE_MISSION", entityId: id } });
      return updated;
    });
    return { data: toOrdreMissionDetail(ordre) };
  }

  validate(id: string, userId: string) {
    return this.transition(id, userId, ["DRAFT"], "VALIDATED", "ORDRE_MISSION_VALIDATED");
  }

  markPrinted(id: string, userId: string) {
    return this.transition(id, userId, ["VALIDATED", "PRINTED"], "PRINTED", "ORDRE_MISSION_PRINTED");
  }

  cancel(id: string, userId: string) {
    return this.transition(id, userId, ["DRAFT", "VALIDATED", "PRINTED"], "CANCELLED", "ORDRE_MISSION_CANCELLED");
  }

  async exportCsv(id: string) {
    const ordre = await this.getExportOrdre(id);
    const rows = [
      ["Référence", ordre.reference],
      ["Client", ordre.client.companyName],
      ["Objet", ordre.object],
      ["Type", getMissionTypeLabel(ordre.missionType, ordre.missionTypeOtherLabel)],
      ["Mode", ordre.missionMode],
      ["Début", formatDateTime(ordre.startDateTime)],
      ["Fin", formatDateTime(ordre.endDateTime)],
      ["Lieu", ordre.location ?? ""],
      ["Consultants", ordre.consultants.map(({ consultant }) => consultant.fullName).join(", ")],
      ["Statut", ordre.status],
    ];
    return {
      buffer: Buffer.from(`\uFEFF${rows.map((row) => row.map(toCsvCell).join(";")).join("\n")}`, "utf8"),
      filename: `${ordre.reference}.csv`,
      type: "text/csv; charset=utf-8",
    };
  }

  async exportXlsx(id: string) {
    const ordre = await this.getExportOrdre(id);
    const workbook = new Workbook();
    const sheet = workbook.addWorksheet("Ordre de mission");
    sheet.columns = [{ width: 22 }, { width: 58 }];
    sheet.addRows([
      ["ORDRE DE MISSION", ordre.reference],
      ["Client", ordre.client.companyName],
      ["Objet", ordre.object],
      ["Type", getMissionTypeLabel(ordre.missionType, ordre.missionTypeOtherLabel)],
      ["Mode", ordre.missionMode],
      ["Début", formatDateTime(ordre.startDateTime)],
      ["Fin", formatDateTime(ordre.endDateTime)],
      ["Lieu", ordre.location ?? ""],
      ["Consultants", ordre.consultants.map(({ consultant }) => consultant.fullName).join(", ")],
      ["Statut", ordre.status],
    ]);
    sheet.getRow(1).font = { bold: true, color: { argb: "FF125885" } };
    sheet.getColumn(1).font = { bold: true };
    return {
      buffer: Buffer.from(await workbook.xlsx.writeBuffer()),
      filename: `${ordre.reference}.xlsx`,
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    };
  }

  async exportPdf(id: string) {
    const ordre = await this.getExportOrdre(id);
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage();
      await page.setContent(await this.renderPrintableHtml(ordre, false), { waitUntil: "networkidle" });
      return {
        buffer: Buffer.from(await page.pdf({ format: "A4", printBackground: true, margin: { top: "18mm", right: "18mm", bottom: "18mm", left: "18mm" } })),
        filename: `${ordre.reference}.pdf`,
        type: "application/pdf",
      };
    } finally {
      await browser.close();
    }
  }

  async getPrintableHtml(id: string) {
    return this.renderPrintableHtml(await this.getExportOrdre(id), true);
  }

  private async transition(id: string, userId: string, allowedStatuses: Array<"DRAFT" | "VALIDATED" | "PRINTED">, status: "VALIDATED" | "PRINTED" | "CANCELLED", action: string) {
    const ordre = await this.prisma.$transaction(async (transaction) => {
      const current = await transaction.ordreMission.findUnique({ where: { id } });
      if (!current || current.archivedAt) throw new NotFoundException("Ordre de mission introuvable");
      if (!allowedStatuses.includes(current.status as "DRAFT" | "VALIDATED" | "PRINTED")) {
        throw new ConflictException("Cette transition n'est pas autorisée pour le statut actuel");
      }
      const updated = await transaction.ordreMission.update({
        where: { id },
        data: { status, requiresReview: false, version: { increment: 1 } },
        include: ordreMissionInclude,
      });
      await transaction.activityLog.create({ data: { userId, action, entityType: "ORDRE_MISSION", entityId: id } });
      return updated;
    });
    return { data: toOrdreMissionDetail(ordre) };
  }

  private async getExportOrdre(id: string) {
    const ordre = await this.prisma.ordreMission.findUnique({ where: { id }, include: ordreMissionExportInclude });
    if (!ordre || ordre.archivedAt) throw new NotFoundException("Ordre de mission introuvable");
    return ordre;
  }

  private async renderPrintableHtml(ordre: OrdreMissionExport, interactive: boolean) {
    const template = ordre.template ?? await this.prisma.ordreMissionTemplate.findFirst({ where: { archivedAt: null, isDefault: true } });
    const consultants = ordre.consultants.map(({ consultant }) => consultant.fullName).join(", ");
    const placeholders: Record<string, string> = {
      "{{reference}}": ordre.reference,
      "{{client.raisonSociale}}": ordre.client.companyName,
      "{{client.adresse}}": ordre.client.address,
      "{{mission.objet}}": ordre.object,
      "{{mission.type}}": getMissionTypeLabel(ordre.missionType, ordre.missionTypeOtherLabel),
      "{{mission.mode}}": ordre.missionMode,
      "{{mission.debut}}": formatDateTime(ordre.startDateTime),
      "{{mission.fin}}": formatDateTime(ordre.endDateTime),
      "{{mission.lieu}}": ordre.location ?? "",
      "{{consultants}}": consultants,
    };
    const content = replacePlaceholders(template?.contentHtml ?? defaultTemplateHtml, placeholders);
    return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${escapeHtml(ordre.reference)}</title><style>${printStyles}</style></head><body>${interactive ? '<button class="print-action" onclick="window.print()">Imprimer</button>' : ""}<main><p class="brand">ABC Consulting</p><p class="reference">${escapeHtml(ordre.reference)}</p>${content}<dl><dt>Client</dt><dd>${escapeHtml(ordre.client.companyName)}</dd><dt>Période</dt><dd>${escapeHtml(formatDateTime(ordre.startDateTime))} - ${escapeHtml(formatDateTime(ordre.endDateTime))}</dd><dt>Consultants</dt><dd>${escapeHtml(consultants || "Non assigné")}</dd></dl></main></body></html>`;
  }
}

const ordreMissionInclude = {
  client: { select: { id: true, companyName: true, color: true, status: true } },
  mission: { select: { id: true, title: true, status: true } },
  template: { select: { id: true, name: true, isDefault: true } },
  consultants: { include: { consultant: { select: { id: true, fullName: true, email: true, status: true } } } },
} satisfies Prisma.OrdreMissionInclude;

type OrdreMissionWithRelations = Prisma.OrdreMissionGetPayload<{ include: typeof ordreMissionInclude }>;
const ordreMissionExportInclude = {
  client: { select: { companyName: true, address: true } },
  template: { select: { contentHtml: true } },
  consultants: { include: { consultant: { select: { fullName: true } } } },
} satisfies Prisma.OrdreMissionInclude;
type OrdreMissionExport = Prisma.OrdreMissionGetPayload<{ include: typeof ordreMissionExportInclude }>;
type OrdreMissionUpdateFields = Omit<OrdreMissionUpdateInput, "consultantIds" | "version">;

function toOrdreMissionCreateData(input: OrdreMissionCreateInput, userId: string, reference: string): Prisma.OrdreMissionCreateInput {
  return {
    reference,
    ...(input.missionId ? { mission: { connect: { id: input.missionId } } } : {}),
    client: { connect: { id: input.clientId } },
    missionType: input.missionType,
    missionTypeOtherLabel: getMissionTypeOtherLabel(input.missionType, input.missionTypeOtherLabel),
    missionMode: input.missionMode,
    startDateTime: input.startDateTime,
    endDateTime: input.endDateTime,
    location: input.location || null,
    object: input.object,
    description: input.description || null,
    status: input.status,
    requiresReview: input.requiresReview,
    ...(input.templateId ? { template: { connect: { id: input.templateId } } } : {}),
    createdBy: { connect: { id: userId } },
    consultants: { create: input.consultantIds.map((consultantId) => ({ consultantId })) },
  };
}

function toOrdreMissionUpdateData(fields: OrdreMissionUpdateFields): Prisma.OrdreMissionUpdateInput {
  return {
    ...(fields.clientId !== undefined ? { client: { connect: { id: fields.clientId } } } : {}),
    ...(fields.missionId !== undefined ? { mission: { connect: { id: fields.missionId } } } : {}),
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
    ...(fields.object !== undefined ? { object: fields.object } : {}),
    ...(fields.description !== undefined ? { description: fields.description || null } : {}),
    ...(fields.status !== undefined ? { status: fields.status } : {}),
    ...(fields.templateId !== undefined ? { template: { connect: { id: fields.templateId } } } : {}),
    ...(fields.requiresReview !== undefined ? { requiresReview: fields.requiresReview } : {}),
  };
}

function getMissionTypeOtherLabel(missionType: OrdreMissionCreateInput["missionType"], otherLabel?: string) {
  return missionType === "AUTRE" ? otherLabel?.trim() || null : null;
}

function toOrdreMissionSummary(ordre: OrdreMissionWithRelations) {
  return {
    ...ordre,
    consultants: ordre.consultants.map(({ consultant }) => consultant),
  };
}

function toOrdreMissionDetail(ordre: OrdreMissionWithRelations) {
  return toOrdreMissionSummary(ordre);
}

async function assertClientExists(transaction: Prisma.TransactionClient, clientId: string) {
  const client = await transaction.client.findUnique({ where: { id: clientId }, select: { id: true, status: true } });
  if (!client || client.status === "ARCHIVED") throw new BadRequestException("Client introuvable ou archivé");
}

async function assertConsultantsExist(transaction: Prisma.TransactionClient, consultantIds: string[]) {
  const uniqueIds = Array.from(new Set(consultantIds));
  const count = await transaction.consultant.count({ where: { id: { in: uniqueIds }, status: { not: "ARCHIVED" } } });
  if (count !== uniqueIds.length) throw new BadRequestException("Un ou plusieurs consultants sont introuvables ou archivés");
}

async function assertMissionExists(transaction: Prisma.TransactionClient, missionId: string) {
  const mission = await transaction.mission.findUnique({ where: { id: missionId }, select: { id: true, archivedAt: true } });
  if (!mission || mission.archivedAt) throw new BadRequestException("Mission introuvable ou archivée");
}

async function assertTemplateExists(transaction: Prisma.TransactionClient, templateId: string) {
  const template = await transaction.ordreMissionTemplate.findUnique({ where: { id: templateId }, select: { id: true, archivedAt: true } });
  if (!template || template.archivedAt) throw new BadRequestException("Modèle d'ordre de mission introuvable ou archivé");
}

async function nextOrdreMissionReference(transaction: Prisma.TransactionClient, date: Date) {
  const year = date.getFullYear();
  const counter = await transaction.ordreMissionReferenceCounter.upsert({
    where: { year },
    create: { year, lastValue: 1 },
    update: { lastValue: { increment: 1 } },
  });
  return `ODM-${year}-${String(counter.lastValue).padStart(4, "0")}`;
}

function parseInput<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (result.success) return result.data;
  throw new BadRequestException({ error: { code: "validation_error", message: "La requête contient des champs invalides", details: z.flattenError(result.error).fieldErrors } });
}

function handleKnownDatabaseError(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new ConflictException("Une contrainte d'unicité empêche cette opération");
  throw error;
}

const defaultTemplateHtml = "<h2>Ordre de mission</h2><p>Objet : {{mission.objet}}</p><p>Mode : {{mission.mode}}</p><p>Lieu : {{mission.lieu}}</p>";
const printStyles = "body{margin:0;color:#0F1720;font-family:Arial,sans-serif;font-size:12px;line-height:1.6}main{max-width:760px;margin:0 auto}.brand{color:#125885;font-size:18px;font-weight:700}.reference{border-bottom:1px solid #D9E0E4;padding-bottom:12px;color:#0E476C;font-weight:700}h2{font-size:20px}dl{display:grid;grid-template-columns:120px 1fr;gap:8px 12px;margin-top:28px;border-top:1px solid #D9E0E4;padding-top:16px}dt{font-weight:700}.print-action{position:fixed;right:24px;top:24px;border:0;border-radius:4px;background:#125885;color:white;padding:10px 16px;font-weight:700}@media print{.print-action{display:none}}";

function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function toCsvCell(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}

function replacePlaceholders(html: string, placeholders: Record<string, string>) {
  return Object.entries(placeholders).reduce((document, [placeholder, value]) => document.replaceAll(placeholder, escapeHtml(value)), html);
}

function escapeHtml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}
