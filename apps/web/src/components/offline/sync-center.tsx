"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { SyncMutationResult } from "@abc/shared";
import { AlertTriangle, CheckCircle2, RefreshCw, RotateCcw, Trash2, WifiOff } from "lucide-react";
import { PageHeader, PagePanel, PageStack, SectionHeader } from "@/components/layout/page-section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiFetch, ApiError } from "@/lib/api";
import { offlineDatabase, type QueuedMutation, type StagedUpload, type StoredConflict } from "@/lib/offline/db";
import { markStagedUploadError, uploadStagedClientDocument } from "@/lib/offline/uploads";

type SyncBatchResponse = { data: SyncMutationResult[] };

export function SyncCenter() {
  const [outbox, setOutbox] = useState<QueuedMutation[]>([]);
  const [uploads, setUploads] = useState<StagedUpload[]>([]);
  const [conflicts, setConflicts] = useState<StoredConflict[]>([]);
  const [online, setOnline] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [queued, stagedUploads, storedConflicts] = await Promise.all([
      offlineDatabase.outbox.orderBy("createdAt").toArray(),
      offlineDatabase.uploads.orderBy("createdAt").toArray(),
      offlineDatabase.conflicts.orderBy("createdAt").toArray(),
    ]);
    setOutbox(queued);
    setUploads(stagedUploads);
    setConflicts(storedConflicts);
  }, []);

  useEffect(() => {
    void load();
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, [load]);

  const stats = useMemo(
    () => ({
      conflicts: conflicts.length,
      failed: outbox.filter((item) => item.lastError).length,
      uploads: uploads.length,
      queued: outbox.length,
    }),
    [conflicts.length, outbox, uploads.length],
  );

  const syncMutations = async (items: QueuedMutation[]) => {
    if (!items.length && uploads.length === 0) return;
    if (!navigator.onLine) {
      setMessage("Connexion indisponible. Reessayez apres la reconnexion.");
      return;
    }
    setIsSyncing(true);
    setMessage(null);
    try {
      const results = items.length
        ? (await apiFetch<SyncBatchResponse>("/sync/batch", {
            method: "POST",
            body: JSON.stringify({ mutations: items }),
          })).data
        : [];
      await applySyncResults(results);
      const failedUploads = await syncStagedUploads(results);
      setMessage(failedUploads > 0 ? `${failedUploads} document(s) restent en attente.` : "Synchronisation terminee.");
    } catch (error) {
      const lastError = error instanceof ApiError ? error.message : "Synchronisation impossible.";
      await Promise.all(items.map((item) => markOutboxError(item, lastError)));
      setMessage(lastError);
    } finally {
      setIsSyncing(false);
      await load();
    }
  };

  const retryStagedUpload = async (upload: StagedUpload) => {
    if (!upload.clientId) return;
    setIsSyncing(true);
    try {
      await uploadStagedClientDocument(upload, upload.clientId);
      setMessage("Document synchronise.");
    } catch (error) {
      await markStagedUploadError(upload, error instanceof Error ? error.message : "Transfert impossible.");
      setMessage("Le document reste en attente.");
    } finally {
      setIsSyncing(false);
      await load();
    }
  };

  return (
    <PageStack>
      <PageHeader
        actions={
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => void load()} type="button" variant="outline">
              <RefreshCw data-icon="inline-start" />
              Actualiser
            </Button>
            <Button disabled={isSyncing || !online || (outbox.length === 0 && uploads.length === 0)} onClick={() => void syncMutations(outbox)} type="button">
              <RotateCcw data-icon="inline-start" />
              {isSyncing ? "Synchronisation..." : "Synchroniser"}
            </Button>
          </div>
        }
        eyebrow="Hors ligne"
        title="Synchronisation"
        description="Controlez les ecritures hors ligne, les reprises et les conflits avant qu'ils impactent le CRM."
      />
      {!online ? (
        <p className="flex gap-2 rounded-lg border border-warning/40 bg-white px-4 py-3 text-sm shadow-soft" role="status">
          <WifiOff className="size-4 text-warning" aria-hidden="true" />
          Connexion indisponible. Les reprises reprendront a la reconnexion.
        </p>
      ) : null}
      {message ? <p className="rounded-md border bg-white px-3 py-2 text-sm text-muted-foreground" role="status">{message}</p> : null}
      <div className="grid gap-3 sm:grid-cols-4">
        <SyncStat label="En attente" value={stats.queued} />
        <SyncStat label="Documents" value={stats.uploads} tone={stats.uploads ? "warning" : "neutral"} />
        <SyncStat label="Echecs" value={stats.failed} tone={stats.failed ? "warning" : "neutral"} />
        <SyncStat label="Conflits" value={stats.conflicts} tone={stats.conflicts ? "danger" : "neutral"} />
      </div>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <OutboxPanel
          isSyncing={isSyncing}
          items={outbox}
          uploads={uploads}
          onDiscard={async (item) => {
            await offlineDatabase.outbox.delete(item.clientMutationId);
            await load();
          }}
          onDiscardUpload={async (upload) => {
            await offlineDatabase.uploads.delete(upload.id);
            await load();
          }}
          onRetryUpload={(upload) => {
            if (!upload.clientId) {
              setMessage("Ce document attend encore la creation du client.");
              return;
            }
            void retryStagedUpload(upload);
          }}
          onRetry={(item) => void syncMutations([item])}
        />
        <ConflictPanel
          conflicts={conflicts}
          outbox={outbox}
          onKeepLocal={async (conflict) => {
            const queued = await offlineDatabase.outbox.get(conflict.result.clientMutationId);
            if (queued) {
              const { lastError, ...queuedWithoutError } = queued;
              void lastError;
              await offlineDatabase.outbox.put({
                ...queuedWithoutError,
                baseVersion: conflict.result.serverVersion,
                retryCount: queued.retryCount + 1,
              });
            }
            await offlineDatabase.conflicts.delete(conflict.id);
            await load();
          }}
          onKeepServer={async (conflict) => {
            await Promise.all([
              offlineDatabase.conflicts.delete(conflict.id),
              offlineDatabase.outbox.delete(conflict.result.clientMutationId),
            ]);
            await load();
          }}
        />
      </div>
    </PageStack>
  );
}

