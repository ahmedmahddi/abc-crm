"use client";

import type { SyncMutationInput } from "@abc/shared";
import { offlineDatabase, type QueuedMutation } from "@/lib/offline/db";

type QueueInput = Omit<SyncMutationInput, "clientMutationId" | "payload"> & {
  payload: unknown;
};

export type QueuedOfflineResult = {
  clientMutationId: string;
  queuedOffline: true;
};

export function shouldQueueOffline() {
  return typeof navigator !== "undefined" && !navigator.onLine;
}

export function isQueuedOfflineResult(value: unknown): value is QueuedOfflineResult {
  return Boolean(value && typeof value === "object" && "queuedOffline" in value);
}

export async function enqueueOfflineMutation(input: QueueInput): Promise<QueuedOfflineResult> {
  const queued: QueuedMutation = {
    clientMutationId: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    entityType: input.entityType,
    operation: input.operation,
    payload: sanitizePayload(input.payload),
    retryCount: 0,
    ...(input.entityId ? { entityId: input.entityId } : {}),
    ...(input.baseVersion ? { baseVersion: input.baseVersion } : {}),
  };

  await offlineDatabase.outbox.put(queued);
  return { clientMutationId: queued.clientMutationId, queuedOffline: true };
}

function sanitizePayload(payload: unknown): Record<string, unknown> {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return {};
  return JSON.parse(JSON.stringify(payload)) as Record<string, unknown>;
}
