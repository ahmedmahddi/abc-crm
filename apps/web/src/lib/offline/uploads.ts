"use client";

import type { ClientDocumentType } from "@abc/shared";
import { apiUpload } from "@/lib/api";
import { offlineDatabase, type StagedUpload } from "@/lib/offline/db";

const KEY_STORAGE_NAME = "abc-crm-offline-upload-key";

export async function stageClientDocumentUpload(input: {
  clientId?: string;
  clientMutationId?: string;
  file: File;
  type: ClientDocumentType;
}) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await getUploadKey();
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, await input.file.arrayBuffer());
  const staged: StagedUpload = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    documentType: input.type,
    encryptedBlob: new Blob([encrypted], { type: "application/octet-stream" }),
    fileName: input.file.name,
    iv: encodeBase64(iv),
    mimeType: input.file.type,
    retryCount: 0,
    size: input.file.size,
    ...(input.clientId ? { clientId: input.clientId } : {}),
    ...(input.clientMutationId ? { clientMutationId: input.clientMutationId } : {}),
  };
  await offlineDatabase.uploads.put(staged);
  return staged;
}

export async function stageClientDocumentUploads(input: {
  clientMutationId: string;
  drafts: Partial<Record<ClientDocumentType, File>>;
}) {
  return Promise.all(
    Object.entries(input.drafts).map(([type, file]) =>
      stageClientDocumentUpload({
        clientMutationId: input.clientMutationId,
        file,
        type: type as ClientDocumentType,
      }),
    ),
  );
}

export async function uploadStagedClientDocument(upload: StagedUpload, clientId: string) {
  const file = await decryptStagedUpload(upload);
  const body = new FormData();
  body.append("file", file);
  body.append("type", upload.documentType);
  await apiUpload(`/clients/${clientId}/documents`, body);
  await offlineDatabase.uploads.delete(upload.id);
}

export async function markStagedUploadError(upload: StagedUpload, lastError: string) {
  const current = await offlineDatabase.uploads.get(upload.id);
  if (!current) return;
  await offlineDatabase.uploads.put({ ...current, lastError, retryCount: current.retryCount + 1 });
}

async function decryptStagedUpload(upload: StagedUpload) {
  const key = await getUploadKey();
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: decodeBase64(upload.iv) },
    key,
    await upload.encryptedBlob.arrayBuffer(),
  );
  return new File([decrypted], upload.fileName, { type: upload.mimeType });
}

async function getUploadKey() {
  const existing = localStorage.getItem(KEY_STORAGE_NAME);
  if (existing) {
    return crypto.subtle.importKey("jwk", JSON.parse(existing) as JsonWebKey, { name: "AES-GCM" }, true, ["encrypt", "decrypt"]);
  }

  const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
  localStorage.setItem(KEY_STORAGE_NAME, JSON.stringify(await crypto.subtle.exportKey("jwk", key)));
  return key;
}

function encodeBase64(value: Uint8Array) {
  return btoa(String.fromCharCode(...value));
}

function decodeBase64(value: string) {
  return Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
}
