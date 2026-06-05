import { z } from "zod";

const missionChronologyRule = (value: { startDateTime?: Date | undefined; endDateTime?: Date | undefined }) =>
  !value.startDateTime || !value.endDateTime || value.endDateTime > value.startDateTime;

const missionBaseObjectSchema = z.object({
  clientId: z.string().uuid(),
  consultantIds: z.array(z.string().uuid()).min(1),
  title: z.string().min(2),
  missionType: z.enum(["AUDIT", "FORMATION", "ASSISTANCE"]),
  missionMode: z.enum(["ONLINE", "PRESENTIELLE"]),
  startDateTime: z.coerce.date(),
  endDateTime: z.coerce.date(),
  location: z.string().optional().or(z.literal("")),
  description: z.string().optional().or(z.literal("")),
  status: z.enum(["PLANNED", "DONE", "CANCELLED"]).default("PLANNED"),
});

export const missionCreateSchema = missionBaseObjectSchema.refine(missionChronologyRule, {
  message: "La date de fin doit être postérieure à la date de début",
  path: ["endDateTime"],
});

export const missionUpdateSchema = missionBaseObjectSchema.partial().extend({
  version: z.coerce.number().int().positive(),
}).refine(missionChronologyRule, {
  message: "La date de fin doit être postérieure à la date de début",
  path: ["endDateTime"],
});

export const missionListQuerySchema = z.object({
  q: z.string().trim().optional(),
  page: z.coerce.number().int().positive().default(1),
  perPage: z.coerce.number().int().positive().max(100).default(20),
  status: z.enum(["PLANNED", "DONE", "CANCELLED", "ALL"]).default("PLANNED"),
  clientId: z.string().uuid().optional(),
  consultantId: z.string().uuid().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export const missionCalendarQuerySchema = z.object({
  from: z.coerce.date(),
  to: z.coerce.date(),
});

export type MissionCreateInput = z.infer<typeof missionCreateSchema>;
export type MissionUpdateInput = z.infer<typeof missionUpdateSchema>;
export type MissionListQuery = z.infer<typeof missionListQuerySchema>;
