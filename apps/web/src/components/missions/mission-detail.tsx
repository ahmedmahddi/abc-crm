"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ban, CalendarClock, MapPin, UsersRound, Wifi } from "lucide-react";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { apiFetch } from "@/lib/api";
import { enqueueOfflineMutation, isQueuedOfflineResult, shouldQueueOffline } from "@/lib/offline/outbox";
import type { QueuedOfflineResult } from "@/lib/offline/outbox";
import { RoleGate } from "@/components/auth/role-gate";

type MissionDetailResponse = {
  data: {
    id: string;
    title: string;
    description: string | null;
    missionType: string;
    missionMode: "ONLINE" | "PRESENTIELLE";
    startDateTime: string;
    endDateTime: string;
    location: string | null;
    status: "PLANNED" | "DONE" | "CANCELLED";
    version: number;
    client: { id: string; companyName: string };
    consultants: {
      id: string;
      fullName: string;
      email: string;
      role: "RESPONSABLE" | "PARTICIPANT";
    }[];
  };
};

const formatDateTime = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "long",
  timeStyle: "short",
});

export function MissionDetail({ missionId }: Readonly<{ missionId: string }>) {
  const queryClient = useQueryClient();
  const [queuedMessage, setQueuedMessage] = useState<string | null>(null);
  const query = useQuery({
    queryKey: ["missions", missionId],
    queryFn: () => apiFetch<MissionDetailResponse>(`/missions/${missionId}`),
  });
  const cancelMutation = useMutation({
    mutationFn: (): Promise<Record<string, unknown> | QueuedOfflineResult> => {
      if (shouldQueueOffline()) {
        return enqueueOfflineMutation({
          baseVersion: query.data?.data.version,
          entityId: missionId,
          entityType: "MISSION",
          operation: "ARCHIVE",
          payload: { version: query.data?.data.version },
        });
      }

      return apiFetch<Record<string, unknown>>(`/missions/${missionId}/archive`, { method: "POST" });
    },
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ["missions"] });
      if (isQueuedOfflineResult(result)) setQueuedMessage("Annulation ajoutee au centre de synchronisation.");
    },
  });

  if (query.isPending) return <Skeleton className="h-72 border" />;
  if (query.isError) {
    return (
      <p className="border-l-2 border-danger pl-3 text-sm text-danger" role="alert">
        Impossible de charger cette mission.
      </p>
    );
  }

  const mission = query.data.data;

  return (
    <div className="flex flex-col gap-5">
      <Breadcrumbs items={[{ href: "/calendar", label: "Calendrier" }, { label: mission.title }]} />
      <header className="flex flex-col justify-between gap-4 border-b pb-5 md:flex-row md:items-end">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight">{mission.title}</h1>
            <Badge>{mission.status}</Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {mission.client.companyName} - {mission.missionType}
          </p>
        </div>
        <RoleGate allowedRoles={["ADMIN", "RESPONSABLE"]}>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href={`/missions/${mission.id}/modifier`}>Modifier</Link>
            </Button>
            {mission.status !== "CANCELLED" ? (
              <CancelMissionDialog
                isPending={cancelMutation.isPending}
                onConfirm={() => cancelMutation.mutate()}
              />
            ) : null}
          </div>
        </RoleGate>
      </header>
      {queuedMessage ? <p className="border-l-2 border-primary bg-white px-4 py-3 text-sm" role="status">{queuedMessage}</p> : null}
      {cancelMutation.isError ? (
        <p className="border-l-2 border-danger pl-3 text-sm text-danger" role="alert">
          Impossible d'annuler la mission.
        </p>
      ) : null}
      <Card>
        <CardHeader>
          <CardTitle>Planification</CardTitle>
          <CardDescription>Informations utiles au deplacement et a l'intervention.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 text-sm">
          <p className="flex gap-3">
            <CalendarClock className="mt-0.5 size-4 shrink-0 text-brand-700" aria-hidden="true" />
            <span>
              {formatDateTime.format(new Date(mission.startDateTime))}
              <br />
              <span className="text-muted-foreground">
                jusqu'au {formatDateTime.format(new Date(mission.endDateTime))}
              </span>
            </span>
          </p>
          <p className="flex gap-3">
            {mission.missionMode === "ONLINE" ? (
              <Wifi className="mt-0.5 size-4 shrink-0 text-brand-700" aria-hidden="true" />
            ) : (
              <MapPin className="mt-0.5 size-4 shrink-0 text-brand-700" aria-hidden="true" />
            )}
            <span>
              {mission.missionMode === "ONLINE"
                ? "Intervention en ligne"
                : mission.location || "Lieu a confirmer"}
            </span>
          </p>
          {mission.description ? (
            <p className="border-t pt-4 text-muted-foreground">{mission.description}</p>
          ) : null}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Equipe affectee</CardTitle>
          <CardDescription>Responsable et participants a l'intervention.</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="flex flex-col gap-3">
            {mission.consultants.map((consultant) => (
              <li className="flex gap-3 text-sm" key={consultant.id}>
                <UsersRound className="mt-0.5 size-4 shrink-0 text-brand-700" aria-hidden="true" />
                <div>
                  <p className="font-medium">{consultant.fullName}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {consultant.role === "RESPONSABLE" ? "Responsable" : "Participant"} -{" "}
                    {consultant.email}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

function CancelMissionDialog({
  isPending,
  onConfirm,
}: Readonly<{ isPending: boolean; onConfirm: () => void }>) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="danger">
          <Ban data-icon="inline-start" />
          Annuler la mission
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Annuler cette mission ?</DialogTitle>
          <DialogDescription>
            La mission restera consultable dans l'historique et ne sera plus consideree comme
            planifiee.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Retour</Button>
          </DialogClose>
          <DialogClose asChild>
            <Button disabled={isPending} onClick={onConfirm} variant="danger">
              {isPending ? "Annulation..." : "Confirmer l'annulation"}
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
