import { z } from "zod";
import { consultantColorPalette } from "../brand";

const consultantColorSchema = z.enum(consultantColorPalette);

export const consultantCreateSchema = z.object({
  fullName: z.string().min(2),
  phone: z.string().min(4).optional().or(z.literal("")),
  email: z.string().email(),
  color: consultantColorSchema.optional(),
  status: z.enum(["ACTIVE", "INACTIVE", "ARCHIVED"]).default("ACTIVE"),
});

export const consultantUpdateSchema = consultantCreateSchema.partial().extend({
  version: z.coerce.number().int().positive(),
});

export const consultantListQuerySchema = z.object({
  q: z.string().trim().optional(),
  page: z.coerce.number().int().positive().default(1),
  perPage: z.coerce.number().int().positive().max(100).default(20),
  status: z.enum(["ACTIVE", "INACTIVE", "ARCHIVED", "ALL"]).default("ACTIVE"),
});

export type ConsultantCreateInput = z.infer<typeof consultantCreateSchema>;
export type ConsultantUpdateInput = z.infer<typeof consultantUpdateSchema>;
