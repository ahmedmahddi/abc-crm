import { z } from "zod";
import { MISSION_TYPE_OPTIONS } from "../domain";

const missionChronologyRule = (value: { startDateTime?: Date | undefined; endDateTime?: Date | undefined }) =>
  !value.startDateTime || !value.endDateTime || value.endDateTime > value.startDateTime;

export const missionConsultantAssignmentSchema = z.object({
  consultantId: z.string().uuid(),
  role: z.enum(["RESPONSABLE", "PARTICIPANT"]),
});

const missionBaseObjectSchema = z.object({
  clientId: z.string().uuid(),
  consultantIds: z.array(z.string().uuid()).optional(),
  consultantAssignments: z.array(missionConsultantAssignmentSchema).optional(),
  title: z.string().min(2),
  missionType: z.enum(MISSION_TYPE_OPTIONS),
  missionTypeOtherLabel: z.string().trim().max(120).optional().or(z.literal("")),
  missionMode: z.enum(["ONLINE", "PRESENTIELLE"]),
  startDateTime: z.coerce.date(),
  endDateTime: z.coerce.date(),
  location: z.string().optional().or(z.literal("")),
  description: z.string().optional().or(z.literal("")),
  status: z.enum(["PLANNED", "DONE", "CANCELLED"]).default("PLANNED"),
});

export const missionCreateSchema = missionBaseObjectSchema
  .superRefine(validateOtherMissionType)
  .superRefine(validateMissionAssignments)
  .refine(missionChronologyRule, {
    message: "La date de fin doit etre posterieure a la date de debut",
    path: ["endDateTime"],
  });

export const missionUpdateSchema = missionBaseObjectSchema
  .partial()
  .extend({
    version: z.coerce.number().int().positive(),
  })
  .superRefine((value, context) => {
    validateOtherMissionType(value, context);
    if (value.consultantAssignments !== undefined || value.consultantIds !== undefined) {
      validateMissionAssignments(value, context);
    }
  })
  .refine(missionChronologyRule, {
    message: "La date de fin doit etre posterieure a la date de debut",
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

export const missionCancelSchema = z.object({
  cancellationType: z.enum(["CLIENT", "INTERNAL"]),
  cancellationReason: z.string().trim().max(500).optional().or(z.literal("")),
  version: z.coerce.number().int().positive(),
});

export type MissionCreateInput = z.infer<typeof missionCreateSchema>;
export type MissionUpdateInput = z.infer<typeof missionUpdateSchema>;
export type MissionListQuery = z.infer<typeof missionListQuerySchema>;
export type MissionCancelInput = z.infer<typeof missionCancelSchema>;

function validateMissionAssignments(
  value: {
    consultantAssignments?: Array<z.infer<typeof missionConsultantAssignmentSchema>> | undefined;
    consultantIds?: string[] | undefined;
  },
  context: z.RefinementCtx,
) {
  const assignments = normalizeConsultantAssignments(value);
  if (assignments.length === 0) {
    context.addIssue({
      code: "custom",
      message: "Selectionnez au moins un consultant",
      path: ["consultantAssignments"],
    });
  }
  if (assignments.length > 0 && !assignments.some((assignment) => assignment.role === "RESPONSABLE")) {
    context.addIssue({
      code: "custom",
      message: "Selectionnez au moins un responsable de mission",
      path: ["consultantAssignments"],
    });
  }
}

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

function normalizeConsultantAssignments(value: {
  consultantAssignments?: Array<z.infer<typeof missionConsultantAssignmentSchema>> | undefined;
  consultantIds?: string[] | undefined;
}) {
  if (value.consultantAssignments?.length) return value.consultantAssignments;
  return (value.consultantIds ?? []).map((consultantId, index) => ({
    consultantId,
    role: index === 0 ? ("RESPONSABLE" as const) : ("PARTICIPANT" as const),
  }));
}
