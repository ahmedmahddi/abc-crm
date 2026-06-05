"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Archive, ArrowDown, ArrowUp, Building2, Download, Edit, Eye, RotateCcw, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FilterBar, FilterField, PagePanel, RecordList, SectionHeader } from "@/components/layout/page-section";
import { Skeleton } from "@/components/ui/skeleton";
import { API_URL, apiFetch, ApiError } from "@/lib/api";

type ClientStatus = "ACTIVE" | "ARCHIVED";
type StatusFilter = ClientStatus | "ALL";
type SortBy = "activitySector" | "companyName" | "createdAt" | "fiscalNumber" | "status";
type SortDir = "asc" | "desc";
type PageSize = 20 | 50 | 100;

type ClientSummary = {
  id: string;
  companyName: string;
  fiscalNumber: string;
  activitySector: string;
  zone: string | null;
  status: ClientStatus;
  totalEmployees: number;
  responsibleConsultants: Array<{ id: string; fullName: string }>;
};

type ClientListResponse = {
  data: ClientSummary[];
  meta: { page: number; perPage: number; total: number; totalPages: number };
};

const pageSizes: PageSize[] = [20, 50, 100];
const sortableColumns: Array<{ label: string; value: SortBy }> = [
  { label: "Entreprise", value: "companyName" },
  { label: "Matricule fiscal", value: "fiscalNumber" },
  { label: "Secteur", value: "activitySector" },
  { label: "Statut", value: "status" },
];

