"use client";

import { useDeferredValue, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AUDIT_EXTERNE_REFERENCE_LABELS, AUDIT_EXTERNE_TYPE_LABELS, type AuditExterneReference, type AuditExterneType } from "@abc/shared";
import { Archive, ArrowDown, ArrowUp, Download, Edit, Eye, FileCheck2, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FilterBar, FilterField, PagePanel, RecordList, SectionHeader } from "@/components/layout/page-section";
import { RoleGate } from "@/components/auth/role-gate";
import { useAuth } from "@/components/providers/auth-provider";
import { Skeleton } from "@/components/ui/skeleton";
import { API_URL, apiFetch, ApiError } from "@/lib/api";

type SortBy = "startDateTime" | "companyName" | "typeAudit";
type SortDir = "asc" | "desc";
type PageSize = 20 | 50 | 100;

type AuditExterneSummary = {
  id: string;
  typeAudit: AuditExterneType;
  reference: AuditExterneReference;
  organisme: string;
  auditeur: string;
  startDateTime: string;
  status: "PLANNED" | "DONE" | "CANCELLED";
  client: { id: string; companyName: string };
  responsable: { id: string; name: string };
};

type AuditExterneListResponse = {
  data: AuditExterneSummary[];
  meta: { page: number; perPage: number; total: number; totalPages: number };
};

const pageSizes: PageSize[] = [20, 50, 100];
const sortableColumns: Array<{ label: string; value: SortBy }> = [
  { label: "Date d'audit", value: "startDateTime" },
  { label: "Client", value: "companyName" },
  { label: "Type", value: "typeAudit" },
];

