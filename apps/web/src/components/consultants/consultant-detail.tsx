"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Mail, Phone, RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch, ApiError } from "@/lib/api";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { enqueueOfflineMutation, isQueuedOfflineResult, shouldQueueOffline } from "@/lib/offline/outbox";
import type { QueuedOfflineResult } from "@/lib/offline/outbox";
import { RoleGate } from "@/components/auth/role-gate";

type Consultant = {
  id: string;
  fullName: string;
  email: string;
  phone?: string;
  status: string;
  version: number;
  user?: { name: string; email: string; role: string; status: string };
  clients: { client: { id: string; companyName: string; status: string } }[];
  missions: { mission: { id: string; title: string; startDateTime: string; endDateTime: string; status: string; client: { companyName: string } } }[];
};
type ConsultantResponse = { data: Consultant };

const dateTime = new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

export function ConsultantDetail({ id }: Readonly<{ id: string }>) {
  const queryClient = useQueryClient();
  const [queuedMessage, setQueuedMessage] = useState<string | null>(null);
  const query = useQuery({ queryKey: ["consultants", id], queryFn: () => apiFetch<ConsultantResponse>(`/consultants/${id}`) });
  const archive = useMutation({
    mutationFn: (): Promise<Record<string, unknown> | QueuedOfflineResult> => {
      if (shouldQueueOffline()) {
        return enqueueOfflineMutation({
          baseVersion: query.data?.data.version,
          entityId: id,
          entityType: "CONSULTANT",
          operation: "ARCHIVE",
          payload: { version: query.data?.data.version },
        });
      }

      return apiFetch<Record<string, unknown>>(`/consultants/${id}/archive`, { method: "POST" });
    },
    onSuccess: (result) => {
      if (isQueuedOfflineResult(result)) setQueuedMessage("Archivage ajoute au centre de synchronisation.");
      return invalidateConsultant(queryClient, id);
    },
  });
  const restore = useMutation({
    mutationFn: (): Promise<Record<string, unknown> | QueuedOfflineResult> => {
      if (shouldQueueOffline()) {
        return enqueueOfflineMutation({
          baseVersion: query.data?.data.version,
          entityId: id,
          entityType: "CONSULTANT",
          operation: "RESTORE",
          payload: { version: query.data?.data.version },
        });
      }

      return apiFetch<Record<string, unknown>>(`/consultants/${id}/restore`, { method: "POST" });
    },
    onSuccess: (result) => {
      if (isQueuedOfflineResult(result)) setQueuedMessage("Restauration ajoutee au centre de synchronisation.");
      return invalidateConsultant(queryClient, id);
    },
  });

  if (query.isPending) return <Skeleton className="h-96" />;
  if (query.isError) return <p className="border-l-2 border-danger pl-3 text-sm text-danger" role="alert">Impossible de charger ce consultant.</p>;

  const consultant = query.data.data;
  const upcoming = consultant.missions
    .filter(({ mission }) => new Date(mission.endDateTime) >= new Date() && mission.status !== "CANCELLED")
    .sort((a, b) => a.mission.startDateTime.localeCompare(b.mission.startDateTime));
  const activeClients = consultant.clients.filter(({ client }) => client.status === "ACTIVE");
  const actionError = archive.error ?? restore.error;

  return (
    <div className="flex flex-col gap-5">
      <header className="border-b pb-4">
        <Breadcrumbs items={[{ href: "/consultants", label: "Consultants" }, { label: consultant.fullName }]} />
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-semibold tracking-tight">{consultant.fullName}</h1>
          <Badge>{consultant.status}</Badge>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">Profil metier, clients suivis et prochaines interventions.</p>
      </header>

      {queuedMessage ? <p className="border-l-2 border-primary bg-white px-4 py-3 text-sm" role="status">{queuedMessage}</p> : null}
      {actionError ? <p className="border-l-2 border-danger pl-3 text-sm text-danger" role="alert">{actionError instanceof ApiError ? actionError.message : "Impossible de finaliser l'action demandee sur ce consultant."}</p> : null}

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader><CardTitle>Prochaines missions</CardTitle></CardHeader>
            <CardContent>
              {upcoming.length ? (
                <ul className="divide-y">
                  {upcoming.map(({ mission }) => (
                    <li className="py-3" key={mission.id}>
                      <Link className="text-sm font-semibold text-brand-700 hover:underline" href={`/missions/${mission.id}`}>{mission.title}</Link>
                      <p className="mt-1 text-xs text-muted-foreground">{mission.client.companyName} - {dateTime.format(new Date(mission.startDateTime))}</p>
                    </li>
                  ))}
                </ul>
              ) : <p className="text-sm text-muted-foreground">Aucune mission a venir.</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Clients suivis</CardTitle></CardHeader>
            <CardContent>
              {activeClients.length ? (
                <ul className="divide-y">
                  {activeClients.map(({ client }) => (
                    <li className="py-3" key={client.id}>
                      <Link className="text-sm font-semibold text-brand-700 hover:underline" href={`/clients/${client.id}`}>{client.companyName}</Link>
                    </li>
                  ))}
                </ul>
              ) : <p className="text-sm text-muted-foreground">Aucun client actif affecte.</p>}
            </CardContent>
          </Card>
        </div>

        <aside className="flex flex-col gap-4">
          <Card>
            <CardHeader><CardTitle>Coordonnees</CardTitle></CardHeader>
            <CardContent className="flex flex-col gap-3 text-sm">
              <p className="flex gap-2"><Mail className="mt-0.5 size-4 shrink-0 text-brand-700" aria-hidden="true" />{consultant.email}</p>
              <p className="flex gap-2"><Phone className="mt-0.5 size-4 shrink-0 text-brand-700" aria-hidden="true" />{consultant.phone || "Non renseigne"}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Compte applicatif</CardTitle></CardHeader>
            <CardContent>
              {consultant.user ? (
                <div className="text-sm">
                  <p className="font-medium">{consultant.user.email}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{consultant.user.role} - {consultant.user.status}</p>
                </div>
              ) : <p className="text-sm text-muted-foreground">Aucun compte lie. Le profil reste utilisable pour les affectations.</p>}
            </CardContent>
          </Card>

          <RoleGate allowedRoles={["ADMIN", "RESPONSABLE"]}>
            <div className="flex flex-col gap-2">
              <Button asChild><Link href={`/consultants/${consultant.id}/modifier`}>Modifier le profil</Link></Button>
              {consultant.status === "ARCHIVED" ? (
                <RestoreConsultantDialog isPending={restore.isPending} onConfirm={() => restore.mutate()} />
              ) : (
                <ArchiveConsultantDialog isPending={archive.isPending} onConfirm={() => archive.mutate()} />
              )}
            </div>
          </RoleGate>
        </aside>
      </section>
    </div>
  );
}

function invalidateConsultant(queryClient: ReturnType<typeof useQueryClient>, id: string) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: ["consultants"] }),
    queryClient.invalidateQueries({ queryKey: ["consultants", id] }),
  ]);
}

function ArchiveConsultantDialog({ isPending, onConfirm }: Readonly<{ isPending: boolean; onConfirm: () => void }>) {
  return (
    <Dialog>
      <DialogTrigger asChild><Button variant="ghost" className="text-danger">Archiver</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Archiver ce consultant ?</DialogTitle>
          <DialogDescription>Le profil restera dans l'historique mais ne sera plus disponible pour les nouvelles affectations.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild><Button variant="outline">Conserver</Button></DialogClose>
          <DialogClose asChild><Button disabled={isPending} variant="danger" onClick={onConfirm}>{isPending ? "Archivage..." : "Confirmer"}</Button></DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RestoreConsultantDialog({ isPending, onConfirm }: Readonly<{ isPending: boolean; onConfirm: () => void }>) {
  return (
    <Dialog>
      <DialogTrigger asChild><Button><RotateCcw data-icon="inline-start" />Restaurer</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Restaurer ce consultant ?</DialogTitle>
          <DialogDescription>Le profil redeviendra disponible pour les nouvelles affectations.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild><Button variant="outline">Annuler</Button></DialogClose>
          <DialogClose asChild><Button disabled={isPending} onClick={onConfirm}>{isPending ? "Restauration..." : "Confirmer"}</Button></DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
