"use client";

import Link from "next/link";
import { useDeferredValue, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Archive, RotateCcw, Search, UserRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { FilterBar, FilterField, PagePanel, RecordList, SectionHeader } from "@/components/layout/page-section";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch, ApiError } from "@/lib/api";
import { enqueueOfflineMutation, isQueuedOfflineResult, shouldQueueOffline } from "@/lib/offline/outbox";
import type { QueuedOfflineResult } from "@/lib/offline/outbox";

type ConsultantStatus = "ACTIVE" | "INACTIVE" | "ARCHIVED" | "ALL";
type Consultant = {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  status: "ACTIVE" | "INACTIVE" | "ARCHIVED";
  version: number;
  activeClientCount: number;
  missionCount: number;
};
type ConsultantListResponse = { data: Consultant[]; meta?: { total: number } };

export function ConsultantList() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<ConsultantStatus>("ALL");
  const [queuedMessage, setQueuedMessage] = useState<string | null>(null);
  const deferredSearch = useDeferredValue(search.trim());
  const query = useQuery({
    queryKey: ["consultants", deferredSearch, status],
    queryFn: () =>
      apiFetch<ConsultantListResponse>(
        `/consultants?${new URLSearchParams({ q: deferredSearch, status, page: "1", perPage: "100" })}`,
      ),
  });
  const archive = useMutation({
    mutationFn: (consultant: Consultant): Promise<Record<string, unknown> | QueuedOfflineResult> => {
      if (shouldQueueOffline()) {
        return enqueueOfflineMutation({
          baseVersion: consultant.version,
          entityId: consultant.id,
          entityType: "CONSULTANT",
          operation: "ARCHIVE",
          payload: { version: consultant.version },
        });
      }

      return apiFetch<Record<string, unknown>>(`/consultants/${consultant.id}/archive`, { method: "POST" });
    },
    onSuccess: (result) => {
      if (isQueuedOfflineResult(result)) setQueuedMessage("Archivage ajoute au centre de synchronisation.");
      return queryClient.invalidateQueries({ queryKey: ["consultants"] });
    },
  });
  const restore = useMutation({
    mutationFn: (consultant: Consultant): Promise<Record<string, unknown> | QueuedOfflineResult> => {
      if (shouldQueueOffline()) {
        return enqueueOfflineMutation({
          baseVersion: consultant.version,
          entityId: consultant.id,
          entityType: "CONSULTANT",
          operation: "RESTORE",
          payload: { version: consultant.version },
        });
      }

      return apiFetch<Record<string, unknown>>(`/consultants/${consultant.id}/restore`, { method: "POST" });
    },
    onSuccess: (result) => {
      if (isQueuedOfflineResult(result)) setQueuedMessage("Restauration ajoutee au centre de synchronisation.");
      return queryClient.invalidateQueries({ queryKey: ["consultants"] });
    },
  });
  const actionError = archive.error ?? restore.error;
  const consultants = query.data?.data ?? [];

  return (
    <PagePanel as="section" className="flex flex-col gap-4" aria-labelledby="consultant-list-title">
      <SectionHeader
        actions={
          <Button asChild size="sm">
            <Link href="/consultants/nouveau">Nouveau consultant</Link>
          </Button>
        }
        count={query.data ? `${consultants.length} profil${consultants.length > 1 ? "s" : ""}` : undefined}
        description="Disponibilite de reference, coordonnees et charge operationnelle."
        id="consultant-list-title"
        title="Repertoire consultants"
      />
      <FilterBar className="md:grid-cols-2">
        <FilterField className="relative">
          <span>Recherche</span>
          <Search className="pointer-events-none absolute left-3 top-9 size-4 text-muted-foreground" aria-hidden="true" />
          <Input className="pl-10" onChange={(event) => setSearch(event.target.value)} placeholder="Nom ou email" type="search" value={search} />
        </FilterField>
        <FilterField>
          Etat du profil
          <select
            className="h-11 rounded-md border bg-white px-3 text-sm font-medium normal-case tracking-normal text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            onChange={(event) => setStatus(event.target.value as ConsultantStatus)}
            value={status}
          >
            <option value="ALL">Tous les profils</option>
            <option value="ACTIVE">Actifs</option>
            <option value="INACTIVE">Inactifs</option>
            <option value="ARCHIVED">Archives</option>
          </select>
        </FilterField>
      </FilterBar>
      {actionError ? (
        <p className="border-l-2 border-danger pl-3 text-sm text-danger" role="alert">
          {actionError instanceof ApiError ? actionError.message : "Impossible de finaliser l'action demandee."}
        </p>
      ) : null}
      {queuedMessage ? <p className="border-l-2 border-primary bg-white px-4 py-3 text-sm" role="status">{queuedMessage}</p> : null}
      {query.isPending ? <ConsultantListLoading /> : null}
      {query.isError ? <p className="border-l-2 border-danger pl-3 text-sm text-danger" role="alert">Impossible de charger les consultants.</p> : null}
      {!query.isPending && !query.isError && consultants.length === 0 ? <ConsultantEmptyState /> : null}
      <RecordList>
        {consultants.map((consultant) => (
          <ConsultantRow
            consultant={consultant}
            isPending={archive.isPending || restore.isPending}
            key={consultant.id}
            onArchive={() => archive.mutate(consultant)}
            onRestore={() => restore.mutate(consultant)}
          />
        ))}
      </RecordList>
    </PagePanel>
  );
}