export function AuditExterneList() {
  const queryClient = useQueryClient();
  const { canManageOperations } = useAuth();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState<PageSize>(20);
  const [sortBy, setSortBy] = useState<SortBy>("startDateTime");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const deferredSearch = useDeferredValue(search.trim());

  const query = useQuery({
    queryKey: ["audit-externe", deferredSearch, page, perPage, sortBy, sortDir],
    queryFn: () =>
      apiFetch<AuditExterneListResponse>(
        `/audit-externe?${new URLSearchParams({
          q: deferredSearch,
          page: String(page),
          perPage: String(perPage),
          sortBy,
          sortDir,
        })}`,
      ),
  });
  const archiveMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/audit-externe/${id}/archive`, { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["audit-externe"] }),
  });

  const records = query.data?.data ?? [];
  const meta = query.data?.meta;

  const updateSort = (nextSortBy: SortBy) => {
    setPage(1);
    if (sortBy === nextSortBy) {
      setSortDir((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSortBy(nextSortBy);
    setSortDir("asc");
  };

  return (
    <PagePanel as="section" className="flex flex-col gap-4" aria-labelledby="audit-externe-list-title">
      <SectionHeader
        actions={
          <Button
            disabled={isExporting}
            onClick={() => void exportAuditExterne({ q: deferredSearch, sortBy, sortDir }, setIsExporting, setExportError)}
            size="sm"
            type="button"
            variant="outline"
          >
            <Download data-icon="inline-start" />
            {isExporting ? "Export..." : "Exporter CSV"}
          </Button>
        }
        count={meta ? `${meta.total} audit${meta.total > 1 ? "s" : ""}` : undefined}
        description="Suivi des audits de certification et de suivi planifies ou realises."
        id="audit-externe-list-title"
        title="Audits externes"
      />

      <FilterBar className="lg:grid-cols-[minmax(0,1fr)_10rem_12rem]">
        <FilterField className="relative">
          <span>Recherche</span>
          <Search className="pointer-events-none absolute left-3 top-9 size-4 text-muted-foreground" aria-hidden="true" />
          <Input
            className="pl-10"
            onChange={(event) => {
              setPage(1);
              setSearch(event.target.value);
            }}
            placeholder="Client, organisme ou auditeur"
            type="search"
            value={search}
          />
        </FilterField>
        <FilterField>
          Par page
          <select
            className="h-11 rounded-md border bg-white px-3 text-sm font-medium normal-case tracking-normal text-foreground"
            onChange={(event) => {
              setPage(1);
              setPerPage(Number(event.target.value) as PageSize);
            }}
            value={String(perPage)}
          >
            {pageSizes.map((size) => (
              <option key={size} value={size}>
                {size} lignes
              </option>
            ))}
          </select>
        </FilterField>
        <FilterField>
          Tri mobile
          <select
            className="h-11 rounded-md border bg-white px-3 text-sm font-medium normal-case tracking-normal text-foreground"
            onChange={(event) => {
              setPage(1);
              setSortBy(event.target.value as SortBy);
            }}
            value={sortBy}
          >
            {sortableColumns.map((column) => (
              <option key={column.value} value={column.value}>
                {column.label}
              </option>
            ))}
          </select>
        </FilterField>
      </FilterBar>

      {exportError ? <p className="border-l-2 border-danger pl-3 text-sm text-danger" role="alert">{exportError}</p> : null}
      {archiveMutation.error ? (
        <p className="border-l-2 border-danger pl-3 text-sm text-danger" role="alert">
          {archiveMutation.error instanceof ApiError ? archiveMutation.error.message : "Impossible d'archiver cet audit."}
        </p>
      ) : null}
      {query.isPending ? (
        <div className="flex flex-col gap-2" aria-label="Chargement des audits" role="status">
          {[0, 1, 2].map((index) => (
            <Skeleton className="h-24 border" key={index} />
          ))}
        </div>
      ) : null}
      {query.isError ? (
        <div className="flex flex-col items-start gap-3 rounded-md border border-danger/30 bg-white px-4 py-3" role="alert">
          <p className="text-sm font-medium">Impossible de charger les audits externes</p>
          <Button onClick={() => void query.refetch()} size="sm" type="button" variant="outline">
            Reessayer
          </Button>
        </div>
      ) : null}
      {!query.isPending && !query.isError && records.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-md border border-dashed px-4 py-10 text-center">
          <FileCheck2 className="size-5 text-muted-foreground" aria-hidden="true" />
          <p className="text-sm font-medium">Aucun audit externe a afficher</p>
          <RoleGate allowedRoles={["ADMIN", "RESPONSABLE"]}>
            <Button asChild size="sm">
              <Link href="/audit-externe/nouveau">Planifier un audit</Link>
            </Button>
          </RoleGate>
        </div>
      ) : null}
      {records.length > 0 ? (
        <>
          <RecordList className="md:hidden">
            {records.map((record) => (
              <article className="flex flex-col gap-2 rounded-md border bg-white p-4 shadow-sm" key={record.id}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold">{record.client.companyName}</h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {new Date(record.startDateTime).toLocaleDateString("fr-FR")} - {AUDIT_EXTERNE_TYPE_LABELS[record.typeAudit]}
                    </p>
                  </div>
                  <Badge>{AUDIT_EXTERNE_REFERENCE_LABELS[record.reference]}</Badge>
                </div>
                <dl className="grid grid-cols-2 gap-2 text-xs">
                  <div><dt className="text-muted-foreground">Organisme</dt><dd className="font-medium">{record.organisme}</dd></div>
                  <div><dt className="text-muted-foreground">Responsable</dt><dd className="font-medium">{record.responsable.name}</dd></div>
                </dl>
                <div className="grid grid-cols-2 gap-2">
                  <Button asChild size="sm" variant="outline"><Link href={`/audit-externe/${record.id}`}><Eye aria-hidden="true" />Ouvrir</Link></Button>
                  {canManageOperations ? (
                    <Button asChild size="sm" variant="outline"><Link href={`/audit-externe/${record.id}/modifier`}><Edit aria-hidden="true" />Modifier</Link></Button>
                  ) : null}
                </div>
              </article>
            ))}
          </RecordList>
          <div className="hidden overflow-x-auto rounded-md border bg-white md:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b bg-muted/60 text-xs text-muted-foreground">
                <tr>
                  <SortableHeader activeSort={sortBy} label="Client" sortDir={sortDir} value="companyName" onSort={updateSort} />
                  <SortableHeader activeSort={sortBy} label="Date d'audit" sortDir={sortDir} value="startDateTime" onSort={updateSort} />
                  <SortableHeader activeSort={sortBy} label="Type" sortDir={sortDir} value="typeAudit" onSort={updateSort} />
                  <th className="px-4 py-3 font-semibold" scope="col">Reference</th>
                  <th className="px-4 py-3 font-semibold" scope="col">Organisme</th>
                  <th className="px-4 py-3 font-semibold" scope="col">Auditeur</th>
                  <th className="px-4 py-3 font-semibold" scope="col">Responsable</th>
                  <th className="px-4 py-3 text-right font-semibold" scope="col">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {records.map((record) => (
                  <tr className="bg-white transition-colors hover:bg-brand-50/50" key={record.id}>
                    <td className="px-4 py-3 font-medium">
                      <Link className="hover:text-brand-700 hover:underline" href={`/audit-externe/${record.id}`}>{record.client.companyName}</Link>
                    </td>
                    <td className="px-4 py-3">{new Date(record.startDateTime).toLocaleDateString("fr-FR")}</td>
                    <td className="px-4 py-3">{AUDIT_EXTERNE_TYPE_LABELS[record.typeAudit]}</td>
                    <td className="px-4 py-3"><Badge>{AUDIT_EXTERNE_REFERENCE_LABELS[record.reference]}</Badge></td>
                    <td className="px-4 py-3">{record.organisme}</td>
                    <td className="px-4 py-3">{record.auditeur}</td>
                    <td className="px-4 py-3">{record.responsable.name}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <Button asChild size="sm" variant="outline"><Link href={`/audit-externe/${record.id}`}>Ouvrir</Link></Button>
                        {canManageOperations ? (
                          <>
                            <Button asChild size="sm" variant="outline"><Link href={`/audit-externe/${record.id}/modifier`}>Modifier</Link></Button>
                            <Button disabled={archiveMutation.isPending} onClick={() => archiveMutation.mutate(record.id)} size="sm" type="button" variant="danger">
                              <Archive data-icon="inline-start" />Archiver
                            </Button>
                          </>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}

      {meta ? (
        <nav className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between" aria-label="Pagination des audits">
          <p className="text-xs text-muted-foreground">
            {meta.total === 0 ? 0 : (meta.page - 1) * meta.perPage + 1}-{Math.min(meta.page * meta.perPage, meta.total)} sur {meta.total} audits
          </p>
          <div className="flex gap-2">
            <Button disabled={page <= 1} onClick={() => setPage(page - 1)} type="button" variant="outline">Precedent</Button>
            <Button disabled={page >= meta.totalPages} onClick={() => setPage(page + 1)} type="button" variant="outline">Suivant</Button>
          </div>
        </nav>
      ) : null}
    </PagePanel>
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
      <button className="inline-flex min-h-10 items-center gap-1 rounded-sm text-left hover:text-brand-700" onClick={() => onSort(value)} type="button">
        {label}
        {active ? (sortDir === "asc" ? <ArrowUp className="size-3" aria-hidden="true" /> : <ArrowDown className="size-3" aria-hidden="true" />) : null}
      </button>
    </th>
  );
}

async function exportAuditExterne(
  filters: { q: string; sortBy: SortBy; sortDir: SortDir },
  setIsExporting: (value: boolean) => void,
  setExportError: (value: string | null) => void,
) {
  setIsExporting(true);
  setExportError(null);
  try {
    const params = new URLSearchParams({ q: filters.q, sortBy: filters.sortBy, sortDir: filters.sortDir, page: "1", perPage: "100" });
    const response = await fetch(`${API_URL}/audit-externe/export.csv?${params}`, { credentials: "include" });
    if (!response.ok) throw new Error("Export impossible");
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `audit-externe-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  } catch {
    setExportError("Impossible d'exporter les audits pour le moment.");
  } finally {
    setIsExporting(false);
  }
}
