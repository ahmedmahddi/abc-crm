import { z } from "zod";

export const TEMPLATE_PLACEHOLDERS = [
  "{{reference}}",
  "{{client.raisonSociale}}",
  "{{client.adresse}}",
  "{{mission.objet}}",
  "{{mission.type}}",
  "{{mission.mode}}",
  "{{mission.debut}}",
  "{{mission.fin}}",
  "{{mission.lieu}}",
  "{{consultants}}",
] as const;

export const templateCreateSchema = z.object({
  name: z.string().trim().min(2).max(120),
  contentHtml: z.string().trim().min(1).max(100_000),
  isDefault: z.boolean().default(false),
});

export const templateUpdateSchema = templateCreateSchema.partial().extend({
  version: z.coerce.number().int().positive(),
});

export const templateListQuerySchema = z.object({
  q: z.string().trim().optional(),
  page: z.coerce.number().int().positive().default(1),
  perPage: z.coerce.number().int().positive().max(100).default(20),
  status: z.enum(["ACTIVE", "ARCHIVED", "ALL"]).default("ACTIVE"),
});

export type TemplateCreateInput = z.infer<typeof templateCreateSchema>;
export type TemplateUpdateInput = z.infer<typeof templateUpdateSchema>;
