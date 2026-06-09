import { ConflictException, Injectable } from "@nestjs/common";
import { Prisma } from "@abc/db";
import type { SyncBatchInput, SyncMutationInput, SyncMutationResult } from "@abc/shared";
import { ClientsService } from "../clients/clients.service";
import { ConsultantsService } from "../consultants/consultants.service";
import { MissionsService } from "../missions/missions.service";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class SyncService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clients: ClientsService,
    private readonly consultants: ConsultantsService,
    private readonly missions: MissionsService,
  ) {}

  async processBatch(batch: SyncBatchInput, userId: string): Promise<{ data: SyncMutationResult[] }> {
    const data: SyncMutationResult[] = [];
    for (const mutation of batch.mutations) {
      data.push(await this.processMutation(mutation, userId));
    }
    return { data };
  }

  private async processMutation(mutation: SyncMutationInput, userId: string): Promise<SyncMutationResult> {
    const existing = await this.prisma.syncMutation.findUnique({
      where: { clientMutationId: mutation.clientMutationId },
    });
    if (existing?.result && isSyncMutationResult(existing.result)) return existing.result;

    try {
      const data = await this.applyMutation(mutation, userId);
      const result: SyncMutationResult = { clientMutationId: mutation.clientMutationId, status: "APPLIED", data };
      await this.recordMutation(mutation, userId, result);
      return result;
    } catch (error) {
      if (error instanceof ConflictException && mutation.entityId && mutation.baseVersion) {
        const serverPayload = await this.getServerPayload(mutation.entityType, mutation.entityId);
        const serverVersion = readVersion(serverPayload);
        const conflict = await this.prisma.syncConflict.upsert({
          where: { clientMutationId: mutation.clientMutationId },
          create: {
            clientMutationId: mutation.clientMutationId,
            userId,
            entityType: mutation.entityType,
            entityId: mutation.entityId,
            baseVersion: mutation.baseVersion,
            serverVersion,
            localPayload: mutation.payload as unknown as Prisma.InputJsonValue,
            serverPayload: serverPayload as unknown as Prisma.InputJsonValue,
          },
          update: {
            localPayload: mutation.payload as unknown as Prisma.InputJsonValue,
            serverPayload: serverPayload as unknown as Prisma.InputJsonValue,
            serverVersion,
            resolvedAt: null,
            resolvedById: null,
          },
        });
        const result: SyncMutationResult = {
          clientMutationId: mutation.clientMutationId,
          status: "CONFLICT",
          conflictId: conflict.id,
          serverVersion,
          serverPayload,
        };
        await this.recordMutation(mutation, userId, result);
        return result;
      }

      const result: SyncMutationResult = {
        clientMutationId: mutation.clientMutationId,
        status: "REJECTED",
        error: error instanceof Error ? error.message : "Synchronisation impossible",
      };
      await this.recordMutation(mutation, userId, result);
      return result;
    }
  }

  private async applyMutation(mutation: SyncMutationInput, userId: string): Promise<Record<string, unknown>> {
    if (mutation.entityType === "ORDRE_MISSION" || mutation.entityType === "TEMPLATE") {
      throw new Error("Ce module est desactive temporairement.");
    }
    if (mutation.entityType === "USER") {
      throw new Error("La gestion des comptes reste disponible uniquement en ligne.");
    }
    if (mutation.entityType === "CLIENT") {
      return unwrap(
        mutation.operation === "CREATE"
          ? await this.clients.create(mutation.payload, userId)
          : mutation.operation === "UPDATE" && mutation.entityId
            ? await this.clients.update(mutation.entityId, mutation.payload, userId)
            : mutation.operation === "ARCHIVE" && mutation.entityId
              ? await this.clients.archive(mutation.entityId, userId)
              : mutation.operation === "RESTORE" && mutation.entityId
                ? await this.clients.restore(mutation.entityId, userId)
                : rejectUnsupported(),
      );
    }
    if (mutation.entityType === "CONSULTANT") {
      return unwrap(
        mutation.operation === "CREATE"
          ? await this.consultants.create(mutation.payload, userId)
          : mutation.operation === "UPDATE" && mutation.entityId
            ? await this.consultants.update(mutation.entityId, mutation.payload, userId)
            : mutation.operation === "ARCHIVE" && mutation.entityId
              ? await this.consultants.archive(mutation.entityId, userId)
              : mutation.operation === "RESTORE" && mutation.entityId
                ? await this.consultants.restore(mutation.entityId, userId)
                : rejectUnsupported(),
      );
    }
    if (mutation.entityType === "MISSION") {
      return unwrap(
        mutation.operation === "CREATE"
          ? await this.missions.create(mutation.payload, userId)
          : mutation.operation === "UPDATE" && mutation.entityId
            ? await this.missions.update(mutation.entityId, mutation.payload, userId)
            : mutation.operation === "ARCHIVE" && mutation.entityId
              ? hasCancellationPayload(mutation.payload)
                ? await this.missions.cancel(mutation.entityId, mutation.payload, userId)
                : await this.missions.archive(mutation.entityId, userId)
              : rejectUnsupported(),
      );
    }
    throw new Error("Type d'entite non supporte.");
  }

  private async getServerPayload(entityType: SyncMutationInput["entityType"], entityId: string) {
    if (entityType === "CLIENT") return unwrap(await this.clients.findOne(entityId));
    if (entityType === "CONSULTANT") return unwrap(await this.consultants.findOne(entityId));
    if (entityType === "MISSION") return unwrap(await this.missions.findOne(entityId));
    return {};
  }

  private async recordMutation(mutation: SyncMutationInput, userId: string, result: SyncMutationResult) {
    await this.prisma.syncMutation.upsert({
      where: { clientMutationId: mutation.clientMutationId },
      create: {
        clientMutationId: mutation.clientMutationId,
        userId,
        entityType: mutation.entityType,
        entityId: mutation.entityId ?? null,
        operation: mutation.operation,
        baseVersion: mutation.baseVersion ?? null,
        status: result.status,
        result: result as unknown as Prisma.InputJsonValue,
        appliedAt: result.status === "APPLIED" ? new Date() : null,
      },
      update: {
        status: result.status,
        result: result as unknown as Prisma.InputJsonValue,
        appliedAt: result.status === "APPLIED" ? new Date() : null,
      },
    });
  }
}

function unwrap(value: { data: unknown } | undefined): Record<string, unknown> {
  if (!value || typeof value.data !== "object" || value.data === null) return {};
  return value.data as Record<string, unknown>;
}

function rejectUnsupported(): never {
  throw new Error("Operation de synchronisation non supportee pour cette entite.");
}

function hasCancellationPayload(payload: unknown) {
  return (
    payload !== null &&
    typeof payload === "object" &&
    !Array.isArray(payload) &&
    "cancellationType" in payload
  );
}

function readVersion(payload: Record<string, unknown>) {
  return typeof payload.version === "number" ? payload.version : 1;
}

function isSyncMutationResult(value: unknown): value is SyncMutationResult {
  return Boolean(
    value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      "clientMutationId" in value &&
      "status" in value,
  );
}
