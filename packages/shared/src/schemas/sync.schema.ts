import { z } from "zod";

export const SYNC_ENTITY_TYPES = [
  "CLIENT",
  "CONSULTANT",
  "MISSION",
  "ORDRE_MISSION",
  "TEMPLATE",
  "USER",
] as const;

export const syncMutationSchema = z.object({
  clientMutationId: z.string().uuid(),
  entityType: z.enum(SYNC_ENTITY_TYPES),
  entityId: z.string().uuid().optional(),
  operation: z.enum(["CREATE", "UPDATE", "ARCHIVE", "RESTORE", "DISABLE"]),
  baseVersion: z.number().int().positive().optional(),
  payload: z.record(z.string(), z.unknown()),
});

export const syncBatchSchema = z.object({
  mutations: z.array(syncMutationSchema).min(1).max(100),
});

export type SyncMutationInput = z.infer<typeof syncMutationSchema>;
export type SyncBatchInput = z.infer<typeof syncBatchSchema>;

export type SyncMutationResult =
  | { clientMutationId: string; status: "APPLIED"; data: Record<string, unknown> }
  | { clientMutationId: string; status: "REJECTED"; error: string }
  | {
      clientMutationId: string;
      status: "CONFLICT";
      conflictId: string;
      serverVersion: number;
      serverPayload: Record<string, unknown>;
    };