export function ClientList() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("ACTIVE");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState<PageSize>(20);
  const [sortBy, setSortBy] = useState<SortBy>("companyName");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const deferredSearch = useDeferredValue(search.trim());
  const isOnline = useOnlineStatus();
  const query = useQuery({
    queryKey: ["clients", deferredSearch, status, page, perPage, sortBy, sortDir],
    queryFn: () =>
      apiFetch<ClientListResponse>(
        `/clients?${new URLSearchParams({
          q: deferredSearch,
          status,
          page: String(page),
          perPage: String(perPage),
          sortBy,
          sortDir,
        })}`,
      ),
  });
  const archiveMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/clients/${id}/archive`, { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["clients"] }),
  });
  const restoreMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/clients/${id}/restore`, { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["clients"] }),
  });

  const clients = query.data?.data ?? [];
  const meta = query.data?.meta;
  const selectedClients = useMemo(
    () => clients.filter((client) => selectedIds.has(client.id)),
    [clients, selectedIds],
  );
  const allVisibleSelected = clients.length > 0 && clients.every((client) => selectedIds.has(client.id));
  const actionError = archiveMutation.error ?? restoreMutation.error;
  const isMutating = archiveMutation.isPending || restoreMutation.isPending;

  useEffect(() => {
    setSelectedIds((current) => new Set([...current].filter((id) => clients.some((client) => client.id === id))));
  }, [clients]);

  const updateSort = (nextSortBy: SortBy) => {
    setPage(1);
    if (sortBy === nextSortBy) {
      setSortDir((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSortBy(nextSortBy);
    setSortDir("asc");
  };

  const toggleAllVisible = () => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (allVisibleSelected) clients.forEach((client) => next.delete(client.id));
      else clients.forEach((client) => next.add(client.id));
      return next;
    });
  };

  const toggleClient = (id: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const runBulkAction = async (targetStatus: ClientStatus) => {
    const mutation = targetStatus === "ARCHIVED" ? archiveMutation : restoreMutation;
    for (const client of selectedClients) {
      if (client.status !== targetStatus) await mutation.mutateAsync(client.id);
    }
    setSelectedIds(new Set());
  };

  return (
    <PagePanel as="section" className="flex flex-col gap-4" aria-labelledby="client-list-title">
      <SectionHeader
        actions={
          <Button
            disabled={isExporting || !isOnline}
            onClick={() =>
              void exportClients({ q: deferredSearch, sortBy, sortDir, status }, setIsExporting, setExportError)
            }
            size="sm"
            type="button"
            variant="outline"
          >
            <Download data-icon="inline-start" />
            {isExporting ? "Export..." : "Exporter CSV"}
          </Button>
        }
        count={meta ? `${meta.total} client${meta.total > 1 ? "s" : ""}` : undefined}
        description="Retrouvez les identites legales, secteurs, effectifs et responsables de compte."
        id="client-list-title"
        title="Repertoire clients"
      />

      <FilterBar className="lg:grid-cols-[minmax(0,1fr)_14rem_10rem_12rem]">
        <FilterField className="relative">
          <span>Recherche</span>
          <Search className="pointer-events-none absolute left-3 top-9 size-4 text-muted-foreground" aria-hidden="true" />
          <Input
            className="pl-10"
            onChange={(event) => {
              setPage(1);
              setSearch(event.target.value);
            }}
            placeholder="Entreprise, matricule fiscal ou secteur"
            type="search"
            value={search}
          />
        </FilterField>
        <FilterSelect
          label="Etat du dossier"
          onChange={(value) => {
            setPage(1);
            setSelectedIds(new Set());
            setStatus(value as StatusFilter);
          }}
          value={status}
        >
          <option value="ACTIVE">Clients actifs</option>
          <option value="ARCHIVED">Archives</option>
          <option value="ALL">Tous les dossiers</option>
        </FilterSelect>
        <FilterSelect
          label="Par page"
          onChange={(value) => {
            setPage(1);
            setSelectedIds(new Set());
            setPerPage(Number(value) as PageSize);
          }}
          value={String(perPage)}
        >
          {pageSizes.map((size) => (
            <option key={size} value={size}>
              {size} lignes
            </option>
          ))}
        </FilterSelect>
        <FilterSelect
          label="Tri mobile"
          onChange={(value) => {
            setPage(1);
            setSortBy(value as SortBy);
          }}
          value={sortBy}
        >
          {sortableColumns.map((column) => (
            <option key={column.value} value={column.value}>
              {column.label}
            </option>
          ))}
        </FilterSelect>
      </FilterBar>

      {!isOnline ? (
        <p className="rounded-md border border-warning/30 bg-white px-3 py-2 text-sm text-muted-foreground" role="status">
          Mode hors ligne : les donnees deja chargees restent consultables. Les actions d'ecriture sont desactivees.
        </p>
      ) : null}
      {exportError ? <p className="border-l-2 border-danger pl-3 text-sm text-danger" role="alert">{exportError}</p> : null}
      {actionError ? (
        <p className="border-l-2 border-danger pl-3 text-sm text-danger" role="alert">
          {actionError instanceof ApiError ? actionError.message : "Impossible d'appliquer l'action demandee."}
        </p>
      ) : null}
      {selectedClients.length > 0 ? (
        <BulkActionBar
          count={selectedClients.length}
          disabled={isMutating || !isOnline}
          onArchive={() => void runBulkAction("ARCHIVED")}
          onClear={() => setSelectedIds(new Set())}
          onRestore={() => void runBulkAction("ACTIVE")}
        />
      ) : null}
      {query.isPending ? <ClientListLoading /> : null}
      {query.isError ? <ClientListError isOnline={isOnline} retry={() => void query.refetch()} /> : null}
      {!query.isPending && !query.isError && clients.length === 0 ? <ClientListEmpty /> : null}
      {clients.length > 0 ? (
        <>
          <RecordList className="md:hidden">
            {clients.map((client) => (
              <ClientMobileRow
                client={client}
                disabled={isMutating || !isOnline}
                isSelected={selectedIds.has(client.id)}
                key={client.id}
                onArchive={() => archiveMutation.mutate(client.id)}
                onRestore={() => restoreMutation.mutate(client.id)}
                onToggle={() => toggleClient(client.id)}
              />
            ))}
          </RecordList>
          <ClientDesktopTable
            allVisibleSelected={allVisibleSelected}
            clients={clients}
            disabled={isMutating || !isOnline}
            selectedIds={selectedIds}
            sortBy={sortBy}
            sortDir={sortDir}
            onArchive={(id) => archiveMutation.mutate(id)}
            onRestore={(id) => restoreMutation.mutate(id)}
            onSort={updateSort}
            onToggleAll={toggleAllVisible}
            onToggleClient={toggleClient}
          />
        </>
      ) : null}

      {meta ? (
        <ClientPagination
          meta={meta}
          page={page}
          setPage={(nextPage) => {
            setPage(nextPage);
            setSelectedIds(new Set());
          }}
        />
      ) : null}
    </PagePanel>
  );
}

