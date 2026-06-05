"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarClock, CalendarPlus, FileUp, MapPin, RefreshCw, Search, Wifi, WifiOff } from "lucide-react";
import { PageHeader, PagePanel, PageStack } from "@/components/layout/page-section";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api";

type Mission = {
  id: string;
  title: string;
  startDateTime: string;
  endDateTime: string;
  location: string | null;
  missionMode: "ONLINE" | "PRESENTIELLE";
  client: { companyName: string };
  consultants: { fullName: string }[];
};
type ListResponse<T> = { data: T[] };

const timeFormat = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" });
const dateFormat = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "2-digit", month: "long" });

export function HomeWorkSurface() {
  const online = useOnlineStatus();
  const missions = useQuery({ queryKey: ["missions", "today"], queryFn: () => apiFetch<ListResponse<Mission>>("/missions?status=PLANNED&page=1&perPage=100") });
  const todayMissions = useMemo(() => (missions.data?.data ?? []).filter((mission) => isToday(new Date(mission.startDateTime))), [missions.data?.data]);

  return (
    <PageStack>
      <PageHeader
        actions={<Button asChild><Link href="/missions/nouvelle"><CalendarPlus data-icon="inline-start" />Planifier</Link></Button>}
        eyebrow={dateFormat.format(new Date())}
        title="Votre journee"
        description="Missions du jour et raccourcis utiles pour le travail terrain."
      />
      {!online ? <OfflineBanner /> : null}
      <QuickActions />
      <div className="grid gap-4">
        <TodayMissions isError={missions.isError} isPending={missions.isPending} missions={todayMissions} retry={() => void missions.refetch()} />
      </div>
    </PageStack>
  );
}

function OfflineBanner() {
  return (
    <div className="flex gap-3 rounded-lg border border-warning/40 bg-white px-4 py-3 text-sm shadow-soft" role="status">
      <WifiOff className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
      <div>
        <p className="font-medium">Mode hors ligne</p>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">Les donnees deja chargees restent disponibles. Les ecritures seront synchronisees apres reconnexion.</p>
      </div>
    </div>
  );
}

function QuickActions() {
  const actions = [
    { href: "/missions/nouvelle", label: "Planifier une mission", detail: "Creer l'intervention terrain", icon: CalendarPlus },
    { href: "/clients", label: "Rechercher un client", detail: "Contacts, documents, historique", icon: Search },
    { href: "/clients", label: "Ajouter un document", detail: "Completer une fiche client", icon: FileUp },
  ];
  return (
    <section className="grid gap-2 sm:grid-cols-3" aria-label="Actions rapides">
      {actions.map((action) => (
        <Link className="group flex min-h-20 items-center gap-3 rounded-lg border bg-white p-4 shadow-soft transition-colors hover:border-brand-200 hover:bg-brand-50/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" href={action.href} key={action.label}>
          <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-brand-50 text-brand-700 transition-colors group-hover:bg-white">
            <action.icon className="size-5" aria-hidden="true" />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold">{action.label}</span>
            <span className="mt-1 block text-xs text-muted-foreground">{action.detail}</span>
          </span>
        </Link>
      ))}
    </section>
  );
}

function TodayMissions({ isError, isPending, missions, retry }: Readonly<{ isError: boolean; isPending: boolean; missions: Mission[]; retry: () => void }>) {
  return (
    <PagePanel as="section" className="flex flex-col gap-4" aria-labelledby="today-missions-title">
      <div className="flex items-center justify-between border-b pb-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground" id="today-missions-title">Missions du jour</h2>
          <p className="mt-1 text-sm text-muted-foreground">{missions.length} intervention{missions.length > 1 ? "s" : ""} planifiee{missions.length > 1 ? "s" : ""}</p>
        </div>
        <Button asChild size="sm" variant="outline"><Link href="/calendar">Calendrier</Link></Button>
      </div>
      {isPending ? <div className="flex flex-col gap-2"><Skeleton className="h-24" /><Skeleton className="h-24" /></div> : null}
      {isError ? <div className="flex flex-col items-start gap-3 border-l-2 border-danger pl-3 text-sm"><p>Impossible de charger les missions du jour.</p><Button onClick={retry} size="sm" type="button" variant="outline"><RefreshCw data-icon="inline-start" />Reessayer</Button></div> : null}
      {!isPending && !isError && missions.length === 0 ? <MissionEmptyState /> : null}
      {missions.length > 0 ? <ul className="flex flex-col divide-y">{missions.map((mission) => <MissionRow mission={mission} key={mission.id} />)}</ul> : null}
    </PagePanel>
  );
}

function MissionRow({ mission }: Readonly<{ mission: Mission }>) {
  return (
    <li>
      <Link className="flex flex-col gap-2 px-1 py-3 transition-colors hover:bg-brand-50/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" href={`/missions/${mission.id}`}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{mission.title}</p>
            <p className="mt-1 truncate text-xs text-muted-foreground">{mission.client.companyName} - {mission.consultants.map((consultant) => consultant.fullName).join(", ")}</p>
          </div>
          <p className="shrink-0 rounded bg-brand-50 px-2 py-1 text-xs font-semibold text-brand-700">{timeFormat.format(new Date(mission.startDateTime))}</p>
        </div>
        <p className="flex items-center gap-1 text-xs text-muted-foreground">{mission.missionMode === "ONLINE" ? <Wifi className="size-3.5" aria-hidden="true" /> : <MapPin className="size-3.5" aria-hidden="true" />}{mission.missionMode === "ONLINE" ? "En ligne" : mission.location || "Lieu a confirmer"}</p>
      </Link>
    </li>
  );
}

function MissionEmptyState() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-md border border-dashed px-4 py-8 text-center">
      <CalendarClock className="size-6 text-muted-foreground" aria-hidden="true" />
      <p className="text-sm text-muted-foreground">Aucune intervention planifiee aujourd'hui.</p>
      <Button asChild size="sm"><Link href="/calendar">Ouvrir le calendrier</Link></Button>
    </div>
  );
}

function isToday(date: Date) {
  const now = new Date();
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate();
}

function useOnlineStatus() {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  return online;
}
