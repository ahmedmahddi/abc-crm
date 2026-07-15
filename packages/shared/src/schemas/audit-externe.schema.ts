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