function SyncStat({ label, tone = "neutral", value }: Readonly<{ label: string; tone?: "danger" | "neutral" | "warning"; value: number }>) {
  const toneClassName =
    tone === "danger" ? "border-danger/30 text-danger" : tone === "warning" ? "border-warning/30 text-warning" : "text-foreground";
  return (
    <PagePanel className={`px-4 py-3 ${toneClassName}`}>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </PagePanel>
  );
}

function OutboxPanel({
  isSyncing,
  items,
  uploads,
  onDiscard,
  onDiscardUpload,
  onRetry,
  onRetryUpload,
}: Readonly<{
  isSyncing: boolean;
  items: QueuedMutation[];
  uploads: StagedUpload[];
  onDiscard: (item: QueuedMutation) => Promise<void>;
  onDiscardUpload: (upload: StagedUpload) => Promise<void>;
  onRetry: (item: QueuedMutation) => void;
  onRetryUpload: (upload: StagedUpload) => void;
}>) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>File d'attente</CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 && uploads.length === 0 ? (
          <EmptySyncState message="Aucune ecriture en attente." />
        ) : (
          <ul className="flex flex-col gap-3">
            {items.map((item) => (
              <li className="rounded-md border bg-white p-3" key={item.clientMutationId}>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold">{formatMutationTitle(item)}</p>
                  <Badge>{item.retryCount} essai{item.retryCount > 1 ? "s" : ""}</Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{formatDate(item.createdAt)}</p>
                {item.lastError ? <p className="mt-2 border-l-2 border-warning pl-2 text-xs text-warning">{item.lastError}</p> : null}
                <details className="mt-2 text-xs">
                  <summary className="cursor-pointer font-medium text-brand-700">Voir les donnees locales</summary>
                  <pre className="mt-2 max-h-40 overflow-auto rounded-md bg-muted p-2 text-[0.68rem]">{JSON.stringify(item.payload, null, 2)}</pre>
                </details>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button disabled={isSyncing} onClick={() => onRetry(item)} size="sm" type="button">
                    <RotateCcw data-icon="inline-start" />
                    Reessayer
                  </Button>
                  <Button onClick={() => void onDiscard(item)} size="sm" type="button" variant="outline">
                    <Trash2 data-icon="inline-start" />
                    Retirer
                  </Button>
                </div>
              </li>
            ))}
            {uploads.map((upload) => (
              <li className="rounded-md border bg-white p-3" key={upload.id}>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold">Document client - {upload.documentType}</p>
                  <Badge>{upload.retryCount} essai{upload.retryCount > 1 ? "s" : ""}</Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {upload.fileName} - {formatFileSize(upload.size)} - {formatDate(upload.createdAt)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {upload.clientId ? `Client ${upload.clientId}` : "En attente de creation du client"}
                </p>
                {upload.lastError ? <p className="mt-2 border-l-2 border-warning pl-2 text-xs text-warning">{upload.lastError}</p> : null}
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button disabled={isSyncing || !upload.clientId} onClick={() => onRetryUpload(upload)} size="sm" type="button">
                    <RotateCcw data-icon="inline-start" />
                    Reessayer
                  </Button>
                  <Button onClick={() => void onDiscardUpload(upload)} size="sm" type="button" variant="outline">
                    <Trash2 data-icon="inline-start" />
                    Retirer
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function ConflictPanel({
  conflicts,
  onKeepLocal,
  onKeepServer,
  outbox,
}: Readonly<{
  conflicts: StoredConflict[];
  onKeepLocal: (conflict: StoredConflict) => Promise<void>;
  onKeepServer: (conflict: StoredConflict) => Promise<void>;
  outbox: QueuedMutation[];
}>) {
  return (
    <Card>
      <CardHeader>
        <SectionHeader count={`${conflicts.length}`} title="Conflits" />
      </CardHeader>
      <CardContent>
        {conflicts.length === 0 ? (
          <EmptySyncState message="Aucun conflit a arbitrer." />
        ) : (
          <ul className="flex flex-col gap-3">
            {conflicts.map((conflict) => {
              const local = outbox.find((item) => item.clientMutationId === conflict.result.clientMutationId);
              return (
                <li className="rounded-md border border-warning/40 bg-white p-3" key={conflict.id}>
                  <p className="flex items-center gap-2 text-sm font-semibold">
                    <AlertTriangle className="size-4 text-warning" aria-hidden="true" />
                    Mutation {conflict.result.clientMutationId}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">Version serveur {conflict.result.serverVersion} - {formatDate(conflict.createdAt)}</p>
                  <div className="mt-3 grid gap-2 md:grid-cols-2">
                    <DiffBlock title="Votre version" value={local?.payload ?? { message: "Mutation locale introuvable" }} />
                    <DiffBlock title="Version serveur" value={conflict.result.serverPayload} />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button onClick={() => void onKeepLocal(conflict)} size="sm" type="button">
                      Garder ma version
                    </Button>
                    <Button onClick={() => void onKeepServer(conflict)} size="sm" type="button" variant="outline">
                      Garder serveur
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function DiffBlock({ title, value }: Readonly<{ title: string; value: unknown }>) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      <pre className="mt-1 max-h-56 overflow-auto rounded-md bg-muted p-2 text-[0.68rem]">{JSON.stringify(value, null, 2)}</pre>
    </div>
  );
}

function EmptySyncState({ message }: Readonly<{ message: string }>) {
  return (
    <p className="flex items-center gap-2 text-sm text-muted-foreground">
      <CheckCircle2 className="size-4 text-success" aria-hidden="true" />
      {message}
    </p>
  );
}

async function applySyncResults(results: SyncMutationResult[]) {
  await Promise.all(
    results.map(async (result) => {
      if (result.status === "APPLIED") {
        await offlineDatabase.outbox.delete(result.clientMutationId);
        const conflicts = await offlineDatabase.conflicts.toArray();
        await Promise.all(
          conflicts
            .filter((conflict) => conflict.result.clientMutationId === result.clientMutationId)
            .map((conflict) => offlineDatabase.conflicts.delete(conflict.id)),
        );
        return;
      }
      if (result.status === "CONFLICT") {
        await offlineDatabase.conflicts.put({ id: result.conflictId, result, createdAt: new Date().toISOString() });
        await markOutboxError({ clientMutationId: result.clientMutationId } as QueuedMutation, "Conflit avec la version serveur.");
        return;
      }
      await markOutboxError({ clientMutationId: result.clientMutationId } as QueuedMutation, result.error);
    }),
  );
}

async function syncStagedUploads(results: SyncMutationResult[]) {
  const appliedClientIds = new Map(
    results.flatMap((result) => {
      if (result.status !== "APPLIED") return [];
      const id = typeof result.data.id === "string" ? result.data.id : undefined;
      return id ? [[result.clientMutationId, id] as const] : [];
    }),
  );
  const uploads = await offlineDatabase.uploads.orderBy("createdAt").toArray();
  let failed = 0;

  for (const upload of uploads) {
    const clientId = upload.clientId ?? (upload.clientMutationId ? appliedClientIds.get(upload.clientMutationId) : undefined);
    if (!clientId) continue;
    try {
      await uploadStagedClientDocument(upload, clientId);
    } catch (error) {
      failed += 1;
      await markStagedUploadError(upload, error instanceof Error ? error.message : "Transfert impossible.");
    }
  }

  return failed;
}

async function markOutboxError(item: QueuedMutation, lastError: string) {
  const current = await offlineDatabase.outbox.get(item.clientMutationId);
  if (!current) return;
  await offlineDatabase.outbox.put({ ...current, lastError, retryCount: current.retryCount + 1 });
}

function formatMutationTitle(item: QueuedMutation) {
  return `${item.operation} - ${item.entityType}${item.entityId ? ` / ${item.entityId}` : ""}`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function formatFileSize(size: number) {
  return size < 1024 * 1024 ? `${Math.ceil(size / 1024)} Ko` : `${(size / 1024 / 1024).toFixed(1)} Mo`;
}
