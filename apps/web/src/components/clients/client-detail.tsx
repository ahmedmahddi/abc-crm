"use client";

import Link from "next/link";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ClientDocumentType } from "@abc/shared";
import { Archive, MapPin, RotateCcw, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ClientDocuments } from "@/components/clients/client-documents";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { enqueueOfflineMutation, isQueuedOfflineResult, shouldQueueOffline } from "@/lib/offline/outbox";
import type { QueuedOfflineResult } from "@/lib/offline/outbox";

type ClientDetailResponse = {
  data: {
    id: string;
    companyName: string;
    fiscalNumber: string;
    address: string;
    zone: string | null;
    activitySector: string;
    applicationDomain: string | null;
    color: string;
    cadreCount: number;
    nonCadreCount: number;
    totalEmployees: number;
    status: "ACTIVE" | "ARCHIVED";
    version: number;
    responsibleConsultants: Array<{ id: string; fullName: string; email: string }>;
    personnel: Array<{ id: string; fullName: string; position: string | null; phone: string | null; email: string | null; type: "CADRE" | "NON_CADRE" }>;
    documents: Array<{ id: string; type: ClientDocumentType; file: { id: string; originalName: string; mimeType: string; size: number } }>;
    missions: Array<{ id: string; title: string; startDateTime: string; status: string }>;
  };
};