function ConsultantRow({
  consultant,
  isPending,
  onArchive,
  onRestore,
}: Readonly<{
  consultant: Consultant;
  isPending: boolean;
  onArchive: () => void;
  onRestore: () => void;
}>) {
  return (
    <article className="flex flex-col gap-3 rounded-md border bg-white p-4 shadow-soft transition-colors hover:border-brand-200 hover:bg-brand-50/60 md:flex-row md:items-center md:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="truncate text-sm font-semibold">
            <Link className="hover:text-brand-700 hover:underline" href={`/consultants/${consultant.id}`}>
              {consultant.fullName}
            </Link>
          </h3>
          {consultant.status !== "ACTIVE" ? <Badge>{consultant.status === "ARCHIVED" ? "Archive" : "Inactif"}</Badge> : null}
        </div>
        <p className="mt-1 truncate text-xs text-muted-foreground">
          {consultant.email}
          {consultant.phone ? ` - ${consultant.phone}` : ""}
        </p>
      </div>
      <div className="flex flex-col gap-3 md:items-end">
        <dl className="flex gap-5 text-xs">
          <div>
            <dt className="text-muted-foreground">Clients</dt>
            <dd className="mt-1 font-semibold">{consultant.activeClientCount}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Missions</dt>
            <dd className="mt-1 font-semibold">{consultant.missionCount}</dd>
          </div>
        </dl>
        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm" variant="outline">
            <Link href={`/consultants/${consultant.id}`}>Ouvrir</Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link href={`/consultants/${consultant.id}/modifier`}>Modifier</Link>
          </Button>
          {consultant.status === "ARCHIVED" ? (
            <RestoreConsultantDialog isPending={isPending} onConfirm={onRestore} />
          ) : (
            <ArchiveConsultantDialog isPending={isPending} onConfirm={onArchive} />
          )}
        </div>
      </div>
    </article>
  );
}

function ConsultantListLoading() {
  return (
    <div className="flex flex-col gap-2" aria-label="Chargement des consultants" role="status">
      {[0, 1].map((index) => (
        <Skeleton className="h-24 border" key={index} />
      ))}
    </div>
  );
}

function ConsultantEmptyState() {
  return (
    <div className="flex flex-col items-center gap-2 rounded-md border border-dashed px-4 py-10 text-center">
      <UserRound className="size-5 text-muted-foreground" aria-hidden="true" />
      <p className="text-sm font-medium">Aucun consultant enregistre</p>
      <p className="text-xs text-muted-foreground">Creez le premier profil pour l'attribuer aux dossiers clients et aux missions.</p>
      <Button asChild size="sm">
        <Link href="/consultants/nouveau">Creer un consultant</Link>
      </Button>
    </div>
  );
}

function ArchiveConsultantDialog({ isPending, onConfirm }: Readonly<{ isPending: boolean; onConfirm: () => void }>) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="sm" type="button" variant="ghost">
          <Archive data-icon="inline-start" />
          Archiver
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Archiver ce consultant ?</DialogTitle>
          <DialogDescription>Le profil restera dans l'historique mais ne sera plus disponible pour les nouvelles affectations.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Conserver</Button>
          </DialogClose>
          <DialogClose asChild>
            <Button disabled={isPending} onClick={onConfirm} variant="danger">
              {isPending ? "Archivage..." : "Confirmer"}
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RestoreConsultantDialog({ isPending, onConfirm }: Readonly<{ isPending: boolean; onConfirm: () => void }>) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="sm" type="button">
          <RotateCcw data-icon="inline-start" />
          Restaurer
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Restaurer ce consultant ?</DialogTitle>
          <DialogDescription>Le profil redeviendra disponible pour les nouvelles affectations.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Annuler</Button>
          </DialogClose>
          <DialogClose asChild>
            <Button disabled={isPending} onClick={onConfirm}>
              {isPending ? "Restauration..." : "Confirmer"}
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