function ClientMobileRow({
  client,
  disabled,
  isSelected,
  onArchive,
  onRestore,
  onToggle,
}: Readonly<{
  client: ClientSummary;
  disabled: boolean;
  isSelected: boolean;
  onArchive: () => void;
  onRestore: () => void;
  onToggle: () => void;
}>) {
  return (
    <article className="flex flex-col gap-3 rounded-md border bg-white p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <input
          aria-label={`Selectionner ${client.companyName}`}
          checked={isSelected}
          className="mt-1 size-5 accent-brand-700"
          onChange={onToggle}
          type="checkbox"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="truncate text-sm font-semibold">{client.companyName}</h3>
              <p className="mt-1 text-xs text-muted-foreground">{client.fiscalNumber}</p>
            </div>
            {client.status === "ARCHIVED" ? <Badge>Archive</Badge> : null}
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-3 text-xs">
            <div><dt className="text-muted-foreground">Secteur</dt><dd className="mt-0.5 font-medium">{client.activitySector}</dd></div>
            <div><dt className="text-muted-foreground">Effectif</dt><dd className="mt-0.5 font-medium">{client.totalEmployees}</dd></div>
            <div className="col-span-2"><dt className="text-muted-foreground">Responsables</dt><dd className="mt-0.5 font-medium">{formatConsultants(client.responsibleConsultants)}</dd></div>
          </dl>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <Button asChild size="sm" variant="outline">
          <Link href={`/clients/${client.id}`}><Eye aria-hidden="true" />Ouvrir</Link>
        </Button>
        <Button asChild size="sm" variant="outline">
          <Link href={`/clients/${client.id}/modifier`}><Edit aria-hidden="true" />Modifier</Link>
        </Button>
        {client.status === "ARCHIVED" ? (
          <Button disabled={disabled} onClick={onRestore} size="sm" type="button">
            <RotateCcw aria-hidden="true" />Restaurer
          </Button>
        ) : (
          <Button disabled={disabled} onClick={onArchive} size="sm" type="button" variant="danger">
            <Archive aria-hidden="true" />Archiver
          </Button>
        )}
      </div>
    </article>
  );
}

