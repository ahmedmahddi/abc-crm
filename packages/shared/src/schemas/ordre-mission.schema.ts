import { z } from "zod";
import { MISSION_TYPES } from "../domain";

const ordreMissionChronologyRule = (value: { startDateTime?: Date | undefined; endDateTime?: Date | undefined }) =>
  !value.startDateTime || !value.endDateTime || value.endDateTime > value.startDateTime;

const ordreMissionBaseObjectSchema = z.object({
  clientId: z.string().uuid(),
  missionId: z.string().uuid().optional(),
  consultantIds: z.array(z.string().uuid()).default([]),
  missionType: z.enum(MISSION_TYPES),
  missionTypeOtherLabel: z.string().trim().max(120).optional().or(z.literal("")),
  missionMode: z.enum(["ONLINE", "PRESENTIELLE"]),
  startDateTime: z.coerce.date(),
  endDateTime: z.coerce.date(),
  location: z.string().optional().or(z.literal("")),
  object: z.string().min(2),
  description: z.string().optional().or(z.literal("")),
  status: z.enum(["DRAFT", "VALIDATED", "PRINTED", "CANCELLED", "ARCHIVED"]).default("DRAFT"),
  templateId: z.string().uuid().optional(),
  requiresReview: z.coerce.boolean().default(false),
});

export const ordreMissionCreateSchema = ordreMissionBaseObjectSchema
  .superRefine(validateOtherMissionType)
  .refine(ordreMissionChronologyRule, {
    message: "La date de fin doit etre posterieure a la date de debut",
    path: ["endDateTime"],
  });

export const ordreMissionUpdateSchema = ordreMissionBaseObjectSchema
  .partial()
  .extend({
    version: z.coerce.number().int().positive(),
  })
  .superRefine(validateOtherMissionType)
  .refine(ordreMissionChronologyRule, {
    message: "La date de fin doit etre posterieure a la date de debut",
    path: ["endDateTime"],
  });

export const ordreMissionListQuerySchema = z.object({
  q: z.string().trim().optional(),
  page: z.coerce.number().int().positive().default(1),
  perPage: z.coerce.number().int().positive().max(100).default(20),
  status: z.enum(["DRAFT", "VALIDATED", "PRINTED", "CANCELLED", "ARCHIVED", "ALL"]).default("ALL"),
  clientId: z.string().uuid().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export type OrdreMissionCreateInput = z.infer<typeof ordreMissionCreateSchema>;
export type OrdreMissionUpdateInput = z.infer<typeof ordreMissionUpdateSchema>;
export type OrdreMissionListQuery = z.infer<typeof ordreMissionListQuerySchema>;

function validateOtherMissionType(
  value: { missionType?: string | undefined; missionTypeOtherLabel?: string | undefined },
  context: z.RefinementCtx,
) {
  if (value.missionType === "AUTRE" && !value.missionTypeOtherLabel?.trim()) {
    context.addIssue({
      code: "custom",
      message: "Precisez le type de mission",
      path: ["missionTypeOtherLabel"],
    });
  }
}