export function ClientDetail({ clientId }: Readonly<{ clientId: string }>) {
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const [queuedMessage, setQueuedMessage] = useState<string | null>(null);
  const query = useQuery({
    queryKey: ["clients", clientId],
    queryFn: () => apiFetch<ClientDetailResponse>(`/clients/${clientId}`),
  });
  const archiveMutation = useMutation({
    mutationFn: (): Promise<Record<string, unknown> | QueuedOfflineResult> => {
      if (shouldQueueOffline()) {
        return enqueueOfflineMutation({
          baseVersion: query.data?.data.version,
          entityId: clientId,
          entityType: "CLIENT",
          operation: "ARCHIVE",
          payload: { version: query.data?.data.version },
        });
      }

      return apiFetch<Record<string, unknown>>(`/clients/${clientId}/archive`, { method: "POST" });
    },
    onSuccess: async (result) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["clients"] }),
        queryClient.invalidateQueries({ queryKey: ["clients", clientId] }),
      ]);
      if (isQueuedOfflineResult(result)) setQueuedMessage("Archivage ajoute au centre de synchronisation.");
    },
  });
  const restoreMutation = useMutation({
    mutationFn: (): Promise<Record<string, unknown> | QueuedOfflineResult> => {
      if (shouldQueueOffline()) {
        return enqueueOfflineMutation({
          baseVersion: query.data?.data.version,
          entityId: clientId,
          entityType: "CLIENT",
          operation: "RESTORE",
          payload: { version: query.data?.data.version },
        });
      }

      return apiFetch<Record<string, unknown>>(`/clients/${clientId}/restore`, { method: "POST" });
    },
    onSuccess: async (result) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["clients"] }),
        queryClient.invalidateQueries({ queryKey: ["clients", clientId] }),
      ]);
      if (isQueuedOfflineResult(result)) setQueuedMessage("Restauration ajoutee au centre de synchronisation.");
    },
  });

  if (query.isPending) return <Skeleton className="h-72 border" />;
  if (query.isError) {
    return <p className="border-l-2 border-danger pl-3 text-sm text-danger" role="alert">Impossible de charger cette fiche client.</p>;
  }

  const client = query.data.data;
  return (
    <div className="flex flex-col gap-5">
      <Breadcrumbs items={[{ href: "/clients", label: "Clients" }, { label: client.companyName }]} />
      {searchParams.get("upload") === "partial" ? <p className="border-l-2 border-warning bg-white px-4 py-3 text-sm" role="status">Le client a été créé, mais certains justificatifs n'ont pas été transférés. Réessayez depuis la section Documents client.</p> : null}
      {queuedMessage ? <p className="border-l-2 border-primary bg-white px-4 py-3 text-sm" role="status">{queuedMessage}</p> : null}
      {archiveMutation.isError || restoreMutation.isError ? <p className="border-l-2 border-danger pl-3 text-sm text-danger" role="alert">Impossible de finaliser l'action demandÃ©e sur ce client.</p> : null}
      <header className="flex flex-col justify-between gap-4 border-b pb-5 md:flex-row md:items-end">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            {client.status === "ARCHIVED" ? <Badge>Archivé</Badge> : null}
          </div>
          <h1 className="text-xl font-semibold tracking-tight">{client.companyName}</h1>
          <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground"><span className="size-3 rounded-full border" style={{ backgroundColor: client.color }} aria-hidden="true" />{client.fiscalNumber} · {client.activitySector}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline"><Link href={`/clients/${client.id}/modifier`}>Modifier la fiche</Link></Button>
          {client.status === "ARCHIVED" ? <RestoreClientDialog isPending={restoreMutation.isPending} onConfirm={() => restoreMutation.mutate()} /> : <ArchiveClientDialog isPending={archiveMutation.isPending} onConfirm={() => archiveMutation.mutate()} />}
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Repères opérationnels</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-4 text-sm">
            <div className="flex gap-3"><MapPin className="mt-0.5 size-4 shrink-0 text-brand-700" aria-hidden="true" /><div><p className="font-medium">Adresse</p><p className="mt-1 text-muted-foreground">{client.address}</p></div></div>
            <dl className="grid grid-cols-2 gap-4 border-t pt-4">
              <div><dt className="text-xs text-muted-foreground">Zone</dt><dd className="mt-1 font-medium">{client.zone || "Non renseignée"}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Domaine</dt><dd className="mt-1 font-medium">{client.applicationDomain || "Non renseigné"}</dd></div>
            </dl>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Effectif</CardTitle><CardDescription>Composition déclarée</CardDescription></CardHeader>
          <CardContent>
            <p className="text-xl font-semibold">{client.totalEmployees}</p>
            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div><dt className="text-xs text-muted-foreground">Cadres</dt><dd className="mt-1 font-medium">{client.cadreCount}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Non-cadres</dt><dd className="mt-1 font-medium">{client.nonCadreCount}</dd></div>
            </dl>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ContactsSection personnel={client.personnel} />
        <ClientDocuments clientId={client.id} documents={client.documents} />
      </div>
      <Card>
        <CardHeader><CardTitle>Consultants responsables</CardTitle><CardDescription>Profils chargés du suivi du dossier</CardDescription></CardHeader>
        <CardContent>
          {client.responsibleConsultants.length === 0 ? <p className="text-sm text-muted-foreground">Aucun consultant responsable attribué.</p> : <ul className="flex flex-col gap-2">{client.responsibleConsultants.map((consultant) => <li className="text-sm" key={consultant.id}><span className="font-medium">{consultant.fullName}</span><span className="text-muted-foreground"> · {consultant.email}</span></li>)}</ul>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Historique des missions</CardTitle><CardDescription>Interventions liées à ce dossier</CardDescription></CardHeader>
        <CardContent>
          {client.missions.length === 0 ? <p className="text-sm text-muted-foreground">Aucune mission planifiée pour ce client.</p> : <ul className="flex flex-col gap-2">{client.missions.map((mission) => <li className="flex flex-col gap-1 border-b pb-2 text-sm last:border-b-0 last:pb-0" key={mission.id}><Link className="font-medium text-brand-700 hover:underline" href={`/missions/${mission.id}`}>{mission.title}</Link><span className="text-xs text-muted-foreground">{formatMissionDate(mission.startDateTime)} · {mission.status}</span></li>)}</ul>}
        </CardContent>
      </Card>
    </div>
  );
}

function formatMissionDate(value: string) {
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function ContactsSection({ personnel }: Readonly<{ personnel: ClientDetailResponse["data"]["personnel"] }>) {
  return (
    <Card>
      <CardHeader><CardTitle>Contacts opérationnels</CardTitle><CardDescription>Interlocuteurs du dossier</CardDescription></CardHeader>
      <CardContent>
        {personnel.length === 0 ? <p className="text-sm text-muted-foreground">Aucun contact renseigné.</p> : (
          <ul className="flex flex-col gap-3">
            {personnel.map((contact) => (
              <li className="flex gap-3 border-b pb-3 last:border-b-0 last:pb-0" key={contact.id}>
                <Users className="mt-0.5 size-4 shrink-0 text-brand-700" aria-hidden="true" />
                <div className="min-w-0 text-sm">
                  <p className="font-medium">{contact.fullName}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{contact.position || "Fonction non renseignée"} · {contact.type === "CADRE" ? "Cadre" : "Non-cadre"}</p>
                  {contact.phone || contact.email ? <p className="mt-1 break-words text-xs text-muted-foreground">{[contact.phone, contact.email].filter(Boolean).join(" · ")}</p> : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function ArchiveClientDialog({ isPending, onConfirm }: Readonly<{ isPending: boolean; onConfirm: () => void }>) {
  return (
    <Dialog>
      <DialogTrigger asChild><Button variant="danger"><Archive data-icon="inline-start" />Archiver</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Archiver ce client ?</DialogTitle>
          <DialogDescription>Le dossier restera consultable dans les archives. Les missions et documents existants ne seront pas supprimés.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild><Button variant="outline">Annuler</Button></DialogClose>
          <DialogClose asChild><Button disabled={isPending} onClick={onConfirm} variant="danger">{isPending ? "Archivage..." : "Confirmer l’archivage"}</Button></DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RestoreClientDialog({ isPending, onConfirm }: Readonly<{ isPending: boolean; onConfirm: () => void }>) {
  return (
    <Dialog>
      <DialogTrigger asChild><Button><RotateCcw data-icon="inline-start" />Restaurer</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Restaurer ce client ?</DialogTitle>
          <DialogDescription>Le dossier redeviendra actif et pourra etre utilise pour les nouvelles missions et affectations.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild><Button variant="outline">Annuler</Button></DialogClose>
          <DialogClose asChild><Button disabled={isPending} onClick={onConfirm}>{isPending ? "Restauration..." : "Confirmer la restauration"}</Button></DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
