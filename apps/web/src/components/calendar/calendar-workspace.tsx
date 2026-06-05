"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import FullCalendar from "@fullcalendar/react";
import type { DatesSetArg, EventDropArg } from "@fullcalendar/core";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import listPlugin from "@fullcalendar/list";
import timeGridPlugin from "@fullcalendar/timegrid";
import frLocale from "@fullcalendar/core/locales/fr";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  addDays,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { fr } from "date-fns/locale";
import {
  AlertTriangle,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Plus,
  RefreshCw,
  SlidersHorizontal,
  Wifi,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { RoleGate } from "@/components/auth/role-gate";
import { useAuth } from "@/components/providers/auth-provider";
import { FilterBar, FilterField, PageStack } from "@/components/layout/page-section";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api";
import { enqueueOfflineMutation, isQueuedOfflineResult, shouldQueueOffline } from "@/lib/offline/outbox";
import type { QueuedOfflineResult } from "@/lib/offline/outbox";

type Mission = {
  id: string;
  title: string;
  missionType: "AUDIT" | "FORMATION" | "ASSISTANCE";
  missionMode: "ONLINE" | "PRESENTIELLE";
  startDateTime: string;
  endDateTime: string;
  location: string | null;
  version: number;
  client: { id: string; companyName: string; color: string | null };
  consultants: { id: string; fullName: string; role: "RESPONSABLE" | "PARTICIPANT" }[];
};
type ListResponse<T> = { data: T[] };
type FilterState = { clientId: string; consultantId: string; mode: string };
type CalendarRange = { from: Date; to: Date };
type MobileCalendarView = "day" | "month";

const MISSION_MODE_DETAILS = {
  ONLINE: {
    badgeClassName: "border-brand-200 bg-brand-50 text-brand-700",
    eventBackground: "hsl(var(--primary) / 0.08)",
    eventBorder: "hsl(var(--primary))",
    label: "En ligne",
  },
  PRESENTIELLE: {
    badgeClassName: "border-warning bg-warning/10 text-warning",
    eventBackground: "hsl(var(--warning) / 0.12)",
    eventBorder: "hsl(var(--warning))",
    label: "Présentielle",
  },
} as const;
const MISSION_TYPE_DETAILS = {
  ASSISTANCE: {
    className: "border-success/30 bg-success/10 text-success",
    label: "Assistance",
    shortLabel: "Assist.",
  },
  AUDIT: {
    className: "border-brand-200 bg-brand-50 text-brand-700",
    label: "Audit",
    shortLabel: "Audit",
  },
  FORMATION: {
    className: "border-abcNeutral-300 bg-abcNeutral-100 text-abcNeutral-800",
    label: "Formation",
    shortLabel: "Form.",
  },
} as const;

export function CalendarWorkspace() {
  const router = useRouter();
  const { canManageOperations } = useAuth();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [mobileView, setMobileView] = useState<MobileCalendarView>(() =>
    searchParams.get("view") === "day" ? "day" : "month",
  );
  const [calendarRange, setCalendarRange] = useState<CalendarRange>(() => {
    const from = startOfMonth(new Date());
    return { from, to: addDays(endOfMonth(from), 1) };
  });
  const [filters, setFilters] = useState<FilterState>({ clientId: "", consultantId: "", mode: "" });
  const [queuedMessage, setQueuedMessage] = useState<string | null>(null);
  const clients = useQuery({
    queryKey: ["clients", "calendar-options"],
    queryFn: () =>
      apiFetch<ListResponse<{ id: string; companyName: string }>>(
        "/clients?status=ACTIVE&page=1&perPage=100",
      ),
  });
  const consultants = useQuery({
    queryKey: ["consultants", "calendar-options"],
    queryFn: () =>
      apiFetch<ListResponse<{ id: string; fullName: string }>>(
        "/consultants?status=ACTIVE&page=1&perPage=100",
      ),
  });
  const missions = useQuery({
    queryKey: [
      "missions",
      "calendar",
      calendarRange.from.toISOString(),
      calendarRange.to.toISOString(),
    ],
    queryFn: () =>
      apiFetch<ListResponse<Mission>>(
        `/missions/calendar?${new URLSearchParams({ from: calendarRange.from.toISOString(), to: calendarRange.to.toISOString() })}`,
      ),
    placeholderData: (previousData) => previousData,
  });
  const visibleMissions = useMemo(
    () =>
      (missions.data?.data ?? []).filter(
        (mission) =>
          (!filters.clientId || mission.client.id === filters.clientId) &&
          (!filters.consultantId ||
            mission.consultants.some((consultant) => consultant.id === filters.consultantId)) &&
          (!filters.mode || mission.missionMode === filters.mode),
      ),
    [filters, missions.data?.data],
  );
  const reschedule = useMutation({
    mutationFn: ({ mission, start, end }: { mission: Mission; start: Date; end: Date }): Promise<Record<string, unknown> | QueuedOfflineResult> => {
      const payload = { version: mission.version, startDateTime: start, endDateTime: end };
      if (shouldQueueOffline()) {
        return enqueueOfflineMutation({
          baseVersion: mission.version,
          entityId: mission.id,
          entityType: "MISSION",
          operation: "UPDATE",
          payload,
        });
      }

      return apiFetch<Record<string, unknown>>(`/missions/${mission.id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
    },
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ["missions"] });
      if (isQueuedOfflineResult(result)) setQueuedMessage("Deplacement ajoute au centre de synchronisation.");
    },
  });
  const calendarEvents = visibleMissions.map((mission) => {
    const mode = MISSION_MODE_DETAILS[mission.missionMode];
    return {
      id: mission.id,
      title: mission.client.companyName,
      start: mission.startDateTime,
      end: mission.endDateTime,
      backgroundColor: mode.eventBackground,
      borderColor: mode.eventBorder,
      extendedProps: { mission },
    };
  });
  const mobileMissions = visibleMissions.filter((mission) => missionOccursOnDate(mission, selectedDate));

  const handleDrop = ({ event, revert }: EventDropArg) => {
    if (!canManageOperations) return revert();
    const mission = event.extendedProps.mission as Mission;
    if (!event.start || !event.end) return revert();
    reschedule.mutate({ mission, start: event.start, end: event.end }, { onError: revert });
  };
  const handleDatesSet = useCallback(({ start, end }: DatesSetArg) => {
    setCalendarRange((current) =>
      current.from.getTime() === start.getTime() && current.to.getTime() === end.getTime()
        ? current
        : { from: start, to: end },
    );
  }, []);
  const selectPlanningDate = (date: Date) => {
    setSelectedDate(date);
    syncMobileRange(date, mobileView);
  };
  const changeMobileView = (view: MobileCalendarView) => {
    setMobileView(view);
    syncMobileRange(selectedDate, view);
  };
  const syncMobileRange = (date: Date, view: MobileCalendarView) => {
    const next = getMobileRange(date, view);
    setCalendarRange((current) =>
      current.from.getTime() === next.from.getTime() && current.to.getTime() === next.to.getTime()
        ? current
        : next,
    );
  };

  return (
    <PageStack>
      <header className="flex flex-col gap-3 border-b pb-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Calendrier des missions</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Planifiez les interventions et affectez les consultants.
          </p>
        </div>
        <RoleGate allowedRoles={["ADMIN", "RESPONSABLE"]}>
          <Button asChild>
            <Link href="/missions/nouvelle">
              <Plus data-icon="inline-start" />
              Nouvelle mission
            </Link>
          </Button>
        </RoleGate>
      </header>
      <CalendarFilters
        clients={clients.data?.data ?? []}
        consultants={consultants.data?.data ?? []}
        filters={filters}
        onChange={setFilters}
      />
      {reschedule.isError ? (
        <p className="border-l-2 border-danger pl-3 text-sm text-danger" role="alert">
          Le déplacement n’a pas pu être enregistré. Le créneau initial a été restauré.
        </p>
      ) : null}
      {queuedMessage ? <p className="border-l-2 border-primary bg-white px-4 py-3 text-sm" role="status">{queuedMessage}</p> : null}
      {missions.isPending ? <Skeleton className="h-[42rem] border" /> : null}
      {missions.isError ? <CalendarError retry={() => void missions.refetch()} /> : null}
      {!missions.isPending && !missions.isError ? (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_16rem]">
          <div className="hidden min-w-0 overflow-hidden rounded-md border bg-white md:block">
            <FullCalendar
              allDaySlot={false}
              businessHours={{
                daysOfWeek: [1, 2, 3, 4, 5, 6],
                startTime: "07:00",
                endTime: "19:00",
              }}
              dayMaxEvents={3}
              eventMaxStack={4}
              datesSet={handleDatesSet}
              editable={canManageOperations}
              events={calendarEvents}
              eventClick={({ event }) => router.push(`/missions/${event.id}`)}
              eventContent={({ event, timeText, view }) => (
                <CalendarEvent
                  isMonthView={view.type === "dayGridMonth"}
                  mission={event.extendedProps.mission as Mission}
                  timeText={timeText}
                />
              )}
              eventDrop={handleDrop}
              eventTimeFormat={{ hour: "2-digit", minute: "2-digit", hour12: false }}
              eventMinHeight={34}
              firstDay={1}
              headerToolbar={{
                left: "prev,next today",
                center: "title",
                right: "timeGridWeek,dayGridMonth",
              }}
              height="auto"
              hiddenDays={[0]}
              initialView="dayGridMonth"
              locale={frLocale}
              moreLinkClick="popover"
              moreLinkContent={(args) => `+ ${args.num} autres`}
              nowIndicator
              plugins={[timeGridPlugin, dayGridPlugin, interactionPlugin, listPlugin]}
              slotMaxTime="19:00:00"
              slotMinTime="07:00:00"
              slotEventOverlap={false}
            />
          </div>
          <MobileCalendar
            allMissions={visibleMissions}
            missions={mobileMissions}
            selectedDate={selectedDate}
            setSelectedDate={selectPlanningDate}
            setView={changeMobileView}
            view={mobileView}
          />
          <OperationalRail />
        </div>
      ) : null}
    </PageStack>
  );
}

function CalendarFilters({
  clients,
  consultants,
  filters,
  onChange,
}: Readonly<{
  clients: { id: string; companyName: string }[];
  consultants: { id: string; fullName: string }[];
  filters: FilterState;
  onChange: (value: FilterState) => void;
}>) {
  return (
    <FilterBar className="md:grid-cols-3" aria-label="Filtres du calendrier">
      <FilterSelect
        label="Client"
        value={filters.clientId}
        onChange={(clientId) => onChange({ ...filters, clientId })}
      >
        <option value="">Tous les clients</option>
        {clients.map((client) => (
          <option value={client.id} key={client.id}>
            {client.companyName}
          </option>
        ))}
      </FilterSelect>
      <FilterSelect
        label="Consultant"
        value={filters.consultantId}
        onChange={(consultantId) => onChange({ ...filters, consultantId })}
      >
        <option value="">Tous les consultants</option>
        {consultants.map((consultant) => (
          <option value={consultant.id} key={consultant.id}>
            {consultant.fullName}
          </option>
        ))}
      </FilterSelect>
      <FilterSelect
        label="Mode"
        value={filters.mode}
        onChange={(mode) => onChange({ ...filters, mode })}
      >
        <option value="">Tous les modes</option>
        <option value="PRESENTIELLE">Présentielle</option>
        <option value="ONLINE">En ligne</option>
      </FilterSelect>
    </FilterBar>
  );
}

function FilterSelect({
  children,
  label,
  value,
  onChange,
}: Readonly<{
  children: React.ReactNode;
  label: string;
  value: string;
  onChange: (value: string) => void;
}>) {
  return (
    <FilterField className="relative">
      <span>{label}</span>
      <SlidersHorizontal
        className="pointer-events-none absolute left-3 top-9 size-4 text-muted-foreground"
        aria-hidden="true"
      />
      <select
        className="h-11 w-full rounded-md border bg-white pl-10 pr-3 text-sm font-medium normal-case tracking-normal shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        onChange={(event) => onChange(event.target.value)}
        value={value}
      >
        {children}
      </select>
    </FilterField>
  );
}

function MobileCalendar({
  allMissions,
  missions,
  selectedDate,
  setSelectedDate,
  setView,
  view,
}: Readonly<{
  allMissions: Mission[];
  missions: Mission[];
  selectedDate: Date;
  setSelectedDate: (date: Date) => void;
  setView: (view: MobileCalendarView) => void;
  view: MobileCalendarView;
}>) {
  const monthStart = startOfMonth(selectedDate);
  const monthGridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const monthGridEnd = endOfWeek(endOfMonth(selectedDate), { weekStartsOn: 1 });
  const monthDays = buildBusinessDays(monthGridStart, monthGridEnd);
  const title =
    view === "month"
      ? format(selectedDate, "MMMM yyyy", { locale: fr })
      : format(selectedDate, "EEEE d MMMM", { locale: fr });
  return (
    <section className="flex flex-col gap-3 md:hidden" aria-labelledby="mobile-agenda-title">
      <div
        className="grid grid-cols-2 gap-1 rounded-md border bg-white p-1"
        aria-label="Vue mobile du calendrier"
      >
        <MobileViewButton active={view === "day"} onClick={() => setView("day")}>
          Jour
        </MobileViewButton>
        <MobileViewButton active={view === "month"} onClick={() => setView("month")}>
          Mois
        </MobileViewButton>
      </div>
      <div className="flex items-center justify-between">
        <Button
          aria-label="Période précédente"
          onClick={() => setSelectedDate(moveMobileDate(selectedDate, view, -1))}
          size="sm"
          type="button"
          variant="outline"
        >
          <ChevronLeft aria-hidden="true" />
        </Button>
        <h2 className="text-sm font-semibold capitalize" id="mobile-agenda-title">
          {title}
        </h2>
        <Button
          aria-label="Période suivante"
          onClick={() => setSelectedDate(moveMobileDate(selectedDate, view, 1))}
          size="sm"
          type="button"
          variant="outline"
        >
          <ChevronRight aria-hidden="true" />
        </Button>
      </div>
      {view === "month" ? (
        <MobileMonthGrid
          allMissions={allMissions}
          days={monthDays}
          selectedDate={selectedDate}
          setSelectedDate={setSelectedDate}
        />
      ) : (
        <MobileDayContext selectedDate={selectedDate} setSelectedDate={setSelectedDate} />
      )}
      <MissionModeLegend />
      {missions.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-md border border-dashed px-4 py-10 text-center">
          <CalendarClock className="size-6 text-muted-foreground" aria-hidden="true" />
          <p className="text-sm font-medium">Aucune mission planifiée</p>
          <p className="text-xs text-muted-foreground">
            Choisissez une autre date ou créez une mission.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {missions.map((mission) => (
            <MobileMissionRow key={mission.id} mission={mission} />
          ))}
        </div>
      )}
    </section>
  );
}

function MobileViewButton({
  active,
  children,
  onClick,
}: Readonly<{ active: boolean; children: React.ReactNode; onClick: () => void }>) {
  return (
    <button
      aria-pressed={active}
      className={`min-h-10 rounded px-2 text-xs font-medium ${active ? "bg-brand-50 text-brand-700" : "text-muted-foreground"}`}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );
}

function MobileDayContext({
  selectedDate,
  setSelectedDate,
}: Readonly<{ selectedDate: Date; setSelectedDate: (date: Date) => void }>) {
  return (
    <div className="grid grid-cols-3 gap-1">
      {[-1, 0, 1].map((offset) => {
        const date = addDays(selectedDate, offset);
        const active = offset === 0;
        return (
          <button
            className={`min-h-11 rounded-md border px-1 py-1 text-xs ${active ? "border-brand-500 bg-brand-50 text-brand-700" : "bg-white text-muted-foreground"}`}
            key={offset}
            onClick={() => setSelectedDate(date)}
            type="button"
          >
            <span className="block uppercase">{format(date, "EEE", { locale: fr })}</span>
            <span className="mt-1 block font-semibold">{format(date, "d")}</span>
          </button>
        );
      })}
    </div>
  );
}

function MobileMonthGrid({
  allMissions,
  days,
  selectedDate,
  setSelectedDate,
}: Readonly<{
  allMissions: Mission[];
  days: Date[];
  selectedDate: Date;
  setSelectedDate: (date: Date) => void;
}>) {
  return (
    <div className="rounded-md border bg-white p-2">
      <div className="grid grid-cols-6 gap-1 pb-2 text-center text-[0.65rem] font-semibold uppercase text-muted-foreground">
        {["lun", "mar", "mer", "jeu", "ven", "sam"].map((day) => (
          <span key={day}>{day}</span>
        ))}
      </div>
      <div className="grid grid-cols-6 gap-1">
        {days.map((date) => {
          const dayMissions = allMissions.filter((mission) => missionOccursOnDate(mission, date));
          const active = isSameDay(date, selectedDate);
          const inMonth = isSameMonth(date, selectedDate);
          return (
            <button
              aria-label={`${format(date, "d MMMM", { locale: fr })}, ${formatDayMissionSummary(dayMissions)}`}
              className={`min-h-14 rounded-md border px-1 py-1 text-left text-xs ${active ? "border-brand-500 bg-brand-50 text-brand-700" : "border-transparent"} ${inMonth ? "bg-white" : "bg-muted text-muted-foreground"}`}
              key={date.toISOString()}
              onClick={() => setSelectedDate(date)}
              type="button"
            >
              <span className="font-semibold">{format(date, "d")}</span>
              {dayMissions.length > 0 ? (
                <span className="mt-1 flex flex-col gap-0.5">
                  {dayMissions.slice(0, 2).map((mission) => (
                    <span
                      className={`truncate rounded border px-1 py-0.5 text-[0.56rem] leading-none ${MISSION_TYPE_DETAILS[mission.missionType].className}`}
                      key={mission.id}
                    >
                      {MISSION_TYPE_DETAILS[mission.missionType].shortLabel}
                    </span>
                  ))}
                  {dayMissions.length > 2 ? <span className="text-[0.56rem] text-muted-foreground">+{dayMissions.length - 2}</span> : null}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function MissionModeLegend() {
  return (
    <div className="flex flex-wrap gap-2 text-xs" aria-label="Légende des modes de mission">
      <span
        className={`rounded border px-2 py-1 ${MISSION_MODE_DETAILS.PRESENTIELLE.badgeClassName}`}
      >
        Présentielle
      </span>
      <span className={`rounded border px-2 py-1 ${MISSION_MODE_DETAILS.ONLINE.badgeClassName}`}>
        En ligne
      </span>
    </div>
  );
}

function CalendarEvent({
  isMonthView,
  mission,
  timeText,
}: Readonly<{ isMonthView: boolean; mission: Mission; timeText: string }>) {
  const mode = MISSION_MODE_DETAILS[mission.missionMode];
  const type = MISSION_TYPE_DETAILS[mission.missionType];
  if (isMonthView) {
    return (
      <div
        aria-label={`${timeText}, ${mission.client.companyName}, ${type.label}, ${mode.label}`}
        className="flex min-w-0 items-center gap-1 border-l-2 px-1 py-0.5 text-[0.68rem] leading-tight"
        style={mission.client.color ? { borderLeftColor: mission.client.color } : undefined}
      >
        <span className="shrink-0 font-semibold">{timeText}</span>
        <span className={`shrink-0 rounded border px-1 text-[0.6rem] ${type.className}`}>{type.shortLabel}</span>
        <span className="min-w-0 truncate font-medium">{mission.client.companyName}</span>
      </div>
    );
  }

  return (
    <div
      aria-label={`${timeText}, ${mission.client.companyName}, ${type.label}, ${mode.label}`}
      className="flex h-full min-w-0 flex-col justify-start overflow-hidden border-l-4 px-1 py-0.5 text-[0.68rem] leading-tight"
      style={mission.client.color ? { borderLeftColor: mission.client.color } : undefined}
    >
      <p className="truncate font-semibold">
        <span>{timeText}</span>
        <span className="font-medium"> · {mission.client.companyName}</span>
      </p>
      <p className="truncate text-abcNeutral-700">
        {type.shortLabel} · {mode.label}
        {mission.title ? ` · ${mission.title}` : ""}
      </p>
    </div>
  );
}

function MobileMissionRow({ mission }: Readonly<{ mission: Mission }>) {
  const mode = MISSION_MODE_DETAILS[mission.missionMode];
  const type = MISSION_TYPE_DETAILS[mission.missionType];
  return (
    <Link
      className="border-l-4 border-brand-500 px-3 py-3 text-sm shadow-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      href={`/missions/${mission.id}`}
      style={{
        backgroundColor: mode.eventBackground,
        borderLeftColor: mission.client.color ?? mode.eventBorder,
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground">
          {formatMissionWindow(mission)}
        </p>
        <span className="flex shrink-0 flex-col items-end gap-1">
          <span className={`rounded border px-2 py-0.5 text-xs font-medium ${type.className}`}>
            {type.label}
          </span>
          <span className={`rounded border px-2 py-0.5 text-xs font-medium ${mode.badgeClassName}`}>
            {mode.label}
          </span>
        </span>
      </div>
      <p className="mt-1 font-semibold">{mission.client.companyName}</p>
      <p className="mt-1 text-xs text-muted-foreground">
        {type.label} · {mission.title} ·{" "}
        {mission.consultants.map((consultant) => consultant.fullName).join(", ")}
      </p>
      <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
        {mission.missionMode === "ONLINE" ? (
          <Wifi className="size-3.5" aria-hidden="true" />
        ) : (
          <MapPin className="size-3.5" aria-hidden="true" />
        )}
        {mission.missionMode === "ONLINE"
          ? "Lien ou salle en ligne"
          : mission.location || "Lieu à confirmer"}
      </p>
    </Link>
  );
}

function OperationalRail() {
  return (
    <aside className="hidden flex-col gap-4 xl:flex" aria-label="Actions operationnelles">
      <div className="rounded-md border bg-white px-3 py-3">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <RefreshCw className="size-4 text-brand-700" aria-hidden="true" />
          Synchronisation
        </p>
        <p className="mt-2 text-xs leading-5 text-muted-foreground">
          Consultez les modifications en attente et resolvez les conflits hors ligne.
        </p>
        <Link
          className="mt-3 inline-block text-xs font-medium text-brand-700 hover:underline"
          href="/sync"
        >
          Ouvrir le centre de synchronisation
        </Link>
      </div>
    </aside>
  );
}
function CalendarError({ retry }: Readonly<{ retry: () => void }>) {
  return (
    <div className="flex flex-col items-start gap-3 border-l-2 border-danger pl-4" role="alert">
      <p className="flex items-center gap-2 text-sm font-medium">
        <AlertTriangle className="size-4" aria-hidden="true" />
        Impossible de charger le planning
      </p>
      <Button onClick={retry} size="sm" type="button" variant="outline">
        <RefreshCw data-icon="inline-start" />
        Réessayer
      </Button>
    </div>
  );
}

function missionOccursOnDate(mission: Mission, date: Date) {
  const day = startOfDay(date).getTime();
  const start = startOfDay(new Date(mission.startDateTime)).getTime();
  const end = startOfDay(new Date(mission.endDateTime)).getTime();
  return day >= start && day <= end;
}

function formatMissionWindow(mission: Mission) {
  const start = new Date(mission.startDateTime);
  const end = new Date(mission.endDateTime);
  if (isSameDay(start, end)) return `${format(start, "HH:mm")} - ${format(end, "HH:mm")}`;
  return `${format(start, "d MMM HH:mm", { locale: fr })} - ${format(end, "d MMM HH:mm", { locale: fr })}`;
}

function formatDayMissionSummary(missions: Mission[]) {
  if (missions.length === 0) return "aucune mission";
  return missions
    .map((mission) => `${MISSION_TYPE_DETAILS[mission.missionType].label}: ${mission.client.companyName}`)
    .join(", ");
}

function getMobileRange(date: Date, view: MobileCalendarView): CalendarRange {
  if (view === "month") {
    const from = startOfMonth(date);
    return { from, to: addDays(endOfMonth(date), 1) };
  }
  const from = startOfDay(date);
  return { from, to: addDays(from, 1) };
}

function moveMobileDate(date: Date, view: MobileCalendarView, direction: -1 | 1) {
  if (view === "month") return new Date(date.getFullYear(), date.getMonth() + direction, 1);
  return addDays(date, direction);
}

function buildBusinessDays(from: Date, to: Date) {
  const days: Date[] = [];
  for (let date = from; date <= to; date = addDays(date, 1)) {
    if (date.getDay() !== 0) days.push(date);
  }
  return days;
}


