import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@abc/db";
import { templateCreateSchema, templateListQuerySchema, templateUpdateSchema, type TemplateCreateInput } from "@abc/shared";
import sanitizeHtml from "sanitize-html";
import { z } from "zod";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class TemplatesService {
  constructor(private readonly prisma: PrismaService) {}

  async findMany(query: unknown) {
    const { page, perPage, q, status } = parseInput(templateListQuerySchema, query);
    const where: Prisma.OrdreMissionTemplateWhereInput = {
      ...(status === "ALL" ? {} : status === "ARCHIVED" ? { archivedAt: { not: null } } : { archivedAt: null }),
      ...(q ? { name: { contains: q, mode: "insensitive" } } : {}),
    };
    const [templates, total] = await this.prisma.$transaction([
      this.prisma.ordreMissionTemplate.findMany({ where, orderBy: [{ isDefault: "desc" }, { name: "asc" }], skip: (page - 1) * perPage, take: perPage }),
      this.prisma.ordreMissionTemplate.count({ where }),
    ]);
    return { data: templates, meta: { page, perPage, total, totalPages: Math.ceil(total / perPage) } };
  }

  async findOne(id: string) {
    const template = await this.prisma.ordreMissionTemplate.findUnique({ where: { id } });
    if (!template) throw new NotFoundException("Modèle introuvable");
    return { data: template };
  }

  async create(body: unknown, userId: string) {
    const input = parseInput(templateCreateSchema, body);
    const template = await this.prisma.$transaction(async (transaction) => {
      if (input.isDefault) await transaction.ordreMissionTemplate.updateMany({ where: { isDefault: true }, data: { isDefault: false } });
      const created = await transaction.ordreMissionTemplate.create({ data: toCreateData(input) });
      await transaction.activityLog.create({ data: { userId, action: "ORDRE_TEMPLATE_CREATED", entityType: "ORDRE_MISSION_TEMPLATE", entityId: created.id, description: `Modèle créé: ${created.name}` } });
      return created;
    });
    return { data: template };
  }

  async update(id: string, body: unknown, userId: string) {
    const input = parseInput(templateUpdateSchema, body);
    const template = await this.prisma.$transaction(async (transaction) => {
      const current = await transaction.ordreMissionTemplate.findUnique({ where: { id } });
      if (!current) throw new NotFoundException("Modèle introuvable");
      if (current.version !== input.version) throw new ConflictException("Le modèle a été modifié depuis votre dernière consultation");
      if (input.isDefault) await transaction.ordreMissionTemplate.updateMany({ where: { isDefault: true, id: { not: id } }, data: { isDefault: false } });
      const { version, ...fields } = input;
      void version;
      const updated = await transaction.ordreMissionTemplate.update({ where: { id }, data: { ...(fields.name !== undefined ? { name: fields.name } : {}), ...(fields.contentHtml !== undefined ? { contentHtml: cleanHtml(fields.contentHtml) } : {}), ...(fields.isDefault !== undefined ? { isDefault: fields.isDefault } : {}), version: { increment: 1 } } });
      await transaction.activityLog.create({ data: { userId, action: "ORDRE_TEMPLATE_UPDATED", entityType: "ORDRE_MISSION_TEMPLATE", entityId: id } });
      return updated;
    });
    return { data: template };
  }

  async archive(id: string, userId: string) {
    const template = await this.prisma.$transaction(async (transaction) => {
      const current = await transaction.ordreMissionTemplate.findUnique({ where: { id } });
      if (!current) throw new NotFoundException("Modèle introuvable");
      if (current.isDefault) throw new BadRequestException("Définissez un autre modèle par défaut avant d’archiver celui-ci");
      if (current.archivedAt) return current;
      const updated = await transaction.ordreMissionTemplate.update({ where: { id }, data: { archivedAt: new Date(), status: "ARCHIVED", version: { increment: 1 } } });
      await transaction.activityLog.create({ data: { userId, action: "ORDRE_TEMPLATE_ARCHIVED", entityType: "ORDRE_MISSION_TEMPLATE", entityId: id } });
      return updated;
    });
    return { data: template };
  }

  async restore(id: string, userId: string) {
    const template = await this.prisma.$transaction(async (transaction) => {
      const current = await transaction.ordreMissionTemplate.findUnique({ where: { id } });
      if (!current) throw new NotFoundException("ModÃ¨le introuvable");
      if (!current.archivedAt) return current;
      const updated = await transaction.ordreMissionTemplate.update({
        where: { id },
        data: { archivedAt: null, status: "ACTIVE", version: { increment: 1 } },
      });
      await transaction.activityLog.create({ data: { userId, action: "ORDRE_TEMPLATE_RESTORED", entityType: "ORDRE_MISSION_TEMPLATE", entityId: id } });
      return updated;
    });
    return { data: template };
  }
}

function toCreateData(input: TemplateCreateInput) {
  return { name: input.name, contentHtml: cleanHtml(input.contentHtml), isDefault: input.isDefault };
}

function cleanHtml(html: string) {
  return sanitizeHtml(html, {
    allowedTags: ["p", "br", "strong", "em", "u", "s", "ul", "ol", "li", "h2", "h3", "blockquote"],
    allowedAttributes: {},
  });
}

function parseInput<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (result.success) return result.data;
  throw new BadRequestException({ error: { code: "validation_error", message: "La requête contient des champs invalides", details: z.flattenError(result.error).fieldErrors } });
}