function ClientDesktopTable({
  allVisibleSelected,
  clients,
  disabled,
  selectedIds,
  sortBy,
  sortDir,
  onArchive,
  onRestore,
  onSort,
  onToggleAll,
  onToggleClient,
}: Readonly<{
  allVisibleSelected: boolean;
  clients: ClientSummary[];
  disabled: boolean;
  selectedIds: Set<string>;
  sortBy: SortBy;
  sortDir: SortDir;
  onArchive: (id: string) => void;
  onRestore: (id: string) => void;
  onSort: (sortBy: SortBy) => void;
  onToggleAll: () => void;
  onToggleClient: (id: string) => void;
}>) {
  return (
    <div className="hidden overflow-x-auto rounded-md border bg-white md:block">
      <table className="w-full text-left text-sm">
        <thead className="border-b bg-muted/60 text-xs text-muted-foreground">
          <tr>
            <th className="w-10 px-4 py-3" scope="col">
              <input
                aria-label="Selectionner les clients visibles"
                checked={allVisibleSelected}
                className="size-4 accent-brand-700"
                onChange={onToggleAll}
                type="checkbox"
              />
            </th>
            <SortableHeader activeSort={sortBy} label="Entreprise" sortDir={sortDir} value="companyName" onSort={onSort} />
            <SortableHeader activeSort={sortBy} label="Matricule fiscal" sortDir={sortDir} value="fiscalNumber" onSort={onSort} />
            <SortableHeader activeSort={sortBy} label="Secteur" sortDir={sortDir} value="activitySector" onSort={onSort} />
            <th className="px-4 py-3 font-semibold" scope="col">Effectif</th>
            <th className="px-4 py-3 font-semibold" scope="col">Responsables</th>
            <SortableHeader activeSort={sortBy} label="Statut" sortDir={sortDir} value="status" onSort={onSort} />
            <th className="px-4 py-3 text-right font-semibold" scope="col">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {clients.map((client) => (
            <tr className="bg-white transition-colors hover:bg-brand-50/50" key={client.id}>
              <td className="px-4 py-3">
                <input
                  aria-label={`Selectionner ${client.companyName}`}
                  checked={selectedIds.has(client.id)}
                  className="size-4 accent-brand-700"
                  onChange={() => onToggleClient(client.id)}
                  type="checkbox"
                />
              </td>
              <td className="px-4 py-3 font-medium">
                <Link className="hover:text-brand-700 hover:underline" href={`/clients/${client.id}`}>{client.companyName}</Link>
              </td>
              <td className="px-4 py-3 text-muted-foreground">{client.fiscalNumber}</td>
              <td className="px-4 py-3">{client.activitySector}</td>
              <td className="px-4 py-3">{client.totalEmployees}</td>
              <td className="px-4 py-3">{formatConsultants(client.responsibleConsultants)}</td>
              <td className="px-4 py-3">{client.status === "ARCHIVED" ? <Badge>Archive</Badge> : <Badge>Actif</Badge>}</td>
              <td className="px-4 py-3">
                <div className="flex justify-end gap-2">
                  <Button asChild size="sm" variant="outline"><Link href={`/clients/${client.id}`}>Ouvrir</Link></Button>
                  <Button asChild size="sm" variant="outline"><Link href={`/clients/${client.id}/modifier`}>Modifier</Link></Button>
                  {client.status === "ARCHIVED" ? (
                    <Button disabled={disabled} onClick={() => onRestore(client.id)} size="sm" type="button">Restaurer</Button>
                  ) : (
                    <Button disabled={disabled} onClick={() => onArchive(client.id)} size="sm" type="button" variant="danger">Archiver</Button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SortableHeader({
  activeSort,
  label,
  sortDir,
  value,
  onSort,
}: Readonly<{ activeSort: SortBy; label: string; sortDir: SortDir; value: SortBy; onSort: (sortBy: SortBy) => void }>) {
  const active = activeSort === value;
  return (
    <th className="px-4 py-3 font-semibold" scope="col" aria-sort={active ? (sortDir === "asc" ? "ascending" : "descending") : "none"}>
      <button
        className="inline-flex min-h-10 items-center gap-1 rounded-sm text-left hover:text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        onClick={() => onSort(value)}
        type="button"
      >
        {label}
        {active ? (
          sortDir === "asc" ? <ArrowUp className="size-3" aria-hidden="true" /> : <ArrowDown className="size-3" aria-hidden="true" />
        ) : null}
      </button>
    </th>
  );
}

function BulkActionBar({
  count,
  disabled,
  onArchive,
  onClear,
  onRestore,
}: Readonly<{ count: number; disabled: boolean; onArchive: () => void; onClear: () => void; onRestore: () => void }>) {
  return (
    <div className="flex flex-col gap-3 rounded-md border border-brand-200 bg-brand-50 px-3 py-3 sm:flex-row sm:items-center sm:justify-between" role="status">
      <p className="text-sm font-semibold text-brand-700">{count} client{count > 1 ? "s" : ""} selectionne{count > 1 ? "s" : ""}</p>
      <div className="flex flex-wrap gap-2">
        <Button disabled={disabled} onClick={onArchive} size="sm" type="button" variant="danger">
          <Archive data-icon="inline-start" />Archiver
        </Button>
        <Button disabled={disabled} onClick={onRestore} size="sm" type="button">
          <RotateCcw data-icon="inline-start" />Restaurer
        </Button>
        <Button onClick={onClear} size="sm" type="button" variant="outline">Annuler la selection</Button>
      </div>
    </div>
  );
}

function ClientPagination({
  meta,
  page,
  setPage,
}: Readonly<{ meta: ClientListResponse["meta"]; page: number; setPage: (page: number) => void }>) {
  const firstRecord = meta.total === 0 ? 0 : (meta.page - 1) * meta.perPage + 1;
  const lastRecord = Math.min(meta.page * meta.perPage, meta.total);
  return (
    <nav className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between" aria-label="Pagination des clients">
      <p className="text-xs text-muted-foreground">
        {firstRecord}-{lastRecord} sur {meta.total} dossiers · page {meta.page} sur {Math.max(meta.totalPages, 1)}
      </p>
      <div className="flex gap-2">
        <Button disabled={page <= 1} onClick={() => setPage(page - 1)} type="button" variant="outline">Precedent</Button>
        <Button disabled={page >= meta.totalPages} onClick={() => setPage(page + 1)} type="button" variant="outline">Suivant</Button>
      </div>
    </nav>
  );
}

function FilterSelect({
  children,
  label,
  onChange,
  value,
}: Readonly<{ children: React.ReactNode; label: string; onChange: (value: string) => void; value: string }>) {
  return (
    <FilterField>
      {label}
      <select
        className="h-11 rounded-md border bg-white px-3 text-sm font-medium normal-case tracking-normal text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        onChange={(event) => onChange(event.target.value)}
        value={value}
      >
        {children}
      </select>
    </FilterField>
  );
}

function ClientListLoading() {
  return <div className="flex flex-col gap-2" aria-label="Chargement des clients" role="status">{[0, 1, 2].map((index) => <Skeleton className="h-28 border" key={index} />)}</div>;
}

function ClientListEmpty() {
  return (
    <div className="flex flex-col items-center gap-2 rounded-md border border-dashed px-4 py-10 text-center">
      <Building2 className="size-5 text-muted-foreground" aria-hidden="true" />
      <p className="text-sm font-medium">Aucun client a afficher</p>
      <p className="max-w-sm text-xs leading-5 text-muted-foreground">Modifiez la recherche ou l'etat du dossier. Les nouveaux clients apparaitront ici apres leur creation.</p>
      <Button asChild size="sm"><Link href="/clients/nouveau">Ajouter un client</Link></Button>
    </div>
  );
}

function ClientListError({ isOnline, retry }: Readonly<{ isOnline: boolean; retry: () => void }>) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-md border border-danger/30 bg-white px-4 py-3" role="alert">
      <div>
        <p className="text-sm font-medium">Impossible de charger les clients</p>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">{isOnline ? "Verifiez votre session puis reessayez." : "Reconnectez-vous pour recuperer les dossiers non disponibles localement."}</p>
      </div>
      {isOnline ? <Button onClick={retry} size="sm" type="button" variant="outline">Reessayer</Button> : null}
    </div>
  );
}

function formatConsultants(consultants: ClientSummary["responsibleConsultants"]) {
  return consultants.length > 0 ? consultants.map(({ fullName }) => fullName).join(", ") : "Non attribue";
}

async function exportClients(
  filters: { q: string; sortBy: SortBy; sortDir: SortDir; status: StatusFilter },
  setIsExporting: (value: boolean) => void,
  setExportError: (value: string | null) => void,
) {
  setIsExporting(true);
  setExportError(null);
  try {
    const params = new URLSearchParams({
      q: filters.q,
      sortBy: filters.sortBy,
      sortDir: filters.sortDir,
      status: filters.status,
      page: "1",
      perPage: "100",
    });
    const response = await fetch(`${API_URL}/clients/export.csv?${params}`, {
      credentials: "include",
    });
    if (!response.ok) throw new Error("Export impossible");
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `clients-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  } catch {
    setExportError("Impossible d'exporter les clients pour le moment.");
  } finally {
    setIsExporting(false);
  }
}

function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(true);
  useEffect(() => {
    const updateStatus = () => setIsOnline(navigator.onLine);
    updateStatus();
    window.addEventListener("online", updateStatus);
    window.addEventListener("offline", updateStatus);
    return () => {
      window.removeEventListener("online", updateStatus);
      window.removeEventListener("offline", updateStatus);
    };
  }, []);
  return isOnline;
}
