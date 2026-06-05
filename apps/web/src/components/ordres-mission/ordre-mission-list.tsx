"use client";

import Link from "next/link";
import { useDeferredValue, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileText, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { FilterBar, FilterField, PagePanel, RecordList, SectionHeader } from "@/components/layout/page-section";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api";

type Ordre = {
  id: string;
  reference: string;
  object: string;
  startDateTime: string;
  status: string;
  requiresReview: boolean;
  client: { companyName: string };
  consultants: { id: string; fullName: string }[];
};
type OrdreListResponse = { data: Ordre[] };

const formatDate = new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", year: "numeric" });

export function OrdreMissionList() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const deferredSearch = useDeferredValue(search.trim());
  const query = useQuery({
    queryKey: ["ordres-mission", deferredSearch, status],
    queryFn: () => apiFetch<OrdreListResponse>(`/ordres-mission?${new URLSearchParams({ q: deferredSearch, status, page: "1", perPage: "100" })}`),
  });

  return (
    <PagePanel as="section" className="flex flex-col gap-4" aria-labelledby="ordre-list-title">
      <SectionHeader
        count={query.data ? `${query.data.data.length} ordre${query.data.data.length > 1 ? "s" : ""}` : undefined}
        description="Brouillons generes, validations et elements necessitant une revue."
        id="ordre-list-title"
        title="Registre des ordres"
      />
      <FilterBar>
        <FilterField className="relative">
          <span>Recherche</span>
          <Search className="pointer-events-none absolute left-3 top-9 size-4 text-muted-foreground" aria-hidden="true" />
          <Input className="pl-10" onChange={(event) => setSearch(event.target.value)} placeholder="Reference, objet ou client" type="search" value={search} />
        </FilterField>
        <FilterField>
          Statut
          <select className="h-11 w-full rounded-md border bg-white px-3 text-sm font-medium normal-case tracking-normal shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" onChange={(event) => setStatus(event.target.value)} value={status}>
            <option value="ALL">Tous les statuts</option>
            <option value="DRAFT">Brouillons</option>
            <option value="VALIDATED">Valides</option>
            <option value="PRINTED">Imprimes</option>
            <option value="CANCELLED">Annules</option>
            <option value="ARCHIVED">Archives</option>
          </select>
        </FilterField>
      </FilterBar>
      {query.isPending ? <div className="flex flex-col gap-2">{[0, 1].map((index) => <Skeleton className="h-32 border" key={index} />)}</div> : null}
      {query.isError ? <p className="border-l-2 border-danger pl-3 text-sm text-danger" role="alert">Impossible de charger les ordres de mission.</p> : null}
      {query.data?.data.length === 0 ? <OrdreEmptyState /> : null}
      <RecordList>
        {query.data?.data.map((ordre) => <OrdreRow key={ordre.id} ordre={ordre} />)}
      </RecordList>
    </PagePanel>
  );
}

function OrdreRow({ ordre }: Readonly<{ ordre: Ordre }>) {
  return (
    <article className="flex flex-col gap-3 rounded-md border bg-white p-4 shadow-soft transition-colors hover:border-brand-200 hover:bg-brand-50/60 md:flex-row md:items-center md:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-semibold"><Link className="hover:text-brand-700 hover:underline" href={`/ordres-mission/${ordre.id}`}>{ordre.reference}</Link></h3>
          <Badge>{ordre.status}</Badge>
          {ordre.requiresReview ? <Badge className="border-warning bg-warning/10 text-warning">A revoir</Badge> : null}
        </div>
        <p className="mt-1 truncate text-sm">{ordre.object}</p>
        <p className="mt-1 text-xs text-muted-foreground">{ordre.client.companyName} - {ordre.consultants.map((consultant) => consultant.fullName).join(", ") || "Aucun consultant"}</p>
      </div>
      <div className="flex items-center justify-between gap-3 md:flex-col md:items-end">
        <p className="text-xs font-medium text-muted-foreground">{formatDate.format(new Date(ordre.startDateTime))}</p>
        <Link className="text-xs font-semibold text-brand-700 hover:underline" href={`/ordres-mission/${ordre.id}`}>Ouvrir</Link>
      </div>
    </article>
  );
}

function OrdreEmptyState() {
  return (
    <div className="flex flex-col items-center gap-2 rounded-md border border-dashed px-4 py-10 text-center">
      <FileText className="size-5 text-muted-foreground" aria-hidden="true" />
      <p className="text-sm font-medium">Aucun ordre de mission</p>
      <p className="text-xs text-muted-foreground">Les nouveaux ordres sont generes automatiquement depuis les missions.</p>
    </div>
  );
}
