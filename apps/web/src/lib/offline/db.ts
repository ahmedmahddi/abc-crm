"use client";

import Dexie, { type EntityTable } from "dexie";
import type { ClientDocumentType, SyncMutationInput, SyncMutationResult } from "@abc/shared";

export interface CachedEntity {
  key: string;
  entityType: SyncMutationInput["entityType"];
  entityId: string;
  version: number;
  payload: Record<string, unknown>;
  updatedAt: string;
}

export interface QueuedMutation extends SyncMutationInput {
  createdAt: string;
  lastError?: string;
  retryCount: number;
}

export interface StoredConflict {
  id: string;
  result: Extract<SyncMutationResult, { status: "CONFLICT" }>;
  createdAt: string;
}

export interface StagedUpload {
  id: string;
  clientId?: string;
  clientMutationId?: string;
  createdAt: string;
  documentType: ClientDocumentType;
  encryptedBlob: Blob;
  fileName: string;
  iv: string;
  lastError?: string;
  mimeType: string;
  retryCount: number;
  size: number;
}

export class AbcOfflineDatabase extends Dexie {
  entities!: EntityTable<CachedEntity, "key">;
  outbox!: EntityTable<QueuedMutation, "clientMutationId">;
  conflicts!: EntityTable<StoredConflict, "id">;
  uploads!: EntityTable<StagedUpload, "id">;

  constructor() {
    super("abc-crm");
    this.version(1).stores({
      entities: "key, entityType, entityId, updatedAt",
      outbox: "clientMutationId, entityType, entityId, createdAt",
      conflicts: "id, createdAt",
    });
    this.version(2).stores({
      entities: "key, entityType, entityId, updatedAt",
      outbox: "clientMutationId, entityType, entityId, createdAt",
      conflicts: "id, createdAt",
      uploads: "id, clientId, clientMutationId, createdAt",
    });
  }
}

export const offlineDatabase = new AbcOfflineDatabase();
