import { z } from "zod";

const optionalText = z.string().trim().optional().or(z.literal(""));
const optionalEmail = z.preprocess(blankToUndefined, z.string().trim().email().optional());
const optionalPhone = z.preprocess(blankToUndefined, z.string().trim().min(4).optional());

export const clientContactSchema = z.object({
  fullName: optionalText,
  position: optionalText,
  phone: optionalPhone,
  email: optionalEmail,
  type: z.enum(["CADRE", "NON_CADRE"]).default("CADRE"),
});

export const clientCreateSchema = z.object({
  companyName: optionalText,
  fiscalNumber: optionalText,
  address: optionalText,
  zone: optionalText,
  activitySector: optionalText,
  applicationDomain: optionalText,
  reference: optionalText,
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default("#125885"),
  cadreCount: z.coerce.number().int().min(0).default(0),
  nonCadreCount: z.coerce.number().int().min(0).default(0),
  responsibleConsultantIds: z.array(z.string().uuid()).default([]),
  contacts: z.array(clientContactSchema).default([]),
});

export const clientUpdateSchema = clientCreateSchema.partial().extend({
  version: z.coerce.number().int().positive(),
});

export const clientListQuerySchema = z.object({
  q: z.string().trim().optional(),
  page: z.coerce.number().int().positive().default(1),
  perPage: z.coerce.number().int().positive().max(100).default(20),
  sortBy: z.enum(["companyName", "fiscalNumber", "activitySector", "status", "createdAt"]).default("companyName"),
  sortDir: z.enum(["asc", "desc"]).default("asc"),
  status: z.enum(["ACTIVE", "ARCHIVED", "ALL"]).default("ACTIVE"),
});

export type ClientCreateInput = z.infer<typeof clientCreateSchema>;
export type ClientUpdateInput = z.infer<typeof clientUpdateSchema>;
export type ClientListQuery = z.infer<typeof clientListQuerySchema>;

export type ClientImportRowStatus = "CREATED" | "SKIPPED" | "FAILED";

export type ClientImportResult = {
  created: number;
  skipped: number;
  failed: number;
  rows: Array<{
    rowNumber: number;
    companyName: string;
    status: ClientImportRowStatus;
    reason?: string;
  }>;
};

function blankToUndefined(value: unknown) {
  return typeof value === "string" && value.trim().length === 0 ? undefined : value;
}
