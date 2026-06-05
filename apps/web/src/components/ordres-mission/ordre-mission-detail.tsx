"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, ExternalLink, FileSpreadsheet, FileText, Printer } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { API_URL, apiFetch, ApiError } from "@/lib/api";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";

type Ordre = {
  id: string;
  reference: string;
  object: string;
  description?: string;
  startDateTime: string;
  endDateTime: string;
  location?: string;
  status: "DRAFT" | "VALIDATED" | "PRINTED" | "CANCELLED" | "ARCHIVED";
  missionMode: string;
  missionType: string;
  requiresReview: boolean;
  client: { id: string; companyName: string };
  consultants: { id: string; fullName: string; email?: string }[];
  mission?: { id: string; title: string };
  template?: { id: string; name: string };
};
type OrdreResponse = { data: Ordre };
const formatDateTime = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" });

export function OrdreMissionDetail({ id }: Readonly<{ id: string }>) {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["ordres-mission", id], queryFn: () => apiFetch<OrdreResponse>(`/ordres-mission/${id}`) });
  const action = useMutation({
    mutationFn: (command: "validate" | "mark-printed" | "cancel" | "archive") => apiFetch<OrdreResponse>(`/ordres-mission/${id}/${command}`, { method: "POST" }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["ordres-mission"] }),
        queryClient.invalidateQueries({ queryKey: ["ordres-mission", id] }),
      ]);
    },
  });

  if (query.isPending) return <Skeleton className="h-96" />;
  if (query.isError) return <p className="border-l-2 border-danger pl-3 text-sm text-danger" role="alert">Impossible de charger cet ordre de mission.</p>;
  const ordre = query.data.data;
  const previewUrl = `${API_URL}/ordres-mission/${ordre.id}/preview`;

  return <div className="flex flex-col gap-5">
    <header className="border-b pb-4">
      <Breadcrumbs items={[{ href: "/ordres-mission", label: "Ordres de mission" }, { label: ordre.reference }]} />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <h1 className="text-xl font-semibold tracking-tight">{ordre.reference}</h1>
        <Badge>{ordre.status}</Badge>
        {ordre.requiresReview ? <Badge className="border-warning bg-warning/10 text-warning">Revue requise</Badge> : null}
      </div>
      <p className="mt-2 text-sm text-muted-foreground">{ordre.object}</p>
    </header>

    {action.isError ? <p className="border-l-2 border-danger pl-3 text-sm text-danger" role="alert">{action.error instanceof ApiError ? action.error.message : "Impossible d’appliquer cette action."}</p> : null}

    <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="flex flex-col gap-4">
        <Card>
          <CardHeader><CardTitle>Intervention</CardTitle></CardHeader>
          <CardContent className="grid gap-4 text-sm sm:grid-cols-2">
            <Fact label="Client"><Link className="text-brand-700 hover:underline" href={`/clients/${ordre.client.id}`}>{ordre.client.companyName}</Link></Fact>
            <Fact label="Mission">{ordre.mission ? <Link className="text-brand-700 hover:underline" href={`/missions/${ordre.mission.id}`}>{ordre.mission.title}</Link> : "Ordre manuel"}</Fact>
            <Fact label="Période">{formatDateTime.format(new Date(ordre.startDateTime))}<br />{formatDateTime.format(new Date(ordre.endDateTime))}</Fact>
            <Fact label="Mode et lieu">{ordre.missionMode}{ordre.location ? ` · ${ordre.location}` : ""}</Fact>
            <Fact label="Type">{ordre.missionType}</Fact>
            <Fact label="Modèle">{ordre.template?.name ?? "Modèle par défaut"}</Fact>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Consultants affectés</CardTitle></CardHeader>
          <CardContent>{ordre.consultants.length ? <ul className="divide-y">{ordre.consultants.map((consultant) => <li className="py-3 text-sm" key={consultant.id}><p className="font-medium">{consultant.fullName}</p>{consultant.email ? <p className="mt-1 text-xs text-muted-foreground">{consultant.email}</p> : null}</li>)}</ul> : <p className="text-sm text-muted-foreground">Aucun consultant affecté.</p>}</CardContent>
        </Card>
        {ordre.description ? <Card><CardHeader><CardTitle>Consignes</CardTitle></CardHeader><CardContent><p className="whitespace-pre-wrap text-sm leading-6">{ordre.description}</p></CardContent></Card> : null}
      </div>

      <aside className="flex flex-col gap-4">
        <Card>
          <CardHeader><CardTitle>Document</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-2">
            <Button asChild variant="outline"><a href={previewUrl} rel="noreferrer" target="_blank"><ExternalLink aria-hidden="true" />Prévisualiser</a></Button>
            <Button asChild variant="outline"><a href={`${API_URL}/ordres-mission/${ordre.id}/export.pdf`}><FileText aria-hidden="true" />PDF</a></Button>
            <Button asChild variant="outline"><a href={`${API_URL}/ordres-mission/${ordre.id}/export.xlsx`}><FileSpreadsheet aria-hidden="true" />XLSX</a></Button>
            <Button asChild variant="outline"><a href={`${API_URL}/ordres-mission/${ordre.id}/export.csv`}><Download aria-hidden="true" />CSV</a></Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Cycle de validation</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-2">
            {ordre.status === "DRAFT" ? <Button disabled={action.isPending} onClick={() => action.mutate("validate")}>Valider l’ordre</Button> : null}
            {ordre.status === "VALIDATED" || ordre.status === "PRINTED" ? <Button disabled={action.isPending} onClick={() => action.mutate("mark-printed")} variant="outline"><Printer aria-hidden="true" />Marquer comme imprimé</Button> : null}
            {ordre.status !== "CANCELLED" && ordre.status !== "ARCHIVED" ? <ConfirmationAction description="L’ordre restera consultable dans l’historique mais ne pourra plus être utilisé comme document actif." label="Annuler l’ordre" onConfirm={() => action.mutate("cancel")} title="Annuler cet ordre ?" /> : null}
            {ordre.status !== "ARCHIVED" ? <ConfirmationAction description="L’ordre sera retiré du registre courant et conservé dans les archives." label="Archiver" onConfirm={() => action.mutate("archive")} title="Archiver cet ordre ?" /> : null}
          </CardContent>
        </Card>
      </aside>
    </section>
  </div>;
}

function Fact({ children, label }: Readonly<{ children: React.ReactNode; label: string }>) {
  return <div><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p><div className="mt-1 leading-6">{children}</div></div>;
}

function ConfirmationAction({ description, label, onConfirm, title }: Readonly<{ description: string; label: string; onConfirm: () => void; title: string }>) {
  return <Dialog><DialogTrigger asChild><Button className="justify-start text-danger" variant="ghost">{label}</Button></DialogTrigger><DialogContent><DialogHeader><DialogTitle>{title}</DialogTitle><DialogDescription>{description}</DialogDescription></DialogHeader><DialogFooter><DialogClose asChild><Button variant="outline">Conserver</Button></DialogClose><DialogClose asChild><Button onClick={onConfirm} variant="danger">Confirmer</Button></DialogClose></DialogFooter></DialogContent></Dialog>;
}
